# Retro-minting pre-promotion features — the evaluation

*Ordered by fable-737 §1 (**"size it, name the risks, bring the shape"**),
re-queued by fable-764 §3. Written 2026-08-16, shift 79. **Evaluation only —
nothing is built and nothing is spent.** The one production read below is a
read-only count; no render, no segmenter call, no credit.*

## The problem, in the founder's own chain

He added horns **before** horns were promoted. No promotion meant no library
slot, no slot meant no minted crop, and a feature with no crop is carried by
words alone. Across the chain his slim curved horns became large ram spirals —
while the red right eye on the same frame carried perfectly, because that one
had a crop. His question was *"would it work on old edits?"* and the answer
today is **no**: the mint fires at delivery and there is no backfill.

The prize is not horns. It is **every feature delivered before its kind's
promotion** — earrings, fangs, any pre-library edit — which is law 7 applied to
a whole class rather than to the instance he happened to see.

## 1. The size — measured, not estimated

Read off production (`hayabusa…:23768`, user 1, read-only):

```
candidates                       47
variants (refine outputs)        24
candidates WITH any library       7
library rows                     29     25 carry/anatomy · 2 carry/item · 2 vacancy/item

by slot   build 6 · eye@left 4 · hair 4 · eye@right 3 · horns@left 3 ·
          horns@right 3 · glasses 2 · earring@left 1 · earring@right 1 ·
          skin 1 · teeth 1
```

**The whole world that could ever need retro-minting is 24 variants**, because a
variant is what a refine produces and only a refine can have delivered a feature.
Forty of forty-seven candidates carry no library row at all, and most of those
are rolls nobody ever refined.

**So the backfill is cheap by construction.** At the measured segmenter price of
**$0.005 a read**, a feature costs one region read (two or three if bilateral,
read per side) — call it 1–1.5¢ — and an upper bound of *every* variant × *every*
slot is still single-digit dollars of house money. **Cost is not the constraint
here, and any shape that is argued for on cost is being argued for on the wrong
axis.**

> **The number's declared limit.** 24 is an upper bound on variants, not a count
> of features owed a crop: it does not subtract the variants whose features
> already have rows (horns has 3+3 rows on one face — that face is post-
> promotion and already carried), and it does not identify which variants
> delivered a feature whose kind had no slot at the time. **The exact work list
> needs the delta facets crossed with each row's `createdAt` against its kind's
> promotion date**, which is one more query and is the first thing a build
> should compute rather than assume.

## 2. The shape — and it is smaller than it looks

`mintReferencesForRender` already takes everything a retro-mint needs, and every
input is either on disk or buyable:

| `MintInput` field | at a live delivery | at a retro-mint |
|---|---|---|
| `frame.bytes` | the frame just rendered | **the OLD delivered frame, still in R2** — persisted by design, URLs never expire |
| `masterRegions` | already read by the harvest | **must be bought** — one segmenter read per question |
| `masterSideRegions` | already read | **must be bought**, and this is the risk (§3.1) |
| `knownDigests` | from the library | unchanged — the library is the library |
| `applied` | where the paint was allowed to go | **there is none** (§3.2) |
| `variantId` | this render | the old variant — the row must be attributed to the render that actually delivered the feature, or the chain lies about when she got it |

So the build is: **a walker that finds pre-promotion features, loads their old
frame, buys the reads, and calls the existing mint through the existing door.**
Not a second mint. Not a second set of gates. That is the whole point of doing
it this way and it is why the evaluation comes back positive on shape.

## 3. The risks, named

### 3.1 The per-side capability may not survive an old frame — and it fails QUIETLY

`masterSideRegions` carries this rule, and it is the sharpest thing in the mint:

> *"A name present here is the capability, proven by data rather than claimed:
> the reader answered this question two-sidedly on this frame. A name absent is
> `noSide`, and the slot files WORDS."*

