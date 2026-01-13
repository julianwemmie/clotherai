from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pathlib import Path
from typing import List
import uuid
import base64
import os
from datetime import datetime, date, timezone

from ..models import (
    ClothingItem, CreateItemRequest, LogWearRequest,
    ProcessCropsRequest, MatchResult, UpdateItemRequest
)
from ..database import get_db_connection
from ..services.embedding import generate_embedding_from_base64
from ..services.matching import find_similar_items, store_embedding

router = APIRouter(prefix="/api", tags=["items"])

IMAGES_PATH = os.getenv('IMAGES_PATH', '../data/images')


def save_image_from_base64(image_data: str, item_id: str, image_id: str) -> str:
    """Save base64 image to disk and return the path."""
    # Remove data URL prefix if present
    if ',' in image_data:
        image_data = image_data.split(',')[1]

    # Decode base64
    image_bytes = base64.b64decode(image_data)

    # Create item directory
    item_dir = Path(IMAGES_PATH) / item_id
    item_dir.mkdir(parents=True, exist_ok=True)

    # Save image
    image_path = item_dir / f"{image_id}.jpg"
    with open(image_path, 'wb') as f:
        f.write(image_bytes)

    return str(image_path)


@router.post("/process-crops")
async def process_crops(request: ProcessCropsRequest) -> dict:
    """
    Process cropped images: generate embeddings and find matches.

    For debugging: Returns all matches without threshold filtering,
    showing similarity scores for all items in the wardrobe.
    """
    all_matches: List[List[MatchResult]] = []

    for crop in request.crops:
        # Generate embedding for this crop
        embedding = generate_embedding_from_base64(crop.imageData)

        # Find similar items without threshold filtering for debugging
        matches = find_similar_items(
            embedding=embedding,
            limit=20,  # Increased limit to see more matches
            category=crop.category if crop.category else None,
            threshold=None  # No threshold - return all matches for debugging
        )

        all_matches.append(matches)

    return {"matches": all_matches}


@router.post("/items/create")
async def create_item(request: CreateItemRequest) -> ClothingItem:
    """Create a new clothing item with its first reference image."""
    conn = get_db_connection()
    cursor = conn.cursor()

    # Generate UUIDs
    item_id = str(uuid.uuid4())
    image_id = str(uuid.uuid4())

    # Save image to disk
    image_path = save_image_from_base64(request.image_data, item_id, image_id)

    # Generate embedding
    embedding = generate_embedding_from_base64(request.image_data)

    # Insert clothing item with initial wear timestamp
    now = datetime.now(timezone.utc).isoformat()
    cursor.execute(
        """INSERT INTO clothing_items
           (item_id, name, category, created_at, last_worn, wear_count)
           VALUES (?, ?, ?, ?, ?, 1)""",
        (item_id, request.name, request.category, now, now)
    )

    # Insert image reference
    cursor.execute(
        """INSERT INTO item_images
           (image_id, item_id, image_path, uploaded_at)
           VALUES (?, ?, ?, ?)""",
        (image_id, item_id, image_path, now)
    )

    # Store embedding (pass connection to avoid db lock)
    store_embedding(image_id, embedding, conn)

    # Log initial wear event
    log_id = str(uuid.uuid4())
    cursor.execute(
        """INSERT INTO wear_logs
           (log_id, item_id, worn_date)
           VALUES (?, ?, ?)""",
        (log_id, item_id, date.today().isoformat())
    )

    conn.commit()
    conn.close()

    return ClothingItem(
        item_id=item_id,
        name=request.name,
        category=request.category,
        created_at=datetime.fromisoformat(now),
        last_worn=datetime.fromisoformat(now),
        wear_count=1,
        thumbnail_path=None
    )


