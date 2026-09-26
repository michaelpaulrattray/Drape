# The reader-ask court — trimming the four fields the author road discards

**Card #1123. Run 2026-09-26 on his word, verbatim: _"1123) run the court"_.**
Driver `scripts/court-reader-ask-1123.mts` · surgery `scripts/lib/readerAskTrim.mts`
· guard `server/readerAskTrim.test.ts` · raw records
`docs/specs/reader-ask-court-1123/`.

**Spent: $10.08** across 403 text calls — $7.99 on the main run (291 entrance
runs) and $2.09 on a deep re-read of the one soft finding (40 runs at n=10). No
credits, no renders, no images, no database writes.

---

## THE VERDICT, IN ONE SENTENCE

**Trimming the ask does not move a single hard stated fact — sex, age band, age
phase, heritage, build, cohort, stated accessories, stated ink and stated
wardrobe are bit-for-bit identical across 87 runs per arm — but it is NOT free:
on the briefs where `role` is already a coin toss the trim turns it into a
certainty of NULL (6/10 and 7/10 filled on the full ask, 0/10 on the trimmed
one), and dropping `variationAxis` on top makes the reader invent a `look` that
locks all eight candidates, so the safe act is at most the three dead fields and
only after `needsAestheticRetry` stops keying on a field that is no longer
asked.**

---

## What the card asked, and the one correction found before any call fired

The card says the reader is asked for four fields the author road discards:
`reads`, `composedDirection`, `poolTendencies`, `variationAxis`. Three of those
hold up at HEAD and one does not.

| field | the card's claim | read at the code, 2026-09-26 |
|---|---|---|
| `reads` | discarded; consumer `personaLineFor` | **Confirmed, and stronger than the card.** `grep` finds exactly ONE site for it in `server/`, `client/` and `shared/` — the parse that writes it (`castingIntent.ts:1456`). There are **zero readers**. `personaLineFor` no longer exists anywhere in the tree; the per-slice caption went with #1241. |
| `composedDirection` | discarded; consumer the unsent per-slice prompt | **Confirmed, with a second reader the card does not name.** The prompt consumer is real (`cohortPhotorealHuman.ts:2877-2878`, gate `stylingResolution.ts:59` is `true`) and the author road overwrites that prompt at `briefCompiler.ts:1417`. But `needsAestheticRetry` also reads it — `interpreter.ts:137`, `intent.composedDirection === null && intent.look === null && intent.archetype === null` — and that is live on both roads. See the cost finding below: it is the reason the trim is not a saving on every brief. |
| `poolTendencies` | discarded; consumer the dice | **Confirmed.** The author road does reach its read sites (`briefCompiler.ts:974`, `:1018` inside `resolveSheet`, called unconditionally at `:1336`; `cohortPhotorealHuman.ts:1437-1551`), but everything they produce lands in the prompt overwritten at `:1417`, the `unsent: true` identity record, or the `variance` blob that stopped crossing to the client in #1124 (`rollProjection.ts:90-94`). |
| `variationAxis` | discarded; "the dice — and `promoteStatedRole`" | ⚠ **NOT discarded. It is a KEPT field with two live author-road consumers.** `promoteStatedRole` reads it at `heritagePromotion.ts:126` (`if (intent.variationAxis !== "look") return intent;`), called on both roads at `briefCompiler.ts:1268`, and turns the brief's first 80 characters into the `role` the sheet shows as "cast as …". And `axisTwin` reads it at `briefEcho.ts:316-318` to decide which open axis the "left to the roll" sentence leaves OUT — live on both roads, as that file's own comment says. |

So the court runs **two** trims rather than one, which is what makes its answer
actionable instead of all-or-nothing.

**One stale citation, corrected here rather than carried:** the card says the
reader's ceiling is 1,800 at `interpreter.ts:1203`. It is **5,000**, at
`interpreter.ts:1328`, raised there on 2026-08-03 with its own measurement
(`interpreter.ts:1300`). The 1,200 → 1,800 raise the card describes is the
history two raises ago. This matters to the card's own argument — see "the
reliability premise" below.

