# The compositor swap — design

*Written 2026-08-10, shift 21, against the rulings listed at the foot. This is
the build document for fable-171's queue item 3 / fable-172's item 4. Nothing
here is new judgment: every rule below traces to a founder ruling or a Fable
ruling, and where a choice was left open the choice is marked **OPEN** rather
than quietly made.*

*Revised 2026-08-10, shift 22, to **D-244 — the Edit Law** (founder-confirmed,
fable-182), and to fable-183's reference-format and tolerance rulings. §3 is
rewritten wholesale; §3.3's degradation machinery is **MOOT by construction**
rather than rejected. The mask work is promoted out of hygiene into §0, because
the founder said "we need to make sure we have the mask working" and under the
Edit Law the region masks are the scissors for every crop the product owns.*

---

## 0. What everything below stands on: the masks

The Edit Law says a feature is regenerated from an ANCHOR plus words, and that
what carries between renders is a CROP. Both of those are cut with a region
mask. So the mask work is not adjacent to the swap — it is the swap's
foundation, and it is listed first for that reason (fable-182, founder):

1. **The completeness guard** (§2.4) — a crop that does not contain its feature
   is the fringe defect, and it enters the library silently unless a second,
   independent read refuses it.
2. **Fresh-full-read seeding** (§2.3) — every reference is minted from a fresh
   region read on a frame that actually wears the thing.
3. **Split-frame bilateral instances** (§2.2) — one crop per instance, which is
   what makes "edit one ear, hold the other" expressible at all.
4. **Occlusion honesty** (fable-183) — our cutter amputates a hoop where hair
   crosses it. That is the fringe class in an occluder's costume, and it now
   sits on the completeness guard's defect list.

None of these are optional preconditions to be revisited later; a swap built on
a dishonest mask ships a product that quietly forgets features.

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

**And the frame must contain the thing** (fable-181, generalizing the fringe
class): *a reference cut from a frame that lacks its subject is a fabrication,
whatever the cutter's quality.* An edit-carried instance reference is cut from a
**delivered frame that wears the thing**, never from a master that does not.
Caught live when the accessory cell's first draft tried to cut per-ear crops
from a candidate master whose ears are bare, and the reader answered *"the
segmenter found no earring to edit"* — the fixture refusing was the only thing
between that draft and a cell measuring references to nothing.

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

## 3. THE EDIT LAW — what an edit is (D-244, founder, 2026-08-10)

*"This isn't Photoshop."* The founder's sentence is the whole design. An edit is
not a patch applied to the last picture; it is a **regeneration of one feature
from its origin**, with everything ever said about that feature said again.

### 3.0 The law, in five lines

1. **Words change; crops carry. Never both for one feature in one render.**
2. **Every edit REGENERATES its feature from its ANCHOR + the feature's FULL
   word stack** — all accumulated words including the new delta. One generation
   from the anchor, always. **A feature's own crop never rides in its own edit.**
3. **Anchors.** Anatomy and surfaces → the **MASTER**. Introduced items → their
   **FROZEN INTRODUCTION REFERENCE** (D-192): a tattoo upload converted to a
   flash sheet (D-138), makeup copied from an image → that image, a lip shape
   taken from an image → that image. Born-worn accessories (her own glasses) →
   the **MASTER**, because they are in it.
4. **The delivered result is re-cropped, and THAT crop is the feature's carry
   reference** for every render that does not touch it — pixel-frozen until the
   feature is edited again. Editing an accessory instance mints a **completely
   new** crop (per-instance, fable-162/167).
5. **Removal = strike the words** (and/or drop the introduced reference) and
   regenerate from the anchor plus what survives. It is the same mechanic as any
   other edit; there is no rollback-versus-rebuild fork to design.

**Removal compiles to the NATURAL state, never to an extreme** (founder,
fable-188): *"natural shine is fine; gloss is makeup, it's obvious."* The
product wording is **"no lip gloss, her natural lips"** — never "matte, no
shine". A matte lip is a different ask, and verification scores removal against
her own natural band, not against a matte specimen. The stylist's ontology
governs (working law 8): gloss is makeup; skin and lips have natural sheen.

### 3.0a The tier boundary is measured on TWO of its three rows (2026-08-10)

D-241 and D-244 put **surfaces on words** and **introduced things on
references** before any evidence for that split existed. The edit-law cell, its
configuration diff and the count bisect measured what a reference crop can do to
a master that disagrees with it:

| what a reference crop asks of the master | does it carry? |
|---|---|
| **ADD** what the master lacks (a hoop) | **yes**, outright |
| **CHANGE a geometry** the master owns (lip fullness) | **partly** — 3 of 3 clear of the arm's own null by more than the engine's own spread, at about a third of the crop's value |
| **CHANGE a surface** the master owns (gloss) | **NOT MEASURED — the instrument cannot resolve it** |

