# The finding-replay walk — the founder's own four findings, driven back

*Drafted 2026-08-10 (fable-126 §3, fable-128); the driver built the same day
(fable-134). **HELD** until the STOPLINE lifts: every delivering step is a real
25-credit refine on a real account. The controls and the dry run are not held and
have both been driven against production.*

---

## Why this exists, and why it is not the self-walk

The self-walk (`scripts/drive-self-walk.mts`) grades *outcomes*: did each step
land where it said it would, and does the delivery rate clear D-236's bar. It
is the right instrument for "does the product work", and it was **green through
every one of the four findings below**. The founder found all four in one
afternoon of dogfooding, with his eyes, on frames the nets had passed.

So this walk is a different question. It does not ask whether the product
works; it asks **whether the four specific things he saw can still happen.**
Each step therefore carries an assertion the self-walk structurally cannot make
— a count, a byte comparison, a seam number, a survival check — and each of
those instruments is driven against **his own stored frames as controls before
a credit is spent.** A counter that has never counted one earring is not a
counter.

**The bar is his eye, not the instrument** (fable-112 §5). A step whose
instrument passes and whose frame he dislikes is a failure of the step.

---

## The four findings, in his words

| # | Where | What he saw | What now claims to close it |
|---|---|---|---|
| 1 | v#156 "gold hoop earrings" | **one earring**, the other ear bare and visible | the pair law — `LANDMARK_OF_ACCESSORY.pair`, in the painter's clause *and* the reader's question (`accessoryKinds.ts`) |
| 2 | v#157 | the single hoop **on the other ear** — placement re-rolled between renders | the accessory corridor — an earring persists as **pixels** (a `statedAccessories` segment), not as a sentence |
| 3 | "wear her hair down" | a **visible tonal seam** at the shirt/underarm — "like it was pasted there"; plus the glasses ghost rim and the under-eye step | the seam verdict rides **every** render row, torn or clean, with its coherence statistic beside it |
| 4 | "wear her hair down" → "dangly cross earrings" | the hair **reverted to the original** and **no earrings** arrived | hairWorn persists by words (recipe), earrings by pixels (segment), on the branch the parent pointer names |

---

## The walk

One face, one branch, in this order. The order is the point: findings 2 and 4
are only visible in what a **later** render does to an **earlier** one.

| Step | Ask | Cost | Serves | Expected |
|---|---|---|---|---|
| 1 | `wear her hair down` | 25 | 3, 4 | delivered |
| 2 | `gold hoop earrings` | 25 | 1, 4 | delivered |
| 3 | `dangly cross earrings` | 25 | 4 (his exact sequence) | delivered |
| 4 | `copper hair` | 25 | 2 (an unrelated ask that must not move the ears) | delivered |
| 5 | `remove her glasses` — on the bespectacled face only | 25 | 3 (the ghost rim) | delivered |

**125 credits per run. The twice-clean bar (founder, 2026-08-06) makes it 250.**
Against the ceiling: net 1,410 of 5,000 as of this drafting, so two runs leave
~3,340. A step that refuses-and-refunds costs nothing and is scored on its own
merits.

Step 5 needs a face wearing glasses; his bespectacled sheet already has one and
it is the same face all three boundary artifacts were found on. If it is gone
by lift time, step 5 moves to its own short run on a fresh bespectacled roll and
says so rather than being dropped silently.

---

## The five assertions, and the control each needs first

### A. Both ears, or an honest refusal (finding 1)

