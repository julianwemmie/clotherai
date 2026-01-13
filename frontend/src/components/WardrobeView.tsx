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
    if (!lastWorn) return 'old';
    const daysSinceWorn = Math.floor((Date.now() - new Date(lastWorn).getTime()) / (1000 * 60 * 60 * 24));
    if (daysSinceWorn <= 30) return 'recent';
    if (daysSinceWorn <= 90) return 'moderate';
    return 'old';
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

  const totalWears = items.reduce((sum, item) => sum + item.wear_count, 0);
  const avgWears = items.length > 0 ? (totalWears / items.length).toFixed(1) : '0';

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
      <div className="wardrobe-view">
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading your wardrobe...</p>
        </div>
      </div>
    );
  }

  if (items.length === 0 && !showAddModal) {
    return (
      <div className="wardrobe-view">
        <div className="empty-wardrobe">
          <div className="empty-icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.38 3.46L16 2a4 4 0 01-8 0L3.62 3.46a2 2 0 00-1.34 2.23l.58 3.47a1 1 0 00.99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 002-2V10h2.15a1 1 0 00.99-.84l.58-3.47a2 2 0 00-1.34-2.23z"/>
            </svg>
          </div>
          <h2>Your Wardrobe is Empty</h2>
          <p>Upload an outfit photo or add items manually to start tracking</p>
          <div className="empty-actions">
            <Link to="/" className="empty-cta">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              Upload First Outfit
            </Link>
            <button className="add-item-cta" onClick={handleAddItemClick}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Add Item Manually
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="wardrobe-view">
      <div className="wardrobe-header">
        <div className="header-content">
          <h2>Your Wardrobe</h2>
          <p>Track what you wear and discover your style patterns</p>
        </div>
        <button className="add-item-button" onClick={handleAddItemClick}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Add Item
        </button>
      </div>

      <div className="wardrobe-stats">
        <div className="stat">
          <div className="stat-icon items">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.38 3.46L16 2a4 4 0 01-8 0L3.62 3.46a2 2 0 00-1.34 2.23l.58 3.47a1 1 0 00.99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 002-2V10h2.15a1 1 0 00.99-.84l.58-3.47a2 2 0 00-1.34-2.23z"/>
            </svg>
          </div>
          <span className="stat-value">{items.length}</span>
          <span className="stat-label">Total Items</span>
        </div>
        <div className="stat">
          <div className="stat-icon wears">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
            </svg>
          </div>
          <span className="stat-value">{totalWears}</span>
          <span className="stat-label">Total Wears</span>
        </div>
        <div className="stat">
          <div className="stat-icon avg">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10"/>
              <line x1="12" y1="20" x2="12" y2="4"/>
              <line x1="6" y1="20" x2="6" y2="14"/>
            </svg>
          </div>
          <span className="stat-value">{avgWears}</span>
          <span className="stat-label">Avg. Wears</span>
        </div>
      </div>

      <div className="items-grid">
        {items.map((item) => (
          <div key={item.item_id} className="item-card">
            <div className="item-thumbnail" onClick={() => openEditModal(item.item_id)}>
              <img
                src={getThumbnailUrl(item.item_id)}
                alt={item.name}
                onError={(e) => {
                  (e.target as HTMLImageElement).src = NO_IMAGE_PLACEHOLDER;
                }}
              />
              <div className="thumbnail-overlay">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </div>
            </div>
            <div className="item-info">
              <h3 className="item-name">
                <button
                  type="button"
                  className="item-name-button"
                  onClick={() => openEditModal(item.item_id)}
                >
                  <span>{item.name}</span>
                </button>
              </h3>
              <div className="item-stats">
                <span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                  </svg>
                  Worn {item.wear_count} {item.wear_count === 1 ? 'time' : 'times'}
                </span>
                <span>
                  <span className={`wear-indicator ${getWearIndicatorClass(item.last_worn)}`}></span>
                  {formatLastWorn(item.last_worn)}
                </span>
              </div>
              <button
                className="delete-item-btn"
                onClick={() => handleDeleteClick(item.item_id)}
                title="Delete item"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                  <line x1="10" y1="11" x2="10" y2="17"/>
                  <line x1="14" y1="11" x2="14" y2="17"/>
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
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget && !savingEditItem) {
              resetEditModal();
            }
          }}
        >
          <div className="edit-item-modal">
            <button
              className="modal-close-x"
              onClick={resetEditModal}
              disabled={savingEditItem}
              aria-label="Close"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
            <h3>Edit Item</h3>

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
                <div className="edit-item-content">
                  <div className="edit-item-details">
                    <div className="form-group">
                      <label htmlFor="edit-item-name">Name *</label>
                      <input
                        id="edit-item-name"
                        type="text"
                        value={editItemName}
                        onChange={(e) => setEditItemName(e.target.value)}
                        placeholder="e.g., Blue T-shirt"
                        disabled={savingEditItem}
                        autoFocus
                      />
                    </div>
                  </div>

                  <div className="edit-item-thumbnail">
                    <div className="thumbnail-preview">
                      <img
                        src={previewSrc || NO_IMAGE_PLACEHOLDER}
                        alt="Thumbnail preview"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = NO_IMAGE_PLACEHOLDER;
                        }}
                      />
                    </div>

                    {editItemImages.length > 0 && (
                      <div className="thumbnail-strip">
                        {editItemImages.map((img) => (
                          <button
                            key={img.image_id}
                            type="button"
                            className={`thumbnail-option ${
                              thumbnailSelection.type === 'reference' && thumbnailSelection.imageId === img.image_id
                                ? 'selected'
                                : ''
                            }`}
                            onClick={() => setThumbnailSelection({ type: 'reference', imageId: img.image_id })}
                            disabled={savingEditItem}
                            aria-label="Use this reference image as thumbnail"
                          >
                            <img
                              src={getItemImage(editModalItemId, img.image_id)}
                              alt="Reference image"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = NO_IMAGE_PLACEHOLDER;
                              }}
                            />
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="thumbnail-actions">
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => setThumbnailSelection({ type: 'clear' })}
                        disabled={savingEditItem}
                      >
                        Reset to Default
                      </button>
                      <button
                        type="button"
                        className="upload-thumbnail-button"
                        onClick={() => editThumbnailFileInputRef.current?.click()}
                        disabled={savingEditItem}
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                          <polyline points="17 8 12 3 7 8"/>
                          <line x1="12" y1="3" x2="12" y2="15"/>
                        </svg>
                        Upload Custom
                      </button>
                      <input
                        ref={editThumbnailFileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleEditThumbnailFileSelect}
                        style={{ display: 'none' }}
                      />
                    </div>
                  </div>
                </div>
              );
            })()}

            <div className="modal-actions">
              <button
                className="cancel-button"
                onClick={resetEditModal}
                disabled={savingEditItem}
              >
                Cancel
              </button>
              <button
                className="create-button"
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
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget && !addingItem) {
              setShowAddModal(false);
              setNewItemName('');
              setNewItemImage(null);
            }
          }}
        >
          <div className="add-item-modal">
            <button
              className="modal-close-x"
              onClick={() => {
                setShowAddModal(false);
                setNewItemName('');
                setNewItemImage(null);
              }}
              disabled={addingItem}
              aria-label="Close"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
            <h3>Add New Item</h3>

            <div className="form-group">
              <label htmlFor="new-item-name">Name *</label>
              <input
                id="new-item-name"
                type="text"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                placeholder="e.g., Blue T-shirt"
                autoFocus
              />
            </div>

            <div className="form-group">
              <label>Reference Image (optional)</label>
              <div className="image-upload-area">
                {newItemImage ? (
                  <div className="image-preview">
                    <img src={newItemImage} alt="Preview" />
                    <button
                      className="remove-image"
                      onClick={() => setNewItemImage(null)}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  </div>
                ) : (
                  <button
                    className="upload-button"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                      <circle cx="8.5" cy="8.5" r="1.5"/>
                      <polyline points="21 15 16 10 5 21"/>
                    </svg>
                    <span>Click to upload image</span>
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  style={{ display: 'none' }}
                />
              </div>
              {!newItemImage && (
                <p className="form-help">
                  Without an image, this item won't be matchable in the upload flow.
                </p>
              )}
            </div>

            <div className="modal-actions">
              <button
                className="create-button"
                onClick={handleCreateItem}
                disabled={addingItem || !newItemName.trim()}
              >
                {addingItem ? 'Creating...' : 'Create Item'}
              </button>
              <button
                className="cancel-button"
                onClick={() => setShowAddModal(false)}
                disabled={addingItem}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget && !deletingItem) {
              setDeleteConfirmId(null);
            }
          }}
        >
          <div className="delete-confirm-modal">
            <button
              className="modal-close-x"
              onClick={() => setDeleteConfirmId(null)}
              disabled={deletingItem}
              aria-label="Close"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
            <h3>Delete Item</h3>
            <p>
              Are you sure you want to delete <strong>{getDeleteItemName()}</strong>?
            </p>
            <p className="delete-warning">
              This permanently deletes wear history and reference images.
            </p>
            <div className="modal-actions">
              <button
                className="delete-button"
                onClick={handleConfirmDelete}
                disabled={deletingItem}
              >
                {deletingItem ? 'Deleting...' : 'Delete'}
              </button>
              <button
                className="cancel-button"
                onClick={() => setDeleteConfirmId(null)}
                disabled={deletingItem}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default WardrobeView;