**Horns are `perSide`.** So a retro-mint of his horns on an old frame where the
reader declines to answer two-sidedly does not fail loudly — **it files words,
which is exactly the state we are trying to leave.** The backfill would report
success and change nothing, and the drift would continue.

**Required:** the walker reports `noSide` outcomes as a distinct result, never
folded into "minted". A retro-mint that produced words is a retro-mint that did
not happen, and it must be visible as such or the whole exercise certifies
itself.

### 3.2 There is no `applied` mask, and `null` does not mean "none"

`applied: null` is not the absence of a value — it is **the BORN read**: *"no
edit governed this frame, so a slot owns its whole region."* Its own comment
warns that passing an empty mask instead would file every slot as owning
nothing.

For a retro-mint, `null` is arguably the honest mapping — we are reading a
finished frame as evidence of what is on her, not attributing a delta to an
edit — but it is a **semantic decision that changes what the row claims**, and
it should be made deliberately rather than by whichever value compiles. It is
the difference between *"this is her horns"* and *"this edit put these horns
here"*.

**Recommendation:** `applied: null`, declared in the row's own provenance, so a
retro-minted row is distinguishable from a delivery-minted one forever.

### 3.3 Old frames predate some instruments — and that is a reason to record, not to refuse

fable-737 named this and it is real: frames from before the delivered-region
work, the centreline work and the completeness specimens were never read by
those instruments. But the gates are the same gates; a frame that fails one
fails it honestly, and the outcome is no row rather than a bad row.

The failure mode to guard is not a bad crop — the content gate and the mint's
independent second read already stop that. It is **silent partial success**:
some slots minted, some fell to words, and a summary that reports only the
first number.

### 3.4 Attribution — the row must belong to the render that delivered it

If a retro-minted row is written against today's variant, the chain says she got
her horns today. Every downstream reader that walks parents for the newest live
row would then be right by accident and wrong the moment anything is pruned.
The row goes on the OLD variant, which `MintInput.variantId` already supports.

## 4. The recommendation

> **Re-read and ratified in the light of §4a — fable-781 §3:** shape positive,
> population mostly elsewhere. The recommendation below stands as written; what
> changed is who it applies to, and §4a is the population it applies to.

**Build it, after the founder's gate, and build it as a walker over the existing
door rather than as a mint of its own.** The evaluation is positive on all three
axes fable-737 asked about:

- **size**: an upper bound of 24 variants in the entire production world, single-
  digit dollars of house money, no customer credit at any point;
- **shape**: no new mint, no new gates — the inputs are all on disk or buyable,
  and the one genuinely absent input (`applied`) has a defensible answer that
  should be declared in the row;
- **risk**: one real hazard, and it is the quiet one — a `perSide` feature
  falling to `noSide` on an old frame and reporting itself as done.

**What I would NOT do:** run it as a one-off script against his account and call
the drift fixed. The population is small enough that the temptation is real, and
a backfill nobody can re-run is a backfill nobody can verify — the same shape as
the six dead ceremony rehearsals this campaign found last shift.

## 4a. THE WORK LIST, MEASURED — and it is not the population above

*Read 2026-08-17, shift 80, closing §1's declared limit and §5's second open
item. Read-only production query, free. Reader:
`scripts/retro-mint-worklist-disposable.mts`.*

The question was asked in its OBSERVABLE form rather than by promotion date —
*did this render deliver a feature that has no crop on its branch?* — because
the promotion date is a proxy for exactly that and lives in git rather than the
database. Every derivation runs through the product's own doors
(`readStoredDelta`, `facetsWrittenBy`, `slotsForFacet`, `accessoryKindOf`), so
this count and the rows the mint files cannot disagree.

