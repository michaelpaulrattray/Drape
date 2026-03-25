# StudioCanvas — Unified Canvas Architecture

## Feature Audit

### Shared (identical in both)
- Canvas background: `#f0ebe3`
- Persistent toolbar: undo/redo + status pill (dot + label)
- Error banner: inline, top-14, dismiss + retry
- Image display: maxWidth calc, borderRadius 16, shadow, blur on generating
- Compare: hold-to-compare with timer, badge ("Original"/"Previous")
- Retry button: top-3 right-3, auto-hides on hover
- LoadingOverlay: shared component
- Keyboard shortcuts: Z/⇧Z for undo/redo
- Image hover container with hover state tracking

### Casting-only features (overlay slots)
- ViewTabs strip (top)
- Identity drift warning banner
- Floating reference image (draggable, resizable, toggle)
- Next stage CTA (right side)
- Tool buttons (surgical edit, eraser) — right side on hover
- Status pills (locked source, active tool) — top-left
- Contextual tip for new model
- Masking helper bar
- RefinePanel (bottom, with textarea)
- Shortcuts bar (bottom, with extra keys: /, F, Hold)
- Quick Ideas / RotatingSuggestions (above refine)
- MaskCanvas overlay
- WarmEmptyState (no assets)
- SlotChip + RotatingSuggestions sub-components

### Wardrobe-only features (overlay slots)
- GarmentOverlay (on image)
- "No model on canvas" empty state
- Shortcuts bar (simpler: Space, Z, ⇧Z, Hold)
- marginTop 50px on image + retry

## Unified Props Interface

```ts
interface StudioCanvasProps {
  // Image
  displayUrl: string | null;
  imageAlt?: string;
  imageRef?: RefObject<HTMLImageElement | null>;
  imageStyle?: React.CSSProperties;

  // State
  isGenerating: boolean;
  generatingMessage?: string | null;
  hasResult: boolean;
  isComparing: boolean;

  // Toolbar
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  statusLabel: string;
  statusColor: string; // dot color
  statusGlow?: string; // optional glow

  // Error
  errorMessage?: string | null;
  onClearError?: () => void;

  // Actions
  onRetry: () => void;
  onCompareStart: () => void;
  onCompareEnd: () => void;
  compareLabel?: string; // "Original" | "Previous"

  // Loading
  loadingMessage?: string;
  isFirstGeneration?: boolean;

  // Empty state (when no image)
  emptyState?: React.ReactNode;

  // Overlay slots — tool-specific content
  imageOverlay?: React.ReactNode;     // GarmentOverlay, MaskCanvas
  topOverlay?: React.ReactNode;       // ViewTabs, identity warning
  bottomOverlay?: React.ReactNode;    // RefinePanel, shortcuts, suggestions
  sideOverlay?: React.ReactNode;      // Tool buttons, next stage CTA
  statusOverlay?: React.ReactNode;    // Locked source, active tool pills
  floatingOverlay?: React.ReactNode;  // Floating reference image

  // Keyboard
  extraKeyHandler?: (e: KeyboardEvent) => boolean; // return true if handled
}
```

## Architecture

DrapeStudio.tsx renders StudioCanvas ONCE, persistently.
Tool switch only changes: props + overlay children.
Canvas div never unmounts.
