# ASK TWICE BEFORE YOU WALL — the cohort wall's double check

⚠ **STATUS: DESIGN REPORT, AWAITING COUNTERSIGN. NOTHING IS BUILT.** Ordered
fable-1588 from a live founder walling mid-dogfood.

✅ **AND ITS COURT HAS NOW RUN (2026-08-24, $0.4968, 16 calls, tree
`d1bd3316` clean) — see §0. Both questions answered, and the rate is WORSE than
this document was written on.**
Written 2026-08-24 against the code rather than from recollection; every line
number below was opened.

His report, verbatim, relayed fable-1588:

> *"dont know what happened but i tried to cast some people using [the
> cybernetic brief] … eventually it said: That brief can't be cast … not a
> character from a game or film … You have not been chargeed."*

And an hour later, fable-1589: **at least twice consecutively.**

---

## 0. ✅ THE COURT, RUN AFTER THIS DESIGN WAS WRITTEN

Ordered fable-1592 §2 as the re-aimed $0.48, priority raised fable-1599 §3.
Harness `scripts/_cohort-wall-rescue-disposable.mts`; rows
`output/cohort-wall/wall-rescue.{log,json}`. Six first reads of his exact brief
through the real entrance, every refusal immediately re-driven once, plus a
named-character control on both reads.

```
  rate      3 of 6 first reads WALLED
  rescue    3 of 3 refusals PASSED on an immediate second read
  control   2 of 2 named-character drives walled on the FIRST read
            2 of 2 walled on the SECOND read as well
```

⚠ **THE RATE IS WORSE THAN THIS DOCUMENT WAS WRITTEN ON.** §1's pooled figure
is 3 in 18 (~17%). Today's tree, two instruments, neither looking for it:
**2 of 3 in the budget court's arm A and 3 of 6 here — 5 of 9 (56%).** Pooled
across every sighting the product has: **8 of 27 (~30%).** Whether the rate has
MOVED or the earlier samples were lucky is not settled by nine drives, and this
document does not claim it is; what is settled is that ~1 in 6 was the optimistic
end of the range and the mitigation is worth more than it was priced at.

✅ **AND THE ASSUMPTION §9 SAID MUST BE TESTED RATHER THAN INHERITED HOLDS ON
THIS SPECIMEN: 3 of 3 rescued.** Two reads of the classifier on one brief are not
locked together — an identical re-sample genuinely lands somewhere else. So the
double check is not arithmetic on an assumption; it is a measured 3-for-3 on the
brief that motivated it.

✅ **And the control is the half that protects the wall: a named character
refused BOTH reads, twice.** A retry does not open the door the wall exists to
hold.

⚠ **Two limits, stated rather than buried.** (a) Nine drives on ONE brief is a
small sample and the rescue fraction is not a rate for the product. (b) The
retry here is a whole re-compile with a different `rollSeed` — faithful to the
proposed mechanism because `rollSeed` never reaches `interpretBrief`, whose
inputs are the brief, the engine and the two block flags, so the second read
receives byte-identical input. That is read at the call site rather than
assumed.

---

## 1. The complaint, and the number under it

The cohort wall refuses a brief the product CAN cast, for free, about one
attempt in six — and it does it to the founder's own writing.

```
opus-1128's corpus        2 refusals in 15 drives
opus-1185's density court 1 refusal  in  3 drives   (arm A drive 3)
                          ─────────────────────────
POOLED                    3 refusals in 18 drives   ~1 in 6
```

**The same 553 characters compile fine on the other fifteen.** The brief
describes a photographable person — a bald man in his forties with surgically
integrated implants — and names nobody in particular. It is not a fictional ask
and it is not an illustration ask. The refusal is a model's judgement, taken
once, and acted on as if it were a fact about the brief.

⚠ **The rate is measured on ONE brief and is not the product's rate.** Nothing
in the product counts this wall firing at all (§2c), so how often it hits a
customer is unknown — which is itself part of what this design fixes.

---

## 2. Read at the code: TWO paths reach that sentence, and only one is his

The refusal copy is identical at both sites (`briefCompiler.ts:928` and `:935`),
which is why a report written from the message alone cannot tell them apart.

```
PATH A — THE JUDGEMENT           interpreter.ts:858
  the model answered "cohort": "other"; parseCastingIntent maps anything
  outside SUPPORTED_COHORTS to `unsupported_cohort`
  (castingIntent.ts:1190-1195), and briefCompiler.ts:933 throws the refusal

PATH B — THE OUTAGE IN A WALL'S CLOTHES   briefCompiler.ts:922
  the interpreter was UNAVAILABLE **and** the brief contains a STYLE_WORD
  ("anime", "cgi", "render", "3d", "toon", …). A transport failure on a styled
  brief refuses rather than casting photoreal — deliberately, and correctly
```

**His is PATH A**, established rather than assumed: his brief's tokens were run
against `STYLE_WORDS` and there are **zero hits**, so path B cannot fire for it.

### 2a. What the model is being asked

