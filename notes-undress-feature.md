# Undress / Reset to Original — Architecture Notes

## Current Flow
1. `modelImageUrl` = the clean full-body model image (uploaded or cast frontFull asset)
2. VTO generation takes `modelImageUrl` + garments → produces dressed result
3. Each VTO result is pushed to `vtoHistory[]` in useWardrobeStore
4. `currentResult` = `vtoHistory[vtoHistoryIndex]` — what's displayed on canvas
5. Canvas `displayUrl` = `gen.currentResult || modelImageUrl` (fallback to original)
6. Compare: hold-to-compare shows previous VTO result or original model

## Key Insight
The original model image is ALREADY available as `modelImageUrl` prop.
When `currentResult` is null (no VTO history), the canvas already shows the original.

## Reset to Original = Simply Clear VTO State
- Clear `vtoHistory`, `vtoHistoryIndex`, `selectedGarmentIds`, `styleNotes`, `resultOverlayItems`
- Canvas automatically falls back to `modelImageUrl` (the clean model)
- No generation needed — it's instant

## Where to Put the Button
- **LayersPanel** (right panel) — has the action buttons area at bottom
- Could also be in the **WardrobeShortcutsBar** (bottom overlay on canvas)
- Best: LayersPanel action area, as a subtle secondary action

## State to Reset
From useWardrobeStore:
- `clearVTOHistory()` — clears vtoHistory, vtoHistoryIndex, selectionSnapshots, overlayCache
- `clearSelection()` — clears selectedGarmentIds
- `clearStyleNotes()` — clears styleNotes
- `setResultOverlayItems([])` — clears overlay items
- `setLastGenStyleNotes({})` — clears dirty style tracking

## Session Impact
- activeSessionId should be kept (the session still exists)
- The session's VTO history on the server is unaffected (just client-side reset)
- User can re-select garments and generate fresh from the original
