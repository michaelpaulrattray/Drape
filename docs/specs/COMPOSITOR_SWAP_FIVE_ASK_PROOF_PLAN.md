# The five-ask dark proof — costed, before any spend

**Plan, owed before the run** (fable-283: the dark-proof plan comes to Fable
BEFORE any spend; fable-296/297: reference dimensions carried on the accessory
steps, the painter-scale question named as an instrument). Shift 57.

This is the last artifact before the flip line.

## What it is for

The compositor swap has a production caller, deployed dark, and every part of it
has been proved in isolation. Nothing has yet asked it to paint five times in a
row on one face. The proof answers one question — **does a chain of real asks
land, carry, and refuse correctly on the new road** — in a world where being
wrong costs dev credits and nobody's panel.

## World, face and spend, declared

| | |
|---|---|
| database | **DEV** (`:52008`), never production |
| bucket | the dev bucket |
| app | a local `pnpm dev`, with `CASTING_REPAINT_SCOPE=users:1` **on the command line only, never in `.env`** — the flag must not survive the run |
| user | 1 |
| face | a candidate with **0 variants and 0 live library rows** — `828db9b8-ae18-4686-8141-532cf7019ed7` (cand 360) or another of the seven like it. The degenerate case is the road every new cast travels, and starting empty means the walk GROWS the library rather than inheriting one |
| spend | **125 dev credits gross**, 25 expected back on step 5 → **100 net**. Dev ledger stands at 360 gross / 0 refunded / 9 rows, and is reported beside production, never summed into it |
| provider | one paint per step; vision calls for the mint's ground, guard and words reads (two words calls per small slot after `8ecbf208`) |

## Step 0 — the driver refuses the dev world by construction

`drive-finding-replay.mts` throws when `--bucket` equals the local `.env`'s
bucket: *"the dev world, and these rows are production's"*. That guard is right
for `--controls`, which reads the founder's own production frames, and it is
applied at module scope to every mode — so **a dev spend cannot be launched at
all** without amending it.

The amendment is narrow: scope the refusal to the mode whose claim it protects
(`--controls`, and any read of production rows), leaving `--spend` free to name
the world it is actually walking. It is a precondition of the run and gets its
own control: a `--controls` invocation pointed at the dev bucket must still
refuse.

**[E] is also repaired here**, as the standing queue says: it asserts `.dpc-kept`,
which panel v2 empties by construction (`CastingSheet.tsx:900`), so four of run
2's five failures were the harness measuring a retired surface.

## The five asks, and what each one is load-bearing for

Order per fable-135 — accessories first, while her ears are visible.

| # | ask | what it proves on the new road |
|---|---|---|
| 1 | gold hoop earrings | the **degenerate case**: an empty library, master alone plus words. The mint files the first crops |
| 2 | dangly cross earrings | **an edit of a slot that already carries a minted crop.** Until `e94c3fb3` this refused and refunded — the assembler's `carriesItsOwnEdit` on a caller that always produced it. This step is that defect's natural reproduction |
| 3 | copper hair | an **unrelated** ask: the earring crops must carry untouched, by pixel identity, while a different slot is edited |
| 4 | wear her hair down | the founder's own ask, and the **second** instance of step 2's collision (step 3 minted a hair crop; this edits hair). Also the D-246 (c) gate the presence/degree table binds |
| 5 | remove her glasses | **a designed refusal.** The repaint cannot yet say a removal declaratively (`repaintCannotRemove`), so this must refuse into the refund and return 25 credits. Chunk 3's design (`LIBRARY_REMOVAL_DESIGN.md`) is what eventually turns this into a paint; until then, proving the refusal-and-refund IS the deliverable |

**Two of the five steps would have refused before today.** That is the argument
for running the whole chain rather than sampling it.

## What is measured, per step

1. **The recipe at the wire** — what was actually sent: reference count, each
   reference's role and slot, and **the pixel dimensions of every reference**.
   The painter-scale question (fable-296) lives here: an earring crop is 24–36 px
   wide, and whether an engine can reproduce a feature from a file that size is
   unanswered. The report carries the dimensions beside each step's verdict so
   the answer is legible rather than inferred. *If small references measure as
   the limiter, the founder's approved 2K test stops being a quality lever and
   becomes the fix — which moves its priority.*
2. **The library after the step** — rows minted, their words, their crops'
   dimensions, and what was refused at the door with its reason.
3. **The delivered frame**, kept. A walk's evidence is the only copy of a paid
   render's day; `--out` must name a fresh directory (the driver enforces this
   after run 2 was aimed at run 1's frames).
4. **The carry proof** on step 3: the earring crops' digests before and after an
   unrelated ask, byte-identical or the carry contract is not what it claims.
5. **Money**: every step's charge and every refund, read from the ledger rather
   than from the run's own account of itself.

## What stops the run

- Any step refusing for a reason not in this plan — an unexpected refusal is a
  finding, and the walk stops rather than spending the next 25 credits to see
  whether it happens twice.
- The ledger disagreeing with the run's own tally at any step.
- Step 5 refusing for the wrong reason, or refusing and NOT refunding.

## What it does not do

It does not flip anything. The flag lives on one command line, the run is dev,
and the flip line is a separate founder gate carrying this proof's tiles and
rows as its evidence.
