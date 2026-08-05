# Fixture — cross-image style transfer at maximum delta

**Founder-raised via Fable, 2026-08-06. Not yet run.** Spec recorded here so the
next session executes it rather than re-deriving it.

## The case

A **crew-cut master** and a **giant-afro reference**. The largest hair delta the
product can be asked for, chosen deliberately: everything smaller is a special
case of it.

The destination zone is sourced from the **reference's** hair segmentation,
**landmark-aligned onto the master's head** and padded. The face is carved out as
law (D-211) — the alignment moves the zone, never the exemption.

## Both directions, scored separately

They are not symmetrical, and pretending they are is how a fixture flatters a
technique.

| direction | what the model must do | expected difficulty |
|---|---|---|
| **grow** (crew cut → afro) | paint hair over background | easy — the destination is empty and nothing is occluded |
| **shrink** (afro → crew cut) | **reconstruct what was behind the hair** | hard — the background, the ears, the neck and the shoulder line were never photographed |

**Shrink is the real test.** "Paint background over it" is a sentence, not an
operation: the pixels behind a large afro do not exist in the master, so the
model is inventing seamless studio backdrop, an ear it has never seen, and a
jawline edge that must match the one still visible below. A shrink that looks
right is evidence the masked path handles occlusion; a shrink that smears is the
honest ceiling of local editing.

## What this measures that nothing else does

**Where the 60% rule fires.** `assertUsable` refuses a "local" edit covering more
than 60% of the frame as a re-render wearing a mask's clothes (D-211). A
silhouette-scale hair transfer is the first legitimate instruction that can
approach that line, so this fixture finds the actual boundary rather than
defending a guessed constant.

**And that boundary is a routing-table row, not a refusal.** Past it, the edit
routes to the **full-frame path with the reference as a frozen anchor** — which
is arm (e′)'s shape (D-200 amended, D-204). So the two workstreams meet here:
*masked below the line, anchored full-frame above it*, with the crossover chosen
by measured coverage rather than by taste. That is worth stating plainly because
it means (e′) is not a parallel experiment — it is the other half of one system.

## New capability this needs

**Landmark alignment between two different faces.** Everything shopped so far is
segmentation; mapping a reference's hair zone onto a master's head needs
correspondence — eye centres, head axis, scale. That is a distinct model
requirement from face parsing or matting, and it belongs in the shop's next
round with its own routing row. Padding covers alignment slop; it does not
substitute for alignment.

## Scoring

Per direction, kept separate per the standing rider:

- **outside-mask byte identity** (D-209) — the guarantee, unchanged.
- **seam band** at the hairline and the shoulder line — where a silhouette edit
  will fail first.
- **identity to master**, geometry only, against a floor (D-203).
- **coverage** of the aligned destination zone, which is the number the routing
  boundary is read from.
- **occlusion honesty** on shrink: does the reconstructed region read as
  photographed, or as invented? Founder eye, side-by-side, no metric claimed.

The negative control stays in the fixture permanently (D-213).
