# The departure gate against #246 — measured, 2026-08-30 (foreman-106)

**Brief:** foreman-105's handoff item 4 — *"the 22 unmeasured sites are the real
work behind #246, and none of them is cut. If a shift wants one, the departure
gate (`refineService.ts:8616`) is the one worth buying a measurement for
first."*

**Cost:** 24 fal region reads, **$0.120** of house money. Two read-only
production queries. No credits, no renders, no customer money, no production
write.

---

## 0. What the gate is

After a render that was asked to take a feature OFF, `refineService.ts:8616`
asks the delivered frame whether the thing is still there:

```ts
const still = await reader.region({ image: image.bytes, name: definition.question, absentIsAnswer: true });
const covered = binaryCoverage(still);
const { floor } = departureFloorFor(definition.guardKind);
if (covered > floor) { /* the removal is DISPUTED */ }
```

#246 says the reader, asked for a feature the picture does not contain, returns
the nearest lookalike rather than nothing. At this gate that would turn a
removal that landed perfectly into a removal our own instrument says did not.

---

## 1. The population, read at the code — 12 questions, 10 of them at a floor of ZERO

`catalogueSlots()` holds 25 slots; 17 carry a `question` and can therefore reach
the vacate path; those 17 ask **12 distinct questions**.

| question | floor | slots |
|---|---|---|
| `earring` | **0.0002 measured** | `earring@left`, `earring@right` |
| `glasses` | **0.001 measured** | `glasses` |
| `derived:below-head` | 0 — unmeasured | `build` |
| `ear` | 0 — unmeasured | `ear@left`, `ear@right` |
| `eyebrows` | 0 — unmeasured | `brow@left`, `brow@right` |
| `eyes` | 0 — unmeasured | `eye@left`, `eye@right` |
| `facial hair` | 0 — unmeasured | `facial-hair` |
| `hair` | 0 — unmeasured | `hair` |
| `horns` | 0 — unmeasured | `horns@left`, `horns@right` |
| `lips` | 0 — unmeasured | `lips` |
| `nose` | 0 — unmeasured | `nose` |
| `nose stud` | 0 — unmeasured | `nose-stud` |

The two measured ones are exactly the two words foreman-105's census found to
have a measured negative population. **The floor for the other ten is zero**,
which `departureFloorFor`'s own docblock defends as *"the strictest reading
there is — the segmenter found nothing of it at all"*. That defence is written
against a reader that answers an absent feature with silence. **#246 is the
claim that it does not**, and at a floor of zero a single lookalike pixel
disputes the removal.

Reader: `scripts/_shift106-departure-population-disposable.mts` (code only, no
network).

---

## 2. The measurement — 1 substitution in 6 absent cells, both controls holding

Real reader (`createFalRegionReader`), real arithmetic (`binaryCoverage`), real
floor (`departureFloorFor`), real question (`slotDefinition(...).question`), so
the verdict printed is the gate's own decision on those bytes. The surrounding
refine request is not driven — no render, no charge, no database.

Frames: foreman-104's kept fixtures, plus two heads from the founder's own
creature reference set. **Every frame was opened at full resolution and looked
at before its arm fired** (law 9), and once *after* — which is how the one error
below was caught.

| arm | frame | my eye | coverage (×2 reads) | gate verdict |
|---|---|---|---|---|
| FH-LAM-K-2 | woman, head hair, no beard | absent | 0.000000 , 0.000000 | accepted ✓ |
| FH-LAM-C-0 | same woman, loose hair | absent | 0.000000 , 0.000000 | accepted ✓ |
| FH-ANG-C-2 | creature | absent | 0.000000 , 0.000000 | accepted ✓ |
| **FH-ONI-K-1** | **bearded man — POSITIVE CONTROL** | present | 0.018523 , 0.018523 | disputed ✓ (mask 36–51%, the jaw) |
| FH-BLANK | flat grey — NEGATIVE CONTROL | absent | 0.000000 | accepted ✓ |
| HO-LAM-K-2 | woman, no horns | absent | 0.000000 , 0.000000 | accepted ✓ |
| **HO-ONI-K-0** | **oni with horns — POSITIVE CONTROL** | present | 0.004162 , 0.004162 | disputed ✓ (mask 16–23%, the forehead) |
| HO-BLANK | flat grey — NEGATIVE CONTROL | absent | 0.000000 | accepted ✓ |
| **HA-ANG-C-0** | **bald creature** | **absent** | **0.016506 , 0.016506** | **DISPUTED ⚠ — 25,962 px on the bare skull** |
| HA-ANG-C-2 | creature | *absent (WRONG — see §3)* | 0.064283 , 0.064283 | disputed — **reader correct** |
| **HA-LAM-K-2** | **real hair — POSITIVE CONTROL** | present | 0.067495 | disputed ✓ (106,160 px) |
| HA-REF-BALD-1 | hairless humanoid | absent | 0.000000 , 0.000000 | accepted ✓ |
| HA-REF-BALD-2 | hairless alien head | absent | 0.000000 , 0.000000 | accepted ✓ |
| HA-BLANK | flat grey — NEGATIVE CONTROL | absent | 0.000000 | accepted ✓ |

