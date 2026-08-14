# The face that resisted every arm was not resisting — she was being mismeasured

*Run 2026-08-15, ordered in fable-555 §4 (reads before renders, quote before
hypothesis). **~20 segmenter reads, about ten cents of house money. No
generations.** Artifacts: `output/skin-carrier/why-one-face.json`,
`fair-long-lost-skin.png`.*

---

## What was quoted first

```
               W      A′     T      S      floor
 fair-short    4.98   1.90   3.14   1.71   0.60
 fair-long     8.73   2.02   4.59   4.22   1.32   ← double her sisters, every arm
 fair-dark     2.50   2.93   2.13   1.95   0.74
```

## The reading, taken before naming a cause

Every ΔE in this program's skin line compares the mean colour inside her skin
mask on one frame with the mean inside her skin mask on another — **two
different sets of pixels.** So each pair was read twice: once as before, and
once with both means taken inside `mask(v1) ∩ mask(v2)`, the same pixels.

```
face          arm   FULL    SHARED   difference   IoU
fair-short    W      4.97     4.97         0.00    98.4%
fair-short    S      1.71     1.72        -0.01    98.6%
fair-long     W      8.77     6.05         2.72    71.4%
fair-long     S      4.22     1.25         2.97    70.7%
fair-dark     W      2.50     2.57        -0.07    98.8%
fair-dark     S      1.95     1.93         0.02    99.1%
```

**On two faces the mask agrees with itself to 98–99% and the two columns agree
to ±0.07. On fair-long the mask agrees with itself 71%, and up to 3.0 ΔE of her
"drift" is the mask moving rather than her colour.**

## Where the mask went — the picture, not the number

45,363 pixels the mask held on v1 and dropped on v2, painted onto her own frame:
**her whole neck**, plus a thin line at her hairline. Nothing else.

Her neck is still visible in the later frame — the picture did not change. The
segmenter's answer to *"face skin"* did: it took her neck in once and left it out
the next time. And her neck is measurably darker than her face (the pre-flight
measured ΔE 3 untanned, 4–7 tanned), so admitting or dropping it moves the mean
by several ΔE all by itself.

## What that changes

**On the same pixels, arm S held her tone better than it held anyone's**:

```
                     FULL              SHARED (same pixels)
 fair-short  S       1.71              1.72
 fair-long   S       4.22              1.25   ← the best reading of any arm
 fair-dark   S       1.95              1.93
                     median 1.95       median 1.72
 words W             median 4.98       median 4.97      bar was a third: 1.66
```

S's miss shrinks from 0.29 to **0.06** — smaller than the ±0.07 the two clean
faces show between the two ways of measuring. **The bar cannot discriminate at
that resolution**, which is a statement about the instrument and not a reason to
move the bar; the verdict stays where it was scored and the decision stays with
the founder.

## The instrument law this earns

**Read the same pixels, or you are measuring the mask.** A region re-read on a
second frame is a second opinion about extent as well as content, and the two
are not separable in a mean. Every cross-frame colour comparison in this program
should be taken inside the intersection, with the IoU reported beside it — it
costs nothing, it is mechanical, and on one face in three here it was worth up
to 3.0 ΔE of pure fiction.

The control is what makes it trustworthy: on the two faces whose masks were
stable the correction changed nothing (±0.07), so this is a fix that only fires
where it is needed.

## The limits

- **Three faces, two arms.** The 71% face is one face; what makes a mask
  unstable (long hair against a neck, a recolour changing the boundary, the
  segmenter's own variance) is not established here — only that it happened, and
  where.
- **A′'s numbers are not re-read.** They come from an earlier run and are quoted
  as FULL; if the same instability touched them, its face column moves too.
- **The neck's inclusion is a question about the phrase "face skin"**, and this
  note does not answer it. If the row ever needs a stable region, that is a
  phrasing bench like the eyes one, not a guess.
