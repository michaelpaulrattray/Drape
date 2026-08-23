# ITEM 8 — THE OPEN-LANE REFERENCE ROAD AND ITS SELECTOR

*Design report for countersign. Written 2026-08-24 under fable-1503 §2's
**decides-nothing contract**: the selector's shape, its vocabulary, and anything
that would touch a prompt or a surface come back to review as open questions
with options priced. Nothing here is a decision, and nothing here is built.*

*It is written against the census and the code rather than from recollection
(the §10 rule, 1315 §3), and every claim about what the product does today was
read at a file this week and is cited to it.*

---

## 1. What the founder asked for

> *"you should be able to upload any image like grok and use it as a reference
> for anything"* — 2026-08-19, the sentence that created the road

> *"the open lane reference work includes the Pinterest-style selection or did
> you forget that"* — 2026-08-21, the sentence that made it ONE item

The roadmap's own gloss is the spec in one line: **tap the thing in the picture
→ it is cut out cleanly → it becomes the reference → the ask carries it.** And
the reason it cannot be filed as two items is written there too — *without the
selector the "take anything from any image" promise collapses back to describing
the picture in words*, which is the road we already have.

---

## 2. What exists today, read at the code this week

| piece | state | where |
|---|---|---|
| the attach door | **LIVE**, `users:1` | `referenceAttachDoor.ts`, `castingV2.reference.attach` |
| a handle on a paid ask | **LIVE** | `routes/castingV2.ts:1347` — `referenceId: publicId.optional()` |
| resolving a handle to bytes | **LIVE**, three ownership questions in order | `askReference.ts` |
| the attach UI (`+`, the chip, the claim) | **BUILT** | `RefinePanel.tsx` |
| hair take — colour as WORDS, style/whole as a CROP | **LIVE**, `users:1` | `hairReferenceTake.ts`, `hairReferenceCutter.ts` |
| ink take — reads placement and side, refuses free | **LIVE**, `users:1` | `inkReferenceTake.ts` |
| the intent vocabulary and its ingestion map | four intents, `open` per form | `shared/referenceIntents.ts` |
| **naming ANYTHING from a reference** | **ABSENT** | — |
| **tapping the picture** | **ABSENT** | — |

**The census agrees, in its own sentence** (`capability-atlas.md:126`):

> *"One reference at a time by ruling; the Pinterest-style selector is the
> road's next build."*

So the capability is **partly present and the selector is absent**, which is the
citation §10's rule asks for.

### 2a. Three readings that are load-bearing and were not inherited

**(i) `casting_reference_crops` (migration 0040) EXISTS AND HAS NEVER BEEN
WRITTEN TO.** The table is real — `drizzle/0040_casting_reference_crops.sql`,
and the deploy rite's schema block reports no unenumerated absence, the one
declared-but-unmigrated table in either world being `casting_cast_segments`.
`server/db/castingV2ReferenceCrops.ts` is 57 lines
and exports exactly two functions — `listPurgeableReferenceCropsIn` and
`deleteReferenceCropRowsIn`. There is **no insert anywhere in the repository**.
A reader, a deleter, and no mint.

This is not a defect and I want to be exact about why: nothing writes it because
no crop-form intent is `open`, and `candidateRetention.ts:186` arms its
missing-table tolerance off that same map rather than off a list — so the two
facts are consistent by construction (law 4, and its docblock says so). **What
it means for this item is the useful half: the durable carrier a selector needs
already has its table, its purge path, and its arming condition, and the day
this road mints a cut is the day that table stops being a promise.**

**(ii) The hair carrier is stored, but NOT as one of those rows.**
`hairReferenceCutter.ts:485` writes the cut through `storagePut` under a
cleanup manifest (`mintHairCarrier`, manifest-before-bytes). So the live crop
road already keeps bytes and already purges them — it simply has no ROW naming
what the cut depicts. A selector that lets her tap *anything* produces cuts
whose meaning is not derivable from a fixed vocabulary, and **a cut whose
subject nobody recorded is the `crop-holds-the-region-it-depicts` problem
arriving from the other end.** Whether that argues for the row is Q2 below.

