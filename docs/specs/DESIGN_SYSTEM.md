# Drape Canvas — Design System & Implementation Spec (revised)

**Audience:** engineering (including coding agents). This is the visual and component spec for the canvas boards rebuild — every component on `/app/board/:id` and in the refinement studio, with tokens, code, states, and interaction behavior. Read `CANVAS_FOUNDATIONS.md` first for architecture, `CANVAS_AUDIT_ADDENDUM_V2.md` for verified code facts, and `DECISION_LOG.md` for the ratification status of every divergence from the original draft.

**Revision note:** the ten non-negotiables and the anti-patterns list are founder-locked and unchanged except where explicitly argued and logged (the destructive-red rule, D-8). New in this revision: the zoom & density strategy (§12), color-as-information position (§2.1), empty states & first-run (§11), the lifted-component redesign folded in as normative spec (§13), corrected field names and formatters throughout, and cost-display rules wired to real `CREDIT_COSTS`.

**Conventions:**
- TypeScript + React 19 + Tailwind v4 + shadcn/ui patterns. `cn` from `@/lib/utils`. Icons from `lucide-react`.
- shadcn primitives (`Popover`, `Button`, `Tooltip`, `Input`, `ScrollArea`, `Tabs`, `Dialog`, `HoverCard`, `DropdownMenu`, `Select`) exist at `@/components/ui/*`. Use them; do not rebuild.
- Tailwind v4 `@theme` tokens go in `client/src/styles/canvas-tokens.css`, imported from the main CSS entry.
- React Flow (`@xyflow/react` v12) is the canvas engine — it is already the engine of the current `BoardCanvas.tsx`; keep its drag-fingerprint protection and imperative viewport helpers (audit N6). Custom node types register via `nodeTypes`.

---

## 1. Design philosophy — the non-negotiables

*(Locked. Read before writing any component.)*

1. **Seamless surfaces.** Every tool and state is part of one continuous visual language. No room feels like a dialog floating over another room. Canvas ↔ refinement studio transitions happen via a back action, not overlays.
2. **Flat, never decorative.** No gradients. No drop shadows (except functional focus rings). No glow, blur, or neon.
3. **Hairlines, not borders.** Default border weight `0.5px`. Selected states upgrade to `1px` dark. Nothing heavier.
4. **Labels outside cards.** Node type and engine labels sit as tiny (10–11px) tertiary-gray text *above* the card. They never go inside it.
5. **Controls below cards.** Type-specific metadata lives in a pill strip *below* the card. Cards stay focused on their output.
6. **Monochrome with one dark accent.** Every commit/run/apply button is a dark pill. Every other button is ghost. Exceptions, both tokenized: the teal "filled/ready" chip state, and — inside confirmation dialogs only — the destructive red confirm (§2.1).
7. **Sentence case everywhere.** Never Title Case, never ALL CAPS.
8. **Two font weights only:** 400 and 500.
9. **Dotted grid canvas background.** Tiny dots at 22px spacing.
10. **No modals, no scrims.** Popovers float; takeovers replace. Confirmation dialogs (the one legitimate dialog use) use the lightest possible backdrop (`bg-black/20` max).

---

## 2. Design tokens

`client/src/styles/canvas-tokens.css`, imported from the main CSS entry:

```css
@theme {
  /* Canvas surfaces */
  --color-canvas-bg:            #FAFAFA;
  --color-canvas-surface:       #FFFFFF;
  --color-canvas-surface-inset: #F4F4F3;

  /* Canvas ink */
  --color-canvas-ink:        #0A0A0A;
  --color-canvas-ink-soft:   #5A5A58;
  --color-canvas-ink-faint:  #9B9B98;

  /* Canvas borders */
  --color-canvas-border:        #E8E8E6;
  --color-canvas-border-strong: #C7C7C4;

  /* Filled state (teal — "ready / parsed / complete") */
  --color-canvas-teal-bg:   #E1F5EE;
  --color-canvas-teal-text: #085041;

  /* Semantic accents (used ONLY where §2.1 permits) */
  --color-canvas-destructive: #B3261E;  /* red confirm inside dialogs; error badge icon */
  --color-canvas-warning:     #E07C5A;  /* required-dot, warning-tier hints */

  /* Connection pins */
  --color-canvas-pin-prompt: #CECBF6;  /* purple — text/prompt input */
  --color-canvas-pin-image:  #B5D4F4;  /* blue — image/reference input */

  /* Radii */
  --radius-canvas-sm: 6px;
  --radius-canvas-md: 8px;
  --radius-canvas-lg: 12px;
  --radius-canvas-pill: 9999px;

  /* Typography scale */
  --text-canvas-xs:  10px;
  --text-canvas-sm:  11px;
  --text-canvas-md:  12px;
  --text-canvas-lg:  14px;
  --text-canvas-xl:  17px;
}
```

Spacing: Tailwind's built-in scale; card padding `px-3 py-2.5` (prompt row) / `px-4 py-3` (rail sections); chips `px-2.5 py-1`; strip gaps `gap-1`/`gap-1.5`.

**Theme scope (audit N11 — the app defaults dark, the canvas is light-first):** the app mounts `ThemeProvider defaultTheme="dark"`, and the app-wide tokens are a different palette. Canvas tokens are self-contained absolute values (nothing above references an app variable), so canvas surfaces don't inherit darkness — but shared primitives rendered *within* the canvas tree (dialogs, dropdowns, toasts) do. `BoardPage` therefore wraps the canvas and refinement studio in a light-scoped container (`<div className="light" …>` or equivalent theme-scope mechanism of the existing `ThemeProvider`) so every portal/primitive inside resolves light. This is a hosting decision in `BoardPage`, made once. Dark canvas variants are authored post-pass-3; components reference tokens only, so they won't change.

### 2.1 Color as information — the position

*(New chapter; decision log D-7/D-8.)*

The canvas stays **monochrome at working zoom, defended by mechanism rather than by hope**. With one teal and no per-type colors, node types, statuses, and edge kinds must remain distinguishable at density. The mechanisms, in priority order:

1. **Silhouette and composition distinguish node *types*.** A cast node (portrait image + attribute block), an image node (bare image), a note (text card), a frame (containment rectangle) read differently at any size because their shapes differ. Type is additionally in the external label at working zoom. We do not color-code node types.
2. **Weight and fill distinguish *states*.** Selection = 1px ink border; generating = progress bar; stale = dimmed image + badge; pinned = filled pin glyph in the control strip; empty = dashed ghosts. None of these need hue.
3. **Badges carry *statuses*.** The corner `NodeStatusBadge` (§5.14) is the single status channel. Variants are distinguished by icon, not badge color — with one exception: the `error` variant's icon renders in `--color-canvas-destructive`, because a failed paid generation is the one state that must be findable at a glance on a 50-node board. One red glyph at 11px is information, not decoration.
4. **Pins keep their two hues** (purple prompt / blue image) — they are a data-type legend, already tokenized, and they earn their color by being the only affordance whose *meaning is the color*.
5. **Edges are monochrome**, differentiated by line style if ever needed (pass 2+: dashed for `reference_for`), not by hue.

**The destructive-red amendment (D-8, supersedes "destructive actions are never red"):** inside a confirmation dialog, the confirming destructive action renders as a red pill (`bg-canvas-destructive text-canvas-surface`). A red confirm inside a dialog is a universal safety convention; withholding it costs users a real error-prevention signal and buys the aesthetic nothing, because dialogs are already the system's one "stop" moment. Strict limits: **red appears only on the confirm button of a dialog whose action destroys user work** (delete node/cascade, recast identity discarding views). Never on canvas chrome, toolbars, strips, chips, badges (except the error glyph above), or hover states. Delete icons in toolbars stay monochrome.

If a future feature wants a new color, it gets argued into this section first — not added to a component.

---

## 3. Anti-patterns — explicit list

*(Locked, with the two amendments noted.)*

