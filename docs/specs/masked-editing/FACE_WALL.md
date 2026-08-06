# THE FACE WALL — the masked-editing workstream's formal pass

**For the founder's eye, 2026-08-06.** Everything below is a picture on disk with
a number beside it. Nothing here has touched the product path.

Exhibits live in `docs/specs/masked-editing/shop/evidence/`. **Every before/after
pair carries a DIFFERENCE VIEW**, because a pair on its own is what sent this
work chasing a seam that was not there for three rounds. A difference panel is
black where nothing moved and bright where something did; the panels are
amplified, and each says by how much.

---

## The one thing to read first

On the night the finale was suspended, the studio was asked for earrings and it
deleted her glasses. Here is the same ask on the masked path:

**`EXHIBIT-20c-walk-earrings-100pc.png`** — her face at 100%, three rows: master,
result, difference.

- Two small gold studs arrived, one on each lobe.
- **The difference panel is two dots. Nothing else in the frame moved.**
- Her glasses: **0 of 27,613 pixels changed.**
- The painter's own output for that same ask changed **98.85% of the frame** — it
  redrew her glasses, her skin and her jaw, exactly as the walk saw. None of it
  reached the picture, because none of it was an earring.

That gap — 98.85% painted, 0.06% delivered — is the whole architecture in two
numbers.

---

## The founder's walk, re-run

One face, three separate asks, each the defect that blocked the sale.
`scripts/calibration/the-walk.mts`.

| the ask | what the walk saw | what the masked path delivers | exhibit |
|---|---|---|---|
| freckles | "replaced her hairstyle wholesale" | **her hair: 1,405 of 130,123 px moved, mean 0.02 levels.** The painter moved 129,138 of them at mean 6.87 | `EXHIBIT-20a` |
| earrings | "deleted her glasses" | **her glasses: 0 of 27,613 px moved** | `EXHIBIT-20b`, `20c` |
| remove glasses | "I can't find any glasses", at a face wearing them | the frames come off (27,608 px, mean 40.2) and **her face beyond the zone: 0 of 92,336 px moved** | `EXHIBIT-20d` |

The refusal is gone for a structural reason rather than a better prompt. The old
path asked the RECORD whether she had glasses; this asks her picture, and SAM 3
finds 27,613 pixels of frames at a score of 0.962. *"I can't find any glasses" is
not an available answer on this path.*

---

## The guarantee

**Where the feathered mask is fully zero, the output is byte-identical to the
master.** Not approximately — `Buffer.compare`, every render, including the ones
that came back visibly broken inside their own mask.

That has now held on every render in the workstream: the glasses fixture (6/6,
three engines), the max-delta fixture in both directions, the finish pass, the
harvest-gate comparison, the fringe pair, the interleave, all six renders of the
relative re-run, and all three walk steps. **A bad render can only be bad inside
its own mask.**

---

## The harvest gate — and the wall that was not up

`EXHIBIT-14-harvest-gate-shoulder.jpg`, `EXHIBIT-14b-harvest-wall-effect.png`

The founder's generalisation — *hair is a layer over the master world; the zone
may cover any territory the style reaches; only matte-confirmed strands survive*
— exposed a defect in shipped code. The finish pass was passing BiRefNet's
**subject** matte as the harvest matte, and a subject matte is opaque across the
whole person, so it confirmed the painter's repainted **clothing** as readily as
her hair. The wall looked enforced only because every fixture until then ran hair
against a plain wall.

Measured on a zone grown until it genuinely crosses her t-shirt:

| | pixels of HER OWN SHIRT that moved |
|---|---|
| the shipped behaviour (subject matte) | **60,783** of 64,291 |
| the harvest gate | **0** |

`EXHIBIT-14b` is what the wall stops: her neck, her collar, her shoulders and her
glasses, 10.24% of the frame, all of it repainted by the model and none of it
delivered.

The old behaviour is kept as a permanent negative control rather than deleted. A
wall nobody has watched fail is not a wall.

---

## The gate with nothing helping it

`EXHIBIT-17-fringe-skin-between-strands.png`, `EXHIBIT-18-hair-down-shirt-beneath.png`

A fringe has to cross the forehead, so the geometric face carve-out has to yield.
These two ran with **no exclusions at all** — no face, no frames, no eyes.

| | result |
|---|---|
| her forehead where no strand landed | **0 of 11,396 px moved** |
| her shirt where no strand landed | **0 of 127,319 px moved** |
| her eyes | **0 of 4,230 px moved** |
| her lips | **0 of 5,439 px moved** |

Row 3 of `EXHIBIT-17` is the painter's raw output beside the composite: asked for
a fringe, it redrew her eyes, her brows, her glasses and her skin. `EXHIBIT-18`
is the same story in fabric — two falls of hair, and between them her own collar
and weave, diffing pure black.

---

## Hair and glasses, interleaved

`EXHIBIT-19-interleave-hair-and-glasses.png`

Wisps fall in FRONT of frames while the arms tuck UNDER the hair, in the same
picture. No ordering rule resolves that, and none is needed: the per-pixel
harvest decides.

