# The C′ bench — does a reference make the item the SAME, or only SIMILAR?

*Ordered by fable-153, framed by fable-154/155/156, narrowed by fable-157/158,
extended by fable-159. Run 2026-08-10 on the Unfussed cast (`f9e9cb81`,
ratified fixture). Fixture lane: provider dollars only, no user credits,
STOPLINE untouched, campaign ceiling still net 1,410 of 5,000.*

**14 paints — 11 Nano Banana Pro, 3 GPT Image 2 — and 57 region reads, of which
0 were NO-READs. Provider spend $1.95.** Logs: `output/cprime-bench-run.log`,
`output/cprime-bench-run2.log`. Frames and masks: `output/cprime/`.

---

## The founder's claim, answered in his own terms, first line

> *"NBP will reliably copy any hairstyle or reference image onto the original."*

**Confirmed at flicker resolution — and it is not close. But the engine that
does it is GPT Image 2, not Nano Banana Pro, and the thing NBP fails at is not
the copying.**

Same recipe, same five references, same ask, three independent paints:

| | Nano Banana Pro | GPT Image 2 |
|---|---|---|
| her glasses, shape agreement on the face | **0.971** | **0.988** |
| her hairstyle, shape agreement on the face | **0.961** | **0.982** |
| her glasses, position on the face | 1.2 px | **0.5 px** |
| the head's own position | wanders **58–67 px** | **0.5 px** |
| the size it hands back | 928×1136, and 928×1138 on one paint | **1024×1536 — the master's own** |

**Both engines copy a reference well. Only one of them hands back her own
picture.** The referenced items hold on the face under either painter; what
Nano Banana Pro cannot do is keep the customer's framing, and that — not the
copying — is what has been making versions look different from each other.

He is right about the architecture, and he is right that pixel-perfect pasting
was the wrong ask. **Pure C′ is viable today**, on an engine we already run in
production, at two-thirds of the cost per render.

---

## 1. What was run

| | |
|---|---|
| Fixture | `f9e9cb81` "Unfussed", master 1024×1536, five reference slots |
| Cell 1 | repeat-paint stability, **no ask**, n=5, Nano Banana Pro |
| Cell 2 | one unrelated ask ("change only her eye colour to green"), n=5, NBP |
| Cell 2g | the **same recipe through GPT Image 2**, n=3, at its exact-pixel size |
| Cell 3 | the control — our current pipeline, on production rows, no spend |

The recipe every paint received: the pristine master, plus crops of her
freckles, her hairstyle, her lip gloss and her gold hoop — each named as an
exact thing rather than described. Nothing chains; every paint starts at the
master.

**Two departures from the literal order, both declared:**

- **The second item is her glasses, not her hair.** fable-153 asked for
  "earring-vs-earring and hair-vs-hair". This face's only hair segment is the
  incidental `hairWorn` row that §3a now forbids — cut from a freckles ask — so
  it is a crop of hair *nobody edited*, and asking "did the hair stay the same"
  over it is a question about the master rather than about a delivered edit. Her
  glasses are a real born-worn item with fine wire temples, and they are the
  item the founder personally saw ghosting on block 4. Hair is reported anyway,
  where it costs nothing, marked for what it is.
- **The unrelated ask is eye colour, not freckles.** On this fixture the
  freckles are one of the *references*, so "add subtle freckles" would have
  tested whether a reference survives being re-asked for — a different question,
  and a kinder one. Eye colour is referenced by nothing, moves no item's
  geography, and is trivially checkable.

---

## 2. The instrument, and the control that rewrote the answer

```
KNOWN-IDENTICAL  v#156's hoop against itself      drift 0.00 px · IoU 1.000 · tonal 0.00
                                                  reads identical, as it must
KNOWN-MOVED      v#156 → v#157, the side-swap      drift 307.7 px · IoU 0.000
                                                  the instrument CAN see an item move
KNOWN-SHIFTED    the whole frame moved 40,40 px    raw 56.8 px (expected 56.6) · ON THE FACE 0.7 px
                                                  the anchor CANCELS head motion, as it must
```