```
variants 24 · library rows 29 (carry 27 · vacancy 2) · readable 18 of 24
                               6 skipped, each naming its reason: status failed

THE WORK LIST   13 (variant × slot) pairs · 8 variants · 4 casts · 1 user

by slot     eye@left 4 · eye@right 4 · lips 1 · skin 1 ·
            horns@left 1 · horns@right 1 · teeth 1
by reason   no row at all 3 · a row with no pixels 10
```

**Only 3 of 13 are the population §2 and §3 were written about.** The other ten
already have rows — rows the mint looked at and REFUSED, and the door recorded
why:

```
noSpecimen/eyes         5     (one beside a disputedDelivery)
noSpecimen/horns        2
disputedDelivery/eyes   2
no refusal recorded     2     (skin, teeth) — UNEXPLAINED, see below
```

### What that does to §2's shape

*"A walker that finds pre-promotion features, loads their old frame, buys the
reads, and calls the existing mint through the existing door"* is right for the
three. For the seven `noSpecimen` members it calls a door that has already
refused those exact slots, and gets the same answer — or falls to words and
reports success, which is **§3.1's quiet risk arriving through a route §3.1 did
not consider**.

### And those seven do not need a mint at all

`noSpecimen` is not a failure to read the frame. The column's own header:

> *"the one refusal that exists in order to produce the specimen — the kind has
> no measured positive, so no number here is earned, so the guard refuses and a
> human must look at the pixels to say what complete means for it. These columns
> are those pixels and that reading."*

`refusedContentKey` and `refusedMaskKey` hold those pixels, in R2, for seven
slots across two kinds (`eyes`, `horns`). **Nobody has looked.** A human saying
what a complete `eyes` and a complete `horns` crop is unblocks those slots on
the next ordinary render — no walker, no backfill, no segmenter spend — and
unblocks them for every FUTURE render too, which a backfill does not.

The gate-not-reader family, in its purest form: a record written specifically to
be consulted, consulted by nobody.

### The other two populations

- **`disputedDelivery` × 2** already have a healing path (fable-468 ruling (b):
  `awaitingCarrier` + `confirmed` mints the carrier on a later render whose own
  reader confirms the facet). Whether it has fired for these two is unasked. If
  it has not, that mechanism is the thing to look at, not a backfill.
- **`no refusal recorded` × 2** — a row with no pixels and no refusal is a third
  thing and **it is not understood**. It may predate the refusal columns
  (migration 0029) or be a `noWords` path. Two rows, one query, and it is
  written down as unexplained rather than guessed.

### One instrument correction, for the record

The first cut of the reader SELECTed `role` and never used it. Two of the
twenty-nine rows are `vacancy` — a slot deliberately empty because she took the
thing off, which has no `storageKey` **by design** — so counted naively, *"the
glasses she removed"* lands on a list of features to re-photograph. It did not
change this total (every pixel-less member here is anatomy and both vacancy rows
are `item`), and that is exactly why it was worth fixing: an instrument that is
wrong and happens to agree is the one that gets trusted next time on a corpus
where it does not.

## 5. What this evaluation does not decide

- **When.** It sits behind the V5 gate in his sequence; nothing here jumps it.
- ~~**Whether the exact work list is 24 or 4.**~~ **Answered in §4a: 13 pairs
  over 8 variants**, and the more useful half of the answer is that the majority
  of them are a different problem.
- **Whether a retro-minted row is visibly different to the customer.** It should
  be different in provenance (§3.2); whether it is ever *shown* is a product
  question nobody has asked yet.

---

**CLOSING — the walker is CLOSED, not deferred (fable-784 §4, 2026-08-17).**
Measured at n=all: **nine of nine remaining slots are specimen-blocked** — the
door would refuse every one of them again, so a walker over that door buys
nothing. The whole fix is the founder sheet (fable-781 §2b): the refused crops
laid out labelled, one question per kind, his answers becoming the measured
positive specimens that unblock those slots for every future render. The
never-renders-again case keeps its crops by design. Nothing in this document is
withdrawn — it is **reduced to the sheet**.