**(iii) `openReferenceIntents()` HAS ONE CALLER AND IT IS ITS OWN TEST.**
`UNIVERSAL_REFERENCE_ROAD_DESIGN.md` §5 specified the honest refusal — *"I can't
take a nose from a photo yet. I can take hair, makeup, eye colour or a tattoo
design."* — as **derived from `openReferenceIntents()` rather than typed into the
copy**. Grepped across `server/`, `client/` and `shared/`, including `.tsx`:
the only non-definition hit is `referenceIntents.test.ts`. **The derivation
exists and its consumer does not, because the sentence it was written for was
never built.**

That is not a bug today — no surface says the wrong thing, it says nothing —
but it is precisely the sentence an OPEN lane needs most, and item 8 inherits
it. Stated here so it is picked up deliberately rather than rediscovered:
**a finding with no card is a finding that gets found twice.**

---

## 3. ⚠ THE ONE FACT THAT DECIDES THE SHAPE, and its evidence class

**The segmenter this product already calls accepts point and box prompts.**

`falRegionReader.ts:34` is `fal-ai/sam-3/image`, called today with
`{ image_url, prompt, include_scores, output_format }` — a TEXT prompt.
Read at the vendor's published input schema for that same endpoint:

```
prompt          string                text prompt for segmentation
point_prompts   list<PointPrompt>     { x, y, label (0|1), object_id?, frame_index? }
box_prompts     list<BoxPrompt>       { x_min, y_min, x_max, y_max, object_id?, … }
                also: return_multiple_masks, max_masks, include_boxes
```

So a tap is a **first-class prompt on the model we are already paying for, at
the endpoint we are already calling, inside the courtesy pool we already have**
(`FAL_CONCURRENCY`). No new provider, no new allowance, no change to
`assertFalBudget`'s arithmetic.

⚠ **AND THAT IS A DOCUMENTED FACT, NOT A DRIVEN ONE.** It is the vendor's own
schema page — a claim, in this program's language, and law 1 says artifacts are
facts. **It must be driven before any build believes it**, and the drive is
cheap and belongs at the head of the build's own sitting rather than in this
report:

```
CONFIRM THE POINT PROMPT      3 taps on 2 stored pictures     6 fal calls
                              ≈ $0.005 each                   ≈ $0.03
  what it must show: a positive point inside a hair mass returns a mask of
  THAT hair and not of the whole person; a point on background returns
  nothing (or a mask we can recognise as nothing) rather than a plausible
  wrong region — the `false-pass-guard` shape, on a tap.
```

Two negative points (`label: 0`) are the documented way to say *not that* —
which is the mechanism behind "tap again to refine", and which nothing in this
report assumes works until it has been seen.

---

## 4. The three shapes a tap could take — options, not a choice

**(a) POINT → MASK.** Her tap becomes `point_prompts: [{x, y, label: 1}]`;
the returned mask is the cut. **One fal call per tap.**
*For:* it is the model's own intended use; the cut is a segmentation and never
a rectangle, so the fidelity law is satisfied by construction; refinement taps
are the same call with more points.
*Against:* we learn WHERE she pointed and never WHAT it is — a mask with no
noun. Everything downstream (the sentence that rides with a crop, the library
row, the refusal copy) currently keys on a named subject.

**(b) POINT → NOUN → TEXT MASK.** The tap goes to a describer
(`fal-ai/moondream3-preview/point` is already wired as `landmark`, in the
opposite direction: noun → points) or a small vision read to NAME the thing,
then the existing text-prompted SAM3 path runs unchanged. **Two calls per tap**
(≈ $0.005 + one text read).
*For:* it produces a noun, so every downstream consumer keeps working, and the
open lane's own vocabulary problem (`delta.open`) is the one it already solves.
*Against:* two reads is two chances to be wrong, and the second inherits the
first's error silently. **It also puts a reader's word between her finger and
her result** — she pointed at a thing and a model decided what she meant, which
is the class law 9 is about.

