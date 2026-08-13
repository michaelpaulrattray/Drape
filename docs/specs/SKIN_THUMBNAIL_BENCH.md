# Does a patch of her skin read as SKIN at thumbnail size? — bench design

*Owed by fable-360 ruling 2: "skin is words until the texture-patch measurement
says a patch reads as skin at thumbnail size — a measurement, not a decision."
Written 2026-08-13, shift 69. Nothing is built; this is the design and its
pre-registered bar, so the run cannot choose its own bar afterwards.*

---

## 1. The decision this settles

The panel's "Her skin" row is **words only** today. Every other pictured row now
shows a masked cutout of her own frame (shift 69). Skin was held back for a real
reason: a 34px square of cheek may be a beige tile that says nothing, and a row
that shows one would be worse than a row that shows none — *four rows wearing
one face-skin crop is the fringe-as-forehead-patch mistake with a thumbnail on
it* (fable-360).

So: **does a skin patch at 34px carry anything a colour swatch does not?** If
yes, skin joins the pictured rows. If no, it stays words, and the reason is on
the record rather than in taste.

## 2. What is cut, and why not the whole face

The scan asks about regions, and the `face` region is her whole face — useless
as a thumbnail, because a cutout of her entire face on a row called "Her skin"
reads as broken even though it is correct.

**The patch is the largest square of face that no other asked-about feature
claims.** Derived, never hand-placed: take the `face` mask, subtract every other
region the scan already read on that frame (eyes, brows, nose, lips, ears, hair,
glasses), and take the largest inscribed axis-aligned square of what remains.
That lands on a cheek or a forehead by construction, on any face, without a
proportion table — and a proportion table is exactly what the panel refuses to
draw boxes from.

**It costs no extra segmenter call.** Every mask it subtracts is already in
hand from the scan, and `face` is already read for the midline (shift 69's axis
memo). If the patch cannot be cut — a face too occluded to leave a square — the
row stays words for that face, which is the same answer the row has today.

## 3. The three arms

All three rendered at the panel's true size (34px, and the mask/stencil path the
real row would use — not a synthetic resize, or the bench measures a pipeline
nobody ships).

| arm | what it is | what it tests |
|---|---|---|
| **A — the patch** | her own skin patch, at 34px | the thing on trial |
| **B — the null** | a flat square of arm A's own mean colour | *does texture survive the size at all?* If A and B are indistinguishable, the thumbnail carries nothing a swatch does not, and a swatch is not a photograph of her |
| **C — the discriminator** | another cast's patch, cut the same way | *is it about HER?* If two different people's skin is indistinguishable at 34px, the row is decoration |

**Control arm (within-person):** a second patch from a different part of the
SAME face. It bounds how much of C's difference is just "a different square of
skin" rather than "a different person" — without it, C's number has no scale.

## 4. The bar, pre-registered

Mean absolute difference over the rendered 34px tiles, per pair, on **at least
six faces** spanning the tone range the product casts.

```
1.  A vs B  ≥ 6.0     texture survives the size
2.  A vs C  >  A vs A' (the within-person control), on at least 5 of 6 faces
3.  and the founder's own look at the contact sheet
```

**Bar 3 is not a formality and it is not a veto dressed as one.** This is a
visual studio: the maths proves a patch is not a flat tile and is not
interchangeable between people; whether it *reads as her skin* on a row called
"Her skin" is his ontology, and the sheet is built at true size so the question
he is answering is the one the panel actually asks.

**A failure is a result.** If bar 1 or 2 fails, skin stays words, the note is
updated with the number, and nothing else changes — which is the current
shipped behaviour, so failing costs nothing but the bench.

## 5. What this bench must not do

- **Not choose the prettiest patch.** The patch is derived by rule (§2) and the
  bench uses whatever that rule produces, including a bad one. A hand-picked
  freckle cluster would measure the best case and ship the average.
- **Not compare at full resolution.** The whole question is what survives 34px.
  A number taken at 512px would pass every arm and answer nothing.
