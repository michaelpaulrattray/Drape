# Casting Architecture Audit for Board Integration

## Current Layout (DrapeStudio)
Casting renders as a 3-panel layout:
- **Left panel** (320px): ControlPanel — form fields (gender, age, hair, skin, etc.), generate button
- **Center**: ImageViewerPanel — canvas with generated model, view tabs, mask painting, refine panel
- **Right panel** (320px): MasterPromptPanel — AI-generated prompt, editable

## State Dependencies
1. **useCastingFormStore** — 30+ model preferences (gender, age, hair, skin, body, etc.) + modelName
2. **useCastingGenerationStore** — genState, currentModelId, currentAssets, history[], masterPrompt, technicalSchema
3. **useCastingUIStore** — activeView (frontClose/frontFull/sideClose), activeTool (cast/refine/mask), modals
4. **useStudioStore** — shared canvas state (hasModel, hasFullBody, modelSource, castModelId, etc.)

## Hooks
1. **useCastingCanvas** — canvas refs, mask painting handlers (pointer down/move/up), guide overlay
2. **useCastingGeneration** — generate/refine/enhance/retry/undo/redo, credits check, form validation
3. **useCastingViewGeneration** — auto-generates next view (headshot → full body → side), nextStage
4. **useCastingExport** — export model to S3

## Key Orchestration in DrapeStudio
- Sync casting assets → shared canvas state (useEffect)
- Hydrate casting store from gallery models (useEffect + tRPC query)
- Form progress calculation (useMemo)
- Full body URL derivation (useMemo)
- New model reset (useCallback)
- Cast gate modal (useCastGate hook)

## For Board Integration
The casting tool is essentially:
1. A form panel (ControlPanel) — can render in the board's right panel
2. A canvas viewer (ImageViewerPanel) — this IS the main workspace, should be the board's center/canvas area
3. A prompt panel (MasterPromptPanel) — can be a collapsible sub-panel

The challenge: ImageViewerPanel is currently a React component that renders inside a div.
In the board context, the generated images should become React Flow nodes on the canvas.

## Proposed Architecture for Board
Instead of rendering ImageViewerPanel in the center, the board canvas IS the center.
When casting is active:
- Right panel shows ControlPanel (form) + MasterPromptPanel (collapsible)
- Generated model images appear as cards on the React Flow canvas
- Clicking a model card opens an overlay/modal with the full ImageViewerPanel for refining/masking
- This preserves all existing functionality while making outputs spatial

## What needs to change
- ControlPanel: No changes — just render in right panel
- MasterPromptPanel: No changes — render below ControlPanel or as collapsible
- ImageViewerPanel: Needs to work as an overlay/modal when a model card is clicked
- useCastingGeneration: Needs a callback to add items to board on generation complete
- useCastingCanvas: No changes — works with canvas refs regardless of container
