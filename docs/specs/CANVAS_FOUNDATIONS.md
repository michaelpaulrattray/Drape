# Canvas Foundations — Drape Boards (revised)

**Audience:** engineering (including coding agents). This is the authoritative spec for the canvas boards rebuild. Read this document end to end before writing any code. Read `DESIGN_SYSTEM.md` alongside it for visual and component specifications, `CANVAS_AUDIT_ADDENDUM_V2.md` for verified code facts, and `DECISION_LOG.md` for the record of every divergence from the original drafts and its ratification status.

**Revision note:** this is the post-migration revision of the original foundations doc. The founder-locked content — the reference-asset framing (§1.5), inline-first invocation, the root/view node model, edges-as-lineage, the four-verb grammar — is unchanged in substance. What changed: verified code facts replace stale ones, and the open design areas (identity semantics on rerun, provenance truthfulness, library integration, cost visibility, keyboard/undo) are now designed rather than deferred. Milestone-level build sequencing has moved to `PASS_1_BUILD_PLAN.md` (written after decision-log ratification); §7 here describes pass-level scope only.

---

## 1. Context and goals

Drape is shifting from a linear classic studio (kept reachable at `/studio?tool=…` during the transition — see §8) to a Luma-style infinite canvas workspace (`/app/board/:id`) where casting, wardrobe, general image generation, references, and notes all live together spatially. The canvas is the primary surface; tools are invoked on nodes, not in side panels. Dense configuration lives inside a focused refinement studio that you enter and leave explicitly via a back action — not as a modal, not behind a scrim.

