import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import type { ClothingItem } from '../types/index.js';
import { getAllItems, getItemThumbnail, updateItem } from '../services/api.js';

function WardrobeView() {
  const [items, setItems] = useState<ClothingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingCategory, setEditingCategory] = useState<string>('');

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

  const categories = ['top', 'bottom', 'outerwear', 'shoes', 'accessory', 'dress'];

  const startEditingCategory = (item: ClothingItem) => {
    setEditingItemId(item.item_id);
    setEditingCategory(item.category);
  };

  const cancelEditingCategory = () => {
    setEditingItemId(null);
    setEditingCategory('');
  };

  const saveCategory = async (itemId: string) => {
    try {
      const updatedItem = await updateItem(itemId, { category: editingCategory });
      setItems(items.map(item =>
        item.item_id === itemId ? updatedItem : item
      ));
      setEditingItemId(null);
      setEditingCategory('');
    } catch (error) {
      console.error('Failed to update category:', error);
      alert('Failed to update category. Please try again.');
    }
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

  if (items.length === 0) {
    return (
      <div className="wardrobe-view">
        <div className="empty-wardrobe">
          <div className="empty-icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.38 3.46L16 2a4 4 0 01-8 0L3.62 3.46a2 2 0 00-1.34 2.23l.58 3.47a1 1 0 00.99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 002-2V10h2.15a1 1 0 00.99-.84l.58-3.47a2 2 0 00-1.34-2.23z"/>
            </svg>
          </div>
          <h2>Your Wardrobe is Empty</h2>
          <p>Upload your first outfit photo to start tracking what you wear</p>
          <Link to="/" className="empty-cta">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            Upload First Outfit
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="wardrobe-view">
      <div className="wardrobe-header">
        <h2>Your Wardrobe</h2>
        <p>Track what you wear and discover your style patterns</p>
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
            <div className="item-thumbnail">
              <img src={getItemThumbnail(item.item_id)} alt={item.name} />
            </div>
            <div className="item-info">
              <h3>{item.name}</h3>
              {editingItemId === item.item_id ? (
                <div className="category-edit">
                  <select
                    value={editingCategory}
                    onChange={(e) => setEditingCategory(e.target.value)}
                    className="category-select"
                  >
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                  <div className="category-edit-buttons">
                    <button
                      onClick={() => saveCategory(item.item_id)}
                      className="save-btn"
                      title="Save"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    </button>
                    <button
                      onClick={cancelEditingCategory}
                      className="cancel-btn"
                      title="Cancel"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="category-display">
                  <p className="item-category">{item.category}</p>
                  <button
                    onClick={() => startEditingCategory(item)}
                    className="edit-category-btn"
                    title="Edit category"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                  </button>
                </div>
              )}
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
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default WardrobeView;
