# The finding-replay walk — the founder's own four findings, driven back

*Drafted 2026-08-10 (fable-126 §3, fable-128). **HELD** until the STOPLINE
lifts: every delivering step is a real 25-credit refine on a real account.*

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

**Instrument:** the real reader, asked twice — `left earring`, `right earring`
— each read separately rather than as the bilateral union, because a union of
one earring and nothing is a non-empty mask and would pass.

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
express a finding before its silence is trusted. Run it in the same session.

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
facets the assembly says were carried — no more, no fewer.

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
FAL_KEY=… railway.cmd run --service MySQL -- \
  npx tsx scripts/drive-finding-replay.mts --base https://… --token <jwt> \
    --candidate <publicId> --controls        # controls only, no spend
FAL_KEY=… railway.cmd run --service MySQL -- \
  npx tsx scripts/drive-finding-replay.mts … --spend
```

`--controls` drives A's counter against v#156, B's difference against a known
replacement, C's selftest and D's parent read, and **exits non-zero if any
control fails to fail.** `--spend` refuses to run unless a controls pass was
recorded in the same invocation. The driver is not written yet; this document is
its specification, and it is deliberately written before the harness so the
assertions are chosen against the findings rather than against what was easy to
measure.
