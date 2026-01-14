import axios from 'axios';
import type { ClothingItem, MatchResult, CroppedItem, ItemImage, SegmentedItem } from '../types/index.js';

const API_BASE_URL = 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const uploadPhoto = async (file: File): Promise<string> => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await api.post('/api/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data.image_path;
};

export const processCrops = async (crops: CroppedItem[]): Promise<MatchResult[][]> => {
  const response = await api.post('/api/process-crops', { crops });
  return response.data.matches;
};

/**
 * Create a new item from crop (upload flow) - logs first wear.
 * wear_count = 1, last_worn = now
 */
export const createItem = async (
  name: string,
  imageData: string
): Promise<ClothingItem> => {
  const response = await api.post('/api/items/create', {
    name,
    image_data: imageData,
  });
  return response.data;
};

/**
 * Create a new item manually (wardrobe add flow) - no wear logged.
 * wear_count = 0, last_worn = null
 */
export const createItemManual = async (
  name: string,
  imageData?: string,
  thumbnailImageData?: string
): Promise<ClothingItem> => {
  const response = await api.post('/api/items', {
    name,
    image_data: imageData,
    thumbnail_image_data: thumbnailImageData,
  });
  return response.data;
};

export const logWear = async (
  itemId: string,
  imageData: string
): Promise<void> => {
  await api.post(`/api/items/${itemId}/wear`, {
    image_data: imageData,
  });
};

export const getAllItems = async (): Promise<ClothingItem[]> => {
  const response = await api.get('/api/items');
  return response.data;
};

export const getItem = async (itemId: string): Promise<{ item: ClothingItem; images: ItemImage[] }> => {
  const response = await api.get(`/api/items/${itemId}`);
  return response.data;
};

export const getItemThumbnail = (itemId: string): string => {
  return `${API_BASE_URL}/api/items/${itemId}/thumbnail`;
};

export const getItemImage = (itemId: string, imageId: string): string => {
  return `${API_BASE_URL}/api/items/${itemId}/images/${imageId}`;
};

export const updateItem = async (
  itemId: string,
  updates: { name?: string }
): Promise<ClothingItem> => {
  const response = await api.put(`/api/items/${itemId}`, updates);
  return response.data;
};

export const deleteItem = async (itemId: string): Promise<void> => {
  await api.delete(`/api/items/${itemId}`);
};

/**
 * Update the thumbnail for an item.
 * Options:
 * - imageId: Pick from existing reference images
 * - imageData: Upload a custom thumbnail
 * - clear: Revert to default (first reference image)
 */
export const updateThumbnail = async (
  itemId: string,
  options: { imageId?: string; imageData?: string; clear?: boolean }
): Promise<{ success: boolean; thumbnail_path: string | null }> => {
  const response = await api.put(`/api/items/${itemId}/thumbnail`, {
    image_id: options.imageId,
    image_data: options.imageData,
    clear: options.clear,
  });
  return response.data;
};

export const segmentImage = async (imageData: string): Promise<SegmentedItem[]> => {
  const response = await api.post('/api/segment', { image_data: imageData });
  return response.data.items;
};
