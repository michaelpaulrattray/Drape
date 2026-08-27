# The wardrobe picker — taking the boredom clause out

> **Status: design record — build state NOT re-verified in this sweep (#69, 2026-08-28).** And note the author road (PROMPT_AUTHOR_RULING_2026-08-26.md) has since moved how flagged rolls dress a cast; re-derive before building.


**Founder order, relayed fable-1595, verbatim:** *"whats up with the wardrobe
choosing the aboslute lamest uninspired outfits?"* — and the order that came
with it: keep every safety rail (no brands or logos, no props, weapons or
headwear, completeness, the fallback), delete the boredom clause, replace it
with costume-designer direction — *dress THIS person for THEIR shoot; the cyborg
gets matte techwear, the model gets fashion-forward.*

**It was written to decide nothing** — prose for countersign: what the picker
actually does today measured at the rows, what in the prompt does it, the two
taste shapes his open question splits into, a court that can tell them apart,
and the sequencing rule this build inherits. It has since been countersigned,
courted and built, and the sections carry their outcomes where they were
predicted rather than in a summary at the top, so a reader meets each claim
beside what happened to it.

Status: ✅ **COUNTERSIGNED (fable-1609), COURTED (§6.5), AND BUILT IN SHAPE A** —
2026-08-25. What is still open is his taste word: shape B is one paragraph away
and the build is written so swapping it is one constant. It does not block,
because B is the register the court measured reverting to today's answers where
it kept today's examples (§6.6).

---

## 0. The one-paragraph version

The picker is not being cut off and it is not running out of room — it is being
**told to be boring, four times, in a block whose worked examples demonstrate
boredom better than its adjectives instruct it.** Its entire live output is four
rolls, all his, and the word *plain* appears in four of four. The cyborg's pick
shares seven of its twelve tokens with the fallback line it was supposed to
improve on. The repair is a prompt edit inside a block only his account
receives; the risk is that a bolder picker dies at its own 180-character door
and falls back to the house line, which is the complaint reproduced by a
different mechanism and invisible.

---

## 1. What exists today — measured at the rows, 2026-08-25

`scripts/_wardrobe-picker-census-disposable.mts`, production, free, read-only.

```
world: PRODUCTION · hayabusa.proxy.rlwy.net:23768
rolls total: 212
rolls with a PATH: 4  (unpathed: 208)
  path=wardrobe: 4
```

**The picker's entire delivered output, ever.** Four rolls, all user 1, all
within 24 minutes on 2026-08-24, every one case (b) — no brief named an outfit,
so every line is the engine's own pick, and every pick passed the door
(`stored line` equals `intent.wardrobe` on all four).

```
roll 209  Runway model, early 20s, shaved head
          -> "a fitted black turtleneck, slim black trousers, plain black shoes"

roll 210  UGC creator, mid-20s, freckles across the nose
          -> "a plain white t-shirt, straight-leg jeans, plain white sneakers"

roll 211  A skincare founder in his 40s, silver at the temples
          -> "a plain crew-neck sweater, tailored chinos, plain leather shoes"

roll 212  Bald male, mid-40s, pale porcelain skin, heavily weathered ... matte-black
          implant ports embedded in his skull above the right temple, fine metal
          seams running across his scalp like plate joins, a dark mechanical
          plate along his jawline ...
          -> "a plain charcoal grey crew-neck tee, dark straight trousers,
              plain black boots."
```

**Roll 212 is the complaint in one row.** A brief describing an augmented man
with implant ports and plate joins produced *a plain grey tee*.

### 1.1 The numbers, and the first one kills the obvious hypothesis

```
announced word cap        30 words
mean words actually used  10.0        (10, 9, 9, 12)
door cap                  180 chars
longest line written      79 chars    (44% of the door)
"plain" present in        4 of 4 lines, 7 occurrences
```

**Nothing is being truncated and nothing is running out of room.** The picker
spends a third of the budget it is offered and less than half the door it must
clear. This is the same class as `characterNotes`' announced cap and the
opposite mechanism: that sentence rationed **length**, and the model wrote to
the number. This one rations **register**, and the model writes to the adjective.

*An announced adjective is a brief.*

### 1.2 And the fallback is what it converges on

Token overlap between each pick and `HOUSE_WARDROBE_LINE` — the case (c) default
the picker exists to improve on:

```
roll 209   4/10 tokens shared   [a trousers plain shoes]
roll 210   4/9                  [a plain straight-leg]
roll 211   5/9                  [a plain crew-neck shoes]
roll 212   7/12                 [a plain grey crew-neck tee trousers]
```

The cyborg's pick is the house line with a colour word swapped and the boots
changed. The picker is not choosing badly between options; **it is orbiting the
default.**

### 1.3 The honest limit of this reading

n = 4, one account, one hour, four briefs, one model, one prompt. It is not a
rate and it cannot be. What it IS: the complete population — there has never
been a fifth pick — so it is not a sample of the picker's behaviour, it is the
picker's behaviour, and his complaint is about these four rows.

---

## 2. What in the prompt does it — and the boredom clause is not one clause

`WARDROBE_BLOCK`, `server/castingV2/interpreter.ts`. Four instructions and four
worked examples, and they push the same way.

**The instructions:**

1. *"you complete it in the same restrained register"* — case (a), her own words.
2. *"OTHERWISE CHOOSE ONE that matches the kind of person being cast and **stays
   plain**."* — case (b), the picker proper.
3. *"**PLAIN, AND NEVER COSTUME.**"* — heading the safety paragraph.
4. *"A reply that breaks any of those is thrown away whole and the sheet falls
   back to its plain studio clothes, **so keep it simple rather than
   interesting**."*

⚠ **The fourth is the one to read twice.** It joins the SAFETY rails to a TASTE
instruction with a *so*: it tells the model that the way to avoid being refused
is to be uninteresting. The rails are correct and stay. The inference the
sentence invites is the defect, and it is the sentence's own grammar that
invites it.

**The worked examples, which are the stronger instruction:**

```
"a barista in a red apron"      -> "a red apron over a plain white tee, dark
                                    straight jeans, plain low shoes"
a caveman                       -> a one-shoulder hide and bare feet
a surgeon                       -> plain scrubs
"a woman in her 30s"            -> ordinary plain clothes
```

⚠ **A model imitates the SHAPE of a worked example far more reliably than it
obeys an adjective, and three of these four demonstrate exactly the register the
order says to leave behind.** This is the design's central claim and it is a
prediction the court can falsify: **a redesign that rewrites the adjectives and
keeps the examples will change little.** If the court's new-prompt arm comes back
still orbiting the default, the examples are why.

### 2.1 What is NOT causing it, checked rather than assumed

- **Not the door.** All four picks passed; the refusal branch has no production
  specimen at all.
- **Not the caps.** §1.1 — a third of the words, under half the characters.
- **Not the brief.** Roll 212's brief is 553 characters of specific, visual,
  non-generic description. The picker had everything it needed.
- **Not the fallback firing silently.** The stored line equals the interpreter's
  own pick on all four rows, so §4(c) never ran.

---

## 3. What must not move — the rails, enumerated

Everything here is out of scope for this change and each is named so that
"delete the boredom clause" cannot quietly take one with it.

**Code-owned, `server/castingV2/wardrobeDoor.ts` — untouched, not one word:**

```
prop        20 words   held objects; a prop moves the pose, which the frame owns
weapon      19 words   the design's own bound: the caveman gets a hide, not a club
headwear    19 words   the sheet's job is eight faces and their hair
text        19 words   printed text and logos; has already cost this product a roll
brand                  scrubBrands edits rather than refuses — the standing answer
digits                 lettering renders as artefacts
blank / too_long       180 chars, refuses rather than truncating
```

**Prompt-owned and staying, because the door does not cover them:** no setting,
no activity, no pose. `wardrobeDoor.ts` states this limit in its own header —
five reject classes, and a setting inside a wardrobe line would pass. The prompt
sentence is the only wall there is, so it survives the edit verbatim.

**Product-owned and staying:** completeness (top, bottoms, footwear in one
phrase — the sheet is waist-up but the signed views are full length); one outfit
for the whole sheet (§B2's comparability law); the fall back to the house line on
refusal; the *"engine's pick"* label where she reads it (`castingPathCopy.ts`);
Basics is not negotiable by a brief.

### 3.1 The word this change deletes from the safety paragraph, and why that is not a rail

*"PLAIN, AND NEVER COSTUME"* — **`costume` is doing taste work under a safety
word.** Everything the product actually refuses is enumerated above and enforced
in code; *costume* names none of them. Left standing next to a costume-designer
direction it is a block contradicting itself in one breath, which an image model
resolves by picking one, silently — the same defect the *"no jackets"* clause had
to be removed for when a wardrobe line could name a jacket
(`cohortPhotorealHuman.ts`). The rails keep their exact enumerations; the
adjective goes.

### 3.2 The tension with the sheet's own law, stated rather than skated over

`statedWardrobe.ts` says, as law: *"a candidate who only reads through costume
failed the audition"*, and §B2 says a sheet compares people and not clothes.
Read carelessly, his order collides with both.

**It does not, and the reason is structural:** the line is ONE per sheet. All
eight candidates wear the same outfit, so wardrobe cannot differentiate one
candidate from another — the comparability law is about VARIANCE across the
eight, and a single shared in-character outfit contributes none. What his order
changes is what all eight wear together, which is a house-taste decision and his
to make.

---

## 4. His open taste question — the two shapes, as actual prompt text

His question (asked in Fable's channel, still open): **fully in-character, or
elevated neutral?**

### Shape A — IN CHARACTER (recommended)

The picker dresses the person for their own shoot. Replaces instructions 1–4 of
§2 and, critically, **replaces the worked examples too**:

```
  OTHERWISE DRESS THEM FOR THEIR OWN SHOOT. You are the costume designer on this
  job: read who this person is and choose what THEY would wear in front of this
  camera, chosen with taste and specific about fabric, cut and colour.
  A cybernetically augmented man gets matte black technical layers with hard
  seams. A runway model gets something sharp and current with a strong line. A
  caveman gets a rough one-shoulder hide and bare feet. A surgeon gets scrubs in
  their real colour. Someone the brief describes only as "a woman in her 30s"
  has no character to dress, and gets well-cut everyday clothes rather than
  anything loud.
  IF THE BRIEF NAMES AN OUTFIT that outfit is the answer, in their words, and you
  complete it in the register the brief itself set: "a barista in a red apron"
  gives "a red apron over a soft white tee, dark straight jeans, worn leather
  low shoes".
```

Note what the examples now do: the caveman and the surgeon are still the same
answers, said with a fabric and a colour. **The register is carried by the
examples, which is where §2 says the instruction actually lives.**

### Shape B — ELEVATED NEUTRAL

The sheet stays a plain studio sheet; the picker simply chooses the *best* plain
version — considered fabrics, better cuts, a coherent palette, nothing that
reads as character.

```
  OTHERWISE CHOOSE THE BEST PLAIN VERSION for the kind of person being cast:
  quiet, well-cut, specific about fabric and colour, the sort of thing a good
  stylist puts someone in when the clothes are not the point.
```

### Why the recommendation is A

**Shape B is close to what the product already does, and what it already does is
the complaint.** Read the four specimens again: a fitted black turtleneck with
slim black trousers, tailored chinos with leather shoes — those ARE elevated
neutral. He looked at them and called them the lamest uninspired outfits. Shape
B is today's answer with better adjectives; only A answers roll 212.

**Recommended answer to put to him: A**, with §3's rails intact and the
*"costume"* adjective deleted per §3.1. If he prefers B, the build is the same
edit with different example text and the court is unchanged — the two shapes are
one build with one paragraph swapped, which is why this document does not need
his answer to be countersigned.

---

## 5. ⚠ The failure mode of a bolder picker is not a bad outfit — it is the house line

This is the part a reader must not discover later.

A pick that names more fabric, more cut and more colour is a LONGER pick, and
three things sit at the end of that road, all of which end in
`bornWardrobeLine` falling back to `HOUSE_WARDROBE_LINE`:

1. **The 180-character door.** Today's longest line is 79. A line like *"matte
   black technical layers with hard bonded seams, tapered cargo trousers in the
   same black, heavy lug-soled boots"* is 116. Two more clauses and it is
   refused — into the greyest sentence in the product.
2. **The word lists get more pressure, and that is by design of the change.** A
   costume designer reaches for a *badge* (text), a *beret* (headwear), a
   *holster* (weapon), a *toque* (headwear). Each is a correct refusal and each
   costs the whole outfit.
3. **The refusal is invisible.** It logs (`castingIntent.ts`, `log.warn` with
   `reason` and `word`) and **nothing counts it**. There is no counter, no census
   row, no operation, no ledger line. If the new prompt trips the door on one
   pick in four, production would look exactly like production looks now.

**So the design carries one small addition beyond the prompt edit**, and it is
recommended rather than assumed: give the refusal a named token the way the
cohort wall got one (`COHORT_WALL_RETRIED`, `interpreter.ts`), so the count is
one grep and an arm pins it. The two-paths design's own §9 is the argument in
its own words — *a refusal nobody counts is a demand signal thrown away* — and
this is a refusal that silently reinstates the exact defect the change exists to
remove. Cost: one exported constant, one log line already written, one arm.

**And the door cap stays at 180.** Raising it is the tempting repair and the
wrong one: the column is 240, the line is the durable contract six signed views
are composed from and a judge compares against, and the court (§6) measures the
length distribution — if the new prompt pushes lines past ~150 characters
routinely, the answer is to tell the picker to be specific in FEWER clauses, not
to widen a contract every downstream reader depends on.

⚠ **THAT PARAGRAPH IS UNCHANGED AND §5.1 BELOW NARROWS IT, so the two are read
together rather than as a contradiction.** It stands as the rule for *the picker
is writing long lines* — the case it was written about, and the case the court
measured as not happening. §5.1 is a different case that the court's rows turned
up afterwards: **the announced bound and the enforced bound do not agree with
each other**, and that is a defect in the pair rather than a symptom of long
lines. If THAT is what ever has to be fixed, the door is the side that moves,
because the alternative is rationing the register this whole item exists to stop
rationing.

### ⚠ 5.1 THE ANNOUNCED CAP AND THE ENFORCED DOOR DISAGREE, AND THEY ALWAYS HAVE

Found in the court's own rows after the build landed, and it is **not** something
this change introduced — it is true of today's prompt and was true before it.

The block announces the bound in WORDS (*"in one phrase under 30 words"*);
`wardrobeDoor.ts` enforces it in CHARACTERS (`WARDROBE_PICK_MAX` 180). Measured
across the court's thirty picks:

```
CURRENT   6.25 chars per word   ->  a compliant 30-word reply is ~188 chars
A         6.77                  ->  ~203
B         6.51                  ->  ~195
```

**A reply that obeys the announced instruction exactly is refused by the door**,
on every side including the one shipping today. That is the shape the brief
fidelity work named in as many words — *the announced cap and the enforced bound
move TOGETHER* — one field over.

**It has never fired, and the reason is the reason it stayed invisible**: the
picker writes at half its allowance. Observed maxima on shape A are **16 words
of an announced 30 and 112 characters of a 180 door** (131 in the probe). The
headroom shrank from ~2.5x to ~1.9x with this change; it did not close.

**Recommendation: change nothing yet, and name the trigger.** Two reasons.

1. **The obvious repair is a ration.** Lowering the announcement to ~25 words
   would make the two agree, and *an announced cap is a brief* — this document's
   own §1.1. Buying agreement with a smaller number is buying it in the currency
   the whole item exists to stop spending. If anything moves it should be the
   DOOR (180 → 200, still well inside the column's 240), and that is a change to
   a durable contract six signed views are composed from, which deserves its own
   sitting rather than a footnote.
2. **We now have a free instrument where we had none.** `WARDROBE_PICK_REFUSED`
   counts a `too_long` refusal the moment one happens, in production, at no
   cost. A closure whose premise is *"it has never fired"* must name the thing
   that would make it fire, and here that thing announces itself.

**THE TRIGGER: the first `wardrobePickRefused` carrying `reason: "too_long"`
re-opens this, and the answer is the door rather than the announcement.**

---

## 6. The court — text only, no picture, no credits

Both prompts, same tree, same hour, same briefs — the subtract-from-the-same-
reading rule. Harness: `scripts/_brief-fidelity-court-disposable.mts`'s shape,
which already drives `castingBriefCompiler` with a counting engine and stamps
each row with the side it drove.

### 6.1 The briefs

```
1  roll 212's cyborg brief          THE SPECIMEN. His own words, the row that
                                    produced "a plain charcoal grey tee"
2  roll 209 runway model            re-drive of a real pick
3  roll 211 skincare founder        re-drive of a real pick
4  "a woman in her 30s"             NEGATIVE CONTROL — no character to dress;
                                    a bolder picker must not put her in costume
5  a caveman                        the design's own worked bound
6  "a barista in a red apron"       CASE (a) — her words must still win, and the
                                    apron must still be there
7  a chef / a soldier               DOOR BAIT — toque and holster are correct
                                    refusals; this cell measures whether the new
                                    prompt walks into them more often
```

⚠ **THE PRICE IN THIS SECTION WAS WRONG BY 3x AND IS CORRECTED FROM A PROBE
RATHER THAN FROM ARITHMETIC** (2026-08-25, 4 calls, $0.1610).

It read *"3 drives per brief per side = 42 interpreter calls, ~$0.30–0.60 on the
fidelity court's own token arithmetic."* Measured at the provider's own counts:
**8,276 tokens in and 2,370 out per call, $0.04025 a call** — because the figure
carried over from the fidelity court priced the INPUT and assumed ~300 tokens of
output, where the interpreter returns eight `reads` strings and a whole intent,
and output bills at 5x input. The cyborg brief costs ~1.5 calls per drive on top
of that: it trips the `notesOverflow` re-ask and an aesthetic re-sample, both of
which are the product working correctly.

```
the design's shape   8 briefs x 3 sides x 2 drives = 48 calls   $1.93
what runs            5 briefs x 3 sides x 2 drives ≈ 33 calls   $1.33, ceiling $1.50
```

The three dropped cells and why: `runway` and `skincare` are re-drives of picks
**production rows 209 and 211 already witness on the CURRENT side** — the court
would be buying a *before* it already has — and `soldier` is a second door-bait
cell whose class (weapon) is the least likely for a clothing picker to walk into,
where `chef` covers the door question with the class that actually threatens it.

*A bar carried over from a weaker estimator measures the weaker estimator.*

### 6.2 What is measured — and half of it is not about outfits

```
THE OUTFIT       the line itself, per row, for his eye. No model judges taste
THE DOOR         refusal rate and CLASS per side. A rise is expected; the
                 question is how much and whether it is one class
THE LENGTH       chars per line, both sides, against the 180 door — §5's trap
THE OTHER FIELDS ⚠ the non-additive check, and it is the reason this is a court
                 and not a diff
```

**The non-additive check, precisely.** This program has measured that a SUBSET of
prompt context raised the stage wall twice as often as its superset, so a longer
`WARDROBE_BLOCK` is not a free change to the fields around it. Every drive's full
reply is kept and compared side to side on: `cohort` (the wall — a prompt change
that opens or closes the cohort wall is a worse outcome than the defect),
`characterNotes`, `sex`, `ageBand`, `heritage`, `build`. These must not move.
Cell 4 is where a movement would show first.

### 6.3 What this court cannot answer, said out loud

**Whether the image provider's PROMPT content checker refuses more often.** That
needs pictures, and the precedent is real: the Basics neckline trips it on 6 of
24 slices. But that precedent points the other way — it was a BARE SKIN sentence,
and clothing that adds fabric, seams and layers is the opposite direction.

**Recommendation: do not buy a separate image arm.** The exposure reads off the
roll he is going to cast anyway under the flag — a refused slice is visible,
counted and honestly refunded — and buying eight slices to pre-measure a risk
that his own dogfood measures for free is spending for a number he will have in
an hour regardless. If Fable wants it bought, the smallest honest arm is 8 slices
on the boldest line the text court produces; that is a paid arm and it comes back
for its own countersign with a price.

### 6.4 What would overturn the change

- The new side's picks still orbit the house line → §2's example hypothesis is
  right and the examples need to go further, or the model is the limit.
- Any other field moves → the block is too long; the edit is rewritten to be
  length-neutral (delete as many words as it adds) and re-courted.
- The door refusal rate rises past roughly one in four → the rails and the
  direction are fighting; the direction is narrowed to name fabric and cut only,
  never objects.

### ✅ 6.5 THE COURT RAN — 2026-08-25, 34 calls, $0.9900 inside its $1.50 ceiling

Harness `scripts/_wardrobe-picker-court-disposable.mts`; rows and blocks in
`output/wardrobe-picker-court/`. Five briefs × three sides × two drives, one
tree, one hour. **Zero walls, zero door refusals, zero failed drives on any
side.**

```
CURRENT  picks 10 · walls 0 · door refusals 0 · "plain" 8/10 · chars mean 74 max  98
A        picks 10 · walls 0 · door refusals 0 · "plain" 2/10 · chars mean 93 max 112
B        picks 10 · walls 0 · door refusals 0 · "plain" 1/10 · chars mean 88 max 111
```

**The specimen — his own roll 212's brief:**

```
CURRENT  "a fitted black turtleneck, dark tailored trousers, plain black boots"
         "a fitted black crew-neck top, dark plain trousers, plain black boots"
A        "A high-collared matte black technical jacket with fine seamed panels,
          fitted dark trousers, black lace-up boots."
         "Matte black technical jacket with hard structured seams, fitted black
          trousers, black lace-up boots."
B        "A fitted black high-collar jacket over a matching dark shirt, tailored
          black trousers, and black combat boots."
         "a matte black high-collar tactical jacket, fitted dark grey trousers,
          black lace-up combat boots"
```

**✅ The negative control passed.** *"a woman in her 30s"* got a soft crew-neck
tee and well-cut straight-leg trousers under A, a well-cut blouse and tailored
navy trousers under B. **Nobody put her in costume.**

**✅ Case (a) held on all six drives.** The apron survived every side; her words
won every time.

**✅ The door was never touched — including the bait cell.** `chef` produced
double-breasted whites, checked trousers, clogs and non-slip kitchen shoes on
every side and **never a toque**. Ruling 1609.2's condition — *come back before
any build if shape A trips the door materially* — **did not fire.**

**✅ The non-additive check is clean.** `cohort`, `sex`, `ageBand` and `build`
are IDENTICAL across all three sides on all five briefs; `characterNotes`
lengths move by at most 7 characters on the cyborg (177/177 → 176/176 → 170/172)
and are unchanged elsewhere. **No side walled a single drive.**

**⚠ And §5's trap did not bite in this sample, which is not the same as being
gone.** Longest line anywhere: 112 characters here, **131 in the earlier probe**
— 73% of the 180-character door, on the brief most likely to produce a long one.
The counter (§5) is what makes the next hundred readable.

### ✅ 6.6 THE VERDICT — shape A, and §2's central claim is what decided it

The two shapes are closer than this document predicted: B is nearly as specific
as A on the cyborg, because *"specific about fabric and colour"* does most of
the work on a brief with a strong character. **What separates them is exactly
the thing §2 said would**:

```
caveman   B's two drives are BYTE-IDENTICAL to a CURRENT drive — twice
          A's two drives are not, either time
          (every other brief: 0 of 2 identical, on both shapes)
```

**B kept CURRENT's caveman example, and B reproduced CURRENT's caveman output
exactly.** That is §2's falsifiable claim landing on the nose: *a model imitates
the shape of a worked example more reliably than it obeys an adjective.* Where B
supplies the old example it supplies the old answer; where A replaces it, the
answer moves.

So the recommendation stands and is now measured rather than argued: **ship
shape A.** B is one paragraph away if his taste word says otherwise, and the
build is written so that swapping it is one constant.

---

## 7. Sequencing — and why this one is not the base prompt

§10.5's rule stands: prompt changes land one at a time, each behind its own
court, because two of them sharing an uncourted tree is the interleaving this
program refuses.

**But `WARDROBE_BLOCK` is inside `CASTING_TWO_PATHS_SCOPE`, which is `users:1` on
production.** Outside that flag the bytes on the wire are byte-identical either
way. So this change's blast radius is his account, its population is the four
rolls above, and it cannot touch the other 208.

The concrete rule this build follows:

```
may land       any time after its own text court closes, while
               CASTING_FRAMING_TRIM_SCOPE is off — the framing retarget is a
               different flag, currently off, so nothing interleaves
must not land  in the same window as a framing-retarget flip on his account.
               If the retarget flips first, this waits behind its gate
must not land  ahead of its court, in either shape
```

Stack position, unchanged from fable-1595 and updated for what has since landed:
framing retarget (court + build, his gate) → 3c lane build → **wardrobe picker
build** → cap court. Text stages of any of them may run whenever a tree is quiet;
this document is one of those text stages.

---

## 8. What this design does not do

- **It does not touch case (c).** `HOUSE_WARDROBE_LINE` is today's picture and
  stays exactly as written; it is the fallback and the unpathed answer.
- **It does not touch Basics.** The path IS the outfit and a brief does not
  negotiate it; the lowered neckline is a founder decision on a measurement and
  is not reopened here.
- **It does not add a sixth door class.** Setting and activity remain
  prompt-walled only — `wardrobeDoor.ts`'s stated limit — and adding a list
  quietly is a design change wearing a diff. Still filed, still open.
- **It does not raise either cap.** 30 announced words, 180 door characters. §5
  — and §5.1, which found after the build that those two numbers have never
  agreed with each other on ANY side of the court, including today's shipped
  prompt. Still not raised here; parked on a named trigger rather than closed.
- **It does not change any customer-visible copy.** The *"engine's pick"* label,
  the sheet notice and the path toggle are untouched.
- **It does not change what happens to a brief that names an outfit.** Case (a)
  still wins; only the register its completion is written in moves.

---

## 9. The build — ✅ LANDED 2026-08-25, `98c06ec0`

One commit, behind its court, exactly as listed:

```
1  WARDROBE_BLOCK rewritten     instructions 1-4 and the worked examples, in the
                                shape he picks (§4). The rails' enumerations
                                copied across character for character
2  "costume" deleted            §3.1 — the adjective, not the enumerations
3  the refusal token            WARDROBE_PICK_REFUSED, COHORT_WALL_RETRIED's
                                shape, at the log line that already exists
4  arms                         the block still contains every rail word (an arm
                                that reddens if an enumeration is lost in the
                                rewrite); the door suite unchanged and still
                                green; the refusal token pinned; the unflagged
                                prompt still byte-identical
```

The fourth is the one that matters most: **the rewrite is the exact operation
that could drop a rail by accident**, and an arm asserting the enumerations
survive the edit is cheaper than finding out at a paid roll.

---

## 10. What needs a word

✅ **FABLE'S ITEMS ARE ALL ANSWERED AND ALL SHIPPED** (fable-1609/1610/1611):
the design countersigned, the refusal token BUILT in the same commit, the image
arm NOT bought, the trimmed court GO at $1.50 and run at $0.9900, and the result
accepted with shape A in.

```
FOUNDER    his taste answer — Shape A or Shape B (§4). Recommended: A, and the
           court has since made that a measurement rather than an argument
           (§6.6). ⚠ It does NOT block and it never did: A is what shipped, so
           he is answering from his own frames rather than in the abstract, and
           B is one paragraph away with the court's rows on disk
OPEN, HIS  the wider board's items, neither of them this design's: stage 3's
           flip-and-roll, and the framing retarget behind it
```

⚠ **AND ONE THING IS PARKED ON AN INSTRUMENT RATHER THAN ON A PERSON** — §5.1's
bounds disagreement. Its trigger is `wardrobePickRefused` with `reason:
"too_long"`, which production will announce for free the first time it happens.
Nobody has to remember to look.
