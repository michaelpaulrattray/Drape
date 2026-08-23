# §6 THE TOGGLE — evidence pack and copy audit

**The UI milestone completion contract** (founder, 2026-08-01): no UI milestone
reaches the founder gate without side-by-side screenshots per surface in both
themes plus a copy audit classifying every user-visible string. This is that
pack for §6 of `CASTING_V2_TWO_PATHS_DESIGN.md` — the last slice of roadmap
item 5 (THE TWO PATHS), built 2026-08-24.

Everything here ships **dark** behind `CASTING_TWO_PATHS_SCOPE`, which is `off`
on production. The pack's negative controls are what make that a reading rather
than a claim.

⚠ **THIS PACK'S OWN STANDING RULE, adopted fable-1490: a pack that stops matching
its surface is worse than no pack.** A copy change on a surface photographed here
re-shoots it in the same commit — the driver run is free — rather than leaving a
document describing a sentence the product no longer says. ⚠ **AND THE RULE NOW
COVERS THE COUNT AS WELL AS THE FRAMES (extended fable-1517 §2, from the
opus-1166 reading): a surface ADDED to this pack updates the count under the
table in the same commit.** That clause exists because the rule's first form was
obeyed perfectly by the two commits that broke it — `484da735` and `40a3c160`
each added a surface and re-shot it correctly, and each edited the count's
mirrors *four lines away* without touching them. "Self-evident to whoever is
editing the table" is precisely what those two commits disproved.

---

## 1. The surfaces, and how they were photographed

Two kept drivers, both of which **spend nothing** — no roll, no refine, no
sign, no segmenter read. The face scan is held at the wire and each declares
its house-money line.

```
scripts/drive-two-paths-evidence.mts        the toggle, the record line, the
                                            switch, and both controls
scripts/drive-two-paths-panel-label.mts     §6.1's "as dressed" label
```

| # | frame | what it shows |
|---|---|---|
| 1 | `1-lobby-wardrobe-{dark,light}.png` | the lobby control at rest — `PATH · Wardrobe | Basics`, Wardrobe chosen, its own line beneath |
| 2 | `2-lobby-basics-{dark,light}.png` | Basics tapped: the choice moves and the line follows |
| 3 | `3-lobby-unflagged-{dark,light}.png` | ⚠ **CONTROL** — an account outside the flag. Nothing |
| 4 | `4-sheet-wardrobe-{dark,light}.png` | `WARDROBE · a rough animal-hide wrap … · engine's pick` — the RECORD, read back in history, with no switch beside it |
| 5a | `5-sheet-resting-{dark,light}.png` | the switch AT REST on a PATHED live sheet — the pills as a LABEL, silent, with the record line saying the same thing in words |
| 5b | `5-sheet-switched-{dark,light}.png` | the same switch moved off the sheet's path: *"Roll again casts on Basics."* |
| 6 | `6-sheet-basics-{dark,light}.png` | `BASICS · a plain black sports top scooped low at the chest …` |
| 7 | `7-sheet-unpathed-{dark,light}.png` | ⚠ **CONTROL** — a roll cast before the paths existed: no record line, and the switch drawn with a note that never falls silent |
| 8 | `8-panel-{wardrobe,basics}-{dark,light}.png` | §6.1's label, present on one path and absent on the other — and, on an account OFF the repaint road, the ask box's sentence unchanged |
| 9 | `9-askbox-{wardrobe,basics}-{dark,light}.png` | the ask box on an account WITH the repaint road: *"Anything about them, including what they're wearing — not the room"* on Wardrobe, and today's sentence on Basics |

Frames live in `output/two-paths-toggle/`.

**24 frames — 12 surfaces × both themes.** ⚠ **THE ARITHMETIC IS THE POINT, not
the total** (ruled fable-1517 §1): a bare *"24"* here is a new mirror one step
closer to its source, while `12 surfaces × both themes` is checkable at a glance
against the table directly above it by the one person who can — whoever is adding
a row. **This is the only place the count is stated.** `CLAUDE.md`'s flag
paragraph and `POST_SIGN_ROADMAP.md`'s item-5 block both used to restate it, and
both had drifted — to 18 and to 16 — for a pack that held 24; they now name this
document and carry no number, which is law 4 on a prose surface. Do not re-add a
count to either.

### ⚠ Two things this pack is honest about

**Frame 8's library row is PLANTED.** No cast on either path has ever been
refined in dev, and `facePanel`'s own rule is *no box, no row* — so there was no
`build` row to draw. What is planted is exactly what a paid build edit would have
written; what is REAL is everything the label depends on: the catalogue's
`pathProvenance`, the one wardrobe owner's resolution, the server projection, the
component and the stylesheet. The driver refuses to start if such a row already
exists and deletes what it planted in a `finally`. Declared under the fidelity
law rather than presented as a live reading.

