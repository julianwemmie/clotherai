#!/usr/bin/env python3
"""
Fix timestamps to include UTC timezone information.

This script updates all timestamps in the database to be timezone-aware (UTC).
"""

import sys
import os
from datetime import datetime, timezone

# Add the backend directory to the path
sys.path.insert(0, os.path.dirname(__file__))

from app.database import get_db_connection


def fix_timestamps():
    """Update all timestamps to be timezone-aware UTC timestamps."""
    conn = get_db_connection()
    cursor = conn.cursor()

    # Fix clothing_items timestamps
    print("Fixing clothing_items timestamps...")

    cursor.execute("SELECT item_id, created_at, last_worn FROM clothing_items")
    items = cursor.fetchall()

    for item in items:
        item_id = item['item_id']
        created_at = item['created_at']
        last_worn = item['last_worn']

        # Parse and convert created_at
        if created_at:
            # Parse the ISO string and make it timezone-aware if it isn't
            dt = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            new_created_at = dt.isoformat()

            cursor.execute(
                "UPDATE clothing_items SET created_at = ? WHERE item_id = ?",
                (new_created_at, item_id)
            )

        # Parse and convert last_worn
        if last_worn:
            dt = datetime.fromisoformat(last_worn.replace('Z', '+00:00'))
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            new_last_worn = dt.isoformat()

            cursor.execute(
                "UPDATE clothing_items SET last_worn = ? WHERE item_id = ?",
                (new_last_worn, item_id)
            )

            print(f"  ✓ Fixed {item_id}: last_worn = {new_last_worn}")

    # Fix item_images timestamps
    print("\nFixing item_images timestamps...")
    cursor.execute("SELECT image_id, uploaded_at FROM item_images")
    images = cursor.fetchall()

    for img in images:
        image_id = img['image_id']
        uploaded_at = img['uploaded_at']

        if uploaded_at:
            dt = datetime.fromisoformat(uploaded_at.replace('Z', '+00:00'))
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            new_uploaded_at = dt.isoformat()

            cursor.execute(
                "UPDATE item_images SET uploaded_at = ? WHERE image_id = ?",
                (new_uploaded_at, image_id)
            )

    conn.commit()
    conn.close()

    print(f"\n✓ Successfully fixed {len(items)} items and {len(images)} images")


if __name__ == "__main__":
    print("Fixing timestamps to include UTC timezone...\n")
    fix_timestamps()
