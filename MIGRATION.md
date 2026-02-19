# Casting Studio Migration Manifest

> **Goal:** Migrate from the current Casting Studio to the redesigned version with improved prompts, chat session persistence, identity drift checking, schema reconciliation, suggestion generation, and prompt compaction — while preserving all backend integrations (tRPC, credits, auth, S3, PDF).

---

## Phase Status

| Phase | Description | Status | Checkpoint |
|-------|-------------|--------|------------|
| 1a | Server prompts: constants + brand profiles | ✅ Done | 19582bce |
| 1b | Server: studio settings, identity anchor, retry logic, response helpers | ✅ Done | 19582bce |
| 1c | Server: prompt assembly (skin, iris, hair, ethnicity blend, vibe bands) | ✅ Done | 19582bce |
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

---

## Design Rationale & Patch History

> **Purpose:** This section documents *why* each design decision exists, what problem it solved, and which files it touches. During migration, if you are tempted to simplify, restructure, or remove any of these patterns — read the rationale first. Each one exists because the naive approach failed in production.

### DR-1: Lighting Directive Defers to Skin Finish Spec

**Files:** `geminiPrompts.ts` (BASE_STUDIO_SETTINGS, directive #2)

**Problem:** Early versions had a single lighting directive ("bright flash, specular highlights on forehead/nose/cheekbones"). This produced identical specular rendering regardless of whether the user selected Matte or Dewy skin finish. Matte-finish models appeared oily; Dewy-finish models looked identical to default.

**Solution:** The lighting directive now explicitly states: *"How the skin RESPONDS to this light (specular, matte, dewy) is defined by the casting spec's skin finish — defer to that."* This separates the *light source* (always the same studio flash) from the *surface response* (controlled by `getSkinDescription`). The Matte finish description says "NO specular hotspots"; the Dewy finish says "bright specular hotspots." The image model reads both and resolves correctly.

**Do not:** Merge the lighting and skin finish descriptions into one block. They are intentionally separate concerns — the lighting is constant (studio setup), the surface response varies per cast.

---

### DR-2: Per-Color Iris Descriptions

**Files:** `geminiPrompts.ts` (irisDescriptions record)

**Problem:** When the prompt said "blue eyes," Gemini rendered a flat, uniform blue disc. Real irises have radial striations, limbal rings, color gradients from pupil to edge, and undertone variation. The generic label produced CGI-looking eyes that killed realism.

**Solution:** Each eye color option maps to a detailed rendering instruction. "Ice" is not just "light blue" — it's "pale icy blue with near-white inner ring, high translucency, cool silver undertone." "Hazel" is "multi-tonal: amber-brown near pupil blending to green-grey at the outer iris, warm center cool edge." These descriptions give the image model enough specificity to render iris texture, not just iris color.

**Do not:** Replace these with simple color names. Do not merge similar colors (e.g., Ice/Sky/Azure are all "blue" but render very differently). The granularity is the point.

---

### DR-3: Brand Expression System (Separate from Brand Descriptor)

**Files:** `geminiPrompts.ts` (BRAND_PROFILES, getBrandExpression)

**Problem:** The original system had brand descriptors ("eclectic, quirky, unconventional beauty") but no expression direction. Every brand produced the same neutral face. A Gucci cast and a Balenciaga cast had different bone structure but identical expressions — which is wrong. Brand identity in fashion photography is communicated significantly through expression.

**Solution:** Two-layer system: (1) `BRAND_PROFILES[brand].descriptor` controls *which features to pick* and *how extreme to push them* (casting director decisions). (2) `getBrandExpression(brand)` controls *what the face does* in the photo (mouth position, eye gaze, bearing). These are separate because the descriptor is used during master prompt generation (LLM picks features), while the expression is injected during image generation (image model renders the face).

**Do not:** Merge descriptor and expression into one string. They are consumed at different pipeline stages by different models.

---

### DR-4: Signal Priority Hierarchy (P1 > P2 > P3)

**Files:** `geminiPrompts.ts` (MASTER_PROMPT_SYSTEM_INSTRUCTION)

**Problem:** When a user selected specific features (e.g., "Porcelain/Pale" skin) AND an ethnicity (e.g., "West African") AND a brand (e.g., "Prada"), the LLM would resolve the conflict by defaulting to the ethnicity's typical skin tone — overriding the user's explicit choice. Users felt their selections were being ignored.

**Solution:** Explicit priority hierarchy baked into the system instruction:
- **P1 (Absolute):** User-explicit features. If the user set it, it's final. Period.
- **P2 (Creative guidance):** Brand direction + ethnicity heritage. Used for features the user didn't explicitly set.
- **P3 (Intensity dial):** Vibe controls how extreme features are, never which features.

The example in the prompt is deliberate: "Porcelain/Pale skin on a West African heritage subject means pale-skinned with West African bone structure." This teaches the LLM that P1 and P2 can coexist without conflict.

**Do not:** Remove or soften the priority language. Without it, the LLM defaults to "ethnicity-typical" features and ignores user selections.

---

### DR-5: Eye/Hair Color Naturalization Rule

**Files:** `geminiPrompts.ts` (MASTER_PROMPT_SYSTEM_INSTRUCTION, CRITICAL RULES section)

**Problem:** When a user selected an unusual combination (e.g., mint green eyes on an East Asian model, or platinum blonde hair on dark skin), the LLM would add qualifiers like "artificial-looking mint green contact lenses" or "bleached platinum hair." This made the generated images look like costume/cosplay rather than natural casting.

**Solution:** Explicit rule: *"If the user specifies an unusual color, describe it as NATURAL. Never write 'artificial', 'colored contacts', 'dyed-looking', or 'unnatural.' Treat every user color choice as if the person was born with it."* The image model then renders the color as a natural genetic trait rather than an applied cosmetic.

**Do not:** Remove this rule. Without it, every unusual color combination gets the "artificial" qualifier, which fundamentally changes the rendered output.

---

### DR-6: SAFETY_SETTINGS = BLOCK_NONE

**Files:** `geminiClient.ts` (SAFETY_SETTINGS constant)

**Problem:** Default Gemini safety settings (BLOCK_MEDIUM_AND_ABOVE) blocked legitimate casting descriptions. Terms like "bare chest," "sub-malar hollows," "heroin chic," and "gaunt" triggered safety filters. Full body shots in activewear were frequently blocked.

**Solution:** BLOCK_NONE for all harm categories. This is specific to the Casting Studio workflow — other apps in the platform should use stricter settings. The comment in the code explicitly warns against unifying this with other apps' settings.

**Do not:** Change to BLOCK_MEDIUM or BLOCK_LOW. Do not unify with other app safety settings. Fashion casting has legitimate use of terminology that triggers false positives.

---

### DR-7: Retry Strategy — 503 Yes, 429 No

**Files:** `geminiClient.ts` (withSingleRetry503)

**Problem:** Early versions retried on all errors including 429 (rate limit). In a multi-user environment, retrying rate limits amplifies the problem — N users hitting rate limits simultaneously all retry, creating 2N requests, which triggers more rate limits.

**Solution:** `withSingleRetry503` retries ONLY on 500/503 (server errors — transient, worth retrying once). 429 errors surface directly to the user with cooldown guidance. The function name encodes this decision to prevent future developers from adding 429 retry logic.

**Do not:** Add 429 to the retry conditions. If rate limiting becomes a problem, the solution is request queuing or backpressure, not retry.

---

### DR-8: Identity Anchor — Structured Fields + Full Prompt

**Files:** `geminiClient.ts` (buildIdentityAnchor)

**Problem:** View generators (full body, side profile, back) received only the master prompt text. The image model would sometimes drift on key features — changing eye color, softening jawline, or losing tattoos between headshot and full body.

**Solution:** `buildIdentityAnchor` extracts structured fields from the technical schema (sex, age, ethnicity, skin tone, hair, eyes, face shape, jawline, cheekbones, nose, lips, eyebrows) and presents them as a bullet-point identity card, followed by the full master prompt. This gives the image model two chances to lock identity: once from structured fields (easy to parse), once from the full prose description.

**Do not:** Remove the structured fields and pass only the prose prompt. The structured fields are the primary identity lock; the prose is backup context.

---

### DR-9: Identity Consistency Check — Fail Open

**Files:** `geminiClient.ts` (checkIdentityConsistency)

**Problem:** View generation sometimes produced identity drift (different person in side view vs headshot). An identity check was needed, but blocking generation on check failure would create a worse UX than the drift itself — users would get errors instead of images.

**Solution:** `checkIdentityConsistency` uses a fast text model to compare source and generated images. If drift is detected, it logs a warning but does NOT block the generation. If the check itself errors (timeout, API failure), it returns `{ consistent: true }` — fail open. The warning can be surfaced to the UI as a non-blocking notification.

**Do not:** Make this check blocking (throw on inconsistency). Do not change the fail-open behavior. The check is advisory, not gatekeeping.

---

### DR-10: Chat Session Persistence via History Replay

**Files:** `geminiGeneration.ts` (activeSession, buildChatHistory)

**Problem:** Gemini's chat API maintains context across turns, which is essential for iterative refinement ("make the jawline sharper" → "now add freckles" → "undo the freckles"). Without session persistence, each iteration was stateless — the model couldn't reference what it did in previous turns.

**Solution:** In-memory singleton `activeSession` stores the chat session. On iteration, the session is reused. On NEW generation, the session is cleared and recreated. History replay strips images from older entries (to stay within token limits) but keeps the last 3 image-bearing messages and prepends the identity anchor.

**Do not:** Store full session state in the database (images are too large). Do not strip ALL images from history (the model needs recent visual context). The "last 3 image-bearing messages" threshold is a balance between context quality and token budget.

---

### DR-11: Ethnicity Phenotype Lock

**Files:** `geminiGeneration.ts` (generateCastingImage, ethnicity instruction block)

**Problem:** During iteration, the model would sometimes drift away from the specified ethnicity — a Korean model might gradually become more European-looking after several rounds of edits. The ethnicity was in the original prompt but got diluted by iteration instructions.

**Solution:** When `ethnicityBlend` is provided, a phenotype lock instruction is injected directly into the iteration prompt: *"ETHNICITY PHENOTYPE LOCK: This subject is [X]. Bone structure, skin undertone, and feature proportions MUST remain consistent with [X] heritage throughout all modifications."* This is injected at the iteration level, not just the master prompt level, so it persists across edits.

**Do not:** Move this to the master prompt only. It must be re-injected at iteration time because iteration prompts can override master prompt context.

---

### DR-12: Attribute Transfer Protocol

**Files:** `geminiGeneration.ts` (buildIterationImagePrompt)

**Problem:** When iterating with a reference image attached, the model would sometimes adopt ALL features from the reference (face shape, skin tone, everything) instead of just the requested attribute. A user saying "give her this hairstyle" while attaching a reference would get the reference person's face.

**Solution:** The attribute transfer protocol explicitly tells the model: *"TRANSFER ONLY the specific attribute requested. The subject's identity (face, skin, bone structure) MUST remain unchanged. The reference image is a STYLE GUIDE, not a face replacement."* This is injected only when both an iteration request AND a reference image are present.

**Do not:** Remove this protocol. Without it, reference-based iteration becomes face replacement.

---

### DR-13: Body Art Detection — Word Boundary Matching

**Files:** `geminiPrompts.ts` (hasBodyArt)

**Problem:** Simple `includes('ink')` matched "think", "drinking", "sinking" — any word containing "ink". This caused the tattoo persistence rule to fire on clean-skin models, adding unwanted tattoo rendering instructions.

**Solution:** `hasBodyArt` pads the input with spaces and uses ` ink ` (with spaces) for word-boundary matching. Additional patterns (wax seal, body branding, calligraphy tattoo) are matched with regex word boundaries. The function returns boolean, and `getStudioSettings` uses it to choose between CLEAN_SKIN_RULE and TATTOO_PERSISTENCE_RULE.

**Do not:** Simplify to `text.includes('ink')`. The false positive rate is unacceptable.

---

### DR-14: Model Fallback Chain (Pro → Flash)

**Files:** `geminiGeneration.ts`, `geminiViews.ts` (all generation functions)

**Problem:** `gemini-3-pro-image-preview` occasionally returns 503 or is temporarily unavailable. Without fallback, generation fails entirely.

**Solution:** Every generation function tries Pro first, then falls back to Flash. The fallback is sequential (not parallel) to avoid wasting API quota. A 1-second delay between attempts prevents hammering the API. The engine used is tracked in the response so credit costs can be adjusted (Flash = 50% of Pro cost).

**Do not:** Remove the fallback chain. Do not make it parallel. Do not remove the delay between attempts.