**(c) DRAG A RECTANGLE → CROP. ⚠ THIS ONE IS ALREADY RULED OUT AND IS LISTED SO
NOBODY RE-PROPOSES IT.** CLAUDE.md's ink-studio paragraph refuses it in the
founder's own context: *"a rectangle crop is the fidelity violation in the very
place he said 'cropped' means the design."* `box_prompts` may still be useful as
a HINT to SAM3 (a box that narrows a mask is not a box that becomes the crop) —
that distinction is Q1's, not this section's.

**My recommendation — ✅ ENDORSED AS LEADING, NOT RULED (fable-1505 §1): (a),
with (b)'s noun obtained from her SENTENCE rather than from a second reader.**
It touches the interpreter's prompt (context-is-not-additive) and must now also
serve Q1's no-words case, so it returns as the build design's first section with
that tension answered — it is not a decision this report may take. She is typing an ask anyway —
*"give her this haircut"* — and the ask already goes through an interpreter that
routes reference takes today. The tap says WHERE; her words say WHAT. That
splits the two questions across the two things that actually know them, and it
buys one call instead of two. But it is a shape decision, it touches the
interpreter's prompt, and **this report does not make it.**

---

## 5. Open questions — ✅ **ALL SIX RULED, fable-1505 §1 (2026-08-24)**

**The rulings are written in below each question rather than in a separate
block, because a ruling is landed when it is written where the next person will
act on it and the mailbox is the record, never the instruction.**

⚠ **AND Q1 CARRIES A FOUNDER RULING THIS REPORT DID NOT CITE, WHICH CHANGES THE
BUILD.** Verbatim, 2026-08-21:

> *"if you tap the hair and dont type how to apply it — it should think you want
> the entire hair look."*

So a tap with no typed application is **not an incomplete ask** — it is a
complete ask for the WHOLE LOOK of the tapped thing, and the build must serve
it. The sentence in §4 that reads *"a tap with no words is 'take this' with no
verb"* was written without knowledge of that ruling and is superseded by it.

