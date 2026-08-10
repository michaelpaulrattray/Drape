# The compositor swap — design

*Written 2026-08-10, shift 21, against the rulings listed at the foot. This is
the build document for fable-171's queue item 3 / fable-172's item 4. Nothing
here is new judgment: every rule below traces to a founder ruling or a Fable
ruling, and where a choice was left open the choice is marked **OPEN** rather
than quietly made.*

---

## 1. What is being swapped

The old compositor renders a region, then **pastes** delivered pixels back onto
the master and blends the join. D-241 retires that whole idea: the new
compositor **repaints the whole frame from the pristine master plus a cropped
reference of every delivered feature**, one generation deep, forever. Masks
scope the CROP and the VERIFICATION; nothing is pasted back as delivery.

**All asks go behind one flag** (fable-171). A cast with no library is C′'s
degenerate form — master plus words — not a second architecture. Two live
compositors selected per-cast is a forked path that hides defects; the old path
retires wholesale when the flag opens.

### The three conditions attached to that ruling

1. **The degenerate case gets its own fixture proof first.** A no-library cast
   with a words-only ask is the path every NEW cast takes, so it is the
   most-travelled road, not the edge case.
2. **Refund law and per-slice billing survive unchanged.** The money contract
   does not know the painter changed.
3. **The flip itself stays founder-queue** — one Railway variable — and the
   replay walk, re-derived to per-tier promises, is the specimen source.

---

## 2. The reference library

### 2.1 Its keys are the panel's slots, never the ledger's

**`facet@region` is the UNDO LEDGER's key and the library must not inherit it**
(fable-173). The library is keyed by the **panel's feature slots** — the
stylist's ontology (fable-160/167/168):

```
skin · lips · eyes (per instance) · brows (per instance) · hair
each accessory instance (earring@left, earring@right, glasses, …)
```

Makeup is **worn state ON those slots** (fable-168), not a slot of its own. So
"marks vs makeup at face skin" — two facets that produced byte-identical crops
in production — is a collision the library never expresses: the SKIN slot holds
one crop of her skin as it currently is.

This dissolves both key findings of D-243 rather than patching them. The
ledger's own placement drift (`makeup@face skin` on one render,
`makeup@lips` on another) stays filed as a known ledger artifact; no fix is owed
under seeds-nothing.

### 2.2 Storage is per instance; language is the pair

**Bilateral and matched features are STORED AS INSTANCES, SPOKEN AS PAIRS,
SPLIT ON DIVERGENCE** (fable-167, and fable-162 for accessories):

- one crop per instance, cut by the split-frame bilateral reader — free by
  construction, and it is the same mechanism that fixed D-238's laterality
- presentation and ask-language are the pair: one row ("Her eyes"), one paired
  thumbnail, plural wording
- the row splits into Left/Right **only** when an edit makes the instances
  diverge, and re-merges if they are made matching again. **Divergence is
  derived from the instances, never a flag maintained beside them.**
- reference budget: one slot while matching, one each after divergence. Slots
  are spent on differences, not on symmetry.
- **mismatched pairs are a FEATURE** — maximum creative freedom (the founder's
  own words in fable-162)

### 2.3 What may seed it — and it is not what we already have

**The existing store seeds NOTHING** (fable-173, ratifying opus-128's harder
line). Not re-cut, not superseded: ignored. D-243's numbers are the case — 7 of
14 rows are the wrong facet entirely, and the surviving best is 78.7% of its own
region. Re-cutting an off-ask row produces a well-made crop of a feature nobody
asked about. **The rows stay live for undo**, which is what they were built for
and where they are correct.

References are minted fresh, at library-build time:

- **born-anatomy references** — a fresh full region read on the MASTER
- **edit-carried references** — the delivered-anchored cutter on the DELIVERED
  frame (`applied ∩ (region(delivered) ∪ region(master))`, the 88.7% cut)

### 2.4 The completeness guard at the door

Every reference crop is checked against a **fresh full read of its region on the
frame it claims to represent**, and:

- **the guard's read is a SECOND, INDEPENDENT read** — not the one that minted
  the crop. A guard sharing its subject's read is the checker that cannot fail
  (fable-173).
