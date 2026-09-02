# The rollout-debt register — every flag, what it waits on, and a recommendation

> **Status: live.** A governing plan (PROGRAM.md) — the honest map of what is half-rolled-out (#69 stamping sweep, 2026-08-28).


Ordered fable-1675 §2 from the founder's own *"i feel like we have made so many
scope changes and interations my brain literally cant keep up."* **This is the
answer to "what is half-finished and why."**

⚠ **POPULATION CORRECTION — THIS PAGE'S CENSUS IS INCOMPLETE BY CONSTRUCTION AND
THE FOUNDER CAUGHT IT IN TEN MINUTES** (2026-08-25, relayed fable-1679/1680,
verbatim: *"do another full sweep make sure nothing else like this is missed
clearly the sweep you did initially wasnt good enough"*).

It derives from GOVERNED FLAGS. **A designed-but-unbuilt thing has no flag yet —
because a flag is what you add when you start building — so every such item was
invisible to it.** He named two on sight: the Pinterest-style reference selector
(issue #14) and the settings modal (#15).

**The corrected population is a UNION** — flags ∪ not-yet-live spec docs ∪ the
roadmap's queue ∪ the decision log ∪ the capability atlas's debts ∪ undischarged
mailbox orders ∪ CLAUDE.md's own pending-build paragraphs — and sweep #2 ran on
it: `docs/specs/CASTING_V2_SWEEP2_WORK_ITEM_LIST.md`, which found **sixteen work
items with no flag and opened issues #16–#31 for them.**

**The flag rows below stand.** What follows is still the truthful answer to *what
is half-rolled-out*; it was never the answer to *what is half-built*, and it
should not be read as one again.

---

**The population is derived, not remembered**: 32 governed variables, read off
`scripts/lib/productionFlagPositions.mts`, which the deploy rite compares to the
live service on every push. Positions below are what the SERVICE holds, verified
by the rite at 2026-08-25T05:14Z (`✓ all 32 stand where the record says they do`).

```
all       6      the finished roads
users:1  21      the debt this page is about
off       5      three inert by design, two parked
```

⚠ **A `users:1` flag is not a bug and this register does not treat it as one.**
The ratchet is deliberate: build dark → dogfood on his account → court → his eye
→ widen. What this page asks of each row is narrower — **is it still moving, and
does its condition still exist?**

---

## The six at `all` — done, listed so the page is a census and not a complaint

| flag | what it is |
|---|---|
| `CASTING_V2_SCOPE` | the casting studio itself |
| `CASTING_REPAINT_SCOPE` | the compositor swap (D-241) |
| `CASTING_REFERENCE_LIBRARY_SCOPE` | the feature library the repaint carries |
| `CASTING_INK_WORDS_SCOPE` | a tattoo typed into a refine — **the first capability this program took from `users:1` to `all`**, ratchet run end to end |
| `R7_SNAPSHOT_READ_SCOPE` | the R7-7B snapshot reader |
| `ENABLE_STORAGE_CLEANUP_WORKER` · `ENABLE_EVIDENCE_CANDIDATE_WORKER` · `ENABLE_FINAL_MODEL_DELETE` | booleans, not scopes; the first is a prerequisite of nine other flags, the second is inert while the composer is off, the third opens permanent Cast deletion to every account |

---

## The twenty-one at `users:1`

**Recommendation vocabulary**, so the column means one thing:
**FINISH** (a named build stands between it and widening) ·
**WIDEN** (nothing stands between it and widening but somebody's word) ·
**RETIRE** (the road it serves is superseded) ·
**HOLD** (its condition is real and unmet) ·
**READ** (nobody knows whether it works; a measurement comes first).

### The ink family — 6 flags, one road, and it is the most interlocked thing here

| flag | waits on | last move | recommendation |
|---|---|---|---|
| `CASTING_INK_STUDIO_SCOPE` | ⚠ **the widening tripwire** (fable-1052 §2) — it does not pass `users:1` while uploads ride uncropped to the plate mint. The mannequin road is deferred, so the tripwire's condition cannot fire, but it **re-arms** the moment that road resumes | 2026-08-21 | **HOLD** — and the hold is load-bearing, not caution |
| `CASTING_INK_CUT_SCOPE` | **3a.2(b), the customer-facing preview that shows her the cut.** His own narrowing (*"his account only until the customer-facing preview ships"*, fable-1257 §1) | 2026-08-23, flipped on his word | **FINISH** — one named surface |
| `CASTING_INK_REFERENCE_SCOPE` | the attach road's parent chain | 2026-08-21 | **HOLD** |
| `CASTING_INK_REGION_CROP_SCOPE` | fable-919 §3's founder gate (a face-bearing reference producing a person-free plate, at the frames, in front of him) — ⚠ **now structural rather than checked** since `cutOutPixels` writes `0,0,0,0`, but the frames are still his | 2026-08-21 | **FINISH** — one founder sitting |
| `CASTING_INK_TRANSFORM_SCOPE` | nothing named. The road is built, the removal action landed 2026-08-22, the multi-tattoo case is its own build with no live customer | 2026-08-22 | **READ** — it has never been measured on a second account |
| `CASTING_REFERENCE_ATTACH_SCOPE` | the parent of the hair and ink reference lanes; nothing of its own | 2026-08-21 | **HOLD** — it widens with its children |

### The reading and geometry family — 5 flags

| flag | waits on | last move | recommendation |
|---|---|---|---|
| `CASTING_FACE_SCAN_SCOPE` | nothing named. It spends house money ($0.100 per version looked at) and fills a panel | 2026-08-16 | **READ** — the per-user cost at `all` has never been modelled |
| `CASTING_SCAN_TABLE_SCOPE` | nothing. It makes a paid scan durable, which strictly reduces spend | 2026-08-16 | **WIDEN** — the cheapest win on this page |
| `CASTING_SEGMENTS_SCOPE` | nothing named | 2026-08-25 (flipped on his *"flip everything on thats currently off"*) | **HOLD** |
| `CASTING_SEGMENTS_DELIVERED_SCOPE` | its parent | 2026-08-25 | **HOLD** |
| `CASTING_SIDE_PHRASING_SCOPE` | nothing. Measured p≈0.09, never once worse, free per render | 2026-08-21 | **WIDEN** — the evidence is in and it costs nothing |

### The composer family — 4 flags, and this is where this week's rulings bite

| flag | waits on | last move | recommendation |
|---|---|---|---|
| `CASTING_BRIEF_FIDELITY_SCOPE` | ⚠ **COURT E1.** Blocked from widening by fable-1670 §4: `role` came back NULL 3 of 3 with it on and 0 of 4 with it off on the same brief family (p = 0.057; pooled p = 0.029). Its own entry declared a SHORT lifespan and *"widens to `all` promptly"* — that sentence is now overtaken | 2026-08-25 | **HOLD → then WIDEN.** E1 is text-only and cheap; it is the highest-value unblocking on this page |
| ~~`CASTING_FRAMING_TRIM_SCOPE`~~ | ✅ **RETIRED 2026-09-03 (#11).** It waited on his eye at strips from his own flagged rolls; he gave it — *"11 heads look fine."* — and rule 15 of `PROMPT_AUTHOR_RULING_2026-08-26.md` retires the trim on exactly that. The flag, the step, the larger render, the two region reads a frame and the kept-original write are deleted; the variable is off the service | 2026-09-03 | **DONE** — the debt is discharged by deletion, not by a flip |
| `CASTING_TWO_PATHS_SCOPE` | one open item — the `build`/`skin` honesty claim before BASICS widens | 2026-08-24 | ⚠ **RETIRE-OR-FOLD, and this is the one I would put in front of him.** The path CHOICE may be superseded by the basics-default design plus the creative register: if every cast is born on a register selected from the brief, a user-facing Wardrobe/Basics toggle is a second control over the same axis. Not a decision I should make |
| `CASTING_BORN_INK_SCOPE` | ⚠ **the `NOTES_MAX` census re-read** (fable-1431 §1) — the only two rolls that ever approached the cap are the only two that describe tattoos, so the cap's closure premise (*rarity*) and this flag's population are ONE population | 2026-08-25 | **HOLD** — and the coupling is easy to forget |

### The rest — 6 flags

| flag | waits on | last move | recommendation |
|---|---|---|---|
| `CASTING_OPEN_LANE_SCOPE` | nothing named | 2026-08-21 | **READ** |
| `CASTING_HAIR_REFERENCE_SCOPE` | nothing named; the three answers all act | 2026-08-21 | **READ** |
| `CASTING_REFINE_DISPATCH_SCOPE` | nothing. It removes a measured failure — 1.7% of refines answered past the ~305 s gateway wall, money safe and the REASON lost | 2026-08-21 | ⚠ **WIDEN.** This one fixes a defect customers already meet |
| `CASTING_DIAGNOSTIC_CAPTURE_SCOPE` | nothing; it keeps frames from refused renders | — | **HOLD** |
| `R7_SNAPSHOT_RESTORE_SCOPE` | must stay a subset of the read scope, which is `all` | — | **READ** — nobody has looked at this in weeks |
| `R7_EVIDENCE_INGEST_SCOPE` | the evidence family below | — | **HOLD** |

---

## The five at `off` — six since 2026-08-26

| flag | state | recommendation |
|---|---|---|
| `R7_EVIDENCE_COMPOSER_SCOPE` | the composer's runtime door, never opened | ⚠ **DECIDE.** The whole R7 evidence-composer family has not moved in weeks while the casting program consumed every shift |
| `R7_EVIDENCE_PACKAGE_SCOPE` | parented on the composer; the accepted-asset ceremony refuses to run unless it is off | **HOLD** — mechanically coupled |
| `R7_EVIDENCE_COMPOSER_RECIPE` | holds the ink-add key with the scope off, so it is inert | **HOLD** |
| ~~`CASTING_FRAMING_TRIM_SCOPE`~~ | ✅ **GONE FROM THE SERVICE 2026-09-03 (#11)** — the variable is deleted, not set to `off`, because the code that read it no longer exists and a row nothing declares can never disagree with anything. Its history: `users:1` in the record, read `off` at 2026-08-24T11:12Z after the founder's retarget, flipped back 2026-08-25 | — |
| `ENABLE_*` booleans | all three `true` | — |
| `CASTING_CREATIVE_REGISTER_SCOPE` | **NEW 2026-08-26** — the creative register (#16, N1), built dark on the founder's verdict on the court. Off, the compile is byte-identical; on, a brief the interpreter reads as creative (grounds in its own words) has its slices written ask-first with the house frame kept and a per-slice variance card | **FLIP `users:1` ON HIS WORD** for step 3 of the design's §5 — a flagged roll of his cyborg brief — then his eye on both bars is the milestone gate. Never `all` on this page's authority |

---

## What this register says as a whole

1. **Three flags could widen on somebody's word alone and are not waiting on
   anything**: `CASTING_SCAN_TABLE_SCOPE` (reduces spend),
   `CASTING_SIDE_PHRASING_SCOPE` (measured, free) and
   `CASTING_REFINE_DISPATCH_SCOPE` (fixes a defect customers meet at 1.7%).
   **That is the most actionable finding on this page.**
2. **Six flags are `READ` — nobody knows whether they work at scale.** Not
   broken, not measured. They are the honest shape of "we built fast."
3. **One flag is plausibly superseded** (`CASTING_TWO_PATHS_SCOPE`) and it is a
   founder question, not a seat's.
4. **One flag's widening is blocked by a defect found this week**
   (`CASTING_BRIEF_FIDELITY_SCOPE`), and its own documentation still described it
   as widening promptly until 2026-08-25.
5. **The R7 evidence family — four flags — has not moved in weeks.** Nothing is
   wrong with it; it has simply been out-competed for shifts by casting. Naming
   that is the point of the register.
