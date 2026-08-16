# M12 close-out — the plan's spec beside the road that was actually built

*First pass, shift 81 (2026-08-17). Opened by fable-784 §5, shaped by fable-707
§1 (the founder's own sequencing: finish Refine → close M12 completely → only
then think about Takes) and fable-711 (his ruling that M12 does not close
without reference-guided edits).*

*SECOND PASS, shift 82 (2026-08-17), ordered by fable-785 §3. **It overturned
the first pass's central claim.** The first pass reasoned about M12 from the
refine road alone and concluded "there is one view, so rows 5 and 8 have no
subject". The Sign road was not read. A Cast has **six** views — the Master plus
the five of package v3.1 — and `refineService.ts:696` refuses a post-Sign edit
with a comment naming this very milestone: "Post-Sign revision is M12, not
this." Seven rows moved — 2, 3, 4, 5, 8, 11, 12 — and every one of the fifteen
has now been read in depth, so the reconciliation is whole. The corrections are
marked **[2nd]** and the reasoning is in "What the second pass overturned"
below.*

*THIRD PASS, shift 83 (2026-08-17). **Not a re-reading — a repair.** Two of this
document's rows were falsified by the work of the shift that wrote them, in the
minutes after it was committed: row 3 was BUILT and deployed (`80265603`), and
row 2's stated cause — a 760 px width cap — was MEASURED and found never to
bind. Both cells said the true thing at the moment they were written and the
wrong thing an hour later, and nothing in the document could say so, because a
document has no instrument. Corrections are marked **[3rd]**; the two rows'
original text is kept in place under them, since what changed is worth reading.*

## What this document is, and what it is not

It lays each clause of the plan's M12 spec beside what the refine road actually
does today, and marks it **DELIVERED**, **REMAINING** or **SUPERSEDED**. It is
the same table shape V4 closed on.

**It is a reading, not a decision.** Every SUPERSEDED row is a claim that the
built road answers the plan's intent by another route, and each of those is a
founder question rather than an executor's ruling — they are marked so.

**Its limits, stated here rather than discovered later:**

- The evidence is code and production rows, not a running-app walk. A row marked
  DELIVERED means the mechanism exists and is reachable; it does not mean it has
  been dogfooded against this clause.
- Rows marked **(shallow)** were settled by one targeted read and deserve a
  deeper one before the remainder list goes to the founder.
- The plan text is quoted from `CASTING_V2_ARCHITECTURE_PLAN.md` lines 143, 269
  and 440. Nothing here is quoted from memory.

## The spec, clause by clause

The plan's M12 (line 440): *"focused editor (pan/zoom master, NL instruction,
current-vs-proposed, one price, Apply/Cancel), intent classifier
(take/revision/fork routing), affected-view derivation (fail-closed), NBP
regeneration + presence/absence/likeness probes, atomic commit/rollback."*
And the ceremony (line 143): *"draft request → classified (take|revision|fork) →
priced → approved → frozen snapshot → affected views derived → generate+validate
all affected → atomic commit | full rollback."*

