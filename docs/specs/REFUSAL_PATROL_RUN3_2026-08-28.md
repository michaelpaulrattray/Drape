> **STATUS — DATED COURT RECORD, 2026-08-28.** A measurement taken on this
> date by the refusal patrol (issue #129), run #3. Its numbers are facts about
> the frames it rendered; its verdict binds nothing beyond what it names.
> Predecessor records: `REFUSAL_PATROL_2026-08-27.md` (runs #1 and #2).

# The refusal patrol — run #3: the torso-anatomy swap

**Seat:** refusal patrol (the Lexicographer's sibling). **Shift:** foreman-69.
**Issue:** #129. **Instrument:** `scripts/_court-refusal-129-run3-disposable.mts`
(disposable). **Artifacts:** `output/_shift129-run3/court/` — 48 frames, both
prompts byte for byte, `readings.json`, `court.log`, `STRIP.png`.

## 0. Why it ran

The founder's order, Crew reply #19, 2026-08-27 20:53:16Z, verbatim:

> *"M — the framing is right, keep it as the default. The refusal rate on M
> needs figuring out (fewer on the second pass, so it smells like the coin
> again) — put it on the refusal patrol, but don't hold the framing on it."*

Run #2 had declined to buy more n on this lead, on the reasoning that the
framing sentence is house code chosen on his eye, so a confirmed delta could
never move it. **His order changes that in exactly one way**, and it is the
only question here worth money:

> Not *"is M worse than K"* — K's geometry is the thing he refused, so a
> K-vs-M significance test has no shippable outcome. But: **is there a
> sentence that delivers M's geometry at a lower refusal rate?**

That has a product outcome (he keeps the framing AND pays fewer refused
tiles) and it is this seat's own deliverable shape — a measured
word → replacement pair for the author's rewrite list.

## 1. The hypothesis, and why this one

The product's ONE proven pair is anatomical: `sternum` refused 8/8, and
`collarbones` in the same slot passed 0/56 (court #125). M's pair is the
first thing since to put torso anatomy back into the locked block. The delta
from K is exactly:

| | K (collar-up, retired) | M (mid-torso, shipped) |
|---|---|---|
| torso nouns | `collarbones` | `mid-torso` ×2, `chest`, `waist` |

So: **take the three torso nouns out, put nothing anatomical in, hold the
geometry.** That is arm N.

## 2. The arms

Thin brief `goth woman mid 30s` — the #128/#130/#182 brief, so M
**replicates** rather than being measured cold. LOW (seed + block), one prompt
per arm, 24 renders each, `1024x1536` medium, the same engine entrance the
roll road uses.

- **M** — today's shipped pair, read verbatim out of `AUTHOR_ROAD_FRAMING`.
- **N** — the crop-line clause moved from anatomy to the garment:
  - `FRAMING: Single figure only, upper body, centred, square to camera.`
  - `Frame the upper body in a 2:3 portrait: … the bottom edge of the frame falling partway down the outfit so the outfit's upper body is fully visible, …`

**The face-share clause, the eye-line clause, the headroom clause and the
shoulders clause are M's BYTE FOR BYTE** — that clause *is* the geometry, and
moving it would confound the arms. `shoulders` stays in both: it is in K too,
and K passes.

Asserted by the harness before a cent was spent, each one able to throw:
M carries every torso noun; N carries none; N → M by the framing-pair swap
alone (round-trip byte equality against the real `staticPrompt`); the geometry
anchor is byte-identical in both; both prompts clear the product's own
`DROPPED_FROM_BLOCK` and `NEVER_WRITTEN` guards.

## 3. The instrument, proven before it spent (working law 2)

| control | expected | measured | |
|---|---|---|---|
| Fisher, perfect split 8/0 vs 0/8 | p < 0.001 | p = 1.55e-4 | PASS |
| Fisher, identical 4/4 vs 4/4 | p = 1.000 | p = 1.000 | PASS |
| Fisher, run #2's published 6/16 vs 1/8 | p = 0.352 (its record) | p = 0.352 | **replicates a prior artifact** |
| face reader, chest-up reference | known 28.2% | 28.2% | PASS |
| face reader, his 2:3 mid-torso reference | known 22.0% | 22.0% | PASS |
| face reader, blank grey frame | no face | no face | PASS |

The Fisher arm is not decoration: the verdict below is computed, not
eyeballed, so the implementation gets controls of its own — including one that
reproduces a number already on the record from a different sitting.

## 4. The two bars, declared before the run

1. **Refusal** — N's rate below M's at Fisher two-tailed p < 0.05.
2. **Geometry** — N's delivered face-share median within 3 points of M's.
   *A reword that refuses less and frames tighter has learned nothing
   shippable*, and this court reports that as N failing, not as a win.

**Power, declared up front:** at M's prior 37.5%, n = 24/arm resolves a drop
to ≲10% and nothing subtler. A directional-but-underpowered result is a LEAD
and enters no list — run #1's standing rule (a pair enters the rewrite list
only at refused n ≥ 2 / passed n ≥ 2, measured).

## 5. RESULTS — and the reason there are two runs

### 5a. Run 3a, arm-major queue (all 24 M, then all 24 N)

| arm | refused | rate | face-share median (min–max) |
|---|---|---|---|
| M — shipped pair | 14/24 | **58%** | 22.7% (20.6–27.9) |
| N — torso nouns out | 6/24 | **25%** | 24.6% (21.7–29.2) |

Fisher two-tailed **p = 0.0392**; geometry drift 1.9pt, inside the declared
3pt bar. On its face, N wins both bars. **It does not, and the reason is the
founder's own sentence.**

3a queued every M render before every N render, so **time and arm were
confounded** — and the drift is not hypothetical, it is inside this run:

```
run 3a completion order   MMMMMMMMMMMMMMMMMMMMMMMMNNNNNNNNNNNNNNNNNNNNNNNN
M refusals                RRRR..RRR.RRR..RR.....RR   first half 9/12, second 5/12
N refusals                RR...R.......R...R..R...   first half 3/12, second 3/12
POOLED SITTING TREND      first 24 renders 14 refused -> last 24 renders 6 refused
```

The whole sitting fell from 14/24 to 6/24, and the arm boundary sat exactly
on that fall. Same direction as #182's pass 1 4/8 → pass 2 2/8 on
byte-identical text; same thing he named — *"fewer on the second pass, so it
smells like the coin again."* An arm-major queue plus a checker that softens
across a sitting manufactures 3a's table with no word doing any work.

### 5b. Run 3b, the order control — the same arms, the queue INTERLEAVED

Identical prompts, identical n, identical instrument. **The only difference
is queue order**, asserted in the harness (`--interleave`, its own output
directory, 3a's frames untouched).

| arm | refused | rate | face-share median (min–max) |
|---|---|---|---|
| M — shipped pair | 9/24 | **38%** | 25.1% (22.7–29.7) |
| N — torso nouns out | 9/24 | **38%** | 25.3% (20.0–29.6) |

Fisher two-tailed **p = 1.0000**. An exact tie.

```
run 3b completion order   NMMMNNNNMMMNMNMNMNMNMMNNMMNNMMNNNNMMMMMNNMNNNMMN
M refusals                RR.......RR.R.RR.R...R..   first half 4/12, second 5/12
N refusals                R..RR....RR.R....R...RR.   first half 5/12, second 4/12
POOLED SITTING TREND      first 24 renders 9 refused -> last 24 renders 9 refused (flat)
```

3b had no sitting-level drift to confound anything, and with time balanced
across the arms the difference vanishes completely.

### 5c. Cost

3a $1.84 + 3b $1.97 = **$3.81 house** (78 renders billed of 96 sent — refused
renders are free — plus 116 region reads). Estimate on the issue before each
run was ≤ $3.20; no DB rows, no credits, dev only. fal $18.31 → $15.38.

## 6. What enters the list: NOTHING — and the finding is the instrument

**1. The torso nouns are not a trigger. Nothing ships.** `mid-torso`, `chest`
and `waist` do not raise the engine's refusal rate at this n; the shipped
sentence stays exactly as the founder ratified it hours earlier, which is also
what he instructed (*"don't hold the framing on it"*). No pair enters the
author's rewrite list. 3b would have caught an effect the size 3a suggested
without difficulty — it returned an exact tie — so what is excluded is an
effect of roughly that magnitude, not every conceivable small one.

**2. ⚠ THE REAL RESULT IS A DEFECT IN HOW THIS SEAT HAS BEEN MEASURING.**
A refusal court whose arms run in blocks cannot separate the words from the
clock, because this checker's rate demonstrably moves within a single sitting.
3a is the specimen: a clean p = 0.0392, a plausible mechanism, an eight-month
prior pointing the same way — and it is an artifact of queue order. Had 3a run
alone, a founder-ratified sentence would have been rewritten on it.

**The rule this seat works to from now on: a refusal court INTERLEAVES its
arms. An arm-major refusal reading is a LEAD, never a finding.**

**3. Prior arm-major readings are re-classed as leads, not retracted.** This
run proves the confound is real and unhandled; it does not re-measure anyone
else's frames, and only a re-run can. Affected, each an arm-major queue:

- **#128's lighting lead** — his lighting block 2/8 against K/L1/L2/L3 0/32.
- **#130's numeric framing family** — 5/24 against 0/40.
- **#182's M-vs-K** — 6/16 against 1/8. (Its order runs K → M → M2 and its
  refusals run 1/8 → 4/8 → 2/8, which is not a monotone decline, so this one
  is not explained by a simple drift the way 3a is. It stays a lead.)

None of these moved a constant, so nothing shipped on them and nothing needs
unwinding. They are re-runnable cheaply and interleaved if any is ever worth
buying.

**4. A caveat for the trim, noted rather than acted on.** M's delivered
face-share median differs by sitting — 23.0% (#182), 22.7% (3a), 25.1% (3b).
`FRAMING_TRIM_TARGET.headShare = 0.230` is the #182 sitting's median. That is
still the best number on the record and nothing here argues for moving it, but
it rests on one sitting's population, and #11 (his eye on strips from his own
flagged rolls) is where a wider population would come from.
