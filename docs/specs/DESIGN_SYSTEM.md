# Drape Canvas — Design System & Implementation Spec

**Audience:** engineering (including coding agents). This document is the visual and component spec for the canvas boards rebuild. Every component the user sees on `/app/board/:id` and in the refinement studio is specified here with design tokens, component code, states, and interaction behavior. Read `CANVAS_FOUNDATIONS.md` first for the architectural context that this doc implements.

**Conventions in this doc:**
- All code is TypeScript + React 19 + Tailwind v4 + shadcn/ui patterns.
- `cn` is imported from `@/lib/utils` (exists).
- Icons come from `lucide-react` (installed, v0.453.0).
- shadcn primitives (`Popover`, `Button`, `Tooltip`, `Input`, `ScrollArea`, `Tabs`) exist at `@/components/ui/*`. Use them; do not rebuild.
- Tailwind v4 uses `@theme` CSS blocks for tokens. New canvas tokens go in a new file `client/src/styles/canvas-tokens.css` imported from the main CSS entry.
- React Flow (`@xyflow/react` v12) is the canvas engine. Custom node types are registered via `nodeTypes` prop. Each node component receives `NodeProps<T>` from React Flow.

---

## 1. Design philosophy — the non-negotiables

Read these before writing any component. They are the same philosophy as ElevenLabs Flows, adapted for Drape.

1. **Seamless surfaces.** Every tool and every state is part of the same continuous visual language. No room feels like a dialog floating over another room. Transitions between canvas and refinement studio happen via a back button in the top bar, not overlays.
2. **Flat, never decorative.** No gradients. No drop shadows (except functional focus rings on inputs). No glow, no blur, no neon. Flat surfaces with hairline borders.
3. **Hairlines, not borders.** The default border weight is `0.5px`. Selected states upgrade to `1px` dark. Nothing heavier.
4. **Labels outside cards.** Node type and engine labels sit as tiny (10-11px) tertiary-gray text *above* the card, in the left and right top corners. They never go inside the card. This is the single biggest move that buys cleanliness.
5. **Controls below cards.** Type-specific metadata (view switcher, version count, aspect ratio, etc.) lives in a pill-style strip *below* the card, not inside it. Cards stay focused on their output.
6. **Monochrome with one dark accent.** Every commit/run/apply button is a dark pill (`bg-canvas-ink text-canvas-surface`). Every other button is ghost (transparent background, hairline border). No other colored buttons anywhere. The one exception is the teal "filled/ready" chip state.
7. **Sentence case everywhere.** Never Title Case. Never ALL CAPS. `Cast a model`, not `Cast A Model` or `CAST A MODEL`.
8. **Two font weights only:** 400 (regular) and 500 (medium/bold). Never 600, never 700.
9. **Dotted grid canvas background.** `radial-gradient` of tiny dots at 22px spacing. Not a solid color, not a lined grid.
10. **No modals, no scrims.** Popovers float; takeovers replace. If you find yourself reaching for a dimmed backdrop, you're solving the wrong problem.

---

## 2. Design tokens

Add to `client/src/styles/canvas-tokens.css`. Import from the main app CSS entry. Tailwind v4 picks these up via the `@theme` block.

```css
@theme {
  /* Canvas surfaces */
  --color-canvas-bg:            #FAFAFA;
  --color-canvas-surface:       #FFFFFF;
  --color-canvas-surface-inset: #F4F4F3;

  /* Canvas ink (text and primary accent) */
  --color-canvas-ink:        #0A0A0A;
  --color-canvas-ink-soft:   #5A5A58;
  --color-canvas-ink-faint:  #9B9B98;

  /* Canvas borders (hairline to strong) */
  --color-canvas-border:        #E8E8E6;
  --color-canvas-border-strong: #C7C7C4;

  /* Canvas filled state (teal — for "ready / parsed / complete") */
  --color-canvas-teal-bg:   #E1F5EE;
  --color-canvas-teal-text: #085041;

  /* Connection dot colors (input pin indicators on nodes) */
  --color-canvas-pin-prompt: #CECBF6;  /* purple — text / prompt input */
  --color-canvas-pin-image:  #B5D4F4;  /* blue — image / reference input */

  /* Canvas radii */
  --radius-canvas-sm: 6px;   /* chips, small buttons */
  --radius-canvas-md: 8px;   /* cards, inputs, most components */
  --radius-canvas-lg: 12px;  /* modals, large containers */
  --radius-canvas-pill: 9999px;

  /* Canvas typography scale */
  --text-canvas-xs:  10px;  /* labels outside cards, control strip segments */
  --text-canvas-sm:  11px;  /* tab labels, chip text, small button text */
  --text-canvas-md:  12px;  /* node title, prompt input, body text */
  --text-canvas-lg:  14px;  /* section headings in editor */
  --text-canvas-xl:  17px;  /* cost numbers, primary metric values */
}
```

After this file is imported, Tailwind v4 automatically generates utilities like `bg-canvas-surface`, `text-canvas-ink`, `border-canvas-border`, `rounded-canvas-md`, `text-canvas-sm`, etc.

### Spacing and layout

Use Tailwind's built-in spacing scale (`gap-1`, `gap-2`, `p-3`, `p-4`, etc.). No custom spacing tokens. Common values:
- Card internal padding: `px-3 py-2.5` (prompt row), `px-4 py-3` (editor rail sections)
- Chip padding: `px-2.5 py-1`
- Strip gap: `gap-1` between pill segments, `gap-1.5` between chips

### Dark mode

Not built in pass 1. The tokens above are light-mode values. When dark mode is added later, each token gets a dark variant inside `@media (prefers-color-scheme: dark)` or a `[data-theme="dark"]` selector. Components reference the token name; they don't need to change.

---

## 3. Anti-patterns — things Manus must not do

Explicit list because these are the mistakes coding agents typically make on UI:

- **Do not add drop shadows** except on focused inputs (`focus-visible:ring-2`). Not on cards, not on popovers, not on buttons, not on the node card.
- **Do not add gradients.** Never. Not even subtle ones.
- **Do not add decorative emoji or icon fonts.** Use `lucide-react` icons with explicit size props.
- **Do not use font weights 600 or 700.** Use 400 and 500 only. If a label needs emphasis, use 500.
- **Do not use Title Case or ALL CAPS.** Sentence case only. `Run refinement`, not `Run Refinement` or `RUN REFINEMENT`.
- **Do not use colored buttons except the dark primary pill and the teal filled chip.** No blue buttons, no red buttons, no green success buttons. Destructive actions confirm via dialog, they are not rendered in red.
- **Do not add borders heavier than 1px.** The default is `0.5px` (use `[border-width:0.5px]` arbitrary value or add a `border-hairline` utility class — see section 4). Selected state is `1px`. Nothing else.
- **Do not wrap the canvas or the refinement studio in a modal container with a dark backdrop.** They are rooms, not dialogs.
- **Do not introduce new colors outside the tokens in section 2.** If a component needs a new color, add it to the tokens file first.
- **Do not stack controls inside cards.** Type-specific metadata goes in the control strip *below* the card.
- **Do not use the `type` enum directly** on `board_items`. Use `kind` and read `metadata.provenance`. The old enum is a compatibility fallback only.
- **Do not hold node config in Zustand or React context.** Config lives in `board_items.metadata`. The only global store is `useGenerationJobs` for in-flight generation tracking.
- **Do not split `CastNode` into multiple components for root vs view.** Use a single `CastNode` component with conditional rendering and disabled states driven by `data.provenance.type === "cast_root" | "cast_view"`. Duplicating the component would double the maintenance surface and lose the guarantee that both variants stay visually consistent. See section 5.11 for the exact conditional logic.
- **Do not couple `RefinementStudio` to routing.** The component accepts `itemId` and `onClose` as props and must not import `wouter`, `useLocation`, or any router hooks. This is what keeps the full-screen-vs-modal decision reversible — `BoardPage` decides how to host it.
- **Do not put view switcher dropdowns inside cast nodes.** Views are separate nodes on the canvas in the pass 1 model. There is no `Headshot ▾` dropdown in the control strip. A root cast node's control strip reads `+ Views · vN · ···`; a view node's control strip reads `vN · ···`.
- **Do not render blender chips on view cast nodes.** Blender chips are identity-level controls. Identity lives on the root. View nodes that need identity edits route the user back to the root.
- **Do not build custom status indicators per node type.** Use the generalized `NodeStatusBadge` component (section 5.14) with the variant field. Pass 1 only implements the `stale` variant; future variants (`quality_flagged`, `needs_review`, `error`, `moderation`) reuse the same component.

---

## 4. Hairline border utility

Tailwind's `border` utility is `1px`. We need `0.5px` as the default, so add this utility to the CSS entry (or as an @layer in the canvas tokens file):

```css
@layer utilities {
  .border-hairline {
    border-width: 0.5px;
  }
  .border-b-hairline { border-bottom-width: 0.5px; }
  .border-t-hairline { border-top-width: 0.5px; }
  .border-l-hairline { border-left-width: 0.5px; }
  .border-r-hairline { border-right-width: 0.5px; }
}
```

Usage: `<div className="border-hairline border-canvas-border rounded-canvas-md">`. Every card, popover, strip, and chip in the canvas uses `border-hairline` as its default.

---

## 5. Component specifications

Each component below has: (a) what it does, (b) prop interface, (c) implementation code, (d) states. Code is ready to copy into files. Location paths are given for each.

### 5.1 `DottedGridBackground`

**Location:** `client/src/features/boards/canvas/DottedGridBackground.tsx`

Renders the canvas background. A single absolutely-positioned div with a CSS radial-gradient that tiles at 22px.

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

React Flow's own background is disabled; we render this instead.

---

### 5.2 `TopBar` and `BackButton`

**Location:** `client/src/features/boards/canvas/TopBar.tsx`

Single top bar used by BOTH the canvas and the refinement studio. Different state, same component. Breadcrumb on the left, utility items on the right.

