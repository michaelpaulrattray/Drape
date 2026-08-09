# Segment permanence — the implementation design

*Design document. No code has been written. Ordered by the founder
(fable-073/075) and ruled directionally by him (fable-076): **"this is the way
— the segments path: edits can never drift, are always editable through precise
edits, and removable by removing the reference image and text associated."**
Reconciled into one design per fable-077; conditions from fable-078; the
engine and accounting notes from fable-079. Written 2026-08-09.*

Supersedes `CASTING_V2_CHAIN_ANCHORING_DESIGN.md`, which priced three options
before the ruling.

---

## 0. The sequencing decision this document feeds — costs, no recommendation

The founder's next call is **certify M8 under today's architecture first, or
pivot now and certify once on the architecture he is going to keep.** Per
fable-076 the honest costs go here and the recommendation is attached
separately, once the estimate below has been read.

**Certify first** — wall fix → walks → Tier A → pack → Sign, then build
segments. What it costs: the certification is performed against a rendering
contract that is being replaced, so **every number that depends on carried
facets has to be earned twice**. The per-class delivery table, the retry
economics, and the 95%-per-class bar are all measured on a lane whose failure
mode segments deletes outright. What it buys: a certified, shippable milestone
sooner, and walks resume immediately.

**Pivot first.** What it costs: **8–10 working days before a walk can be
counted** (§9, slice 1), on a campaign whose clean-walk count is currently 0/2.
What it buys: one certification instead of two, and an easier bar rather than a
harder one — because a carried facet stops being a dice roll and becomes
arithmetic, so the class that has blocked this campaign for four shifts leaves
the measurement entirely.

**One thing is true under both, and it is already committed:** the caption fix
(`87532bcc`) took `marks` from 0/16 to 11/16 on the carried lane. It ships
whatever the founder decides, because overlap repaints carry prose for as long
as the product exists.

## 1. Why not the other two, briefly

**A — today's architecture (base anchor + words).** Prior deliveries survive as
prose, so every later render re-rolls the painter's dice on every earlier
facet. Measured this shift on run-15's own face: even after the caption fix,
the carried lane's ceiling is a *probability per facet per render*, compounding
with chain length. It cannot be argued up to certainty by better words, and
four shifts of trying is the evidence.

**B — chain anchoring (each render painted on the previous composite).** It is
the smallest diff and it pays for it twice. v2 already did this and was
withdrawn (D-152): conditioning on the parent's pixels inherits its softness
once per generation, and six edits deep the founder's own gauntlet was visibly
blurred **while every facet-survival instrument read green**. It also brings
back D-146's intensification — "copper" on already-copper pixels re-dyes dyed
hair — and it turns mid-chain undo from a free click into up to N−k serial
re-renders. Segments get B's persistence without any of that.

## 2. The design

When an edit is kept, the pixels it was accepted for are **cropped and stored
as a named segment**: the facet it answers, the mask it occupies, and the
content inside that mask. Nothing else about rendering changes. Every render is
still painted from **the sharp original**, and the compositor assembles the
delivered frame from three sources instead of two:

1. **the master**, everywhere untouched;
2. **the stored segments**, for regions this edit does not overlap — pasted
   deterministically, never re-asked and never re-rolled;
3. **the fresh paint**, inside this edit's applied mask.

Where a new edit *does* claim ground a segment owns, that region repaints, and
the segment's crop rides along as a supporting reference so the repaint matches
what she already had.

### 2.1 The anchor question, resolved

fable-077 asks which anchor semantics the segment mechanism actually wants. The
answer is **the master, and the segment store is what makes that affordable.**

Persistence becomes a property of the **compositor**, not of the anchor. Once
that is true, the anchor is chosen on other grounds, and on every one of them
the master wins: no photocopy loss ever, D-146's guard intact (the painter
never sees the prior state, so it cannot re-dye it), the seam instrument's
calibration still valid (§5), and prune still free.

There is one thing a parent-composite anchor would buy — the painter can see
her accumulated state — and it matters in exactly one place: an edit that has
to reconcile with an earlier one. That place is the overlap region, and
**patch-crops-as-references buy it there without paying for it everywhere**.

And a coherence argument that only holds under the master anchor: every source
the compositor assembles — the master, every segment, and the fresh paint —
was rendered against *the original's lighting*. They share one basis. Under a
parent-composite anchor the sources would come from different generations with
drifting tone, and the compositor would be blending photographs of slightly
different afternoons.

### 2.2 What this is NOT — added things versus born things

The founder's *"removable by removing the reference image and text
associated"* is a rule about **things an edit added**. It does not extend to
things she was born wearing.

If the glasses came from the brief, no segment exists for them, and removing
them is a real render: the painter has to invent the skin, hair and shadow
behind them. **The departure machinery stays exactly as it is** —
`departedTerritory`, `departedVacancy`, and the per-pixel vacancy harvest that
took the shrink case from 0.0% to 18.4%. Segments make *added* things free to
remove and change nothing about *born* things. Anyone reading the founder's
sentence as "removal is solved" would delete the hardest machinery in the
product.