⚠ **THE ONE TENSION, NAMED RATHER THAN SOLVED** (fable-1505 §1, and it returns
with the build design): the no-words tap **has no sentence to take the noun
from**, so §4(a)-with-her-sentence-noun cannot serve it alone. Three shapes are
on the table and none is chosen here — a bounded reader whose answer ROUTES
rather than refuses (the precedented shape: fable-1075's drawn-hair rule, *a
reader's verdict may choose a lane, never turn a customer away*), an ask-back
chip, or a subject recorded from the mask itself. Law 9 bounds all three.
**Whoever writes the build design answers this in its first section.**

---

**Q1 — Does the tap REPLACE the noun, or SUPPLEMENT it?** §4's fork. A tap with
no words is *take this* with no verb; a noun with no tap is the road we have.
*Recommendation: supplement — the tap answers WHERE, her sentence answers WHAT.*

✅ **RULED: SUPPLEMENT, with the founder's no-words ruling folded in.** See the
note at the head of this section — a tap with no typed application is a complete
ask for the whole look, and the tension that creates returns with the build
design.

**Q2 — Is a tapped cut DURABLE?** Today's hair carrier is bytes under a cleanup
manifest with no row; `casting_reference_crops` is a table with a purge path and
no mint (§2a-i). *Recommendation: the row, and for one reason — an open-lane cut
has no vocabulary to re-derive its subject from, so if it is not recorded it
cannot be carried into a later edit, and "carries like any crop" is the whole
promise.* This is a migration-adjacent decision and therefore yours.

✅ **RULED: THE ROW, in principle — and the MINT's design comes back at build.**
The table, purge path and arming condition already exist (§2a-i). What returns
for countersign is the write order (keeper-receipt, like every byte-keeping road
here) and **what the row records as the subject**, which is Q1's answer one step
later.

**Q3 — Does the selector WIDEN the intent vocabulary, or ride inside the four?**
The open lane means *name anything*. `UNIVERSAL_REFERENCE_ROAD_DESIGN.md` §12.1
already enumerates what the widening owes, and all three are still owed: the
database `$type<InkPlacement>()` narrowings (kept honest by
`inkPlacementCoupling.test.ts`), the mannequin road's three type sites, and
**the sign-road measurement — frames in front of eyes, never a lookup's
default.** *Recommendation: the selector ships INSIDE the four intents first,
because the widening's third owed item is a founder-eyes measurement on a paid
shipped road and bundling it makes one road wait on the other.*

✅ **RULED: INSIDE THE FOUR FIRST.** The widening is its own later sitting —
bundling makes one road hostage to the other.

**Q4 — The face.** Today the fence is met by construction: a hair crop is the
hair region's cutout, so a face cannot ride. **A tap has no such guarantee** —
she can tap a face. *Recommendation: the same answer the region-crop road
reached — cut the tapped region, subtract `face`, and write `0,0,0,0` below
threshold so the bytes and not merely the alpha are person-free (the
`cutOutPixels` lesson, fable-1216 §1).* One extra fal call, ≈ $0.005.

✅ **RULED: FACE SUBTRACTION, bytes and not alpha.** Person-free BYTES by
construction, never a mask laid over a photograph. Countersigned as *the
cheapest structural fence this product has ever bought*.

**Q5 — What is said when the tap finds nothing?** The honest refusal §5 of the
universal design specified and §2a-iii shows was never built. *Recommendation:
build it here, derived from `openReferenceIntents()` as originally specified —
the derivation is already written and has been waiting for its consumer.*

✅ **RULED: BUILD IT HERE, DERIVED AND NEVER TYPED.** The selector is the
consumer that derivation has been waiting for since the universal design
specified it.

**Q6 — One reference per ask.** Ruled singular, and the census records it as a
ruling. A selector does not obviously change it, but a *Pinterest-style* surface
invites more than one picture. *Recommendation: unchanged, and say so out loud
in the copy rather than leaving the surface to imply otherwise.*

✅ **RULED: SINGULAR UNCHANGED, and said in the copy.** ⚠ **With one thing the
build design owes**: the founder's select-both scenario — hair AND earrings from
one picture, then type — is **multiple TAPS on ONE image**, which is a different
question from multiple images and is NOT foreclosed by this ruling. The build
design says which of the two the first ship serves.

---

## 6. What it would cost, per house

The two purses are separate and a court's exposure is stated per house or it is
not stated (the correction on `UNIVERSAL_REFERENCE_ROAD_DESIGN.md` §8d).

```
fal          one tap                     1 call     ≈ $0.005
             + the face subtraction (Q4) 1 call     ≈ $0.005
             the confirm-the-schema probe (§3)      ≈ $0.03 total
             all on the shared FAL_CONCURRENCY courtesy pool —
             assertFalBudget's ceiling arithmetic is UNTOUCHED
openrouter   nothing new IF Q1 lands on "her sentence says what" — the
             interpreter call already runs on every refine
             ⚠ one more read per tap if Q1 lands the other way
credits      NOTHING. A tap is not a render.
```

**The openrouter balance is this board's constraint** ($4.6669 at the last
reading, a shared production account). §4(a) is the shape that spends none of
it, which is worth stating beside the taste argument rather than instead of it.

---

## 7. What this road would discharge

Two census rows and two doors are waiting on exactly the state this item
creates, and they are named so the day it lands the rows are its pinning arms:

```
ref.hair.whole    "copy this hair"                 _not driven_ — needs the
ref.ink.sleeve    "copy his right arm sleeve"      reference-attached state,
                                                   which no fixture supplies
unplacedInk       UNREACHABLE_DOORS — "becomes reachable: a reference-attached
                  fixture whose take carries no placement"
inkBeyondToday    UNREACHABLE_DOORS — "the reference-attached fixture, asking
                  for a sleeve"
```

**The reference-attached census fixture is therefore part of this build, not a
tidy-up after it.** Four rows in the map are currently held open by its absence.

---

## 8. What this report does NOT decide

Every one of Q1–Q6. Nothing here touches a prompt, a surface, a schema, a
migration, a flag or a price. No code was written for it, and the one fact it
leans on hardest (§3) is marked as documented-not-driven with the drive priced.

If the founder's look at the §6 toggle pack reorders the queue, this report is
dropped or re-aimed at no cost, which is what a decides-nothing report is for.
