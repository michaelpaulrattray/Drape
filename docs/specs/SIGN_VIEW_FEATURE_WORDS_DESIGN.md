# BUILD ONE — the sign views carry the words for what the anchor cannot show

> **Status: built.** Design-time record — the feature shipped (package views carry feature words; fable-1006 §3); the code and CLAUDE.md govern current behaviour (#69 stamping sweep, 2026-08-28).


*Design filed for review before any code (fable-1055 §1, ordered under the
founder's go: "go with your reccomended order nothing lands on my desk until
these are switched from a no or partly to a fully yes"). This is arrow 6 of his
seven-arrow model of refine.*

> *"when signing a cast to make the angles the refined image is supplied as the
> reference and a description so that any features not visible are not lost."*
> — the founder, 2026-08-19

---

## 1. What is true today, read at the code

**Half of his arrow already holds.** Signing anchors on the SELECTED refined
variant: `signService.ts` reads `source.face.imageKey` for the chosen
`selectedVariantId`, and those bytes become `BuildPackageInput.anchor`
(`packageOrchestrator.ts:143`), which rides every view as reference image #1
(`packageOrchestrator.ts:396-398`).

**The other half does not exist.** `composePackageViewPrompt(angle)`
(`castViewPackage.ts:481`) composes an identity-keep sentence, the view
directive, the wardrobe line and four constant photoreal blocks — and **nothing
about this person**. Its own docblock says so and has since 2026-08-17:

> *"The anchor's PIXELS plus this constant. **No customer words reach a view** —
> not the open field, not a refine delta, not `identityText`."*

So a feature the anchor cannot show — a tail, clawed feet, cybernetics on the
hands — **rides on nothing at all** into the three full-body views the customer
just paid for. That is arrow 6's PARTLY, and this build is what makes it a YES.

## 2. The bounds this build inherits — already founder-ruled, not new

**fable-876 §2, verbatim: "i think yes i just dont know what to expect obviously
the reference is still king."** Written into `castViewPackage.ts`'s docblock at
the time, and it governs every line below:

1. the anchor image remains the identity authority;
2. a clause may supply **ONLY facts the anchor cannot show**;
3. it may **never re-describe the person**;
4. where words and pixels could disagree, **the pixels win**.

And the same docblock names two things that must exist **before any such clause
rides six paid views**:

- **(P-a)** the *how-does-the-code-know-a-fact-is-not-shown* answer, designed
  once, with the does-it-extend and is-it-paired kind properties (fable-872 §2);
- **(P-b)** a **control on `packageViewExpectation`**, which is assembled from
  the view spec alone and today has no opinion about a clause at all
  (invariant 7 — fable-871 §3).

**P-a is already built and I am not re-deriving it.** `shared/bodyAnchorRegions.ts`
holds `PRESENTS_IN`, a total record of which of the eight body regions each
framing shows, each row quoting the framing spec it came from, and
`anchorPresentsIn(region, framing)` answers the question with **no model call
and no vision read**. The master framing — the frame every paid edit is painted
into, and therefore the frame the sign anchor IS — presents
`head · neck · torso · arms · wholeBody`, and does not present
`hands · belowWaist · feet`.

**P-b is a deliverable of this build**, §7 below.

## 3. WHAT RIDES — the selection rule, derived

For each feature the Cast currently has, take its anchor region and ask
`anchorPresentsIn(region, "master")`:

```
presents in the master   →  the PIXELS carry it. Nothing rides.
                            (Bound 3: re-describing it is the drift this
                             product refuses.)
does NOT present         →  the anchor cannot show it, so the WORDS are the
                            only carrier there is. It rides.
```

**Which features can even be in the second bucket — verified, not assumed.**
Every entry in `referenceSlotCatalogue.ts` is a head, face or whole-body feature
(hair, facial-hair, eye, brow, lashes, nose, lips, teeth, cheekbone, jaw, chin,
ear, build, skin, horns) and every one of those regions presents in the master.
**So the riding set is exactly the OPEN kinds anchored at `hands`, `belowWaist`
or `feet`** — the wings/horns/tail/cybernetics family his arrow 4 is about, on
the surfaces his arrow 6 is about. Their region is not guessed: it is the
`anchorRegion` column of `casting_open_kind_properties`, minted once per kind by
the open lane and read with `readKindProperties`.

This is what makes the rule honest rather than convenient: **it cannot grow into
"describe the person" by accident**, because a face slot is structurally
incapable of entering it.

### ⚠ AMENDED 2026-08-19 — the rule above is HALF of it, and the probe is why

**Geometry is not visibility, and `anchorPresentsIn`'s own docblock says so:**
*"What it does NOT answer is whether the thing is VISIBLE in a delivered
photograph: that is D2, it is a fact about a picture, and this program's rule is
that such facts are READ rather than inferred from geometry."* The version of
this section above used it for exactly the question it disclaims.

**The probe caught it at the frames.** A dev specimen's tail, anchored
`belowWaist`, was drawn curling up beside her shoulder and is plainly IN the
delivered frame — so the words would have re-described what the pixels already
carry, which is bound 3's mild direction. Two further readings from the same
sitting made it worse rather than better: a relocation edit produced a frame
where the tail runs off the corner, and a *"scaled clawed feet"* ask produced a
frame the engine **REFRAMED to full body** in order to show them. **The
delivered frame is not pinned to the master framing**, so the geometry premise
is unreliable in both directions.

**THE RULE, as ruled fable-1058 §2:**

```
rides its words  ⟺  the framing geometry says the anchor cannot show it
                     AND the branch holds NO CROP of it
```

The crop is the read fact and is the load-bearing half: a crop exists only
because a segmenter FOUND the thing in a delivered frame and cut it, under its
own coverage guard, on money already spent — no new read, no vision call at
Sign. The geometry half stays for one job only, and it is the important one:
**keeping a face slot structurally incapable of entering the set.**

**Verified on real branches** (fable-1058 §3's ordered reading, not an
assumption): candidate 376, variant 471 (crop minted) declines `cropped`;
variant 472, after an edit that moved the feature and produced no crop, CARRIES
its words — `deriveLibrary` serves the newest row per slot, so no stale ancestor
crop is served and no tiebreak is needed.

## 4. WHERE THE WORDS COME FROM — one owner, no second list

The panel already computes each slot's current declarative state from the
library lineage: `listLineageReferences({userId, candidateId, anchorVariantId})`
returns the branch-correct rows (ownership in the statement, master-minted rows
inherited by every branch), and `stateOfSlot` in `facePanel.ts` picks the newest
row's `words` — with `role: "vacancy"` meaning the feature is GONE and the slot
falls to empty.

**That rule is extracted, not copied.** `stateOfSlot` keeps its job and calls the
extracted `liveWordsForSlot(rows)`; the sign composer calls the same function. A
second implementation of "what does this slot currently say" is law 4's copy and
would drift on the first vacancy rule that changes — and drifting HERE means
telling an engine about a tail the customer removed.

`anchorVariantId` is the `selectedVariantId` the Sign is anchoring on, so the
words and the pixels come from the same branch and the same frame. Anything else
is `branch-state-identity` failing.

## 5. WHERE THE CLAUSE GOES, and what it says

Composed by a new `server/castingV2/viewFeatureWords.ts`, appended to the view
prompt exactly where the ink clause already goes (after
`composePackageViewPrompt(angle)`, `packageOrchestrator.ts:403`), so there is one
shape for "things that ride beside the anchor" rather than two.

The sentence names the feature, where it is, and nothing else:

```
The person in the reference photograph also has: a long scaled tail at the base
of the spine; matte-black cybernetic plating on both hands. These are parts of
this same person that the reference photograph does not show. Everything the
reference photograph DOES show is authoritative — do not re-imagine the face,
hair, skin or build from these words.
```

The last sentence is bound 4 written into the prompt itself, rather than trusted
to the constant blocks below it.

**Per-side and pair phrasing come from the owners that already hold them** —
`sidePhrasing.imageHalfClause` for a side, the kind's `locality` for whether one
crop can hold it — so this lane cannot come apart from the repaint lane on what
"left" means.

## 6. WHICH VIEWS GET IT — every one, and the reason is asymmetric

The same argument the founder already ruled for plates (`inkViewReferences.ts`:
*"RIDES EVERY VIEW, INCLUDING THE ONES THAT CANNOT SHOW IT"*). A view that cannot
show a tail simply does not show one — the clause says where the feature lives.
Withholding has the quiet failure instead: a frame that happens to catch the
surface, rendered by an engine that was never told, comes back with ordinary skin
and the customer's feature has vanished from one frame of six with nothing in the
record saying why.

**The opposite risk is real and is bought by the court, not argued here**: a
close-up that reframes to show the feet because the words mentioned them. That is
a conformance failure, which is a refunded slice, so it is a must-NOT-reframe arm
in §7's court — the same way the ink lane bought its own.

## 7. THE YES BAR — what has to be true before the word is spoken

fable-1055 §1 sets it, and P-b joins it:

1. **At the wire, red-first** (law 5): the assertion is on the outgoing view
   request's prompt, not on a constant near it. Red first means the test exists
   and fails before the composer does.
2. **The control that defines the arrow**: a specimen whose feature is INVISIBLE
   in the anchor is NAMED in the riding words — driven end to end on a real Cast,
   not a fixture.
3. **The negative control, which is the one that keeps the bound**: a Cast whose
   features are all face slots rides **NO words at all** — an empty clause, and
   the prompt is byte-identical to today's. A composer that cannot produce
   nothing would be re-describing the person on every Sign in the product.
4. **P-b, the `packageViewExpectation` control**: the judge's expectation is
   asserted byte-identical with and without a riding clause. A clause must never
   be able to buy its own conformance pass — if the words could move the
   expectation, view conformance quietly becomes prompt compliance and the check
   stops being worth running.
5. **The reframe arm**: on a specimen carrying a below-waist feature, the close-up
   and portrait views still pass their own framing conformance.

## 8. PRIVACY — where these words may and may not go

The library's `words` are the customer's creative content, the same class as
`masterPrompt` / `technicalSchema` / `preferences`. They ride **to the engine**,
which is where every render already goes, and **to no staff surface ever**:

- not into any moderator or admin projection (the grid's "metadata only" line);
- not into the log. The ink lane logs `designPublicId` and a disposition reason —
  never the artwork. This lane logs the **slot key and whether it rode**, never
  the words. A "which features rode" line is the same single-surface discipline
  fable-1005 §2 ordered, without carrying the content;
- the composed clause is not persisted on any row. Nothing today stores a view
  prompt, and this build does not start.

A test asserts the log payload and the staff projections cannot contain a word
from the library stack.

## 9. TWO THINGS I AM PUTTING TO REVIEW RATHER THAN DECIDING

**(a) The region vocabulary has no front/back axis, and his own example lives in
that gap.** `torso` means "shoulders to waist, front or back", and the master
presents `torso` — so a BACK feature (his fable-1047 §1 example: a back tattoo,
worded, viewed from behind) is classified as *the anchor shows it* and would ride
nothing into `backFull`. It is unreachable today for ink (the placement
vocabulary is neck / upper arm / upper chest — all front) and no open kind has
minted a back-only anchor. **My recommendation: ship the derived rule and file
the axis as a named gap** rather than widen the vocabulary inside this build —
widening `BODY_ANCHOR_REGIONS` touches the ink placement road, the open-kind
properties table and every row already written to it, which is a build of its own
and not the one he prioritised.

**(b) Cap shape.** I propose a cap on the number of features named (5) and on the
clause's characters (600), with any overflow REPORTED rather than silently
dropped. No Cast in production is near either. Say if you would rather the cap be
derived from the prompt's own budget than stated.

## 10. COST

**No new engine call, no vision read, no credit.** The selection is arithmetic
over two tables already read on the Sign path; the clause is text on a request
that was already being sent. The only spend this build can add is the court's own
renders on the founder's account, which are house-priced and declared with the
court.
