# Ruling-4 Assessment — the casting takeover (D-35)

**Status: RATIFIED (founder, 2026-07-11).** Option B approved; D-24 re-ratified as inverted (guard verbatim); amend = D-11 identity event, no new concept; picker click-to-open permanent (auto-open closed); D-29/D-30 ratified alongside; environment restyle gets a named plan slot. R1–R7 approved — see `PASS_1_BUILD_PLAN.md` (R-sequence) and the Group 6d ratification record in `DECISION_LOG.md`. Prepared 2026-07-11 against the code as of the D-32…D-37 application commit. Scope ruled by the founder: (1) can `/studio` casting serve as the takeover's contents; (2) M7 impact; (3) scope delta + resequenced plan; (4) collisions with ratified decisions.

---

## 1. Can the existing `/studio` casting flow serve as the takeover's contents?

**Yes — and it should. The environment the ruling describes already exists and works; the job is hosting it, not building it.**

What the takeover needs vs. what `/studio?tool=casting` already has:

| Takeover requirement (ruling 4) | Exists today | Where |
|---|---|---|
| Attributes (full tactile config) | ✅ | `ControlPanel` + `WarmPrimitives` (blenders, grids, wheel) |
| Generation | ✅ | `useCastingGeneration` (param-taking since M2a) |
| Views | ✅ | `useCastingViewGeneration` (`nextStage`) |
| Surgical edits | ✅ | `ImageViewerPanel` + `MaskCanvas` (surgical + eraser) |
| Refinement | ✅ | `RefinePanel` chat-refine path |
| History | ✅ | generation-store history + the 4 version procedures |
| Save/mint → finished package | ✅ | `useCastGate` → `generation.mint` (side view → name → mint) |
| Landing on the board node | ✅ | `boardOps.fillFromLibrary(itemId, modelId)` — shipped in M4, stamps provenance + version row |
| Takeover shell (slim frame, Esc, back/close) | pattern exists | `ModelEditorOverlay`'s shell conventions (the double-click viewer) — ruling's named reference |

### Two hosting options

**Option A — route-hosted (cheapest, ~1.5–2d):** navigate to `/studio?tool=casting&new=1&returnTo=/app/board/:id&fillItem=:itemId`. `useStudioEntry` already handles the casting-new reset; add `returnTo`/`fillItem` handling + a mint-completion hook that calls `fillFromLibrary` and navigates back. Cheap because nothing is extracted. **Cost:** it is a page navigation, not a takeover — the board unmounts (state is server-side and the viewport persists, but the transition reads as *leaving*, and the sidebar/header of the studio come along). Does not match the ruled pattern.

**Option B — overlay-hosted (recommended, ~2.5–3d):** extract DrapeStudio's casting block (~70 lines of JSX + ~120 lines of hook wiring, `DrapeStudio.tsx:403–470` plus the hooks above it) into a `CastingWorkspace` component under `features/studio/`, and mount it inside a takeover shell in `BoardPage` (near-full-screen, slim frame, back/close, Esc — `ModelEditorOverlay`'s shell conventions, rebuilt clean). Open runs the same reset block `useStudioEntry` uses for `casting&new=1` (extract it into a callable). Esc with unsaved-work confirmation (casting holds paid in-progress state). On mint: `fillFromLibrary` → close → the untouched board with the filled root. The board stays mounted underneath — the exact image-viewer pattern the ruling names. Studio route keeps working by mounting the same `CastingWorkspace`.

**Savings vs. M8's planned build:** M8 was 4 focused days to *build* a `RefinementStudio` (props-only shell, `?edit=` hosting, three-column grid, four tabs, retire `ModelEditorOverlay`). Under Option B, all four tab contents already exist; M8 as a construction project disappears into the 2.5–3d hosting job — which *also* replaces M5's canvas popover work (2.5–3d), since attributes now configure in the environment. Net: **~6.5–7d of planned build collapses into ~2.5–3d of hosting + ~1.5–2d of edit-path wiring (§3).** `ModelEditorOverlay` still gets deleted (its refine/surgical are environment capabilities; its shell conventions live on in the takeover frame).

