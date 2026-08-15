# V3(b) — the ink slot story and the marks vocabulary: design note

*Written 2026-08-16 by the executor, ordered by fable-648 §3, BEFORE any build.
Nothing here has been driven. The ink half is founder-adjacent at every corner —
placement, flash sheets, and what a tattoo IS in this product — so the questions
that are taste are marked **FOUNDER** and are not answered here.*

---

## 0. Why this note exists, and what it is blocking

V4 closed with exactly one undischarged clause: **ink**. Its own catalogue entry
says why, and the sentence is the whole design brief in one line:

> *OWED, not absent: ink is per placement and its question comes from the
> PLACEMENT rather than from a region table, so its slots arrive with the tattoo
> studio and the flash-sheet path (D-138). Inventing a `tattoo` question here
> would ask a segmenter an open question (D-213).*

Three other things are queued behind this note, which is why it is worth writing
carefully rather than quickly:

- **The whole-skin carrier** — measured, courted, and NOT SHIPPED by founder
  ruling: *"until the tattoo studio is launched we carry skin as words only
  otherwise it starts to become extremely complicated"* (fable-562). The tan
  costs ~ΔE 5 of drift per subsequent edit under words today, on the record.
- **The collision rule** (fable-561) — the founder's own follow-up: when tattoos
  arrive as flash-sheet references, two references claim the same patch of skin.
- **`marks`**, whose court came back SHORT: the freckle scaffolding is standing
  and inert, `canDepart` shut, nothing shipped (`V3B_FRECKLE_COURT_VERDICT.md`).

## 1. What a tattoo IS in this product — the question under everything

Every other kind in this vocabulary is a thing a face HAS: hair, a jaw, an
earring. A tattoo is different in three ways that all bite:

1. **It has no home region.** Hair is where hair is. A tattoo is wherever the
   customer put it, and the same customer may put a second one somewhere else on
   the same body. There is no `tattoo` region to segment, and asking for one is
   D-213's open question — *"find the tattoo"* on a bare arm answers something,
   because these readers answer.
2. **It is a DESIGN before it is a picture of skin.** A rose on a shoulder is
   the same rose on a forearm. That is what D-138's flash-sheet path is about:
   ink enters as a design on a mannequin template, tone ladder, no text, frozen
   at introduction (D-192) — so it can be transferred, re-anchored, and removed
   as one thing.
3. **It sits ON a surface another reference already claims.** This is fable-561,
   and it is the collision §4 exists to resolve.

**FOUNDER — the ontology question, and it decides the build:** is a tattoo *a
thing she is wearing* (like an earring: placed, movable, removable, one row per
tattoo), or *a property of a patch of her skin* (like a tan: the skin at this
site is inked)? The product's law 8 says the user's ontology governs, and a
stylist would say the first. Everything below assumes the first; if that is
wrong, §3 and §4 both change shape.

## 2. The marks half — and why it is NOT the same problem

`marks` (freckles, moles, beauty spots) reads like ink's little sibling and is
not. The freckle court settled that with measurement:

- **Freckles leave on their own.** Three renders of an unrelated edit, freckles
  never mentioned, and they survived one of three. A words-carried surface does
  not hold.
- **BORN freckles are a different mechanism and are expected safe** — they ride
  the master anchor as PIXELS, and the repaint reproduces the photograph. The
  boundary is stated in the verdict and is not crossed by anything here.

So the marks half of V3(b) is not "give freckles a slot". It is: **a
words-carried surface cannot hold, and the real source is a reference** — which
is the same sentence as the skin carrier's, and the same sentence as ink's. All
three are surfaces, and this product has learned twice that words do not hold a
surface.

**Recommendation (not a ruling):** the marks vocabulary lands as part of the
same reference machinery as ink rather than as its own scaffold. One mechanism
for *"a surface on her skin, in a place, that must survive an unrelated edit"*,
with ink and marks as two tenants of it. The alternative — a second scaffold
beside ink's — is law 4's copy in a new coat.

## 3. The slot story: how ink gets a slot without a region

