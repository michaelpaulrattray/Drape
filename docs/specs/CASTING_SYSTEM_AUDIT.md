# Casting system audit — the full state-machine map

**Status: REPORT ONLY — founder rules; nothing builds until ratified.** Commissioned at the round-4 walk hold (state note, commit `1d7bcb5`, 2026-07-13). Question: map the ENTIRE casting loop (draft → views → edit → staleness → refresh → mint) as a state machine — what the code actually does vs what the ratified law says — classify every divergence, and propose a repair sequence so fixes land on a map, not symptom by symptom.

**Method:** DECISION_LOG read in full (the law), plus the build plan, all four assessments, and the state note; then three code sweeps (per-view iterate gating; staleness writers/readers + every minted derivation; the mint-dialog flow) with every load-bearing claim verified first-hand at file:line. Fossil origins dated with `git log -S`.

---

## 1. The headline

**All six walk findings are root-caused, and the founder's era suspicion was right in shape but wrong in vintage.** The pattern is not primarily pre-D-46/pre-D-55 canvas eras surviving — the two worst findings come from *outside* that window:

- The per-view iteration inconsistency (side refuses, ¾ won't type) is **one line of February 2026 code** — a pre-canvas allowlist from the original linear studio, untouched through every canvas ruling.
- The lost mint-naming step is **not a legacy survival at all** — it is a fresh regression from the VC-R6-final round-2 fix batch (the state-aware tier dialog was built without a name field in its new branch).

The has-views⇒minted class the founder suspected does still exist (V10), but it is not what broke the walk.

### 1.1 The era model (four, not three)

| Era | Period | Doctrine | What survives from it |
|---|---|---|---|
| **0 — Linear studio** | Feb 2026, pre-canvas (Manus-era `/studio`) | Fixed generation sequence; side view *derived* from headshot+body, so not directly editable; per-view capability allowlists; the masterPrompt as a mutable running document ("FREEZE-AND-APPEND, matches SOT") | **V1** iterate allowlist, **V3** export maps, **V4** trio-based flags, **V5** unconditional masterPrompt mutation, **V14** un-composed iterate payload |
| **1 — Stage-lock** | canvas M-era → retired by D-46 (2026-07-12) | Edits forbidden by lock instead of represented by staleness | **V2** dead lock UI on constant-false flags; part of **V10** |
| **2 — Fused mint** | D-39/D-46 → reversed by D-55 (2026-07-13) | views ⇒ minted | **V10** session-flag minted inferences (r2 fixed three; two more found) |
| **3 — Current law** | D-53 ledger + D-55 decoupling + r3 fixes | Every slot change is a ledger row; identity forks; drafts iterate freely and stale siblings; mint is the immutability moment | Where specced, built correctly — the gaps are where the spec is silent (**V7**, **V11**) or where a fix round missed (**V8**, **V9**) |

The round-4 walk broke on eras 0 and "last Tuesday" — which is why symptom-by-symptom fixing kept losing: the r1–r3 rounds were correctly sweeping era 2 while the walk was tripping over era 0.

---

## 2. The state-machine map

Model states: **D0** draft, headshot only · **D1** draft with views (D-55) · **M1** minted, partial package · **M2** minted, full six. Views: `frontClose` (Headshot) · `threeQuarter` · `sideClose` (Side profile) · `frontFull` (Full front) · `sideFull` (Walk) · `backFull` (Full back).

Legend: ✓ = conforms to law · ✗Vn = diverges, see register entry Vn.

### 2.1 Iterate / refine (typed edit in the environment)

**Law (D-53 canonical statement, D-43.2, F3/F6):** every slot takes cosmetic iterate as a new ledger row; identity-level iterate is allowed on drafts (stales filled unpinned siblings; headshot edit stales the whole package) and refused on minted with the F4 fork copy. The gate is the *server classifier* — no per-view carve-outs exist anywhere in the law.

| View | D0/D1 actual | M1/M2 actual |
|---|---|---|
| Headshot | ✓ works; identity edit whole-package-stales (F6, unit-proven) | ✓ cosmetic works / identity refused (A1 seal) — but see ✗V5 below |
| Full front | ✓ / ✗V5 | ✓ seal correct / ✗V5 |
| Full back | ✓ / ✗V5 | ✓ / ✗V5 |
| **Side profile** | **✗V1** — refusal card: *"Side profile cannot be edited directly. Edit the headshot or full body instead."* (era-0 copy; no law supports it) | **✗V1** same |
| **Three-quarter** | **✗V1** — normal-looking refine bar, **silently disabled textarea**, no explanation ("won't accept typing") | **✗V1** same |
| **Walk** | **✗V1** — identical silent-disable (the founder hasn't hit this one yet; he will) | **✗V1** same |

Cross-cutting on every *allowed* iterate, draft or minted, cosmetic or identity: the model-level `masterPrompt` gets `APPLIED MODIFICATION: {feedback}` appended and `technicalSchema` rewritten — **✗V5** — with the emergent consequence **✗V6** (§3, V6). The surgical-edit tool and Enhance are gated on the same V1 allowlist, so masked edits — cosmetic *by construction* — are also unavailable on side/¾/walk (**✗V1**). The iterate plumbing itself is view-agnostic and correct: right asset id per view, real ledger ids since r2 (`performIteration` at `useCastingGeneration.ts:336,347`).

### 2.2 Staleness — write side

**Law (F3/F6, D-53, F4-as-ratified):** on a draft, an identity-classified edit (permanent marks deterministically) stales every other filled, unpinned head; pinned exempt; minted never stales (seal refuses upstream). Detection only — refresh regenerates against the current headshot, no propagation until calibration.

| Trigger | Actual |
|---|---|
| Draft + identity edit (incl. named mark) | ✓ fires deterministically (`namesAPermanentMark`)… but **✗V7**: the mark trigger is lexical/region-blind and `selectStaleSiblingHeads` is visibility-blind — a *forearm* tattoo stales the headshot close-up, a view that cannot show a forearm. No ruling ever specced visibility-aware staling; the walk finding is a law gap, not a mis-build. |
| Draft + cosmetic edit | ✓ no staling — but the edit text still enters the identity document (✗V5) |
| Minted + anything | ✓ sealed / no staling |
| Pinned siblings | ✓ exempt |

### 2.3 Staleness — read side

**Law (DS §5.17, D-51/§5.8-as-consolidated):** stale = 70% dim + tile dot; `{N} stale` pill segment → bulk-refresh dialog over the unpinned stale set; per-tile popover status line.

| Surface | Actual |
|---|---|
| Board tile dim + dot | ✓ renders — **✗V11**: zero copy anywhere on it (no tooltip, no label; the dot is unexplained) |
| `{N} stale` segment | **✗V8**: count includes a stale headshot (`useSheetController.ts:109`), which refresh structurally refuses (`refusalFor='identity_anchor'`) — strip says "5 stale", the dialog offers "Refresh 4 views", and after refreshing, the model is stuck at "1 stale" **with no in-product way to clear it** (the exits — iterate the headshot, or restore — are signposted nowhere) |
| Bulk-refresh dialog | ✓ honest copy ("regenerates against the current headshot… pinned views stay untouched") — undermined by ✗V6 |
| Environment strip | ✓ marks stale (r3 F5) — **✗V15** minor: thumbnails from the client store but staleness from the server query, different `staleTime` than the board (5s vs 15s), and active-view suppression exists only here |
| The staling *moment* | **✗V11**: nothing announces it. You type the tattoo edit, siblings flip stale silently; the one explanatory sentence in the whole product is a hover `title` on the environment strip. D-40 (feedback where the action happened) is violated in spirit at the exact center of the D-55 loop. |

### 2.4 Refresh / pin / restore / pop-out

| Op | Actual |
|---|---|
| Per-tile Refresh | ✓ plan-priced, refusals before money, back/walk identity-gated, named-and-refunded, status-agnostic (works on drafts, r2-proven) |
| Headshot Refresh | ✓ refused with F6 status-aware copy (draft → iterate-in-environment; minted → fork) — but the *tile still counts as stale*, feeding ✗V8 |
| Pin/Unpin | ✓ model-asset ledger, distinct from board pins (naming collision resolved R-5) |
| Restore ("Use this version") | ✓ copy-forward append, free, unpinned arrival, no-op guards, D-12 provenance |
| Pop out / collapse | ✓ edges written/pruned correctly (VC-R5 fix 1), nearest-free-slot placement (invariant U), slimmed toolbar per D-55 rider |

### 2.5 Mint / stays-draft / upgrade (the tier dialog)

**Law (D-55 + Fix 1, r2 defect 4):** stays-draft path on every tier, never demands a name (optional nickname); naming-as-identity fused to the mint moment; nameless mint refused; a placed draft's dialog leads with add-views and offers "Name & mint" as a distinct labeled door; every door says where it leads.

| Entry state | Actual |
|---|---|
| Fresh cast (takeover) | ✓ leads with mint, name field present ("Name — this mints her identity"), stays-draft second door |
| **Placed draft → Edit** | **✗V9**: the `addFirst` branch renders **no name input at all** — `canMint` requires a name nothing can set, so the "Name & mint" door renders permanently disabled (tooltip: *"Enter a name to mint her identity"* — with no field to enter it in). The naming step isn't lost after an identity edit specifically; it is structurally dead for **every** placed-draft edit session. The node's own menu promises the opposite: "Edit — name and mint this draft." |
| Minted → Edit (upgrade) | ✓ fixedName, remaining-slot pricing, no name field by design |
| Nameless mint | ✓ refused at the router — single point of defense; `executeMintPackage`'s mint branch has no internal guard (hardening note, §4 Batch A) |
| stayDraft threading | ✓ `mint:false` + optional nickname; no `isMinted` flip; real asset ids; status stays `draft` server-side; mint atomicity confirmed (`mintModel` sets status+agencyId+mintedAt together) |

### 2.6 Identity edit / fork / session lifecycle

| Op | Actual |
|---|---|
| Draft identity edit (environment save / iterate) | ✓ free, no ceremony (r2) |
| Minted save → D-11 fork-or-keep | ✓ (E1b phantom-diff race remains open — pre-existing, logged for R7 in Group 6g; not new) |
| Fork | ✓ new unnamed draft, headshot-only, `forked_from` edge — arrives in exactly the D-55 walkable state |
| Session close | ✓ reset on every close (r3 F1, SD10); optimistic slot carry on close (F2) |
| **"Minted" derivation** | **✗V10**: four non-equivalent signals coexist — `model.status` (seal, stale-writer, resume), `!!agencyId` (packageState → comp-card verb), `prov.draft` = `status!=='active' && status!=='locked'` (boardOps), and **session flags**: `useStudioStore.ts:139` hardcodes *"Gallery-loaded models are always minted"* and `useCastGate` sets `isMinted` from the gate action. r2 declared the chain "status-driven end-to-end"; these two are the stragglers. The schema's `locked`/`archived` values partition differently at different sites (an archived model reads as a *draft* through boardOps). |

### 2.7 Export / display

| Op | Actual |
|---|---|
| Export identity pack | **✗V3**: the export/PDF view maps predate D-39 and omit `threeQuarter` — the ¾ view silently never exports |
| Viewer status labels | ✗V3 (minor): `VIEW_DISPLAY_NAMES` has three keys; other views show raw ids |
| "All views" flags | **✗V4**: `useResumeDraft` / `useSessionPersistence` / `CastingWorkspace` compute `hasAllViews` from the era-0 trio — wrong universe post-D-39 |
| Double-click routing | ✓ D-54 as ruled (tiles → environment focused; viewer for image-class cards) |

---

## 3. Divergence register

Classification key: **LEGACY(n)** = era-n survival · **BUG** = defect against settled law · **WIRING** = ratified but never built · **GAP** = no ruling covers it (founder design territory) · **DOCS** = documentation era-lag.

| # | Class | Finding | Mechanism (verified) | Law |
|---|---|---|---|---|
| **V1** | **LEGACY(0)** | Side/¾/Walk cannot iterate; side shows fossil refusal copy; ¾/walk silently disabled; surgical edit + Enhance also hidden on those views | `useCastingGeneration.ts:205-207` allowlist `['frontClose','frontFull','backFull']`; `RefinePanel.tsx:105-108` sideClose-only reason string; `:222` `disabled={!isIterationAllowed}`; `ImageViewerPanel.tsx:343`. Origin: `f0ff3ba`/`8f0224b`, Feb 2026 | D-53 gives every slot cosmetic iterate and drafts identity iterate; the server classifier is the only sanctioned gate. The "side is derived" model died with D-39's six independent slots. |
| **V2** | LEGACY(1) | Dead stage-lock UI still shipped: "View locked/Unlock" branch, "Locked source" pill, threaded constant-false `isViewLocked`/`hasDownstreamDependencies` | `useCastingGeneration.ts:202-203`; `RefinePanel.tsx:151-168`; `ImageViewerPanel.tsx:365-372` | D-46 retired stage-lock; its R7 log item 4 already names the plumbing — this extends it to UI |
| **V3** | LEGACY(0) | Export/PDF maps omit `threeQuarter`; `VIEW_DISPLAY_NAMES` 3 keys | `useCastingExport.ts:58-62,125-130`; `ImageViewerPanel.tsx:14-18` | D-39 six-slot package; export-as-verb (Group 6i) |
| **V4** | LEGACY(0) | `hasAllViews`/`hasFullBody` from the old trio | `useResumeDraft.ts:56-67`; `useSessionPersistence.ts:94-101`; `CastingWorkspace.tsx:77-82` | D-39 package-completeness is a model property (`packageState`) |
| **V5** | LEGACY(0) + WIRING | Every iterate — cosmetic or identity, draft or minted — appends to `masterPrompt` and rewrites `technicalSchema` | `castingRefinement.ts:105,179-182` ("FREEZE-AND-APPEND, matches SOT"), unconditional inside the paid op | A1 Option A (ratified in the D-53 bundle) included scoping masterPrompt mutation; never shipped. D-43.2's "per-view feedback belongs to the view's record, not the identity document" |
| **V6** | BUG (emergent, law contradiction) | **Accidental text-channel mark propagation.** A draft's tattoo edit enters `masterPrompt` (V5); refresh composes `buildIdentityAnchor(masterPrompt)` as the identity text (`composeIdentityPayload.ts:101`) — so "regenerates against the current headshot" may in fact *carry the mark via text*, unreliably. The system is neither F4's detection-only nor its calibration-gated propagation: it is uncalibrated dice-throw propagation — the exact class F4's ratification forbade (*"trust behavior should never be a dice throw"*) | F4 (founder-ratified 2026-07-13): detection ships, propagation is calibration-gated |
| **V7** | **GAP** | Forearm tattoo stales the headshot: mark trigger is lexical/region-blind (`MARK_PATTERN`, `editClassifier.ts:64-69`); `selectStaleSiblingHeads` (`:117-130`) stales every filled unpinned head with no visibility concept | F3/F6 spec "stale siblings" flatly; no ruling addresses whether a view that cannot display the mark is out of sync. Note V5 complicates the intuition: because the mark enters the identity *document*, every view including the headshot genuinely is out of sync *with the document* — the V7 ruling and the V5 ruling are one question wearing two faces. |
| **V8** | BUG | Stale count ≠ actionable: `staleCount` includes `frontClose` (`useSheetController.ts:109`); refresh/bulk structurally exclude it (`refreshSlots.ts:58-63`; `useSheetController.ts:211`) → "5 stale" strip, "Refresh 4 views" dialog, then a **permanently stuck "1 stale"** with unadvertised exits | F6 (headshot never refreshable) collided with the R5-era count; nobody reconciled the two read models |
| **V9** | BUG (fix-round regression) | Placed-draft Edit → tier dialog has a dead "Name & mint" door: the `addFirst` branch (`CastModelModal.tsx:69,135-140`) renders no name input; `canMint` (`:92`) needs `name.trim()`; only the fresh-cast branch (`:141-161`) has the field | D-55 Fix 1 + r2 defect 4: the mint door must exist and say where it leads. Introduced *by* the r2 defect-4 fix. |
| **V10** | LEGACY(1/2) | Four non-equivalent minted signals; `useStudioStore.ts:139` "gallery-loaded ⇒ minted" hardcode; `useCastGate.ts:101-104` gate-action inference; `locked`/`archived` partitioned inconsistently (`boardOps.ts:455,508`) | r2's own doctrine: status-driven end-to-end. (mintModel atomicity confirmed, so `status`/`agencyId` agree on the normal path — the hazard is the *other* two signals and the odd enum values) |
| **V11** | **GAP** | Staleness is silent: bare dot + dim, no copy on board tiles; no feedback at the staling moment; stuck-headshot state (V8) has no signposted exit; best copy in product is a hover `title` (`ViewTabs.tsx:67`) | DS specs the *rendering* (dim/dot/segment) but no ruling ever designed the divergence-loop *experience*. D-40's principle applies squarely. |
| **V12** | Architecture note | Two stale ledgers: model_assets (live, terse UX) vs board_items metadata.status (edge-propagation, rich badge copy, mostly dormant) | D-39's amendment moved staleness to model_assets; ledger B was left behind with the better UX. Pass-2 unification question — flag, don't fix now. |
| **V13** | DOCS | DS still says stale is "dormant in pass 1 — nothing sets stale (D-43)" (twice); headshot-tile copy is pre-F6; §5.17 predates the r3 world | r3 F3 lit the writer; F6 made copy status-aware |
| **V14** | LEGACY(0), logged | Iterate payload is un-composed: target view's own image only, no anchor/identity-text (A1 §1.1, still true), plus a binary `frame: HEADSHOT|FULL_BODY` param (`castingRefinement.ts:133`) — a ¾/side iterate would be framed FULL_BODY once V1 lifts | D-30's composer exists for view generation; iterate predates it. Interacts with the F4 calibration question — same payload-composition family. |
| **V15** | Minor wiring | Board vs environment observers: `staleTime` 15s vs 5s; env thumbnails from store but staleness from server; active-view suppression env-only | One read model, one cadence |

---

## 4. Repair sequence proposal

### Batch A — mechanical, no rulings needed (~1.5–2.5d incl. drive legs)

Everything here executes already-ratified law; none of it forecloses the §4.3 rulings.

1. **V1** — delete the allowlist (or derive from the canonical six); delete the sideClose reason string; surgical/Enhance follow automatically. The server classifier + seal is already the real gate. *Drive: iterate leg per view type (extend Y3/SD legs to ¾/side/walk).*
2. **V9** — name field in the `addFirst` mint door (the fresh-cast input, relocated); plus an internal empty-name guard in `executeMintPackage` (defense in depth). *Drive: SD13 — placed-draft Edit can name-and-mint.*
3. **V8 (count honesty)** — `{N} stale` counts the *actionable* set (same predicate as `bulkStaleRows`); the stale headshot surfaces as its own state, not a number that won't budge. Full stuck-state UX belongs to the V11 ruling; this fix just stops the arithmetic lying. *Drive: count == dialog rows always.*
4. **V2** — delete dead lock UI + constant-false threading (extends D-46 R7 log item 4).
5. **V3/V4** — six-slot export maps + display names; `hasAllViews` from `packageState`/canonical list.
6. **V15** — one `staleTime`, staleness read from one source in the strip.
7. **V13** — DS reconciliation batch (stale-is-live, F6 copy, §5.17 touches).

### Batch B — status unification sweep (~0.5–1d)

**V10**: one exported `isModelMinted(model)` derivation (status-driven; `agencyId` as detail only); kill the gallery hardcode and the gate-action inference; decide the `locked`/`archived` partition once (tiny ruling, or fold `locked` into a migration note). Sweep every call site found in §2.6 — the r2 sweep pattern, one tier deeper.

### Founder rulings needed (the audit's actual questions)

- **R-A (V5+V6+V7 — one ruling wearing three faces): what is the identity document, post-D-53?** The era-0 model ("masterPrompt is a running mutable document; every edit joins the identity") collides with the D-53 model ("the ledger is the version history; cosmetic edits belong to the view"). Recommended shape, for your consideration: **(i)** cosmetic-classified edits stop mutating `masterPrompt` entirely (per-view feedback lives on the generation record — A1's unshipped line); **(ii)** identity-classified *draft* edits do enter the document deliberately — which makes stale-all-siblings *coherent* (every view is out of sync with the amended identity) and makes V7's forearm/headshot case *correct in data terms* while remaining wrong in *experience* terms — the fix for the walk finding is then V11's explanation, not a visibility engine; **(iii)** V6 resolves honestly in either direction: acknowledge the text channel (bulk-refresh copy says the edit rides along as description) **or** compose refresh payloads from the pre-amendment identity until F4's calibration rules. I recommend against visibility-aware staling (anatomy inference per mark per angle — engine-grade complexity for a copy-sized problem). Build after ruling: ~0.5–1d.
- **R-B (V11): the divergence-loop experience.** The staling moment (environment announces "3 views flagged out of sync" where the action happened, D-40), the dot's explanation (tile popover first line + tooltip), the stuck-headshot exit (signpost iterate-the-headshot/restore), and refresh-affordance discoverability. Minimal-honest version ~0.5–0.75d; this is R6's own remit — the D-55 walkable loop is its centerpiece.
- **R-C (V14, log-level):** iterate payload composition joins the F4 calibration scope (same roled-reference family) rather than getting its own track. No build now.

### Explicitly deferred (post-pass / pass 2)

V12 ledger unification · full propagation (F4 calibration, as already gated) · visibility-mapped staling (if R-A even wants it) · E1b hydration race (already on R7).

---

## 5. Sizing and the R6 call

| Chunk | Size |
|---|---|
| Batch A | 1.5–2.5d |
| Batch B | 0.5–1d |
| R-A build (after ruling) | 0.5–1d |
| R-B minimal-honest build (after ruling) | 0.5–0.75d |
| **Total to a walkable, honest loop** | **≈ 3–5 focused days** + two rulings |

**Recommendation: R6 closes AFTER Batch A + V8/V9 + the R-B minimal build, i.e. after the repairs.** Reasoning: R6's ratification object *is* the D-55 walkable loop, and V1/V8/V9/V11 sit directly on its path — a round-5 walk today fails at the same four places regardless of any other polish. Batch B and the R-A build could technically slide to R7's hardening slot, but R-A's *ruling* should land now: it determines V6's honesty fix, V7's framing, and the F4 calibration's inputs — deciding it after R6 closes would re-open ratified copy. The deep items (propagation, ledger unification, visibility mapping) do not block close and are already gated elsewhere.

One process note, offered not ruled: three of the four walk-breakers were invisible to every drive because the drives assert the paths the law names, and eras 0's fossils live on paths no ruling ever looked at. Batch A's drive legs are written per-view and per-door for exactly that reason — coverage keyed to the *surface inventory*, not to the rulings.

**For ratification:** Batch A (execute), Batch B (execute now or R7), R-A and R-B (rule), R-C (log). Nothing here has been built.
