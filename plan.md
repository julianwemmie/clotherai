# ClotherAI - Full-Stack MVP Implementation Plan

## Project Overview
Build an outfit tracking app where users upload daily outfit photos, crop clothing items, and the system matches them against their wardrobe database using AI embeddings. This enables users to see which clothes they actually wear vs. what sits unused.

## Tech Stack
- **Frontend**: React + TypeScript (Vite)
- **Backend**: Python + FastAPI
- **Database**: SQLite + sqlite-vec extension
- **Embeddings**: Jina AI Embeddings v4 API (2048-dimensional vectors)
- **Image Storage**: Local filesystem

---

## Phase 1: Project Setup & Infrastructure

### 1.1 Initialize Project Structure
Create the following directory structure:
```
ClotherAI/
├── frontend/          # React TypeScript app
├── backend/           # Python FastAPI server
├── data/              # SQLite database and uploaded images
│   └── images/        # Organized by item_id
├── .gitignore
└── README.md
```

### 1.2 Frontend Setup (React + TypeScript)
- Initialize Vite React TypeScript project in `frontend/`
- Install dependencies:
  - `react-router-dom` for navigation
  - `axios` for API calls
  - CSS framework (Tailwind CSS or simple CSS modules)
- Configure proxy to backend (port 8000)
- Create basic project structure:
  ```
  frontend/src/
  ├── components/
  │   ├── PhotoUpload.tsx       # Upload outfit photo
  │   ├── ImageCropper.tsx      # Crop clothing items
  │   ├── MatchResults.tsx      # Show top 5 matches
  │   └── WardrobeView.tsx      # View all items + wear frequency
  ├── services/
  │   └── api.ts                # API client for backend
  ├── types/
  │   └── index.ts              # TypeScript interfaces
  ├── App.tsx
  └── main.tsx
  ```

### 1.3 Backend Setup (Python + FastAPI)
- Use **uv** for Python package management
- Initialize project with `uv init` in backend directory
- Install dependencies via uv:
  - `fastapi`
  - `uvicorn[standard]` for server
  - `python-multipart` for file uploads
  - `requests` for Jina AI API calls
  - `sqlite-vec` for vector search
  - `Pillow` for image processing
  - `numpy` for vector operations
  - `pydantic` for data validation
- Create backend structure:
  ```
  backend/
  ├── app/
  │   ├── main.py              # FastAPI app entry point
  │   ├── database.py          # SQLite connection & setup
  │   ├── models.py            # Pydantic models
  │   ├── routers/
  │   │   ├── upload.py        # Photo upload endpoint
  │   │   ├── items.py         # Item CRUD operations
  │   │   └── matching.py      # Similarity search
  │   └── services/
  │       ├── embedding.py     # Vertex AI integration
  │       ├── matching.py      # Cosine similarity logic
  │       └── thumbnail.py     # AI-generated flat thumbnails
  ├── main.py                  # Server entry point with uvicorn
  └── pyproject.toml           # uv project config
  ```

### 1.4 Database Schema (SQLite + sqlite-vec)
Create SQLite database with the following tables:

**Table: `clothing_items`**
```sql
CREATE TABLE clothing_items (
    item_id TEXT PRIMARY KEY,           -- UUID
    name TEXT NOT NULL,                 -- User-provided name
    category TEXT,                      -- 'top', 'bottom', 'outerwear', 'shoes', etc.
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_worn TIMESTAMP,
    wear_count INTEGER DEFAULT 0,
    thumbnail_path TEXT                 -- AI-generated flat thumbnail
);
```

**Table: `item_images`** (stores reference images and embeddings)
```sql
CREATE TABLE item_images (
    image_id TEXT PRIMARY KEY,          -- UUID
    item_id TEXT NOT NULL,              -- Foreign key to clothing_items
    image_path TEXT NOT NULL,           -- Path to cropped image
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (item_id) REFERENCES clothing_items(item_id)
);
```

**Table: `embeddings`** (using sqlite-vec virtual table)
```sql
CREATE VIRTUAL TABLE embeddings USING vec0(
    image_id TEXT PRIMARY KEY,          -- Links to item_images
    embedding FLOAT[2048]               -- 2048-dim vector from Jina Embeddings v4
);
```

