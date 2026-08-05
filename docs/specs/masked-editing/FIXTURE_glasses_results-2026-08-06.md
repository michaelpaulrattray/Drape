# Fixture — the glasses case, both scenarios, three engines

**Run 2026-08-06.** `scripts/calibration/glasses-fixture.mts` and
`scripts/calibration/boundary-contact-expansion.mts`. Raw results in
`output/masked/glasses-fixture/results.json` and
`output/masked/boundary-expansion/results.json`.

The first renders in this workstream. Everything before established that masks of
the right shape can be obtained; this asks whether an edit made inside one holds
the guarantee the architecture rests on.

Master: `fresh-02` from the bespectacled roll. Feather radius 3.

## The guarantee held, six times out of six

**Outside the feathered mask, the composite is byte-identical to the master** —
every scenario, every engine, including the one that produced a visibly broken
picture. Settled by arithmetic (`outsideMaskUnchanged`), no vision model asked.

That is worth stating plainly because it is the whole point of the pivot: a bad
render can now only be bad *inside its own mask*. The founder's walk — freckles
replacing a hairstyle, an earrings edit deleting glasses — is structurally
unavailable on this path.

## Scenario (a) — compound same-region edit

Fox eyes + green irises + thicker brows + different glasses, batched into ONE
mask and ONE pass (batch by REGION, never by count). Mask =
`union(eyeglasses, eyes, eyebrows)`, coverage 1.54%.

| engine | outside | seam mean | seam max | contact@2 | time |
|---|---|---|---|---|---|
| gpt2 | byte-identical | **16.4** | 221 | **70.5%** | 61s |
| nbp | byte-identical | 19.3 | 216 | 76.5% | 38s |
| flux | byte-identical | 35.9 | 228 | 93.3% | 26s |

**FLUX failed this scenario visibly** — doubled, ghosting frame outlines
(`EXHIBIT-5`). The cause is structural: the mask was segmented from the OLD
glasses, so an engine drawing a larger frame paints outside that footprint, is
clipped, and leaves the new frame's interior sitting inside the old frame's
edges. **A same-region edit that changes an object's silhouette cannot use a
tight segmentation of the object as it currently is.**

## Scenario (b) — eye edits that keep the glasses

Mask = `subtract(union(lenses, brows), frames)`, coverage 1.18%. The frames are
**excluded last**, so they are composited back verbatim *by construction* rather
than by asking a model to leave them alone.

| engine | outside | seam mean | seam max | contact@2 | frames |
|---|---|---|---|---|---|
| gpt2 | byte-identical | **10.3** | 138 | 67.5% | unchanged |
| nbp | byte-identical | 15.1 | 165 | 82.1% | unchanged |
| flux | byte-identical | 21.1 | 172 | 92.9% | unchanged |

**All three engines' frames are pixel-unchanged, including FLUX's** — the engine
that failed the other scenario. D-211's exclusion-subtracts-last is doing real
work: an exclusion cannot be talked open by a prompt.

Lens interiors regenerated correctly in all three; the eye is visible through
glass with no frame disturbance. The behind-glasses case, which defeated the
whole-frame reader on the founder's walk, is here just a small crop.

## The boundary-contact rider, measured rather than guessed — D-218

The rider says the tolerance is a number to measure on the fixture. Measuring it
produced something better than a tolerance.

**First, the precondition the rider does not state.** On a *tight object mask*
absolute contact is high for everything — the glasses go right up to where the
glasses are. Contact is read as a **comparison**, never as an absolute threshold.
As a comparison it ranked the three engines correctly before anyone looked at a
picture: 93.3% / 76.5% / 70.5%, and the 93.3% is the broken one.

**Second, and the real finding.** Re-compositing the *same saved renders* against
grown zones — no new spend:

| engine | r=0 | r=8 | r=16 | r=32 | seam r=0 → r=16 |
|---|---|---|---|---|---|
| gpt2 | 70.5% | **17.6%** | 18.0% | 27.4% | 16.4 → **2.7** |
| nbp | 76.5% | **32.9%** | 27.6% | 38.2% | 19.3 → **3.7** |
| flux | 93.3% | 80.6% | 85.0% | 80.9% | 35.9 → 30.8 |

**A genuine local edit CONVERGES under expansion** — contact collapses, the seam
falls four to five-fold, the clipped paint lands and the patch meets the master
naturally. **FLUX never converges at any radius**, and `EXHIBIT-7` shows why: at
r=32 it has not improved, it has recomposed the region wholesale — different eye
size, different brows, different facial proportions. More room means more
difference, because it is re-rendering, not editing.

So the expansion loop terminates on **two** conditions: coverage past 60%, or
**contact that stops falling**. The second fires at 3% coverage where the first
would never fire at all, costs nothing, and needs no model. It is a free
detector for *this engine is not doing a local edit* — the exact class the pivot
exists to prevent.

## Bake-off — first evidence, not a routing row

GPT Image 2 leads on seam in both scenarios and is the most restrained
photographically. NBP oversaturates the iris on a colour instruction. FLUX
over-styles (it added heavy lashes nobody asked for) and fails the
silhouette-changing case outright.

One specimen, one prompt pair. **Taste is the founder's** — exhibits 5, 6 and 7
are the side-by-sides.

## What this does not settle

- Grain matching and spill bands are not yet scored; seam mean/max is a proxy.
- Cropped-region verification against the behind-glasses false-refusal class is
  not yet run — the masks make the question small, but the measurement is owed.
- All three engines added eyeliner or lash content nobody asked for on the
  fox-eye instruction. Whether that is the prompt's fault or the engines' is
  unmeasured.
- The silhouette-change case (a) wants a **destination zone**, not a tight object
  mask. That is the max-delta fixture's territory and it now has a second
  motivating case.
