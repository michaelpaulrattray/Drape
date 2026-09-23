# The two-paths predicates, re-answered one at a time

**#203 slice 2 · 2026-09-24 · read at `origin/main@fb2157b4` and at the production rows**

This is the writing #203 demands before anything collapses. Its own words:

> **So: a retirement that collapses `path` to one value must re-answer all three
> questions independently and in writing.** Deleting the column and letting the
> three predicates fold together reintroduces that bug pointed the other way.
> The comments at those three sites are the best specification of the retirement
> that exists — read them before cutting, not after.

Three things came out of doing it that the card could not have known.

1. ⚠ **There are EIGHT sites, not three.** The ghost audit found the three that
   share a helper. Five more answer the same question with their own hand, and
   two of them are drawn on a customer's screen.
2. ⚠ **Production holds THIRTEEN pathed rolls, not zero.** #203's slice-1
   comment says *"7 pathed rolls in dev, 0 in production"*. Read at the rows
   tonight: **10 `wardrobe` + 3 `basics`, ids 209–221, all `userId 1`**, cast
   between 2026-08-24 11:09Z and 2026-08-26 09:33Z.
3. ✅ **And they are unreachable for a much stronger reason than the flag.**
   Every one of those thirteen rolls holds **zero candidates**, zero candidate
   variants and zero signed casts, and every one of their sessions is `expired`.
   A branch is a candidate; no candidate, no branch. **So no reachable branch on
   production has ever been pathed, and after slice 1 none can become one.**

The count is not pedantry: *"nothing to protect because the rows do not exist"*
and *"nothing to protect because nothing can reach the rows that do"* are
different arguments, and only the second one is true.

---

## The measurement

Read through `scripts/lib/dbConnection.mts` against
`hayabusa.proxy.rlwy.net:23768/railway` (production), 2026-09-23 18:2xZ.

| `casting_rolls.path` | rolls | with a `wardrobeLine` | first | last |
|---|---|---|---|---|
| `(null)` | 282 | 0 | 2026-07-31 | 2026-09-23 |
| `wardrobe` | 10 | 10 | 2026-08-24 | 2026-08-26 |
| `basics` | 3 | 3 | 2026-08-25 | 2026-08-26 |

**Reachability of the 13**, each read as its own statement:

| what | count |
|---|---|
| candidates on a pathed roll | **0** |
| candidate variants descending from a pathed roll | **0** |
| signed casts descending from a pathed roll | **0** |
| their sessions, all `expired` | 13 of 13 |

⚠ **The zero was verified with a positive control before it was believed**, because
a wrong join looks exactly like an empty table: the same statement returns 8
candidates each for the five newest rolls, and 4 for roll 251. Candidates
survive from roll 251 onward (plus seven stragglers as far back as roll 5); the
whole 200–232 block holds none.

---

## The eight sites

Three questions were named on the card. The sweep found five more that answer a
path question with their own hand. **This is a floor, not a complete list**: the
population came from grepping `"wardrobe"`, `"basics"`, `bornPathsServing`,
`wardrobeOnly` and `everyPath` across `client/ server/ shared/ drizzle/` and
reading each hit. A site that branches on the path under some other spelling —
a boolean computed elsewhere, a field named for something else — would not have
been found.

### Q1 · May the model be SHOWN this subject?

`subjectServedOnPath` / `subjectsServedOnPath` — `server/castingV2/refineSubjects.ts`

`unpathed` → **withheld**. The wardrobe subject is the only `wardrobeOnly` card
of thirty; the other twenty-nine say `everyPath`. Withholding keeps the
interpreter prompt byte-identical for every roll in production, which is what
`bornPathSubjects.test.ts`'s prompt arms pin.

**Its answer after the retirement is unchanged and it is NOT collapsed in this
slice.** Collapsing it means `refineParseSystemPrompt` can never take its
composed-on-the-spot branch, which is a change to how the paid prompt is built;
it is provable (the four precomputed prompts are the only reachable outputs
already) and it is a separate commit with its own before/after on the bytes.

