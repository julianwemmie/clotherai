import os
import base64
import time
import logging
import replicate

logger = logging.getLogger(__name__)

# Configuration
REPLICATE_API_TOKEN = os.getenv('REPLICATE_API_TOKEN')

# Prompt for product-style thumbnails
PRODUCT_THUMBNAIL_PROMPT = """Create a professional product photograph of this clothing item on a pure white background.
Preserve all details and textures. Remove any person or mannequin, showing only the garment flat lay style."""


def _detect_mime_type(image_bytes: bytes) -> str:
    if image_bytes.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if image_bytes.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    return "image/png"


def generate_product_thumbnail(image_path: str, max_retries: int = 3) -> str:
    """
    Generate a product-style thumbnail using Replicate's nano-banana model.

    Args:
        image_path: Path to the image file on disk
        max_retries: Maximum number of retry attempts

    Returns:
        Base64 data URL of the generated thumbnail (data:image/<type>;base64,...)

    Raises:
        ValueError: If REPLICATE_API_TOKEN is not set
        RuntimeError: If generation fails after all retries
    """
    if not REPLICATE_API_TOKEN:
        raise ValueError("REPLICATE_API_TOKEN environment variable is not set. AI thumbnail generation is not available.")

    last_error = None
    for attempt in range(max_retries):
        if attempt > 0:
            # Exponential backoff: 2, 4, 8 seconds
            wait_time = 2 ** attempt
            logger.info(f"Retry attempt {attempt + 1}/{max_retries} after {wait_time}s wait...")
            time.sleep(wait_time)

        try:
            # Open file and pass to Replicate
            with open(image_path, 'rb') as f:
                output = replicate.run(
                    "google/nano-banana",
                    input={
                        "prompt": PRODUCT_THUMBNAIL_PROMPT,
                        "image_input": [f]
                    }
                )

            # Output is a FileOutput object, read the bytes
            image_bytes = output.read()    

            # Convert to base64 data URL
            generated_base64 = base64.b64encode(image_bytes).decode('utf-8')
            mime_type = _detect_mime_type(image_bytes)
            return f"data:{mime_type};base64,{generated_base64}"

        except Exception as e:
            last_error = e
            logger.warning(f"Replicate API error on attempt {attempt + 1}: {e}")
            continue

    # All retries failed
    logger.error(f"Replicate API error after {max_retries} attempts: {last_error}")
    raise RuntimeError(f"Failed to generate thumbnail after {max_retries} attempts: {last_error}")
