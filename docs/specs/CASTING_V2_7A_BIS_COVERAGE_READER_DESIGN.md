# 7a-bis — the reader that answers coverage for an outfit nobody wrote down

✅ **COUNTERSIGNED 2026-08-24 (fable-1491)** on shape (a), with §3.1's open
question RULED as **(ii), lazily at the ask** — *"the advisor's aesthetic loses
to the stale-box receipts"* — and §7's sequence endorsed as **the recommendation
to the founder**. Nothing here is built, and by that ruling **the build waits on
a number** rather than on anyone's attention: flip, count
`surfaceCoverageUnread` for a window, build against what it says.

`CASTING_TWO_PATHS_SCOPE`'s **first remaining flip precondition**
(`CASTING_V2_TWO_PATHS_DESIGN.md` §10, second bullet; the coupling ruled
fable-1368 ruling 2). The flip carries either this reader **or the founder's
explicit acceptance of the refuse-until-read state** — and §7 argues that the
second is a real answer rather than a fallback, because it is already
instrumented.

---

## 1. The question, read at the code

`server/castingV2/inkSurfaceCoverage.ts` is the one owner of *does this cast's
wardrobe cover this surface*. It answers over `INK_PLACEMENTS` — `neck`,
`upperArm`, `upperChest` — with `bare` / `covered` / `unknown`, from two tables:

```
HOUSE_COVERAGE    the house crew-tee line          neck bare · upperArm bare · upperChest covered
BASICS_COVERAGE   the two Basics forms             all three bare (earned at three courts)
anything else     unknown
```

`unknown` **fails closed** and each consumer names it in its own words rather
than borrowing `covered`'s — *"nobody has read this outfit"*, never *"the chest
is covered"* (ruling 1; a fail-closed gate that lies about why it closed is how
somebody learns to distrust every refusal this product writes).

**Today `unknown` is unreachable.** Every production roll is `unpathed` and
answers the house table byte for byte. **The day the flag widens, every
Wardrobe-path cast with a picked or customer-named outfit meets an ink refusal on
every placement** — because the picker's line is, by construction, one nobody
wrote a table for.

### 1.1 The consumers, counted rather than remembered

Five, at eight call sites, all synchronous:

| where | what it decides |
|---|---|
| `inkPlacement.ts:382, :422` | whether an ink ask is admitted at all, and what the refusal says |
| `inkPlacement.ts:456` (`bareSurfaces`) | which surfaces a refusal offers INSTEAD — *"neck or an upper arm now"* |
| `inkViewReferences.ts:251` | whether a design rides the six signed package views |
| `signService.ts:775, :967` | the Sign disposition — `surfaceCovered` vs `surfaceCoverageUnread` |
| `carriedGeometry.ts:325` | `coveredWhenEmpty` — why a carried feature's re-read came back empty |
| `refineService.ts:2410` | the demand tally's KIND (see §7) |

---

## 2. Three shapes, and two of them are refused

### (a) A per-frame reading of the picture — **RECOMMENDED**

Ask the segmenter its own measured word of the frame this ask will render from,
and believe the answer. **No garment taxonomy exists or is needed.**

**It is calibrated, and the calibration is this campaign's own courts:**

```
a picked one-shoulder hide      upper chest   66,046 · 64,942 · 101,468 · 133,099 px
  (chest largely bare)                        four frames, two rounds — masks on bare
                                              skin, stopping dead at the fur, no garment
a picked dark suit jacket       upper chest   0 px · 0 px · 0 px
  over a collared shirt                       three frames, twelve of twelve across runs
the house crew tee              upper chest   nothing at all, three clothed frames
the lowered Basics scoop        upper chest   4 of 4 on three sheets, two wordings
```

**Both directions, on two garments the product had never made, with the overlays
opened.** A read of zero is the PASS on a covered chest and the FAILURE on a bare
one, and the reader got both right without being told what a suit is.

This is the fidelity law's own arrow: a dedicated instrument exists, and the
approximation is nearer to hand.

### (b) A text reading of the LINE — **REFUSED**

The line is a code-composed English sentence, so *"does this outfit cover the
upper chest?"* looks like reading comprehension rather than vision, and it would
be cheap and cacheable.

**It is refused because the line underdetermines the frame, and this program has
the receipts.** `BASICS_COVERAGE.upperChest` was `bare` read off our own spec
sentence — *"cut low enough to show a chest piece"* — and the frames answered
**0 px on 4 of 4**. A text reader would have said `bare` too, confidently, from
the same words. The sentence is a PRESCRIPTION; coverage is a fact about a
DELIVERY, and the gap between them cost three courts and a founder ruling.

**Not even as a pre-filter.** A pre-filter is a second authority that can
disagree with the frame, for $0.015 saved.

