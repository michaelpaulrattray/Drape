# The horns court — design, pre-registered

*Written 2026-08-14 by the executor, BEFORE the first call, per fable-517.
Budget: **$20 of house money, hard cap**, spend stated per court. No founder
credits, no ledger rows, no writes to any table.*

---

## 0. Which registry horns belongs to — a design output

**Horns are a SUBJECT-shaped kind, not an accessory.** Three registrations if
promoted: a subject card, a facet card, a catalogue feature.

The accessory table is for objects **worn at a landmark**, and every one of its
entries carries a `vacantPhrase` — the sentence that says the site is bare
("no earrings — both earlobes bare"). Horns do not sit at a landmark and are not
taken off; per `openKindPolicy`'s own answer for an open kind, removing one is
*the recipe not carrying it*, because it was never in the master. A kind whose
removal is subtraction from the recipe rather than a vacancy on the face is a
subject, and the catalogue is where its slot would live.

That classification is what the courts below are measuring the price of. If
delivery fails, the classification is moot and horns stay a demand-table row
with a measured reason.

---

## 1. The status-quo arm, and what it means to beat it

**Today's status quo for horns is an honest refusal.** The open lane reads
*"give her horns"*, finds no stage word (measured: it re-claims 3/3), and
answers *"Refining can't do horns yet — it isn't one of the things this can
name."* Nothing is charged and nothing is wrong.

So the arm to beat is not a bad render. It is **a refusal that is never wrong,
costs nothing, and is honest.** A carrier arm beats it only by delivering at a
rate worth charging for — the D-236 bar, **95% per class and zero false
passes** — because anything less means a customer paying for a picture that
does not have horns in it, which the refusal never does.

This is the strictest status-quo arm any court in this program has had, and it
is stated here so no later reading can soften it.

---

## 2. The courts, in order, with their bars written before the first call

### Court 1 — DELIVERY (runs first; everything else depends on it)

*Composed exactly as the recipe assembler would if horns were a subject —
master, plus a horns clause in her words — and driven at the repaint engine.
Nothing is promoted to run it.*

| arm | what it is |
|---|---|
| `refusal` | **status quo.** The shipped interpreter, driven on *"give her horns"*. Delivers nothing, charges nothing, is never wrong. |
| `words` | the master plus a horns clause, no carrier. What a newly promoted subject would get on day one. |

**Negative control (the floor):** three renders of the same face with an
UNRELATED ask and no mention of horns, read by the same judge. If the judge sees
horns there, the judge is the instrument at fault and the court refuses before
judging anything.

**Pre-registered bars**

```
delivers            words arm delivers horns on >= 95% of renders (D-236)
never-false-passes  the judge reports ZERO horns on the negative control
judge-can-say-yes   the judge reports horns on at least one arm render
                    (a reader that cannot say yes proves nothing by saying no)
```

**Reading:** 6 words-arm renders + 3 negative-control renders, each judged by a
narrow vision question with D-235's asymmetry — an affirmative needs a `saw`.

**Estimated house cost:** 9 renders × $0.099 + 9 judge reads × ~$0.01 + 6
interpreter calls × ~$0.01 ≈ **$1.05**.

**A PASS admits:** horns may be asked for at all. A FAIL ends the run and horns
stay a demand-table row with a number beside them.

---

### Court 2 — DETECTION (second, because it is cheap and it gates the panel)

*Can a segmenter find horns on a frame that has them, and answer nothing on a
frame that does not?*

| class | frames |
|---|---|
| worn | the delivery court's own passing frames (free — already rendered) |
| visibly bare | the negative control's frames (free — already rendered) |
| not visible | one render with horns asked for and the head turned away |

**Pre-registered bars**

```
finds-when-worn     coverage above the per-frame floor on >= 95% of worn frames
silent-when-bare    ZERO answers above the floor on visibly-bare frames
floor-is-measured   the floor is read from these frames, never inherited from
                    another kind's court
```

**Estimated house cost:** 1 render + ~16 segmenter reads ≈ **$0.19**.

**A PASS admits:** the detector may be ARMED, and the panel may draw a horns
row. A FAIL means the panel says nothing about horns, which is what
`deferArming` already does for earrings and is honest.

---

### Court 3 — SURVIVAL (third, and the expensive one)

*Ask for horns, then ask for something else entirely. Are they still there?*

| arm | what it is |
|---|---|
| `words` | **status quo for a carried kind.** The horns clause restated in the second render's recipe, no crop. |
| `crop` | a minted crop of the horns from the first frame, carried as a reference. |

**Floor:** two renders of one face with an unrelated ask, measuring the wobble
that is not the horns.

**Pre-registered bars**

```
survives            horns present after the unrelated edit on >= 95% of renders
identity-held       the face's own reading does not move more than 3x the floor
                    (a carrier that keeps horns and changes her is not a pass)
```

**Estimated house cost:** 3 first renders + 6 chained renders + 3 mints ≈ 12
renders × $0.099 + ~30 reads × $0.005 ≈ **$1.34**.

**A PASS admits:** horns may be CARRIED — which is what lets a later edit keep
them. A FAIL means horns are words-only, stated rather than discovered.

---

### Court 4 — REMOVAL (last; only a question once horns exist)

*"Take the horns off." Does the frame come back without them?*

| arm | what it is |
|---|---|
| `drop-the-carry` | **status quo for an open kind**, per `openKindPolicy`: the recipe simply does not carry them, and the master repaints without horns because it never had any. |
| `vacate-phrase` | an explicit absence sentence, the accessory road. |

**Pre-registered bars**

```
gone                the judge reports NO horns on >= 95% of removal renders
no-hole             the judge reports no artefact where they were — the
                    "ghost rim" class, asked as its own question
```

**Estimated house cost:** 6 renders + 6 reads ≈ **$0.66**.

**A PASS admits:** `departable: true` on the horns card — measured rather than
declared.

---

## 3. The whole run, priced

```
delivery    ~$1.05     9 renders
detection   ~$0.19     1 render + 16 reads
survival    ~$1.34    12 renders + 30 reads
removal     ~$0.66     6 renders + 6 reads
                      ----------------------
total       ~$3.24    against a $20 cap
```

**The design does not need more than the budget.** If a court's floor refuses,
the courts after it do not run and the spend is lower still. Every figure is
stated per court in the report, and the bench kit's ledger watch throws if any
user credit moves.

---

## 4. Where the verdicts file, if horns pass

Per V1's pattern, on the cards a promotion would create:

```
delivery + survival + removal   the horns SUBJECT card
detection                       the horns REGION card ("horns")
the readings themselves         beside them, as the lips phrasing rides its
                                region — floor, signal, per-arm numbers, date,
                                specimen
```

A promotion whose evidence lives in a shift report is a promotion nobody can
re-check.