- **Do not add drop shadows** except focus rings. Not on cards, popovers, buttons, or nodes.
- **Do not add gradients.** The only exception: color-*data* rendering inside `EyeGrid` (§13.5) — iris depth is data, not decoration.
- **Do not add decorative emoji or icon fonts.** `lucide-react` with explicit sizes.
- **Do not use font weights 600/700.**
- **Do not use Title Case or ALL CAPS.** Sentence case only.
- **Do not use colored buttons** except the dark primary pill, the teal filled chip, and — *amended per §2.1/D-8* — the red destructive confirm inside dialogs.
- **Do not add borders heavier than 1px.** Default `0.5px` via `border-hairline` (§4); selected `1px`.
- **Do not wrap the canvas or refinement studio in a modal container.** They are rooms. (The current `ModelEditorOverlay` violates this; it is rebuilt, not reused — audit N12.)
- **Do not introduce colors outside §2 tokens.**
- **Do not stack controls inside cards.**
- **Do not use the legacy `type` enum** on `board_items` in new code. `kind` + `metadata.provenance`.
- **Do not hold node config in Zustand or context.** Config lives in `board_items.metadata`; the only global store in canvas code is `useGenerationJobs`.
- **Do not import `useCastingFormStore`/`useCastingGenerationStore`/`useCastingUIStore` from any canvas code.** They are `/studio`-scoped legacy (foundations Decision 4).
- **Do not split `CastNode` into root/view components.** One component, branching on `data.provenance.type` (§5.11).
- **Do not couple `RefinementStudio` to routing.** Props only (`itemId`, `onClose`).
- **Do not put view-switcher dropdowns inside cast nodes.** Views are separate nodes.
- **Do not render the attribute block on view nodes.** Identity lives on the root.
- **Do not build per-type status indicators.** One `NodeStatusBadge` (§5.14).
- **Do not hardcode credit costs anywhere in the client.** Every cost string comes from a `plan()` result (foundations Decision 6). Grep-able rule: no numeric literal followed by the word "credits" in canvas code.
- **The canvas language applies to lifted casting components too.** Color-data swatches in `SkinToneGrid`, `HairColorWheel`, `EyeGrid` are the only chromatic exception, and only the swatches themselves (§13).

---

## 4. Hairline border utility

```css
@layer utilities {
  .border-hairline    { border-width: 0.5px; }
  .border-b-hairline  { border-bottom-width: 0.5px; }
  .border-t-hairline  { border-top-width: 0.5px; }
  .border-l-hairline  { border-left-width: 0.5px; }
  .border-r-hairline  { border-right-width: 0.5px; }
}
```

Usage: `border-hairline border-canvas-border rounded-canvas-md`. Every card, popover, strip, and chip defaults to this. (Zoom note: at canvas zoom < 1 a 0.5px border can drop below device-pixel rendering — §12 handles this deliberately rather than accidentally.)

---

## 5. Component specifications

Build order: tokens → `DottedGridBackground` → `TopBar` → `FloatingToolPill` → `ConnectionDot` → `NodeLabelRow` → `CanvasNodeShell` → `NodeInlinePrompt` → `NodeControlStrip` → `NodeAttributeBlock` → `NodeFloatingToolbar` → `CastImageArea` → `NodeStatusBadge` → `CostLabel` → `CastNode` → popovers → studio. Each depends on the ones before it.

### 5.1 `DottedGridBackground`

`client/src/features/boards/canvas/DottedGridBackground.tsx`

```tsx
export function DottedGridBackground() {
  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        backgroundImage:
          "radial-gradient(circle, var(--color-canvas-border) 1px, transparent 1px)",
        backgroundSize: "22px 22px",
        opacity: 0.6,
      }}
      aria-hidden
    />
  );
}
```

React Flow's own `Background` (currently rendered by `BoardCanvas.tsx:366–371`) is removed; this renders instead.

### 5.2 `TopBar` and back action

`client/src/features/boards/canvas/TopBar.tsx` — one component for BOTH canvas and studio states. Breadcrumb left, utilities right, optional `backAction` (chevron + label). Implementation as in the original draft (unchanged):

```tsx
export interface TopBarProps {
  breadcrumb: Array<{ label: string; onClick?: () => void }>;
  title?: string;
  subtitle?: string;
  rightSlot?: React.ReactNode;
  backAction?: { label: string; onClick: () => void };
}
```

Canvas usage: breadcrumb `Boards · {board.name}`, right slot zoom % · Share · avatar. Studio usage: `backAction {label:"Boards"}`, breadcrumb `Cast`, title `Maya R.`, subtitle `v{n} · saved {relativeTime}`, right slot `{viewsDone} of 5 views · esc`. Row: `px-4 py-3 border-b-hairline border-canvas-border bg-canvas-surface`; back button `text-canvas-sm text-canvas-ink-soft hover:bg-canvas-surface-inset`; crumbs `text-canvas-sm text-canvas-ink-soft` separated by `·` in ink-faint; title `text-canvas-md font-medium`.

### 5.3 `FloatingToolPill`

`client/src/features/boards/canvas/FloatingToolPill.tsx` — bottom-center pill, canvas only. Buttons: **Add** (`Plus`), **Select** (`MousePointer2`), **Frame** (`Square`), **Note** (`Type`), divider, **More** (`MoreHorizontal`). 28px round buttons; active = `bg-canvas-ink text-canvas-surface`; container `p-1 bg-canvas-surface border-hairline border-canvas-border-strong rounded-canvas-pill`. Implementation as in the original draft.

The **Add** dropdown (shadcn `DropdownMenu`, positioned above the pill) lists: `Cast`, `From library` *(new — foundations Decision 3a/§4 `library_cast` placement; opens the `LibraryPickerPopover`, §7.3)*, `Image` *(pass 3, hidden until then)*, `Reference`, `Note`, `Frame`. The pill's geometry already accommodates future tool entries (video, pass 4) without redesign — do not size anything to exactly the current icon count.

### 5.4 `ConnectionDot`

`client/src/features/boards/canvas/ConnectionDot.tsx` — 10px colored circles on the card's left edge; double as React Flow `Handle`s (the current `BoardItemNode` already stubs invisible handles at :135–144 — these replace them, visible):

```tsx
import { Handle, Position } from "@xyflow/react";

export interface ConnectionDotProps {
  kind: "prompt" | "image";
  id: string;
  top: number; // px offset from card top
}

export function ConnectionDot({ kind, id, top }: ConnectionDotProps) {
  return (
    <Handle
      type="target" position={Position.Left} id={id}
      style={{
        top, left: -5, width: 10, height: 10,
        background: kind === "prompt" ? "var(--color-canvas-pin-prompt)" : "var(--color-canvas-pin-image)",
        border: "1.5px solid var(--color-canvas-surface)", borderRadius: "50%",
      }}
      className="!transform-none"
    />
  );
}
```

Cast root: `prompt` at 22px + `image` at 40px (the image pin maps to the existing `referenceImage` preference — audit B1). Cast view: `prompt` only.

### 5.5 `NodeLabelRow`

Above-card label row, 10px ink-faint; type/title left (`Cast · Maya R.` / `Cast · Maya R. · Full front`), engine right (from `provenance.engine` — never hardcode an engine name; pass 1 has one engine, the slot is the multi-engine door). Selected nodes upgrade the type label to ink-soft. Implementation as in the original draft. **Zoom behavior per §12** (hidden below the mid tier).

### 5.6 `CanvasNodeShell`

The generic white card every node composes. `relative bg-canvas-surface rounded-canvas-md overflow-hidden`; default `border-hairline border-canvas-border`, selected `border border-canvas-ink`; transition border only. No hover states on the shell. Implementation as in the original draft.

### 5.7 `NodeInlinePrompt`

Prompt row at the card bottom: single-line input + right-aligned action button. States: `empty` (placeholder, Run disabled-ghost until input exists), `ready` (Run dark pill **with adjacent `CostLabel`**, §5.15), `generating` (input disabled, "Running" ghost), `complete` (button reads "Edit" → navigates to studio). `Enter` submits. Implementation as in the original draft, with one correction: in the `empty` state the Run button is **ghosted/disabled** (Run enables only when prompt text or a set attribute exists — foundations 3a); the original draft's "empty: Run dark and active, flashes red on press" contradicted the foundations and is dropped.