### Q2 · Does this path REFUSE her ask?

`pathRefusedNounIn` — `server/castingV2/refineSubjects.ts` → **RETIRED IN THIS SLICE**

`unpathed` → **does not refuse.** *A path nobody chose is not a path that
refuses.* The door returned `null` for every branch that can reach it, on every
sentence, always — so it has never once fired for anybody.

Retired rather than collapsed, for three reasons that all point the same way:

- **Its refusal names a product we no longer sell.** The sentence is *"This one
  was cast on Basics … Cast on Wardrobe to change what someone is wearing."*
  After slice 1 nobody can cast on either, so the one instruction it gives is
  one nobody can follow. That is the disappearing-technology law's clause 6
  exactly — a control that mirrors an implementation rather than an intention.
- **The wall it was invented to replace becomes honest again.** The door existed
  because `wall_unbacked`'s *"it isn't one of the things this can name"* stopped
  being true the day the wardrobe subject landed. With the subject not on offer
  to any reachable branch, the sentence is true once more.
- **The map has been saying so for a month.** `wall_basics_wardrobe` was the
  ONE unpinned door in the whole capability census (`capabilityAtlas.test.ts`
  asserted the list as `["wall_basics_wardrobe"]` by name), and the map carried
  two warnings about it: `unpinned-refusal` — *"a door nobody has proven can
  shut"* — and `unreached` — *"the door may be unreachable."* Both were right.
  The reason was not a missing fixture; it was that the state no longer exists.

**What a customer sees: nothing.** An outfit ask lands where it has always
landed for every production cast — `wall_stage` when the lexicon backs the word,
`wall_unbacked` when it cannot. `stageWallBackstop.test.ts`'s positive control
(*"put her in a long black coat"* → `wall_stage`, backed) runs through the real
interpreter and is untouched by this change.

### Q3 · Does the panel draw a wardrobe SECTION?

`wardrobeSectionServed` / `wardrobePanelPieces` — `server/castingV2/wardrobeCards.ts`

`unpathed` → **no section.** This is the value that AGREES with Q1 while
DISAGREEING with Q2, which is why all three are argued out loud at their own
sites.

**Not collapsed in this slice.** It reads Q1's predicate, so it collapses when
Q1 does — and its collapse makes `facePanel`'s wardrobe-section loop dead code,
which is a deletion inside the panel rather than a reading of the refine road.

### Q4 · Does a panel row say *"as dressed"*? ⚠ not on the card

`provenanceSays` — `server/castingV2/facePanel.ts:842`

```ts
if (input.wardrobe?.kind !== "line" || input.wardrobe.path !== "wardrobe") return null;
```

`unpathed` → **no label**, and its own docblock argues the case: on an unpathed
cast the label would be TRUE (every production master wears the house crew tee)
and is still refused, because drawing it would change a live surface for every
account that has never met the feature. **The answer survives the retirement
unchanged**; what dies is the reason being a *path*. This is the site most
likely to be missed by a sweep that greps for the three helper names, because it
spells the condition itself.

### Q5 · Is the reader asked to pick an outfit? ⚠ not on the card, and ALREADY DEAD

`pickWardrobe` — `server/castingV2/rollService.ts:635`, `briefCompiler.ts` ×5

```ts
const bornPath: CastingPath | null = null;              // slice 1
const pickWardrobe = bornPath === "wardrobe" && !input.followCandidatePublicId;
```

**Provably `false` at compile time since slice 1**, so `briefCompiler`'s `pick`
is always `null` and `interpretBrief` is always asked `wardrobe: false`. This is
a branch slice 1 orphaned and did not sweep — the retirement's own class, one
rung in.

⚠ **It is NOT removed here, and the reason is a live card.** Deleting the
plumbing is safe only as far as `interpretBrief({ wardrobe: false })`; taking
the field out of the reader's ask changes the prompt bytes, and **#1123** is
open precisely because trimming that ask needs a court (*context is not
additive* — a SUBSET of prompt context raised the stage wall twice as often as
its superset). The safe half and the unsafe half must not ride one commit.

