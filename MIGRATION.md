# Casting Studio Migration Manifest

> **Goal:** Migrate from the current Casting Studio to the redesigned version with improved prompts, chat session persistence, identity drift checking, schema reconciliation, suggestion generation, and prompt compaction — while preserving all backend integrations (tRPC, credits, auth, S3, PDF).

---

## Phase Status

| Phase | Description | Status | Checkpoint |
|-------|-------------|--------|------------|
| 1a | Server prompts: constants + brand profiles | ⬜ Not started | — |
| 1b | Server: studio settings, identity anchor, retry logic, response helpers | ⬜ Not started | — |
| 1c | Server: prompt assembly (skin, iris, hair, ethnicity blend, vibe bands) | ⬜ Not started | — |
| 2a | Server: schema reconciliation + identity drift checking | ⬜ Not started | — |
| 2b | Server: suggestion generation + reference analysis | ⬜ Not started | — |
| 2c | Server: prompt compaction | ⬜ Not started | — |
| 2d | Server: chat session management (casting generator) | ⬜ Not started | — |
| 2e | Server: full body + view generators upgrade | ⬜ Not started | — |
| 3a | tRPC routes: new procedures (reconcile, suggestions, compact, session) | ⬜ Not started | — |
| 3b | Types: update ModelPreferences + add new types | ⬜ Not started | — |
| 4a | Client: Zustand stores (form, generation, UI) | ⬜ Not started | — |
| 4b | Client: hooks (useCastingGeneration, useCastingViewGeneration) | ⬜ Not started | — |
| 5 | Client: ControlPanel components | ⬜ Not started | — |
| 6 | Client: ImageViewer + RefineBar + ViewStrip | ⬜ Not started | — |
| 7 | Client: MasterPrompt panel + quick suggestions | ⬜ Not started | — |
| 8 | Integration testing + polish | ⬜ Not started | — |

---

## File Mapping (Old → New)

### Server Files

| Current File | New Design Reference | Changes |
|---|---|---|
| `server/casting/geminiPrompts.ts` | `constants.ts` + `promptGenerator.ts` | Replace MASTER_PROMPT_SYSTEM_INSTRUCTION, add BRAND_PROFILES, update getSkinDescription, add irisDescriptions, add formatEthnicityBlend, add vibe band system |
| `server/casting/geminiClient.ts` | `services/gemini/client.ts` | Add safeResponseText, extractImageFromResponse, diagnoseResponse, withTimeout, withSingleRetry503, getStudioSettings, buildIdentityAnchor, checkIdentityConsistency, hasBodyArt, GeminiPart |
| `server/casting/geminiGeneration.ts` | `services/gemini/castingGenerator.ts` + `promptGenerator.ts` | Add chat session (activeSession), brand expression system, ethnicity phenotype lock, attribute transfer protocol, identity anchor, model fallback chain |
| `server/casting/geminiViews.ts` | `services/gemini/bodyGenerator.ts` + `viewGenerator.ts` | Add identity anchor, physique directive, identity consistency check, model fallback chain |
| `server/casting/geminiTypes.ts` | `types.ts` | Add ethnicityBlend, Amendment, GeneratedAsset, GenerationState |
| `server/casting/geminiService.ts` | `services/gemini/index.ts` | Add new exports: reconcileSchemaWithImage, updateSchemaForIteration, generateCastingSuggestions, analyzeReferenceForTransfer, compactMasterPrompt, clearCastingSession, checkIdentityConsistency |
| — (new) | `services/gemini/schemaUpdater.ts` | NEW: updateSchemaForIteration, reconcileSchemaWithImage |
| — (new) | `services/gemini/suggestionGenerator.ts` | NEW: generateCastingSuggestions, analyzeReferenceForTransfer |
| — (new) | `services/gemini/promptCompactor.ts` | NEW: compactMasterPrompt |

### Client Files (future phases)

| Current File | New Design Reference | Changes |
|---|---|---|
| `client/src/features/casting/stores/useCastingFormStore.ts` | `CastingContext.tsx` (state portion) | Add ethnicityBlend, amendments, generatedAssets |
| `client/src/features/casting/stores/useCastingGenerationStore.ts` | `CastingContext.tsx` (generation portion) | Add identityWarning, currentStep, suggestions |
| `client/src/features/casting/hooks/useCastingGeneration.ts` | `CastingContext.tsx` (generation logic) | Add chat session awareness, reconciliation calls, suggestion fetching |
| `client/src/features/casting/ControlPanel.tsx` | `components/ControlPanel.tsx` | Already mostly aligned — add ethnicity blend UI |
| `client/src/features/casting/components/ImageViewer/` | `components/ImageViewer/` | Add RefineBar, MaskCanvas, ViewStrip, EmptyState |

---

## Backend Contract (tRPC Procedures)

### Existing Procedures (preserve)

| Procedure | Auth | Description |
|---|---|---|
| `generation.castingImage` | protected | Generate headshot/iteration |
| `generation.fullBody` | protected | Generate full body from headshot |
| `generation.multiView` | protected | Generate side/back views |
| `generation.singleView` | protected | Generate single view |
| `generation.upscale` | protected | Upscale image |
| `generation.enhancePrompt` | protected | Enhance user iteration text |

### New Procedures (Phase 3a)

| Procedure | Auth | Description |
|---|---|---|
| `generation.reconcileSchema` | protected | Visual reconciliation after iteration |
| `generation.suggestions` | protected | Generate quick idea chips |
| `generation.analyzeReference` | protected | Analyze reference image for transfer |
| `generation.compactPrompt` | protected | Compact bloated master prompt |
| `generation.clearSession` | protected | Clear chat session state |

---

## State Contract (Zustand Store Fields)

### useCastingFormStore additions

```typescript
ethnicityBlend: { name: string; pct: number }[];
// (existing fields preserved)
```

### useCastingGenerationStore additions

```typescript
identityWarning: string | null;
currentStep: string;
suggestions: string[];
amendments: Amendment[];
```

---

## Decisions Log

| # | Decision | Rationale | Date |
|---|---|---|---|
| 1 | Chat session persistence uses replay-from-history | Strip images from older entries, keep last 3 image-bearing messages, prepend identity anchor — avoids storing full session state in DB | Pre-migration |
| 2 | Schema reconciliation is awaited (not fire-and-forget) | Shows "Syncing identity details..." UI, returns corrected schema+description with image | Pre-migration |
| 3 | Suggestion generation in geminiPrompts.ts | Prompt assembly concern, not reconciliation | Pre-migration |
| 4 | File split: prompts / reconciliation / generation / views | Clean separation of concerns matching new design | Pre-migration |
| 5 | Testing: Vitest server-side tests for Phase 2 before hooks | Validate server functions independently | Pre-migration |
| 6 | compressImageForApi: server-side implementation needed | New design uses browser Canvas API — need Node.js equivalent using sharp | Phase 1b |
| 7 | Safety settings: BLOCK_NONE preserved for Casting Studio | Fashion casting requires bare skin descriptions that trigger false positives | Pre-migration |
| 8 | Model fallback chain: pro → flash → 2.5-flash | Graceful degradation across model availability | Pre-migration |
| 9 | Identity consistency check: warn but don't block | Fails open (returns true) to avoid blocking generation on check failures | Pre-migration |
| 10 | Prompt compaction threshold: after 3+ amendments | Prevents prompt bloat from accumulating iteration modifications | Pre-migration |