- **Not read the tone off the words.** The skin ROW's words already carry tone
  ("warm olive, freckled"). This bench is about the picture only; if it fails,
  the words lose nothing, which is why failing is cheap.

---

# THE RESULT — run 2026-08-13, shift 70

**Bar 1 PASSES. Bar 2 FAILS 3 of 6. So skin stays words**, which is the shipped
behaviour, and per §4 that is a result rather than a disappointment.

```
face          A vs B    A vs C    A vs A'   C beats A'?
43ac4560       27.22     66.85     34.81    YES
7cf4f801       12.38     14.01     31.87    no
83e10422       10.05     17.62     23.35    no
4c98c7fc       13.00     17.67     31.83    no
d508cd29       11.27     39.41     20.27    YES
2f43a3fc       12.82     93.48     35.47    YES

1. A vs B >= 6.0 on every face      6/6   PASS
2. A vs C > A vs A'                 3/6   FAIL   (bar: at least 5 of 6)
3. the founder's own look                 OWED — output/skin-bench/
```

**What it means, in one line: at 34px a skin patch carries TONE strongly and
IDENTITY weakly.** When two casts have different complexions arm C wins hugely
(66.9, 39.4, 93.5); when their tones are close it loses to the within-person
control (14.0, 17.6, 17.7), because two places on one face differ more than two
faces of one tone. A tile that is mostly a tone swatch is a picture of something
the row's words already say — *"warm olive, freckled"* — so it earns its square
only for the founder's eye, which is bar 3, and bar 3 does not run alone.

**The FAIL is trustworthy in both directions:** both branches fired (3 YES, 3
no), so this is not a comparison that can only return one answer.

## Three corrections the run made to this design

1. **The patch is NOT free.** §2 said it *"costs no extra segmenter call"*
   because `face` is already read for the midline. It is not: the `skin` slot
   carries `question: { from: "none" }` (`referenceSlotCatalogue.ts:316`), so
   `scanPlan()` drops it and **no face mask is ever surfaced on `FaceScan`**.
   Run 1 proved it the loud way — 8 faces, 8 × "NO FACE MASK", every scan
   reporting 9 slots found. The patch needs one extra `face skin` read per face.
   If the row ever ships, that call is part of its price.
2. **The patch must stand BACK from every feature, and §2's rule did not.** The
   largest square of *face minus every other region* sat flush against eyes on
   several faces and carried eyelashes and orbital shadow into the tile — because
   SAM's masks are tight to the feature, so the shadow around it belongs to no
   region and survives as "skin". It contaminated the **within-person control**
   specifically, which is the arm bar 2 is measured against. Fixed with a 12px
   erosion; run 1's bar-2 number is void and run 1 is kept at
   `output/skin-bench-run1/` as the record of why.
3. **A population chosen by recency cannot answer a question about range.** §4
   asked for *"at least six faces spanning the tone range"*; run 1 took the six
   most recent dev faces and got six versions of one complexion, which makes arm
   C unanswerable rather than negative. Run 2 surveys all 18 ready dev faces with
   one cheap call each, takes each one's mean skin luma, and picks six **evenly
   across** the sorted range — 130.1 … 170.8, spread 40.7 against a pre-set
   adequacy bar of 20. The bench now refuses to report a bar-2 verdict at all if
   the pool is too narrow.

**One honest limit that remains.** The patch lands on the largest feature-free
skin area, which is *not always a cheek or forehead* as §2 claimed — `chin`,
`jaw` and `cheekbones` return NO READ from the segmenter, so they are never
subtracted, and two of the six patches landed on a chin. They are still skin and
the measurement stands; the claim about *where* it lands does not.

---

## 6. Cost

Zero segmenter calls beyond a scan that already happened, per face. Six faces ×
one scan each is $0.36 of house money if none are cached, and nothing is
charged to anyone. No object is written: the tiles are rendered, measured, put
in a contact sheet, and discarded.