**The confirmed instance is HA-ANG-C-0.** A genuinely bald head; the reader
returned a 25,962-pixel mask shaped like a hairline cap sitting over the bare
skull — the place hair would be if there were any. Stable across two reads.
Painted back onto the frame and looked at:
`output/_shift106/HA-ANG-C-0-WHERE.png`.

**Both controls are load-bearing and both held in the same sitting.** The flat
grey field went through the identical code and returned an EMPTY mask, so the
function can say *nothing there* — without that, "it filed a box" would be
indistinguishable from "it files a box for everything". And LAM-K-2 returned
106,160 px on real hair, so the reader can find the thing when it is present —
without that, a clean null on the other cells would be evidence of nothing
(`null-result-needs-a-fixture`).

⚠ **It is NOT a rule about bald heads.** Two other hairless heads returned
exactly 0.000000, twice each. So the rate is **one substitution in three
hairless subjects**, not *always* — which is the worse shape for diagnosis, not
the better one: an instrument that is wrong sometimes cannot be caught by a
single check.

⚠ **`facial hair` and `horns` did NOT reproduce it** — four absent cells, all
0.000000, each with a positive control that fired on the same word in the same
sitting. #246's own specimen was `tusks`, a word the gate never asks. So the
substitution is not a property of every word; which words it reaches is open.

Drivers: `scripts/_shift106-departure-substitution-disposable.mts` (+ the
`-round2-` / `-round3-` variants, identical but for their `ARMS` list).
Overlays and reports in `output/_shift106/`.

---

## 3. ⚠ MY OWN ERROR, AND IT IS THE ONE WORTH COPYING

I called **ANG-C-2 bald** and filed it as an absent cell. It is not bald: it has
a mass of fine, wet, dark hair around the head, and the reader's 101,108-pixel
mask sits exactly on it. **The reader was right and I was wrong.**

The cause is exact and repeatable: I chose my arms off a **300-pixel contact
sheet**, where dark wet hair against a dark background reads as a bare skull.
What caught it was the overlay — painting the mask back onto the frame and
opening it at full resolution, which is the step that exists for this.

Had the overlay not been opened, ANG-C-2 would have been written up as a second
confirmed substitution at four times the pixel count of the real one, and #246
would have been "confirmed twice" on the strength of a thumbnail.

**The rule this earns: an absent cell's absence is verified at the resolution
the claim is made at, not at the resolution the frame was chosen at.** A
contact sheet picks candidates; it never certifies one.

---

## 4. What it costs — and this CORRECTS the handoff that sent me here

foreman-105's handoff called this site *"the only one in the census where a
substitution costs a customer money and a picture."* **Read at the code, the
money half is not true**, and the reason is a founder ruling.

`removal_not_delivered` is **not** in `REFUSES_AFTER_RENDER`
(`server/providers/types.ts:214`), whose members are `render_fault`,
`composite_fault` and `segment_store` alone. Under fable-721's
catastrophic-only contract a disputed removal is **DELIVERED AND CHARGED**, and
Regenerate is the remedy — the founder's own ruling that a reader's opinion of a
picture is off the money path.

What a substitution costs here instead is **the record and the next edit**:

> *"The SLOT IS NOT RETIRED when the reading disputes the removal… Retirement is
> not a money decision; it is a statement in her library about what her face now
> has."* — the gate's own comment.

So the failure is: she asks for the hair off, the render takes it off, the gate
disputes it, the slot keeps its reference — and **the next repaint carries the
hair back onto her head**. A paid removal that reverts on the following edit,
which is the `library-holds-presence-not-absence` class exactly.

That is a real defect and a different one from the one I was sent to find. It
argues for the same repair with a different urgency: not a refund bug, a
persistence bug.

---

## 5. Live population: ZERO — read at production, with an instrument check

```
internalPrompt shapes:  one shape, holding `repaint`
repaint shapes:         one shape, holding `vacated`
variants: 1 · withRepaint: 1 · withVacated: 0
rows that reached the departure gate: []
```

**No production render has ever carried a non-empty `vacated` list, so this gate
has never fired for a customer.**

The zero was checked before it was believed (foreman-105's rule): `JSON_KEYS`
first, so the path is known to exist rather than assumed, and then a control
query — **236 rolls, 240 candidates, 1 variant, newest 2026-08-19**. The refine
road has barely run in production at all; the emptiness is a fact about the
whole table, not about my query.

This is the **second consecutive #246 site to confirm a defect with no live
population**. That is not a reason to shelve it — it is the argument for fixing
it before N3: the refine era is precisely what brings the population, and this
class is underneath it by then.

Reader: `scripts/_shift106-vacate-population-disposable.mts` (read-only, house
door, production).

---

## 6. What this does not say

- It does not measure the other nine unmeasured words. Four cells across two of
  them came back clean; ten questions still have no negative population.
- It does not settle whether ANG-C-0's scalp is hairless **to the founder's
  eye** — law 9 says my reading of a frame is a pointer, not a verdict. The
  strip is on his page for that reason.
- It does not propose a repair. #246's three costed options are his decision and
  foreman-105's handoff explicitly holds them; nothing here changes the
  recommendation, though §4 changes what the repair is *for*.

---

# 7. THE SECOND WORD — `eyebrows`, measured 2026-08-30 (foreman-113)

**Brief:** foreman-112 declined this for a sixth night and then wrote the
counter-argument into its own handoff, item 9: *"an independent confirmation on
a SECOND word would settle the gate regardless of how he answers, which is
exactly what the eye question is holding up."* §6 above leaves the gate resting
on one cell whose absence is waiting on the founder's eye. This buys a second,
independent word so the gate has a verdict either way.

**Cost:** 13 fal region reads, **$0.065** of house money. No credits, no
renders, no database, no production read.

Driver: `scripts/_shift113-brow-substitution-disposable.mts`.
Report: `output/_shift113/report.md`. Overlays: `output/_shift113/BR-*-WHERE.png`.
Strip: `output/_shift113/STRIP-brows.jpg`.

## 7.1 Why `eyebrows` and not one of the other nine

Not convenience — three of the four reasons are properties of the word itself:

- it is one of the **ten gate questions at a floor of ZERO**, so a single
  lookalike pixel disputes a removal that landed;
- `falRegionReader.ts` already documents the **opposite** failure on this exact
  word (the `eyebrow` union coming back EMPTY over a frame whose brows measure
  1,429 px and 1,593 px), so the module already knows this word is fragile and
  had never been asked about this direction;
- *"take her eyebrows off"* is an ordinary customer ask, not a creature-only
  one — unlike `tusks`, which the gate never asks at all;
- and a brow with the hair taken off still has a **RIDGE** where the hair was,
  which is the nearest lookalike a picture can offer.

## 7.2 CONFIRMED — 2 substitutions in 4 absent cells, both controls holding

Real reader, real `binaryCoverage`, real `departureFloorFor`, real catalogue
question, and the same call shape the gate itself makes at
`refineService.ts:8611` — whole delivered frame, plain noun, `absentIsAnswer`.

| arm | frame | eye | coverage ×2 | px | band | verdict |
|---|---|---|---|---|---|---|
| **BR-ANG-C-2** | anglerfish creature | absent | **0.004269 , 0.004269** | **6,714** | 26%–29% | **DISPUTED ⚠** |
| **BR-ANG-C-0** | same species | absent | **0.002544 , 0.002544** | **4,001** | 23%–27% | **DISPUTED ⚠** |
| BR-ANG-K-0 | same species | absent | 0.000000 ×2 | 0 | — | accepted ✓ |
| BR-c1871 | honeycomb skull plate | absent | 0.000000 ×2 | 0 | — | accepted ✓ |
| BR-LAM-K-2 | dark brows — POSITIVE | present | 0.002466 ×2 | 3,878 | 29%–32% | disputed ✓ |
| BR-53 | blond brows — POSITIVE | present | 0.003868 ×2 | 6,084 | 26%–29% | disputed ✓ |
| BR-BLANK | flat grey — NEGATIVE | absent | 0.000000 | 0 | — | accepted ✓ |

Identical to six decimal places on re-read in both disputed cells: **a settled
wrong answer, not noise** — the same stability `tusks` showed.

**Both controls are load-bearing and the script ASSERTS them rather than
printing them.** Flat grey returned EMPTY through the identical code, so the
function *can* say nothing is there; both brow-bearing faces returned non-empty,
so the reader knows the word. Without either, every clean null in the table
above would be silence rather than evidence.

## 7.3 It fails UPWARD again — and this time past the positive controls

`tusks` scored 3–4× its own present arm. `eyebrows` does something narrower and
worse to read:

**ANG-C-2's ABSENT read (6,714 px) is larger than BOTH present arms** — the
woman's real dark brows (3,878 px) and the man's real blond brows (6,084 px).
ANG-C-0's absent read (4,001 px) is larger than the woman's real brows too.

So on this word the absent population does not merely score high, it **outscores
the feature actually being present**. Any repair that hopes to separate the two
by magnitude is dead here for the same reason a pixel floor was dead on `tusks`,
and now it is dead with the two populations *inverted* rather than merely
overlapping.

## 7.4 LOOKED AT, not inferred — law 9

The numbers are a pointer; the strip is the finding
(`output/_shift113/STRIP-brows.jpg`, four arms, masks painted back at native
resolution with each arm's own verdict read out of the run's report rather than
retyped).

- **ANG-C-2** — the reader painted **two anatomically perfect eyebrow shapes
  onto bare ridged skin**, one above each eye, on a face carrying no brow hair.
- **ANG-C-0** — one brow-shaped patch of bare skin above one eye, and **nothing
  at all on the other side**: the reader is not self-consistent even within one
  species on one word.
- Both positive controls sit exactly on the real brows. The reader is good at
  this word when the word has a referent.

Cells were certified by eye at NATIVE resolution before any read fired
(`output/_shift113/brow-band.jpg`, `scripts/_shift113-eyecrop-disposable.mts`),
which is §3's earned rule applied rather than quoted.

## 7.5 What this settles, and what it does not

**Settles:** the gate's substitution is **not a property of one word or one
frame**. Two independent words now confirm it — `hair` (foreman-106, 1 of 3) and
`eyebrows` (2 of 4) — with different subjects, different lookalikes and their
own controls in their own sittings. **§6's open item is closed: the verdict no
longer depends on how the founder answers the bald-skull question.** If
ANG-C-0's scalp turns out to carry hair, `hair` reverts to unmeasured and the
gate still has a confirmed substitution.

Pooled across both sittings the gate now stands at **3 substitutions in 10
absent cells** across five words, with `facial hair` (3 cells) and `horns`
(1 cell) clean and each carrying its own positive control.

**Does not settle:** the remaining **seven** unmeasured words
(`ear`, `eyes`, `lips`, `nose`, `nose stud`, `derived:below-head`, and the two
measured-floor accessory words are separately unprobed for substitution). It
proposes no repair — #246's three costed options are the founder's, and nothing
here changes the recommendation. It does not touch the live population, which is
still **zero**.

## 7.6 What it costs a customer, when the population arrives

Unchanged from §4 and now on a word she would plausibly ask for: she asks for
her eyebrows off, the render takes them off, the reader points at the bare ridge
and says they are still there — so the frame is **delivered and charged** (the
catastrophic-only contract), and **the slot is not retired**, which means the
next repaint paints the eyebrows back on. A paid removal that reverts on the
following edit: the `library-holds-presence-not-absence` class, not a refund bug.
