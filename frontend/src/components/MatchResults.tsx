import { useState } from 'react';
import type { MatchResult, CroppedItem } from '../types/index.js';
import { createItem, logWear, getItemThumbnail } from '../services/api.js';

interface MatchResultsProps {
  crops: CroppedItem[];
  matches: MatchResult[][];
  onComplete: () => void;
}

function MatchResults({ crops, matches, onComplete }: MatchResultsProps) {
  const [currentCropIndex, setCurrentCropIndex] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [showNewItemForm, setShowNewItemForm] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [completedCrops, setCompletedCrops] = useState<Set<number>>(new Set());

  const currentCrop = crops[currentCropIndex];
  const currentMatches = matches[currentCropIndex] || [];

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
    setNewItemName('');
    setShowNewItemForm(true);
  };

  const handleCreateItem = async () => {
    if (!newItemName.trim()) {
      alert('Please enter a name for the item');
      return;
    }

    setProcessing(true);
    try {
      await createItem(newItemName, currentCrop.imageData);
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
        </div>

        {/* Matches list */}
        <div className="matches-list">
          <h3>
            {currentMatches.length > 0
              ? `Matches (${currentMatches.length})`
              : 'No matches found - create as new item'}
          </h3>

          {currentMatches.length > 0 ? (
            <>
              <div className="debug-info">
                <p>Select a match or create a new item</p>
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
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget && !processing) {
              setShowNewItemForm(false);
              setNewItemName('');
            }
          }}
        >
          <div className="new-item-modal">
            <button
              className="modal-close-x"
              onClick={() => {
                setShowNewItemForm(false);
                setNewItemName('');
              }}
              disabled={processing}
              aria-label="Close"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
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
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                placeholder="e.g., Blue T-shirt"
                autoFocus
              />
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
