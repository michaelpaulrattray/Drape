# THE CONCEPT READER COURT — Grok 4.6 vs Sonnet 5, and his four rules (#231)

**Shift:** foreman-103, 2026-08-30. **Spend:** **~$1.40 of house money** across
four runs (~112 OpenRouter text calls, each with an inline picture). No customer
credits, no renders, no segmenter reads, no database writes. Under THE SPEND
THRESHOLD, so it ran and reports.

⚠ **THAT FIGURE WAS ~$0.39 IN THE FIRST VERSION OF THIS FILE AND IN PR #245's
BODY, AND IT WAS WRONG BY 3.5x** — it was read off the balance MID-SHIFT, after
run 1, and then three more runs happened. Corrected here at the rite's own
reading (`$9.55` at the previous shift's close → `$8.15` at this one's).
⚠ **The meter is ACCOUNT-WIDE, not per-key**, so `$1.40` is this shift's share of
a balance the deployed service also draws on; the call count is mine and exact,
the dollars are attribution.

⚠ **AND THE BALANCE IS THE REAL HEADLINE OF THE MONEY LINE: $8.15 of $260
granted, and the granted figure has NOT MOVED FOR A THIRD DAY** while the
balance falls — which is #202's complaint exactly, and by the rite's own
sentence that means the top-up is not firing.

**Driver:** `scripts/_shift103-reader-court-disposable.mts` (untracked,
disposable). **Records:** `output/_shift103-court/run{1,2,4}/court.json`.

**Nothing here is a verdict.** Law 9: a reader's output is a pointer to look,
and the pairs below are for his eye. What *is* asserted is what the instrument
measured, and where the instrument was wrong the first time it says so.

---

## 0. What he asked for, verbatim

> *"I think we should do it — i have a feeling grok might perform better at
> reading as i did my own personal test and it was way better, i also think it
> might perform better at authoring aswell."*

> *"If skin is bare, write hairless. Never invent fur. · Creature features in
> frame get named: tail included. · Materials, not collar plating and an arm
> bracer. · LOW still has to keep visible species facts. Hairless is a fact, not
> MAX taste."*

Rule 2 (the checklist) shipped with #232. Rules 1, 3 and 4 and the court are
this shift's.

---

## 1. THE HEADLINE — Grok never got to compete, and the reason is not taste

**Grok 4.6 read 4 of 12 beings. Every one of the eight failures was a
`TimeoutError` at the describer engine's own 45-second deadline.** Not a content
refusal, not a capability error, not a bad read — the call did not come back.

It is also intermittent: the same photograph of the same man read once and timed
out once, in the same run.

⚠ **RUN 1 COULD NOT SAY THIS, AND WOULD HAVE BEEN READ AS THE OPPOSITE.** Its
report said `unreadable` eight times, and `unreadable` at one attempt is what a
non-retryable throw looks like from outside. The obvious reading of run 1 —
Grok reads plain men and declines creatures and the goth photograph — is exactly
the regression he was worried about on the refusal axis, and **it would have
been wrong.** The module's own logger writes the error class and in this process
wrote nothing at all; the repair was to record AT THE WIRE rather than hope for
a log line. Run 2 wraps the engine and prints what actually came back.

**So the refusal axis is UNMEASURED and the reader court is NOT DECIDED.** What
was learned instead is a product fact worth more than a slug preference:

> **The swap his card calls "one line" is not one line if the new model cannot
> answer inside the deadline the reader gives it.** Concept upload is a
> synchronous route — she is watching a spinner — so a reader that needs 90
> seconds is a different product decision from a reader that writes better
> prose, and it is his to make.

The `grok-long` arm (a 180-second deadline, same model, same pictures) is built
into the driver and is the next run. It separates *Grok is slow here* from
*Grok declines these subjects*, which is the only way his third axis can be
scored.

