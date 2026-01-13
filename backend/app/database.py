import sqlite3
import os
from pathlib import Path
import sqlite_vec

DATABASE_PATH = os.getenv('DATABASE_PATH', '../data/clotherai.db')
IMAGES_PATH = os.getenv('IMAGES_PATH', '../data/images')


def get_db_connection():
    """Get a database connection with sqlite-vec extension loaded."""
    db_path = Path(DATABASE_PATH)
    db_path.parent.mkdir(parents=True, exist_ok=True)

    conn = sqlite3.connect(db_path, check_same_thread=False)
    conn.row_factory = sqlite3.Row

    # Load sqlite-vec extension
    try:
        conn.enable_load_extension(True)
        sqlite_vec.load(conn)
        conn.enable_load_extension(False)
    except AttributeError:
        # If enable_load_extension is not available, use direct loading
        sqlite_vec.load(conn)

    return conn


def init_database():
    """Initialize the database with required tables."""
    conn = get_db_connection()
    cursor = conn.cursor()

    # Create clothing_items table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS clothing_items (
            item_id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            category TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_worn TIMESTAMP,
            wear_count INTEGER DEFAULT 0,
            thumbnail_path TEXT
        )
    ''')

    # Create item_images table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS item_images (
            image_id TEXT PRIMARY KEY,
            item_id TEXT NOT NULL,
            image_path TEXT NOT NULL,
            uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (item_id) REFERENCES clothing_items(item_id)
        )
    ''')

    # Create embeddings virtual table using sqlite-vec
    # Using 2048 dimensions for Jina Embeddings v4
    cursor.execute('''
        CREATE VIRTUAL TABLE IF NOT EXISTS embeddings USING vec0(
            image_id TEXT PRIMARY KEY,
            embedding FLOAT[2048]
        )
    ''')

    # Create wear_logs table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS wear_logs (
            log_id TEXT PRIMARY KEY,
            item_id TEXT NOT NULL,
            worn_date DATE NOT NULL,
            outfit_image_path TEXT,
            FOREIGN KEY (item_id) REFERENCES clothing_items(item_id)
        )
    ''')

    conn.commit()
    conn.close()

    # Create images directory
    images_dir = Path(IMAGES_PATH)
    images_dir.mkdir(parents=True, exist_ok=True)

    print(f"Database initialized at {DATABASE_PATH}")
    print(f"Images directory created at {IMAGES_PATH}")


if __name__ == "__main__":
    init_database()
