import sqlite3
from app.database import get_db_connection
import numpy as np
import uuid

def test_database():
    """Test database schema and sqlite-vec operations."""
    print("Testing database connection and schema...")

    conn = get_db_connection()
    cursor = conn.cursor()

    # Test 1: Verify tables exist
    print("\n1. Verifying tables...")
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = cursor.fetchall()
    print(f"Found tables: {[table['name'] for table in tables]}")

    # Test 2: Insert a test clothing item
    print("\n2. Inserting test clothing item...")
    item_id = str(uuid.uuid4())
    cursor.execute('''
        INSERT INTO clothing_items (item_id, name, category)
        VALUES (?, ?, ?)
    ''', (item_id, "Test Blue Shirt", "top"))
    conn.commit()
    print(f"Inserted item with ID: {item_id}")

    # Test 3: Insert a test image
    print("\n3. Inserting test image...")
    image_id = str(uuid.uuid4())
    cursor.execute('''
        INSERT INTO item_images (image_id, item_id, image_path)
        VALUES (?, ?, ?)
    ''', (image_id, item_id, f"/images/{item_id}/{image_id}.jpg"))
    conn.commit()
    print(f"Inserted image with ID: {image_id}")

    # Test 4: Insert a test embedding vector
    print("\n4. Testing sqlite-vec with embedding insertion...")
    test_embedding = np.random.rand(1408).astype(np.float32).tolist()

    # Convert to the format sqlite-vec expects
    embedding_blob = np.array(test_embedding, dtype=np.float32).tobytes()

    cursor.execute('''
        INSERT INTO embeddings (image_id, embedding)
        VALUES (?, ?)
    ''', (image_id, embedding_blob))
    conn.commit()
    print(f"Inserted embedding for image {image_id}")

    # Test 5: Query the embedding back
    print("\n5. Querying embedding...")
    cursor.execute('SELECT image_id FROM embeddings WHERE image_id = ?', (image_id,))
    result = cursor.fetchone()
    print(f"Successfully retrieved embedding for image: {result['image_id']}")

    # Test 6: Test vector similarity search
    print("\n6. Testing vector similarity search...")
    query_embedding = np.random.rand(1408).astype(np.float32).tobytes()

    # Perform a similarity search
    cursor.execute('''
        SELECT image_id, distance
        FROM embeddings
        WHERE embedding MATCH ?
        ORDER BY distance
        LIMIT 5
    ''', (query_embedding,))

    results = cursor.fetchall()
    print(f"Similarity search returned {len(results)} results")
    for i, row in enumerate(results, 1):
        print(f"  {i}. Image {row['image_id']}: distance={row['distance']:.4f}")

    # Test 7: Clean up test data
    print("\n7. Cleaning up test data...")
    cursor.execute('DELETE FROM embeddings WHERE image_id = ?', (image_id,))
    cursor.execute('DELETE FROM item_images WHERE image_id = ?', (image_id,))
    cursor.execute('DELETE FROM clothing_items WHERE item_id = ?', (item_id,))
    conn.commit()
    print("Test data cleaned up")

    conn.close()
    print("\n✓ All database tests passed!")

if __name__ == "__main__":
    test_database()
