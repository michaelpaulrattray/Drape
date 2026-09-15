# #242 RE-MEASURED ON THE ROAD THAT REPLACED IT — AND IT DOES NOT REPRODUCE

**2026-09-15, foreman-20260915-1205 (background, casting upkeep).**
**24 Re-imagine presses · estimate ~$0.40 · ACTUAL $0.0694 indicated · no credit, no render, no row.**

Predecessor record: `AUTHOR_SELF_NARRATION_READING_2026-08-30.md` (the MAX road).
Instrument: `scripts/_242-reimagine-drive-disposable.mts` (new) +
`scripts/_shift110-selfnarration-census-disposable.mts --drafts` (the one cue list, extended — §4).

---

## 1 · WHY THIS RUN EXISTS: THE CARD WAS MEASURING A ROAD THAT NO LONGER RUNS

#242 was filed 2026-08-29 against **the MAX author at roll time**. Two things
happened to it and **neither reached the card's body**, so three consecutive
shifts re-read a body that was false in two independent ways:

1. **Its hypothesis was measured and INVERTED on 2026-08-30** (`c792d07f`, 24
   paid MAX calls). The card asks whether the author narrates its own
   *compliance*; the drive found the finished seed — the card's own
   highest-prior cell — produced **zero in five drafts**, and that the real
   class is the author narrating what it is leaving **OPEN**. The card's
   proposed fix (ban `no invented` / `no new` / `not add`) was measured a
   false-positive generator and **nothing shipped**.
2. **Its road was DELETED on 2026-09-06** by #535 / PR #598 (`ce886cac`). There
   is no author call at the roll any more — `briefCompiler.ts:1322` *"NO TEXT
   CALL HAPPENS HERE SINCE #535"*, `promptAuthor.ts` header *"THE MAX AUTHOR IS
   GONE FROM THE ROLL ROAD"*. The author survives as a **visible press on the
   brief box** (`reimagine.ts`).

A comment of 2026-09-05 re-pointed the card at the new author *"when it
exists"*. It has existed for nine days and nobody had measured it.

⚠ **AND THE CARD'S CHEAP ROAD IS CLOSED ON THIS ONE.** #242 says *"a census
over production rows is a read, not a drive"* — true of MAX, whose drafts
landed in `register.content`. The Re-imagine procedure
(`server/routes/castingV2.ts:1396-1415`) returns the text to the box and
**persists nothing** — an explicit projection under invariant 8, deliberately.
**So there is no population to read and a drive is the only instrument left.**
That is a permanent property of the new road, not a gap.

---

## 2 · THE RESULT

Same three seeds as 2026-08-30, byte for byte, so the road is the only variable.

| | MAX road (2026-08-30) | **Re-imagine road (today)** |
|---|---|---|
| drafts read | 23 | **24** |
| **confirmed self-narration** | **4 (17%)** | **0** |
| worst cell | **thin, 2 of 6** | **thin, 0 of 8** |
| first drafts refused by our own guards | 13 of 24 (**54%**) | **3 of 24 (12.5%)** |
| presses lost entirely | 5 of 24 (**21%**, and *silently* — see §3) | **0** |

Per cell, all eight presses returning an idea in every cell:

```
A-sphinx     presses 8  idea 8  re-asked 1  nothing 0  avg 100 words
B-finished   presses 8  idea 8  re-asked 1  nothing 0  avg  94 words
C-thin       presses 8  idea 8  re-asked 1  nothing 0  avg  86 words
```

**The worked comparison, same seed, same cell, one road apart.** The old road's
`C-thin-4` — the draft the 2026-08-30 cue list *missed*, and the one that named
our own pipeline to the image engine:

> *"Jewellery, where it appears, reads as dark metal and old stones rather than
> sparkle — **left to the engine** rather than fixed."*

Today's drafts on that same seed say the same thing as picture content:

> *"Jewellery is old silver, tarnished, personal, not decorative filler."*
> (`C-thin-0`)

### The one flag, and it is a detector artifact — read at the sentence

`A-sphinx-4` tripped the cue `invented`, on the substring inside **re**invented:

> *"**Wardrobe reinvented as** dark, structured plating that reads ceremonial
> rather than martial, its bronze and gold surfaces worked with fine inlay…"*

That is a description of the wardrobe, not a negative instruction to the engine
and not a pipeline object. It is a faint register wobble (*reinvented* is a word
about authoring) and it is **not** the defect #242 describes. Counted as **0
confirmed, 1 upper-bound**, because the cue list is declared over-broad and the
classification is a reading, not a count (law 9 — the detector points, the eye
decides).

### The wider sweep, by hand, past the cue list

The 2026-08-30 record's sharpest warning is that its own *"deliberately
over-broad cue list STILL missed a hit"*. So the 24 drafts were also swept by
hand for every phrase that class can wear — `left to`, `left open`, `left
unset`, `the engine`, `the studio`, `the request`, `the brief`, `the prompt`,
`the customer`, `unstated`, `not named`, `unspecified`, `as asked`, `as given`.