```tsx
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TopBarProps {
  breadcrumb: Array<{ label: string; onClick?: () => void }>;
  title?: string;
  subtitle?: string;
  rightSlot?: React.ReactNode;
  backAction?: { label: string; onClick: () => void };
}

export function TopBar({ breadcrumb, title, subtitle, rightSlot, backAction }: TopBarProps) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b-hairline border-canvas-border bg-canvas-surface">
      <div className="flex items-center gap-3">
        {backAction && (
          <button
            type="button"
            onClick={backAction.onClick}
            className="flex items-center gap-1.5 px-2 py-1 rounded-canvas-sm text-canvas-ink-soft hover:bg-canvas-surface-inset transition-colors"
          >
            <ChevronLeft className="w-3 h-3" strokeWidth={1.6} />
            <span className="text-canvas-sm">{backAction.label}</span>
          </button>
        )}
        {breadcrumb.map((crumb, i) => (
          <span key={i} className="flex items-center gap-2">
            {i > 0 && <span className="text-canvas-xs text-canvas-ink-faint">·</span>}
            <button
              type="button"
              onClick={crumb.onClick}
              className={cn(
                "text-canvas-sm text-canvas-ink-soft",
                crumb.onClick && "hover:text-canvas-ink transition-colors"
              )}
            >
              {crumb.label}
            </button>
          </span>
        ))}
        {title && (
          <>
            <span className="text-canvas-xs text-canvas-ink-faint">·</span>
            <span className="text-canvas-md font-medium text-canvas-ink">{title}</span>
          </>
        )}
        {subtitle && (
          <span className="text-canvas-xs text-canvas-ink-faint">{subtitle}</span>
        )}
      </div>
      <div className="flex items-center gap-3.5">{rightSlot}</div>
    </div>
  );
}
```

**Canvas usage:**
```tsx
<TopBar
  breadcrumb={[
    { label: "Boards", onClick: () => navigate("/app") },
    { label: board.name },
  ]}
  rightSlot={
    <>
      <span className="text-canvas-xs text-canvas-ink-faint">{zoomPct}%</span>
      <span className="text-canvas-xs text-canvas-ink-faint">Share</span>
      <UserAvatar />
    </>
  }
/>
```

**Refinement studio usage:**
```tsx
<TopBar
  backAction={{ label: "Boards", onClick: () => closeStudio() }}
  breadcrumb={[{ label: "Cast" }]}
  title="Maya R."
  subtitle={`v${version} · saved ${relativeTime}`}
  rightSlot={
    <>
      <span className="text-canvas-xs text-canvas-ink-faint">{viewsDone} of 5 views</span>
      <span className="text-canvas-xs text-canvas-ink-faint">esc</span>
    </>
  }
/>
```

---

### 5.3 `FloatingToolPill`

**Location:** `client/src/features/boards/canvas/FloatingToolPill.tsx`

The bottom-center pill that holds the add-node menu and tool switcher. Always visible on the canvas, never on the refinement studio.

```tsx
import { Plus, MousePointer2, Type, Square, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FloatingToolPillProps {
  activeTool: "add" | "select" | "note" | "frame";
  onSelectTool: (tool: "add" | "select" | "note" | "frame") => void;
  onMore?: () => void;
}

export function FloatingToolPill({ activeTool, onSelectTool, onMore }: FloatingToolPillProps) {
  return (
    <div
      className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-0.5 p-1 bg-canvas-surface border-hairline border-canvas-border-strong rounded-canvas-pill"
    >
      <ToolButton active={activeTool === "add"} onClick={() => onSelectTool("add")} label="Add">
        <Plus className="w-3 h-3" strokeWidth={1.8} />
      </ToolButton>
      <ToolButton active={activeTool === "select"} onClick={() => onSelectTool("select")} label="Select">
        <MousePointer2 className="w-3 h-3" strokeWidth={1.6} />
      </ToolButton>
      <ToolButton active={activeTool === "frame"} onClick={() => onSelectTool("frame")} label="Frame">
        <Square className="w-3 h-3" strokeWidth={1.6} />
      </ToolButton>
      <ToolButton active={activeTool === "note"} onClick={() => onSelectTool("note")} label="Note">
        <Type className="w-3 h-3" strokeWidth={1.6} />
      </ToolButton>
      <span className="w-px h-3.5 bg-canvas-border mx-1" aria-hidden />
      <ToolButton onClick={onMore} label="More">
        <MoreHorizontal className="w-3 h-3" strokeWidth={1.6} />
      </ToolButton>
    </div>
  );
}

function ToolButton({
  children,
  active,
  onClick,
  label,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        "w-7 h-7 rounded-full flex items-center justify-center transition-colors",
        active
          ? "bg-canvas-ink text-canvas-surface"
          : "text-canvas-ink-soft hover:bg-canvas-surface-inset"
      )}
    >
      {children}
    </button>
  );
}
```

The "Add" button is the primary action — it opens a small dropdown menu listing node types (`Cast`, `Wardrobe`, `Image`, `Reference`, `Note`, `Frame`). Use shadcn `DropdownMenu` for this. The dropdown is triggered by Add, positioned above the pill.

---

### 5.4 `ConnectionDot`

**Location:** `client/src/features/boards/canvas/ConnectionDot.tsx`

The tiny colored circles on the left edge of every node card indicating input types. Also serves as React Flow connection handles.

```tsx
import { Handle, Position } from "@xyflow/react";
import { cn } from "@/lib/utils";

export interface ConnectionDotProps {
  kind: "prompt" | "image";
  id: string;
  top: number; // pixel offset from card top
}

export function ConnectionDot({ kind, id, top }: ConnectionDotProps) {
  return (
    <Handle
      type="target"
      position={Position.Left}
      id={id}
      style={{
        top,
        left: -5,
        width: 10,
        height: 10,
        background: kind === "prompt" ? "var(--color-canvas-pin-prompt)" : "var(--color-canvas-pin-image)",
        border: "1.5px solid var(--color-canvas-surface)",
        borderRadius: "50%",
      }}
      className="!transform-none"
    />
  );
}
```

A cast node has two handles: `prompt` (purple) at top 22px, `image` (blue) at top 40px. An image-gen node has one `prompt` handle. Wardrobe garment nodes have zero — they accept uploads, not connections.

---

### 5.5 `NodeLabelRow`

**Location:** `client/src/features/boards/canvas/NodeLabelRow.tsx`

The tiny label row *outside* and *above* the card. Type/title on the left, engine on the right. 10px tertiary gray.

```tsx
export interface NodeLabelRowProps {
  type: string;       // "Cast · Maya R." or "Image"
  engine?: string;    // "Gemini 2.5"
}

export function NodeLabelRow({ type, engine }: NodeLabelRowProps) {
  return (
    <div className="flex justify-between items-center px-0.5 pb-1.5">
      <span className="text-canvas-xs text-canvas-ink-faint">{type}</span>
      {engine && <span className="text-canvas-xs text-canvas-ink-faint">{engine}</span>}
    </div>
  );
}
```

When a node is selected, the type label upgrades its color to `text-canvas-ink-soft` (slightly darker). Controlled via parent passing `selected`:

```tsx
<div className={cn("text-canvas-xs", selected ? "text-canvas-ink-soft" : "text-canvas-ink-faint")}>
```

---

### 5.6 `CanvasNodeShell`

**Location:** `client/src/features/boards/canvas/CanvasNodeShell.tsx`

The generic white card that every node type composes. Handles the selection border state. All node-type components wrap their content in this.

```tsx
import { cn } from "@/lib/utils";

export interface CanvasNodeShellProps {
  selected?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function CanvasNodeShell({ selected, children, className }: CanvasNodeShellProps) {
  return (
    <div
      className={cn(
        "relative bg-canvas-surface rounded-canvas-md overflow-hidden transition-[border-color,border-width]",
        selected
          ? "border border-canvas-ink"
          : "border-hairline border-canvas-border",
        className
      )}
    >
      {children}
    </div>
  );
}
```

**States:**
- Default: `border-hairline border-canvas-border`
- Selected: `border border-canvas-ink` (1px dark)
- Generating: parent component adds a progress indicator inside; shell stays in whichever border state matches selection.

Do not add hover states on the shell itself — hover is handled by React Flow and the chrome components (toolbar, strips).

---

### 5.7 `NodeInlinePrompt`

**Location:** `client/src/features/boards/canvas/NodeInlinePrompt.tsx`

The prompt input row at the bottom of the card. Single-line text input that expands on focus. `Run` button on the right that becomes `Running` during generation and `Edit` after completion.

```tsx
import { cn } from "@/lib/utils";
import { useRef, useEffect } from "react";

export type NodePromptState = "empty" | "ready" | "generating" | "complete";

export interface NodeInlinePromptProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  state: NodePromptState;
  placeholder?: string;
}

export function NodeInlinePrompt({
  value,
  onChange,
  onSubmit,
  state,
  placeholder = "Describe your model...",
}: NodeInlinePromptProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && state !== "generating") {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <div className="flex items-center justify-between gap-2.5 px-3 py-2.5 border-t-hairline border-canvas-border">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKey}
        placeholder={placeholder}
        disabled={state === "generating"}
        className="flex-1 min-w-0 bg-transparent text-canvas-md text-canvas-ink placeholder:text-canvas-ink-faint focus:outline-none truncate"
      />
      <RunButton state={state} onClick={onSubmit} />
    </div>
  );
}

function RunButton({ state, onClick }: { state: NodePromptState; onClick: () => void }) {
  const label =
    state === "generating" ? "Running" : state === "complete" ? "Edit" : "Run";
  const disabled = state === "generating";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "px-2.5 py-1 rounded-canvas-pill text-canvas-xs font-medium transition-colors shrink-0",
        disabled
          ? "bg-canvas-surface-inset text-canvas-ink-faint border-hairline border-canvas-border"
          : "bg-canvas-ink text-canvas-surface hover:opacity-90"
      )}
    >
      {label}
    </button>
  );
}
```

**Behavior:**
- `empty`: placeholder shown, Run button dark and active (pressing Run with empty input flashes the input border red briefly — see animation section).
- `ready`: value present, Run active.
- `generating`: input disabled (shows last submitted value), button reads "Running", button style is ghost.
- `complete`: button reads "Edit", clicking it navigates to refinement studio for this node (not re-running the prompt).

---

### 5.8 `NodeControlStrip`

**Location:** `client/src/features/boards/canvas/NodeControlStrip.tsx`

