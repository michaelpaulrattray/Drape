# The vocabulary system — Fable review and overhaul program plan

*Per fable-393 §1 (founder: "a full vocabulary system overhaul kicking off with
a fable review — makeup is too narrow"), with rulings 2 ("anything should be
removable") and 3 ("auto detect should be a full system") as the program's
targets. Written 2026-08-13 from a full inventory of the catalogue as built
(counts verified against source; the OPEN_LANE_DESIGN_NOTE's 23/24 figures are
stale — it is 28 subjects / 29 facets since the body work landed).*

---

## Part 1 — Findings

### F1. The bones are good: most of the system is derived and total

Eight tables are compile-closed over the subject set (FREE_SUBJECTS,
FREE_SUBJECT_KIND, SUBJECT_NOUNS, SUBJECT_QUALIFIER, CHANGE_AMPLITUDE,
ZONE_SCOPE, MOVES_ITS_EDGE, FACET_SLOTS) — a new kind will not build without
an answer in each, which is the right refusal. And the expensive surfaces are
already DERIVED: the scan plan, the bilateral reader's set, the accessory
slots, the vacate phrasing in the assembler all follow the tables with no
edit. The overhaul is not a rebuild; it is finishing a job the codebase
started.

### F2. The silent deciders are the standing hazard

Three lists decide by ABSENCE (PLURAL_SUBJECTS, DEPARTABLE_SUBJECTS,
PRESENTATION_SUBJECTS) and a fourth behaves that way undocumented
(REGION_OF_FACET covers 21 of 29 facets; the missing 8 fall to null by
omission). A kind absent from all of them is not undecided — it is decided
invisibly four times. This is the unowned-axis class at the vocabulary layer
and it is where a new kind's bugs will live.

### F3. Removal is three exceptions, not a system (founder ruling 2's gap)

- Removable today: earring, glasses, nose stud — the kinds with a benched
  `vacantPhrase`. Everything else refuses.
- **Three of the four DEPARTABLE_SUBJECTS cannot actually deliver a
  departure** (ink, marks, facialHair) — the list says "removable," the road
  says no, and the refusal even mislabels its reason (an ink departure
  reports `unnamedObject` when the true cause is a decided `notASlot`).
- Pruning (removing what an earlier edit added) refuses wholesale (D-244 —
  the stack is not yet derived from the chain's own pruning).
- "Remove her hair" (→ bald) is not even a departure candidate today: hair is
  not in DEPARTABLE_SUBJECTS, and baldness is a new class — a born-worn
  removal of a feature every completeness instrument assumes present.

### F4. Detection is one kind armed, and its classes are too narrow a universe

Armed: glasses. Earring has a floor live for the DEPARTURE gate but inert for
detection (deferred pending a proper 3-class court). Nose stud: nothing.
And the detector's class list derives from the ACCESSORY table only — skin
type, body type and tattoos (founder ruling 3's list) are not accessory
kinds; they need their own detection stories (skin/body: the scan words
reader now in flight; tattoos: `ink` is a `notASlot` resident with no slot,
no region, no court).

### F5. Adding a kind costs too many hands

Measured on the specimens: an accessory kind touches ~4 mandatory tables, +1
pair noun, +2 measurement courts, +1 completeness specimen before it can mint,
+1 noun list, and **4–5 prose sites no test closes**. `glasses` still has one
bare string literal typed into a segmenter call outside every table
(refineService.ts:2066). A free subject touches 8 compile-closed tables plus
the silent lists. This cost is why the vocabulary grew as exceptions.

### F6. Assorted debts the inventory surfaced

The interpreter prompt promises four walls and names three (the fourth exists
code-side only); the OPEN_LANE_DESIGN_NOTE's counts are stale; crop-minting
completeness has one family specimen (hair) and one centreline specimen
(earring, n=1); `makeup`/`ink`/`expression` sit in `notASlot` awaiting their
systems.

---

## Part 2 — The program (five milestones, founder gates marked)

**V1 — ONE REGISTRATION PER KIND.** A single catalogue entry per kind feeds
every table: the compile-closed eight stay closed but derive from the entry;
the four silent lists become REQUIRED fields of it (silence becomes a loud,
written decision); the prose sites are derived or deleted; the stray literals
(refineService:2066) join the tables. Acceptance: adding a scaffold test kind
touches ONE file plus its courts, and the Atlas can count the vocabulary.

**V2 — THE PROMOTION KIT.** The four standard courts packaged so one executor
shift can run them for any kind: departure floor (two populations), detection
(three classes — worn / visibly-bare / not-visible), removal phrasing (with
the asymmetric arm for pairs), carry survival (tone/feature survives an
unrelated edit — the fable-361 §1 carrier bench is this court's prototype and
runs first as already ordered). Output per kind: measured numbers or a named
refusal, never a guess.

**V3 — REMOVAL UNIVERSALITY (ruling 2).** In rising order of difficulty:
(a) new accessory kinds by kit (necklace, watch, hat…); (b) the ink/marks/
facialHair slot stories so every DEPARTABLE subject can actually deliver;
(c) PRUNING — deriving the word stack from the chain so an added thing can be
taken back (the largest single build in the program); (d) the extreme class —
"remove her hair" → bald — designed as its own bench (it inverts every
completeness assumption and is identity-adjacent). **Founder gate: (d)'s
design before build; pricing of any newly-chargeable removal.**

**V4 — DETECTION UNIVERSALITY (ruling 3).** Earring and nose-stud detection
courts (the earring reader's answers-something-on-every-face anomaly settled
first); tattoo/ink detection designed with its slot story from V3(b); skin
and body ride the scan words reader (already in flight). Target: what the
product can say, the scan can see — every armed detector court-proven, no
detector armed by default.

**V5 — THE OPEN LANE DELIVERS (phase 2+).** The recipe assembler carries
slotless asks (the majority of the open-lane build, sized in
OPEN_LANE_DESIGN_NOTE); crop-and-carry via the generic mint door (the
master-declines negative control, already ruled); demand-table-driven
promotions begin — makeup enters here as one promotion among many, per the
founder's "makeup is too narrow." **Founder gate: first spendable open-lane
render class.**

> **V5 PREP, 2026-08-16 (fable-757 §4): the reconciliation lives in
> `OPEN_LANE_DESIGN_NOTE.md` §9** — the clause table (DELIVERED / REMAINING /
> SUPERSEDED), the size in the note's own step numbering, and the founder gate
> with the reading it should be brought with. One pointer rather than a second
> copy: the table is derived from the source and would drift here. Its headline:
> **`horns` was promoted into the CLOSED lane** (subject #29, per-side slot,
> in the guidance the interpreter is sent), so the open lane's worked example
> shipped down the other road — and the measured open demand in production is
> **one paid ask, ever** ("give her vampire fangs").

**Sequencing with the live queue:** the executor's current run finishes first
(scan descriptions → carrier bench → per-eye bench) — the carrier bench is
V2's prototype court, so nothing waits idle. V1 starts on this plan's
approval; it is the multiplier every later milestone spends.

**What this program retires from the filed list when done:** makeup (V5),
pruning (V3c), born-worn arming (V4), single-side asks (V2's mirror-hazard
court), the tattoo flash-sheet system's vocabulary half (V3b/V4).

---

## V4 — CLOSED, 2026-08-16 (fable-648)

*Closed on the clause table below, with a standing instrument rather than a
document: `server/castingV2/detectionUniversality.ts` prints the map and
`detectionUniversality.test.ts` holds its properties, so a regression reddens
the suite instead of ageing quietly in this file.*

### The target, clause by clause

| V4's own words | State at close |
|---|---|
| earring detection court | **DONE** — armed, per-side floor `0.00009` measured at the boundary it is read at, presence-only per fable-435 |
| nose-stud detection court | **REFUSED ON MEASURED DEMAND** (fable-647). Zero asks across 260 production and 159 dev briefs and refine instructions, against earring 20 and glasses 22, control proving the search reads. Filed as `courtDeferred`, not as a gap |
| "the earring reader's answers-something-on-every-face anomaly settled first" | **DEAD before the arming** — the uniform 0.02–0.03% was a WORN population read per side, not a reader answering on every ear |
| tattoo/ink detection, *"designed with its slot story from V3(b)"* | **BLOCKED ON V3(b), by V4's own words** — a dependency, not a gap. `ink`'s question comes from a PLACEMENT, and inventing a `tattoo` region here would ask a segmenter an open question (D-213) |
| skin and body ride the scan words reader | **BOTH SEEN** — skin under its `display` region, build COMPOSED from a head read and a subject matte |
| every armed detector court-proven | **MACHINE-HELD** — armed-on-an-unmeasured-floor prints VIOLATION, driven |
| no detector armed by default | **MACHINE-HELD** — arming requires a measured floor, and a paired kind requires both boundaries |

### The seven gaps, and why none of them owed a court

Six carried a ruling already; **four of those are the founder's own recorded
words.** The map had been reporting settled decisions as open work, which is
what `courtDeferred` and the NOBODY-SAYS-THIS state now prevent.

| Gap | Ruling | Citation |
|---|---|---|
| cheekbones, jaw, chin | **by design** — facial structure runs as words, no cutouts | founder, fable-360; each part named again in fable-382 §1 |
| lashes | **by design** — folded into the eye row; the only region containing lashes IS the eye, so a lash crop is the eye's crop renamed | founder, fable-382 §1; D-242 |
| expression | **by design** — presentation rather than identity, and no zone contains it | D-136 |
| makeup | **by design today**, and V5's named promotion — worn STATE on the anatomy it sits on | fable-168; V5 |
| ink | **deferred to the tattoo studio** with its slot story | D-138, D-213 |

### What the map read at close

```
30 facets · 23 SEEN · 7 GAP · 0 VIOLATION
gaps: cheekbones, chin, expression, ink, jaw, lashes, makeup
arming: earring ARMED · glasses ARMED · nose stud NOBODY-SAYS-THIS
```

Run it with `npx tsx scripts/v4-detection-map-disposable.mts`, and never publish
a clean reading without `--controls` beside it: an inventory that cannot print a
gap looks exactly like one that has none.

### Two facts the phase produced that outlive it

- **A face scan costs 20 segmenter reads, $0.100 per version** — counted through
  `scanFace` with a recording reader (`scripts/count-scan-reads-disposable.mts`),
  after two hand-derivations of that figure were wrong in a row. A figure quoted
  more than once gets a script, not a memory.
- **The corpus is the demand reader the demand table cannot yet be**
  (`scripts/read-vocabulary-demand-disposable.mts`). Its limits are declared: a
  floor on demand, never a measurement, and blind to any kind asked for in words
  nobody registered. When V5 gives `casting_open_lane_demand` its writer, this
  reader is the historical backfill and the cross-check.
