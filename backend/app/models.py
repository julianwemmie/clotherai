from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class ClothingItem(BaseModel):
    item_id: str
    name: str
    category: str
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
    name: str
    category: str
    image_data: str


class LogWearRequest(BaseModel):
    image_data: str


class MatchResult(BaseModel):
    image_id: str
    item_id: str
    name: str
    category: str
    similarity: float
    thumbnail_path: Optional[str] = None


class CroppedItem(BaseModel):
    imageData: str
    category: str
    boundingBox: dict


class ProcessCropsRequest(BaseModel):
    crops: List[CroppedItem]


class UpdateItemRequest(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
