# The side-inference court — the parse is right, and the PAINT is the problem

**Ordered:** fable-604 §3b — n≥6 per side, mirrored arms, an edit and its
control, the opus-275/342 precedent read before the bars are set.
**Run:** 2026-08-15, dev fixture, 14 renders, 350 dev credits, ~$5 house.
**Verdict:** the inference parses correctly 12/12 and **must not ship yet** —
the court found a delivery failure underneath it that belongs to the SHIPPED
click path as much as to the proposed inference.

---

## 1. The bars, written before the first render

```
n = 6 per side, MIRRORED — a per-side claim tested on one side measures the
IMAGE's half rather than hers.

THE ASK      "her <side> eye <colour>", a different colour each repeat so the
             already-true door never refuses a repeat for free.
THE PASS     the NAMED eye changes at least TWICE as much as the other. Not
             "the other does not change": a repaint redraws the whole frame, so
             every pixel moves a little and an absolute bar would fail a correct
             render.
THE CONTROL  "her left and right eyes <colour>" → both sides change, within
             1.5x of each other.
```

Judged on geometry: the segmenter's per-side eye masks are read ONCE on the
fixed parent frame (it reads a fixed frame to within 0.2%, measured), and each
render is scored by the mean absolute pixel change inside each side's own mask.

## 2. What came back

```
her right   3/6    ratios 5.13 · 0.50 · 2.93 · 3.21 · 0.56 · 0.38
her left    6/6    ratios 2.18 · 2.63 · 3.66 · 5.60 · 2.66 · 2.24
CONTROL     2/2    both eyes moved together — 1.09 · 1.16
```

**The parse is not in question: all twelve renders recorded `edited` as the slot
the words named.** The inference maps "her right eye" onto `eye@right` exactly as
a tapped box does.

**The paint is.** Asked for her LEFT eye, the engine paints her left eye, six
times out of six. Asked for her RIGHT eye, it paints her left eye instead on
three of six — and the picture agrees with the number:
`output/side-inference-court/eyes-sheet.png` shows the emerald landing on her
right eye (the image's left) and the violet landing on her left.

The control matters: it proves the instrument can see both eyes move, so the
right arm's failures are not "this product can only ever paint one eye".

## 3. What this means, and it is bigger than the inference

The recipe a clicked box produces and the recipe this inference produces are the
SAME recipe — one slot, one ask, one prompt. So the failure is not the
inference's: **a per-side eye edit lands on the named eye about half the time
when the named side is her right, on the path that is already live.**

That is below D-236's bar for the class, and it is the same shape as the
standing image-half law: her right eye sits on the image's left, and the engine
appears to favour the image's right half regardless of which side the recipe
names.

So the inference stays dark. Shipping it would multiply the number of asks that
reach a paint we know honours one side and not the other; the honest order is to
fix the paint, then open the door.

## 3b. A CANDIDATE CURE, courted twice — say the side BOTH ways

The misses all landed on the image's RIGHT half whatever the recipe named, which
is a positional bias rather than a naming confusion. So the ask names her
anatomy and the half of the picture it lives on: *"her right eye (on the left of
the picture as you look at it)"*, dark behind `CASTING_SIDE_PHRASING`.

```
FIRST PASS, six renders an arm, her right
  plain    3/6 landed on her right eye
  placed   6/6

PAIRED PASS, six FRESH colours, each asked BOTH ways on the same parent
  plain    wrong eye 1/6    ratios 2.48 · 6.30 · 0.28 · 2.47 · 2.47 · 2.02
  placed   wrong eye 0/6    ratios 2.31 · 3.32 · 1.91 · 2.37 · 3.27 · 2.03
```

Pooled over both passes, twelve renders each way on her right:

```
without the clause   4 of 12 painted the other eye
with the clause      0 of 12
```

**p ≈ 0.09 — suggestive, not conclusive**, and said that way on purpose. What is
not in doubt: the clause never once hurt (every phrased render landed on the
named eye, and the paired turquoise pair flipped from 0.28 to 1.91 on the colour
that had failed), and it costs nothing per render.

Note also that the baseline rate itself moves — 3/6 on the first pass and 1/6 on
the second. A per-side failure rate quoted from six renders is not a constant,
which is why the pooled figure is the one to carry.

## 4. And the read-back's side words cannot be trusted to judge this

Five of the fourteen renders came back with an uncorroborated read-back (the
captioner refusing to pin what it saw). Reading the five:

```
asked "her right eye ice blue"
saw   "Left eye (viewer's left) is pale icy blue; right eye remains warm brown."
```

That render PASSED the geometry arm — the colour landed on her right eye, which
is the viewer's left. The reader saw the same thing and called it "left eye",
then refused to corroborate an ask about the right one. **Its side vocabulary is
viewer-framed at least some of the time**, so its per-side verdicts are wrong in
both directions: it will refuse correct renders and pass wrong ones.

