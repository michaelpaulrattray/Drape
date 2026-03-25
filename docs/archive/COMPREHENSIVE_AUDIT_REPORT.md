# FormaStudio — Comprehensive Casting Studio Audit Report

**Author:** Manus AI
**Date:** February 19, 2026
**Scope:** 9-dimension deep code trace covering state flows, security, credits, error handling, cascade logic, export fidelity, prompt injection, session lifecycle, concurrent isolation, and prompt engineering preservation.

---

## Executive Summary

This audit traces every user action through the full stack — from button click to Zustand store update to tRPC call to server procedure to Gemini API and back. The codebase is in strong shape: **0 blockers** were found across all 9 audit dimensions. One **warning** was identified regarding concurrent user session isolation, and three **cleanup** items were flagged for deprecated code removal. All prompt engineering patches (10–17) are intact and unmodified.

| Dimension | Status | Blockers | Warnings | Cleanup |
|-----------|--------|----------|----------|---------|
| State Flow Verification | Pass | 0 | 0 | 0 |
| Credit & Rate Limit Coverage | Pass | 0 | 0 | 0 |
| Error Handling Parity | Pass | 0 | 0 | 0 |
| Cascade Invalidation Integrity | Pass | 0 | 0 | 0 |
| Export Fidelity | Pass | 0 | 0 | 0 |
| Prompt Injection Safety | Pass | 0 | 0 | 0 |
| Session Lifecycle | Pass | 0 | 0 | 0 |
| Concurrent User Isolation | Warning | 0 | 1 | 0 |
| Prompt Engineering Patches 10–17 | Pass | 0 | 0 | 3 |
| **Total** | | **0** | **1** | **3** |

---

## 1. State Flow Verification

Each of the 8 user actions was traced through the complete chain: UI event → Zustand store mutation → tRPC mutation/query → server procedure → Gemini API call → response parsing → store update → UI re-render. Every chain is complete with no broken links, missing functions, or type mismatches.

### New Cast

The flow begins when the user clicks "Cast" in the ControlPanel, which calls `useCastingGeneration.handleCast()`. This sets `isGenerating=true` and `stage='generating'` in the generation store, then fires `trpc.generation.castModel.mutate()` with the user's preferences and resolution. On the server, `castingImaging.castModel` validates input with Zod, runs `checkRateLimit()`, wraps the operation in `withAtomicCredits(5)`, and delegates to `aiService.castModel()`. The AI service calls `generateMasterPrompt()` to produce the natural description and technical schema, then `generateCastingImage()` to generate the headshot. The response flows back as `{ imageUrl, masterPrompt, schema, engineUsed }`. On the client, `onSuccess` calls `genStore.addToHistory()` to snapshot the current state, updates the current image/prompt/schema, and sets `stage='review'`. The ImageViewerPanel re-renders with the new image.

### Iterate (Refine)

The user types a refinement instruction in the RefineBar (or RefinePanel) and submits. This calls `useCastingGeneration.handleIterate(prompt, maskData?)`, which sets `isGenerating=true` and fires `trpc.generation.iterateCasting.mutate()` with the prompt, current image URL, master prompt, schema, resolution, optional mask data, optional reference image URL, brand, vibe, and ethnicity hint. On the server, `castingRefinement.iterateCasting` validates, rate-limits, and wraps in `withAtomicCredits(5)`. The AI service calls `enhanceUserPrompt()` to clarify the user's intent, then `generateMasterPrompt(ITERATE)` to update the spec, then `generateCastingImage(ITERATE)` which uses the 3-path architecture (chat iteration → chat NEW → stateless fallback). The response includes the updated master prompt, schema, and an amendment record. On the client, `addToHistory()` snapshots the previous state, applies cascade invalidation (deleting downstream views), and updates the current state.

### Expand to Full Body

The user clicks the "Expand to Full Body" CTA, which calls `useCastingViewGeneration.generateView('frontFull')`. This fires `trpc.generation.generateBodyView.mutate()` with the view key, headshot URL, master prompt, schema, resolution, brand, vibe, and ethnicity. On the server, `castingImaging.generateBodyView` validates, rate-limits, and wraps in `withAtomicCredits(5)`. The AI service dispatches to `geminiViews.generateFullBodyView()`, which builds a full-body prompt with identity anchoring from the headshot. The response flows back and `genStore.setViewImage('frontFull', url)` updates the views object.

### Generate Side Profile

Identical to the body flow but with `view='sideClose'`, dispatching to `geminiViews.generateSideProfileView()` on the server. The prompt includes strict profile angle directives and identity anchoring.

### Export Pack