**Zero hits.**

---

## 3 · THE SECOND NUMBER, AND IT IS THE BIGGER ONE

The 2026-08-30 record's stated reason for shipping no fix was **cost of a ban**:

> *"Every ban is a re-ask, and a second failure costs the whole authored draft.
> The static rate is already 21%."*

On the MAX road a double refusal **silently became LOW while the sheet still
said "Max"** — the #252 lie. That is precisely what #535 deleted: on this road
a double refusal returns `nothing`, the customer's own words stay in her box,
and the surface says so. **Measured today: 0 of 24.**

All three re-asks recovered on the second call, and each names a guard working:

```
A-sphinx-2    named "chestplate" — a piece the request never named
B-finished-3  named "collar"     — a piece the request never named
C-thin-5      used "the set"     — NEVER_WRITTEN (set narration, dev roll 95)
```

⚠ **`C-thin-5` is the openness class being caught by an existing guard on the
new road** — the author reached for set narration, `NEVER_WRITTEN` refused it,
and the re-ask produced a clean draft. The mechanism #242 worried about is
present in the model and is already being stopped.

---

## 4 · THE INSTRUMENT, AND THAT IT CAN FAIL

The detector keeps **one** cue list (working law 4); this run extended it rather
than starting a second, **from its own recorded failure** rather than a new
idea. The 2026-08-30 run found the real class is openness narration and
measured those phrases as perfect discriminators (`left to the engine` / `left
to the room` 2 of 2 offending; `nothing named or fixed` / `what is stated` 3 of
3) while its cue list could not see them. Re-measuring with that blind spot
still in would have reproduced the exact hole the last run declared.

Added: `left to the engine`, `left to the room`, `nothing named`, and `left
open` / `left unset` (already `NEVER_WRITTEN`, present as controls on the ban's
reach). **`left to` alone is deliberately NOT a cue** — measured 3 occurrences,
2 offending: *"the OBJECT decides"*.

**Controls, run before any draft is read** (the run refuses and exits nonzero if
they misbehave):

```
positive  CAUGHT via [described, invented, no new, beyond, no softening]
positive  CAUGHT via [left to the engine]  (openness class)
negative  clear  "no soft youthful rounding in the jaw."      <- his own direction
negative  clear  "matte skin, no shine."
negative  clear  "hairless, with a keratin ridge over the brow."
```

**Proven able to fail.** The added openness cue was sabotaged to a
non-matching string; the run printed *"positive MISSED — the OPENNESS specimen
(C-thin-4)"* and **CONTROLS FAILED — refusing to report a census from an
instrument that cannot fail**. Restored from a copy taken before the sabotage,
not from `HEAD` — the restore point matters as much as the control (the
2026-09-15 01:15 shift lost a whole sabotage run to `git checkout --` restoring
from `origin/main`).

---

## 5 · WHY NO CODE CHANGED, STATED PLAINLY

There is no guard in `reimagineRefusal` for self-narration; the rule lives in
the instruction as prose (*"Do NOT write notes about the series or the process …
Write only what the picture should contain"*). That is working law 3's shape —
a rule tested only by a model that usually behaves — and it was the live
candidate for a fix.

**It is not taken, on the measurement rather than on taste:**

1. **The rate is 0 of 24 on this road.** A ban costs a re-ask on every false
   positive, and the only thing the cue list flagged today was a false positive
   (`reinvented`). Shipping it would trade a defect that did not occur against a
   cost that would.
2. **The cue list is measured incomplete by its own record**, so a ban built
   from it catches its own specimens and nothing else.
3. **A prompt change needs a court, not an edit** — *context is not additive*,
   and one clause moves every cast.
4. Any change to the author instruction or its guards is a register/author-spec
   change, which an Opus shift escalates rather than decides.

**Nothing is filed as a new card either.** A residual with a measured rate of
zero and an existing guard already catching the neighbouring class is not a
finding; filing it would be the anti-boredom rule's exact failure.

---

## 6 · LIMITS OF THIS RUN, SAID BEFORE THEY ARE FOUND

- **n = 24, one sitting, three seeds.** A model reply is a coin. Read 0 of 24 as
  a band, not as proof of zero — it rules out a 17% rate comfortably and rules
  out nothing below a few percent.
- **The seeds are the old road's seeds on purpose.** That is what makes the two
  numbers comparable, and it means this run says nothing about seeds no drive
  has used.
- **The detector is over-broad by construction and still incomplete by its own
  record.** The hand sweep in §2 is the backstop, and it is a hand sweep.
- **Drafts land in the customer's visible, editable box.** Even a confirmed hit
  on this road carries a far weaker consequence than on MAX, which put the same
  prose on the wire invisibly. The bar for spending a re-ask to prevent one is
  correspondingly higher.

Drafts, manifest and both logs: `output/_242-reimagine-drive/`.