## 3. The segment store

One row and one pair of objects per kept edit:

| field | why |
|---|---|
| `userId`, `candidateId`, `variantId` | ownership scoped in the statement that reads or writes it (invariant 1); the variant is the provenance |
| `facet` | what it answers — this is the key the compositor, the undo and the face chart all read |
| `version` | §7: segment-level history falls out of this column |
| `maskKey`, `contentKey` | R2 objects: one single-channel mask, one cropped RGB |
| `bbox` | so a paste does not decode a full frame to find its region |
| `verifiedAt`, `verdict` | §6: these pixels arrive pre-verified, and the record says by what |

Keys are `crypto.randomUUID()` on the public bucket, like every other writer;
the repository guard against `Math.random()` in storage writers already covers
it.

**Deletion rights cover segments, and the sweep already has the right shape.**
`candidateRetention.ts:100-121` purges a candidate and every one of its
variants inside **one transaction**, with every object on one cleanup manifest.
Segments join that transaction and that manifest. The code's own comment
refuses two schedules for one lifetime, and it should keep refusing it here —
a second retention path is how paid pictures of people outlive the sheet they
belonged to.

One deliberate asymmetry: **an undo does not delete bytes.** Dropping a segment
takes it out of the composite; the object survives so §7's redo can exist. Her
account-level deletion still removes everything, because that runs on the
candidate.

## 4. Overlap — surrender rules

The default matches the user's ontology: **the newer edit wins the pixels it
claims; the older segment keeps everything it still owns.** The territory
tables already speak this language (`zoneScope.ts`, and the
`departedTerritory` / `departedVacancy` masks the harvest computes today).

Three cases are named rather than defaulted:

- **Same facet.** "Make the freckles heavier" *retires* its predecessor's
  segment rather than contesting it — one facet, one segment, newest version
  wins. This is also what keeps D-146 dead: the painter is never handed the old
  copper as ground truth for new copper.
- **A removal that vacates ground a segment owns.** Take off the earrings where
  an earlier edit painted the earlobe: the segment surrenders its intersection
  with the departed territory, and the vacancy harvest fills it.
- **A partial claim.** An edit that takes part of a segment leaves a segment
  with a hole. Store the survivor as a new version rather than mutating the old
  one — a segment is evidence of a delivered render and must stay readable.

## 5. Seams

