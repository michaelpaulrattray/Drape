# Two ways to make an edit stick — one page, for the founder

*Ordered by fable-120 half 2. The founder chose base anchoring (D-86) before
this class of evidence existed; this puts the two options beside each other so
the choice is made against measurements rather than against a fear and a fact.*

**Nothing here is a recommendation.** The left column's costs are read off the
design doc and the code; the right column's degradation is measured on this
machine, with the n stated.

---

## The problem both of these solve

A segment's mask is cut against the MASTER's geography, and the things a
customer buys live where the master has nothing. Measured on the founder's own
account, candidate `84598983`:

```
his paid "hair down" edit          232,370 px changed against the master
  inside the kept segment's mask     23,231 px   10.0%   ← all kept, byte-identical
  outside it                        209,139 px   90.0%   ← 0.0% survived
```

The store kept **100% of what it was given** and **10% of what she bought**. The
adjudicator says KEPT and the founder says reverted, and both are right.

Two designs fix it, and they are partial alternatives to each other.

---

## Column A — segments cut from the DELIVERED thing

Keep anchoring every render on the master; change what the compositor pastes
back, so a segment's mask comes from the delivered frame's own extent of the
thing rather than the master's.

**Already built and deployed, as the first consumer of exactly this rule:** the
accessory corridor (`6bc2b75e`). An earring's ground is now
`applied ∩ (corridor ∪ delivered ∪ master)` — arrived ground, delivered extent,
departed ground — and accessories persist by pixels instead of being re-rolled
from words on every render. So Column A is not a hypothesis; its cheapest half
is in production and its shape survived contact.

**What the rest of it costs, named rather than discovered:**

| | |
|---|---|
| **One extra segmentation call** | per landed render that files a patch, on the half of renders that keep anything. Roughly the harvest's own cost. Accessories were free of this because their delivered read was already being made; `hairWorn` is not. |
| **A NEW BOUNDARY CLASS** | pasting delivered-ground onto master-ground is painted-then-pasted meeting untouched-master. No check in this product has ever passed that boundary. It is the reason the coherence statistic was a prerequisite rather than a follow-up. |
| **Surrender rules for grown grounds** | four of them, and they are new law: later delivery wins an overlap; a segment may not claim ground its own reading did not find; departed ground is surrendered before arrived ground; growth is bounded by the ask. |
| **A bigger purge** | a hair-down crop is an order of magnitude larger than a bun crop. Retention is unchanged (segments die with their candidate); the bytes go up. |

**What it does NOT change:** base anchoring, coordinates, the row shape, the
retention regime, the flag. Every variant stays `edit(the ORIGINAL, 1..N)`, so
the photocopy argument never applies.

---

## Column B — anchor each render on the previous COMPOSITE

Most of Column A becomes unnecessary: if render N+1 is made from composite N,
then what she is looking at IS the base, and a delivered hair-down is simply
there.

**The argument against it has always been the photocopy of a photocopy — and
that argument has never been measured on the right animal.** Bench B's control
re-anchors on the previous raw FRAME, so the entire picture is regenerated at
every step. A composite-anchored chain is different in kind: outside the applied
region the composite is byte-identical to its own anchor, so untouched ground is
COPIED, and only the repainted region re-encodes, once per step.

*(The measurement is filled in below from
`output/composite-anchored/composite-anchored-arm.json`.)*

**What it costs, named:**

| | |
|---|---|
| **Undo becomes a re-render** | today an undo retires a row and the next composite simply omits it. With chain anchoring the pixels are baked into the anchor, so taking one facet back means rebuilding from an earlier frame. |
| **D-146's guard** | the base-anchoring guarantee is what several checks are written against; `outsideMaskUnchanged` would then be a statement about the previous composite rather than about her master. |
| **Seam recalibration** | every instrument that exploits master-identity to find a boundary is measuring against a moving reference. |
| **Drift has no floor** | base anchoring bounds error at one generation, forever. Chain anchoring bounds it at whatever the per-step measurement below says, compounded over a session's length. |

---

## The measurement — and why it does not answer the question

Run 2026-08-09, `scripts/calibration/composite-anchored-arm.mts`, twelve fixture
paints on fal (provider balance; no campaign credits). Same master, same six
asks, same regions, same instrument as bench B, so the columns are comparable.
**n = 2 chains on the new arm; bench B's two arms are n = 1 each, stated because
it is not 2.**

Each region measured at the step that delivered it, against the last frame of
its own chain:

```
  region     patched(B)      photocopy(B)     composite#1    composite#2
  hair       1.005  held     0.690  DEGRADED  1.000  held    0.999  held
  eyes       1.000  held     0.854  held      1.038  held    0.942  held
  eyebrows   1.000  held     0.532  DEGRADED  1.000  held    1.000  held
  lips       1.000  held     0.651  DEGRADED  1.000  held    1.000  held
  nose       1.000  held     1.087  held      1.000  held    1.000  held

  degraded:  0 of 5          3 of 5           0 of 5         0 of 5
```

The composite's own guarantee held on all twelve steps.

Read carelessly, that is *"chain anchoring costs nothing — measured"*. **It is
not, and the reason is in bench B's own artifact:**

```
bench B, overlaps between its six regions:  []   ← they are DISJOINT
```

On a disjoint chain, composite anchoring and patch anchoring produce the same
picture **by construction**, and one line of algebra says so:

```
version_k  =  anchor_(k-1)  with region k replaced by fresh paint
anchor_(k-1) =  master      with regions 1..k-1 replaced
⇒ final     =  master with each region replaced by its own fresh paint
```

which is exactly what the patched arm builds. The `1.000`s were guaranteed
before the first frame was painted. A null result needs a proven delta, and this
fixture cannot produce one between these two arms.

**What the run does establish**, and it is not nothing:

1. **The instrument fires on this exact fixture** — the photocopy control
   degrades 3 of 5 on the same six asks. So a real degradation here would have
   been seen.
2. **The gap between a composite-anchored chain and a full photocopy is real and
   large.** The photocopy argument, which is the standing objection to chain
   anchoring, has been measured against the wrong animal: regenerating the whole
   frame every step degrades, and re-encoding only the repainted region does not.
3. **The fresh-paint column cannot separate the arms at this n.** Each step's
   freshly painted region against the master's own sharpness there moves in both
   directions (hair 0.569 → 0.603 / 0.688; lips 0.928 → 0.845 / 0.757), and the
   spread *between the two composite chains* is as large as the difference
   between the arms. Reporting either direction from it would be reading noise.

### What would answer it

An **overlapping** chain — two or more edits on the same ground (hair colour
then hair worn; lip gloss then fuller lips) — because that is the only shape
where composite anchoring re-encodes ground a second time and patch anchoring
does not. Both arms, n ≥ 2, same instrument: 24 fixture paints, roughly 70
minutes. That measurement is not yet made, and this page does not pretend
otherwise.

---

## What the founder is actually being asked

Not "which is better". The question is narrower:

> **Is the per-step degradation of a composite-anchored chain small enough to be
> worth not building the boundary class, the surrender rules and the bigger
> purge — given that undo becomes a re-render?**

**As of 2026-08-09 the honest answer is that the degradation is unmeasured on
the shape that matters**, and the fear it rests on has been shown to be about a
different mechanism. Column A's first consumer is already shipped and working,
so nothing is blocked by leaving this open — but the choice should not be made
on this page's numbers until the overlapping chain has been run.