### 5.8 `NodeControlStrip`

Below-card pill strip, selected nodes only. Segments: `label` (plain), `dropdown`/`action` (buttons, hover inset). Root cast: `[+ Views] [vN] [···]`. View cast: `[vN] [···]` — plus a small pin glyph segment when `pinned` (filled `Pin` icon 10px, tooltip "Pinned — kept as finished work"). No view-switcher segment exists on any cast strip. Implementation as in the original draft.

### 5.9 `NodeAttributeBlock` — identity attributes below the card *(rewritten per the VC1.5 ruling, 2026-07-10)*

> **Ruling history:** the original filled-pill chip strip failed VC1 — six pills below a selected card read as a second card competing with the image. The founder ruled a synthesis of the explored variants: **summary line at rest, spec-sheet rows on engagement.** The tap-to-popover architecture is unchanged. `BlenderChipStrip` is deleted; `NodeAttributeBlock` (`client/src/features/boards/canvas/NodeAttributeBlock.tsx`) is the shipped primitive.

Below the control strip; **cast roots only**; hidden below the working zoom tier (§12); collapses on deselect. Two states:

- **Resting (completed root, selected):** one tertiary-gray line of the filled values joined by `·`, truncating at card width (`Saint Laurent · Editorial · Brazilian + Japanese · …`). 10px ink-faint, hover → ink-soft, `title="Edit identity"`. The card keeps a single visual center.
- **Engaged (tap the line):** the line swaps to a no-fill spec-sheet row list at uniform card width — `grid-cols-[64px_1fr]`, label column 10px ink-faint, value column 10px ink-soft (hover → ink; active row → ink + medium; unset values render a faint `Add`). **Every row is a popover trigger** opening its tactile component (§13) in a `CanvasPopoverContent` directly — no intermediate step.
- **Empty root (freshly dropped):** skips the summary (nothing to summarize) and shows the rows immediately with faint `Add` values — identity controls stay visible and inviting before the first Run, preserving the foundations §3a intent that previously belonged to the ghost chips.

