import os
import base64
import requests
import time
import logging
from typing import List
from PIL import Image
import io

logger = logging.getLogger(__name__)

# Configuration
JINA_API_KEY = os.getenv('JINA_API_KEY')
JINA_API_URL = "https://api.jina.ai/v1/embeddings"
JINA_MODEL = os.getenv('JINA_MODEL', 'jina-embeddings-v4')

# Embedding dimensions for jina-embeddings-v4 (default 2048, can be truncated to 128)
EMBEDDING_DIMENSIONS = 2048


def _get_headers():
    """Get headers for Jina API requests."""
    if not JINA_API_KEY:
        raise ValueError("JINA_API_KEY environment variable is not set")
    return {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {JINA_API_KEY}"
    }


def _preprocess_image(image_data: str, max_size: int = 1024, quality: int = 85) -> str:
    """
    Preprocess image by resizing and recompressing.

    Args:
        image_data: Base64 encoded image string (with or without data URL prefix)
        max_size: Maximum dimension (width or height)
        quality: JPEG quality (1-100)

    Returns:
        Preprocessed base64 data URL
    """
    # Extract base64 data
    if ',' in image_data:
        base64_data = image_data.split(',')[1]
    else:
        base64_data = image_data

    # Decode and open image
    image_bytes = base64.b64decode(base64_data)
    image = Image.open(io.BytesIO(image_bytes))

    # Convert to RGB if necessary
    if image.mode in ('RGBA', 'LA', 'P'):
        image = image.convert('RGB')

    # Resize if larger than max_size
    if max(image.size) > max_size:
        ratio = max_size / max(image.size)
        new_size = (int(image.width * ratio), int(image.height * ratio))
        image = image.resize(new_size, Image.Resampling.LANCZOS)

    # Recompress as JPEG
    buffer = io.BytesIO()
    image.save(buffer, format='JPEG', quality=quality)
    new_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')

    return f"data:image/jpeg;base64,{new_base64}"


def generate_embedding_from_base64(image_data: str, max_retries: int = 3) -> List[float]:
    """
    Generate embedding from a base64-encoded image.

    Args:
        image_data: Base64 encoded image string (may include data URL prefix)
        max_retries: Maximum number of retry attempts

    Returns:
        List of 2048 floats representing the image embedding
    """
    # Always preprocess images to ensure consistent format for Jina API
    # This normalizes the image format and reduces size to avoid API issues
    image_data = _preprocess_image(image_data, max_size=1024, quality=90)

    payload = {
        "model": JINA_MODEL,
        "input": [{"image": image_data}],
        "normalized": True,
    }

    last_error = None
    for attempt in range(max_retries):
        if attempt > 0:
            # Exponential backoff: 2, 4, 8 seconds
            wait_time = 2 ** attempt
            logger.info(f"Retry attempt {attempt + 1}/{max_retries} after {wait_time}s wait...")
            time.sleep(wait_time)

        response = requests.post(JINA_API_URL, headers=_get_headers(), json=payload)

        if response.ok:
            result = response.json()
            return result["data"][0]["embedding"]

        last_error = response
        logger.warning(f"Jina API error: {response.status_code}")

    # All retries failed
    logger.error(f"Jina API error after {max_retries} attempts: {last_error.status_code}")
    logger.error(f"Response body: {last_error.text}")
    last_error.raise_for_status()
    # raise_for_status() will raise an exception, but add explicit raise for type checker
    raise RuntimeError(f"Jina API request failed with status {last_error.status_code}")


def generate_embedding_from_file(file_path: str) -> List[float]:
    """
    Generate embedding from an image file.

    Args:
        file_path: Path to the image file

    Returns:
        List of 2048 floats representing the image embedding
    """
    # Read and encode the image as base64
    with open(file_path, 'rb') as f:
        image_bytes = f.read()

    # Determine mime type from extension
    ext = file_path.lower().split('.')[-1]
    mime_type = 'image/jpeg' if ext in ('jpg', 'jpeg') else f'image/{ext}'

    base64_data = base64.b64encode(image_bytes).decode('utf-8')
    data_url = f"data:{mime_type};base64,{base64_data}"

    return generate_embedding_from_base64(data_url)


def generate_embedding_from_pil(image: Image.Image) -> List[float]:
    """
    Generate embedding from a PIL Image.

    Args:
        image: PIL Image object

    Returns:
        List of 2048 floats representing the image embedding
    """
    # Convert PIL image to bytes
    buffer = io.BytesIO()
    # Save as JPEG for efficiency
    if image.mode in ('RGBA', 'LA', 'P'):
        image = image.convert('RGB')
    image.save(buffer, format='JPEG', quality=85)
    image_bytes = buffer.getvalue()

    # Encode as base64 data URL
    base64_data = base64.b64encode(image_bytes).decode('utf-8')
    data_url = f"data:image/jpeg;base64,{base64_data}"

    return generate_embedding_from_base64(data_url)