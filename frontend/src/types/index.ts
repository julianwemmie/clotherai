export interface ClothingItem {
  item_id: string;
  name: string;
  category: string;
  created_at: string;
  last_worn: string | null;
  wear_count: number;
  thumbnail_path: string | null;
}

export interface ItemImage {
  image_id: string;
  item_id: string;
  image_path: string;
  uploaded_at: string;
}

export interface MatchResult {
  image_id: string;
  item_id: string;
  name: string;
  category: string;
  similarity: number;
  thumbnail_path: string | null;
}

export interface CroppedItem {
  imageData: string; // base64
  category: string;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface WearLog {
  log_id: string;
  item_id: string;
  worn_date: string;
  outfit_image_path: string | null;
}