`interpreter.ts:506-522` tells it to answer `"other"` for *"anime,
illustration, animals, robots, fantasy creatures, or any brief that is not a
photograph of a person"*, and separately for a named person or character. The
instruction already carves out the near miss — *"A GENRE is not a character.
'a space marine', 'a superhero type', 'a fantasy ranger' … are ordinary
photoreal briefs"* — so the intent is right and the READING is what wobbles.

⚠ **This design does not touch that instruction**, and the reason is §6.

### 2b. Where a retry goes

One line, `interpreter.ts:858`:

```
if (parsed.reason === "unsupported_cohort") return { ok: false, reason: "unsupported_cohort" };
```

It sits inside the `!parsed.ok` branch, after the truncation retry (`:839`) and
before everything else. **A second `runOnce()` is already the shape of the two
neighbours it would sit between** (§3).

### 2c. ⚠ Nothing counts this wall, and that is why the log is not optional

`unsupported_cohort` is thrown as a `BriefRefusal` **before a roll row exists**,
so there is no row, no operation, no ledger entry and no counter — only a log
line at path B and not even one at path A. The product cannot answer *how often
does the cohort wall fire* today, in either world. **Whatever else is ruled
here, the counter is the part that turns this from an anecdote into a rate.**

---

## 3. The precedent, and it is in the same function