The user opens the ExportModal and clicks "Export". `useCastingExport.handleExport()` fires `trpc.generation.mintCastingPack.mutate()` with the views object, master prompt, schema, and preferences. On the server, `castingExport.mintCastingPack` (protected, no credits) builds a ZIP using JSZip, iterating over the `{ frontClose, frontFull, sideClose }` views object. Each view with a URL is fetched and added as `{viewKey}_casting.png`. A `casting_spec.json` is also included. A PDF is generated with view images and schema data. The response returns `{ zipUrl, pdfUrl }` and the client opens download links.

### Undo / Redo

Pressing `Z` triggers `useCastingGeneration.handleUndo()` → `genStore.undo()`. The store checks `history.length > 0`, pushes the current state onto the `redoStack`, pops the last item from `history`, and restores it as the current state (imageUrl, masterPrompt, schema, views, amendments). Pressing `Shift+Z` triggers `handleRedo()` → `genStore.redo()`, which performs the inverse operation. Both operations are purely client-side with no server calls.

### Reference Image Upload

The user uploads a reference image via the MasterPromptPanel or ImageViewerPanel. The file is stored in `useCastingUIStore.referenceImage`. On the next iterate call, `referenceImageUrl` is included in the mutation payload. The server passes it as `additionalReferenceBase64` to `generateCastingImage()`, where it is sent as an inline image part to Gemini with the `ATTRIBUTE TRANSFER` protocol that locks identity from the source image and extracts only the requested attribute from the reference.

### Suggestion Click

Suggestions are loaded via `trpc.generation.generateSuggestions.useQuery()` which calls `castingRefinement.generateSuggestions` on the server (rate-limited, no credits). When the user clicks a suggestion chip, it triggers `handleIterate(suggestionText)`, following the same iterate flow described above.

---

## 2. Credit and Rate Limit Coverage

Every procedure that calls the Gemini API was audited for credit deduction and rate limiting. The table below shows the complete coverage map.

| Procedure | Credits | Rate Limited | Gemini Call | Verdict |
|-----------|---------|-------------|-------------|---------|
| `castModel` | 5 (`withAtomicCredits`) | Yes | Image generation | Correct |
| `iterateCasting` | 5 (`withAtomicCredits`) | Yes | Prompt enhance + image generation | Correct |
| `generateBodyView` | 5 (`withAtomicCredits`) | Yes | Image generation | Correct |
| `generateAllViews` | 10 (`withAtomicCredits`) | Yes | Multiple image generations | Correct |
| `enhancePrompt` | 0 | Yes | Text-only (prompt rewrite) | Correct — low cost |
| `generateSuggestions` | 0 | Yes | Text-only (suggestion list) | Correct — low cost |
| `reconcileSchema` | 0 | Yes | Text-only (schema update) | Correct — low cost |
| `compactPrompt` | 0 | Yes | Text-only (prompt compression) | Correct — low cost |
| `analyzeReference` | 0 | Yes | Text-only (image analysis) | Correct — low cost |
| `clearCastingSession` | 0 | No | None (clears server state) | Correct — no API call |
| `mintCastingPack` | 0 | No | None (ZIP/PDF assembly) | Correct — no API call |
| `generateCastingPdf` | 0 | No | None (PDF assembly) | Correct — no API call |

All image-generating procedures deduct credits atomically via `withAtomicCredits()`, which ensures credits are reserved before the Gemini call and refunded on failure. Text-only Gemini calls are rate-limited but do not deduct credits, which is an intentional design choice reflecting their lower cost. Non-Gemini procedures (session clearing, export assembly) require neither credits nor rate limiting. **No unprotected Gemini call path exists.**

---

## 3. Error Handling Parity

Every tRPC mutation in the client hooks was audited for error handling coverage. All three hooks (`useCastingGeneration`, `useCastingViewGeneration`, `useCastingExport`) implement consistent `onError` callbacks with the following error classification:

**Rate limit errors** are detected by checking `error.data?.code === 'TOO_MANY_REQUESTS'` and surface a cooldown toast with the retry-after duration. The `isGenerating` flag is reset to `false`, which re-enables the Cast/Iterate buttons.

**Safety refusals** are detected by checking if `error.message` contains "Refusal" and surface the refusal text in a descriptive toast. This matches the server-side pattern where `diagnoseResponse()` throws errors prefixed with "Refusal:" when Gemini returns text instead of an image.

**Generic/network errors** fall through to a catch-all that displays `error.message` in a toast and resets `isGenerating` to `false`. This re-enables the retry button without requiring a page refresh.

**Credit exhaustion** is handled by `withAtomicCredits()` on the server, which throws a `TRPCError` with code `PAYMENT_REQUIRED` before the Gemini call is made. The client surfaces this as a generic error toast with the message "Insufficient credits."