The pill-style strip below the card that shows type-specific metadata. Only visible on the selected node. Each segment is a small button (for interactive segments like the view switcher) or a plain label (for informational segments like version count).

```tsx
import { cn } from "@/lib/utils";
import { ChevronDown, MoreHorizontal } from "lucide-react";

export interface ControlSegment {
  kind: "label" | "dropdown" | "action";
  content: string;
  icon?: "chevron" | "more";
  onClick?: () => void;
  active?: boolean;
}

export interface NodeControlStripProps {
  segments: ControlSegment[];
}

export function NodeControlStrip({ segments }: NodeControlStripProps) {
  return (
    <div className="mt-2 inline-flex items-center p-0.5 bg-canvas-surface border-hairline border-canvas-border-strong rounded-canvas-md">
      {segments.map((seg, i) => (
        <SegmentView key={i} segment={seg} showDivider={i > 0} />
      ))}
    </div>
  );
}

function SegmentView({ segment, showDivider }: { segment: ControlSegment; showDivider: boolean }) {
  const classes = cn(
    "px-2.5 py-1 text-canvas-xs flex items-center gap-1 rounded-[5px] transition-colors",
    segment.active
      ? "bg-canvas-surface-inset text-canvas-ink font-medium"
      : "text-canvas-ink-soft",
    (segment.kind === "dropdown" || segment.kind === "action") && "hover:bg-canvas-surface-inset cursor-pointer"
  );

  const content = (
    <>
      {segment.content}
      {segment.icon === "chevron" && <ChevronDown className="w-2.5 h-2.5 opacity-60" strokeWidth={1.6} />}
      {segment.icon === "more" && <MoreHorizontal className="w-2.5 h-2.5 opacity-60" strokeWidth={1.6} />}
    </>
  );

  return (
    <>
      {showDivider && <span className="w-px h-2.5 bg-canvas-border" aria-hidden />}
      {segment.kind === "label" ? (
        <span className={classes}>{content}</span>
      ) : (
        <button type="button" onClick={segment.onClick} className={classes}>
          {content}
        </button>
      )}
    </>
  );
}
```

**Example usage for a cast node:**
```tsx
<NodeControlStrip
  segments={[
    { kind: "dropdown", content: "Headshot", icon: "chevron", onClick: openViewSwitcher },
    { kind: "label", content: `${viewsDone} of 5 views` },
    { kind: "action", content: "+ Views", onClick: openViewsPopover, active: viewsPopoverOpen },
    { kind: "label", content: `v${version}` },
    { kind: "action", content: "···", icon: "more", onClick: openMoreMenu },
  ]}
/>
```

---

### 5.9 `BlenderChipStrip` and `BlenderChip`

**Location:** `client/src/features/boards/canvas/BlenderChipStrip.tsx`

The strip of five expressive-control chips below the control strip. Only visible on selected cast nodes. Each chip is a button that opens its tactile component in a popover.

```tsx
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";

export interface BlenderChipProps {
  label: string;
  value: string | null; // null when unfilled — chip renders in ghost/empty state
  active?: boolean;
  onOpenChange: (open: boolean) => void;
  popoverContent: React.ReactNode;
  popoverWidth?: number;
}

export function BlenderChip({
  label,
  value,
  active,
  onOpenChange,
  popoverContent,
  popoverWidth = 280,
}: BlenderChipProps) {
  const isFilled = value !== null;

  return (
    <Popover onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex items-center gap-1 px-2.5 py-1 rounded-canvas-md text-canvas-xs transition-colors",
            active && "bg-canvas-surface-inset border border-canvas-ink text-canvas-ink font-medium",
            !active && isFilled && "border-hairline bg-canvas-surface border-canvas-border text-canvas-ink-soft hover:border-canvas-border-strong",
            !active && !isFilled && "border-hairline border-dashed bg-transparent border-canvas-border-strong text-canvas-ink-faint hover:text-canvas-ink-soft hover:border-canvas-ink-soft"
          )}
        >
          <span>{isFilled ? `${label} · ${value}` : `+ ${label}`}</span>
          {isFilled && <ChevronDown className="w-2 h-2 opacity-60" strokeWidth={1.8} />}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="right"
        align="start"
        sideOffset={12}
        style={{ width: popoverWidth }}
        className="p-4 bg-canvas-surface border-hairline border-canvas-border-strong rounded-canvas-md shadow-none"
      >
        {popoverContent}
      </PopoverContent>
    </Popover>
  );
}

export interface BlenderChipStripProps {
  chips: Array<{
    id: "brand" | "vibe" | "ethnicity" | "skin" | "hair";
    label: string;
    value: string | null; // null = unfilled ghost state
    popoverContent: React.ReactNode;
    popoverWidth?: number;
  }>;
  activeChipId: string | null;
  onActiveChange: (id: string | null) => void;
}

export function BlenderChipStrip({ chips, activeChipId, onActiveChange }: BlenderChipStripProps) {
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {chips.map((chip) => (
        <BlenderChip
          key={chip.id}
          label={chip.label}
          value={chip.value}
          active={activeChipId === chip.id}
          onOpenChange={(open) => onActiveChange(open ? chip.id : null)}
          popoverContent={chip.popoverContent}
          popoverWidth={chip.popoverWidth}
        />
      ))}
    </div>
  );
}
```

**IMPORTANT for shadcn Popover:** the default shadcn Popover has a drop shadow. Override with `shadow-none` as shown above. The `bg-canvas-surface border-hairline border-canvas-border-strong` overrides its default background and border to match the canvas language.

**Chip visual states:**
- **Ghost (unfilled)**: dashed hairline border, transparent background, `+ Brand` style label in faint ink, no chevron. Used on freshly-dropped empty cast nodes.
- **Filled**: solid hairline border, surface background, `Brand · Editorial` style label with chevron. Used on casts where the attribute has been set either by the user or by the LLM parser.
- **Active (popover open)**: solid 1px dark border, surface-inset background, medium weight text. Used while the user is interacting with the popover anchored to this chip. Applies to both filled and ghost chips.

**The five chips for a cast root node** (always these five, always in this order; `cast_view` nodes do not render chips at all):

```tsx
// From useCastNodeController, when provenance.type === "cast_root":
const blenderChips = [
  { id: "brand",     label: "Brand",     value: attrs.brand ?? null,                    popoverContent: <BrandSelectorPopover ... /> },
  { id: "vibe",      label: "Vibe",      value: attrs.vibe ? formatVibe(attrs.vibe) : null,                popoverContent: <VibeBlenderPopover ... /> },
  { id: "ethnicity", label: "Ethnicity", value: attrs.ethnicityBlend?.length ? formatEthnicity(attrs.ethnicityBlend) : null, popoverContent: <EthnicityBlenderPopover ... /> },
  { id: "skin",      label: "Skin",      value: attrs.skin ?? null,                     popoverContent: <SkinTonePopover ... /> },
  { id: "hair",      label: "Hair",      value: attrs.hairColor ?? null,                popoverContent: <HairColorPopover ... /> },
];
```

Helper formatters:
- `formatVibe({commercial, editorial, runway})` returns `"55 / 25 / 20"` — sorted by value descending, just three numbers.
- `formatEthnicity(blend)` returns `"Brazilian"` for a single-value blend, or `"Brazilian + Japanese"` for a two-value blend, or `"3 mixed"` for three+.

---

### 5.10 `NodeFloatingToolbar` (the Luma-style on-selection toolbar)

**Location:** `client/src/features/boards/canvas/NodeFloatingToolbar.tsx`

The small pill that floats above a selected node with six icon actions. Not visible unless the node is selected. Uses absolute positioning with negative top offset so it doesn't affect React Flow's measured node height.

```tsx
import { cn } from "@/lib/utils";
import { RefreshCw, Shuffle, Copy, Download, Trash2, Info } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";

export interface NodeToolbarAction {
  id: "rerun" | "variations" | "duplicate" | "download" | "delete" | "info";
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

export interface NodeFloatingToolbarProps {
  actions: NodeToolbarAction[];
}

const ICONS: Record<NodeToolbarAction["id"], React.ComponentType<{ className?: string; strokeWidth?: number }>> = {
  rerun: RefreshCw,
  variations: Shuffle,
  duplicate: Copy,
  download: Download,
  delete: Trash2,
  info: Info,
};

export function NodeFloatingToolbar({ actions }: NodeFloatingToolbarProps) {
  return (
    <TooltipProvider delayDuration={300}>
      <div
        className="absolute left-1/2 -translate-x-1/2 -top-9 flex items-center gap-0.5 p-0.5 bg-canvas-surface border-hairline border-canvas-border-strong rounded-canvas-pill"
        onMouseDown={(e) => e.stopPropagation()} // prevent React Flow from starting a drag
      >
        {actions.map((action) => {
          const Icon = ICONS[action.id];
          return (
            <Tooltip key={action.id}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={action.onClick}
                  disabled={action.disabled}
                  aria-label={action.label}
                  className={cn(
                    "w-7 h-7 rounded-full flex items-center justify-center transition-colors",
                    "text-canvas-ink-soft hover:bg-canvas-surface-inset hover:text-canvas-ink",
                    action.disabled && "opacity-40 pointer-events-none"
                  )}
                >
                  <Icon className="w-3 h-3" strokeWidth={1.6} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-canvas-xs bg-canvas-ink text-canvas-surface border-none shadow-none px-2 py-1 rounded-canvas-sm">
                {action.label}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
```

**Standard action set for a cast node:**
```tsx
const actions: NodeToolbarAction[] = [
  { id: "rerun",      label: "Rerun",      onClick: handleRerun },
  { id: "variations", label: "Variations", onClick: handleVariations },
  { id: "duplicate",  label: "Duplicate",  onClick: handleDuplicate },
  { id: "download",   label: "Download",   onClick: handleDownload, disabled: !hasImage },
  { id: "delete",     label: "Delete",     onClick: handleDelete },
  { id: "info",       label: "Info",       onClick: handleInfo },
];
```

---

### 5.11 Putting it together: `CastNode` (React Flow custom node)

**Location:** `client/src/features/boards/canvas/nodes/CastNode.tsx`

This is the single React Flow node type for all casts — both `cast_root` and `cast_view` provenance types render through this one component. Do not split it. Conditional logic branches on `data.provenance.type`.

