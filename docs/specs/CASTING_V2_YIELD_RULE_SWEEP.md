# The yield rule — the sweep, as a list

**THE RULE, named as a class after four instances on one slice** (fable-1670 §5):

> **HOUSE PROSE THAT ANSWERS AN AXIS THE BRIEF ANSWERED MUST STAND DOWN.**

Stated facts pin; defaults fill the unstated; **nothing argues with the
customer.** This repairs TODAY'S product for every account and is independent of
the creative register.

**Status: THE SWEEP, WHICH IS THE DELIVERABLE. No fix is proposed here and none
is built** — fable-1670 §5 ordered the list before any repair, because the yields
are not one shape: some are one suppression like the skin pin, one needs a
different fallback axis entirely, and one is not a suppression at all.

---

## 0. ⚠ How this list was derived, and what its instrument cannot see

`scripts/_yield-rule-sweep-disposable.mts` scans both composing files for every
emitted ALL-CAPS labelled block and reports the guard standing in front of it.
**51 blocks.** It is a regex over a shape, so its limits are stated rather than
discovered:

- ⚠ **THE FIRST VERSION MISSED `PHYSIQUE`, WHICH IS THE MOST IMPORTANT BLOCK
  HERE.** It required the label immediately after the quote, and `describeBuild`
  returns a template literal opening with a SPACE because it is joined onto the
  SUBJECT sentence. One block missing out of forty-two — and it was the one the
  founder's complaint is about. That is CLAUDE.md's own named class (a regex
  standing in for a declaration, reporting a complete list either way), caught
  here only because the finding it was built to confirm was absent from its own
  output.
- ⚠ **The first version also knew ONE yield mechanism and there are THREE**:
  `stated(axis)`, the HAIR deference gate, and `intent.X ?? drawn` precedence. A
  sweep reporting only the first files the other two as *cannot yield*, which is
  the wrong answer in the dangerous direction.
- **It reports EMITTERS, not contradictions.** Whether a stated fact can reach a
  given axis is a judgement about the vocabulary, and every judgement below is
  annotated by hand against the code.
- **It has false positives**: a labelled string inside a DOCBLOCK or a vocabulary
  table scans the same as an emitted block. Those are marked below rather than
  silently dropped.
- **It THROWS on an empty result**, so a shape change cannot make a short list
  read as a clean sweep.

---

## 1. THE FINDING THAT CHANGES THE RULE'S SHAPE — there are THREE failure kinds, not one

fable-1670 §5 named three instances and read them as one kind: house prose
answering an axis the brief answered. **Read at the code, the sharpest of the
three is not that.**

### Kind 1 — HOUSE PROSE ANSWERS AN AXIS THE BRIEF ANSWERED (the named class)

The skin pin was instance one, and it was fixed by a suppression: `SKIN
CHARACTER` stands down when `stated("skin")`.

### Kind 2 — A DEFAULT FILLS AN UNSTATED AXIS, AND THEN A LATER PASS COLLAPSES IT

**`FACIAL HAIR` is here, and it is NOT a yield failure.** Its gate exists and
works: `if (axes.facialHair && !stated("facialHair"))`. His brief never mentions
facial hair, so the gate correctly does not fire and a beard is drawn — the
default filling an unstated axis, which is the design.

**What fails is downstream.** `applySheetTaste`'s twin-breaker uses facial hair
as its FALLBACK axis, reached exactly when the hair rules stand down because the
brief authored the hair. His brief says *"Bald."* — that one word routed his
sheet into the fallback lane. Measured over 2,000 sheets of his brief's shape:

```
                          BEFORE the taste pass      AFTER
short beard                    17.0%                  27.4%
distinct values per sheet       5.27                   4.98
values moved                                          22.8%
on an ORDINARY brief                                   0.0%   (0 of 16,000)
```

**The separation costs more variety than it returns**, and it fires only on
stated-hair briefs. `realizedAxes.ts`'s own docblock names the FEMALE version of
this as a limit it cannot fix; the male version is its mirror and was never
measured.