**The honest costs of reuse, stated plainly:**
- The environment is **warm-styled** (DS §13 was going to redesign these primitives for the canvas). The takeover ships in the studio's warm language first; restyling to canvas language is a deferred 1–1.5d polish item. This is the D-22/G.9 dissonance question answered in the opposite direction: the environment is a *room* with its own (warm) climate.
- The casting surface is **deeply store-coupled**: 50 references to the three casting stores + `useStudioStore` across 11 files. Hosting means the stores come along wholesale. See collision #1 — this inverts D-24's retirement story and needs your explicit sign-off.

## 2. M7 impact — what dies, what survives

**Dies on the canvas (view-spawning as UI):**
- View-node spawning + auto-row placement, per-view standalone cards as the default rendering (already proposed dead in D-29 — ruling 4 lands the same place from the other direction).
- `ViewsGenerationPopover` on canvas — view generation is environment capability (`+ Views` on the root strip becomes an *Edit-environment* entry or dies; decide at build).
- VC2.5's "chips fill in on the node" checkpoint (void — no chips on canvas, D-34).

**Survives, unconditionally (the stale/identity machinery):**
- `board_edges`, snapshots (`InputSnapshot[]`, D-12), `ImageFallback` compliance.
- `NodeStatusBadge` stale/error flow, pin semantics (`Keep old = pin`, D-21), `refreshStaleViews` as a canvas-side bulk action (refresh is not authoring — it's maintenance of finished assets, canvas-legitimate under ruling 4's "receives finished reference assets").
- The identity-change dialog (D-11 three options, plan-derived counts) — now fired by **environment save-back**: editing a placed cast in the environment ends in an op that restamps the root node and stales downstream per D-11. Same dialog, new trigger point.
- D-30's `composeIdentityPayload` + weighted-edge metadata — unaffected.
- D-29's character-sheet rendering — **moves in and gets stronger**: the environment mints the package; the sheet is how the package lands. D-29/D-30 should be ratified together with this plan.

**New (small) piece:** a landing/sync op — call it `boardOps.applyModelEdit(itemId)` — that, on environment save for an already-placed cast, restamps the node (image, version row, provenance) and runs the D-11 stale flow. Today `fillFromLibrary` covers first placement only; edits need the same landing path. ~0.5d, absorbed into R3 below.

## 3. Scope delta and resequenced plan

Remaining plan today (post-VC2): M2b 2 + M5 2.5–3 + M6 2.5 + M7 4–4.5 (with D-29) + M8 4 + M9 1.5–2 + M10 1.5 ≈ **18–19.5 focused days**.