```tsx
import { NodeProps } from "@xyflow/react";
import { CanvasNodeShell } from "../CanvasNodeShell";
import { NodeLabelRow } from "../NodeLabelRow";
import { ConnectionDot } from "../ConnectionDot";
import { NodeInlinePrompt } from "../NodeInlinePrompt";
import { NodeControlStrip } from "../NodeControlStrip";
import { BlenderChipStrip } from "../BlenderChipStrip";
import { NodeFloatingToolbar } from "../NodeFloatingToolbar";
import { NodeStatusBadge } from "../NodeStatusBadge";
import { CastImageArea } from "./CastImageArea";
import { useCastNodeController } from "./useCastNodeController";

export interface CastRootProvenance {
  type: "cast_root";
  modelId: number;
  viewAngle: "frontClose";
  attributes: CastAttributes;
}

export interface CastViewProvenance {
  type: "cast_view";
  modelId: number;
  rootItemId: number;
  viewAngle: "frontClose" | "frontFull" | "sideClose" | "sideFull" | "backFull";
  attributes: CastAttributes; // inherited from root, read-only on view nodes
}

export interface CastNodeData {
  itemId: number;
  provenance: CastRootProvenance | CastViewProvenance;
  modelName?: string;
  imageUrl: string | null;
  prompt: string;
  engine: string;
  version: number;
  status?: NodeStatus; // optional status (e.g. stale), drives NodeStatusBadge
  isEmpty: boolean;    // true when no generation has been run yet (root only)
}

const VIEW_ANGLE_LABEL: Record<string, string> = {
  frontClose: "Headshot",
  frontFull:  "Full front",
  sideClose:  "Side close",
  sideFull:   "Side full",
  backFull:   "Back full",
};

export function CastNode({ data, selected }: NodeProps<CastNodeData>) {
  const controller = useCastNodeController(data);
  const { promptState, controlSegments, blenderChips, toolbarActions } = controller;

  const isRoot = data.provenance.type === "cast_root";
  const isEmpty = isRoot && data.isEmpty;

  // Type label: root = "Cast · Maya R.", view = "Cast · Maya R. · Full front"
  const baseLabel = data.modelName ? `Cast · ${data.modelName}` : "Cast";
  const viewLabel = !isRoot ? VIEW_ANGLE_LABEL[data.provenance.viewAngle] : null;
  const typeLabel = viewLabel ? `${baseLabel} · ${viewLabel}` : baseLabel;

  // Width: root is 260, view is 200 (smaller because less chrome)
  const width = isRoot ? 260 : 200;

  return (
    <div className="relative" style={{ width }}>
      {/* Floating toolbar: only visible when selected and the node has an output.
          Root gets 6 icons; view gets 4 effective (Variations + Duplicate disabled). */}
      {selected && !isEmpty && <NodeFloatingToolbar actions={toolbarActions} />}

      <NodeLabelRow type={typeLabel} engine={data.engine} />

      <CanvasNodeShell selected={selected}>
        {/* Connection dots: root has 2 (prompt + image), view has 1 (prompt only).
            View nodes inherit identity from the root via the generated_from_cast edge
            and do not take image references directly. */}
        <ConnectionDot kind="prompt" id="prompt-in" top={22} />
        {isRoot && <ConnectionDot kind="image" id="ref-in" top={40} />}

        {/* Status badge: corner-anchored, only rendered when status is set.
            Currently only "stale" is wired up; the component handles the rest. */}
        {data.status && (
          <NodeStatusBadge
            status={data.status}
            onRefresh={controller.refreshFromStatus}
            onDismiss={controller.dismissStatus}
          />
        )}

        <CastImageArea
          imageUrl={data.imageUrl}
          promptState={promptState}
          // Desaturate the image as a secondary cue when stale
          dimmed={data.status?.type === "stale"}
        />

        <NodeInlinePrompt
          value={controller.promptValue}
          onChange={controller.setPromptValue}
          onSubmit={controller.runOrEdit}
          state={promptState}
          placeholder={isRoot ? "Describe your model..." : "Pose..."}
        />
      </CanvasNodeShell>

      {/* Chrome that only appears on selected nodes. Empty roots skip the
          control strip (nothing to show yet) but DO show the blender chip strip
          in its ghosted state. */}
      {selected && (
        <>
          {!isEmpty && <NodeControlStrip segments={controlSegments} />}
          {isRoot && (
            <BlenderChipStrip
              chips={blenderChips}
              activeChipId={controller.activeChipId}
              onActiveChange={controller.setActiveChipId}
            />
          )}
        </>
      )}
    </div>
  );
}
```

**State reference for `useCastNodeController`.** The hook returns the following shape based on `data.provenance.type` and whether the node is empty/complete/generating. Manus should treat this as the contract; the exact internals can vary:

```ts
interface CastNodeControllerResult {
  // Prompt input state
  promptValue: string;
  setPromptValue: (v: string) => void;
  promptState: "empty" | "ready" | "generating" | "complete";
  runOrEdit: () => void; // Run if empty/ready, navigate to editor if complete

  // Control strip segments — depends on node type and state
  // Root complete:  [{kind:"action",content:"+ Views",onClick,active?}, {kind:"label",content:"vN"}, {kind:"action",content:"···",icon:"more"}]
  // View complete:  [{kind:"label",content:"vN"}, {kind:"action",content:"···",icon:"more"}]
  // Empty root: controlSegments is empty (caller checks data.isEmpty and skips rendering)
  controlSegments: ControlSegment[];

  // Blender chips — ONLY for cast_root.
  // Empty root: all five chips ghost/placeholder state (no filled values, Apply & run disables Run if combined with empty prompt)
  // Complete root: five chips filled with the current attribute values
  // For cast_view: the hook returns [] and CastNode doesn't render the strip at all
  blenderChips: BlenderChipProps[];
  activeChipId: string | null;
  setActiveChipId: (id: string | null) => void;

  // Floating toolbar actions — six for root, four active for view (Variations + Duplicate disabled)
  toolbarActions: NodeToolbarAction[];

  // Status badge callbacks
  refreshFromStatus: () => void; // e.g. regenerate stale view
  dismissStatus: () => void;     // "Keep old" action
}
```

**Empty state vs completed state behavior on the root.** The visual difference is:

- **Empty + selected root**: The image area shows the "Cast a model" placeholder (person icon + text). The inline prompt field is focused automatically, placeholder `Describe your model...`. The Run button is in ghosted/disabled state. The blender chip strip is visible with all five chips in their ghost state (dashed border, `+ Brand` etc.). The control strip is not rendered (nothing to show yet). The floating toolbar is not rendered (no output to manipulate). Run enables the moment either `promptValue.trim().length > 0` or any chip transitions to filled state.
- **Complete + selected root**: The image area shows the generated image. The inline prompt field is read-only display of the submitted prompt. The Run button reads "Edit" and navigates to the refinement studio. The blender chip strip shows all five chips in filled state. The control strip is visible with `+ Views · vN · ···`. The floating toolbar is visible with all six icons active.
- **Complete + selected view**: The image area shows the generated view image. The inline prompt field is optional pose direction (placeholder `Pose...`). The Run button reads "Edit" and navigates to the refinement studio. NO blender chip strip. The control strip is visible with `vN · ···`. The floating toolbar shows six icons but Variations and Duplicate are disabled with tooltips `Not available on view nodes`.

`useCastNodeController` is the hook that binds this node to `boardOps`, `useGenerationJobs`, and tRPC mutations. It is where all the "what happens when the user clicks X" logic lives. It returns a stable interface for the component to render. Keep the component file thin — all branching and mutation plumbing belongs in the hook.

---

### 5.11a Disabled toolbar actions on view nodes

When building the `toolbarActions` list for a `cast_view` node, Variations and Duplicate must be present in the list but flagged disabled. Do not hide them — keeping them visible-but-disabled preserves the predictable 6-icon toolbar shape across node types while communicating clearly that the action doesn't apply here.

```ts
// Inside useCastNodeController, for cast_view:
const toolbarActions: NodeToolbarAction[] = [
  { id: "rerun",      label: "Rerun",                                    onClick: handleRerun },
  { id: "variations", label: "Not available on view nodes",              onClick: () => {}, disabled: true },
  { id: "duplicate",  label: "Not available on view nodes",              onClick: () => {}, disabled: true },
  { id: "download",   label: "Download",                                 onClick: handleDownload, disabled: !hasImage },
  { id: "delete",     label: "Delete",                                   onClick: handleDelete },
  { id: "info",       label: "Info",                                     onClick: handleInfo },
];
```

The `NodeFloatingToolbar` component (section 5.10) already renders disabled buttons with `opacity-40 pointer-events-none` and shows the tooltip content on hover — no changes needed to that component.

---

### 5.12 `CastImageArea`

**Location:** `client/src/features/boards/canvas/nodes/CastImageArea.tsx`

The image-or-placeholder area inside the cast node card. Four states: empty (placeholder with "Cast a model" text and person icon), generating (progress bar + timer), complete (image), errored (error state with retry hint).

```tsx
import { User } from "lucide-react";
import { cn } from "@/lib/utils";
import { NodePromptState } from "../NodeInlinePrompt";

export interface CastImageAreaProps {
  imageUrl: string | null;
  promptState: NodePromptState;
  progressSeconds?: number;
  dimmed?: boolean; // true when node status is "stale" — desaturates the image
}

export function CastImageArea({ imageUrl, promptState, progressSeconds, dimmed }: CastImageAreaProps) {
  return (
    <div className="h-[140px] bg-canvas-surface-inset flex flex-col items-center justify-center text-canvas-ink-faint">
      {promptState === "empty" && (
        <>
          <User className="w-5 h-5 opacity-50" strokeWidth={1.2} />
          <span className="text-canvas-xs mt-1.5">Cast a model</span>
        </>
      )}
      {promptState === "generating" && (
        <>
          <div className="w-[72%] h-[3px] bg-canvas-surface rounded-full overflow-hidden">
            <div
              className="h-full bg-canvas-ink opacity-45"
              style={{ width: "58%", transition: "width 0.3s linear" }}
            />
          </div>
          <span className="text-canvas-xs mt-2">Generating · {progressSeconds ?? 0}s</span>
        </>
      )}
      {promptState === "complete" && imageUrl && (
        <img
          src={imageUrl}
          alt=""
          className={cn("w-full h-full object-cover transition-opacity", dimmed && "opacity-70")}
        />
      )}
    </div>
  );
}
```

