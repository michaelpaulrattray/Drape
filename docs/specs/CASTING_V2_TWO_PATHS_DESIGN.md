# The Two Paths — Wardrobe or Basics: a design for countersign

**Founder ruling: fable-1311** (chat, 2026-08-21 — *"this is the way foward
100%"*), with fable-1312's addendum. **Roadmap §10 item 5.**

✅ **COUNTERSIGNED 2026-08-22 (fable-1334)** with one added condition — **(v),
written into §3.1a**: the edited line's resolution is `currentWardrobeLine`, one
owner, and Sign snapshots ITS answer. The four questions in §13 are ruled, as
recommended, and recorded there. **Nothing of item 5 is built until the migration
ceremony lands and condition (v) is in the code.** Nothing is flipped on for
anybody before the court and his eyes.

**The census rule is discharged in §1** (fable-1315 §3): every capability this
design touches is cited by its row id in `docs/architecture/capability-atlas.md`,
driven through the real refine entrance, or the census is quoted saying the
capability is absent. Nothing below is written from recollection.

---

## 0. What he ruled, in one paragraph

A cast is born on one of two paths, chosen before the roll. **Wardrobe** (the
default): she is born and signed in an outfit — hers if she named one, otherwise
one the engine picks to match the cast type, otherwise the plain grey tee. Ink
lands only where that outfit leaves skin. **Basics**: she is born and signed in
plain black basics — a clean body record, and the chest is bare. Wardrobe edits
work on the Wardrobe path and are refused, honestly, on Basics. The tradeoff is
told before the roll, not discovered after it.

That ruling retires two open questions outright: the **chest word** (hidden vs
scoop) and the **basics anchor**. The path decides.

---

## 1. What exists today — the census reading, not a memory

Rows read from the **committed** census table (`capability-atlas.md`, profile
`fixture-as-founder`, repaint `all`) — **not re-driven for this report**, which
is the instrument working as intended: *does this exist* is a lookup. A re-drive
would also have spent ~$0.80 of an OpenRouter balance the founder's own card says
is at $5.80, under the standing no-drive discipline (fable-1328 §4).

| row | ask | observed today |
|---|---|---|
| `wardrobe.tee` | "put him in a plain black tee" | **`refused:wall_stage`** |
| `wardrobe.colour` | "make his tee black" | `refused:wall_stage` |
| `background.white` | "make the background pure white" | `refused:wall_stage` (the *backed* sentence) |
| `guard.stage` | "put her on a beach at sunset" | `refused:wall_stage` |
| `ink.words.chest` | "give him a small swallow tattoo on his upper chest" | `refused:gate_ink_uncarried` |
| `ink.words.neck` / `ink.words.arm` | neck / upper arm | would-render |

**There is no wardrobe capability in the studio today.**
`FREE_SUBJECTS` (`server/castingV2/subjectCards.ts`) holds twenty-nine subjects
and not one of them is a garment — the wall is a missing slot, by design, and
`refineSubjects.ts` says so under the heading *"This list IS wall (b)"*.
`STAGE_WORDS` (`refineDelta.ts`) refuses garment asks a second way, by ACTING on
`coat · jacket · shirt · dress · suit · hat · scarf`.

⚠ **And reading the census's own COPY column turns up something the design has to
account for: today's wardrobe wall is not the lexicon's, it is the MODEL'S.**
Both wardrobe rows come back with the **unbacked** sentence — *"Refining can't do
a plain black tee yet — it isn't one of the things this can name"* — and unbacked
means `stageWordIn` found nothing. It found nothing because **`tee` is not in
`STAGE_WORDS`** (nor is *top*, *jeans*, *hoodie*, *apron*, *boots*). Compare
`background.white`, which comes back **backed**: *"the background is a garment, a
prop or the set"*.

So the wall that stands between a customer and a wardrobe edit today is the
model's claim plus a re-look — *the model's read is the unstable thing*, this
program's own finding, measured at 4-in-5 on `wall_stage` once before.

⚠ **FOOTNOTE, 2026-08-22: the two wardrobe rows above now refuse under
`wall_unbacked`, not `wall_stage`** (census card C1, ruled fable-1336). Nothing
the customer reads changed — the sentence in the table is still the sentence —
and nothing about this design's argument changes either. What changed is the
NAME the record files it under, and it changed for the reason this section
found: the wall a tee meets was never the shoot's, it was *the model said out of
scope and the code could not confirm what about*. The table's `observed` column
is quoted as the census had it on the day this was written. **Two
consequences the design owes:** opening the Wardrobe path is not a matter of
deleting lexicon words (they were never what refused a tee), and refusing on the
Basics path needs a real code-owned door (§7.2) rather than the absence of a
subject — a guard that refuses by ABSENCE protects nothing once a lane stands
behind it, which is `refineDelta.ts`'s own three-wall audit.

**Census finding 4(b), and it is the reason this design owns the fix rather than
a patch in front of it.** `gate_ink_uncarried`'s own sentence
(`refineRefusals.ts`) offers:

> *"…I can put it on their neck or an upper arm now — **or change what they are
> wearing first**."*

The product offers a road it refuses. `ink.words.chest` and `wardrobe.tee` are
the two census rows that meet, and today the second is a wall. That dead end
closes on both paths and for two different reasons: on Wardrobe the offer becomes
true, and on Basics there is nothing to refuse because the chest is already bare.

**Two more census rows belong to this design and are being read honestly rather
than claimed as bugs it fixes:** `age.older` and `guard.compliment` also land on
`wall_stage`. They are the same wall wearing a different meaning — *"this isn't
one of the things I can name"* — and they are **not** wardrobe. They stay filed
as their own card (the `wall_stage` double-meaning family, fable-1329 §4). This
design must not silently absorb them.

---

## 2. The evidence — the class this kills, measured at the frames

**opus-977 §3, on the founder's own dev cast, free and on the record.** A paid
removal re-render (`v509`, "take the tattoo off his arm") came back with his tee
**light grey before and BLACK after** — same person, same pose, same framing,
same background, and a garment nobody asked about.

The cause was read at the recipe rather than guessed. v509's whole identity
sentence, from `recipeAssembler.identityClause`:

> *"Reference 1 is the photograph of this person — reproduce him exactly: same
> face, same pose, same lighting, same framing, same background."*

**Five nouns, and clothing is not one of them.** The master's tee IS grey and the
master was the only reference; the engine changed it anyway, and the recipe never
asked it not to.

Why it had never been seen before: the step *before* it (v508) carried an ink
crop cut from his sleeve, so the garment had a picture speaking for it. The gap
is real and it is **masked whenever a carry happens to include cloth**, which is
the worst way for a gap to behave.

Frames: `output/bare-skin-court/small-v501-arm.png` (grey) and
`output/bare-skin-court/small-after-step2-v509.png` (black).

**A stored wardrobe line is the clothing noun with an owner.** That is the whole
argument for this design being the fix: not a sixth noun added to a measured
prose constant on a live lane (opus-941 already ruled that a court's variable,
not a shift's), but a fact about this cast that every render is handed because it
is stored — the same shape `presentationState.ts` uses for *how the hair is worn*
and for the same reason: **a fact nothing names is a fact the engine is free to
reinterpret.**

---

## 3. The shape — one owner, derived everywhere

### 3.1 The path is a born fact; the LINE is what travels

```
casting_rolls.path          'wardrobe' | 'basics'     NULL = cast before the paths existed
casting_rolls.wardrobeLine  varchar(240)              the resolved outfit, complete
```

**On the roll, because a roll is the sheet and the ruling is one outfit per
sheet** (§B2: *"Identical across all eight candidates — a sheet compares people,
not clothes"*). It is not on the candidate: eight candidates in eight outfits is
the comparability law broken. It is not on the session: two rolls in one session
already differ by brief, and a Follow may legitimately change nothing else.

**A Follow inherits both**, in the same insert-select that re-anchors the parent
candidate to `ctx.user.id` — the `parentVariantId` precedent, and the same reason:
lineage is cheap to write while the row is being created and painful to backfill.

⚠ **A Follow inherits the BORN line, not the EDITED one, and this is decided here
rather than by absence.** If the followed variant has had a wardrobe edit, that
edit does not travel: a Follow casts a fresh eight, and dressing eight strangers
in one person's mid-session outfit change is *a momentary choice made permanent
for eight strangers* — which is the sentence `refineSubjects.ts` already uses
about `expression`, for the same reason, and it is why the wardrobe card carries
a non-null `presentationNoun` (§7.1). The edited look stays on the person it was
made for.

**At Sign it is snapshotted** through `identityDocumentsFor`, which already reads
`source.roll.*` — so `technicalSchema` gains `path` and `wardrobeLine` with no
new read. And because `technicalSchema` never crosses a projection boundary, the
sheet's own display of the line comes from the roll column through an **explicit
projection** (invariant 8), never lifted out of the document blob and never out
of `compiledBrief`, which is declared internal.

### 3.1a ⚠ CONDITION (v) — `currentWardrobeLine(branch)` IS THE ONLY ANSWER, and Sign snapshots ITS answer

**Added at countersign (fable-1334 §2), and it closes a refund hole this report
had left open by omission.** Three sentences of the design implied a fourth
nobody had written: the roll's line is snapshotted at Sign (§3.1), a wardrobe
edit rewrites *the stored line* (§7.1), and a Follow inherits the BORN line
(above). Together those imply a **per-branch edited line**, and therefore a Cast
**signed after a wardrobe edit** whose six views would be judged against the born
line it is no longer wearing — six views, the wardrobe axis, **refunded slices**,
which is precisely how the crew-neck chest design already cost money.

So it is stated rather than left to be resolved at the keyboard:

```
currentWardrobeLine(branch)  =  the branch's edited line, if one exists
                                else the roll's born line
```

**ONE function, and every reader in §3.3 reads it** — the recipe derives from it,
Sign snapshots ITS answer, the judge judges against ITS answer, the sheet shows
ITS answer. **Exactly one caller reads the born column by name: the Follow**
(above), because a Follow is the one case that deliberately wants the sheet's
outfit rather than this person's. Anything else reaching past this function for
`casting_rolls.wardrobeLine` is the parallel-copy shape (law 4) with a refund
attached.

### 3.2 ⚠ THE MIGRATION IS A BLOCKING PREREQUISITE OF THE CODE, NOT OF THE FLIP

A new column on a table drizzle SELECTs is in every read, flag or no flag. So the
order is **migration ceremony → code lands dark → court → his eyes → flip**, and
the ceremony is a founder-only production act. It is carded in
`founder-queue.md` with this design, not assumed.

✅ **BOTH HALVES NOW EXIST AND DEV HAS TAKEN THEM** (2026-08-22, shift 102;
approved fable-1343). The card had promised *"the migration file will be written
and tested on dev before it reaches you, and the exact command comes with it"*
and neither existed — a card reading blocked-on-him whose deliverable was ours.

```
drizzle/0051_casting_rolls_two_paths.sql     two ADD COLUMNs, nothing else
scripts/ceremony-two-paths.mts               the house rite; safe to run twice

npx tsx scripts/ceremony-two-paths.mts --dev                      ← run, exit 0
railway.cmd run --service MySQL -- npx tsx scripts/ceremony-two-paths.mts --production
```

Dev read-back, quoted rather than described: `path enum('wardrobe','basics')
NULL no default` · `wardrobeLine varchar(240) NULL no default` · `rows: 44 · path
set on 0 · line set on 0`.

⚠ **NULLABLE WITH NO DEFAULT, and that is the load-bearing detail.** §3.1's *NULL
= cast before the paths existed* is only true if the ALTER leaves the historical
rows alone, and MySQL fills every existing row with a column's DEFAULT when one
is given. `NULL DEFAULT 'wardrobe'` would therefore stamp all 44 dev rolls and
every production roll with a claim that they were cast on a path that did not
exist when they were cast — unrepairable afterwards, because the distinction it
destroys is the only evidence of which rolls predate the feature, and the
resulting table looks entirely healthy. The ceremony reads the default back by
value and asserts the non-null count is zero on the sitting that applies it; the
migration text is pinned by `server/castingV2/twoPathsMigration.test.ts`.

**Until `--production` has run, `drizzle/schema.ts` must not name either column.**
That absence is an arm rather than a note, and the arm says in its own comment
what to replace it with.

The cheaper-looking alternative — hiding both facts inside the existing
`compiledBrief` JSON — is refused on purpose. Sign would then read an internal
blob for a durable fact, and the sheet would lift a display string out of a
column whose docblock says *"INTERNAL — never projected"*. That is the shape this
codebase keeps paying for.

### 3.3 One owner: `server/castingV2/wardrobeLine.ts`

Everything that needs to say what this person is wearing derives from that
module, and — per condition (v), §3.1a — every row below reads
`currentWardrobeLine(branch)`, never the column:

| reader | today | with the line |
|---|---|---|
| the roll prompt | `cohortPhotorealHuman.FRAMING`'s fixed *"WARDROBE: plain unbranded clothing in neutral grey or off-white"* | the born line, composed per roll (no branch exists yet) |
| the refine recipe | nothing at all (§2's five nouns) | `currentWardrobeLine`, stated as already true, dropped the moment this edit writes the slot |
| the six signed views | `CAST_PACKAGE_WARDROBE_SPEC`, hard-coded *crew-neck* | `currentWardrobeLine` of the branch being signed |
| the wardrobe judge | the same constant, via `packageViewExpectation` | the SAME answer the views were composed from — one owner, so generator and judge cannot drift, and a Cast signed after a wardrobe edit is judged against what it is wearing |
| the sheet | `sheetNotice`'s *"casting sheets keep the studio tee"* | `currentWardrobeLine`, with *"· engine's pick"* when it was picked for her |
| a Follow | — | the BORN column, by name, and it is the only caller that may (§3.1) |

**Two live self-contradictions close as a side effect, and both are recorded in
the code already.** `CAST_PACKAGE_WARDROBE_SPEC` hard-codes *crew-neck* while
naming the reference photograph as the authority — on a Cast signed off a scooped
anchor those halves already disagree (`inkViewReferences.ts` says so in as many
words). And the spec deliberately names no colour because the sheet casts in
*"neutral grey OR off-white"* and a Cast signed in off-white had a package whose
contract it could not satisfy — *the customer paid for our inconsistency*
(`castViewPackage.ts`, first real Sign, 2026-08-02). **A stored exact line removes
the latitude that caused both.**

### 3.4 The AUTHORITY paragraph has to be amended, deliberately, in one place

`cohortPhotorealHuman.OVERRIDE` is appended last with override authority and says:

> *"If the description implies a location, an activity, a **costume**, a prop, or
> any text, ignore that implication and render this person in the plain studio
> frame described here."*

That sentence is what makes the Wardrobe path impossible today, and it is the
guarantee behind the precedence fix — so it is amended rather than deleted: the
frame, the capture, the realism and the negatives keep absolute authority, and
the WARDROBE line becomes the one thing the description may set, because it is no
longer the description setting it — **it is a code-owned field the code composed.**
Location, activity, props and text are untouched.

**A guard already stands over this and it will go red, which is the point.**
`briefCompiler.test.ts`'s *"keeps the framing constant intact and last in every
compiled prompt"* asserts every member of `COHORT_CONSTANT_MARKERS` (=
`CONSTANT_BLOCKS`, derived — never re-listed) appears verbatim in each of the
eight compiled prompts, and separately that `AUTHORITY:` is present and last. So
the wardrobe sentence leaving `FRAMING` for a composed line **cannot be a silent
edit**: that arm fails until the guard is re-pointed at the composed line, and
the re-pointing is a decision somebody signs rather than a diff nobody sees.
Verified by reading the arm, not assumed from the block's name.

---

## 4. The Wardrobe path — resolution, in order

**(a) Her words win.** An outfit named in the brief is the line.
*"a barista in a red apron"* → the apron.

**(b) Else the engine picks ONE per sheet, matching the cast type.** Written by
the brief stage — a new `wardrobe` field on `CastingIntent`, filled by the
interpreter call that already runs. **No new engine call, no new spend, no new
transport.**

House taste, stated as a bound the picker is given and a door the code enforces:
*matches the type, stays plain* — no props, no weapons, no logos, no headwear,
nothing costumey. The caveman gets a one-shoulder hide and bare feet, not a club.

**(c) Else the default grey tee** — anything basic (*"woman mid 30s"*) — which is
today's picture, unchanged.

Whatever resolves is written **complete**: top, bottoms, footwear. A named top
gets its bottoms completed in the same restrained register, so the waist-up
sheet, the hero and the three full-length signed views cannot disagree about what
she is wearing below the crop.

### 4.1 ⚠ Case (b) is a NAMED exception to source containment, and it needs its own door

Every free value in this product must appear in the customer's own sentence
(D-172). **An engine-picked outfit cannot** — that is the whole point of it. So
the exception is declared rather than smuggled, and it carries three things:

1. **It is labelled where she reads it**: *"Wardrobe: dark canvas work jacket,
   straight jeans, plain boots · engine's pick"*. She is never told she asked for
   it.
2. **A code-owned door**, refusing by ACTING and not by absence — the
   `STAGE_WORDS`/open-lane lesson (`refineDelta.ts`'s three-wall audit). It runs
   `brandScrub` and rejects props, weapons, headwear, printed text and logos.
3. **A rejected pick falls back to (c) and the sheet line still describes the
   picture.** The internal reason is logged. The sheet never carries an apology
   for a decision the customer did not make.

The alternative — a closed catalogue of outfits keyed by cast type — is refused
under the fidelity law. Eight canned outfits cannot dress a cybernetic male or a
caveman, and he asked for the engine to decide precisely because they cannot.

### 4.2 The existing clothing guards are NOT what refuses a wardrobe, and they stay

`parseStatedHair` and `parseStatedAccessories` drop a value containing a clothing
word (`mentionsWornClothing`). That is not the wardrobe wall — it is *the model
answered about the outfit in the hair field*, and it stays exactly as it is on
both paths. The wardrobe gets its own field; nothing about those two guards moves.

---

## 5. The Basics path — and one honest correction to its copy

**Spec** (§B3): men shirtless with plain black fitted shorts; women a plain black
sports top with black fitted shorts, cut low enough to show a chest piece. Adults
only is already the product's rule.

### ⚠ 5.1 "Tattoos anywhere" is not a promise this frame can keep

The ruling's copy line reads *"Basics — born and signed in plain black basics;
full body record, tattoos anywhere, clean base for try-on."* Two halves of that
need correcting before it reaches a customer, and both are read off the code:

- **The master frame is waist-up.** `cohortPhotorealHuman.FRAMING` asks for
  *"waist-up"* and *"from mid-torso up in a 2:3 portrait"*, and
  `castingFrame.ts` pins that premise with a test that fails the day it changes.
  So a forearm, a thigh, a calf or a foot is **not in the picture** — the fifth
  refuse-before-dispatch door, and only a different photograph answers it.
- **The vocabulary is three placements**: `neck · upperArm · upperChest`
  (`shared/inkPlacementVocabulary.ts`), measured on sixteen production masters.

**What Basics actually opens is `upperChest`** — one placement, the one whose
entry already says `skin: "dependsOnGarment"` because *the same placement is
available on a scoop neck and absent on a crew neck in the same product at the
same moment.* That is a real and valuable unlock, and it is what the copy should
say: **"a chest piece works here."** Not *anywhere*.

**Recommendation: the Basics path does NOT change the roll framing.** A
full-length master would move `castingFrame`, `anchorPresentsIn`, the whole
out-of-frame vocabulary and every measured placement reading at once — a
different, larger road. "Full body record" is delivered by the three full-length
signed views the package already renders, now in basics rather than in an outfit.

### 5.2 What Basics does to the ink road, precisely

`placementRidesPackageViews` (`inkViewReferences.ts`) is a frozen table with
`upperChest: false`, and its docblock currently says what lifts it is *"his
hidden-vs-scoop word and the court that follows it."* **That sentence is one
ruling behind: 1311 retired the chest word.** The table becomes **derived from
the resolved wardrobe line** rather than fixed — a chest design rides when the
garment leaves the chest bare and does not when it does not, on either path, one
owner for both ink lanes so a chest tattoo cannot ride as a crop while being
refused as a plate.

Same for `signService`'s `surfaceCovered` disposition and for
`gate_ink_uncarried`: both stop asking *is it upperChest* and start asking *does
this cast's wardrobe cover it*.

The docblock correction is carried into the build sitting and named in §13.

---

## 6. The toggle, and its copy

**Where it sits.** Two surfaces, because there are two places a roll is bought,
and a toggle on only one of them is a path a customer can change by accident:

- `client/src/pages/CastingV2.tsx` — the lobby hero, under the brief field and
  above the TRY row, in the row that already carries the price. It is not a
  modal and it is not a step: one control, two states, default **Wardrobe**.
- `client/src/pages/CastingSheet.tsx` — the re-roll box, where it shows the
  path this sheet was cast on. **A re-roll may switch it**; a Follow inherits it
  (§3.1) and does not offer the switch, because a Follow narrows an existing
  face and changing what that face is wearing mid-lineage is a different ask.

**The copy, and the brief discipline it is under** — the tradeoff is told before
the roll, which is his own condition (*"as long as we make it clear before they
go to cast someone"*). One honest line each, no marketing:

```
WARDROBE   Born and signed dressed. Tattoos land where the outfit shows skin.
BASICS     Born and signed in plain black basics. A clean body record — a chest
           piece works here, and try-on starts from a clean base.
```

⚠ **Neither line may say "anywhere"** — see §5.1. The Basics line above is the
corrected one, and it is corrected because the frame is waist-up, not because the
shorter sentence read better.

**The path is shown after the roll too**, on the sheet, beside the wardrobe line
(§3.3). A fact that decides what a cast can and cannot do later must be visible
on the cast, not only on the control that set it.

**One thing the toggle does NOT do**: it does not appear when
`CASTING_TWO_PATHS_SCOPE` is off. No disabled control, no "coming soon" — a
disabled toggle is a question with no answer, which is D-180's dead end wearing a
tap target.

---

## 7. Refine — the stage wall admits garments on one path and refuses on the other

### 7.1 Wardrobe path: a garment becomes a subject

A new subject card (`subjectCards.ts`) with `heading: "WARDROBE"`,
`kind: "presence"`, `departable: false`, `plural: false`,
`presentationNoun: "wardrobe"` — presentation, so a Follow never inherits it
(D-136) — and `admittedOn: "repaintOnly"`, because it will be measured on the
repaint road and admitting it on the paste road would charge somebody for a kind
nobody has measured there.

An edit **rewrites the stored line** (§B5) rather than appending to it: one slot
holding a whole outfit, restated absolutely, which is what keeps removal
arithmetic honest — the same rule the card's own `plural` field encodes.

`STAGE_WORDS` keeps every garment noun. What changes is that on the Wardrobe path
a garment now HAS a subject to be filed under, so the wall stops being reached —
the refusal-by-absence half disappears, and the refusal-by-acting half is scoped
to the path. `background · backdrop · wall · studio · set · scene · location ·
holding · prop · chair · table` are untouched: **this design opens the wardrobe
and not the shoot.**

### 7.2 Basics path: an honest refusal, and it is a new door

> *"He's a Basics cast — the record stays in basics, so outfits come in takes and
> campaigns rather than here."*

A new refusal id (`wall_basics_wardrobe`), free, `report: "wall"`, with a pinning
test named in the same commit — otherwise it lands as one more of the twelve
service refusals the census already reports as *"a door nobody has proven can
shut."*

### 7.3 Three census rows are added in the same commit as the code

| new row | ask | state | expects |
|---|---|---|---|
| `wardrobe.tee.wardrobePath` | "put him in a plain black tee" | master, Wardrobe | would-render |
| `wardrobe.tee.basicsPath` | "put him in a plain black tee" | master, Basics | `refused:wall_basics_wardrobe` |
| `ink.words.chest.basics` | "give him a small swallow tattoo on his upper chest" | master, Basics | would-render |

A capability that ships without its census row is a capability the next design
report cannot look up, which is the instrument's whole purpose.

---

## 8. Garment cards, and who owns a body fact (fable-1312)

1. **Garment pieces are WARDROBE CARDS on the Wardrobe path** — their own panel
   section, **derived from the stored line** (phrase per piece, crop where the
   scan finds one), never mixed with body features. Editing a garment card
   rewrites the line, which is §7.1's road and not a second one. Their crops may
   ride the signed views the way delivery crops do — the intended answer to
   irregular-garment drift (the caveman's hide across six angles).
   **The judge still checks the full line**, and that is the point: a crop is how
   the view is TOLD, the line is what the view is JUDGED against, and they come
   from one owner so they cannot disagree.
2. **Body-fact ownership splits by path, and no capability is claimed twice.**
   On **Basics**, build · skin · scars · ink are MEASURED — detected, cropped,
   carded from the picture, because the body is in the frame. On **Wardrobe**
   they are carried where visible (words, plus the dressed torso crop that
   already carries build) **without a measurement claim.** That is not a
   collision with the analyser; it is a split of what each path can honestly say
   it can see.
3. **Discovery still mints nothing into a recipe** (1297 §4). A garment card's
   carry into the views goes through the wardrobe property, never through the
   analyser.

---

## 9. The tally — a refusal nobody counts is a demand signal thrown away

Hidden-surface ink on a Wardrobe cast is refused with what acts (neck or an upper
arm now, or recast in Basics) — and the refusal is **counted**, on the
`casting_ink_form_demand` pattern (`shared/inkFormDemand.ts`,
`server/db/castingV2InkFormDemand.ts`):

- **The column list is the privacy boundary**: `placement`, `pathAtRefusal`,
  `outcome`, `createdAt`. Not the account, not the cast, not the design —
  **absent from the row rather than omitted from a projection.**
- **It may never block the answer.** Fire-and-forget, fails soft and loud, cannot
  reject. A missing table costs the tally and never a customer's sentence.

⚠ **And the lesson from the ink form demand table rides with it**: that tally has
counted **nothing** since its only call site went behind a deferral
(`MANNEQUIN_ROAD_DEFERRED`), and nobody noticed because a tally that writes
nothing looks exactly like a demand of zero. **So this one lands with an arm that
proves the write happens on the refusal path itself** — driven through the
refusal, not through the writer.

**Recommendation: reuse `casting_ink_form_demand` with a widened `kind` rather
than a second table.** It is the same question (*what did we have to refuse, and
how many people wanted it*), and a second table is a second thing to read.

---

## 10. The flag

```
CASTING_TWO_PATHS_SCOPE     off | all | users:<ids>      parent: CASTING_V2_SCOPE
```

- **Off, and absent means off**: no toggle is rendered, no path is written, every
  roll composes the wardrobe sentence exactly as it does today, `wall_stage`
  answers every garment ask, and not one line of the new road runs.
- **Parent is `CASTING_V2_SCOPE` and nothing narrower** (§B7). This is the roll,
  and the roll is spendable surface at `all` — unlike every sub-flag on the
  refine road, whose parent is the repaint scope. The WARDROBE SUBJECT inside it
  is `repaintOnly` by its card, so the refine half is gated a second way by the
  card rather than by a second flag.
- **No new environment requirement**: no stored bytes, so no cleanup worker; no
  new transport, so `assertFalBudget`'s ceiling arithmetic is untouched; no new
  engine call, so no new house cost per roll.
- **Named prerequisite of the FLIP**: the `path` / `wardrobeLine` columns must
  exist (§3.2) — and that one is a prerequisite of the CODE, which is stricter.

---

## 11. The court — bounds, price, and it is staged

**Everything on dev, on the outsider fixture, nothing on production.**

| arm | what it buys | credits |
|---|---|---|
| 1. Wardrobe sheet — the caveman | the engine's pick under house taste on the hardest type; eight candidates in ONE outfit | 160 |
| 2. Basics sheet — an ordinary brief | the basics spec at the frames; is the chest bare, does the sports top sit as specified | 160 |
| **stop, read the frames, report** | | **320** |
| 3. Sign the caveman | irregular-garment drift across six judged views; the judge reading the stored line | 450 |
| 4. Sign the Basics cast | basics across six views, and whether a chest piece can now honestly ride | 450 |
| | **total** | **1,220 dev credits** |

**Staged deliberately** (fable-1331 §3's discipline): a sheet that fails does not
buy a Sign. Frames read at full resolution, ledger read in the sitting, and the
frames go to his desk — **his eyes, then widen** (§B7). Law 9: no verdict here
closes on a reader's prose.

**What arm 4 is really measuring**, said plainly so it is not oversold: whether
`placementRidesPackageViews` derived from the line delivers a visible chest piece
across six paid views, or whether the wardrobe axis refunds slices the way it did
on the crew neck. That is a real risk and it is why the arm exists.

---

## 12. What this design does NOT do

- It does not change the roll framing (§5.1). Waist-up stays waist-up.
- It does not open the SHOOT. Backdrop, set, props and location keep every wall
  they have.
- It does not touch `age.older` or `guard.compliment` — the other `wall_stage`
  meanings stay their own card.
- It does not widen `INK_PLACEMENTS`. Basics unlocks the third member; it adds no
  fourth.
- It does not add a vision read. Nothing here asks a reader what she is wearing —
  the line is what we WROTE, which is the whole reason it can be trusted.
- It does not move `identityClause`'s five nouns. The clause is measured prose on
  a live lane and a court's variable (opus-941); this design hands the render the
  garment as a stored fact instead.

---

## 13. Carried conditions, and what needs his word

**Carried in from the ruling (§B8): master-born ink cannot be removed by
repainting from the master.** The Basics path is what CREATES that population —
today 0 of 37 masters carry ink (roadmap §10 item 2), and a Basics cast whose brief asks
for a chest piece is born wearing one. **The sitting that ships births-with-ink
designs that removal**, and until it does, a Basics cast born with ink must not
be offered a removal it cannot perform.

**A straggler of the ruling, swept and CORRECTED IN THIS SITTING rather than
carried.** `inkViewReferences.ts`'s `RIDES_PACKAGE_VIEWS` docblock still queued
*his hidden-vs-scoop word and the court that follows it* as the thing that lifts
the chest — a question 1311 replaced rather than answered. The roadmap had been
made current (§3d is marked RETIRED with the record kept); **the code the next
person actually reads had not**, which is the mirror law exactly. Corrected
here, prose only, no behaviour moved. What remains carried into the build is the
DERIVATION — the table becoming a fact about the wardrobe instead of about the
placement (§5.2).

**The four questions, ✅ RULED at countersign (fable-1334 §3) — kept with their
answers rather than deleted, because the reasoning is the record:**

1. **Flag name** — ✅ `CASTING_TWO_PATHS_SCOPE`. It is what everyone calls it and
   what the roadmap item is named; house style otherwise names the capability
   (`CASTING_WARDROBE_PATH_SCOPE`). **The findability ground won**: a reader of
   the variable finds the ruling.
2. **`casting_ink_form_demand` widened vs a second table** (§9). ✅ **WIDEN**,
   with §9's driven-through-the-refusal arm as a condition of the landing.
3. **Where the picked outfit is first seen.** He ruled it shows on the sheet, so
   *shown on the sheet* is also *shown after 160 credits*. **Showing it earlier
   is not a copy change**, and the product already knows why: the brief is
   compiled INSIDE roll creation, so anything the echo says before the money
   needs *"the brief compiled at echo time — a second text call, before anyone
   has paid"* (`CastingSheet.tsx`, the variance-confession note, which is the
   same problem one feature earlier). Recommendation: ship as ruled; a pre-roll
   echo is its own item and it would fix both lines at once, not a rider on this
   one. ✅ **SHIP AS RULED**; the pre-roll echo is banked as its own item.
4. **The court's price** — 1,220 dev credits, staged 320 then 900. ✅ **THE 320
   IS GRANTED** with the countersign; the 900 is held until the sheet frames are
   read. **All of it waits behind the ceremony and the dark code** (§3.2).
