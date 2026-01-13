# Wardrobe Editing MVP (No Categories)

## Goals
- Users can manage wardrobe items from `/wardrobe`: add, rename, change thumbnail, delete.
- Manual add does **not** count as worn; wear stats only change via the upload/crop flow.
- Hard-delete removes all associated data: `wear_logs`, `item_images`, `embeddings`, and app-managed image files.
- Remove categories everywhere (UI + API); keep the code ready to reintroduce later.

## Non-goals (for now)
- Auth / multi-user
- Soft-delete / undo
- Category/tag system
- “Daily log” UI

## Data Model
- Deprecate categories entirely in API + UI.
  - Keep `clothing_items.category` in SQLite as nullable/ignored for now (simplest migration); drop later if desired.
- Tables:
  - `clothing_items`: `item_id`, `name`, `created_at`, `last_worn`, `wear_count`, `thumbnail_path`
  - `item_images`: reference images per item (`image_id`, `item_id`, `image_path`, `uploaded_at`)
  - `embeddings`: one embedding per `image_id`
  - `wear_logs`: wear events per item (deleted when item is deleted)

### Rules
- Manual item creation:
  - `wear_count = 0`
  - `last_worn = NULL`
  - no `wear_logs` row
- Logging a wear (upload flow):
  - increments `wear_count`
  - updates `last_worn`
  - inserts `wear_logs`
  - stores the crop image as a new `item_images` row + embedding

## Backend
Keep existing read endpoints conceptually, but remove `category` from all request/response shapes and queries.

### Items API
- `GET /api/items`
  - Returns list of items (no category field).
- `POST /api/items` (manual create)
  - Body: `{ name: string, image_data?: string, thumbnail_image_data?: string }`
  - Behavior:
    - Always creates a `clothing_items` row with wear stats at zero.
    - If `image_data` provided:
      - Save file under `IMAGES_PATH/<item_id>/`
      - Create `item_images` row
      - Generate + store embedding for the image
    - If no image: create the item only (shows in wardrobe with placeholder thumbnail).
    - Never logs wear.
- `PUT /api/items/{item_id}` (rename)
  - Body: `{ name?: string }`

### Thumbnail API
- `PUT /api/items/{item_id}/thumbnail`
  - Body (one of):
    - `{ image_id: string }` (pick from existing `item_images`)
    - `{ image_data: string }` (upload a custom thumbnail; stored under `IMAGES_PATH/<item_id>/`)
    - `{ clear: true }` (revert to default behavior)
- `GET /api/items/{item_id}/thumbnail`
  - Behavior:
    - If `clothing_items.thumbnail_path` exists and is readable, return it.
    - Else return the first reference image in `item_images` (oldest or newest—pick one and keep consistent).
    - Else 404 (frontend should show a placeholder).

### Delete API (hard delete)
- `DELETE /api/items/{item_id}`
  - Deletes DB rows:
    - `wear_logs` where `item_id = ?`
    - `embeddings` for **all** `image_id`s associated to the item (from `item_images`)
    - `item_images` where `item_id = ?`
    - `clothing_items` where `item_id = ?`
  - Deletes app-managed files on disk:
    - every `item_images.image_path`
    - `clothing_items.thumbnail_path` if set
    - remove `IMAGES_PATH/<item_id>/` folder if empty

#### File deletion safety (must-have)
- Only delete files if the resolved path is inside an app-owned directory (e.g. `IMAGES_PATH`).
- If `thumbnail_path` points outside app storage (ex: a user’s Downloads), do **not** delete it.

### Upload / crop flow changes (no categories)
- `POST /api/process-crops`:
  - Remove category filtering entirely.
- `POST /api/items/{item_id}/wear`:
  - Keep as the only path that increments wear stats.
- Creating a *new* item from a crop:
  - Option A (preferred consistency): `POST /api/items` (create) then `POST /api/items/{id}/wear` (log wear + store crop)
  - Option B: keep a convenience endpoint that does both in one call

## Frontend

### Wardrobe view (`/wardrobe`)
- Add a primary `+ Add item` button → opens modal.
- Each item card:
  - thumbnail (or placeholder)
  - editable name (inline edit with save/cancel)
  - wear stats (wear count + last worn)
  - actions: `Change thumbnail`, `Delete`

### Add Item modal
- Fields:
  - `Name` (required)
  - optional `Reference image` upload (optional)
  - optional `Thumbnail` upload (optional; may reuse the same image)
- Copy:
  - If no image is provided: “This item won’t be matchable until it has a reference image.”

### Change Thumbnail modal
- Shows current thumbnail.
- If item has reference images: grid to pick one as thumbnail.
- Always allow uploading a custom thumbnail image.
- Allow “Clear thumbnail” to revert to default thumbnail behavior.

### Delete confirmation modal
- Confirm/cancel with warning:
  - “This permanently deletes wear history and reference images.”

### Upload/Crop flow (no categories)
- Remove category picking everywhere:
  - Cropper: just “Add crop”; label as “Item 1/2/3…”
  - Match results: no category display or selection
  - “Create new item” from crop asks only for name

## Notable Risks / Gotchas
- Items with no images won’t match (expected); UI should warn.
- Removing category filtering will likely increase false matches; expect some threshold tuning later.
- Temp upload directory (`data/temp`) has no cleanup policy; track disk growth separately.

## Acceptance Criteria
- Manual add creates an item with `wear_count=0` and `last_worn=NULL`.
- Wardrobe allows: add item, rename item, change thumbnail, delete item.
- Deleting an item removes DB rows (`clothing_items`, `item_images`, `embeddings`, `wear_logs`) and deletes only app-managed files.
- Upload flow no longer asks for categories; confirming a match or creating a new item still logs wear correctly.

