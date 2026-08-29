# THE CREATURE LANE'S WIDENING — the mouth anatomy the customer never typed

**Issue #243 · foreman-104 · 2026-08-30 · $1.34 of house money in renders, cents in reads · no customer credits, no database, no production write**

**Founder instruction, verbatim (Crew reply #30, 2026-08-29 13:17:03Z):**

> *"Count it as proven and still run #243's fixture (mouth anatomy the customer never typed) as the widening."*

Driver: `scripts/_shift104-court-widening-disposable.mts` · frames, prompts, per-frame
readings and strips in `output/_shift104-widening/`.

---

## 0. Why this fixture, and what was wrong with the last one

The mouth court (#232, `CREATURE_LANE_COURT_2026-08-29.md` §3) drove the oni seed
*"…**prominent lower tusks**…"*. The house block's own `AUTHORITY_LINE` says a fact the
description states outright overrides any default in the block — so the tusks were a
**stated fact on both arms**, and the human lane's *"mouth closed"* was being overridden
by the SEED rather than by the lane. Both arms had to paint tusks, and they did.

The lane can only matter where the mouth anatomy **is who the being is and the customer
did not type it**. So every seed here names a SPECIES and never a mouth. That is asserted
at the bytes before a cent is spent — a seventeen-word list (`tusk, teeth, tooth, fang,
denti, tongue, underbite, overbite, lip, jaw, mouth, bite, maw, muzzle, snarl, grin,
smile`) and the driver **refuses to run** rather than warning, because a seed that names
the anatomy is #232's fixture again and the reading would be worth nothing.

## 1. The arms

Three fixtures × two lanes, **LOW throughout** (no author call, so the lane is the only
variable between an arm pair), n=4. The two composed prompts were diffed before spending
and differ in exactly the two documented places — `ANATOMY_VISIBILITY_LINE` added, and
`EXPRESSION_LINE` → `CREATURE_EXPRESSION_LINE` — and nowhere else.

| | seed | region word |
|---|---|---|
| **ONI**-K / -C | #232's seed with *"prominent lower tusks"* **deleted** and nothing else changed | `tusks` |
| **ANG**-K / -C | a deep-sea anglerfish humanoid — needle dentition is the species' own | `teeth` |
| **LAM**-K / -C | a lamia, serpent-blooded woman — his own third case, the species tongue | `tongue` |

`-K` = the human block (what every roll gets today). `-C` = the creature block.

## 2. The controls, both directions, before a cent was spent

Law 2, and the **positive** one is load-bearing here: this court EXPECTS nulls on the
human arm, and a reader that cannot fire produces those nulls for free.

| control | result |
|---|---|
| NEGATIVE · blank grey frame, region `tusks` / `teeth` / `tongue` | 0 px, 0 px, 0 px — **OK** |
| NEGATIVE · blank grey frame, placement read | `unclear` — *"no face or mouth visible; frame shows only a blank gray background"* — **OK** |
| POSITIVE · `_shift101-mouth/T-C-2.png`, a frame that visibly holds tusks, region | 2,597 px — **OK** |
| POSITIVE · the same frame, placement read | `seated` — *"lower tusks protruding upward from closed mouth"* — **OK** |

The placement read is a **closed four-value answer** (`none` / `seated` / `through_lips` /
`open`, plus `unclear`) with a `saw` locator, because his own instruction on this card was
that placement is judged at the frames or by *"a describer asked where the feature sits"*,
never by a pixel count. Frames are downscaled to 768px wide before that read; the controls
go through the same door.

## 3. What the pointers said

**24/24 delivered. No refusals.**

| arm | region px | mouth read |
|---|---|---|
| ONI-K | 7455, 6666, 5652, 0 | none 2 · through_lips 1 · seated 1 |
| ONI-C | 2429, 2326, 2123, 1841 | **seated 3** · through_lips 1 |
| ANG-K | **0, 0, 0, 0** | **none 4** |
| ANG-C | 4890, 298, 259, 0 | **seated 4** |
| LAM-K | 0, 0, 0, 0 | none 4 |
| LAM-C | 0, 0, 0, 0 | none 4 |

## 4. THE FINDING — the anglerfish, and it is clean

**On a fixture where the customer typed nothing about the mouth, the lane decides whether
the being keeps its own dentition.**

- **ANG-K (today's block):** ordinary closed human-shaped mouths, 4 of 4. Both pointers
  agree — the region reader finds no teeth on any frame, the placement reader answers
  `none` on all four. **At the frames** (I opened them): the anglerfish is reduced to a
  person with grey skin and a lure on a stalk. The mouth is a human mouth.
- **ANG-C (the creature block):** non-human dentition seated at rest, 4 of 4 on the
  placement reader, region teeth on 3 of 4. **At the frames**: three of the four carry
  unmistakable rows of needle teeth in a widened, hardened jaw; the fourth (ANG-C-0) has a
  narrow protruding lower jaw rather than visible teeth — still non-human, less toothy, and
  it is the frame the region reader scored 0.

Complete separation, both pointers agreeing with each other and with my eye. **This is the
widening the card asked for, and it proves out.**

The **oni separates too, but only at the frames and on the placement reader** — see §5,
because the pixel count says the opposite and the reason is the more valuable half of
tonight.

## 5. ⚠ THE INSTRUMENT FINDING — asked for a feature that is absent, the reader answers with the HORNS

The oni's region numbers are **inverted**: the human lane scores 7455 / 6666 / 5652 / 0
against the creature lane's 2429 / 2326 / 2123 / 1841. Read as a number, that says today's
block paints MORE tusks than the creature block — **the exact opposite of what the frames
show**, where ONI-K is four bearded men with essentially human mouths and ONI-C is four
heavy jaws with lower tusks seated outside the upper lip.

Law 7b forbids guessing at it, so the mask was painted back onto the frame and looked at
(`scripts/_shift104-where-disposable.mts`, overlays `*-WHERE.png`):

| frame | px | where the mask sits |
|---|---|---|
| ONI-K-3 (human lane) | 7,455 | **17%–23% of frame height — the two HORNS on his forehead** |
| ONI-K-0 (human lane) | 6,664 | **16%–23% — the horns** |
| ONI-C-0 (creature lane) | 2,123 | 35%–38% — **the two lower tusks at the corners of the mouth** |

**So the reader asked for `tusks` on a face that has none does not answer zero. It answers
with the nearest thing in the picture that looks like the word, confidently and stably**
(re-read: 7455 twice, 6666 → 6664, 2123 twice — this is not noise, it is a settled wrong
answer). And it fails **upward**: the arm where the feature is ABSENT scored three to four
times the arm where it is present.

The documented failure mode for this module is the opposite direction — a present feature
read as zero, which with `absentIsAnswer` becomes a confident *"she has no eyebrows"*. This
is that hazard's mirror, it is not in the module's docblock, and it is the more dangerous
of the two for a court, because a false negative reads as a null result while a false
positive reads as a finding. **Filed as its own card.**

### And this does NOT retro-smear #232 — checked, and the correction runs its way

The obvious next thought is that #232's overlapping ranges were this artifact. **They were
not.** Its three human-arm frames were re-read and painted: `T-K-0/1/2` sit at **38%–44% of
frame height — on real tusks at the mouth**, because that seed STATED them, so the human
arm genuinely had tusks to find. foreman-101's overlap was a **true overlap honestly
measured**, and its blindness was to PLACEMENT alone — exactly as the founder ruled when
his eye separated the rows on where the tusks sat rather than how many pixels they were.
A new finding does not get to reach backwards and take an old reading's honesty with it.

## 6. The lamia is a NULL on the mouth — and the fixture could not have produced a positive

`tongue` 0 px and `none` on 4 of 4, on **both** arms. That is not evidence the creature
lane fails on a species tongue. A forked tongue at rest is **inside a closed mouth by
anatomy**, and both blocks ask for a mouth at rest — so this fixture cannot ask the
question at all. A null is evidence only if the fixture could have produced a positive.

His own third case is still open and needs a different fixture (a species whose tongue is
outside the mouth at rest, if one exists that is not a posed tongue — which the creature
line bans by name). Recorded as unasked, not as answered.

## 7. ⚠ UNLOOKED-FOR, POST-HOC: the lamia separates on the TAIL, 4/4 against 0/4

Counted at the strip by eye, not a pre-registered arm, so it is an observation and not a
verdict:

- **LAM-C:** a serpent body or coil is in the frame on **4 of 4** — over the left shoulder,
  or coiled at the right edge.
- **LAM-K:** **0 of 4.** A woman in a drape, four times.

The seed never says *"tail"* — it says *"a serpent-blooded woman"*. `ANATOMY_VISIBILITY_LINE`
says *"anatomy the description **names**"*, and here the description names a SPECIES, not a
body part. So on this frame set the anatomy clause is reaching further than its own words
claim. That is plausibly a good thing and it is certainly an unmeasured one. **On his card
as a question, and it is post-hoc: n=4, one fixture, my eye.**

## 8. What is claimed, and what is not

**Claimed:** the creature lane changes the picture on a fixture whose seed names no mouth
anatomy — 4/4 against 4/4 on the anglerfish, agreed by two independent pointers and by my
eye at the frames; and the region reader substitutes a lookalike feature when the one it is
asked for is absent, proven by painting the mask.

**Not claimed:** any verdict on the species tongue (§6); the tail observation as a finding
(§7); and — his standing law — **the gate is his eye, not this document.** Three strips are
in his gallery.