No error path was found where the UI would become stuck in a loading state after a failure — every `onError` handler resets `isGenerating` to `false`.

---

## 4. Cascade Invalidation Integrity

The cascade invalidation logic was traced through `useCastingGenerationStore.addToHistory()`. When a new generation result arrives, the method snapshots the current state into the history array, then applies cascade rules based on which view was active during the edit.

When `frontClose` (headshot) is edited, both `frontFull` and `sideClose` are deleted from the views object. This is correct because the headshot is the identity source — changing it invalidates all downstream views that were generated from it.

When `frontFull` (full body) is edited, `sideClose` is deleted. This is correct because the side profile references the full body for clothing/pose consistency.

When `sideClose` (side profile) is edited, no cascade occurs because it is a leaf node with no downstream dependencies.

The amendment log is appended with the new amendment from the server response. The schema and master prompt are updated atomically with the new values. The redo stack is cleared on any new edit, which prevents redo from restoring an inconsistent state where downstream views exist but the headshot has changed.

---

## 5. Export Fidelity

The export function in `castingExport.mintCastingPack` iterates over exactly three view keys: `frontClose`, `frontFull`, and `sideClose`. For each key that has a non-null URL, the image is fetched and added to the ZIP archive with the filename pattern `{viewKey}_casting.png`. A `casting_spec.json` file is also included containing the master prompt, technical schema, and user preferences.

The PDF builder in `generateCastingPdf` references the correct view labels ("Front Close", "Front Full", "Side Close") and maps them to the corresponding schema fields. No references to deleted or renamed views were found. The export correctly handles partial view sets — if the user only generated a headshot without expanding to body or side profile, only `frontClose_casting.png` is included in the ZIP.

Each export is assigned a unique ID via `generateExportId()` from `castingHelpers.tsx`, which produces a UUID-based identifier. This ID is associated with the model's master prompt for cross-app retrieval, enabling future applications to reference the exported model's identity.

---

## 6. Prompt Injection Safety

Four user text entry points were identified and traced through the prompt assembly pipeline.

The **refine bar input** (`iterationRequest`) is placed inside `USER INSTRUCTION: "${iterationRequest}"` within the `buildIterationImagePrompt()` function. It is contained within a clearly labeled section and never reaches the system instruction or structural directives. The surrounding prompt structure uses uppercase section headers (`STRICT PHOTOREALISTIC INPAINTING TASK`, `VISUAL RULES`, `CRITICAL GLOBAL CONSTRAINTS`) that establish the generation context before the user text appears.

The **custom features field** (`prefs.features`) is placed in `Additional Traits: ${prefs.features}` within the `buildNewPromptContent()` function. It is contained within the `MANDATORY FACIAL FEATURES (P1)` section, which is a data section rather than an instruction section. The system instruction is set separately via `config.systemInstruction` in the Gemini API call, which is architecturally isolated from the user content.

The **reference image** is sent as `inlineData` (binary image data), not as text. There is no path for text injection through image upload. The server's `analyzeReference` procedure extracts visual attributes from the image using Gemini's vision capabilities, but the analysis output is structured JSON that is validated before use.

The **suggestion text** follows the same path as the refine bar input when clicked, and suggestions themselves are generated server-side from the master prompt and schema — they are not user-authored text.

No path was found where user-provided text could overwrite system instructions, modify structural directives, or escape its labeled section.

---

## 7. Session Lifecycle

The undo/redo system was traced through `useCastingGenerationStore`. The `undo()` method checks that `history.length > 0`, pushes the current state (imageUrl, masterPrompt, schema, views, amendments) onto the `redoStack`, pops the last item from `history`, and restores it as the current state. The `redo()` method performs the exact inverse: checks `redoStack.length > 0`, pushes current to `history`, pops from `redoStack`, and restores. Both operations maintain referential integrity — the full state snapshot is stored, so undo/redo always produces a consistent state.

The `reset()` method (triggered on "New Cast") clears the history array, redo stack, amendment log, views object, and current image/prompt/schema. It also fires the `clearCastingSession` tRPC mutation, which sets `activeSession = null` on the server, destroying the Gemini chat session. This prevents stale conversation context from bleeding into a new casting.

The page unmount cleanup (in `CastingStudio.tsx`) also calls `clearCastingSession` to ensure the server-side session is cleaned up when the user navigates away.

---

## 8. Concurrent User Isolation

### Finding W-1: Module-Level Session Variable (WARNING)

**File:** `server/casting/geminiGeneration.ts`, line 54
**Code:** `let activeSession: CastingSession | null = null;`