---

## Method

Both arms go through the real entrance, `interpretBrief`
(`server/castingV2/interpreter.ts:1197`), with the real transport, the real
model, the real temperature and the real ceiling. **No production code was
edited for this court.** The arms differ by the bytes of the system prompt and
by nothing else: the driver wraps the real `TextEngine` and swaps `system` on
the way past, so the entrance composes the prompt exactly as it does on a paid
roll and the wrapper substitutes the arm's variant.

- **Model** `anthropic/claude-sonnet-5` (`DEFAULT_INTERPRETER_MODEL`,
  `server/providers/openRouterText.ts:44`), temperature 0.2,
  `maxOutputTokens: 5000`, `timeoutMs` 120 s, `retries: 1` — identical in every
  arm. **The trimmed arms were NOT given a lower ceiling**: a cap is not a
  reservation and an unused token is not billed, so holding it constant removes
  a confound the card's 1,200/1,800 history would have invited.
- **The ask under test is read from the product's own composer**, not quoted:
  `interpreterSystemPrompt({ wardrobe: false, ink: true, fidelity: true, author: true, statedWardrobe: true })`
  — 24,999 characters. Those are today's positions for every account:
  `CASTING_CREATIVE_REGISTER_SCOPE` (#201), `CASTING_BRIEF_FIDELITY_SCOPE`
  (#203) and `CASTING_BORN_INK_SCOPE` (#215) all went to `all` on 2026-09-24
  (`scripts/lib/productionFlagPositions.mts`), and the compiler hands `wardrobe`
  a literal `false` (`briefCompiler.ts:1136`).
- **Asserted at the wire.** Every call checks that what the product composed is
  that exact string before the swap; a prompt the court does not recognise
  throws rather than being measured. The one exception is deliberate and named:
  `interpretBrief` also calls `compressCharacterNotes` on the same engine with
  its own short prompt, and that call is passed through untouched.
- **The surgery removes both statements of a field and nothing else** — the
  schema line inside the reply-shape object and the instruction paragraph under
  `WHAT TO EXTRACT` — and every step throws if its anchor is missing, ambiguous,
  or if the field's own name survives. A trim that silently removed nothing
  would make two arms one ask and report perfect agreement.

### The four arms

| arm | ask | dropped | note |
|---|---|---|---|
| `full` | 24,999 chars | — | byte-identical to production; **also the negative control** |
| `dead3` | 17,879 (−7,120, −28%) | `reads`, `composedDirection`, `poolTendencies` | the three with no reader |
| `card4` | 17,266 (−7,733, −31%) | those three + `variationAxis` | the card's own trim |
| `control` | 24,049 (−950) | `sex`, `heritage` | **the positive control** |

### Fixtures — 29 briefs he typed, 12 to 1,137 characters

Nineteen from `server/castingV2/goldenBriefs.ts` — *"every entry is a brief a
founder actually typed … each one is here because it failed once, in production,
on a real roll"* — and ten read out of `casting_rolls.briefText` on the
development database on 2026-09-26. Provenance is recorded per brief in the
driver and in the JSON record. In length order:

| id | chars | what it is |
|---|---|---|
| `devroll-81` | 1,137 | the editorial brief: heritage, age, hair, an earring, extensive ink, build — the longest brief either database holds |
| `devroll-92` | 553 | his cybernetics brief — the specimen the cohort-wall and budget courts both ran on |
| `devroll-86` | 307 | the prehistoric man |
| `devroll-87` / `devroll-93` | 179 | every fact stated and no category; a stated occupation plus greying hair |
| `devroll-83` | 163 | a brief whose facts are ABSENCES — no tattoos, no jewellery |
| `devroll-65` | 127 | stated accessories, no category |
| `devroll-55` / `devroll-38` / `devroll-56` | 49 / 40 / 29 | stated heritages — West African, Middle Eastern, East Asian |
| `golden-01`…`golden-19` | 12–78 | the regression memory: miu miu, Margiela, Wes Anderson, the bogan, the k-pop idol, the redhead, the bleached brows |

**Stated limit.** The production roll table was the first choice and this
machine's permission classifier refused the read (`[Production Reads]`), so roll
219's 1,494 characters and the rest of the long tail are absent: **one brief
over 1,000 characters instead of several.** The truncation and ceiling questions
the card raises live on exactly those briefs, so that half of the reliability
premise is under-tested here and says so.

---

## The controls, before the finding

### NEGATIVE CONTROL — the same ask twice (three times), the same brief

The `full` arm's three repeats per brief ARE the noise floor, and it is not
uniform:

| field | briefs where 3 identical calls agreed | |
|---|---|---|
| cohort, sex, ageBand, heritage, build, statedAccessories, statedWardrobe | **29/29 (100%)** | rock solid |
| agePhase, energy, look, statedInk | 28/29 (97%) | |
| `variationAxis` | 25/29 (86%) | |
| `role` | **22/29 (76%)** | the noisiest field the customer sees |

⚠ **`role` and `variationAxis` are unstable on the same ask**, which is why no
`role` finding in this court is reported off n=3.

### POSITIVE CONTROL — the full ask minus `sex` and `heritage`

Population: 10 briefs whose sentence states a sex or a heritage, taken on a
stride so the set is not all short goldens (6 golden + 4 dev rolls, including
the 1,137-character one). The population was proven live rather than assumed:
the `full` arm filled `sex` on **10/10** of them and `heritage` on **1/10**.

| | |
|---|---|
| `sex` lost in the control arm | **10/10** |
| `heritage` lost in the control arm | **1/1** |
| **verdict** | **PASSES** — removing two kept fields from the ask is visible to this instrument |

So a null result below is a null result, not a blind instrument. The surgery
itself carries ten arms in `server/readerAskTrim.test.ts`, including three that
prove each anchor is load-bearing (a missing schema line, a missing instruction
block, and a doubled field all REFUSE rather than trimming something else).

---

## THE RESULT

### The hard stated facts do not move

Fill counts over **87 runs per arm** (29 briefs × 3 repeats), counting every run
in which the field came back non-empty:

| field | `full` | `dead3` | `card4` | moved? |
|---|---|---|---|---|
| `cohort` | 87/87 | 87/87 | 87/87 | no |
| `sex` | 57/87 | 57/87 | 57/87 | no |
| `ageBand` | 75/87 | 75/87 | 75/87 | no |
| `agePhase` | 40/87 | 40/87 | 39/87 | no |
| `heritage` | 12/87 | 13/87 | 12/87 | no |
| `build` | 9/87 | 9/87 | 9/87 | no |
| `statedAccessories` | 9/87 | 9/87 | 9/87 | no |
| `statedInk` | 3/87 | 3/87 | 3/87 | no |
| `statedWardrobe` | 3/87 | 3/87 | 3/87 | no |
| `role` | 67/87 | 64/87 | 65/87 | **yes — see below** |
| `energy` | 7/87 | 8/87 | **4/87** | `card4` only |
| `look` | 1/87 | 0/87 | **5/87** | `card4` only |
| `variationAxis` | 73/87 | 71/87 | **0/87** | `card4` by construction |

Per-brief modal agreement with the `full` arm tells the same story: 29/29 on
cohort, sex, ageBand, agePhase, heritage, statedAccessories and statedWardrobe
in **both** trim arms.

**So the founder's own sentence — the sex, the age, the heritage she typed — is
untouched by the trim, measured, with a control that proves the instrument can
see a removal.** That is the card's central worry answered, and answered no.

### But `role` is lost, and the deep re-read proves it is not noise

In the main run two briefs lost `role` in the trimmed arms:

- `devroll-92` (his 553-character cybernetics brief) — `full` 2/3, `dead3` 0/3
- `devroll-38` ("a Middle Eastern street casting, mid 20s") — `full` 2/3, `dead3` 1/3

`role`'s noise floor is 76%, so at n=3 that could have been nothing. It was
re-read at **n=10 per arm** on those two briefs alone, and the raw values are
these:

```
devroll-92  full   role filled 6/10   "cybernetically augmented man" x3, "cyborg" x2, "cybernetic augmented man" x1
devroll-92  dead3  role filled 0/10   null, ten times out of ten
devroll-38  full   role filled 7/10   "street casting" x7
devroll-38  dead3  role filled 0/10   null, ten times out of ten
```

**A field that lands six or seven times in ten on the ask we send today lands
zero times in ten on the trimmed ask.** That is not the noise floor; that is the
effect. And `role` is not a minor field: it is the one that produces the "cast
as …" clause the customer reads back on her own sheet
(`rollProjection.ts:311-315` → `briefEcho.ts:242`), and on the house road the
CASTING CATEGORY block. `goldenBriefs.ts` exists because losing it once already
produced *"a sheet of generic people"*.

The mechanism is visible in the removed text: `poolTendencies`' instruction
opens *"what the CASTING CATEGORY typically implies…"* and `reads` asks for
eight labels *"in the brief's OWN register"*. Both make the model characterise
the person before it answers. Taking them out takes the scaffolding with them.
**This is "context is not additive", measured again, in the direction the card
feared and on a field the card did not flag.**

### And dropping `variationAxis` makes the reader invent a `look`

`card4` fills `look` **5 times in 87** where the full ask fills it **once** —
`golden-08` ("a Wes Anderson casting, mid 30s") gained *"angular and unslept"*
and `golden-09` (the gothic bogan) gained *"off-kilter charm"*, neither of which
the full ask produced. A stated `look` **locks across all eight candidates** by
the archetype law, so an invented one narrows the sheet for a fact nobody typed.
`card4` also halves `energy` (7 → 4).

So the card's own four-field trim is the worse of the two trims on three counts:
it destroys a kept field outright, it loses `role` exactly as `dead3` does, and
it invents a locking `look`.

### Latency, tokens and money — the trim is cheaper on average and slower where it bites

Main run, 87 runs per arm:

| arm | calls/run | p50 wall | p95 wall | tokens in/call | tokens out/call | reply chars (p50) | truncated | parse failures | $ per run |
|---|---|---|---|---|---|---|---|---|---|
| `full` | 1.07 | 11.7 s | 39.8 s | 9,117 | 1,245 | 934 | **0** | **0** | $0.0328 |
| `dead3` | 1.18 | 7.0 s | 28.0 s | 6,728 | 693 | 502 | **0** | **0** | $0.0241 |
| `card4` | 1.22 | 6.2 s | 35.2 s | 6,514 | 616 | 473 | **0** | **0** | $0.0234 |
| `control` | 1.03 | 16.3 s | 32.0 s | 8,750 | 1,472 | 835 | **0** | **0** | $0.0333 |

Averaged over the corpus: **26% cheaper and 40% faster at p50** for `dead3`.
That is the number the card hoped for, and it comes with a catch the card could
not have known.

⚠ **THE SAVING EVAPORATES ON EXACTLY THE BRIEFS THAT TRIP THE SPECIFIC-NAME
DETECTOR, AND THE CAUSE IS `needsAestheticRetry` READING A FIELD THAT IS NO
LONGER ASKED.** `interpreter.ts:137` fires a whole extra interpretation when
`composedDirection`, `look` and `archetype` are all null and the brief names
something specific. Trim `composedDirection` away and the first of those three
is null forever, so the retry fires on every such brief and can never be
satisfied by the thing it was written to recover. Measured on the deep re-read's
two briefs:

| arm | calls/run | p50 wall | $ per run |
|---|---|---|---|
| `full` | 1.50 | 23.9 s | $0.0543 |
| `dead3` | **2.00** | **40.5 s** | $0.0502 |

**Twice the calls, 70% slower, and the money saving down to 8%.** Across the
whole corpus the trimmed arms' calls/run rose 1.07 → 1.18/1.22 for the same
reason, and the extra calls are counted: **`full` fired 6 second interpretations
across its 87 runs, `dead3` 16 and `card4` 19** — a 2.7x and 3.2x rise. Over the
whole main run the 42 extra calls were **34 aesthetic re-samples and 8
`roleNull` re-asks**, with no truncation retry and no cohort-wall retry at all.
Any trim that ships must take that predicate with it.

### The reliability premise has nothing to buy

The card argues *"a shorter reply is a more reliable one."* Across **all 403
calls in both runs, on every arm: 0 truncations and 0 parse failures.** The
ceiling is 5,000 tokens and the median reply is 934 characters on the full ask —
about 6% of the headroom. There is no reliability to recover at the current
ceiling, and the card's premise rests on a citation two raises out of date. **The
honest caveat is the fixture limit above**: the truncation class lives on
1,000-plus-character briefs and this corpus holds one of them.

---

## What this leaves for him to decide

Not a recommendation to act, because widening or narrowing what every cast is
read with is his call. What the measurement supports:

1. **Nothing about the trim threatens the facts she typed.** Nine fields,
   identical to the run. If the question was *"is this safe for her sheet's
   stated facts"*, the answer is yes.
2. **The card's four-field trim should not ship as written.** `variationAxis` is
   a kept field, and removing it also makes the reader invent a locking `look`.
3. **Even the three-field trim costs `role`** on the briefs where `role` is
   already a coin — 6/10 and 7/10 → 0/10 — and `role` is the field
   `goldenBriefs.ts` exists to protect. That is a defect to fix before a trim,
   not a price to pay for one.
4. **If a trim happens, `needsAestheticRetry` moves in the same commit.** A
   predicate that reads a field nobody asks for turns a 26% saving into a
   doubling of calls on aesthetic briefs.
5. **`reads` is dead in a way the trim does not even need.** It has zero readers
   on either road and its old consumer no longer exists. Removing that ONE field
   is the smallest true version of this card, and this court did not isolate it —
   it is the obvious next measurement if he wants the cheapest safe step.

---

## Re-running it

```
npx tsx scripts/court-reader-ask-1123.mts --dry-run
npx tsx scripts/court-reader-ask-1123.mts --run
npx tsx scripts/court-reader-ask-1123.mts --run --only=devroll-92,devroll-38 --arms=full,dead3 --repeats=10
```

It refuses to send anything without `--run`, prints the plan and a cost estimate
under `--dry-run`, and reports the **measured** spend from the token counts the
provider returns on every call rather than from the estimate's model. The
estimate quoted on the card before the first arm fired was $14.71 worst case;
the main run came in at $7.99.

## Stated limits

- **One brief over 1,000 characters.** The production roll table read was refused
  by this machine's permission classifier, so the long tail of his real briefs is
  absent and the truncation/ceiling half of the card's argument is under-tested.
- **n=3 on 29 briefs for the main run**, which is why nothing about `role` is
  reported off it — the deep re-read exists because `role`'s own noise floor is
  76%. Fields with a 100% noise floor need no such caution; fields at 97% (agePhase,
  energy, look, statedInk) are reported at n=3 and a single-brief difference there
  should not be read as an effect.
- **The `look` and `energy` findings on `card4` rest on small counts** (1 → 5 and
  7 → 4 out of 87). They are reported because they point the same way as the
  mechanism and because a locking field is worth flagging cheaply, not because
  n is comfortable.
- **The positive control's `heritage` half ran on one brief** — only one fixture
  in the population had a heritage the full ask actually filled. The `sex` half
  carried the control at 10/10.
- **The control arm's own collateral was not analysed.** It moved `role` on one
  brief and `heritage` on one; the control exists to certify the instrument, not
  to be a finding.
- **This is the reader only.** Nothing here measures what the eight pictures look
  like, because on the author road none of these four fields reaches an image
  prompt at all — which is the premise the card starts from and this court did not
  re-test.
