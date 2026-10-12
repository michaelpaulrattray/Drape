# The refusal patrol — run #1 (2026-08-27, foreman-30, issue #129)

**Status: RUN. Nothing built, no constant moved, no measured pair added.
Spend $0.98 house (estimated ≤ $1.34 on the issue first), 0 credits, no rows
written.** Corpus reader `scripts/_refusal-corpus-129-disposable.mts` (SELECT
only), probe `scripts/_probe-framing-refusal-129-disposable.mts`. Runs on
disk: `output/_shift129/` (corpus.json — his briefs, not quoted here; the
probe's 24 frames, prompts, rows.json, logs).

The founder's order (Crew reply #8): *"Build the refusal loop: log every
refused and passed prompt, find trigger words, measured word→replacement
pairs into the author's rewrite list, visible on the expanded prompt."* This
is the seat's first record; the next run begins by reading it.

## 1. Step (1) needs no build — the log already exists

`server/castingV2/rollService.ts:628` writes `internalPrompt: { prompt,
resolved }` on every roll candidate, both roads, beside `failureClass` — so
every refused AND every passed prompt the roll road has ever sent is on its
row. Read at production 2026-08-27 01:52 AEST: **144 surviving candidates,
144 with a prompt; 13 `content_policy` refusals** (every failure ever is
this class; `attemptCount` 1 on all, `expired` 3, `signed` 3, `ready` 125).
All 144 are on the founder's account.

## 2. The structural finding: on the author road a diff is impossible

The author road sends **one prompt per sheet** — all eight slices carry
byte-identical text (rolls 221/222/223: `distinctPrompts = 1`). So refused
and passed slices of the same roll have the SAME prompt:

| roll | road | prompt length | refused / 8 |
|---|---|---|---|
| 221 | author LOW (pre-§5b) | 468 | 1 |
| 222 | author LOW (pre-§5b) | 635 | **5** |
| 223 | author LOW (block) | 2,794 | 1 |

Roll 222 is the specimen: identical text, 5 refused and 3 delivered. **The
checker is a coin per render, not a function of the text.** A word-level diff
of refused vs passed prompts — the mechanism step (2) names — has nothing to
diff on this road; attribution can only come from a CONTROLLED SWAP (the
shape of the #125 sternum probe), never from the rows.

The house road (persona-varied slices) allows a within-roll diff, and it
gives a confounded answer: the six house-road refusals (rolls 215/216/220)
all sit on the cyber-goth brief family, so every word of that brief scores
"significant" — `porcelain` 6/40 vs 0/80 (p = 0.001), `bald` 6/57 vs 0/63,
`gaunt` 6/67 vs 0/53 — and none of them is separable from the others or from
the brief. Within the family, the *Bald / severe bone structure / gaunt
cheeks* persona line carries 4 of the 6 (4/24 vs 2/96, p = 0.014) — a
CANDIDATE for a swap court, not a trigger.

Refusal by road (all on his account, so brief and road are confounded):
author 7/24 (29%), PR #94 creative 2/16, house 4/104 (4%); p = 0.0007 — but
the author-road rolls are exactly the lean/cyber-goth briefs court #125
already measured as the engine's worst case (thin brief raw 17/18, full
cyber-goth 63/64).

The provider names no word: fal's 422 body is one generic sentence (*"The
content could not be processed because it contained material…"*), identical
on every refusal in tonight's logs. Nothing per-word can be read off it.

## 3. The probe — the numeric framing family, attributed to nothing

Across the #128 and #130 courts the three numeric framing sentences refused
**5/24** where the collarbones line refused **0/40** (p = 0.0056), and F2 is
the live recommendation on his eye item. Three arms, brief and block
byte-identical, only `AUTHOR_ROAD_FRAMING[1]` swapped (swap-back asserted
byte-identical; `NEVER_WRITTEN` and `DROPPED_FROM_BLOCK` clean; the
`collarbones` pin held):

| arm | sentence | refused / 8 |
|---|---|---|
| F2 | the court's F2 verbatim (was 2/8) | **0** |
| F2N | F2's numbers, today's crop clause | 0 |
| F2C | today's line, F2's "crop line across the chest" clause | 0 |

Pooled: F-family **5/48** vs 0/40 (p = 0.061); F2 alone **2/16** vs K 0/16
(p = 0.48). **No clause is attributable and no pair enters the list.** For
#130: F2's refusal cost is not a measured objection — tonight it delivered
8/8.

## 4. Measured pairs — the list holds ONE, and it guards the wrong text

The only word→replacement pair that meets bar (3) (word refused n ≥ 2,
replacement passed n ≥ 2) is the one #125 found: **"the crop just below the
sternum" (2/2 alone, 8/8 in a passing brief) → "collarbones" (0/2 probe, and
0/56 across every collarbones-line arm of #128/#130/tonight)**. It already
lives in `NEVER_WRITTEN` (`promptAuthor.ts`) — as a REFUSE-AND-RE-ASK on the
author's draft, not a rewrite, and `neverWrittenIn` has no caller outside
`promptAuthor.ts`. Two consequences: LOW makes no author call, so a
customer's own "sternum" rides verbatim to the engine unchecked; and MAX
refuses the author's draft rather than rewriting it. Rewriting a CUSTOMER's
words is #93's road (never silent, logged on the operation, design first) —
it is not this patrol's to build.

## 5. What the next run does (and does not)

- **Feed the list by swap courts only.** A candidate word (the *Bald … gaunt*
  persona line; the cyber-goth brief's own words) becomes a pair only when
  a swap arm passes n ≥ 2 while the original refuses n ≥ 2 IN THE SAME
  SITTING — tonight showed the same text can go 2/8 then 0/8 across nights.
- **The cheapest rescue is a same-text retry, before any rewrite.** Roll 222
  delivered 3 of 8 on the text that refused 5; the Retry button (#122 shape
  1) and #93's "retried before any refund" both rest on this fact.
- Not re-run until material exists: new refusals on the rows (`SELECT …
  failureClass = 'content_policy'` with `id > 1784`), or a court that adds
  n. A patrol that finds nothing writes one line.

---

# Run #2 (2026-08-28 ~02:00 AEST, foreman-58)

**Status: RUN, $0 house, 0 credits, no rows written, nothing enters the
list.** Material condition met two ways: refusal rows 1787–1790 (> 1784),
and the #182 framing court adding n (foreman-56 logged it for this patrol).
Corpus re-read at production (same reader): **168 candidates, 17
`content_policy` (was 13)**.

## 1. The new rows — roll 224, the coin again, no new words

Roll 224 (author LOW, block era, one prompt across the eight, len 2,899):
**4 refused / 4 delivered on byte-identical text** — the roll-222 shape
exactly (5/8 on one prompt), on the same cyber-goth brief family. One prompt
means nothing to diff (run #1 §2); the family's per-word scores cannot
separate from the brief. No candidate advances.

Roll 225 (same brief, 04:10Z) is **excluded from this corpus**: all 8
`unrecovered`, not filter — foreman-49's 04:07:58Z push restarted the
service at ~04:10 while the roll was being created (his own activity read
~8 min quiet at push time; the rite's active-session refusal DID fire on
the NEXT push at 04:12, receipt on disk). Charge 160, refunds 8 × 20 at
04:16 under the per-candidate references (verified through
`candidateRefundReference` — the keys hash past 64 chars, so a LIKE on the
opId cannot see them). Accepted class (D-85), money conserved, tiles map
`unrecovered → engine` so all eight offered Retry.

## 2. The framing-sentence lead — quantified, and it dies at this n

The #182 court swapped only the framing pair on the same brief, same block:
mid-torso **6/16 refused** vs collar-up K **1/8**. Exact Fisher two-tailed
**p = 0.352**; the court's own pass1-vs-pass2 on identical M bytes (4/8 vs
2/8, p = 0.61) is the coin restated. A +8/+8 court at the observed rates
would still sit near p ≈ 0.15 — chasing it is paying for noise. **The
mid-torso sentence is house CODE, founder-chosen on his eye ("run it"), not
customer words** — even a confirmed delta would be an #182 eye-item datum,
never a rewrite-list pair. The lead stays logged here; his own live rolls on
the mid-torso block accrue n at $0, and the next run re-pools when they
have.

## 3. Next run

Same condition, moved: new `content_policy` rows with **id > 1800**, or a
court adding n. Re-pool the M-block refusal rate from his live rolls against
the pre-M rolls (confounded by brief, as ever — say so when quoting it).

---

## Run #3 (2026-08-28, foreman-69) — pointer

Run #3 has its own record: **`REFUSAL_PATROL_RUN3_2026-08-28.md`**. Fired on
the founder's order (Crew reply #19: *"The refusal rate on M needs figuring
out … put it on the refusal patrol, but don't hold the framing on it"*).

**Result in one line: nothing entered the rewrite list, and the finding is
about this seat's own method.** The torso-anatomy hypothesis (`mid-torso`,
`chest`, `waist` out of the shipped framing sentence) measured p = 0.0392 in
favour of the reword on an ARM-MAJOR queue, and **p = 1.0000 — an exact tie,
9/24 vs 9/24 — when the same arms were INTERLEAVED**. The 3a effect was a
sitting-level refusal decline (14/24 → 6/24 across the run) landing on the
arm boundary.

**Standing rule from it: a refusal court interleaves its arms; an arm-major
refusal reading is a LEAD, never a finding.** Run #1's own probe and the
#128/#130/#182 leads recorded above were all arm-major and are re-classed as
leads (none moved a constant, so nothing needs unwinding). $3.81 house.

**Next-run condition (unchanged from run #2, plus one):** new `content_policy`
rows with id > 1800, or a court adding n — and any such court interleaves.

---

# Run #4 (2026-10-12, seat1-20261012-141545, issue #129 slice 2)

**Status: RUN, and the first run with a corpus built for it. $0 house, 0
credits, no rows written, nothing enters the rewrite list — and this time the
reason is MEASURED rather than structural-by-argument.** The reader is tracked
now (`server/castingV2/refusalLoopCorpus.ts`, driven by
`server/castingV2/refusalLoopCorpus.test.ts`), so run #5 does not write a
fourth one. Command:

```
railway.cmd run --service Drape -- npx tsx scripts/refusal-patrol-read.mts
```

## 1. The material condition, and what finally changed

Runs #1–#3 read candidate ROWS, where a refused slice dies with its session and
takes its words with it. Slice 1 (PR #1007, `9d517932`, merged 2026-09-16) keeps
the sent words of every refused roll's slices — refused AND delivered — on the
private evidence bucket for 30 days. **That corpus now exists and this is the
first reading of it.** Read 2026-10-12 at `casting-v2/refusal-loop/`:

```
keys listed 120 · read 120 · rejected 0
slices        120   (refused 53 · passed 67)
operations     15
owners          1   (userId 1, as every roll in this product's history is)
DISTINCT TEXTS 12   (refused 12 · passed 12)
one-text rolls 15 of 15
COIN rolls     14 of 15
```

⚠ **120 OBJECTS AMOUNT TO 12 PIECES OF EVIDENCE, AND THAT RATIO IS THE FIRST
FINDING.** Every one of the fifteen rolls sent ONE prompt for its whole sheet —
run #1 §2's `distinctPrompts = 1`, now true of 15 of 15 rolls rather than 3 of
3. A word in a roll where five slices refused is in five refused OBJECTS and in
exactly one piece of evidence; counting the objects would clear the n ≥ 2 bar on
a single roll. The reader therefore counts DISTINCT TEXTS everywhere and reports
slice counts beside them only so the inflation stays visible. It is the sibling
of this seat's own run #3 rule — *an arm-major refusal reading is a LEAD, never
a finding* — and three arms of the suite redden if the counting is swapped back.

## 2. THE HEADLINE: the coin is total, and it is no longer an inference

**All 12 distinct texts carry BOTH outcomes. 120 of 120 slices sit on a text
that was both refused and delivered.**

| text | refused | delivered | rolls |
|---|---|---|---|
| `e5cdbcfad6ec…` | **24** | **8** | **4** |
| `2567bc9f5f05…` | 7 | 1 | 1 |
| `e99e63232bc3…` | 4 | 4 | 1 |
| `c6e0aabb36b2…` | 3 | 5 | 1 |
| `4d994dfbd111…` | 3 | 5 | 1 |
| `dee3e68ebd94…` | 3 | 5 | 1 |
| four texts | 2 | 6 | 1 each |
| three texts | 1 | 7 | 1 each |

The top row is the specimen: **one brief, rolled four times, 32 renders of
byte-identical words — 24 refused and 8 delivered.** Run #1 read this shape on
one roll (222: 5 refused, 3 delivered on one text) and called it *"a coin per
render, not a function of the text."* **That sentence is now measured across 15
rolls and 12 texts, and it does not merely hold — it is universal in this
corpus.**

## 3. Trigger candidates: ZERO, and the zero is a reading rather than a silence

The left half of his bar (word refused in ≥ 2 distinct texts, delivered in none)
admits **nothing**. Two controls were run on the real corpus before that was
believed, because *"no candidates"* and *"read nothing"* print the same number:

```
--min-refused-texts 1   → 0 candidates   (so the BAR is not what excludes them)
distinct words    536
ever refused      536
ALSO delivered    536   <- every refused word in the corpus was also allowed
```

**536 words read, 536 refused at least once, 536 delivered at least once.**
There is not one word in this corpus that was refused and never allowed, so no
word is attributable to a refusal — and the instrument demonstrably held words
while saying so. `vocabularyReach` prints those three numbers on every run for
exactly this reason.

The gate was also driven on real data: `sternum → collarbones` (#125's pair) and
`porcelain → weathered` were both REFUSED, each naming its own shortfall — both
words are absent from this corpus, which is the honest answer rather than a pass
by omission.

## 4. What this settles, and what it does not

- **Item (2) is BUILT** — the patrol has a tracked reader with 41 arms, three
  sabotages each reddening a named arm, and its own positive control in every
  run's output.
- **Item (3) admits nothing, by measurement.** The bar is his and it is working:
  a corpus where every refused word was also delivered can produce no pair.
- **Item (4) stays DEFERRED, and this run is an argument about it rather than
  only a deferral.** A rewrite list applied before the first send can only help
  if the refusal is a function of the words; on this road, 12 times out of 12, it
  is not. **Whether item (4) is ever worth building is now a question with
  evidence against it**, and that is a founder-facing finding, not a shift's call.
- **Item (5) has nothing to show** — it displays rewrites, and there are none.
- ⚠ **The retry is the thing this run actually vindicates.** Identical words
  delivered 8 times while refusing 24 on the same brief; across the corpus 67 of
  120 slices passed on texts that also refused. A same-text Retry is not a
  consolation prize on this road, it is the measured rescue — run #1 §5 said so
  first, and `CASTING_RETRY_SCOPE` has been `all` since his switch sitting
  (2026-09-24), so the product already does the right thing.
- **Attribution still needs a controlled, INTERLEAVED swap court** (run #3's
  standing rule). Nothing in a corpus of one-prompt rolls can replace it.

## 5. Next-run condition

Re-run when ANY of these is true, and not before — a patrol that finds nothing
writes one line:

1. **The corpus holds a text that refused and never passed** — i.e. the reading
   above stops being universal. That is one command and it is free.
2. **A roll road sends per-slice prompts again.** Every bar here is blind while
   15 of 15 rolls send one text; the house road's persona-varied slices allowed a
   within-roll diff, and the author road does not.
3. **An interleaved swap court adds n**, in which case its arms are judged
   through `measuredPairVerdict` rather than by eye.

⚠ **AND ONE DATE MATTERS: the oldest objects reach their 30-day window about
2026-10-22.** The corpus is born held and the worker collects object and row
together when the hold lapses, so the 2026-09-22 rolls leave first. Nothing is
lost that this record does not already carry — the census, the coin table and
the three reach numbers are here precisely because the words themselves are not
quoted anywhere and will be gone.

**No customer prose appears in this record, by the same rule the reader follows:
a composed prompt is the cast's recipe in sentences.**
