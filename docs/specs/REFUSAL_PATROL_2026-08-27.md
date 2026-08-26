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