**Every state of the control is now photographed**, including the one that was
missing when this pack was first written: the switch RESTING on a sheet that has
a path. It took a live pathed roll to exist, and none did in either world — the
court session's newest was the bald acceptance roll, cast before the flag. Arm 3
of the Two Paths court created one (2026-08-24, 160 dev credits), and the same
roll bought §10's covering-garment reading. **One spend, two authorized items;
they wanted the same artifact from opposite ends.**

⚠ **And the fixture moving under it taught this pack its own repair.** Surface 5
was pinned to *"the latest roll"*, so the moment a court bought a new one the
driver asserted *"Nothing was chosen for these eight"* against a sheet that had
just been given a path. **A surface pinned to whatever is newest is pinned to
whatever the last court bought.** Surface 5 now names the pathed state and
surface 7 owns the unpathed one, on a session that is unpathed by construction.

**Surface 9 is the same walk run twice, against two different accounts**, and
that is what makes it a reading rather than a demonstration. The ask box's line
is a JOIN of two facts — the account's garment gate and the cast's path — so
three of its four cells must show today's sentence and exactly one must show the
new one. Frame 8 is the walk with the gate SHUT (both paths keep the old
sentence, which is correct for that account); frame 9 is the same walk with the
fixture inside the repaint scope, where Wardrobe says the capability and Basics
still does not. The driver ASSERTS which it expects rather than reporting what it
found: a run that asks for the new sentence and meets the old one fails.

**⚠ And frame 5 cost this pack a lesson at the pixels.** The first version of
it photographed BOTH pills mid-transition — the chosen one part-way to black,
the other part-way back to transparent — because `.dp-scopepill` fades its
background over `--t-fast` (120ms) and the screenshot landed in the next frame.
The computed style read 200ms later said *solid*, so **the reading and the
picture disagreed and the picture was the one going to the founder**: a mid-grey
"selected" pill reads as a styling defect that is not there. Caught by cropping
the frame at 2× and reading the actual bytes rather than trusting either. The
driver now settles on two consecutive stable samples of every pill's computed
background before it shoots.

---

## 2. The copy audit

Every user-visible string this milestone introduces, classified. **The design's
§6 copy block is the "prototype" here** — there is no HTML prototype for this
surface, so "design-verified" means *lifted verbatim from a countersigned
design*, and "invented" means *written in this sitting and owned by it*.

| string | where | class | provenance |
|---|---|---|---|
| `PATH` | the toggle's eyebrow, both surfaces | **invented** | the TRY row's own chrome idiom, one control across. A machine-ish label beside a control, never a sentence — which is what lets it be set in mono |
| `Wardrobe` | pill, and the record tag | **design-verified** | §6's copy block; the founder's own word (fable-1311, *"this is the way foward 100%"*) |
| `Basics` | pill, and the record tag | **design-verified** | as above |
| "Born and signed dressed. Tattoos land where the outfit shows skin." | under the lobby pills when Wardrobe is chosen | **design-verified, verbatim** | §6's copy block |
| "Born and signed in plain black basics. A clean body record — a chest piece works here, and try-on starts from a clean base." | under the lobby pills when Basics is chosen | **design-verified, verbatim** | §6's copy block, and it is already the CORRECTED line — §5.1 struck *"tattoos anywhere"* because the roll frame is waist-up. An arm in `castingPathCopy.test.ts` refuses either line containing the word |
| "· engine's pick" | the sheet's record line | **design-verified** | §4.1(1) names the label verbatim — *she is never told she asked for it*. Composed from the server's own `enginePicked`, never decided in the client |
| the wardrobe line itself | the sheet's record line | **not copy** — it is the cast's own stored sentence, through the one owner |
| "Roll again casts on Basics." / "… on Wardrobe." | the re-roll box, once the switch leaves the sheet's path | **invented** | modelled on the FOLLOWING chip's *"Roll again keeps this family"*, which is the same job: saying what the next paid action will do while it can still be changed |
| "Nothing was chosen for these eight — Roll again casts on Wardrobe." | the re-roll box on an UNPATHED sheet, always | **invented** | ruled fable-1483 ASK 1(b). It names the ABSENCE first and the plan second, and that order is the whole sentence: the pills over a pathless sheet are a label of nothing, so the line has to say so before it says what comes next |
| "Basics sheets are cast in plain black basics — roll again on Wardrobe to have the outfit you described." | the sheet's notice slot, Basics path, when the brief named clothes | **invented** | replaces a sentence that is FALSE on this path. It names a road that ACTS — the re-roll box's own switch — rather than a road that merely exists (D-180) |
| "Anything about them, including what they're wearing — not the room" | the ask box, on a Wardrobe cast whose owner is on the repaint road | **invented** | ruled fable-1490. It replaces a sentence that becomes FALSE on day one, and it SAYS the capability rather than merely dropping the denial: the line's job is disclosure before typing, and a panel showing garment rows beside a sentence that ignores them is the contradiction being removed. Every other cell keeps today's sentence byte for byte |
| "as dressed" | the panel's `build` and `skin` rows, Wardrobe path | **design-verified, verbatim** | §6.1. ⚠ A LABEL AND NEVER A HEDGE: the row is not less accurate on Wardrobe, it is accurate about something smaller. `referenceSlotCatalogue.test.ts` refuses the words *approx · roughly · we think · may be · might · unverified · estimate* on it |
| "How this cast is born" / "How the next roll is cast" | the two groups' accessible names | **invented** | not read by eye; they are what makes a pair of pills one question for a screen reader |