For the progress bar, the real implementation should animate `width` based on estimated job duration from `useGenerationJobs`. The `58%` above is a placeholder.

---

### 5.13 `CanvasPopover` primitive

Do not build a custom popover. Use shadcn's `Popover` with consistent styling overrides. Wrap once:

**Location:** `client/src/features/boards/canvas/CanvasPopover.tsx`

```tsx
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export { Popover, PopoverTrigger };

export function CanvasPopoverContent({
  className,
  ...props
}: React.ComponentProps<typeof PopoverContent>) {
  return (
    <PopoverContent
      sideOffset={12}
      className={cn(
        "bg-canvas-surface border-hairline border-canvas-border-strong rounded-canvas-md shadow-none p-4",
        className
      )}
      {...props}
    />
  );
}
```

Use `CanvasPopoverContent` for every popover in the canvas (blender chips, view generation, more menus). It enforces the no-shadow, hairline-border, canvas-surface styling.

---

### 5.14 `NodeStatusBadge` — the generalized node status indicator

**Location:** `client/src/features/boards/canvas/NodeStatusBadge.tsx`

A single component that handles all node-level status indicators on the canvas. Pass 1 only implements the `stale` variant but the component is built to accommodate future variants (`quality_flagged`, `needs_review`, `error`, `moderation`) without structural changes. When a new variant is needed, add a case to the switch statement inside the component — do not build a second badge component.

The badge sits in the top-right corner of the image area of any node that has a non-null `status` field in its metadata. On hover, a floating status card appears anchored to the badge with a status-specific message and action buttons. The card uses shadcn's `HoverCard` primitive (already in the component inventory), restyled to match the canvas language.

```tsx
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import { AlertCircle, AlertTriangle, Eye, XCircle, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

export type NodeStatus =
  | { type: "stale"; message: string; context?: { causedByItemId?: number; oldValues?: Record<string, unknown>; newValues?: Record<string, unknown> } }
  | { type: "quality_flagged"; message: string; context?: { flaggedBy?: string; issues?: string[] } }
  | { type: "needs_review"; message: string; context?: { requestedBy?: string } }
  | { type: "error"; message: string; context?: { errorCode?: string } }
  | { type: "moderation"; message: string; context?: { caseId?: number } };

export interface NodeStatusBadgeProps {
  status: NodeStatus;
  onRefresh?: () => void;   // Primary action (Refresh / Regenerate / Approve / Retry — varies by variant)
  onDismiss?: () => void;   // Secondary action (Keep old / Dismiss / Reject / Delete — varies by variant)
}

interface VariantConfig {
  Icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  primaryLabel: string;
  secondaryLabel: string;
}

const VARIANT_CONFIG: Record<NodeStatus["type"], VariantConfig> = {
  stale:           { Icon: AlertCircle,   title: "Out of sync",  primaryLabel: "Refresh",    secondaryLabel: "Keep old" },
  quality_flagged: { Icon: AlertTriangle, title: "Quality flag", primaryLabel: "Regenerate", secondaryLabel: "Accept anyway" },
  needs_review:    { Icon: Eye,           title: "Needs review", primaryLabel: "Approve",    secondaryLabel: "Reject" },
  error:           { Icon: XCircle,       title: "Error",        primaryLabel: "Retry",      secondaryLabel: "Delete" },
  moderation:      { Icon: Shield,        title: "Under review", primaryLabel: "Open case",  secondaryLabel: "Dismiss" },
};

export function NodeStatusBadge({ status, onRefresh, onDismiss }: NodeStatusBadgeProps) {
  const config = VARIANT_CONFIG[status.type];
  const { Icon } = config;

  return (
    <HoverCard openDelay={100} closeDelay={150}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          aria-label={config.title}
          className="absolute top-2 right-2 z-10 w-[22px] h-[22px] rounded-full bg-canvas-surface border-hairline border-canvas-border-strong flex items-center justify-center text-canvas-ink hover:border-canvas-ink transition-colors"
          onMouseDown={(e) => e.stopPropagation()} // prevent React Flow drag
        >
          <Icon className="w-[11px] h-[11px]" strokeWidth={1.5} />
        </button>
      </HoverCardTrigger>
      <HoverCardContent
        side="right"
        align="start"
        sideOffset={8}
        className="w-[250px] p-3.5 bg-canvas-surface border-hairline border-canvas-border-strong rounded-canvas-md shadow-none"
      >
        <div className="flex items-center gap-1.5 mb-1.5">
          <Icon className="w-3 h-3 text-canvas-ink" strokeWidth={1.5} />
          <span className="text-canvas-sm font-medium text-canvas-ink">{config.title}</span>
          {status.type === "needs_review" && status.context?.requestedBy && (
            <span className="text-canvas-xs text-canvas-ink-faint">@{status.context.requestedBy}</span>
          )}
        </div>
        <div className="text-canvas-sm text-canvas-ink-soft leading-relaxed mb-3">
          {status.message}
        </div>
        <div className="flex gap-1.5">
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className="flex-1 bg-canvas-ink text-canvas-surface border-none py-1.5 px-2.5 rounded-canvas-md text-canvas-xs font-medium hover:opacity-90 transition-opacity"
            >
              {config.primaryLabel}
            </button>
          )}
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="flex-1 bg-transparent border-hairline border-canvas-border py-1.5 px-2.5 rounded-canvas-md text-canvas-xs text-canvas-ink-soft hover:border-canvas-border-strong transition-colors"
            >
              {config.secondaryLabel}
            </button>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
```

**Pass 1 scope.** Only the `stale` variant is reachable through actual code paths in pass 1. The other four variants are defined in the type union and the `VARIANT_CONFIG` map so that:

1. Future work (quality checks in pass 3, agent review handoffs post-pass-3, error recovery, moderation integration) can enable each variant by wiring up the corresponding `boardOps.markNodeStatus` calls without touching this component.
2. TypeScript's exhaustiveness checking forces any new `NodeStatus["type"]` to either be added to `VARIANT_CONFIG` or explicitly excluded.
3. The visual language for status communication on the canvas is set in one place, not scattered across node-type-specific implementations.

**Usage on nodes.** Any node component that can carry a status renders `<NodeStatusBadge>` inside its `CanvasNodeShell`, between the connection dots and the image area, passing `data.status` and the appropriate callbacks. The badge is absolutely positioned inside the card, so it doesn't affect layout. The `CastNode` component in 5.11 already demonstrates this wiring.

**Secondary cue on stale.** When a `cast_view` node has a stale status, the `CastImageArea` is also rendered with `dimmed={true}`, which applies `opacity-70` to the image. This is a secondary cue on top of the badge — the image still reads as the image, but it visibly recedes, signaling "this is out of date" even to users who don't notice the corner badge. Other status variants do not dim the image (quality flags should still show the full image so the user can judge it; errors don't have an image to dim; etc.).

**Do not invent new badge positions or styles.** If a future feature wants a status that doesn't fit the corner-badge shape, that's a signal to either (a) add a new variant to `NodeStatus` and use the same badge shape anyway, or (b) raise the design question explicitly rather than forking the pattern.

---

## 6. Refinement studio layout

**Location:** `client/src/features/boards/studio/RefinementStudio.tsx`

Full-screen takeover by default. `BoardPage` conditionally renders `RefinementStudio` instead of `BoardCanvas` when a `?edit=:itemId` URL param is set. The studio fills the viewport with no dimmed scrim, no modal card, no overlay — it is a separate room, not a dialog over the canvas.

**Critical constraint — this component is host-agnostic.** It accepts `itemId` and `onClose` as props and must not import `wouter`, `useLocation`, or any router hooks. All navigation happens through the `onClose` callback passed from `BoardPage`. This keeps the full-screen-vs-modal decision reversible — if dogfooding proves the full-screen presentation is wrong, the switch to a modal host is a change to `BoardPage`, not a refactor of the studio. Do not couple this component to routing under any circumstance.

```tsx
import { TopBar } from "@/features/boards/canvas/TopBar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { RefineTab } from "./tabs/RefineTab";
import { SurgicalTab } from "./tabs/SurgicalTab";
import { AttributesTab } from "./tabs/AttributesTab";
import { HistoryTab } from "./tabs/HistoryTab";
import { PreviewColumn } from "./PreviewColumn";
import { MetadataRail } from "./MetadataRail";

export interface RefinementStudioProps {
  itemId: number;
  boardId: number;
  onClose: () => void;
}

export function RefinementStudio({ itemId, boardId, onClose }: RefinementStudioProps) {
  const { data: node, ... } = useRefinementStudioController(itemId);

  if (!node) return null;

  return (
    <div className="h-screen w-screen flex flex-col bg-canvas-bg">
      <TopBar
        backAction={{ label: "Boards", onClick: onClose }}
        breadcrumb={[{ label: "Cast" }]}
        title={node.modelName ?? "Untitled"}
        subtitle={`v${node.currentVersion} · saved ${relativeTime(node.savedAt)}`}
        rightSlot={
          <>
            <span className="text-canvas-xs text-canvas-ink-faint">{node.viewsDone} of 5 views</span>
            <span className="text-canvas-xs text-canvas-ink-faint">esc</span>
          </>
        }
      />

      <div className="flex-1 grid grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)_215px] overflow-hidden">
        <PreviewColumn node={node} />

        <div className="border-l-hairline border-r-hairline border-canvas-border p-5 overflow-y-auto">
          <Tabs defaultValue="refine" className="w-full">
            <TabsList className="bg-transparent border-b-hairline border-canvas-border rounded-none p-0 h-auto -mb-px">
              <StudioTabTrigger value="refine">Refine</StudioTabTrigger>
              <StudioTabTrigger value="surgical">Surgical</StudioTabTrigger>
              <StudioTabTrigger value="attributes">Attributes</StudioTabTrigger>
              <StudioTabTrigger value="history">History</StudioTabTrigger>
            </TabsList>
            <TabsContent value="refine" className="mt-4"><RefineTab node={node} /></TabsContent>
            <TabsContent value="surgical" className="mt-4"><SurgicalTab node={node} /></TabsContent>
            <TabsContent value="attributes" className="mt-4"><AttributesTab node={node} /></TabsContent>
            <TabsContent value="history" className="mt-4"><HistoryTab node={node} /></TabsContent>
          </Tabs>
        </div>

        <MetadataRail node={node} />
      </div>
    </div>
  );
}

function StudioTabTrigger({ value, children }: { value: string; children: React.ReactNode }) {
  return (
    <TabsTrigger
      value={value}
      className="px-3 py-2 text-canvas-sm text-canvas-ink-faint data-[state=active]:text-canvas-ink data-[state=active]:font-medium data-[state=active]:border-b data-[state=active]:border-canvas-ink data-[state=active]:shadow-none rounded-none bg-transparent"
    >
      {children}
    </TabsTrigger>
  );
}
```

