# THE FANGS-AT-REST COURT — #599 (Fable escalated shift, 2026-09-09)

**His words (terminal, 2026-09-06, on roll 249 of his oni-cyber Re-imagine):**
*"the fangs were not rendering correctly i thought this was fixed — see the
fangs coming out of the lips — or like this one, mouth seems forced closed
might be the issue?"* — and his authorisation on the card: *"go with all your
recommendations"*.

## The class

"Mouth at rest" + "stays visible at rest" is satisfiable for TUSKS (they
protrude by anatomy) and impossible for FANGS (they live inside the mouth).
The engine resolved the contradiction the only way it could: mouth shut,
sabre teeth drawn over the lip. Two writers pushed the same way — the house
line's *stays visible at rest* and roll 249's authored *kept sharp and
visible*. #232/#243 were proven on tusked fixtures, where the sentence is
true; fangs were never in the fixture set.

## The fix (PR #708, squash `e5d374f8`)

1. `CREATURE_EXPRESSION_LINE` (`server/castingV2/houseBlock.ts`): dentition
   *shows as that anatomy allows* — tusks and an underbite protrude of
   themselves; fangs sit inside the mouth and show through lips slightly
   parted at rest — closed by the register clause *lips may part at rest to
   show what is there; never teeth forced through closed lips.* The defect
   phrase is pinned OUT in the suite.
2. The Re-imagine instruction (`server/castingV2/reimagine.ts`): a named
   mouth feature is anatomy the author keeps; HOW the mouth holds it is the
   house block's — no "kept visible", no "bared", no open or closed mouth,
   with the skin rule's own carve-out (a pose word the request itself holds
   is the customer's to keep).

## The court — two trees, refuse-to-spend assertions first

All arms at the roll's own `CANDIDATE_RENDER` (1024×1536 medium), so the lane
sentence was the only variable. Before a cent: human block byte-identical
across trees; creature block differing by exactly the #599 rewrite; **main's
composer reconstructing roll 249's RECORDED prompt byte-for-byte**, making his
production frames a true before arm; the ONI pair differing by exactly the
rewrite at the wire. Reader controls both directions: blank grey → `unclear`;
the #243 tusk positive caught; **roll 249 frame 0 as a `through_lips`
positive, verified by the operating eye before the run** (two sabre fangs over
a shut lower lip — his own reported defect).

The CYB after arm deliberately KEPT the authored "kept sharp and visible"
sentence in the brief, so the fixed line was measured against a live pose
word — the hardest case.

| arm | delivered | mouth reads |
|---|---|---|
| CYB-BEFORE — roll 249, his frames | 6/8 | **through_lips 4**, seated 1, none 1 |
| CYB-AFTER — same brief, fixed line | **8/8** | through_lips 1, **seated 5**, none 2 |
| ONI-BEFORE — implied-tusk oni, today's line | 8/8 | seated 7, through_lips 1 |
| ONI-AFTER — implied-tusk oni, fixed line | 8/8 | seated 6, through_lips 1, none 1 |

**At the operating eye (law 9 — the reader is a pointer):** after frames 0/2/5
show fangs inside the mouth, tips through slightly parted lips — the ask
exactly. The honest residual is after frame 3 (short fangs over the lip, 1/8
against 4/6 on his sheet — the per-render coin). **The tusk mouth did not
close**: ONI-AFTER-4 is textbook protrusion, and the one `none` read is a
heavy underbite with small corner tusks the reader under-called. Two after
frames dropped the fangs (`none`) — the before sheet also had one; stated-fact
presence is the known coin, not a new loss.

**Cost:** 24 renders, $1.34 (estimate held); 33 vision reads (cents). Record:
`output/_shift599-fangs/` (report.md, readings.json, prompts, frames, strips).
Strips in his eye gallery: `crew-eye/eda7f26c-b566-409f-b6d5-944117612b8e.jpg`
(oni-cyber before/after), `crew-eye/b11551bb-cda3-42a6-be51-49e380768461.jpg`
(tusk control before/after).

**The gate:** his eye on the strips closes #599. If his eye finds the 1/8
residual unlivable, the next measured step is a guard entry born from that
frame (declined this round with the reasoning on PR #708 — a pose-word ban has
second senses and the fixed line removed the forcing half).