**Non-overlap costs nothing, and the reason is provable rather than hopeful.**
Every render is master-anchored, so every segment was originally cut and
composited *against the master's own pixels*. Re-applying it later places it
against the same master pixels, in the same position, at the same boundary. It
is not a new seam — **it is the seam that already passed `compositeSeam` when
it was delivered.** So the instrument's calibration
(`compositeIntegrity.ts:41-50`, sized on run-6's own production frames)
transfers unchanged. Under option B it would not have.

**Overlap is where the real work is.** A contested boundary is fresh paint
against a stored segment — two renders of the same face made at different
times, meeting along a line. Neither the compositor's two-source machinery nor
the seam bar has ever seen that class. It needs a blend, a specimen set, and a
re-run of `scripts/calibration/composite-seam.mts` before any enforcing posture
applies to it. Working law 2: the instrument gets its controls before its
verdicts count.

## 6. Verification — and one hard honesty condition

A pasted segment needs no re-verification: **it is the verified pixels**, and
`verifiedAt`/`verdict` carry the reading that earned them. So a render's
verification shrinks to the facets it actually wrote plus any it repainted in
overlap — fewer facts per read, and no stochastic reader re-deciding what
arithmetic has already settled. This is also what finally makes
`inheritedVerdict` sound; it is built, green, and deliberately unwired because
today's base anchoring makes its premise false (`refineService.ts:2106-2136`).

**The condition, adopted from fable-078 as non-negotiable and repeated here so
it cannot be lost in a slice plan:**

> A carried segment is recorded as **CARRIED**, never as a fresh delivery, and
> the reliability report splits its columns **in the same slice that ships
> segments.**

It is not a false pass — she genuinely has the freckles she paid for. It is
worse in a subtler way: the per-class rate would rise because the denominator
quietly lost its hardest cases, at the exact moment the founder is asked to
certify a number. That is the flattering-bias family, and this campaign has
been burned by every other member of it.

## 7. Per-segment version history — free, and it answers the founder's sentence

The `version` column is the whole feature. Because a segment is named by facet
and versioned, the product gets:

- **segment-level undo** — "take the earrings off" drops that segment and
  recomposites: instant, free, nothing downstream re-renders, because nothing
  downstream was ever painted on top of it;
- **segment-level redo and comparison** — the previous version of one facet,
  without touching the others;
- **a mitigation for the one honest cost of pixel permanence.** Kept pixels
  keep their mistakes: a slightly wrong region delivered today is no longer
  laundered by tomorrow's re-anchor. Version history is the answer — the bad
  version is one drop away rather than one re-render away.

## 8. Engines and references

Multi-reference is **already plumbed end to end**: `falImages.ts:162` takes
`references` as an array and `:184` maps every one into `image_urls`; only the
caller (`refineService.ts:1929`) passes a single element. Nano Banana Pro takes
several natively; GPT Image 2's behaviour with several is the thing to measure.

Routing, stated as a rule rather than left to a default: **the masked path
keeps its engine; overlap repaints send the master plus the surrendering
segments' crops.** If GPT Image 2 handles multiple references poorly, option C
degrades to "overlap repaints use prose" — which is *today's behaviour on
today's hardest case*, so the downside is bounded at the status quo.

Live and interacting: the founder's engine question (fable-079) — the 6/8
written-arm figure is GPT Image 2's, and NBP has never been measured on marks.
That arm is running as this is written. If NBP is near-perfect on the class,
the residual's answer is **per-class routing** (the `eye.shape` precedent)
rather than a retry, and it would land inside slice 1 rather than beside it.

## 9. Build estimate, and the dark path

Engineering days at this session's throughput. Every slice is dark behind the
existing `CASTING_V2_SCOPE` machinery at `users:1` from its first commit — no
slice changes live behaviour by landing.

**Slice 1 — non-overlap permanence. 8–10 days.**

| | days |
|---|---|
| schema + migration + retention join (one transaction, one manifest) | 1 |
| harvest persists mask + crop on landing; storage manifest wiring | 1 |
| compositor: three-source assembly, disjointness, applied bookkeeping | 2 |
| prune = drop segment + recomposite, no render | 1 |
| **reliability report's two columns** (§6, hard condition) | 1 |
| flag/scope wiring, tests, sabotage guards | 1 |
| **the two benches** (§10) and their reading | 1.5 |

**Slice 2 — overlap. 6–8 days.**

| | days |
|---|---|
| surrender rules incl. removal and same-facet cases | 1.5 |
| blend at the contested boundary | 1.5 |
| segment crops as painter references + engine routing measurement | 1 |
| specimen set + seam re-calibration | 2 |
| tests + guards | 1 |

**Per-segment history: +0.5–1 day server-side** (the column exists from slice
1; this is selection and the undo path). The chart UI is separate work.

**Total server-side ~15–18 days, and slice 1 is independently useful** — it
kills the flicker for the non-overlapping majority, which is where the campaign
is stuck.

**Where this estimate is most likely to be wrong:** the benches, not the
build. Every schedule this campaign has missed has been missed on instruments
— the reader's controls, the amplitude threshold, the mislabelled sitting
found this morning. The build items above are ordinary; §10 is the risk.

## 10. The gate — non-negotiable

Two benches, before the flag opens past `users:1`. They are the two v2 shipped
without, and fable-077 is right that the founder should not meet that ghost
twice:

1. **Same-facet stacking.** Re-ask one facet twice and measure whether the
   second render intensifies the first. §4's same-facet retirement is supposed
   to make this structurally impossible; a bench is what turns "supposed to"
   into a reading.
2. **A six-edit sharpness gauntlet.** Not facet survival — *sharpness*. v2's
   defect was invisible to facet instruments by construction, and the only
   reason anyone found it was that the founder looked at his own face.

## 11. What transfers untouched

Mask geometry and segmentation; the money path entire (per-slice billing,
refunds, the recovery sweep, the deploy-collision contract); the refusal path;
D-93's landing smoke alarm; the departure and vacancy machinery (§2.2); the
courts, benches and reliability report as instruments; retention's shape; and
**Sign**, which copies its own anchor and so depends on nothing in the variant
table (`candidateRetention.ts:104-106`).

## 12. The convergence — one mechanism, three features

The segment store is a **named, per-facet, versioned store of accepted
regions**, which is precisely what the post-Sign roadmap's face chart needs:
tappable segments in the stylist's ontology, each with its own history and its
own "remove this". M12's surface and this store are the same thing seen from
two ends. Building segments buys the chart's foundation; building the chart
first would have built the segment store under a different name.

## 13. The over-guarding accounting the founder asked for

One line each, because he asked whether the product is being strangled by its
own safety:

- **Guards have never blocked a delivery.** Every one of them is read-only —
  they refuse, refund, or record. Not one has ever been measured suppressing a
  render the painter got right.
- **Prompt prose has been both the cure and the poison, measured each way.**
  The qualifier floor raised delivery; the realization caption walled it at
  zero for sixteen paints. Prose is the component with the worst measured
  record in the product.
- **Segments strip most carried prose from the paid path** — a carried facet
  stops being described at all, because it is simply still there. That is the
  honest answer to the over-guarding question: the thing to remove is not the
  guards, it is the words.