The `activeSession` variable is declared at module scope, meaning it is shared across all requests in the Node.js process. When User A starts a casting session, `activeSession` is set to their Gemini chat object. If User B then starts a casting session before User A's next iteration, User B's session overwrites `activeSession`, and User A loses their chat context.

**Impact analysis:** The code has a graceful fallback built in. When a chat iteration fails (line 478–482), the handler catches the error, sets `activeSession = null`, and falls through to stateless generation (PATH 3). This means the worst case under concurrent use is that one user gets a stateless generation instead of a chat-based iteration — slightly lower quality due to loss of visual memory, but fully functional. No user data is stored in the session object (only a Gemini chat handle), so there is no cross-user data leak.

**Recommended fix:** Replace the module-level variable with a `Map<string, CastingSession>` keyed by user ID. The user ID is available in `ctx.user.id` from the tRPC context and can be passed through to the generation functions. This would provide true per-user session isolation.

```typescript
// Before (current):
let activeSession: CastingSession | null = null;

// After (recommended):
const userSessions = new Map<string, CastingSession>();
```

**Severity:** WARNING — functional degradation under concurrent use, but no security vulnerability or data leak.

No other module-level mutable state was found in the casting server files. All other state is either per-request (function parameters), per-user (Zustand stores on the client), or immutable (constants and prompt templates).

---

## 9. Prompt Engineering Patches 10–17 Preservation

Each patch was located in the server-side prompt files and verified to be intact, unmodified, and correctly referenced by the generation pipeline.

| Patch | Description | Location | Status |
|-------|-------------|----------|--------|
| 10 | Facial Feature Directives | `geminiPrompts.ts` lines 46–55 (system instruction) and `geminiGeneration.ts` lines 198–218 (`buildNewPromptContent` P1 features) | Intact — every facial feature has specific value requirements, bold/distinctive mandate, no vague values |
| 11 | Iris Descriptions | `geminiPrompts.ts` lines 336–352 (`irisDescriptions` record with 15 colors) | Intact — each color has detailed rendering instructions (radial striations, color gradients, translucency) |
| 12 | Skin Finish Deferral | `geminiPrompts.ts` line 217 ("defer to casting spec's skin finish") and `getSkinDescription()` lines 286–326 | Intact — studio settings defer finish to spec, getSkinDescription provides texture + finish combinations |
| 13 | Body Scoping | `geminiGeneration.ts` lines 567–579 (`frameDirective` + `framingLock`) | Intact — headshot: "DO NOT ZOOM OUT", full body: "HEAD TO TOE VISIBLE", crop rule for below-frame features |
| 14 | Eye Realism | `geminiPrompts.ts` lines 222–228 (IRIS TEXTURE, LIMBAL RING, CATCHLIGHTS, CORNEAL GLOSS, PUPIL, SCLERA) | Intact — each sub-feature has specific rendering instructions |
| 15 | Matte/Dewy Overrides | `getSkinDescription()` lines 310–318 | Intact — Matte: "NO specular hotspots, NO oil sheen"; Dewy: "hyper-hydrated glaze, bright specular hotspots" |
| 16 | Eyelash Rendering | `geminiPrompts.ts` lines 229–232 | Intact — individual strands, irregular clumping, micro-shadows, no mascara-heavy uniformity |
| 17 | Lip & Eyebrow Detail | `geminiPrompts.ts` lines 233–240 | Intact — lip plicae, moisture gradients, vermillion border; eyebrow individual strands, growth direction, natural gaps |

No patch has been simplified, truncated, or restructured. The prompt text matches the original implementation verbatim.

---

## Cleanup Items

### C-1: Deprecated Aliases in geminiPrompts.ts

**File:** `server/casting/geminiPrompts.ts`, lines 362–400
**Functions:** `getBrandDescriptors()`, `getBrandDirectives()`, `getNegativeConstraints()`

These three functions are marked `@deprecated` with JSDoc comments indicating they should be removed after Phase 1b/1c. A grep across the entire codebase confirms no active callers exist — all generation code now uses `BRAND_PROFILES[brand].descriptor`, `getBrandExpression(brand)`, and inline `technicalConstraints` respectively. These functions can be safely deleted to reduce maintenance surface.

**Severity:** Cleanup — no functional impact, but dead code that could cause confusion.

---

## Conclusion

The Casting Studio codebase passes all 9 audit dimensions with **0 blockers**. The single warning (W-1: module-level session variable) has a built-in graceful fallback and poses no security risk, but should be addressed before scaling to concurrent users. The three cleanup items are deprecated function aliases with no active callers. All prompt engineering patches (10–17) are preserved in their original form and correctly integrated into the generation pipeline.