### (c) A rule or word list over the line — **REFUSED under the fidelity law**

It is the frozen-constant shape 7a exists to kill, and the owner's own header
already forbids it in as many words: *"no prose matching here, no does it contain
the word 'crew': a guess about what a customer's outfit covers is a guess about
her body, and this product refuses those."*

---

## 3. ⚠ The crux: the owner is PURE and must stay so

`inkSurfaceCoverage` has no database, no flag and no reader, and its header says
why that is load-bearing: it is what lets the ink gate ask **before any money
moves** and lets Sign ask about a **snapshot** and get the same answer. **A
measurement is neither pure nor synchronous.**

**The resolution: the owner never reads. The SERVICE reads, and hands the answer
in.** The three exports gain an optional MEASURED table beside the two authored
ones; absent, they behave exactly as today.

```
today      coverageOfWardrobeLine(line, placement)
7a-bis     coverageOfWardrobeLine(line, placement, measured?)
           ── house line or Basics form   the authored table, no read, as now
           ── a measured row for THIS frame   its verdict
           ── neither                          `unknown`, failing closed as now
```

**`unknown` does not go away — it stops being universal.** After 7a-bis it means
*this frame has not been read*, which is a failed mint or a cast from before the
reader, rather than *nobody wrote a table for this outfit*.

### 3.1 ✅ When the read happens — RULED (ii), LAZILY AT THE ASK (fable-1491)

Two candidate moments were put up. **The second is ruled, on the correctness
argument rather than the cost one**, and the two conditions attached to it are
written at the end of this section.

**(i) At candidate landing, on every Wardrobe-path roll.** Three reads per
candidate, twenty-four per roll, ≈ **$0.12 per Wardrobe roll** of house money,
folded into a wait the customer already bought (the `carriedGeometry` pattern —
ungated, counted, never thrown). Every cast is read whether or not ink is ever
asked.

⚠ **Its defect is not the money.** It reads the MASTER, and **the wardrobe is a
live edit axis**: §7.1's wardrobe subject rewrites the line and re-renders. A
customer who changes into a vest produces a frame nobody has read — so her chest
ink refuses on the very branch she just edited, with `unknown`, immediately after
the edit that should have opened it. That is the carried-crop stale-box defect
verbatim (9 of 9 production boxes drawn on frames they were not minted from,
median four versions adrift).

**(ii) Lazily, at the first ask that needs coverage for a given frame** — awaited
inside the paid road, **before the claim**, and stored so it is bought once per
frame rather than once per ask. ✅ **RULED.**

```
correctness   it always reads the frame the ask will render from, which is the
              single thing §5 says is most likely to go wrong
cost          three reads only for a cast somebody actually asks ink about,
              once per frame — far fewer casts than (i), and the same $0.015
              when it happens
latency       ~8s on the FIRST ink ask against a frame, inside a road whose
              median is 121 seconds. Invisible on a render; VISIBLE on a free
              refusal, which is the honest cost of this choice and is stated
              rather than buried
purity        the owner is untouched. `refineService` awaits
              `ensureCoverageRead(frame)` and passes the result into the pure
              function — the same shape `readStoredDelta` already has
```

⚠ **What (ii) must NOT become: refuse-now-and-mint-in-the-background.** A free
refusal that spends house money and writes a row is the *free answer is a write*
class, and *"we could not read it, ask again in a minute"* is a dead end wearing
an apology. **It blocks and answers, or it does not read at all.**

⚠ **And the read is bought only for an ask that actually needs coverage** — an
ask refused for any other reason must not pay for it. The gate order is stated in
the build: cheaper refusals first, then the read.

**The two conditions the ruling attaches (fable-1491):**

1. **The reading is CACHED per (candidate, frame)** — the second ask on the same
   frame is free. That is §4's key doing double duty, and it is what keeps the
   ~8s a once-per-frame cost rather than a per-ask one.
2. **The prohibition in the paragraph above is immovable**: *blocks and answers,
   or does not read at all.* And the ~8s belongs **in the copy's vicinity if a
   surface ever shows a wait for it** — a silent pause on a free refusal is the
   product looking broken at the one moment it is being careful.

---

## 4. Where the row lives

**A new table, and NOT `casting_face_scans`.**

```
casting_wardrobe_coverage
  candidateId   ── the owner, for the purge path
  frameKey      ── ⚠ THE KEY. Not the cast, not the version: the FRAME
  placement     ── the closed vocabulary, one row each
  verdict       ── bare | covered
  pixels        ── what was measured, so a later reader can re-judge the verdict
  readAt        ── provenance
```

⚠ **Keyed by FRAME, and §5 is why.** A row minted on the master and consulted on
a later version is the defect this campaign has already paid for once.

