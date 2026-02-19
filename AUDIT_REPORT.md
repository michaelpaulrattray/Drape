# FormaStudio — Backend Compatibility Audit Report

**Date:** 2026-02-19  
**Scope:** Full audit of the Phase 6 Casting Studio UI migration against the existing backend  
**Auditor:** Manus AI  

---

## Executive Summary

The Phase 6 visual overhaul is **backend-compatible**. All 18 client-side tRPC calls map to existing server procedures with matching input/output schemas. No client-side code accesses Gemini directly, touches S3, or exposes API keys. All prompt engineering patches (10–17) are intact and unmodified in their server-side files.

The audit identified **0 blockers**, **1 warning** (confusing naming), and **14 cleanup items** (dead code from the old UI that can be safely removed).

---

## 1. Backend Compatibility — tRPC Contract Verification

Every client-side tRPC call was traced to its server-side procedure definition. The table below confirms full coverage.

| Client Hook File | tRPC Call | Server Router | Procedure | Severity |
|---|---|---|---|---|
| `useCastingGeneration.ts` | `trpc.credits.getBalance.useQuery` | `credits.ts` | `getBalance` | **OK** |
| `useCastingGeneration.ts` | `trpc.models.create.useMutation` | `models.ts` | `create` | **OK** |
| `useCastingGeneration.ts` | `trpc.generation.castingImage.useMutation` | `castingImaging.ts` | `castingImage` | **OK** |
| `useCastingGeneration.ts` | `trpc.generation.iterate.useMutation` | `castingRefinement.ts` | `iterate` | **OK** |
| `useCastingGeneration.ts` | `trpc.generation.enhance.useMutation` | `castingRefinement.ts` | `enhance` | **OK** |
| `useCastingGeneration.ts` | `trpc.generation.suggestions.useMutation` | `castingRefinement.ts` | `suggestions` | **OK** |
| `useCastingGeneration.ts` | `trpc.generation.reconcile.useMutation` | `castingRefinement.ts` | `reconcile` | **OK** |
| `useCastingGeneration.ts` | `trpc.generation.compactPrompt.useMutation` | `castingRefinement.ts` | `compactPrompt` | **OK** |
| `useCastingGeneration.ts` | `trpc.generation.clearSession.useMutation` | `castingRefinement.ts` | `clearSession` | **OK** |
| `useCastingGeneration.ts` | `trpc.generation.analyzeReference.useMutation` | `castingRefinement.ts` | `analyzeReference` | **OK** |
| `useCastingViewGeneration.ts` | `trpc.generation.fullBody.useMutation` | `castingImaging.ts` | `fullBody` | **OK** |
| `useCastingViewGeneration.ts` | `trpc.generation.multiView.useMutation` | `castingImaging.ts` | `multiView` | **OK** |
| `useCastingViewGeneration.ts` | `trpc.generation.generateAllViews.useMutation` | `castingImaging.ts` | `generateAllViews` | **OK** |
| `useCastingExport.ts` | `trpc.generation.mint.useMutation` | `castingExport.ts` | `mint` | **OK** |
| `useCastingExport.ts` | `trpc.generation.generatePdf.useMutation` | `castingExport.ts` | `generatePdf` | **OK** |
| `useCastingExport.ts` | `trpc.generation.upscale.useMutation` | `castingRefinement.ts` | `upscale` | **OK** |
| `useCastingExport.ts` | `trpc.generation.proxyImage.useMutation` | `castingRefinement.ts` | `proxyImage` | **OK** |
| `StudioHeader.tsx` | `trpc.profile.get.useQuery` | `profile.ts` | `get` | **OK** |

**Result: 18/18 calls verified. Zero mismatches. Zero missing procedures.**

---

## 2. Security Audit

| Check | Result | Details |
|---|---|---|
| Client-side Gemini API calls | **None** | Only footer link text mentions "gemini" — no `GoogleGenAI` or API key usage |
| Client-side S3/storage access | **None** | No `storagePut`, `storageGet`, `aws-sdk`, or `s3Client` imports |
| Hardcoded API keys | **None** | Only `VITE_*` prefixed env vars used on client; no raw keys |
| Auth on generation endpoints | **All protected** | Every generation procedure uses `protectedProcedure` |
| Reference image handling | **Correct** | Stored in client state (`ModelPreferences.referenceImage`), sent to server via tRPC mutation input |
| In-memory state that should be server-managed | **None** | Chat session state (`activeSession`) is correctly server-side in `geminiGeneration.ts` |

