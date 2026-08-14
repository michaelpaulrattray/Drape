# A prune, measured on the road it actually drove — the second court

*Run 2026-08-15 after the first court was found to have measured the wrong road.
**275 dev credits and about $1.30 of house money** across two runs; production
untouched. Supersedes `V3C_PRUNE_COURT_VERDICT.md`, which now carries a
correction at its head.*

---

## Why there is a second court

The first one passed three times on the **departure** road. Its specimens
already wore earrings in their masters, so the arbitration correctly read *"take
the earrings off"* as base-worn and the recipe filed a vacancy — the pruning
road never ran. The stored rows say it plainly: `vacated:
["earring@left","earring@right"]`, `restated: null`, on all three.

**Nothing in that court could tell.** It scored its arms from the pictures and
never asked which road produced them.

## The two changes

1. **The pruned thing is HORNS.** No master has them — the detection court read
   0.0000% on every bare frame — so a horns step is one the CHAIN put there by
   construction. The specimen question is removed rather than answered.
2. **The road is asserted at the wire, before a single arm is scored.** After
   the removal render the stored row is read and `restated` must be non-null. A
   specimen that did not drive the prune is not scored at all.

## The readings

```
specimens that DROVE THE PRUNE   3   restated=["horns"] · vacated=[] on every one
(b) THE PRUNED THING reverted    3 of 3    the horns are gone
(c) SAME PERSON throughout       3 of 3    each frame against its own parent
(a) EVERYTHING ELSE still there  2 of 2 MEASURABLE   (see below)
```

Arm (a) was measurable on two of the three, and held on both — with **different
survivors**, which is worth more than three of one: copper hair on one face,
jet-black hair on another, each read as present before the prune and still
present after it.

On the third, the surviving step never delivered: *"give her a blunt fringe"* on
a buzz cut came back *"very short buzzed hair, no fringe visible"* BEFORE the
prune. There is nothing there to survive, so that specimen's arm (a) is
**unmeasurable rather than failed** — the script counts it as a miss, and this
verdict corrects the script rather than the other way round.

## What that means for the milestone

The pruning road does what V3(c) built it to do: the pruned thing goes, the rest
of her stays, and she is still herself — measured on the road, with the road
proved rather than assumed.

**The instrument lesson is the one worth keeping**: a court that cannot say
which road it drove can pass on the wrong one, and the artifact that settles it
(`internalPrompt.repaint.restated`) was already being written. It just was not
being read.

## The limits

- **n = 3 on the road**, and arm (a) rests on two of them.
- **One pruned kind (horns), one shape of chain** — the pruned step was the
  first of two, so this IS the mid-chain case fable-538 asked for on the arm it
  could measure, but with one surviving step rather than two.
- **The specimens are a shared database**: faces used by tonight's other courts
  hit the already-true door (*"she already has copper"*), which is the product
  working and the court's own supply problem. A clean pool would have bought
  three measurable (a) arms for the same money.
- **The pruned thing was always an OBJECT** (horns). A prune of an anatomy edit
  — her lips, her hair — is the same code path and is unmeasured.
