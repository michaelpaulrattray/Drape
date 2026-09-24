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

**Slice 2 — the studio's own service chain**, now unreachable: `inkUploadService.ts`,
`inkUploadDoor.ts`, the cut and region-crop machinery (`inkReferenceCutter`, `inkReferenceCrop`,
`inkDeliveryCrop`) **where it is not shared with the reference road** — checked per module at the
bytes, not assumed from the file name. `#10` (the ink-cut preview) closes with this slice: it is the
widening condition for a flag that will no longer exist.

**Slice 3 — the transform ask**, and it is the delicate one. `captureCastingInkTransformEnabled` is
read inside `refineService.ts`, a live file every account uses, and the thing it governs is *changing
a tattoo she already has*. ⚠ **A resident design can come from the reference road**, so the transform
road's removal must be read against the held road rather than against the studio alone. This slice
gets its own read before it gets a branch.

**Slice 4 — the flags and the shared constants**, children-first, at the Atlas's retirement view —
with **#1156 read before that view is trusted**, because a file that will not parse makes the Atlas
drop a whole router silently, and *absent* is exactly the reading that says *removable*.

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
