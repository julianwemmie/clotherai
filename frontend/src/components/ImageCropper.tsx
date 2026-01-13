import { useState, useRef, useCallback } from 'react';
import type { CroppedItem } from '../types/index.js';

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
    <div className="image-cropper">
      <h2>Select Clothing Items</h2>
      <p className="instructions">
        Click and drag to select each clothing item in your outfit photo.
      </p>

      <div className="cropper-container">
        <div
          ref={containerRef}
          className="image-container"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <div className="image-wrapper">
            <img
              ref={imageRef}
              src={imageUrl}
              alt="Outfit to crop"
              className="cropper-image"
              draggable={false}
            />

            {/* Existing crop overlays */}
            {crops.map((crop, index) => (
              <div
                key={index}
                className="crop-overlay existing"
                style={getCropStyle(crop)}
              >
                <span className="crop-label">Item {index + 1}</span>
              </div>
            ))}

            {/* Current selection overlay - uses ref for performance */}
            <div
              ref={selectionRef}
              className="crop-overlay selecting"
              style={{ display: 'none' }}
            />
          </div>
        </div>

        <div className="crops-sidebar">
          <h3>Selected Items ({crops.length})</h3>

          {crops.length === 0 && (
            <p className="no-crops">No items selected yet</p>
          )}

          <div className="crops-list">
            {crops.map((crop, index) => (
              <div key={index} className="crop-item">
                <img src={crop.imageData} alt={`Crop ${index + 1}`} />
                <div className="crop-info">
                  <span className="crop-category">Item {index + 1}</span>
                  <button
                    className="remove-crop"
                    onClick={() => handleRemoveCrop(index)}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>

          {crops.length > 0 && (
            <button className="submit-crops" onClick={handleSubmit}>
              Find Matches ({crops.length} items)
            </button>
          )}

          <button className="cancel-button" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>

      {/* Confirm crop modal (simplified - no category selection) */}
      {pendingCrop && (
        <div className="category-modal-overlay">
          <div className="category-modal">
            <h3>Add Item</h3>
            <img src={pendingCrop.imageData} alt="Selected crop" className="pending-crop-preview" />

            <p className="modal-description">
              Add this selection as Item {crops.length + 1}?
            </p>

            <div className="modal-actions">
              <button className="add-crop-button" onClick={handleAddCrop}>
                Add Item
              </button>
              <button
                className="cancel-crop-button"
                onClick={() => setPendingCrop(null)}
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

export default ImageCropper;
