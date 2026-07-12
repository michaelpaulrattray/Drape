# Per-view edit coherence — assessment (VC-R5 A1)

**Status: RATIFIED (founder, 2026-07-12 — D-53, combined with A3).** Stage 1 (the seal: identity-level edits refused on minted via `editClassifier`) shipped same day; stage 2 (fork-guidance UI + the draft stale-writer, Option A + B-lite) lands as part of the D-53 rider on R6's environment-restyle slot. Original question: the casting environment lets you type edits against a single generated view; an edit like "add tattoos" on the full-body diverges that view from the rest of the package. What does the current path actually do, what guards coherence, and what's the right model?

---

## 1. What the current path actually does (verified against code)

The hover edit bar is `RefinePanel` ("Describe a change…", `client/src/features/casting/components/ImageViewer/RefinePanel.tsx:200`), bound to the single active view; submit flows through `useCastingGeneration.performIteration` → `generation.iterate` (`server/routes/generation/castingRefinement.ts:25–165`). Surgical (masked) and Magic-eraser edits ride the same route. Per edit:

1. **It regenerates that ONE image only**, sending *only that view's own image* as reference (`:105–117`) — no headshot anchor, no identity text, no sibling views.
2. **It mutates the model-level spec**: the edit text is appended to the shared `masterPrompt` (`APPLIED MODIFICATION: …`, auto-compacted every 5) and `technicalSchema` is reconciled — an edit typed against the full-body rewrites the identity document every view generates from (`:80–92`, `:138–141`).
3. **It writes a NEW `model_assets` row** for that viewType (`:130–136`) — and because every read is newest-wins (`computePackageSlots`, `composeIdentityPayload`, `buildHistoryFromAssets`), **the edited image silently becomes the canonical view** the comp card renders and the composer sends downstream.
4. **Nothing guards coherence.** No identity check runs on this path (the gates live only in mint/refresh). No sibling is stale-marked (the package ledger's `stale` flag exists end-to-end on the read side but has NO production writer — dormant pass-2 machinery). A "brighten the lighting" edit and an "add tattoos" edit are indistinguishable to the system.
5. **Client-side inconsistency**: after an edit, the viewer locally *drops* downstream views from its strip (`useCastingGeneration.ts:358–365`) but the DB rows remain filled and current — the viewer and the package ledger disagree about the same package.

Cost: `CREDIT_COSTS.iteration` (350), atomic, refunded on failure — the money side is honest.

## 2. The finding that outranks the question: this is a live D-43 bypass

D-43 ratified minted identity as immutable — `applyModelEdit` structurally refuses `decision:'update'` on non-drafts (drive invariant E4), and D-46 rider 2 removed the ungated view endpoints for exactly this bypass class. **But `generation.iterate` accepts a minted model, rewrites its `masterPrompt`, and replaces its canonical views — no ceremony, no gate, no fork.** "Add tattoos" on a minted cast's full-body is an identity change (permanent marks) that lands outside the D-11 ceremony and immediately becomes the package's official view. Adjacent-surface inventory: surgical/eraser share the path (masked, so scoped by construction, but same persistence); upscale and the export-pack write nothing to the package (clean).

Whatever the founder rules on coherence UX, this hole is law-level, same class as the D-46 rider-2 endpoints.

## 3. Options (composable; costs are focused days)

### Option A — Classified edits: refine freely, identity edits route to law *(recommended core)*
Classify each edit server-side (one `TEXT_ECONOMY` call, same tier as the back gate: *"does this edit change permanent physical identity — marks, build, facial structure, hair identity — or is it styling/lighting/pose/quality?"*).
- **Drafts**: everything stays allowed (drafts are freely editable by law); identity-classified edits additionally stale-mark sibling slots (see B-lite).
- **Minted**: cosmetic/refinement edits allowed — D-43.2 already ratified refinements as same-person non-events (new version of that view, no ceremony). Identity-classified edits are **refused with fork guidance** ("This changes who they are — fork instead"), exactly the shape of the D-11 fork-or-keep copy. Also stop mutating `masterPrompt` on minted models for cosmetic edits (per-view feedback belongs to the view's generation record, not the identity document).
- Cost: **~1d** (classifier + refusal UI + masterPrompt scoping + tests). Risk: classifier false positives annoy — mitigate with a "this looked identity-level" soft warning + proceed on drafts, hard refusal only on minted.

### Option B-lite — Light the dormant stale-writer for identity-classified edits *(recommended companion)*
When a draft's view takes an identity-classified edit, mark sibling filled slots `stale` on `model_assets` — the ENTIRE read side already exists (comp-card dimming + dots, `{N} stale` strip segment, bulk-refresh dialog, composer stale-input warnings) and ships dormant; this is the missing writer, arriving exactly as pass 2 planned. Cosmetic edits mark nothing (D-43.2: staleness spam is the failure mode to avoid).
- Cost: **~0.5d** on top of A (the classifier is shared). Also fixes the viewer-vs-ledger disagreement by *replacing* the local sibling-dropping with honest ledger staleness (+0.25d).

### Option C — Post-edit identity gate (verifyViewIdentity on the edited view)
Run the mint-gate check (edited view vs current headshot) after every iterate; fail → named-and-refunded retry, like mint slots. Catches *unrequested* drift (the engine inventing changes) but is the wrong tool for *deliberate* divergence — the user asked for the tattoos; refusing their successful edit reads as a broken product. Useful as silent-drift insurance on minted-model cosmetic edits only.
- Cost: **~0.5d** (gate reuse + refund path). Optional layer over A.

### Option D — Package-level edits only (retire per-view free-text edit)
Identity coherence by construction: free-text edits apply at package level (the D-11 machinery already does this — drafts update + stale downstream, minted fork). Per-view keeps only masked surgical/eraser (cosmetic by construction).
- Cost: **~0.5d** (mostly deletion). But it destroys a genuinely good workflow (fixing ONE bad view without touching five good ones) and overshoots the law — D-43.2 deliberately blessed per-view refinement. Not recommended alone.

### Recommended bundle: **A + B-lite** (≈ 1.5–2d), folded into R6
R6 already restyles this exact surface (`ImageViewerPanel`/`RefinePanel` are named restyle scope) — the coherence model should land with the restyle rather than re-touching the surface twice. If the D-43 bypass alone feels urgent before R6: a minimal seal (refuse identity-classified edits on minted, ~0.5d of the A work) can ship standalone.

---

## Appendix — A2 sizing (lobby grace, R6-adjacent)

**(a) Library → Models card click teleports into wardrobe.** `LibraryView.tsx:119–124` navigates minted cards straight to `/studio?tool=wardrobe&modelId=…` (drafts → casting). Proposed: a modal-class chooser (D-32 sanctioned): **View comp card / Open in casting / Dress in wardrobe**. "View comp card" can reuse `CharacterSheetImageArea` statically over `generation.packageState` — the canonical card as a lightweight viewer, no new rendering system. Cost: **~0.5–1d** in R6.

**(b) Recent Work flooding.** The feed is already board/session/draft-grained with caps (8 total, drafts pre-capped at 6, one row per board — NOT per generation). The flood is **draft models**: every canvas cast/fork/variation candidate is an unnamed draft, and drafts are a feed source — six canvas candidates displace the boards/sessions the founder actually returns to. Cheapest honest cut: **exclude UNNAMED drafts** from Recent Work (D-42 already made unnamed the candidate marker; candidates live on their board, not in the lobby) — a one-line filter in `getUserDraftModelsWithThumbnail`'s feed usage. Named drafts (deliberate works-in-progress) stay. Cost: **~0.25d**; grouping-by-board or per-source caps are available escalations if exclusion isn't enough.
