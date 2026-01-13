import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { CroppedItem, MatchResult } from '../types/index.js';
import { uploadPhoto, processCrops } from '../services/api.js';
import ImageCropper from './ImageCropper.js';
import MatchResults from './MatchResults.js';

type Stage = 'upload' | 'crop' | 'match';

function PhotoUpload() {
  const navigate = useNavigate();
  const [stage, setStage] = useState<Stage>('upload');
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // For cropping stage
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);

  // For matching stage
  const [crops, setCrops] = useState<CroppedItem[]>([]);
  const [matches, setMatches] = useState<MatchResult[][]>([]);

  const handleFileSelect = async (file: File) => {
    // Validate file type
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      setError('Please select a JPEG or PNG image');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB');
      return;
    }

    setError(null);
    setUploading(true);

    // Read file and immediately transition to crop stage
    const reader = new FileReader();
    reader.onloadend = async () => {
      const previewUrl = reader.result as string;

      try {
        await uploadPhoto(file);
        // Use the local preview URL for cropping
        setUploadedImageUrl(previewUrl);
        setStage('crop');
      } catch (err) {
        console.error('Upload failed:', err);
        setError('Failed to upload image. Please try again.');
      } finally {
        setUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleCropsComplete = async (completedCrops: CroppedItem[]) => {
    setCrops(completedCrops);
    setProcessing(true);
    setError(null);

    try {
      const matchResults = await processCrops(completedCrops);
      setMatches(matchResults);
      setStage('match');
    } catch (err) {
      console.error('Processing failed:', err);
      setError('Failed to process crops. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const handleCropCancel = () => {
    setStage('upload');
    setUploadedImageUrl(null);
  };

  const handleMatchComplete = () => {
    // Reset and go back to upload, or navigate to wardrobe
    navigate('/wardrobe');
  };

  const handleReset = () => {
    setStage('upload');
    setUploadedImageUrl(null);
    setCrops([]);
    setMatches([]);
    setError(null);
  };

  // Render upload stage
  if (stage === 'upload') {
    return (
      <div className="photo-upload">
        {error && (
          <div className="error-message">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {error}
          </div>
        )}

        {uploading ? (
          <div className="processing-message">
            <div className="spinner"></div>
            <h2>Uploading...</h2>
            <p>Preparing your image for cropping</p>
          </div>
        ) : (
          <div className="upload-hero">
            <h2>Upload Your Outfit</h2>
            <p>Take a photo of what you're wearing today and we'll help you track it in your wardrobe</p>

            <div className="upload-container">
              <input
                type="file"
                accept="image/jpeg,image/png"
                onChange={handleInputChange}
                id="file-input"
              />
              <label
                htmlFor="file-input"
                className={`upload-dropzone ${isDragging ? 'dragging' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <div className="upload-dropzone-content">
                  <div className="upload-icon">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                      <polyline points="17 8 12 3 7 8"/>
                      <line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                  </div>
                  <span className="upload-text">Drop your photo here or click to browse</span>
                  <span className="upload-hint">Supports JPEG and PNG up to 10MB</span>
                </div>
              </label>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Render crop stage
  if (stage === 'crop' && uploadedImageUrl) {
    return (
      <div className="photo-upload">
        {error && (
          <div className="error-message">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {error}
          </div>
        )}

        {processing ? (
          <div className="processing-message">
            <div className="spinner"></div>
            <h2>Processing...</h2>
            <p>Analyzing your clothing items and searching for matches</p>
          </div>
        ) : (
          <ImageCropper
            imageUrl={uploadedImageUrl}
            onCropsComplete={handleCropsComplete}
            onCancel={handleCropCancel}
          />
        )}
      </div>
    );
  }

  // Render match stage
  if (stage === 'match') {
    return (
      <div className="photo-upload">
        {error && (
          <div className="error-message">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {error}
          </div>
        )}

        <MatchResults
          crops={crops}
          matches={matches}
          onComplete={handleMatchComplete}
        />

        <button className="reset-button" onClick={handleReset}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '0.5rem' }}>
            <polyline points="1 4 1 10 7 10"/>
            <path d="M3.51 15a9 9 0 102.13-9.36L1 10"/>
          </svg>
          Start Over
        </button>
      </div>
    );
  }

  return null;
}

export default PhotoUpload;