⚠ **So fable-1670 §6's reconciliation resolves this way: the facial-hair repair
is NOT a yield-rule item.** It is a twin-breaker item, it is graded offline
against the census bar, and it is a different repair from everything else on this
page. It belongs on the list because it looked like a yield item until it was
read.

### Kind 3 — ⚠ HOUSE PROSE EXPANDS A STATED FACT AND ADDS QUALIFIERS THE CUSTOMER NEVER SAID

**This is the sharpest specimen and it is not what anyone thought it was.**

```
his brief    "Intense unsmiling expression."
his prompt   PRESENCE: still and serious — steady, intelligent gaze, composed.
             Grounded, never sullen.
```

That sentence is not a drawn value ignoring him. **It is HIS OWN stated fact,
expanded.** The interpreter read *"Intense unsmiling expression"* and filed
`energy: "grave"`; `resolved.energy` is `intent.energy ?? cycled`, so the stated
value won exactly as it should; and then `ENERGIES.grave` rendered it as
*"still and serious — steady, intelligent gaze, composed. Grounded, never
sullen."*

**The yield worked and the translation argued.** `composed`, `grounded` and
`never sullen` are three qualifiers he did not type, and the last of them fights
`intense unsmiling` directly.

**A suppression cannot fix this.** Standing the block down would delete his own
stated energy from the prompt. What is wrong is the EXPANSION: a closed
vocabulary word carrying a paragraph of house prose that the customer's sentence
never licensed. The candidate repairs are different in kind from kind 1's —
render the stated word plainly, or split each `ENERGIES` entry into the part that
DESCRIBES and the part that QUALIFIES and emit only the first when the value came
from the brief — and both are prompt changes on every cast, so both come to
Fable before anything is built.

---

## 2. THE LIST — every block that describes a PERSON

Structural blocks (`FRAMING`, `CROP`, `BACKGROUND`, `CAMERA`, `LIGHTING`,
`COLOUR`, `REALISM`, `EYES`, `CATCHLIGHTS`, `SCLERA`, `PUPILS`, `LASHES`,
`LIPS`, `BROWS`, `AUTHORITY`) are **out of scope and must not yield** — they are
the sheet, not the person, and `AUTHORITY` says so in as many words. They are
counted in the 51 and not listed again here.

| block | axis | yields today? | can a stated fact contradict it? |
|---|---|---|---|
| `SKIN CHARACTER` | skin surface | ✅ `stated("skin")` | fixed — instance one |
| `EYE COLOUR` | eye colour | ✅ `stated("eyes")` | fixed |
| `BROW CHARACTER` | brows | ✅ `stated("brows")` | fixed |
| `FACIAL HAIR` | facial hair | ✅ `stated("facialHair")` | **gate fine — see §1 kind 2** |
| `HAIR` (×8 sites) | hair | ✅ deference gate | measured working on his *"Bald."* |
| `LOOK` | look | ✅ `intent.look` precedence | locks flat when stated |
| `SKIN FINISH` | skin finish | ✅ brief-beats-archetype | its docblock states the precedence |
| `SKIN` (stated lane) | skin tone | — it IS the pin | — |
| **`PHYSIQUE`** | **build** | ❌ **no yield of any kind** | ⚠ **YES — measured** |
| **`PRESENCE`** | **disposition** | ⚠ yields, then EXPANDS | ⚠ **YES — §1 kind 3** |
| `SUBJECT` heritage clause | heritage | ✅ `intent.heritage` | ⚠ **YES when heritage is EMPTY — measured** |
| `EXPRESSION` (shared) | gaze | ❌ no yield | plausible, unmeasured |
| `EYE SHAPE` | eye geometry | ❌ no yield | **no** — never drawn, so a value here came from the user |
| `MAKEUP` | makeup | ❌ no yield | **no** — the value IS her words |
| `STRUCTURAL FEATURES` · `STATED ACCESSORIES` · `STATED MAKEUP` | — | ❌ no yield | **no** — these are LICENCES for stated facts, the opposite shape |
| `DIRECTION` · `REFERENCE DIRECTION` | role | ❌ no yield | role-derived; unmeasured |
| `SKIN` :1269 · `SKIN CHARACTER` :1623 | — | — | **scanner false positives** — a docblock and a vocabulary table |

