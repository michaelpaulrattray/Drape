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

**What dies with this answer, and it is a saving:** the parent design's §3
point-prompt dependency — the one fact it leaned on hardest and marked
*documented, not driven* — is **not needed**. A tap selects a found region,
and the found region's box goes to the segmenter through `regionInBox`
(`falRegionReader.ts:1375`), which #2532's bench measured and #2692 built.
The $0.03 confirm-the-schema probe from §3 is cancelled; the road a tap takes
is already driven.

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
  either.
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

## 3 · THE SURFACE — what the customer sees (the mock shows this)

The attach door does not move: one `+` beside the ask box, any picture, no
label naming a feature (`referenceAttachCopy.ts`'s own ruling). What changes
is what happens after the picture lands.

1. **The picture opens large the moment it is attached** — his spec's own
   verb: *"upload it it appear and like a pinterest style selector"*. While
   it is being read, the only words on it are honest progress: **"Reading
   your picture…"** No catalogue names, no skeleton rows (his #2566
   finding 1).
2. **Found things appear as small round markers ON the picture** — the
   Pinterest affordance — each with a short name in the customer's own
   vocabulary (the discovery read's bare noun: *Hair*, *Jacket*, *Earrings*,
   *Neck tattoo*). Markers appear as they are found rather than all at once.
   **The face gets no marker, ever** (§6). Scene things get no marker: the
   reference reading asks what is on the person or what the standalone item
   is, never what the room holds — Refine changes the person, not the shoot.
   Garments mark **per piece** (*Jacket*, *Top*, *Belt*) under one quiet
   *Outfit* group affordance that selects all of them in one tap — piece
   taps serve *"wear this jacket"*; the group tap serves *"put them in this
   whole outfit"* (both are his own sentences, #2736).
3. **Tap to choose; tap again to let go.** A chosen marker gets a selected
   ring, and a chip with the same name appears above the ask box — the same
   row the attached-picture chip already lives in (`RefinePanel.tsx`).
   **Several taps on one picture is the first ship** — his spec sentence is
   literally *"i click the hair and earrings"*, so Q6's owed question is
   answered YES for multiple TAPS; the ONE-PICTURE ruling itself is
   unchanged and the copy still says it.
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

Three build notes that are decisions, stated so they are not re-made:

- **The reference reading is the discovery shape with a different question.**
  On a cast the read asks *what is on this character* with a head crop + full
  frame merge. On a reference the subject may be a person, a garment on a
  hanger, or a product shot — so the reference variant asks the full frame
  first (*what is this picture of; what is the person wearing; what is the
  standalone item*) and adds the head crop only when a person is present.
  Names obey the same bare-noun contract (`isBareNoun`), because they become
  `regionInBox` neighbours and detector prompts.
- **A failed reading fails open to words, silently costing nothing** — the
  same property `faceDiscovery.ts` holds for scans: `{ ok: false }` means the
  picture simply presents with no markers and the words road untouched. A
  provider's bad minute must never make an attach look broken.
- **Markers are bounded** (a cap near 12, largest-first) so a busy photo is a
  surface and not a quiz; everything found remains takeable by WORDS even
  when unmarked.

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

```
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
```

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

---

## 9 · FLAG, SLICES, AND WHAT CLOSES IT

**Flag:** `CASTING_REFERENCE_SELECTOR_SCOPE`, a child of
`CASTING_REFERENCE_ATTACH_SCOPE` in the boot-fence chain (a child may not
reach past its parent), dark at birth, `users:1` on his word, catalogue entry
in the same commit (the capability-atlas law).

**Slices, one PR each, in order** (#2565 slice 4 is this build; its builder
reads this document and the mock verdict first):

1. **The court** (§8) — before any code believes the reference-photo numbers.
2. **The reference reading, dark**: discovery variant + detect boxes on
   attach, server-side, no UI; the crops-table migration ceremony (§2) rides
   ahead of the first mint.
3. **The surface**: the picture opens with markers, taps, chips — behind the
   flag, evidence pack both themes against the approved mock, copy audit
   (every string mock-verified / adapted / invented).
4. **The tap's cut rides the ask**: regionInBox on tap (one box per call —
   `pointerCut.ts`'s cap rule, inherited), face subtraction, the first
   `casting_reference_crops` mint, nouns + cuts on the interpreter call, the
   landed edit's re-cut-from-the-cast (#2565's rule). Hair, jewellery,
   tattoos and every named non-garment thing work end to end here.
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
   adjacent, whichever the two cards' builders agree, but one road).

**What closes #14:** his eye on the mock (this sitting's ask), then the
slices, then his eye on a real tapped edit on his own account. A card waiting
on his eye does not close before it.

## 10 · What this design does NOT decide

#2736's step 0 (how a garment cut rides the repaint — that card's own Fable
pass); the #2566 grouping repair (his five findings — its own design pass,
owed there); §12.1's ink-placement widening; any widening past `users:1`.
