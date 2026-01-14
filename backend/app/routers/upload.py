from fastapi import APIRouter, UploadFile, File, HTTPException
from pathlib import Path
import uuid
import os
from PIL import Image
import io

from ..models import SegmentRequest, SegmentResponse, SegmentedItem
from ..services.segmentation import segment_clothes

router = APIRouter(prefix="/api", tags=["upload"])

IMAGES_PATH = os.getenv('IMAGES_PATH', '../data/images')
TEMP_PATH = os.getenv('TEMP_PATH', '../data/temp')


@router.post("/upload")
async def upload_photo(file: UploadFile = File(...)):
    """Upload an outfit photo for processing."""
    # Validate file type
    if file.content_type not in ["image/jpeg", "image/png"]:
        raise HTTPException(
            status_code=400,
            detail="Invalid file type. Only JPEG and PNG are supported."
        )

    # Validate file size (max 10MB)
    contents = await file.read()
    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(
            status_code=400,
            detail="File too large. Maximum size is 10MB."
        )

    # Validate it's actually an image
    try:
        image = Image.open(io.BytesIO(contents))
        image.verify()
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Invalid image file."
        )

    # Create temp directory if it doesn't exist
    temp_dir = Path(TEMP_PATH)
    temp_dir.mkdir(parents=True, exist_ok=True)

    # Generate unique filename
    file_ext = ".jpg" if file.content_type == "image/jpeg" else ".png"
    filename = f"{uuid.uuid4()}{file_ext}"
    file_path = temp_dir / filename

    # Save the file
    with open(file_path, "wb") as f:
        f.write(contents)

    return {
        "image_path": str(file_path),
        "filename": filename
    }


@router.post("/segment", response_model=SegmentResponse)
async def segment_image(request: SegmentRequest):
    """
    Automatically segment clothing items from an image.

    Uses the SegFormer B3 Clothes model to detect and segment
    clothing items like shirts, pants, shoes, etc.

    Returns cropped images and bounding boxes for each detected item.
    """
    try:
        items = segment_clothes(request.image_data)

        return SegmentResponse(
            items=[
                SegmentedItem(
                    label=item['label'],
                    score=item['score'],
                    imageData=item['imageData'],
                    boundingBox=item['boundingBox']
                )
                for item in items
            ]
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Segmentation failed: {str(e)}"
        )
