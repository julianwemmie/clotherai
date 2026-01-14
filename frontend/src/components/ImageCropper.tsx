import { useState, useRef, useCallback } from 'react';
import type { CroppedItem } from '../types/index.js';
import { segmentImage } from '../services/api.js';

interface ImageCropperProps {
  imageUrl: string;
  onCropsComplete: (crops: CroppedItem[]) => void;
  onCancel: () => void;
}

interface PendingCrop {
  imageData: string;
  boundingBox: { x: number; y: number; width: number; height: number };
}

function ImageCropper({ imageUrl, onCropsComplete, onCancel }: ImageCropperProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const selectionRef = useRef<HTMLDivElement>(null);
  const isDrawingRef = useRef(false);
  const startPosRef = useRef({ x: 0, y: 0 });
  const [crops, setCrops] = useState<CroppedItem[]>([]);
  const [pendingCrop, setPendingCrop] = useState<PendingCrop | null>(null);
  const [isAutoDetecting, setIsAutoDetecting] = useState(false);
  const [autoDetectError, setAutoDetectError] = useState<string | null>(null);

  const getRelativeCoordinates = useCallback((e: React.MouseEvent | MouseEvent) => {
    const img = imageRef.current;
    if (!img) return { x: 0, y: 0 };

    const rect = img.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    return {
      x: Math.max(0, Math.min(x, img.offsetWidth)),
      y: Math.max(0, Math.min(y, img.offsetHeight)),
    };
  }, []);

  const getImageCoordinates = useCallback((displayX: number, displayY: number) => {
    const img = imageRef.current;
    if (!img) return { x: 0, y: 0 };

    const scaleX = img.naturalWidth / img.offsetWidth;
    const scaleY = img.naturalHeight / img.offsetHeight;

    return {
      x: displayX * scaleX,
      y: displayY * scaleY,
    };
  }, []);

  const updateSelectionBox = useCallback((endX: number, endY: number) => {
    const selection = selectionRef.current;
    if (!selection) return;

    const startX = startPosRef.current.x;
    const startY = startPosRef.current.y;

    const x = Math.min(startX, endX);
    const y = Math.min(startY, endY);
    const width = Math.abs(endX - startX);
    const height = Math.abs(endY - startY);

    selection.style.left = `${x}px`;
    selection.style.top = `${y}px`;
    selection.style.width = `${width}px`;
    selection.style.height = `${height}px`;
    selection.style.display = 'block';
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (pendingCrop) return;

    const coords = getRelativeCoordinates(e);
    isDrawingRef.current = true;
    startPosRef.current = coords;

    const selection = selectionRef.current;
    if (selection) {
      selection.style.left = `${coords.x}px`;
      selection.style.top = `${coords.y}px`;
      selection.style.width = '0px';
      selection.style.height = '0px';
      selection.style.display = 'block';
    }
  }, [pendingCrop, getRelativeCoordinates]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDrawingRef.current) return;

    const coords = getRelativeCoordinates(e);
    updateSelectionBox(coords.x, coords.y);
  }, [getRelativeCoordinates, updateSelectionBox]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (!isDrawingRef.current) return;

    isDrawingRef.current = false;

    const selection = selectionRef.current;
    if (selection) {
      selection.style.display = 'none';
    }

    const coords = getRelativeCoordinates(e);
    const startX = startPosRef.current.x;
    const startY = startPosRef.current.y;

    const displayX = Math.min(startX, coords.x);
    const displayY = Math.min(startY, coords.y);
    const displayWidth = Math.abs(coords.x - startX);
    const displayHeight = Math.abs(coords.y - startY);

    if (displayWidth > 20 && displayHeight > 20) {
      const img = imageRef.current;
      if (img) {
        const start = getImageCoordinates(displayX, displayY);
        const end = getImageCoordinates(displayX + displayWidth, displayY + displayHeight);
        const imgWidth = end.x - start.x;
        const imgHeight = end.y - start.y;

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = imgWidth;
        tempCanvas.height = imgHeight;
        const tempCtx = tempCanvas.getContext('2d');
        if (tempCtx) {
          tempCtx.drawImage(
            img,
            start.x, start.y, imgWidth, imgHeight,
            0, 0, imgWidth, imgHeight
          );
          const imageData = tempCanvas.toDataURL('image/jpeg', 0.9);
          setPendingCrop({
            imageData,
            boundingBox: { x: start.x, y: start.y, width: imgWidth, height: imgHeight },
          });
        }
      }
    }
  }, [getRelativeCoordinates, getImageCoordinates]);

  const handleAddCrop = () => {
    if (!pendingCrop) return;

    const newCrop: CroppedItem = {
      imageData: pendingCrop.imageData,
      boundingBox: pendingCrop.boundingBox,
    };

    setCrops([...crops, newCrop]);
    setPendingCrop(null);
  };

  const handleRemoveCrop = (index: number) => {
    setCrops(crops.filter((_, i) => i !== index));
  };

  const handleAutoDetect = async () => {
    setIsAutoDetecting(true);
    setAutoDetectError(null);

    try {
      const segmentedItems = await segmentImage(imageUrl);

      if (segmentedItems.length === 0) {
        setAutoDetectError('No clothing items detected. Try manual selection.');
        return;
      }

      // Convert segmented items to CroppedItem format
      const newCrops: CroppedItem[] = segmentedItems.map(item => ({
        imageData: item.imageData,
        boundingBox: item.boundingBox,
      }));

      setCrops(prev => [...prev, ...newCrops]);
    } catch (err) {
      console.error('Auto-detect failed:', err);
      setAutoDetectError('Auto-detection failed. Please try manual selection.');
    } finally {
      setIsAutoDetecting(false);
    }
  };

  const handleSubmit = () => {
    if (crops.length === 0) {
      alert('Please select at least one clothing item');
      return;
    }
    onCropsComplete(crops);
  };

  // Calculate crop overlay positions (convert from image coords to display coords)
  const getCropStyle = (crop: CroppedItem) => {
    const img = imageRef.current;
    if (!img) return {};

    const scaleX = img.offsetWidth / img.naturalWidth;
    const scaleY = img.offsetHeight / img.naturalHeight;

    return {
      left: crop.boundingBox.x * scaleX,
      top: crop.boundingBox.y * scaleY,
      width: crop.boundingBox.width * scaleX,
      height: crop.boundingBox.height * scaleY,
    };
  };

  return (
    <div className="animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Select Clothing Items</h2>
          <p className="mt-2 text-sm text-gray-500">
            Use auto-detect or click and drag to select each clothing item.
          </p>
        </div>
        <button
          onClick={handleAutoDetect}
          disabled={isAutoDetecting}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:-translate-y-0.5 hover:shadow-lg disabled:cursor-not-allowed disabled:from-gray-300 disabled:to-gray-300 disabled:shadow-none disabled:translate-y-0"
        >
          {isAutoDetecting ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Detecting...
            </>
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
              </svg>
              Auto-Detect
            </>
          )}
        </button>
      </div>

      {autoDetectError && (
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {autoDetectError}
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div
          ref={containerRef}
          className="flex min-h-[450px] cursor-crosshair select-none items-center justify-center rounded-2xl bg-gradient-to-br from-gray-100 to-gray-50 p-6 shadow-lg"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <div className="relative inline-block">
            <img
              ref={imageRef}
              src={imageUrl}
              alt="Outfit to crop"
              className="block max-h-[600px] max-w-full rounded-xl shadow-xl"
              draggable={false}
            />

            {/* Existing crop overlays */}
            {crops.map((crop, index) => (
              <div
                key={index}
                className="pointer-events-none absolute box-border border-[3px] border-emerald-500 bg-emerald-500/10"
                style={getCropStyle(crop)}
              >
                <span className="absolute left-1 top-1 rounded bg-emerald-500 px-2 py-0.5 text-xs font-semibold text-white">
                  Item {index + 1}
                </span>
              </div>
            ))}

            {/* Current selection overlay - uses ref for performance */}
            <div
              ref={selectionRef}
              className="pointer-events-none absolute box-border border-2 border-dashed border-indigo-500 bg-indigo-500/15"
              style={{ display: 'none' }}
            />
          </div>
        </div>

        <div className="sticky top-20 flex h-fit flex-col rounded-2xl border border-gray-200 bg-white p-6 shadow-lg">
          <h3 className="text-sm font-semibold text-gray-900">Selected Items ({crops.length})</h3>

          {crops.length === 0 && (
            <p className="mt-4 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 px-4 py-10 text-center text-sm text-gray-400">
              No items selected yet
            </p>
          )}

          <div className="mt-4 flex max-h-80 flex-col gap-3 overflow-y-auto">
            {crops.map((crop, index) => (
              <div key={index} className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3 transition hover:bg-gray-100">
                <img src={crop.imageData} alt={`Crop ${index + 1}`} className="h-[52px] w-[52px] rounded-md object-cover shadow-sm" />
                <div className="flex flex-1 flex-col gap-1">
                  <span className="text-sm font-semibold text-gray-900">Item {index + 1}</span>
                  <button
                    className="w-fit rounded-md px-2 py-1 text-xs text-gray-400 transition hover:bg-red-50 hover:text-red-500"
                    onClick={() => handleRemoveCrop(index)}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>

          {crops.length > 0 && (
            <button className="mt-4 w-full rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-md transition hover:-translate-y-0.5 hover:shadow-lg disabled:cursor-not-allowed disabled:from-gray-300 disabled:to-gray-300 disabled:shadow-none disabled:translate-y-0" onClick={handleSubmit}>
              Find Matches ({crops.length} items)
            </button>
          )}

          <button className="mt-3 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-500 transition hover:border-gray-300 hover:bg-gray-50 hover:text-gray-700" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>

      {/* Confirm crop modal (simplified - no category selection) */}
      {pendingCrop && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-[90%] max-w-md rounded-3xl bg-white p-7 shadow-xl animate-slide-up">
            <h3 className="text-center text-lg font-semibold text-gray-900">Add Item</h3>
            <img src={pendingCrop.imageData} alt="Selected crop" className="mt-5 max-h-44 w-full rounded-xl bg-gray-100 object-contain" />

            <p className="mt-5 text-center text-sm text-gray-600">
              Add this selection as Item {crops.length + 1}?
            </p>

            <div className="mt-6 flex gap-3">
              <button
                className="flex-1 rounded-xl bg-gray-100 px-4 py-3 text-sm font-semibold text-gray-600 transition hover:bg-gray-200"
                onClick={() => setPendingCrop(null)}
              >
                Cancel
              </button>
              <button className="flex-1 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-md transition hover:-translate-y-0.5" onClick={handleAddCrop}>
                Add Item
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ImageCropper;