**Table: `wear_logs`** (tracks when items were worn)
```sql
CREATE TABLE wear_logs (
    log_id TEXT PRIMARY KEY,            -- UUID
    item_id TEXT NOT NULL,              -- Foreign key to clothing_items
    worn_date DATE NOT NULL,
    outfit_image_path TEXT,             -- Original full outfit photo
    FOREIGN KEY (item_id) REFERENCES clothing_items(item_id)
);
```

---

## Phase 2: Core Feature Implementation

### 2.1 Photo Upload Flow (Frontend)
**File**: [frontend/src/components/PhotoUpload.tsx](frontend/src/components/PhotoUpload.tsx)

- Create file input for image upload
- Display uploaded image preview
- Validate file type (jpg, png) and size
- Send image to backend via POST `/api/upload`
- Navigate to cropping view on success

### 2.2 Image Cropping Interface (Frontend)
**File**: [frontend/src/components/ImageCropper.tsx](frontend/src/components/ImageCropper.tsx)

- Display uploaded outfit photo on HTML canvas
- Implement click-and-drag rectangular selection
- Allow user to define multiple crop regions sequentially:
  1. Select region → label type (top/bottom/outerwear)
  2. Extract cropped region as base64
  3. Add to list of cropped items
  4. Repeat for each clothing piece
- Submit all cropped regions to backend: POST `/api/process-crops`

### 2.3 Embedding Generation (Backend)
**File**: [backend/app/services/embedding.py](backend/app/services/embedding.py)

- Accept cropped image from frontend
- Convert image to format required by Vertex AI
- Call Google Vertex AI Multimodal Embeddings API:
  ```python
  from google.cloud import aiplatform
  from vertexai.vision_models import MultiModalEmbeddingModel

  model = MultiModalEmbeddingModel.from_pretrained("multimodalembedding@001")
  embeddings = model.get_embeddings(image=image_data)
  return embeddings.image_embedding  # 1408-dim vector
  ```
- Handle API errors and rate limits
- Return embedding vector (1408 floats)

### 2.4 Similarity Matching (Backend)
**File**: [backend/app/services/matching.py](backend/app/services/matching.py)

- Accept embedding vector for new cropped item
- Query sqlite-vec for most similar embeddings (e.g., top 20 candidates)
- **De-duplicate by item_id**: Group results by `item_id` and take the best match for each distinct clothing item
- Return top 5 **unique clothing items** (not 5 images of the same item):
  ```sql
  -- Get top match for each distinct item
  WITH ranked_matches AS (
    SELECT
      e.image_id,
      i.item_id,
      c.name,
      c.category,
      vec_distance_cosine(e.embedding, ?) as distance,
      ROW_NUMBER() OVER (PARTITION BY i.item_id ORDER BY vec_distance_cosine(e.embedding, ?) ASC) as rn
    FROM embeddings e
    JOIN item_images i ON e.image_id = i.image_id
    JOIN clothing_items c ON i.item_id = c.item_id
  )
  SELECT image_id, item_id, name, category, distance
  FROM ranked_matches
  WHERE rn = 1  -- Only best match per item
  ORDER BY distance ASC
  LIMIT 5;
  ```
- Return list of 5 unique items with their best similarity scores
- If no existing items or best similarity < threshold (e.g., 0.7), treat as new item

### 2.5 Match Results Display (Frontend)
**File**: [frontend/src/components/MatchResults.tsx](frontend/src/components/MatchResults.tsx)

- Show top 5 matching items with:
  - Thumbnail of reference image
  - Item name
  - Similarity percentage
  - "This is it!" button to confirm match
  - "Not a match" / "New item" button
- If user confirms match:
  - POST `/api/items/{item_id}/wear` to log wear event
  - Save new reference image for this item
  - Update wear count and last_worn timestamp
- If user marks as new item:
  - Show dialog to name the item and select category
  - POST `/api/items/create` to create new wardrobe entry
  - Save cropped image and embedding

### 2.6 Item Management Endpoints (Backend)
**File**: [backend/app/routers/items.py](backend/app/routers/items.py)

**Endpoints**:
- `POST /api/items/create` - Create new clothing item
  - Generate UUID for item_id and image_id
  - Save cropped image to `data/images/{item_id}/{image_id}.jpg`
  - Insert into `clothing_items` and `item_images`
  - Store embedding in `embeddings` table

