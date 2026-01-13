from typing import List, Optional
import struct
from ..database import get_db_connection
from ..models import MatchResult


def serialize_embedding(embedding: List[float]) -> bytes:
    """Serialize embedding list to bytes for sqlite-vec."""
    return struct.pack(f'{len(embedding)}f', *embedding)


def find_similar_items(
    embedding: List[float],
    limit: int = 5,
    threshold: Optional[float] = 0.3
) -> List[MatchResult]:
    """
    Find the most similar clothing items to the given embedding.

    Uses sqlite-vec for efficient similarity search and de-duplicates
    results by item_id to return unique clothing items.

    Args:
        embedding: 2048-dimensional embedding vector
        limit: Maximum number of unique items to return
        threshold: Maximum cosine distance threshold (lower = more similar).
                   If None, returns all matches without filtering.

    Returns:
        List of MatchResult objects for the top matching items
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    # Serialize embedding to bytes
    embedding_bytes = serialize_embedding(embedding)

    # Query with de-duplication by item_id
    # Get top match for each distinct clothing item
    query = """
        WITH ranked_matches AS (
            SELECT
                e.image_id,
                i.item_id,
                c.name,
                c.thumbnail_path,
                e.distance,
                ROW_NUMBER() OVER (PARTITION BY i.item_id ORDER BY e.distance ASC) as rn
            FROM embeddings e
            JOIN item_images i ON e.image_id = i.image_id
            JOIN clothing_items c ON i.item_id = c.item_id
            WHERE e.embedding MATCH ?
              AND k = 20
        )
        SELECT image_id, item_id, name, thumbnail_path, distance
        FROM ranked_matches
        WHERE rn = 1
    """

    params = [embedding_bytes]

    if threshold is not None:
        query += " AND distance < ?"
        params.append(threshold)

    query += """
        ORDER BY distance ASC
        LIMIT ?
    """

    params.append(limit)

    cursor.execute(query, params)
    rows = cursor.fetchall()

    # Debug logging
    print(f"DEBUG: Similarity search query returned {len(rows)} rows")
    print(f"DEBUG: Threshold: {threshold}, Limit: {limit}")
    if rows:
        print(f"DEBUG: First match distance: {rows[0]['distance']}")

    conn.close()

    results = []
    for row in rows:
        # Convert cosine distance to similarity percentage
        # distance of 0 = 100% similar, distance of 1 = 0% similar
        similarity = max(0, (1 - row['distance'])) * 100

        results.append(MatchResult(
            image_id=row['image_id'],
            item_id=row['item_id'],
            name=row['name'],
            similarity=round(similarity, 1),
            thumbnail_path=row['thumbnail_path']
        ))

    return results


def store_embedding(image_id: str, embedding: List[float], conn=None) -> None:
    """
    Store an embedding in the database.

    Args:
        image_id: UUID of the image
        embedding: 1408-dimensional embedding vector
        conn: Optional existing database connection (to avoid locking issues)
    """
    should_close = False
    if conn is None:
        conn = get_db_connection()
        should_close = True

    cursor = conn.cursor()

    embedding_bytes = serialize_embedding(embedding)

    cursor.execute(
        "INSERT INTO embeddings (image_id, embedding) VALUES (?, ?)",
        (image_id, embedding_bytes)
    )

    if should_close:
        conn.commit()
        conn.close()


def delete_embedding(image_id: str) -> None:
    """Delete an embedding from the database."""
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("DELETE FROM embeddings WHERE image_id = ?", (image_id,))

    conn.commit()
    conn.close()