**The attributes for a cast root, with real field names and formatters** (audit B2/B3/C/D/E/F — this table is normative; the original draft's `attrs.skin`/`attrs.brand`/`attrs.vibe` names were wrong):

```ts
// From useCastNodeController, when provenance.type === "cast_root":
const attributes: AttributeDescriptor[] = [
  { id: "brand",     label: "Brand",     value: attrs.castingBrand ?? null,                               popoverContent: <BrandSelectorPopover/>,     popoverWidth: 260 },
  { id: "vibe",      label: "Vibe",      value: attrs.castingVibe ? formatVibe(attrs.castingVibe) : null, popoverContent: <VibeBlenderPopover/>,       popoverWidth: 280 },
  { id: "ethnicity", label: "Ethnicity", value: formatEthnicity(attrs.ethnicityBlend ?? []),              popoverContent: <EthnicityBlenderPopover/>,  popoverWidth: 320 },
  { id: "skin",      label: "Skin",      value: attrs.skinTone?.split(" / ")[0] ?? null,                  popoverContent: <SkinTonePopover/>,          popoverWidth: 280 },
  { id: "hair",      label: "Hair",      value: attrs.hairColor ?? null,                                  popoverContent: <HairColorPopover/>,        popoverWidth: 300 },
  { id: "eyes",      label: "Eyes",      value: attrs.eyeColor ?? null,                                   popoverContent: <EyeColorPopover/>,         popoverWidth: 240 },
];
```

> **D-19 re-decided inside the ruled treatment:** six attributes ship. The crowding objection was a property of the filled pills; six quiet text rows (and one truncating summary line) don't reproduce it. Dropping Eyes remains a one-line change if dogfooding disagrees.

Formatters:
- `formatVibe(weights)` → nearest `TriBlendSelector` preset label within `SNAP_THRESHOLD` (35), else `"Custom"`. Requires exporting `PRESETS`/`SNAP_THRESHOLD` from `TriBlendSelector.tsx` (currently private at :28/:39).
- `formatEthnicity(blend)` → `null` (empty) / `"Brazilian"` (one) / `"Brazilian + Japanese"` (two). Two is the hard cap (`toggleEth`, audit C); no "3 mixed" case.
- Skin displays the first half of the compound value (`"Porcelain / Pale"` → `"Porcelain"`), matching `SummaryStrip` (`WarmPrimitives.tsx:434`).
- Hair attribute = `hairColor` only (audit D). Row tooltips surface `*Override` text when present (parser override pattern).

When a value was set by the parser rather than the user, it renders identically — parser output and user output are the same attribute surface; provenance of the value is not visually distinguished in pass 1.

### 5.10 `NodeFloatingToolbar`

Above-card pill, selected + non-empty nodes only. Six 28px icon buttons: Rerun (`RefreshCw`), Variations (`Shuffle`), Duplicate (`Copy`), Download (`Download`), Delete (`Trash2`), Info (`Info`). Disabled = `opacity-40 pointer-events-none`, tooltip explains. `onMouseDown` stops propagation (React Flow drag). Tooltips: `bg-canvas-ink text-canvas-surface`, no shadow. Implementation as in the original draft.

View-node action list keeps all six with Variations/Duplicate disabled (`"Not available on view nodes"`). **Root-node Rerun does not fire immediately — it opens the `ForkRecastPopover` (§7.4)** per foundations 3f.

### 5.11 `CastNode` — the single React Flow node type for casts

`client/src/features/boards/canvas/nodes/CastNode.tsx`. One component for `cast_root`, `cast_view`, **and `library_cast`** provenance; branch on `data.provenance.type`. Do not split.

```ts
export interface CastNodeData {
  itemId: number;
  provenance: CastRootProvenance | CastViewProvenance | LibraryCastProvenance;
  modelName?: string;
  imageUrl: string | null;
  prompt: string;
  engine?: string;          // absent on library_cast placements
  version: number;
  status?: NodeStatus;      // stale | error in pass 1
  pinned?: boolean;
  isEmpty: boolean;         // root only: no generation yet
}
```

Composition (root **and library** width 260 — a placed library cast is an identity anchor, not a view; VC2 finding — true `cast_view` cards 200):

- `NodeFloatingToolbar` — selected && !isEmpty. Root: 6 active (Rerun → ForkRecastPopover). View: Variations/Duplicate disabled. Library cast: Rerun/Variations disabled ("Generate from this cast in a downstream node"), Duplicate/Download/Delete/Info active.
- `NodeLabelRow` — root `Cast · {name}`; view `Cast · {name} · {viewLabel}`; library `Cast · {name} · Library`. Engine right-slot only when present.
- `CanvasNodeShell` containing: `ConnectionDot`s (root: prompt+image; view: prompt; library: none — it *is* a reference source), `NodeStatusBadge` when `status` set, `CastImageArea`, `NodeInlinePrompt` (root placeholder `Describe your model...`; view placeholder `Pose...`; hidden entirely on library casts).
- Below, when selected: `NodeControlStrip` (!isEmpty), `NodeAttributeBlock` (root only — summary line when complete, rows immediately on empty roots).

State reference for `useCastNodeController` (the hook binds node → `boardOps` + `useGenerationJobs` + tRPC; all branching and mutation plumbing lives there, the component stays thin):

```ts
interface CastNodeControllerResult {
  promptValue: string;
  setPromptValue: (v: string) => void;
  promptState: "empty" | "ready" | "generating" | "complete";
  runOrEdit: () => void;              // Run (with cost shown) if empty/ready; open studio if complete
  runCost: number | null;             // from boardOps plan — null while loading; feeds CostLabel
  controlSegments: ControlSegment[];
  attributes: AttributeDescriptor[];  // [] for non-root
  attrsExpanded: boolean;             // summary ↔ rows state; reset on deselect
  setAttrsExpanded: (e: boolean) => void;
  activeAttrId: string | null;
  setActiveAttrId: (id: string | null) => void;
  toolbarActions: NodeToolbarAction[];
  forkRecast: { open: boolean; onFork: () => void; onRecast: () => void; setOpen: (o: boolean) => void };
  refreshFromStatus: () => void;      // stale → refresh this view; error → retry
  dismissStatus: () => void;          // stale → PIN the node (Keep old); error → clear after acknowledge
}
```

**Root empty/complete/view behavior** (empty root: placeholder art, focused prompt, attribute rows with faint `Add` values, disabled Run, no strip/toolbar; complete root: image, read-only prompt, Edit, control strip, collapsed attribute summary line, toolbar; complete view: image, pose prompt, no attribute block, reduced toolbar) — with the pass-1 additions: costs on Run affordances, pinned exemptions, and the error state (§5.12).

### 5.12 `CastImageArea`

Five states now (was four):

- `empty` — `User` icon + "Cast a model", inset bg — plus, beneath it, the quiet secondary path (D-28, founder-directed): a ghost text link **`or choose from your models`** (10px ink-faint, hover ink-soft, no border, no fill) that opens the `LibraryPickerPopover` (§7.3) anchored to the node. Create-new and pick-existing both live at the node — the ElevenLabs-Flows avatar-node pattern, rendered in Drape's language (popover, not modal). Picking **fills this node in place** (§7.3), it does not spawn a sibling.
- `generating` — 3px progress bar animating `width` against `estimatedDurationMs` from `useGenerationJobs`, plus `Generating · {n}s`.
- `complete` — image, `object-cover`; `dimmed` prop (70% opacity) when stale.
- **`error`** *(new — foundations Decision 1 makes `error` a pass-1 status)* — inset bg, `XCircle` 16px in `text-canvas-destructive`, "Generation failed" in ink-soft, and a small ghost "Retry" button. The credit refund already happened server-side (`atomicCredits` refunds on failure); the message must not imply money was kept: subtitle "You weren't charged."
- `pinned` overlays nothing — pinning shows only in the control strip glyph.

### 5.13 `CanvasPopover` primitive

Wrap shadcn Popover once; every canvas popover uses it:

```tsx
export function CanvasPopoverContent({ className, ...props }: React.ComponentProps<typeof PopoverContent>) {
  return (
    <PopoverContent
      sideOffset={12}
      className={cn("bg-canvas-surface border-hairline border-canvas-border-strong rounded-canvas-md shadow-none p-4", className)}
      {...props}
    />
  );
}
```

### 5.14 `NodeStatusBadge` — generalized status indicator

One component for all node statuses; corner-anchored 22px round button in the image area's top-right; shadcn `HoverCard` (restyled: hairline, no shadow) with title, message, and up to two actions. Variant config:

| type | icon | title | primary | secondary |
|---|---|---|---|---|
| `stale` | `AlertCircle` | Out of sync | Refresh · {cost} | Keep old *(pins the node)* |
| `error` | `XCircle` (destructive-color glyph) | Generation failed | Retry · {cost} | Dismiss |
| `quality_flagged` | `AlertTriangle` | Quality flag | Regenerate | Accept anyway |
| `needs_review` | `Eye` | Needs review | Approve | Reject |
| `moderation` | `Shield` | Under review | Open case | Dismiss |

Pass 1 wires `stale` and `error`; the rest stay reserved (foundations Decision 1). Primary actions that cost credits show the cost in the button label, from plan data. Badge icon is monochrome ink except the `error` glyph (§2.1). Implementation otherwise as in the original draft (hover delays 100/150ms, `stopPropagation` on mousedown, actions as dark-pill primary + ghost secondary). Do not invent new badge positions or styles; extend this component or raise the design question.

### 5.15 `CostLabel` *(new)*

`client/src/features/boards/canvas/CostLabel.tsx` — the one way cost appears next to an affordance:

```tsx
export function CostLabel({ credits }: { credits: number | null }) {
  if (credits === null) return null; // plan still loading — never show a guess
  return (
    <span className="text-canvas-xs text-canvas-ink-faint whitespace-nowrap">
      ~{credits.toLocaleString()} credits
    </span>
  );
}
```

Placement rules: adjacent to (left of) the Run/Refresh/Generate control, never inside the primary button's label — except popover/dialog footers, where the total is the primary metric and renders large (`text-canvas-lg font-medium`). The `~` is deliberate (Flash-fallback pricing may halve actual cost — foundations Decision 6). Values always come from `plan().estimatedCreditCost`.

### 5.16 `ImageFallback` — the "source unavailable" state *(founder amendment to D-12)*

`client/src/features/boards/canvas/ImageFallback.tsx`. No canvas surface ever shows a broken image. Every `<img>` rendering a node image, version thumbnail, or provenance `InputSnapshot` uses this shared fallback on load error:

```tsx
import { ImageOff } from "lucide-react";

export function ImageFallback({ label = "Source unavailable" }: { label?: string }) {
  return (
    <div className="w-full h-full bg-canvas-surface-inset flex flex-col items-center justify-center gap-1 text-canvas-ink-faint">
      <ImageOff className="w-3.5 h-3.5" strokeWidth={1.4} />
      <span className="text-canvas-xs">{label}</span>
    </div>
  );
}
```

Wire via a small `onError` state swap (or a shared `SafeImage` wrapper — implementer's choice, one implementation only). Tiny contexts (History thumbs, snapshot chips) may render icon-only. Operations that would *consume* a missing input fail with a clear, refunded error naming the source (foundations Decision 1).

---

## 6. Refinement studio layout

`client/src/features/boards/studio/RefinementStudio.tsx` — full-screen takeover hosted by `BoardPage` (URL param `?edit=:itemId`); **props-only (`itemId`, `boardId`, `onClose`), no router imports** — this keeps the full-screen-vs-modal host decision reversible. No scrim, no overlay: a room.

Structure as in the original draft: `TopBar` (backAction Boards, title, `v{n} · saved {t}` subtitle, `{viewsDone} of 5 views · esc` right slot) over a three-column grid:

- **Preview column** `minmax(0, 1.55fr)`: large preview on inset bg + `ViewThumbStrip` (five equal thumbs: filled = hairline border + image; current = 1.5px ink border; empty = dashed + centered `+`; 9–10px labels below).
- **Tool column** `minmax(0, 1fr)`: underline-style tabs (Refine / Surgical / Attributes / History), active = ink text + 1px ink underline, medium weight.
- **`MetadataRail`** fixed `215px`, inset bg: master-prompt readout (mono 10px, clamped), Technical key-values (version, views, resolution), the **cost card** (pending operation label + `plan()` cost, `text-canvas-xl`), primary run button (dark, full-width, disabled at 40%), ghost Export button. `pendingOperationLabel`/`pendingCost` come from the active tab via `useRefinementStudioController`; the cost card hides when the active tab has no pending operation (History).

Column dividers: hairline only.

### 6.1 `RefineTab`

Prompt textarea (inset bg, no border) + quick-suggestion ghost pills + strength segmented control (Subtle/Moderate/Strong — hairline buttons, active = ink border + medium). Run button lives in the rail. Implementation as in the original draft. Calls `boardOps.runRefinement`. The salvaged zoom/pan viewer from `ModelEditorOverlay` powers the preview column.

### 6.2 `SurgicalTab`

Brush-masking pipeline salvaged from `ModelEditorOverlay`'s `MaskCanvasLayer` + `useCastingCanvas`, wired into the tab. Calls `boardOps.runSurgicalEdit`.

### 6.3 `AttributesTab`

Layered layout: **Region 1** — expressive widgets as full components (`BrandSelector`, `TriBlendSelector`, `EthnicityBlender`, `SkinToneGrid`, `HairColorWheel`, `EyeGrid`), each under a 10px ink-soft `ExpressiveSection` label. **Region 2** — `SimpleAttributeChipGrid` for the remaining simple fields, grouped under the five existing section names from `ControlPanel` (Casting basics, Physique, Face structure, Skin & complexion, Eyes & hair) with completion counts (`Face structure · 1 of 7`). Chip pattern: filled = teal bg/teal text pill; ghost = dashed hairline + faint `+ {label}`; click opens the field's editor (e.g. `WarmSelectControl`) in a small `CanvasPopoverContent`.

For `cast_root`: identity-level commits route through `boardOps.updateAttributes` and the stale-flow dialog (§9). Cross-field invalidation (gender → hair resets; hair-style cascade) happens server-side in `updateAttributes` — the tab does not re-implement it. For `cast_view`: read-only, rendering inherited values with an `Edit identity on root cast →` link that reopens the studio on the root.

### 6.4 `HistoryTab`

Version timeline on the existing `board_item_versions` rails (audit N3): thumb + `v{n}` + tool/prompt line + relative time; continuous left rail (current = 2px ink, prior = hairline, last = transparent); selecting a non-current version reveals **Revert to v{n}** and **Branch as new cast** ghost buttons. Thumbs and any rendered `InputSnapshot`s use `ImageFallback` (§5.16) on load error. On a `cast_root`, Revert is an identity event — it routes through the same confirmation as recast when unpinned views exist (foundations 3f); label it "Restore this identity". Implementation otherwise as in the original draft.

---

## 7. Popover content specifications

Each blender popover wraps its tactile component (§13 redesigned versions) in the same shell: header row (title `text-canvas-md font-medium` + hint `text-canvas-xs ink-faint`) → component → readout → footer `Cancel` (ghost, flex-1) + `Apply & run` (dark pill, flex-[2]) above a hairline. **The `Apply & run` footer row includes a `CostLabel`** with the rerun cost from plan data. Widths: brand 260, vibe 280, ethnicity 320 (the blend bar's absolutely-positioned percentage labels need the extra room plus a bottom spacer — §13.2), skin 280, hair 300, eyes 240.

### 7.1 `VibeBlenderPopover`

Header "Casting vibe" + "drag to adjust"; `TriBlendSelector`; three readouts (Commercial/Editorial/Runway percentages, 9px label + `text-canvas-md font-medium` value); footer. Implementation as in the original draft.

### 7.2 `ViewsGenerationPopover`

**The 5 canonical views are fixed** — no custom pose field, no "+ Another pose", no free-text angle. Ever. (Foundations §1.5.)

Rows: checkbox + label (`Headshot` pre-checked and locked — it's the root; `Full body front`, `Side close`, `Side full`, `Back full`), right-aligned per-view cost — **from the plan, not a literal** (real pricing: `CREDIT_COSTS.multiView`; the popover requests `boardOps.generateViews.plan` on open and re-plans on toggle). Footer: `{n} views selected` + total (`text-canvas-lg font-medium`), then Cancel / Generate (disabled at 0 selected). Checkbox: 14px square, checked = ink fill + white check path, locked-checked = ink-faint fill, unchecked = hairline-strong border. Completed views render at 60% opacity with "done" instead of a cost.

When **all views already exist**, the popover body is replaced by the all-views-exist state (§11.4).

### 7.3 `LibraryPickerPopover` *(new — foundations Decision 3a / library bridge; D-28 second entry point)*

A 320px `CanvasPopoverContent`: search input (inset bg), two underline tabs `Models` / `Garments` (garments hidden until pass 2), then a 3-column grid of square thumbs (hairline borders, name in 10px below, hover = border-strong). Data: existing `models`/`wardrobe` list procedures. Empty library state: `User` icon + "No models yet" + ghost link `Cast one on this board` (closes the popover, drops a cast node). No pagination in pass 1 — most-recent 30 with search.

**Two entry points, one picker (D-28):**
1. **Add menu → "From library"** — clicking a thumb *places* a new `library_cast` node at the viewport center (`boardOps.createNode`) and closes.
2. **Empty cast node → "or choose from your models"** (§5.12) — clicking a thumb *fills that node in place*: provenance becomes `library_cast` with the model's id, the image becomes the model's canonical headshot, an initial version row is written. No sibling node is spawned.

**What is pickable here is constrained — canonical cast reference imagery only.** The Models tab lists cast/minted models and represents each by its canonical views (headshot by default; pass 1 places `frontClose`). It never lists VTO outputs, styled/outfitted renders, or scene imagery — a casting node is a reference asset (foundations §1.5), and letting a dressed-and-lit output stand as an identity reference would quietly break the identity guarantee downstream. ElevenLabs' avatar detail view offers styles/outfits/scenery at pick time (reference screenshots, 2026-07-10); Drape deliberately does not at this surface — creative variants belong to downstream image-gen/VTO nodes that consume the cast via edges. If a per-view choice is wanted later (full front vs headshot as the placed reference), it is a second-level select limited to the five canonical views — never styles.

### 7.4 `ForkRecastPopover` *(new — foundations 3f)*

Anchored to the root's Rerun toolbar icon. 260px. Title "Rerun this cast"; body copy one line: "A rerun casts a different person." Two stacked full-width choices, each a bordered row (hairline, hover border-strong) with title + one-line description + `CostLabel`:

- **Fork new cast** — "Keep {name}; add another candidate beside them." (default focus)
- **Recast this cast** — "Replace {name}'s identity. {N ? `Outdates ${N} views.` : ``}"

Choosing Recast with unpinned views proceeds to the identity-change dialog (§9). Esc/outside-click cancels. This is a popover, not a dialog — it's a choice, not a warning.

---

## 8. Canvas layout composition

`client/src/features/boards/BoardCanvas.tsx` (refactored, not rewritten — keep the item↔node mapping approach, the drag-fingerprint diff at :153–209, and the imperative viewport-center/scroll-to-node refs at :321–350; audit N6):

```tsx
const nodeTypes = {
  cast: CastNode,            // cast_root | cast_view | library_cast provenance
  image: ImageNode,          // upload | reference (pass 1); text2img (pass 3)
  note: NoteNode,            // existing, restyled to canvas language
  frame: FrameNode,          // existing, restyled
  // wardrobe: WardrobeNode  — pass 2; video: VideoNode — pass 4
};
```

`BoardCanvas` renders: `TopBar` → relative flex-1 with `DottedGridBackground` + `ReactFlow` (`proOptions={{ hideAttribution: true }}`, `panOnDrag`, `selectionOnDrag` when the Select tool is active, `fitView={false}`) → `FloatingToolPill`. React Flow's own `Background`/`MiniMap` are not rendered.

**Edges:**

```ts
const defaultEdgeOptions = {
  type: "smoothstep",
  style: { stroke: "var(--color-canvas-border-strong)", strokeWidth: 1, opacity: 0.4 },
};
```

Edge opacity upgrades to 1 when either endpoint is selected (selection-change listener in `useBoardCanvasController`). Edges are otherwise ambient — they are lineage, not wiring diagrams.

---

## 9. Interaction specifications

### Selection
- Click selects (single); Cmd/Ctrl+click extends; click empty canvas deselects; `Cmd/Ctrl+A` selects all.
- Selection drives: border weight (hairline → 1px ink), `NodeFloatingToolbar`, `NodeControlStrip`, `NodeAttributeBlock` (roots), connected-edge opacity.

### Empty-state cast node (freshly dropped)
As foundations 3a: auto-selected, prompt auto-focused, the six attribute rows visible with faint `Add` values (§5.9 empty-root state), no strip/toolbar, Run disabled until prompt text or a set attribute. First Run fires `boardOps.runGeneration` (server-side parser dispatch), with cost shown beforehand via `CostLabel`. The image area additionally carries the quiet `or choose from your models` link (§5.12/D-28) — the pick-existing path at the node; choosing a model fills the node in place as `library_cast` and the node exits its empty state without a generation.

### Drag
- React Flow default node drag. During drag, chrome (toolbar/strips/chips) hides; reappears on drop if still selected.
- All chrome components call `stopPropagation` on `onMouseDown`.
- Drag-end persists via `boardOps.moveNodes` (wrapping the existing `batchUpdatePositions`); each drop pushes one entry on the move-undo stack.

### Popovers
- One open at a time; opening another closes the first. Esc or outside-click closes and reverts the attribute row to its previous state (the rows stay expanded; deselect collapses the block).
- `Apply & run`: for identity-level changes on a root with connected **unpinned** views → identity-change dialog first. Otherwise commit (`boardOps.updateAttributes` or `updateNodeMetadata`) + `runGeneration` immediately.

### Identity change confirmation dialog
Fires when an identity-level attribute on a `cast_root` is about to change AND unpinned connected views exist (also reached from Recast, §7.4, and History restore, §6.4).

- Content: **"This will regenerate {N} existing views · ~{cost} credits."** (counts and cost from `updateAttributes.plan` / `recastRoot.plan`).
- **Update now** — dark pill. Commits, regenerates root + all affected views in one batch; atomic deduction.
- **Update later** — ghost. Commits, regenerates root, marks each affected view `stale` (with old/new values in context).
- **Cancel** — text button. Nothing commits; the popover/tab retains the draft.
- shadcn `Dialog` restyled: `bg-canvas-surface border-hairline border-canvas-border-strong shadow-none`, backdrop `bg-black/20` max, width 400px. This dialog's confirm is **not** red — updating views isn't destroying work. Red confirms appear only where work is destroyed (§2.1): delete-cascade and recast (recast's confirm IS red — it discards an identity).

### Stale + pin
- Stale views show the badge at all times (not selection-gated) + 70% image opacity.
- Badge hover card: **Refresh · ~{cost}** (regenerate this view against current identity; clears status on completion) / **Keep old** (sets `pinned: true` via `boardOps.setNodePinned`, clears the badge permanently — finished work).
- Pinned nodes: pin glyph in control strip; excluded from cascade counts, bulk refresh, and future stale marking; unpin lives in the node's `···` menu.
- Root `···` menu gains `Refresh all stale views ({N} · ~{cost})` when applicable → `refreshStaleViews.plan` → confirm → execute; each view transitions through its own generating state.

### Delete + undo
- `Delete`/`Backspace` or toolbar Trash: plain nodes soft-delete immediately with a toast `Cast deleted · Undo` (8s); roots with connected views get the cascade dialog first (**red confirm** — destroys work), then delete as a unit with one toast.
- `Cmd/Ctrl+Z` undoes the most recent delete or move. Toast Undo and `Cmd+Z` share the same restore path (`boardOps.undoDelete` / `moveNodes`).

### Refinement studio entry/exit
- `Edit` → `BoardPage` sets `?edit=:itemId` and swaps `RefinementStudio` in. `← Boards` / Esc → `onClose` → canvas restores viewport + selection.
- Unsaved Refine/Surgical drafts discard without warning — transient by design.
- Editing a view: Attributes read-only + root link, as §6.3.

### Keyboard (full table: foundations Decision 7)
Esc layer order: popover → hover card → dialog → studio → deselect. Arrows nudge 1 unit (Shift = 16), batched as one undoable move. Enter submits focused prompt. `Cmd/Ctrl+K` reserved for pass 3.

---

## 10. Animation and transition specifications

Keep animations minimal. Heavy motion is off-brand.

| Target | Property | Duration | Easing |
|---|---|---|---|
| Node border color/width | border | 150ms | ease-out |
| Button hover bg | background-color | 120ms | ease-out |
| Popover open / close | opacity, translateY(4px→0) | 160 / 120ms | ease-out / ease-in (Radix default) |
| Chrome appearance on selection | opacity 0→1 | 120ms | ease-out |
| Studio tab swap | opacity | 120ms | ease-out |
| Progress bar fill | width | 300ms | linear |
| Image fade-in on complete | opacity | 250ms | ease-out |
| Zoom-tier chrome swap (§12) | opacity | 120ms | ease-out |
| First-run intro dismiss (§11) | opacity | 200ms | ease-out |

Do not animate: node positions during drag (React Flow's job), text color, layout-shifting chrome (above-card toolbar is absolutely positioned; below-card strips appear via opacity, never height).

---

## 11. Empty states and first-run *(new chapter)*

Empty states are part of the product's voice: calm, capable, specific. Never a bare blank surface; never a marketing splash. All copy sentence case, two sentences max.

### 11.1 Empty board — first ever (first-run intro)

Shown the first time a user opens any board with zero items and has never dismissed it (persist a `canvasIntroSeen` flag on the user profile via the existing profile router — not localStorage, so it survives devices). In the spirit of Higgsfield's canvas intro, executed in Drape's restrained language: **not** a modal tour, **not** coach marks — a quiet arrangement *on the canvas itself*, in canvas tokens:

- Centered composition of three ghost cards (dashed hairline borders, inset placeholder art at 50% opacity) laid out like a real workflow: a cast card, an arrow-less gap, a views row — each with a one-line 11px ink-soft caption beneath: `Cast a model from a sentence`, `Generate their five views`, `Everything stays connected`.
- Beneath the composition, one dark pill: `Cast your first model` (drops a cast node at center, auto-focused — the same action as the tool pill's Add → Cast) and a ghost text button `Start with a blank board`.
- Interacting with anything else (tool pill, dropping any node, clicking a ghost card) dismisses it permanently. It never returns; it does not animate in (it is simply *there*, first).
- The ghost cards are static art, not live nodes — no chrome, no selection.

### 11.2 Empty board — returning user

Zero items, intro already seen: a single centered hint, nothing else. `Plus` icon 16px ink-faint over `Add a cast, note, or frame from the toolbar` (11px ink-faint). Vertically centered, fades on first node.

### 11.3 Node with no output

The empty cast root's in-card state is §5.12 `empty` ("Cast a model" + person icon). A node whose generation **failed** is never blank: the `error` status badge + §5.12 error state with Retry ("You weren't charged"). A board *containing* failed nodes needs no board-level treatment — the per-node error state is the treatment; errors must be visible at the node, findable at density via the red glyph (§2.1.3).

### 11.4 Views popover — all views exist

When all five canonical views exist, the `+ Views` segment stays (grammar stays predictable) but the popover body becomes: the five rows all in their done state (60% opacity, "done"), footer text replaced by `All five views exist` in ink-faint, and the Generate button replaced by a ghost `Open a view` action that closes the popover and selects the nearest view node. No dead-end popovers.

### 11.5 Library picker — empty library

Per §7.3: icon + `No models yet` + ghost `Cast one on this board`.

---

## 12. Zoom & density strategy *(new chapter — highest-priority gap)*

The system above is specced at ~100% zoom with few nodes. Unmanaged, it degrades at 40% on a 50-node board: 10px labels become smudges, 0.5px hairlines alias out of existence, below-card chrome turns to noise, and every selected node shouts. The strategy: **the card is the constant; chrome is the variable.** Chrome progressively retracts as zoom falls, so the flat/hairline language at working zoom is never compromised — small sizes simply show less, not smaller-everything.

Three tiers, driven by React Flow's live zoom (`useStore(s => s.transform[2])`), with thresholds as exported constants:

```ts
// client/src/features/boards/canvas/zoomTiers.ts
export const ZOOM_TIER_MID = 0.45;   // below: "mid" — chrome retracts
export const ZOOM_TIER_FAR = 0.35;   // below: "far" — cards become tiles
export type ZoomTier = "working" | "mid" | "far";
```

> **Thresholds ruled at VC1 (founder, 2026-07-10): mid 0.45, far 0.35.** The constants remain the single tuning point — nothing else may hardcode a zoom breakpoint. (The tier architecture itself was ratified as D-1/D-2/D-3.)

Hysteresis: apply a ±0.03 band around each threshold when crossing back upward, so panning near a boundary doesn't flicker tiers. Tier transitions animate opacity only (120ms).

| Element | working (≥ 0.45) | mid (0.35–0.45) | far (< 0.35) |
|---|---|---|---|
| Card + image | full spec | full spec | image tile only; `rounded-canvas-sm`; inset placeholder if no image |
| Card border | hairline / 1px selected | **1px / 1.5px selected** (see below) | 1px; selected 2px |
| External `NodeLabelRow` | shown | hidden | hidden |
| Inline prompt row | shown | hidden (image fills the card) | hidden |
| Control strip / attribute block | shown on selection | hidden | hidden |
| Floating toolbar | shown on selection | shown on selection (it's fixed-size screen-space chrome — see below) | hidden; selection acts via keyboard/context |
| Connection pins | shown | shown at fixed screen size | hidden |
| Status badge | in-card corner, 22px | **screen-fixed 14px dot** at card corner (icon only, no ring) | same 14px dot — statuses stay findable at any zoom |
| Edges | 40% opacity, 1px | same, screen-space width | 60% opacity (they become the structure you're reading) |
| Stale dimming | 70% image opacity | same | same |

**Screen-space vs canvas-space (the load-bearing implementation rule):** labels, strips, and chips are canvas-space (they scale with the node, hence they retract instead of shrinking below legibility). The floating toolbar, status badges, and pins render at **fixed screen size** regardless of zoom (`transform: scale(1/zoom)` on their wrappers, or React Flow's `NodeToolbar` which does this natively). A 22px badge that scales down to 9px is decoration; a fixed 14px dot is information.

**Hairline handling below 1× zoom:** a 0.5px canvas-space border at 0.5 zoom renders at 0.25px — sub-pixel, aliased, effectively random. Hence the tier table upgrades card borders to 1px at mid and below: at those zooms 1px canvas-space ≈ the hairline's *rendered* weight at working zoom. This preserves the hairline *appearance* rather than the hairline *number* — the language is the look, not the CSS value.

**Selection at density:** at far tier, the selected tile's 2px ink border plus the (screen-fixed) toolbar at mid — or, at far, a 1px ink outline ring offset 2px — keeps selection findable without color. Multi-select at far tier shows the outline on each node.

**What never retracts:** the image itself, the status dot, selection indication. What you made, what needs attention, what you're touching.

Frame labels (pass 3) will render at far tier as the *only* text on the canvas — frames become the wayfinding layer at density; noted here so pass-1 code doesn't fight it.

Implementation: `useZoomTier()` hook (subscribes to zoom, returns the tier with hysteresis); every node component reads the tier from context and branches its chrome rendering. Do not implement per-element `if (zoom < x)` checks scattered through components — one tier enum, one source.

---

## 13. Lifted casting components — redesign in the canvas language *(normative; supersedes audit addendum §G)*

Every lifted casting component is redesigned to canvas tokens, hairline borders, monochrome ink, and sentence case. **Functional behavior — drag, snap, blend manipulation, selection — is preserved unchanged; only visuals shift.** Structural rewrites (e.g. converting `TriBlendSelector` to a 2D plane) are explicitly out of scope for pass 1.

**The principled exception — color data stays colored.** `SkinToneGrid` (skin tones), `HairColorWheel` (hair colors), `EyeGrid` (iris colors) render data that *is* color. The swatches stay chromatic; every border, hover state, selection ring, label, and piece of chrome around them conforms to the canvas language.

Component locations (audit-corrected): `TriBlendSelector.tsx` and `HairColorWheel.tsx` are standalone under `features/casting/components/`; `EthnicityBlender` (:182), `EyeGrid` (:154), `SkinToneGrid` (:492), `WarmSelectControl` (:119), `CollapsibleSection` (:289), `SummaryStrip` (:421) are exports inside `WarmPrimitives.tsx`; `BrandSelector` is extracted from `ControlPanel.tsx:166–191` and redesigned during extraction.

### 13.1 `TriBlendSelector`

Keeps the two-slider structure (edge + heat) + collapsible 8-preset grid. Redesign: outer beige container deleted (host popover provides the surface); header `Tone & energy` (sentence case) `text-canvas-md font-medium` with active-preset readout right (`text-canvas-xs` italic, ink-soft when matched / faint "Custom"); each slider = 4px inset track with hairline border and flat `bg-canvas-ink` fill, 14px ink thumb with 2px surface border (the border simulates a ring without shadow — same trick as `ConnectionDot`); endpoint labels (`Safe`/`Bold`, `Narrative`/`Commanding`) 10px ink-faint; number inputs borderless canvas typography; presets toggle = `ChevronRight` (rotates 90°) + `Presets` in sentence case; preset grid buttons use the standard chip pattern (below). Export `PRESETS` + `SNAP_THRESHOLD` for `formatVibe`.

**Standard chip pattern** (used by preset grid, ethnicity grid, `ChipRow`, `OptionGrid`):

```tsx
className={cn(
  "py-2 rounded-canvas-md text-center text-canvas-xs transition-colors",
  active
    ? "bg-canvas-surface-inset border border-canvas-ink text-canvas-ink font-medium"
    : "bg-canvas-surface border-hairline border-canvas-border text-canvas-ink-soft hover:border-canvas-border-strong"
)}
```

### 13.2 `EthnicityBlender`

Grid buttons → standard chip pattern (`grid-cols-3 gap-1.5` unchanged). **Blend bar loses per-ethnicity color coding entirely** — the bar shows *proportion*, the labels show *identity*:

```tsx
{selected.length === 2 && (
  <div className="space-y-1 pt-1">
    <div ref={barRef}
         className="relative flex h-8 rounded-canvas-md overflow-hidden border-hairline border-canvas-border select-none"
         style={{ cursor: dragging ? "col-resize" : "default" }}>
      {selected.map((eth, i) => (
        <div key={eth.name}
             className="h-full flex items-center justify-center relative bg-canvas-surface-inset"
             style={{
               width: `${eth.pct}%`,
               transition: dragging ? "none" : "width 200ms ease",
               ...(i === 0 ? { borderRight: "0.5px solid var(--color-canvas-border)" } : {}),
             }}>
          {eth.pct > 20 && (
            <span className="text-canvas-xs font-medium text-canvas-ink-soft">{eth.name}</span>
          )}
          <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-canvas-xs text-canvas-ink-faint whitespace-nowrap">
            {eth.pct}%
          </span>
        </div>
      ))}
      <div onMouseDown={(e) => { e.preventDefault(); setDragging(true); }}
           onTouchStart={() => setDragging(true)}
           className="absolute top-0 h-full w-3.5 -ml-1.5 cursor-col-resize flex items-center justify-center z-10 touch-none"
           style={{ left: `${selected[0].pct}%` }}>
        <div className={cn("w-0.5 h-3.5 rounded-full transition-colors",
                           dragging ? "bg-canvas-ink" : "bg-canvas-border-strong")} />
      </div>
    </div>
    <div className="h-3.5" /> {/* spacer: percentage labels are absolutely positioned below the bar */}
  </div>
)}
```

Single-selection hint: `Tap a second ethnicity to create a blend`, 10px ink-soft. The 2-ethnicity cap stands (audit C). Popover width 320. When `Mediterranean` lands in `ETHNICITIES` (parser prerequisite), the grid picks it up automatically — verify `ETH_COLORS` no longer matters post-redesign (it colored the bar; the bar is now monochrome, so the map and its coverage question die with it).

### 13.3 `SkinToneGrid` (color-data exception)

Six swatches keep their real tone colors, flat (`background: tone.base` — the `linear-gradient(base, shadow)` goes; `tone.shadow` becomes unused). Chunky borders and scale transforms go:

```tsx
className={cn(
  "h-9 rounded-canvas-md transition-all",
  isSelected
    ? "border border-canvas-ink ring-1 ring-canvas-ink ring-offset-1 ring-offset-canvas-surface"
    : "border-hairline border-canvas-border hover:border-canvas-border-strong"
)}
style={{ background: tone.base }}
```

### 13.4 `HairColorWheel` (color-data exception)

Wheel segments keep their real hair colors; geometry/SVG unchanged. Redesign around it: Dyed/Natural tabs → the studio underline-tab pattern (§6); Warm/Neutral/Cool → the strength-segmented-control pattern (§6.1); wheel container → `bg-canvas-surface-inset border-hairline border-canvas-border`; selected segment → 1.5px ink ring on its outer arc instead of drop shadow; center readout → `text-canvas-md font-medium` name + `text-canvas-xs ink-faint` tone qualifier; warm outer container deleted (popover provides surface). Fits at popover width 300.

### 13.5 `EyeGrid` (color-data exception)

15 iris swatches keep the radial gradient (`radial-gradient(circle at 35% 35%, hex, #333)`) — it's what makes a swatch read as an iris; **the only permitted gradient in the system**. The white highlight blur dot is removed (gratuitous). Borders/selection: same ring treatment as `SkinToneGrid`, circular (`rounded-full`, `aspect-square`, `grid-cols-5 gap-2`).

### 13.6 `BrandSelector` (extracted + redesigned in one step)

Extract from `ControlPanel.tsx:166–191` into `features/casting/components/BrandSelector.tsx`; drop the inline style blocks during extraction:

```tsx
export function BrandSelector({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {BRAND_OPTIONS.map((b) => {
        const sel = value === b.value;
        return (
          <button key={b.value} type="button" onClick={() => onChange(b.value)}
                  className={cn("rounded-canvas-md text-center transition-colors px-1 py-2",
                                sel ? "bg-canvas-surface-inset border border-canvas-ink"
                                    : "bg-canvas-surface border-hairline border-canvas-border hover:border-canvas-border-strong")}>
            <div className={cn("text-canvas-sm", sel ? "text-canvas-ink font-medium" : "text-canvas-ink-soft")}>{b.value}</div>
            <div className={cn("text-canvas-xs mt-0.5", sel ? "text-canvas-ink-soft" : "text-canvas-ink-faint")}>{b.desc}</div>
          </button>
        );
      })}
    </div>
  );
}
```

`ControlPanel` swaps its inline JSX for `<BrandSelector value={prefs.castingBrand} onChange={(v) => updatePref('castingBrand', v)} />`.

### 13.7 Utility primitives (`FieldLabel`, `ChipRow`, `OptionGrid`, `WarmSelectControl`, `CollapsibleSection`, `SummaryStrip`)

Token swaps per the mapping table (§13.9), plus:

- `FieldLabel`: `text-canvas-xs text-canvas-ink-soft mb-1.5`; the `ReqDot` stays a semantic warning → `bg-canvas-warning` (token added in §2).
- `ChipRow` / `OptionGrid`: standard chip pattern; "Reset to auto" (sentence case) with lucide `RotateCcw` replacing the inline SVG; "Guided by casting direction" in ink-faint.
- `WarmSelectControl`: replace the native `<select>` with shadcn `Select` (trigger: `h-9 bg-canvas-surface border-hairline border-canvas-border rounded-canvas-md text-canvas-sm shadow-none focus:ring-0 focus:border-canvas-ink`; content: `shadow-none border-hairline border-canvas-border-strong`). Renaming to `CanvasSelectControl` is optional (touches all import sites — defer).
- `CollapsibleSection`: **delete the `.toUpperCase()`** (the explicit anti-pattern violation) — title `text-canvas-sm font-medium text-canvas-ink-soft`, no letter-spacing; chevron → lucide `ChevronRight` rotating 90°; completion dots `w-1 h-1`, filled `bg-canvas-ink` / empty `bg-canvas-border`; header `hover:bg-canvas-surface-inset/50`; container `border-t-hairline border-canvas-border`.
- `SummaryStrip`: pill chips `bg-canvas-surface border-hairline border-canvas-border text-canvas-xs text-canvas-ink-soft`, strip `bg-canvas-surface-inset border-b-hairline`, no letter-spacing.

### 13.8 What is NOT touched

The hooks (`useCastingGeneration` — refactored for store-decoupling, not visuals — `useCastingViewGeneration`, `useCastingCanvas`, `useCastingExport`), `castingHelpers.tsx`, `constants.ts` data, `hairStyleConfig.ts`, all of `server/casting/`. **`ControlPanel.tsx` itself is not redesigned** — it lives in the `/studio` fallback (reachable only via `?tool=` URLs, audit N1) which is on a retirement path. The redesigned primitives will look flat inside its warm container; that dissonance is accepted. If it genuinely disturbs dogfooding, a `/studio`-scoped CSS token override is the ~1-hour mitigation — test before building it.

### 13.9 Token mapping reference

| Hardcoded value | Canvas replacement | Context |
|---|---|---|
| `#1a1a1a` | `var(--color-canvas-ink)` | text/bg/border |
| `#52524B`, `#71716A`, `#777168` | `var(--color-canvas-ink-soft)` | secondary text |
| `#999`, `#bbb`, `#d4d0c9`, `#d8d4ce` | `var(--color-canvas-ink-faint)` | tertiary/hints |
| `#ffffff` | `var(--color-canvas-surface)` | card bg |
| `#FAFAF8`, `rgba(0,0,0,0.04)` | `var(--color-canvas-surface-inset)` | hover/inset bg |
| `#E8E4DF`, `rgba(0,0,0,0.05–0.08)` | `var(--color-canvas-border)` | borders |
| `#C5BFB6`, `rgba(0,0,0,0.15)` | `var(--color-canvas-border-strong)` | hover borders/handles |
| all `box-shadow` values | removed (ring/border/bg swaps instead) | |
| `font-weight: 600/700` | `500` | |
| `letter-spacing`, `text-transform: uppercase`, `.toUpperCase()` | removed | |
| `borderRadius: 8/14`, `rounded-xl` | `var(--radius-canvas-md)` | |
| `linear-gradient(...)` on UI | removed | swatch data colors stay |
| `radial-gradient(circle at 35% 35%, hex, #333)` | **kept — EyeGrid only** | iris depth is data |

### 13.10 Effort

| Component | Estimate |
|---|---|
| `TriBlendSelector` | 2–3 h |
| `EthnicityBlender` | 1.5–2 h (blend bar) |
| `SkinToneGrid` / `EyeGrid` | 30 min each |
| `HairColorWheel` | 2–3 h |
| `BrandSelector` | 30 min (with extraction) |
| `CollapsibleSection` | 45 min |
| `WarmSelectControl` → shadcn Select | 1 h |
| `ChipRow`/`OptionGrid`/`SummaryStrip`/`FieldLabel` | 1 h combined |

**Total ≈ 1–1.5 focused days**, after tokens exist. Sequencing constraint: `canvas-tokens.css` + `border-hairline` must land first or none of the classes resolve.

---

## 14. Final reminders for implementation

1. **Read `CANVAS_FOUNDATIONS.md` first**; check `DECISION_LOG.md` for anything marked pending ratification before building it.
2. **Build §5 components in listed order** — each depends on the ones before it. Do not start `CastNode` until every primitive below it works.
3. **Use shadcn primitives**; the only custom primitives are §5's.
4. **Redesign the lifted casting components per §13 before composing them into popovers** — tokens first, redesign second, composition third.
5. **No canvas import of the three legacy casting stores.** Node config in metadata; `useGenerationJobs` is the only global store.
6. **No new tokens outside `canvas-tokens.css`; no arbitrary hex in components.**
7. **Every mutation through `boardOps`; every cost string from `plan()`.** No literal followed by "credits" in canvas code.
8. **One `CastNode`, branching on provenance. `RefinementStudio` props-only.**
9. **Views are separate nodes; five fixed canonical views; no view switchers; no custom poses.**
10. **Identity changes on a root with unpinned views always surface the three-option dialog. Rerun on a root always offers fork/recast.** Never silently regenerate; never silently orphan.
11. **`NodeStatusBadge` is the only status surface; `stale` + `error` in pass 1.** Extend, never fork.
12. **Zoom tiers come from one `useZoomTier()` source (§12)** — no scattered zoom conditionals.
13. **Empty states are specced (§11), not improvised.** A blank surface or dead-end popover is a bug.
14. **Preserve `/studio?tool=…` behavior and the existing `BoardCanvas` drag-fingerprint + imperative helpers.**
15. **Polish is a later pass** — ship the milestones in `PASS_1_BUILD_PLAN.md` before chasing micro-interactions.

---

**End of design system doc.** Ambiguities found while implementing are raised to the design lead before writing code that deviates.
