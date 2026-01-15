from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pathlib import Path
from typing import List
import uuid
import base64
import os
import shutil
from datetime import datetime, date, timezone

from ..models import (
    ClothingItem, CreateItemRequest, LogWearRequest,
    ProcessCropsRequest, MatchResult, UpdateItemRequest, UpdateThumbnailRequest
)
from ..database import get_db_connection
from ..services.embedding import generate_embedding_from_base64
from ..services.matching import find_similar_items, store_embedding
from ..services.gemini import generate_product_thumbnail
import logging

logger = logging.getLogger(__name__)

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


def is_path_safe(path: Path, base_path: Path) -> bool:
    """Check if a path is safely within the base path (no directory traversal)."""
    try:
        resolved_path = path.resolve()
        resolved_base = base_path.resolve()
        return str(resolved_path).startswith(str(resolved_base))
    except (OSError, ValueError):
        return False


@router.post("/process-crops")
async def process_crops(request: ProcessCropsRequest) -> dict:
    """
    Process cropped images: generate embeddings and find matches.
    No category filtering - matches against all items.
    """
    all_matches: List[List[MatchResult]] = []

    for crop in request.crops:
        # Generate embedding for this crop
        embedding = generate_embedding_from_base64(crop.imageData)

        # Find similar items without category filtering
        matches = find_similar_items(
            embedding=embedding,
            limit=20,
            threshold=None  # No threshold - return all matches for debugging
        )

        all_matches.append(matches)

    return {"matches": all_matches}


