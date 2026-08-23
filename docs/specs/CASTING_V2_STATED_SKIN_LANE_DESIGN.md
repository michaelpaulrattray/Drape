# A STATED SKIN LANE — §10 item 3c's design report

**Status: FOR COUNTERSIGN. Nothing here is built.**
Ordered fable-1477 ASK 2 (*"a stated-appearance brief lane, designed AFTER the
hair assert proves the pattern"*), re-endorsed fable-1499 §3 (*"3c's build still
wants its design report and countersign before any prompt change —
context-is-not-additive is measured here, so no lane joins a prompt on a shift's
judgement"*). Written 2026-08-24, opus-1150, against the code and the census
rather than from recollection.

---

## 1. The complaint, in one sentence

**A customer types a skin colour into a brief and it reaches the picture about
one time in three, while everything else she typed reaches it every time.**

The brief-fidelity corpus (opus-1128, ordered fable-1473) drove eight briefs
through the real entrance and counted survival as *present in ALL EIGHT compiled
prompts* — because "reaches the image model" is a claim about the string that is
sent, never about a field near it (invariant 5):

```
porcelain    1 of 3      olive        1 of 4          ← colour names
ruddy        4 of 4      freckled     4 of 4
gaunt        4 of 4      laugh lines  4 of 4
nose stud    4 of 4      glasses      4 of 4          ← a FILLED LANE, 8/8 twice
```

**The shape is the finding.** A word with a lane the interpreter fills reaches
every prompt. Everything else is a lottery run by a summariser — and what the
summariser loses is COLOUR NAMES, while texture and feature words come through
every time.

---

## 2. Why, read at the code rather than inferred

Four links, each opened:

1. **The interpreter's schema has no skin field.** `interpreter.ts:265` declares
   `statedHair`, `statedAccessories`, `build`, `heritage`, `energy`, `ageBand`
   and no skin lane of any kind. A skin fact typed into a brief has nowhere to go
   but `characterNotes`.
2. **`characterNotes` is a summary.** It is written by a model asked to compress
   the brief to a 180-character line, so every specific word is at the mercy of a
   paraphrase — and a paraphrase normalises *porcelain* to *pale* without
   dropping any meaning it can see.
3. **Nothing else in the roll prompt states a tone.** `skinTone` does not exist
   on the roll road at all: it appears only in `facetCards`, `subjectCards`,
   `faceScan`, `referenceSlotCatalogue` and `changeAmplitude` — the REFINE side.
   (fable-1477 owns this correction; verified again here by grep.) The roll's
   only authored skin line is CHARACTER, not colour — `realizedAxes.ts:603`,
   picking between `plain`, `lightly freckled`, `freckled`, `a beauty mark`,
   `visibly textured` and `sun-weathered`.
4. **So the tone falls to the heritage block**, which says *"when the description
   does not state them, eye colour, hair colour and skin tone belong to this
   specific person and follow plausibly from their heritage and age"*
   (`cohortPhotorealHuman.ts:504`). That instruction is CORRECT and it is doing
   its job. The defect is upstream of it: **a tone the customer stated becomes a
   tone the engine inferred, and nothing anywhere records that it happened.**

This is the bald incident's mechanism exactly, one axis over. His roll came back
eight of eight with hair on a brief whose first word was *Bald*, because the
summary dropped it and nothing else in the prompt said it. The premise that had
been written down twice in that file — *"the user's own words carry it through
the role and character fields — the path that has always worked"* — rested on a
channel measured at 33%. **The same premise is load-bearing for skin today, and
it has now been measured at 25–33% on the two colour words we have driven.**

---

## 3. ⚠ AND A SECOND DEFECT, FOUND WHILE WRITING THIS — the deference vocabulary
## has an inflection hole and no colour words at all

`statedAxis("skin", brief)` is the gate that decides whether the engine stands
down and stops authoring skin character. It is a word-list membership test over
`AXIS_WORDS.skin` (`cohortPhotorealHuman.ts:1570`), and the whole list is:

```
freckle freckles freckled acne scar scarred birthmark mole beauty
pockmarked weathered complexion skin blemish blemishes
```

**Not one colour or tone word is in it.** Driven at the real function, twelve
ordinary ways a brief states skin (`scripts/_skin-axis-probe-disposable.mts`,
free, no model):

```
STANDS DOWN   "Bald male, mid-40s, pale porcelain skin, heavily weathered."
STANDS DOWN   "an olive complexion"
STANDS DOWN   "deep brown skin, close-cropped hair"
STANDS DOWN   "tanned and freckled"
STANDS DOWN   "porcelain skin"
STANDS DOWN   "she has a scar on her cheek"
engine authors  "a ruddy man in his fifties"
engine authors  "olive-skinned, mid-30s"          ← the word `skin` is INSIDE it
engine authors  "she is very fair"
engine authors  "a sallow office worker"
engine authors  "a woman with a deep tan"         ← `tanned` is listed, `tan` is not
engine authors  "porcelain"
```

**Six of twelve.** Two of the six are pure inflection holes — `olive-skinned`
splits to `{olive, skinned}` and `skinned` is not listed; `a deep tan` fails
where `tanned` passes. That is the same class `validInContext` solved one file
over with an `INFLECTIONS` walk, and it is the drift the typo gate's own docblock
warns about: *"a second list that is supposed to mirror a vocabulary will drift
from it."*

**What it costs today is small and real, and it is NOT the tone.** The authored
line is skin CHARACTER, so the consequence is that a brief saying *"a ruddy man"*
can be handed `SKIN CHARACTER: freckled skin` on top of her word, and the
`resolvedIdentity` record keeps that fabricated character
(`briefCompiler.ts:604` nulls `skinCharacter` only when the axis says stated —
D-88's own rule, which is right and is simply not firing here).

⚠ **It is filed here rather than fixed** because the two are one design: a lane
that speaks and a gate that stands down are the two halves of the same
transaction, and widening the deference list ALONE would make the engine quieter
about a fact that still is not being said. **That is strictly worse than today**
— it is `statedHair`'s original defect, the one the bald commit named in a
sentence this program should keep: *a lane that silences is not a lane that
speaks.*

---

## 4. ⚠ What the census says: NOTHING, and that is structural

The queue's rule is that no design report is countersigned without citing the
census rows it extends, or the census saying the capability is absent
(fable-1315 §3). Here it is the second, and the reason matters more than the
answer:

**The census drives `refineCandidate`. This is the ROLL road.** Its 62 rows put
canonical customer sentences to the refine entrance; not one of them compiles a
brief. So the census's skin rows — `skin.tan` (*"give her a deep tan"*,
`skinTone`, would-render) and `mark.freckles` — are about the EDIT surface and
say nothing whatever about whether a brief's words survive into a roll.

So the census cannot see this class at all, the way it cannot see a render
dropping a feature (§10 3b's own note). **A brief-road arm for the census is a
real card and it is NOT this one** — it would need a corpus of briefs, and every
row would spend an interpreter call, which the census's own first law (*the
corpus must never spend*) forbids in its current shape. Named here so the gap is
on the record rather than rediscovered.

The instrument that DOES see it is the brief-fidelity corpus
(`scripts/_brief-fidelity-corpus-disposable.mts`), and it is the one this
design's court runs.

---

## 5. The proposal

**Shape A — the hair pattern, unchanged.** A `statedSkin` lane the interpreter
fills IN HER OWN WORDS under source containment, and a composer sentence that
SPEAKS it. Two halves that land together, because the interpreter half alone
fills a field that moves nothing a customer can see, and the composer half alone
has nothing to say.

```
interpreter   "statedSkin": { "tone": string | null, "character": string | null }
              tone       the colour or complexion in her word — "porcelain",
                         "olive", "deep brown", "ruddy", "sallow", "a deep tan"
              character  what the skin DOES — "weathered", "freckled", "lined",
                         "scarred". Null unless she said it.
              USE ONLY WORDS THAT APPEAR IN THE BRIEF — the identical clause
              `statedHair` and `statedAccessories` already carry, so a paraphrase
              is dropped rather than emitted and a null is better than a guess.
composer      ` SKIN: <her word> — exactly as described.`
              emitted ONLY when the lane is filled; absent, every caller behaves
              exactly as it does today (strictly additive, the bald fix's own
              property).
deference     `AXIS_WORDS.skin` gains the tone vocabulary and an inflection walk,
              so the gate stands down on the same facts the lane now speaks.
record        `statedBiology.skin` already nulls `skinCharacter` when the axis
              fires; with the gate fixed that starts working on the six briefs
              above, which is D-88 doing what it was written to do.
```

**Why two sub-fields and not one.** `tone` and `character` fail differently and
the measurement says so: `ruddy` and `freckled` already survive 4/4 while the
colour names do not, so folding them into one field would put a word that works
at the mercy of a change made for a word that does not. It also keeps
`statedSkin` parallel to `statedHair`'s per-part shape, which D-79 bought with a
real incident (the unit of *said* is the FACT, not the axis).

**Why not the two cheaper things.** Both were considered and neither is
recommended:

- *Tell the summariser not to normalise colour words.* One instruction, no field,
  no composer change — and it hands the fix to the same summariser that is
  already dropping the word two times in three. **Put the rule on the sentence,
  not after it** (banked memory: deterministic code after a flaky parse just
  moves the coin flip).
- *Repair `characterNotes` in code — if a skin word from the brief is missing,
  append it.* This is worse than it looks: `characterNotes` is capped at 180
  characters and already compresses, so appending competes with facts that DID
  survive, and the repair would be a second author of a field the interpreter
  owns. A LANE costs the notes nothing.

---

## 6. ⚠ The risk this design exists to be judged on: context is not additive

The measurement is in the bank and it is this product's own: **a SUBSET of prompt
context raised the stage wall twice as often as its superset.** A new field in a
~13k-token system prompt is not a free addition, and neither is a new sentence in
the image prompt. The two are separate risks and the court has to separate them:

```
the SYSTEM prompt   one more field in the interpreter's schema. Risk: the
                    interpreter's behaviour on everything ELSE moves — a lane
                    that steals words from `characterNotes`, a cohort verdict
                    that flips, a `notesOverflow` that starts firing.
the IMAGE prompt    one more sentence, only on briefs that state skin. Risk:
                    the engine over-weights a stated tone and flattens the eight
                    candidates, or the sentence contradicts the heritage block.
```

**The bald fix's own non-additive check is the model to copy**: it counted ten
OTHER words across the same drives and required them unmoved inside noise, in the
same run, rather than in a separate one.

### 6b. `NOTES_MAX` — the coupling, answered rather than assumed

`characterNotes` is capped at 180 characters and a roll that overruns is
counted (`notesOverflow`), re-asked for a compression, and — before that
counter existed — silently `.slice`d mid-word, which cost two production rolls
their whole ink description and produced masters with no tattoos.

**This design adds NOTHING to `characterNotes`, and that is deliberate rather
than incidental.** `statedSkin` is a sibling of `statedHair`, not a contributor
to the notes: it is filled from her sentence, checked against it, and read by the
composer directly. The instruction that ships with it must therefore carry
`statedHair`'s own clause verbatim — *THIS IS IN ADDITION TO, NEVER INSTEAD OF,
"role" and "characterNotes"* — because the failure mode a new lane invites is the
interpreter treating the lane as the place the fact now lives and dropping it from
the summary. **That would be a net LOSS on any road that reads the notes and not
the lane**, and it is the same shape as tonight's 3b lesson one road over: a fix
that stops saying something is only safe where something else carries it.

So the court's stage 1 counts `characterNotes` length and `notesOverflow` on
every drive, before and after, and a lane that shortens the notes is a FINDING
rather than a saving.

⚠ **And the near-cap population is now spoken for**: the only two production
rolls whose notes ever came near 180 are the two that describe tattoos
(opus-1068 §5), which is why `CASTING_BORN_INK_SCOPE` widening re-opens the
`NOTES_MAX` park. A skin tone is two or three words, so this lane does not join
that argument — **but it is the second thing to point at that cap, and the next
one makes three.** If stage 1 shows the notes moving at all, the cap's census is
re-read in the same sitting rather than later.

### 6c. The `statedHair` lesson, answered up front

The lane that already exists failed for a year in a way this one must not repeat:
**`statedHair` was a SUPPRESSION SIGNAL. It stopped the engine authoring a cut
and never said what the cut was** — right about authoring, wrong about silence.
Its carve-out even told the interpreter *not* to fill `cutLength` for exactly the
briefs that needed it most, so his bald cast came back with hair.

The two halves of this design exist because of that, and neither ships alone:

```
the lane SPEAKS      the composer emits her word. Without this half, filling
                     `statedSkin` moves nothing a customer can see and buys a
                     quieter engine on a fact nobody states — strictly worse
                     than today.
the gate STANDS DOWN `AXIS_WORDS.skin` widened so deference fires on the same
                     facts. Without this half, her word and an authored skin
                     character are in the prompt together.
```

The acceptance arm for that is not a unit test of either half: it is the survival
count at the wire with the OTHER half sabotaged, both ways round.

---

## 7. The court, priced

The reading budget is a shared production resource and it is thin (see §10 3d's
priced park), so this is staged and the first stage is decisive on its own.

```
STAGE 1 — the lane speaks                        ~24 drives   ~$1.20
  4 briefs stating a tone, before and after, 3 drives each.
  PASS: the tone word is present in all eight prompts, 3/3, on every brief.
  AND the ten unmoved words stay unmoved — the non-additive check, in the
  SAME run, because a separate run measures a different day.

STAGE 2 — the doors did not move                 ~12 drives   ~$0.60
  the cohort wall, `notesOverflow`, and a no-skin brief driven before and after.
  This is the arm that would catch the system-prompt risk, and it is the one
  a shift is tempted to skip because stage 1 already passed.

STAGE 3 — at the frames                          160 credits + his eyes
  ONE roll, and it is not optional: §6's second risk is about a PICTURE, and
  law 9 says no reader closes that. Staged separately and NOT authorized here.
```

Stage 1 + 2 is **~$1.80 at the measured $0.080 a drive**, which the balance can
carry where 3d's ~$3.80 cannot.

⚠ **A fixture whose word the house can also say cannot test whether the customer
was heard** — the bald court's own hardest-won lesson, and it applies directly:
`freckled` and `weathered` are in the ENGINE's own authored vocabulary
(`skinWeights`), so a brief using them can pass a survival arm through the
house's own sentence. **Stage 1's briefs must state tones the engine never
authors** — porcelain, olive, sallow, ruddy — and the arm must be the one that
went red against working code before it went green.

---

## 8. Open questions for the countersign

1. **Does this build at all before the two-paths flip?** It touches the roll
   prompt, which is the surface the founder is about to look at. My
   recommendation: **design now, build after his look**, because a prompt change
   landing under a founder gate is the *work about the wrong thing* risk
   fable-1497 §4 already ruled on for item 8.
2. **Two sub-fields or one?** Recommendation: two, for the reason in §5.
3. **Does the deference repair (§3) ship WITH the lane or before it?** My
   recommendation is WITH, and only with — alone it makes the engine quieter
   about a fact still not being said, which is strictly worse than today.
4. **Is stage 3 (one 160-credit roll) part of this item or a separate ask?**
   Recommendation: separate, staged behind stages 1 and 2 passing, so no credits
   are committed on a design that might not survive its own text court.