**The crop is outvoted by the master in proportion to how much it contradicts
it** — on the two rows that have a working instrument. So words are the carrier
of record for what they govern and crops are the carrier of record for
introduced items, but note what that sentence now rests on: the ADD and GEOMETRY
rows are measurements; **the SURFACE row is still the founder's judgment call,
and this document should not claim otherwise.**

**Why the surface row was withdrawn (2026-08-10, shift 23).** Three paints of a
single identical prompt spread **0.67pp** on the specular measure. Every gloss
difference the campaign has read — the crop-sent family against the never-sent
family (0.10pp), the gloss arm against the natural band (0.34pp) — is smaller
than that. And read backwards, the measure fails its own positive control: the
frames with gloss **struck** read *higher* (mean 2.46%) than the frame with
gloss **asked for** (2.28%). A measure that cannot order its own quantity cannot
adjudicate in either direction. It has range only at the extremes — a maximal
wet ask (3.60%) and a matte control (0.26%) — and the product lives in the nude
region between them. `scripts/calibration/glossy-family-sweep-disposable.mts`
holds the reading.

Two things are withdrawn with it, and neither is replaced by its opposite:
opus-135's "the thirteen were never glossy", and the founding case's **2 of 3**
verdict on gloss removal. Both are **unearned**, not reversed. The founding
case's *fullness* half is untouched — that measure has a noise floor of 0.10pp
and its margins clear it.

Two consequences for the build, both unchanged by the withdrawal: the assembler
must always emit the **configuration proven to carry** (named references, proven
naming form), and anatomy/surface features keep their words in the stack rather
than trusting a crop alone — which is now the *only* thing standing behind the
surface tier, and so matters more rather than less.

**The owed arm has run.** The carrying recipe with **two** references carried
fullness 3 of 3 (4.73 / 4.50 / 4.46% against a null of 4.23–4.33%), so
**reference count is out, and crop position with it**. What remains of the
bundle is **naming form and ask size** — name each reference for what it is, and
do not ask for a region redraw in the same breath.

### 3.1 What this makes IMPOSSIBLE — and therefore what we do not build

The law's value is mostly negative: whole classes of machinery become
unreachable rather than merely unnecessary.

- **Degradation over a long chain cannot accumulate.** No feature is ever more
  than **one generation from its anchor**. fable-179's gauge/word-ledger
  re-ground is **MOOT — obsoleted, not rejected** — and the lip staircase bench
  is cancelled as a threshold-finder. See §3.3.
- **The contaminated mint is unreachable.** Gloss baked into a fuller-lips crop
  can never ride the lips' own next edit, because a crop never participates in
  its own feature's edit. No tagging machinery, no provenance flags on pixels.
- **The removal contradiction is unreachable**, for the same reason.
- **fable-175 §1's edit recipe is SUPERSEDED.** Edits carry the full word stack
  from the anchor, not delta-words plus the current crop. The ratchet survives
  **only as the carry side** — see §3.2.

### 3.2 What survives: the carry side, and minting

**Words propose; acceptance mints the reference** (fable-166 §3) still stands,
and is now the law's fourth line. For a "new value" ask on a reference-carried
facet — a colour she does not have, a style she has never worn — there is no
reference to send, so the ask is carried by WORDS; the **accepted delivered
frame** is then re-cropped into that slot's carry reference.

- **Carry is pixel-frozen.** A render that does not touch a feature sends that
  feature's minted crop unchanged, byte-identical. That is the ratchet's
  surviving half and it is what makes "her earrings did not move when I changed
  her hair" true rather than hoped.
- **Routing composes.** A shape ask may route NBP-anatomical and a surface ask
  GPT2; the slot only records accepted deliveries, so the reference is
  engine-agnostic memory.
- **Verification is per ask, in two columns**: the ask's own feature verifies
  as DELIVERED, every untouched feature verifies as CARRIED. That is the
  delivered/carried pair the reliability report already expresses (D-235).
- **fable-168 §4's "revert to the born crop"** has no separate existence any
  more: removal is line 5, and regenerating from the anchor with the words
  struck *is* the revert, without a special case. *(This supersedes fable-175
  §3's correction of it — recorded here because the mailbox was that rule's
  only transcription.)*

### 3.2a The declared trade — the founder chose it with his eyes open

Editing a feature re-derives its earlier look from words, so **an exact accepted
look may shift a hair when that same feature is edited again**. Only the edited
feature moves; everything else is pixel-frozen. Stated, weighed, accepted
(fable-182). Do not build a mitigation for it without a fresh ruling.

### 3.3 Every generation is paid surface (fable-180 — CONFIRMED founder law)

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

### 3.4 Degradation over a long chain — **MOOT under D-244**

The history, kept because it is how the law was reached:

