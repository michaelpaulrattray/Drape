# Multi-subject identity gate (2026-08-01)

The pre-M7 condition named in plan §I's heritage ruling: identity retention
verified **across demographics, not just one**. M3 established retention on a
single anchor — a photoreal adult male — and its own report says a
single-subject result should not be generalised. M7's package orchestrator is
built entirely on the assumption that it does.

**Verdict: PASS on all three subjects. M7's identity assumption holds.**

Spend: **$3.40** of the ~$5 approved (18 images, plus a 6-image re-run).

---

## Method

Three subjects chosen to move the axes M3 did not:

| Subject | Axis tested |
|---|---|
| West African woman, early 30s, close-cropped hair | woman + deep skin tone |
| East Asian woman in her late 60s, silver hair | older + woman |
| Mediterranean man in his 70s, weathered face | older man |

Anchors came from the **real compiler**, so what was tested is what a paid roll
produces. Views were generated through the identity engine with the anchor as
the only reference, across M3's canonical set minus motion: front, frontClose,
threeQuarter, side, back.

Judged by eye, deliberately. M3's perceptual metric measures layout and tone
and — in its own words — "cannot see identity". The cohort validator that will
do this mechanically is M7 work, so this run produces evidence for a human
verdict rather than a number that would flatter itself.

## Result

Identity held on **all three subjects across all five views**: same face, same
bone structure, same skin, same hair, through a 90° profile and from behind.
Deep skin tone held without lightening. Age held without the older subjects
drifting younger in the derived views — the failure mode most likely to have
hidden in a single-subject result.

No subject showed the drift M3 warned might be demographic-specific. The
condition is discharged.

## The defect this run surfaced — worth more than the verdict

The third subject's first anchor came back as a man **in his twenties**. The
brief said "Mediterranean man in his 70s". The lock contract showed why: `sex`
and `heritage` captured, **`ageBand` absent entirely**.

Repeated testing showed the interpreter dropping the stated age on **3 of 4
runs** of that brief — non-deterministically, while handling "a woman in her
70s" and "a man of 82" correctly every time.

The cause was my own system prompt. The restraint doctrine ended with *"Under-
filling is always the safer error"*, and on a brief carrying several facts the
model took that literally and discarded one the brief plainly stated. The
instruction meant *never invent*; it was read as *when in doubt, drop it*.

The same overshoot pattern as the expression clause, which went from
"performing" to "vacant" when pushed too hard in one direction, and the same
failure class as the heritage gap the founder ruled on: **a stated fact
silently dropped is a lock violation, not caution.**

Fixed by stating the other half of the rule as explicitly as the first, with
this exact brief as a worked example inside the prompt. Verified 9 for 9 across
three briefs and three repeats each.

**This is the argument for calibration runs over unit tests.** No offline test
would have caught it — the parser was correct, the enum was correct, the schema
was correct. Only generating a real image of a 25-year-old when a 75-year-old
was asked for made it visible.

## What this run does NOT establish

- **Revisions.** M3 tested three sequential revisions on its single subject;
  this run tested views only. Revision retention across demographics is
  unmeasured.
- **Non-human and stylized cohorts.** Photoreal humans only. M9's certification
  is untouched by this.
- **Sustained retention.** One anchor per subject, one pass. No repeat-run
  variance measured.
- **A mechanical threshold.** This is a human verdict on 18 images, not a
  score. The cohort validator (M7, with the view-conformance component M3's
  report requires) remains the thing that must make this automatic.
