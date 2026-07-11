# D-39 Assessment — canonical identity package, tiered mint, and the D-11 six-view seam

**Status: awaiting founder ratification. Nothing below is built.** Prepared 2026-07-11 against the code as of the post-VC-R1 fixes commit. Covers the founder's brief items 5a–5e and the item-6 seam verification. Companion to `DECISION_LOG.md` D-39 (proposed).

---

## 1. What the current studio view system supports (verified facts)

**Stored view types** (`model_assets.viewType`, and the canonical list in `boardOps`): `frontClose`, `frontFull`, `sideClose`, `sideFull`, `backFull` — **five**, all generated from the headshot anchor + `buildIdentityAnchor` text (the D-30-proven pattern).

**Generation functions** (`server/casting/geminiViews.ts`):
- `generateCastingImage` — the headshot (engine anchor).
- `generateFullBody` — `frontFull` from the headshot.
- `generateRemainingViews` — `sideClose` + `sideFull` + `backFull`, three parallel calls through `withImageQueue`, each: anchor image + "THE ATTACHED IMAGE IS THIS EXACT PERSON" + identity anchor + per-view clamps (`backFull` already carries "No new back tattoos").
- `generateSingleView('side' | 'walk' | 'back')` — one-at-a-time path (used by today's mint side-view option).

**Costs** (`CREDIT_COSTS`, server + client copies): castingImage 350 · fullBody 300 · multiView 300 · allViews 900 · exportPack 1500 · flash fallback ×0.5.

**Verification infrastructure:** `server/wardrobe/identityCheck.ts` (`checkIdentityMatch`) already does model-vs-result identity comparison for VTO — the exact shape of gate the back view needs, pointed at a different pair of images.

## 2. Per-slot capability and risk (5a)

| Slot | Exists today | Engine risk | Notes |
|---|---|---|---|
| Front headshot | ✅ `castingImage` | **Low** — it's the anchor | Default cast output; everything derives from it |
| Side profile (`sideClose`) | ✅ `generateSingleView('side')` | **Medium** — 90° rotation; shipped and working, occasional drift | Face cluster |
| **Three-quarter** | ❌ **net-new** | **Low** — ~45° is the safest rotation there is | Needs: prompt config, `viewType` value, asset plumbing, cost entry. The old context menu offered "3/4 View" as UI fiction — no backend ever existed. Face cluster's easiest win |
| Full-body front (`frontFull`) | ✅ `generateFullBody` | **Medium** — face is small at body scale; identity rides the text anchor | Body cluster |
| Full-body back (`backFull`) | ✅ in `generateRemainingViews` | **High** — past ~120° rotation is hallucination territory per the angles research; the existing "No new back tattoos" clamp is a text plea, not a gate | **Recommend: identityCheck-style gate** — adapt `checkIdentityMatch` to compare silhouette/build/hair (not face) against headshot + full-body front; one auto-retry on failure, then fail named-and-refunded (D-12/D-15 pattern). ~0.5–0.75d |
| Full-body side (`sideFull`) | ✅ in `generateRemainingViews` | Medium (90°, body scale) | **See the count question below** |

**⚠ Slot-count discrepancy — yours to rule.** The brief says **six** slots but names **five** (headshot, side profile, three-quarter, full-body front, full-body back). The system's existing sixth canonical view is **full-body side** (`sideFull`). Options: (a) sixth = full-body side (cheapest — it already generates); (b) the package is five and "six" was a miscount; (c) the sixth is something new (e.g., a detail/texture shot). The tier table below assumes (a); everything renumbers trivially if you rule otherwise.

## 3. Tiered mint (5b) — costs and shape

Additional-cost-at-mint, derived server-side per D-15 (numbers below are today's `CREDIT_COSTS`, shown with "~" for the flash fallback):

| Tier | Contents | Added views at mint | ~Credits | Copy intent |
|---|---|---|---|---|
| **Draft** | headshot only | none | **+0** | Exploring candidates — always allowed |
| **Core identity** | + side profile, three-quarter, full-body front | 3 | **~+900** | Ready for downstream work (VTO, boards) |
| **Production sheet** | all six | 5 | **~+1500** | Full comp card for scenes/video |

Notes: Draft replaces nothing — it's today's skip-side-view path made honest. The tier picker replaces the `CastModelModal` side-view checkbox; a server `plan()` endpoint derives the exact numbers (never client literals — the D-15 guard applies). Upgrading later costs the same as buying at mint (no penalty, per 5c's upgrade-anytime) — worth stating in the dialog copy so Draft doesn't feel like a trap.

## 4. Package completeness as a model property (5c) — and the data-model question to rule on

The brief makes the package a **model-level** property. That collides productively with D-29, which defined `cast_view` as **board-level** data records:

- Package slots naturally live on the **model** (`model_assets` rows) — they exist before any board placement, they're what VTO/scenes consume, and the takeover mints them.
- D-29's sheet, staleness, and pins were specced against **board** rows (`metadata.status`, `pinned` on `board_items`).

**Proposed resolution (needs your ratification — it amends D-29):** the model's package is the single source of truth. `model_assets` gains additive columns (`status` JSON, `pinned`, `sourceVersion`/provenance stamp); the R5 sheet renders the root node from the model's package; per-tile staleness/pins read and write model-asset state; **board-level `cast_view` rows never ship** — pop-out (D-29's work surface) becomes a board item that *references* a model asset. One staleness ledger instead of two. D-30's composer reads the same package and records the slots it used in each `InputSnapshot` (which also satisfies D-12 reproducibility for refreshes).

## 5. Composer budget (5d) — logged

Recorded in D-39: ~5–6 reference images per generation before fidelity degrades; multi-model scenes allocate headshot + one task-relevant view per model with the text identity anchor doing more work; full-package-per-model is never the strategy; staged composition is the logged (not scheduled) escape hatch for 3+ subjects. This is consistent with ratified D-30 strategy (b) — it adds a ceiling, changes nothing shipped.

## 6. Where it lands in the R-sequence (5e)

**Recommendation: a new R3b, between R3 and R4** (~2–2.5 focused days), rather than swelling R5:

| Piece | Size |
|---|---|
| Three-quarter view: prompt config + `viewType` + cost entry + studio plumbing | 0.5 |
| Back-view identity gate (adapt `checkIdentityMatch`; retry-then-refund) | 0.5–0.75 |
| Tiered `CastModelModal` + server `plan()` for tier costs | 0.75 |
| Package-completeness read model + `model_assets` additive columns | 0.25 |
| Composer slot-recording in `InputSnapshot` | 0.25 |

Reasoning: the mint dialog is takeover surface (R3-adjacent — the founder meets it every cast), and R5's sheet **consumes** slots that must already exist; building slot machinery inside R5 would balloon it to ~6d and put engine risk (back gate) on the critical path of the sheet checkpoint. R5 then renders empty slots + add-view affordances against machinery that already works. **Plan impact: +2–2.5d (remaining total ≈ 18–20.5d).** R3 (edit path) stays first and unblocked — tiers don't depend on it.

## 7. Item 6 — the D-11 seam at six-view scale (verification)

**What exists and scales fine:**
- Board-side: `markNodeStatus` (per-item stale/error), `NodeStatusBadge`, `pinned` exemption, `board_edges` + `getEdgesForItem`, and the `plan/execute` scaffold with server cost derivation. Blast-radius **counting** is a sum over package slots + edge-connected downstream nodes — nothing in the architecture caps it at 1–2; six is a number, not a redesign.
- Generation throughput: `generateRemainingViews` already runs 3 parallel through `withImageQueue` (`GEMINI_IMAGE_CONCURRENCY` default 5); a full six-slot refresh is queue-bounded and safe. Cost of a full-package refresh ≈ ~1800 credits — the D-11 dialog must show it (plan-derived), which the ratified machinery already requires.

**What the takeover move exposed (flags):**

1. **The stage-lock is philosophically opposite to D-11 and will block R3 if untouched.** The studio's only blast-radius guard today is a linear lock chain (`isViewLocked`: headshot locks once full-body exists → full-body locks once side exists → `backFull` always locked) + `StageLockModal`. It *prevents* edits; D-11 *propagates* them. In the R3 edit path, a minted cast opened for editing would arrive with its headshot **locked** the moment the package has views — making identity editing impossible. R3 must add a session mode: draft authoring keeps the stage-lock; minted-edit mode disables it and routes every save through `applyModelEdit` → the D-11 dialog (update-with-cascade / fork-as-new-model / keep-old+pin). This is the one thing the takeover move genuinely "broke" — latently; R3 would have collided with it.
2. **The edit mode must live in the shared workspace, not the takeover shell.** Stores are shared between the takeover and `/studio` (ratified session-bleed behavior) — a half-done edit session resumed in `/studio` must carry the same D-11 routing, or the studio becomes a D-11 bypass. Mode flag belongs in store state consumed by `CastingWorkspace`.
3. **Per-view staleness needs the model-level home** (§4's data-model ruling) before R5 — board `metadata.status` can't hold package staleness for views that aren't board items.
4. **Pin semantics move with it**: pin today is board metadata; under §4 it becomes a model-asset property surfaced on sheet tiles. Same behavior, different ledger.
5. Refresh regenerations must write fresh `InputSnapshot`s (current headshot + identity text per D-30's stale-input rule) — the composer slot-recording from 5c is exactly this; no extra machinery.

**Item-4 keyboard confirmation (post-resequence R4 scope):** Duplicate, delete + undo + `Cmd+Z`, arrow nudge, Esc layer stack, `Cmd+A`, Enter, and the full Decision-7 table are all in R4 as ratified. **Copy Image** (clipboard) survives in the stripped context menu. **Node copy/paste (`Cmd+C`/`Cmd+V`) is NOT in D-16's ratified keyboard table** — Duplicate covers the need; if you want clipboard paste of nodes, that's a D-16 amendment to rule on, not something R4 silently contains.

---

**Decisions needed from you, compactly:** (1) the sixth slot — full-body side, five-only, or something new; (2) the §4 data-model ruling — model-level package as single source of truth (amends D-29); (3) R3b placement + the +2–2.5d plan impact; (4) back-view gate approach (identityCheck adaptation, retry-then-refund); (5) whether node copy/paste joins D-16 or Duplicate suffices. On ratification I fold R3b into the build plan and rewrite the affected doc sections.