## Second court, the same day — his eye overturned the first fix

**His eye on the strips above, verbatim:** *"the fang are coming out of the LIPS like fang tusks they dont look like teeth."* The reader's 5/8 "seated" was five tusks-through-lips to his eye, and the standard is now written down: **fangs must read as teeth inside a mouth, never growing out of or over the lips.**

Two rolls on his account (the real entrance, his session), same brief as roll 249:

| roll | change | his eye |
|---|---|---|
| `6e6140e7` (NOVIS-0..7) | the brief's own *"kept sharp and visible"* dropped; fixed line above | *"no the fangs do not read correctly here either … about the same"* |
| `b1c0eff8` (OPEN-0..7) | the same, PLUS *"the mouth is slightly open, upper teeth showing, the fangs among them as teeth — nothing growing out of or over the lips"* | *"fangs are all visible correctly now"* |

So neither the author's clause nor "lips slightly parted at rest" was the lever. **The cause is the mouth pose**: "at rest"/"parted" still reads as a closed mouth, and a closed mouth gives the engine nowhere to put a fang except through the lip. The sentence that worked is now `CREATURE_EXPRESSION_LINE`'s fang clause verbatim; "lips slightly parted at rest" and "never teeth forced through closed lips" are removed and pinned out in `creativeRegisterScope.test.ts`. Tusks keep "protrude past the lips of themselves".

**Cost:** 16 renders on his account (two rolls, 160 credits each), no reader — his eye only. Frames and strips: `output/_shift599-fangs/NOVIS-*`, `OPEN-*`, `STRIP-NOVIS-faces.jpg`, `STRIP-OPEN-faces.jpg`.

**Proof of the house line itself** (the brief-level sentence proved the mechanism, not the line): one 8-frame roll of the roll-249 brief WITHOUT the added sentence under the new line, his eye on it, recorded on #599. That roll is the gate that closes the card.

## Third court, the same day — the slot matters more than the sentence

The proof roll of the house line alone (roll `4cdd75b5`, HOUSE-0..7, the roll-249 brief with no added sentence, under the line above): **his eye — *"no strip house is reading wrong compared to the last one where i said it was good."*** The same sentence passed in the description (`b1c0eff8`) and failed in the EXPRESSION slot. Two structural reasons: the AUTHORITY line makes the description WHO and the block HOW, so the engine weights the description; and the expression line opened with "mouth at rest", which reads as closed before the fang clause is reached.

**Change:** the fang sentence now also sits in `ANATOMY_VISIBILITY_LINE` (earlier in the block, framed as anatomy like the tail), and the creature geometry is *lips parted enough to show the being's own dentition* — "mouth at rest" is gone from the creature line and pinned out. Human line untouched. Guard arms in `creativeRegisterScope.test.ts`.

**Gate:** one more roll of the roll-249 brief (no added sentence) under this block, his eye on the strip. If the description is still the only slot that works, the next honest step is the compose step writing the fang sentence INTO the seed for a fanged being (a facet the reader already sees), not another block edit.

## Fourth court — the sentence goes where the engine listens

The anatomy-line roll (`d31fbd76`, ANAT-0..7, six delivered, two content-filter refusals refunded): **his eye — *"about 3-4 of them produced fangs as teeth the others were coming out of the lip still."*** Four rolls, four slots, one pattern:

| slot | roll | his eye |
|---|---|---|
| expression line only | `4cdd75b5` | wrong |
| expression + anatomy line | `d31fbd76` | about half |
| the description itself | `b1c0eff8` | all correct |

**Change:** `dentitionClauseFor(brief, lane)` — for a creature-lane roll whose brief names `fang`/`fangs`, `composeFinalPrompt` writes `DENTITION: The being's fangs are teeth — <FANG_SENTENCE>.` as its own paragraph straight after the brief, before the family clause and the block. His words stay verbatim; the clause is code's, recorded in the prompt like the family clause (#154). Human lane never; a creature brief without fangs never (the tusked control is untouched). `FANG_SENTENCE` is declared once and shared with the anatomy line. Arms in `creativeRegisterScope.test.ts`.

**Gate:** one roll of the roll-249 brief (no added sentence) under this composition, his eye on the strip.
