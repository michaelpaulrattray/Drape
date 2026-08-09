# Keeping her edits — three options, priced

*Design document. No code has been written. Requested by Fable (fable-073) on
the founder's own challenge, extended by fable-075 with the founder's option C.
Written 2026-08-09 during the overnight shift.*

> *"I thought the whole point of masked edits was to keep all her edits
> consistent — if you edit her eyes or earrings, they should not change when
> you edit her hair. Otherwise what's the point of masking?"* — the founder,
> reviewing the carried-marks wall.

That is law 8 in one sentence, and it is correct as a statement of what the
product promises. This document says what it would take to make the
architecture agree with it, in three shapes, with what each one costs.

---

## 1. What is true today, and why

Every refinement render is anchored on the **original candidate image**. The
line is one field in `claimVariant`:

```
server/db/castingV2Variants.ts:96   /** The face this refinement was rendered FROM — always the ORIGINAL. */
server/db/castingV2Variants.ts:171  baseImageKey: candidate.imageKey,
```

`refineService.ts:1827` reads those bytes as `base`, hands them to the painter
as the single reference (`:1929`), and hands the same bytes to the harvest as
`master` (`:1941`). The compositor then reverts everything outside the applied
mask **to the original**.

Prior deliveries survive as **words, not pixels**: after each render a vision
pass writes a per-facet realization caption, and every later prompt restates
those captions as ALREADY TRUE. That is recipe v3, D-152 — *"pixels teach,
words remember"* (`realizationCaption.ts:1-32`).

**v3 exists because the obvious fix was already tried and taken out.** v2
conditioned each render on the selected parent's pixels. Facets held perfectly;
the picture rotted. Each generation inherited the last one's softness,
tone-crush and vignette, and the founder's own gauntlet was visibly blurred six
edits deep **while every facet-survival instrument read green**. v2 also made
restatement non-idempotent: "copper" on already-copper parent pixels brightened
it — re-dyeing dyed hair, which is what D-146 closed.

So the real question is not *"should we keep her edits in pixels"*. It is
**"can we keep them without paying v2's bill again"** — and there are three
answers, only one of which was available when v2 was written.

## 2. The three options

