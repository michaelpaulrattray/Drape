# The horns specimen — what a static frame can and cannot calibrate

> **Status: dated record.** A measurement/evidence/court document from the date it states — it records what was true then; individual verdicts may since have been superseded. Current law: CLAUDE.md, the capability atlas, `DECISION_LOG.md` (#69 stamping sweep, 2026-08-28).


*Run 2026-08-15 after the enrolment (fable-566 §3, then §4's order: calibration
before the court). **6 segmenter reads, about three cents.** No generations, no
credits. Artifacts: `output/horns-specimen/`.*

---

## What was measured

The guard re-reads the region on the crop's own frame and computes
`|crop ∩ region| / |region|`. So both specimens were built on a delivered horns
frame, per side, and **both crops were looked at before either number was
used**:

```
                                    left      right
the whole horn, tip to base        100.0%    100.0%     ← looked at: complete
the same crop, top third gone       83.7%     83.7%     ← looked at: incomplete
```

`output/horns-specimen/left-complete.png` is the whole horn.
`left-incomplete.png` is the same horn with its tip missing. The label is a
human verdict on the artifact; the number is the instrument's reading of it.

## And why 100.0% is NOT the positive specimen

**It is the identity control**, and it matches the hair table's own note
exactly: *"a region scored as its own crop reads 100.0% (14 of 14)"*. A crop cut
straight from the mask, measured against a re-read of that mask on the same
bytes, has nothing to lose.

The mint's crop is not that. It is the SEGMENT CUT — the region narrowed by what
the edit actually delivered — which is why hair's positive specimen reads
**94.6%** rather than 100%. Adopting 100% as the horns bar would refuse every
real crop, including good ones, on the first pixel of ordinary variance: a
threshold nobody could pass, derived from a comparison that could not fail.

**So the positive specimen has to come from a real mint**, and the shipped
enrolment is what produces it: every horns crop is refused `noSpecimen` and
KEPT, with its reading in the refusal — *"horns has no completeness specimen
yet; it read NN.N% and no number here is earned"*. That is the material. Cut,
keep, measure, calibrate, in that order and no other.

## What this run does establish

1. **The identity control reproduces for horns** — the instrument reads a crop
   as itself at 100.0% on both sides, so it is not mis-scaled or mis-scoped for
   this kind's per-side reads.
2. **A real mis-cut is separable** — the same crop with its tip gone reads
   83.7%, so the instrument moves in the right direction by the right kind of
   amount when a horn is genuinely incomplete.
3. **The negative specimen is in hand** at 83.7%, from an artifact that was
   looked at.

What is missing is exactly one number, and it cannot be invented here.

## The limits

- **One frame, one face.** Both sides of one delivered pair.
- **The verdicts are the executor's**, not the founder's. The hair specimens
  carry his eye; these carry mine, and the pictures are on disk for anyone who
  wants to disagree.
- **83.7% is a shape, not a law**: it is what removing a third of a box does to
  this horn. A different mis-cut reads differently, which is why it is filed as
  the negative rather than as the bar.
