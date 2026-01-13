# ClotherAI

An AI-powered outfit tracking app that helps you understand which clothes you actually wear vs. what sits unused in your wardrobe.

## What It Does

ClotherAI lets you:
- Upload daily outfit photos
- Crop individual clothing items from the photo
- Automatically match cropped items against your wardrobe database using AI embeddings
- Track wear frequency for each piece of clothing
- View wardrobe insights (most worn, least worn, never worn items)

The app uses a "cold-start" approach - no need to catalog your entire wardrobe upfront. Just start uploading outfits, and the system builds your wardrobe database organically as you wear different items.

## Tech Stack

- **Frontend**: React + TypeScript (Vite)
- **Backend**: Python + FastAPI
- **Database**: SQLite + sqlite-vec extension for vector similarity search
- **Embeddings**: Jina AI Embeddings v4 API (2048-dimensional vectors)
- **Image Storage**: Local filesystem
- **Package Management**: uv for Python dependencies

## Project Structure

```
ClotherAI/
├── frontend/          # React TypeScript app
├── backend/           # Python FastAPI server
├── data/              # SQLite database and uploaded images
│   └── images/        # Organized by item_id
├── plan.md            # Detailed implementation plan
├── PROGRESS.md        # Development progress tracking
└── README.md          # This file
```

## Database Schema

### Tables
- **clothing_items**: Wardrobe items with metadata (name, category, wear count, last worn date)
- **item_images**: Reference images for each clothing item
- **embeddings**: Vector embeddings for similarity search (using sqlite-vec)
- **wear_logs**: Historical record of when items were worn

## Key Features

### 1. Photo Upload & Cropping
- Upload daily outfit photos
- Use interactive canvas to crop individual clothing items
- Label items by category (top, bottom, outerwear, shoes)

### 2. AI-Powered Matching
- Generate embeddings using Jina AI Embeddings v4
- Find similar items using cosine similarity search
- De-duplicate results to show top 5 unique clothing items
- Threshold-based new item detection

### 3. Wardrobe Management
- View all items in a grid with AI-generated flat thumbnails
- Track wear frequency and last worn dates
- Sort by most/least worn, recently worn, or date added
- Color-coded indicators:
  - 🟢 Green: Worn in last 30 days
  - 🟡 Yellow: Worn 30-90 days ago
  - 🔴 Red: Not worn in 90+ days

### 4. Insights
- Total wardrobe size
- Most/least worn items
- Items never worn
- Average wears per item

## Implementation Stages

The project is divided into 4 development stages:

**Stage 1: Foundation**
- Project structure setup
- React TypeScript frontend initialization
- Python FastAPI backend with uv
- SQLite database with sqlite-vec extension

**Stage 2: Core Upload & Embedding Flow**
- Photo upload component and endpoint
- Image cropping interface with canvas
- Jina AI embedding generation integration
- Image and embedding storage

**Stage 3: Matching & Item Management**
- De-duplicated similarity search (top 5 unique items)
- Match results display
- Match confirmation and new item creation
- Wear logging functionality

**Stage 4: Wardrobe View & Polish**
- Wardrobe dashboard with item grid
- AI-generated flat thumbnails
- Insights and analytics
- UI/UX polish and error handling

## Prerequisites

- Google Cloud Platform project with Vertex AI API enabled
- Service account with Vertex AI permissions
- Service account JSON key file
- `GOOGLE_APPLICATION_CREDENTIALS` environment variable set
- Node.js 18+
- Python 3.9+
- uv package manager

## Environment Configuration

Required environment variables:
- `GOOGLE_APPLICATION_CREDENTIALS` - Path to GCP service account key
- `GCP_PROJECT_ID` - Your Google Cloud project ID
- `DATABASE_PATH` - Path to SQLite database file
- `IMAGES_PATH` - Path to image storage directory

## Running the Application

### Backend
```bash
cd backend
uv run python main.py
# Server runs on http://localhost:8000
```

### Frontend
```bash
cd frontend
npm run dev
# App runs on http://localhost:5173
```

## Success Criteria

- ✅ User can upload outfit photos
- ✅ User can manually crop clothing items
- ✅ System generates embeddings via Jina AI
- ✅ System matches crops against wardrobe with de-duplication
- ✅ User can confirm matches or create new items
- ✅ Wear frequency tracking works correctly
- ✅ Wardrobe view displays items with AI thumbnails and stats
- ✅ Cold-start experience is smooth (no upfront cataloging needed)

## Future Enhancements

- Auto-segmentation using SAM or similar model (eliminate manual cropping)
- Advanced analytics (seasonal trends, color analysis, outfit combinations)
- Self-hosted DINOv2 embeddings to reduce API costs
- React Native mobile app for easier daily logging
- Social features (share stats, outfit inspiration)

## Documentation

See [plan.md](plan.md) for the complete implementation plan with detailed technical specifications.

See [PROGRESS.md](PROGRESS.md) for current development status.
