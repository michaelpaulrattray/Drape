# V3 — Removal universality: the shape note

*Written 2026-08-15 by the executor, ordered in fable-528 §b. Every claim about
today's behaviour carries the file it was read from; nothing here is from
memory. Nothing is built yet — this note is what gets ruled on before anything
is.*

> **"Anything should be removable… even if she is born with it."**
> — the founder, ruling 2 (fable-393 §2), which also names the current
> three-kind vacate list as *a transitional state rather than an accepted one*.

---

## 1. What removal IS today — three roads, and only one of them is general

| road | what it does | what it needs | who it serves |
|---|---|---|---|
| **PRUNE** | drops the chain step that added the thing | the thing was added by an EDIT, and the picture has arbitrated the match | any subject |
| **VACANCY** | the recipe SAYS the thing is absent | a slot, and a `vacantPhrase` for its kind | 3 accessory kinds |
| **DROP THE CARRY** | the repaint anchors on the pristine master and does not carry it | the repaint road, and the thing arrived through an edit | any repaint-road subject |

**PRUNE** (`refineService.ts:1286`) turns on provenance, not on language: *a
prune can only remove what the chain added*, so the question is asked of the
ORIGINAL candidate rather than of the face she is looking at. Present in the
base ⇒ no amount of pruning takes it off her face. Since run-7 a prune proceeds
only where the picture has arbitrated (`refineService.ts:1298`), which is what
stopped *"remove her glasses"* deleting an earrings step.

**VACANCY** (`refineService.ts:1676`) is the road for a thing the ORIGINAL
photograph already had. The code authors the fact rather than asking a model for
it — `editDelta = { absent: { subject: [noun] } }` — and it becomes a chain step
like any other: durable, undoable, superseded by a later ask on the same
subject. Two things gate it, and both are narrower than the ruling:

- the subject must be **departable** (`subjectCards.ts`, five of twenty-nine);
- the recipe must be able to SAY the absence, and it may not improvise one.
  `repaintAsks.ts:409` refuses `uncatalogued` when a slot's kind has no
  `vacantPhrase`, because *a sentence authored beside an ask is free-floating
  parallel prose and the cost of getting this one wrong is a paid render that
  says something untrue about her face*.