### 2a — `PHYSIQUE` is the one clean kind-1 instance, and it is measured

```
his brief    "Severe bone structure with pronounced brow ridge, deep-set eyes,
              hard jawline, gaunt cheeks."
his prompt   PHYSIQUE: athletic build — this is a deliberate casting choice and
             MUST BE VISIBLE IN THE FRAME: a thicker neck, defined trapezius and
             shoulders filling the frame, a firmer jawline.
             Do not default to a slim runway physique.
```

**Two instructions about one body, and the product's is the one written as a
requirement.** Three of his five delivered slices were ordered a thicker or wider
neck and a heavy or defined trapezius.

⚠ **The precedence rule the product already states does not cover this.** The
shared prompt says *"Every fact stated there — sex, age, heritage, build —
outranks the DIRECTION block, the LOOK, the expression whisper."* It names
`build` and it does not name `PHYSIQUE`, which is the resolver's own voice in the
absolute register. So the block that overrides him is the one block the
precedence sentence forgets.

⚠ **AND `Do not default to a slim runway physique` MUST NOT BE REMOVED CASUALLY.**
It exists for a measured reason — a bare build adjective was ignored and a
blacksmith came back with a runway body. Removing it reopens a closed defect.

**The candidate yield: `describeBuild` stands down when the brief describes the
BODY.** That needs an axis word list the way `statedAxis` has for skin, eyes,
brows and facial hair — *gaunt*, *lean*, *heavy*, *broad*, *slight*, *muscular*,
*bone structure*, *frame* — and it is a vocabulary decision, which is Fable's.

### 2b — The heritage clause, and it has a frames-level demonstration already

`heritageClause(resolved.heritage)` renders a drawn heritage when
`intent.heritage` is empty. **Measured at the frames** (court 3 run 1): a brief
saying *"deep dark brown skin"* had the phrase reach 4 of 4 prompts, and six of
seven delivered frames came back medium or light brown, because the interpreter
had written *"mostly Middle Eastern heritage with Western European features"* into
the ABSOLUTE block one paragraph above the skin sentence. **At the frames the
heritage wins.**

That is a kind-1 instance with its evidence already on disk. Its yield is not
obvious — a heritage IS bone, and standing it down leaves the engine's own prior
to fill it — so it is listed and not proposed.

---

## 3. What this list asks for

1. **Fable's word on `PHYSIQUE`'s yield vocabulary** — which words count as the
   brief describing the body. It is a vocabulary decision and the wrong list
   either over-suppresses (a brief saying *"a strong jaw"* silencing the whole
   physique block) or under-suppresses (today).
2. **Fable's word on kind 3** — plain rendering of a stated word, or splitting
   `ENERGIES` into describe/qualify. This shape has no precedent in the product.
3. **A decision on the heritage clause**, which has the most evidence and the
   least obvious repair.
4. **Nothing on `FACIAL HAIR`** — §1 kind 2 moves it to the twin-breaker repair,
   which is graded offline against the census bar.

**Every one of these is a prompt change on every cast in the product**, so
fable-1667's ordinary-population regression bar applies to each, and the likely
landing for anything contested is conditional compilation rather than a global
edit.

## 4. Riding along, per fable-1670 §8

Two copy defects on every slice of every roll, folded into whichever commit
carries the first yield repair: `SUBJECT: A average male` (also `A athletic`,
`A broad`) and a doubled full stop at `approximation..`. They are not yield
items; they are in this document because this is the sweep that read the bytes
they are in.