**The third control exists because the first draft of this bench would have
reported the wrong verdict.** Under C′ every paint re-synthesizes the *whole*
frame, so between two paints the head itself sits somewhere different. Raw
centroid drift cannot tell "the reference failed to hold the earring" from "the
earring is exactly where it should be, on a head that shifted" — the first is a
verdict on the architecture, the second on framing, and they lead to opposite
builds.

So every pair is also measured in the face's own frame: the item's offset from
the face centroid, divided by that paint's own face scale, differenced, and put
back into pixels. Head translation and head size both cancel. That correction is
itself a new instrument, so it got its own positive control — the whole frame
shifted a known 40 px right and 40 px down, where item and head move together by
construction. It reads raw 56.8 px against an expected 56.6, and **0.7 px on the
face**. The anchor works.

**How much it mattered:** NBP's earring reads 78.5 px of raw drift and **6.1 px
on the face**. Ninety-two per cent of what looked like item instability was the
head moving.

**A NO-READ is reported as a NO-READ**, never folded into a mean as a zero, and
every cell carries its own n. Two consequences visible below: a tonal delta over
zero shared pixels prints as `—` rather than `0.00` (caught on this bench's own
positive control, where the side-swapped hoops share no ground at all and the
first version printed "tonal 0.00" beside an IoU of 0.000); and cell 2 reports
**6 pairs from n=5** rather than 10, because one paint came back a different
size and the bench refuses to diff across a resample — see §5.

**One limitation of image-space IoU, stated rather than buried, and then
closed.** The bench's IoU is computed in *image* coordinates, so a perfectly
reproduced pair of glasses on a head that moved 58 px scores badly while a
re-invented pair on a still head scores well. It cannot answer the shape
question under NBP at all.

Looking at the tile pack made that concrete — NBP's paints 3 and 4 appear to
wear chunkier glasses than 1, 2 and 5 — so rather than report the impression,
`scripts/measure-shape-on-face-disposable.mts` re-computes the overlap in the
face's own frame, mapping one mask through each paint's face centroid and face
scale. It costs nothing: every mask was already cached by the bench.

**Its own control failed first, and that is why it is trustworthy.** A mask
remapped onto its own face must score 1.000 and scored **0.953** — the forward
scatter perforated the mask when the scale rose above 1, and the dilation that
closed the holes then cost the identity case its own points. Rewritten as an
inverse map, which cannot perforate, the control reads **1.000**. The figures in
§3 and §4 are from the fixed instrument.

**And the impression was wrong.** On the face, NBP's glasses agree at 0.971 —
most of what looked like different spectacles was her head being nearer to the
camera in those two paints, which the scale normalisation removes. Measured
beat eyeballed, in the direction that made our own case weaker.

---

## 3. Cells 1 and 2 — Nano Banana Pro

```
CELL 1  no ask, n=5, 10 pairs
  THE HEAD                        drift mean  58.2  worst 106.5 px
  earring   raw 78.5 / 141.0 px   ON THE FACE  6.1 /  12.9 px    IoU 0.023
  glasses   raw 45.5 /  83.7 px   ON THE FACE  1.2 /   1.9 px    IoU 0.350
  hair      raw 19.4 /  41.3 px   ON THE FACE  3.7 /   5.6 px    IoU 0.596

CELL 2  "change only her eye colour to green", n=5, 6 pairs
  THE HEAD                        drift mean  66.9  worst 125.4 px
  earring   raw 99.6 / 197.6 px   ON THE FACE  5.4 /   9.7 px    IoU 0.021
  glasses   raw 46.9 /  91.7 px   ON THE FACE  1.7 /   2.6 px    IoU 0.359
  hair      raw 17.1 /  29.3 px   ON THE FACE  6.5 /  12.6 px    IoU 0.543
```