@router.post("/items/{item_id}/wear")
async def log_wear(item_id: str, request: LogWearRequest) -> dict:
    """
    Log a wear event for an existing item.

    Also saves a new reference image to improve future matching.
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    # Verify item exists
    cursor.execute("SELECT item_id FROM clothing_items WHERE item_id = ?", (item_id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Item not found")

    # Save new reference image
    image_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    image_path = save_image_from_base64(request.image_data, item_id, image_id)

    # Insert image reference
    cursor.execute(
        """INSERT INTO item_images
           (image_id, item_id, image_path, uploaded_at)
           VALUES (?, ?, ?, ?)""",
        (image_id, item_id, image_path, now)
    )

    # Generate and store embedding for new image (pass connection to avoid db lock)
    embedding = generate_embedding_from_base64(request.image_data)
    store_embedding(image_id, embedding, conn)

    # Update item wear stats
    cursor.execute(
        """UPDATE clothing_items
           SET wear_count = wear_count + 1, last_worn = ?
           WHERE item_id = ?""",
        (now, item_id)
    )

    # Log wear event
    log_id = str(uuid.uuid4())
    cursor.execute(
        """INSERT INTO wear_logs
           (log_id, item_id, worn_date)
           VALUES (?, ?, ?)""",
        (log_id, item_id, date.today().isoformat())
    )

    conn.commit()
    conn.close()

    return {"success": True, "message": "Wear logged successfully"}


@router.put("/items/{item_id}")
async def update_item(item_id: str, request: UpdateItemRequest) -> ClothingItem:
    """Update a clothing item's details (name and/or category)."""
    conn = get_db_connection()
    cursor = conn.cursor()

    # Verify item exists
    cursor.execute(
        """SELECT item_id, name, category, created_at, last_worn,
                  wear_count, thumbnail_path
           FROM clothing_items
           WHERE item_id = ?""",
        (item_id,)
    )
    row = cursor.fetchone()

    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Item not found")

    # Build update query dynamically based on provided fields
    updates = []
    params = []

    if request.name is not None:
        updates.append("name = ?")
        params.append(request.name)

    if request.category is not None:
        updates.append("category = ?")
        params.append(request.category)

    if not updates:
        # No updates requested, return current item
        conn.close()
        return ClothingItem(
            item_id=row['item_id'],
            name=row['name'],
            category=row['category'],
            created_at=datetime.fromisoformat(row['created_at']) if row['created_at'] else datetime.now(timezone.utc),
            last_worn=datetime.fromisoformat(row['last_worn']) if row['last_worn'] else None,
            wear_count=row['wear_count'],
            thumbnail_path=row['thumbnail_path']
        )

    # Execute update
    params.append(item_id)
    query = f"UPDATE clothing_items SET {', '.join(updates)} WHERE item_id = ?"
    cursor.execute(query, params)
    conn.commit()

    # Fetch updated item
    cursor.execute(
        """SELECT item_id, name, category, created_at, last_worn,
                  wear_count, thumbnail_path
           FROM clothing_items
           WHERE item_id = ?""",
        (item_id,)
    )
    row = cursor.fetchone()
    conn.close()

    return ClothingItem(
        item_id=row['item_id'],
        name=row['name'],
        category=row['category'],
        created_at=datetime.fromisoformat(row['created_at']) if row['created_at'] else datetime.now(timezone.utc),
        last_worn=datetime.fromisoformat(row['last_worn']) if row['last_worn'] else None,
        wear_count=row['wear_count'],
        thumbnail_path=row['thumbnail_path']
    )


@router.get("/items")
async def get_all_items() -> List[ClothingItem]:
    """Get all clothing items in the wardrobe."""
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute(
        """SELECT item_id, name, category, created_at, last_worn,
                  wear_count, thumbnail_path
           FROM clothing_items
           ORDER BY created_at DESC"""
    )

    rows = cursor.fetchall()
    conn.close()

    items = []
    for row in rows:
        items.append(ClothingItem(
            item_id=row['item_id'],
            name=row['name'],
            category=row['category'],
            created_at=datetime.fromisoformat(row['created_at']) if row['created_at'] else datetime.now(timezone.utc),
            last_worn=datetime.fromisoformat(row['last_worn']) if row['last_worn'] else None,
            wear_count=row['wear_count'],
            thumbnail_path=row['thumbnail_path']
        ))

    return items


@router.get("/items/{item_id}")
async def get_item(item_id: str) -> dict:
    """Get a single item with all its reference images."""
    conn = get_db_connection()
    cursor = conn.cursor()

    # Get item details
    cursor.execute(
        """SELECT item_id, name, category, created_at, last_worn,
                  wear_count, thumbnail_path
           FROM clothing_items
           WHERE item_id = ?""",
        (item_id,)
    )

    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Item not found")

    # Get all reference images for this item
    cursor.execute(
        """SELECT image_id, image_path, uploaded_at
           FROM item_images
           WHERE item_id = ?
           ORDER BY uploaded_at DESC""",
        (item_id,)
    )

    images = cursor.fetchall()
    conn.close()

    return {
        "item": ClothingItem(
            item_id=row['item_id'],
            name=row['name'],
            category=row['category'],
            created_at=datetime.fromisoformat(row['created_at']) if row['created_at'] else datetime.now(timezone.utc),
            last_worn=datetime.fromisoformat(row['last_worn']) if row['last_worn'] else None,
            wear_count=row['wear_count'],
            thumbnail_path=row['thumbnail_path']
        ),
        "images": [
            {
                "image_id": img['image_id'],
                "image_path": img['image_path'],
                "uploaded_at": img['uploaded_at']
            }
            for img in images
        ]
    }


@router.get("/items/{item_id}/thumbnail")
async def get_item_thumbnail(item_id: str):
    """Get the thumbnail image for an item."""
    conn = get_db_connection()
    cursor = conn.cursor()

    # First check for AI-generated thumbnail
    cursor.execute(
        "SELECT thumbnail_path FROM clothing_items WHERE item_id = ?",
        (item_id,)
    )
    row = cursor.fetchone()

    if row and row['thumbnail_path']:
        thumbnail_path = Path(row['thumbnail_path'])
        if thumbnail_path.exists():
            conn.close()
            return FileResponse(thumbnail_path)

    # Fall back to first reference image
    cursor.execute(
        """SELECT image_path FROM item_images
           WHERE item_id = ?
           ORDER BY uploaded_at ASC
           LIMIT 1""",
        (item_id,)
    )
    row = cursor.fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=404, detail="No image found for item")

    image_path = Path(row['image_path'])
    if not image_path.exists():
        raise HTTPException(status_code=404, detail="Image file not found")

    return FileResponse(image_path)
