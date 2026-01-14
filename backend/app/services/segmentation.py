import os
import base64
import io
from typing import List, Dict, Any
from PIL import Image, ImageOps
import numpy as np
from huggingface_hub import InferenceClient

# Clothing labels from the segformer_b3_clothes model
CLOTHING_LABELS = {
    0: "Background",
    1: "Hat",
    2: "Hair",
    3: "Sunglasses",
    4: "Upper-clothes",
    5: "Skirt",
    6: "Pants",
    7: "Dress",
    8: "Belt",
    9: "Left-shoe",
    10: "Right-shoe",
    11: "Face",
    12: "Left-leg",
    13: "Right-leg",
    14: "Left-arm",
    15: "Right-arm",
    16: "Bag",
    17: "Scarf",
}

# Labels that represent actual clothing items (not body parts or background)
CLOTHING_ITEM_LABELS = {1, 4, 5, 6, 7, 9, 10}  # Hat, Upper-clothes, Skirt, Pants, Dress, Shoes (excluded: Sunglasses, Belt, Bag, Scarf)


def _get_client() -> InferenceClient:
    """Get HuggingFace Inference Client."""
    hf_token = os.getenv('HF_TOKEN')
    if not hf_token:
        raise ValueError("HF_TOKEN environment variable is not set")
    return InferenceClient(provider="hf-inference", api_key=hf_token)


def _image_to_bytes(image: Image.Image) -> bytes:
    """Convert PIL Image to JPEG bytes."""
    if image.mode in ('RGBA', 'LA', 'P'):
        image = image.convert('RGB')
    buffer = io.BytesIO()
    image.save(buffer, format='JPEG', quality=90)
    return buffer.getvalue()


def _base64_to_pil(image_data: str) -> Image.Image:
    """Convert base64 image data to PIL Image, handling EXIF orientation."""
    if image_data.startswith('data:'):
        # Remove data URL prefix
        image_data = image_data.split(',', 1)[1]
    image_bytes = base64.b64decode(image_data)
    image = Image.open(io.BytesIO(image_bytes))
    # Apply EXIF orientation to match browser display
    image = ImageOps.exif_transpose(image)
    return image


def _pil_to_base64(image: Image.Image) -> str:
    """Convert PIL Image to base64 data URL."""
    if image.mode in ('RGBA', 'LA', 'P'):
        image = image.convert('RGB')
    buffer = io.BytesIO()
    image.save(buffer, format='JPEG', quality=90)
    base64_data = base64.b64encode(buffer.getvalue()).decode('utf-8')
    return f"data:image/jpeg;base64,{base64_data}"


def _get_bounding_box(mask: np.ndarray) -> Dict[str, int]:
    """Get bounding box from binary mask."""
    rows = np.any(mask, axis=1)
    cols = np.any(mask, axis=0)

    if not np.any(rows) or not np.any(cols):
        return None

    y_min, y_max = np.where(rows)[0][[0, -1]]
    x_min, x_max = np.where(cols)[0][[0, -1]]

    return {
        "x": int(x_min),
        "y": int(y_min),
        "width": int(x_max - x_min + 1),
        "height": int(y_max - y_min + 1)
    }


def _merge_shoe_labels(segments: List[Dict]) -> List[Dict]:
    """Merge left and right shoe segments into a single 'Shoes' segment."""
    shoes = [s for s in segments if s['label'] in ('Left-shoe', 'Right-shoe')]
    others = [s for s in segments if s['label'] not in ('Left-shoe', 'Right-shoe')]

    if len(shoes) == 0:
        return others

    # Combine shoe masks
    combined_mask = None
    for shoe in shoes:
        if combined_mask is None:
            combined_mask = shoe['_mask'].copy()
        else:
            combined_mask = np.logical_or(combined_mask, shoe['_mask'])

    # Get combined bounding box
    bbox = _get_bounding_box(combined_mask)
    if bbox:
        others.append({
            'label': 'Shoes',
            'score': max(s['score'] for s in shoes),
            '_mask': combined_mask,
            'boundingBox': bbox
        })

    return others


def segment_clothes(image_data: str) -> List[Dict[str, Any]]:
    """
    Segment clothing items from an image using the SegFormer model.

    Args:
        image_data: Base64 encoded image string (may include data URL prefix)

    Returns:
        List of detected clothing items with:
        - label: Clothing type (e.g., "Upper-clothes", "Pants")
        - score: Confidence score
        - imageData: Base64 cropped image of the item
        - boundingBox: {x, y, width, height} in original image coordinates
    """
    import tempfile
    import os as _os

    client = _get_client()

    # Convert base64 to PIL Image
    original_image = _base64_to_pil(image_data)

    # Save to a temp file since the API needs a file path or raw bytes with proper handling
    with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as tmp:
        if original_image.mode in ('RGBA', 'LA', 'P'):
            original_image.convert('RGB').save(tmp, format='JPEG', quality=90)
        else:
            original_image.save(tmp, format='JPEG', quality=90)
        tmp_path = tmp.name

    try:
        # Run segmentation with file path
        result = client.image_segmentation(
            tmp_path,
            model="sayeed99/segformer_b3_clothes"
        )
    finally:
        _os.unlink(tmp_path)

    # Process results
    segments = []
    for item in result:
        label = item.get('label', '')
        score = item.get('score', 0)
        mask = item.get('mask')

        # Skip non-clothing labels
        label_id = None
        for lid, lname in CLOTHING_LABELS.items():
            if lname == label:
                label_id = lid
                break

        if label_id is None or label_id not in CLOTHING_ITEM_LABELS:
            continue

        if mask is None:
            continue

        # Convert mask to numpy array
        mask_array = np.array(mask)

        # Get bounding box
        bbox = _get_bounding_box(mask_array)
        if bbox is None or bbox['width'] < 20 or bbox['height'] < 20:
            continue

        segments.append({
            'label': label,
            'score': score,
            '_mask': mask_array,
            'boundingBox': bbox
        })

    # Merge left/right shoes
    segments = _merge_shoe_labels(segments)

    # Create cropped images and remove internal mask data
    results = []
    for seg in segments:
        bbox = seg['boundingBox']

        # Crop the original image
        cropped = original_image.crop((
            bbox['x'],
            bbox['y'],
            bbox['x'] + bbox['width'],
            bbox['y'] + bbox['height']
        ))

        results.append({
            'label': seg['label'],
            'score': seg['score'],
            'imageData': _pil_to_base64(cropped),
            'boundingBox': bbox
        })

    # Sort by y-position (top to bottom)
    results.sort(key=lambda x: x['boundingBox']['y'])

    return results


def segment_clothes_from_file(file_path: str) -> List[Dict[str, Any]]:
    """
    Segment clothing items from an image file.

    Args:
        file_path: Path to the image file

    Returns:
        List of detected clothing items
    """
    # Load image and handle EXIF orientation
    image = Image.open(file_path)
    image = ImageOps.exif_transpose(image)

    # Convert to base64
    buffer = io.BytesIO()
    if image.mode in ('RGBA', 'LA', 'P'):
        image = image.convert('RGB')
    image.save(buffer, format='JPEG', quality=90)
    base64_data = base64.b64encode(buffer.getvalue()).decode('utf-8')
    data_url = f"data:image/jpeg;base64,{base64_data}"

    return segment_clothes(data_url)
