# The author road carrying a follow or a chip edit — design (#131's open item)

*Foreman-32, 2026-08-27. Status: **BUILT 2026-08-27 (foreman-40) on his countersign** — Crew reply #11, 2026-08-26 20:49Z, verbatim: *"Yes to building it; (1) yes, let the engine vary; (2) yes, read-only chips with the sentence; (3) no fine details. It is dark until it lands, and the first follow on your account is the court."* Built as recommended, with the amendments in §6 below.*
*Governing ruling: `PROMPT_AUTHOR_RULING_2026-08-26.md` (rules 1–16, §5b/§5c);*
*the road as it stood before this build: `briefCompiler.ts` (`authorRoad`, `houseBecause` — the latter deleted by the build, §6), `promptAuthor.ts`, `houseBlock.ts`.*

## 0. What the customer meets today (read at the code, HEAD `7fa16ad3`)

Under `CASTING_CREATIVE_REGISTER_SCOPE` (his account, `users:1`), every roll
takes the author road EXCEPT two: a **follow** (a roll anchored on a
candidate) and a roll carrying a **chip edit** (an unlock or an override).
Those compose HOUSE — the pre-author composer, eight per-candidate prompts,
the wardrobe tee, the 2,000-character bound — and the row records
`register: { kind: "house", because: "anchored" | "edited" }` (review of
PR #132, finding 1: an authored follow would paint eight strangers under a
lineage pill; an authored chip edit would record an edit the engine was
never told).

**The row said why; the sheet did not.** That half is fixed in the PR this
design rides with: the sheet draws an `AUTHOR` record line naming the reason,
and the dock hides the settings gear while a chip adjustment is queued (it
already hid it on a standing follow) and says in its place that the next
roll is the studio's own casting. A gear promising *Photoreal · Low* over a
roll that reads neither was a control that lied — the ratified
no-dead-controls ruling, on his own account.

## 1. Why carrying is not a mechanical port

The author road paints eight frames from ONE prompt whose first paragraph is
the customer's words **verbatim** (rule 1, by code). The house road's follow
and chip edits act on the INTENT — the reader's structured record — and
reach the engine through per-candidate prose the author road never writes.
Two of the three inputs translate cleanly into words; the third cannot, and
that is the product question.

| Input | What it does on the house road | On the author road |
|---|---|---|
| **Follow** (`FollowAnchor`: sex, primary heritage, age band, hair, look, realized axes) | every candidate copies the anchor's realized axes; heritage varies its second component per candidate ("cousins, not clones") | a FAMILY CLAUSE — one paragraph, written by CODE from the anchor after unlocks, placed after the verbatim brief and before the author's content |
| **Override** (`LockOverrides`: sex, ageBand, agePhase, heritage, build, energy, look, archetype) | replaces the reader's value and locks it | the same clause, as words ("cast as a woman in her 40s") — an override is a sentence the customer said with a control instead of the keyboard |
| **Unlock** (`sex`, `ageBand`, `heritage`, `build`, `energy`, `archetype`) | clears the reader's lock so the axis varies | **on a follow**: strips that axis from the family clause (the anchor stops supplying it). **On a plain authored roll: it cannot do anything** — the brief travels verbatim, so a chip derived from *"a woman in her 30s"* cannot be unsaid by removing it; the engine reads the sentence, not the chip |

The third row is the clash. On the house road a chip is a CONTROL over the
prompt; on the author road a chip on a non-follow sheet is a RECORD of what
the reader saw in words the engine will read anyway. Offering removal there
is a control that does nothing — the class this product's own
`FollowAnchor` docblock names (*"Unpinning used to be silently inert on a
follow"*).

## 2. The design

**2a. The family clause (follows).** After the verbatim brief and before the
author's content, code writes ONE paragraph from the anchor as the sheet
already shows it — derived from the same prose the house composer and the
persona line use (`describeHeritage`, `describeAge`, `describeBuild`,
`describeHair` in `cohortPhotorealHuman.ts`; law 4, one renderer), never a
second phrasebook:

> *Continue this family: cast eight relatives of one person — a woman, late
> 30s, of Korean heritage, slight build, dark hair worn in a low bun, still
> and grave. Same sex, same age, same heritage on every one; faces differ.*

Verbatim-first holds (the brief is still paragraph one, untouched). The
author sees the clause as context and may not restate identity (its MAX
instruction already forbids an exact face). `NEVER_WRITTEN` and the sternum
guard apply to the clause's vocabulary exactly as they do to the block —
`describeHair`'s output must be swept for refusal words before this ships.

**2b. Overrides → words in the same clause.** *"Cast as: a woman; in her
40s; of Nigerian heritage."* One sentence per override, from the same
renderers. An override on a follow REPLACES that axis in the family clause.

**2c. Unlocks.** Honoured on a follow (strip the axis from 2a, exactly
`withUnlocksApplied`). On a non-follow authored sheet the chips are drawn
**non-removable** (the `removable` bit is already per-chip in
`buildChips`), because removal there changes nothing the engine reads. The
sheet says so once, on the chip row: *"These are what the studio read in
your words — edit the sentence to change them."*

**2d. Records.** `register.kind = "author"` on these rolls too, with a new
`carried: { anchorOf: <candidate>, unlocks: [...], overrides: {...},
clause: "<the paragraph>" }` so the sheet's prompt record shows the clause
inside `authoredPrompt` (no hidden prompt, rule 5). `houseBecause` and the
`AUTHOR` record line from §0 survive for rows already written and for any
future road the author still cannot carry.

**2e. Road decision.** `rollService`'s `authorRoad` predicate and the
compiler's `houseBecause` collapse to one: under the flag every roll is
authored. The follow's path inheritance (*a Follow INHERITS the sheet's
path*) is moot on this road — the engine dresses the cast (rule 11).

