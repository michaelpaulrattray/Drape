# THE FACE WALL — final

**For the founder's formal pass, 2026-08-06.** Everything here is a picture on
disk with a number beside it. **Nothing has touched the product path.**

Exhibits live in `docs/specs/masked-editing/shop/evidence/`. **Every before/after
pair carries a DIFFERENCE VIEW** — black where nothing moved, bright where it
did, amplification stated. That rider exists because this work once spent three
rounds chasing a seam that was not there, and it caught two of my own false
claims during this build.

---

## THE GUARANTEE

**Where the feathered mask is fully zero, the output is byte-identical to the
master.** Not approximately — `Buffer.compare`, every render.

It has now held on **every render in the workstream**: the glasses fixture across
three engines, the max-delta fixture in both directions, the finish pass, the
harvest-gate comparison, the fringe pair, the interleave, the relative re-run,
the walk, the sticker test, the gauntlet, the whole-hair renders. **Including the
ones that came back visibly broken inside their own mask.**

A bad render can now only be bad *inside the region it was asked to change*. The
failure class that suspended the finale is structurally unavailable on this path.

---

## THE ONE PICTURE

`EXHIBIT-20c-walk-earrings-100pc.png` — her face at 100%: master, result,
difference.

Two gold studs arrived. **The difference panel is two dots and nothing else.**
Her glasses: **0 of 27,613 pixels changed.** The painter's own output for that
same ask changed **98.85% of the frame** — it redrew her glasses, her skin and
her jaw, exactly as the walk saw. **0.06% was delivered.**

That gap is the architecture.

---

## YOUR WALK, RE-RUN

One face, three separate asks — the three edits that blocked the sale.
`scripts/calibration/the-walk.mts`, exhibits `20a`–`20d`.

| the ask | what the walk saw | what this path delivers |
|---|---|---|
| freckles | "replaced her hairstyle wholesale" | her hair: **1,405 of 130,123 px moved**, mean 0.02 levels. The painter moved 129,138 at mean 6.87 |
| earrings | "deleted her glasses" | her glasses: **0 of 27,613 px moved** |
| remove glasses | *"I can't find any glasses"*, at a face wearing them | frames off; her face beyond the zone: **0 of 92,336 px moved** |

The refusal is gone structurally. The old path asked the RECORD whether she had
glasses; this asks her picture, and the segmenter returns 27,613 pixels of frames
at 0.962. **That answer is no longer available.**

---

## THE FRINGE — and the lesson that cost the most

`EXHIBIT-31-the-fringe-final.png` — master / composite / the painter's raw output
/ difference, at 100%.

This is the fixture that taught the wall its most expensive lesson. The fringe
was built as **strands painted onto a forehead patch** — the minimal-diff
framing, because that is where the pixels move. It produced appliqué: sparse
wisps on repainted skin, then a pale veil that survived three rounds of gating.

**A fringe is a haircut.** Your correction — *select the whole hair and change
the cut* — re-scoped the zone to the whole hair composition and described the
complete style. Both engines then produced a genuine fringe: density, fall,
texture and light belonging to one mass. **Three rounds of gating were chasing a
symptom of the framing.**

That is now working law #7 and a table: `server/castingV2/zoneScope.ts` assigns
every facet in the vocabulary a zone-scope class, derived from the vocabulary so
it cannot drift, so **no other facet can ship fringe-scoped.**

---

## THE HARVEST GATE — one defect, three costumes

Hair is a layer over the master world: the zone may cover any territory the style
reaches, and **only matte-confirmed content survives**. Everything else inside it
reverts to her.

The same underlying flaw wore three faces, and all three are closed:

| costume | what it was | closed by |
|---|---|---|
| the wall that was never up | a SUBJECT matte confirmed the painter's clothing as readily as her hair — **60,783 px of her own shirt** survived, against **0** now | `harvestMatteFrom` (`EXHIBIT-14`) |
| the hem | the zone stopped where the hair did not, and the composite cut it straight | `expandUntilClear` (`EXHIBIT-25`, `26`) |
| the veil | the segmenter's mask fills a silhouette, so the gaps between strands were painter-skin at full alpha | `harvestGate` (`EXHIBIT-28`) |

**The gate is a pure narrowing** — it can only ever revert more pixels to her,
never admit one, and a test asserts that across every pixel. That property is
what made global scope safe.

`EXHIBIT-17` and `18` are the harvest gate with **no geometry helping it at all**
— no face carve-out, no frame exclusion. Her forehead where no strand landed: **0
of 11,396 px moved.** Her shirt: **0 of 127,319.** Her eyes: **0 of 4,230.**

---

## WHAT ELSE IS ON THE WALL

| # | what it shows |
|---|---|
| 1–4 | the segmentation shop: the phantom an open question invents, the hair row as a composition, frames vs lenses |
| 5–7 | the bake-off, and non-convergence as the routing trigger |
| 8 | max delta, both directions — including the shrink that reconstructed the backdrop |
| 9–13 | within-region anchoring, the finish pass with its honest miss, and the difference view that ended the phantom chase |
| 15–16 | the finish at the temple and ear, and why grain came off the critical path |
| 19 | hair and glasses interleaved — resolved by harvest, with no ordering rule in the code |
| 22, 27–28 | the sticker effect, and the gate that closed it |
| 29–30 | the whole-hair redesign, and what a degree word actually steers |

---

## WHAT IS HONEST TO SAY, AND WHAT IS NOT

**The relative carve-out may not carry a number.** The clean gap is 2.5pp —
*smaller* than the 3.9pp it was meant to confirm. Direction holds; magnitude does
not.

**The visibility gate is reasoned, not calibrated.** No face in the set hides a
stud past 64%; the bar sits at 98%. It is **not** being lowered to make an
instrument fire — refusing an edit that is a third visible is the false refusal
that killed the walk.

**Degree adherence is unverified.** "Wispy" steers coverage by 28.6 points,
opacity by 7.8, and length not at all. The net checks presence, not intensity.

**The harvest gate is only as good as its segmentation** — it was watched
mis-confirming dark sunglasses as hair.

**Fine strand tips are clipped**, because fal has no hair-matting model. The
shop is shelved with a trigger rather than run: the whole-hair redesign mooted
the defect it was queued for.

---

## FOUR TIMES I MEASURED THE WRONG THING

Recorded because the wall's credibility rests on the instruments, not the claims.
Each was caught by a picture, and three of the four were caught by **yours**.

- I claimed a hem was gone from a downscaled panel where the hem sat at the crop's
  bottom edge — the difference-view rider, ignored by me.
- I diagnosed that hem as the segmenter's boundary. It was the zone.
- A wall check compared against the harvest instead of `composed.applied`, and
  reported 5,682 ratified contact shadows as a breach.
- I measured a veil inside a face-skin mask that **begins at row 316** while the
  veil was dense **from row 105** — 179 pixels reported where the frame carried
  30,093.

The rules that came out of it are D-231 and D-232: **prefer the thing that fired
over the thing you computed, and prefer the thing that changed over the thing
that was asked.**

---

## WHAT THIS WALL IS ASKING FOR

Your pass. Then, in order and nothing else in front of it:

1. the masked path wired into the product, **dark, behind its flag**
2. **your walk** — freckles, fox eyes, earrings, the removal — in the product, on
   your account, the same fifteen minutes that blocked the sale
3. if it holds in your hands as it held in the harness: refine her until you'd
   sign her, and **Sign**

M8 closes on that click.