@router.post("/items")
async def create_item(request: CreateItemRequest) -> ClothingItem:
    """
    Create a new clothing item (manual add).

    This is for manually adding items to the wardrobe.
    - wear_count is always 0
    - last_worn is always NULL
    - No wear_logs entry is created

    If image_data is provided, it becomes a reference image with embedding.
    If thumbnail_image_data is provided, it becomes the custom thumbnail.
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    # Generate UUIDs
    item_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    thumbnail_path = None

    # Handle thumbnail if provided
    if request.thumbnail_image_data:
        thumb_id = str(uuid.uuid4())
        thumbnail_path = save_image_from_base64(
            request.thumbnail_image_data, item_id, f"thumb_{thumb_id}"
        )

    # Insert clothing item with wear stats at zero
    cursor.execute(
        """INSERT INTO clothing_items
           (item_id, name, category, created_at, last_worn, wear_count, thumbnail_path)
           VALUES (?, ?, NULL, ?, NULL, 0, ?)""",
        (item_id, request.name, now, thumbnail_path)
    )

    # Handle reference image if provided
    if request.image_data:
        image_id = str(uuid.uuid4())
        image_path = save_image_from_base64(request.image_data, item_id, image_id)

        # Insert image reference
        cursor.execute(
            """INSERT INTO item_images
               (image_id, item_id, image_path, uploaded_at)
               VALUES (?, ?, ?, ?)""",
            (image_id, item_id, image_path, now)
        )

        # Generate and store embedding
        embedding = generate_embedding_from_base64(request.image_data)
        store_embedding(image_id, embedding, conn)

    conn.commit()
    conn.close()

    return ClothingItem(
        item_id=item_id,
        name=request.name,
        created_at=datetime.fromisoformat(now),
        last_worn=None,
        wear_count=0,
        thumbnail_path=thumbnail_path
    )


@router.post("/items/create")
async def create_item_from_crop(request: CreateItemRequest) -> ClothingItem:
    """
    Create a new clothing item from a crop (upload flow).

    This creates the item AND logs the first wear.
    - wear_count is 1
    - last_worn is set to now
    - A wear_logs entry is created

    Kept for backwards compatibility with the crop flow.
    """
    if not request.image_data:
        raise HTTPException(status_code=400, detail="image_data is required for creating from crop")

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
           VALUES (?, ?, NULL, ?, ?, 1)""",
        (item_id, request.name, now, now)
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
    """Update a clothing item's name."""
    conn = get_db_connection()
    cursor = conn.cursor()

    # Verify item exists
    cursor.execute(
        """SELECT item_id, name, created_at, last_worn,
                  wear_count, thumbnail_path
           FROM clothing_items
           WHERE item_id = ?""",
        (item_id,)
    )
    row = cursor.fetchone()

    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Item not found")

    # Update name if provided
    if request.name is not None:
        cursor.execute(
            "UPDATE clothing_items SET name = ? WHERE item_id = ?",
            (request.name, item_id)
        )
        conn.commit()

    # Fetch updated item
    cursor.execute(
        """SELECT item_id, name, created_at, last_worn,
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
        created_at=datetime.fromisoformat(row['created_at']) if row['created_at'] else datetime.now(timezone.utc),
        last_worn=datetime.fromisoformat(row['last_worn']) if row['last_worn'] else None,
        wear_count=row['wear_count'],
        thumbnail_path=row['thumbnail_path']
    )


@router.put("/items/{item_id}/thumbnail")
async def update_thumbnail(item_id: str, request: UpdateThumbnailRequest) -> dict:
    """
    Update the thumbnail for an item.

    Options:
    - image_id: Pick from existing item_images
    - image_data: Upload a custom thumbnail
    - clear: Revert to default behavior (use first reference image)
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    # Verify item exists
    cursor.execute(
        "SELECT item_id, thumbnail_path FROM clothing_items WHERE item_id = ?",
        (item_id,)
    )
    row = cursor.fetchone()

    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Item not found")

    old_thumbnail_path = row['thumbnail_path']
    new_thumbnail_path = None

    if request.clear:
        # Clear custom thumbnail - will fall back to first reference image
        new_thumbnail_path = None

    elif request.image_id:
        # Pick from existing item_images
        cursor.execute(
            "SELECT image_path FROM item_images WHERE image_id = ? AND item_id = ?",
            (request.image_id, item_id)
        )
        img_row = cursor.fetchone()
        if not img_row:
            conn.close()
            raise HTTPException(status_code=404, detail="Image not found for this item")
        new_thumbnail_path = img_row['image_path']

    elif request.image_data:
        # Upload custom thumbnail
        thumb_id = str(uuid.uuid4())
        new_thumbnail_path = save_image_from_base64(
            request.image_data, item_id, f"thumb_{thumb_id}"
        )
    else:
        conn.close()
        raise HTTPException(
            status_code=400,
            detail="Must provide image_id, image_data, or clear=true"
        )

    # Update thumbnail path
    cursor.execute(
        "UPDATE clothing_items SET thumbnail_path = ? WHERE item_id = ?",
        (new_thumbnail_path, item_id)
    )
    conn.commit()

    # Delete old custom thumbnail file if it was a custom upload (contains "thumb_")
    # and the new path is different
    if old_thumbnail_path and old_thumbnail_path != new_thumbnail_path:
        old_path = Path(old_thumbnail_path)
        base_path = Path(IMAGES_PATH).resolve()
        if "thumb_" in old_path.name and is_path_safe(old_path, base_path):
            try:
                old_path.unlink(missing_ok=True)
            except OSError:
                pass  # Ignore deletion errors

    conn.close()

    return {"success": True, "thumbnail_path": new_thumbnail_path}


@router.post("/items/{item_id}/generate-thumbnail")
async def generate_item_thumbnail(item_id: str) -> dict:
    """
    Generate an AI-powered product-style thumbnail from the most recent reference image.
    Returns base64 image data for preview (user must save explicitly).
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    # Verify item exists
    cursor.execute("SELECT item_id FROM clothing_items WHERE item_id = ?", (item_id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Item not found")

    # Get most recent reference image
    cursor.execute(
        "SELECT image_path FROM item_images WHERE item_id = ? ORDER BY uploaded_at DESC LIMIT 1",
        (item_id,)
    )
    row = cursor.fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=404, detail="No reference image found. Please add a reference image first.")

    # Verify image file exists
    image_path = Path(row['image_path'])
    if not image_path.exists():
        raise HTTPException(status_code=404, detail="Image file not found")

    # Generate thumbnail using Replicate
    try:
        generated_thumbnail = generate_product_thumbnail(str(image_path))
        return {"success": True, "image_data": generated_thumbnail}
    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e))  # REPLICATE_API_TOKEN not set
    except Exception as e:
        logger.error(f"Replicate thumbnail generation failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate thumbnail. Please try again.")


@router.delete("/items/{item_id}")
async def delete_item(item_id: str) -> dict:
    """
    Hard delete an item and all associated data.

    Deletes:
    - wear_logs rows
    - embeddings rows (for all item_images)
    - item_images rows
    - clothing_items row
    - All app-managed files on disk
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    # Verify item exists
    cursor.execute(
        "SELECT item_id, thumbnail_path FROM clothing_items WHERE item_id = ?",
        (item_id,)
    )
    row = cursor.fetchone()

    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Item not found")

    thumbnail_path = row['thumbnail_path']

    # Get all image paths and IDs for this item
    cursor.execute(
        "SELECT image_id, image_path FROM item_images WHERE item_id = ?",
        (item_id,)
    )
    images = cursor.fetchall()
    image_ids = [img['image_id'] for img in images]
    image_paths = [img['image_path'] for img in images]

    # Delete wear_logs
    cursor.execute("DELETE FROM wear_logs WHERE item_id = ?", (item_id,))

    # Delete embeddings for all images
    for image_id in image_ids:
        cursor.execute("DELETE FROM embeddings WHERE image_id = ?", (image_id,))

    # Delete item_images
    cursor.execute("DELETE FROM item_images WHERE item_id = ?", (item_id,))

    # Delete clothing_item
    cursor.execute("DELETE FROM clothing_items WHERE item_id = ?", (item_id,))

    conn.commit()
    conn.close()

    # Delete files on disk (only if within app-managed directory)
    base_path = Path(IMAGES_PATH).resolve()

    for img_path in image_paths:
        path = Path(img_path)
        if is_path_safe(path, base_path):
            try:
                path.unlink(missing_ok=True)
            except OSError:
                pass  # Ignore deletion errors

    # Delete custom thumbnail if set and within app storage
    if thumbnail_path:
        thumb_path = Path(thumbnail_path)
        if is_path_safe(thumb_path, base_path):
            try:
                thumb_path.unlink(missing_ok=True)
            except OSError:
                pass

    # Try to remove the item directory if empty
    item_dir = base_path / item_id
    if item_dir.exists() and item_dir.is_dir():
        try:
            item_dir.rmdir()  # Only removes if empty
        except OSError:
            pass  # Directory not empty or other error

    return {"success": True, "message": "Item deleted successfully"}


@router.get("/items")
async def get_all_items() -> List[ClothingItem]:
    """Get all clothing items in the wardrobe."""
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute(
        """SELECT item_id, name, created_at, last_worn,
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
        """SELECT item_id, name, created_at, last_worn,
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


@router.get("/items/{item_id}/images/{image_id}")
async def get_item_image(item_id: str, image_id: str):
    """Get a reference image for an item."""
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute(
        "SELECT image_path FROM item_images WHERE item_id = ? AND image_id = ?",
        (item_id, image_id)
    )
    row = cursor.fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=404, detail="Image not found")

    image_path = Path(row['image_path'])
    base_path = Path(IMAGES_PATH).resolve()

    if not is_path_safe(image_path, base_path):
        raise HTTPException(status_code=400, detail="Invalid image path")

    if not image_path.exists():
        raise HTTPException(status_code=404, detail="Image file not found")

    return FileResponse(image_path)


@router.get("/items/{item_id}/thumbnail")
async def get_item_thumbnail(item_id: str):
    """Get the thumbnail image for an item."""
    conn = get_db_connection()
    cursor = conn.cursor()

    # First check for custom thumbnail
    cursor.execute(
        "SELECT thumbnail_path FROM clothing_items WHERE item_id = ?",
        (item_id,)
    )
    row = cursor.fetchone()

    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Item not found")

    if row['thumbnail_path']:
        thumbnail_path = Path(row['thumbnail_path'])
        if thumbnail_path.exists():
            conn.close()
            return FileResponse(thumbnail_path)

    # Fall back to first reference image (oldest)
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
