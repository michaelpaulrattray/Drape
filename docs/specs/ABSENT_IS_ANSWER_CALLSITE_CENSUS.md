# `absentIsAnswer` — the production call-site census (#246)

**Generated, not written.** Regenerate with:

```
npx tsx scripts/_shift114-absent-callsites-disposable.mts
```

The script is the authority: it derives the population from `server/**` on every
run and REFUSES if a module gains or loses a call site without somebody answering
the card's question about it. This file is a snapshot of its output on 2026-08-30
(foreman-114) so the finding survives without re-running the scan.

Two sittings measured the substitution in a lab (`tusks`, `hair`, `eyebrows`).
This answers the card's own first proposed item: **where the product uses it.**

---

# `absentIsAnswer` — production call-site census (#246)

1139 tracked server files · 636 test files excluded · 503 production files
32 textual mentions, 32 accounted for, 0 unaccounted

**28 production call sites in 10 modules** ask in a way that can return an absent answer.

**16 of them, in 5 modules, are REACHED** — live on production, with a floor the measured substitution defeats.

### REACHED — `server/castingV2/carriedGeometry.ts` (2 sites)
- `server/castingV2/carriedGeometry.ts:426` · asked: `one.question` · absent-is-answer
- `server/castingV2/carriedGeometry.ts:430` · asked: `one.question` · absent-is-answer
- **live:** ungated — the render re-reads every carried feature on the frame it delivers
- **floor:** NONE. `boundsOf(mask) === null` is the only 'empty'; any non-empty mask becomes a box
- **exposure:** This module IS the repair for the founder's own floating-rectangle complaint (a 'Right horn' box over background). A carried feature genuinely absent from the delivered frame reads as its lookalike, and the box is filed over the wrong pixels — reproducing the reported defect with fresh geometry that looks trustworthy

### REACHED — `server/castingV2/faceScan.ts` (4 sites)
- `server/castingV2/faceScan.ts:355` · asked: `DERIVED_REGION_ASKS.belowHead.head` · absent-is-answer
- `server/castingV2/faceScan.ts:425` · asked: `region.question` · absent-is-answer
- `server/castingV2/faceScan.ts:485` · asked: `region.question` · absent-is-answer
- `server/castingV2/faceScan.ts:531` · asked: `region.question` · absent-is-answer
- **live:** CASTING_FACE_SCAN_SCOPE = all — EVERY ACCOUNT
- **floor:** ZERO for every anatomical word. `detectionFloorFor` returns 0 for any question the born-worn catalogue does not name, and says so: "any pixels at all are the region answering, which is what the scan has always done"
- **exposure:** The face panel's boxes. Two of the three words measured substituting (`hair`, `eyebrows`) ARE panel words. A box is drawn over the substrate, and `FaceRegions`' own `onAsk(instruction, scope?)` makes it a tap target for a PAID edit — 'same pipeline, same price'. So a customer can be shown, and charged for, an edit to a feature their cast does not have

### REACHED — `server/castingV2/inkDeliveryMint.ts` (2 sites)
- `server/castingV2/inkDeliveryMint.ts:184` · asked: `ask.word` · absent-is-answer
- `server/castingV2/inkDeliveryMint.ts:292` · asked: `regionWord` · absent-is-answer
- **live:** CASTING_INK_WORDS_SCOPE = all (neck and upper arm)
- **floor:** no coverage floor; the mask is checked for the frame's SPACE, not for plausibility
- **exposure:** Mints the delivered tattoo crop that documents the design for every later edit. A substituted mask mints the wrong pixels as her tattoo, durably

### REACHED — `server/castingV2/invisibleRemoval.ts` (2 sites)
- `server/castingV2/invisibleRemoval.ts:133` · asked: `entry.site.question` · absent-is-answer
- `server/castingV2/invisibleRemoval.ts:147` · asked: `OCCLUDER` · absent-is-answer
- **live:** reached from the refine road
- **floor:** `binaryCoverage(anatomy) > 0` — a zero floor on a presence question
- **exposure:** Asks whether the anatomy is visible in the delivered frame. A substitution returns `visible: true`, and the hair-occlusion explanation the module exists to give is skipped — the customer is told her removal is visible when it is not

