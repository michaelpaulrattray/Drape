# V2 — the promotion kit: the shape note

*Written 2026-08-14 by the executor, before the first court runs. Approved shape
per fable-516; the milestone is `docs/specs/VOCABULARY_OVERHAUL_REVIEW.md` Part
2, V2. Nothing here has been driven with a transport yet — what HAS been built
is the runner every court sits on (`scripts/lib/court.mts`, ten controls, three
sabotages).*

---

## What the kit is for

A kind arrives in this product by demand: somebody asks for horns, the ask has
nowhere to file, and the demand table counts it. Promoting that kind — giving it
a card, a region, a slot — is cheap now (V1: two or three registrations). What
is NOT cheap, and what has always been done ad hoc, is answering whether the
product can actually deliver it.

**The kit is the four questions a kind must answer before it is promoted, in a
form one shift can run.** Each is a court: pre-registered bars, a measured noise
floor, a status-quo arm, and one output rule — *measured numbers or a named
refusal, never a guess.*

---

## The four courts

### 1. DELIVERY — does the ask land at all?

*Does asking for this kind produce it, on a real face, at a rate worth charging
for?*

- **Arms**: words-only (the status quo for a new kind), and whatever carrier the
  kind's card proposes.
- **Floor**: two renders of one face with the kind never asked for. The wobble
  that is not the ask.
- **Bar**: the D-236 delivery bar — **95% per class and zero false passes**.
- **Costs**: ~8 renders (the floor's two plus three per arm) and the reader
  calls to judge them. House money.
- **A PASS admits**: the kind may be asked for at all. Without it nothing else
  is worth measuring, which is why it runs first.

### 2. SURVIVAL — does it stay through an unrelated edit?

*Ask for the kind, then ask for something else entirely. Is the kind still
there?*

- **Arms**: words-only, plus each carrier shape the kind can support (a cut, a
  patch, a minted crop).
- **Floor**: the same wobble, measured on the same two frames.
- **Outcomes**: `SURVIVED` / `MELTED` / `PARTIAL`, reported raw and
  unclassified where it is neither.
- **Costs**: ~21 renders and ~30 segmentations — the skin-carrier bench's own
  measured cost, and the most expensive of the four.
- **A PASS admits**: the kind may be CARRIED, which is what lets a later edit
  keep it. A fail means the kind is words-only, stated rather than discovered.

### 3. REMOVAL — can it be taken back?

*"Take it off." Does the frame come back without it, and does the vacancy read
as a real absence rather than a hole?*

- **Arms**: the vacate phrase from the kind's own card, and the ordinary-edit
  road (the status quo for everything outside the three vacate kinds).
- **The asymmetric arm**: for a PAIR, one side removed and the other kept — the
  case that has cost this program twice, because a painter reading loosely takes
  both.
- **Costs**: ~6 renders plus a per-side reading.
- **A PASS admits**: `departable: true` on the kind's card — which is a written
  decision today and would then be a measured one.

### 4. DETECTION — can the scan see it when it is there, and say so when it is
### not?

*Three classes, and the middle one is the whole difficulty: worn, visibly bare,
and not visible at all.*

- **Arms**: the segmenter question from the region card, at the floor its own
  court measures.
- **Floor**: per-boundary — whole-frame for a single thing, per-SIDE for a pair,
  because a union floor sits above two of sixteen measured worn sides and would
  lose a real earring on one wearing ear in eight.
- **Costs**: ~16 frames × 1 read, the cheapest of the four.
- **A PASS admits**: the kind's detector may be ARMED. Until then the panel
  says nothing about it, which is honest and is what `deferArming` already does
  for earrings.

---

## Where a verdict files

**On the card, per V1's pattern.** A court's output is a fact about the kind, so
it belongs where the kind's other facts are:

```
delivery    subject card    the kind may be asked for
survival    subject card    a carrier field, with the winning arm named
removal     subject card    `departable`, measured rather than declared
detection   region card     the detector's floor and its arming state
```

The reading itself — floor, signal, per-arm numbers, the date and the specimen
— rides with it, exactly as the lips phrasing does today. A promotion whose
evidence lives in a shift report is a promotion nobody can re-check.

---

## What runs first, and what it costs

**Horns**, because it is the program's own founding example and the founder
asked for it in his own words. In order:

1. **Delivery** (~8 renders). If horns do not land, nothing else matters and the
   kind stays a demand-table row with a measured reason.
2. **Detection** (~16 reads, cheap). Whether the scan can see them decides
   whether the panel may ever draw a row.
3. **Survival** (~21 renders). The expensive one, and only worth buying once
   delivery has passed.
4. **Removal** (~6 renders). Last, because "take the horns off" is only a
   question once horns exist.

**Total if every court runs: ~35 renders and ~45 reads of house money.** No user
credits, no ledger rows, no writes to any table — the bench kit's ledger watch
throws if that turns out to be false.

---

## What the kit refuses to do

- **It does not promote on a guess.** A court that cannot measure its floor
  refuses, and a refused court runs no arms and spends nothing.
- **It does not crown a carrier worse than what ships.** Every court carries a
  status-quo arm, and the runner refuses to start without exactly one.
- **It does not count an arm that never ran.** An arm whose subject did not
  reach the wire is VOID — two benches in this program passed while the thing
  under test was inert.
- **It does not decide which kinds get run.** That is the demand table's job:
  the kinds with rows are the kinds people are asking for, and a kit that chose
  its own subjects would be measuring what we find interesting.