### Q6 · What is the sheet told about the outfit? ⚠ not on the card

`wardrobeOf` / `enginePicked` — `server/castingV2/rollProjection.ts:535–555`

`resolution.kind !== "line"` → returns `null`, so `RollProjection.wardrobe` is
absent on every reachable roll and both client sites below read `null`. The
`enginePicked` flag (`path === "wardrobe" && line !== HOUSE_WARDROBE_LINE && !statesWardrobe(brief)`)
has therefore never been computed as `true` for any branch a customer can open.

### Q7 · Which notice does the sheet show? ⚠ not on the card, and it is CLIENT copy

`sheetNotice` — `client/src/features/castingV2/sheetNotice.ts:123–124`

```ts
if (input.wardrobePath === null) return STATED_WARDROBE_NOTICE;   // live, every cast
if (input.wardrobePath === "basics") return BASICS_WARDROBE_NOTICE; // dead
```

The **first** line is the live one and must not be disturbed by the retirement —
this is the closest thing in the whole sweep to a behaviour a customer would
notice, and it is the `null` branch, not a path branch.

### Q8 · Does the ask box claim it can reach her clothes? ⚠ not on the card, CLIENT copy

`RefinePanel.tsx:1074` — `wardrobeEdits && wardrobePath === "wardrobe"`

Always false (Q6 gives `wardrobePath` as `null` on every reachable cast), so the
box says *"Anything about them — not their clothes or the room"* for everybody.
`wardrobeEditCopy.test.ts` pins both cells and the requirement that BOTH halves
of the condition are present.

---

## What this slice changed, and what it deliberately did not

**Changed:** Q2 only — §7.2's door, its refusal reason `wall_basics_wardrobe`,
its copy, its corpus row, and the five arms that drove the helper. The arm that
mattered is re-asked at the entrance through the real interpreter rather than at
the helper, including on a `basics` resolution — the one state that used to open
the door — so the deletion is proven rather than merely unreached.

**Not changed:** Q1 and Q3 (one commit, with the prompt bytes asserted before
and after), Q4 (a panel deletion), Q5 (blocked on #1123's court for its second
half), Q6–Q8 (the sheet and the ask box, where the `null` branch is live copy
and the path branches are the dead ones).

**Not changed and not a shift's to change:** `shared/castingPaths.ts` and the
two columns. `drizzle/schema.ts` reads `CASTING_PATHS` for two column enums and
`WARDROBE_LINE_MAX_LENGTH`; the thirteen rows are the evidence of which rolls
predate the author road and are not to be backfilled or nulled.

## The order the rest should go in, and why

1. **Q1 + Q3 together** — they share a predicate and cannot be separated. The
   bar is the four precomputed interpreter prompts, byte for byte, before and
   after, plus `facePanel`'s section loop removed in the same commit so no
   constant-false predicate is left standing.
2. **Q4** — independent, and it is a single early return.
3. **Q6 → Q7 → Q8** — the display road, server first so the client's `null`
   branch is provably the only one reachable when its dead branches come out.
   ⚠ Q7's `null` branch is LIVE COPY on every cast; it is the thing this whole
   sweep is most likely to break.
4. **Q5's safe half** — the `pickWardrobe` plumbing down to
   `interpretBrief({ wardrobe: false })`. Its unsafe half waits for **#1123**.
5. **The columns and `shared/castingPaths.ts`** — last, at the Atlas's
   retirement view, and only once nothing above reads a path.

## A question this sweep raises and does not answer

With the paths gone, **a customer cannot change what a cast is wearing at all**
— the wardrobe subject is `wardrobeOnly`, so it is served on no reachable
branch, and an outfit ask meets the generic wall for everybody.

That is the honest state today and it is not new; the retirement only makes it
permanent by removing the road that would have opened it. Whether the wardrobe
subject should instead become `everyPath` — a real capability, on the author
road, for every customer — is a **product decision and a scope widening**, and
therefore his. It is filed rather than folded into a retirement, because a
retirement that quietly widens something is the same mistake as a retirement
that quietly narrows one.
