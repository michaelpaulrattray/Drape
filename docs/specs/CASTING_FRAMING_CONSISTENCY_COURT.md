# THE FRAMING CONSISTENCY COURT — redesign

⚠ **STATUS: DESIGN ONLY. NOTHING HERE HAS RUN AND NOTHING IS BUILT.** It comes
for countersign before one image is bought (fable-1544 Q2: *redesign, fresh
sitting, countersign first*). Zero spent writing it — every number below is
either read off an artifact already on disk or arithmetic over one, and the
arithmetic is machine-produced rather than hand-derived.

**Ordered by the founder**, 2026-08-24, verbatim: *"id like the framing to be
consistent across casts personally"* — said after asking why the suit sheet
framed tighter than the others and hearing that the orders are identical and the
engine under-obeys on business wardrobe. Recorded in `POST_SIGN_ROADMAP.md`
beside the two-paths row it came out of.

**It replaces a court that failed** (opus-1189, accepted as FAILED at fable-1544
Q1). That court's three harness defects are named in §7 and each is answered by
construction rather than by remembering.

---

## 1. What he is asking for, in the two numbers that show it

Read off `output/framing-court/arm0.log` — fifteen real production frames, two
populations, one measured word (`face`), already paid for:

```
          n   head share            within-sheet spread
SUIT      8   median 27.3%          6.6 points
BASICS    7   median 23.5%          5.7 points
```

**His complaint has two halves and they are different problems.**

- **ACROSS casts** — 27.3% against 23.5%, a **3.8 point** gap between two sheets
  given the identical framing order. That is the half he actually said out loud,
  and no court before this one has had it as its subject.
- **WITHIN a sheet** — 6.6 and 5.7 points of spread, which is `FRAMING_FIXED`'s
  own comparability law (E1: *fixed for every candidate so that comparing two of
  them compares two people*) failing on every sheet the product casts.

A cut can close both. What it cannot do is invent field of view, and that single
sentence is why the last court failed and why this one is shaped the way it is.

---

## 2. What survives from the failed court, and what does not

**Dead:** L3's premise. *Render bigger to buy margin* — the engine composes to
whatever frame it is given, so a larger render is the same picture with more
pixels. Measured, and it is not recoverable by wording.

**Alive, and load-bearing here:**

- **The cut works.** The deterministic normalisation closed `belowChin` spread
  1.13 → 0.13 on one sheet and 0.70 → 0.26 on the other. That is the consistency
  half proven, and it is the half nobody needs to buy again.
- **The fidelity objection to cutting is answered** — where the render is larger
  than the delivery, the cut is a DOWNSCALE and no pixel is invented.
- **Prose has cost this product consistency once already.** ROUND2's anti-widen
  clause moved the median where it wanted it and **widened the within-sheet
  spread from 6.0 to 11.0 points** on its own population.
  ⚠ **That pair of numbers is corrected here.** The figure this program has been
  quoting is *"7.6 → 11.0"*, and **7.6 is the UNPATHED control's spread — a
  different sheet, a different brief.** Read off the clause's own before-and-
  after in `output/two-paths-court-round2/framing-measure.log`: ROUND1 caveman
  min 19.7 max 25.7 = **6.0**; ROUND2 caveman with the clause min 20.1 max 31.1
  = **11.0**. The correction runs AGAINST the clause — the damage was **+5.0
  points, not +3.4** — so nothing that rested on it is overturned, but a
  before/after taken across two populations is the shape this campaign keeps
  finding, and it was inside its own headline number.
- **Fresh prices**, measured at the balance this shift and settled properly:
  **$0.0400 per 1024×1536 image, $0.0650 per 1536×2304** (`arm 1`, n=2 per size,
  isolated second pass). The planning constant `FAL_GPT_IMAGE_2_MEASURED_USD_PER_IMAGE`
  = $0.099 is stale by 2.5× and is not used anywhere below.

---

## 3. The mechanism: prompt for MARGIN, cut for CONSISTENCY

Each half does the thing it is good at.

