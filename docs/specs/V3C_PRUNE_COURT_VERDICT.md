# A prune, measured — V3(c)'s three-arm court

> ## ⚠ CORRECTION, 2026-08-15, before this was acted on
>
> **This court did not measure a prune.** Every one of its three specimens took
> the DEPARTURE road, not the pruning road: their masters already wore earrings,
> so the arbitration correctly read the removal as base-worn and the recipe
> filed a VACANCY. The stored records say it plainly — `vacated:
> ["earring@left","earring@right"]`, `restated: null`, on all three.
>
> What the numbers below ARE is a real reading of the vacancy road on a chained
> face with a surviving step, and on that they hold. What they are NOT is a
> measurement of the carry derivation or the restate ask, which is what the
> heading claimed.
>
> The court has been rebuilt to pick specimens whose master wears no earrings
> and to ASSERT THE ROAD AT THE WIRE (`restated` non-null on the delivered row)
> before it reads a single arm — a court that cannot tell which road it drove
> can pass on the wrong one. See `V3C_PRUNE_COURT_VERDICT_2.md` for the run that
> answers the original question.

*Run 2026-08-15 against arms pre-registered in fable-534 §3 and written into the
script's header before the first call. **225 dev credits and about $1.00 of
house money**; the production ledger was not touched. Every frame is in
`output/prune-court/`.*

**Not an engine bench.** Every render went through `refineCandidate` exactly as
a customer's would — the interpreter reading a removal, the arbitration deciding
the chain put it there, the carry list derived from the surviving chain, and the
restate ask naming what was taken back.

---

## The verdict

```
(a) EVERYTHING ELSE still there   3 of 3     the copper hair survives the prune
(b) THE PRUNED THING reverted     3 of 3     the earrings are actually gone
(c) SAME PERSON throughout        3 of 3     each frame against its own parent
```

**PASS — a prune takes back what it named and leaves the rest of her alone.**

Per specimen, three real paid steps: *gold hoop earrings* → *colour her hair
copper* → *take the earrings off*. Specimen 1's strip
(`output/prune-court/1-strip.png`) says it without a number: hoops on both ears,
then copper hair with the hoops still there, then the same woman with the same
copper hair and no hoops.

## Why (a) is the verdict-maker

Proving the pruned thing left is easy — the master never had it and the render
anchors on the master, so *everything* leaving would score arm (b) perfectly.
Arm (a) is what separates a prune from a revert: the copper hair was added by a
step that SURVIVED, and it had to survive the render that took the earrings
back. It did, on all three.

That is the carry derivation doing its job at the wire: the earring row stopped
riding because the chain no longer names it; the hair row rode because it does.

## What the first run taught, before the numbers

Two things, and both were fixed in the DESIGN rather than in the verdict:

- **The specimen was already someone else's experiment.** It picked the face I
  had given horns to earlier the same night, so the reader spent both its
  answers describing a horn. The court now takes untouched faces only — a
  specimen carrying another chain measures that chain.
- **The survivor was unreadable.** *"Are the lips noticeably full"* came back
  false on a frame that had just been given fuller lips, so arm (a) could not be
  measured at all. Copper hair is unmistakable, and the question is about the
  prune rather than about the reader's threshold.

Neither failure was the product's, and neither was allowed to become a verdict
about it.

## The honest limits

- **n = 3, one shape of prune** — a chain-added ACCESSORY taken back with one
  surviving step beside it. A prune of an anatomy edit (her lips, her hair) is
  the same code path and is not measured here.
- **The pruned thing was always the LAST accessory step.** A prune of an earlier
  step with two later ones on top is the harder case and is not bought.
- **Identity was judged by the same reader family as everything else**, against
  each frame's own parent (the branch-state rule). Three affirmatives, each
  carrying its own `saw` about the face.
- **The intersection's key stayed at slot level.** fable-534 §3 said the key
  (slot-and-ask or finer) is decided by what turns arms (a) and (b) green
  together — they are both green at slot level, so nothing finer is bought yet.