**Column widths (locked):**
- Preview: `minmax(0, 1.55fr)` — roughly 60% of remaining width
- Tool column: `minmax(0, 1fr)` — roughly 25%
- Metadata rail: fixed `215px`

**Vertical dividers** between columns are `border-l-hairline border-canvas-border` on the middle column (left and right sides). No color on the dividers beyond the token.

---

### 6.1 `PreviewColumn`

```tsx
import { cn } from "@/lib/utils";

export function PreviewColumn({ node }: { node: RefinementNode }) {
  return (
    <div className="p-5 flex flex-col">
      <div className="flex-1 bg-canvas-surface-inset rounded-canvas-md flex items-center justify-center min-h-[340px] mb-4">
        {node.currentImageUrl ? (
          <img src={node.currentImageUrl} alt="" className="max-w-full max-h-full object-contain" />
        ) : (
          <PlaceholderGlyph />
        )}
      </div>
      <ViewThumbStrip views={node.views} currentView={node.currentView} onSelect={node.setCurrentView} />
    </div>
  );
}
```

**`ViewThumbStrip`** shows five thumbnails in equal columns. Filled views have a `border-hairline border-canvas-border` thumbnail showing the image. The currently-selected view has `border border-canvas-ink` (1.5px — use arbitrary value `[border-width:1.5px]`). Empty views have `border-hairline border-dashed border-canvas-border-strong` and a centered `+` in ink-faint. Labels sit below each thumb in 9px ink-faint text (or 10px if 9px feels too small in real rendering).

---

### 6.2 `RefineTab` — the prompt iteration surface

```tsx
import { useState } from "react";
import { cn } from "@/lib/utils";

export function RefineTab({ node }: { node: RefinementNode }) {
  const [prompt, setPrompt] = useState("");
  const [strength, setStrength] = useState<"subtle" | "moderate" | "strong">("moderate");

  return (
    <div>
      <SectionLabel>What to change?</SectionLabel>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="More defined jawline, slightly warmer skin tone..."
        className="w-full min-h-[72px] bg-canvas-surface-inset border-none rounded-canvas-md px-3 py-3 text-canvas-md text-canvas-ink placeholder:text-canvas-ink-faint resize-none focus:outline-none"
      />

      <SectionLabel className="mt-4">Quick suggestions</SectionLabel>
      <div className="flex flex-wrap gap-1.5 mb-4">
        {["Sharper features", "Softer lighting", "Younger", "More editorial"].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setPrompt((p) => (p ? `${p}, ${s.toLowerCase()}` : s))}
            className="px-2.5 py-1 rounded-canvas-pill text-canvas-xs text-canvas-ink-soft border-hairline border-canvas-border hover:border-canvas-border-strong transition-colors"
          >
            {s}
          </button>
        ))}
      </div>

      <SectionLabel>Strength</SectionLabel>
      <div className="grid grid-cols-3 gap-1">
        {(["subtle", "moderate", "strong"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStrength(s)}
            className={cn(
              "py-1.5 rounded-canvas-md text-canvas-xs capitalize-first transition-colors",
              "border-hairline",
              strength === s
                ? "border-canvas-ink text-canvas-ink font-medium"
                : "border-canvas-border text-canvas-ink-faint hover:border-canvas-border-strong"
            )}
          >
            {s === "subtle" ? "Subtle" : s === "moderate" ? "Moderate" : "Strong"}
          </button>
        ))}
      </div>
    </div>
  );
}

function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("text-canvas-xs text-canvas-ink-soft mb-2", className)}>{children}</div>
  );
}
```

The "Run refinement" button itself lives in the `MetadataRail` (right column), not in this tab content — see 6.5.

---

### 6.3 `AttributesTab` — layered expressive-plus-chip layout

```tsx
export function AttributesTab({ node }: { node: RefinementNode }) {
  return (
    <div className="space-y-6">
      {/* Region 1: Expressive controls as full widgets */}
      <ExpressiveSection label="Brand">
        <BrandSelector value={node.attributes.brand} onChange={node.updateAttribute("brand")} />
      </ExpressiveSection>

      <ExpressiveSection label="Vibe">
        <TriBlendSelector value={node.attributes.vibe} onChange={node.updateAttribute("vibe")} />
      </ExpressiveSection>

      <ExpressiveSection label="Ethnicity">
        <EthnicityBlender selected={node.attributes.ethnicityBlend} onChange={node.updateAttribute("ethnicityBlend")} />
      </ExpressiveSection>

      <ExpressiveSection label="Skin tone">
        <SkinToneGrid value={node.attributes.skin} onChange={node.updateAttribute("skin")} />
      </ExpressiveSection>

      <ExpressiveSection label="Hair color">
        <HairColorWheel value={node.attributes.hairColor} onChange={node.updateAttribute("hairColor")} />
      </ExpressiveSection>

      {/* Region 2: Simple attributes as chip grid */}
      <div className="pt-4 border-t-hairline border-canvas-border">
        <SectionLabel>Additional attributes</SectionLabel>
        <SimpleAttributeChipGrid attributes={node.attributes} onUpdate={node.updateAttribute} />
      </div>
    </div>
  );
}

function ExpressiveSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-canvas-xs text-canvas-ink-soft mb-2">{label}</div>
      {children}
    </div>
  );
}
```

The `TriBlendSelector`, `EthnicityBlender`, `SkinToneGrid`, `HairColorWheel`, and brand selector are all lifted unchanged from `client/src/features/casting/components/`. They already exist. Wrap them in `ExpressiveSection`; do not rebuild their internals.

`SimpleAttributeChipGrid` is new and handles the remaining ~22 simple fields (age, gender, build, jawline, face shape, cheekbones, nose, lips, eyes, brows, hair style, hair tuck, facial hair, etc.). Each chip follows this pattern:

```tsx
<button
  type="button"
  onClick={openChipEditor}
  className={cn(
    "px-2.5 py-1 rounded-canvas-pill text-canvas-xs border-hairline",
    value
      ? "bg-canvas-teal-bg text-canvas-teal-text border-canvas-teal-bg"
      : "bg-transparent text-canvas-ink-faint border-dashed border-canvas-border-strong"
  )}
>
  {value ? `${fieldLabel} · ${value}` : `+ ${fieldLabel}`}
</button>
```

Clicking a filled chip opens its specific editor (e.g., `WarmSelectControl` for a simple select field) in a small popover anchored to the chip. Clicking a ghost chip does the same and also focuses the editor for input.

Group the simple chips under subsection labels (`Casting basics`, `Physique`, `Face structure`, `Eyes & hair`) with completion counts: `"Face structure · 1 of 7"`. Same style as `SectionLabel`.

---

### 6.4 `HistoryTab` — version timeline

```tsx
export function HistoryTab({ node }: { node: RefinementNode }) {
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);

  return (
    <div>
      {node.versions.map((v, i) => (
        <HistoryItem
          key={v.id}
          version={v}
          isCurrent={v.version === node.currentVersion}
          isSelected={v.version === selectedVersion}
          isLast={i === node.versions.length - 1}
          onClick={() => setSelectedVersion(v.version)}
        />
      ))}

      {selectedVersion !== null && selectedVersion !== node.currentVersion && (
        <div className="mt-4 pt-4 border-t-hairline border-canvas-border flex gap-1.5">
          <button
            type="button"
            onClick={() => node.revertTo(selectedVersion)}
            className="flex-1 px-2.5 py-1.5 rounded-canvas-md text-canvas-xs border-hairline border-canvas-border hover:border-canvas-border-strong"
          >
            Revert to v{selectedVersion}
          </button>
          <button
            type="button"
            onClick={() => node.branchFrom(selectedVersion)}
            className="flex-1 px-2.5 py-1.5 rounded-canvas-md text-canvas-xs border-hairline border-canvas-border hover:border-canvas-border-strong"
          >
            Branch as new cast
          </button>
        </div>
      )}
    </div>
  );
}

function HistoryItem({ version, isCurrent, isSelected, isLast, onClick }: ...) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full flex items-start gap-3 pl-4 py-2.5 text-left hover:bg-canvas-surface-inset transition-colors",
        !isLast && (isCurrent ? "border-l-2 border-canvas-ink" : "border-l-hairline border-canvas-border"),
        isLast && "border-l-transparent",
        isSelected && "bg-canvas-surface-inset"
      )}
      style={{ marginLeft: isCurrent ? "3px" : "3.5px" }} // align left-border offsets
    >
      <div className="w-10 h-12 bg-canvas-surface-inset rounded border-hairline border-canvas-border shrink-0 overflow-hidden">
        {version.thumbUrl && <img src={version.thumbUrl} alt="" className="w-full h-full object-cover" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={cn("text-canvas-sm", isCurrent && "font-medium")}>v{version.version}</span>
          {isCurrent && (
            <span className="text-[9px] bg-canvas-teal-bg text-canvas-teal-text px-1.5 py-px rounded-canvas-pill">current</span>
          )}
        </div>
        <div className="text-canvas-xs text-canvas-ink-faint mt-1">
          {capitalize(version.tool)} · {truncate(version.prompt ?? "initial", 40)}
        </div>
        <div className="text-[9px] text-canvas-ink-faint mt-0.5">{relativeTime(version.createdAt)}</div>
      </div>
    </button>
  );
}
```

