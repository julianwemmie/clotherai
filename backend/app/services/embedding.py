import os
import base64
import requests
from typing import List
from PIL import Image
import io

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


def generate_embedding_from_base64(image_data: str) -> List[float]:
    """
    Generate embedding from a base64-encoded image.

    Args:
        image_data: Base64 encoded image string (may include data URL prefix)

    Returns:
        List of 2048 floats representing the image embedding
    """
    # Keep the data URL format for Jina API
    if not image_data.startswith('data:'):
        # Add data URL prefix if not present
        image_data = f"data:image/jpeg;base64,{image_data}"

    payload = {
        "model": JINA_MODEL,
        "input": [{"image": image_data}],
        "normalized": True,
        "task": "retrieval.query"
    }

    response = requests.post(JINA_API_URL, headers=_get_headers(), json=payload)
    response.raise_for_status()

    result = response.json()
    return result["data"][0]["embedding"]


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