**Result: No security issues found.**

---

## 3. Dead Code — Old Casting Studio Components

The following files are no longer imported by any active component after the Phase 6 migration. They exist on disk but are unreachable from the component tree.

| File Path | Lines | Replaced By | Severity |
|---|---|---|---|
| `features/casting/components/BrandSelector.tsx` | 144 | Inline brand chips in new `ControlPanel` | **Cleanup** |
| `features/casting/components/EyeSection.tsx` | 127 | Inline eye grid in `WarmPrimitives.EyeGrid` | **Cleanup** |
| `features/casting/components/FaceSection.tsx` | 168 | Inline face chips in new `ControlPanel` | **Cleanup** |
| `features/casting/components/SkinSection.tsx` | 127 | Inline skin controls in new `ControlPanel` | **Cleanup** |
| `features/casting/components/PhysiqueSelector.tsx` | 70 | Inline physique chips in new `ControlPanel` | **Cleanup** |
| `features/casting/components/HairSection.tsx` | 149 | Inline hair builder in new `ControlPanel` | **Cleanup** |
| `features/casting/components/EthnicityBlender.tsx` | 185 | `WarmPrimitives.EthnicityBlender` | **Cleanup** |
| `features/casting/components/DirectorsNote.tsx` | ~80 | `MasterPromptPanel.tsx` (right sidebar) | **Cleanup** |
| `features/casting/ElapsedTimeDisplay.tsx` | ~45 | `LoadingOverlay.tsx` (inline tips) | **Cleanup** |

**Dead exports in `castingHelpers.tsx`** (the file itself is still used for `generateRandomPreferences` and `generateExportId`):

| Export | Reason Dead | Severity |
|---|---|---|
| `ConnectorLine` | Not imported anywhere | **Cleanup** |
| `BODY_ICONS` | Only used inside dead `PhysiqueSelector` | **Cleanup** |
| `FACE_ICONS` | Only used inside dead `FaceSection` | **Cleanup** |
| `CollapsibleSection` | Replaced by `WarmPrimitives.CollapsibleSection` | **Cleanup** |
| `SelectControl` | Replaced by `WarmPrimitives.WarmSelectControl` | **Cleanup** |
| `VisualOptionGrid` | Not imported anywhere | **Cleanup** |

**Dead server-side exports** (only referenced in test files):

| Export | File | Reason | Severity |
|---|---|---|---|
| `getBrandDescriptors` | `geminiPrompts.ts` | Deprecated alias, only in `geminiMigration.test.ts` and `geminiPhase5Integration.test.ts` | **Cleanup** |
| `getBrandDirectives` | `geminiPrompts.ts` | Deprecated alias, only in test files | **Cleanup** |
| `getNegativeConstraints` | `geminiPrompts.ts` | Deprecated alias, only in test files | **Cleanup** |

---

## 4. Redundant Code

| Item | Location A | Location B | Issue | Severity |
|---|---|---|---|---|
| **`MasterPromptPanel`** (name collision) | `components/MasterPromptPanel.tsx` (102 lines) — compact button widget inside ControlPanel | `MasterPromptPanel.tsx` (405 lines) — full right sidebar panel in CastingStudio | Two completely different components share the same exported name. Location A is a small "Compact Prompt" button panel imported by `ControlPanel.tsx`. Location B is the full Profile/Spec/Amendments sidebar imported by `CastingStudio.tsx`. They serve different purposes but the naming is confusing. | **Warning** |
| `EthnicityBlender` | `components/EthnicityBlender.tsx` (185 lines) | `components/WarmPrimitives.tsx` (~40 lines inline) | Old version is dead. Only the WarmPrimitives version is used. | **Cleanup** |
| `CollapsibleSection` | `castingHelpers.tsx` | `components/WarmPrimitives.tsx` | Old version is dead. Only the WarmPrimitives version is used. | **Cleanup** |

---

## 5. Contract Mismatches

No type mismatches were found between:

- Zustand store state shapes and tRPC response types
- Client mutation inputs and server Zod schemas
- `ModelPreferences` type (used by form store) and the server's expected `preferences` input
- `GeneratedAsset` / `GenerationState` / `Amendment` types shared between client and server

The `constants.ts` file serves as the single source of truth for shared types, and both client components and server routers reference it consistently.

---

## 6. Missing Server Procedures