**Key points:** the `border-left` on each item forms a continuous vertical rail. The current version's border is 2px dark; prior versions' borders are 0.5px hairline; the last item's border is transparent so the rail terminates cleanly. No `border-radius` on these side borders — hairline rules forbid it.

---

### 6.5 `MetadataRail` (right column of refinement studio)

```tsx
export function MetadataRail({ node }: { node: RefinementNode }) {
  return (
    <div className="p-5 bg-canvas-surface-inset overflow-y-auto">
      <RailSection label="Master prompt">
        <div className="font-mono text-[10px] text-canvas-ink-faint leading-relaxed line-clamp-4">
          {node.masterPrompt}
        </div>
      </RailSection>

      <RailSection label="Technical">
        <KeyValueRow k="Version"    v={`${node.currentVersion} of ${node.versionCount}`} />
        <KeyValueRow k="Views"      v={`${node.viewsDone} of 5`} />
        <KeyValueRow k="Resolution" v="2K" />
      </RailSection>

      <div className="bg-canvas-surface border-hairline border-canvas-border rounded-canvas-md px-3 py-2.5 mb-3">
        <div className="text-canvas-xs text-canvas-ink-faint">{node.pendingOperationLabel}</div>
        <div className="text-canvas-xl font-medium">
          {node.pendingCost.toLocaleString()} <span className="text-canvas-xs text-canvas-ink-faint font-normal">credits</span>
        </div>
      </div>

      <button
        type="button"
        onClick={node.runPending}
        disabled={!node.canRun}
        className="w-full py-2.5 rounded-canvas-md bg-canvas-ink text-canvas-surface text-canvas-sm font-medium disabled:opacity-40 mb-1.5"
      >
        {node.pendingOperationLabel}
      </button>
      <button
        type="button"
        onClick={node.openExport}
        className="w-full py-2 rounded-canvas-md border-hairline border-canvas-border text-canvas-sm text-canvas-ink-soft hover:border-canvas-border-strong"
      >
        Export
      </button>
    </div>
  );
}
```

The `pendingOperationLabel` and `pendingCost` reactive values come from whichever tab is active — Refine populates them with "Run refinement" + refinement cost; Attributes populates with "Regenerate with changes" + cost; Surgical with "Run surgical edit" + cost; History with nothing (the cost card is hidden when the selected tab has no pending operation). Wire this through the `useRefinementStudioController` hook.

---

## 7. Popover content specifications

These are the contents of the popovers triggered by the blender chips. Each wraps an existing tactile component with a popover-appropriate shell.

### 7.1 `VibeBlenderPopover`

```tsx
import TriBlendSelector from "@/features/casting/components/TriBlendSelector";

export function VibeBlenderPopover({ value, onApply, onCancel }: {...}) {
  const [draft, setDraft] = useState(value);
  return (
    <div>
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-canvas-md font-medium">Casting vibe</span>
        <span className="text-canvas-xs text-canvas-ink-faint">drag to adjust</span>
      </div>
      <div className="text-canvas-xs text-canvas-ink-faint mb-3.5">
        Edge × heat · maps to commercial, editorial, runway weights
      </div>

      <TriBlendSelector value={draft} onChange={setDraft} />

      <div className="grid grid-cols-3 gap-2 mt-3 mb-3.5">
        <VibeReadout label="Commercial" pct={Math.round(draft.commercial * 100)} />
        <VibeReadout label="Editorial"  pct={Math.round(draft.editorial * 100)}  />
        <VibeReadout label="Runway"     pct={Math.round(draft.runway * 100)}     />
      </div>

      <div className="flex gap-1.5 pt-3 border-t-hairline border-canvas-border">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-1.5 rounded-canvas-md border-hairline border-canvas-border text-canvas-xs text-canvas-ink-soft"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => onApply(draft)}
          className="flex-[2] py-1.5 rounded-canvas-md bg-canvas-ink text-canvas-surface text-canvas-xs font-medium"
        >
          Apply & run
        </button>
      </div>
    </div>
  );
}

function VibeReadout({ label, pct }: { label: string; pct: number }) {
  return (
    <div>
      <div className="text-[9px] text-canvas-ink-faint">{label}</div>
      <div className="text-canvas-md font-medium">{pct}%</div>
    </div>
  );
}
```

The same pattern applies to `EthnicityBlenderPopover`, `SkinTonePopover`, `HairColorPopover`, `BrandSelectorPopover`: header row → component from `/features/casting/components/` → readout → Cancel + Apply & run. Each popover has an appropriate `popoverWidth` (vibe: 280, ethnicity: 320, skin: 280, hair: 300, brand: 260).

### 7.2 `ViewsGenerationPopover`

**Scope note — the 5 canonical views are fixed.** There is no custom pose field in this popover, no "+ Another pose" affordance, no free-text angle input. The popover exposes exactly the five view types defined in the schema (`frontClose` a.k.a. headshot, `frontFull`, `sideClose`, `sideFull`, `backFull`) and nothing else. Users who want non-canonical angles/poses/scenes of a cast will do that in downstream image-generation nodes that consume the cast as a reference (see `CANVAS_FOUNDATIONS.md` section 1.5 for the framing). Do not add a custom pose section to this popover under any circumstances.

The popover uses `ViewAngle` as the canonical type name matching the backend enum. The `id` field on each row maps directly to the backend view type string.

```tsx
export function ViewsGenerationPopover({ node, onGenerate, onCancel }: {...}) {
  const [selected, setSelected] = useState<Set<ViewAngle>>(new Set());
  const totalCost = selected.size * 1200;

  const views: Array<{ id: ViewAngle; label: string }> = [
    { id: "frontClose", label: "Headshot" },
    { id: "frontFull",  label: "Full body front" },
    { id: "sideClose",  label: "Side close" },
    { id: "sideFull",   label: "Side full" },
    { id: "backFull",   label: "Back full" },
  ];

  return (
    <div>
      <div className="text-canvas-md font-medium mb-0.5">Generate additional views</div>
      <div className="text-canvas-xs text-canvas-ink-faint mb-3">Identity locked · views render from this cast</div>

      {views.map((view, i) => {
        const done = node.completedViews.has(view.id);
        const checked = selected.has(view.id) || done;
        return (
          <div
            key={view.id}
            className={cn(
              "flex items-center justify-between py-1.5",
              i < views.length - 1 && "border-b-hairline border-canvas-border",
              done && "opacity-60"
            )}
          >
            <label className="flex items-center gap-2.5 cursor-pointer">
              <CheckSquare checked={checked} locked={done} onClick={() => !done && toggle(view.id)} />
              <span className="text-canvas-sm">{view.label}</span>
            </label>
            <span className="text-canvas-xs text-canvas-ink-faint">{done ? "done" : "1,200"}</span>
          </div>
        );
      })}

      <div className="flex items-center justify-between pt-3 mt-1 border-t-hairline border-canvas-border">
        <span className="text-canvas-xs text-canvas-ink-faint">{selected.size} views selected</span>
        <span className="text-canvas-lg font-medium">
          {totalCost.toLocaleString()} <span className="text-canvas-xs text-canvas-ink-faint font-normal">credits</span>
        </span>
      </div>

      <div className="flex gap-1.5 mt-3">
        <button type="button" onClick={onCancel} className="flex-1 py-1.5 rounded-canvas-md border-hairline border-canvas-border text-canvas-xs">Cancel</button>
        <button type="button" onClick={() => onGenerate(Array.from(selected))} disabled={selected.size === 0} className="flex-[2] py-1.5 rounded-canvas-md bg-canvas-ink text-canvas-surface text-canvas-xs font-medium disabled:opacity-40">Generate</button>
      </div>
    </div>
  );
}

function CheckSquare({ checked, locked, onClick }: { checked: boolean; locked?: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={locked}
      className={cn(
        "w-3.5 h-3.5 rounded-[3px] flex items-center justify-center transition-colors",
        checked
          ? locked
            ? "bg-canvas-ink-faint"
            : "bg-canvas-ink"
          : "bg-transparent border-hairline border-canvas-border-strong"
      )}
    >
      {checked && (
        <svg width="8" height="8" viewBox="0 0 8 8">
          <path d="M1 4l2 2 4-5" stroke="var(--color-canvas-surface)" strokeWidth={1.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}
```

---

## 8. Canvas layout composition

**Location:** `client/src/features/boards/BoardCanvas.tsx` (refactored)

```tsx
import { ReactFlow, Background, MiniMap, ... } from "@xyflow/react";
import { TopBar } from "./canvas/TopBar";
import { DottedGridBackground } from "./canvas/DottedGridBackground";
import { FloatingToolPill } from "./canvas/FloatingToolPill";
import { CastNode } from "./canvas/nodes/CastNode";
// ... other node types

const nodeTypes = {
  cast: CastNode,
  wardrobe: WardrobeNode,    // pass 2
  image: ImageGenNode,        // pass 3
  note: NoteNode,
  frame: FrameNode,
};

export function BoardCanvas({ boardId }: { boardId: number }) {
  const { nodes, edges, onNodesChange, onEdgesChange, activeTool, setActiveTool, ... } = useBoardCanvasController(boardId);

  return (
    <div className="h-screen w-screen flex flex-col bg-canvas-bg">
      <TopBar
        breadcrumb={[{ label: "Boards", onClick: goToLobby }, { label: board.name }]}
        rightSlot={<><ZoomPct /><ShareLink /><UserAvatar /></>}
      />
      <div className="flex-1 relative">
        <DottedGridBackground />
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          fitView={false}
          proOptions={{ hideAttribution: true }}
          panOnDrag
          selectionOnDrag={activeTool === "select"}
        >
          {/* Do not render React Flow's own Background — we use DottedGridBackground */}
        </ReactFlow>
        <FloatingToolPill activeTool={activeTool} onSelectTool={setActiveTool} />
      </div>
    </div>
  );
}
```

**Edge rendering:** use React Flow's edge types. Configure the default edge with:
```ts
const defaultEdgeOptions = {
  style: { stroke: "var(--color-canvas-border-strong)", strokeWidth: 1, opacity: 0.4 },
  type: "smoothstep",
};
```
Visible opacity bumps to 1 when either endpoint is selected. This is handled via React Flow's selection state — listen for selection changes in `useBoardCanvasController` and update edge props conditionally.

