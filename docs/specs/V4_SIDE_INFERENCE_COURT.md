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