This is a precondition on the open ruling from opus-454: an uncorroborated
read-back must NOT be made to refuse or to count against the delivery bar until
its side vocabulary is fixed, or correct per-side renders will be refunded.
Counting it, which is what shipped, remains safe and is exactly how this came to
light.

## 5. What is built, and what state it is in

- The inference is written and **dark behind `CASTING_SIDE_INFERENCE`**
  (`repaintAsks.inferSideFromWords`), with its free arms pinned in the suite:
  narrows right, narrows left, and leaves a both-sides sentence alone.
- With the flag off — which is every environment — an unscoped sentence naming
  one side still REFUSES, which is the shipped behaviour from `eb4108ab` and
  remains correct: better a free refusal than a contradiction at full price.
- The court script is `scripts/court-side-inference-disposable.mts`. Its one
  instrument note: it restores the fixture to a fixed parent between renders,
  which DELETES the variant rows as it goes — so the per-render `internalPrompt`
  evidence is gone by the end and the read-back verdicts above had to be read
  from the run log. A court that spends should keep its rows.

## 6. THE THIRD LANE — the ink plate road, and the picture does not rescue it

Everything above is the repaint road, where the side reaches the engine as
words. The ink studio's plate road was supposed to be the lane where words are
not the only carrier: a design declaring `upperArm:left` is drawn onto a
picture of a LEFT arm, and that picture rides into the package view beside the
sentence. If a picture of the correct limb could beat the image-half bias,
this is where it would show.

It does not. Fifteen house renders, one candidate, one specimen, every frame
read by eye (`scripts/court-single-view-arm-mirror-disposable.mts` and its two
extensions; the panel is
`output/single-view-arm-court/COURT-PANEL-single-view-arm.jpg`):

```
arm  plate                              clause        n   landed on         verdict
A    armLeft  blank, as minted          "her left"    5   her LEFT   5/5    correct
B    the A plate hand-flopped           "her left"    2   her RIGHT  2/2    crossed
C    armRight blank (mirrored plate)    "her right"   5   her LEFT   5/5    WRONG
D    armRight blank (clean plate)       "her right"   3   her LEFT   3/3    WRONG
```

**Thirteen of fifteen landed on the image's RIGHT half** — whichever limb the
plate depicted, whichever side the sentence named. Her left arm is the image's
right, so arm A reads as a clean pass and is not one: it is the bias agreeing
with the answer. Arm C+D is the same bias disagreeing, 0 for 8.

Three things this settles, and one it does not:

- **The blank does not carry the side.** That was the hypothesis the six
  single-view blanks were built on after the retired three-view sheet was
  convicted, and on the right side it fails every time. `ARM_FOR_SIDE` is
  correctly named (the armLeft blank really is a left arm — the axillary fold
  sits image-left) and correctly named is not load-bearing.
- **The sentence does not carry it either**, re-confirmed on a third lane:
  eight renders said *"her right upper arm (on the left of the picture as you
  look at it)"* and none of them obeyed. §3b's positional clause is on this
  road unconditionally and did not rescue it.
- **Arm B is the only thing that ever moved the ink**, and B is not a road the
  product travels — it hand-flops a finished plate, which mirrors the
  customer's artwork with it. B and C carry the same limb and the same
  artwork orientation and land on opposite arms, so the "the picture decides"
  reading from the three-view sitting does not survive; the mechanism is
  unnamed and nothing here should be built on a guess about it.

What it does not settle: one candidate, one design, one view angle. The
direction of the bias is consistent with the two earlier lanes, so it is very
unlikely to be this cast's pose, but a second face is what would prove it.

**A separate defect surfaced on the way, and it is a flake rather than a
rule.** The first `armRight` mint came back with the customer's artwork
MIRRORED — the crescent opening the wrong way against the specimen — in plain
violation of the plate prompt's own *"reproduce the DESIGN faithfully… exactly
as they appear"*. A second mint of the same design on the same blank came back
correct. One of two, against zero of one on the left blank: a flag, not a rate,
and it is the reason arm D exists at all (arm C's five renders all rode the
defective plate, so on its own it could not tell a placement failure from an
artwork one).

**Consequence for release.** `RELEASED_INK_TUPLES` is empty and this is the
first V2 evidence about a specific tuple. `upperArm:left` is the only arm tuple
with a reading behind it; `upperArm:right` has one too and it says no. The
legacy road's rule — *a tuple is never inferred from a neighbouring placement
or the opposite side* — is exactly what stops a right-arm design shipping on
the left arm's evidence, and this court is what that rule looks like when it
earns its keep.