```
PROMPT   asks for a LOOSER frame than we deliver. It does not have to hit a
         target — it only has to OVERSHOOT, in one direction, roughly. All the
         scatter it produces is absorbed downstream.
CUT      takes every frame to ONE common frame, deterministically. It cannot
         wobble. It also cannot crop outward, which is why the prompt half
         exists at all.
```

The reason this is not the lever that failed: **ROUND2 asked prose to hit a
target and graded it on whether it did.** Here prose is graded on whether it
overshoots, and overshooting is a far weaker thing to ask of a stochastic
engine. The cut then makes the delivered frame exact.

---

## 4. ⚠ The tension nobody has named: his order and the old median bar cannot both hold

The last court's bar said **the median must not move** — *within 1.5 points of
the sheet's own pre-change median, because his acceptance of the medians is a
ruling.*

**That bar and his framing order are contradictory, and it took writing them on
one page to see it.** SUIT's median is 27.3% and BASICS' is 23.5%. One frame
across both casts is ONE number. There is no number within 1.5 points of both.

**His order wins, and the bar changes shape.** *Consistent across casts* means
the per-sheet medians stop differing, which necessarily means at least one of
them moves. So:

> **The median bar is no longer "each sheet keeps its own median". It is "the
> common frame lands inside the band of medians he has already accepted, and no
> sheet moves more than 2.5 points to reach it".**

The accepted band, from the record: **22.3%** (ROUND1 caveman), **23.5%**
(BASICS), **26.4%** (ROUND2 caveman), **27.3%** (SUIT and the UNPATHED control).

**This is the one thing in this document I would most want challenged at the
countersign**, because it retires a bar a previous sitting wrote deliberately.
It is not a relaxation for convenience: it is that the old bar was written for a
within-sheet court and this court's subject is across-sheet, and the old bar makes
his own order unsatisfiable by construction.

---

## 5. The headline measure: `T_min`, the loosest common frame a sheet can reach

The whole court reduces to one number per sheet, and it is not a number the cut
can determine.

A frame can only be cropped IN. So for a chosen common head share `T` and common
headroom `R`, a frame is REACHABLE only if all three hold:

```
  share_raw    <=  T             the head is not already bigger than the target
  headroom_raw >=  R             there is enough above the head to place it
  below_raw    >=  1/T - R - 1   there is enough torso below the chin
```

`T_min` is the smallest `T` every frame of a sheet can reach — **the loosest
common frame that sheet can be cut to.** Today, computed over arm 0's own logged
face boxes by `scripts/_framing-tmin-disposable.mts` — which opens one text file
and divides, and is in the tree because a design that quotes a figure nobody can
re-derive is a figure that gets copied forward once and never checked again:

```
          share median   T_min      binding frame
SUIT      27.3%          31.6%      SUIT/pos1
BASICS    23.5%          27.4%      BASICS/pos0
BOTH      25.5%          31.6%      SUIT/pos1
```

**Read that last row.** A frame common to both sheets today is **31.6%** — which
moves BASICS' median **+8.1 points** and SUIT's **+4.3**, to a frame tighter than
**every one of the fifteen frames** — the target exceeds even the tightest raw
share (31.3%), because it must also leave room to place the common headroom.
**Consistency across casts is unaffordable
today, and that is exactly the gap the margin clause exists to close.**

⚠ **AND THE TWO "ESTIMATORS" THE LAST COURT USED ARE NOT TWO READINGS.**
`belowChin` is not independent of head share — it is algebraically determined by
head share and headroom:

```
  below  =  1/share - headroom - 1        holds on 15 of 15 frames, exactly
```