No new server procedures are required. The Phase 6 migration was purely a UI/visual overhaul. All new client-side functionality is rendering-only:

| New Client Feature | Server Dependency | Status |
|---|---|---|
| `TriBlendSelector` | None (local state → `castingVibe` in preferences) | **No server call needed** |
| `HairColorWheel` | None (local state → `hairColor` in preferences) | **No server call needed** |
| `LoadingOverlay` | None (reads `genState` from store) | **No server call needed** |
| `WarmEmptyState` | None (pure UI) | **No server call needed** |
| `MasterPromptPanel` (right sidebar) | Reads `currentMasterPrompt`, `currentTechnicalSchema`, `amendments` from store | **No server call needed** |
| Warm theme styling | None (CSS/inline styles) | **No server call needed** |

---

## 7. Prompt Engineering Patches 10–17 Preservation

Every patch was verified against the server-side prompt files. All are present, complete, and unmodified.

| Patch | Description | File | Lines | Status |
|---|---|---|---|---|
| **10** | Facial feature directives (specific values for every feature) | `geminiPrompts.ts` | 46–55 | **Intact** |
| **11** | Iris descriptions (15 detailed color maps with radial striations, fiber structures) | `geminiPrompts.ts` | 336–352 | **Intact** |
| **12** | Skin finish deferral ("defer to casting spec's skin finish") | `geminiPrompts.ts` | 217 | **Intact** |
| **13** | Body scoping (full body generation with gender-aware wardrobe, physique directive) | `geminiViews.ts` | 35–126 | **Intact** |
| **14** | Eye realism (iris texture, limbal ring, catchlights, corneal gloss, pupil, sclera) | `geminiPrompts.ts` | 222–228 | **Intact** |
| **15** | Matte/dewy overrides (4 distinct finish modes with specific specular behavior) | `geminiPrompts.ts` | 309–322 | **Intact** |
| **16** | Eyelash rendering (individual strands, irregular clumping, micro-shadows) | `geminiPrompts.ts` | 229–232 | **Intact** |
| **17** | Lip & eyebrow detail (plicae, moisture gradients, organic borders, hair strands) | `geminiPrompts.ts` | 233–240 | **Intact** |

Additionally verified that the following advanced prompt features remain intact in `geminiGeneration.ts`:

- **Signal Priority Hierarchy** (P1 user explicit → P2 brand → P3 vibe) — lines 143–163 of system instruction
- **Ethnicity Phenotype Lock** — lines 422–437 of `generateCastingImage`
- **Chat Session Persistence** (3-path architecture) — lines 467–551
- **Identity Lock / Attribute Transfer Protocol** — lines 626–661 of `buildIterationImagePrompt`
- **Ink Realism Protocol** — lines 589–602
- **Skin Feature Protocol** (scars/birthmarks) — lines 604–613
- **Framing Lock** (headshot geometry enforcement) — lines 571–579

---

## 8. Recommended Actions

### Immediate (before next feature work)

1. **Rename `components/MasterPromptPanel.tsx`** to `CompactPromptButton.tsx` or `PromptCompactWidget.tsx` to eliminate the naming collision with the right-sidebar `MasterPromptPanel.tsx`. This is the only **warning**-level finding.

### Deferred (cleanup sprint)

2. **Delete dead component files** (9 files, ~1,095 lines): `BrandSelector.tsx`, `EyeSection.tsx`, `FaceSection.tsx`, `SkinSection.tsx`, `PhysiqueSelector.tsx`, `HairSection.tsx`, `EthnicityBlender.tsx`, `DirectorsNote.tsx`, `ElapsedTimeDisplay.tsx`.

3. **Clean up `castingHelpers.tsx`**: Remove dead exports (`ConnectorLine`, `BODY_ICONS`, `FACE_ICONS`, `CollapsibleSection`, `SelectControl`, `VisualOptionGrid`). Keep `generateRandomPreferences`, `generateExportId`, and `LOADING_TIPS`.

4. **Remove deprecated aliases** from `geminiPrompts.ts` (`getBrandDescriptors`, `getBrandDirectives`, `getNegativeConstraints`) and update the 2 test files that reference them.

5. **Split `geminiGeneration.ts`** (682 lines, over the 500-line limit): Extract `buildNewPromptContent`, `buildIteratePromptContent`, and `buildIterationImagePrompt` into a `geminiPromptBuilders.ts` file.