- `POST /api/items/{item_id}/wear` - Log wear event
  - Insert record into `wear_logs`
  - Increment `wear_count` in `clothing_items`
  - Update `last_worn` timestamp
  - Save new reference image to improve future matching

- `GET /api/items` - List all wardrobe items
  - Return all items with wear stats

- `GET /api/items/{item_id}` - Get single item details
  - Return item info + all reference images

---

## Phase 3: Wardrobe View & Insights

### 3.1 Wardrobe Dashboard (Frontend)
**File**: [frontend/src/components/WardrobeView.tsx](frontend/src/components/WardrobeView.tsx)

- Display grid of all clothing items
- Show for each item:
  - **AI-generated flat thumbnail** (see 3.1a below)
  - Item name
  - Wear count
  - Last worn date
- Sort options:
  - Most worn → Least worn
  - Recently worn → Not worn in a while
  - Newest → Oldest
- Color coding:
  - Green: Worn in last 30 days
  - Yellow: Worn 30-90 days ago
  - Red: Not worn in 90+ days

### 3.1a AI-Generated Flat Thumbnails
**File**: [backend/app/services/thumbnail.py](backend/app/services/thumbnail.py)

Generate clean, flat-lay style thumbnail images of clothing items for the wardrobe grid view.

**Approach Options**:
1. **Use Google Imagen or similar image generation API** to create a clean flat-lay representation:
   - Input: Cropped clothing item photo
   - Prompt: "A flat lay product photo of [category] on white background, studio lighting, top-down view"
   - Cache generated thumbnails to avoid regenerating

2. **Simple background removal + padding**:
   - Use background removal API (e.g., remove.bg API or RMBG model)
   - Center the clothing item on white/neutral background
   - Simpler and cheaper than full image generation

**Implementation**:
- Generate thumbnail when item is first created
- Store thumbnail path in database (add `thumbnail_path` column to `clothing_items`)
- Serve thumbnails via backend endpoint: `GET /api/items/{item_id}/thumbnail`
- Fallback to original cropped image if thumbnail generation fails

**Database Update**:
```sql
ALTER TABLE clothing_items ADD COLUMN thumbnail_path TEXT;
```

### 3.2 Basic Insights
- Total wardrobe size
- Most worn items (top 10)
- Least worn items (bottom 10)
- Items never worn (wear_count = 0)
- Average wears per item

---

## Phase 4: Polish & Error Handling

### 4.1 Error Handling
- Handle Vertex AI API failures gracefully
- Validate image formats and sizes
- Handle missing database tables (auto-create on startup)
- Show user-friendly error messages in UI

### 4.2 User Experience Improvements
- Loading states during embedding generation
- Success/failure toast notifications
- Confirmation dialogs for destructive actions
- Responsive design for mobile use

### 4.3 Configuration
- Environment variables for:
  - `GOOGLE_APPLICATION_CREDENTIALS` path
  - `GCP_PROJECT_ID`
  - `DATABASE_PATH`
  - `IMAGES_PATH`
- Create `.env.example` files for both frontend and backend

---

## Critical Files to Create/Modify

### Frontend
1. [frontend/src/components/PhotoUpload.tsx](frontend/src/components/PhotoUpload.tsx) - Upload UI
2. [frontend/src/components/ImageCropper.tsx](frontend/src/components/ImageCropper.tsx) - Cropping tool
3. [frontend/src/components/MatchResults.tsx](frontend/src/components/MatchResults.tsx) - Match display
4. [frontend/src/components/WardrobeView.tsx](frontend/src/components/WardrobeView.tsx) - Wardrobe grid
5. [frontend/src/services/api.ts](frontend/src/services/api.ts) - API client
6. [frontend/src/App.tsx](frontend/src/App.tsx) - Main app with routing

### Backend
1. [backend/app/main.py](backend/app/main.py) - FastAPI app
2. [backend/app/database.py](backend/app/database.py) - DB connection & schema
3. [backend/app/services/embedding.py](backend/app/services/embedding.py) - Vertex AI integration
4. [backend/app/services/matching.py](backend/app/services/matching.py) - De-duplicated similarity search
5. [backend/app/services/thumbnail.py](backend/app/services/thumbnail.py) - AI thumbnail generation
6. [backend/app/routers/upload.py](backend/app/routers/upload.py) - Upload endpoint
7. [backend/app/routers/items.py](backend/app/routers/items.py) - Item CRUD
8. [backend/pyproject.toml](backend/pyproject.toml) - uv project config