Shape agreement in the face's own frame (control 1.000):

```
CELL 1   glasses 0.971 (worst 0.950)   hair 0.961 (worst 0.945)   earring 0.363
CELL 2   glasses 0.956 (worst 0.931)   hair 0.930 (worst 0.915)   earring 0.311
```

**The references hold. The frame does not.** On her face, the glasses land
within 1.2 px and agree in shape at 0.971 across five independent paints — that
is the reference doing exactly what the founder said it would. What NBP will not
hold is *where she is*: the head wanders 58 px mean and 106 px worst between
paints of an identical request, and re-crops the picture on top of that (§5).

**The earring column is confounded on this engine too** — 0.363 shape agreement
against 0.971 for glasses on the same frames. The pair question (§4) has not
been ruled out for NBP either, and this report makes no claim about either
engine and accessories.

**The ask costs the referenced items almost nothing.** Every cell-2 figure sits
inside cell 1's own spread — glasses 1.7 against 1.2, earring 5.4 against 6.1,
hair 6.5 against 3.7. Landing an unrelated edit does not additionally disturb
what the references are holding.

That is the single most important number in this document for the pivot: under
C′ **an edit does not damage the rest of the picture.** There is no seam,
because nothing was pasted.

---

## 4. Cell 2g — the same recipe through GPT Image 2

fable-159, on the founder's own observation that reference-repaint is
engine-agnostic. **Engine choice is routing, not architecture** — so the
compositor is built against the transport interface and hard-codes no engine.

```
CELL 2g  same recipe, same ask, n=3, at 1024x1536
  THE HEAD                       drift mean   0.5  worst   0.6 px
  glasses   raw 0.1 /  0.2 px    ON THE FACE  0.5 /   0.7 px    IoU 0.993
  hair      raw 0.8 /  1.1 px    ON THE FACE  1.1 /   1.5 px    IoU 0.989
  earring   raw 201.5 / 302.0 px ON THE FACE 201.8 / 302.7 px   IoU 0.221   ← see below
```

Shape agreement in the face's own frame (control 1.000):

```
CELL 2g  glasses 0.988 (worst 0.984)   hair 0.982 (worst 0.977)   earring 0.221
```

**This is the founder's architecture working at flicker resolution.** Between
independent paints, 0.05% of the frame changes by more than 40 levels. Her
glasses — the tortoiseshell frame with the distinctive white temple tips, the
item he personally watched ghost on block 4 — come back at 0.988 on the face
and IoU 0.993 in the image, three times running. The head holds to half a pixel.

**The margin over NBP is real but narrower than the raw numbers suggest**:
0.988 against 0.971 on glasses, 0.982 against 0.961 on hair. The decisive gap is
not shape — it is geometry (§5), where NBP loses outright.

**And the ask lands on all three.** Verified by looking, not by inference: the
master's eyes are grey-blue and all three paints are green
(`output/cprime/EYES-sheet.png`). Near-identity would be worthless if the
painter had simply handed back reference 1, and it did not.

**The reference genuinely contributes.** Also verified by looking
(`output/cprime/EARS-master-vs-paint.png`): **the master wears no earrings at
all.** The hoops in every paint came from the reference crop, cut from v#156.

### The earring number is a PAIR failure, not a fidelity failure

201 px of drift against a head that moved 0.5 px demanded an explanation, so the
frames were opened rather than the number reported.

Between two GPT Image 2 paints, only **846 pixels of a 1,572,864-pixel frame**
change by more than 40 levels — and they sit in two clusters, at both ears.
Cropping them (`output/cprime/EARS-gpt2-sheet.png`) shows it plainly: **paints 1
and 2 deliver the matching pair of hoops; paint 3 delivers one.** The reader
then finds "earring" at the midpoint of two hoops in two paints and on one ear
in the third, and reports 300 px of drift for an item that never moved.

