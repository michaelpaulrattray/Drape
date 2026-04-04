# Canvas Board System — Phase 1 Plan

## Overview

Phase 1 replaces the current session-based, tool-switching studio with a **persistent board workspace** inspired by Luma's free-form canvas approach. Users start from a lobby, choose an intent (Cast or Style), and land in a board where all tools, assets, and iterations live together. The existing tool internals (casting, wardrobe, export) remain unchanged — only the container they render in changes.

**Guiding principle:** build the board as a parallel route (`/app/board/:id`) alongside the existing `/studio`. The classic studio continues to work untouched until the board is validated and promoted to default.

---

## Route Structure

| Route | Purpose | Auth |
|---|---|---|
| `/` | Landing page (unchanged) | Public |
| `/login` | Auth (unchanged) | Public |
| `/app` | Board lobby — list of user's boards, "New Board" entry points | Protected |
| `/app/board/:id` | A specific board canvas | Protected |
| `/app/wardrobe` | Global garment library (future — Phase 2) | Protected |
| `/app/models` | Cast models library (future — Phase 2) | Protected |
| `/studio` | Classic studio (unchanged, kept as fallback) | Protected |
| `/admin/*` | Admin panel (unchanged) | Admin |
| `/moderator` | Moderator panel (unchanged) | Moderator |

The existing `/studio` route stays functional throughout Phase 1. A banner or toggle in the lobby lets users switch between "Classic Studio" and "Board View" during the transition period.

---

## Database Schema (Additive Only)

Two new tables. No existing tables are modified — only new foreign keys are added to future records.

### `boards` table

```
boards
├── id              INT AUTO_INCREMENT PK
├── userId          INT NOT NULL (FK → users)
├── name            VARCHAR(128) NOT NULL (default: "Untitled Board")
├── description     TEXT (optional)
├── thumbnail       TEXT (S3 URL — auto-generated from first asset)
├── startedWith     ENUM('casting', 'wardrobe') NOT NULL
├── status          ENUM('active', 'archived') DEFAULT 'active'
├── createdAt       TIMESTAMP DEFAULT NOW()
├── updatedAt       TIMESTAMP DEFAULT NOW() ON UPDATE NOW()
└── INDEX(userId, status)
```

### `board_items` table

Each item on the canvas — a model, garment, VTO output, reference image, or iteration.

```
board_items
├── id              INT AUTO_INCREMENT PK
├── boardId         INT NOT NULL (FK → boards)
├── type            ENUM('model', 'garment', 'vto_result', 'reference', 'iteration', 'note')
├── label           VARCHAR(256) (user-editable label)
├── imageUrl        TEXT (S3 URL of the visual)
├── imageKey        VARCHAR(256) (S3 key)
├── positionX       INT DEFAULT 0 (canvas X coordinate)
├── positionY       INT DEFAULT 0 (canvas Y coordinate)
├── width           INT DEFAULT 280 (card width on canvas)
├── height          INT DEFAULT 280 (card height on canvas)
├── parentItemId    INT (FK → board_items, self-ref — links iteration to parent, VTO to model+garment)
├── sourceModelId   INT (FK → models — if this item represents a cast model)
├── sourceGarmentId INT (FK → wardrobe_garments — if this item is a garment)
├── sourceSessionId INT (FK → wardrobe_sessions — if this item is a VTO result)
├── metadata        JSON (tool-specific data: casting preferences, style notes, etc.)
├── zIndex          INT DEFAULT 0 (layering order)
├── createdAt       TIMESTAMP DEFAULT NOW()
└── INDEX(boardId, type)
```

### Why these two tables are enough

The `board_items` table is intentionally denormalized. Each item stores its own `imageUrl` and `position`, regardless of whether the underlying asset is a model, garment, or VTO result. The `source*Id` columns are optional back-references to existing tables — they let us link a board item to its original data without duplicating it. This means:

- Casting outputs automatically become board items (just insert a row with `sourceModelId` pointing to the `models` table).
- Garments pulled from the library become board items (with `sourceGarmentId` pointing to `wardrobe_garments`).
- VTO results become board items (with `sourceSessionId` and `parentItemId` linking to the model and garment items).
- Iterations link to their parent via `parentItemId`, creating a visual tree on the canvas.

No existing tables need migration. The `models`, `wardrobe_garments`, `wardrobe_sessions`, and `wardrobe_looks` tables continue to work exactly as they do today.

---

## Build Steps (Ordered, One Checkpoint Per Step)

### Step 1: Schema + DB Migration

**What:** Add `boards` and `board_items` tables to `drizzle/schema.ts` and push migration.

**Changes:**
- `drizzle/schema.ts` — add two new table definitions
- Run `pnpm db:push`

**Risk:** None — purely additive, no existing tables touched.

**Checkpoint after this step.**

