# THE NOTES ARE A FIXED BUDGET AND A DENSE BRIEF IS RATIONED
# — §10 item 3c, redesigned

⚠ **STATUS: DESIGN REPORT, AWAITING COUNTERSIGN. NOTHING IS BUILT AND NOTHING
HERE IS DECIDED.** Written 2026-08-24 against the code and against four free
readings taken at the production database, not from recollection.

**It replaces the STATED CASE of `CASTING_V2_STATED_SKIN_LANE_DESIGN.md`, which
was countersigned (fable-1501) and then stopped at its own court** (opus-1185,
ruled fable-1539 Q1). That document stays on the shelf: its §0 is the record of
the stop and its §5–§7 are the shape this one still recommends. What it got
wrong is the SUBJECT — it named colour words, and the mechanism is density.

Ordered by fable-1539 Q2 (*"if it reproduces, the population it names is DENSE
BRIEFS, and that population is already spoken for elsewhere … a dense-brief fix
and that coupling must be designed in one look, not two"*) and scoped by
fable-1543 §1 (*"subject DENSE BRIEFS, the `NOTES_MAX`/born-ink coupling in the
same look, `olive`'s hyphen carved out as its own small vocabulary defect"*).

---

## 0. The four readings this is written on

All four are **free** — no model call, no credit, no fal call. Two are new this
sitting and read at the production database; two are re-reads of artifacts
already bought.

```
R-a  the notes census, PRODUCTION      209 rolls, 98 carrying characterNotes
     scripts/_notes-budget-census-disposable.mts --production
R-b  the four dense briefs, PRODUCTION every roll whose brief is >=200 chars
     scripts/_dense-rolls-text-disposable.mts --production
R-c  the density court, re-read        output/skin-lane-court/density-court.{log,json}
                                       ($0.64, bought opus-1185, tree 16f1ba79)
R-d  the code, at four sites           interpreter.ts, castingIntent.ts,
                                       briefCompiler.ts, cohortPhotorealHuman.ts
```

---

## 1. The complaint, restated so it can be measured

**One population, two failure modes, and only one of them is counted.**

A brief that says a lot gets the same amount of room to say it in as a brief
that says a little. What does not fit is not refused, not logged and not shown
to anybody — it is quietly generalised or dropped, and the picture is cast from
what is left.

```
MODE A — OVERFLOW           the summary exceeds 180 characters. It is re-asked
  COUNTED                   for a compression, and if that fails it is cut at a
  notesOverflow             word boundary. Production instances: rolls 128, 129
MODE B — SILENT RATIONING   the summary fits comfortably and a stated fact is
  COUNTED NOWHERE           generalised or dropped anyway. Production instances:
  no counter, no log        rolls 206, 208
```

Mode A is the one the product already knows about: it has a counter, a docblock,
a compression re-ask and a closed park (`NOTES_MAX`, ruled fable-1431 §1). **Mode
B has never been named, and it is the one 3c has been chasing.** On rolls 206 and
208 the notes came back at **148 and 165 characters against a 180 cap** — no
overflow, no counter, nothing to grep — and the founder's own word *porcelain*
is absent from both.

---

## 2. The mechanism, measured: the output budget does not move when the input does

The density court drove the identical phrase *"pale porcelain skin"* in two
briefs, one tree, one hour (R-c). The received reading was *dense fails, plain
passes*. **The number nobody quoted is the note LENGTH, and it is the finding:**

```
arm                       brief    notes (chars)     "porcelain" at the wire
A-dense                   553      153, 149          0 of 2
B-plain                   190      152, 152, 146     3 of 3
```

**The two arms produced summaries of the SAME LENGTH.** The dense brief was not
given a longer line because it had more to say — it was given the same line and
made to choose. Its choices are visible in the log: drive 2 keeps the implants,
the scalp seams, the jaw plate, the ear studs and the amber-red eye, and pays
for them with *porcelain*, which comes back as *pale*.

Production says the same thing at 209 rolls (R-a):

```
brief length      n     median notes        median notes
                        (characters)        (words)
   <100          91          17                  2
100-199           3          34                  4
   550+           4         165                 24
```

**Note length climbs with brief length and then stops.** The four densest briefs
in the product are 553, 553, 1137 and 1137 characters and their notes are 148,
165, 180 and 180 — a 2x difference in input producing a 1.1x difference in
output. The word counts are 21, 24, 25, 25.

---

## 3. Why the budget is where it is: it is ANNOUNCED, twice, in two units

There are two caps on this field and they are declared in different places, in
different units, by different mechanisms:

```
the ANNOUNCED cap    "Under 25 words."            interpreter.ts:308, inside the
                     extraction instruction        system prompt the model reads
the ENFORCED cap     180 characters               castingIntent.ts:1202/1207,
                     NOTES_MAX                     applied to the model's answer
```

**A cap the ask announces is not a filter, it is a brief** — this program
measured that on a different surface in August: a reader told *"at most 40
characters"* answered exactly 40 on three of four reads, by cutting a word out
of a phrase, and the consequence written down then was *set the number ABOVE the
measured need rather than at it, or the model spends its budget dropping words
instead of surfaces.*

The production histogram is that finding again (R-a). Of 98 rolls carrying
notes, the maximum word count in the entire product is **25**, and the four
dense rolls sit at 21, 24, 25, 25. **The model is writing to the announced
number.** Nothing in the product has ever asked whether 25 is the right number;
it is the number that was typed.

⚠ **And the two caps have never been checked against each other.** 25 English
words is roughly 150 characters, so the announced brief lands just under the
enforced bound — which is exactly the arrangement that makes overflow rare and
rationing constant. That is the same shape as the two-caps defect found on the
makeup reader (an inner slot cap and an outer sentence budget, neither derived
from the other, four legal answers needing 121 characters of an 80-character
budget). **Naming it is not proposing to move it**: see §6.

---

## 4. The population, measured — and it is FOUR ROLLS, all his

R-a, production, all 209 rolls ever cast:

```
briefs >= 200 characters                    4    (rolls 128, 129, 206, 208)
briefs >= 100 characters                    7
briefs <  100 characters                   91   of the 98 carrying notes
```

**Every dense brief in the product is the founder's**, and they are two texts
cast twice each: the 1137-character editorial-portrait brief (128, 129 — 09:20
and 09:35 on 2026-08-01, fifteen minutes apart) and the 553-character
cybernetics brief (206, 208 — a week apart). The ordinary customer brief in this
product is 48 characters and its notes are two words long.

⚠ **Those two timestamps were read WRONG once while this document was being
written, and the repair is worth a line because it is this repository's own
named trap.** The first pass of `_dense-rolls-text-disposable.mts` opened a raw
`mysql.createConnection`, which parses a DATETIME as LOCAL — ten hours early on
this bench — and printed 128/129 as *2026-07-31 23:20*. `scripts/lib/dbConnection.mts`
is the one door precisely for this, `server/scriptConnectionDiscipline.test.ts`
went red on the raw call the moment the suite ran, and the corrected times agree
to the minute with what `interpreter.ts:621`'s own census recorded. **The counts
in this document are unaffected — none of them is a clock** — and every reading
here was re-taken through the door before it was quoted.

**What was lost, read at the rows** (R-b), stated per roll rather than pooled:

```
roll 128  1137 chars -> notes 180, cut mid-word at "…cornrows into fa"
          THE ENTIRE TATTOO DESCRIPTION IS ABSENT. The brief spends ~250
          characters on "extensive black-and-grey ornamental tattoos covering
          most of his chest, shoulders, upper arms and lower neck … dense
          geometric patterns, circular motifs, intricate linework". None of it
          reaches the notes.
roll 129  1137 chars -> notes 180, cut mid-word at "…braids, sha". Same loss.
roll 206   553 chars -> notes 148.  ABSENT: porcelain, gaunt cheeks, the
                                    unsmiling expression
roll 208   553 chars -> notes 165.  ABSENT: porcelain, the unsmiling expression
```

128 and 129 are mode A and they are the pair the product already has on the
record — the guillotine incident that bought the compression re-ask, and the
two rolls the `NOTES_MAX` census counts. **206 and 208 are mode B and they are
new here.** They never came near the cap, so no instrument in the product saw
them.

### 4a. The coupling, which is now arithmetic rather than an argument

`NOTES_MAX`'s park is closed as NOT WORTH IT on an explicit premise (ruled
fable-1431 §1, written into `interpreter.ts:621`): raising the cap *"would
change the outcome for two rolls in three weeks."* Its own closure names the
thing that would falsify it — **the only briefs long enough to be cut are the
ones that describe tattoos, so the cap's population and
`CASTING_BORN_INK_SCOPE`'s population are one population** — and orders the
census re-read BEFORE that flag widens.

This design's reading is that closure's census re-taken from the other side, and
it makes the coupling tighter than the park states:

```
the near-cap population (mode A)         2 rolls   128, 129
the dense population    (mode A + B)     4 rolls   128, 129, 206, 208
the born-ink population                  2 rolls   128, 129   — the same two
```

**The dense population is strictly larger than the near-cap one, and the two
extra members are the mode nobody counts.** So the park's premise (*rare*) is
true of overflow and understates the class by half. `CASTING_BORN_INK_SCOPE` is
`off` on production today (`scripts/lib/productionFlagPositions.mts`, whose own
`why` line already names this coupling), and the day it widens, both modes grow
together.

### 4b. ⚠ The thing born ink does NOT do, read at the code

`statedInk` is a lane, and it works: a brief's ink words land in
`compiledBrief.intent.statedInk` and are minted as library rows
(`bornInkMint.ts`). **It does not reach the eight prompts.** `briefCompiler.ts`
hands `statedInk` back to its caller for the mint and never composes it; nothing
in `cohortPhotorealHuman.ts` reads it. CLAUDE.md says the same thing in product
terms — *a born tattoo is RECORDED AND DISCLOSED; it is not pixels* — and 7b-ii,
the sign-mint that would make it a picture, is not started.

**So on rolls 128 and 129 the tattoos would still have to travel through the
rationed notes**, and they did not arrive. This is the stopped design's §6c law
in a new place — *a lane that silences is not a lane that speaks* — and it is
the strongest argument in this document for the recommendation in §6: **a lane
is only a fix where the lane is also emitted.**

### 4c. One stale sentence found on the way, small and worth a line

`interpreter.ts:649` says *"`characterNotes` and `role` are the ONLY text that
reaches the image model."* That was true when it was written and has not been
true since `c6839ed8` (2026-08-23): `describeHair` now emits `statedCutSentence`
— **her own words for a stated cut** — as a third channel. The sentence is a
docblock rather than a control, so nothing is broken by it; it is named here
because the whole of §6 turns on how many channels exist, and a document that
reasons from a stale count reasons wrongly. Repair belongs to whichever commit
next touches that docblock.

---

## 5. `olive` is carved out here and is NOT part of this design

Ruled fable-1543 §1. Stated so no build folds it in:

```
what happens   "Olive-skinned woman …"        0/3 at the wire, heritage:
                                              [Mediterranean]
               "a woman … with olive skin"    3/3 at the wire, heritage: []
where          the hyphenated form is read as an ETHNICITY, filed into
               `heritage`, and the notes then decline to repeat it
the brief      163 characters, notes 119-122. NOT DENSE. Nothing in this
               document explains it and nothing in this document fixes it
```

It is a two-part vocabulary defect — an inflection hole in `AXIS_WORDS.skin`
(`olive-skinned` splits to `{olive, skinned}`; `a deep tan` fails where `tanned`
passes) and a translation into a neighbouring lane. Its own item, its own court
(~6 drives, ~$0.48), and it does not wait on this one.

---

## 6. The options, priced — and what this report recommends

Five were considered. **This report recommends 1 + 2 together and recommends
against 3, 4 and 5**, with the reasoning for each stated so the countersign can
overturn any of them.

### Option 1 — RAISE THE ANNOUNCED CAP (the two-word edit)

Change *"Under 25 words"* to a number set above the measured need. Serves every
axis at once; no new field, no new sentence, no schema.

```
for      it is the mechanism, not a symptom of it. §3's own banked rule says a
         cap at the measured need makes the model pay in content
against  it moves what reaches the image model on EVERY brief that has more
         than 25 words to say, and context is not additive — this product
         measured a SUBSET of prompt context raising the stage wall twice as
         often as its superset
cost     ~$0.96 to measure (12 drives), plus §8's non-additive arm
coupled  raising it pushes more rolls INTO mode A, which is `NOTES_MAX`'s
         park. The two numbers must move together or the second cuts what the
         first bought
```

### Option 2 — THE LANE, AS THE STOPPED DESIGN SPECIFIES IT

`statedSkin` filled in her own words under source containment, a composer
sentence that SPEAKS it, and the `AXIS_WORDS.skin` deference repair, all landing
together. Unchanged from `CASTING_V2_STATED_SKIN_LANE_DESIGN.md` §5.

```
for      a lane is not rationed and not paraphrased: it is filled from her
         sentence and read by the composer directly. `statedHair` is the
         existing proof (bald 1/3 -> 4/4 after `c6839ed8`)
against  it fixes ONE axis. §4's losses include tattoos, an expression and a
         bone-structure phrase; a lane per fact does not scale
cost     one system-prompt field + one composer sentence + the deference walk;
         court in §8
```

**Why both and not either.** Option 1 raises the budget for everything and
proves nothing about any particular fact; option 2 takes one fact off the budget
entirely and leaves the rest rationed. The dense population loses facts from
several axes at once (§4), so **the honest shape is: take skin off the budget,
and measure whether the remaining budget is the right size.** They are also
separable at the countersign — either can be ruled alone.

### Option 3 — RAISE `NOTES_MAX` — NOT RECOMMENDED, and it is already closed

It addresses mode A only. Rolls 206 and 208 never touched 180. Its park is
closed on a measured premise and this design does not re-open it — **it
re-states the trigger**: the census is re-read before `CASTING_BORN_INK_SCOPE`
widens, and this document is half of that re-read taken early.

### Option 4 — TELL THE SUMMARISER WHAT TO KEEP FIRST — NOT RECOMMENDED

A priority instruction (*keep stated colours and markings before bearing and
expression*). Cheap, and it puts the rule on the sentence rather than after it.
Rejected as a primary because it is still a rationing rule: it decides which of
her facts to lose, and the product has no basis for that ranking. **Worth
keeping as a fallback if option 1's court says the budget cannot move.**

### Option 5 — REPAIR THE NOTES IN CODE — NOT RECOMMENDED

Append a missing stated word to `characterNotes` after the fact. It makes a
second author of a field the interpreter owns, and it competes for the same
180 characters with the facts that DID survive. Carried over from the stopped
design's §5 unchanged.

---

## 7. The acceptance arm, and the reason this redesign exists

The stopped design was stopped because its arm could not go red: built on
*porcelain survives after the build*, it would have gone green against a tree
where the word already survives 3/3 on an ordinary brief.

**The red reading is already in hand and it was bought before this document was
written.** On the founder's own 553-character brief, on tree `16f1ba79`, clean:

```
"porcelain" present in all eight compiled prompts     0 of 2   (R-c, arm A)
the same phrase in a 190-character brief              3 of 3   (R-c, arm B)
```

and at production, on two real paid rolls a week apart (R-b): *porcelain* absent
from the notes both times.

So the arm is:

```
SUBJECT      the dense brief, and only the dense brief. A plain brief is the
             NEGATIVE control and must stay at 3/3 — a fix that helps the dense
             case by hurting the plain one is not a fix
RED TODAY    0/3 on the dense arm, on the tree under test, before any build.
             This is asserted rather than assumed: the run refuses to report a
             green if its own before-side did not go red
GREEN AFTER  3/3 on the dense arm, 3/3 still on the plain arm
UNMOVED      the ten unmoved words, IN THE SAME RUN, and `characterNotes`
             length + `notesOverflow` per drive. A fix that shortens the notes
             is a FINDING, not a saving
TREE-STAMPED every run records the HEAD sha and whether the tree was dirty, in
             the log and in the JSON (fable-1503 §1's added condition)
```

⚠ **The fixture trap, carried forward from the stopped design's §7 because it
applies unchanged.** A word the HOUSE can also say cannot test whether the
customer was heard: `freckled` and `sun-weathered` are in `SKIN_CHARACTERS`
(`shared/castingRealization.ts`) and can enter a prompt without the customer.
The tone subjects are `porcelain`, `olive`, `sallow`, `ruddy`; the character
subjects are `lined`, `scarred`, `pockmarked`.

⚠ **And a trap this redesign adds, which is the reason it is a redesign.** The
dense arm must be dense **for the reason under test** — many facts competing for
one budget — and not merely long. A 553-character brief padded with filler is
not a dense brief; the four production briefs are dense because every clause
names something photographable. **The subject briefs are the founder's own two,
verbatim, plus at most one written to match their fact density**, and the
density is stated as a count of photographable clauses rather than as a
character length.

---

## 8. The court, priced — with the multiplication done

The stopped design's price was signed wrong by 2.1x because *"~$1.80"* was one
side wearing the whole court's name. The arithmetic is written out here.

Measured unit cost: **$0.080 per drive** (2 openrouter calls, ~15,262 in /
4,949 out, counted off the census against the model's published price).

```
STAGE 1 — does the fact survive on a dense brief
  3 subject briefs x 3 drives = 9 per side, before AND after      18 drives
  the plain negative control x 3 drives, both sides                6 drives
                                                                 ---------
                                                                  24 drives   $1.92

STAGE 2 — did anything else move
  the ten unmoved words: counted in stage 1's own drives                       $0.00
  the cohort wall + notesOverflow + a no-skin brief, both sides    12 drives   $0.96
                                                                 ---------
  STAGE 1 + 2                                                     36 drives   $2.88

STAGE 3 — at the frames                            160 credits + his eyes
  NOT authorized here and not part of this ask. §6's second risk is about a
  PICTURE and law 9 says no reader closes it. Staged behind 1 and 2 passing.
```

⚠ **If option 1 is ruled alongside option 2, stage 1 doubles** — the cap raise
and the lane are two different afters and pooling them measures neither. That is
**24 more drives, $1.92**, and it is the honest reason to ask whether the two
should be courted in sequence rather than together.

**The balance check belongs to the sitting that runs it, not to this document**:
the openrouter balance is thin and its figure is quoted fresh at dispatch, never
from a constant.

---

## 9. What the census says: NOTHING, and it is the same structural gap

The queue's rule (fable-1315 §3) is that no design report is countersigned
without citing the census rows it extends or the census saying the capability is
absent. **It is the second, for the same structural reason the stopped design
recorded: the census drives `refineCandidate`, and this is the ROLL road.** Not
one of its rows compiles a brief, and its first law — the corpus must never
spend — forbids a row that buys an interpreter call in the shape it has today.

The instrument that sees this class is the brief-fidelity corpus
(`scripts/_brief-fidelity-corpus-disposable.mts`), and it is what this court
drives. **A brief-road arm for the census is a real card and it is still not
this one.**

---

## 10. Open questions for the countersign

1. **Is the SUBJECT accepted as dense briefs rather than colour words?** This is
   the whole redesign. Recommendation: yes — §2's equal-length arms and §4's
   four rolls are the case, and the old subject is refuted by its own before-run.
2. **Option 1, option 2, or both?** Recommendation: **both, courted in
   sequence** — the lane first (it is the shape already argued and its arm is
   sharpest), the cap second (it is one edit and its risk is the widest). A
   ruling for either alone is coherent and this report does not need both.
3. **If option 1 is ruled, what number?** This report deliberately does not
   propose one. §3's rule says *above the measured need*, and the measured need
   is unknown — the model has never been allowed to exceed 25 words, so the
   product has never seen what a dense brief would say with room. **The first
   drive of that court is the reading, not the fix.**
4. **Does the `NOTES_MAX` park re-open here, or stay closed with its trigger
   re-stated?** Recommendation: **stay closed, trigger re-stated** — mode B is
   the subject and the cap does not touch it. §4a is filed as half of the
   re-read that park already owes.
5. **Does this build before the founder's framing gate?** The stopped design
   asked this and its answer was *design now, build after his look*. The gate is
   still open (his flagged rolls have not been cast — verified at production
   this sitting: zero candidates carry a kept original). Recommendation:
   unchanged — **this is a prompt change on the surface he is about to
   photograph**, so it courts and builds after his framing verdict, and the
   court's text stages are safe to run before it because they buy no picture.
6. **Is `olive` (§5) confirmed as a separate item?** Recommendation: yes, ruled
   fable-1543 §1, ~$0.48, and it does not wait on this.

---

## 11. What this report decides: nothing

No field is added, no instruction is edited, no cap is moved, no flag exists,
and no credit or dollar is committed. The two disposable readers it was written
on are read-only and free. It exists so the first build of 3c starts from a
subject that survived its own measurement — which is what the stop at fable-1539
bought and what this document is spending.
