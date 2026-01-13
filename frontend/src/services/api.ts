import axios from 'axios';
import type { ClothingItem, MatchResult, CroppedItem } from '../types/index.js';

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

export const createItem = async (
  name: string,
  category: string,
  imageData: string
): Promise<ClothingItem> => {
  const response = await api.post('/api/items/create', {
    name,
    category,
    image_data: imageData,
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

export const getItem = async (itemId: string): Promise<ClothingItem> => {
  const response = await api.get(`/api/items/${itemId}`);
  return response.data;
};

export const getItemThumbnail = (itemId: string): string => {
  return `${API_BASE_URL}/api/items/${itemId}/thumbnail`;
};

export const updateItem = async (
  itemId: string,
  updates: { name?: string; category?: string }
): Promise<ClothingItem> => {
  const response = await api.put(`/api/items/${itemId}`, updates);
  return response.data;
};
