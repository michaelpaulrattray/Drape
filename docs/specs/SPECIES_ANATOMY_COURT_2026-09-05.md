# THE SPECIES-ANATOMY COURT — his sentence, his four checks

**Issue #243 · Fable escalated shift `foreman-20260905-0656` · 2026-09-05 · $1.11 of house
money in renders (20 × $0.0557), cents in describer reads · no customer credits, no
database, no production write.**

**Founder order, verbatim (Crew reply #38, 2026-08-30 00:18Z):**

> *"Creature lane stays on. Don't tighten. Rewrite the rule to species — measured, not
> guessed. … Lamia didn't test tongues. It did test implied anatomy: brief never said
> 'tail,' coils still landed in all four. That's correct. Tightening to 'only anatomy the
> user typed' would turn a lamia into a woman in a dress. Don't ship that. … The next
> sentence in the house block should be: **Show anatomy the species implies, even when the
> brief doesn't name the part. People lane unchanged: mouth closed, no teeth, no tongue.**
> Then run four checks: anglerfish, lamia, sphinx, goth woman. If the goth grows fangs,
> roll it back. If the lamia loses coils, the sentence is wrong. Paper should match the
> lane. The lane is already doing the right thing."*

Driver: `scripts/_243-species-court-disposable.mts` (main tree, untracked). Frames,
prompts, per-frame readings and four strips: `output/_shift243-species/`. Parent court:
`CREATURE_LANE_WIDENING_COURT_2026-08-30.md` (its §7 tail observation is what he ruled on).

---

## 1. What was built

His sentence lands in `ANATOMY_VISIBILITY_LINE` (`server/castingV2/houseBlock.ts`), as the
paragraph's second sentence — between the named-anatomy rule and his two prohibitions, so
the placements and prohibitions govern named and implied anatomy alike:

> ANATOMY: If the being has a tail, wings, or other anatomy the description names, it must
> be visible in this frame — over a shoulder, beside the ribcage, or rising into the
> picture. **Show anatomy the species implies, even when the description doesn't name the
> part.** Do not hide it behind the back. Do not switch to a full-body shot.

**One word adapted, declared** (the same precedent as the clause's two existing declared
adaptations): his *"the brief"* is *"the description"*, because "brief" has no referent
inside the block and `AUTHORITY_LINE` already names the customer's text "the description".
Asserted in the suite (`creativeRegisterScope.test.ts`, the #243 arm).

**His *"People lane unchanged"* is executed structurally, not as prompt text**: the
sentence joins the creature lane only. Sending that clause to the engine would tell a
creature roll "mouth closed, no teeth" — the opposite of the lane it rides in. The proof is
at the bytes, cross-tree: the driver imports the composer from BOTH trees (main = today,
branch = the sentence) and **refuses to spend** unless the human block is byte-identical
across them and the creature block differs by exactly his sentence. Both held. The goth's
composed prompt was additionally asserted byte-identical to today's human-lane composition
at the wire.

## 2. How it was read — no pixel counter

His instruction three replies running (*"Don't trust the pixel tool. It counted horns as
tusks. The pictures are the result."* — #246 measured that reader failing UPWARD on absent
features). So: **closed-answer describer reads with a `saw` locator as pointers, the frames
opened by eye before anything is claimed, the strips for HIS eye, which is the gate.**

Controls, both directions, before a cent was spent — and every positive-control frame was
first verified by the operating eye (law 9, "positive control needs a verified outcome"):

| control | read | answer | |
|---|---|---|---|
| blank grey | mouth / serpent / wings / teeth | `unclear` ×4 | OK |
| `_shift101-mouth/T-C-2.png` (tusks at the mouth, verified) | mouth | `through_lips` | OK |
| same frame | teeth | `nonhuman` | OK |
| `open-absence-court/made-wings-frame.png` (large white wings, verified) | wings | `visible` | OK |
| `_shift104-widening/LAM-C-0.png` (serpent body at left edge, verified) | serpent | `visible` | OK |

## 3. The four checks — all LOW, n=4, 20/20 delivered, no refusals

Anglerfish and lamia before-rows are foreman-104's frames (`houseBlock.ts` has no commit
since 2026-08-30 — read at git log, so those frames are the same bytes' output). The sphinx
has no prior frames and rendered BOTH arms tonight — prompts diffed at the bytes, differing
by exactly his sentence. Every seed names a SPECIES and never the part being measured,
asserted at the bytes per fixture (the driver refuses otherwise).

| check | his condition | describer | my eye at the frames | verdict |
|---|---|---|---|---|
| **goth woman** (human lane) | *"If the goth grows fangs, roll it back"* | `human` 4/4 | four closed mouths, dark lipstick, no fangs, no non-human dentition | **holds — no rollback** |
| **lamia** (creature lane) | *"If the lamia loses coils, the sentence is wrong"* | `visible` 4/4 (before: 4/4) | serpent coils in frame on all four, placed as before (shoulder / edge) | **holds — coils kept** |
| **anglerfish** | keeps the jaw | `seated` 3/4, `none` 1/4 (before: seated 4/4) | needle dentition at rest on 3; the 4th a closed-mouth but distinctly angler face — same shape as the before row's own weakest frame | **holds** |
| **sphinx** | new fixture | `visible` 4/4 **on both arms** | feathered wings rising behind the shoulders on all 8 frames, before and after | **holds — see §4** |

## 4. The honest finding: the sentence's measured delta is ~zero, and that is his own diagnosis confirmed

The sphinx before-arm — today's creature block, no sentence — already delivered wings 4/4.
So on these fixtures the sentence does not change what the lane paints; the lane was
**already** showing species-implied anatomy (the lamia's tail last week, the sphinx's wings
tonight), reaching past the old clause's *"anatomy the description names"*. That is exactly
what he said when he ordered this: *"Paper should match the lane. The lane is already doing
the right thing."* The sentence is the written rule catching up to judged-good behaviour —
and the court's job was to prove it catches up **without breaking anything**: the goth grew
no fangs, the lamia kept her coils, the anglerfish kept its jaw. It does.

(Why ship a sentence with a null delta? Because the old words argued with the behaviour: a
future tightening to the clause's literal *"names"* — the exact move he forbade — would
have been a defensible reading of the old bytes. It is not a defensible reading of the new
ones.)

## 5. What is claimed, and what is not

**Claimed:** the human block is byte-identical before/after (cross-tree, at the bytes);
the creature block differs by exactly his sentence; all four of his checks pass at the
describer AND at my eye; neither rollback condition fires.

**Not claimed:** any verdict on the species tongue — his third case remains UNASKED (a
forked tongue at rest is inside a closed mouth by anatomy; the widening court's §6 stands),
and reply #38 did not order a tongue fixture. And — his standing law — **the gate is his
eye, not this document.** Four strips are in his gallery.
