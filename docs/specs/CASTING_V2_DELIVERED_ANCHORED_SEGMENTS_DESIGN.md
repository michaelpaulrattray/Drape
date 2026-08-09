# Segments anchored to the DELIVERED thing

*Design document. No code has been written. Ordered by fable-118 after founder
finding #4; every number in it is measured on production artifacts.*

---

## The disease, in one sentence

**A segment's mask is cut against the MASTER's geography, and the things a
customer buys live where the master has nothing.**

Two production measurements say it, and they are the same disease seen from two
ends.

### The hair she paid to wear down

Candidate `84598983`, the founder's account, 2026-08-09. `v#163` = "she wear her
hair down", delivered, verified, hair genuinely down. Measured on the stored
frames (`scripts/measure-hairdown-revert-disposable.mts`):

```
DELIVERED by the paid edit                232,370 px changed against the master
  inside the kept segment's mask           23,231 px   10.0%
  OUTSIDE it                              209,139 px   90.0%
SURVIVING byte-identical on the next render
  of everything delivered                  23,231 px   10.0%
  of what the mask did not cover                 0 px   0.0%
REVERTED to the master's own pixel        208,273 px   89.6%
```

The store kept **100% of what it was given** and **10% of what she bought**. The
adjudicator says KEPT and the founder says reverted, and both are right: the
segment was cut as `applied ∩ region("hair" on the MASTER)`, and her master's
hair region is a bun. Hair worn down lives on her shoulders and her chest, where
the master's hair region does not reach.

### The earrings that swap ears

```
every segment row in production, by facet:
   6 edit_patch marks · 4 edit_patch makeup · 3 edit_patch hairWorn
   1 edit_patch eye.colour                                    total 14
   statedAccessories:  ZERO
```

Not one accessory pixel has ever been kept, on any face, on any render this
campaign has paid for. `statedAccessories` has no entry in `REGION_OF_FACET`,
so `regionNameOf` returns null and the cutter never files one. Accessories are
re-rolled from words on every later render — which is why the founder's single
gold hoop appeared on her left ear in `v#156` and on her right in `v#157`.

**Same disease.** A delivered earring hangs where the master's ear is bare; a
delivered hair-down covers ground the master's bun never touched. In both cases
the mask asks the master where the thing is, and the master's honest answer is
*"it isn't here."*

---

## The proposal

> **Cut the segment from the DELIVERED frame's own extent of the thing.**

Concretely, `cutSegments` gains a second segmentation pass — the same reader,
the same region names, run on the delivered composite — and a facet's ownership
becomes

```
own(facet) = applied ∩ ( region(facet, delivered)  ∪  region(facet, master) )
```

Coordinates stay in the master's frame throughout, which is what every existing
consumer (the compositor, the adjudicator, the prune, the face chart) already
assumes. Content is taken from the delivered frame, as it is today.

### Why the UNION, and not simply the delivered region

Because an arrangement change has two grounds and only one of them is where the
thing now is.

- **Arrived ground** — where the delivered thing sits and the master had
  something else. Her shoulders, under the loose hair. `region(facet, delivered)`
  finds it; the master cannot.
- **Departed ground** — where the master's version of the thing sat and the
  delivered frame has something else. The vacated bun at the back of her head,
  now shirt and background. `region(facet, master)` finds it; the delivered
  frame cannot.

Paste only the arrived ground onto a later render and you get her hair down
**and the bun still there** — two hairstyles on one head. The departed ground is
not an optimisation; it is half of what the change was.

This is the same arrived/departed pair the removal machinery already reasons
about, arriving at the segment store from the other direction. That is a reason
to be confident in the shape and a reason to check the two do not build a second
answer to one question (law 4): **the departure vocabulary already exists, and
this design should consume it rather than restate it.**

### What this does NOT change

- Base anchoring. Every variant stays `edit(the ORIGINAL, instructions 1..N)`.
  This changes what the compositor pastes back, never what the painter is
  handed. The photocopy-of-a-photocopy argument (founder queue item 3) is
  untouched.
- Coordinates, the row shape, the retention regime, the purge, the flag.
- `detected_born` segments. A thing she came with IS in the master, so the
  master is the right geography for it — the delivered pass is for `edit_patch`
  only, which is also the cheaper half.

---

## The seam implication, stated honestly

**Pasting delivered-ground onto master-ground creates a NEW boundary that no
check in this product has ever passed.**

