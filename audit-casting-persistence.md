# Casting Draft Resume — Persistence Audit

## Architecture Comparison: Wardrobe vs Casting

### Wardrobe (Session-based)
- **Storage model:** `wardrobeSessions` table with `history` JSON column (array of VTO snapshots)
- **Bug found:** `vto.incremental` and `vto.refine` didn't call `updateSession()` → only initial `vto.generate` saved to DB
- **Impact:** Incremental swaps and refinements were lost on session resume
- **Fix:** Added `updateSession()` calls to both routes

### Casting (Asset-based)
- **Storage model:** `modelAssets` table — each generation creates a new row via `createModelAsset()`
- **Every route persists:**
  - `castingImage` → calls `createModelAsset()` ✅ (line 112-118 of castingImaging.ts)
  - `fullBody` → calls `createModelAsset()` ✅ (line 229-235)
  - `multiView` → calls `createModelAsset()` ✅ (line 337-343)
  - `iterate` → calls `createModelAsset()` ✅ (line 130-136 of castingRefinement.ts)
  - `iterate` → also calls `updateModel()` to persist masterPrompt + technicalSchema ✅ (line 138-141)

## Key Finding: NO PERSISTENCE BUG IN CASTING

Unlike wardrobe (which used a session-based history JSON that needed manual updates), casting uses an **asset-per-generation** model where every successful generation automatically creates a new `modelAssets` row. This means:

1. **Initial headshot** → saved as `frontClose` asset ✅
2. **Iteration/refinement** → saved as new asset (same viewType, new row) ✅
3. **Full body** → saved as `frontFull` asset ✅
4. **Multi-view** → saved as `sideClose`/`sideFull`/`backFull` asset ✅

## Draft Resume Flow (Client-Side)

When user clicks "Resume" on a draft in the lobby:
1. `onResumeDraft` in DrapeStudio.tsx fires
2. Immediately sets canvas state with thumbnail data from the draft listing
3. Switches to casting tool instantly (no waiting)
4. Background fetch: `trpcUtils.models.get.fetch({ modelId: draft.id })`
5. On resolve: restores `currentAssets`, pushes to history, updates canvas flags

The `models.get` endpoint returns ALL assets for the model (`getModelAssets(modelId)`), so all iterations are available.

## What IS Lost on Resume (Accepted Limitations)

| State | Persisted? | Impact |
|-------|-----------|--------|
| Model assets (all views) | ✅ DB | Full history available |
| Master prompt | ✅ DB | Restored from model record |
| Technical schema | ✅ DB | Restored from model record |
| Form preferences | ✅ DB | Restored from model.preferences |
| Model name | ✅ DB | Restored from model.name |
| Undo/redo history | ⚠️ Partial | Only latest assets loaded, not full undo stack |
| Amendment log | ❌ In-memory | Lost — user can't see past change descriptions |
| Gemini chat context | ❌ In-memory | Stateless fallback on resume (30min TTL) |
| Suggestions | ❌ In-memory | Re-fetched on next interaction |
| Active view selection | ❌ In-memory | Defaults to frontClose |

## Undo/Redo History Gap

The resume flow calls `pushHistory(restoredAssets)` once with ALL current assets. This creates a single history entry. The user cannot undo through previous iterations.

However, all past assets ARE in the DB (multiple `frontClose` rows from iterations). They're just not loaded into the undo stack.

**Severity:** Low — this is a UX limitation, not data loss. The latest state is always correct.

## Conclusion

**Casting does NOT have the same persistence bug as wardrobe.** The fundamental architecture difference (asset-per-generation vs session-history-JSON) means every casting generation is automatically persisted. No code changes needed for basic persistence.

**Optional improvement:** Load full asset history into undo stack on resume (query all assets ordered by createdAt, group by viewType to rebuild history snapshots). This would give users full undo capability after resuming a draft.
