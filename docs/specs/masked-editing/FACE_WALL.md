# THE FACE WALL — the masked-editing workstream's formal pass

**For the founder's eye, 2026-08-06.** Everything below is a picture on disk with
a number beside it. Nothing here has touched the product path.

> **PASS 1 VERDICT: HELD, on the sticker effect.** The founder's eye caught what
> every measurement here had missed — the edits are *correct* and they do not
> *belong*. That is answered in the section immediately below; the rest of the
> wall stands as it was, and the exhibits it references are the before-side of
> the comparison.
>
> **PASS 2 VERDICT: Mode C ratified, fringe accepted, held on two residuals — and
> the diagnosis came back the OTHER WAY.** Both were called authorship. Both are
> ours. The painter's ends taper beautifully and its afro perimeter is coils
> breaking the outline; we were removing them. See *"The two residuals, and who
> actually did it"*.

Exhibits live in `docs/specs/masked-editing/shop/evidence/`. **Every before/after
pair carries a DIFFERENCE VIEW**, because a pair on its own is what sent this
work chasing a seam that was not there for three rounds. A difference panel is
black where nothing moved and bright where something did; the panels are
amplified, and each says by how much.

---

## THE TWO RESIDUALS, AND WHO ACTUALLY DID IT

`EXHIBIT-23c-the-painters-ends-are-good.png`,
`EXHIBIT-23a-where-the-hem-comes-from.png`,
`EXHIBIT-23b-where-the-blob-comes-from.png`

Both residuals were diagnosed as authorship. **The five-minute check says
otherwise, on both, and the pictures are not ambiguous.**

**The painter's raw output ends in scattered, tapering, individual strands.**
Better ends than the brief was going to ask for. **The painter's raw afro has
individual coils standing proud of the outline** with gaps between them. Neither
defect is in the paint.

And the zone cannot have authored anything, because **the painter is never sent
the zone.** The standing rider is full-frame context with local harvest: the
model gets the master and one sentence, and returns a whole frame. There is no
canvas to complete inside, so the box-authored mechanism is unreachable on this
dispatch shape. *(It becomes reachable the day we start sending masks to the
model — worth remembering, not worth acting on now.)*

**So we were removing it.** `EXHIBIT-23a` is the proof in three rows: the raw
paint, the harvest matte painted red over it, and what shipped. The red is a
smooth rounded blob that stops short of the strands — and the shipped picture
ends exactly on that boundary. **The hem is the segmenter's confidence frontier,
composited into a haircut.**

One cause, two costumes:

| where the paint lies | subject matte there | what happens |
|---|---|---|
| over the **wall** (afro) | ramps — 11% of edge pixels carry a real ramp value | partially rescued; reads *smoothed* |
| over her **own shirt** (hem) | flat **254/255**, zero ramp | nothing rescues it; the segmenter's outline transfers whole |

That also explains why the tip taper did not save the hem: its ramp-ness guard —
the thing that stops it bleeding onto a forehead — refuses every strand over her
body for exactly the same reason. **The guard that makes the taper safe is the
guard that makes it useless where the hem is.**

### The fix, and why it needs no model

D-216 found fal has no hair-matting model. That finding stands, and it stops
mattering here, because **the one thing a matting model exists to infer, we
already own exactly: the background.** The master *is* the plate.

    patch = alpha · strand + (1 − alpha) · master

Difference matting against a known background is not an approximation standing in
for a segmentation — it is the exact solution, and the strand colour is measured
from the interior of confirmed content rather than assumed.

**It does not reopen the wall, and not because of a threshold.** It is a
projection: a repainted shirt moves grey toward a *different grey*, a delta
nearly orthogonal to (strand − master), which projects to about nothing. Proven
on the real render — of her t-shirt, **269,703 pixels stayed hers, and the
painter had repainted them by a mean of 8 levels. All discarded.** The 49% that
was claimed is where hair genuinely lies on the shirt.

### Mode D — C, with the substance no longer cut to a confidence frontier

`EXHIBIT-24a` (hair-down), `24b` (afro), `24c` (fringe) — five rows each: master,
A, B, C, **D**.