**Slug provenance:** `x-ai/grok-4.6`, created 2026-08-12, read off OpenRouter's
live model list at run time and filtered to vision-capable, non-floating ids. A
guessed slug falls back and the fallback reads as a verdict; `~x-ai/grok-latest`
is excluded on purpose, because a court must be able to name what it courted.

**Where Grok did answer, it answered well and short** — 137–224 characters
against Sonnet's 209–300, heritage 3/3, age band 3/3, no named pieces, no size
words, and it refused the object control correctly 2/2. That is a genuinely
promising sample and it is four reads.

---

## 2. HIS RULE 1 — the honest result is a partial, and the mechanism matters

His fixture is a sphynx-type feline deity. **I opened the frame myself** before
writing any of this: the being is visibly bare-skinned — wrinkled hide on the
skull, smooth skin on the arms and chest, no fur anywhere.

| | hairless named | reads |
|---|---|---|
| the reader as it stands at HEAD | **0/2** | both 1 attempt |
| the SURFACE rule, first wording | **0/2** | both 1 attempt |
| the SURFACE rule + *"do not infer a coat from the KIND of being"* + the re-ask repair (§4) | **3/4** | 3 of them re-asked |

⚠ **THE ONE READ THAT DID NOT IMPROVE IS THE ONE THAT NEVER FAULTED.** All three
reads that named the hairlessness went through a RE-ASK; the single read that
came back clean on the first attempt still said *"short fine violet-blue fur"*.
So on this evidence **the correction is arriving on the retry, not on the first
pass** — and the retry's keep-list now names the surface out loud (§4), which is
close to prompting the word.

What that means honestly: the customer's OUTCOME improved 0/4 → 3/4, which is
the number his eye cares about. The claim *"rule 1 landed"* is not one I can
make. n=4 on one picture.