## 3. What stays open for his word

1. **"Cousins, not clones"** — the house follow varies the second heritage
   component per candidate; one prompt cannot. The clause says *relatives*
   and lets the engine vary. His eye on a flagged follow sheet decides
   whether that is enough.
2. **Non-removable chips on an authored sheet (2c)** — a visible UX change
   on his account. The alternative (keep removal, let it do nothing) is the
   lying control; there is no third option that keeps verbatim.
3. **Should a follow's clause carry the realized axes** (eye colour, brow,
   skin character) as words? They exist so *"the founder followed a face
   expecting its eyes"*; in words they push the author toward a portrait.
   Recommendation: carry sex, age, heritage, build, hair, look; leave the
   realized axes to the engine and read the sheet.

## 4. Cost and spend

No new table, no migration, no new engine or reader call; the author call
is unchanged (one text call at MAX, none at LOW). `assertFalBudget`
untouched. Court: one flagged follow and one chip-edited roll on his account
for his eye — 320 credits of his, on his word, nothing house.

## 5. Order

§0's honest half ships now (this PR). §2 builds dark on countersign, one
PR, with the scope test's two "house under the flag" arms rewritten to
assert the clause on the wire and the unflagged compile byte-identical.

## 6. As built (2026-08-27, foreman-40) — where the build departs from §2, and why

- **The clause never says "eight".** §2a's example (*"cast eight relatives"*)
  would have been refused by the author's own `NEVER_WRITTEN` — "eight" is
  on it because counting the casts painted 7 of 8 tiles as contact-sheet
  grids on dev roll 95. The clause says *"cast a close relative of one
  person"* and closes *"the face itself is new"*; no series word at all.
  `familyClause.test.ts` sweeps every value the closed vocabularies can put
  into a clause through `neverWrittenIn` and `containsHouseSentence`, with a
  positive control.
- **Hair is carried as COLOUR, not as the cut.** §2a's example named *"dark
  hair worn in a low bun"*. The house follow holds colour on all eight
  (`anchoredHairColour`, *"colour is the family signal"*) and deliberately
  varies the cut (*"one family, not one barber"*); a named cut in words is
  the clone stamp that ruling removed. So the clause says *"blonde hair"* and
  nothing about the cut — which is also his answer (3) applied to hair.
- **Build and energy are override-only.** `FollowAnchor` carries neither, so
  a follow's clause cannot name them; an override does, in words.
- **Phrasebook.** Heritage reads through `describeHeritage` (exported from
  `cohortPhotorealHuman.ts`, law 4). Sex uses the house composer's nouns
  (*"a woman" / "a man" / "an androgynous person"*). Age, energy and look are
  short phrases of the clause's own (`agePhrase`, `ENERGY_PHRASE`) — the
  house renderers for those are prompt blocks with anatomy guards, not
  sentences a family clause can quote.
- **The record is `register.carried = { follow, overrides, clause }`**
  (§2d's `anchorOf` is not duplicated: the row's lineage columns already
  name the parent). `houseBecause` is gone from the compiler; the projection's
  `readAuthorSatOut` survives for rows already written and the sheet's copy
  for them is in the past tense.
- **Read-only chips** are the server's `removable` bit (`buildChips`: on the
  author road, removable only where anchored AND one of sex/ageBand/heritage)
  AND the echo's `varyOffered` policy on the client (the echo composes from
  `facts`, not from chips) — the same rule at both ends, keyed on the NEXT
  roll. The one line under the echo is `AUTHOR_CHIPS_ARE_A_RECORD`.
- **Two things §2 did not name, found at the wire.** (a) An authored follow
  must NOT inherit its parent's wardrobe pair — the engine dresses it — so
  `createRollWithCandidates` takes `inheritWardrobe: false` on the author
  road; otherwise the sheet would draw a WARDROBE line over an outfit the
  engine was never told (PR #138 finding 1's class). (b) The `follow`
  mutation took no `imagination`/`style`; with the gear now drawn on a
  standing follow it would have been a control the roll ignored, so it takes
  both, and the client sends them.
- **The dock note is deleted** (`AUTHOR_SITS_OUT_CHIP_EDITS`): it can no
  longer be true on this road.