---

### Step 2: Server Procedures (CRUD for Boards + Items)

**What:** Add tRPC procedures for board and item management.

**New file:** `server/routers/boards.ts` (or extend `server/routers.ts`)

**Procedures:**

| Procedure | Type | Auth | Description |
|---|---|---|---|
| `boards.create` | Mutation | Protected | Create a new board (name, startedWith) |
| `boards.list` | Query | Protected | List user's boards (paginated, sorted by updatedAt) |
| `boards.get` | Query | Protected | Get a single board with all its items |
| `boards.update` | Mutation | Protected | Update board name/description |
| `boards.archive` | Mutation | Protected | Soft-delete a board |
| `boards.items.add` | Mutation | Protected | Add an item to a board |
| `boards.items.update` | Mutation | Protected | Update item position/size/label |
| `boards.items.remove` | Mutation | Protected | Remove an item from a board |
| `boards.items.batchUpdate` | Mutation | Protected | Batch update positions (for drag operations) |

All procedures use Zod validation, `protectedProcedure`, and ownership checks (`board.userId === ctx.user.id`).

**Checkpoint after this step.**

---

### Step 3: Board Lobby Page (`/app`)

**What:** A new page that lists the user's boards and provides entry points to create new ones.

**New file:** `client/src/pages/AppLobby.tsx`

**Layout:**
- Header with user avatar, credits display, and settings
- "New Board" section with two entry points: "Cast a Model" and "Style a Model"
- Grid of existing boards (thumbnail, name, date, item count)
- Click a board → navigate to `/app/board/:id`
- Click "Cast a Model" → create board with `startedWith: 'casting'` → navigate to new board
- Click "Style a Model" → create board with `startedWith: 'wardrobe'` → navigate to new board

**Reuses:** `StudioHeader` (credits display), existing auth hooks.

**Route registration:** Add `/app` route to `App.tsx`.

**Checkpoint after this step.**

---

### Step 4: Canvas Engine (React Flow Integration)

**What:** Install React Flow and build the core canvas component with pan, zoom, and drag.

**New files:**
- `client/src/features/board/components/BoardCanvas.tsx` — React Flow wrapper with custom node types
- `client/src/features/board/components/BoardItemNode.tsx` — Custom node rendering for each item type
- `client/src/features/board/stores/useBoardStore.ts` — Zustand store for board state (current board, items, viewport)

**Capabilities:**
- Infinite canvas with pan (mouse drag on background) and zoom (scroll wheel)
- Items rendered as draggable cards with image preview, label, and type badge
- Drag to reposition → debounced `boards.items.batchUpdate` call
- Zoom controls (bottom-right: +/- buttons, fit-to-view)
- Minimap (optional, can be toggled)

**React Flow gives us for free:** pan, zoom, drag, minimap, node selection, keyboard shortcuts, touch support. We only need to define custom node components for our item types.

**Checkpoint after this step.**

---

### Step 5: Board Page Shell (`/app/board/:id`)

**What:** The board page that composes the canvas with a sidebar and tool panels.

**New file:** `client/src/pages/BoardView.tsx`

**Layout:**
```
┌──────┬────────────────────────────────┬──────────┐
│      │                                │          │
│ Side │       Canvas (React Flow)      │  Tool    │
│ bar  │                                │  Panel   │
│      │       [items as cards]         │ (slides  │
│      │                                │  in/out) │
│      │                                │          │
└──────┴────────────────────────────────┴──────────┘
```

- **Left sidebar:** Simplified version of AppSidebar — board name, tool shortcuts (Cast, Style, Export), back to lobby
- **Center:** BoardCanvas with all items
- **Right panel:** AnimatedPanel that slides in when a tool is active (casting controls, wardrobe rack, export options)

**Key behavior:** Clicking a tool in the sidebar doesn't navigate away — it opens the tool panel on the right side while the canvas stays visible. The tool panel operates on the currently selected item(s) on the canvas.

**Route registration:** Add `/app/board/:id` route to `App.tsx`.

**Checkpoint after this step.**

---

### Step 6: Wire Casting Tool into Board

**What:** Make the casting flow work within a board context. When a user casts a model, the result becomes a board item.

**Changes:**
- The existing `ControlPanel`, `MasterPromptPanel`, and `ImageViewerPanel` render inside the right-side tool panel (not as full-page takeover)
- On successful cast generation, a new `board_items` row is inserted with `type: 'model'` and `sourceModelId`
- Iterations create new items with `parentItemId` pointing to the original model item
- The casting stores (`useCastingFormStore`, `useCastingGenerationStore`) work exactly as today — no changes to generation logic

**What doesn't change:** The casting API, prompt generation, image generation, credit deduction, session persistence — all identical.

**Checkpoint after this step.**

---

