> **STATUS — DATED COURT RECORD, 2026-08-28.** A measurement taken on this
> date by the refusal patrol (issue #190, the founder's order). Its numbers are
> facts about the frames it rendered; its verdict binds nothing beyond what it
> names. Predecessor records: `REFUSAL_PATROL_2026-08-27.md` (runs #1 and #2),
> `REFUSAL_PATROL_RUN3_2026-08-28.md` (run #3), `SOFTER_WORDING_COURT_2026-08-27.md`
> (#93), `PROMPT_AUTHOR_COURT_2026-08-26.md` (#125).

# The trigger-cluster swap court — sitting 1

**Seat:** refusal patrol (the Lexicographer's sibling). **Shift:** foreman-75.
**Issue:** #190. **Instrument:**
`scripts/_court190-trigger-clusters-disposable.mts` (disposable).
**Artifacts:** `output/_shift190-s1/court/` — every arm's prompt byte for byte,
3 delivered frames, `readings.json`, `court.log`, `instrument.log`, `STRIP.png`.

**Spend: $0.17 house** (60 renders sent, 3 billed — a refused render is free),
estimate on the issue before firing ≤ $3.35. 0 credits, no rows, dev `.env`.
fal $15.11 → $14.88.

## 0. Why it ran

Founder, terminal, 2026-08-28, verbatim:

> *"its probably worth testing, but not worth implementing unless we have the
> proof. users are going to try and push provocative casts especially females
> so its worth trying to see if we can build a system that can deliver for
> them"*

The goal is delivering LEGITIMATE edgy/fashion casts reliably by reducing the
checker's FALSE POSITIVES through wording — never smuggling past it. The engine
stays the judge, a refusal still refunds, and nothing here changes what the
studio accepts as a brief.

## 1. The base, and the one declared deviation from the issue's words

The issue says *"the authored cyber-goth look line + current block"*. This court
measured on **LOW** — the brief verbatim + the current `HOUSE_BLOCK`, composed
by the product's own `staticPrompt`, no author call. Declared before firing,
for one reason: calling the author would put a fresh text generation between
every arm and the engine, so the arms would differ by more than the family under
test. LOW is also the founder's ratified default, and every prior court in this
seat (#125, #129 runs 1–3) measured there.

The brief is **read from the artifact of the run that refused it**
(`output/_shift93/court/goth-O.prompt.txt` — the Grok cyber-goth brief, 1,831
characters, 292 words) rather than retyped; the harness refuses to spend if that
file is missing, because a reconstructed input is a claim, not a record.

## 2. The arms — one family at a time, everything else byte-identical

| arm | family | shippability, declared BEFORE the numbers existed |
|---|---|---|
| **B1** | base | control |
| **B2** | base, **byte-identical to B1** | the NEGATIVE CONTROL — the coin's same-sitting variance |
| **A1** | `a young woman` → `a woman in her twenties` | customer-fact |
| **A2** | `a young woman` → `a woman, mid 30s` | customer-fact |
| **F1** | `mesh`/`lace` → gloss / structured dark tailoring | customer-fact |
| **C1** | every `chest` in the sent text out (the block's → `collarbones`) | house |
| **T1** | REALISM without `a face you could touch` / `vellus` | house |

**Shippability is not uniform, and that was declared before the run so it could
not be decided by the result.** `T1`/`C1` are house text or near-synonyms — a win
there is a measured pair in the ordinary way. `F1` and `A1/A2` change **what is
cast**: the mesh/lace is the garment she asked for and an age word is the person
she asked for, so a win there can never be a silent rewrite (rule 16, the
fidelity law). Its only honest shape would be a suggestion she accepts, or #93's
rewrite-and-retry after a refusal she was told about.

### Three things the issue asked for that this court did NOT do

1. **`patent` is not in the brief.** The fabric family is measured as mesh+lace;
   `patent` cannot be tested on this text.
2. **The chest hypothesis as literally written is untestable.** The issue says
   *"the lighting line with/without `chest`"* citing the 2/8-vs-0/32 L2+ lead —
   but **`LIGHTING_LINE` as shipped contains no `chest`**, and L2+ never shipped.
   The only live `chest` in the block is in the FRAMING sentence. So `C1` tests
   the underlying question in its strongest form — *does the word `chest`
   anywhere in the sent text trip the checker* — over the brief's three mentions
   and the block's one. The block half is independently measured **null** by run
   #3b (torso nouns out, p = 1.0000).
3. **No region reads.** Refusal is the question, not geometry.

## 3. The instrument, proven before it spent (working law 2)

| control | expected | measured | |
|---|---|---|---|
| Fisher, perfect split 8/0 vs 0/8 | p < 0.001 | p = 1.55e-4 | PASS |
| Fisher, identical 4/4 vs 4/4 | p = 1.000 | p = 1.000 | PASS |
| Fisher, run #2's published 6/16 vs 1/8 | 0.352 (its record) | 0.352 | **replicates a prior artifact** |
| detector, known-refused (`sternum`, 8/8 at #125) | a refusal is visible | 1/2 refused | PASS |
| detector, known-passing (`collarbones`, 0/56) | a pass is visible | 2/2 delivered | PASS |

The detector controls matter more than usual here, because the result is a wall
of refusals: **the counter was shown able to see a delivery in this very
sitting** before the court's own zero-ish pass rate was believed.

Asserted in the harness before a cent, each able to throw: B2 byte-identical to
B1; every family round-trips to base by its swap alone; the base carries its
tokens and no arm carries its own; no two arms share text; all seven clear
`DROPPED_FROM_BLOCK` and `NEVER_WRITTEN`; the queue is interleaved.

**One inherited property checked rather than assumed:** a content refusal is
**not retried** — `content_policy` is absent from `RETRYABLE_FAILURES` and
`server/providers/providerContract.test.ts:44` asserts it — so each recorded
refusal is one attempt at the checker, not a silent best-of-three.

## 4. The queue is INTERLEAVED, and the drift check proves it worked

Run #3 established the standing rule: an arm-major refusal reading is a LEAD,
never a finding. All seven arms were round-robined across the whole sitting.

```
first 28 renders  27 refused
last  28 renders  26 refused      → flat. The clock did nothing tonight.
```

## 5. RESULTS

| arm | ship | n | refused | rate |
|---|---|---|---|---|
| **B1** | control | 8 | 7 | 88% |
| **B2** | control (byte-identical) | 8 | 8 | 100% |
| A1 | customer-fact | 8 | 8 | 100% |
| A2 | customer-fact | 8 | 8 | 100% |
| F1 | customer-fact | 8 | 7 | 88% |
| C1 | house | 8 | 8 | 100% |
| T1 | house | 8 | 7 | 88% |

**Negative control: B1 7/8 vs B2 8/8 on BYTE-IDENTICAL text — Fisher p = 1.0000,
spread 1 of 8.** Base pooled B1+B2 = **15/16 refused (94%)**.

| family | refused | vs base 15/16 | Fisher p |
|---|---|---|---|
| A1 | 8/8 | 100% vs 94% | **1.0000** |
| A2 | 8/8 | 100% vs 94% | **1.0000** |
| F1 | 7/8 | 88% vs 94% | **1.0000** |
| C1 | 8/8 | 100% vs 94% | **1.0000** |
| T1 | 7/8 | 88% vs 94% | **1.0000** |

**53 of 56 refused. Nothing separates from the base. Nothing enters the rewrite
list, and no constant moves.**

## 6. What this does and does not prove

**It proves:** at a 94% base, none of the four families produces a large rescue.
The court retained power for a big effect — 15/16 vs 2/8 would have landed at
p ≈ 0.002 — and saw nothing remotely that size. Taken with the two prior
readings on this same brief, the four families join a growing list of
*single-wording changes that do not rescue it*: #93's five-sentence swap map (no
sentence attributable), #129 run #3's torso-anatomy swap (p = 1.0000), and now
age, fabric, chest and the touch line.

**It does not prove** the families are inert at a mid-range base. A ceiling
leaves no room to fall, and a hypothesis is not killed by a test that could only
have detected a landslide.

### ⚠ The finding that matters more than the arms: this brief has no stable base rate

Same brief, three sittings, three different worlds:

| date | court | block era | refused |
|---|---|---|---|
| 2026-08-26 | #125 | chest-up (K) | **63/64 (98%)** |
| 2026-08-27 | #93 | chest-up (K) | **5/8 (62%)** |
| 2026-08-28 | this court | mid-torso (M) | **53/56 (95%)** |

**Nothing about the product changed between the first two rows, and the rate
moved 36 points.** So (a) an across-sitting comparison on this brief is worth
nothing, which is why this court carried its own base in its own sitting and why
the founder's two-sitting rule is right; and (b) **the block-era column cannot be
read as a cause** — the tempting sentence *"the mid-torso block tripled the
refusals"* is exactly the confound run #3 was bought to kill, and it is not said
here.

### ⚠ And one pre-declaration was too pessimistic, at the frames

`F1` was declared *customer-fact* on the reasoning that removing `mesh`/`lace`
delivers a different garment. **It did not.** F1's one delivery wears the same
sheer black floral lace top and lace sleeve as the base's — *"a sheer black top
with intricate floral patterns"* renders as lace whether or not the word is
present. The declaration stands as written (it was the honest prior), but the
measured shippability concern for this particular swap is milder than declared.

## 7. The three deliveries, on my eyes

All three delivered frames (B1, F1, T1) land the brief almost completely —
asymmetric platinum hair over a shaved side with scalp crosses, the spiked
leather eye harness with the hand raised to it, lace glove, septum and lip
piercings, the cross under the eye, buckled choker with the strap down the
front, arm calligraphy, mid-torso framing on grey seamless. **None of the three
passes is a tamer picture**: no arm bought its delivery by casting something
safer. This is the coin landing, and it is worth the founder's eye for the
opposite reason to the refusals — it shows the engine *can* serve this look
beautifully. (My eyes, not his; law 9.)

## 8. Verdict, and what sitting 2 should be

**Nothing ships. No pair, no constant, no vocabulary.** All four families are
recorded as **not a rescue at a saturated base**, so they cannot be refiled as
new theories without new evidence.

**⚠ Sitting 2 as the issue drafted it — the same matrix on the same brief —
should NOT be run.** It would repeat a null against the ceiling and buy nothing.
Two better designs, in order of recommendation:

1. **Re-base, don't re-run.** Carry the same four families on a cyber-goth base
   that measures MID-RANGE, so a family can move the number in either direction.
   The candidate already exists and is already on the record: the founder's own
   hand rewrite of this brief (`output/_shift93/court/goth-H.prompt.txt`) scored
   4/8 at #93. Same look, same sitting, real power. ~56 renders, ≈ $2.
2. **Stop asking the vocabulary question about this brief.** Three independent
   attributions have now failed on it (#93 sentences, #129 torso anatomy, #190
   token families) and run #1's own reading was that *the checker is a coin per
   render, not a function of the text*. The product answer that already exists
   is the **Retry button** (#122, live on his account since 2026-08-27, widened
   to content-filter tiles on his own word) — a re-flip of the coin, which is
   what tonight's 3 deliveries out of 56 identical-ish sends actually describes.

The next-run condition for this seat is unchanged and gains one: new
`content_policy` rows with id > 1800, or a court adding n — **and any court on a
brief whose base measures above ~85% or below ~15% reports the saturation and
does not spend its remaining arms.**
