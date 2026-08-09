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

**Reordered 2026-08-10 (fable-135), and by a defect the harness found rather
than a preference.** The original order opened with `wear her hair down` — and
hair worn down goes over the ears, which is where assertions A and B both look.
The walk's own first step could have removed the subject of its next two
assertions, and a NO-READ there closes nothing. Findings 1/2 and findings 3/4
came from **different chains of his anyway; the conflation was ours.**

| Step | Ask | Cost | Serves | Expected |
|---|---|---|---|---|
| 1 | `gold hoop earrings` | 25 | 1 — a pair, while her ears are visible | delivered |
| 2 | `dangly cross earrings` | 25 | 1, 2 — the replacement: pair *and* swap | delivered |
| 3 | `copper hair` | 25 | 2 — the unrelated ask, before hair can supersede | delivered |
| 4 | `wear her hair down` | 25 | 3, 4 — and C reads **this** row's seam | delivered |
| 5 | `remove her glasses` — on the bespectacled face only | 25 | 3, 4 — the ghost rim, and a later ask | delivered |

Findings 1 and 2 are closed at steps 1–3, with A armed on **both** accessory
steps. Finding 4's mechanism — a later ask re-pinning her hair off the master —
is exercised by step 5 following step 4, which is the same length as his own
sequence (one later ask). If her hair covers her ears by steps 4–5, A is
legitimately a NO-READ there and has already been answered.

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

**Control:** the same comparison run between steps 1 and 2 — where the earrings
were *deliberately replaced* (hoops → crosses) — must come back **different**. A
comparison that reports "identical" for a facet that genuinely changed is
measuring the wrong region. Judged with **no recorded intersections**, because
the question is "did these pixels survive", not "did the compositor account for
their loss"; an instrument that can only ever say KEPT cannot fail.

**And a second instrument on the same step, added when the reorder exposed the
hole it closes.** Step 3 is `copper hair`, and hair covers ears. The adjudicator
forgives a loss the assembly RECORDED as an intersection — right for its own
question and blind to this one: if the copper repaint wins the whole earring
region and the compositor writes that down, B reads KEPT over a hoop that is
simply gone from her picture. An instrument at its own floor reporting a clean
result, which is working law 2's exact shape. So **A's counter also runs on step
3's frame**, asking the thing the arithmetic structurally cannot: is the
jewellery still *there*. A disagreement between the two is the finding.

### C. The seam is on the record, and the record agrees with his eye (finding 3)

**Assert:** step 4's variant row — `wear her hair down`, his own ask, the render
he called *"like it was pasted there"* — carries a seam verdict, `worstExcess`
and the coherence statistic, written whether or not it tore. Nothing here is a
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

**Assert:** step 4 delivers her hair down, and after step 5 — the later ask —
it is **still** down. Two instruments, both required, because they fail
differently:

- **the recipe** — `hairWorn` is still in the resolved identity of each later
  variant, so the words did not get dropped;
- **the picture** — a read of the delivered frame says the hair is down.

The picture is the one that matters and the recipe is the one that explains it.
His finding was the picture reverting; a recipe that still says "down" over a
frame that is not is the same defect with a better alibi.

**Control:** a frame before the hair came down must read as **not** down on the
same instrument. Without that, "still down" is a reading that has never been able
to say otherwise. Satisfied by control D, which uses two readings the product
itself already took on one face — v#163 `verified: true`, v#164 `verified:
false`, both asked with the same word.

### E. The panel agrees with the assembly (new, free)

**Assert,** as revised during the build — two assertions, not one:

1. **every panel row joins to a LIVE segment row** of this face, by object key;
2. **every facet the assembly carried, or this render kept, is ON the panel.**

Anything else the panel shows is **named in the observation, not failed**.

*Both revisions were forced by driving rather than by reading, and the original
wording — "exactly the facets the assembly says were carried, no more, no fewer"
— was wrong in both directions:*

- ***no fewer** is wrong: a render that WRITES a facet does not carry it, so the
  panel is longer than the carried list by exactly the facet the step just asked
  for, on every step that asks for one.*
- ***no more** is wrong: rehearsed against his own v#157, the panel showed two
  rows over three live segments with no assembly record at all. The panel lists
  what is live on the BRANCH, which is a superset of what any one render carried.
  Asserting equality would have failed all five steps of a correct walk.*

Compared by **identity, not by copy**: each row's thumbnail carries the stored
segment's own `contentKey` in its `background-image`, and that key is a row in
`casting_segments`. And both halves are read at the same MOMENT — segments are
persisted after the variant lands, so a panel read at landing against a segment
table read at the end of the walk is a disagreement about time rather than about
the product.

**The one honest caveat**, seen on that same face: the projection deliberately
drops a row whose delivered value cannot be found — a `hairWorn` segment from a
render that never asked about hair — because "a silent row is honest where an
ugly one is not". Step 1 of this walk sets a hair arrangement, so its value
exists; a carried facet that still fails to appear IS the finding, and the
observation says so.

**`--rehearse` drives all of this without typing**, which is how both corrections
were found before a credit: it opens her sheet, matches her tile by her own
picture, settles the stack, presses the Original, selects the newest version and
reads the panel. Opening a viewer and selecting a version are navigation between
pictures that already exist (D-121), so the entire path up to the keystroke is
free — and it is the only part of `--spend` testable without spending, which
makes driving it obligatory rather than optional.

A rehearsal reports the walk's face preconditions instead of refusing on them,
and the reason is structural: a walkable face is by definition one the walk has
not edited, so it keeps nothing, so its panel does not render — the only faces
that can answer E's join are faces the walk would rightly refuse.

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