(Evaluated on every frame rather than asserted — the script exits nonzero if it
ever stops holding, because a stated identity nobody checks is an assumption
wearing a proof's clothes.)

So *"both estimators agree"* was one reading and a restatement of it wearing a
second name. **The two free quantities are head SIZE and head PLACEMENT**
(`share`, `headroom`); `below` is the third and is derived. This court measures
the two free ones and prints `below` as derived, labelled as such — which is the
same discipline as §7's first defect, one level deeper.

---

## 6. The bar, written before the run

Every bar below is on the RAW frame — the input to the cut. **No bar in this
court is measured on a quantity the cut determines**, which is the direct repair
of the last court's first defect.

### 6.1 The margin bar — three-way, pre-registered

On `T_min` computed across BOTH sheets, under the clause:

```
PASS      T_min <= 26.0%     a common frame at 26.0% moves no sheet's median
                             by more than 2.5 points. The split works. Build it.
PARTIAL   26.0 < T_min <= 29.0
                             a common frame exists and costs a median move he
                             has to see. The court's output is the strips and
                             the number, and HE rules.
FAIL      T_min > 29.0%      the clause bought less than a third of the gap.
                             Prose is not a margin source, across-cast
                             consistency is deferred, and the honest fallback is
                             WITHIN-sheet consistency alone — each sheet cut to
                             its own T_min, which costs no median move at all
                             and is still a real answer to half his complaint.
```

**It can go red**: today's number is 31.6%, which is a FAIL by this bar. The
clause has to buy a **1.22× linear widening** on the binding frame to reach PASS.

### 6.2 The perturbation bar — and it is calibrated on a clause that would fail it

The clause must not degrade the picture it widens:

```
  raw within-sheet share spread under the clause  <=  control spread + 2.0 pt
```

**ROUND2's clause moved its own population 6.0 → 11.0, which is +5.0 — it would
fail this bar two and a half times over.** That is deliberate: a bar no
previously shipped lever could fail is not a bar.
Control cells are rendered in the same run, same brief, same seeds, same
wardrobe line — the clause as the only variable.

### 6.3 The delivered numbers are REPORTED, never the bar

The instrument prints post-cut share and headroom spread **with the clamp count
beside them**, and where clamps are zero it prints, in those words:

```
  DETERMINED BY THE CUT — NOT EVIDENCE
```

A post-cut spread of `0.0pt` with no clamps is the transformation restating its
own definition. It is a check that the cut executed, and the instrument says so
on its own face rather than leaving a reader to notice.

### 6.4 His eye, last

Two strips, same construction as the ones he has already seen:

- the cut sheet beside sheet 2 — **within-sheet** consistency;
- the cut SUIT sheet beside the cut BASICS sheet — **across-cast** consistency,
  which is the thing he actually asked for and which no number substitutes for
  (law 9).

---

## 7. The last court's three defects, made structural

Each is answered by construction. None is answered by remembering.

### (1) The bar that could not go red

**Was:** the cut sets head share to `targetShare` by arithmetic, and the bar was
on head share after the cut. `spread 0.0pt` measured nothing.

**Now:** every bar is on the raw frame (§6), the derived-vs-free distinction is
stated (§5), and the instrument labels its own determined outputs (§6.3).

### (2) The wardrobe line never reached the prompts

**Was:** the harness called `castingBriefCompiler({ briefText })` with no `path`
and no wardrobe, so the "suit sheet" rendered in the house grey crew tee. Found
by opening a frame.

**Now, asserted at the wire.** The harness passes `path` and `inheritedWardrobe`
exactly as `createRoll` does (`server/castingV2/rollService.ts` — `path:
bornPath`, `inheritedWardrobe`, `pickWardrobe`), and then, before one image is
dispatched:

```
  every one of the eight composed prompts CONTAINS the resolved wardrobe line,
  or the run throws and buys nothing.
```

`inheritedWardrobe` is used rather than `pickWardrobe` because it is the real
path a FOLLOW travels and it is deterministic — the founder's population is the
suit, not whatever the interpreter picks today. **And a frame is opened before a
number is read, on every cell**, because that is what caught this the first time.

### (3) The price measurement was destroyed by an auto top-up

**Was:** `fal spent $-18.6600`. A $20 auto top-up landed mid-run.

**Now, two guards, and the first is the one that matters:**

- **The run REFUSES TO START** unless the balance can absorb twice the expected
  spend and still sit clear of the top-up trigger.
  ⚠ **And the trigger is not $20, which is what "auto-replenishes at $20" reads
  like and is not what was observed.** $20 is the AMOUNT. Read at the incident's
  own arithmetic: the run began at **$10.01**, spent ~$1.34, and settled at
  **$28.67** — so the top-up fired while the balance was somewhere between
  **$8.67 and $10.01**, which is the only observation of the trigger this
  account has. The guard is written against the observed ceiling with margin:
  `balance − 2 × expectedSpend > $12`. At today's **$28.67** and an expected
  ~$3, that is $22.67 against $12 — **clear with room, and the court's price
  reading is not compromised.** One observation is one observation, and the
  guard says so where it is written.
- **Any rise voids the reading.** Direction is checked as well as delta, and a
  run whose ledger rose reports `UNMEASURED`, never a cheap number.

Both are doctrine #25 (`INSTRUMENT_DOCTRINE.md`), which was written out of this
exact incident.

---

## 8. ⚠ A defect in the cut itself, found while designing it: the landmark is wrong

The normaliser places the frame from the **face** box. `FRAMING_FIXED`'s CROP
clause is about the **hair**:

> *"The subject's ENTIRE HAIR SILHOUETTE is inside the frame … Nothing on the
> head is clipped: not the crown, not the hairline, not a single strand."*

That clause exists because of a founder gate on 2026-07-31 — *the first sheets
cropped scalps and read as mugshots.* **A cut that sets headroom from the face
box will guillotine an afro, an updo or any volume the hair carries**, and it
will do it deterministically, on every sheet, which is worse than the wobble it
was built to remove.

So the cut needs a **head-top landmark** rather than a face-top one, and which
measured word delivers one is not known. That is arm H below: two words asked of
frames already on disk, no render, ~$0.08. **It is a prerequisite of the build
and cheap enough to be a prerequisite of the court.**

---

## 9. The arms, priced from fresh measurement

Prices are the ones measured at the balance this shift — **$0.0400** per
1024×1536 image, **$0.0650** per 1536×2304, **$0.005** per segmenter read, ~$0.08
per interpreter compile (openrouter). The 2026-07-30 constant is not used.

**No arm spends a credit and no arm mints a row.** Every arm composes through
the product's own entrance and dispatches directly; the candidate row and the
charge are the only absentees, and neither bears on whether eight frames agree.

### Arm H — the head-top landmark. ~$0.08, no render.

Ask `hair` and `head` of eight frames already on disk (arm 0's own SUIT set,
plus the tallest-hair frame the court can find) and see which returns a box whose
top sits reliably above the face box. **Decides whether the cut is buildable at
all**, and it is the cheapest thing on the board.

### Arm R — does render size change composition? 16 images, ~$1.00.

Eight at 1024×1536 and eight at 1536×2304 — **same brief, same wardrobe line,
same seeds, size as the only variable.** This is fable-1544's §4 question,
settled unconfounded rather than quarantined, and it is a prerequisite rather
than a curiosity: **the cut needs pixels to spend, so the shipping render is not
the delivered size, and if size moves composition then the clause must be
calibrated at the size we ship.**

It also re-takes the price reading the top-up destroyed, as a by-product, under
§7(3)'s guards — which closes the queued stale-constant row.

⚠ **The eight 1024×1536 frames are the SUIT control cell for arm M**, same
sitting and same seeds. That is why arm R renders eight per size rather than the
two a price reading would need.

### Arm M — the margin clause. 24 images, ~$1.80 at the larger size.

```
  suit + clause        8    the founder's own population, the tight one
  basics + clause      8    the OTHER side of the measured gap, the loose one
  basics control       8    same path, same seeds, clause as the only variable
```

The suit control is arm R's. Measured on `share` and `headroom`; `T_min` and the
spread bars computed per §6.

⚠ **The second sheet is BASICS and not the caveman, and the reason is §1.** The
across-cast gap this court exists to close is **SUIT 27.3% against BASICS
23.5%** — those two populations, measured on real frames, are the gap he saw. A
caveman cell would buy brief-generality and no across-cast evidence at all,
which is the wrong purchase for the court's own question. The caveman keeps its
place in this design as the population the perturbation bar is calibrated on
(§6.2) — data that already exists and costs nothing to use.

### The clause itself, for countersign

**A landmark swap, not an added sentence.** `FRAMING_FIXED` currently says:

> *"Frame from mid-torso up in a 2:3 portrait."*

The candidate replaces the landmark with a lower one and adds one overshoot
permission:

> *"Frame from the hips up in a 2:3 portrait. If in doubt include MORE of the
> body rather than less — a little extra room below and at the sides is
> correct."*

**Swapped rather than appended on purpose**: ROUND2's specimen is an ADDED
framing sentence that doubled the spread, and this campaign has measured that a
subset of prompt context raised the stage wall twice as often as its superset.
One candidate wording, not two — a second doubles the court and the bar is
overshoot rather than accuracy, so wording precision is worth less here than it
looks.

### Total

```
  arm H   ~$0.08                        fal
  arm R   ~$1.00  (+$0.08 openrouter)
  arm M   ~$1.80  (+$0.16 openrouter)   at 1536x2304; ~$1.20 at 1024x1536
  ------------------------------------
  ~$2.9 fal + ~$0.24 openrouter, NO CREDITS at any point
```

⚠ **openrouter holds $3.33** and the rite is printing its LOW banner. Three
compiles is ~$0.24 of it. That is affordable and it is worth saying out loud
before a court that needs the interpreter is authorised.

---

## 10. What this decides for the build, and for the settings modal

**Where the cut would live** is a build question and not this court's, but its
shape is already fixed by what the court proves: a post-render step on the
delivered bytes, before storage, behind its own scope flag, dark first — the
ratchet every capability in this program has run. It is named here so the court's
report has somewhere to land, not because anything is ordered.

⚠ **AND FRAMING IS NOW ON HIS OWN CANDIDATE LIST AS A CUSTOMER AXIS**
(fable-1548; `CASTING_SETTINGS_MODAL_DESIGN.md` §10b). Two things follow, and
both are free to state now and expensive to discover later:

- **The cut can only ever serve targets TIGHTER than what was rendered.** A
  customer option that is WIDER than the house frame — full-length, say — is not
  a cut at all, it is a different render order. So a framing vocabulary splits
  into *cuttable* options and *re-render* options, and only the first is free.
- **Framing PASSES §7's picture-per-option test**, which is the modal design's
  own law: it is a CLOSED vocabulary, and every option is a real render of what
  the option genuinely does, mintable once as an artifact. That is worth knowing
  at the modal build — most candidate axes will not pass it.

**This court establishes the mechanism and the number, and neither is the axis.**
It measures `T_min`, which is *the loosest frame reachable* — so the reading
generalises to any target inside the band rather than certifying one constant.

---

## 11. Open questions for the countersign

1. **Is §4 accepted** — that the median bar changes shape, because his order and
   the old bar are contradictory? Recommendation: **yes.** The old bar is a
   within-sheet bar and this is an across-sheet court; keeping it would make his
   own order unsatisfiable by construction. It is the one retirement in here and
   it should be argued with rather than nodded through.
2. **Arm H first, alone, as a gate?** Recommendation: **yes.** Eight cents
   decides whether the cut can respect the hair clause at all, and a cut that
   guillotines crowns is not shippable however consistent it is. If arm H finds
   no usable head-top word, the court stops there and the finding is worth its
   own message.
3. **Is the three-way bar (§6.1) the right shape**, or should PARTIAL collapse
   into FAIL? Recommendation: **keep three.** A common frame that costs a median
   move is a genuine product decision and it is his; collapsing it would either
   throw away a working mechanism or ship a median move he never saw.
4. **Is BASICS the right second sheet** (§9, arm M), against the caveman the
   last court used? Recommendation: **BASICS.** It is the other end of the only
   across-cast gap this product has actually measured, and across-cast is the
   court's subject. It costs the same and the caveman's data stays useful where
   it already is. ⚠ It does change one thing worth naming: BASICS is a PATH
   rather than a brief, so the clause is being tested across a path boundary as
   well as a brief one — which is more like the real population and less like a
   clean single-variable A/B. The control cell is what keeps it honest.
5. **Does anything reach him before the court reports?** Recommendation: **no.**
   §1's 3.8-point across-cast gap is the first number that answers his question
   directly, and it should reach him with the strips beside it rather than
   alone.

---

## 12. What this report decides

**Nothing.** It is a design and a price. No image is bought, no clause reaches
`FRAMING_FIXED`, no flag is created, and the cut is not built. The next thing
that happens is a countersign or a correction.
