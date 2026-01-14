from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class ClothingItem(BaseModel):
    item_id: str
    name: str
    created_at: datetime
    last_worn: Optional[datetime] = None
    wear_count: int = 0
    thumbnail_path: Optional[str] = None


class ItemImage(BaseModel):
    image_id: str
    item_id: str
    image_path: str
    uploaded_at: datetime


class CreateItemRequest(BaseModel):
    """Request for manual item creation (wear_count=0, no wear log)."""
    name: str
    image_data: Optional[str] = None
    thumbnail_image_data: Optional[str] = None


class LogWearRequest(BaseModel):
    image_data: str


class MatchResult(BaseModel):
    image_id: str
    item_id: str
    name: str
    similarity: float
    thumbnail_path: Optional[str] = None


class CroppedItem(BaseModel):
    imageData: str
    boundingBox: dict


class ProcessCropsRequest(BaseModel):
    crops: List[CroppedItem]


class UpdateItemRequest(BaseModel):
    name: Optional[str] = None


class UpdateThumbnailRequest(BaseModel):
    """Request to update item thumbnail."""
    image_id: Optional[str] = None  # Pick from existing item_images
    image_data: Optional[str] = None  # Upload custom thumbnail
    clear: Optional[bool] = None  # Revert to default behavior


class SegmentRequest(BaseModel):
    """Request for automatic clothing segmentation."""
    image_data: str  # Base64 encoded image


class SegmentedItem(BaseModel):
    """A detected clothing item from segmentation."""
    label: str  # Clothing type (e.g., "Upper-clothes", "Pants")
    score: float  # Confidence score
    imageData: str  # Base64 cropped image
    boundingBox: dict  # {x, y, width, height}


class SegmentResponse(BaseModel):
    """Response from clothing segmentation."""
    items: List[SegmentedItem]
