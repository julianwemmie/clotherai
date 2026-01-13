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
    <div className="animate-fade-in">
      <h2 className="text-center text-2xl font-bold text-gray-900">Match Results</h2>

      {/* Progress indicator */}
      <div className="mt-6 flex justify-center gap-2">
        {crops.map((_, index) => {
          const baseClasses = 'h-3 w-3 rounded-full bg-gray-200 transition';
          const stateClasses = completedCrops.has(index)
            ? 'bg-emerald-500'
            : index === currentCropIndex
              ? 'bg-indigo-500 scale-125 shadow-[0_0_0_4px_rgba(99,102,241,0.2)]'
              : '';

          return (
            <div
              key={index}
              className={`${baseClasses} ${stateClasses}`}
              onClick={() => !completedCrops.has(index) && setCurrentCropIndex(index)}
            />
          );
        })}
      </div>

      <p className="mt-3 text-center text-sm font-medium text-gray-500">
        Item {currentCropIndex + 1} of {crops.length}
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[280px_1fr]">
        {/* Current crop preview */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-lg">
          <h3 className="text-sm font-semibold text-gray-700">Your Selection</h3>
          <img src={currentCrop.imageData} alt="Selected crop" className="mt-3 max-h-72 w-full rounded-xl bg-gray-100 object-contain" />
        </div>

        {/* Matches list */}
        <div className="flex flex-col">
          <h3 className="text-base font-semibold text-gray-900">
            {currentMatches.length > 0
              ? `Matches (${currentMatches.length})`
              : 'No matches found - create as new item'}
          </h3>

          {currentMatches.length > 0 ? (
            <>
              <div className="mt-4 rounded-xl border-2 border-amber-400 bg-amber-50 p-4 text-amber-900">
                <p className="text-sm font-medium">Select a match or create a new item</p>
                <div className="mt-2 flex flex-wrap gap-4 text-xs text-amber-900">
                  <span className="flex items-center gap-2">
                    <span className="h-5 w-5 rounded border-2 border-black/10 bg-gradient-to-br from-emerald-100 to-emerald-200" />
                    70%+ = High match
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="h-5 w-5 rounded border-2 border-black/10 bg-gradient-to-br from-amber-100 to-amber-200" />
                    50-70% = Medium
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="h-5 w-5 rounded border-2 border-black/10 bg-gradient-to-br from-red-100 to-red-200" />
                    &lt;50% = Low
                  </span>
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-3">
                {currentMatches.map((match) => {
                  const similarityClass =
                    match.similarity >= 70 ? 'border-emerald-500 bg-gradient-to-br from-white to-emerald-100' :
                    match.similarity >= 50 ? 'border-amber-500 bg-gradient-to-br from-white to-amber-100' :
                    'border-red-500 bg-gradient-to-br from-white to-red-100';

                  return (
                    <div key={match.item_id} className={`flex items-center gap-4 rounded-2xl border-2 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${similarityClass}`}>
                      <img
                        src={getItemThumbnail(match.item_id)}
                        alt={match.name}
                        className="h-[72px] w-[72px] rounded-xl bg-gray-100 object-cover"
                      />
                      <div className="flex flex-1 flex-col">
                        <h4 className="text-base font-semibold text-gray-900">{match.name}</h4>
                        <p className="text-sm font-semibold text-emerald-600">
                          <strong>{match.similarity.toFixed(1)}%</strong> similarity
                        </p>
                      </div>
                      <button
                        className="rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-md transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:from-gray-300 disabled:to-gray-300 disabled:shadow-none disabled:translate-y-0"
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
                className="mt-4 w-full rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-md transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:from-gray-300 disabled:to-gray-300 disabled:shadow-none disabled:translate-y-0"
                onClick={handleNewItem}
                disabled={processing}
              >
                Not a match - Create New Item
              </button>
            </>
          ) : (
            <button
              className="mt-4 w-full rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-md transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:from-gray-300 disabled:to-gray-300 disabled:shadow-none disabled:translate-y-0"
              onClick={handleNewItem}
              disabled={processing}
            >
              Create New Item
            </button>
          )}

          <button
            className="mt-3 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-500 transition hover:border-gray-300 hover:bg-gray-50 hover:text-gray-700 disabled:cursor-not-allowed"
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
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget && !processing) {
              setShowNewItemForm(false);
              setNewItemName('');
            }
          }}
        >
          <div className="relative w-[90%] max-w-md rounded-3xl bg-white p-8 shadow-xl animate-slide-up">
            <button
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-600 transition hover:bg-gray-200 hover:text-gray-900 disabled:opacity-50"
              onClick={() => {
                setShowNewItemForm(false);
                setNewItemName('');
              }}
              disabled={processing}
              aria-label="Close"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            <h3 className="text-center text-xl font-semibold text-gray-900">Create New Item</h3>

            <img
              src={currentCrop.imageData}
              alt="New item"
              className="mt-6 max-h-52 w-full rounded-xl bg-gray-100 object-contain"
            />

            <div className="mt-6 space-y-2">
              <label htmlFor="item-name" className="text-sm font-semibold text-gray-700">Name</label>
              <input
                id="item-name"
                type="text"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                placeholder="e.g., Blue T-shirt"
                autoFocus
                className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-base transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
            </div>

            <div className="mt-6 flex gap-3">
              <button
                className="flex-1 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-md transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:from-gray-300 disabled:to-gray-300 disabled:shadow-none disabled:translate-y-0"
                onClick={handleCreateItem}
                disabled={processing}
              >
                {processing ? 'Creating...' : 'Create Item'}
              </button>
              <button
                className="flex-1 rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed"
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