**DROP THE CARRY** is the repaint road's own answer and it is now MEASURED
rather than argued: the horns removal court read **3/3 gone and 3/3 clean on
both roads** — dropping the carry, and an absence sentence on the horned frame
— with every judge naming what it saw instead (*"smooth hairline pulled back, no
bumps"*). No stump, no ghost rim (`docs/specs/V2_HORNS_VERDICT.md` §4).

**And one more, which is not a removal at all:** *bald* is a HAIRCUT
(`cohortPhotorealHuman.ts:1614` — "there is no cut on a bald man"). The
founder's fringe argument is the same shape: a cut with no fringe is a haircut,
not a face with a fringe-shaped hole in it. This is working law 8 and it is why
`hairCut` is deliberately NOT departable.

## 2. Who can actually leave today

Five subjects of twenty-nine are `departable`, and **departable is not the same
as deliverable**:

| subject | asked-for removal today | what is missing |
|---|---|---|
| `statedAccessories` | **works** — 3 kinds, per-instance vacancy, invisible-site note | new kinds (necklace, watch, hat…) — V3(a) |
| `horns` | **works** on the repaint road, measured | nothing; it is never in the master |
| `ink` | **prune only** | `notASlot` — *"OWED, not absent"*: its question comes from the placement, so its slots arrive with the tattoo studio (D-138) |
| `marks` | **prune only** | folds into the `skin` slot; no vacant phrase for a freckle |
| `facialHair` | **prune only** | it HAS a slot and a question, and no `vacantPhrase` — so a beard in the ORIGINAL photograph refuses `uncatalogued` |

The other twenty-four are `departable: false`, for two genuinely different
reasons that V3 must not confuse:

- **A CUT IS NOT A HOLE.** Hair, brows, lashes, facial structure: removing them
  is a different SHAPE of the same feature, and the product already says so
  properly (a fringe is a haircut). These need no vacancy machinery at all —
  they need the extreme class, V3(d).
- **A SURFACE HAS NO ABSENCE.** Skin tone, skin character, build: there is no
  state in which she has no skin. *"Remove the tan"* is a restatement of her
  own colouring, not a departure — and that is exactly where this milestone
  meets the finding below.

## 3. Where V3 meets the skin finding — the worst of both

The tan negative control (`docs/specs/V2_TAN_VERDICT.md`) measured what
`skinTone` costs a live customer today:

```
delivery   PASS 3/3   asking for a tan produces a tan
survival   FAIL 0/3   drift ΔE 10.46 · 10.26 · 7.64 against a 2.78 bar,
                      MOVING further from the master, not fading home
```

So today a tan **cannot be held** (it drifts on every subsequent edit) and
**cannot be removed** (a surface has no absence, and no road files one). A
customer who asks for a tan and changes their mind has no way back except
pruning the step — which works only if the chain added it, and does nothing at
all for skin the ORIGINAL photograph had.

**That pair is the argument for taking skin seriously inside V3 rather than
leaving it to the carrier work**: a fact you can neither keep nor undo is worse
than one you can only keep. The two halves have different owners (the carrier
bench owns holding it; V3 owns undoing it) and one specimen.

## 4. The court every removal class must pass

V2's kit is the measuring stick, and the horns run is the worked example. For a
removal class specifically:

```
REMOVAL      is it GONE, and is the site CLEAN — both arms where both roads
             exist (drop-the-carry, vacate-phrase), n≥3 per arm, every
             affirmative carrying its own `saw` (D-235)
DETECTION    for anything BORN-WITH: the departure floor, measured at the
             boundary it will be judged at. A pair needs BOTH floors or no
             arming — the earring court's union floor sat above two of sixteen
             measured worn sides
INVISIBLE    can the site be seen at all? A removal nobody can see must SAY so
             (`invisibleRemoval.ts`), and that reading is two questions in
             order, never one
SURVIVAL     does the absence hold through an unrelated edit — the same court
             the additions take, pointed the other way. **The library holds
             presence, not absence** is a proved failure mode: a born-worn
             removal lasted exactly one frame before the next step re-anchored
             on the master and painted it back
```

The last row is the one a new removal class is most likely to fail, and it is
cheap to run: one chained edit after the removal, three times.

## 5. The slices, in the review's own order, priced

Prices are from the horns run, which is the only measured precedent: **$3.56 for
four courts on two faces**, of which the removal court alone was **$0.65** and
detection **$1.16**.

| slice | what it is | build | courts | founder gate |
|---|---|---|---|---|
| **(a) new accessory kinds** | necklace, watch, hat… — 2 registrations each by the V1 measurement | small | ~$1.50/kind (removal + detection) | pricing, if any becomes chargeable |
| **(b) the three owed slot stories** | `facialHair` vacancy first, then `marks`, then `ink` with the studio | medium | ~$1.50/class | no |
| **(c) PRUNING derived from the chain** | the word stack derived rather than accumulated — *the largest single build in the program* | large | no new court; the existing arbitration tests | no |
| **(d) the extreme class — bald** | inverts every completeness assumption, identity-adjacent | large | its own bench | **yes, design before build** |

### The first slice, recommended: (b) `facialHair`'s vacancy

Cheapest real widening of the ruling, and it is the one gap where everything
except one sentence already exists:

- it is already `departable`, already has a slot, a question and a guard kind;
- what it lacks is a `vacantPhrase`, because that table lives on the ACCESSORY
  placement list and a beard is not an accessory. **That is the actual shape of
  the work**: the vacancy vocabulary has to stop being an accessory table and
  become a property of a KIND, exactly the way V1 moved the other four silent
  lists onto cards;
- it is the first case that proves the pattern for `marks` and `ink` behind it;
- and it is measurable tonight: a beard in the master, *"shave his beard"*, the
  removal court's two arms.

**One rider, and it is the reason to do this before (a):** adding more accessory
kinds widens a table that is already the wrong home for this field. Moving the
vacancy phrase onto the subject/facet card first means every kind added
afterwards — accessory or not — answers the question in one place.

---

## What this note does not settle

- **Whether a born-with removal needs its own price.** A vacancy render is an
  ordinary paid edit today; the founder gate on (d) names pricing, and (b) may
  raise the same question earlier.
- **Whether `marks` should split from `skin`** to hold a vacancy of its own —
  that is the same slot-story question the tattoo studio answers for `ink`.
- **The skin half.** V3 can give a tan an absence sentence; it cannot make one
  hold. That is the carrier bench's, and neither half is worth much alone.