The canvas slots into the existing lobby navigation model: boards are created from `/app` via `boards.create` (which requires `startedWith: "casting" | "wardrobe" | "blank"`; lobby CTAs pass `"blank"`), and appear in the cross-tool `lobby.recentWork` feed with their `thumbnailUrl`. Canvas work must keep that thumbnail fresh (update it when a board's first node completes, and on a debounce thereafter) or the lobby goes stale.

The first vertical slice is casting, built end to end on the new primitives before wardrobe is touched.

**The four experiential goals that shape every decision below:**

1. The common path is fast. Typing a prompt and hitting Run generates a model in under twenty seconds without leaving the canvas.
2. Tactile controls are tactile. The blenders, color wheels, and grids that distinguish Drape are reachable in two clicks from the canvas, not buried in modals.
3. The deep path is deep. The refinement studio is a real workspace for surgical edits, version branching, and attribute-level precision — not a dialog.
4. The canvas is programmatically introspectable. Every operation a user can perform must also be callable as a pure function, so a future canvas agent can orchestrate multi-step workflows without UI simulation.

---

## 1.5 Casting's role in Drape — read this before everything else

*(Locked. Unchanged from the original.)*

Casting in Drape is a **reference-asset workflow, not a final-output workflow.** This framing governs every UI and data decision about casting in the rest of this doc, and understanding it up front prevents hours of confusion downstream.

A cast produces an identity-locked model with a standard package of five canonical views (`frontClose`, `frontFull`, `sideClose`, `sideFull`, `backFull`). That package is a **reference asset** — it exists so downstream generation nodes can consume it as an identity input and produce novel creative output (new poses, new scenes, new compositions, wardrobe try-ons) with guaranteed identity consistency. The five canonical views are *not* the creative deliverable; they are the talent roster headshots that creative deliverables will be built from.

Concretely:

- **Casting is deliberately narrow.** Five fixed view types, no custom poses, no custom framings, no "sixth view" affordance. The cast node produces the reference package, and that's it.
- **Creative freedom lives downstream.** A user who wants Maya in a running three-quarter pose doesn't cast her in that pose — they cast her canonically, then drop an image-generation node, connect Maya's headshot (or any view) to the image-gen node's reference input via a lineage edge, and prompt for the pose.
- **Wardrobe VTO follows the same shape.** A VTO node takes a cast reference (via edge) plus garment references (via edges) and produces a new output node. The cast stays clean; the VTO output carries the creative result.
- **The connection dots on every node matter.** They are the interface between cast references and downstream consumers. Every node that can accept an image reference has a blue image pin; every node that can accept a prompt has a purple prompt pin. Edges between cast views and consumers are the lineage of the board.

If anything later in this doc seems overly restrictive for casting, the answer is almost always "because casting is a reference-asset workflow, and that thing belongs in a downstream node type, not here."

---

## 2. Foundational decisions

### Decision 1 — Node typing: `kind` + `metadata.provenance` *(locked, provenance shapes extended)*

Node types split into two concerns. A new `kind` column on `board_items` governs rendering: `image | cast_config | wardrobe_config | note | frame | video` (`video` is reserved for pass 4 — see §2.6; nothing renders it in pass 1, but the enum ships extensible). Everything else — "is this a cast output, a VTO result, a library placement, a text-to-image output?" — lives in `metadata.provenance` as structured JSON.

The existing enum on `board_items.type` (`model | garment | vto_result | reference | iteration | note | frame`) remains for one migration cycle as a compatibility fallback. New code writes both, reads `kind` + provenance.

**Provenance shapes committed for pass 1** (pass 2+ shapes shown for extensibility proof, not built now):

```ts
type CanonicalViewAngle = "frontClose" | "frontFull" | "sideClose" | "sideFull" | "backFull";

/** A snapshot of an input actually consumed by a generation, captured at generation time. */
type InputSnapshot = {
  itemId: number;          // the source node at the time of generation
  versionId?: number;      // board_item_versions.id if the source was versioned
  imageUrl: string;        // the EXACT image URL consumed — survives later edits to the source
};

type Provenance =
  // pass 1
  | { type: "cast_root"; modelId: number; viewAngle: "frontClose"; attributes: CastAttributes;
      engine: string; forkedFromItemId?: number }
  | { type: "cast_view"; modelId: number; rootItemId: number; viewAngle: CanonicalViewAngle;
      attributes: CastAttributes; engine: string; inputs: InputSnapshot[] }
  | { type: "library_cast"; modelId: number; viewAngle: CanonicalViewAngle; attributes?: CastAttributes }
  | { type: "upload"; originalFilename?: string }
  | { type: "reference"; sourceItemId?: number }
  // pass 2+
  | { type: "vto_output"; inputs: InputSnapshot[]; engine: string }
  | { type: "library_garment"; garmentId: number }
  | { type: "text2img"; prompt: string; engine: string; inputs: InputSnapshot[] }
  // pass 4 (shape reserved, see PASS_4_VIDEO_NOTES.md)
  | { type: "img2video"; engine: string; inputs: InputSnapshot[]; prompt: string; durationSec: number };
```

Two changes from the original draft, both ratified via the decision log:

1. **Provenance snapshots inputs at generation time** (`InputSnapshot[]`). Storing only `rootItemId`-style pointers made historical outputs lie after identity edits: a view generated from Maya-v1 would appear to descend from Maya-v3. With snapshots, every generated node truthfully records the exact image URLs it consumed. R2 URLs are stable and never expire (public-bucket serving), so snapshots normally stay resolvable. Edges remain the *navigational* lineage; snapshots are the *forensic* lineage. Agents, the History tab, and future reproducibility features read snapshots.
   **Graceful degradation (founder amendment to D-12):** a snapshot URL may still stop resolving (object deleted from R2, storage migration). Every surface that renders a snapshot or version thumbnail must handle a non-resolving URL with the explicit "Source unavailable" state (`DESIGN_SYSTEM.md` §5.16) — never a broken image. Operations that would *consume* a missing input (e.g. regenerating from a snapshot) fail with a clear, refunded error naming the unavailable source, not a generic failure.
2. **`engine` is recorded on every generated provenance.** Pass 1 writes a single value (the Gemini image engine identifier); nothing may assume it. This is the multi-engine door (§2.6).

`CastAttributes` is the `ModelPreferences` shape from `client/src/features/casting/constants.ts` (~34 fields — see audit B1) plus the six parser-override fields added as a pass-1 prerequisite. Identity-level attributes live on the root and are inherited by view nodes.

**Node metadata also carries an optional `status` field** powering the generalized `NodeStatusBadge`:

```ts
type NodeStatus =
  | { type: "stale"; message: string; context?: { causedByItemId?: number; oldValues?: Record<string, unknown>; newValues?: Record<string, unknown> } }
  | { type: "quality_flagged"; message: string; context?: { flaggedBy?: string; issues?: string[] } }
  | { type: "needs_review"; message: string; context?: { requestedBy?: string } }
  | { type: "error"; message: string; context?: { errorCode?: string } }
  | { type: "moderation"; message: string; context?: { caseId?: number } };
```

Pass 1 implements `stale` and `error` (`error` was originally deferred, but generation failures are a pass-1 reality — a failed node must communicate itself; see the design system's empty/error-state chapter). The other variants stay reserved in the union.

**Node metadata additionally carries `pinned?: boolean`** — see Decision 3c. A pinned node is finished work: it is exempt from staleness pressure (no stale badge, excluded from cascade counts and bulk refresh).

### Decision 2 — Edges as first-class data *(locked, enum extended)*

Fashion workflows are DAGs, not trees. One VTO result has one model parent plus N garment parents. We add a `board_edges` table:

```sql
CREATE TABLE board_edges (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  boardId      INT NOT NULL,
  sourceItemId INT NOT NULL,
  targetItemId INT NOT NULL,
  relation     ENUM('iterated_from','vto_input_model','vto_input_garment','reference_for',
                    'variant_of','generated_from_cast','forked_from') NOT NULL,
  metadata     JSON,
  createdAt    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_board_edges_source (sourceItemId),
  INDEX idx_board_edges_target (targetItemId),
  INDEX idx_board_edges_board  (boardId)
);
```

`forked_from` is new — it records root-to-root forks from Decision 3f. `parentItemId` on `board_items` is retained but frozen (audit N7 confirmed nothing writes it today; nothing new starts). New code writes edges.

**Edge classes (D-50.5):** every relation belongs to exactly one class — **lineage** (history: `generated_from_cast`, `forked_from`, `variant_of`, `iterated_from`) or **input** (dataflow: `vto_input_model`, `vto_input_garment`, `reference_for`, and D-30's weighted references). Run-all, the D-30 composer, and the future board agent consume the *input* graph; lineage is what renders as ambient history. The classification lives as `EDGE_CLASS` in `shared/boardTypes.ts` — code selects edges by class, never by ad-hoc relation lists. Lineage edges are facts and are never disconnectable; edge-hover X-disconnect (D-36b) applies to input edges and arrives with pass 2.

Edge rendering: hairline, low opacity, upgraded when either endpoint is selected — exact treatment in the design system §8.

### Decision 3 — Tool invocation: inline-first, root + view node model, refinement studio as the deep path *(locked, with 3c/3f revised)*

#### 3a. Creating a cast happens inline on the canvas

Drop a cast node from the floating tool pill at the bottom-center. The node lands with a placeholder image area and an inline prompt field, auto-selected, revealing its chrome: the identity attribute block below the card, showing its rows with faint "Add" values (per the VC1.5 ruling — `DESIGN_SYSTEM.md` §5.9); no floating toolbar, no control strip (nothing exists yet to act on).

The user can, in any order, before hitting Run:
- Type a prompt. On Run, the LLM parser — a new `server/casting/promptParser.ts` service using the existing Gemini text path (`getAiClient` + `withTextQueue` + circuit breaker; the deleted `server/_core/llm.ts` is NOT coming back) — extracts structured attributes into `CastAttributes` per `PARSER_PROMPT_V2.md`. The parser's three-path dispatch (parsed / random / per-field random) executes **server-side inside `boardOps.runGeneration`**; the preference randomizer must therefore be callable server-side (port or move it to `shared/`).
- Tap any attribute row to open the real tactile component in a popover, set a value, Apply. Explicit attribute values are hard constraints; parser-extracted values are soft defaults that explicit values override (precedence chain per `PARSER_PROMPT_V2.md` §5).

**Run enables as soon as either the prompt has text OR at least one attribute is set.** The Run affordance displays its credit cost inline before execution (Decision 6). On Run, the node generates in place; on completion it transitions to the completed state (image, read-only prompt display, Edit button, control strip, floating toolbar, and the attribute block collapsed to its summary line). What gets created is a `cast_root` — the identity anchor.

**The empty node also carries the pick-existing path (D-28, founder-directed):** a quiet `or choose from your models` link in the placeholder image area opens the library picker (`DESIGN_SYSTEM.md` §7.3) directly at the node — create-new and pick-existing are both node-local, never split across menu surfaces alone. Picking fills *this* node in place (provenance → `library_cast`, image → the model's canonical headshot, initial version row) rather than spawning a sibling. The picker is constrained to canonical cast reference imagery — never outfitted, styled, or scene outputs, which would smuggle non-reference imagery into an identity slot (§1.5).

#### 3b. The package renders as a comp card; views pop out on demand *(rewritten with R5 per D-29 as amended by D-39, D-46, D-51)*

Views are **model-level data** (`model_assets` — the single package ledger, D-39), not board rows. View generation lives in the **casting environment**: an empty slot's ghost opens the tiered mint/upgrade dialog (D-46 — one view system; the pre-D-46 views popover never shipped). The six canonical slots are **fixed and strict** — headshot, three-quarter, side profile, full front, walk, full back (D-39/D-44). No custom pose or framing options — see §1.5.

**On the board, the root renders its package as a COMP CARD** (D-51 vocabulary — fashion's own word; "character sheet" is docs shorthand only): once ≥2 slots are filled, the root's image area becomes a headshot-dominant mosaic (headshot spans 2×2, views fill around it; empty slots render ghost add-view affordances — upgrade anytime, no re-cast, D-39c). Tiles are images only at rest; the one per-view surface is the tile-click popover (`Pop out` · `Refresh · ~cost` · `Pin`/`Unpin` · `Open in environment`). The headshot tile is never refreshable — it IS the minted identity (D-43); fork is the identity operation.

**Pop out** materializes a standard view card (200 wide, 3:4) as a board item *referencing* the model asset — provenance `cast_view` with `modelId`, `rootItemId`, `viewAngle`, and an `inputs` snapshot — connected by a `generated_from_cast` edge carrying `{ viewAngle }` metadata. The comp-card tile remains (package integrity) with a ⤢ corner glyph. **Collapse** dematerializes the placement and re-anchors any outgoing edges to the root, preserving `viewAngle` intent in edge metadata (D-30). Deleting a root cascades over its popped views (the one red confirm).

Root control strip carries the package verb (D-51): `Build comp card` on drafts (opens the mint gate), `Complete card` on minted models with empty slots (opens upgrade), nothing when the card is complete. Popped-view strip: `v1 · ···`.

#### 3c. Identity changes on the root — the stale flow *(revised: stale is informational; pinning)* — **scope reduced by D-43:** minted identities are immutable (fork is the only identity operation), so the identity-edit staleness trigger below no longer exists in pass 1. The stale *machinery* (badge, dim, pins, refresh, this dialog) stays built as pass-2 infrastructure, keyed off `model_assets.status`.

When the user changes an identity-level attribute on the root (attribute-block popover or studio Attributes tab), the root regenerates and connected views become stale — they depict the previous person. The flow:

1. User applies an identity change. The client calls `boardOps.updateAttributes.plan`, which detects identity-level fields and returns the affected (unpinned) view list and total cost.
2. A confirmation dialog surfaces: **"This will regenerate N existing views · {cost} credits. Update views now / Update later / Cancel."** Costs come from the plan, never hardcoded.
3. **Cancel** — nothing commits; the popover reopens with the draft.
4. **Update now** — identity commits, root regenerates, all affected views regenerate in parallel; total cost deducted atomically (existing `atomicCredits` pattern).
5. **Update later** — identity commits, root regenerates, each affected view gains `status: { type: "stale", ... }` with old/new values in context, rendered as the corner `NodeStatusBadge` plus the dimmed-image secondary cue.

**Stale is informational, not corrective pressure.** The badge's hover card offers **Refresh · {cost}** (regenerate this view against the new identity) and **Keep old** — and Keep old now has real semantics: it sets `pinned: true` on the view. A pinned view is finished work: badge cleared, excluded from future cascade counts, bulk refreshes, and stale marking. (Unpinning is available from the node's `···` menu.) A bulk `Refresh all stale views` action lives in the root's `···` menu.

Pinned nodes remain truthful because provenance snapshots (Decision 1) record exactly what they were generated from.

#### 3d. Editing an existing cast happens in the refinement studio

Click Edit on a selected cast node. The canvas dissolves and the refinement studio fills the viewport — same window, same top-bar component in a different state, no scrim, no modal card. `← Boards` in the top bar (or Esc) is the way out. Four tabs: Refine, Surgical, Attributes, History.

Editing a **root** exposes all identity-level attributes in the Attributes tab; identity changes follow 3c. Editing a **view** exposes Refine/Surgical/History normally; Attributes is read-only with an "Edit identity on root cast" link.

The current `ModelEditorOverlay.tsx` (a modal-with-scrim, 786 lines) is **rebuilt into** the studio shell, salvaging its zoom/pan viewer and mask-canvas internals — it is not a rename (audit N12).

#### 3e. Interaction grammar summary *(rewritten with R5 — post-D-35 every placed cast is `library_cast` provenance and root-grade for the grammar; "view" now means a popped-out placement)*

| Verb | On a placed cast (root) | On a popped-out view |
|---|---|---|
| **Run** | **Identity event** — fork-or-keep on minted (D-43; recast sealed), free rerun on drafts | N/A — per-tile **Refresh** lives in the comp-card tile popover (headshot excluded: it IS the identity) |
| **Variations** | N sibling roots spawn below with `variant_of` edges (D-48 geometry), each a new identity interpretation | **Disabled** — views of a locked identity don't vary meaningfully |
| **New node** | Fresh cast node at cursor, no relation | Same |
| **Edit** | Casting environment (takeover) on the model | Collapse into sheet / Download / Delete via strip + menu; identity work happens at the root |
| **Delete** | Cascade dialog when popped views exist (the one red confirm); soft otherwise | Plain soft delete, undoable |

Popped views carry the reduced toolbar (Variations/Rerun disabled with explanatory tooltips). Multi-select renders as a **group** (D-50): one container, one group toolbar (Duplicate · Download all · Focus · Delete · reserved Run all), right-click context menu in parity. Simple casts stay one prompt and one click; angles live in the environment one verb away; precision work one Edit click.

#### 3f. Rerun on a root is fork or recast — never a silent new version *(new; ratified via decision log D-11)*

Generic vN versioning is wrong for cast roots: a rerun root is a **different person**, and "v2 of Maya" makes every downstream edge ambiguous. So on a completed `cast_root`, Rerun presents an explicit choice (small popover anchored to the toolbar, not a heavy dialog):

- **Fork new cast** (default): creates a *new* `cast_root` node beside the original (new `modelId`, same attributes as its starting brief), connected by a `forked_from` edge. The original and its views are untouched. This is "same brief, another candidate."
- **Recast this cast**: regenerates this root in place — a new person under the same node. This is an identity event: if unpinned views exist, the 3c dialog follows with exact counts and cost. This is "I don't like this face."

**On roots, every image change is an identity event** — recast, attribute change, and History-tab revert all route through the 3c confirmation when views exist. Version history is still *recorded* for roots (`board_item_versions` — the rails already exist, audit N3) so History remains an honest audit trail and revert stays possible, but revert is presented as "restore this identity," with the same cascade rules. `cast_view`, image-gen, and VTO nodes keep plain vN versioning — reruns there are new shots of the same subject.

### Decision 4 — Per-node state architecture *(revised store-retirement scope)*

The three casting stores (`useCastingFormStore`, `useCastingGenerationStore`, `useCastingUIStore`) were built for a single active cast in a linear studio and cannot represent multiple casts on one canvas. **No canvas code may import them.**

Revised retirement plan (audit N1): the stores are *not* deleted in pass 1. They survive as `/studio`-scoped state, because `/studio`'s `DrapeStudio` + `ControlPanel`, `useStudioEntry`'s entry-reset contract, and nothing else consume them once `BoardCastingPanel` is deleted. They die with `/studio`. The enforcement line moves from "deleted from the repo" to "zero imports from `features/boards/**` or any new canvas code" — mechanically checkable.

**New model:**

- **Persistent config** (all casting fields, prompts, blender values) lives in `board_items.metadata`, written via `boardOps` (debounced during active editing).
- **Transient editor state** (open tab, expanded chip, drafts) is local React state, discarded on close.
- **In-flight generation state** lives in one global Zustand store, `useGenerationJobs`, keyed by `itemId` — orchestration only, never form values. Job shape from day one: `{ itemId, operation, engine, status: 'queued'|'running'|'failed'|'done', progressPct?, phaseLabel?, startedAt, estimatedDurationMs }`. It must tolerate **minutes-long jobs** (video, pass 4) even though pass-1 image jobs finish in seconds: progress is time-based against `estimatedDurationMs`, polling backs off on long jobs, and nothing in the store assumes a single image result.

Duplicating a node is a copy of metadata. Undo restores a snapshot of metadata (Decision 7). The agent reading board state gets cleanly serializable JSON.

### Decision 5 — Agent-ready primitives *(revised: 5.3 already shipped)*

The canvas must be fully callable as pure functions from day one. Commitments:

1. **All mutations go through `boardOps`** (server module + tRPC router — §4). No React component mutates board state directly. This also replaces the current inline iteration orchestration in `BoardPage.tsx` (:632–685), which moves into `boardOps.runRefinement`.
2. **All cast output provenance is structured and filterable.** Never free-text. The parser emits structured JSON.
3. ~~Garment auto-captioning~~ — **already shipped** (`server/wardrobe/garmentAnalysis.ts`; audit N4). Removed from the pass-1 workload; pass 2 consumes it.
4. **Mutations use a two-phase `plan / execute` API.** `plan()` computes what would happen — nodes created, placement, **credit cost derived server-side from `CREDIT_COSTS`**, estimated duration — and `execute()` performs it. This one pattern powers the agent's confirmations, the Variations action, the views popover, the stale dialog, and every inline cost display (Decision 6).
5. **`boardState.getSnapshot(boardId)`** returns a JSON-serializable description of the full board: nodes with kinds and provenance, edges with relations, selection, viewport. Consumed by agents, undo, export, and future collaboration.

The agent itself is not built in this slice. These commitments cost ~one day of discipline.

### Decision 6 — Credit cost at every point of action *(new; ratified via decision log D-15)*

No affordance fires a paid generation without showing its cost first. The views popover's cost-total pattern generalizes:

- Every Run/Rerun/Refresh/Generate control displays its cost inline (placement per design system §9: adjacent cost label, not inside the button text, except in popover footers where the total is the primary metric).
- Costs are **computed by `plan()` server-side from `CREDIT_COSTS`** (`server/casting/aiService.ts:62`) — never client-side literals. The old docs' flat "1,200/view" examples are void (real: `castingImage` 350, `multiView` 300, `iterate` 350, etc.).
- Cost copy is an estimate ("~350 credits") because the engine may fall back to Flash pricing (`flashMultiplier: 0.5`); actual deduction happens through the existing `atomicCredits` path.
- This pattern is load-bearing for pass 4, where video costs make surprise charges unacceptable.

### Decision 7 — Keyboard model and scoped undo, specified now *(new; ratified via decision log D-16/D-17)*

Components are built against this model from the start, not retrofitted.

**Keyboard (pass 1):**

| Key | Behavior |
|---|---|
| `Esc` | Closes the topmost layer, strictly in order: popover → hover card → dialog → refinement studio → clear selection |
| `Delete` / `Backspace` | Delete selection. Root with connected views → confirmation dialog with cascade count. Everything else deletes immediately (undoable) |
| Arrow keys | Nudge selected node(s) 1 canvas unit; `Shift+Arrow` = 16 units. Batched into one undoable move |
| `Enter` | Submit the focused inline prompt (Run) |
| `Cmd/Ctrl+Z` | Undo, scoped (below) |
| `Cmd/Ctrl+A` | Select all nodes |
| `Space`+drag / wheel / pinch | Pan / zoom (React Flow defaults; zoom clamped to the existing 0.1×–5× persistence range) |
| `Cmd/Ctrl+K` | Reserved; command palette in pass 3 |

**Undo (pass 1, scoped):** a destructive spatial canvas without undo is a trust failure — but a full command-pattern undo stack across generations is not pass-1-sized. Pass 1 ships undo for the two trust-critical, cheaply-invertible operations:

- **Delete** — soft delete. `board_items` gains a nullable `deletedAt` timestamp (additive migration); delete sets it, queries filter it, and a toast offers "Undo" (in addition to `Cmd+Z`) which clears it. Versions and edges survive intact. Cascade deletes (root + views) restore as a unit. Hard cleanup of old soft-deleted rows is a later maintenance job.
- **Move** — an in-memory stack of position snapshots; `Cmd+Z` restores the previous positions via `boardOps.moveNodes`.

Generation operations are **not** undoable (money was spent; history covers recovery via versions). Full multi-step undo remains pass 4, and `getSnapshot` is its designed foundation.

---

## 3. Interaction grammar

*(Locked — table unchanged except Run-on-root routing to 3f.)*

Every node type obeys the same four-verb grammar (Run / Variations / New node / Edit), scoped by node type where scoping makes semantic sense (3e). Disabled verbs stay visible as greyed icons with explanatory tooltips, so the grammar remains predictable.

**Supporting actions on selection** (floating toolbar above the card): `Rerun`, `Variations`, `Duplicate`, `Download`, `Delete`, `Info`. Six icons max; no text labels; tooltips on hover.

---

## 4. `boardOps` and `boardState` API shape

Lives in `server/lib/boardOps.ts` + `server/lib/boardState.ts`, exposed via a tRPC router at `server/routes/boardOps.ts` (following the existing directory-router convention of `server/routes/generation/` if it grows sub-modules). The module is the single source of truth for "what operations exist on a board."

### Read operations

```ts
interface BoardStateSnapshot {
  boardId: number;
  viewport: { x: number; y: number; zoom: number };
  selection: number[];
  nodes: Array<{
    id: number;
    kind: "image" | "cast_config" | "wardrobe_config" | "note" | "frame" | "video";
    position: { x: number; y: number };
    size: { width: number; height: number };
    zIndex: number;
    label: string | null;
    imageUrl: string | null;
    provenance: Provenance;
    status: NodeStatus | null;
    pinned: boolean;
    metadata: Record<string, unknown>;
    currentVersion: number;
    versionCount: number;
  }>;
  edges: Array<{
    id: number;
    source: number;
    target: number;
    relation: "iterated_from" | "vto_input_model" | "vto_input_garment" | "reference_for"
            | "variant_of" | "generated_from_cast" | "forked_from";
  }>;
}

boardState.getSnapshot(boardId: number): Promise<BoardStateSnapshot>;
```

### Mutation operations

Every mutation has a `plan` function (expected outcome, cost, no side effects) and an `execute` function. Agents always plan-then-execute; the UI uses `plan` wherever a confirmation or cost display is needed (which, per Decision 6, is every paid action).

```ts
interface OperationPlan {
  operation: string;
  creates: Array<{ kind: string; provenance: Provenance; position: { x: number; y: number } }>;
  modifies: Array<{ itemId: number; changes: Partial<BoardItem> }>;
  deletes: number[];
  addEdges: Array<{ source: number; target: number; relation: string }>;
  estimatedCreditCost: number;   // derived from CREDIT_COSTS server-side
  estimatedDurationMs: number;
}

// Pass-1 operations:
boardOps.createNode          // drop a node (cast: creates an empty cast_root; library: places a library_cast/upload/reference)
                             // D-28: the empty-cast-node picker path does NOT create — it fills the existing node in place
                             // (provenance → library_cast, image → canonical headshot, initial version row)
boardOps.updateNodeMetadata  // config changes on an existing node (debounced writes)
boardOps.runGeneration       // fire a generation. First run on an empty cast_root invokes the prompt parser
                             // (three-path dispatch server-side). Result shape is engine- and media-agnostic:
                             // { outputs: [{ kind: "image", url, ... }], engine } — nothing assumes one image.
boardOps.runRefinement       // prompt-based iteration (studio Refine tab); replaces BoardPage's inline orchestration
boardOps.runSurgicalEdit     // mask-based edit (studio Surgical tab)
boardOps.updateAttributes    // structured attribute changes. Applies cross-field invalidation rules
                             // (gender clears hairStyle/hairFade/facialHair; hair-style selection cascade —
                             // port both rules from ControlPanel, audit D1) and the ethnicity dual-write (audit B4).
                             // Identity-level changes on cast_root: plan returns affected unpinned views for the 3c dialog.
boardOps.runVariations       // N sibling nodes. cast_root: new roots with variant_of edges. cast_view: NOT_SUPPORTED.
boardOps.forkRoot            // 3f Fork: new cast_root from an existing root (or from a version), forked_from edge
boardOps.recastRoot          // 3f Recast: regenerate a root in place; plan reports affected views like updateAttributes
boardOps.generateViews       // spawn N cast_view nodes for requested canonical views; generated_from_cast edges;
                             // provenance carries InputSnapshots of the root image consumed
boardOps.refreshStaleViews   // batch-regenerate all stale, unpinned views of a root; single plan/confirm
boardOps.markNodeStatus      // set/clear metadata.status (pass 1 writes stale + error)
boardOps.setNodePinned       // set/clear pinned (Keep old = pin; unpin from ··· menu)
boardOps.revertToVersion     // wraps existing boards.revertItemVersion; on cast_root this is an identity event (3f)
boardOps.branchFromVersion   // new node rooted at a prior version (from cast history: a new cast_root snapshot)
boardOps.deleteNode          // soft delete (deletedAt); cast_root with views: confirm + cascade as a unit
boardOps.undoDelete          // clears deletedAt for a node or cascade unit
boardOps.addEdge / removeEdge
boardOps.moveNodes           // batch position updates (drag, nudge)
```

Notes:

- `generateViews.plan` returns one `creates` entry per requested view and per-view + total costs from `CREDIT_COSTS.multiView` (or `allViews` when all remaining are selected, if cheaper).
- Every operation is logged with plan + result. Every operation that changes a node's visible output writes a `board_item_versions` row — the existing rails (audit N3); new `tool` values (`'attributes'`, `'rerun'`, `'views'`, …) are additive on the varchar column.
- Where an operation wraps an existing `boards.*` or `generation.*` procedure, wrap — don't duplicate (`addItem`, `updateItem`, `batchUpdatePositions`, the version procedures, and the iterate path all exist; audit N8).

---

## 5. State management and data flow

*(Rule unchanged: survives-reload ⇒ database; transient ⇒ local React state; exactly one global store for canvas code.)*

| State category | Location |
|---|---|
| Node config (attributes, prompts, blends) | `board_items.metadata` |
| Version history | `board_item_versions` (existing table) |
| Lineage/edges | `board_edges` (new) |
| Viewport | `boards.viewportX/Y/Zoom` (existing; zoom stored ×100) |
| Selection | Local React state in `BoardPage` |
| Editor tab, scroll, drafts | Local React state in editor/popover |
| In-flight generation jobs | `useGenerationJobs` (only global store in canvas code) |
| Undo stacks (move, delete toasts) | Local module state in `BoardPage`/`boardOps` client wrapper |
| Credit balance | TanStack Query cache (tRPC) |

**Mutation flow:** component → `boardOps.X.plan` (when confirmation/cost needed) → `boardOps.X.execute` via tRPC → optimistic update via `onMutate` → server writes → cache reconciles. Generation operations register in `useGenerationJobs`; node cards read job status from the store. Polling is fine for pass 1 (no SSE), with backoff for long jobs.

Preserve `BoardCanvas`'s existing drag-fingerprint protection (audit N6) — server round-trips must not stomp in-flight drags.

---

## 6. Schema changes (pass 1)

### New table: `board_edges`

As in Decision 2. Drizzle schema addition in `drizzle/schema.ts` following existing patterns; migrate via `pnpm db:push`.

### Additive columns on `board_items`

```sql
ALTER TABLE board_items
  ADD COLUMN kind ENUM('image','cast_config','wardrobe_config','note','frame','video') NULL,
  ADD COLUMN deletedAt TIMESTAMP NULL,
  ADD INDEX idx_board_items_kind (kind);
```

**Backfill mapping** (provenance-aware, audit N7 — stamped into `metadata.provenance` during the same migration script):

| Legacy `type` | `kind` | provenance stamp |
|---|---|---|
| `model` with `sourceModelId` | `image` | `{ type: "library_cast", modelId: sourceModelId, viewAngle: metadata.viewType ?? "frontClose" }` |
| `model` without `sourceModelId` | `image` | `{ type: "upload" }` |
| `garment` | `image` | `{ type: "library_garment", garmentId: sourceGarmentId }` (or `upload` if no FK) |
| `vto_result` | `image` | `{ type: "vto_output", inputs: [], engine: "unknown" }` |
| `reference` | `image` | `{ type: "reference" }` |
| `iteration` | `image` | `{ type: "upload" }` + `iterated_from` edge from `parentItemId` where set |
| `note` / `frame` | `note` / `frame` | none |

New rows write both `type` (legacy) and `kind`. The old enum drops in a later phase.

### No wardrobe schema change

`shortName`/`description`/`tags` exist and are populated by the shipped auto-captioning (audit N4).

---

## 7. Vertical slice sequencing (pass-level scope)

Milestone-by-milestone ordering, sizing, and founder checkpoints live in **`PASS_1_BUILD_PLAN.md`** (authored after `DECISION_LOG.md` ratification). Pass-level scope:

- **Pass 1 — Casting end to end on the new primitives.** Prerequisite refactors (audit Part 3) → tokens + schema → lifted-component redesign → canvas shell + empty/first-run states → inline cast creation with parser → completed-node chrome + attribute popovers → toolbar + variations + fork/recast → views + lineage edges → stale/pin flow → refinement studio (Refine, Surgical, Attributes, History) → library placement ("Add from library") → keyboard + scoped undo. Dogfoodable at the end; team uses it daily.
- **Pass 2 — Wardrobe on the same primitives.** `wardrobe_config` nodes, VTO as `runGeneration` with model+garment input edges and snapshot provenance, consuming the existing auto-captions.
- **Pass 3 — Canvas-native capabilities.** Generic image-gen node, note/frame maturity, multi-select operations, `Cmd+K` palette, frames-as-export-units (select a frame → export contents as PDF lookbook / PNG set — the canvas produces deliverables; groundwork only in pass 1 via frame kind + snapshot API).
- **Pass 4+ — Video nodes and polish.** Per `PASS_4_VIDEO_NOTES.md`; pass 1's obligations to it are already folded into Decisions 1, 4, and 6 (extensible kind, media-agnostic job store and `runGeneration` result, cost-before-run).
- **Later — canvas agent**, reading `getSnapshot()` and calling `boardOps` via tool-use.

---

## 8. Scope protection — what pass 1 does NOT include

- **No dark canvas palette.** Canvas tokens are self-contained light values; the canvas routes render inside a light-scoped container within the dark-defaulting app shell (audit N11, design system §2). Dark variants later.
- **No feature flags.** The canvas is the primary app surface.
- **No collaborative features.**
- **No agent UI.**
- **No full undo/redo stack.** Only the scoped delete/move undo of Decision 7. Pass 4 for the rest.
- **No `/studio` removal, restated:** `/studio` today is tool-URL-driven (`?tool=casting|wardrobe|export`; bare `/studio` redirects to `/app` — audit N1). Those tool entries and the lobby links into them keep working unchanged. The three casting stores survive as `/studio`-scoped state and are forbidden imports for canvas code (Decision 4).
- **No custom poses in views. No view-switcher dropdowns. No modals for canvas/studio surfaces.**
- **No real-time progress streaming.** Polling with backoff.
- **No mobile/tablet layouts.**

---

## 9. File inventory — what gets touched

### Delete

- `client/src/features/boards/panels/BoardCastingPanel.tsx` — replaced by inline creation + studio.
- `client/src/features/boards/overlays/ModelEditorOverlay.tsx` — rebuilt as the refinement studio (salvage the zoom/pan viewer and `MaskCanvasLayer` internals into studio tabs before deleting).
- `BoardPage.tsx`'s inline iteration orchestration (:632–685) — superseded by `boardOps.runRefinement`.
- `client/src/features/boards/components/NodeContextMenu.tsx` and other chrome superseded by the new node components (audit N6 inventory) — retire as each replacement lands, not big-bang.

### Refactor

- `client/src/features/casting/hooks/useCastingGeneration.ts` + `useCastingViewGeneration.ts` → parameter-taking (audit A1; both `setCanvas` side-effects removed).
- `ControlPanel.tsx` → `BrandSelector` extracted (A2); panel itself otherwise untouched in pass 1 (design system G.9).
- `client/src/features/boards/BoardPage.tsx` — hosts canvas/studio swap, selection, keyboard model, undo stacks.
- `client/src/features/boards/BoardCanvas.tsx` — keeps React Flow shell, fingerprint diff, imperative helpers; swaps node types and background to the new primitives.

### New

- `server/lib/boardOps.ts`, `server/lib/boardState.ts`, `server/db/boardEdges.ts`, `server/routes/boardOps.ts`.
- `server/casting/promptParser.ts` (+ its structured-output schema and tests against `PARSER_GOLD_STANDARD_V2.md`).
- `drizzle/schema.ts` additions + migration (board_edges; kind, deletedAt).
- `client/src/features/boards/canvas/` — canvas primitives (full inventory in `DESIGN_SYSTEM.md` §5).
- `client/src/features/boards/studio/` — refinement studio shell + tabs.
- `client/src/features/boards/stores/useGenerationJobs.ts` — the one global store for canvas code.
- `client/src/styles/canvas-tokens.css`.

### Reuse without structural modification

- Tactile components (`TriBlendSelector`, `EthnicityBlender`, `SkinToneGrid`, `HairColorWheel`, `EyeGrid`, `WarmSelectControl`, …) — *visually redesigned* per design system §G, functionally unchanged; locations per audit G table.
- `useCastingCanvas`, `useCastingExport` (already parameter-clean), the refactored generation hooks.
- Existing `boards.*` procedures, version rails, `atomicCredits`, the Gemini service layer (client/queue/breaker), garment auto-captioning.
- shadcn/ui primitives.

---

## 10. Current success criteria — R6 production baseline / R7 entry gate

> **Rewritten in R7-0 (2026-07-19).** The former list described retired inline prompt/attribute chrome, `RefinementStudio`, and pre-D-56 pin/staleness semantics. These criteria describe the shipped takeover + character-sheet system at the R7 entry baseline. R7's new capabilities gain their own acceptance criteria in `CASTING_SYSTEM_R7_REVIEW_AND_EXECUTION_PLAN.md`; they are not falsely claimed here.

All demonstrable on a real board unless the criterion names the standalone Studio entry:

1. **First cast:** dropping a Cast node opens the picker; **Cast new model** opens the Casting takeover. A validated natural-language brief and/or structured settings show the server-planned cost before generation, create one draft model with a real returned id, and produce its canonical headshot.
2. **Honest close/continuation:** leaving during same-tab headshot iteration or Add Views never leaks a stale Casting session. The originating node shows truthful progress when linked, completed work lands exactly once, and a headshot completed after an unlinked close is saved to Drafts with one **Open Draft** action. Reload/cross-tab recovery is explicitly R7, not claimed here.
3. **First-run entry:** a first-time user on an empty board sees the designed intro/empty state, may dismiss it, and does not see it again after the server-backed flag persists.
4. **Draft character sheet:** two or more filled canonical slots render the six-slot comp card on the Canvas whether the model is draft or minted. Empty, generating, current, stale, and failed slots are visually distinct; the Draft badge is live model status, not placement-era inference.
5. **Live placement truth:** linked placements read the model's current name and lifecycle. Naming a draft updates ordinary linked Canvas labels without minting or refresh; an explicit placement-only rename still wins; archived or missing sources degrade to **Source unavailable** while retaining the snapshot.
6. **Two authoring contracts:** on a draft, structured settings + **Recast model** deliberately create a new draft identity and say the person may change. Text/reference refinement operates on the accepted person and passes the strict post-generation identity gate. Unsupported, ambiguous, presentation, mark, and masked edits refuse before money according to D-56.
7. **Identity revision flow:** an authorized draft identity edit commits the new anchor, identity documents, revision, and sibling stale rows atomically. An image-only edit changes only the selected asset. A verified current display headshot may receive the next authorized identity edit without weakening server-owned revision authority.
8. **Package care:** the strip's stale/failed/refreshing/missing truth agrees with Package Health and the Canvas mosaic. Package Health shows exact plan prices, refreshes/retries only after an explicit click, names/refunds per-slot failures, clears stale presentation only after server confirmation, and never spends automatically.
9. **Views without minting:** adding Core or full-card views may keep a model draft. Closing the modal/takeover during Add Views is safe in the same tab, every completed slot keeps its real ledger id, and reopening reads the resulting package from server truth.
10. **Mint ceremony and minted immutability:** mint requires a non-empty name and clean draft state, selected-tier integrity, and no failed required slot. Successful mint gives one stable agency id and updates every linked placement. Minted visual identity never changes in place; the current R6 surface routes change to Fork and missing views to the deliberate upgrade door.
11. **Fork, recast, and variation lineage:** fork creates a distinct draft/model identity and a `forked_from` relationship; variation creates a new draft placement with the intended lineage edge; board-door recast/identity landing is atomic and reports a durable library result if placement fails.
12. **Export truth:** unminted export refuses and routes to mint. Model Library exports the free current-resolution six-view identity pack with correct labels and identity PDF; no hidden 2K generation or surprise charge occurs.
13. **Version truth:** **Use this version** is free compatible asset reuse inside the current identity revision, appends a new display head, preserves siblings, and visibly refuses no-op or cross-revision selection. It is never described as identity rollback.
14. **Canvas trust and recovery:** node delete/Undo, duplicate, selection, nudge, lineage, thumbnail clear-on-last-delete, and library placement work without corrupting the underlying model. Failed generation renders a named recoverable state rather than a blank card; unrelated nodes remain untouched.
15. **Architecture, accessibility, and parity:** Canvas code respects the permanent casting-store import boundary; paid Canvas copy contains no hardcoded credit literals; takeover Escape/modal ownership is deterministic; `/studio?tool=casting` smoke-passes after casting changes; the tokenized monochrome design and interaction grammar remain legible on a 30+ node board.

---

## 11. Open questions for later phases

- Wardrobe's expressive-control equivalent of blender chips — start of pass 2.
- Agent surface: chat panel vs agent-node — start of agent work.
- `/studio` retirement timing — product call, post pass 3 (the three stores and `ControlPanel` go with it).
- Dark canvas palette authorship — post pass 3.
- Full undo/redo scope — pass 4, on `getSnapshot` foundations.
- Frames-as-export implementation detail (PDF layout engine, export presets) — start of pass 3; pass 1 only guarantees the primitives don't block it.
- Collaborative cursors / real-time sync — much later.

---

**End of foundations doc. Read `DESIGN_SYSTEM.md` next; check every divergence from the original drafts in `DECISION_LOG.md`.**