Chunky frames onto a face already carrying a fringe: **her strands not under a
frame, 0 of 2,413 px moved**, while the frames themselves move 22,811 of 22,838.
Row 3 is again the painter's version, with her whole face quietly redrawn.

---

## The finish

`EXHIBIT-15-finish-temple-ear-right.png`, `EXHIBIT-15b`, `EXHIBIT-16`

The difference view localised the last real seam to both ear crossings. Ears and
glasses arms are now carved out beside the face, and the ear's residual
disturbance drops **mean 10.38 → 6.75 levels, max 128 → 89** — the same under
either matte, so it is a genuine placement effect.

**The finish completes with zero grain machinery on the critical path**, which
was the success condition. One zone, three composites — bare, tone, tone-and-
grain — and the seam across the whole boundary reads 2.92, 2.91, 2.92 levels.
Neither step buys anything, because the two changes upstream had already removed
the seam they were written for.

Grain was worse than neutral. `EXHIBIT-16` is a straight-edged rectangle inside a
head of hair: neighbouring 64px tiles resolving to different amplitudes, with the
tile boundary showing as a hard line in a region that contains none. **Grain is
reserve.** If a genuine seam ever needs it, the approach of record is the
noise-plate transplant, not a fourth round of synthesis.

**My read on the criterion — no visible boundary line on skin at 100% zoom, at
the temples and the ear: MET on this specimen.** `EXHIBIT-15` is master |
composite | difference, lossless, at 100%. The face, temple, ear, glasses and
background all diff black; the ear is composited back verbatim and does not read
as pasted. **The founder's eye is the bar, and this is what it is being handed.**

---

## What is honest to say, and what is not

**The relative carve-out still may not carry a number into pricing.**
`EXHIBIT-21a/b`. D-222's 3.9pp was the zone saturating — a floor, not a
measurement. Re-run with the zone grown to a floor of 98.8%, the clean gap at the
first relative instruction is **2.5pp, which is SMALLER than the number it was
meant to confirm.** The second relative step read 9.7pp but its anchored render
is incoherent, so it does not count. Direction holds; magnitude does not.

**The visibility gate is built and reasoned, not calibrated.** It refuses an edit
predicted invisible before any charge, it is wired into the contract door, and it
has been watched failing. But across eight faces no stud is hidden past 64%, and
the bar sits at 98% — so it fires on nobody in this set, and it is **not** being
lowered to make it go off. Refusing an edit that is a third visible is the false
refusal that killed the walk.

**The harvest gate is exactly as good as its content segmentation.**
`EXHIBIT-21c`. On one render the painter turned her glasses into dark sunglasses,
SAM 3 returned the LENSES as "hair", and the gate faithfully harvested them. It
does not fail open in general — it fails where the segmenter is confused, and a
dark accessory beside dark hair is a known confusion. The answer is the standing
one: swap the model and re-run, never tune.

**A geometric carve-out composites harder than no carve-out at all.** The same
exhibit shows a visible straight seam down both sides of her face where the face
mask was subtracted. The fringe fixture, run with no carve-out whatsoever, looks
better. That is the harvest-gate law earning itself a second time.

**"Fox eyes" was probably never a reader failure.** Graded against arithmetic, a
reader scored 18/18 on this pair — correctly saying the iris colour changed,
correctly saying the eye SHAPE did not, correctly saying the mouth did not, six
times each, at full frame and cropped. The shape did not change because **the
engine dropped the clause.** When the studio said "fox eyes" and the reader said
no, the reader was telling the truth about a generation failure. The crop
therefore bought nothing here — the full-frame reader was already at ceiling — so
the cropped-region hypothesis is untested rather than disproven.

**Fine strand tips over skin are clipped.** fal has no hair-matting model
(D-216), so the harvest matte is composed from a binary segmentation and a
subject matte. That composition recovers strand territory at the silhouette but
not the finest tips lying over skin, so a fringe composites slightly shorter and
cleaner than the painter drew it. Named limit, visible in `EXHIBIT-17`.

---

## The thirteen that came before

| # | what it shows |
|---|---|
| 1 | the first face wall — segmentation shop |
| 2 | eyeglasses controls: the phantom a segmenter invents when asked an open question |
| 3 | the hair row as a composition (SAM 3 ∩ BiRefNet) |
| 4 | frames vs lenses — asked for, not derived (D-217) |
| 5, 6 | the bake-off, both scenarios, three engines |
| 7 | expansion convergence — a local edit converges, a re-render does not (D-218) |
| 8 | max delta, both directions — including the shrink that reconstructed the backdrop |
| 9, 9a, 9b | within-region anchoring, five rounds, both rules (D-220) |
| 10, 11 | the finish pass, and the honest miss recorded against it |
| 12a, 12b | the relative carve-out's first evidence, and its confound |
| 13 | the difference view that ended the phantom-seam chase |

---

## What this wall is asking for

A walk. The same sequence that blocked the sale — freckles, earrings, a removal —
on the masked path, in the founder's own hands. **That walk is what ends in a
Sign.**

Nothing here has touched the product path, and nothing should until the walk
passes.
