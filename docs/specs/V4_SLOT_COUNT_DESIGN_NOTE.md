# What a render's reads BUY — the slot-count note

**Ordered:** fable-603 §4 — *"The SLOT-COUNT question gets a DESIGN NOTE before
any code: trimming reads is how false passes come back — the note states what
each slot's two reads buy, which renders read which slots today (the census now
answers that), and what a reduced set would no longer prove. I rule on the note,
not on a diff."*

**Status:** the note. No code, no diff, no recommendation acted on.

---

## 1. Why this exists

The first latency readings (roadmap §1) put a delivered refine at 19 provider
calls and 149–280 seconds, with the paint at 40–65% of the wall clock. The paint
is not ours. Of the rest, segmentation and reading are roughly equal, and the
named lever from the old program — caching the unchanged master's regions —
buys nothing on the repaint road, because a repaint has no harvest and the mint
reads a delivered frame that never existed before.

So the only remaining lever on this road is **how many slots a render reads**,
and that is a product question wearing a performance costume: every read is
something the product proves about the picture it is about to keep.

## 2. What the two reads per slot actually buy

A slot that files a crop is read twice, by construction and on purpose:

```
THE GROUND   where the feature IS on the delivered frame — the mask the crop is
             CUT from. Without it there is no crop, and the library files words.
THE GUARD    a second, independent read of the same feature, which the crop is
             SCORED against (completeness). Without it a crop enters the library
             with no measure of whether it holds the whole thing.
```

**They are deliberately not one read.** The independence is the point: the mask
that cut the crop must not be the mask the crop is scored against, or the score
is a tautology — a crop always covers the mask it was cut from. That is the
wrong-boundary class, and it is the reason the mint invokes each seam
separately.

So "read each slot once and score against the same mask" is not a saving. It is
the deletion of the completeness guard, dressed as one.

## 3. Which renders read which slots — measured, not assumed

The census now names the question every call asked (`byAbout`, shipped
`c20c7d5f`), so this is read off the rows rather than argued:

```
AN EARRING RENDER (a pair delivered, crops filed)
  19 calls · wall 226s     segment 9 · read 9 · paint 1

A SCOPED EYE-COLOUR RENDER (the side-inference court's own arm)
   6 calls · wall 172s     segment 0 · read 5 · paint 1
```

**The spread is the finding.** An eye-colour edit segments nothing at all — the
eyes' completeness family has no specimen yet, so its crop is turned away at the
door and the slot files words. An earring edit cuts and scores both sides, and
each bilateral read is three provider calls (her midline, then one half to a
picture).

So the population that pays is narrow: renders whose edit lands on a kind the
library can hold a crop for, times the number of instances that kind has.

## 4. What a reduced set would stop proving

Three candidate reductions, each with the thing it would cost:

```
READ ONLY THE EDITED SLOT     Every carried slot stops being re-measured, so a
                              feature that drifted on this render is filed as
                              though it had not. The library's crops become
                              claims about the render that FILED them rather
                              than about the frame they are on.

DROP THE GUARD READ           The completeness score becomes a tautology (§2).
                              Crops enter at any coverage, and the first thing
                              that breaks is the carry: a partial crop carried
                              forward paints a partial feature.

READ ONE SIDE OF A PAIR       The unread side is filed from its sibling's
                              measure. The image-half law says exactly what
                              that produces — a claim about her left made from
                              her right, correct half the time by construction.
```

None of those is free, and each of them buys back seconds that the paint spends
anyway.

## 5. The one reduction that costs nothing, and it is not about slots

Her midline. A bilateral region is three calls — the face read for her own
vertical axis, then one half to a picture — and the face read is most of the
time (13.7s against 9.3s for the two halves in parallel, measured at the wire).

The reader already memoises the axis per frame, so within one render it is paid
once however many pairs are asked about. **The remaining cost is one face read
per frame, and nothing in the render path holds a face mask to donate** — the
scan holds one, but it reads a different frame (the selected version) from the
one the mint reads (the delivery).

So the midline hint (fable-132, elevated by fable-603 §4) has **no donor in the
current architecture**. Two honest options, and both are rulings rather than
diffs:

- **A per-candidate midline, declared — and now measured.** A repaint
  reproduces the same pose and framing by construction, and her axis moves
  accordingly:

  ```
  the fixture's chain        5 frames   midline moves 0.3px   0.031% of the width
  the founder's own cast     2 frames   midline moves 0.1px   0.005%
  ```

  A third of a pixel in 1024. The cut this axis makes is a half-frame split, so
  what an error would cost is a feature sitting inside that band being handed to
  the wrong half — and no feature is a third of a pixel wide. Caching the axis
  per candidate would remove the 13.7s face read from every render after the
  first, at a cost this measurement says is not detectable
  (`scripts/measure-midline-drift-disposable.mts`, frames already on disk).

  It is still an approximation and must be **declared** as one where it lands:
  a cached axis is a claim about a frame it was not read from.
- **Nothing.** Keep paying 13.7s per render for an axis read from the frame it
  is about. Honest, and the paint costs eight times as much.

## 6. What I would rule, if it were mine to rule

The midline measurement is taken and it is in §5: a third of a pixel across a
chain. So cache the axis per candidate, declared, with that number written
beside it — one face read per CANDIDATE rather than per render, 13.7s off every
bilateral render after the first, and an error term three orders of magnitude
below the thing it decides. Leave the slot count alone: every read in it is
a thing the product proves, and the two reductions that would save real time are
the completeness guard and the per-side independence — the two mechanisms this
campaign spent months building.
