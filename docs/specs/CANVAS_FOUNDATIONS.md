# Canvas Foundations — Drape Boards

**Audience:** engineering (including coding agents). This is the authoritative spec for the canvas boards rebuild. All architectural decisions here are locked. Read this document end to end before writing any code. Read `DESIGN_SYSTEM.md` alongside it for visual and component specifications.

---

## 1. Context and goals

Drape is shifting from a linear classic studio (`/studio`, preserved as fallback) to a Luma-style infinite canvas workspace (`/app/board/:id`) where casting, wardrobe, general image generation, references, and notes all live together spatially. The canvas is the primary surface; tools are invoked on nodes, not in side panels. Dense configuration lives inside a focused refinement studio that you enter and leave explicitly via a back action — not as a modal, not behind a scrim.

The first vertical slice is casting, built end to end on the new primitives before wardrobe is touched. The classic studio remains accessible at `/studio` during the transition and is not deleted in this phase.

**The four experiential goals that shape every decision below:**

1. The common path is fast. Typing a prompt and hitting Run generates a model in under twenty seconds without leaving the canvas.
2. Tactile controls are tactile. The blenders, color wheels, and grids that distinguish Drape are reachable in two clicks from the canvas, not buried in modals.
3. The deep path is deep. The refinement studio is a real workspace for surgical edits, version branching, and attribute-level precision — not a dialog.
4. The canvas is programmatically introspectable. Every operation a user can perform must also be callable as a pure function, so a future canvas agent can orchestrate multi-step workflows without UI simulation.

---

## 1.5 Casting's role in Drape — read this before everything else

Casting in Drape is a **reference-asset workflow, not a final-output workflow.** This framing governs every UI and data decision about casting in the rest of this doc, and understanding it up front prevents hours of confusion downstream.

A cast produces an identity-locked model with a standard package of five canonical views (`frontClose`, `frontFull`, `sideClose`, `sideFull`, `backFull`). That package is a **reference asset** — it exists so downstream generation nodes can consume it as an identity input and produce novel creative output (new poses, new scenes, new compositions, wardrobe try-ons) with guaranteed identity consistency. The five canonical views are *not* the creative deliverable; they are the talent roster headshots that creative deliverables will be built from.

Concretely:

- **Casting is deliberately narrow.** Five fixed view types, no custom poses, no custom framings, no "sixth view" affordance. The cast node produces the reference package, and that's it.
- **Creative freedom lives downstream.** A user who wants Maya in a running three-quarter pose doesn't cast her in that pose — they cast her canonically, then drop an image-generation node, connect Maya's headshot (or any view) to the image-gen node's reference input via a lineage edge, and prompt for the pose. The image-gen node produces the output; the cast node provided the identity.
- **Wardrobe VTO follows the same shape.** A VTO node takes a cast reference (via edge) plus garment references (via edges) and produces a new output node. The cast stays clean; the VTO output carries the creative result.
- **The connection dots on every node matter.** They are the interface between cast references and downstream consumers. Every node that can accept an image reference has a blue image pin; every node that can accept a prompt has a purple prompt pin. Edges between cast views and image-gen/VTO/other consumers are the lineage of the board.

This framing explains why the casting UI is shaped the way it is: fixed views, locked identity, minimal per-node configuration, no hidden complexity. It also explains why passes 2 and 3 (wardrobe, generic image generation) are where the real creative surface expands — because casting is the calm layer underneath that everything else references.

If anything later in this doc seems overly restrictive for casting, the answer is almost always "because casting is a reference-asset workflow, and that thing belongs in a downstream node type, not here."

---

## 2. Foundational decisions (all locked)

### Decision 1 — Node typing: `kind` + `metadata.provenance`

Node types split into two concerns. The `kind` field on `board_items` governs rendering: `image | cast_config | wardrobe_config | note | frame`. Everything else — "is this a cast output, a VTO result, a reference upload, a text-to-image output?" — lives in `metadata.provenance` as structured JSON. This means generic image generation, text-to-image, and any future generation type all slot into `kind: "image"` without schema migrations; the provenance tells renderers and agents what the image actually is.

The existing enum on `board_items.type` (`model | garment | vto_result | reference | iteration | note | frame`) remains for one migration cycle but is *only* a compatibility fallback. New code writes to `kind` and reads provenance. Migration maps legacy rows to `kind: "image"` with appropriate provenance stamped into metadata.

**Provenance shapes we commit to in pass 1:**

```ts
type Provenance =
  | { type: "cast_root"; modelId: number; viewAngle: "frontClose"; attributes: CastAttributes }
  | { type: "cast_view"; modelId: number; rootItemId: number; viewAngle: CanonicalViewAngle; attributes: CastAttributes }
  | { type: "vto_output"; sourceModelItemId: number; garmentItemIds: number[] }
  | { type: "text2img"; prompt: string; engine: string }
  | { type: "upload"; originalFilename?: string }
  | { type: "reference"; sourceItemId?: number };

type CanonicalViewAngle = "frontClose" | "frontFull" | "sideClose" | "sideFull" | "backFull";
```

