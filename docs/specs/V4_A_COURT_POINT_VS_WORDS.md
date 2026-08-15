# A's court — pointing vs describing, and the noise floor that swallowed it

**Ordered:** fable-598 §4 ("his exact case as the arm … against the words-argued
baseline his own #194 provides", ~$1 house).
**Run:** 2026-08-15, dev fixture, 125 dev credits, five delivered renders and
four refunded ones.
**Verdict on the question asked: VOID.** The court cannot separate the two
wordings, because two renders of the *identical* recipe differ from each other
by as much as the effect it was built to detect.
**What it did settle, and it is the bigger fact:** a bug that would have taken
the carry away from every user the moment the repaint road widened. Fixed and
deployed (`facf19f1`).

---

## 1. The baseline, on the founder's own rows — free

His #193 delivered a matched pair of cross earrings; his #194 asked for a red
eye and carried both crops. Read with the standing constancy instrument
(geometry decides, per side, worst side is the verdict statistic):

```
#193 → #194     left  extent 1.080% → 1.023% of her face   drift  5.2%
                right extent 1.100% → 0.822%               drift 25.3%
                worst side (any axis)                            26.9%
```

His eye said *both drifted and the right one more*. The geometry agrees with his
eye, per side, without being told what to expect. That much is solid.

The instrument's own calibration: **0%** for one object photographed twice,
**26%** for two different deliveries of the same kind.

## 2. The court, and why it is paired

A fixture face compared against his frames would be two different women and two
different crosses. So both arms ran on ONE face, from ONE born pair, with ONE
ask, and the only difference between them was the sentence riding beside the
carried crops:

```
born          "give her dangly cross earrings"     both crops file, with digests
after point   "her right eye — fiery red"          the shipped fix (POINT)
after words   the same ask, same parent, same      the pre-fix describe()
              crops                                 restored by hand
```

Between arms the fixture is put back exactly as the born render left it: the
selection returns to the born version, the arm's variant row goes, and any
library row minted after the born snapshot is removed — verified by reading the
rows afterwards, where both earring rows are still id 99/100 with their original
digests. **Both arms carried the same two crops.**

## 3. What came back

```
                left extent   right extent   worst (any axis)
POINT              0.0%           6.1%            6.1%
POINT (repeat)    21.3%          25.2%           25.2%
WORDS             13.6%           3.9%           15.8%
WORDS (repeat)    12.3%           5.6%           12.3%

his own #193→#194  5.2%          25.3%           26.9%
```

**The two POINT runs are the whole story.** Same code, same crops, same ask,
same parent — and one carried a side at 0.0% while the other moved the same side
by 21.3%. The spread WITHIN one arm is larger than any difference BETWEEN the
arms (point mean 15.7%, words mean 14.1%).

So:

- The hypothesis in fable-598 — that his right earring drifted because its
  sentence sat furthest from what its own crop showed — **is not supported by
  this court**. A 25% drift happens with identical words on both sides too.
- His 26.9% is no longer distinguishable from ordinary render-to-render
  variation on this evidence. It may still be real; it is not proved.
- Nothing here argues against Fix A, and nothing here argues for it on drift
  grounds. It stands on the ground it was ruled on: one object gets one claim,
  and a sentence that argues with the picture beside it is incoherent by
  construction. It is not measurably better at holding an earring still.

## 4. The noise floor is the finding

**A carried crop's delivered extent varies by ~25% between renders of an
identical recipe.** That is the floor any future carry-fidelity court has to
beat, and it was never measured before — every reading in this chase, mine
included, treated a single render as the arm.

What a real verdict would cost, at this floor: separating a ~5-point effect from
a ~10-point spread needs roughly fifteen renders an arm — **~750 dev credits and
~$9 of house money**, an hour and a half of wall clock. That is a founder call,
not an overnight purchase, and it is the honest price of ruling on any carry
change by measurement rather than by reasoning.

## 4b. IT IS THE DELIVERY, NOT THE MASK (fable-600 §2, settled 2026-08-15)

Every extent above is a segmenter mask's extent, and a re-read moves on its own,
so the ~25% could have been the instrument. The control is the cheapest one
there is — **read the same frame three times**, since a picture cannot change
between reads:

```
WITHIN ONE FRAME (the instrument's floor)
  born          left   0.0265% · 0.0266% · 0.0266%    spread 0.2%
  born          right  0.0284% · 0.0284% · 0.0284%    spread 0.2%
  after-point   left   0.0266% · 0.0266% · 0.0266%    spread 0.0%
  after-point   right  0.0301% · 0.0301% · 0.0301%    spread 0.0%
  after-point2  left   0.0209% · 0.0209% · 0.0209%    spread 0.0%
  after-point2  right  0.0213% · 0.0213% · 0.0213%    spread 0.0%

BETWEEN THE TWO POINT ARMS (means of three reads each)
  left   0.0266% → 0.0209%    drift 27.4%
  right  0.0301% → 0.0213%    drift 41.5%
```

**The segmenter reads a fixed frame to within 0.2%, and the two renders differ
by 27% and 41%.** The variance is not the reader. It is the delivery.

And it is visible: `output/court-carried-words/point-vs-point-earrings.png` puts
the two arms' lobes side by side — the same silver cross, carried from the same
crop, drawn plainly larger on one render than the other.

So the noise floor stands as a product fact rather than an instrument artefact:
**a carried crop's delivered size varies by a quarter or more between renders of
an identical recipe.** The founder should hear it plainly, because it is the
reason a pair he approved can come back looking different after an unrelated
edit — nothing was mis-carried, the engine simply draws it at a different size.

## 5. What the court found on the way — the lineage bug

The first two arms both refused into a refund: four renders, every one
delivered without the earrings the previous render had just given her, and the
record said why in one field — `carried: []`, beside two healthy library rows
with crops, masks and digests.

The carry reads the lineage (`listLineageReferences` anchors on the new variant
and climbs its parents), and `parentVariantId` was NULL, because that column was
written **only while `CASTING_SEGMENTS_SCOPE` named the user**. The fixture sat
inside the repaint and library scopes and outside the segment one — a
configuration nobody had ever run.

Both halves of that gate's stated reason had gone stale:

- It was never a deploy defence. Drizzle names every column in the schema and
  passes `default` for the ones a caller omits, so the column is in the INSERT
  regardless — proved by dropping it under a real claim in the segment-store db
  suite. Migration-before-code is what protects that deploy.
- "Recording it while the store is dark buys nothing" — it buys the whole carry
  now, and the version rail's take grouping climbs the same column.

Nothing in production was ever exposed: all four scopes name the founder alone
and his renders parent correctly. But `CASTING_V2_SCOPE` is already `all`, so
**widening the repaint road by itself would have detonated it for everyone at
once** — every filed crop stops riding, every feature already paid for reverts,
and the completeness guard turns those renders into refunds.

The suite could not have caught it: every repaint test hands the lineage rows in
directly, which is the harness supplying the argument the product must derive
(the standing lesson, met again). The new test asserts the fact at the site that
writes it, with the flag forced OFF inside the test — `vitest.setup.ts` loads the
developer's own `.env`, so the first cut of the control read `true` on this
machine. Sabotaged back to the old line, it fails on exactly that assertion.

## 6. One observation, filed rather than chased

The fixture cast is male, and *"her right eye — fiery red"* was scoped to
`eye@left` AND `eye@right` — both eyes, on an ask that names one. The earring
measurement is unaffected (the pair is read per side against its own born
frame), but a per-side ask landing on a pair is worth its own reading.

## 7. Artifacts

`output/court-carried-words/` — the born frame, all four arm frames, each arm's
dispatched prompt, and the per-side readings as JSON. The scripts are
`scripts/court-carried-words-baseline-disposable.mts` (the free baseline) and
`scripts/court-carried-crop-vs-words-disposable.mts` (the paired court).