Today the compositor's guarantee is `outsideMaskUnchanged`: outside the applied
region the composite is byte-identical to the master. Every seam instrument
rests on it — `compositeSeam` exploits exactly that identity to measure a step
across the boundary. A delivered-extent paste is a change of territory: the
segment now owns pixels the master owns in every other render, and the boundary
between them is painted-then-pasted meeting untouched-master.

This is not a reason not to do it. It is the reason this document belongs to
fable-114's boundary spine, and it comes with the measurement that shift already
made on the founder's own seam:

```
his shirt seam, on the frame he complained about
  boundary samples in his band            3,080
  pixels over the tear bar (80 levels)        0
  signed excess along the boundary     −10.31 ± 9.22   |mean|/sd 1.118
  the same statistic, whole boundary    +0.39 ± 19.76  |mean|/sd 0.020
```

A tear is an amplitude; a blend seam is a **coherence** — a small consistent
offset the eye integrates along an edge. The existing detector measures |step|
and thresholds at 80, so it cannot express the founder's defect at any bar. So:

> **Prerequisite, not a follow-up: the coherence statistic must exist and be
> recorded before delivered-anchored segments ship**, because this change
> manufactures more of exactly the boundary it measures. Shipping the paste
> first would be building on an instrument that cannot see the thing the
> instrument is for — working law 2, in the most expensive place available.

The cheapest route to it is the one already proposed in opus-092: persist the
seam verdict on the row for every render, coherence beside amplitude, in shadow.
A week of dogfooding then produces the specimen set both this design and the
shadow→enforce flip have been waiting on.

---

## The surrender and overlap rules for grown grounds

A master-anchored segment could never overlap much, because every facet was
confined to its own master region. A delivered-anchored one can: her hair worn
down covers ground that also belongs to her shirt, her shoulders, and possibly a
later garment edit.

The rules this needs, in the order they bite:

1. **Later delivery wins the overlap.** The existing surrender rule (a facet's
   own reading decides what it keeps) extends to territory: when two segments
   claim a pixel, the one filed by the LATER variant on the branch owns it, and
   the earlier one records the loss as an intersection. The adjudicator already
   reads intersections off the row and already refuses to call a face CLEAN over
   an unresolved one — so this is a extension of a mechanism with teeth, not a
   new promise.
2. **A segment may not claim ground its own reading did not find.** The
   delivered-frame region is a segmentation answer, and an unverified answer
   files nothing (the permanence fix of 2026-08-09 already established this for
   facets; here it must also gate the EXTENT).
3. **Departed ground is surrendered first.** When a later edit re-makes the same
   facet, the earlier segment's departed ground is released before its arrived
   ground — vacating a place is not a claim on it, and holding it would let an
   old edit veto a new one's silhouette.
4. **Growth is bounded by the ask.** A `hairWorn` segment may grow to the hair's
   delivered extent; it may not grow into her face because the segmenter had a
   bad day. The boundary-contact expansion already has this shape (a cap plus a
   reason) and should be reused rather than re-invented.

---

## First consumer: the accessory corridor

Accessories are the right first consumer and the cheapest one:

- The geography already exists — `LANDMARK_OF_ACCESSORY` gives the ear corridor,
  `additionDestination` builds a disc at each landmark, and the pair law (shipped
  2026-08-09) means both ears are in the ask and in the reader's question.
- There is no departed ground for an addition, so the hardest half of the design
  is not on the critical path for the first delivery.
- It closes the side-swap directly: an earring with kept pixels is pasted where
  it was delivered, on the ear it was delivered to, on every later render.
- It is small — a `REGION_OF_FACET` entry cannot express it (the region depends
  on the described object), so the cutter takes the corridor the harvest already
  built, which is one parameter and no new segmentation call.

`hairWorn` is the second consumer and the one that needs the whole document.

---

## What this is worth, and what it costs

**Worth:** the 90% of a paid arrangement edit that currently reverts on the next
render, and every accessory the product has ever delivered and then forgotten.

**Costs, named rather than discovered:**

- One extra segmentation call per landed render that files a patch (the
  delivered-frame regions). Not free; roughly the harvest's own cost, on the
  half of renders that keep anything.
- More stored pixels per segment — a hair-down crop is an order of magnitude
  larger than a bun crop. Retention is unchanged (segments die with their
  candidate), but the purge's bytes go up.
- A new boundary class, addressed above, and the reason the coherence instrument
  is a prerequisite rather than a companion.

**Not proposed here:** chain anchoring (founder queue item 3). These are
alternatives to each other in part — anchoring on the composited previous frame
would make most of this unnecessary — and that decision is the founder's, not
this document's. The two should be put side by side before either is built,
which is a recommendation rather than a plan.