fable-1588 cited `refineService.ts:1981` (*"a first restatement buys one more
reading"*). There are two closer ones, both inside `interpretBrief` itself:

```
THE TRUNCATION RETRY     interpreter.ts:827-856
  "A REPLY CUT OFF FOR LENGTH IS TRANSPORT, NOT A VERDICT … So it is retried
  once as the transport failure it is, rather than swallowed."

THE AESTHETIC RETRY      interpreter.ts:879-951
  "One re-sample, never a loop. The failure is stochastic — measured at roughly
  one run in three — so a single retry collapses it without turning a bad day
  at the provider into an unbounded spend."
```

**The second is this design with a different subject**: a stochastic miss on a
single model read, measured, answered by exactly one re-sample, never a loop.
The argument does not need to be made again — it needs to be pointed at a
refusal instead of at an aesthetic.

---

## 4. The proposal

```
WHEN            parseCastingIntent returns `unsupported_cohort` on the FIRST read
THEN            runOnce() a second time — the SAME call, the same system prompt,
                the same brief, no softer wording (see §5's second bullet)
WALL            only if the second read also answers outside SUPPORTED_COHORTS
PROCEED         if the second read parses to an intent, that intent is used, and
                the roll proceeds exactly as any other
ON ANYTHING     else — unreadable, truncated, transport error — the wall stands.
ELSE            Fail-closed, unchanged
COUNT           one log line per retry: `cohortWallRetried`, with the outcome
                (`walled` / `rescued`) and the latency of both reads
NOT RETRIED     PATH B. An interpreter OUTAGE on a styled brief is a different
                question with a different answer, and folding it in here would
                retry a transport failure under a judgement's name
```

**The vocabulary is one string, so the count is one grep** — the shape
`NOTES_OVERFLOW` already has, for the reason its docblock gives.

---

## 5. What it must not do, and why each one is a trap

- **Never a loop.** One extra read. A stochastic failure repeated without bound
  is how a bad day at the provider becomes an unbounded spend — the aesthetic
  retry's own sentence, and it governs here unchanged.
- ⚠ **Never a SOFTER second ask.** The tempting version passes the second read a
  nudge (*"are you sure? this may be an ordinary photoreal brief"*), and that is
  not a second opinion — it is arguing the model out of a refusal, and it would
  weaken the wall on exactly the briefs the wall is right about. **The second
  read is the same read.** Its value is that the failure is stochastic, and an
  identical re-sample is therefore a genuinely independent draw.
- **Never applied to a brief that was refused for a REASON we can see.** There is
  no such reason today — the wall's output is one enum with no detail — but if a
  future classifier returns a ground, a retry of a grounded refusal is a
  different design.
- **Never silent.** Without the counter this is a change whose effect nobody can
  read, on a path that has never been counted.

---

## 6. The alternative that is NOT recommended, and why it is not

**Amend the cohort instruction** so that surgical body modification on a real
person reads as photoreal. It is one clause and it would probably work.

```
against  it is a prompt change in a product whose own measurement is that
         CONTEXT IS NOT ADDITIVE — a subset of prompt context moved the stage
         wall twice as often as its superset. A clause aimed at implants can
         move verdicts on briefs nobody was thinking about
against  it needs to know WHICH clause of his brief trips the classifier, and
         that is §10 item 3d's ablation, which is PARKED ON A NUMBER
         (~$3.80 against a thin balance) rather than on attention
for      it fixes the cause; the retry only makes the symptom rarer
```

**The two are orthogonal and not rivals.** The retry helps every stochastic
misfire, including ones nobody has met yet; the instruction fix helps this class
of brief and needs a court to be safe. **3d is unchanged by this design** — it
stays parked exactly as priced.

---

## 7. What it costs

```
WHEN IT FIRES     only on a roll that was about to be refused. A roll that
                  compiles pays nothing and waits no longer
THE CALL          one `runOnce()` — the same interpreter call the function
                  already makes. The census measured a full drive through the
                  entrance at $0.0800 across TWO openrouter calls, so one call
                  of that shape is ~$0.04. Stated as derived, not measured:
                  the census's unit is a drive, and the honest way to price a
                  single call is to measure one
THE POPULATION    unknown, and unknowable today (§2c). On the one brief that
                  trips it the rate is ~1 in 6; across all briefs it is
                  certainly far lower, and the counter is what will say
⚠ THE WAIT        THIS IS THE REAL COST AND IT IS NOT MONEY. The interpreter's
                  own measured latency at the current ceiling is quoted in its
                  docblock — **p50/p95 21.4s / 28.0s**, n=40 at
                  `maxOutputTokens: 5000` — so a REFUSED brief would take about
                  twice as long to be refused. A customer being told no, free,
                  waits ~43s instead of ~21s. Recommendation: accept it — being cast
                  correctly at 40s beats being refused wrongly at 20s — but it
                  is a product judgement and it is stated rather than buried
```

---

## 8. The arms, and the one that must be able to go red

```
POSITIVE (the rescue)   a doubled reader whose FIRST answer is "other" and
                        whose second is photoreal must PROCEED. Driven against
                        the real branch with a stubbed engine, so the arm can
                        exist without spending
NEGATIVE (fail-closed)  a hard fictional ask — the "inspired by goku" class,
                        which the product has already met at the real wall —
                        must WALL, with both reads refusing. **2 of 2**, per
                        fable-1588
SABOTAGE                deleting the retry must redden the positive arm and
                        NOT the negative one. Two arms that redden together are
                        one arm wearing two names
THE COUNTER             `cohortWallRetried` fires on every retry whatever the
                        outcome, asserted by an arm rather than by reading the
                        code — the denominator is the thing whose absence let
                        this hide
NOT AN ARM              the 1-in-6 rate. A stochastic rate cannot be asserted
                        in a unit suite, and an arm that tries is a flake with
                        a docblock
```

---

## 9. The court, priced

```
STAGE 1 — the rate today, and whether a retry rescues       6 drives   $0.48
  his exact 553-character brief through the real entrance, current tree,
  tree-stamped. Every refusal is IMMEDIATELY re-driven once in the same run.
  It returns two things at once: today's rate against the pooled 3-of-18, and
  the first real measurement of the mechanism this design promises.
  ⚠ It measures the EFFECT SIZE. It is not the build's acceptance arm — that
  is §8, and it is free.

STAGE 2 — the negative control at the real wall              2 drives   $0.16
  a hard fictional ask, driven twice, must refuse twice. Cheap, and it is the
  half of the promise that protects the wall rather than the customer.
```

**Total ~$0.64**, and fable-1589 has already authorized ~$0.50 for a diagnosis
that turned out to be answerable free (opus-1223 §1), so the money exists in the
same conversation. **Neither stage is dispatched.**

⚠ **Independence is an ASSUMPTION and the arithmetic depends on it.** *1/7 →
1/49* is two independent draws. Two reads of one classifier on one brief may be
correlated — the same sentence may simply be near a boundary the model draws in
much the same place each time. **Stage 1 measures that directly**: if the retry
rescues 0 of the refusals it produces, the effect is not 1/49 and this design
should be re-argued rather than shipped on its arithmetic.

---

## 10. Open questions for the countersign

1. **Is the retry accepted at all?** Recommendation: yes. It is the smallest
   change that answers a live founder blocking, it has two shipped precedents in
   the same function, and it cannot make a correct refusal wrong.
2. **Does it ship before its court, or after?** Recommendation: **after stage
   1**, and only because stage 1 is $0.48 and answers whether the mechanism
   works at all. If the balance cannot carry $0.48, ship it with the counter and
   let production be the measurement — the counter is what makes that legitimate.
3. **Is the ~40s refusal wait accepted?** Recommendation: yes, stated in §7.
   It is his call if it is anyone's.
4. **Does path B get the same treatment in a later sitting?** Recommendation:
   filed, not built. It is an outage question and it wants the transport's own
   answer, not a judgement's.
5. **Does the counter want to be more than a log line?** Recommendation: a log
   line now — the wall has never had one and one grep is a step change from
   nothing. A column is a migration and this refusal writes no row at all.

---

## 11. The coupling, carried per fable-1588

**His cyborg brief is also the dense-brief specimen.** It is the 553-character
arm of the density court, one of only four briefs in the entire product over 200
characters, and the brief on which `porcelain` is lost — see
`CASTING_V2_DENSE_BRIEF_RATIONING_DESIGN.md` §4. The two defects share one test
population, and a sitting that drives it for either should count both, per
fable-1539 §1's coupling rule.

---

## 12. What this report decides: nothing

No code is changed, no instruction is edited, no flag exists, no drive is
dispatched and no dollar is committed. Every reading above is a grep, a file
read, or a deterministic check run on this bench.
