# Rider — the boundary-contact check

**Founder rider, definition transmitted verbatim 2026-08-06. Canonical.**
Applies to destination-zone edits.

> **STATUS: BUILT** — `expandUntilClear` in `server/castingV2/maskGeometry.ts`,
> shipped `cb94a781`. Fires on painted content touching the zone's hard edge;
> the re-render ceiling is measured on the EFFECTIVE edit (the harvest), not the
> zone, because under harvest gating the zone is only an outer bound.
>
> **Every rider in this folder carries this line, and it is not bookkeeping.**
> This one sat canonical and unbuilt while the founder reported hair "cut off
> straight" across three passes, and two diagnoses went to the painter and the
> segmenter before landing on the zone. **Spec'd-but-never-implemented is the
> invoked-but-inert class wearing better paperwork** — the rule exists, the
> document exists, the call site does not, and nothing in the repository says so.
> A rider without a built/unbuilt bit can sit quiet indefinitely.

## The rule, as given

> After a masked render, examine the painted content — the newly generated
> pixels — against the edge of its own destination zone. Painted content touching
> or pressing against the zone boundary means the zone was too tight: real hair,
> fabric, or style never ends in a straight line where a mask happened to stop.
> On contact: auto-expand the zone and re-run, before any scoring or delivery —
> the system notices its own crop mechanically, the way an eye notices a photo
> cut off mid-style. Repeated expansion that pushes coverage past the 60% rule
> routes the edit to the full-frame path rather than expanding forever.

## The precision that matters

**The check runs on the PAINTED CONTENT, not on the mask geometry.** A generous
zone whose paint sits comfortably inside it passes untouched, however near that
zone's own edge happens to sit to anything else.

This was the correction to a plausible-sounding inference — that a mask touching
the edge of its region should expand — and the difference is not cosmetic. Mask
geometry says where paint was *allowed*; painted content says where paint
*went*. Only the second can tell you the zone was too tight, and a check built on
the first would fire constantly on generous zones and stay silent on the exact
failure it exists to catch.

## Implementation shape

It is arithmetic, not a reader — the same move as D-209.

1. **Find the painted set.** Inside the mask, the pixels where the composite
   differs from the master. That set is already computable byte-for-byte; no
   model is asked whether something was painted.
2. **Find the zone's hard edge.** The destination zone before feathering — the
   feather band is a blend, not a boundary, and measuring contact against a ramp
   would report contact for every edit.
3. **Test contact.** Does the painted set reach that edge, or press against it
   within a small tolerance?
4. **On contact: expand and re-run**, before scoring and before delivery. The
   crop is noticed mechanically rather than by anyone looking.
5. **On repeated expansion past 60% coverage: route to the full-frame path** with
   the reference as a frozen anchor, rather than expanding forever. Same boundary
   as `assertUsable`'s ceiling — this is one more road into it, which is further
   evidence the ceiling is a routing decision rather than a refusal.

## What it costs, stated plainly

An expansion is a **re-render**. The check must therefore be right about contact
before spending, and the tolerance is a number that will need measuring on the
fixture rather than guessing here. Provisional until the probe sets it, and
labelled that way when it lands — same discipline as the coverage bands (D-213).

Growing hair is the obvious case. Shrinking is not exempt: reconstructed
background that presses against the zone edge is the same evidence of a zone cut
too tight, and the max-delta fixture scores both directions separately anyway.
