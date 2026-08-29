# The absent-feature substitution — does it reach the product, and where else could it?

**#246, worked by foreman-105 on 2026-08-30.** The card filed a finding about an
INSTRUMENT and left two things open: whether it reaches a customer, and which of
the product's `absentIsAnswer: true` call sites could inherit it. Both are
answered here. Cost: **$0.015** of house money (three region reads), two
read-only production queries, no credits, no render, no write.

---

## 1. What #246 established, and what it did not

`falRegionReader` asked for a feature the picture does **not** contain does not
answer nothing. It answers with the nearest thing in frame that looks like the
word — confidently, stably, and **larger** than the true feature scores when it
IS present:

| frame | asked | px | where the mask sat |
|---|---|---|---|
| `ONI-K-3` — no tusks, two prominent horns | `tusks` | **7,455** | 17%–23% of height — **the horns** |
| `ONI-C-0` — tusks at the mouth | `tusks` | 2,123 | 35%–38% — **the mouth** |

That is a fact about an instrument. It says nothing by itself about a customer.

---

## 2. It reaches the product path — driven, not inferred

The widest-population site is `reMintCarriedGeometry` (`carriedGeometry.ts:419`).
It runs on every repaint render that carries a feature, it is behind no flag of
its own, and its header rests on precisely the property #246 falsifies:

> *"an empty reply means the frame does not show it, which is a rectangle we must
> not draw rather than a question that failed"*

So the **real production function** was driven with the **real fal reader**, on
frames I opened and looked at myself (law 9). The only injected dependency is
the database write, captured and never performed.
Driver: `scripts/_shift105-carried-substitution-disposable.mts`.

| arm | frame | expected | filed | box band |
|---|---|---|---|---|
| **A** | `ONI-K-3` — tuskless, horns in frame | `unread` | **a box** ⚠ | **17%–23%** |
| **P** positive control | `ONI-C-0` — tusks present | a box | a box ✓ | 35%–38% |
| **N** negative control | blank grey | `unread` | `unread` ✓ | — |

**The negative control is the load-bearing one.** Without it, "arm A filed a box"
is indistinguishable from "this function files a box for everything". It answered
`unread` through the same code path, so arm A's box is a reading of the picture.

**And the box was painted back onto the frame and looked at**
(`output/_shift105-carried/ARM-A-BOX.png`): the rectangle the product filed for
`tusks` is drawn tightly around **both horns on the forehead**. That is the
founder's own founding specimen for this table — a rectangle labelled for one
feature sitting on another — reproduced by the machinery built to end it.

### The consequence, stated plainly

A carried feature the render did **not** deliver is filed as present, with a box
on the wrong anatomy. Three things follow: the panel draws that rectangle; the
`unread` counter — whose stated job is *"a re-mint that quietly starts failing is
stale geometry returning with a green suite"* — does not count it; and a later
crop cut from that geometry becomes the feature's DOCUMENT, which is what rides
into the next prompt.

---

## 3. ⚠ Its live population today is ZERO, and that is the honest severity

Read off production (read-only), and the instrument was checked before the number
was believed — the first query read `geometry.carried` and **no row has that key
at all**, so a zero off that path was a broken reader, not a finding. The census
that answers is `JSON_KEYS`, which enumerates every shape in the table:

| reading | production |
|---|---|
| `casting_face_scans` rows | 176 (2026-08-17 → 2026-08-29) |
| distinct `geometry` shapes | 2 — `…,scanned` (175) and the same without it (1) |
| rows holding a `carried` key | **0** |
| `casting_reference_library` rows | **1**, written 2026-08-18 |
| `casting_ink_delivery_crops` rows | **0** |

The re-mint fires only when a render carries library rows or delivered ink crops.
Production holds one library row — written five days *before* the re-mint shipped
— and no delivery crops. **So the confirmed defect has never run for a customer.**

This is caught before its population arrives, not after. It is also why this is a
card for his decision rather than an incident.

---

## 4. The census — every `absentIsAnswer: true` site in the product

**25 call sites in 8 modules** (a 26th match, `security/trustedImageFetch.ts`, is
a docblock quoting the flag, not a call). The question asked of each is the card's:
*can this be asked of a picture that does not contain the answer, and is a
lookalike plausible?*

### Class 1 — the absent case IS the question. The exposure lives here.

