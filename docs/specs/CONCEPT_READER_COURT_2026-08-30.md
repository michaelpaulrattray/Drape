# THE CONCEPT READER COURT — Grok 4.6 vs Sonnet 5, and his four rules (#231)

**Shift:** foreman-103, 2026-08-30. **Spend:** ~$0.39 of house money (OpenRouter
text calls with an inline picture). No customer credits, no renders, no
segmenter reads, no database writes. Under THE SPEND THRESHOLD, so it ran and
reports.

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
