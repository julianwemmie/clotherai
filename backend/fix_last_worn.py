#!/usr/bin/env python3
"""
Fix last_worn timestamps for existing items in the database.

This script updates items where last_worn is NULL but they have wear_logs,
setting last_worn to the most recent wear date.
"""

import sys
import os
from datetime import datetime

# Add the backend directory to the path
sys.path.insert(0, os.path.dirname(__file__))

from app.database import get_db_connection


def fix_last_worn_timestamps():
    """Update last_worn for items based on their wear_logs."""
    conn = get_db_connection()
    cursor = conn.cursor()

    # Find items with NULL last_worn but have wear logs
    cursor.execute("""
        SELECT DISTINCT c.item_id, c.name
        FROM clothing_items c
        INNER JOIN wear_logs w ON c.item_id = w.item_id
        WHERE c.last_worn IS NULL
    """)

    items_to_fix = cursor.fetchall()

    if not items_to_fix:
        print("✓ No items need fixing - all items have proper last_worn timestamps")
        conn.close()
        return

    print(f"Found {len(items_to_fix)} items with missing last_worn timestamps:")

    for item in items_to_fix:
        item_id = item['item_id']
        item_name = item['name']

        # Get the most recent wear date for this item
        cursor.execute("""
            SELECT worn_date
            FROM wear_logs
            WHERE item_id = ?
            ORDER BY worn_date DESC
            LIMIT 1
        """, (item_id,))

        latest_wear = cursor.fetchone()

        if latest_wear:
            worn_date = latest_wear['worn_date']
            # Convert date to datetime for last_worn timestamp
            last_worn_timestamp = datetime.fromisoformat(worn_date).isoformat()

            # Update the item
            cursor.execute("""
                UPDATE clothing_items
                SET last_worn = ?
                WHERE item_id = ?
            """, (last_worn_timestamp, item_id))

            print(f"  ✓ Updated '{item_name}' - set last_worn to {last_worn_timestamp}")

    conn.commit()
    conn.close()
    print(f"\n✓ Successfully updated {len(items_to_fix)} items")


if __name__ == "__main__":
    print("Fixing last_worn timestamps in database...\n")
    fix_last_worn_timestamps()