### Step 7: Wire Wardrobe Tool into Board

**What:** Make the wardrobe/VTO flow work within a board context.

**Changes:**
- "Add garment" pulls from the global garment library (existing `wardrobeGarments` table) and creates a board item with `type: 'garment'` and `sourceGarmentId`
- User selects a model item + garment item(s) on the canvas → "Try On" action becomes available
- VTO result creates a new board item with `type: 'vto_result'`, `parentItemId` linking to the model, and `sourceSessionId`
- The existing `WardrobeWorkspaceSection`, `RackPanel`, `LayersPanel` render in the right-side tool panel
- Wardrobe store (`useWardrobeStore`) works exactly as today

**What doesn't change:** VTO generation, garment detection, digitization, tattoo mapping, overlay system — all identical.

**Checkpoint after this step.**

---

### Step 8: Wire Export into Board

**What:** Allow exporting selected items from the board.

**Changes:**
- User selects one or more items on the canvas → "Export" action in toolbar
- ExportPanel renders in the right-side tool panel, pre-populated with selected items
- Export pack logic reads from `board_items` → resolves `sourceModelId` and garment data → generates pack as today

**What doesn't change:** Export pack generation, PDF creation, zip packaging — all identical.

**Checkpoint after this step.**

---

### Step 9: Board Auto-Save + Resume

**What:** Ensure boards persist and resume correctly.

**Changes:**
- Canvas viewport (zoom level, pan position) saved to `boards` table metadata on change (debounced)
- On board open, restore viewport and all items from DB
- Item positions saved on drag-end (already covered in Step 4)
- Board `updatedAt` timestamp refreshed on any change

**Checkpoint after this step.**

---

### Step 10: Polish + Lobby Toggle

**What:** Add a toggle between classic studio and board view, polish the UI.

**Changes:**
- Lobby page shows both "Classic Studio" link and board grid
- Board cards show thumbnail, name, item count, last modified
- Empty state for new users (no boards yet)
- Redirect `/studio` users to `/app` with a "Try the new Board View" banner (non-blocking)
- Mobile-responsive layout for lobby and board view

**Checkpoint after this step.**

---

## What Does NOT Change in Phase 1

This list is critical — it defines the safety boundary.

| System | Status | Notes |
|---|---|---|
| Casting API + generation logic | Unchanged | Same prompts, same Gemini calls, same credit deduction |
| Wardrobe VTO generation | Unchanged | Same VTO pipeline, same garment processing |
| Garment library (upload, detect, digitize) | Unchanged | Global library stays as-is, board items reference it |
| Export pack generation | Unchanged | Same PDF/zip logic |
| Auth, billing, credits, Stripe | Unchanged | Zero changes |
| Admin + moderator panels | Unchanged | Zero changes |
| Landing page | Unchanged | Zero changes |
| Classic `/studio` route | Unchanged | Stays functional as fallback |
| All existing DB tables | Unchanged | No migrations on existing tables |

---

## Technical Dependencies

| Package | Purpose | Install |
|---|---|---|
| `@xyflow/react` | React Flow v12 — canvas engine with pan/zoom/drag | `pnpm add @xyflow/react` |

React Flow is the only new dependency. It provides the infinite canvas, node rendering, edge connections (optional), minimap, and touch support out of the box. It's MIT licensed, actively maintained, and used by Stripe, Vercel, and others.

---

## Effort Estimate

| Step | Effort | Cumulative |
|---|---|---|
| 1. Schema + migration | 30 min | 30 min |
| 2. Server procedures | 1-2 hrs | 2.5 hrs |
| 3. Board lobby page | 2-3 hrs | 5.5 hrs |
| 4. Canvas engine | 2-3 hrs | 8.5 hrs |
| 5. Board page shell | 2-3 hrs | 11.5 hrs |
| 6. Wire casting | 3-4 hrs | 15.5 hrs |
| 7. Wire wardrobe | 3-4 hrs | 19.5 hrs |
| 8. Wire export | 1-2 hrs | 21.5 hrs |
| 9. Auto-save + resume | 1-2 hrs | 23.5 hrs |
| 10. Polish + toggle | 2-3 hrs | 26.5 hrs |

**Total estimate: ~25-30 hours of implementation across multiple sessions.**

This will be spread across multiple task sessions with checkpoints at every step. If any step reveals unexpected complexity, we pause and reassess before continuing.

---

## Risk Mitigation

1. **Pre-canvas checkpoint saved** — we can always rollback to the current stable state.
2. **Classic studio untouched** — if the board experiment fails, users still have the working studio.
3. **Additive DB changes only** — no existing data is at risk.
4. **Feature flag approach** — the board is a parallel route, not a replacement. Promotion to default happens only after validation.
5. **Incremental checkpoints** — one per step, so we can rollback to any intermediate state.
