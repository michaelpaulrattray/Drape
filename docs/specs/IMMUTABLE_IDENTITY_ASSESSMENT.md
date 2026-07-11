# Assessment — minted casts as identity-immutable (amends D-11)

**Status: RATIFIED (founder, 2026-07-11), all four sub-decisions as recommended** — fork-only (dialog = fork-or-keep, no red); refinements are not staleness; v-chip hidden at v1, opens history at >1; immutability keyed off `status !== 'draft'` server-side. Logged as D-43 in `DECISION_LOG.md`; implemented same day; R5 scope reduced in `PASS_1_BUILD_PLAN.md`. Prepared 2026-07-11 from the VC-R3 drive directive.

---

## 1. The coherence argument (why your instinct is right by the system's own words)

Three places in the shipped product already assert immutability; R3's update path is the anomaly:

- The D-11 dialog's own copy: an identity change "makes this a different person." Updating-in-place to a *different person* under the same `modelId`, same name, same lineage is incoherent — the thing every downstream reference points at silently stops being the thing they referenced.
- The studio's read-only banner (pre-R3, still shipped): *"This model has been cast and their identity is locked."* The mint gate has claimed identity-locking since before the canvas existed. R3's minted-edit **update** quietly broke that promise.
- D-39's ratified data-model: the model-level package is the single staleness ledger, and `modelId` is the identity key VTO/scenes/video will compose against (D-30). An immutable `modelId` makes that key *trustworthy*; a mutable one makes every `InputSnapshot` a necessary defense instead of a nicety.

**Fork-only restores the original product stance.** Mint stops being "a name and an agency id" and becomes the moment identity becomes real — which is exactly what the tiered-mint copy (D-39: "ready for downstream work") is about to promise.

## 2. What this deletes from R5's staleness scope

Bigger deletion than it first looks:

| Staleness source | Under mutable identity (today) | Under immutability |
|---|---|---|
| Identity edit on a minted root | The whole package + downstream nodes go stale — the R5 headline flow | **Gone.** No identity event can occur on a minted cast |
| Draft identity edits | No staleness (drafts have no package until mint) | Same — nothing to stale |
| View refresh (quality redo) | Regenerate from unchanged root — no staleness created | Same |
| Refinement/surgical on a minted headshot (same person, new pixels) | Ambiguous — pixel drift vs identity | The only *candidate* left. Recommend: **not staleness** — same person means downstream references remain valid; D-12 snapshots already preserve exact inputs for reproducibility. At most a quiet "made from an earlier version" note in Info, no badges, no dialogs |

So R5's stale machinery shrinks from "the identity cascade system" to: **per-tile refresh (quality), pins as finished-work markers, and the aggregate-refresh plan dialog.** The `NodeStatusBadge` stale variant, `refreshStaleViews`, and the D-11 cascade options stay *built* (they shipped or are trivial) but their pass-1 trigger disappears; they become infrastructure waiting for pass-2 consumers (VTO outputs referencing a re-refined garment, etc.). **R5 sizing drops roughly 1–1.5d** (identity-dialog wiring into updateAttributes, cascade-count plumbing, update-later flows all vanish).

## 3. What the D-11 dialog becomes

**Fork-or-keep, no red.** On Save in a minted-edit session:

> **This is a new person** — changing {fields} on {name} means casting someone new.
> [ Keep editing ]  [ **Fork as new model** · ~350 credits ]

- The red confirm disappears from this dialog entirely — fork destroys nothing. **D-8's red retreats to delete-cascade only**, which sharpens it (one action wears red in the whole app: deleting work).
- Arguably the dialog stops being a "dialog of options" and becomes a confirm on the single paid action — it could even collapse into the Save button reading "Fork as new model · ~cost" once the session knows it's minted. Recommend keeping the interstitial for pass 1 (the copy teaches the model's immutability), revisit at R6.
- Drafts: unchanged — no dialog, free editing, the mint gate is the promotion route (D-42).

## 4. Impact on what was just built (small, honest sunk cost)

- `applyModelEdit`'s **update branch is deleted** (~60 lines server + the update leg of the BoardPage landing). Fork branch, `mergeAttributeChanges` (both cascade rules + dual-write — forks need them identically), the pending-fork overlay, jobs, and the whole takeover session machinery **survive unchanged**.
- Server guard becomes structural: `applyModelEdit` rejects `decision:'update'` when `model.status !== 'draft'` — immutability enforced where no client can bypass it.
- The bleed contract (bug-1) and drive invariants D/F stay exactly as-is; **invariant E swaps** from "update round trip" to "fork-only: Update is refused server-side + fork round trip" — cheaper to run, stronger claim.
- Version strip on minted casts: versions become refinement-only (R5's surgical/refine). **Recommend: hide the v-chip at v1, and at >1 the chip itself opens history** (the modal exists) — no `···` indirection needed; the "v1/v2 chip feels dated" question belongs to R6's strip redesign either way.
- `metadata.version` stamping (bug-2 fix) stays — refinements still count.

## 5. Downsides you may not be seeing (argued, none disqualifying)

1. **"Same person, small identity fix" is forced into a fork.** The founder casts, mints, then notices the eye color reads wrong on views. Under immutability that's a fork (new modelId, views regenerate, board node is a *new* node — lineage preserved but placement/wiring redone). Mitigation is real, though: that correction belongs in the **draft** stage, and the D-39 Draft tier exists precisely to make "not sure yet" cheap. The cost of immutability is discipline at the mint moment; the tier copy should say so ("minting locks this identity").
2. **Roster-iteration culture.** Brands iterating a hero model across seasons will accumulate fork chains (`forked_from` lineage). That's arguably honest — season 2's face IS a different person — but the library needs fork lineage to read well eventually (pass 2 curation concern, log it).
3. **Fork loses board context in multi-node boards.** If the original root has downstream wiring (pass 2+), the fork arrives unwired — correct (different person shouldn't inherit references) but the user may expect "swap this person everywhere." A future "replace on board" affordance is the answer if dogfooding asks; not pass 1.
4. **`locked` status semantics**: the models table already has `draft/active/locked/archived`. Immutability should be enforced against **not-draft**, not just `active`, or `locked` becomes a loophole.
5. Credits: neutral — fork costs what update cost.

## 6. Recommendation

Ratify immutability. It deletes more than it adds, restores three existing promises, makes `modelId` a trustworthy identity key before R3b builds the package on top of it, and shrinks R5. Implementation on ratification: ~0.5d (server guard + update-branch deletion + dialog copy/buttons + drive invariant E swap + D-11 amendment in the log + R5 scope note in the plan).

**Decision needed:** (1) ratify fork-only for minted casts (D-11 amendment); (2) confirm refinement/surgical edits on minted casts are *not* staleness events (quiet Info note only); (3) confirm the v-chip ruling (hidden at v1, chip opens history at >1); (4) confirm immutability keys off `status !== 'draft'`.