---

## 9. Interaction specifications

### Selection
- Click a node → select it (single-select). Cmd/Ctrl + click extends selection.
- Click empty canvas → deselect all.
- Selection state drives: node border weight (0.5px → 1px dark), visibility of `NodeFloatingToolbar`, `NodeControlStrip`, `BlenderChipStrip` (on cast_root only), and edge opacity for connected edges.
- Edges are rendered at 40% opacity by default and upgrade to full opacity when either endpoint node is selected.

### Empty-state cast node (freshly dropped)
- Dropping a new cast node from the floating tool pill creates an empty `cast_root` and auto-selects it.
- The inline prompt input is auto-focused.
- The `BlenderChipStrip` is rendered immediately with all five chips in ghost state (`value: null`).
- The `NodeControlStrip` is NOT rendered (nothing to show on a node with no output).
- The `NodeFloatingToolbar` is NOT rendered (no output to manipulate).
- The Run button is in disabled visual state until either `promptValue.trim().length > 0` OR at least one blender chip transitions to filled state.
- The first Run on an empty root fires `boardOps.runGeneration` with whatever combination of prompt and chips the user has set. LLM parser fills in any gaps.
- On generation completion, the node transitions to completed state: control strip appears, floating toolbar appears, inline prompt becomes read-only display, Run button becomes Edit.

### Drag
- Nodes are draggable (React Flow default). During drag, chrome (toolbar, strips) hides to reduce visual jitter. After drag ends and if the node is still selected, chrome reappears.
- `onMouseDown` on floating toolbar, control strip, blender chip strip, and status badge calls `stopPropagation` to prevent React Flow from starting a drag on their children.

### Popovers
- Blender chip click → popover opens anchored to the chip, chip enters active state (1px dark border, inset background).
- Clicking outside the popover or pressing Esc closes it and reverts the chip to its previous state (filled or ghost).
- Only one popover is open at a time. Opening a second closes the first.
- `Apply & run` closes the popover and commits: for identity-level blender changes on a cast_root with connected view nodes, the identity change confirmation dialog appears before any mutation runs (see below). For all other cases, `boardOps.updateNodeMetadata` + `boardOps.runGeneration` fire immediately for that node.

### Identity change confirmation dialog
Fires when any identity-level attribute on a `cast_root` is about to change AND the root has one or more connected `cast_view` nodes.

- Triggered by: blender chip Apply & run on the canvas, or by committing identity-level changes in the refinement studio's Attributes tab.
- Dialog content: "This will regenerate N existing views · {N × 1200} credits." Three options:
  - **Update now** — primary dark pill button. Commits the identity change, regenerates the root, fires `boardOps.refreshStaleViews.execute` for all connected views in one batch. Single cost confirmation already covered by the dialog; no second confirmation is shown.
  - **Update later** — secondary ghost button. Commits the identity change, regenerates the root, marks each connected view with `NodeStatus { type: "stale", message, context: { oldValues, newValues } }` via `boardOps.markNodeStatus`. Views retain their old images and gain the corner badge.
  - **Cancel** — tertiary text button. No change is committed. The blender popover reopens (or the Attributes tab retains the draft).
- Use shadcn's `Dialog` primitive for this, restyled with `bg-canvas-surface border-hairline border-canvas-border-strong shadow-none` to match the canvas language. Do not use a heavy modal scrim; the backdrop should be `bg-black/20` at most.
- Dialog width: 400px. Centered on the viewport.

### Stale view node interactions
- A view node with `status.type === "stale"` shows the `NodeStatusBadge` in the top-right corner of its image area at all times (not just when selected).
- The `CastImageArea` renders the image at 70% opacity as a secondary cue.
- Hovering the badge triggers the `HoverCard` after 100ms delay, showing the status message and two actions.
- Primary action ("Refresh") fires `boardOps.runGeneration` for just this view with the current (updated) identity, clears the stale status on completion.
- Secondary action ("Keep old") clears the status via `boardOps.markNodeStatus` with `null`, but does not regenerate — the user is explicitly accepting the old image.
- The hover card closes after 150ms of the mouse leaving it or the badge. Clicking inside the card keeps it open.

### Bulk refresh of stale views
- Available from the root cast node's `···` more menu when the root has one or more stale connected views.
- Menu item: "Refresh all stale views (N · {N × 1200} credits)".
- Clicking fires `boardOps.refreshStaleViews.plan` then `.execute` with confirmation.
- While the batch is running, each view individually transitions through its own generating state and clears its stale status as it completes.

### Refinement studio entry/exit
- Click `Edit` inside a node card → navigate to the studio via the `onClose`-adjacent `onEdit` callback on `BoardPage`. `BoardPage` updates its URL param and swaps the rendered component.
- Click `← Boards` in studio top bar → call the `onClose` prop, which navigates `BoardPage` back to the canvas view. Canvas restores its previous viewport and selection.
- `Esc` in studio → same as clicking back.
- `RefinementStudio` itself does not touch routing — it only calls `onClose`. This is what keeps the full-screen-vs-modal host decision reversible.
- If the user has unsaved draft text in the Refine or Surgical tab, no warning dialog — drafts are transient by design.
- Editing a `cast_view` opens the studio with the Attributes tab in a read-only mode, surfacing a link `Edit identity on root cast →` that closes the view's studio session and reopens it for the root.

### Keyboard shortcuts (pass 1)
- `Esc`: close popover, dismiss hover card, or exit studio (in that priority order)
- `Delete` / `Backspace`: delete selected node. For a cast_root with connected views, show confirmation dialog listing the cascade count.
- `Enter` in inline prompt: submit (Run)
- `Cmd/Ctrl + K`: placeholder for command palette in pass 3, not built in pass 1

---

## 10. Animation and transition specifications

Keep animations minimal. Heavy motion is off-brand.

| Target                          | Property              | Duration | Easing       |
|---------------------------------|-----------------------|----------|--------------|
| Node border color / width       | `border-color`, `border-width` | 150ms | `ease-out`  |
| Button hover background         | `background-color`    | 120ms    | `ease-out`   |
| Popover open                    | `opacity`, `transform-y(4px → 0)` | 160ms | `ease-out` (handled by Radix/shadcn) |
| Popover close                   | `opacity`, `transform` | 120ms | `ease-in`    |
| Chrome appearance on selection  | `opacity` (0 → 1)    | 120ms    | `ease-out`   |
| Tab content swap in studio      | `opacity`             | 120ms    | `ease-out`   |
| Progress bar fill               | `width`               | 300ms    | `linear`     |
| Node image fade-in on complete  | `opacity`             | 250ms    | `ease-out`   |

**Do not animate:**
- Node position changes during drag (React Flow handles this).
- Text color changes.
- Layout shifts from chrome appearance (the chrome uses absolute positioning for the above-card toolbar; below-card strips are in flow and should appear without layout jank — use `opacity` transition, not `height` transition).

---

## 11. Final reminders for implementation

1. **Read `CANVAS_FOUNDATIONS.md` first** for decisions, API shape, sequencing, and scope. This doc is the visual layer; the foundations doc is the architectural layer. They work together.
2. **Build components in the order listed in section 5.** Each component depends on tokens and simpler components below it in the list. Do not jump to `CastNode` before `CanvasNodeShell`, `NodeLabelRow`, `ConnectionDot`, `NodeInlinePrompt`, `NodeControlStrip`, `BlenderChipStrip`, `NodeFloatingToolbar`, `CastImageArea`, and `NodeStatusBadge` are all working.
3. **Use shadcn primitives wherever possible.** The canvas is not an excuse to rebuild buttons, popovers, tooltips, hover cards, tabs, or dialogs. The only custom primitives are the ones in section 5; everything else wraps shadcn.
4. **Reuse the casting components from `client/src/features/casting/components/`** unchanged. `TriBlendSelector`, `EthnicityBlender`, `HairColorWheel`, `SkinToneGrid`, `WarmPrimitives`, `WarmSelectControl` are all lifted into popovers and into the Attributes tab. Do not rebuild them.
5. **Delete the three casting stores** as part of milestone M1. They are replaced by node metadata plus `useGenerationJobs`.
6. **Do not invent new design tokens.** If you need a new color, add it to `canvas-tokens.css` first and reference it via the Tailwind class. No arbitrary hex values in component code.
7. **Every mutation goes through `boardOps`.** No React component writes to `board_items` directly. The `useRefinementStudioController` and `useCastNodeController` hooks are where mutations are invoked.
8. **Preserve the classic `/studio` route** unchanged. It stays alive until the canvas proves itself. Do not touch its files.
9. **When in doubt on proportions or spacing**, match the existing mockups referenced in conversation with the design lead. The numbers in section 2 are the source of truth; the components follow from them.
10. **Polish is a later pass.** Ship M1–M8 (plus M4.5 for stale flow) as described in `CANVAS_FOUNDATIONS.md` section 7 before chasing micro-interactions.
11. **One `CastNode` component, conditional on provenance.type.** Do not build `RootCastNode` and `ViewCastNode` as separate files. Section 5.11 shows the single-component approach with branching on `data.provenance.type`. This is in the anti-patterns list too — it's that important.
12. **`RefinementStudio` must not import routing.** Props-only: `itemId` and `onClose`. Full-screen-vs-modal host is the caller's decision, not the studio's. This keeps the presentation choice reversible during dogfooding.
13. **Views are separate nodes on the canvas, not internal states of the root cast.** Clicking `+ Views` on a root spawns new `cast_view` nodes connected by `generated_from_cast` edges. There is no view switcher dropdown inside the root cast. There are no custom poses in the views popover — the 5 canonical views are fixed.
14. **Identity-level changes on a root with connected views always surface the three-option dialog.** Never silently regenerate views, never silently leave them stale. The dialog is the only correct path.
15. **`NodeStatusBadge` is generalized from day one.** Pass 1 only wires up the `stale` variant, but the type union includes `quality_flagged`, `needs_review`, `error`, and `moderation` for future use. Do not add a second badge component later — extend this one.

---

**End of design system doc.** Any ambiguity found while implementing should be raised as a question to the design lead before writing code that deviates from this spec.