- **thresholds are per-kind, derived at build time from that kind's own
  specimens.** Hair has both: 12.5% negative (the founder's fringe), 94.6%
  positive (the delivered-anchored v#163 cut). **No other kind has a positive
  specimen, so for every other kind the guard REFUSES rather than passes** until
  one exists. D-235's asymmetry is the tiebreak. No provisional number.
- an under-captured crop is **REFUSED loudly, never stored silently**
- **a crop byte-identical to another slot's crop is refused by construction** —
  D-242 one layer up: two rows holding one fact

### 2.5 One slot, one reference, per render (fable-174 — founder)

The recipe assembler **REFUSES at build** any recipe where two references claim
the same feature slot. Conflicting instructions are structurally impossible, not
merely avoided.

**Charts and flash sheets are introduction-time references**: on the applying
render they REPLACE the slot's current reference (the ask is "apply this
look/ink"); on acceptance, the delivered per-feature crops are minted as the
carried references and the chart never rides again — it stays in the library as
the look's record and for application to other casts. Identical lifecycle to
D-138/D-192 flash sheets.

A contact sheet packing many ITEMS into one slot-image is unaffected: the
invariant is about two references claiming ONE feature, not many features
sharing one reference image.

**Backstop:** the refusal gets a test driven directly, not through an LLM that
usually behaves (working law 3).

---

## 3. The ask, and what mints a reference

**Words propose; acceptance mints the reference** (fable-166 §3, generalized
from eye.colour). For any "new value" ask on a reference-carried facet — a
colour she does not have, a style she has never worn — there is no reference to
send, so the ask is carried by WORDS; the **accepted delivered frame** then
becomes that slot's reference for every render after.

This is why the tier table has no standing "eye.colour is words or reference"
row: the architecture answers it.

---

### 3.1 The slot is a RATCHET (fable-175)

Same-feature edits compose **in time, not in parallel**. "Change her lip shape,
then add gloss" is two renders, and after each accepted one the slot's reference
is **RE-MINTED with everything so far baked into the pixels** (shape, then
shape+gloss).

- **An ask's words carry only the DELTA; the reference carries the accumulated
  truth.** A shape can never be "forgotten" by a later surface ask, because it
  is not an instruction — it is the picture. So fable-174's one-slot invariant
  holds here without exception.
- **Routing composes too.** The shape ask may route NBP-anatomical, the surface
  ask GPT2. Irrelevant to the slot, which only records accepted deliveries: the
  reference is engine-agnostic memory.
- **Removal is an EDIT or a ROLLBACK, never a blind revert.** Either words
  remove the surface while the current reference carries and the shape survives
  (re-mint on acceptance), or the slot rolls back to a prior entry in its own
  lineage. "Revert to the born crop" is right ONLY when the removed thing is the
  slot's sole accepted change. *(This corrects fable-168 §4 — update the tier
  doc where that is transcribed.)*
- **Verification is per ask**: a surface ask verifies the gloss delivered AND
  the shape held — the delivered/carried pair the two-column reliability report
  already expresses.

### 3.2 Every generation is paid surface (fable-180 — CONFIRMED founder law)

**No flow anywhere generates a render the user can walk away from for free.** A
generate-then-decline flow is a free render on the platform's money every time a
user declines. This is a standing product law, not a detail of any one feature:
**check every future UX proposal against it.**

- A re-grounding or refresh, if its design is ever confirmed, runs **INSIDE the
  paid render** — the recipe substitutes for the drifted crop on that render,
  same price, no preview, no second generation. It just generates.
- **Decline = the existing free rollback.** Versions already exist; rolling back
  buys nothing.
- Distinguished and untouched: the roadmap's show-the-refused-frame item. That
  frame was already bought and refunded, so showing it costs nothing new and is
  not a preview mechanic.

### 3.3 Degradation over a long chain — PROPOSED, NOT CONFIRMED

fable-177's refuse-if-softer bar was **withdrawn**: the founder overruled it
("of course it will degrade over 3–4 edits… her original crop needs to be an
anchor"). A rule that refuses the inevitable would strangle multi-edit features.

fable-179 proposes a replacement — the master crop as a **measuring gauge**
rather than a wall, refusal reserved for single-step collapse, and a
**word-ledger re-ground** that repaints the feature from the pristine master
plus the slot's accumulated delta words. **It is explicitly not founder-
confirmed. Do not build against it.** It is recorded here as design input only.

If it is confirmed, two consequences are already known: the mint record gains
generation and detail-ratio columns (**and a new column on a written table means
the migration lands first** — the standing law), and the word ledger's
completeness becomes load-bearing, so mint time must assert that the delta words
are non-empty for every word-tier and anatomy ask.

## 4. Verification, per tier

The bar is **per tier**, and D-235's asymmetry applies to each tier's own
promise — an affirmative without a reading is not a pass.

### 4.1 Reference tier

Provisional at **n=3**, worst-of-three not mean, and **the n goes in every
report that cites it**:

```
GPT Image 2      shape-on-face ≥ 0.977   on-face drift ≤ 2 px
Nano Banana Pro  shape-on-face ≥ 0.915   (its head wanders 58–67 px between paints)
```

**Widening is mandatory before any certification walk counts.** The accessory
tolerance is set from the accessory instance cell's numbers.

### 4.2 Word tier — and its realism clause

A colour or surface ask verifies as **changed AND within natural amplitude**
(fable-166). Wire the existing `changeAmplitude`/qualifier machinery; do not
build a new instrument. **A neon iris is a REFUSED frame.** Calibrate the range
from the named specimens: cell2-3/4 negative, cell2-1/2 and the GPT2 arm
positive.

The class behind the clause: **NBP over-delivers word asks** — a literalist that
amplifies (singular clause → single hoop, "green" → neon), where GPT2 carries a
world prior that corrects toward the stylist's ontology. Word-carried
surface/colour asks lean GPT2 on amplitude taste, on top of canvas fidelity and
price. **NBP's anatomical routes stand unchanged until measured** (the fox-eyes
guard rail).

---

## 5. What the transport does and does not give us

Both measured this shift (D-243), so the swap does not have to guess:

- **`mask_url` is BANNED from every product path** (fable-178, pinned in
  `server/providers/falImages.ts`). Not "unused" — banned, with its reason: the
  canonical RGBA form is accepted and ignored, and a greyscale+alpha form
  returns **a different person at HTTP 200** with the mask verified well-formed
  afterwards. A stub field that fails by substituting a stranger's face on a
  paid render is a trap, not a parameter. The ban lifts only through a fresh
  probe carrying this one as its negative control. C′ scopes by CROP and by
  VERIFICATION exactly as ruled, and nothing here reopens per-region patch
  thinking.
- **There is no item-level matting.** BiRefNet mattes the ear, not the earring.
  So cutout references are made from the binary region mask for **crisp-edged
  items only** — whose true alpha is very nearly binary — and hair is declared
  NOT-RUN. **Panel thumbnails are cutouts regardless of the engine verdict**
  (fable-165 §4): the floating-item look is the design language, and it is
  available today.

---

## 6. Build order

1. **The degenerate case, first and on a fixture**: no-library cast, words-only
   ask, through the new compositor. It is condition 1 of the ruling and the
   most-travelled road.
2. **The library**: slot keys, per-instance storage, minting from fresh reads,
   the completeness guard with its second read and per-kind refusal, the
   byte-identity refusal, the one-slot assembler refusal with its direct test.
3. **The recipe assembler and the repaint path**, behind the flag, dark.
4. **Verification per tier**, including the realism clause.
5. **The replay walk, re-derived to per-tier promises** — the specimen source
   for the flip decision.
6. **The flip**: founder-queue, one Railway variable.

Per-slice billing and the refund law are untouched at every step: the money
contract does not know the painter changed.

---

## Provenance

| Rule | Source |
|---|---|
| Reference-conditioned repaint; masks scope crop + verification | D-241 (founder) |
| Full recipe, two carry tiers | D-241 addendum, fable-158 |
| Accessories per instance; mismatched pairs a feature | D-241 second addendum, fable-162 (founder) |
| Library never seeded from old-cutter segments; completeness guard | fable-164 |
| Crop vs matted cutout; real matting only; panel thumbnails are cutouts | fable-165 (founder hypothesis) |
| Word-tier realism clause; words propose, acceptance mints | fable-166 |
| Pairs stored as instances, spoken as pairs, split on divergence | fable-167 (founder question) |
| Makeup as worn state on anatomy slots | fable-168 |
| Pair delivery is its own tallied column | fable-169 (founder tally) |
| All asks behind the flag + three conditions | fable-171 |
| Store seeds nothing; second-read guard; per-kind refuse-until-specimen; panel slots not ledger keys | fable-173 |
| One slot, one reference, per render | fable-174 (founder) |
| Store coverage audit; both transport capabilities | D-243 |