`cast_root` represents the initial cast node — always rendered as the headshot (`frontClose`), owns the identity configuration (the five blender chips plus the master prompt), and is the only node that can accept identity-level edits. `cast_view` represents additional view nodes that share an identity with their root (`rootItemId` links back) but carry their own per-view image, version history, and optional per-view pose prompt. See Decision 3 for the interaction model.

`CastAttributes` is structured and queryable (see Decision 5): `{ gender, ageRange, ethnicityBlend, build, vibe, brand, skin, hairColor, hairStyle, ... }`. All 27 casting fields appear here when set, with defaults filled by the LLM parser or by explicit editor choices. Identity-level attributes (brand, vibe, ethnicity, skin, hair, etc.) live on the root and are inherited by view nodes; view-specific attributes (currently none in pass 1, but reserved for future use like per-view pose prompts) live on the view node itself.

**Node metadata also carries an optional status field** that powers the generalized `NodeStatusBadge` system (see Decision 3 and the design system's `NodeStatusBadge` spec):

```ts
type NodeStatus =
  | { type: "stale"; message: string; context?: { causedByItemId?: number; oldValues?: Record<string, unknown>; newValues?: Record<string, unknown> } }
  | { type: "quality_flagged"; message: string; context?: { flaggedBy?: string; issues?: string[] } }
  | { type: "needs_review"; message: string; context?: { requestedBy?: string } }
  | { type: "error"; message: string; context?: { errorCode?: string } }
  | { type: "moderation"; message: string; context?: { caseId?: number } };
```

Only `stale` is implemented in pass 1. The other variants are reserved in the type union for future use (quality checks, agent review handoffs, error states, moderation flags) — the `NodeStatusBadge` component handles dispatch based on `status.type` and will fall back to a generic rendering for unimplemented variants. See the design system doc for component spec.

### Decision 2 — Edges as first-class data

Fashion workflows are DAGs, not trees. One VTO result has one model parent plus N garment parents. Single-parent `parentItemId` cannot represent this cleanly. We add a `board_edges` table:

```sql
CREATE TABLE board_edges (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  boardId      INT NOT NULL,
  sourceItemId INT NOT NULL,
  targetItemId INT NOT NULL,
  relation     ENUM('iterated_from','vto_input_model','vto_input_garment','reference_for','variant_of','generated_from_cast') NOT NULL,
  metadata     JSON,
  createdAt    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_board_edges_source (sourceItemId),
  INDEX idx_board_edges_target (targetItemId),
  INDEX idx_board_edges_board  (boardId)
);
```

`parentItemId` on `board_items` is retained for now but no longer the primary lineage mechanism. New code writes edges. The refinement studio's History tab and the future agent both read lineage from this table.

Edge rendering on the canvas: hairline, 50% opacity, visible only when either endpoint node is selected. Not shown by default. React Flow edges bind to rows in this table via the `boardId` scope.

### Decision 3 — Tool invocation: inline-first, root + view node model, full-screen editor as escape hatch

#### 3a. Creating a cast happens inline on the canvas

Drop a cast node from the floating tool pill at the bottom-center. The node lands with a placeholder image area and an inline prompt field. **The freshly-dropped cast node is automatically selected**, which reveals its chrome: the five blender chips (Brand, Vibe, Ethnicity, Skin, Hair) appear below the card in their empty/ghosted state, and the floating action toolbar above the card is *not* rendered (because there is no output yet to rerun/duplicate/download). The control strip below the card is also not rendered on empty nodes — it's for completed casts.

The user can now do any of the following, in any order, before hitting Run:
- Type a prompt in the inline field. The LLM parser (Gemini via existing `server/_core/llm.ts`) will extract structured attributes from the prompt into `CastAttributes` on submit.
- Click any of the five blender chips to open the real tactile component (`TriBlendSelector`, `EthnicityBlender`, `SkinToneGrid`, `HairColorWheel`, brand selector) in a popover anchored to the chip, set a value, Apply. The chip flips from ghosted to filled state.
- Do both — explicit chip values are hard constraints; LLM-extracted values from the prompt are soft defaults that explicit chips override.

**Run enables as soon as either the prompt has text OR at least one chip is filled.** An empty-empty node cannot Run. This is visually communicated by the Run button being in a ghosted state when there's nothing to run, and darkening to the primary pill when any input is provided.

On Run, the node generates in place — progress bar in the image area, "Running" label on the button. When the generation completes, the node transitions to its completed state: the image fills in, the prompt field shows the submitted prompt in tertiary gray (read-only display), the Run button becomes Edit, the control strip appears below the card, and the floating action toolbar appears above the card. The chips stay visible and show their filled values (whatever the LLM extracted plus whatever the user set explicitly).

This is the first (and often only) generation of the cast. What gets created here is a `cast_root` node — the identity anchor.

#### 3b. Generating additional views spawns separate view nodes

Once a root cast exists, the user can request additional view angles via the `+ Views` action in the control strip. This opens a popover anchored to the control strip with checkboxes for the five canonical view types (headshot is always pre-checked and disabled because it's the root). The user ticks the views they want, sees a running cost total in the popover footer, and hits Generate.

**Each requested view spawns as its own separate node on the canvas**, not as internal state of the root. The generated view nodes:

- Are of provenance type `cast_view`
- Reference the root via `rootItemId` in their provenance
- Are connected to the root via a `board_edges` row with relation `generated_from_cast`
- Inherit the full identity from the root (same `modelId`, same master prompt, same agency ID once minted)
- Get auto-placed in a horizontal row to the right of the root by default, draggable anywhere afterward
- Each show their own individual version history, their own inline prompt for optional per-view pose direction ("three-quarter pose, shoulder forward"), and their own floating toolbar when selected
- Do NOT show blender chips (identity editing happens at the root)
- Have type labels like `Cast · Maya R. · Full front` — identity name plus view angle

The root cast node's control strip reads `+ Views · v1 · ···` and has no view switcher dropdown (there's no dropdown needed — views are separate nodes, visible on the canvas). View nodes have a simpler control strip: `v1 · ···`.

The five canonical view types are **fixed and strict**. There is no custom pose / custom framing option in the views popover. Creative freedom for non-canonical angles, poses, and scenes lives in downstream image-generation nodes that consume cast references as inputs — see section 1.5 for the full framing.

#### 3c. Identity changes on the root invalidate view nodes — the stale flow

When the user changes an identity-level attribute on the root cast (any of the five blender chips, or any identity-level attribute via the refinement studio's Attributes tab), the root's own image becomes outdated immediately. But the existing view nodes connected to that root also become stale — they depict an old version of Maya.

The flow is:

1. User changes vibe on the root from 55/25/20 to 30/40/30 and hits Apply in the popover.
2. Before firing the generation, the client detects that 3 view nodes exist connected to this root. A confirmation dialog surfaces: **"This will regenerate 3 existing views · 3,600 credits. Update views now / Update later / Cancel."**
3. **Cancel** — no change is committed. Popover reopens so the user can tweak or discard.
4. **Update now** — the root's identity is updated, the root regenerates, and all 3 view nodes are marked as generating and regenerate in parallel with the new identity. Total cost (root regen + 3 view regens) is deducted atomically.
5. **Update later** — the root's identity is updated, the root regenerates, but the 3 view nodes stay as-is with their old images. Each view node gains a **stale status** (`NodeStatus` of type `"stale"`), which causes a `NodeStatusBadge` to appear in the top-right corner of the view node's image area. The view node's image is also rendered at 0.7 opacity as a secondary cue.

A stale view node's badge is hover-interactive: on hover, a floating card appears next to the node with the status message (`"Maya's identity was updated. This view still reflects the previous vibe (55/25/20 → 30/40/30)."`) and two actions — **Refresh · 1,200 credits** (regenerates just this view) or **Keep old** (dismisses the card, the view stays stale and the badge remains until the user either refreshes or deletes the node). There is also a bulk `Refresh all stale views` action available from the root cast node's `···` more menu, which fires per-view regeneration for all connected stale views in one batch with a single cost confirmation.

The stale badge is a specific variant of the generalized `NodeStatusBadge` system. Future variants (`quality_flagged`, `needs_review`, `error`, `moderation`) will reuse the same corner-badge + hover-card + action-button shape. See the design system doc for the component spec and section 1.5 for how this enables future agent review workflows.

#### 3d. Editing an existing cast happens in the refinement studio

Click Edit on a selected cast node (root or view). The canvas dissolves and the refinement studio fills the viewport — same browser window, same top-bar component in a different state, no dimmed scrim, no modal card. A `← Boards` action in the top bar is the only way out. The studio has four tabs (Refine, Surgical, Attributes, History) and contains every dense operation Drape supports on an existing cast.

Editing a **root cast node** in the studio gives access to all identity-level attributes via the Attributes tab (the five expressive blender widgets plus ~22 simple chips for the other structured attributes). Changes to identity-level attributes in the studio follow the same confirmation flow as on-canvas blender chip changes (section 3c).

Editing a **view cast node** in the studio gives access to per-view refinement only — the Refine and Surgical tabs work normally, the History tab shows per-view versions, and the Attributes tab is in a read-only mode showing the inherited identity from the root (with a "Edit identity on root cast" link that navigates to the root's editor). Users cannot change identity-level attributes from within a view node's editor; they must go to the root.

#### 3e. Interaction grammar summary

Every node type on the canvas obeys the same four-verb grammar, but with type-aware scoping:

| Verb       | On root cast                                              | On view cast                                         |
|------------|-----------------------------------------------------------|------------------------------------------------------|
| **Run**    | New version on the same root, may trigger stale flow if views exist | New version on the same view, root and siblings unaffected |
| **Variations** | N sibling *root* nodes spawn with `variant_of` edges, each a new identity interpretation | **Disabled** — views of a locked identity don't vary meaningfully |
| **New node** | Fresh cast node drops at cursor, no relation to existing | Same                                                 |
| **Edit**   | Navigates to refinement studio for the root              | Navigates to refinement studio for the view          |

**View nodes have a reduced floating toolbar: 4 icons** (Rerun, Download, Delete, Info). Variations and Duplicate are disabled (tooltip "Not available on view nodes"). Root cast nodes have the full 6-icon toolbar (Rerun, Variations, Duplicate, Download, Delete, Info).

This model means **simple casts are one prompt and one click**, **tactile adjustments are two clicks on the canvas**, **additional angles are one popover on the canvas**, and **precision work is one Edit click into the studio**. Nothing is gated by how the node was created. Every cast has access to every tool its type supports.

### Decision 4 — Per-node state architecture

The current `useCastingFormStore`, `useCastingGenerationStore`, and `useCastingUIStore` are deleted. They were built for a single active cast in a linear studio; they cannot represent multiple casts on the same canvas.

**New model:**

- **Persistent config** (all 27 casting fields, prompts, blender values, style notes) lives in `board_items.metadata`. Written via the existing `boards.updateItem` tRPC mutation, debounced during active editing.
- **Transient editor state** (which tab is open, which chip is expanded, scroll position, unsaved draft text) lives in local React state inside the editor overlay or popover. Discarded on close unless committed.
- **In-flight generation state** (job id, progress, status per node) lives in a single global Zustand store: `useGenerationJobs`. Keyed by `itemId`. This is the only global store in the new architecture, and it is orchestration-only — it never holds form values.

Duplicating a node is a copy of metadata. Undoing is a snapshot of metadata. The agent reading board state gets a cleanly serializable JSON object.

### Decision 5 — Agent-ready primitives

The canvas must be fully callable as a set of pure functions from day one. This is a shipping discipline, not a new feature. Five commitments:

1. **All mutations go through `server/boardOps.ts`**, a thin typed wrapper over existing tRPC procedures plus any client-side coordination. No React component mutates board state directly. Example operations: `createNode`, `updateNodeMetadata`, `runGeneration`, `runRefinement`, `runVariations`, `generateViews`, `revertToVersion`, `branchFromVersion`, `addEdge`, `deleteNode`. Full API in section 4.
2. **All cast output provenance is structured and filterable.** Never free-text. A future agent must be able to query "all male cast outputs on this board" via `boardState.getSnapshot()` and filter by `provenance.attributes.gender === "male"`. The LLM prompt parser emits structured JSON, not descriptions.
3. **Garment nodes are auto-captioned and tagged at digitize time.** When a garment is uploaded, a vision LLM call populates `shortName`, `description`, and `tags` automatically. User can edit. Agent filters by tags: `tags.includes("hoodie") && tags.includes("orange")`. This also improves the non-agent wardrobe UX because users get smart default labels.
4. **Mutations use a two-phase `plan / execute` API.** `planOperation()` computes what would happen (which nodes will be created, spatial placement, total credit cost, estimated time) and returns a plan object. `executeOperation()` runs it. This pattern serves the agent's "7,200 credits, proceed?" confirmation and also powers the Variations action and the views popover in the non-agent UI. Build once, use everywhere.
5. **`boardState.getSnapshot(boardId)` returns a JSON-serializable description** of the full board: all nodes with their kinds and structured provenance, all edges with their relations, current selection, current viewport. This is what agents, undo/redo, board export, and future collaborative features all consume. One function, returns one object.

The agent itself is not built in this vertical slice. These five commitments keep the door open at ~one day of extra discipline during the build.

---

## 3. Interaction grammar

Every node type on the canvas obeys the same four-verb grammar, scoped by node type where scoping makes semantic sense (see Decision 3e for the cast-specific table):

| Verb       | Spatial outcome                                           | Typical trigger              |
|------------|-----------------------------------------------------------|------------------------------|
| **Run**    | New version on the same node. Old version goes to history.| Click Run inside the card    |
| **Variations** | N sibling nodes spawn adjacent to source, lineage edges connect them to the source, shared prompt config. Disabled on view cast nodes. | Variations button on selection toolbar |
| **New node** | A fresh concept node drops at cursor position.          | Floating tool pill `+` menu  |
| **Edit**   | Navigates to the refinement studio (full-screen takeover).| Edit button inside card, or selection toolbar |

These four verbs apply to every node type. Users learn the grammar once. Individual node types may disable specific verbs when they're meaningless for that type (e.g. Variations and Duplicate on view cast nodes) — disabled actions remain visible in the toolbar as greyed-out icons with tooltips explaining why, so the grammar remains predictable.

**Supporting actions on selection** (from the floating action toolbar above the card): `Rerun` (≡ Run), `Variations`, `Duplicate`, `Download`, `Delete`, `Info`. Six icons max for nodes that support all actions (root cast, wardrobe, image-gen). Four icons effectively active for view cast nodes (Variations and Duplicate greyed). No text labels. Tooltips on hover.

---

## 4. `boardOps` and `boardState` API shape

Lives in `server/lib/boardOps.ts` (service layer, typed). Client calls these via tRPC. Every mutation is available through this module. The module is the single source of truth for "what operations exist on a board."

### Read operations

```ts
interface BoardStateSnapshot {
  boardId: number;
  viewport: { x: number; y: number; zoom: number };
  selection: number[]; // item IDs
  nodes: Array<{
    id: number;
    kind: "image" | "cast_config" | "wardrobe_config" | "note" | "frame";
    position: { x: number; y: number };
    size: { width: number; height: number };
    zIndex: number;
    label: string | null;
    imageUrl: string | null;
    provenance: Provenance;
    metadata: Record<string, unknown>;
    currentVersion: number;
    versionCount: number;
  }>;
  edges: Array<{
    id: number;
    source: number;
    target: number;
    relation: "iterated_from" | "vto_input_model" | "vto_input_garment" | "reference_for" | "variant_of";
  }>;
}

boardState.getSnapshot(boardId: number): Promise<BoardStateSnapshot>;
```

### Mutation operations

Every mutation has a matching `plan` function that returns the expected outcome without executing, and an `execute` function that performs it. Agents call `plan` first, show the plan, wait for confirmation, then call `execute`. Non-agent UI can call `execute` directly for simple cases (e.g., typing a prompt and hitting Run) or use `plan` for confirmations (e.g., Variations, Generate views).

```ts
interface OperationPlan {
  operation: string;
  creates: Array<{ kind: string; provenance: Provenance; position: { x: number; y: number } }>;
  modifies: Array<{ itemId: number; changes: Partial<BoardItem> }>;
  deletes: number[];
  addEdges: Array<{ source: number; target: number; relation: string }>;
  estimatedCreditCost: number;
  estimatedDurationMs: number;
}

boardOps.createNode.plan(input): Promise<OperationPlan>;
boardOps.createNode.execute(input): Promise<{ itemId: number; plan: OperationPlan }>;

// Operations in pass 1:
boardOps.createNode          // drop a new node (for cast: creates a cast_root)
boardOps.updateNodeMetadata  // change config on an existing node
boardOps.runGeneration       // fire a generation (cast, VTO, img-gen), creates new version on same node
boardOps.runRefinement       // prompt-based iteration in the refinement studio
boardOps.runSurgicalEdit     // mask-based edit
boardOps.updateAttributes    // change structured attributes; for identity-level changes on cast_root, returns a plan that includes stale propagation to connected cast_view nodes, requiring explicit Update now / Update later confirmation
boardOps.runVariations       // spawn N sibling nodes sharing config. On cast_root: creates new root casts. On cast_view: disallowed (throws NOT_SUPPORTED).
boardOps.generateViews       // for a cast_root: spawn N new cast_view nodes for the requested canonical view types (fixed enum: frontClose, frontFull, sideClose, sideFull, backFull), place horizontally adjacent to the root, create `generated_from_cast` edges. Returns the list of created itemIds.
boardOps.refreshStaleViews   // for a cast_root: regenerate all connected view nodes that currently have a `stale` NodeStatus. Batch operation with single cost confirmation via .plan(). Clears the stale status on each view as its regen completes.
boardOps.markNodeStatus      // set or clear the optional `status` field on a node's metadata (pass 1 only writes `stale`; future variants reuse this same operation)
boardOps.revertToVersion     // set a node's current version to a prior one
boardOps.branchFromVersion   // create a new node rooted at a prior version of another node (for cast_view this creates a new cast_root snapshot from that version)
boardOps.deleteNode          // on cast_root with connected cast_views: requires confirmation and cascade-deletes the views, unless the user branches them out first
boardOps.addEdge
boardOps.removeEdge
boardOps.moveNodes           // batch position update (drag)
```

**The generateViews plan shape** is worth noting explicitly because it's the most common multi-node-creation operation in pass 1:

```ts
boardOps.generateViews.plan({
  rootItemId: number;
  views: Array<"frontClose" | "frontFull" | "sideClose" | "sideFull" | "backFull">;
}): Promise<OperationPlan>;
// plan.creates will contain one entry per requested view, each of kind "image" with
// provenance { type: "cast_view", modelId, rootItemId, viewAngle, attributes: <inherited> }
// plan.addEdges will contain one generated_from_cast edge per requested view
// plan.estimatedCreditCost = views.length * 1200 (pass 1 flat rate; wire to existing pricing later)
```

**The updateAttributes plan shape** for identity-level changes on a cast root includes stale propagation:

```ts
boardOps.updateAttributes.plan({
  itemId: number;  // a cast_root
  changes: Partial<CastAttributes>;
}): Promise<OperationPlan & { staleViews: number[] }>;
// If any identity-level attribute is in `changes` and connected cast_view nodes exist,
// the plan includes the list of affected view itemIds so the UI can present the
// Update now / Update later / Cancel dialog with exact counts and cost.
```

Every operation is logged with its plan + result for debugging and audit. Every operation writes to `board_item_versions` when it changes the visible output of a node.

---

## 5. State management and data flow

**Rule of thumb:** if a value needs to survive a page reload, it lives in the database (via `board_items.metadata` or a dedicated column). If a value is transient UI state, it lives in local React state. There is exactly one global Zustand store.

| State category          | Location                                   |
|-------------------------|--------------------------------------------|
| Node config (27 attributes, prompts, blends) | `board_items.metadata`    |
| Version history         | `board_item_versions` table                |
| Lineage/edges           | `board_edges` table                        |
| Viewport                | `boards` table (existing columns)          |
| Selection               | Local React state in `BoardPage`           |
| Editor tab, scroll, draft text | Local React state in editor overlay |
| In-flight generation jobs | `useGenerationJobs` Zustand store (only global store) |
| Credit balance          | TanStack Query cache (tRPC)                |

**Mutation flow:**

1. User interaction triggers a call into `boardOps.someOperation` via tRPC.
2. Optimistic update applied via TanStack Query `onMutate` hook.
3. Server mutation runs, writes DB rows, returns new state.
4. Query cache updates with server truth; optimistic rollback if error.
5. For generation operations: `useGenerationJobs` tracks in-flight status via server-sent updates or polling; the node card reads job status from this store and shows progress.

---

## 6. Schema changes (pass 1)

### New table

```sql
-- board_edges: DAG lineage for canvas items
CREATE TABLE board_edges (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  boardId      INT NOT NULL,
  sourceItemId INT NOT NULL,
  targetItemId INT NOT NULL,
  relation     ENUM('iterated_from','vto_input_model','vto_input_garment','reference_for','variant_of','generated_from_cast') NOT NULL,
  metadata     JSON,
  createdAt    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_board_edges_source (sourceItemId),
  INDEX idx_board_edges_target (targetItemId),
  INDEX idx_board_edges_board  (boardId)
);
```

Add corresponding Drizzle schema in `drizzle/schema.ts` following the existing patterns. Generate migration via `pnpm db:push`.

### Additive column on `board_items`

Add a new `kind` column alongside the existing `type` column. Both are populated during the migration window:

```sql
ALTER TABLE board_items
  ADD COLUMN kind ENUM('image','cast_config','wardrobe_config','note','frame') NULL,
  ADD INDEX idx_board_items_kind (kind);
```

Backfill existing rows: `UPDATE board_items SET kind = 'image' WHERE type IN ('model','garment','vto_result','reference','iteration'); UPDATE board_items SET kind = 'note' WHERE type = 'note'; UPDATE board_items SET kind = 'frame' WHERE type = 'frame';`

New rows always write both `type` (legacy) and `kind` (new). The old enum is dropped in a later phase, not pass 1.

### Wardrobe auto-captioning columns

No schema change — `wardrobe_garments.shortName`, `description`, and `tags` already exist. We just need to *always populate them* at digitize time via a new vision-LLM caption step in `server/wardrobe/`.

---

## 7. Vertical slice sequencing

### Pass 1 — Casting end to end on new primitives (2–3 weeks)

The only goal is to prove the primitives work by making casting fully canvas-native. Wardrobe, generic image gen, and agent work all wait.

**Milestones (each milestone is dogfoodable):**

1. **M1 — Canvas shell, fresh node, prompt-to-result, empty-state chips.** User can drop a cast node from the floating tool pill. The freshly-dropped node is auto-selected and shows the five blender chips in ghost/empty state immediately, with the inline prompt field focused and Run disabled until there's input. User can type a prompt OR click a chip (or both) to enable Run. On Run, node generates in place as a `cast_root` and transitions to completed state. Uses `boardOps.createNode` and `boardOps.runGeneration`. Old `BoardCastingPanel` is deleted. `useCastingFormStore` / `useCastingUIStore` / `useCastingGenerationStore` are deleted. New `useGenerationJobs` store handles in-flight state. LLM parser extracts structured attributes from the prompt into `CastAttributes`. At this milestone, control strip and floating toolbar are NOT yet rendered on completed nodes — M2 adds them.
2. **M2 — Completed-node chrome: control strip, blender chip popovers with Apply & run.** Selected completed cast root shows `+ Views · v1 · ···` control strip (no view switcher dropdown, since views are separate nodes in this model) and filled blender chips. Clicking a blender chip opens the real component (`TriBlendSelector`, `EthnicityBlender`, `SkinToneGrid`, `HairColorWheel`, brand selector) in a shadcn Popover with canvas-language styling overrides. Apply & run commits new metadata and fires a new generation on the same node.
3. **M3 — Floating action toolbar on selection, type-scoped.** Above-the-card Luma-style toolbar with 6 icons for cast_root (Rerun, Variations, Duplicate, Download, Delete, Info). Variations calls `boardOps.runVariations.plan` then `execute`, spawns N sibling cast_root nodes with `variant_of` edges. The view_cast case is prepared in the component but not yet exercised (no view nodes exist until M4).
4. **M4 — Generate views popover spawning separate view nodes with lineage edges.** `+ Views` action in the root's control strip opens the popover with 5 canonical view checkboxes (headshot pre-checked and disabled), cost total, Generate. Calls `boardOps.generateViews.plan` then `.execute`, which spawns N new `cast_view` nodes placed horizontally to the right of the root, connected via `generated_from_cast` edges. Each view node gets its own inline prompt (for optional pose direction), no blender chips, a reduced 4-icon floating toolbar (Rerun, Download, Delete, Info — Variations and Duplicate disabled with tooltips). Selecting any view node highlights the lineage edge back to the root. Selecting the root highlights all outgoing edges to its views.
5. **M4.5 — Stale view flow and NodeStatusBadge component.** Build the generalized `NodeStatusBadge` component with only the `stale` variant wired up (others stubbed in the type union for future use). When the user changes an identity-level attribute on the root (via blender chip or via `boardOps.updateAttributes.plan` detecting identity-level fields in the changes), surface a confirmation dialog with three options: Update now / Update later / Cancel. Update now calls `boardOps.refreshStaleViews.execute` with all connected views in one batch. Update later marks each connected view with `NodeStatus { type: "stale", ... }` via `boardOps.markNodeStatus` and renders the corner badge on each. Hovering the badge surfaces the floating status card with Refresh and Keep old actions. The root's `···` more menu gains a `Refresh all stale views` action for bulk manual refresh.
6. **M5 — Refinement studio shell with Refine tab.** Click Edit → full-screen takeover, `← Boards` back. Three columns. Refine tab is the prompt-iteration surface. Calls `boardOps.runRefinement`. Studio is strictly self-contained: accepts `itemId` + `onClose` as props, does not import routing, so it can be hosted either as a full-screen route (pass 1 default) or inside a modal wrapper (fallback option if full-screen feels wrong during dogfooding).
7. **M6 — Refinement studio: Surgical tab.** Brush-masking pipeline from existing `useCastingCanvas`, wired into the new tab. Calls `boardOps.runSurgicalEdit`.
8. **M7 — Refinement studio: Attributes tab.** Layered layout: expressive widgets (vibe blender, ethnicity blender, brand, skin, hair) as full components at top; chip grid for the remaining ~22 simple attributes below. Calls `boardOps.updateAttributes`. For cast_root, identity-level changes trigger the same stale-view confirmation flow from M4.5. For cast_view, the tab is in read-only mode showing inherited attributes, with a link to open the root's editor.
9. **M8 — Refinement studio: History tab.** Timeline of versions with tool/prompt/timestamp. Revert and branch actions. Calls `boardOps.revertToVersion` / `boardOps.branchFromVersion`. Branching from a cast_view history creates a new cast_root snapshot on the canvas.

At M8, casting is fully canvas-native and dogfoodable by the team. Ship internal, use daily, file friction notes for polish passes.

### Pass 2 — Wardrobe on the same primitives (1–2 weeks)

Port wardrobe to the canvas using the exact patterns from pass 1. A wardrobe node is a `kind: "wardrobe_config"` node with its own blender-equivalent chips (though probably fewer — slot type, style notes). VTO is `runGeneration` on a wardrobe node with edges pointing to a source cast. Garment upload triggers auto-captioning. The refinement studio for wardrobe nodes gets its own tab set (TBD in pass 2 design).

### Pass 3 — Canvas-native capabilities (1 week)

Generic image generation node, note node, frame node, multi-select operations, proper `Cmd+K` command palette. Each of these is additive and small once the primitives exist.

### Pass 4+ — Polish

Keyboard shortcuts, empty states, micro-interactions, cursor states, alignment guides, onboarding, animation tuning, error states, loading skeletons. Emerges from dogfooding.

### Later — Canvas agent

Chat panel (or agent-node type) that reads `boardState.getSnapshot()` and calls `boardOps` operations via tool-use. Not built in pass 1, 2, or 3. Enabled by the agent-ready primitives committed to in Decision 5.

---

## 8. Scope protection — what pass 1 does NOT include

- **No dark mode.** CSS variables are used throughout so dark mode is free to add later, but no dark palette is authored in pass 1.
- **No feature flags.** The canvas is the primary app. `/studio` remains as a parallel fallback route, untouched.
- **No collaborative features.** Single-user canvases only.
- **No agent UI.** Decision 5 is about the primitives supporting agents later, not building one.
- **No keyboard shortcut system beyond the obvious:** `Esc` closes popovers, `Delete` deletes selected node, `Cmd+Z` is TBD (probably pass 4), `Cmd+K` placeholder in pass 3.
- **No `/studio` removal.** It stays alive until the canvas has proven itself. Removal is a separate product call, later.
- **No undo/redo in pass 1.** History exists via `board_item_versions` (per-node) but no global undo stack. Pass 4.
- **No mobile or tablet layouts.** Desktop only.
- **No real-time progress streaming from the server.** Polling is fine for pass 1.

---

## 9. File inventory — what gets touched

### Delete

- `client/src/features/boards/panels/BoardCastingPanel.tsx` — its job moves into inline canvas creation and the refinement studio.
- `client/src/features/casting/stores/useCastingFormStore.ts`
- `client/src/features/casting/stores/useCastingGenerationStore.ts`
- `client/src/features/casting/stores/useCastingUIStore.ts`

### Refactor (content preserved, location/wrapper changes)

- `client/src/features/casting/ControlPanel.tsx` → becomes the content renderer for the Attributes tab of the refinement studio. Collapsible sections become the bottom-region chip grid. Expressive widgets (blenders, wheels, grids) become the top-region first-class widgets.
- `client/src/features/casting/MasterPromptPanel.tsx` → becomes the right-rail "Master prompt" readout in the refinement studio and on the blender popover details view.
- `client/src/features/boards/overlays/ModelEditorOverlay.tsx` → becomes `client/src/features/boards/studio/RefinementStudio.tsx`. The full-screen takeover container; hosts the three-column layout and tab routing.
- `client/src/features/boards/BoardPage.tsx` — viewport, selection, floating tool pill, and top bar handling. Removes all casting-specific logic (moved to node-local).
- `client/src/features/boards/BoardCanvas.tsx` — node rendering now uses new primitive components from `DESIGN_SYSTEM.md`.

### New

- `server/lib/boardOps.ts` — the service layer. All mutation operations with `.plan()` and `.execute()` pairs.
- `server/lib/boardState.ts` — `getSnapshot()` and related read helpers.
- `server/db/boardEdges.ts` — query helpers for the new table.
- `drizzle/schema.ts` — add `boardEdges` table, add `kind` column to `boardItems`.
- `drizzle/NNNN_board_edges.sql` — migration.
- `client/src/features/boards/canvas/` — new folder for canvas primitive components (see `DESIGN_SYSTEM.md` for full inventory).
- `client/src/features/boards/studio/` — new folder for the refinement studio shell and tabs.
- `client/src/features/boards/stores/useGenerationJobs.ts` — the one allowed global store.
- `server/routes/boardOps.ts` — tRPC router exposing `boardOps` to the client.

### Reuse without modification

- All tactile components in `client/src/features/casting/components/`: `TriBlendSelector`, `HairColorWheel`, `SkinToneGrid`, `EthnicityBlender`, `WarmPrimitives`, `WarmSelectControl`. They are lifted into popovers and into the Attributes tab unchanged.
- All casting hooks: `useCastingGeneration`, `useCastingViewGeneration`, `useCastingExport`, `useCastingCanvas`. They are called from new contexts (inline node, popover, refinement studio) but their internals don't change.
- All shadcn/ui components. `Popover`, `Button`, `Input`, `Tooltip`, `ScrollArea`, `Tabs` are the primary primitives used by the new canvas chrome.

---

## 10. Success criteria for pass 1

At the end of pass 1, all of the following must be demonstrably true on a real board:

1. A user can drop a cast node, type a natural-language prompt, hit Run, and receive a headshot in the node within ~20 seconds. Prompt is parsed by Gemini into structured `CastAttributes`. The resulting node is provenance type `cast_root`.
2. A freshly-dropped cast node is auto-selected and immediately shows five ghosted blender chips. Run is disabled until either the prompt has text or at least one chip is filled. Typing a prompt OR clicking any chip enables Run.
3. Selecting a completed cast root reveals: 1px dark border, control strip with `+ Views · vN · ···` (no view switcher dropdown), blender chip strip with five filled chips, and a floating action toolbar above the card with six icons (Rerun, Variations, Duplicate, Download, Delete, Info).
4. Clicking a blender chip opens the real tactile component in a shadcn Popover anchored to the chip. Apply & run commits new metadata and fires a new generation. Identity-level changes trigger the Update now / Update later / Cancel dialog when connected view nodes exist.
5. Clicking `+ Views` opens the view generation popover with 5 canonical view checkboxes (headshot pre-checked and disabled), cost total, Generate. Generating spawns N new `cast_view` nodes to the right of the root, connected by `generated_from_cast` edges. Each view node has its own control strip (`vN · ···`), its own inline prompt field, no blender chips, and a 4-icon floating toolbar (Variations and Duplicate disabled with tooltips).
6. Clicking the Variations icon on a cast root spawns N sibling `cast_root` nodes with `variant_of` edges. Variations is disabled on view nodes.
7. Changing an identity attribute on a root with connected view nodes surfaces the three-option confirmation dialog. Update later marks each view with `NodeStatus { type: "stale" }` and renders the corner `NodeStatusBadge`. Hovering the badge surfaces the floating status card with Refresh and Keep old actions.
8. Clicking Edit navigates to the refinement studio (full-screen, not modal). Four tabs (Refine, Surgical, Attributes, History) all work on a root cast; on a view cast, the Attributes tab is read-only with a link to edit the root. `← Boards` returns to the canvas with node state preserved.
9. All mutations go through `boardOps`. No React component writes to `board_items` directly. `boardState.getSnapshot(boardId)` returns a valid JSON object with all nodes (typed provenance), all edges (typed relations), selection, and viewport.
10. `useCastingFormStore`, `useCastingGenerationStore`, `useCastingUIStore` are deleted from the repo. Only `useGenerationJobs` remains as a global store.
11. The classic `/studio` still works unchanged.
12. The design system in `DESIGN_SYSTEM.md` is followed component by component. No custom shadows, gradients, colored backgrounds, or chrome outside the specified language.
13. `RefinementStudio` is self-contained (props-only, no routing imports), so switching it from full-screen takeover to modal presentation requires only changing how `BoardPage` hosts it, not editing the studio itself.

---

## 11. Open questions for later phases (not pass 1)

- Wardrobe's equivalent of the blender chip strip — what are the expressive controls for a garment/VTO node? Decide at start of pass 2.
- Whether the agent lives as a chat panel or as an "agent node" type. Decide at start of agent work.
- Whether to eventually delete `/studio` entirely, or keep it as a simple-mode entry point forever. Product call, post pass 3.
- Dark mode palette authorship. Cosmetic, any time after pass 3.
- Undo/redo scope — per-board global undo vs. per-node history-only. Pass 4.
- Collaborative cursors and real-time sync. Much later, probably a separate project.

---

**End of foundations doc. Read `DESIGN_SYSTEM.md` next for the visual and component specifications that implement these decisions.**
