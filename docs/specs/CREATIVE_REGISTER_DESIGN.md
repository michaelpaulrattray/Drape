# The Creative Register — Fable-authored design

**Status: DESIGN, Fable-authored on the founder's explicit ask (2026-08-25:
"i honestly will need you to do a fable review of the work for this").
Nothing built. The dilution court (fable-1660) executes against this
design; the enrichment design folds into it.**

**Authority:** the three-legged founder mandate — creativity at Midjourney's
level, especially on initial sheets (fable-1662); specific asks delivered
AND sold (fable-1663); never at the cost of photoreal humans (fable-1667) —
plus the two founder-eye standards on disk in `output/raw-prompt-reference/`
(the raw-prompt frames = the conviction bar — TWO distinct frames, opus-1276 §5
read the bytes and founder-raw-01/02 are byte-identical; the old sheet = the
spread bar) and the bracket statement (fable-1665).

---

## 0. The diagnosis this design accepts

The engine is a better artist than our prose. Given the founder's 553
characters plus SEVEN words of frame ("ultra-realistic, bare chested,
studio casting shot"), GPT Image 2 delivered conviction, correct vibe
inference, and fidelity. Given the same 553 characters inside our ~13,700-
character compile, it delivered timidity, beards nobody asked for, and
bodybuilders. The compiled prompt does not merely dilute the customer —
it ANSWERS QUESTIONS THE ENGINE ANSWERS BETTER UNAIDED (disposition prose,
physique register, energy words), and the engine obeys our answers over
its own inference (fable-1664).

The corollary that saves us from over-correcting: those same sentences are
plausibly WHY ordinary human sheets are reliably photoreal and consistent.
The engine's native prior for "a person" benefits from our structure; its
native prior for "a cybernetic man" is damaged by it. **The scaffolding is
innocent on one population and guilty on the other — so the repair is not
deletion, it is REGISTER SELECTION.**

## 1. The architecture: the compiler states, the engine paints

Two registers, selected per roll, behind a flag:

### 1a. The HOUSE register (today's, byte-identical)

Every ordinary photoreal-human brief compiles exactly as today. Not
"mostly" — byte-identical, asserted as a string. This is constraint 3
made structural: the population the engine is already great at never
rides an experiment.

### 1b. The CREATIVE register (new, flagged)

Engaged when the brief is creative (§2). Three parts, in salience order:

**THE ASK — the customer's words, verbatim, first.**
The brief rides as written, not paraphrased into house prose. The
founder's raw prompt IS a customer's words performing perfectly; the
interpreter's job here shrinks to extraction (facts for pinning, axes
for variance) and NEVER rewriting. What the customer typed is the
highest-salience text the engine sees.

**THE SHEET FRAME — minimal, structural, counted in words not paragraphs.**
Photoreal register ("ultra-realistic studio casting shot"), the framing
sentence, the wardrobe line (with the bare-chested lesson: construction
nouns, no exposure statements), the backdrop. Target: the frame is
SMALLER THAN THE ASK for any substantial brief. The founder proved seven
words suffice for the frame's core; ours may need a few more (wardrobe,
backdrop, crop) but every sentence must name a STRUCTURAL fact of the
sheet, never a quality of the person.

**THE VARIANCE CARD — per-slice, invitations on open axes only.**
- Stated facts are never re-stated per slice (they live in the ask; the
  pin machinery guards them at extraction, not by repetition — repetition
  is how the ask gets outweighed).
- Each slice names its variation as an INVITATION on axes the brief left
  open: "this candidate: the augmentation more extensive — hardware
  continuing below the jaw" / "this candidate: older wear, scarring
  around the ports" / "this candidate: leaner, ascetic". Concrete enough
  to force divergence, open enough that the engine designs the hardware.
- Disposition is expressed as something VISIBLE ("weariness in the eyes",
  "coiled stillness") only when the brief leaves character open;
  otherwise omitted — the founder's frames prove the engine infers vibe
  from content.
- The category block (when `role` exists) keeps its job in ONE sentence:
  "Every candidate is a credible <role>; vary within that." Its current
  seven-line form is house prose answering inferable questions.

### 1d. The writer's room — thin briefs get AUTHORED concepts
### (founder direction, 2026-08-25)

The founder's Grok experiment is the founding evidence: the reference-
quality goth portrait came from a LANGUAGE MODEL writing ~250 concrete
words which then rode into the engine nearly alone. Authored richness is
manufacturable. So for a THIN creative brief ("cyber-goth girl with an
eyepatch"), the compiler's authoring upgrades from filling defaults to
WRITING THE CONCEPT:

- One text call authors EIGHT DISTINCT rich concepts of the ask, each
  written like a description of an existing photograph (the Grok
  register: concrete, constructional, specific — never mood-prose).
- The customer's stated words survive verbatim inside every concept
  (stated facts pin; the author only writes the unstated).
- Each concept rides the creative register as its slice's ask — the
  variance card's job is absorbed by concept divergence on thin briefs.
- Cost: cents of text before any render. Refusal path (§1c-pre) applies
  to authored concepts identically — the author writes in the safe
  construction register from the start.

His words that ordered it: "if someone types a small prompt not a rich
prompt how do they recieve a result as creative as this" — the answer is
the sheet advantage Midjourney lacks: eight authored interpretations of
one thin ask, on one sheet.

**The richness dial, complete (his framing, 2026-08-25):** thin brief →
the writer's room authors; medium → yield-rule blend (stated pins,
house fills what remains); rich → the compiler orchestrates only (frame,
spread, extraction, safety) and stays out of the author's chair.

