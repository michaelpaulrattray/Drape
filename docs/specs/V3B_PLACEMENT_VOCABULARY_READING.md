# The placement vocabulary — the killer question, answered

*Run 2026-08-16 by the executor, ordered by fable-649 §3 and approved
pre-emptively, BEFORE any placement table was designed. House money: 56
segmenter reads, no credits, no ledger rows, no writes to any table.
Bench: `scripts/bench-placement-vocabulary-disposable.mts`. Artifacts:
`output/placement-vocabulary/`.*

---

## 0. The question, and the short answer

`V3B_INK_AND_MARKS_DESIGN_NOTE.md` §3 named the expensive part and asked for it
to be tested first: **can a reader find a forearm?** A placement the reader
cannot find is a tattoo the panel cannot point at.

**No — and the failure is not a refusal.** Asked for a forearm on a frame that
contains none, the reader answers on 3 of 4 frames with a confident mask that
passes every downstream check a panel would apply. It hands back the **upper
arm** and calls it a forearm.

The note's warning was right about the direction and one layer short of the
cause. The cause is not that the body is under-exercised. It is that

> **the body is not in the photograph.**

## 1. What a casting frame actually contains — established before any call

Sixteen production masters were downloaded and opened at full resolution before
a single read was bought (`frames-sheet.png`, `bottom-strip.png`,
`corners.png`). The result is uniform to a degree that needs no statistics:

```
16 of 16   cropped ABOVE THE ELBOW
16 of 16   wearing the roll prompt's own uniform
```

The uniform is not incidental — it is asked for, in
`cohortPhotorealHuman.ts:190`:

> `WARDROBE: plain unbranded clothing in neutral grey or off-white — a simple
> crew-neck tee or plain shirt.`

So the inventory of **bare skin below the jaw** in a casting frame is:

```
neck                  every frame
lower upper arm       a sliver below the sleeve, at the bottom corners
upper chest           on a SCOOP neckline only — covered on a crew neck
```

Everything else a tattoo vocabulary would want — forearm, wrist, hand, ribs,
upper back, shoulder blade — is either below the crop line or under the tee.

**Measured, not eyeballed.** The crop line falls **1.8–2.2 face-mask-heights
below the chin** across the four bench frames (a face mask is brow-to-chin, so
a head is taller than one). Taken against the subject matte's crown instead —
which includes hair volume and is therefore the softer of the two readings —
that is ~1.4–1.5 head-heights below the chin on the three ordinary-haired
frames. On canonical figure proportion that lands between the nipple line and
the navel, roughly half a head-height above the elbow.

**This confirms `castingFrame.ts` rather than contradicting it.** That module's
declared shortcut says the delivered masters are "cropped at roughly the lower
ribs", and they are. The existing door is correct; it simply holds one row.

## 2. The reader, on words it cannot honour

Four frames (one man, one scoop neckline, two crew), asked through the
product's own `createFalRegionReader` with `absentIsAnswer: true` — the one path
that turns a failed reading into a confident negative, which is the path under
test. Positive controls (`face`, the subject matte) held on **4 of 4**, so the
run stands.

```
                                                        ground truth
  neck          4/4  found                              IN FRAME, BARE
  shoulder      4/4  found                              IN FRAME, CLOTHED
  upper arm     4/4  found                              IN FRAME, PARTIAL
  chest         0/4  not found                          IN FRAME, CLOTHED
  collarbone    0/4  not found                          IN FRAME (bare on B)
  forearm       3/4  ANSWERED ABOUT PIXELS THAT DO NOT EXIST
  elbow         0/4  refused honestly                   NOT IN FRAME
  hand          0/4  refused honestly                   NOT IN FRAME
  waist         0/4  refused honestly                   NOT IN FRAME
  knee          0/4  refused honestly                   NOT IN FRAME
```

**The prediction filed before the run was WRONG, and being wrong is the
finding.** I predicted the five out-of-frame words would hit on more than half
of their twenty reads — that the reader is broadly a yes-machine. It is not:
elbow, hand, waist and knee refused on 4 of 4 each. **3 of 20.**

That makes the one word that DID answer far more dangerous than a yes-machine
would have been. A reader that says yes to everything is caught by its first
control. This one refuses cleanly where there is no plausible referent and
**relabels where a near-enough surface exists** — which is the failure that
survives a review.

## 3. The signature — two words, one arm

The proof is in `arm-overlay.png`, and the numbers predicted it before the
picture was drawn. Cyan is what the reader called *upper arm*; magenta is what
it called *forearm*:

```
frame   upper arm                    forearm
A       centre x 90%, band 80–100%   centre x  7%, band 94–100%
B       centre x 15%, band 80–100%   (nothing)
C       centre x 90%, band 74–100%   centre x  8%, band 91–100%
D       centre x 15%, band 68–89%    centre x 87%, band 87–100%
```

**Every frame where both read, the two words land on OPPOSITE SIDES of the same
body, in the same height band.** A forearm and an upper arm cannot be at the
same height on opposite sides of someone standing square to camera with their
arms down. There is one bare arm sliver on each side; the reader gives one word
each. Neither is finding an anatomical structure — both are finding *bare arm
skin*, and `keep: "first"` picks a side.

This is the class already on the record: **a reader asked a question it cannot
answer wrong answers a class with an instance.** It cost a whole walk once when
SAM3 ignored laterality; here it would have cost a customer a tattoo on the
wrong part of their arm, silently, at full price.

And it would have passed every guard a panel could reasonably apply: the mask
is **100% inside the subject**, 0.7–1.7% of the frame, in the lower band, and
non-empty. There is no downstream check that catches it. The only thing that
catches it is knowing the forearm is not in the picture.

## 4. Name the surface, not the bone

`collarbone` read 0/4 — including frame B, whose collarbone is bare, unoccluded
and plainly visible. Before concluding the region is unreadable, the lips
precedent was applied: a region's key is not the words sent. Twelve reads, on a
bare (scoop) frame and a covered (crew) frame as its negative control:

```
                   B, bare scoop        A, covered crew
  collarbone       nothing              nothing
  collarbones      nothing              nothing
  clavicle         nothing              nothing
  decolletage      nothing              nothing
  upper chest      FOUND 2.69%          nothing
  chest skin       FOUND 2.79%          nothing
```

**It was the word.** Skeletal nouns read nothing; surface nouns find it exactly
(`upper-chest.png` — a tight mask on the bare skin inside the neckline, stopping
clean at the fabric). And the same word **correctly refuses on the covered
frame**, which is the occlusion-aware, per-frame honesty a placement vocabulary
needs, and the exact opposite of what `forearm` did.

So: **SAM 3 segments visible surfaces, not landmarks.** This is a measured input
to the founder's third question, which is about the placement names as copy.

## 5. The sweep — how many instances of this class already exist

Working law 7, run before reporting. Every question in the slot catalogue today:

```
hair · facial hair · eyes · eyebrows · nose · lips · ears · horns
earrings · glasses · nose stud
```

All of them are face regions, **in frame by construction** — which is precisely
what `castingFrame.ts` says ("A casting portrait always contains the face").
The one body slot, `build`, carries `derived:below-head`: it is COMPOSED, never
asked.

**The class has zero existing instances.** No slot in the product today asks a
segmenter for a region whose presence in the frame is unestablished. The ink
slot would have been instance one. This finding is preventive, not remedial.

## 6. What this does to the design

1. **A placement must clear the frame before it clears the reader.** The order
   in the design note's §5 is right but its step 2 needs a step 1a: the
   `OUT_OF_FRAME` table (`castingFrame.ts`, one row today) is the gate, and
   every placement below the jaw needs an entry or an explicit in-frame proof.
   A segmenter read is not that proof — §2 is the demonstration.
2. **The vocabulary that survives the frame is very small**: neck, upper arm,
   and upper chest *conditional on the neckline*. Two bare-skin placements, one
   of them dependent on what the model is wearing.
3. **Placement names are surfaces**, not bones (§4), and that is measured rather
   than a preference.
4. **The frame gate is per-frame, not per-vocabulary, for the conditional one.**
   "Upper chest" is available on a scoop neck and absent on a crew neck, in the
   same product, at the same moment. The reader answers that question correctly
   and for free — it is already reading the garment.

## 7. What this does NOT settle, and the question it raises above the founder's

The ontology question (§1 of the design note — is a tattoo something she WEARS
or something her SKIN IS) is untouched by this and still his to answer.

But it is no longer the first question, and the sequencing should be said
plainly: **a tattoo studio built on this casting frame has almost nowhere to put
a tattoo.** Two placements, one conditional on a t-shirt. That is not a
vocabulary problem to be designed around — it is a question about what the
camera takes and what the model wears, and it decides whether the studio can
exist in its intended form at all.

Filed to `founder-queue.md` with a recommendation. It costs nothing to answer
and it outranks the ontology, because the ontology only matters once there is
somewhere for the ink to go.
