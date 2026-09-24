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

**Slice 4 — the flags and the shared constants**, children-first, at the Atlas's retirement view —
with **#1156 read before that view is trusted**, because a file that will not parse makes the Atlas
drop a whole router silently, and *absent* is exactly the reading that says *removable*.


### ⚠ WHAT SLICE 4 INHERITED FROM SLICE 2 — read this before the flags

Five things landed on slice 4's desk on 2026-09-24, each named where it lives rather than left to be
rediscovered:

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