**Assert:** after step 2, the delivered frame carries an earring on the left ear
*and* on the right, or the render refused and refunded. One hoop delivered and
charged is a **false pass** and fails the run outright (D-235's asymmetry: the
verdict's `saw` must name both).

**Instrument — REVISED 2026-08-10, and the revision is the point.** This
document originally specified *the real reader, asked twice —* `left earring`*,*
`right earring`. That instrument was built, driven at his own frames, and
**refuted**: it scored his ONE-hoop frame a pair, 740px and 728px, and the masks
on disk are the same hoop returned twice. SAM 3 answers the noun and ignores the
laterality entirely. Asking for "every mask, unioned" failed differently — 472px
on ONE ear of a two-hoop frame, because the model returns one instance when
asked about a class.

The counter that ships is the third design: **cut the frame at her face's own
midline and ask the plain noun of each half**, so each call can only answer about
the pixels it was handed. The same cure was taken one layer down into the product
(`58725856`, D-238), where the bilateral `eyes` region had been returning one eye
for a two-eye ask on a paid render.

**And an ear that is not visible is a NO-READ, not an absence.** His finding was
precise — one hoop, *the other ear bare and visible* — so the counter reads the
EAR on each half beside the earring, and a side with no ear makes the assertion
`neverArmed` (which fails the run) rather than failing it for a missing hoop
nobody could have delivered. The floor is measured, not chosen: 400px, against
1,756–3,222px per side across every frame this campaign has looked at. It has
four positives and no measured hidden-ear negative, and says so.

The walk's **pre-flight refuses a face whose ears cannot be found**, exactly as
it refuses one wearing no glasses — the same class, since both are a step whose
subject is not in the frame.

**Controls, before any spend — and both are already on disk:**

```
POSITIVE (must FAIL)   v#156, his one-hoop frame — production, stored
NEGATIVE (must PASS)   any frame with two, from step 2 of a prior run, or
                       the roll master of a candidate rolled wearing a pair
```

If the counter passes v#156, the counter is wrong and the walk does not run.

### B. The ears do not move (finding 2)

**Assert:** the earring pixels in step 4's frame are the **same pixels** as in
step 3's — because they were pasted, not repainted. Same side, same shape.

**Instrument:** the assembly evidence on the variant row names the
`statedAccessories` segment as carried; then the arithmetic — inside that
segment's own mask, step 4's frame equals step 3's, pixel for pixel, allowing
only the compositor's declared feather at the boundary. This is the same
byte-level proof the campaign already used for 20,036 of 24,056 pixels.

**Control:** the same comparison run between step 2 and step 3 — where the
earrings were *deliberately replaced* (hoops → crosses) — must come back
**different**. A comparison that reports "identical" for a facet that genuinely
changed is measuring the wrong region.

### C. The seam is on the record, and the record agrees with his eye (finding 3)

**Assert:** step 1's variant row carries a seam verdict — `worstExcess` and the
coherence statistic — written whether or not it tore. Nothing here is a
pass/fail against a threshold, because the threshold is exactly what is being
decided (roadmap §0, the shadow→enforce flip).

**What the step produces:** the number, the frame at the boundary at 3×, and
the founder's verdict on the same frame. Three outcomes, all useful:

```
he sees a seam AND the instrument scored it   → the flip has its calibration
he sees a seam and the instrument did NOT     → the blind spot is at his exact
                                                 amplitude; worse, and the more
                                                 important finding
he sees no seam                                → the class is closed on his eye,
                                                 and the number is a baseline
```

**Control:** `scripts/sweep-seam-rows-disposable.mts --selftest` already carries
one — a clean boundary and his own numbers, so the reader is known able to
express a finding before its silence is trusted. Satisfied **in-process**: both
the sweep and the walk's control C read through the same `lib/seamRows`, so
running it in the same session is one module answering rather than a second copy
of the same reading being consulted beside the first.

**The 3× crop is DERIVED, and that is stated.** The seam verdict records no
coordinates, so the walk locates the boundary as the bounding box of where step
1's frame differs from the face it was made from, pads it, and writes it at 3×
beside the full frame. A crop pointing somewhere wrong is visible to him
instantly — which is why a picture may be derived here where a verdict may not.

### D. The hair stays down (finding 4)

**Assert:** after steps 2, 3 and 4, her hair is still down. Two instruments,
both required, because they fail differently:

- **the recipe** — `hairWorn` is still in the resolved identity of each later
  variant, so the words did not get dropped;
- **the picture** — a read of the delivered frame says the hair is down.

The picture is the one that matters and the recipe is the one that explains it.
His finding was the picture reverting; a recipe that still says "down" over a
frame that is not is the same defect with a better alibi.

**Control:** step 1's own *parent* frame — the one before the hair came down —
must read as **not** down on the same instrument. Without that, "still down" is
a reading that has never been able to say otherwise.

### E. The panel agrees with the assembly (new, free)

**Assert:** after each step, the "On his/her face" panel lists exactly the
facets the assembly says were carried **plus whatever that render kept for the
first time** — no more, no fewer.

*(The italicised half is a correction made during the build, stated rather than
quietly applied. The panel lists what this VERSION is keeping; a render that
writes a facet does not CARRY it, so "exactly the facets the assembly says were
carried" is short by precisely the facet the step just wrote, on every step that
writes one. As specified, E would have failed on a correct product.)*

Compared by **identity, not by copy**: each row's thumbnail carries the stored
segment's own `contentKey` in its `background-image`, and that key is a row in
`casting_segments`. And both halves are read at the same MOMENT — segments are
persisted after the variant lands, so a panel read at landing against a segment
table read at the end of the walk is a disagreement about time rather than about
the product.

Free, on-screen, and it is a genuine cross-check rather than a decoration: the
panel and the compositor read the same store through different paths, so a
disagreement is a real finding either way. It is also the only assertion here
that the founder can make himself, at a glance, while he walks.

---

## What it is NOT allowed to do

- **No re-rolling to tidy a step.** A refusal is data (the gauntlet's fourth
  chain died of one; the lesson was filed).
- **No threshold introduced mid-run** for finding 3. The number is the output.
- **No step dropped for being expensive.** If the ceiling cannot take the whole
  walk, the walk waits — a partial replay reported as a replay is the flattering
  direction.
- **No claim of closure without his eye on the frames.** Every one of these four
  was invisible to a green suite once already.

---

## Running it, when the line lifts

```
JWT_SECRET=… APP_ID=… OPEN_ID=… npx tsx scripts/mint-production-session.mts

# the instruments alone — no credits, and this is what runs inside the freeze
FAL_KEY=… railway.cmd run --service MySQL -- \
  npx tsx scripts/drive-finding-replay.mts --controls --bucket https://pub-990e39d8…

# the dry run — the face is found, her glasses and ears are proven, the price is stated
FAL_KEY=… railway.cmd run --service MySQL -- \
  npx tsx scripts/drive-finding-replay.mts --bucket https://pub-990e39d8… \
    --base https://drape-production-0232.up.railway.app --token <jwt> --candidate <publicId>

# the walk — 125 credits, and only once the STOPLINE is gone
FAL_KEY=… railway.cmd run --service MySQL -- \
  npx tsx scripts/drive-finding-replay.mts … --spend
```

`--controls` drives A's counter against v#156 and v#147, B's difference across a
delivered accessory change, C's two seam rows through the production reader and
D's pair of stored readings, and **exits non-zero if any control fails to fail.**

**`--spend` does not consult `--controls` — it executes them**, and refuses if
one is red. A flag the operator must remember is a flag the operator forgets,
and the refusal lives in `lib/stopline`'s `assertPreconditionsProved` with its
own three-way controls beside the freeze's, because a guard whose only test is
the 125-credit path is an untested guard (working law 3).

Written 2026-08-10. The specification came first on purpose, so the assertions
were chosen against his findings rather than against what was easy to measure —
and where the build had to depart from it (A's instrument, E's arithmetic, C's
crop) the departure is recorded above rather than smoothed over.