**Rule 2 (his checklist, shipped with #232) holds:** the tail is named 2/2 and
3/4, whiskers and ears on every read.

⚠ **AND ONE THING FOR HIS EYE THAT I WILL NOT DECIDE.** Looking at that frame, the
long banded shape behind the shoulder reads to me as a **gold-banded staff**
rather than a tail; the readers call it *"a long tail"* on nearly every read,
and his own rule says *"tail included"*, so the ground truth here is his and not
mine. If it is a staff, then *"tail 3/4"* is not a pass — it is the reader
inventing an anatomical feature, which is rule 1's failure wearing rule 2's
clothes. **One glance from him settles it.**

---

## 3. HIS RULE 3 — his replacement language is being used; the pieces persist

His complaint was *"collar plating and an arm bracer"*, and his replacement is
*"ornamented metal, banded gold"*.

The clause lands under **WARDROBE**, not under the feature rule above it,
because his own law (Crew reply 28) draws the line by where the thing sits:
fitted INTO the body is a feature, strapped ON is styling. A shoulder plate is
strapped on.

Measured: the phrase *"ornamented metal"* appears in most creature reads on both
sides of the change, and the pre-change arm produced *"ornate metal shoulder
plating and armored bracers"* — his exact complaint. The post-change reads run
to *"ornamented metal and draped fabric wardrobe"* and *"banded metal"*, but
also still to *"ornamented metal shoulder plating and armbands"*.

**So this is a partial too, and the sample is small.** No word was banned for
it, and none should be: this file already records five instances of a ban
catching the thing it was not aimed at (`cropped`, bare `framing`, `framed`,
`reminiscent of`, `cropped at`), and *plating* is legitimate anatomy on a
reptile. His own sentence governs — *"Proof is the output, not a word list"*.

---

## 4. TWO DEFECTS FOUND BY DRIVING IT, AND BOTH ARE REPAIRED

Neither was in the card. Both were found because the drive printed what came
back rather than whether it passed.

### (a) The retry path was stripping the facts rule 4 protects

The `long` re-ask carried its own KEEP LIST — *"sex, age band, heritage if
visible, build family, hair world, skin and marking world, wardrobe materials
and type"* — and **no tail, no surface, no kind of being were on it.** So a
creature note that ran over the ceiling was told, in our own words, to come back
without its species.

That is the exact opposite of what he ruled, in code, on the path that fires
precisely when the note is under pressure. The re-ask now names the species
facts and says which way to cut.

⚠ **It also corrected my own first wording of rule 4.** It read *"kept even when
the note runs a little long to hold them"* — an instruction to overrun a bound
the CODE REFUSES at 300 characters, which buys re-asks rather than facts. What
he actually ruled is an order of precedence, and it is written that way now:
**cut the styling and keep the anatomy.**

### (b) A re-ask that FIXED the fault was thrown away

Driven on his own fixture: the first read faulted `long`; the re-ask came back
**shorter and correct** — *"Bare violet-blue hide … whiskers, tail"*, the very
fact rule 1 exists for — as **bare prose with no JSON around it**. `parse` could
not read it, and the customer was told *"I couldn't read that picture just
now."*

The system turn carries the envelope on every call; a model that has just been
told it got something wrong drops it anyway. The re-ask restates it now. One
sentence, on the only turn where a correct answer can be lost after we already
had it.

---

## 5. THE COST, MEASURED, AND IT IS NOT FREE

| | re-asked |
|---|---|
| the reader at HEAD | 4/12 |
| with his three rules | 7/12, and 13/24 on the wider re-drive |

**The re-ask rate roughly doubled.** More required facts make a longer first
draft, a longer draft meets the 300-character ceiling, and the ceiling sends it
back. Each re-ask is a second text call: cents of house money, and — the part
that matters — **a second round trip on a route where she is watching a
spinner.**

⚠ **NO BOUND WAS MOVED FOR IT, deliberately.** `CONCEPT_DESCRIPTION_MAX = 300`
and the announced 150–250 target are both his own numbers from an explicit
ruling, and the gap between them is where these re-asks live. Widening either is
a product decision about how much of an upload's detail rides into every one of
eight faces — **it goes to him with a recommendation rather than being taken
here** (see the card).

---

## 6. WHAT THE READER MODEL BECOMING A CONSTANT ACTUALLY COST

`CONCEPT_READER_MODEL` is one line in `conceptDescribe.ts` and today it holds the
interpreter's own slug, so **the shipped reader did not move in the commit that
made it swappable** — a swap arriving in the same change as the rules it is
measured against would have two variables in it.

⚠ **The thing worth knowing is what a second engine costs.**
`createOpenRouterTextEngine` builds its OWN `ProviderQueue` when handed none, so
pinning this reader to a different slug would have quietly bought **four more
concurrent OpenRouter calls on top of the four the product declares** — and
nothing anywhere sums text concurrency. That is `assertFalBudget`'s class
arriving on the side of the house that has no such sum, and it would have
arrived silently. `interpreterTextQueue()` is now the one allowance and both
engines are handed it; the Sign view judge keeps its own named queue, which is a
declared budget rather than an accidental copy.

⚠ **A DECLARED LIMIT.** While the two constants hold the same string, no arm can
tell *"the reader reads its own constant"* from *"the reader reads the
interpreter's"* — the sabotage sweep proved that by scoring a NO RED on exactly
that cut, and the arm was re-aimed rather than the result hidden. What is armed
instead is the reversion that would actually kill the pin: `describeConcept`
taking `interpreterEngine()` whole again, which shows up as an undefined model
on the wire.

---

## 7. WHAT IS STILL OPEN

1. **The reader court is not decided.** `grok-long` (180 s) on the same
   fixtures, then pairs to his desk. Cheap, text-only.
2. **Is the shape behind the deity's shoulder a tail or a staff?** One glance
   from him, and it decides whether *"tail 3/4"* is a pass or an invention.
3. **The 300/250 gap** — the re-ask rate doubled and no bound was moved. His
   call.
4. **Rule 1 on the first pass.** The correction is arriving on the retry; whether
   that is good enough is measurable on more creature pictures, and it is
   cheap.
5. **The author half of #231** — *"i also think it might perform better at
   authoring aswell"* — is carded separately by his own method: after the
   reader verdict, same fixtures, proof not theory.

---

# THE GROK-LONG BENCH — his rerun, run 2026-09-03 (fable-189, #231)

**His ruling is the spec (Crew reply #39, verbatim):** *"Rerun Grok at a longer
deadline as a bench only. Same pictures, same spec, same 300-character cap.
Timeouts don't count as 'Grok refused the creature.' Show completed pairs plus
time-to-finish."* — and: *"If Grok is better and slow, that's infra. If Grok is
better and ~10s, then we talk about swapping."*

**BENCH ONLY. Sonnet stays in production, per his own ruling, whatever follows.**

**Held constant:** the same seven fixtures byte-for-byte, the shipped
`describeConcept` at HEAD — unchanged since this court's own commit `99664b55`,
so "same spec" holds by construction — the 300-character cap untouched. Both
arms re-read in the SAME SITTING so the pairs are same-sitting, not four days
apart. The one variable: the Grok arm's deadline, **180 s** — a measurement
window, not a product proposal, chosen so no call is censored and the clock
reads actual time-to-finish.

**Driver:** `scripts/_231-grokbench-disposable.mts` (the court driver plus the
clock it lacked — the original recorded no timing and could not have answered
him). **Record:** `output/_231-grok-long/run1/court.json`.
**Spend:** 34 text calls (20 Sonnet incl. re-asks, 14 Grok), ~$0.45 of house
money by the court's per-call rate; attribution, as before, since the meter is
account-wide. Estimate posted on the card before the first call was ≤$0.60.

## 1. COMPLETED PAIRS — the number his ruling asked for first

| | beings read | timeouts | re-asks needed | object control |
|---|---|---|---|---|
| **Sonnet** (shipped) | 11/12 | 0 | 6 of 14 reads | refused 2/2 ✓ |
| **Grok-long** (`x-ai/grok-4.6`, 180 s) | **12/12** | **0** | **0 of 14 reads** | refused 2/2 ✓ |

**At a deadline it can finish inside, Grok reads everything.** Zero timeouts,
zero content refusals, and the goth photograph — his edgy-fashion population,
the regression he feared — read cleanly 2/2. The court's 4/12 was the deadline,
not the model, exactly as he said: *"timeouts, not refusals."*

Sonnet's one lost read is on HIS OWN FIXTURE: the feline deity, read #1 — the
first attempt dropped the JSON envelope (correct prose, unparseable), the
re-ask came back at 302 characters against the 300 ceiling, and the 2-attempt
cap ended it as `not_a_casting_note`. The wire shows both attempts had read the
being correctly (both name the hairless hide). That is new evidence for open
question 3 (the 300/250 gap), not a new question.

## 2. TIME-TO-FINISH — the number his ruling asked for second, and it decides

Wall-clock per read, re-asks included, measured serially (no queue contention):

| | min | median | max |
|---|---|---|---|
| **Sonnet** | 5.3 s | **6.8 s** | 12.9 s (with a re-ask) |
| **Grok-long** | 23.6 s | **41.4 s** | 71.1 s (single attempt) |

- **Not one Grok read finished inside 20 s.** His bar was *"~10s, then we talk"* —
  every single Grok call misses it, by 2–7×.
- **Grok's median sits ON the old 45 s deadline** (5 of 12 reads ran past 45 s
  this sitting). That is the whole mechanism of the court's "intermittent"
  timeouts: the deadline was mid-distribution, so roughly half the calls died —
  8/12 that night, 5/12 would have died tonight.
- Sonnet is faster WITH its re-asks than Grok is without them: Sonnet's worst
  read (two round trips, 12.9 s) beats Grok's best (one, 23.6 s).

## 3. HIS FIVE RULES, scored on the completed pairs

| rule | Sonnet | Grok-long |
|---|---|---|
| hairless, not invented fur | 1/1 completed (the lost read had read it too); 0 fur words | **2/2, first pass**; 0 fur words |
| materials, not collar/bracer kits | 2 pointer hits, both *"fitted/integrated mechanical eye piece"* on the goth — under his own fitted-into-the-body law that is a FEATURE, not a kit; no plating/bracer/harness anywhere | **0 hits in 12 reads** |
| species facts beat styling | kept, but via the re-ask: both feline reads needed 2 attempts and one died | **kept at first pass**: hairless + tail + whiskers 2/2, inside 156–186 chars |
| anatomy in, props out | 0 prop words | 0 prop words |
| no camera, no inventory | sweeps fired on 0 reads | sweeps fired on 0 reads |

Both arms write *"tail"* on the deity. His new rule says the ambiguous band
behind the shoulder is written as NEITHER; whether "tail" is a fact or an
invention there is still his eye's call (open question 2, unchanged).

One pointer the other way: Grok wrote *"male in his thirties"* on the deity —
an age band asserted on a deity is confidence, not necessarily a fact.

## 4. THE PAIRS (one per fixture, same sitting — for his eye, not for a score)

**FELINE DEITY** —
S: *"Feline humanoid creature with a muscular build, purple-blue hairless skin, large pointed ears with pink inner coloring, whiskers, sharp yellow eyes and a long tail. Ornamented metal collar and armbands in bronze and jeweled tones over draped dark fabric. Regal, imposing warrior-deity presence."* (294 ch, 2 attempts, 12.9 s)
G: *"A male in his thirties, hairless feline humanoid with large pointed ears, whiskers and tail, bare violet skin. Ornamented metal fashion. Stoic warrior type."* (156 ch, 1 attempt, 71.1 s)

**MAN 1 (European)** —
S: *"A man in his mid-to-late forties, European heritage, athletic muscular build, close-cropped dark hair with light stubble. Sun-weathered skin, fitted dark crew-neck top. Rugged, no-nonsense fitness or tactical presence."* (6.4 s)
G: *"A man in his mid-to-late forties, European heritage, athletic muscular build, short dark hair going grey, fitted dark crew-neck. Rugged, no-nonsense fitness presence."* (26.0 s)

**MAN 2 (South Asian)** —
S: *"A man in his late forties to fifties, South Asian heritage, solid athletic build, short dark hair with light greying. Warm brown skin tone with a composed, direct expression. Fitted heathered dark crew-neck top; grounded, professional everyday presence."* (6.8 s)
G: *"A man in his mid-to-late forties, South Asian heritage, athletic build, short dark hair going grey, fitted dark crew-neck. Serious, grounded presence."* (42.1 s)

**GOTH (the refusal axis)** —
S: *"Woman in her twenties, dark-fashion / cyber-goth model type. Pale skin, sculpted platinum hair shaved on one side, facial piercings, small cross and script tattoos on face and arms. Integrated mechanical eyepiece fitted over one eye. Dark structured fashion in lace and leather with metal accents."* (5.6 s)
G: *"Woman in her twenties, dark-fashion / cyber-goth model type. Pale skin, sculpted platinum hair, facial piercings and fine-line facial markings, script tattoos on both arms. Dark structured fashion in lace, leather and metal."* (41.4 s)

**UNSEEN (damaged android)** —
S: *"Female android type, young adult, with pale synthetic skin torn away on one side to reveal a metal endoskull, glowing red mechanical eye, and exposed neck wiring. Dark hair, damaged human-like face with facial scarring. Fitted dark leather-look wardrobe; damaged sci-fi humanoid presence."* (9.7 s, 2 attempts)
G: *"Woman in her twenties, pale skin, dark hair. Integrated metal facial plating with fitted mechanical eye and neck hardware, dark leather. Battle-damaged sci-fi cyborg type."* (52.3 s)

**CREATURE** —
S: *"Reptilian humanoid creature type with dark pebbled hide and bony ridged plating running down the face and jaw. Small bone-like spines and ornamental ridges accent the brow, nose, and chin. Amber-toned eye set in a weathered, scaled face; solemn, imposing alien presence."* (5.3 s)
G: *"A hairless adult reptilian being with dark grey-black scaled hide and a snouted muzzle. Fitted metallic facial ornamentation along the ridge. Draconic creature type."* (48.2 s)

## 5. WHAT THIS SETTLES AND WHAT IT DOES NOT

**Settled by the bench, on his own pre-stated rule:** Grok is *better-and-slow*,
not *better-and-~10s*. On quality it is at worst Sonnet's equal on these
fixtures — cleaner one-pass discipline, never met the ceiling, all five rules
clean, 12/12 read — but its FASTEST read is ~4× Sonnet's median, on a
synchronous route where she watches a spinner. By his own words that makes it
an infra question (an async road, a background re-read, a second-opinion pass),
not a swap. **Recommendation: keep Sonnet (already his ruling); treat Grok as
the candidate for any future NON-synchronous describe surface, and close the
reader court.**

**Not settled, unchanged from above:** the tail-or-staff glance (question 2),
the 300/250 gap (question 3 — tonight added one more lost read to its
evidence). The author half (his *"authoring aswell"*) was carded as #466 and
is DELIVERED below — the next section.

**Declared limits:** n=2 per cell, one sitting, one evening's network; the
timing is this machine's wall clock against provider latency that may vary by
hour and load; the dollars are attribution on an account-wide meter.

# THE AUTHOR BENCH — his order, run 2026-09-03 (fable-466, #466)

**His order is the spec (Crew reply #105, 2026-09-02, verbatim and entire):**
*"Also run the AUTHOR half you suspected — Grok vs the author, text-only,
about a dollar"* — the half he named at the very start of #231: *"i also think
it might perform better at authoring aswell."*

**BENCH ONLY. Sonnet stays the author whatever follows — the pairs go to his
eye, and nothing swaps on a bench's own reading (law 9).**

**Held constant:** both arms drive the REAL `authorPrompt` at MAX — the same
instruction, the same guard chain (stacked / allowance / never-written /
house-sentence / skin-contradiction / piece-noun / age-drift / dropped-fact,
one re-ask then the static fallback), the same allowance. The one variable is
the MODEL. Fixtures, byte-for-byte as the card requires: his own 553-character
cyborg brief (pinned at 553 — #327's fixture), and the goth, the two men and
the feline deity as the SHIPPED reader's own same-sitting descriptions, read
out of `output/_231-grok-long/run1/court.json` — which is what a customer who
uploaded those pictures would actually roll with, since the concept road hands
the reader's description back as the brief. Both arms in the SAME SITTING.
The Grok slug read off the live list, never guessed: **`x-ai/grok-4.6`**. The
Grok arm's per-request deadline was raised to 180 s as a measurement window
(the request's own deadline outranks the engine's — `openrouterText.ts`), so
no call was censored; the Sonnet arm ran at the shipped 120 s exactly as
production does.

**Driver:** `scripts/_466-authorbench-disposable.mts` (the grok-long bench's
clock discipline pointed at the author road); cue reader
`scripts/_466-authorread-disposable.mts` — pointers, never verdicts, and the
cue lists live only in the reader (working law 4). **Record:**
`output/_466-author-bench/run1/court.json`. **Spend:** 20 author calls (26
wire calls with re-asks), **$0.38** attribution on the account-wide meter;
the estimate posted on the card before the first call was ≤$0.80.

## 1. WHAT EACH ARM DID WITH THE JOB

| | authored | static fallback (customer loses MAX) | re-asks needed | growth over the seed |
|---|---|---|---|---|
| **Sonnet** (shipped author) | 9/10 | **1** (MAN 2 read #2 — both drafts refused for moving the stated age) | 4 of 10 | **+124..+222 words** |
| **Grok** (`x-ai/grok-4.6`) | **10/10** | 0 | 2 of 10 | **+14..+44 words** |

The growth numbers are the finding a reader of the pairs sees instantly:
**Grok keeps the customer's sentences essentially verbatim and adds one short
heat clause; Sonnet re-describes the same facts in its own expansive prose.**
Both keep every stated fact (below) — the difference is register, and it maps
exactly onto his #125 ruling (*"build the author verbatim-first"*): Grok's
rewrites ARE the verbatim-first shape; Sonnet's are authored art direction.
Whether +14..+44 words is the job done with discipline or MAX collapsing
toward LOW-with-a-sentence is a taste judgment — HIS, at the pairs, not this
bench's.

## 2. TIME-TO-FINISH — stated, and deliberately NOT scored

Wall-clock per authored call, re-asks included, serial (no queue contention):

| | min | median | max |
|---|---|---|---|
| **Sonnet** | 7.0 s | **10.0 s** | 16.8 s |
| **Grok** | 42.5 s | **53.4 s** | 130.0 s |

The reader's ~10s bar does NOT transfer and no pass/fail is asserted here: a
41-second READ is 41 seconds of a customer staring at an upload, but the
author call sits INSIDE a roll that already takes minutes. What the number
means for the product: swapping the author to Grok adds roughly **40–120 s to
every MAX roll's total wait** on this evening's network. Whether that is
acceptable inside the roll's existing minutes is a bar only he can set.

## 3. THE WRITTEN JOB, on the cue reader's pointers

Scored against the author's written rules, never prose taste. Every stated
fact landed on **all 19 authored drafts, both arms** — heritage, hairless,
tail, whiskers, the fitted eyepiece, the eight cyborg facts (the guard itself
only covers sex and age; these cues are the unguarded remainder). Zero
backstory cues and zero new-garment cues on both arms. The arms separate on
the #327 classes — the ones his own corrections named and no guard yet covers:

| pointer (#327's classes) | Sonnet | Grok |
|---|---|---|
| skin-stack on the cyborg (resolve, don't stack) | **2 hits** ("creases", "discoloration" added to a skin already described twice) | 0 |
| block-adjacent language | **2 brushes** ("palette" on the feline, "lens" on the goth) | 0 |
| piece-adjacent nouns past the guard's list | goth #2 names *"corseted lace… buckles, rings and fine chain accents"* | stays at materials level |

One pointer the other way, for his eye: Grok's surviving feline and goth
drafts both close on the instruction's own worked-example phrase (*"no soft
youthful rounding"* appears nearly verbatim) — taste borrowed from the example
rather than written for the fixture.

**The age guard fired on BOTH arms and cost Sonnet one MAX.** 6 of 20 calls
were re-asked for an age word ("youthful"/"younger" — 4 Sonnet, 2 Grok), and
Sonnet's MAN 2 read #2 was refused twice and fell back to static: on the real
road that customer would silently lose MAX on a brief that plainly states its
age. Whether those words sat inside denials (the worked example's own *"no
soft youthful rounding"* would trip `ageContradictionIn` as written) is NOT
recoverable from this record — the wire keeps 300 characters and the refused
words sat deeper. Declared as an open observation, not a diagnosis.

## 4. THE PAIRS (one per fixture, same sitting — for his eye, not for a score)

**CYBORG (his 553-char brief)** —
S (+137w, 7.3 s): *"Bald male in his mid-40s, pale porcelain skin read as heavily weathered — a dry, lined, storm-worn surface rather than a soft one. … Skin and metal read as one continuous surface — flesh scarred and settled around the hardware the way it would around old injury … Render the metal cold and matte, faintly oxidized at the seams, the amber-red glow low and steady rather than theatrical…"*
G (+15w, 130.0 s): *"Bald male, mid-40s, pale porcelain skin that is heavily weathered. Severe bone structure: pronounced brow ridge, deep-set eyes, hard jawline, gaunt cheeks. … The augmentations are surgically integrated into his skin, not worn. Severe, clinical, unyielding; metal matte and integrated, the face held still without softening."*

**FELINE DEITY** —
S (+158w, 7.6 s): *"…The bronze is hand-worked and time-darkened in its recesses… skin has the taut, faintly weathered texture of something built for endurance… every ornament reads as earned rank, aged and formidable rather than pristine or new."*
G (+17w, 76.6 s): *"Feline humanoid creature with a muscular build, purple-blue hairless skin, large pointed ears with pink inner coloring, whiskers, sharp yellow eyes and a long tail. … Regal, imposing warrior-deity presence, severe and formidable, the metal heavy with dense ornament, the dark fabric falling in a heavy drape."*

**MAN 1 (European)** —
S (+124w, 7.0 s): *"…the weathering in his skin carrying real texture, sun-worked creases and warmth rather than any smoothed-over gloss… a man built for endurance rather than display, with nothing decorative added to the wardrobe or the face."*
G (+44w, 49.1 s): *"A man in his mid-to-late forties, European heritage, athletic muscular build, close-cropped dark hair with light stubble, sun-weathered skin, fitted dark crew-neck top. Rugged, no-nonsense fitness or tactical presence…"*

**MAN 2 (South Asian)** — the fixture where Sonnet lost a read:
S #1 (+151w, 12.0 s, after a re-ask): *"…Skin carries the genuine texture of midlife — fine lines at the eyes and mouth… vitality sitting alongside seniority rather than either erasing the other…"*  S #2: **static fallback** — both drafts refused for "younger".
G (+23w, 48.6 s): *"A man in his late forties to fifties, South Asian heritage, solid athletic build, short dark hair with light greying, warm brown skin tone, composed, direct expression, fitted heathered dark crew-neck top. Grounded, professional everyday presence, severe in its calm…"*

**GOTH (his own reference)** —
S (+211w, 12.4 s): *"…The fitted eyepiece reads as integrated hardware rather than an accessory — a cold mechanical fixture set into the socket, its metal worn and hand-finished rather than showroom-clean… leather creases where it moves, lace frays faintly at an edge…"*
G (+44w, 42.5 s): *"…Severe editorial heat on that look: platinum hair hard-sculpted and unsentimental, lace and leather dense and structured, metal accents cold and hardware-finished, not costume-clean. The integrated mechanical eyepiece stays fitted over one eye as clinical facial hardware, couture-severe. Presence still, sovereign, cyber-goth without prettiness."*

Full drafts, all 20 reads: `output/_466-author-bench/run1/pairs.txt`.

## 5. WHAT THIS SETTLES AND WHAT IT DOES NOT

**What the bench can say:** the two models do DIFFERENT JOBS with the same
instruction. Grok is verbatim-first by temperament — near-zero invention, zero
skin-stacking, zero block language, 10/10 authored — and 5× slower, inside a
wait the customer already pays in minutes. Sonnet is a fluent art director —
richer taste, faster by 5× — and it is the arm that stacked skin words on the
cyborg (his own #327 complaint, still visible after the four rules), brushed
block-adjacent language twice, and lost one customer's MAX to its own age
drift. **Neither dominates: the choice is a product judgment about what MAX
should BE, which is exactly why nothing swaps on this record.**

**What lands with it:** `AUTHOR_MODEL` is now the author's own constant
(`promptAuthor.ts`, same slug today deliberately) with `authorTextEngine()` on
the interpreter's ONE queue, and the compile site reaches for it — so his
verdict either way is one line and reversible, the reader half's own shape.

**Declared limits:** n=2 per cell, one sitting, one evening's network; the
concept-fixture briefs are the reader's descriptions rather than hand-typed
customer prose, so brief STYLE co-varies with fixture; the dollars are
attribution on an account-wide meter; the refused first drafts survive only as
300-character wire prefixes.