⚠ **It cannot ride `casting_face_scans`, and the reason is a memory rather than a
preference: the library holds PRESENCE, not absence.** A coverage reading's
load-bearing answer is **zero pixels** — *the reader looked and found nothing* —
and a store whose shape is *here is what we found* cannot durably distinguish
that from *we never asked*. This table records absence as a first-class verdict.

**Rows die with their candidate, unconditionally and not gated on the flag** —
the `casting_face_scans` rule, for the same reason. **The migration and its
ceremony are a named prerequisite of the FLIP**, in the shape §3.2 uses for the
`path`/`wardrobeLine` columns.

---

## 5. ⚠ The one thing most likely to go wrong

**Keying the reading to the CAST instead of to the FRAME.** It is the tempting
shape — a cast has one outfit, so one reading ought to do — and it is wrong the
first time a wardrobe edit lands. The design's answer is §4's key and §3.1(ii)'s
timing, which agree with each other: read the frame you are about to render from,
file it under that frame, and never consult a row minted from another one.

---

## 6. The flag, the cost and the arms

```
CASTING_COVERAGE_READ_SCOPE   off | all | users:<ids>   parent: CASTING_TWO_PATHS_SCOPE
```

Off, and absent means off: no read, no row, and every consumer answers exactly as
it does today — which for an unpathed cast is the house table and for a pathed
one is `unknown`. **The parent is the paths' own flag** and nothing narrower: a
cast with no path has an outfit nobody chose and the authored table already
answers it.

**No new fal allowance.** The reads ride the shared `FAL_CONCURRENCY` courtesy
pool, as the region reads and the ink cutter's questions do, so
`assertFalBudget`'s ceiling arithmetic is untouched.

**The arms that must exist before it ships:**

1. the reader REFUSES rather than guessing when the segmenter fails — the row is
   not written and the gate answers `unknown`, which is today's behaviour;
2. a **negative control**: a covered chest must read `covered`, driven on a real
   frame, or the instrument cannot fail;
3. a **positive control**: a bare chest must read `bare` on the same road;
4. the owner with NO measured table answers byte-identically to today — the
   whole point of the optional argument, and the arm that lets this ship dark;
5. a purge arm at a real database, with the flag asserted OFF, proving rows die
   with their candidate (`castingV2-face-scan-db.test.ts`'s own shape).

---

## 7. ⚠ THE OTHER ANSWER IS REAL, AND IT IS ALREADY INSTRUMENTED

fable-1368 ruling 2 offers the founder's **explicit acceptance of the
refuse-until-read state** as an alternative to building this at all — *"which is
a real option, since he may want the paths before the tattoos."*

**It should be put to him with the numbers, not as a fallback**, because the
product is already counting the demand for it:

```
refineService.ts:2410 writes a demand row on every coverage refusal, and the
KIND separates the two questions:

  surfaceCovered           her outfit covers it — the demand is a wardrobe edit
                           or a Basics recast, a PRODUCT road
  surfaceCoverageUnread    we have not read this outfit — the demand is 7a-bis,
                           a DIFFERENT build
```

That separation exists precisely so *"one value for both would inflate the case
for the wrong one"*. **So the honest sequence may be: flip, let the tally count
`surfaceCoverageUnread` for a window, and build this against a number.** The cost
of waiting is that every Wardrobe cast refuses ink until it lands — visible,
honest, free, and named in its own words.

✅ **RULED THE RECOMMENDATION (fable-1491), and the framing matters as much as
the sequence: it is not "we skipped a build". It is "the product is counting
whether this build is needed, and here is the interim honesty."**

```
flip  →  count `surfaceCoverageUnread` for a window  →  build against the number
```

The tally's kind-separation exists for exactly this, so the last TECHNICAL
precondition converts into **his one-sentence interim acceptance**, put to him in
the sitting that follows his look at §6 — with this design sitting ready to build
the day the number says so.

---

## 8. What this design does NOT do

- It does not touch the authored tables. The house line and the two Basics forms
  keep their measured answers and their provenance.
- It does not widen `INK_PLACEMENTS`. A surface with no vocabulary entry has no
  question to ask.
- It does not answer the **fourth state** — *visible skin the reader will not
  name* — which the Basics round-1 court met (0 px on plainly visible skin) and
  fable-1453 parked as *carded when reached*. ⚠ **This reader makes it
  reachable**, and law 9 says a reader-driven refusal class goes past his eyes,
  with the overlays, before it refuses a stranger. ✅ **Confirmed as a named
  prerequisite of this flag's own flip and not of the build** (fable-1491) —
  law 9's own sentence, correctly placed.
- It does not make coverage a property a customer can see or set. It is a fact
  about a photograph.