**The prompt is at least as culpable as the engine.** The bench's reference
clause says *"the exact gold hoop earring she is wearing — the same hoop, on the
same ear"* — singular — and the fixture wears a pair. Two paints of three
supplied the pair anyway. This is the founder's own ontology (working law 8:
earrings come in matching pairs) meeting a prompt that spoke in the singular,
and the codebase already owns the fix: `accessoryKinds.pairClauseFor`.

**Filed, not concluded:** the pair question needs its own small cell with a
pair-aware clause before anyone says GPT Image 2 drops earrings. n=3 with a
singular prompt does not support that claim, and this report does not make it.

---

## 5. The geometry problem

The bench was not designed to find this and it is the most operationally
consequential thing it found.

```
her master                                        1024x1536
NBP, 1K, no aspect argument                        928x1136   ← a different SHAPE, not a smaller one
NBP, 1K, aspect pinned 2:3                         848x1264   ← right aspect, still not her size
NBP, same request, fifth paint of cell 2           928x1138   ← and not even self-consistent
GPT Image 2, told exact pixels                    1024x1536   ← the master's own geometry, returned
```

Nano Banana Pro takes a resolution *tier*, not a size. Pinning the aspect ratio
fixes the shape and not the size — 848×1264 is its own roughly-one-megapixel
cap. So under NBP the customer's approved crop is never the crop that comes
back, and one paint in ten wanders two pixels on top of that, which silently
cost cell 2 four of its ten comparisons.

**This is decisive for hybrid-D.** Hybrid-D byte-restores unasked ground from
the master, and ground that has been resampled can never byte-match. A painter
that will not return the master's geometry cannot support byte-restore at all;
one whose output size wanders between identical calls cannot support it even in
principle.

**Even on GPT Image 2, hybrid-D is not free.** The paint comes back on the
master's canvas, but against the master itself it carries mean |Δ| 3.6 and
0.09% strongly-changed pixels — the subject is re-rendered and very slightly
re-placed. Byte-restore would need per-region registration, not a straight
copy. Between GPT Image 2's *own* paints, though, agreement is 0.993, which is
the number the customer actually experiences when flicking between versions.

---

## 6. The reference-slot budget

### The headroom table, read from schemas rather than memory

| engine | image-input cap | source |
|---|---|---|
| GPT Image 2 (`openai/gpt-image-2/edit`) | **16** | fal's own OpenAPI, read 2026-08-10: `GptImage2EditInput.image_urls.maxItems: 16`, *"A maximum of 16 images are allowed"* |
| Nano Banana Pro (`fal-ai/nano-banana-pro/edit`) | **14** | our own code's documented ceiling (`server/providers/falQueue.ts:59`). **fal's OpenAPI declares no `maxItems` for this endpoint at all** — so 14 is docs-derived, not schema-derived, and it is enforced by us rather than by them |

This fixture's recipe used **5 slots** (master + 4 item references), so GPT
Image 2's cap covers it and fable-159's arm qualified and ran.

### How many slots a heavily-edited cast actually needs

Derived from the facet vocabulary rather than guessed: **9 facets are
reference-carried** (§7), so a cast edited on every one of them needs master + 9
= **10 slots** — inside both caps, with 4 to spare on NBP and 6 on GPT Image 2.

**But two of those nine hold many things each.** `statedAccessories` is one
facet and can be earrings *and* glasses *and* a necklace; `ink` is one facet and
D-138's flash sheets are explicitly plural. So the ceiling is reachable: 8
single-item facets + master leaves **5 slots on NBP / 7 on GPT Image 2** for all
accessories and all tattoos combined.

**The packing rule, proposed now rather than discovered in production:** when
adornments exceed their remaining slots, composite them into ONE contact-sheet
reference — which is exactly what D-138's flash sheets already are for tattoos.
An "adornment sheet" generalises a mechanism the program has already ruled on
rather than inventing a second one. It costs one slot however many items it
carries, and it keeps every item's crop frozen, which is the flash-sheet law.