| # | Milestone (resequenced) | Size | Checkpoint |
|---|---|---|---|
| R1 | **Casting takeover** — `CastingWorkspace` extraction, takeover shell (image-viewer conventions), reset-on-open, Esc + unsaved-work confirm, mint → `fillFromLibrary` landing, board untouched underneath | 2.5–3 | **VC3′ — drop → picker → Cast new → full environment → mint → root lands** (this is the old VC6 pulled forward) |
| R2 | M2b as ruled — server parser + gold-standard suite + prerequisites (BrandSelector, dedupe, overrides); surfaces as "from prompt" inside the create path | 2 | async before/after: prompt → parsed attributes visible in the environment |
| R3 | **Edit path + identity events** — Edit entry on the placed root (strip/toolbar), minted-edit semantics (see collision #5), `updateAttributes` op with both invalidation rules (audit D1), `applyModelEdit` landing + D-11 dialog + downstream staleness | 1.5–2 | VC4′ — edit a placed cast, watch the stale flow |
| R4 | M6 as planned — toolbar, fork/recast, variations, delete+undo, keyboard (rerun/recast route through the identity dialog) | 2.5 | the grammar tour |
| R5 | M7′ — edges, stale/pin/snapshots, character sheet (D-29), composer (D-30); no view-card spawning | 3.5–4 | lineage + staleness on the sheet |
| R6 | M9′ — first-run intro (CTA opens the picker), picker completion (filters, Add-menu placement path, empty states), thumbnails | 1.5 | first-touch |
| R7 | M10 hardening + criteria sweep (criteria 5/6/8 rewritten per D-29; inline-first criteria rewritten per D-33/D-35) | 1.5 | dogfood |
| — | *Deferred:* environment restyle to canvas language | (1–1.5) | polish pass |

**Total ≈ 15–16.5 focused days — saves ~3 days outright and removes the single riskiest build (M8's from-scratch studio) from the plan.** M5 and M8 disappear as construction projects; their server-side obligations (`updateAttributes` invalidation rules, version `tool` values) survive inside R3/R5.

## 4. Collisions with ratified decisions (surfaced, not resolved)

1. **D-24 inverts (biggest one).** D-24 ratified the three casting stores as *retirement-path* state that "dies when `/studio` retires." Under ruling 4 the studio casting surface **becomes the flagship casting environment** — the stores become load-bearing indefinitely (until a future props-only refactor nobody is scheduling). The mechanical guard survives verbatim (no store imports under `features/boards/**`; the takeover is `features/studio` code hosted by `BoardPage`), but D-24's *story* needs rewriting: the rule becomes a permanent architectural boundary, not a retirement fence. **Needs your explicit re-ratification.**
2. **D-25 boundary.** The takeover is a workspace in overlay form. D-25's argument against `ModelEditorOverlay` was "modal-with-scrim workflow"; ruling 4 sanctions the near-full-screen *room-as-overlay* (the image viewer precedent). Logged in D-35; `ModelEditorOverlay` itself still dies. No conflict if this distinction is the ruling — flagging that it narrows D-25 from "never an overlay" to "never a scrim-dialog."
3. **Locked inline-first principle** — amended by D-33/D-35 (logged; founder-initiated, permitted). The foundations' §3a posture and success criteria that assume on-node casting must be rewritten at R7.
4. **D-28** — "both paths at the node" became "both paths in the picker modal" (logged in D-32). The node keeps one front-door affordance.
5. **`isMinted` read-only vs. post-cast Edit.** The studio locks minted models (`DrapeStudio` `isReadOnly`). Ruling 3/4 requires *editing* placed casts in the environment. These directly conflict. Proposed resolution for your ruling: minted models open in an **amend mode** — every save is an identity event (D-11) writing new versions, never mutating the minted original silently. This is R3 work either way; the ruling needed is whether amend-mode edits re-mint (new model version) or version-in-place.
6. **D-21's empty-node Run-ghosted rule** — moot; Run lives in the modal/environment now (cost label discipline D-15 carries over — the modal already shows the server-planned `~350 credits`).
7. **Session persistence bleed.** `useSessionAutoSave` (localStorage) is shared: a half-finished takeover session would resume in `/studio` and vice versa. Probably desirable (one casting session, wherever you enter it), but it means "closes back to the untouched board" can coexist with a resumable in-progress cast. Needs a one-line ruling: shared session is a feature, or takeover sessions are isolated.
8. **Version bookkeeping duality.** Environment edits version *model assets*; the board node has its own version rows (D-23 wraps them). Rule proposed: node version rows remain the canvas-side ledger, stamped only by landing ops (`fillFromLibrary`/`applyModelEdit`) — the environment never writes node versions directly. Extends D-23's wrap-don't-duplicate.
9. **Picker auto-open vs. the create→drag trust invariant.** Ruling 4's flow reads "drop cast node → picker modal" (auto-open). VC2's ratified trust fix guarantees create→immediately-drag with no interference, and the permanent regression drive asserts it. Auto-opening a modal on drop breaks that gesture (and the drive). Applied today as click-to-open (the pill); if you want auto-open, it needs a placement-first design (e.g., open only for pill/menu adds, never right-click-place) — your call at R1.
10. **VC ladder renumbering.** VC2.5 void; the old VC6 (deep path) becomes the *first* checkpoint of the new sequence (R1). The checkpoint that actually needs your feel-judgment earliest is the takeover open/close transition — it is the product's core rhythm under this ruling.

---

**Recommendation:** ratify Option B with collisions #1 and #5 decided (proposed resolutions above), ratify D-29/D-30 alongside, and R1 starts at the takeover shell. If you want the cheaper proof first, Option A can ship in a day and be upgraded to B — but the transition feel is the thing ruling 4 is about, so I'd go straight to B.
