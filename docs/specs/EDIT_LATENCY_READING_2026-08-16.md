# Where a paid edit's three minutes go — the reading

Ordered by the founder in person, 2026-08-16: *"3 minutes is very long for a
render — have we looked at why?"* (fable-678 §5). **Measurement only. Nothing
in this document has been changed in the product**; the cut list needs Fable's
countersign, and anything touching a verification gate or spend semantics is a
founder card.

Read with `scripts/read-edit-latency-disposable.mts` off the census rows
`refineService` already persists in `casting_candidate_variants.internalPrompt`
(`.census`). Zero credits: rows and code only.

## Before any number: what this reading does NOT cover

- **Coverage.** Dev: **56 of 68** recent variant rows carry a census (82.4%).
  Production: **4 of 18** (22.2%). The production column is four edits and is
  quoted as corroboration, never as the estimate.
- **Every total is a floor.** The persisted field is `censusSoFar()`, taken as
  the row lands, so spend after the picture is stored is absent. The complete
  figure only ever went to a log line, whose window rotates on every deploy.
- **42% of calls carry a label.** `about` is recorded for segment calls (the
  region asked) and for some reads. The `read` stage — the biggest non-paint
  pot in production — is largely **unlabelled**, so it can be timed but not yet
  attributed. That is a measurement debt, named as candidate 3.

## The shape of the wall

| | dev (n=56) | production (n=4) |
|---|---|---|
| wall per edit, median | **204.1 s** | **209.1 s** |
| sum of call time, median | 194.7 s | 202.4 s |
| paint (`render`) | 109.0 s · 56.9% | 98.9 s · 60.1% |
| our own reads (`read`) | 40.8 s · 6.3 calls | 51.3 s · 9.8 calls |
| region reads (`segment`) | 41.7 s · 5.3 calls | 14.4 s · 8.0 calls |
| **everything but the paint** | **82.4 s** | **65.7 s** |

**The finding is the first two rows.** Sum ≈ wall (95–97%) means the edit is
not one slow thing — it is a **queue of roughly twenty round trips taken one
after another**, only one of which is the picture. A worked example, variant
324 in dev, twenty calls in completion order:

```
  0  render   —              99.3 s   gpt-image-2/edit
  1– 4  read (unlabelled)    41.0 s   claude-sonnet-5   ← four, in a row
  5– 6  segment hair, face    9.9 s   sam-3
  7–10  segment eye ×4       19.0 s   sam-3             ← four, in a row
 11–12  read (unlabelled)     9.4 s   claude-sonnet-5
 13     segment hair          6.7 s   sam-3
 14–15  read (unlabelled)     9.1 s   claude-sonnet-5
 16–19  segment eye ×4       27.2 s   sam-3             ← four, in a row
```

## What is NOT a saving, checked before it was quoted

The first pass flagged *"the same question asked twice in one edit"* —
`segment:eye` in 17 of 56 edits, +119 calls, an apparent **18.9 s/edit**. Then
the call sequence above was read: the eye reads come in **4 before and 4
after**, which is the harvest reading the master and then the delivered frame.
That is two different pictures, not one question asked twice, and removing it
would remove the measurement that proves the edit landed. **Withdrawn as a
saving.** The filed duplicate-"face" ask is not visible in this window either.

## The candidates, costed in seconds and in risk

| # | Candidate | Seconds saved / edit | Basis | What it weakens |
|---|---|---|---|---|
| 1 | Issue each run of consecutive **segment** calls together instead of one after another | **28.0 s** dev · 13.5 s prod (p90 54.0 s, max 157.0 s; 29/56 edits) | measured bound: sum − slowest, per run | **Nothing about the answers** — same questions, same frames, same masks. Risk is the provider budget, not the product |
| 2 | The same for consecutive **read** calls | **21.4 s** dev · 34.4 s prod (p90 25.6 s; 56/56 edits) | measured bound, same method | Unknown until each site is read: if a later read consumes an earlier read's answer, it cannot move. **Must be proven per site, not assumed** |
| 3 | Label the `read` stage's `about` | 0 s directly | — | Nothing. It converts the largest production pot from timed-but-anonymous into attributable, which is what candidate 2 needs to be safe |
| 4 | ~~The paint itself~~ — **DEAD by founder ruling** | — | 99–109 s, 57–60% of call time | — |