| | **A — base anchor + words** (today) | **B — chain anchor** | **C — patch permanence** (the founder's) |
|---|---|---|---|
| what the painter sees | the sharp master | the previous composite | the sharp master (+ patch crops as extra references) |
| how a prior edit survives | restated in prose, re-rolled every time | it is already in the reference pixels | its accepted pixels are re-composited, untouched |
| non-overlap carried region | **re-rolled — the defect** | frozen | **deterministic — pasted, never re-rolled** |
| photocopy loss | none | overlap regions only | **none** |
| same-facet intensification (D-146) | guarded | **returns** | guarded |
| mid-chain prune | free, or one render | **up to N−k serial renders** | **free — drop the patch** |
| seam instrument | calibrated | needs re-calibration | **transfers unchanged** (§5.2) |
| new machinery | none | anchor swap | patch store, surrender rules, 3-source compositor |

### A — what we have

Prose carries everything, so every later render re-rolls the painter's dice on
every earlier facet. Measured this shift on run-15's own face and prompts: the
written ask delivers freckles **6 of 8**; the carried ask delivers **0 of 12**
across four wordings. Whatever the wall's site turns out to be, A's ceiling is
a *probability per facet per render*, compounding with chain length.

### B — anchor each render on the previous composite

The thing v2 did, with one distinction v2 did not have: anchor on the
**composite**, not on the parent render. A composite is byte-identical to its
anchor outside the applied mask (`maskedComposite.ts:1066`), so a chain of
composites is not a chain of photocopies — loss is confined to regions where
masks overlap instead of spreading across the frame.

It is the smallest change on this list: one field, plus renaming a great many
things that say "master" and would now mean "predecessor". It is also the only
one that puts prior pixels in front of the painter, which is both its advantage
(the painter can reconcile an edit against what is already there) and its two
costs: **D-146's intensification confounder returns**, and **mid-chain undo
stops being free** — pruning step 2 of six invalidates four descendants'
pixels, which is four serial renders, ~100 credits and 4–10 minutes for what is
one click today. That can be softened (re-composite the steps whose masks are
disjoint from the pruned one; only overlaps must re-render) but the softening
is most of option C's machinery, arrived at from the expensive end.

### C — kept edits live as patches (the founder's, and the recommendation)

The master stays the anchor forever. When an edit is kept, its **accepted
in-mask content is cropped and stored as a named patch**. Every later render is
still painted from the sharp original, and the compositor assembles the result
from **three** sources instead of two:

- the master, everywhere untouched;
- **the stored patches**, for carried regions this edit does not overlap —
  pasted deterministically, not re-asked, not re-rolled;
- the fresh paint, inside this edit's applied mask.

Where a new edit *does* claim ground a patch owns, that region repaints, with
the patch crop handed to the painter as a supporting reference so the repaint
matches what she already had.

**Why this is the strongest of the three, in one line:** it is the only option
that keeps every property v3 was built for — sharp anchor, no photocopy loss,
idempotent restatement — **and** adds the property v3 lacks, which is that
delivered pixels persist. B buys persistence by giving up two of v3's
properties. C gives up none of them.

Three further things fall out of it rather than being paid for:

1. **The flicker dies structurally where it lives.** A carried facet in a
   non-overlapping region is no longer a dice roll at all. The reliability
   question changes from *"does the carried lane deliver"* to *"did the first
   delivery land"*, which is the only question the painter should ever have
   been asked.
2. **Prune stays free.** A patch is dropped and the picture is recomposited.
   Nothing downstream re-renders, because nothing downstream was ever painted
   on top of it. This is B's largest bill, deleted rather than reduced.
3. **The face chart gets its foundation for free.** Post-Sign roadmap item 3 —
   the tappable stylist-ontology face chart — needs exactly a store of named,
   per-segment accepted regions. That is the patch store. One mechanism, two
   features.

## 3. What all three fix

The run-7 / run-15 class at its root. Freckles delivered at step 1 and gone at
step 3 is not a prompt defect: step 3's composite reverted her cheeks to the
original because step 3's mask did not cover them. Under B they are in the
reference; under C they are pasted from her own accepted pixels. Either way
**the painter is never asked to re-deliver them**, and the carried-marks
lane — 0 of 12 — leaves the paid path for non-overlapping edits.

Both B and C also make **`inheritedVerdict` sound and unblock it**. That module
is built and green and deliberately unwired, and the reason is stated at
`refineService.ts:2106-2136`: under A, "outside `applied`, identical to the
master" means identical to *her first picture*, so inheriting a predecessor's
verdict would manufacture a confident false pass on pixels that had silently
reverted. Under C the inheritance is not even a judgement call — a patched
region **is** the verified pixels, bit for bit.

And all three should carry one fix that is due regardless:
`refineService.ts:1423` captures presentation facts from
`source.candidate.imageKey` — the ORIGINAL — so a pin can be read off a picture
that later paid steps have already invalidated.

## 4. Pricing option C

### 4.1 The patch store

One row and one object per kept edit: the facet it belongs to, the variant that
produced it, its mask (single-channel PNG) and its cropped RGB content. Keys
are `crypto.randomUUID()` on the public bucket like every other writer, and the
repository guard against `Math.random()` in storage writers already covers it.

**Retention and deletion are not an afterthought — patches are pixels of a
person.** Her deletion rights cover them exactly as they cover variants.
`candidateRetention.ts:100-121` already purges a candidate and all of its
variants inside one transaction, with the cleanup manifest carrying every
object; patches join that same transaction and that same manifest. **Two
schedules for one lifetime is the failure mode the retention code explicitly
refuses**, and it should keep refusing it here.

### 4.2 Seams — the part that costs nothing, and the part that does

**Non-overlap patches cost nothing, and this is worth stating precisely.**
Every render is master-anchored, so every patch was originally cut and
composited **against the master's own pixels**. Re-applying it to a later
composite places it against *the same master pixels*, in the same position, at
the same boundary. It is not a new seam — it is the seam that already passed
`compositeSeam` when it was delivered. So the instrument's calibration
(`compositeIntegrity.ts:41-50`, sized on run-6's own production frames)
**transfers unchanged**, which is not true under B.

**Overlap is where the real work is.** When a new edit claims ground a patch
owns, the boundary becomes fresh-paint against stored-patch — two renders of
the same face, made at different times, meeting along a line. Neither the
compositor's two-source machinery nor the seam bar has ever seen that. It needs:
a blend at the contested boundary, a specimen set, and a re-run of
`scripts/calibration/composite-seam.mts` on that class before any enforcing
posture applies to it (working law 2 — verify the instrument before believing
its finding).

### 4.3 Overlap surrender rules

Which patch yields when a new edit claims its ground. The territory tables
already speak this language (`zoneScope.ts`, and the `departedTerritory` /
`departedVacancy` machinery the harvest already computes). The default that
matches the user's ontology: **the newer edit wins the contested pixels; the
older patch keeps everything it still owns.** Two cases need naming rather than
defaulting:

- a *removal* that vacates ground an earlier patch owns (take off the earrings
  where an earlier edit painted the earlobe);
- a *same-facet* edit, which should retire its predecessor's patch outright
  rather than contest it — "make the freckles heavier" replaces the freckles
  patch, it does not fight it.

### 4.4 Engine references

Already plumbed. `falImages.ts:162` takes `references` as an array and
`:184` maps every one of them into `image_urls`; only the caller
(`refineService.ts:1929`) passes a single element. Nano Banana Pro takes
multiple references natively; GPT Image 2's behaviour with several is the one
thing to measure before relying on patch crops as guidance — and note that
patch-as-reference is needed **only for overlap repaints**, so a weak
multi-reference story degrades option C to "overlap repaints use prose", which
is exactly today's behaviour on exactly today's hardest case.

### 4.5 Verification, and an honesty requirement for the rate

A patched region needs no re-verification: it *is* the verified pixels. That is
correct, and it has a reporting consequence that must not be left implicit.

**A carried patch must be recorded as carried, never counted as a fresh
delivery.** Otherwise the per-class delivery rate rises for a reason that has
nothing to do with capability — the denominator quietly loses every carried
facet — and the reliability report starts describing an ability the painter
does not have. It is not a false pass (she really does have the freckles she
paid for), but under the zero-false-pass bar the distinction between *delivered
today* and *kept from before* is exactly the kind of thing this campaign has
been burned by leaving unsaid. The report splits into two columns.

### 4.6 What it does not cost

Latency on the ordinary path: unchanged — one render, one master, same
resolution pin, plus an arithmetic composite. The money path entire (per-slice
billing, refunds, the recovery sweep, the deploy-collision contract). The
refusal path and the verification net's structure. D-93's landing smoke alarm.
Mask geometry and segmentation. The courts and benches. **Sign**, which copies
its own anchor and therefore depends on nothing in the variant table
(`candidateRetention.ts:104-106`).

## 5. Pricing option B, for comparison

- `castingV2Variants.ts:171` points at the predecessor; `:96`'s contract
  comment — *"always the ORIGINAL"* — is the thing that changes.
- Every guarantee phrased "identical to the master" becomes "identical to the
  predecessor" (`refineService.ts:1941`, `maskedRefine.ts:1530`).
- `compositeIntegrity.ts` keeps its formula but loses its calibration: the
  thresholds were sized on base-anchored specimens, and a re-anchored render
  has a different in-mask character.
- `sameChain` / `fingerprintDelta` keep working, but *"same recipe ⇒ equivalent
  picture"* stops being true, because order now matters wherever masks overlap.
- Mid-chain prune: §2's bill.
- D-146's confounder returns; a same-facet-stacking bench gates the flag.
- A variant's stored bytes stop being re-derivable — they become the only copy
  of the lineage state, where today the recipe plus the master reproduces them.

## 6. Interim posture — none of this waits on the decision

**If the carried-marks wall has a site that is fixable in words, that fix ships
regardless, under every option.** Under A it is the whole answer. Under B and C
the carry prose survives for exactly the overlap repaints — the hardest cases,
not the easiest — so a words fix is not throwaway work under any outcome. This
is why the wall verdict is sequenced first.

## 7. Recommended rollout, if C is approved

1. **Patch store and deterministic non-overlap compositing first**, with
   overlap falling back to today's behaviour (repaint + carry prose). That
   slice alone kills the flicker for the entire non-overlapping majority and
   needs no new seam calibration.
2. Flag-dark behind the existing `CASTING_V2_SCOPE` machinery at `users:1`.
3. Then overlap: surrender rules, blend, specimen set, seam re-calibration,
   and the multi-reference measurement.
4. The reliability report's two columns land with step 1, not after it.
5. The run that answers the founder's sentence: freckles at step 1, three
   unrelated edits, and her freckles still there at step 4 — **byte-identical
   to the ones she bought**, with no words about them in the prompt at all.

---

## The decision, in one paragraph

All three options can make the pixels agree with what masking already promises.
**A** is honest but its ceiling is a dice roll per facet per render. **B** is
the smallest diff and pays for it twice — v2's photocopy risk returns in
overlap regions, D-146's intensification confounder returns everywhere, and
mid-chain undo goes from free to as much as four renders. **C** — the founder's
— keeps the sharp master as the anchor forever, makes carried regions
deterministic rather than probable, leaves prune free, leaves the seam
instrument's calibration valid, and hands the face chart its store on the way
past; its whole cost is concentrated in overlap regions, which is precisely
where the carry prose we already have remains the fallback. **My
recommendation is C, delivered in the two slices of §7 — non-overlap first,
where it is nearly free and fixes the measured defect.**