- fable-177 proposed a refuse-if-softer bar. The founder **overruled** it ("of
  course it will degrade over 3–4 edits… her original crop needs to be an
  anchor"). A rule that refuses the inevitable would strangle multi-edit
  features.
- fable-179 then proposed a gauge instead of a wall, plus a **word-ledger
  re-ground** repainting the feature from the pristine master plus accumulated
  delta words.
- **D-244 obsoletes both.** The re-ground is not an occasional repair — it is
  what *every* edit already is. And there is nothing left to gauge: a feature is
  never more than one generation from its anchor, so the staircase whose steps
  the gauge would count does not exist.

**fable-179 is MOOT, not rejected**, and nothing is owed from it. In particular
the two consequences it carried are **not** owed: no generation/detail-ratio
columns on the mint record, and therefore no migration.

**The one thing it leaves behind is load-bearing**: the word stack's
completeness. Line 2 of the law regenerates from *the full word stack*, so a
lost or empty delta is a silently forgotten edit. Mint time must assert that
the delta words are non-empty for every word-tier and anatomy ask, and the
edit-law cell (§6.1) is where that assertion is first driven.

## 4. Verification — existence and catastrophe (D-246, 2026-08-10)

**REWRITTEN by the founder's ruling.** *Detectors gate disasters only.* The
runtime bar is four catastrophic classes — a damaged frame, identity loss, the
asked thing **completely absent**, process death — and nothing else. Subtle
quality is DELIVERED: amplitude, hue, thickness, gloss level, exact shade,
degree are shown to the person who asked for them, who re-rolls (paid) or rolls
back (free). Advisory readings are recorded for trends and never enforced.

The per-tier numbers below are **retained as routing and bench evidence**, not as
runtime gates. D-235's asymmetry still governs every reading that is taken — an
affirmative without a reading is not a pass — and D-236's bars now apply to the
catastrophic classes, where the instruments are reliable.

### 4.1 Reference tier

Provisional at **n=3**, worst-of-three not mean, and **the n goes in every
report that cites it**:

```
anatomy / surfaces
  GPT Image 2      shape-on-face ≥ 0.977   on-face drift ≤ 2 px      (n=3)
  Nano Banana Pro  shape-on-face ≥ 0.915                             (n=3)
                                     (its head wanders 58–67 px between paints)

accessory carry — RATIFIED fable-183, from the accessory instance cell
  GPT Image 2      per-instance ≥ 0.85   worst-of-n, never averaged  (n=5)
  Nano Banana Pro  NOT ROUTED for accessory carry
```

**NBP is not routed for accessory carry**, and the reason is a promise rather
than a preference: its worst instance scored **0.525** and its bands run ~10%
thin, so a bar loose enough to pass it is a bar that blesses **a different
earring** — which is exactly what D-241 promises will not happen. Its
anatomical routes (fox-eyes) are untouched by this.

**Per instance, never averaged across instances.** The cell's img-left/img-right
lean (§7) is the reason: a mean would pass the easy ear by carrying the hard one.

**Widening is mandatory before any certification walk counts** — every n above
is provisional and travels inside any number that cites it.

### 4.2 Word tier — the realism clause is SUPERSEDED (D-246)

fable-166 §2 required a colour or surface ask to verify as *changed AND within
natural amplitude*, and called **a neon iris a REFUSED frame**. D-246 supersedes
that: neon green is subtle, not catastrophic. **It ships and the user judges.**

The clause was never built, so nothing was disarmed — but the class behind it is
still true and still useful, in its proper place: **taste is answered by ROUTING,
never by gating.**

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

### 5.1 REFERENCE FORMAT: recipes carry RECTANGULAR CROPS (fable-183)

**Ruled.** On the routed engine the crop arm won both measures against the
cutout arm, so **every reference a recipe sends is a rectangular crop** until an
occlusion-aware cutter exists and a re-test says otherwise. **Cutouts remain the
PANEL's display format** (fable-165 §4) — the two uses are now deliberately
different formats, which is worth saying out loud so a later reader does not
"unify" them.

**And the reason the cutout lost is ours, not the founder's hypothesis.** Our
cutter amputates the arc of a hoop where hair crosses it; a ring that stops
mid-air *asks* to be completed, so the cutout invited the very invention it was
meant to prevent. **Occlusion amputation therefore joins the completeness
guard's defect list** (§0.4) — the fringe class, occluder edition. When the
cutter is fixed, this ruling is re-tested rather than assumed.

---

## 6. Build order

### 6.1 The EDIT-LAW CELL comes before any swap code (fable-182 §TEST, founder-ordered)

The law is a claim about what a picture does when it is edited, and it has never
been driven. It is measured before it is built on. Fixture lane, on the Unfussed
lineage, count and cost stated before a dollar is spent, four scenarios:

| | scenario | what it must show |
|---|---|---|
| a | **gloss → fuller → remove gloss** (the thread's founding case) | the removal comes back **bare AND fuller** — words struck, the shape that was never struck survives |
| b | **carry stability** | edit her hair; the untouched lips crop rides **byte-identical** in the recipe, and the delivered lips hold |
| c | **introduced-item edit** | an earring from the cell's own frames, "make it bigger" regenerated from its **frozen intro anchor + words**, a new crop minted |
| d | **instance edit** | one ear only; the other ear **pixel-held** |

Verified per D-235 in both columns — **delivered** for the edited feature,
**carried** for every untouched one — with tiles for the founder. This replaces
the lip staircase, which D-244 cancelled.

### 6.2 Then the swap itself

1. **The degenerate case, first and on a fixture**: no-library cast, words-only
   ask, through the new compositor. It is condition 1 of the ruling and the
   most-travelled road.
2. **The library**: slot keys, per-instance storage, minting from fresh reads,
   the completeness guard with its second read and per-kind refusal, the
   byte-identity refusal, the one-slot assembler refusal with its direct test.
3. **The recipe assembler and the repaint path**, behind the flag, dark. The
   assembler is where D-244 lives in code: it resolves each feature to
   *anchor + full word stack* (edited) or *minted crop* (carried), and it can
   never hand a feature its own crop on its own edit.
4. **Verification: existence and catastrophe gates only** (D-246) — subtle
   readings recorded for trends, never enforced. The disarm sweep is part of
   this step; its result is in the D-246 entry and pinned by
   `d246VerificationBar.test.ts`.
5. **The replay walk, re-derived to D-246 bars** — per-class existence
   delivery, zero catastrophic false passes, and the founder's eye for taste.
   The specimen source for the flip decision.
6. **The flip**: founder-queue, one Railway variable.

Per-slice billing and the refund law are untouched at every step: the money
contract does not know the painter changed.

---

## 7. Open items — carried deliberately, each with what would close it

| item | state | what closes it |
|---|---|---|
| **Contamination instrument** (what a paint borrowed from a crop's background) | **DEFERRED WITH TRIGGER** (fable-184). Shape and material catch invented FORM and invented MATERIAL; neither counts borrowing. It was never built and that is stated as owed, not absent. | Build it **when an occlusion-aware cutter reopens the crop-vs-cutout question** (§5.1). Until then the format ruling stands on shape + material. |
| **img-left / img-right asymmetry** | **OPEN ROW.** Ten for ten on GPT2 the smaller, more occluded hoop scores worse. Mechanism proposed, untested. | Test it **only if the edit-law cell shows the same lean** (fable-183). Meanwhile the standing rule already contains the risk: per-instance worst-of-n, never averaged. |
| **Occlusion-aware cutter** | Not built. Named as the cause of the cutout arm's loss. | A cutter that completes rather than amputates at occluders, then a re-test of §5.1. |

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
| **THE EDIT LAW — words change, crops carry; regenerate from anchor + full word stack; removal strikes words; every edit mints a new crop** | **D-244 (founder), fable-182** |
| Masks are the swap's foundation, not its hygiene (§0) | fable-182 (founder) |
| Degradation machinery MOOT by construction; fable-179 obsoleted; lip staircase cancelled | D-244 |
| fable-175 §1's edit recipe superseded; ratchet survives as the carry side only | D-244 |
| Accessory carry ≥ 0.85 worst-of-n on GPT2 (n=5); NBP NOT ROUTED for accessory carry | fable-183 |
| Recipes carry rectangular CROPS; cutouts are the panel's display format only | fable-183 |
| Occlusion amputation joins the completeness guard's defect list | fable-183 |
| Contamination instrument deferred with a trigger; asymmetry an open row | fable-184 |
| **Detectors gate disasters only; subtle quality is delivered; the realism clause and the VLM gloss judge are superseded/cancelled** | **D-246 (founder), fable-194/195** |
| Reference format: NAMED, then a short description derived from the slot's own record | fable-194 (founder), fable-195 |
| Word stacks are DECLARATIVE STATE; the interpreter owes a state phrase | fable-195 |
| Removal compiles to the NATURAL state, not to matte | fable-188 (founder) |
| The tier boundary measured on two rows: add carries, geometry partly | the edit-law cell + configuration diff, fable-189 |
| Reference COUNT is out — two references carry what five did; naming form and ask size are what remain | the count bisect, 2026-08-10 |
| The surface row is WITHDRAWN, unearned in both directions — the specular measure's noise (0.67pp) exceeds the whole nude range it must divide, and it fails its own positive control by sign | `glossy-family-sweep-disposable.mts`, 2026-08-10 |
| A positive control class must be labelled by a verified OUTCOME, never by the ask or the reference that produced it | the same, named as the class per working law 7 |