**Candidates 1 and 2 together bound at ~49 s dev / ~48 s prod — roughly a
quarter of the wall — and neither removes a question, a check or a gate.** They
change *when* calls are issued, not *what* is asked or *what is done with the
answers*. That is why they are the first two: the verification layer is the
founder's money-protection, and nothing here touches it.

### The risk on candidate 1, stated plainly

The fal account ceiling is **20 concurrent requests**, and four paths already
spend it (`assertFalBudget` refuses to boot if their sum exceeds it):
`ROLL_IMAGE_CONCURRENCY` 8 + `SIGN_VIEW_CONCURRENCY` 3 + `REFINE_EDIT_CONCURRENCY`
3 + `FAL_CONCURRENCY` 6 = 20. *(The arithmetic above is this reading's own date.
On 2026-08-18 the plate mint became a fifth path and the cut came out of the
courtesy pool: `FAL_CONCURRENCY` 5 + `INK_PLATE_CONCURRENCY` 1, still 20 of 20.
The reading is left as it was taken.)* `FAL_CONCURRENCY` is the segmenter's allowance and
it exists because of a measured incident: eight panels opened at once returned
**no rows at all on five of them**, with `429 concurrent_requests_limit`.

So candidate 1 is *"issue the run through the gate that already exists"*, not
*"issue the run at once"*. The saving above is the ceiling; the real figure
depends on how much of a run fits inside the current allowance, and that is
knowable before any change by replaying the runs against the limiter.

### Why candidate 2 is not simply candidate 1 again

A segment call is a question about a picture and its answer is a mask. A read
is a question whose answer is a sentence, and some of this product's reads are
*conditioned on the previous one* — a re-ask is by definition a second look at
the first answer. Until the `about` labels exist (candidate 3), the census
cannot tell an independent read from a dependent one, and parallelising a
dependent pair would not make the edit faster, it would make it wrong.

### Candidate 4 is closed — the founder ruled it out, verbatim

> *"we will not test another image model there are none out there that compete
> currently all speed gains have to be on our end"*

So the ~100 s of paint is a fixed cost of the product as it stands, no
image-model test is to be proposed now or later, and **the whole latency
programme is the remaining candidates and nothing else.** The arithmetic that
follows from his ruling is worth stating plainly: of a ~205 s edit, ~100 s is
his ruled-fixed paint, and the rest is our queue.

## Recommended order

1. ~~**Candidate 3 first**~~ — **already built** at `c7039b9d` (2026-08-16
   07:37), before this reading was taken. The "unlabelled read stage" in the
   table above is a fact about the DATA WINDOW, not the code: every census row
   here predates the labels by a morning. Nothing to do; the labelled rows
   arrive with the founder's next ordinary edits.
2. **Candidate 1**, through the existing `FAL_CONCURRENCY` gate, with the
   before/after read taken by this same script. Bar pre-registered at the
   **replayed** figure (28.0 s dev), not the ceiling.
3. **Candidate 2** only per-site, each site proven independent by reading the
   code, never in bulk — and not before labelled rows exist to read.
4. ~~Candidate 4~~ — closed above by founder ruling.

## Reproducing this

```
npx tsx scripts/read-edit-latency-disposable.mts                      # dev
railway.cmd run --service MySQL npx tsx scripts/read-edit-latency-disposable.mts
```

The two worlds are the same host and database name and differ only by port —
dev `:52008`, production `:23768` — so the script prints the world it opened
before any number.