| case | strand pixels the boundary was discarding |
|---|---|
| hair-down | **150,280** |
| afro | **92,794** |
| fringe | **51,470** |

On `EXHIBIT-24a` the hem is gone: the ends scatter into wisps that carry on down
over the shirt, which is what the painter drew in the first place. **Beyond the
destination zone: 0 pixels moved, on all twelve composites.**

D is C plus recovered substance — **the ratified shadow behaviour is untouched.**

---

## PASS 1'S FINDING, ANSWERED — the sticker effect

`EXHIBIT-22a-sticker-fringe.png`, `EXHIBIT-22b-sticker-hair-down.png`,
`EXHIBIT-22c-sticker-afro.png` — each one is **master / A / B / C at 100%**.

Three observations, one cause. The fringe floats; the afro edge reads
smoothed-out; the ends cut off straight and lie on the shirt with no shadow.
**A strict substance harvest keeps only pixels a segmenter confirms ARE the
object — and a contact shadow is not the object.** Neither is occlusion
darkening, or a translucent taper, or spill. Those are precisely the pixels that
make a thing belong to a photograph rather than sit on top of one, and the
harvest was discarding every one of them. The result is a correct cut-out of the
right shape, floating.

The founder's phrasing was the brief: **allow room for the model to actually
blend.**

| mode | what it does |
|---|---|
| **A — substance** | what shipped. The baseline, kept in the comparison rather than assumed to lose |
| **B — interaction** | + painter-delta pixels within a bounded band of confirmed content. Shadows, tapers and spill arrive — and so does any colour the painter felt like adding |
| **C — shadow** | the same band, adopting **only darkening**, as a multiply from the painter's luminance. Contact shadows without letting it tint her |

**The tip taper is in all three**, because it answers a separate observation: a
segmenter stops where its confidence does, so the matte knew a strand end was 20%
there and the harvest multiplied it by zero. Now 20% confident renders at 20%.
Between 7,533 and 12,765 strand-tip pixels per case were being clipped.

### My read, and the founder's call

**C.** It gets the belonging on all three observations — root shading under the
fringe, a cast shadow on the wall behind the afro, contact where the hair lies on
the shirt — and it gets there on a *narrower permission* than B. Under C the
band can only make her darker; her hue survives by construction, because every
channel is scaled by one factor. B reaches the same place and carries the
painter's colour with it, and every complaint in this program's history is about
something arriving unbidden.

B and C are close on the pictures. The difference is what they *allow*, not what
they produced here, and that is the thing worth choosing on.

### What it costs, stated rather than absorbed

| case | band | C adopted | what C adds over A |
|---|---|---|---|
| afro | 43,554 px | 20,893 | 0.02% of the frame, max 34 levels |
| fringe | 22,843 px | 7,588 | 0.38%, max 124 levels |
| hair-down | 68,372 px | 42,444 | 2.04%, max 222 levels |

The byte-identical territory shrinks by exactly that band. **Beyond the
destination zone nothing moves at all — 0 pixels, on all nine composites.** That
half of the guarantee is untouched and always will be; this is the boundary
becoming accurate about where it actually sits.

Adoption is a **comparison against the painter's own drift, measured per render**,
not a threshold — the painter repaints 99% of the frame, so "it differs here" is
true everywhere and selects nothing. What a contact shadow does is differ far
more than the painter's background noise does.

**Nothing here relaxes the face.** Fox-eyes-class strictness is untouched:
features, eyes and glasses are exactly as strict as they were.

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

**Pass 3: look at D, then walk.**

`EXHIBIT-24a/b/c` — master, A, B, C, D at 100%. D is the ratified C with the
strands the segmenter's boundary was discarding. The two residuals from pass 2
are answered there; the fringe row is closed by the founder's own acceptance.

Then the walk: the same sequence that blocked the sale — freckles, earrings, a
removal — on the masked path, in the founder's own hands. **That walk is what
ends in a Sign.**

Nothing here has touched the product path, and nothing should until both land.
