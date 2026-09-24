# The ink studio retires — the census, and the slices (#1158)

**His ruling, 2026-09-24, Crew reply #208 on card `switch-10-ink-studio`, verbatim and entire:**

> It retires with N2

This document is the census that ruling needs before a line is deleted, and the slice order it
produces. It is #203's shape — entrance first, then read paths, then columns and shared constants
last — and it exists for the same reason #203's did: the word "ink" names **four different roads** in
this repository, he has ruled differently on each of them, and a sweep that reads the word rather
than the road would retire a capability he has just asked to be re-asked about.

Every figure below was read at the artifact on 2026-09-24, not carried from a card.

---

## 1 · THE FOUR ROADS, AND ONLY ONE OF THEM RETIRES

| road | what it is, in his terms | flag | his word |
|---|---|---|---|
| **the studio** | she uploads a design she owns, we store it and draw it onto her Cast | `CASTING_INK_STUDIO_SCOPE` + 3 children | **RETIRES** (#208) |
| **born ink** | her brief says *"he has a sleeve"* and the sheet records it | `CASTING_BORN_INK_SCOPE` | **HELD**, re-ask owed — #1159 (#209) |
| **ink from words** | a tattoo invented from her sentence and painted | `CASTING_INK_WORDS_SCOPE` | **`all`** — live for everyone, untouched |
| **ink from a picture** | her attached photograph is the document for a tattoo | `CASTING_INK_REFERENCE_SCOPE` | **HELD, moved to N3** (#213) |

⚠ **The last row is the one that decides this card's whole scope**, and it is the finding of this
census: **`CASTING_INK_REFERENCE_SCOPE`'s parent is `CASTING_REFERENCE_ATTACH_SCOPE`, not the
studio.** Read at `castingV2Scope.ts`'s `captureCastingInkReferenceEnabled`, which ANDs the attach
door and never the studio one. The two roads are structurally independent, so retiring the studio
does not disturb his hold — and, equally, **cannot be allowed to take the reference road's machinery
with it.**

---

## 2 · TWO DOORS MINT A DESIGN ROW. ONLY ONE RETIRES.

This is the sentence to read twice before deleting anything, and the code says it in its own words at
`castingInkDeliveryCropArmed`:

> *"Two doors mint a design row and neither is the other's parent: the studio's upload
> (`CASTING_INK_STUDIO_SCOPE`) and the take from an attached picture (`CASTING_INK_REFERENCE_SCOPE`,
> whose parent is the attach door)."*

Driven rather than quoted — every non-test caller of `recordInkDesign`, the only writer of
`casting_ink_designs`:

```
server/castingV2/inkUploadService.ts   record: recordInkDesign     <- the studio road — RETIRES
server/castingV2/inkReferenceMint.ts   record: recordInkDesign     <- the reference road — HELD
```

**So the following are NOT this card's to remove, at any slice**, and each would look removable to a
sweep that read the word:

- `casting_ink_designs`, its db module `server/db/castingV2InkDesigns.ts`, and `recordInkDesign`
- `casting_ink_delivery_crops` and their purge path — the retention comment is explicit that a crop
  cut while a flag was on must be collected after it goes off
- the `/api/ink-design/:designId` route (`server/routes/inkDesignDelivery.ts`) — an enumerated
  authenticated Express surface in `CLAUDE.md`, serving rows the reference road still mints
- **`ink.remove`** — deliberately not behind the studio flag, and its own docblock says why: gating it
  would mean a customer could no longer delete a picture of her own that we are still holding

---

## 3 · THE CHAIN, AND WHY THE ORDER OF ANY UNSET IS LOAD-BEARING

All four stand at `users:1` — his account, the only account that has ever cast.

```
CASTING_INK_STUDIO_SCOPE          users:1
  |-- CASTING_INK_CUT_SCOPE       users:1
  |     \-- CASTING_INK_REGION_CROP_SCOPE   users:1
  \-- CASTING_INK_TRANSFORM_SCOPE users:1
```

A child scope **refuses to boot** when it reaches past its parent
(`validateCastingInkCutEnvironment` and siblings), so **the flags leave the service only when the
machinery they gate is gone, and they leave children-first.** An unset parent over live children is a
crash-looping deploy. Rehearse `validateEnv()` against the target values on a local machine before
touching production — that is the road this sitting's five widens took.

---

## 4 · THE POPULATION — read at the production rows, 2026-09-24

⚠ **AND THREE DOCBLOCKS IN `candidateRetention.ts` STATED THE OPPOSITE OF THE ROWS UNTIL SLICE 4b.**
They read *"production has taken neither 0034 nor 0037"*. Read at the production rows on 2026-09-24:
`casting_ink_designs`, `casting_ink_plates` and `casting_ink_delivery_crops` are **all PRESENT and all
hold zero rows** — the additive migrations landed, most likely through the deploy rite's own auto-apply
(#322). The tolerances those docblocks justify therefore cannot fire on production at all today. Corrected
in the same commit, because a comment that argues from a database state that has moved is how the next
reader inherits a wrong premise.

```
casting_ink_designs           0
casting_ink_plates            0
casting_ink_delivery_crops    0
casting_ink_form_demand       0
```

**Zero, all time, in every table the studio writes.** So unlike #203 — which had thirteen pathed rows
whose history is evidence — there is no data here whose loss would cost anything. That is a reason
the deletion is cheap; it is not a reason to skip the read at each slice, because the reference road
may begin writing `casting_ink_designs` the day he unholds it.

**And the plate mint has been shut since 2026-08-19 by his earlier ruling** — `MANNEQUIN_ROAD_DEFERRED`
in `shared/inkMannequinDeferral.ts`, a named constant rather than a flag precisely so no environment
variable could switch it back on. The studio has therefore never drawn anything.

---

## 5 · EVERY NON-TEST CONSUMER OF THE FOUR PREDICATES

This is the whole list, and it is short — which is why the ~200 files matching `ink` are misleading
about the size of this card.

| predicate | non-test call sites |
|---|---|
| `captureCastingInkStudioEnabled` | `server/routes/castingV2.ts` — the `ink.upload` procedure |
| `castingInkStudioArmed` | `candidateRetention.ts` x2 (missing-table tolerance); `castingInkDeliveryCropArmed` |
| `captureCastingInkCutEnabled` | `inkUploadService.ts` |
| `captureCastingInkRegionCropEnabled` | `inkUploadService.ts` x2 |
| `captureCastingInkTransformEnabled` | `refineService.ts` — the transform ask |

**And there is no client caller of the `ink` namespace at all.** A grep over `client/src` for
`ink.upload`, `inkUpload` and `castingV2.ink` returns one unrelated `link.remove()`. The studio's
entrance is a tRPC procedure with no user interface in front of it — reachable only by a direct API
call, on his account.

---

## 6 · THE SLICES

**Slice 1 — the entrance (this PR).** Remove `ink.upload` and the suite that drives it. Nothing new
can be created by the studio road from that commit. Every read path, the table, the delivery route
and `ink.remove` are untouched. `server/inkUploadEntranceRetired.test.ts` pins the absence **with a
positive control** — it asserts `ink.remove` is still reachable, because a guard that only asserts an
absence passes just as well when the whole router failed to load.

**Slice 2 — the studio's own service chain** — ✅ **DONE, and ⚠ THE SENTENCE THIS PARAGRAPH USED
TO CARRY WAS WRONG IN BOTH DIRECTIONS.** It is kept below, struck, because the way it was wrong is
the most useful thing in this document.

> ~~now unreachable: `inkUploadService.ts`, `inkUploadDoor.ts`, the cut and region-crop machinery
> (`inkReferenceCutter`, `inkReferenceCrop`, `inkDeliveryCrop`) **where it is not shared with the
> reference road** — checked per module at the bytes, not assumed from the file name.~~

Its own escape clause — *checked per module at the bytes* — is what saved it, and the check
disagreed with the list:

**THREE MODULES IT NAMED ARE THE HELD ROAD'S AND SURVIVE.** Each is reached by something live, so
deleting any of them would have broken the paid refine road or pre-emptied a road he HELD:

| module | what actually reaches it |
|---|---|
| `inkUploadDoor.ts` | **ten** importers outside the studio — `referenceAttachService`, `referenceAttachDoor`, `inkReferenceMint`, `inkReferenceCutter`, `inkReferenceCrop`, `inkReferenceUpscale`, `inkRideFloor`, `uploadRefusalCopy`, `makeupFromReference`, and the deleted plate door |
| `inkReferenceCutter.ts` | `inkReferenceMint.ts`, plus `refineService.ts` and `refineReask.ts` for its `InkCutFocus` type — **live for every account** |
| `inkReferenceCrop.ts` | the cutter, the delivered-crop arithmetic, and the reference mint |

`inkDeliveryCrop.ts` is a fourth of the same kind: `refineService.ts:9686` calls
`mintInkDeliveryCrop` on the live carry road, so the delivered-crop road is not the studio's at all.

**AND THE ROAD IT DID NOT NAME IS WHAT WAS ACTUALLY UNREACHABLE — the PLATE road**, the studio's
second half, which draws a design onto the blank form. Deleted whole, 3,448 lines with its suites:

```
server/castingV2/inkPlateMint.ts      383   only non-test caller: defaultMintPlate
server/castingV2/inkPlateEngine.ts    100   only caller: defaultMintPlate
server/castingV2/inkPlateEngines.ts   215   only callers: the two above
server/castingV2/inkPlateDoor.ts      336   only non-test importer: inkPlateMint
server/castingV2/inkTemplates.ts      437   only readers: the plate door and the plate mint
```

`inkTemplates.ts` is the one worth noticing: nothing in its name says *plate*, and it came out of the
closure because its only two readers did. The mirror of `inkUploadDoor.ts`, whose name says *upload*
and which stays.

**What changed in `inkUploadService.ts` rather than being deleted.** `uploadInkDesign` (the order),
`defaultMintPlate`, `readBytes`, `REAL` and the four studio-only types are gone; 580 lines → 181.
**`defaultManifest` and `defaultCutDesign` stay**, because `inkReferenceMint.ts` wires both as its
REAL dependencies and `inkDeliveryMint.ts` wires the manifest on the live carry road —
`inkReferenceMint.test.ts` asserts that as an IDENTITY, which is the arm that made the reading
certain rather than probable. The filename is kept deliberately: a rename is a repository-wide sweep
over the text guards that name this path, and folding one into a retirement grows the cleanup a
second job.

**⚠ A DEAD IMPORT SLICE 1 LEFT BEHIND, and it is the class `CLAUDE.md` has a founder ruling about.**
`server/routes/castingV2.ts` still carried `import { uploadInkDesign } from "../castingV2/inkUploadService"`
with no caller anywhere in the file. *An import is not a call site* — but the Atlas builds its edges
from imports, so a dead one makes a retired module read as **reached**, and reached is exactly the
reading that stops a later slice removing it. Removed, and pinned by an arm.

**#10 closes with this slice**, and the reason is narrower than "the flag goes away". Its subject is
*an uploaded tattoo design cut out of its picture before it is stored*, and the preview it asks for
is a customer-facing preview on the upload surface. There is no upload surface. ⚠ **The CUT itself
does not close with it** — `defaultCutDesign` survives for the held road, so the cut road is alive
and only the studio's entrance to it is gone.

**⚠ AND ONE FLAG CHANGED CHARACTER RATHER THAN DYING, WHICH SLICE 4 MUST NOT MISREAD.**
`CASTING_INK_CUT_SCOPE` had exactly one read in the whole product — the retired upload's `cutEnabled`
dependency — so from slice 2 nothing consults it. **It is not therefore removable**: it is the boot
PARENT of `CASTING_INK_REGION_CROP_SCOPE`, which `defaultCutDesign` still reads, and a child scope
refuses to boot when it reaches past its parent. Unsetting the parent over a live child is a
crash-looping deploy. `CASTING_INK_REGION_CROP_SCOPE` is fully live and is NOT this card's to touch.

**Five exports lost their last caller and are TAKE rows in `docs/specs/cleanup-dispositions.yaml`**
rather than deletions in the same commit, which is that table's own contract — a TAKE row deletes
nothing by itself and the execution is its own commit: `inkIntentRefusal`, `inkPlacementRefusal`
(both `inkUploadDoor.ts`), `candidateBelongsTo`, `readInkDesignCastIdentity` (both
`castingV2InkDesigns.ts`) and `recordInkPlate` (`castingV2InkPlates.ts`, the only writer of
`casting_ink_plates`). **None is HELD**: the tempting blocker is *"the reference road may want this
when he un-holds it"*, and that is precisely what his rule from the switch sitting forbids.
`INK_SITS_ON_THE_FORM_LINES` was deleted outright instead — it was a second wrapped form of a live
sentence, kept honest by an arm, existing solely for the plate prompt's bullet shape.

**Four tracked court drivers were deleted with the road they drove** — `court-ink-containment`,
`court-single-view-arm-mirror`, `court-view-reference` and `court-wrap-reference`. Each entered
through `uploadInkDesign` or the plate modules, so none can run again; their findings live in
`V3B_INK_AND_MARKS_DESIGN_NOTE.md` and `V4_SIDE_INFERENCE_COURT.md`, which is where a court's record
belongs.

**⚠ THE FAL ALLOWANCE IS NAMED AND DEFERRED, NOT QUIETLY LEFT.** `INK_PLATE_CONCURRENCY` (1,
courtesy) now spends nothing — `inkPlateEngine.ts` was the only caller of
`falAllowanceOf("INK_PLATE_CONCURRENCY")`. It stays DECLARED until slice 4 because the variable is
set on the service and `assertFalBudget()` is a **boot** gate, so removing the declaration while the
value stays in the environment changes what the gate computes on the next restart. The docblock says
so at the row rather than continuing to describe *"a design drawn onto a form"*. **And the freed slot
is not handed back to the courtesy pool** — region reads went 6 → 5 to pay for the plate mint, and
raising a live path's concurrency is a capability change wearing a cleanup's clothes.

**One guard grew a third class because the deletion forced it, and it is worth reading.**
`storageManifestReceipt.test.ts` sorted every module that writes a cleanup manifest into KEEPERS or
COLLECTORS. After slice 2, `inkUploadService.ts` still WRITES one — through `defaultManifest` — and
owns no batch, because the id now always comes from its caller. It is neither class, and labelling it
either would have been a false claim on a purge path. So it is a **WRAPPER**, with two arms making
that safe rather than convenient: a wrapper must mint no id of its own, and **every module reaching
the store through it must itself be classified** — which is the same hole the 2026-08-23 widening
closed, held shut from the other side. The instrument's own positive control was hard-coded to read
`inkUploadService.ts` for the word `cleanupBatchId`; it is derived from the keeper table now, so it
follows the population instead of shadowing it.

**What slice 2 deliberately did NOT touch, each for a stated reason:** the four flags (slice 4);
`server/db/castingV2InkPlates.ts` and the `casting_ink_plates` table (`signService.carriedInkPlates`
reads it on the paid sign road, retention purges it, the owner's removal clears it);
`shared/inkMannequinDeferral.ts` (**`signService.ts:986` reads `MANNEQUIN_ROAD_DEFERRED`** — this one
looked studio-only and is not, and it is the sharpest near-miss of the slice); `signService`'s plate
read itself, which is a money-surface change and needs its own reading.

**Slice 3 — the transform ask**, and it is the delicate one. `captureCastingInkTransformEnabled` is
read inside `refineService.ts`, a live file every account uses, and the thing it governs is *changing
a tattoo she already has*. ⚠ **A resident design can come from the reference road**, so the transform
road's removal must be read against the held road rather than against the studio alone. This slice
gets its own read before it gets a branch.


### ⚠ SLICE 3'S READ — DONE 2026-09-24, AND ITS ANSWER IS *DO NOT RETIRE THE TRANSFORM*

The card said this slice *"gets its own read before it gets a branch"*. The read is done and it
**disagrees with the slice as scoped above**, for the same reason slice 2's list was wrong: the word
*ink* names four roads and this flag does not belong to the one that retires.

**What the transform actually is, read at `shared/inkTransforms.ts` and both consumption sites.** Its
subject is **THE SAME DELIVERED CROP** — *"the design as it actually sits on him, at his own tone and
in his own light"* — with one clause of the instruction changed. Its document is the crop. There is no
field in the vocabulary for what the tattoo IS, *because the picture already says that*. `refineService`
reads the flag once (`:1553`) and uses it twice:

- **`:1876`** — whether D-137's *"a design invented from a sentence"* wall opens for a `change` ask.
  With the flag shut the ask is **refused FREE**, which the code's own paragraph argues is the RIGHT
  answer for an account that cannot transform: open the wall without the road and the ask falls
  through to the words road, which paints a fresh design from her prose and **charges 25 credits for
  it**.
- **`:3846`** — the transform itself: one axis only, the address taken from the slot through the same
  field the words road uses, and the delivery mint writes the NEW crop as the next carry's baseline.

**So the transform's subject is a DELIVERED TATTOO, whatever road delivered it** — and the road that
delivers for everybody is not the studio. Read at the artifacts rather than argued:

| fact | read at |
|---|---|
| `CASTING_INK_WORDS_SCOPE` stands at **`all`** — *"the FIRST capability this program took from users:1 to all"* | `scripts/lib/productionFlagPositions.mts:102` |
| a words-road delivery carries **no design row** — crop #1 is a delivery with `designId` NULL | `server/_core/env.ts`'s own words-road paragraph |
| delivered ink is counted **by SLOT**, valued by the crop's id, with no design id anywhere in the reading | `readDeliveredInk` / `readInkPointers`, `inkApplied.ts:163` |

**Therefore every account already has a subject for a transform, and no account but his can use one.**

#### ⚠ THE FLAG IS MIS-PARENTED TODAY, AND THE CODE SAYS BOTH THINGS IN ADJACENT PARAGRAPHS

`captureCastingInkTransformEnabled` ANDs `captureCastingInkStudioEnabled`
(`castingV2Scope.ts:2285-2289`), and `validateCastingInkTransformEnvironment` makes the studio scope
its boot parent. The reason given at the call site (`server/_core/env.ts:468`) is:

> *"a transform's whole content is a picture of a tattoo this product already delivered, so a user
> outside that door has no subject for it."*

**The very next paragraph in the same file refutes it**, about the words road:

> *"this road needs no design row and no uploaded picture — crop #1 is a delivery with `designId`
> NULL — so hanging it off the studio door would gate a lane whose subject does not require it."*

Both cannot be true. The second is the one the code implements: a words-road delivery is a subject,
and it needs no studio door. **This is a pre-existing defect, not one the retirement creates** — but
the retirement is what forces it into the open, because unsetting the studio flag would take the
transform down with it on the one account that has it.

#### What slice 3 therefore IS, and it is smaller than the card assumed

1. ⚠ **Nothing is deleted.** `captureCastingInkTransformEnabled`, `shared/inkTransforms.ts`, both
   `refineService` sites and the whole transform road **stay**. Retiring them would remove a live
   capability from the live ink road under a cleanup's name, which is his own rule inverted.
2. **The repair is a RE-PARENT and it changes nothing for anybody**: point the transform's parent at
   `CASTING_V2_SCOPE`, exactly as the words road is pointed, and leave
   `CASTING_INK_TRANSFORM_SCOPE` at `users:1`. Same accounts, same behaviour, and the studio flag is
   then free for slice 4 to unset. It is mechanical, and it is a shift's act rather than his.
3. **The capability question is separate and it is genuinely his**, so it is NOT folded in: *should an
   account whose tattoo came from words be able to say "make it bigger"?* Today the honest answer the
   product gives them is D-137's free wall. Opening it is a widen, it costs 25 credits a render on a
   road that currently refuses for free, and it is the kind of decision the switch sitting exists for.
   **It is not filed as a switch here** — slice 4 puts it to him with the numbers, or it waits.

⚠ **And the docblock at `server/_core/env.ts:468` is corrected as part of whichever slice moves the
parent**, not left standing: it is the sentence that would make the next reader re-derive the wrong
parenting from scratch.

**Slice 4 — the flags and the shared constants**, children-first, at the Atlas's retirement view —
with **#1156 read before that view is trusted**, because a file that will not parse makes the Atlas
drop a whole router silently, and *absent* is exactly the reading that says *removable*.


### ⚠ WHAT SLICE 4 INHERITED FROM SLICE 2 — read this before the flags

Five things landed on slice 4's desk on 2026-09-24, each named where it lives rather than left to be
rediscovered:

⚠ **ITEM 1 BELOW WAS RIGHT ABOUT THE CUT FLAG AND WRONG ABOUT WHOSE DECISION IT WAS, AND IT MISSED
THE STUDIO FLAG SITTING IN THE SAME CHAIN — READ *SLICE 4a'S READ* BELOW FIRST.** It closed *"re-parenting
is a change to what a live road is gated by, so it is his, not a shift's"*, and offered *"or the parent
stays as scaffolding"* as the conservative alternative. The second is not conservative: leaving the chain
alone keeps `CASTING_INK_STUDIO_SCOPE` a live ENABLING term inside the held reference road's `AND`, which
is the thing that would make a later unset turn the surface cut off silently. The re-parent was taken as a
shift's act on slice 3's ground — driven identity for every account — and disclosed on PR #1170 for the
relay to overturn.

1. **`CASTING_INK_CUT_SCOPE` is a flag nothing reads and cannot simply be unset.** Its single read
   died with the upload; it remains the boot PARENT of `CASTING_INK_REGION_CROP_SCOPE`, which
   `defaultCutDesign` still consults on the HELD reference road. Either the child is re-parented — a
   design decision, and the obvious candidate is the attach door that already parents
   `CASTING_INK_REFERENCE_SCOPE` — or the parent stays as scaffolding. **Re-parenting is a change to
   what a live road is gated by, so it is his, not a shift's.**
2. **`INK_PLATE_CONCURRENCY` is declared and spends nothing.** Removing the row from `FAL_ALLOWANCES`
   changes what `assertFalBudget()` computes at BOOT while the variable is still set on the service,
   so it is rehearsed against the target values before it is pushed — the road the five widens took.
   The sum goes 20 → 19 of a ceiling of 20, and **the freed 1 is not given to the courtesy pool**
   without its own card.
3. **Five TAKE rows in `docs/specs/cleanup-dispositions.yaml`** — `inkIntentRefusal`,
   `inkPlacementRefusal`, `candidateBelongsTo`, `readInkDesignCastIdentity`, `recordInkPlate`. A TAKE
   row is *read, and the reading says remove*; executing them is one commit, and the table will
   refuse the commit until each row is flipped to TAKEN, which is the door closing behind the knife.
4. **`signService.carriedInkPlates` reads a table nothing can write.** It returns early on zero rows
   and has since before the retirement, so removing it changes no behaviour — but it is on the PAID
   sign road, so it is a money-surface diff and gets its own reading and its own PR rather than
   riding a flag slice.
5. **`server/castingV2-ink-plate-db.test.ts` is the last proof of the plate table's rules**, now that
   the door and mint suites are gone. If `recordInkPlate` is TAKEN, that suite loses its subject and
   the table keeps only read paths — decide what proves the table's conditions before deleting the
   arms that currently do.

**And the standing warning for slice 4's own act:** #1156 is read before the Atlas's retirement view
is trusted, because a file that will not parse makes the Atlas drop a whole router silently, and
*absent* is exactly the reading that says *removable*.

---

## 7 · THE TWO RULES #203 PAID FOR, WHICH BIND EVERY SLICE ABOVE

1. ⚠ **A dead clause inside an `AND` is not dead code — it is the thing SUPPRESSING the other
   clause.** Read what the surviving term evaluates to *on production* before deleting its neighbour.
   #203 slice 2 nearly shipped *"including what they're wearing"* to every customer this way.
2. ⚠ **Ask of every guard: would this arm still pass if the thing I am deleting were already gone?**
   Two arms in #203 step (d) answered no only after they were rewritten.

**And his own rule from the sitting that produced this card, which binds it hardest of all:**

> *"Folding a new capability into a retirement is how a half-built feature ships under a cleanup's
> name."*

Nothing is added here, and nothing is KEPT "because a future feature might want it" — what stays,
stays because a road he has HELD still reads it, and §2 names each one.

---

## 8 · SLICE 4a'S READ — DONE 2026-09-24, AND IT RE-SCOPES SLICE 4 ENTIRELY

Slice 4 was *"the four flags and the shared constants leave, children-first"*. **Read at the bytes, not
one of the four can leave the service today**, and the two the census expected to go are held in place by
a road the founder HELD.

### The chain, with every live reader named

```
captureCastingInkRegionCropEnabled   castingV2Scope.ts   LIVE
   |   inkUploadService.ts:147,169 — defaultCutDesign
   |   whose only caller is inkReferenceMint.ts:215 (MINT_DEPENDENCIES.cut)
   |   reached only behind captureCastingInkReferenceEnabled (refineService.ts:1805, :4978)
   v
captureCastingInkCutEnabled          no direct reader — an ENABLING TERM only
   v
captureCastingInkStudioEnabled       no direct reader — an ENABLING TERM only
   v
captureCastingRepaintEnabled         `all`
```

| flag | can it leave? | why not |
|---|---|---|
| `CASTING_INK_TRANSFORM_SCOPE` | **no** | live on every account's refine road (`refineService.ts:1554`); slice 3 re-parented it precisely so it could stay |
| `CASTING_INK_REGION_CROP_SCOPE` | **no** | live — the held reference road's surface cut |
| `CASTING_INK_CUT_SCOPE` | **not yet** | was the region crop's boot parent and an enabling term in its `AND` |
| `CASTING_INK_STUDIO_SCOPE` | **not yet** | the same, one level up — **and** `castingInkStudioArmed()` arms three missing-table tolerances in `candidateRetention.ts` |

### ⚠ THE STUDIO FLAG WAS NOT AN UNREAD FLAG. IT WAS A LIVE ENABLING TERM.

`captureCastingInkStudioEnabled` has no caller outside its own chain, so every grep for the studio door
answers *nothing consults this*. Unsetting it would have made `captureCastingInkRegionCropEnabled(1)`
**false** — the held reference road's cut silently storing the patch rather than the surface, with no
failing test and no error. **This is §7 rule 1 with the sign flipped: the clause that looks dead is the
one doing the work**, and the census's own item 1 had spotted it one level down and missed it here.

It would not have reached production in any case: a child scope refuses to boot past an `off` parent, so
`CASTING_INK_CUT_SCOPE=users:1` over an unset studio is a crash-looping deploy. **Both failure modes point
the same way — the child moves, never the parent.**

### What slice 4a did, and its whole claim is that nothing moved

`CASTING_INK_REGION_CROP_SCOPE` re-parented from `CASTING_INK_CUT_SCOPE` to
`CASTING_INK_REFERENCE_SCOPE`, in the fence, the `validateEnv()` call site, the catalogue bullet and the
suite's own stated reason together (PR #1170, `6809e39a`).

**The old reason died with the upload and the code says so in two places** — the mirror of slice 3's
finding. The fence's reason was *"the region road is an escalation of the `cut` route — reached only after
the routing has already decided to cut"*; that routing was `uploadInkDesign`'s, retired by slices 1–2.
`inkReferenceMint.ts`'s own header says **`CASTING_INK_CUT_SCOPE` IS NOT CONSULTED** on the surviving road,
because a photograph she attached has no not-cutting position to take.

**Driven, not argued** — `captureCastingInkRegionCropEnabled` under the recorded production positions, on
the tree before and after the change:

| user | before | after |
|---|---|---|
| 1 | true | true |
| 2 | false | false |
| 7 | false | false |

One boot allowance changed: an account inside the reference road that was never inside the retired studio
now boots. No account but his names this flag.

### ⚠ A SABOTAGE LESSON, AND IT RUNS OPPOSITE TO SLICE 3'S

Slice 3 recorded *a sabotage that survived was not a hole*. Slice 4a's two survivors were not holes
either, **and for a duller reason: the edits never happened.** One `sed` pattern spanned lines (sed is
line-based); the other left the new parent still named elsewhere in the same bullet. Both reddened at
once when re-driven by a script that asserts its own anchor and prints what it changed.

**So the rule has two halves and both are now paid for: a surviving sabotage is not a finding until the
edit is proved to have MEANT something — and not until it is proved to have HAPPENED.** A green run and a
no-op edit look identical, exactly as `surviving-sabotage-may-be-inert` records.

### The corrected order for what remains

1. **4b — the deletions and the purge-path re-arm.** ✅ **DONE 2026-09-24, PR #1171** — and it corrects
   the two sentences below rather than following them. `captureCastingInkCutEnabled` and
   `captureCastingInkStudioEnabled` had no production caller and are gone. ⚠ **THE CUT FENCE, ITS PARSE,
   ITS ERRORS AND ITS `validateEnv()` CALL SITE DID NOT GO WITH THEM, AND MUST NOT** —
   `server/scopeParentChain.test.ts` holds the declared scope constants and the `validate…Environment`
   fences equal AS SETS (*"a flag with no boot check is invariant 7's 'a control that is not invoked does
   not exist', wearing an env var"*), so a declaration outliving its fence by one slice is RED in between.
   **They leave in 4c, in the same act as the variable.** And the crash this census feared points
   elsewhere: it is unsetting the **PARENT** while the child still reads `users:1`, which that fence
   refuses at boot — so 4c unsets the two TOGETHER and there is no window. ⚠ **And the retention tolerances must be re-armed in
   the same PR**: `tolerateAbsentInkDesignStore` and `tolerateAbsentInkPlateStore` read
   `castingInkStudioArmed()`, while **two doors mint design rows and only the reference one survives** —
   the same law-4 shape `castingInkDeliveryCropArmed` already fixed by ORing the two. Left as it is, the
   studio flag going off flips those tolerances from *throw* to *swallow* over a table the reference road
   can still write, which is a customer's photograph outliving the Cast it was promised to leave with.
   A purge path, so its own PR and its own reading. `inkCutScope.test.ts` loses its subject and needs a
   `DELIBERATELY_ABSENT` row; `scopeParentChain.test.ts`'s call-site CONTROL names
   `CASTING_INK_CUT_SCOPE → CASTING_INK_STUDIO_SCOPE` as its known pair and must be re-pointed, not
   deleted.
2. **4c — the variables leave the service.** ✅ **DONE 2026-09-24.** Both are UNSET, their
   `productionFlagPositions.mts` rows read `off`, and the act was rehearsed through the real
   `validateEnv()` against the service's own 36 values first, with the dangerous case as a NEGATIVE
   control: unsetting `CASTING_INK_STUDIO_SCOPE` while `CASTING_INK_CUT_SCOPE` still read `users:1`
   REFUSED, naming the child. **So the two moved in one act and there is no window.** No ink predicate
   moved for users 1, 2 or 7, and `castingInkDesignArmed()` is still true — 4b's OR doing its job.

   ⚠ **AND THE CODE DID NOT GO WITH THE VARIABLES. SLICE 4b'S OWN HANDOFF SAID IT WOULD, AND IT
   CANNOT — READ AT THE CODE, NOT AT THE CARD.** 4b wrote that 4c would take *"both fences, both
   `*_ENV` constants"*. `CASTING_INK_STUDIO_SCOPE_ENV` cannot leave at all today, because
   `castingInkStudioArmed()` reads it — and that reader is the retention sweep's question, which 4b
   deliberately KEPT and ORed with the held reference road. **Deleting the constant means deleting
   that term, which is the purge-path narrowing 4b's whole PR existed to prevent**, one slice later
   and under a cleanup's name. `scopeParentChain.test.ts` holds constants and fences equal as SETS,
   so the studio's fence cannot go without its constant either.

   **And the position row cannot be deleted while any reader remains**: the table's population arm
   takes the union of the Atlas's inventory and a constant scan, and the Atlas reads
   `process.env["X"]` as well as the constant form — so inlining the string would not help.
   `CASTING_TWO_PATHS_SCOPE` is the exact worked precedent, four days old: unset on his *"Unset it"*,
   row at `off`, fence and constant still standing.

   **The remainder is therefore NAMED rather than scheduled**: the two fences, their constants and
   the cut's parse leave when the sweep's *"could a design row ever have been written?"* is answered
   without reading a variable nobody can set. That is a reading, not a deletion, and folding it into
   a cleanup is what his own rule forbids.
3. **4d — `INK_PLATE_CONCURRENCY`** (boot arithmetic 20 → 19; the freed slot is not handed back to the
   courtesy pool without its own card).
4. **4e — the five TAKE rows executed**, one commit.
5. **4f — `signService.carriedInkPlates`** — a money surface, its own reading and its own PR.

**Neither `CASTING_INK_REGION_CROP_SCOPE` nor `CASTING_INK_TRANSFORM_SCOPE` appears on that list.** Both
are live, both stay at `users:1`, and both are now parented on roads that actually produce their subjects.
