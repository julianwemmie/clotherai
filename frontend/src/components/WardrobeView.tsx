import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import type { ClothingItem, ItemImage } from '../types/index.js';
import {
  getAllItems,
  getItemImage,
  getItemThumbnail,
  updateItem,
  deleteItem,
  createItemManual,
  getItem,
  updateThumbnail,
} from '../services/api.js';

type ThumbnailSelection =
  | { type: 'keep' }
  | { type: 'clear' }
  | { type: 'reference'; imageId: string }
  | { type: 'custom'; imageData: string };

const NO_IMAGE_PLACEHOLDER =
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"%3E%3Crect fill="%23f0f0f0" width="100" height="100"/%3E%3Ctext x="50" y="50" text-anchor="middle" dy=".3em" fill="%23999" font-size="14"%3ENo image%3C/text%3E%3C/svg%3E';

function WardrobeView() {
  const [items, setItems] = useState<ClothingItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Add item modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemImage, setNewItemImage] = useState<string | null>(null);
  const [addingItem, setAddingItem] = useState(false);

  // Edit item modal
  const [editModalItemId, setEditModalItemId] = useState<string | null>(null);
  const [editItemName, setEditItemName] = useState('');
  const [editItemOriginalName, setEditItemOriginalName] = useState('');
  const [editItemImages, setEditItemImages] = useState<ItemImage[]>([]);
  const [thumbnailSelection, setThumbnailSelection] = useState<ThumbnailSelection>({ type: 'keep' });
  const [savingEditItem, setSavingEditItem] = useState(false);
  const [thumbnailVersions, setThumbnailVersions] = useState<Record<string, number>>({});

  // Delete confirmation modal
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deletingItem, setDeletingItem] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const editThumbnailFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = async () => {
    try {
      const data = await getAllItems();
      setItems(data);
    } catch (error) {
      console.error('Failed to load items:', error);
    } finally {
      setLoading(false);
    }
  };

  const getWearIndicatorClass = (lastWorn: string | null): string => {
    if (!lastWorn) return 'bg-red-500';
    const daysSinceWorn = Math.floor((Date.now() - new Date(lastWorn).getTime()) / (1000 * 60 * 60 * 24));
    if (daysSinceWorn <= 30) return 'bg-emerald-500';
    if (daysSinceWorn <= 90) return 'bg-amber-500';
    return 'bg-red-500';
  };

  const formatLastWorn = (lastWorn: string | null): string => {
    if (!lastWorn) return 'Never worn';
    const date = new Date(lastWorn);
    const daysSinceWorn = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (daysSinceWorn === 0) return 'Today';
    if (daysSinceWorn === 1) return 'Yesterday';
    if (daysSinceWorn < 7) return `${daysSinceWorn} days ago`;
    if (daysSinceWorn < 30) return `${Math.floor(daysSinceWorn / 7)} weeks ago`;
    return date.toLocaleDateString();
  };

  const getThumbnailUrl = (itemId: string) => {
    const version = thumbnailVersions[itemId];
    const baseUrl = getItemThumbnail(itemId);
    return version ? `${baseUrl}?v=${version}` : baseUrl;
  };

  // Add item handlers
  const handleAddItemClick = () => {
    setNewItemName('');
    setNewItemImage(null);
    setShowAddModal(true);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setNewItemImage(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreateItem = async () => {
    if (!newItemName.trim()) {
      alert('Please enter a name for the item');
      return;
    }

    setAddingItem(true);
    try {
      const newItem = await createItemManual(
        newItemName,
        newItemImage || undefined,
        newItemImage || undefined // Use same image for thumbnail
      );
      setItems([newItem, ...items]);
      setShowAddModal(false);
      setNewItemName('');
      setNewItemImage(null);
    } catch (error) {
      console.error('Failed to create item:', error);
      alert('Failed to create item. Please try again.');
    } finally {
      setAddingItem(false);
    }
  };

  // Delete handlers
  const handleDeleteClick = (itemId: string) => {
    setDeleteConfirmId(itemId);
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmId) return;

    setDeletingItem(true);
    try {
      await deleteItem(deleteConfirmId);
      setItems(items.filter(item => item.item_id !== deleteConfirmId));
      setDeleteConfirmId(null);
    } catch (error) {
      console.error('Failed to delete item:', error);
      alert('Failed to delete item. Please try again.');
    } finally {
      setDeletingItem(false);
    }
  };

  const resetEditModal = () => {
    setEditModalItemId(null);
    setEditItemName('');
    setEditItemOriginalName('');
    setEditItemImages([]);
    setThumbnailSelection({ type: 'keep' });
    if (editThumbnailFileInputRef.current) {
      editThumbnailFileInputRef.current.value = '';
    }
  };

  const openEditModal = async (itemId: string) => {
    const item = items.find(i => i.item_id === itemId);
    if (!item) return;

    setEditModalItemId(itemId);
    setEditItemName(item.name);
    setEditItemOriginalName(item.name);
    setEditItemImages([]);
    setThumbnailSelection({ type: 'keep' });

    try {
      const { item: fetchedItem, images } = await getItem(itemId);
      setEditItemName(fetchedItem.name);
      setEditItemOriginalName(fetchedItem.name);
      setEditItemImages(images);
    } catch (error) {
      console.error('Failed to load item images:', error);
      setEditItemImages([]);
    }
  };

  const handleEditThumbnailFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setThumbnailSelection({ type: 'custom', imageData: event.target?.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveEditItem = async () => {
    if (!editModalItemId) return;

    const trimmedName = editItemName.trim();
    if (!trimmedName) {
      alert('Name cannot be empty');
      return;
    }

    const nameChanged = trimmedName !== editItemOriginalName;
    const thumbnailChanged = thumbnailSelection.type !== 'keep';
    const targetItemId = editModalItemId;

    if (!nameChanged && !thumbnailChanged) {
      resetEditModal();
      return;
    }

    setSavingEditItem(true);
    try {
      if (nameChanged) {
        await updateItem(targetItemId, { name: trimmedName });
      }

      if (thumbnailChanged) {
        if (thumbnailSelection.type === 'custom') {
          await updateThumbnail(targetItemId, { imageData: thumbnailSelection.imageData });
        } else if (thumbnailSelection.type === 'reference') {
          await updateThumbnail(targetItemId, { imageId: thumbnailSelection.imageId });
        } else if (thumbnailSelection.type === 'clear') {
          await updateThumbnail(targetItemId, { clear: true });
        }
      }

      await loadItems();
      if (thumbnailChanged) {
        setThumbnailVersions((prev) => ({ ...prev, [targetItemId]: Date.now() }));
      }
      resetEditModal();
    } catch (error) {
      console.error('Failed to update item:', error);
      alert('Failed to update item. Please try again.');
    } finally {
      setSavingEditItem(false);
    }
  };

  const getDeleteItemName = () => {
    const item = items.find(i => i.item_id === deleteConfirmId);
    return item?.name || 'this item';
  };

  if (loading) {
    return (
      <div className="w-full animate-fade-in">
        <div className="rounded-3xl border border-gray-200 bg-white px-8 py-16 text-center shadow-lg">
          <div className="mx-auto mb-6 h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-indigo-500" />
          <p className="text-gray-500">Loading your wardrobe...</p>
        </div>
      </div>
    );
  }

  if (items.length === 0 && !showAddModal) {
    return (
      <div className="w-full animate-fade-in">
        <div className="rounded-3xl border border-gray-200 bg-white px-8 py-20 text-center shadow-lg">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-gray-100 to-gray-200 text-3xl text-gray-500">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.38 3.46L16 2a4 4 0 01-8 0L3.62 3.46a2 2 0 00-1.34 2.23l.58 3.47a1 1 0 00.99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 002-2V10h2.15a1 1 0 00.99-.84l.58-3.47a2 2 0 00-1.34-2.23z" />
            </svg>
          </div>
          <h2 className="text-2xl font-semibold text-gray-900">Your Wardrobe is Empty</h2>
          <p className="mt-3 text-gray-500">Upload an outfit photo or add items manually to start tracking</p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link to="/" className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 px-7 py-3 text-sm font-semibold text-white shadow-md transition hover:-translate-y-0.5">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              Upload First Outfit
            </Link>
            <button className="inline-flex items-center gap-2 rounded-xl border-2 border-indigo-500 px-7 py-3 text-sm font-semibold text-indigo-600 transition hover:bg-indigo-50" onClick={handleAddItemClick}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add Item Manually
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Your Wardrobe</h2>
          <p className="mt-2 text-gray-500">Track what you wear and discover your style patterns</p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-md transition hover:-translate-y-0.5" onClick={handleAddItemClick}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add Item
        </button>
      </div>

      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((item) => (
          <div key={item.item_id} className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-md transition hover:-translate-y-1 hover:shadow-xl">
            <div className="group relative flex h-[220px] w-full cursor-pointer items-center justify-center bg-gradient-to-br from-gray-100 to-gray-50" onClick={() => openEditModal(item.item_id)}>
              <img
                src={getThumbnailUrl(item.item_id)}
                alt={item.name}
                className="h-full w-full object-cover transition duration-200 group-hover:scale-105"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = NO_IMAGE_PLACEHOLDER;
                }}
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-white opacity-0 transition group-hover:opacity-100">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </div>
            </div>
            <div className="p-5">
              <button
                type="button"
                className="text-left text-lg font-semibold text-gray-900 transition hover:text-indigo-500"
                onClick={() => openEditModal(item.item_id)}
              >
                {item.name}
              </button>
              <div className="mt-3 flex flex-col gap-2 text-sm text-gray-600">
                <span className="flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                  </svg>
                  Worn {item.wear_count} {item.wear_count === 1 ? 'time' : 'times'}
                </span>
                <span className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${getWearIndicatorClass(item.last_worn)}`} />
                  {formatLastWorn(item.last_worn)}
                </span>
              </div>
              <button
                className="mt-3 inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-500 transition hover:border-red-500 hover:bg-red-50 hover:text-red-500"
                onClick={() => handleDeleteClick(item.item_id)}
                title="Delete item"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                  <line x1="10" y1="11" x2="10" y2="17" />
                  <line x1="14" y1="11" x2="14" y2="17" />
                </svg>
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Edit Item Modal */}
      {editModalItemId && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget && !savingEditItem) {
              resetEditModal();
            }
          }}
        >
          <div className="relative max-h-[calc(100vh-4rem)] w-[92%] max-w-3xl overflow-y-auto rounded-3xl bg-white p-7 shadow-xl animate-slide-up">
            <button
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-600 transition hover:bg-gray-200 hover:text-gray-900 disabled:opacity-50"
              onClick={resetEditModal}
              disabled={savingEditItem}
              aria-label="Close"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            <h3 className="text-center text-xl font-semibold text-gray-900">Edit Item</h3>

            {(() => {
              const defaultReferenceImageId =
                editItemImages.length > 0 ? editItemImages[editItemImages.length - 1].image_id : null;

              const previewSrc = (() => {
                if (!editModalItemId) return null;
                if (thumbnailSelection.type === 'custom') return thumbnailSelection.imageData;
                if (thumbnailSelection.type === 'reference') {
                  return getItemImage(editModalItemId, thumbnailSelection.imageId);
                }
                if (thumbnailSelection.type === 'clear') {
                  return defaultReferenceImageId ? getItemImage(editModalItemId, defaultReferenceImageId) : null;
                }
                return getThumbnailUrl(editModalItemId);
              })();

              return (
                <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.15fr]">
                  <div className="space-y-2">
                    <label htmlFor="edit-item-name" className="text-sm font-semibold text-gray-700">Name *</label>
                    <input
                      id="edit-item-name"
                      type="text"
                      value={editItemName}
                      onChange={(e) => setEditItemName(e.target.value)}
                      placeholder="e.g., Blue T-shirt"
                      disabled={savingEditItem}
                      autoFocus
                      className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-base transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:bg-gray-100"
                    />
                  </div>

                  <div className="flex flex-col">
                    <div className="flex h-[220px] items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-gradient-to-br from-gray-50 to-white">
                      <img
                        src={previewSrc || NO_IMAGE_PLACEHOLDER}
                        alt="Thumbnail preview"
                        className="h-full w-full object-contain"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = NO_IMAGE_PLACEHOLDER;
                        }}
                      />
                    </div>

                    {editItemImages.length > 0 && (
                      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                        {editItemImages.map((img) => (
                          <button
                            key={img.image_id}
                            type="button"
                            className={`h-16 w-16 flex-none overflow-hidden rounded-xl border-2 border-gray-200 transition hover:-translate-y-0.5 hover:border-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 ${
                              thumbnailSelection.type === 'reference' && thumbnailSelection.imageId === img.image_id
                                ? 'border-indigo-500 shadow-[0_0_0_3px_rgba(99,102,241,0.12)]'
                                : ''
                            }`}
                            onClick={() => setThumbnailSelection({ type: 'reference', imageId: img.image_id })}
                            disabled={savingEditItem}
                            aria-label="Use this reference image as thumbnail"
                          >
                            <img
                              src={getItemImage(editModalItemId, img.image_id)}
                              alt="Reference image"
                              className="h-full w-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = NO_IMAGE_PLACEHOLDER;
                              }}
                            />
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                      <button
                        type="button"
                        className="flex-1 rounded-xl bg-gray-100 px-4 py-3 text-sm font-medium text-gray-600 transition hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={() => setThumbnailSelection({ type: 'clear' })}
                        disabled={savingEditItem}
                      >
                        Reset to Default
                      </button>
                      <button
                        type="button"
                        className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 bg-gray-100 px-4 py-3 text-sm font-medium text-gray-600 transition hover:border-indigo-500 hover:bg-indigo-50 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={() => editThumbnailFileInputRef.current?.click()}
                        disabled={savingEditItem}
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                          <polyline points="17 8 12 3 7 8" />
                          <line x1="12" y1="3" x2="12" y2="15" />
                        </svg>
                        Upload Custom
                      </button>
                      <input
                        ref={editThumbnailFileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleEditThumbnailFileSelect}
                        className="hidden"
                      />
                    </div>
                  </div>
                </div>
              );
            })()}

            <div className="mt-6 flex gap-3 border-t border-gray-200 pt-6">
              <button
                className="flex-1 rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed"
                onClick={resetEditModal}
                disabled={savingEditItem}
              >
                Cancel
              </button>
              <button
                className="flex-1 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-md transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:from-gray-300 disabled:to-gray-300 disabled:shadow-none disabled:translate-y-0"
                onClick={handleSaveEditItem}
                disabled={savingEditItem || !editItemName.trim()}
              >
                {savingEditItem ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Item Modal */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget && !addingItem) {
              setShowAddModal(false);
              setNewItemName('');
              setNewItemImage(null);
            }
          }}
        >
          <div className="relative w-[90%] max-w-lg rounded-3xl bg-white p-8 shadow-xl animate-slide-up">
            <button
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-600 transition hover:bg-gray-200 hover:text-gray-900 disabled:opacity-50"
              onClick={() => {
                setShowAddModal(false);
                setNewItemName('');
                setNewItemImage(null);
              }}
              disabled={addingItem}
              aria-label="Close"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            <h3 className="text-center text-xl font-semibold text-gray-900">Add New Item</h3>

            <div className="mt-6 space-y-2">
              <label htmlFor="new-item-name" className="text-sm font-semibold text-gray-700">Name *</label>
              <input
                id="new-item-name"
                type="text"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                placeholder="e.g., Blue T-shirt"
                autoFocus
                className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-base transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
            </div>

            <div className="mt-6 space-y-2">
              <label className="text-sm font-semibold text-gray-700">Reference Image (optional)</label>
              <div className="rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-6 text-center transition hover:border-indigo-500 hover:bg-indigo-50">
                {newItemImage ? (
                  <div className="relative inline-block">
                    <img src={newItemImage} alt="Preview" className="max-h-52 rounded-xl object-contain" />
                    <button
                      className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-red-500 text-white transition hover:scale-110"
                      onClick={() => setNewItemImage(null)}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <button
                    className="flex w-full flex-col items-center gap-2 text-gray-500 transition hover:text-indigo-600"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21 15 16 10 5 21" />
                    </svg>
                    <span>Click to upload image</span>
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                />
              </div>
              {!newItemImage && (
                <p className="text-xs italic text-gray-500">
                  Without an image, this item won't be matchable in the upload flow.
                </p>
              )}
            </div>

            <div className="mt-6 flex gap-3">
              <button
                className="flex-1 rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed"
                onClick={() => setShowAddModal(false)}
                disabled={addingItem}
              >
                Cancel
              </button>
              <button
                className="flex-1 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-md transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:from-gray-300 disabled:to-gray-300 disabled:shadow-none disabled:translate-y-0"
                onClick={handleCreateItem}
                disabled={addingItem || !newItemName.trim()}
              >
                {addingItem ? 'Creating...' : 'Create Item'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget && !deletingItem) {
              setDeleteConfirmId(null);
            }
          }}
        >
          <div className="relative w-[90%] max-w-md rounded-3xl bg-white p-8 shadow-xl animate-slide-up">
            <button
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-600 transition hover:bg-gray-200 hover:text-gray-900 disabled:opacity-50"
              onClick={() => setDeleteConfirmId(null)}
              disabled={deletingItem}
              aria-label="Close"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            <h3 className="text-center text-xl font-semibold text-gray-900">Delete Item</h3>
            <p className="mt-5 text-gray-600">
              Are you sure you want to delete <strong>{getDeleteItemName()}</strong>?
            </p>
            <p className="mt-3 text-sm font-medium text-red-500">
              This permanently deletes wear history and reference images.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                className="flex-1 rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed"
                onClick={() => setDeleteConfirmId(null)}
                disabled={deletingItem}
              >
                Cancel
              </button>
              <button
                className="flex-1 rounded-xl bg-gradient-to-br from-red-500 to-red-600 px-4 py-3 text-sm font-semibold text-white shadow-md transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:from-gray-300 disabled:to-gray-300 disabled:shadow-none disabled:translate-y-0"
                onClick={handleConfirmDelete}
                disabled={deletingItem}
              >
                {deletingItem ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default WardrobeView;
