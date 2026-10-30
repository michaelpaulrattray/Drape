# THE REFERENCE SELECTOR — BUILD DESIGN (#14)

*Written 2026-10-28 by the escalated Fable seat, under three of the founder's
own words from the same day: his goal (**"1 and 2 is the goal"** — #2736 is
road 1, this is road 2), his law (**"the selector should not be confined to a
set list … the image is analyzed and features are determined that way"**), and
his original behaviour spec (2026-08-25, quoted in full on #14). This is the
build design `OPEN_LANE_REFERENCE_SELECTOR_DESIGN.md` §5 said was owed, with
the one named tension answered in its first section. **It decides the build's
shape. It does not open the build**: the mock accompanies it to his eye, and
nothing is cut into slices for a seat until he has seen the surface
(the UI contract). Status: design — nothing here is built.*

*Every claim about what exists today was read at `origin/main` on 2026-10-28
and is cited to a file. The parent design's six rulings (fable-1505 §1) are
inherited except where one of his later words retired one, and each such
retirement is named.*

⚠ *AMENDED 2026-10-31 (the escalated Fable seat, on card #14's held design
decision): **the surface is the SPOTLIGHT, not the markers** — §0 below carries
the decision, his words and the court's numbers; §§1, 3, 4, 6, 8 and 9 carry
their amendments inline, struck never deleted.*

---

## 0 · AMENDED TO THE SPOTLIGHT — 2026-10-31, on his eye

**His eye, 2026-10-30, on a private prototype built from this card's spotlight
court output (chat, verbatim): *"I WOULD SAY I LIKE THIS MUCH BETTER THAN THE
BOXES THOUGH"* — recorded on #14 as *"Taken as the direction, with spotlight
over boxes in both the picker and the face panel."*** His earlier eye on the
marker mock (2026-10-29, verbatim: *"i think it reads well enough for now
aslong as we get the tech working i can refine the design later"*) passed that
mock as it stood; the later word is a direct comparison of the two surfaces,
and the comparison wins. His own proposal, the same day, is the interaction
spec: *"what if instead of boxes it worked exactly as pinterest works it sort
of highlights the piece your mouse is over and darkens the rest? for the
reference picker does that help the design?"*

**So slice 3 builds the spotlight**: the attached picture is split into pieces
once; the piece under the pointer lights while the rest darkens; a tap takes
the piece under the finger. There are no named markers on the picture any
more — **the name is read from the TAPPED cut and lands on its chip before any
money moves**, which keeps §1's law-9 property intact in the same strength.

**The road is measured, not believed** — the spotlight court ran 2026-10-30
(`relay-agent-14spot`; the full verdict with every number is a comment on #14;
≈$0.31 house): a 32-point SAM 3 grid in ONE call (`fal-ai/sam-3/image`, point
prompts, empty text prompt) splits a photo into pieces that light whole
garments — 7 of 9 things garment-level, 4.3–6.6 s typical and 52.3 s once,
≈0.5¢ a photo; a single SAM 3 POINT at the tapped spot cuts the right piece
8 of 9 (1.1–3.8 s, ≈0.5¢ a tap); and today's reader names a whole-thing cut
8 of 8 (one text call per tap on the cut on flat grey, 1.5–4.1 s,
0.05–0.23¢). **A spotlight is buildable on SAM 3 and is not buildable on the
split alone** — the split lights, the point cuts, the reader names: three
calls with three different jobs.

**What the spotlight dissolves — the two problems that made slice 3
unstartable as written:**

- **The streaming problem is gone.** The marker road bought one ~13 s detect
  per name, sequentially — 169 s for a 12-marker picture — and slice 3 owed a
  per-marker transport nobody had designed. The split is ONE call; hover is
  then a hit-test in the browser and costs nothing. No operation rows, no
  polling, no transport architecture.
- **#2787 never reaches this surface.** Two names arriving on one identical
  box was the marker road's collision; with no per-name boxes drawn there is
  nothing to collide. (#2787 stays open and `blocked` — the per-name detect
  still serves the words-only take, #2736's road.)

**What it does NOT dissolve — three hazards, measured in the same court, each
owned below:**

1. **Small things are not in the split.** The earring and the necklace had no
   piece of their own, so hover cannot show them. A tap is therefore honoured
   wherever it lands, lit or not: the point cut found all four worn things,
   earring and necklace included (4 of 4, IoU 0.985 / 0.943 / 0.901 / 0.893).
   §3 carries the rule.
2. **The face must never light.** Hovering jewellery or hair lit the whole
   person, face included, in both split methods. The likeness fence now binds
   the HOVER SET, not only the cut — §6 carries the rule.
3. **Part or whole.** A point returns whatever part is under the finger (the
   belt's keeper alone, honestly named *"leather strap"*; a second tap on the
   strap returned the whole belt at 0.958), and lapels, cuffs and toe caps
   come back as their own pieces. The clean-up handles the hover half; the
   chip's honest name and a second tap handle the tap half. §3 carries it.

**And one obligation is his, verbatim:** *"Whoever builds slice 3 owes that
clean-up as part of the split, measured on the court's fixtures."* It is the
no-extra-call post-process his prototype carries — keep each piece's main body
(components of at least 10% of its largest); give a pixel two pieces claim to
the one it sits deeper inside; fill holes under 2% of the piece — and it
answered his own question on the frame (why the jacket lit part of the scarf):
the raw masks speckle on textured knits, and one point's mask leaked onto the
neighbouring piece.

**What this amendment does not change:** the no-words tap is still a complete
ask (§1 — the noun arrives at tap time instead of attach time, and the
customer still sees it before the spend); no fixed list anywhere (§2); the
fences (§6); the flag, its chain and its off-until-the-surface-exists position
(§9); slices 1 and 2 as shipped history; slice 5 and the #2736 seam. **His
word is the direction, not yet a formal yes on a built surface** — slice 3's
evidence pack goes to his eye, and #14 still closes only on his eye on a real
tapped edit on his own account.

---

## 1 · THE NO-WORDS TAP — the owed first section, answered

**The tension as fable-1505 left it:** a tap with no typed words is a complete
ask for the WHOLE LOOK of the tapped thing (his ruling, 2026-08-21, verbatim:
*"if you tap the hair and dont type how to apply it — it should think you want
the entire hair look"*) — but a bare tap has no sentence to take the noun
from, and everything downstream wants a noun. Three shapes were tabled and
none chosen: a bounded reader that routes, an ask-back chip, or a subject
recorded from the mask.

**The answer: move the reading to ATTACH TIME, and make it visible.** The
moment the customer attaches a picture, the picture is READ — the discovery
shape #2566 already built (`faceDiscovery.ts`: open vocabulary, short bare
nouns, counts, no catalogue) — and each found thing becomes a **named, visible
marker on the picture**. A tap is therefore never a raw point the product has
to interpret: it is the customer choosing one of the things the picture was
already read to contain, **with its name already attached**. The no-words tap
carries its noun with it by construction.

Why this is the right resolution of the three tabled shapes rather than a
fourth one: it IS the bounded-reader shape (a reader's verdict routes, never
refuses — fable-1075's precedent), with the read moved in front of the
customer's eyes **before any money moves**. The customer sees the marker, sees
its name, and taps it or doesn't. Law 9 is satisfied in the strongest form
available: a human eye — theirs — sits between the reader's naming and the
spend. A wrong name costs nothing and walls nothing: the customer can ignore
the marker and type words instead (Q1's SUPPLEMENT ruling, unchanged), and
the geometry of what they tapped — their own choice — is what is cut, whatever
the label said.

~~**What dies with this answer, and it is a saving:** the parent design's §3
point-prompt dependency — the one fact it leaned on hardest and marked
*documented, not driven* — is **not needed**. A tap selects a found region,
and the found region's box goes to the segmenter through `regionInBox`
(`falRegionReader.ts:1375`), which #2532's bench measured and #2692 built.
The $0.03 confirm-the-schema probe from §3 is cancelled; the road a tap takes
is already driven.~~

⚠ **The paragraph above reversed with the spotlight (§0, 2026-10-31): a tap IS
a point prompt now.** It held only while a tap selected a pre-boxed marker.
What the parent design marked *documented, not driven* is now DRIVEN: the
spotlight court measured a SAM 3 point cut at 8 of 9 garment-level, so the
dependency returns with numbers instead of a belief, and no $0.03 probe is
needed either way. **What §1 actually decides holds unchanged**: the no-words
tap carries its noun by construction, and a human eye — the customer's — sits
between the reader's naming and the spend. The noun is read from the tapped
CUT (8 of 8 on whole-thing cuts) and lands on the chip they see before they
press Refine; the only thing that moved is WHEN the name is bought — at tap
time, for the one thing tapped, instead of at attach time for everything.

---

## 2 · NO FIXED LIST — what his 2026-10-28 word changes, at the code

> *"the selector should not be confined to a set list nothing should be
> confined to a set list thats the old way of doing things the new way is the
> image is analyzed and features are determined that way right?"*

- **Q3's "INSIDE THE FOUR FIRST" is retired** (it was fable-1505's, and his
  word outranks it). The selector does not route through
  `REFERENCE_INTENTS` (`shared/referenceIntents.ts`). What a marker names is
  the discovery read's own bare noun — a jacket, earrings, a tattoo, a
  hairstyle, horns, a prop — whatever the picture holds.
- **The intent map is not deleted; it is demoted to what it really is**: the
  record of the RULED ingestion forms for four known classes, and the home of
  his rule that decides every new class — *"things which would carry fine as
  words alone … stay as words but specific looks and feature must always ride
  as cropped refrences"* (fable-1047). The selector applies that rule as a
  property, not a lookup: **a tapped thing rides as its CUT** (a tap means
  "this exact look", which is precisely what words drift on), and the
  customer's sentence may narrow it to words-scale taking (*"use the hair
  color only"* → the colour reads as words, today's live hair-colour road,
  `hairColourFromReference.ts`).
- **Q5's honest refusal is re-derived, because its premise moved.** The
  parent design specified a refusal derived from `openReferenceIntents()` —
  *"I can't take a nose from a photo yet…"*. With no fixed list there is no
  enumerable can't-list to recite. The honest sentences are now two, and
  neither names a vocabulary: while reading, the surface says what is
  happening (*"Reading your picture…"*, naming no catalogue — the exact
  defect his finding 1 on #2566 caught in the cast panel's loader);
  and when the reading finds nothing takeable, it says so and leaves the
  words road open: **"We couldn't find anything in this picture to take.
  You can still describe what you want in words."** Nothing is charged for
  either. ⚠ *(2026-10-31: under the spotlight the attach-time trigger for
  that second sentence mostly disappears — an empty or failed split fails
  open SILENTLY to the words road, because a tap still works anywhere. The
  sentence survives where it is still true: a TAP whose cut the judge refuses
  gets it, which is #2565 slice 2's holes-mean-words rule wearing this
  surface's copy.)*
- **The `casting_reference_crops` mint (Q2's row) needs one schema change.**
  The table (migration 0040) has never held a row; its `intent` column is
  `enum('hair','eyeColour')` — a fixed list in the one place the open road
  must record an open noun. The design: the subject column becomes
  `varchar(64)` holding the marker's bare noun (the `region` column already
  holds "the segmentation question that drew the cut", which on this road is
  the same noun; the migration may simply widen `intent` or fold the two —
  the builder picks the smaller diff). ⚠ **This is a column MODIFY on an
  empty table**: the rite's auto-apply refuses non-additive statements, so it
  lands as a relay-run ceremony with the zero-rows reading quoted in the
  receipt (`SELECT COUNT(*)` both worlds, before and after).
  `referenceCropSchema.test.ts` moves in the same commit — it currently pins
  the enum to the crop-form intent members, which is law 4 serving the old
  premise.

---

## 3 · THE SURFACE — what the customer sees ~~(the mock shows this)~~

⚠ *(2026-10-31: the marker mock no longer shows this surface — the visual
reference is the spotlight prototype he preferred, built from the court's
pieces; his refine-later word covers the visual polish.)*

The attach door does not move: one `+` beside the ask box, any picture, no
label naming a feature (`referenceAttachCopy.ts`'s own ruling). What changes
is what happens after the picture lands.

⚠ **AMENDED 2026-10-31 (§0): items 1–3 below are struck and replaced by this
block; items 4 and 5 stand unchanged.**

1. **The picture opens large the moment it is attached** — his spec's own
   verb: *"upload it it appear and like a pinterest style selector"*. While
   the split runs, the only words on it are honest progress: **"Reading your
   picture…"** — no catalogue names, no skeleton rows (his #2566 finding 1).
   The split is ONE call, 4.3–6.6 s measured (52.3 s once, on the provider's
   bad minute); a split that fails or stalls leaves the picture exactly as an
   attach looks today — words road untouched, nothing charged, nothing said
   about machinery (§4's fail-open property, inherited).
2. **The piece under the pointer lights; the rest darkens.** His sentence is
   the spec. No boxes, no dots, no labels painted on the picture. The lit
   geometry is the cleaned split piece (§0's owed clean-up), faces never
   light and the whole-person piece never lights (§6), and tiny fragments
   never light. On a touch screen there is no hover: the first tap lights the
   piece, a second tap takes it.
3. **Tap to take; tap again to let go.** A tap is honoured wherever it lands,
   lit or not — small things (an earring, a necklace) have no split piece and
   are still cut correctly by the point under the finger (4 of 4 in the
   court). On a tap the piece is cut (one SAM 3 point), cleaned and judged
   (`cutQuality.ts`, consumed never rewritten), faces subtracted in the
   bytes, and NAMED — one text call on the cut — and a chip with that name
   appears above the ask box, the same row the attached-picture chip already
   lives in (`RefinePanel.tsx`). **The chip says what was actually cut**: tap
   the belt's keeper and it honestly names the small thing it got; tap
   elsewhere on the belt and the whole belt comes (0.958 on the court's
   second tap). The chip shows the cut piece at about 2 s and its name when
   the reader answers, 2–4 s later. **Several taps on one picture is the
   first ship** — his spec sentence is literally *"i click the hair and
   earrings"*, so Q6's owed question stays answered YES for multiple TAPS;
   the ONE-PICTURE ruling itself is unchanged and the copy still says it.

   **One property the marker road had that the spotlight trades away, named
   rather than glossed:** the reading never marked scene things, because it
   was only ever asked about the person or the item. A split does not know a
   wall from a jacket, so a background piece can light on hover. The first
   ship accepts that: a tapped scene piece is cut, honestly named, and the
   ask meets the same scenery wall the words road has — Refine changes the
   person, not the shoot, and the refusal says so. If his eye finds lit
   backgrounds noisy on the built surface, the repair is design polish under
   his refine-later word, never a pre-naming pass — naming every piece up
   front would re-buy the per-name economy the spotlight just retired.

   **The whole-OUTFIT take moves to slice 5**, where garment identity exists
   (the named cuts, through the #2736 seam): the split does not know which
   pieces are garments until they are tapped and named, so a pre-named
   *Outfit* group on the split would be a guess. Piece taps serve *"wear this
   jacket"* from the first ship; *"put them in this whole outfit"* stays his
   sentence and lands with the seam.

~~1. **The picture opens large the moment it is attached** — his spec's own
   verb: *"upload it it appear and like a pinterest style selector"*. While
   it is being read, the only words on it are honest progress: **"Reading
   your picture…"** No catalogue names, no skeleton rows (his #2566
   finding 1).~~
~~2. **Found things appear as small round markers ON the picture** — the
   Pinterest affordance — each with a short name in the customer's own
   vocabulary (the discovery read's bare noun: *Hair*, *Jacket*, *Earrings*,
   *Neck tattoo*). Markers appear as they are found rather than all at once.
   **The face gets no marker, ever** (§6). Scene things get no marker: the
   reference reading asks what is on the person or what the standalone item
   is, never what the room holds — Refine changes the person, not the shoot.
   Garments mark **per piece** (*Jacket*, *Top*, *Belt*) under one quiet
   *Outfit* group affordance that selects all of them in one tap — piece
   taps serve *"wear this jacket"*; the group tap serves *"put them in this
   whole outfit"* (both are his own sentences, #2736).~~
~~3. **Tap to choose; tap again to let go.** A chosen marker gets a selected
   ring, and a chip with the same name appears above the ask box — the same
   row the attached-picture chip already lives in (`RefinePanel.tsx`).
   **Several taps on one picture is the first ship** — his spec sentence is
   literally *"i click the hair and earrings"*, so Q6's owed question is
   answered YES for multiple TAPS; the ONE-PICTURE ruling itself is
   unchanged and the copy still says it.~~

4. **Then they speak, or they don't.** Say nothing and press Refine: the
   full look of each chosen thing applies (§1). Type — *"use the hair color
   only"* — and the words scope what is taken from the chosen things (Q1,
   SUPPLEMENT). Words with no taps keep working exactly as today.
5. **What is deliberately NOT on the surface:** no strength slider, no mode,
   no per-feature menu, no "which engine", no percentage, no confirmation
   step. One picture, named markers, taps, the box they already know. The
   price of the edit is the Refine price they already pay; **a tap costs no
   credits** (a tap is not a render).

---

## 4 · THE ENGINE ROAD — mostly built, read at the code

⚠ **THE STATE COLUMN DECAYED IN ONE DAY, AND TWO ROWS ARE CORRECTED HERE
(2026-10-30, #2827, re-read at `origin/main` `294cfe97a`).** The design is
right as of its own date — the header says every claim was read on 2026-10-28,
and #2565 slice 2 and #2736 slice 2 both landed on the 29th. **Why it was worth
a card rather than a shrug: both corrected rows said UNBUILT of something that
is live, and a slice-4 builder reading them would have built a second copy of
each — the one thing §5 and #2736 both forbid.**

**The other six rows were re-read at that same commit and all six hold**:
attach `users:1`; boxing (#2692) and tap→cut (#2566 slice 2) built;
`casting_reference_crops` still a table and a purge path with **no writer of
any kind** — every `castingReferenceCrops` reference under `server/` outside
tests is a select, a delete, a purge count or a deletion disposition, and not
one is an insert; and the single
`referenceId` wire live with the chosen-cuts field still this build's. **Row 2
is the next one to move** — the reference reading variant was still unbuilt at
that commit, and it is PR #2826, open while this was read.

⚠ **What the corrections do NOT touch is any obligation.** Every struck
sentence was a claim about STATE; the instruction each one carried — consume
that road, never write a second one — is kept verbatim beside the correction,
because that half was never stale.

| step | what runs | state |
|---|---|---|
| attach | `referenceAttachDoor.ts` → `casting_reference_attachments` | **LIVE**, `users:1` |
| read the picture | the discovery shape (`faceDiscovery.ts`), pointed at the REFERENCE | **BUILT for casts** (#2566); the reference variant is this build's |
| box each found thing | `pointer` (detect) — `falRegionReader.ts:1319` | **BUILT** (#2692) |
| tap → cut | detect-box → `regionInBox` (SAM 3, one box prompt) — `pointerCut.ts`, `falRegionReader.ts:1375` | **BUILT and measured** (#2566 slice 2, #2532 bench — one box per call, the cap rule) |
| clean the cut, refuse a broken one | gaps closed, feather outside only, holes = words instead | ⚠ **BUILT 2026-10-29** (#2565 slice 2) — ~~"**UNBUILT** — it is #2565 slice 2's, and `pointerCut.ts`'s own docblock says so"~~. `cutQuality.ts`'s `judgeCut` and `cleanCut`, judged raw then cleaned (widening raises fill, so the other order loosens the bar silently); `CUT_FILL_FLOOR` 20%, measured — correct cuts 42.3–73.5%, the known-bad 8.3%. `pointerCut.ts`'s header now carries the struck sentence itself. **The instruction is unchanged and is the half worth keeping: this build CONSUMES it and never writes a second one** |
| person-free bytes | Q4's face subtraction — subtract `face`, zero the pixels | ⚠ **BUILT 2026-10-29** (#2736 slice 2) — ~~"**ruled, unbuilt** (the hair cutter's `cutOutPixels` lesson is the shape)"~~. `subtractFaces` in `referenceTake.ts` zeroes the mask inside every detected face box and `cutOutPixels` writes `0,0,0,0` below threshold, so the BYTES are person-free and not merely the alpha — which is exactly the `cutOutPixels` lesson the struck note named as the shape. The detector's question is `TAKE_FACE_NOUN`, one call bought only once there is a cut worth keeping, and the count rides out on `facesRemoved`. **Consumed here, never written a second time** |
| mint the row | `casting_reference_crops` first-ever write, keeper-receipt order | table + purge path **exist**, writer is this build's |
| the ask carries it | `referenceId` + chosen-cut ids on the refine input | the single-`referenceId` wire is **LIVE**; the chosen-cuts field is this build's |
| the edit renders | the repaint road (every paid refine since #1577 4b), cuts as references | **#2736's design owns how a cut rides the repaint** — see §5 |
| after it lands | the item is re-cut from the CAST's own picture and saved; the stranger's photo never carries forward | **RULED** — #2565 slice 4, his *"okay cool im happy with the build"* |

⚠ **AMENDED 2026-10-31 (§0): THE SURFACE NO LONGER CONSUMES ROWS 2–4 — THE
SPLIT AND THE POINT REPLACE THEM.** The reference reading
(`referenceDiscovery.ts`, slice 2, merged dark — `readAndMarkReference` has
zero production callers, read 2026-10-30) and the per-name detect are
superseded on the picker road: the attach buys ONE split instead, and the name
is read from the tapped cut. Row 4's cut survives with a different prompt — a
POINT at the tap, not `regionInBox` on a marker's box. **The detect →
`regionInBox` machinery itself stays BUILT and stays serving the words-only
take** (#2736's sentence road, live at `users:1`); whether slice 2's reading
road is retired outright is its own card the moment slice 3a lands, never
folded in (his 2026-09-24 rule) — a dark road with no planned consumer is
exactly what the ghost audit exists to catch. Four steps the spotlight ADDS,
none of which exists in the tree tonight:

| step | what runs | state |
|---|---|---|
| split the picture once | SAM 3, a 32-point grid in ONE call (`fal-ai/sam-3/image`, point prompts, empty text prompt) | **UNBUILT** — `falRegionReader.ts` sends one box prompt plus `max_masks` (`:1355`) and has no point-prompt shape; the court drove the raw endpoint. The provider refuses `max_masks` > 32, measured |
| clean the split | his owed post-process, no extra call: components ≥10% of a piece's largest kept; a contested pixel to the deeper piece; holes <2% filled; tiny fragments and the whole-person piece dropped from the hover set (§6) | **UNBUILT** — prototyped on the court's fixtures; measured there again before the surface ships (his verbatim obligation, §0) |
| cut the tapped spot | SAM 3, ONE point prompt at the tap | **UNBUILT** as a reader shape; measured in the court at 8 of 9 garment-level, 1.1–3.8 s |
| name the tapped cut | today's reader, one call on the cut on flat grey, the bare-noun contract (`isBareNoun`) | prompt shape **measured** in the slice-1 and spotlight courts (8 of 8 on whole-thing cuts); the production call site is slice 3a's |

Rows 5–10 of the table above (clean/judge, person-free bytes, the mint, the
ask, the render, the re-cut) are **unchanged** — the tap's cut enters the same
pipeline whatever drew it.

Three build notes that are decisions, stated so they are not re-made:

- **The reference reading is the discovery shape with a different question.**
  On a cast the read asks *what is on this character* with a head crop + full
  frame merge. On a reference the subject may be a person, a garment on a
  hanger, or a product shot — so the reference variant asks the full frame
  first (*what is this picture of; what is the person wearing; what is the
  standalone item*) and adds the head crop only when a person is present.
  Names obey the same bare-noun contract (`isBareNoun`), because they become
  `regionInBox` neighbours and detector prompts. ⚠ *(2026-10-31: built, dark,
  and no longer on the surface's road — see the amendment above. The bare-noun
  contract itself moves to the tap's cut-naming call unchanged.)*
- **A failed reading fails open to words, silently costing nothing** — the
  same property `faceDiscovery.ts` holds for scans: `{ ok: false }` means the
  picture simply presents with no markers and the words road untouched. A
  provider's bad minute must never make an attach look broken. ⚠ *(2026-10-31:
  the property transfers to the SPLIT verbatim — a failed or empty split means
  the picture presents with no spotlight, taps still honoured, words road
  untouched, nothing charged, nothing said.)*
- ~~**Markers are bounded** (a cap near 12, largest-first) so a busy photo is a
  surface and not a quiz; everything found remains takeable by WORDS even
  when unmarked.~~ ⚠ *(2026-10-31: no markers to bound. The hover set is
  bounded by the split's own ceiling — the provider refuses more than 32
  masks — and by the clean-up's fragment and face rules; everything stays
  takeable by TAP anywhere and by WORDS always.)*

---

## 5 · CLOTHING, AND THE #2736 SEAM — one road, said precisely

His word put clothing in this card's goal, and his no-list word forbids a
`garment` intent row. The seam between the two cards:

**One artifact, two producers, one consumer.** The artifact is the reference
cut: person-free bytes + a bare noun + provenance, minted as a
`casting_reference_crops` row. **#14's tap produces it** (regionInBox on the
chosen marker). **#2736's sentence-only road produces the same artifact
server-side** — the customer types *"wear this jacket"* with a picture
attached, and the road runs detect(noun from the sentence) → regionInBox →
the same mint. **The consumer is one road too**: how a garment cut rides the
repaint beside the pristine master and the current description is **#2736's
step-0 design and is deliberately not duplicated here** — whichever design
lands second inherits the first's consumer unchanged. A second garment road
is the failure both cards name.

**Slice order therefore names garments with an owner** (his 10-28 word: not
deferred unowned): the selector's first ship marks and cuts garments like
anything else; the garment cut's RIDE into the edit opens the moment #2736's
consumer exists, and the two cards' builds share it. Non-garment cuts (hair,
tattoos, jewellery) ride the roads that already exist today
(`hairReferenceTake.ts`, `inkReferenceTake.ts`) with the noun routing by the
fable-1047 property rather than by intent key.

**One capability told honestly rather than widened in passing:** a tapped
TATTOO still lands through the ink take, whose placements are the measured
three (`UNIVERSAL_REFERENCE_ROAD_DESIGN.md` §12.1 — the database narrowing,
the mannequin sites, and the sign-road measurement are all still owed). A tap
does not pay that debt and must not pretend to: an ink cut aimed at an
unmeasured surface gets the same capability sentence the road gives today.
§12.1 is its own card when the widening is ordered.

---

## 6 · THE FENCES THAT HOLD, unchanged

- ⚠ **AMENDED 2026-10-31 (§0 hazard 2): the likeness fence binds the HOVER SET
  too.** Measured in the spotlight court: hovering the earring lit the whole
  person, face included, and hovering the hair did the same in the other split
  method. So, before any piece can light: every split piece has detected face
  boxes subtracted in its mask (`subtractFaces`, `referenceTake.ts` — consumed,
  never rewritten), and a piece that still covers a detected face's box — the
  whole-person piece both split methods produce on a worn photo — is **dropped
  from the hover set entirely**: a person is not a takeable thing. A tap there
  still works, because the point cut returns the garment or hair under the
  finger, not the person (4 of 4 in the court), and the tiny skin specks the
  court saw at a hair piece's edge die in the same subtraction. **A face never
  lights, on any road, under any split.**
- **The likeness fence (Q4), strengthened to the strongest form:** the face
  is never a marker, never a tap target, never a cut. Any cut whose region
  overlaps a detected face is cleaned by SUBTRACTION IN THE BYTES —
  `0,0,0,0` below threshold, never a mask over a photograph (the
  `cutOutPixels` lesson, fable-1216 §1) — so a photo of a person carries the
  piece and never the person. Small facial features (eyes for eye colour)
  ride their own proven crop roads, person-free by their own scale.
- **The scenery wall:** Refine changes the person, not the shoot. Scene
  things are never marked (§3), and a typed scenery ask meets the existing
  wall unchanged.
- **One picture per ask (Q6):** unchanged, said in the copy; several taps on
  that one picture is the first ship.
- **The customer's picture stays private:** the attachment and every cut
  live at owner-only addresses (`askReference`'s rule, the
  `/api/reference/:referenceId` road); no public URL, no prompt log carrying
  a storage key; rows and bytes die with the candidate
  (`candidateRetention.ts` is row-driven — the mint is what makes the cut
  purgeable, which is §2's other reason the row exists).
- **Law 9:** every reader output here is a pointer — the customer's tap
  confirms the region before money moves, and his eye on the court's frames
  (§8) closes quality.

---

## 7 · THE DISAPPEARING-TECHNOLOGY GATE — answered in this body

⚠ *(2026-10-31: all three answers HOLD under the spotlight and the first gets
stronger — a lit piece under the pointer explains itself where a field of
named dots had to be read. Nothing new to learn, the same one decision with
full basis, and the technology still shows nowhere: the light is the picture's
own geometry, and no split, segment, point or engine word reaches a screen.)*

1. **What must the customer learn?** Nothing. They already attach pictures
   with `+`; the picture now shows them, in their own words, what it holds,
   and they tap what they want the way they tap anything. Saying nothing is
   a complete ask. Everything they could do yesterday still works unchanged.
2. **What decision is put in front of them, and on what basis?** One, with
   full basis: *which of these visible, named things do you want?* — decided
   by looking at the picture they chose. No mode, no strength, no form
   choice: how a thing travels (cut vs words) is our homework, decided by
   his fable-1047 rule inside the pipeline.
3. **Where does the technology show?** Nowhere. No engine name, no
   "segmentation", no confidence number. The reading state says what is
   happening to their picture, not what is doing it. A refusal says what was
   refused and what to do (§2's two sentences).

---

## 8 · COSTS AND LATENCY, per house (clause 3 — stated or it is not decision-grade)

⚠ **AMENDED 2026-10-31 (§0): the block below is the MARKER road's economy and
is struck — the spotlight's measured numbers follow it.**

~~```
fal (house)   per ATTACH   1 discovery read (one or two crops)   ≈ $0.009–0.018
                           + 1 detect per marker (≤12)           ≈ ½¢ each
                             (inferred: #2565 §8's one-feature read is ~1¢
                              for detect + cut together)
                           ≈ 2–7¢ a picture, all on FAL_CONCURRENCY —
                           assertFalBudget's ceiling arithmetic untouched
              per TAP      1 regionInBox + face subtraction      ≈ 1¢
openrouter    nothing new — the interpreter call already runs on every refine;
              the chosen things' nouns ride the same call (Q1's one-call shape)
credits       NOTHING NEW. A tap is not a render; the edit is the Refine
              price they already pay.
latency       reading: markers appear progressively, first within ~10–20 s,
              while the customer is looking and typing anyway;
              tap-time cut: ~12 s at SAM 3's measured mean, inside the edit
              they just asked for.
```~~

```
fal (house)   per ATTACH   1 split call (32-point grid, one request)  ≈ 0.5¢
                           4.3–6.6 s measured, 52.3 s once — all on
                           FAL_CONCURRENCY; assertFalBudget untouched
              per TAP      1 point cut ≈ 0.5¢ (1.1–3.8 s, measured)
openrouter    per TAP      1 naming call on the cut ≈ 0.05–0.23¢ (1.5–4.1 s);
              the interpreter call on refine is unchanged — the chosen
              things' nouns ride it (Q1's one-call shape)
credits       NOTHING NEW. A hover costs nothing; a tap is not a render;
              the edit is the Refine price they already pay.
latency       hover is a browser hit-test, free and instant once the split
              lands; a tap's chip shows the cut piece at ~2 s and its name
              ~2–4 s after that.
```

**The economy also moved in the right direction**: the marker road paid 2–7¢
at every attach whether anything was tapped or not; the spotlight pays ≈0.5¢
at attach and buys the rest only when the customer actually taps.

⚠ **The per-call figures are measured on CAST RENDERS** (#2532 bench, #2566
build, #2565 §8) **and inferred for reference photographs** — busy scenes,
flat-lays, product shots are a different population. **So the build opens
with a court, not a belief** (courts run without asking; spend reported
after): ~6 reference photos of the kinds he named (worn, on a hanger, product
shot) through discovery + detect + box-cut, ≈ **$1–2 house**, frames to his
Desk. It answers: does the reading name a flat garment; do boxes land; do
cuts hold their piece; does anything of the photo's person leak. **The 08-24
design's $0.03 point-prompt probe is cancelled** (§1) — this court replaces
it on the road actually taken.

⚠ **THE COURT HAS RUN AND IS COMPLETE — ALL THREE KINDS, IN TWO SITTINGS
(2026-10-29 and 2026-10-30). Nothing above is a plan any more.** It is recorded
here because §9 sends a builder to slice 1 first, and a finished court that
reads as pending is re-run.

- **The WORN kind**, 2026-10-29 (`foreman-20261029-1543`), through the CAST road
  — slice 2 did not exist yet. Cell `scripts/_14-reference-court-disposable.mts`,
  frames `output/_14court/run/`.
- **The HANGER and PRODUCT-SHOT kinds**, 2026-10-30 (`foreman-20261030-1234`),
  through **slice 2's own `readAndMarkReference`**. Cell
  `scripts/_14-court-kinds-disposable.mts`, frames `output/_14court/kinds/`.
  Their fixtures were minted on the house key through the product's own
  text-to-image engine and looked at before use — the Codex road that stopped
  this arm twice is closed on his word (#2788, *"it can generate images using
  fal.ai"*).

**The four questions, answered on all three kinds:** the reading names a flat or
hanging garment (12 and 7 bare nouns, 0 unmarked); boxes land (19 of 19 on the
two new kinds, both absence controls empty); cuts hold their piece on whole
garments (90.7% / 76.8% / 73.8% / 53.5% of their own boxes, each read at the
frame); and no person leaked, which on the two person-free kinds is a `face`
probe at 0 boxes rather than a discharge — ⚠ **Q4's face subtraction is still
owed on #2736's open-garment case.**

⚠ **AND THE ONE-TEXT-CALL ECONOMY IS MEASURED, NOT INFERRED.** `personPresent`
came back **false** on both person-free kinds with `crops: ["full"]` and
**exactly 1 text call each**, counted by wrapping the REAL engine — the head
crop is never bought. Slice 2 could only assert that against a fake.

**Three findings, each carded rather than folded in:** **#2787** reproduces on
both new kinds (3 of 3 — and the PART noun inherits the WHOLE object's box every
time); **#2841**, a cut in 29 separate pieces passes `judgeCut` with `use=true`,
so slice 4's *"a cut with holes or broken edges is still not used"* is true of
holes and not of pieces; **#2842**, a noun made of several parts keeps the
biggest single part (`laces` returned 9 boxes and kept a 57x66 speck).

~~⚠ **One number here contradicts the latency line above and slice 3 owns it:** a
whole picture took **169 s** (12 markers) and **116 s** (7), because the detect
calls run one at a time at ~13 s each. The *"first markers within ~10–20 s"*
sentence still holds for the FIRST marker — **so slice 3 streams markers as they
land and never awaits the road.**~~ ⚠ *(2026-10-31: dissolved by the spotlight —
one split call replaces the twelve detects, so there is nothing to stream; §0.)*

⚠ **A SECOND COURT RAN AND IS COMPLETE — THE SPOTLIGHT COURT, 2026-10-30
(`relay-agent-14spot`), AND IT IS THE ONE THE AMENDED SURFACE IS BUILT ON. Do
not re-run it either.** The full verdict with every number, the split-method
comparison (SAM 2 auto-segment, the 32-point SAM 3 grid, the SAM colour map),
the point-cut and naming tables, and the three hazards are a comment on #14;
§0 carries what binds the build. ≈$0.31 house, reported there. Its frames and
the clickable prototype he judged are on the relay's machine
(`C:\Users\Admin\drape-scratch\relay-14spot\`), never posted.

---

## 9 · FLAG, SLICES, AND WHAT CLOSES IT

**Flag:** `CASTING_REFERENCE_SELECTOR_SCOPE`, a child of
`CASTING_REFERENCE_ATTACH_SCOPE` in the boot-fence chain (a child may not
reach past its parent), dark at birth, `users:1` on his word, catalogue entry
in the same commit (the capability-atlas law).

**Slices, one PR each, in order** (#2565 slice 4 is this build; its builder
reads this document and the mock verdict first):

1. **The court** (§8) — before any code believes the reference-photo numbers.
   ⚠ **DONE — all three kinds, 2026-10-29 (worn) and 2026-10-30 (hanger,
   product shot). Do not re-run it; §8 carries the result and the three
   findings it produced.**
2. **The reference reading, dark**: discovery variant + detect boxes on
   attach, server-side, no UI; the crops-table migration ceremony (§2) rides
   ahead of the first mint.
3. ⚠ **REWRITTEN 2026-10-31 (§0), and cut in two PRs because the first is
   server-dark and the second is his eye's:**
   **(3a) The split-and-tap road, dark (server):** the 32-point grid call —
   the reader's first point-prompt shape; his owed clean-up, measured on the
   court's fixtures before the surface ships (§0, verbatim obligation); the
   face-subtraction-and-drop rule for the hover set (§6); the point cut at a
   tap; and the cut-naming call. All behind the flag, no UI. Two sentences
   are corrected in the same commits that make them true:
   `productionFlagPositions.mts`'s *"buys a reading nobody can see yet"*, and
   the flag's catalogue entry, which describes the slice-2 reading as what
   the flag buys. **Slice 2's reading road is left dark and untouched here;
   its retirement is its own card the moment 3a lands** (§4's amendment).
   **(3b) The surface:** the picture opens large, *"Reading your picture…"*,
   the spotlight hover (tap-to-light on touch), tap → cut → chip with the
   cut's own name, tap again to let go, fail-open to words — behind the flag,
   evidence pack both themes, copy audit (every string verified / adapted /
   invented). The visual reference is the spotlight prototype he preferred,
   not the marker mock; **his formal yes comes on the built surface, on his
   own account.**
   ~~**The surface**: the picture opens with markers, taps, chips — behind the
   flag, evidence pack both themes against the approved mock, copy audit
   (every string mock-verified / adapted / invented).~~
4. **The tap's cut rides the ask**: ~~regionInBox on tap (one box per call —
   `pointerCut.ts`'s cap rule, inherited)~~ *(2026-10-31: the cut is 3a's
   point road now; this slice carries it into the ask)* — face subtraction,
   the first `casting_reference_crops` mint (the §2 ceremony rides ahead of
   it), nouns + cuts on the interpreter call, the landed edit's
   re-cut-from-the-cast (#2565's rule). Hair, jewellery, tattoos and every
   named non-garment thing work end to end here.
   ⚠ **Depends on #2565 slice 2's clean-and-refuse pipeline — and that
   dependency is DISCHARGED, not removed (2026-10-30, #2827).** It read
   ~~"(unbuilt at the time of writing, per `pointerCut.ts`'s own
   docblock)"~~; the pipeline landed 2026-10-29 as `cutQuality.ts`, and that
   docblock now carries its own struck sentence. **Nothing else in this
   slice moves**: a cut with holes or broken edges is still not used and the
   edit still rides on words, and **this build consumes that pipeline and
   never writes a second one** — which is why the line is corrected rather
   than deleted. The same holds for the face subtraction it is paired with
   (`subtractFaces`, `referenceTake.ts`, #2736 slice 2): built, consumed,
   never rebuilt here.
5. **Garments through the seam** — WITH #2736's consumer (one PR or two
   adjacent, whichever the two cards' builders agree, but one road). ⚠
   *(2026-10-31: the one-tap whole-OUTFIT take lands here too, where garment
   identity exists in the named cuts — §3's amendment says why it cannot ride
   the split.)*

**What closes #14:** ~~his eye on the mock (this sitting's ask), then the
slices~~ *(2026-10-31: the mock ask is discharged — he passed the marker mock
on 2026-10-29 and then preferred the spotlight prototype on 2026-10-30, which
is the direction §0 builds; what remains is)* the slices, then **his eye on a
real tapped edit on his own account**. A card waiting on his eye does not
close before it.

## 10 · What this design does NOT decide

#2736's step 0 (how a garment cut rides the repaint — that card's own Fable
pass); the #2566 grouping repair (his five findings — its own design pass,
owed there); §12.1's ink-placement widening; any widening past `users:1`.

⚠ *Added 2026-10-31:* **the FACE PANEL's spotlight** — his 2026-10-30 word
covers *"both the picker and the face panel"*, and the panel half is **#2868**,
filed so the direction is not lost; it builds on the rebuilt panel (#2856,
#2862), never here. And **the disposition of slice 2's dark reading road**
(`referenceDiscovery.ts`) once 3a lands — its own card then, per §4's
amendment, never folded into a build or a retirement.
