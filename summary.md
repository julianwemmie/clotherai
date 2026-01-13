**Outfit Tracker App - High Level Summary**

**Goal:**
Help users identify which clothing items they actually wear versus what sits unused in their closet.

**Core User Flow:**

1. **Daily Logging:**
   - User uploads a photo of their outfit
   - User manually crops clothing regions (tops, bottoms, outerwear) - auto-segmentation comes later
   - System generates embeddings and matches against wardrobe database
   - Shows top 5 most likely items
   - User confirms matches or tags new items

2. **New Item Handling:**
   - When new clothing detected, user names the item
   - System saves the cropped clothing region and embedding as reference
   - Over time, each item accumulates multiple reference images from different wears/angles/lighting
   - Matching accuracy improves as more references are collected

3. **Insights:**
   - View wear frequency for each item
   - Identify most/least worn pieces
   - See last worn dates
   - Determine what to keep vs. donate

**User Experience Principle:**
Maximum ease of use - just upload photo, crop items, confirm matches, done. No upfront wardrobe cataloging required.

---

## Technical Implementation Decisions

### Architecture
- **Platform**: Web-based application (browser)
- **Frontend**: React + TypeScript
- **Backend**: Local Python backend for ML processing
- **Deployment**: Hybrid approach with web frontend communicating with local Python server

### Data Storage
- **Database**: SQLite with sqlite-vec extension
  - Single file storage for embeddings + metadata + image paths
  - Built-in KNN search for similarity matching
  - SIMD-accelerated performance
  - No external dependencies
- **Images**: Local file system with organized folders, paths stored in SQLite
- **Vector Search**: sqlite-vec's built-in similarity search (cosine similarity)

### Computer Vision & AI
- **Embedding API**: Google Vertex AI Multimodal Embeddings
  - Cost: $0.0001 per image (~$0.30 for MVP with 1000 items)
  - Performance: 71.5% accuracy (highest among commercial APIs)
  - 1408-dimension vectors
  - Free tier: 1000 units/month
  - Migration path to DINOv2 self-hosted available later
- **Segmentation**: Manual cropping for MVP
  - Auto-segmentation to be added in Phase 2
- **Similarity**: Cosine similarity between embeddings (built into sqlite-vec)

### MVP Development Phases
- **Phase 1** (Current): Manual photo upload, manual cropping, basic embedding generation and storage
- **Phase 2**: Add auto-segmentation once basic matching works
- **Phase 3**: Insights/analytics after data collection is stable

### User Experience Decisions
- Manual fallbacks allowed when matching confidence is low
- Cold start approach: wardrobe builds organically from daily use
- Similarity thresholds will be tweaked based on real-world testing

### Technology Stack Summary
```
Frontend: React + TypeScript
Backend: Python (FastAPI/Flask)
Database: SQLite + sqlite-vec
Vector Storage: sqlite-vec extension
Embedding API: Google Vertex AI Multimodal
Image Storage: Local file system
```