### Configuration
1. [.gitignore](.gitignore) - Ignore node_modules, venv, data/, .env
2. [README.md](README.md) - Setup instructions
3. [backend/.env.example](backend/.env.example) - Environment template

---

## Verification & Testing

### End-to-End Test Flow
1. **Start Backend**: `cd backend && uv run python main.py` → Server runs on http://localhost:8000
2. **Start Frontend**: `cd frontend && npm run dev` → App runs on http://localhost:5173
3. **Upload Photo**: Navigate to app, upload outfit photo
4. **Crop Items**: Draw rectangle around top, label as "top", submit
5. **View Matches**: Should show "No matches - new item" for first upload
6. **Create Item**: Name it "Blue T-shirt", confirm
7. **Verify Storage**:
   - Check `data/images/` for saved cropped image
   - Query SQLite to verify item in `clothing_items`
   - Query `embeddings` table to verify vector stored
8. **Upload Second Photo**: Same blue t-shirt from different angle
9. **Crop & Match**: Should show "Blue T-shirt" as top match with high similarity (>80%)
10. **Confirm Match**: Click "This is it!" to log wear
11. **Check Wardrobe**: Navigate to wardrobe view, see "Blue T-shirt" with wear_count=2

### Unit Tests to Add Later
- Embedding generation with mock Vertex AI responses
- Similarity matching with sample vectors
- Database CRUD operations
- Image cropping boundary cases

### Integration Tests
- Full upload → crop → match → log flow
- Error handling when Vertex AI is unavailable
- Handling duplicate item detection

---

## Implementation Order

**Stage 1: Foundation**
1. Set up project structure (frontend + backend directories)
2. Initialize React TypeScript app with Vite
3. Set up Python FastAPI backend with uv and basic "hello world" endpoint
4. Create SQLite database with schema
5. Install sqlite-vec extension and test vector operations

**Stage 2: Core Upload & Embedding Flow**
6. Build photo upload component and endpoint
7. Implement image cropping interface with canvas
8. Integrate Google Vertex AI embedding generation
9. Save cropped images and embeddings to database
10. Test full upload → crop → embed → save pipeline

**Stage 3: Matching & Item Management**
11. Implement de-duplicated similarity search with sqlite-vec (top 5 unique items)
12. Build match results display component
13. Create endpoints for confirming matches and creating new items
14. Implement wear logging functionality
15. Test matching accuracy with real photos

**Stage 4: Wardrobe View & Polish**
16. Build wardrobe dashboard with item grid
17. Implement AI-generated flat thumbnails for grid view
18. Add insights (wear frequency, last worn, etc.)
19. Polish UI/UX (loading states, error handling, notifications)
20. Add configuration files and documentation
21. End-to-end testing and bug fixes

---

## Future Enhancements (Post-MVP)
- **Phase 2**: Auto-segmentation using SAM or similar model (eliminate manual cropping)
- **Phase 3**: Advanced analytics (seasonal trends, color analysis, outfit combinations)
- **Performance**: Migrate to self-hosted DINOv2 embeddings to reduce API costs
- **Mobile**: Build React Native app for easier daily logging
- **Social**: Share wardrobe stats, outfit inspiration from community

---

## Assumptions & Prerequisites
- You have a Google Cloud Platform project with Vertex AI API enabled
- You have created a service account with Vertex AI permissions
- You have downloaded the service account JSON key file
- Your GCP project has sufficient quota for Vertex AI Multimodal Embeddings API
- You'll set `GOOGLE_APPLICATION_CREDENTIALS` environment variable to the key file path
- SQLite version supports extensions (most modern versions do)
- Node.js 18+ and Python 3.9+ are installed
- uv package manager is installed

## Success Criteria
✅ User can upload outfit photo
✅ User can manually crop clothing items
✅ System generates embeddings via Vertex AI
✅ System matches crops against wardrobe database with de-duplication
✅ User can confirm matches or create new items
✅ Wear frequency tracking works correctly
✅ Wardrobe view displays all items with AI-generated thumbnails and stats
✅ Cold-start experience is smooth (no upfront cataloging needed)