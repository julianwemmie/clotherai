import { useState } from 'react';
import type { MatchResult, CroppedItem } from '../types/index.js';
import { createItem, logWear, getItemThumbnail } from '../services/api.js';

interface MatchResultsProps {
  crops: CroppedItem[];
  matches: MatchResult[][];
  onComplete: () => void;
}

interface NewItemForm {
  name: string;
  category: string;
}

function MatchResults({ crops, matches, onComplete }: MatchResultsProps) {
  const [currentCropIndex, setCurrentCropIndex] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [showNewItemForm, setShowNewItemForm] = useState(false);
  const [newItemForm, setNewItemForm] = useState<NewItemForm>({ name: '', category: '' });
  const [completedCrops, setCompletedCrops] = useState<Set<number>>(new Set());

  const currentCrop = crops[currentCropIndex];
  const currentMatches = matches[currentCropIndex] || [];

  // Debug logging
  console.log('MatchResults Debug:', {
    currentCropIndex,
    totalMatches: matches.length,
    currentMatches: currentMatches,
    currentMatchesLength: currentMatches.length
  });

  const handleConfirmMatch = async (match: MatchResult) => {
    setProcessing(true);
    try {
      await logWear(match.item_id, currentCrop.imageData);
      markCropComplete();
    } catch (error) {
      console.error('Failed to log wear:', error);
      alert('Failed to log wear. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const handleNewItem = () => {
    setNewItemForm({
      name: '',
      category: currentCrop.category,
    });
    setShowNewItemForm(true);
  };

  const handleCreateItem = async () => {
    if (!newItemForm.name.trim()) {
      alert('Please enter a name for the item');
      return;
    }

    setProcessing(true);
    try {
      await createItem(
        newItemForm.name,
        newItemForm.category || currentCrop.category,
        currentCrop.imageData
      );
      setShowNewItemForm(false);
      markCropComplete();
    } catch (error) {
      console.error('Failed to create item:', error);
      alert('Failed to create item. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const markCropComplete = () => {
    const newCompleted = new Set(completedCrops);
    newCompleted.add(currentCropIndex);
    setCompletedCrops(newCompleted);

    // Move to next crop or complete
    if (currentCropIndex < crops.length - 1) {
      setCurrentCropIndex(currentCropIndex + 1);
    } else if (newCompleted.size === crops.length) {
      onComplete();
    }
  };

  const handleSkip = () => {
    if (currentCropIndex < crops.length - 1) {
      setCurrentCropIndex(currentCropIndex + 1);
    } else {
      onComplete();
    }
  };

  return (
    <div className="match-results">
      <h2>Match Results</h2>

      {/* Progress indicator */}
      <div className="progress-indicator">
        {crops.map((_, index) => (
          <div
            key={index}
            className={`progress-dot ${
              completedCrops.has(index)
                ? 'completed'
                : index === currentCropIndex
                ? 'current'
                : ''
            }`}
            onClick={() => !completedCrops.has(index) && setCurrentCropIndex(index)}
          />
        ))}
      </div>

      <p className="progress-text">
        Item {currentCropIndex + 1} of {crops.length}
      </p>

      <div className="match-content">
        {/* Current crop preview */}
        <div className="crop-preview">
          <h3>Your Selection</h3>
          <img src={currentCrop.imageData} alt="Selected crop" />
          <p className="crop-category">{currentCrop.category}</p>
        </div>

        {/* Matches list */}
        <div className="matches-list">
          <h3>
            {currentMatches.length > 0
              ? `All Matches (${currentMatches.length}) - DEBUG MODE`
              : 'No matches found - create as new item'}
          </h3>

          {currentMatches.length > 0 ? (
            <>
              <div className="debug-info">
                <p>Showing all wardrobe items sorted by similarity</p>
                <p className="debug-legend">
                  <span className="legend-item"><span className="color-box high"></span>70%+ = High match</span>
                  <span className="legend-item"><span className="color-box medium"></span>50-70% = Medium</span>
                  <span className="legend-item"><span className="color-box low"></span>&lt;50% = Low</span>
                </p>
              </div>

              <div className="matches-grid">
                {currentMatches.map((match) => {
                  const similarityClass =
                    match.similarity >= 70 ? 'high-match' :
                    match.similarity >= 50 ? 'medium-match' :
                    'low-match';

                  return (
                    <div key={match.item_id} className={`match-card ${similarityClass}`}>
                      <img
                        src={getItemThumbnail(match.item_id)}
                        alt={match.name}
                        className="match-thumbnail"
                      />
                      <div className="match-info">
                        <h4>{match.name}</h4>
                        <p className="match-category">{match.category}</p>
                        <p className="match-similarity">
                          <strong>{match.similarity.toFixed(1)}%</strong> similarity
                        </p>
                      </div>
                      <button
                        className="confirm-match-button"
                        onClick={() => handleConfirmMatch(match)}
                        disabled={processing}
                      >
                        This is it!
                      </button>
                    </div>
                  );
                })}
              </div>

              <button
                className="new-item-button"
                onClick={handleNewItem}
                disabled={processing}
              >
                Not a match - Create New Item
              </button>
            </>
          ) : (
            <button
              className="new-item-button primary"
              onClick={handleNewItem}
              disabled={processing}
            >
              Create New Item
            </button>
          )}

          <button
            className="skip-button"
            onClick={handleSkip}
            disabled={processing}
          >
            Skip this item
          </button>
        </div>
      </div>

      {/* New item form modal */}
      {showNewItemForm && (
        <div className="modal-overlay">
          <div className="new-item-modal">
            <h3>Create New Item</h3>

            <img
              src={currentCrop.imageData}
              alt="New item"
              className="new-item-preview"
            />

            <div className="form-group">
              <label htmlFor="item-name">Name</label>
              <input
                id="item-name"
                type="text"
                value={newItemForm.name}
                onChange={(e) =>
                  setNewItemForm({ ...newItemForm, name: e.target.value })
                }
                placeholder="e.g., Blue T-shirt"
                autoFocus
              />
            </div>

            <div className="form-group">
              <label htmlFor="item-category">Category</label>
              <select
                id="item-category"
                value={newItemForm.category}
                onChange={(e) =>
                  setNewItemForm({ ...newItemForm, category: e.target.value })
                }
              >
                <option value="top">Top</option>
                <option value="bottom">Bottom</option>
                <option value="outerwear">Outerwear</option>
                <option value="shoes">Shoes</option>
                <option value="accessory">Accessory</option>
                <option value="dress">Dress</option>
              </select>
            </div>

            <div className="modal-actions">
              <button
                className="create-button"
                onClick={handleCreateItem}
                disabled={processing}
              >
                {processing ? 'Creating...' : 'Create Item'}
              </button>
              <button
                className="cancel-button"
                onClick={() => setShowNewItemForm(false)}
                disabled={processing}
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

export default MatchResults;