| site | word asked | what a substitution costs |
|---|---|---|
| `refineService.ts:8616` — the departure gate | the removed thing's own question, on the **delivered** frame | **the sharpest one in the census.** `covered > floor` refuses into the refund. A successful removal reads as a failure: she is refused and refunded for a picture that was correct |
| `refineService.ts:9287/9302` — the mint's reader | the feature's question, on the delivered frame | nothing found is `subjectAbsent`, the honest refusal. A lookalike mints a crop of the wrong anatomy as the feature's **document** |
| `refineService.ts:3119` — `presentInBase` | the asked feature, on the **original** | the product believes she already had it and prunes a step she paid for |
| `carriedGeometry.ts:419` | the carried feature's question | **confirmed above** |
| `invisibleRemoval.ts:136` | the site's anatomy (`ear`, `eyes`, `nose`) | D-226's whole premise is that silence means *nothing in the picture can see this site*. A lookalike says "visible", the expensive half never runs, and the honest *"her ears are behind her hair"* sentence is never said |
| `invisibleRemoval.ts:147` | `hair` (the occluder) | attributes the covering to hair on a cast that has none |
| `inkReferenceCutter.ts:406` | `tattooed skin`, on her upload | the licence's whole population is pictures that may hold none. A lookalike turns a **refusal into a cut** of part of a person's photograph |
| `inkReferenceCutter.ts:407` | `human skin`, padded | fails the other way — a flash sheet read as a person turns a good upload away |
| `inkReferenceCutter.ts:699` | `tattooed skin` inside the surface crop | the region road's licence |
| `bornWornDetector.ts:522` | `glasses` | files a worn accessory onto a face wearing none |
| `faceScan.ts:428/488/534` — accessory slots | `glasses`, `earring` | a panel row and a rectangle for something she is not wearing |
| `inkDeliveryMint.ts:187/292` | the placement word on a **covered** surface | the covered case is load-bearing: a lookalike mints the shirt as the tattoo's document, and that document is the SOURCE a transform carries |

### Class 2 — present by construction. Low exposure, listed for completeness.

`faceScan.ts:358` (`head`), `faceScan.ts:428/488/534` for anatomy slots,
`framingTrimStep.ts:232/235` (`face`, `head`), `hairReferenceCutter.ts:343`
(`face`, for scale), `inkReferenceCutter.ts:520` (the named surface — a failure
here drops the scope rather than refusing, the safe direction),
`inkReferenceCutter.ts:735` (`face`, for the exclusion — a substitution
over-excludes, also the safe direction), `refineService.ts:4810`
(`EYEWEAR_REGION`), `inkDeliveryMint.ts` on a bare surface.
`hairReferenceCutter.ts:296` (`hair`) sits between the two: a bald or
non-person reference reaches it.

### Which sites have a MEASURED negative population

Two words, and only two:

- **`glasses`** — 23 bare faces read 0.000% against 8 bespectacled at 1.349–2.093%
  (`bornWornDetector.ts`, 2026-08-09). This defends `bornWornDetector:522`,
  `faceScan`'s glasses slot and `refineService:4810`.
- **`earring`** — 4 visibly bare lobes at 0.0000%, and per side 14 of 14
  non-wearing sides **structural zeros** (2026-08-13/14).
- Partial: **`human skin`** — the padded-licence court measured two drawings
  staying at zero, which is a negative control for the flash-sheet direction only.

**Everything else in class 1 rests on an assumption that has now been falsified
once.** That is the census's actual yield.

---

## 5. What this does NOT claim

1. **It does not claim every absent read substitutes.** One word (`tusks`), one
   species, one lookalike (horns), measured. Generalising from it would be the
   guess law 7b forbids. What the census establishes is that the property these
   sites rely on is **unmeasured** at 22 of 25 of them, not that it is false there.
2. **It does not retro-smear any shipped reading.** The two words with measured
   negative populations were measured the right way round and stand.
3. **It does not say a customer has been harmed.** §3 is explicit: zero live rows
   on the confirmed site.

---

## 6. The repair is a product decision, so it is not cut here

Three options, and none of them is free. **My recommendation is (b), and only for
class 1.**

- **(a) A pixel floor.** Dead on arrival — the substitution scored 7,455 px
  against the true feature's 2,123. No floor separates them; a floor high enough
  to reject the horns rejects real tusks.
- **(b) A bound on WHERE the answer may sit** — a feature's answer must land in
  the band its anatomy lives in. Free (arithmetic on a mask already in hand), and
  it is exactly what made the defect visible in thirty seconds. The cost is that
  it needs a band per question, which is a vocabulary decision and touches the
  yield rule (#13).
- **(c) A second, differently-anchored question** — ask a confirming question of
  the crop. Robust, and it buys **one extra segmenter read per carried feature**
  ($0.005 each) on a path that already prices itself at $0.015–$0.030 a render.

Option (b) is the one that fits this program's own rules: it is arithmetic rather
than a second model opinion (law 9), it costs nothing, and it fails toward
`unread` — the outcome the code already handles and already counts.

**What holds until he rules:** nothing ships. The site is dark by population, and
the record above is what stops the next seat from reading a green suite as proof.

---

## Artifacts

- Driver: `scripts/_shift105-carried-substitution-disposable.mts` (three arms,
  both controls, box painted back onto each frame)
- Frames and overlays: `output/_shift105-carried/` (`ARM-A-BOX.png` is the one
  to look at), report at `output/_shift105-carried/report.md`
- Source frames: `output/_shift104-widening/` (foreman-104's court)
- Production reads: `scripts/_shift105-keys-disposable.mjs`,
  `scripts/_shift105-pop-disposable.mjs` (read-only)
- The finding is recorded in source at `server/castingV2/falRegionReader.ts`,
  beside the opposite direction it already documented