### Cost per render

| | | |
|---|---|---|
| Nano Banana Pro, 1K | **$0.150** | list price (`falQueue.ts`) |
| GPT Image 2 | **$0.099** | **measured** off the account balance, 2026-07-30 — list arithmetic was 18% low |

The better painter is also the cheaper one. This is the latency-and-cost
program's engine-routing court (§1/§6) getting its first C′-shaped specimens.

---

## 7. The two carry tiers, derived and not hand-authored

fable-158 requires the tier split to come from the existing rails and forbids a
second authored list. `scripts/derive-carry-tiers-disposable.mts` reads
`allFacets()` and classifies each from `CHANGE_AMPLITUDE`, which the program had
already recorded for every free subject. The amplitude classes turn out to *be*
the tier question in different words:

| amplitude | what it means | tier |
|---|---|---|
| SURFACE | a few levels over a wide area — no silhouette to crop | **word-carried** |
| REPLACEMENT | opaque where it is, absent where it is not — a croppable thing | **reference-carried** |
| RESTRUCTURE | a boundary moves, the interior stays itself — its crop is a crop of the face | **ambiguous** |

**Reference-carried (9):** `ears`, `eye.colour`, `facialHair`, `hair.colour`,
`hair.cut`, `hair.texture`, `hairWorn`, `ink`, `statedAccessories`

**Word-carried (4):** `cheekbones`, `marks`, `skinCharacter`, `skinTone`

**Ambiguous (11) — the founder's thirty-second taste pass:**

| facet | why it is ambiguous | recommendation |
|---|---|---|
| `makeup` | axis-only — no free subject answers it, so there is nothing underneath to read | **word** — makeup is applied, not owned; regenerating it from its words is what a stylist expects |
| `lips` | RESTRUCTURE — fuller lips move the vermilion border, the interior stays lip | **word** — his "lip gloss" and "lip colour" both fold in here, and both are finishes rather than objects |
| `brows` | RESTRUCTURE — a shape change moves the boundary, the interior stays brow | **reference** — a brow shape is a *cut*, and §4 says references hold hair-like things at 0.99 |
| `lashes` | RESTRUCTURE — fine dark strands on a small boundary | **reference** on GPT Image 2, **word** on NBP — this is exactly the fine-detail class the engine choice decides |
| `eye.shape`, `nose`, `jaw`, `chin`, `teeth` | RESTRUCTURE — anatomy, not adornment | **word** — these are the face itself, and the master already carries her |
| `hairFinish` | RESTRUCTURE — shine and matte change how light sits, not where hair is | **word** — a finish has no silhouette |
| `expression` | RESTRUCTURE — and D-136 already refuses to let Follow inherit a smile | **word**, and it should stay outside the library entirely |

**The check that this rule is honest rather than fitted:** fable-158 named
`makeup`, `brows` and `lips` as ambiguous from taste, before any of this was
written, and the derived rule lands **3 of 3** of them in the ambiguous column
without ever consulting them. (`lip gloss` and `lip colour` have no separate
slot and fold into `lips`. **`nails` is not in the vocabulary at all** — no
facet, no subject, no region; adding it is real work, not a mapping.)

**One derived row deserves his eye:** `eye.colour` derives as reference-carried
because it is REPLACEMENT by amplitude — and an iris crop *is* a real reference
— but an eye colour is not a *thing* the way a hoop is. Recommendation: leave it
reference-carried; §4 shows a reference's weakness is small hard objects, and an
iris is neither hard-edged nor free to wander.

---

## 8. The pivot plan

fable-155 requires the plan to arrive beside the tiles; fable-157 narrows the
question to **which variant**, not whether.

### Recommendation: PURE C′, routed to GPT Image 2. Do not build hybrid-D.

Four reasons, each with a number behind it:

1. **Pure C′ already meets the bar on GPT Image 2.** Shape agreement 0.988 and
   0.982 on the referenced items against a control of 1.000, 0.5 px of head
   motion, the ask landing 3 of 3, 0.05% of the frame strongly changed between
   paints. There is nothing left for a byte-restore to rescue.
2. **Hybrid-D's precondition is only half-met even on the good engine.** The
   canvas comes back exact, but the subject is re-rendered against the master at
   mean |Δ| 3.6 — so byte-restore needs per-region registration, which is a
   second geometry problem to own for a benefit the customer cannot see.
3. **What hybrid-D fixes is a verification convenience, not a quality.** The
   customer-visible risk is small-item fidelity, and hybrid-D does not touch it:
   an asked-for earring is asked-for ground and gets repainted either way.
4. **It is cheaper.** $0.099 against $0.150 per render, measured.

Build against the transport interface regardless, so the routing decision stays
a routing decision.

### What "verified delivery" means under the winner

Cell 1's job under fable-157 was to calibrate the bar, and it does:

- **Reference tier, on GPT Image 2: shape agreement on the face ≥ 0.977 and
  on-the-face drift ≤ 2 px** is the measured band for items of glasses/hair
  scale — that is the *worst* pair of three, not the mean, which is the side to
  set a bar from. That is the candidate tolerance "unchanged" should mean —
  **provisional at n=3**, and the first thing the adoption chunk should widen.
  On NBP the same band would be ≥ 0.915, which is the price of that engine.
- **Small hard items have no band yet**, because the only n=3 reading available
  is confounded by the pair question (§4). A pair-aware cell must run before any
  accessory bar is set. **Recorded as absent rather than estimated.**
- **Word tier** keeps the existing class-delivery bar and makes no
  cross-version stability claim, per D-241.
- The zero-false-pass law (D-235) applies to each tier's own promise separately.

### What retires, and what carries

**Retires (compositor-specific):** the paste compositor, the blend/feather build
(already on hold per fable-155), and the seam-treatment programme.

**Carries, essentially whole:**

- **The segment store**, re-read as what the founder always meant: a **crop +
  text reference library**. Better segments make better *references*, so the
  delivered-anchored silhouette build that shipped dark this shift (10.0% →
  88.7% capture of what the paid edit delivered) is not stranded — it feeds the
  pivot directly.
- **The panel** (fable-144/160), which renders that library. Under D-241 every
  segment has a crop by construction, so the empty-thumbnail question dissolves:
  the thumbnails *are* the reference crops.
- **Detection and the born-worn catalogue** — they seed the library.
- **Every instrument**: the deltas, the coherence statistic, the region reader,
  the walk machinery, and the head-anchor built here.
- **The refund law, the spend guards, the recovery sweep, the walks.**

**It is a painter swap, not a rebuild.**

---

## 9. Handed forward

- **The pair cell.** Re-run cell 2g with `pairClauseFor`'s language and n≥5,
  before any accessory tolerance is set. Until then no claim is made about
  either engine and accessories.
- **The replay walk's assertions need re-deriving.** They were written against
  the paste compositor and assert byte-identity on unasked ground — a claim the
  new architecture does not make. The walk does not run against an architecture
  being replaced (fable-157). STOPLINE stands regardless; only Fable lifts it.
- **Block 3's seam finding is not wasted.** The −5.99 luma step along 9,332
  boundary pixels of the hair paste (coherence 0.445 against the anchored arms'
  0.202 and 0.179) is exactly the class of defect a full repaint never
  manufactures. It is now evidence *for* the pivot, and remains the calibration
  specimen if blending ever resumes.
- **NBP is not retired by this report.** It holds items on the face to 1.2 px
  and it owns the anatomical routes on identity strength. What it cannot do is
  hand back the customer's own geometry — so it stays a routing row, with its
  weakness now measured rather than suspected.