### REACHED — `server/castingV2/refineService.ts` (6 sites)
- `server/castingV2/refineService.ts:3119` · asked: `asked` · absent-is-answer
- `server/castingV2/refineService.ts:4810` · asked: `EYEWEAR_REGION` · absent-is-answer
- `server/castingV2/refineService.ts:8342` · asked: `question` · absent-is-answer
- `server/castingV2/refineService.ts:8611` · asked: `definition.question` · absent-is-answer
- `server/castingV2/refineService.ts:9287` · asked: `question` · absent-is-answer
- `server/castingV2/refineService.ts:9301` · asked: `question` · absent-is-answer
- **live:** CASTING_V2_SCOPE = all; CASTING_REPAINT_SCOPE = all
- **floor:** `departureFloorFor` — measured for glasses and earrings, ZERO for everything else
- **exposure:** The departure gate (`:8611`) decides the REFUND: a substituted mask means `covered > floor`, so a render that correctly removed the thing is called a failure and the customer loses the edit they paid for and received. The library mint (`:9287`/`:9301`) files a crop of the lookalike, which is then CARRIED into every later edit. `:3119` decides `presentInBase`; `:4810` (glasses, measured floor) fails toward a FREE re-ask; `:8342` crops for a caption

### NARROW — `server/castingV2/bornWornDetector.ts` (1 site)
- `server/castingV2/bornWornDetector.ts:522` · asked: `entry.region` · absent-is-answer
- **live:** reached by the panel scan; only ARMED classes are asked (glasses, earrings)
- **floor:** measured per class, three orders of magnitude below the smallest worn reading
- **exposure:** UNMEASURED against substitution. Its floors are derived from WORN readings, which is the direction the substitution defeats — but whether `glasses` on a bare face answers with the eye region has never been asked. A named gap, not a clean site

### NARROW — `server/castingV2/framingTrimStep.ts` (2 sites)
- `server/castingV2/framingTrimStep.ts:232` · asked: `"face"` · absent-is-answer
- `server/castingV2/framingTrimStep.ts:235` · asked: `"head"` · absent-is-answer
- **live:** CASTING_FRAMING_TRIM_SCOPE = users:1 (his account)
- **floor:** no floor; the boxes are handed to the trim planner
- **exposure:** `face`/`head` on a portrait, where the feature is genuinely present — the substitution's population is ABSENCE, so an ordinary cast is not exposed. A subject with no face (a creature, a helmet) would be, and the mission is casting creatures

### NARROW — `server/castingV2/hairReferenceCutter.ts` (2 sites)
- `server/castingV2/hairReferenceCutter.ts:296` · asked: `HAIR_REGION` · absent-is-answer
- `server/castingV2/hairReferenceCutter.ts:343` · asked: `SCALE_REGION` · absent-is-answer
- **live:** CASTING_HAIR_REFERENCE_SCOPE = users:1 (his account)
- **floor:** a scale floor below, applied to the answer
- **exposure:** Asked of a picture the customer ATTACHED because it has hair in it, so the absence population is thin. A hairless reference would cut the lookalike instead of refusing

### NARROW — `server/castingV2/maskedRefine.ts` (2 sites)
- `server/castingV2/maskedRefine.ts:1134` · asked: `<caller's `name`>` · forwarded
- `server/castingV2/maskedRefine.ts:1138` · asked: `<caller's `name`>` · forwarded
- **live:** the paste road's shared reader
- **floor:** the caller's
- **exposure:** `absentIsAnswer` is a PARAMETER here (default false), so this module neither creates nor closes the exposure — it forwards its callers'. Listed because it is a call site and a census that hides a forwarder is a census with a hole

### FAILS-SAFE — `server/castingV2/inkReferenceCutter.ts` (5 sites)
- `server/castingV2/inkReferenceCutter.ts:406` · asked: `INK_REGION` · absent-is-answer
- `server/castingV2/inkReferenceCutter.ts:407` · asked: `PERSON_REGION` · absent-is-answer
- `server/castingV2/inkReferenceCutter.ts:520` · asked: `word` · absent-is-answer
- `server/castingV2/inkReferenceCutter.ts:699` · asked: `INK_REGION` · absent-is-answer
- `server/castingV2/inkReferenceCutter.ts:735` · asked: `FACE_REGION` · absent-is-answer
- **live:** CASTING_INK_CUT_SCOPE / CASTING_INK_REGION_CROP_SCOPE = users:1 (his account)
- **floor:** the licence is `pixels > 0` by design and may never carry a percentage floor
- **exposure:** Both safety reads fail the SAFE way: a substituted `human skin` says a person IS present, which routes to CUTTING rather than to riding her photograph whole; a substituted `face` over-excludes. The dangerous direction here is the false NEGATIVE, which is already the documented padded-licence finding