| # | Clause | Verdict | Evidence |
|---|---|---|---|
| 1 | Focused editor — NL instruction, one price, Apply/Cancel | **DELIVERED** | The refine panel is that editor. `RefinePanel.tsx` carries the price stated once and never on the button (D-15/D-109), and the ask box is the NL instruction. |
| 2 | …pan/zoom master | **[2nd] REMAINING — there is no magnification anywhere in the product** | Read properly this pass. `CandidateViewer` has no wheel handler, no drag, no transform and no zoom control; its whole interaction grammar is *click opens · ←→ walks · Esc closes · download*. Delivered frames are larger than the viewer shows: a candidate refine renders at **1K** (`refineService.ts:3840`) and a signed package view at **2K** (`packageOrchestrator.ts:377`), and the only way to see one whole is the download button. **[3rd] The CAUSE this cell first named was wrong, and it was measured before anything was built on it.** The 760 CSS px cap (`castingV2.css:722/740/808`, `object-fit: contain`) **never binds**: on a 2:3 frame the viewer runs out of *height* first. Driven in the running app (`scripts/measure-downsample-disposable.mts` → `output/downsample/downsample.json`): in a **2560×1440** window a 1024×1536 frame draws at **604×906** — 0.590 of natural, and 156 px short of the cap it was supposed to be hitting; in a 1440×1000 window it draws at **310×466**, 0.303 (opus-580, that run's file overwritten by this one). Lifting the cap would have shipped a diff and delivered zero pixels; fable-789 §1 withdrew the order to lift it. The complaint is real and the row stands — what has to change is the **height** the picture is allowed, not the width ceiling. **The 2K half is UNREAD**: the fixture bot owns no signed Cast, so every figure here is a 1K candidate frame, and M13 measures the half he paid most for. The one founder ruling nearby (`castingV2.css:2168`, 2026-08-02) rejected the `zoom-in` *cursor* on tiles because it "promises a zoom" the viewer does not keep — that is a ruling about an affordance not matching the surface, **not** a ruling that magnification is unwanted, and the first pass came close to reading it as one. |
| 3 | …current-vs-proposed | **[3rd] SHIPPED — built as an inheritance, deployed in `80265603`** | **Built and live.** V2's viewer now holds the previous frame under press-and-hold, with the same 150 ms delay as the legacy road (read off it *by the test*, so neither side can drift alone), the same `Original`/`Previous` labels and the same badge. The previous frame is mounted and decoded as soon as one exists and only its *visibility* changes — a `src` swapped at press time is a request, not a picture — and the hold starts on the photograph only, never on a region box. Thirteen driven checks; the one that matters is pixels rather than attributes: **held differs from at rest, released is byte-identical to at rest, the box never moves** (`output/hold-to-compare/`). The legacy road's `grab` cursor is deliberately **not** inherited, under the founder's own zoom-cursor ruling. *The reading that produced it, kept:* fable-785 asked for this exact check and it paid. V1 has **hold-to-compare**: `ImageViewerPanel.tsx:172–181` derives the previous frame and labels it `Original`/`Previous`, and `StudioCanvas.tsx:217–269` swaps the plate on press-and-hold with a badge. V2's viewer has no equivalent — the refine road still shows the delivered frame *instead of* the previous one. So this is not an undesigned capability; it is one the product already proved and V2 did not inherit. Small: the plate is already two-layer (`dpc-viewer__sizer` + the frame, both `inset: 0; object-fit: contain`) and the rail already carries every version's URL on `data-frame`. |
| 4 | Intent classifier — take / revision / fork routing | **[2nd] REMAINING in letter; two of its three destinations are delivered without it, and the third is blocked by sequence** | Read in depth this pass. The shipped kinds are `castingV2.roll`, `castingV2.refine`, `castingV2.sign` — no `.take`, no `.revision`. But a classifier is only worth what its destinations are worth, and they differ: **take** — the plan's Take (presentation-only picture off a signed Cast, own table, immutable — plan lines 147/270/318) is **not built at all**: no `takeService.ts`, no `casting_takes` table. M8 was re-scoped from Takes to Refine, and fable-707 §1 sequences Takes *after* M12. **revision** — refused at `already_signed`; this is the §3 founder question. **fork** — **delivered, twice, and neither needed a classifier**: fork-from-Cast at session create (`server/db/castingV2.ts:73/122–143`, `parentCastId` resolved through `models.userId` in the same statement — invariant 1 satisfied), and version branching pre-Sign, which the founder described in his own word: *"you just click between accumulated edits and can fork from any you choose."* |
| 5 | Affected-view derivation, fail-closed | **[2nd] REMAINING — the first pass's "one view" premise is false** | A Cast has **six** views: the Master plus package v3.1's five (`CAST_PACKAGE_VIEWS` = closeUp, threeQuarter, frontFull, sideClose, backFull — `castViewPackage.ts:73`), minted at Sign, priced per view, live in production with signed Casts owning them. What is true is narrower and is a *sequencing* fact, not an absence: **editing and multi-view are mutually exclusive in time.** You refine a candidate (one frame), you Sign (five more are rendered), and then `refineService.ts:696` refuses any further edit — `already_signed`, nothing charged — under a comment that names this milestone: *"Post-Sign revision is M12, not this."* The clause is not superseded; it is the exact unbuilt thing, and the code says so. The founder question it raises is real but different from the one the first pass framed — see §5/8 below. |
| 6 | NBP regeneration | **DELIVERED, by another engine** | The repaint road regenerates the whole frame from the pristine master plus cropped references (D-241, `CASTING_REPAINT_SCOPE=users:1` in production). The plan named Nano Banana Pro; the road dispatches GPT Image 2 for the edit and NBP for identity work. Same intent, different transport — flag it for him as a wording change, not a gap. |
| 7 | Presence / absence / likeness probes | **DELIVERED** | The render verifier reads the delivered frame per facet (`verification.checks`, `read`/`verified`), the content gate reads the region, and a failed reading refunds. This is the probe taxonomy under a different name. |
| 8 | Atomic commit / full rollback of a package | **[2nd] SUPERSEDED — and by a built, tested, founder-ratified law rather than by absence** | The first pass got the verdict right for the wrong reason ("there is no package"). There *is* a package, it *does* partially fail, and the road answers with the opposite of all-or-nothing: **keep what landed, refund what did not, activate her anyway.** `packageOrchestrator.test.ts` asserts it directly — *"still activates the Cast when every view fails — the master is usable"*, *"keeps the base when even one view lands"*, *"zero of N — the base goes back too"*, *"fails and refunds exactly one slice"* — and `signRecovery.test.ts` carries ~25 more on the crash path. This is per-slice billing, the same law CLAUDE.md records for a roll ("eight independently refundable units", founder ruling 2026-08-01), applied to the package. A full rollback would now *take back views she can see*. **This row is answered; it is no longer a founder question.** |
| 9 | Frozen snapshot before generation | **DELIVERED in substance** | Every render anchors on `candidate.imageKey`, the pristine master, and the library rows are immutable versions along an ancestry. The freeze is structural rather than ceremonial. |
| 10 | Priced once, approved before it runs | **DELIVERED** | One price, stated once, confirmed before dispatch. |
| 11 | Migration `0020_casting_v2_revision_ops` | **[2nd] SUPERSEDED — there is nothing for it to do** | Not present, and the plan itself says why (line 323): `kind` is varchar(48) and a new operation kind needs no migration. The plan hedged it as "revision operation kind metadata **if needed**". No metadata need has appeared. Whatever row 5 is answered with, this row does not come back. |
| 12 | Tests: the R7-7E-style suite re-pointed (partial failure keeps the previous package; refund truth) | **[2nd] DELIVERED** | The first pass said the partial-failure half "has no subject". It has one, and it is one of the better-tested surfaces in the program: `packageOrchestrator.test.ts` (28 assertions — every-view-lands, one-regeneration-then-refunded, per-axis verdict persisted for a dispute, no orphaned object behind a failed view, judge-unavailable *delivers* rather than charges nothing, the fence, zero-of-N) plus `signRecovery.test.ts` (~25 on the crash path — paid once and counted once, never refunds more than was charged, escalates rather than sealing a lie). The clause's literal wording is what has no subject: there is no *previous* package to survive, because a package is minted once at Sign and never re-rendered. What it was protecting — money and coherence under partial failure — is covered. One cosmetic: `packageOrchestrator.test.ts:142` is still titled *"commits all six views"* while asserting five (the walk retired in v2); the assertion is right, the title is stale. |
| 13 | Gate: the founder performs a real revision and a refused one | **REMAINING — a founder gate, unchanged** | Both halves are reachable today (a paid refine that lands; a refusal that refunds). It has not been performed *as this gate*. |
| 14 | Rollback: revision flag off, the room simply lacks the Edit door | **DELIVERED** | `CASTING_REPAINT_SCOPE` off returns the road to paste-and-blend; `CASTING_V2_SCOPE` off removes the surface. |
| 15 | **Reference-guided edits** — "add features from reference images like tattoos or hair styles or makeup or whatever we want" | **REMAINING — founder-ruled, and M12 does not close without it** (fable-711) | Not built. The machinery it lands on exists: the library carries features as crops with digests and frozen bytes, the repaint road paints from references, and the flash-sheet design specifies upload → converted. What is missing is the DISTILLATION step — an uploaded image becoming the product's own reference form — and the upload path itself. |

## What the second pass overturned, and how it happened

The first pass wrote *"the refine road has one view, so there is nothing to
derive"* and hung two SUPERSEDED verdicts on it. It is false. A Cast has six
views, they are priced and sold, signed Casts in production own them, and the
refine service refuses to touch them with a comment pointing at this milestone
by name.

**How the mistake was made is worth more than the mistake.** Nothing was
misread. The first pass read the refine road carefully and generalised from it
to *the product*, without opening the Sign road where the package lives — and
then wrote the generalisation down as a premise that two later rows leaned on.
The sentence was true of the module in front of it and false of the thing it
claimed to be about.

That is the same shape as the stale docblock swept in opus-576 §3 — *"undefined
on every ask, which is all of them until the panel sends one"* — a claim that
was true where it was written, false about the system, and load-bearing for a
review that came after. It survived one pass here for exactly the same reason:
**an argument that a clause has no subject is a review already performed, and
the next reader inherits it instead of looking.** The countermeasure is the same
one that caught it: go to the module that would have to disagree, and read it.

Only one verdict actually changed direction (row 5, SUPERSEDED → REMAINING).
Rows 8 and 12 kept their verdicts and lost their reasons — which is the more
common and more dangerous case, because nothing on the surface looks wrong.

## What the table says when you stand back

Three groups, and they are not the same kind of work.

1. **Mostly done, differently.** Rows 1, 6, 7, 9, 10, 14, and now 8 and 12: the
   built road delivers the plan's intent under other names, because the plan was
   written for a ceremony product and the road was built per-slice.
2. **One founder question, and it is not the one the first pass framed.** See
   below.
3. **Genuinely not built.** Rows 2, 3, 15: magnification, current-vs-proposed,
   and reference-guided edits. Row 15 is founder-ruled as blocking. Rows 2 and 3
   are new to this list, and both are *look-closely* capabilities — see below.
   **[3rd] Row 3 is no longer in this group: it was built and deployed hours
   after this paragraph was written.** Two of the three are now one.
4. **Waiting on the one question, not on engineering.** Rows 4 and 5. Row 11 is
   gone.

## The thing rows 2 and 3 have in common, which is not a coincidence

Both are ways of **looking closely**, and the product had neither when this was
written. There is no magnification, and there was no before/after; the only
close look available was the download button. **[3rd] Half of that is now
false — row 3 shipped, so the product does have a before/after.** The argument
below is why it did.

That is worth saying plainly because of how this campaign actually runs: nearly
every visual judgement in it has been made on contact sheets built by scripts
into `output/` and opened outside the app. Law 9 says the founder's eyes are
king — and the product draws a 1024×1536 frame at 310×466 in a laptop window
and shows him one frame at a time. (**[3rd]** that figure was first written here
as "caps his eyes at 760 px"; the cap is not what does it — see row 2.) The
defect closed last shift surfaced *only* because a sheet put a kept crop beside
the row that lied about it (opus-576 §8); the app could not have shown him that.

Neither row is expensive. Row 3 is nearly free — the plate is already two-layer
and the rail already carries every version's URL. Together they would move the
close look inside the product, where the customer is, instead of leaving it in a
scripts folder where only we are.

**Ruled (fable-786 §3), and they split:**

- **Row 2 goes to M13, not M12.** A 2K view drawn at a third of its pixels is
  the same defect as the founder's own *"why do the images look pixelated"*
  report — one item, not two — so it folds into M13's high-DPI sharpness work.
  Whether a zoom *gesture* ever comes is founder taste, asked when that item
  opens.
- **Row 3 joins M12's build list, as an inheritance.** Hold-to-compare is proven
  on the legacy road, the V2 viewer is already two-layer, the rail already
  carries the URLs. It answers a plan clause with the product's own precedent
  rather than a new invention.

**[3rd] Both have moved since those bullets were written, within the same
shift:**

- **Row 3 is BUILT** (`80265603`, deployed) — see the row above.
- **Row 2 goes to M13 WHOLE, and it takes a measurement with it.** fable-787 §3
  first ordered the 760 px cap lifted alongside row 3; the cap was measured
  before it was lifted, found never to bind (height binds first on every 2:3
  frame), and fable-789 §1 withdrew the order. So M13 inherits the whole row,
  the numbers, the honest gap — **the 2K half is unread, because the fixture bot
  owns no signed Cast** — and one founder question at its opening: *when you
  want to look closely at a face, should the picture get bigger inside the app —
  or is downloading it the answer?*

## What row 4 turned out to be about

The plan assumed operation-intent has to be **inferred from a sentence** — the
customer types something, a classifier decides whether it is a take, a revision
or a fork. The road expresses the same intent through **selection** instead: you
are forking because you clicked an earlier chip, or because you opened a session
from a parent Cast. Nothing has to be guessed, so nothing has to be classified.

The road does classify, fail-closed, at entry, before money moves — that is
`refineInterpreter.ts`, and its own docblock states the money argument
explicitly ("refuse while it is still free"). But it classifies along a
different axis: not *what kind of operation is this* but *which axis of her does
this touch, and can this build render it at all*. Sentence-parsing is reserved
for content; operation-intent is carried by what the customer pointed at. That
is law 8 — the user's ontology governs — and it is the better design for a
one-frame product.

**A word collision worth naming before it costs someone a verdict.** "Take"
means two different things inside this program:

- **the plan's Take** — a presentation-only picture off a signed Cast,
  immutable, its own table (lines 147/270/318). Not built.
- **the product's "fresh take"** — a regeneration of the same edit, grouped in
  the rail (`railTakes.ts`, founder ruling 2026-08-15). Built and live.

A reader who greps `take` finds `railTakes.ts` and could mark the plan's Takes
delivered. They share a noun and nothing else. This is the same hazard as two
rulings sharing one noun: ratify against the cited line, never the word.

## The founder question, reframed

The first pass asked *"does a Cast have one view or several?"* That question is
already answered by the code — **six** — so asking it would have been asking him
to rule on a fact. The real question is the one `already_signed` is holding
shut:

> **Once a Cast is Signed, can she be changed at all — and if she can, does the
> whole package follow her?**

Three answers, and they are different amounts of work:

- **She is finished when she is signed.** Nothing to build. `already_signed` is
  the product's answer, not a placeholder, and M12 closes without rows 5 or 11.
  Editing lives entirely before Sign, which is where it lives today.
- **She can be changed, and the package re-renders.** This is the plan's
  original clause and the largest remaining build: affected-view derivation,
  fail-closed, plus the re-pricing of five views.
- **She can be changed, and only the Master moves.** Cheapest to build and the
  worst of the three — her close-up would show red hair while her profile
  showed blonde, and the product would be shipping an incoherent person.

**Recommendation: the first.** Sign already reads as a commitment in the
product's own language — it is the ceremony, it is priced as one, and the
customer who wants a different look can refine the candidate before signing or
fork a new one. Nothing observed in the campaign suggests he has wanted to edit
a signed Cast; the wants that keep recurring are all pre-Sign.

**But the answer is not free, and fable-786 §2 caught why: the room already
promises something.** `CastingRoom.tsx:481` ships this sentence today —

> *"Refining a signed Cast arrives with refinement. Until then, a new direction
> means a new sheet."*

So "she is finished when signed" costs a re-word of copy the founder has already
seen and shipped. **Reading the surrounding markup makes the cost much smaller
than it first looks:** that sentence sits inside the **Takes** section, directly
under a disabled button labelled **"New takes"** (lines 469–487). The surface it
lives on is a Takes surface. The only ambiguous thing about it is the word
"Refining".

That is the split the question has to make, and it is fable-786's: **identity
edits** (who she is — her eyes, her hair, her fangs) are a different thing from
**Takes** (new photographs of the same her, M8's whole subject). The room's own
markup already draws that line; only the sentence blurs it. If the founder's
answer is "identity locks at Sign, takes come in M8", nothing is broken and one
word is re-worded.

## Row 15 sized — reference-guided edits

The only row that is a build rather than a reading. Sized against fable-711 §2's
landing points, which hold up.

**The finding that sets the shape:** a library row is not a bag of references —
it is *a memory of her own face*. `StoredReference` (`referenceLibrary.ts:113`)
carries `candidateId`, a catalogue `slot`/`tier`/`noun`, and a `geometry` whose
bbox is a rectangle **on her frame**. An uploaded picture has none of those: no
place on her face, no slot until something classifies it, no provenance in her
lineage. So a distilled upload **cannot be written straight in as a carry row** —
and it should not be, which is the same conclusion fable-711 §2 reached from the
other direction ("the upload is a SEED, never a straight carrier").

That makes the build much smaller than it looks, because it needs no new carry
machinery at all:

```
upload  →  distil (the new part)  →  ONE render through the existing repaint
           road, seeded by the reference  →  the existing harvest mints the
           library crop from HER frame  →  every render after it carries the
           feature for free, exactly as a typed edit does
```

Everything after the second arrow is built and in production. What is genuinely
new is two things:

1. **The upload path.** Closest existing analogue is `wardrobe.upload`
   (`server/routes/wardrobe.ts:110`): base64 in, `storagePut`, priced, kicks a
   pipeline. Same shape, and it is `protectedProcedure` with the ownership
   scoping already right.
2. **The distillation.** Per-feature, per fable-711 §3b — a tattoo becomes a
   flash sheet (his ruled design, fable-680), hair and makeup do not yet have a
   ruled form. This is where the design work is, and it is the only part that
   needs him.

**The fence is the risk, not the plumbing** (fable-711 §3a). A hairstyle
reference almost always contains a face, and the product must take the style and
never the person. That fence has to be designed before this ships, and it is not
a detail of the build — it is a condition on it.

## Where the reconciliation stands

**Every one of the fifteen rows has now been read in depth. The reading is
whole** — which was fable-785 §3's condition for M12 leaving reading and
becoming building.

```
DELIVERED    1 · 6 · 7 · 9 · 10 · 12 · 14        (12 moved here this pass)
SUPERSEDED   8 · 11                              (both with their reasons
                                                  corrected or replaced)
SHIPPED      3            — [3rd] BUILT AND DEPLOYED (80265603), not remaining
REMAINING    15           — buildable now, in M12, once two design answers land
             2            — MOVED TO M13 WHOLE, with its measurement
             4 · 5        — waiting on ONE founder question, not on engineering
```

Nothing is left to reconcile. What remains is **one build, one question, and two
design answers**:

- **[3rd] Row 3 is done** — built, driven, looked at, and deployed within the
  shift that wrote the row above. What is left buildable in M12 is row 15 alone,
  and it is gated on the two design answers below rather than on engineering.
  **Row 2 left M12** — folded into M13's high-DPI sharpness item by fable-786
  §3, because a delivered frame drawn at a fraction of its pixels is the
  founder's own pixelation report wearing a different name.
- **The one question:** can a signed Cast be changed? It decides rows 4 and 5
  and nothing else. Shaped by fable-786 §2 around the identity-vs-Takes split
  and with him now.
- **Row 15's two design answers**, both his: the real-person fence (fable-711
  §3a) and the per-feature ingestion form for hair and makeup (§3b). The tattoo
  form is already ruled. The plumbing is sized and mostly built; these gate it.
