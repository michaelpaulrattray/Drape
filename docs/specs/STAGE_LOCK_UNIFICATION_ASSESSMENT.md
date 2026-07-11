# Stage-lock unification — assessment (VC-R3b)

**Status:** awaiting founder ratification. No code changed beyond the ratified
D-44 label/semantics amendment. Requested at VC-R3b (2026-07-12).

## The defect that triggered this

Editing a **draft**, hovering a ghost slot fires the pre-D-39 sequential
pipeline: a `StageLockModal` — *"Lock Headshot & Generate Body? … You won't
be able to return and edit the head without resetting the body generation."*
Two things are wrong:

1. **The copy is now false.** The immutability ruling (D-43) established that
   drafts are *freely editable* — nothing about generating a body forecloses
   editing the head. The threat describes a constraint that no longer exists.
2. **Two view systems run side by side, split by status.** A *minted* model's
   ghost opens the new tier dialog (`casting-open-package-upgrade` → the
   `CastModelModal` upgrade mode, remaining-slots pricing). A *draft's* ghost
   opens the old stage-lock generate flow. Same affordance, same visual, two
   entirely different behaviours depending on `status`.

## What the old stage system actually is

Purely client-side ceremony, no server contract behind it:

- **`useCastingViewGeneration`** — `handleGenerateFullBody`,
  `handleGenerateMultiView`, `handleAutoGenerateAllViews`, and the `nextStage`
  ladder (Full Body → Side View → Export). Each opens a `StageLockModal`
  before calling `generation.fullBody` / `generation.multiView`.
- **`isViewLocked`** (in `useCastingGeneration`) — once a downstream view
  exists, the upstream view's Refine panel is disabled and shows a locked
  overlay. **Already returns `false` in minted-edit sessions** (it checks
  `isMintedEditSession`), so today only *draft authoring* ever hits the lock.
- **`StageLockModal`** + the `setLockModal`/`closeLockModal` bindings.

## Is anything load-bearing? — No.

I traced the server generation path. Full-body generation
(`castingImaging.ts`) reads the **current** headshot from `model_assets` at
generation time (`assets.find(a => a.viewType === "frontClose")`) and passes
it as the reference. It depends on a headshot *existing*, **not** on it being
frozen. Multi-view reads `frontClose || frontFull` the same way.

So the lock never protected a prompt-chain invariant. What it crudely
pre-empted was **staleness**: if you edit the head after generating a body,
the body now derives from a face that changed. But:

- That is exactly what the package staleness ledger (D-29, as amended by
  D-39/D-43) is designed to *represent* rather than *forbid* — the body
  becomes a stale slot, regenerable, not a locked door.
- D-43 already ruled drafts freely editable and minted identities immutable
  (fork on change). The lock is the last artifact of the old
  "freeze-as-you-go" model that both rulings replaced.

**Conclusion:** nothing is load-bearing. The mechanics (read-current-headshot)
already do the right thing; only the ceremony (the modal + the lock overlay +
the false threat) needs to go.

## Proposed direction (matches the founder's) — ONE view system

1. **Draft ghosts open the same tier dialog as minted ghosts.** For a draft
   that isn't minted, "add views" *is* casting — so the draft ghost opens the
   **mint** dialog (`CastModelModal` mode `mint`), which already includes the
   hovered view in its Core/Production tiers. Minted ghosts keep opening the
   **upgrade** dialog. Both are the same component; the only fork is
   mint-vs-upgrade, which already exists. This unifies the two systems into
   one and deletes the `nextStage`→`StageLockModal` path.
2. **Retire the stage-lock entirely.** `isViewLocked` becomes constant
   `false`; `StageLockModal`, `setLockModal`/`closeLockModal`, and the
   `useCastingViewGeneration` stage handlers (`handleGenerateFullBody`,
   `handleAutoGenerateAllViews`, and the lock branch of
   `handleGenerateMultiView`) are removed. The Refine panel's
   `isViewLocked`/`unlockMode` logic simplifies to always-allow.
3. **Replace the threat with a soft informational line**, if anything at all:
   *"Views generate from the current headshot — later face changes mark them
   for refresh."* No lock, no "you won't be able to…", no modal.

### Collision check with the R3 minted-edit session mode — clean

Minted edits already bypass `isViewLocked`. The two actions on a minted model
stay distinct and coherent: **Save changes** = identity edit → the D-11
fork-or-keep dialog; **a ghost** = complete the package → the upgrade dialog.
Retiring the lock only extends "no lock" to drafts, which have no D-11 routing
to disturb (they mint, they don't fork). No conflict.

## Costs / surgery

| Area | Change | Risk |
|---|---|---|
| `ViewTabs` (authoring branch) | AddViewButton/`nextStage.action()` → open the mint dialog | low — ghost wiring already exists for minted |
| `useCastingViewGeneration` | delete stage handlers + `nextStage` lock ladder (keep the Export chip, re-anchored) | medium — `nextStage` also feeds the NextStepChip |
| `useCastingGeneration` | `isViewLocked` → `false`; drop `hasDownstreamDependencies` lock use | low |
| `StageLockModal` + bindings | delete component, `setLockModal`/`closeLockModal` from `castingBindings` + `CastingWorkspace` | low — mechanical |
| `RefinePanel` | drop `isViewLocked`/`unlockMode` gating | low |
| `generation.fullBody` / `generation.multiView` endpoints | now unused by the unified path; leave in place (harmless) or remove | defer removal to R7 |

Estimated ~0.75–1d including the drive updates. No schema. No prod migration.

## Folded in: D-44 walk gate

D-44 ratified the sixth slot as a deliberate **walk** and made its identity
gate **mandatory**. Today only `backFull` is gated (`verifyBackView` in
`mintPackage`); `sideFull`/walk generates ungated. The unification should:

- Generalize `backViewGate` into a per-angle identity gate (the back prompt is
  back-specific; a walk is a dynamic side/full pose where the face may be
  partly visible, so its check can consider face + silhouette + build + hair).
- Gate `sideFull` with the same one-retry-then-named-and-refunded contract
  already proven for `backFull` (and now surfaced via the D-40 failed-slot
  work shipped in this batch).

This is the one net-new *capability* in the unification (the rest is deletion);
it rides the failed-slot surfacing that already landed.

## Recommendation

Proceed as proposed — it is pure simplification plus one ratified gate
addition, with nothing load-bearing lost. Await founder ratification, then land
as a single change with drive coverage (a draft ghost opens the mint dialog;
no `StageLockModal` reachable anywhere; walk generation passes/【fails-named】
its gate).