### 1c-pre. The refusal path (founder-proven, 2026-08-25)

The founder's own experiment is the specimen: a rich Grok description of
his gothic cyber-fashion reference refused 4/4 on GPT Image 2 as sent,
and passed 3/4 after HIS rewrite — same character, same garments, same
composition, with the exposure claims and fetish-adjacent material words
swapped for construction nouns ("black leather cybernetic eye harness…
straps" → "black geometric futuristic eye covering"; "sheer black lace
mesh top that reveals the skin underneath" → "black lace long-sleeve
top"; the sheer/reveals/fingerless-glove clauses dropped). Seedream 5.0
Pro took the raw version whole — the checker is per-engine, not
per-content.

So the register's verbatim-ask principle needs one honest amendment:
1. The ask rides VERBATIM first, always.
2. On a `content_policy` refusal, ONE retry with the ask passed through
   the construction-register transformation (the `SAFETY_TERM_MAP`
   grammar generalized: rename flagged nouns by construction, drop
   exposure claims, never change the objects) — DISCLOSED on the sheet,
   never silent, because rewording a customer's words without saying so
   violates the register's own founding principle.
3. Still refused → per-slice refund and the honest sentence, as today.
This is the wall-retry pattern applied at the engine's own wall, and the
founder's manual edit is its worked example (saved beside the reference
frames).

### 1c. What is deliberately NOT in the creative register

No physique register (build converges bodybuilder today because we
describe bodies; if the brief leaves build open, the variance card owns
it), no energy/mood prose, no anti-instructions ("never X") except the
safety-critical ones, no repeated fact blocks. Every removal is courted
(§3), never assumed.

## 2. Register selection

The interpreter already classifies enough to decide: a brief engages the
creative register when it states any of — an open-lane kind, fantastical
anatomy/hardware (the cyborg's `statedInk`-adjacent hardware reading), a
role outside the ordinary human catalogue, or explicit style/world
language. Selection is: (a) logged on the roll row, so every sheet knows
which register built it; (b) conservative — ambiguity resolves to HOUSE,
because the house register is the proven one and a creative brief
mis-routed to house is today's known state, while an ordinary brief
mis-routed to creative is an unmeasured one; (c) behind
`CASTING_CREATIVE_REGISTER_SCOPE` (users:1, parent `CASTING_V2_SCOPE`),
off = absent = byte-identical product.

## 3. The court, refined (executes fable-1660)

Arms, one brief (his cyborg), same seed policy, three renders each:

```
A  his raw prompt verbatim          reproduce the reference frames
B  today's full compile             the product control
C  the creative register (§1b)      the candidate
D  C minus the variance card        isolates the card's cost/benefit
H  an ORDINARY human brief through   register-selection control: must
   the selector                      compile byte-identical to house —
                                     WITH the cyborg through the same
                                     selector as the positive control
                                     (a selector that never routes is
                                     not a control; opus-1276 §4b)
R  C plus the category sentence      owns fable-1644's orphaned question
   (role supplied manually)          — role is NULL on all his live rolls
C' today's blocks kept but BRIEF     separates "our answers are wrong"
                                     from "our answers are too long"
                                     (opus-1276 §4's correction, taken)
W  a THIN brief ("cyber-goth girl    the writer's room arm: 8 authored
   with an eyepatch") through the    concepts vs today's compile of the
   writer's room + creative register same thin brief; judged by his eye —
                                     "can a small prompt get this"
```

Judged: his eye on the strip against the reference standard, plus
per-frame fact checks — jaw plate PRESENT AND PROMINENT, amber eye
GLOWING, porcelain COMMITTED, no unstated beards, build spread not
converged, sex/age/count held (the locks must survive the lean frame),
wardrobe line obeyed, refusal count per arm. Success per fable-1662: C
reaches A's conviction at his eye while keeping sheet structure. If C
falls short, the ablation continues sentence-class by sentence-class —
each removal measured, per fable-1667's burden rules.

## 4. What this does NOT touch

Refine, repaint, sign, ink, segments: untouched — they anchor on
delivered FRAMES, not on roll prompts, so a leaner roll prompt cannot
reach them. The recovery/billing machinery: untouched. The house
register: untouched by construction.

## 5. Sequencing and the Phase-A gate

Court (§3) → creative register built dark → flagged roll of his cyborg
brief → his eye on BOTH bars (conviction + spread). That sheet is the
Phase-A gate (fable-1666, research doc §5b) — and the creative register
is, deliberately, the first seam of the cohort-module architecture the
creative-casts program needs anyway: Phase A's cohort modules are
creative-register variants with their own frames and variance axes.