**Nothing was carried over unexamined**, and one string was DELETED from a
path rather than adapted: `STATED_WARDROBE_NOTICE` no longer fires on the
Wardrobe path at all, because her outfit wins there and the confession would be
about something that did not happen (§3).

---

## 3. The stated-outfit notice — three cells, and the middle one is silence

The defect this milestone had to fix, found by reading the projection rather
than by a report: `statedWardrobe` is computed unconditionally from the brief
text, so a pathed sheet that named an apron was told *"casting sheets keep the
studio tee"* while rendering the apron.

```
unpathed   today's product exactly, unchanged. Every roll in production
basics     a new sentence — her instruction really WAS set aside, because the
           path IS the outfit and a brief cannot negotiate it
wardrobe   SILENT — §4(a), her words win. What she gets instead is the record
           line, which describes the picture she is looking at
```

⚠ **The suppression covers one cell in silence, stated rather than quietly
closed.** A stated outfit can still be REJECTED on the Wardrobe path —
`wardrobeDoor` refuses props, weapons, headwear and printed text on case (a) as
well as case (b) — and `bornWardrobeLine` falls back to the house line. That
sheet says nothing here. No fourth sentence was invented for it: the cell has no
measured population, and what would answer it is a server-side fact (*she stated
clothes and the resolved line is the house default*) computed where both terms
live, not a client comparison against a constant the client would have to be
handed.

---

## 4. What is NOT proven, and why

✅ **CLOSED 2026-08-24.** The switch resting on a pathed sheet is frame 5a, and
the record line beside it reads `WARDROBE · a plain dark suit jacket over a
white collared shirt, dark tailored trousers, black leather dress shoes ·
engine's pick`. The 160 that bought it also bought §10's covering-garment
reading.

**What this pack still does not prove** is narrower and is stated rather than
left to be discovered: every frame here is a DEV fixture on one account, so the
pack evidences the control's behaviour and not its behaviour at scale; and the
§6.1 label rests on a planted library row, as §1 says.

**⚠ The rule that made that gap was itself the finding, and it changed.** The
first build hid the switch on every unpathed sheet, on
`shared/castingPaths.ts`'s argument that *the absence must never become a
member*. Ruled otherwise (fable-1483 ASK 1(b)) on the distinction that decides
it: **that argument protects the ROLL'S RECORD, and this control is a statement
about the NEXT roll.** So the two halves part company — the record line stays
absent on an unpathed sheet, and the switch is drawn there with a note that
never falls silent. The case is day one rather than hypothetical: every existing
customer's sheets are unpathed when the flag opens, and the lobby would otherwise
be their only door.

✅ **`RefinePanel`'s meta line — FIXED 2026-08-24** (ruled fable-1490), and it
is surface 9. It said *"Anything about them — not their clothes or the room"*
four lines under the panel's new WARDROBE section. Checked at the code before it
was believed: the wardrobe subject is `admittedOn: "repaintOnly"`, so a garment
ask needs an account on the REPAINT road AND a cast on the Wardrobe path — a
population empty in both worlds today, which the flip creates on day one.

The client's only handle on the second term was `config.stepBackEnabled`, a gate
named for the version chip's *take this step back*. It got a real one instead —
a sixth config gate named for what it decides — because **one gate answering two
questions under one of their names is how the two drift** the day the wardrobe
subject is promoted off `repaintOnly`. The panel joins the two facts and decides
neither, and its props default to claiming nothing.

---

## 5. The mechanizable laws, as assertions

Written as browser-drive checks rather than as review memory, per the milestone
contract:

- the toggle is **absent** outside the flag — not disabled, not hidden: zero
  `.dpc-paths`, zero disabled pills, and the word *Basics* nowhere on the page
  (D-180: a disabled toggle is a question with no answer wearing a tap target);
- exactly **one** pill is chosen, and at rest it is `Wardrobe`;
- the `PATH` tag **is** mono and the line under it is **not** — the mono law's
  line falls exactly between a machine label and a sentence;
- neither path line contains the word *"anywhere"* (§5.1);
- the record line's tag follows the roll being READ, so walking the rail changes
  what the sheet says it is wearing;
- switching the dock's path does **not** move the sheet on screen — rolls are
  immutable and the switch is about the next one;
- on an **unpathed** sheet the record line is absent AND the switch's note
  speaks — both halves in one frame, because either alone is the wrong product.
