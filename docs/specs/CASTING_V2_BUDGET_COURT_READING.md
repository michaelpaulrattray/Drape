# HIS BRIEF, THREE WAYS — the budget court's reading

> **Status: dated record.** A measurement/evidence/court document from the date it states — it records what was true then; individual verdicts may since have been superseded. Current law: CLAUDE.md, the capability atlas, `DECISION_LOG.md` (#69 stamping sweep, 2026-08-28).


Ordered by the founder, 2026-08-24, verbatim: *"run the budget court with my
cyborg breif."* Relayed fable-1598; option 1 of
`CASTING_V2_DENSE_BRIEF_RATIONING_DESIGN.md`, countersigned fable-1595.

Run on tree `5c9e7052`, clean. **22 calls, $0.6775**, priced off the provider's
own token counts against `anthropic/claude-sonnet-5`'s published rate — not off
a balance, which is a position rather than a spend meter. Harness:
`scripts/_budget-court-disposable.mts`; log and rows:
`output/budget-court/budget-court.{log,json}`.

**No product file was changed to run it.** The announced cap is rewritten on the
wire by a wrapping text engine, and the wrapper REFUSES to run if the sentence
it means to replace is not in the prompt — a treatment that did not apply is a
court measuring nothing twice.

---

## 1. The headline

**His brief can say everything he wrote. The product will not let it.**

```
AS HE WROTE IT            553 characters · 83 words · 14 named facts
AS RATIONED TODAY          22 words delivered ·  7 of 14 facts
AS SPOKEN WITH ROOM        70 words           · 14 of 14 facts   <- the reading
AS DELIVERED WITH ROOM     22 words delivered ·  7 of 14 facts   <- unchanged
```

The last two lines are the whole finding. **Given room, the interpreter says
every one of his fourteen facts, three drives out of three.** Then
`NOTES_MAX` — 180 characters, enforced in code and never announced to the model
— cuts it back to exactly what he gets today.

**Raising the announced cap alone does not fix this. It moves the loss from the
summariser to the guillotine.** The design predicted that coupling in §6 option
1 (*"the two numbers must move together or the second cuts what the first
bought"*) and this is it, measured.

---

## 2. His brief three ways, verbatim

### AS HE WROTE IT

> Bald male, mid-40s, pale porcelain skin, heavily weathered. Severe bone
> structure: pronounced brow ridge, deep-set eyes, hard jawline, gaunt cheeks.
> Intense unsmiling expression. Cybernetic augmentation as part of his body:
> matte-black implant ports embedded in his skull above the right temple, fine
> metal seams running across his scalp like plate joins, a dark mechanical plate
> along his jawline, a small black implant stud below each ear, and his right
> eye glowing faint amber-red. The augmentations are surgically integrated into
> his skin, not worn.

### AS RATIONED TODAY — what actually reaches the picture

> Weathered pale skin, severe bone structure, deep-set eyes, gaunt cheeks; skull
> implant ports, scalp seams, jaw plate, ear studs, glowing amber-red eye

150 characters. **Gone: *porcelain*, the pronounced brow ridge, the hard
jawline, the unsmiling expression, matte-black, above the right temple, like
plate joins.** This is the residue the engine paints from, and it is why the
sheet came back with tan men and generic dots — his own two complaints, one
line apart.

### AS SPOKEN WITH ROOM — the reading his order bought

> Pale porcelain skin, heavily weathered. Severe bone structure: pronounced brow
> ridge, deep-set eyes, hard jawline, gaunt cheeks. Intense, unsmiling
> expression. Cybernetic augmentation surgically integrated into the skin:
> matte-black implant ports embedded in the skull above the right temple, fine
> metal seams running across the scalp like plate joins, a dark mechanical plate
> along the jawline, a small black implant stud below each ear, and the right
> eye glowing faint amber-red.

481 characters, 70 words, **14 of 14 facts** — and every clause is his own
wording. Nothing was invented and nothing was added; the model simply stopped
having to choose.

### AND WHAT THE PRODUCT WOULD STILL DELIVER FROM IT

> Bald, pale porcelain skin, heavily weathered. Severe bone structure with
> pronounced brow ridge, deep-set eyes, hard jawline, gaunt cheeks. Intense
> unsmiling expression.

168 characters. The cybernetics — every one of them — are cut off at the
180-character bound.

---

## 3. The survival table, per fact, per arm

`raw` is what the model replied, read off the wire. `del` is what survived
`NOTES_MAX` into the eight prompts.

```
                                 A · TODAY        B · RELEASED     C · UNDER 80
                                 raw    del       raw    del       raw    del
  pale porcelain skin            0/1    0/1       3/3    3/3       3/3    3/3
  heavily weathered              1/1    1/1       3/3    3/3       3/3    3/3
  pronounced brow ridge          0/1    0/1       3/3    3/3       3/3    3/3
  deep-set eyes                  1/1    1/1       3/3    3/3       3/3    3/3
  hard jawline                   0/1    0/1       3/3    3/3       3/3    3/3
  gaunt cheeks                   1/1    1/1       3/3    3/3       3/3    3/3
  intense unsmiling expression   0/1    0/1       3/3    3/3       3/3    3/3
  matte-black ports              0/1    0/1       3/3    1/3       3/3    2/3
  above the right temple         0/1    0/1       3/3    0/3       3/3    0/3
  fine metal seams               1/1    1/1       3/3    0/3       3/3    0/3
  like plate joins               0/1    0/1       3/3    0/3       2/3    0/3
  plate along the jawline        1/1    1/1       3/3    0/3       3/3    0/3
  stud below each ear            1/1    1/1       3/3    0/3       3/3    0/3
  right eye glowing amber-red    1/1    1/1       3/3    0/3       3/3    0/3
```

Read it in two passes. **Across the RAW columns**: the interpreter is not the
defect — given room it holds every fact, every drive. **Down the `del` columns
of B and C**: the seven facts that survive are the seven that happen to sit in
the first 180 characters. **The cybernetics lose because they are last in the
sentence, not because they are cybernetics** — the same accident that cost rolls
128 and 129 their entire tattoo description.

⚠ **Arm A has n=1 and says so.** Two of its three drives were REFUSED by the
cohort wall (§5), so its column is one drive. The before-side does not rest on
it: production rolls 206 and 208 and the density court's two drives all show the
same losses on the same brief.

---

## 4. Where the need actually sits

```
                       raw length per drive          facts held
  RELEASED (no limit)  481 / 431 / 504 chars         14/14, 14/14, 14/14
                        70 /  60 /  76 words
  UNDER 80 words       456 / 452 / 380 chars         14/14, 14/14, 13/14
                        65 /  65 /  53 words
  TODAY (25 words)     150 chars, 22 words            7/14
```

**`Under 80 words` is enough.** It holds the same fourteen facts as no limit at
all, in fewer words, on a brief of 83 words — so an announced number does not
have to be removed, only set above the measured need rather than at it.

**His own estimate was *"300-500 words is generally safe"*** (his words this
hour, recorded as the ceiling hypothesis at fable-1598). The measured need on
his own brief is **~70 words / ~500 characters** — inside his estimate by a wide
margin, and it is a reading rather than a guess.

⚠ **The number that has to move with it is `NOTES_MAX`, and this court cannot
recommend its value on this evidence alone.** 520 characters covers the longest
raw reply here with nothing to spare; a real number wants headroom and wants to
be read off more than one brief.

---

## 5. The controls, and both hold

```
NEGATIVE CONTROL   the 190-character plain brief, driven under both caps
  TODAY      20 words delivered · 6/14 facts   (its brief only states six)
  RELEASED   20 words delivered · 6/14 facts
  → a short brief is UNMOVED when the cap moves. The change reaches the
    population it was aimed at and no other.

THE DOORS          a named character must still wall
  TODAY      walled 2/2
  RELEASED   walled 2/2
  → releasing the cap does not open the cohort wall.

NOTES OVERFLOW     fires on every released drive, as it should — the raw reply
                   is over 180 characters and the product says so. Under
                   today's cap it never fires on this brief, which is exactly
                   why the loss has been invisible: it is not an overflow.
```

⚠ **AND ONE CONTROL FIRED THAT WAS NOT PLANNED: the cohort wall refused his own
brief on 2 of 3 drives in arm A.** Pooled with the record's earlier samples the
rate is unchanged in kind (~1 in 6 across three instruments, and this run is a
small sample), but it is the third instrument to meet it and the second to meet
it while looking for something else. It is `CASTING_V2_COHORT_WALL_DOUBLE_CHECK_DESIGN.md`'s
population, unchanged.

---

## 6. What this decides, and what it does not

**Decides:** the announced cap is the mechanism, `Under 80 words` is a
sufficient operating point on his brief, the interpreter holds his facts when
allowed to, and the enforced 180-character bound is now the binding constraint
rather than a backstop.

**Does not decide, and must not be read as deciding:**

- ⚠ **the picture.** Every number here is text — the notes and the compiled
  prompts. Whether a 500-character character-detail line makes a BETTER
  photograph is a question about frames, and law 9 says no reader closes it.
  That is the design's stage 3, his eyes, and it is not authorised here.
- ⚠ **the image-side context risk.** *Context is not additive* was measured on
  the IMAGE prompt, and this court did not touch it: a longer `Character detail`
  line is more image-prompt context, and its effect on the eight candidates'
  variety, on the stage wall, and on the provider's own content checker is
  unmeasured.
- **`NOTES_MAX`'s new value** (§4).

The build that follows is a two-number change and it comes back for countersign
with both numbers and the stage-3 shape.