The catalogue's slots are keyed `feature[@instance]`, and instances today are
`one` or `perSide`. Ink needs a third shape: **per PLACEMENT**, where the
placement is named by the customer and the site is the anchor.

```
slot          ink@<placement>            e.g. ink@left-forearm
question      NONE — there is no region called "tattoo"
anchor        the placement's own region, from the anatomy vocabulary
              (forearm, shoulder, upper back…) — never invented per call site
reference     the FLASH SHEET (D-138), frozen at introduction (D-192)
display       the placement region, so the row has somewhere to point
              (the teeth precedent: a slot may be POINTED AT without being CUT)
```

Two consequences worth stating before anybody builds:

- **The placement vocabulary is a new table, and it is the expensive part.** It
  is the body's regions, and the body is where this product's segmentation is
  least exercised — `allSkin` is declared and unimplemented, and the roadmap's
  own note says cheeks do not exist as a region either. A placement the reader
  cannot find is a tattoo the panel cannot point at.
- **The slot key is user-facing.** `ink@left-forearm` becomes *"the tattoo on
  her left forearm"* in the panel and in every sentence the recipe writes, so
  the placement names are copy, not identifiers.

**FOUNDER — how many tattoos, and how are they named?** One row per tattoo
("Rose, left forearm") is the stylist's ontology and is what §1 recommends. It
means the panel grows a row per tattoo rather than one "Tattoos" row, and it
means a second tattoo on the same forearm needs a name that distinguishes it.

## 4. The collision rule — the required section, with its court

fable-561 named this and it does not get argued, it gets driven. When an ink
site has a flash-sheet reference AND the skin has a cutout, two references claim
the same pixels: the crisp canonical design, and the delivered pixels of that
patch of skin.

**Candidate A — one authority per pixel.** The skin cutout is cut AROUND every
ink site: tone owns everything except ink sites, the flash sheet owns the ink.
This is `slotTwiceReferenced`'s spirit widened from *one reference per slot* to
*one reference per patch of skin*.

**Candidate B — birth versus carry.** The flash sheet is the authority when the
ink is created or edited (born crisp); the skin cutout carries it between edits,
with the flash sheet as a periodic re-anchor. The named risk is photocopy
softening — a carried crop of a carried crop.

**The court**, because the collision is measurable on the same frames both ways:

```
arms        A (cut-around) · B (carry, with re-anchor) · status quo (words)
subjects    one inked site + one uninked patch of the same skin, same face
readings    INK CRISPNESS at the site, and TONE HOLD on the uninked patch,
            after an unrelated edit — the two things the two candidates
            trade against each other
floor       the wobble: the same recipe twice, no ink change, on the same face
            (the carry noise floor is 0.0% vs 21.3% on a repeat, so it is
            bought before any verdict, not after)
bar         pre-registered, and both readings quoted for both arms — an arm
            that wins on crispness by losing tone has not won
```

**This court cannot run until ink references exist**, so it is the studio's
first spend rather than a precondition of the design.

## 5. The gate, and the order this all lands in

fable-562 is a founder ruling and it sequences the whole thing:

```
1  THIS NOTE                       reviewed; the FOUNDER questions answered
2  the placement vocabulary        a table, its names as copy, its regions
                                   proven findable by a reader
3  the ink slot story              slots per placement, flash sheet as the
                                   reference, display region for the row
4  THE COLLISION COURT             §4, on real ink references
5  the skin carrier, RE-DECIDED    on top of the rule §4 proves — never before
                                   it, which is exactly what the founder said
6  marks as the second tenant      if §2's recommendation stands
```

Step 5 is the one that pays a debt already on the record: the tan drifts ~ΔE 5
per edit under words today, and that is the honest current state rather than a
regression.

## 6. What this note deliberately does not do

- **It does not invent a placement vocabulary.** That is step 2, and the names
  are copy the founder should see.
- **It does not choose between the collision candidates.** fable-561 said
  tested, not argued, and the early lean toward A is recorded as a lean.
- **It does not promise the panel a tattoo row.** A row needs a rectangle
  (fable-414), so it needs a placement region a reader can find — which step 2
  either delivers or honestly fails to.
- **It costs nothing yet.** No transport has been touched writing it.
