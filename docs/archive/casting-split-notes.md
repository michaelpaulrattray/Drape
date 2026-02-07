# CastingStudio Split Plan

## Current Structure (2,299 lines)
- Lines 1-54: Imports
- Lines 55-117: generateExportId + generateRandomPreferences (constants/utils)
- Lines 119-231: BODY_ICONS, FACE_ICONS, ConnectorLine (visual constants + component)
- Lines 233-353: StageLockModal + ExportModal (modal components)
- Lines 355-476: CollapsibleSection, SelectControl, VisualOptionGrid (form helpers)
- Lines 478-604: ReferenceNode (drag-drop image upload)
- Lines 606-670: LOADING_TIPS + ElapsedTimeDisplay (loading UI)
- Lines 674-845: Main component - state, hooks, effects, debug utility
- Lines 847-987: Canvas drawing handlers + mask generation
- Lines 989-1065: Form validation, progress, view locking memos
- Lines 1066-1496: Generation functions (handleGenerate, handleGenerateFullBody, handleGenerateMultiView, handleAutoGenerateAllViews, handleRefineSubmit, performIteration, handleEnhance)
- Lines 1498-1661: Export handler (handleExport)
- Lines 1663-1757: Retry, undo/redo, nextStage memo
- Lines 1759-2299: JSX return (loading, modals, left panel, right panel)

## Proposed Split

### 1. features/casting/castingHelpers.tsx (~200 lines)
- generateExportId, generateRandomPreferences
- BODY_ICONS, FACE_ICONS, LOADING_TIPS
- ConnectorLine, StageLockModal, ExportModal
- CollapsibleSection, SelectControl, VisualOptionGrid
- ElapsedTimeDisplay

### 2. features/casting/ReferenceNode.tsx (~130 lines)
- Already self-contained, just move

### 3. features/casting/hooks/useCastingGeneration.ts (~400 lines)
- handleGenerate, handleGenerateFullBody, handleGenerateMultiView
- handleAutoGenerateAllViews, handleRefineSubmit, performIteration
- handleEnhance, handleRetry, handleUndo, handleRedo
- All mutations, creditsData query, refetchCreditsWithWarning

### 4. features/casting/hooks/useCastingExport.ts (~170 lines)
- handleExport, mintMutation, generatePdfMutation, upscaleMutation, proxyImageMutation

### 5. features/casting/hooks/useCastingCanvas.ts (~150 lines)
- Canvas drawing state, handlers (pointerDown/Move/Up)
- getGuideOverlayDataUrl, syncCanvas effect, isMasking

### 6. features/casting/ControlPanel.tsx (~120 lines)
- Left sidebar JSX (header, collapsible sections, generate button, admin tools)

### 7. features/casting/ImageViewerPanel.tsx (~200 lines)
- Right panel JSX (loading overlay, main image, canvas, tools, next stage, empty state)

### 8. CastingStudio.tsx shell (~200 lines)
- Import hooks, compose UI, auth redirect, keyboard shortcuts, memos
