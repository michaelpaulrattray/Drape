# THE OUTFIT COURT — can Sunburst invent the outfit the anchor cannot show better than Nano Banana Pro?

**Card #1451. His order, 2026-09-27 (terminal), verbatim and entire:**

> *"actually i want one more test and use one of my more creative casts for it.
> test NBP and sunburst high on outfit creation. meaning sunburst might invent
> the outfit it cant see better then NBP can"*

Said minutes after *"keep NBP 2k for signing views"* (#1394 — his eye on those
frames: Nano Banana Pro *"more organic"*, Sunburst high *"too smoothed out"*).
**That ruling stands PROVISIONALLY until these frames are in front of him.**

⚠ **THIS DOCUMENT RETURNS NO VERDICT ON WHICH ENGINE DRESSES HER BETTER** —
working law 9, his eyes are king. It carries the numbers, the prose two readers
wrote, the controls those readers passed, and the keys of the frames his Desk
shows him. **No Sign-engine change is built either way until his word after
this.**

---

## Why #1394 could not answer this

That court's third axis is *"the SAME outfit the reference photograph shows"* —
agreement with what is VISIBLE. And the anchor is a chest-up photograph, so on
the four views that show a whole body most of the outfit is not in the reference
at all. The spec says so itself, in as many words: *"anything below the frame of
the reference CANNOT be compared to it and must not fail this check."*

His hypothesis lives exactly in that silence. A signed view the anchor cannot
show — the back, the two profiles, the full-length front — has to **invent** the
rest: the back of a garment, the fall of a hem, the shoes. #1394 scored agreement
and said nothing about invention.

---

## Fixtures — ONE cast, his own, read out of PRODUCTION read-only

He said *"one of my more creative casts"* and named none on the card, so the seat
read his signed casts on production read-only and chose. **Five signed casts
belong to user 1**; the choice and its reasoning were posted on #1451 **before a
cent was spent.**

| cast | the wardrobe its brief describes |
|---|---|
| #52 Shina | *"miu miu styled glasses"* — an accessory, no outfit |
| #53 Jericho | *"a skincare founder in his 40s, silver at the temples"* — no outfit, and already in #1394's record |
| **#55 Sifr** ← chosen | ***"She wears a white, body-conscious dress that mixes qipao structure with industrial straps, buckles, and a worn graphic on the chest, leaving the exact cut, hardware, and weathering open."*** |
| #56 Sifr2 | *"She dresses sharp and a little worn, between Eastern tailoring and tactical gear"* — a register, not a garment |
| #57 Yimi | the same brief as #56, word for word |

**Sifr, for three reasons and the third is the strongest:**

1. It is the only one of the five whose brief describes an actual **garment**.
2. Its wardrobe sentence **deliberately leaves the cut, the hardware and the
   weathering open** — which is this court's question, in his own words, on his
   own cast.
3. **It is the cast his own defect report was about.** #1207, verbatim: *"my sifr
   cast closeup rendered correctly full frontal rendered incorrect she is wearing
   pants and shoes these dont match her described outfit at all in the brief."*

Read at the rows (`hayabusa.proxy.rlwy.net:23768/railway`, `SELECT` only):

| | |
|---|---|
| cast | model **#55 "Sifr"**, user 1, active, `sourceCandidateId` 2398, `sourceRollId` 300 |
| anchor | `model_assets` #313 — the 1K `frontClose` whose provenance carries `identityRole: "anchor"`, i.e. the same row the product's own Try again reader takes, **1024×1536** |
| stored wardrobe line | **none.** `technicalSchema.wardrobe.line` is `null`, so `castWardrobeLine` returns `null` |
| brief | 626 characters, quoted in full in the prompts artifact |

### What the court sends her is byte-identical to what a real retried view sends — measured, not assumed

A real Sign appends two further clauses to the composed prompt
(`packageOrchestrator.ts`): her delivered ink crops, and her carried feature
words. Both compose to the empty string for this cast, and the reason is in the
rows and in the code rather than in anyone's memory:

- `casting_ink_delivery_crops` holds **0 rows, all time, in production** — no
  cast in this product has delivered ink, so the ink clause is empty for every
  Cast including this one.
- Her candidate carries **one** reference-library row, `bornInk:arms`, and
  `viewFeatureWords.ts:246` declines **every** born-ink slot with
  `markingDiscloses`. So the words clause is empty too.
- With a brief on record and no stored line, both the generator and the judge
  read `CAST_PACKAGE_WARDROBE_SPEC_DESCRIBED` — the half of #1278 part 1 where
  *"below its frame the description governs"*.

**So the one string this court composes per view is the string a real Try again
composes.** It is on disk rather than described:
`output/1451-outfit-court/sifr/outfit/prompts.json`, written by the driver on a
dry run as well as a paid one (working law 5 — the contract is proven on the
outgoing request).

---

## The four views, and the two that are this court's own ask

The close-up is excluded: it invents nothing.

| court view | how it is asked | judged against | angle axis trustworthy? |
|---|---|---|---|
| `frontFull` | `composePackageViewPrompt("frontFull", …)` **unchanged** | `frontFull` | **yes** |
| `leftProfileFull` | the `frontFull` prompt **plus one TURN clause** | `sideClose` | **no — see below** |
| `rightProfileFull` | the same, mirrored | `sideClose` | **no** |
| `backFull` | `composePackageViewPrompt("backFull", …)` **unchanged** | `backFull` | **yes** |

⚠ **THE TWO PROFILES ARE NOT THE PACKAGE'S OWN AND THE REASON IS IN THE CODE.**
`sideClose`'s spec is *"a head-and-shoulders TRUE side profile"* and its
directive says *"Head and shoulders only"* — it shows no outfit below the chest,
so it cannot carry an outfit-invention question at all; and it names only the
RIGHT edge, so it has no left twin. This court therefore asks for a **full-length**
profile, built from the package's own `frontFull` prompt with one appended TURN
clause. That clause is authored here and is **declared** rather than passed off as
the product's, on the precedent already inside the same driver: #1394's
`sheetPrompt` adds its four-column instruction to the same base for the same
reason.

⚠ **The clause says out loud that it overrides the line above it.** The base
reads *"stands square to camera"*; a turn appended without saying so is a prompt
that contradicts its own earlier sentence and leaves the engine to choose. The
sheet arm got away with an implicit override because its layout clause was
obviously later and more specific; a single figure gets no such help.

⚠ **THE SIDES ARE NAMED BY THE FRAME'S EDGE, NEVER BY HER ANATOMY.** That is the
package's own craft (*"the subject's nose points toward the RIGHT EDGE OF THE
OUTPUT FRAME"*) and this repository's own measurement — an anatomy-relative side
ask lands on the image half about as often as not. So `leftProfileFull` means
*her nose points at the frame's left edge*, and that is what the reader is asked
and what every caption says.

⚠ **AND THAT MAKES THE PRODUCT'S ANGLE AXIS UNTRUSTWORTHY ON HALF THE VIEWS.**
The profiles are judged against `sideClose`'s spec, which asks for the true 90°
turn this court wants read **and** for a head-and-shoulders framing this court
deliberately widened, so an angle FAIL there is this court's own framing
mismatch and not a fact about either engine. Every row carries
`angleAxisTrustworthy` and the per-arm angle rate below counts **only** the front
and the back. #1394's sheet arm declared the same limit about its middle two
columns — and it left half the views with no honest angle reading, which is why
the court grew a second instrument.

---

## THE INSTRUMENTS, AND THEIR CONTROLS RAN FIRST (working law 2)

### The turn reader — a court-owned instrument, and it had to be

The product has no conformance reading for a view the product does not promise.
So one question is asked of every profile render, with no reference beside it:
*is this a TRUE ninety-degree profile, and if so which edge of the frame does the
nose point at?* That is what makes an off-angle profile legible as off-angle
rather than as an outfit finding — the thing the card asked the three-axis judge
for and the thing the three-axis judge cannot give here.

**Its three controls cost no renders: every frame is a picture he has already
paid for** — Sifr's own delivered package views, out of the production bucket.
They run inside the paid phase, before the first render, so no flag can skip
them.

| # | frame | what it must read | it read | the reader's own words |
|---|---|---|---|---|
| 1 | her delivered **`frontFull`** view, as served | `profile: false` | **`false`, edge `neither`** — as required | *"The person faces directly toward the camera with both eyes visible."* |
| 2 | her delivered **`sideClose`** view, as served | `profile: true` | **`true`, edge `right`** — as required | *"…a true side profile with only one eye and ear visible, facing toward the right edge of the image."* |
| 3 | **the same frame, flipped horizontally** | `profile: true` **and the OPPOSITE edge** | **`true`, edge `left`** — as required | *"…a true side profile with one eye and one ear visible, facing toward the left edge of the image."* |

**All three pass, and they passed independently in BOTH processes.** The court ran
as two processes, one per arm, and each took its own controls before its own first
render — six readings, six as required.

**Both halves of the reader are controlled separately and could have failed
separately.** Control 1 failing would have struck every profile angle reading;
control 3 failing would have struck only the left/right half while leaving
presence standing. A single pass/fail over an instrument that answers two
questions is how a half-blind reader keeps a whole reputation.

### The outfit reader — the card's own question, prose only

One reading per render, the anchor and the render side by side, four prose
fields and **no score and no boolean**:

> *describe the outfit in this picture; does it agree with the visible half of
> the anchor's outfit; does it agree with the wardrobe line; what did it add that
> neither shows?*

⚠ **"The wardrobe line" is the BRIEF on this cast, and the row says so.** Her
stored `wardrobe.line` is `null`, and so is every one of his five signed casts'
— #55, #56 and #57 carry a `wardrobe` block whose `line` is `null`; #52 and #53
carry no `wardrobe` block at all, and `castWardrobeLine` answers `null` to both
shapes. So there is no line to quote and the only record of her clothes is the
brief,
which is exactly what the product itself hands its judge as `description`.
Cutting a wardrobe sentence out of the brief by hand would be an authored
extraction standing in for a field, so the whole record goes across and every row
carries `wardrobeRecordSource: "brief"`.

### The product's own three-axis judge

Unchanged from #1394, including its downscale: `viewConformance` posts frames at
full resolution and OpenRouter answers 400 to a Sunburst-sized one, so every arm
is judged through the same 1,568-px longest-edge copy. **Identical for both
arms**, which is what keeps them comparable; it is not what a Sign does today and
that deviation is #1394's, declared there.

---

## THE RESULTS

### The renders — 24 of 24 arrived, and neither engine refused anything

| arm | renders | refusals | identity | angle (front/back only) | wardrobe | mean s | p95 s | MB | pixels | $/picture | $ total |
|---|---|---|---|---|---|---|---|---|---|---|---|
| today (2K) | 12 | 0 | 12/12 (100%) | 6/6 (100%) | 12/12 (100%) | 29.0 | 37.6 | 5.0 | 1696x2528 | $0.15 | $1.80 |
| Sunburst high | 12 | 0 | 12/12 (100%) | 6/6 (100%) | 12/12 (100%) | 52.1 | 65.5 | 9.4 | 2352x3504 | $0.14 | $1.68 |

**Both arms held identity, wardrobe and angle on every frame.** The product's own
judge failed nothing, which is worth saying plainly rather than skipping past:
**neither engine produced an off-angle or a wrong-person frame for the outfit
question to be confused with.** That is exactly the job the card gave this axis,
and it did it by coming back clean.

⚠ **Sunburst refused nothing here, and #1394 measured seven `content_policy_violation`
refusals — six of them on the caveman and one on the basics cast, none from Nano
Banana Pro on the same words.** Those asks were an animal-hide wrap and a
loincloth; this cast is a dressed woman and the same door took every ask. **One
cast is not a refusal rate** — it is one more data point on an engine whose content
checker has already fired in this programme.

⚠ **AND THE ANGLE AXIS DID NOT BITE ON THE PROFILES AFTER ALL.** The caution above
said an angle FAIL on a profile would be this court's own framing mismatch. In the
event the judge passed the profiles 3/3 on both arms against `sideClose`'s
head-and-shoulders spec. **The caution stands as a stated limit rather than a
measured cost** — and the headline rate in the table still counts only the front
and the back, because a rate including an axis this court knowingly widened would
be quoted later by somebody who had not read this paragraph.

### The turn reader on the two profiles — 12 of 12 are true profiles, 11 of 12 face the asked edge

| view | arm | draw | a true 90° profile? | nose at which frame edge? | the reader's own words |
|---|---|---|---|---|---|
| leftProfileFull | today (2K) | 1 | yes | left | The woman is shown in a true side profile with her nose pointing toward the left edge of the image. |
| leftProfileFull | today (2K) | 2 | yes | right | The woman is shown in a full side profile with only one eye and ear visible, facing toward the right edge of the image. |
| leftProfileFull | today (2K) | 3 | yes | left | The person is shown in a true side profile with only one eye visible, facing toward the left edge of the image. |
| rightProfileFull | today (2K) | 1 | yes | right | The woman stands in full side profile with only one eye visible, facing toward the right edge of the image. |
| rightProfileFull | today (2K) | 2 | yes | right | The person stands in full side profile with one visible eye and ear, facing toward the right edge of the image. |
| rightProfileFull | today (2K) | 3 | yes | right | The person is shown in a full side profile with only one eye and ear visible, facing toward the right edge of the image. |
| leftProfileFull | Sunburst high | 1 | yes | left | The person is shown in a true side profile with only one eye visible, facing toward the left edge of the image. |
| leftProfileFull | Sunburst high | 2 | yes | left | A true side profile view with the woman's nose and body pointing toward the left edge of the image. |
| leftProfileFull | Sunburst high | 3 | yes | left | The woman stands in full side profile with only one eye and ear visible, facing toward the left edge of the image. |
| rightProfileFull | Sunburst high | 1 | yes | right | The woman stands in full side profile with her body and face turned toward the right edge of the image. |
| rightProfileFull | Sunburst high | 2 | yes | right | The woman is shown in a full side profile facing the right edge of the image, with only one eye and ear visible. |
| rightProfileFull | Sunburst high | 3 | yes | right | The woman stands in full side profile with only one eye visible, facing toward the right edge of the image. |

**The one disagreement is `leftProfileFull`, today (2K), draw 2**, which the reader
called `right` where the ask said left. ⚠ **It is recorded as the reader's answer
and NOT as a finding about the engine** — that is not a call a reader gets to close
(law 9). The frame is the third panel of the left-profile sheet and his eye settles
it. On this seat's own look at that sheet all six left-profile panels face the same
way; **that is an observation, not his verdict.**

### Latency, per view

| view | today (2K) mean s | Sunburst high mean s |
|---|---|---|
| `frontFull` | 27.7 | 49.1 |
| `leftProfileFull` | 31.2 | 50.8 |
| `rightProfileFull` | 28.9 | 56.5 |
| `backFull` | 28.2 | 52.0 |

**Sunburst high takes about 1.8x as long per picture for about the same money.** At
a five-view Sign rendered three at a time that is two waves either way: about 58 s
on today's engine against about 104 s — #1394's own figures, re-measured here on a
different cast and landing in the same place.

### The spend, measured at the provider's own balance

| | |
|---|---|
| fal balance before | **$25.11** |
| fal balance after | **$21.68** |
| **measured delta** | **$3.43** for 24 renders |
| estimate posted on the card before the run | $3.48 |

⚠ **Two honest qualifications on that number.** First, these are **single reads,
not settled reads** — #1394's price phase takes two consecutive equal readings
either side and this run did not, so $3.43 is a window rather than a settled
measurement. The direction FELL, so no top-up masked it. Second, **the two text
readers bill on OpenRouter and are outside this window entirely**; their token
usage was returned by the reader and never written into the rows, which is a gap
in this court's own instrument. It is **fixed in the driver rather than estimated
here**, and the fix is declared below.

Taking Nano Banana Pro's published $0.15 as given, the residue puts Sunburst's edit
at about **$0.136 a picture at 2352x3504** — consistent with #1394's own n=1
measurement of $0.14, and stated as arithmetic rather than as a second measurement.

### Every render, as a reader described it — prose, no score

⚠ **This is the section the card asked for, and it is the section that is not a
verdict.** Twenty-four readings, the anchor and the render side by side each time,
her brief handed across as the written record of what she wears. Read them beside
the frames.

### frontFull — today (2K), draw 1

- **the outfit:** The woman wears a sleeveless, high-collared white mini dress with a stand collar and zip front, its fabric heavily stained with grey-black smudges and marbled dark patterning across the chest; over it sits a harness-like arrangement of buckled straps running from the shoulders down to the hips, with metal hardware at the shoulder yokes and hip tabs. The dress is short, ending well above the knee, fitted through the torso and hips, and paired with chunky white platform combat boots that have metal disc hardware, buckles, and lacing, also weathered with dark grime and scuffing.
- **against the anchor's visible half:** It agrees closely with IMAGE 1: the same stand collar, front zip, buckled shoulder straps, and dark marbled staining across the chest are all visible in both, and the tattooed arm matches in placement and density. IMAGE 1 shows nothing below the chest, so the mini-dress length, hip hardware, and boots cannot be confirmed or denied by it, but nothing contradicts it.
- **against her written record:** It agrees well with the written record: a pale, androgynous look, short messy silver-grey hair, heavy black eye makeup, a white body-conscious dress with straps and buckles and a worn/weathered graphic on the chest, and dense tattoos on one arm are all present. The qipao-style collar is consistent with the record's 'qipao structure' description, though the record leaves cut and hardware open, which this image simply specifies further.
- **added by neither:** The white platform combat boots with metal disc and buckle hardware, the earrings, and the visible neck tattoo are shown in IMAGE 2 but not described in the written record or visible in IMAGE 1.

### frontFull — today (2K), draw 2

- **the outfit:** She wears a floor-length, off-white qipao-inspired dress with a high mandarin collar and front zip, marbled with grey-black staining/weathering throughout; the bodice has cutout shoulders with buckled straps crossing over it, and the skirt is long and column-fitted with a front slit and an asymmetric buckled strap wrapping the hip, ending mid-calf on one side. On her feet are black lace-up combat boots with chunky soles, worn and scuffed, completing a rough, lived-in industrial look.
- **against the anchor's visible half:** It agrees closely: the same high-collar zip-front bodice, the buckled shoulder straps, and the marbled grey staining on white fabric all match IMAGE 1 exactly, as does the tattooed arm and silver-grey hair. IMAGE 2 simply reveals more — the full skirt, slit, hip strap, and boots — that IMAGE 1's chest-level crop did not show.
- **against her written record:** It agrees well: the pale androgynous look, silver-grey messy hair, heavy dark makeup, white qipao-structured dress with industrial straps/buckles and a worn graphic on the chest, and dense tattoos on one arm all match the written record. The record leaves footwear and exact skirt cut open, and here that is filled in with a slit maxi skirt and black combat boots, which does not contradict anything stated.
- **added by neither:** The multiple small hoop earrings, the specific dragon/floral tattoo imagery on the arm, and the black lace-up combat boots are visible in IMAGE 2 but are not shown in IMAGE 1 nor named in the written record.

### frontFull — today (2K), draw 3

- **the outfit:** She wears a sleeveless, high-collared white dress with a fitted bodice and a straight midi-length skirt slit up the front on one side, the fabric heavily distressed with grey-black staining and a smudged graphic across the chest. Metal buckle straps run over the shoulders and cinch around the waist and hips, matching heavy silver hardware at the collar zip, and she wears chunky lace-up white platform boots with buckled straps, all in the same worn, dirtied finish as the dress.
- **against the anchor's visible half:** It agrees closely: the same high collar with metal clasp, the buckled shoulder straps, the smudged chest graphic, the worn white fabric with grey-black staining, and the tattooed arm and shoulder all match IMAGE 1 exactly where it is visible.
- **against her written record:** It agrees well — the white, body-conscious dress with industrial straps and buckles, worn graphic on the chest, dense tattoos on one arm, silver-grey messy hair, and heavy black makeup all match the written record; the record's mention of qipao structure is only loosely reflected in the standing collar and slit skirt.
- **added by neither:** The full-length view reveals a hip-level double buckle strap detail, a thigh-high front slit in the skirt, additional tattoos extending down both legs, and white lace-up platform boots, none of which are shown in IMAGE 1 or described in the written record.

### leftProfileFull — today (2K), draw 1

- **the outfit:** In profile, she wears a sleeveless, high-necked white mini dress with a fitted bodice and short skirt, heavily distressed with grey-black staining and streaks throughout; a buckled strap crosses the torso and connects down to a garter-like leg strap with metal hardware looping around the upper thigh. On her feet are dark brown lace-up combat boots with side buckle straps and thick lug soles, worn and utilitarian in contrast to the pristine-cut but visually soiled dress.
- **against the anchor's visible half:** The high collar, sleeveless cut, buckle hardware, and the mottled dark staining on white fabric all match IMAGE 1's chest-level view exactly, as does the tattooed arm and silver-grey messy hair. IMAGE 2 adds the skirt length, leg strap, and boots that IMAGE 1's crop simply doesn't reach, so nothing contradicts.
- **against her written record:** This agrees with the written record's white, body-conscious dress with industrial straps and buckles, worn/weathered look, silver-grey messy hair, and tattooed arm. It does not clearly show qipao structure or a distinct chest graphic (obscured by staining), and the described 'elegant or damaged' makeup isn't visible in this angle.
- **added by neither:** The dark brown lace-up combat boots with buckle straps and the specific garter-strap detail running down to the thigh are visible here but not described in the written record or shown in IMAGE 1.

### leftProfileFull — today (2K), draw 2

- **the outfit:** She wears a long, ankle-length white qipao-style dress with a high mandarin collar, sleeveless cut, and a front slit that runs up past the knee, the fabric heavily distressed with grey-black staining and grime throughout. Metal buckle straps run over the shoulder and down the side of the dress with hook-and-clasp hardware, and she wears heavy lace-up combat boots in a worn grey-brown tone with a strap across the ankle.
- **against the anchor's visible half:** The high collar, shoulder straps with buckle hardware, and the dirtied, distressed white fabric all match what IMAGE 1 shows at the chest and shoulders. IMAGE 1 does not show the length, slit, or footwear, so those cannot be confirmed or denied, but nothing visible contradicts it.
- **against her written record:** This agrees with the written record's white, body-conscious qipao-inspired dress with industrial straps and buckles, worn/weathered look, and dense tattoos on one arm. The chest graphic in IMAGE 1 is present as a dark, worn mark, consistent with the record's 'worn graphic on the chest.'
- **added by neither:** The specific ankle-length hem with a thigh-high side slit and the grey lace-up combat boots are visible in IMAGE 2 but are not described in the written record or shown in IMAGE 1.

### leftProfileFull — today (2K), draw 3

- **the outfit:** In IMAGE 2 she wears a fitted, sleeveless white mini-dress with a high stand collar, front zip, and a mottled grey-black weathered or stained pattern across the fabric; small metal buckle-strap details run down the side seams. The hem falls mid-thigh with a torn or frayed loop hanging loose near the bottom, and she wears heavy black lace-up combat boots with straps and buckles, looking worn and scuffed at the soles and toes.
- **against the anchor's visible half:** The dress in IMAGE 2 matches IMAGE 1's high collar with front clasp/zip, the white body-conscious fabric, the dark mottled staining pattern, and the strap-and-buckle hardware crossing the chest — all consistent between the two images. IMAGE 1 shows more visible harness straps over the shoulders and chest than are clearly distinguished in the side profile of IMAGE 2, though this may just be the camera angle.
- **against her written record:** This agrees with the written record's white, body-conscious dress with industrial straps and buckles and a worn, weathered look, and the qipao-like standing collar is present as described. The 'worn graphic on the chest' is less distinct here, reading more as staining than a clear graphic, and the boots and full tattoo extent are not detailed in the record beyond 'dense tattoos on one arm.'
- **added by neither:** The black lace-up combat boots with buckles are not shown in IMAGE 1 (cropped at chest) nor mentioned in the written record.

### rightProfileFull — today (2K), draw 1

- **the outfit:** In profile, she wears a sleeveless, high-necked, form-fitting white dress with a mandarin collar and front closures, its fabric heavily streaked and stained with grey-black dirt or ink-like blotches; a wide strap over the shoulder connects to a large curved flap or pouch of the same fabric hanging at the hip, fastened with buckled straps. The dress falls to mid-calf, and she wears heavily worn, dark lace-up combat boots that reach above the ankle.
- **against the anchor's visible half:** It agrees on the sleeveless white dress with a high mandarin collar, buckled straps at the shoulder, heavy dirt/stain weathering, the tattooed arm, and the silver-grey messy hair — all consistent with IMAGE 1's cropped chest view. IMAGE 2 adds the skirt length, hip pouch, and boots that IMAGE 1 does not show, but nothing visibly contradicts the anchor.
- **against her written record:** It agrees with the written record's description of a pale androgynous cyberpunk woman with short messy silver-grey hair, a white body-conscious dress with industrial straps and buckles and worn/weathered graphic textures, and dense tattoos on one arm. The record does not specifically mention the qipao-style structure's mid-calf skirt length, the hip pouch, or the combat boots, though these do not contradict its open-ended description.
- **added by neither:** The heavy lace-up combat boots and the hanging hip pouch/flap attached by straps are visible in IMAGE 2 but are not described in the written record or shown in IMAGE 1.

### rightProfileFull — today (2K), draw 2

- **the outfit:** In IMAGE 2 she wears a sleeveless, high-necked white dress that runs full-length to the ankle, cut close to the body with a mermaid-like flare below the hip, its fabric heavily mottled and streaked with grey-black dirt or dye throughout. Metal-buckled straps run over the shoulders and cinch at the waist and thigh with small hanging strap-ends, and she pairs it with chunky black lace-up combat boots featuring side buckles, the whole look reading as worn, weathered, and utilitarian rather than pristine.
- **against the anchor's visible half:** It agrees strongly: the same white high-collar dress with front zipper/clasp closure, the same buckled shoulder straps, the same dark mottled staining on the fabric, and the same tattooed arm and silver-grey messy hair are all present in both images. Nothing in IMAGE 2 contradicts what IMAGE 1 shows, since IMAGE 1 only covers the chest and up.
- **against her written record:** It largely agrees: the pale androgynous look, silver-grey messy hair, heavy dark eye makeup, white body-conscious dress with industrial straps and buckles, a worn/weathered chest graphic, and dense tattoos on one arm are all consistent with the written record. The dress's qipao-like high collar and structure also matches, though the record leaves the exact length and hardware open, and here it is rendered as a full ankle-length gown rather than a shorter cut.
- **added by neither:** The black lace-up combat boots with side buckles are visible in IMAGE 2 but are not shown in IMAGE 1 (cropped at chest) nor mentioned in the written record.

### rightProfileFull — today (2K), draw 3

- **the outfit:** In profile, she wears a sleeveless, high-necked white dress with a mock collar and mandarin closure at the throat, its fabric mottled and stained with grey-brown patches suggesting heavy weathering; the bodice has a fitted, structured cut with metal buckle-strap details at the shoulder, transitioning into a longer, straight midi-length skirt with a large flap pocket and buckle hardware at the hip. She wears heavy black lace-up combat boots with buckle straps at the ankle and calf, worn-looking with a thick tread sole, and no other visible accessories on the legs or feet.
- **against the anchor's visible half:** The white dress with its distressed, stained texture, the mandarin collar, and the buckle-strap hardware at the shoulder all match what IMAGE 1 shows at the chest and collar; the visible sleeve tattoo also continues consistently onto the same arm. IMAGE 2 adds the skirt length, pocket, hip hardware, and boots, none of which contradict IMAGE 1 since that photo simply doesn't extend low enough to confirm or deny them.
- **against her written record:** This agrees with the written record's white, body-conscious dress mixing structured lines with industrial straps and buckles, the worn/weathered surface, the dense tattoo sleeve on one arm, and the short silver-grey hair; the qipao-style standing collar is also present. The record's 'worn graphic on the chest' is not clearly visible in this side profile, though the general stained texture is consistent with it.
- **added by neither:** The specific skirt-length cut with a large hip pocket and cargo-style flap, along with the black lace-up combat boots with ankle and calf buckles, are shown here but not described in the written record or visible in IMAGE 1.

### backFull — today (2K), draw 1

- **the outfit:** Seen from behind, she wears a sleeveless, high-collared white dress in a mottled, dirt-stained fabric, cinched at the waist with a fitted bodice that closes via a row of metal buckle clasps down the spine, and cross-back straps looping over the shoulders. The skirt is short and asymmetric, with an angled hemline and dangling straps/buckles hanging loose at the hip and thigh, worn over black chunky lace-and-buckle combat boots with visible platform soles; the fabric overall looks heavily weathered and soiled rather than pristine.
- **against the anchor's visible half:** It agrees strongly: the same white buckled harness-dress bodice, high collar, cross-back/shoulder straps, worn and stained fabric, silver-grey messy hair, and the sleeve of dense tattoo work on one arm all match IMAGE 1's chest-up view. IMAGE 1 shows no skirt or footwear, so those elements cannot be confirmed or denied by the anchor, but nothing visible contradicts it.
- **against her written record:** It agrees well: the pale, androgynous cyberpunk look, short messy silver hair, industrial straps and buckles, worn/dirty white qipao-influenced garment, and dense tattooing on one arm are all present as described. The written record doesn't specify boots or a skirt shape, so the asymmetric mini-skirt and black buckled boots are consistent additions rather than contradictions.
- **added by neither:** The specific black buckled combat boots with platform soles, and the asymmetric, strap-draped cut of the skirt portion, are shown here but not described in the written record or visible in the cropped reference image.

### backFull — today (2K), draw 2

- **the outfit:** Seen from behind, she wears a sleeveless, high-necked white dress in a stained, weathered fabric, fitted through the torso and falling to a knee-length pencil skirt, with a full back-zip closure, buckled shoulder straps, and several small buckled tabs and pocket-like panels at the hips and lower back. On her feet are chunky, dark grey-black lace-up combat/platform boots with buckle straps and worn, scuffed metal-toned finishes; the dress itself shows dirt-like smudges and discoloration throughout, giving it a used, distressed look.
- **against the anchor's visible half:** It agrees with what IMAGE 1 shows: the same white dress with a high buckled collar, shoulder straps with metal buckle hardware, and the same worn/stained texture of the fabric, plus the same tattooed arm and silver-grey hair. IMAGE 1 does not show the skirt length, back design, or footwear, so those cannot be confirmed or denied by it, but nothing visible in IMAGE 2 contradicts the chest-up portion IMAGE 1 shows.
- **against her written record:** It agrees with the written record's description of a white, body-conscious dress with industrial straps and buckles, worn/weathered fabric, silver-grey short hair, and tattoos covering one arm. The record does not mention boots or an exact skirt length, so the knee-length cut and the specific dark buckled boots seen here are consistent additions rather than contradictions, and the qipao-style structure or chest graphic mentioned in the record is not visible from this back view.
- **added by neither:** The specific dark, buckled combat-style boots and the exact placement of buckle tabs and pocket panels on the lower back and hips are not described in the written record nor visible in IMAGE 1.

### backFull — today (2K), draw 3

- **the outfit:** Seen from behind in full length, she wears a short, body-conscious white dress with a high collar, sleeveless cut, and a harness-like overlay of straps and buckles across the shoulders and sides that mirror down the back seam; the fabric is heavily mottled and stained with grey-black weathering throughout. She has one visibly tattooed arm (dragon/floral motifs) plus a small tattoo between the shoulder blades and marks near the ankles, and she wears dark lace-up ankle boots with worn, matte leather.
- **against the anchor's visible half:** It agrees strongly: the same silver-grey messy short hair, the high-collared white dress with strap-and-buckle hardware, and the same weathered, stained fabric are all present and consistent between the two images; the chest graphic seen in Image 1 is not visible from this back angle, but nothing contradicts it.
- **against her written record:** It agrees with the record's description of a white, body-conscious dress with industrial straps and buckles, worn/weathered look, and dense tattoos on one arm; the qipao-style collar is present as described, though the graphic on the chest is not visible from this angle so it cannot be confirmed here.
- **added by neither:** The dark lace-up ankle boots and the small tattoo marks near the ankles are visible in Image 2 but are not mentioned in the written record or shown in the cropped Image 1.

### frontFull — Sunburst high, draw 1

- **the outfit:** She wears a sleeveless, high-collared white mini dress with a mandarin-style zip neckline, a dark abstract splatter graphic across the chest, and buckled strap hardware running from the shoulders down to the hips where garter-like straps hang open at both thigh slits; the fabric is heavily distressed with grey-black grime and stains throughout. On her feet are chunky white platform combat boots with metal buckles and laces, also weathered to match the dress, giving the whole look a worn, industrial, apocalyptic finish.
- **against the anchor's visible half:** It agrees closely: the same white high-collared dress with metal buckle straps, the chest graphic, the grimy distressed texture, the tattooed arm, the silver-grey messy hair, and heavy dark eye makeup all match IMAGE 1's chest-up view exactly.
- **against her written record:** It agrees well — pale skin, short messy silver-grey hair, heavy black makeup, a white body-conscious dress with industrial straps and buckles and a worn chest graphic, and dense tattoos on one arm all match the written record; the qipao influence is subtle but the mandarin collar supports it, and the boots are an unmentioned but compatible addition.
- **added by neither:** The chunky white platform combat boots, the visible thigh-slits with dangling garter straps, the small hoop earrings, and dark nail polish are shown in IMAGE 2 but not depicted in IMAGE 1 or described in the written record.

### frontFull — Sunburst high, draw 2

- **the outfit:** A sleeveless, high-collared white mini dress in a weathered, marbled fabric with a front zip and a dark abstract graphic across the chest, cinched at the waist and rigged with an elaborate harness of straps and metal buckles that continue down over the hips into hanging garter-like straps at the thigh. The dress ends well above the knee, and she wears chunky white platform combat boots covered in buckles that match the dirtied, distressed look of the dress, giving the whole outfit a worn, battle-damaged appearance.
- **against the anchor's visible half:** It agrees closely: the high collar with front zip and clasp, the shoulder straps and buckle hardware, the marbled/stained white fabric, and the dark chest graphic all match exactly what IMAGE 1 shows in its cropped chest-up view. Nothing in the visible torso area contradicts the anchor.
- **against her written record:** It agrees on the core elements — white body-conscious dress with qipao-like structure, industrial straps and buckles, a worn graphic on the chest, and tattoos on one arm — matching the written record's description well. The dress reads more as a mini dress with a fitted skirt rather than explicit qipao slits, and the tattoo coverage is confined to one arm rather than 'parts of her body' more broadly, but this falls within the record's stated flexibility.
- **added by neither:** The white platform combat boots with buckles, the hanging garter straps at the hip/thigh, the small hoop earrings, and the dark manicure are visible in IMAGE 2 but are not described in IMAGE 1 or the written record.

### frontFull — Sunburst high, draw 3

- **the outfit:** She wears a sleeveless, high-collared white mini-dress with a distressed, dirt-and-ink-smudged finish, a front zip closure, and a dark abstract splatter graphic across the chest; the bodice has cutout shoulders with buckled straps, and the skirt is fitted with side buckle-strap detailing and dangling garter-like straps at the thigh. On her feet are chunky white platform combat boots with multiple buckles and heavy distressing that matches the dress, giving the whole look a worn, soiled, post-industrial finish.
- **against the anchor's visible half:** It agrees closely: the same high collar with front clasp/zip, the buckled shoulder straps, the dirt-and-splatter weathering, and the chest graphic all match what IMAGE 1 shows; nothing visible in IMAGE 1 contradicts IMAGE 2.
- **against her written record:** It agrees with the record's description of a white, body-conscious dress with industrial straps and buckles, a worn graphic on the chest, and dense tattoos on one arm; the record leaves exact cut and footwear open, so the mini-dress length, garter straps, and buckled platform boots are consistent additions rather than contradictions.
- **added by neither:** The specific garter-strap dangles at the thigh and the exact style of the platform combat boots are not shown in IMAGE 1 nor described in the written record.

### leftProfileFull — Sunburst high, draw 1

- **the outfit:** In IMAGE 2 she wears a short, sleeveless white mini-dress with a high stand collar, a fitted bodice, and metal buckle-and-strap hardware running down the front and side, the fabric mottled and stained with dark grime marks throughout. The hem sits mid-thigh with a small buckled strap dangling at the hip slit, and she wears heavy lace-up platform combat boots in the same weathered off-white with multiple buckle straps, the whole look showing consistent dirt and wear from top to bottom.
- **against the anchor's visible half:** It agrees strongly: the same white buckled bodice with the high collar, front closure, dark grunge staining, and strap/buckle hardware seen in IMAGE 1 continues seamlessly into the full-length view, and the tattooed arm also matches; nothing in IMAGE 2 contradicts what the chest-up anchor shows.
- **against her written record:** It agrees on the core description: a white, body-conscious dress with industrial straps and buckles, a worn/grunge finish, silver-grey short messy hair, heavy dark eye makeup, and dense tattoos on one arm; the record's mention of a qipao-influenced cut is loosely reflected in the fitted silhouette and collar, though the dress reads more like a structured mini-dress than a distinct qipao shape, and the record does not mention the boots.
- **added by neither:** The tall white buckled lace-up platform combat boots are shown in IMAGE 2 but not depicted in IMAGE 1 or described in the written record.

### leftProfileFull — Sunburst high, draw 2

- **the outfit:** In profile, she wears a sleeveless, high-collared white dress with a fitted bodice and a midi-length skirt that splits into multiple hanging strips or panels, each edged with small buckles and metal fasteners; the fabric is heavily weathered with grey-black staining and scuffing throughout. On her feet are chunky lace-up platform combat boots in the same distressed off-white tone, laced high and studded with buckles, giving an overall worn, salvaged, industrial look rather than a pristine one.
- **against the anchor's visible half:** It agrees strongly: the same high stand collar with a front closure, the pale weathered fabric, dark grime/staining patterns, buckle hardware at the shoulder/chest area, and the tattooed arm all match. IMAGE 1 doesn't show the skirt or footwear, so no conflict there, but everything visible in both — collar, bodice construction, distressing, and tattoo placement — is consistent.
- **against her written record:** It largely agrees: pale silver-grey messy short hair, heavy black eye makeup, a white body-conscious dress with qipao-like structure, industrial straps and buckles, worn/weathered look, and dense tattoos on one arm are all present. The chest graphic mentioned in the record is not clearly visible from this side profile, and the record doesn't specify boots, so that detail is an interpretation rather than a contradiction.
- **added by neither:** The specific chunky lace-up buckled platform boots and the skirt's multi-strip, layered cut with hanging fastened panels are shown here but not described in either the reference photo or the written record.

### leftProfileFull — Sunburst high, draw 3

- **the outfit:** A short, body-hugging white mini dress with a high mock-neck collar and a metal hook-and-eye closure at the throat, sleeveless with cutaway shoulders, buckle straps crossing the chest, and small buckled vents at the hip; the fabric is heavily distressed with grey-black grime, staining, and a dark abstract graphic bleeding across the torso. She wears chunky white platform combat boots with thick lugged soles, laces, and side buckles, similarly weathered and dirt-streaked, and no other visible accessories beyond the small hoop earrings at her ear.
- **against the anchor's visible half:** It agrees closely: the same high-collar white garment with metal clasp closure, the crossing buckle straps, the dark smeared graphic on the chest, the distressed/dirtied white fabric, the silver-grey tousled hair, and the tattooed arm all match IMAGE 1 exactly where it shows the chest and shoulders.
- **against her written record:** It agrees well: the pale androgynous look, silver-grey messy hair, heavy dark makeup, a white body-conscious dress with industrial straps and buckles and a worn chest graphic, and dense tattoos on one arm all match the written record; the dress reads more as a fitted mini-dress than a distinctly qipao-structured cut, but the industrial/cyberpunk mood is consistent.
- **added by neither:** The chunky white platform combat boots with lugged soles and buckles are not described in the written record nor visible in the cropped reference image.

### rightProfileFull — Sunburst high, draw 1

- **the outfit:** She wears a long, high-collared white dress with a fitted bodice and a shredded, strappy skirt that falls in tattered vertical strips to mid-calf, closed with small metal buckles and studs running down the side seam; the fabric is heavily dirtied and distressed with grey-black smudges throughout. On her feet are chunky white platform combat boots with thick lug soles, multiple buckle straps, and the same weathered, soiled finish as the dress, giving the whole look a worn, apocalyptic street style.
- **against the anchor's visible half:** It agrees well: the same high collar, sleeveless cut, buckle hardware at the shoulder/bodice, dirtied white fabric, and the tattooed arm all match IMAGE 1's chest-up view. Nothing in IMAGE 2 contradicts what the anchor shows.
- **against her written record:** It agrees with the record's description of a white, body-conscious dress with industrial straps and buckles, worn/weathered look, dense tattoos on one arm, and a cold, stylish, intense presence. The record does not specifically mention the shredded skirt panels or the platform boots, so those are consistent extensions rather than direct matches.
- **added by neither:** The tattered, strip-cut skirt design and the specific chunky buckled platform boots are shown in IMAGE 2 but not depicted in IMAGE 1 or described in the written record.

### rightProfileFull — Sunburst high, draw 2

- **the outfit:** In IMAGE 2 she wears a sleeveless, high-necked white dress in a distressed, stained fabric with a qipao-like fitted silhouette that falls to mid-calf, cinched close to the body with a row of buckled straps at the hip and a slit up the side secured by three small metal buckles running down the thigh; on her feet are matching heavy lace-up combat boots in the same weathered off-white tone with buckle straps across the ankle and a thick lugged sole, the whole outfit looking deliberately soiled and worn rather than pristine.
- **against the anchor's visible half:** It agrees with IMAGE 1 on the high mandarin collar with front clasp closure, the cracked/stained white fabric, the buckled harness-like straps over the chest, and the tattoo sleeve on her left arm; IMAGE 2 additionally reveals the dress's full mid-calf length, its side slit with thigh buckles, and the boots, none of which IMAGE 1's cropped framing shows one way or the other.
- **against her written record:** This matches the written record's white, body-conscious dress with qipao structure, industrial straps and buckles, worn/weathered look, and dense tattoos on one arm; the chest graphic described as a 'worn graphic' is consistent with the smudged dark stain visible on the bodice in IMAGE 1, though IMAGE 2's side view does not clearly show it.
- **added by neither:** The specific buckled combat boots and the side-slit leg buckles are shown in IMAGE 2 but are not described in the written record nor visible in IMAGE 1.

### rightProfileFull — Sunburst high, draw 3

- **the outfit:** In profile, she wears a short, weathered white mini-dress with a high stand collar, sleeveless cut, and metal buckle-and-strap hardware running down the bodice and hip, with a slit at the side showing the leg; the fabric is streaked and stained with grey-black marbling throughout. On her feet are chunky lace-up combat boots in the same distressed off-white tone with a side buckle strap and thick lugged soles, and the whole look reads heavily worn and grimy rather than pristine.
- **against the anchor's visible half:** It agrees closely: the same white body-conscious dress with a high collar, front hardware, buckles, and the dirtied/stained texture seen in IMAGE 1 continues down the torso, and the tattooed arm and silver-grey hair match as well. IMAGE 1 does not show the skirt length, side slit, or footwear, so those parts cannot be confirmed against it, though nothing here contradicts what is visible in the reference.
- **against her written record:** It agrees with the record's description of a white, body-conscious dress mixing structure with industrial straps and buckles, worn and weathered, plus dense tattoos on one arm and short messy silver-grey hair. The chest graphic mentioned in the record is not clearly visible from this side angle, and the boots, while plausible for the described aesthetic, are not specifically named in the written record.
- **added by neither:** The specific lace-up buckled boots with thick lugged soles are not described in the written record nor visible in IMAGE 1, and the visible ear piercings and neck tattoo detail are also not called out by either source.

### backFull — Sunburst high, draw 1

- **the outfit:** Seen from behind and full-length, she wears a sleeveless, high-collared white mini dress with a mottled grey-black weathered or stained finish, its bodice crossed with buckled straps and panel seams down the back and a rear zipper, ending in a short, straight hemline with a small back slit and a few hanging strap-tails; on her feet are tall white buckled combat-style boots with dark treaded soles, and the whole outfit reads as heavily distressed and worn-in rather than pristine.
- **against the anchor's visible half:** It agrees strongly: the same high collar with metal clasp, the same buckled cross-strap harness detailing over a white dress bodice, matching silver-grey messy short hair, and the same dense tattoo sleeve on one arm are all consistent between the two images; nothing in IMAGE 2 contradicts what IMAGE 1 shows.
- **against her written record:** It agrees well with the written record: the white, body-conscious dress with industrial straps and buckles, the worn/weathered look, the dense tattoos on one arm, and the cold, stylish, intense presence are all present; the record does not specifically mention boots, so their exact style is an added specific rather than a conflict.
- **added by neither:** The tall white buckled combat boots and the visible dark nail polish on her fingers are shown in IMAGE 2 but not depicted in IMAGE 1 or described in the written record.

### backFull — Sunburst high, draw 2

- **the outfit:** Seen from behind, she wears a long, body-hugging off-white dress with a high mock neckline and back zip, crossed harness-style straps with metal buckles over the shoulders and down the torso, and a hip-level cutout secured with more buckled straps; the skirt splits into an asymmetrical, tattered hem that opens in a high slit up one leg, and she wears tall buckled boots in the same weathered off-white tone, with the whole garment heavily dirtied and stained rather than pristine.
- **against the anchor's visible half:** It agrees strongly: the same silver-grey messy short hair, the same off-white dress with a high collar, back zip, buckled harness straps, and the same dense sleeve tattoo are visible in both images, continuing seamlessly from the cropped chest view into the full-length body of the dress.
- **against her written record:** It agrees with the record's description of a white, body-conscious dress with industrial straps and buckles, worn and weathered, paired with dense tattoos on one arm — matching the qipao-influenced silhouette, hardware, and cold, stylish, street-futurist presence; the record does not specifically mention the thigh-high slit, hip cutout, or tall buckled boots, but these do not contradict it.
- **added by neither:** The tall lace-free buckled boots, the high thigh slit with asymmetrical tattered hemline, and the hip-level cutout with straps are shown in IMAGE 2 but are not described in the written record or visible in the cropped IMAGE 1.

### backFull — Sunburst high, draw 3

- **the outfit:** Seen from behind, she wears a sleeveless, high-necked white dress with a fitted bodice and a long, ankle-grazing skirt slit up one side to the thigh; the fabric is heavily stained and mottled with grey-black dirt-like patches throughout. Metal buckles and strap hardware run down the spine and cinch at the hip, with a thin dangling strap hanging past the slit, and she wears matching pale, equally weathered lace-up combat boots with chunky soles.
- **against the anchor's visible half:** It agrees strongly: the same short messy silver-grey hair, the harness-style straps and buckle hardware at the shoulders/back, the high collar, and the same heavily weathered off-white fabric with dark grime patterning all match IMAGE 1's visible chest-up portion. The tattooed arm also continues consistently between both images.
- **against her written record:** It agrees with the written record's description of a body-conscious white dress mixing qipao-like structure (high neck, fitted long skirt, side slit) with industrial straps and buckles, worn by a pale, androgynous figure with dense tattoos on one arm and short silver-grey hair. The record's mention of a 'worn graphic on the chest' isn't verifiable here since the back is shown, but nothing contradicts it.
- **added by neither:** The specific pale, distressed combat boots with buckle detailing and the visible dangling strap loose past the skirt slit are not described in the written record or shown in IMAGE 1.


## RENDERS THAT NEVER ARRIVED: 0


## CONTROLS

- {"control":"turn-reader","anchor":"sifr","viewType":"frontFull","variant":"as delivered","mustRead":"profile: false","readAsRequired":true,"profile":false,"edge":"neither","note":"The person faces directly toward the camera with both eyes visible.","why":""}
- {"control":"turn-reader","anchor":"sifr","viewType":"sideClose","variant":"as delivered","mustRead":"profile: true","readAsRequired":true,"profile":true,"edge":"right","note":"The person is shown in a true side profile with only one eye and ear visible, facing toward the right edge of the image.","why":""}
- {"control":"turn-reader","anchor":"sifr","viewType":"sideClose","variant":"mirrored","mustRead":"profile: true, and the OPPOSITE edge from the delivered frame","readAsRequired":true,"deliveredEdge":"right","profile":true,"edge":"left","note":"The person is shown in a true side profile with one eye and one ear visible, facing toward the left edge of the image.","why":""}
- {"control":"turn-reader","anchor":"sifr","viewType":"frontFull","variant":"as delivered","mustRead":"profile: false","readAsRequired":true,"profile":false,"edge":"neither","note":"The person faces directly toward the camera with both eyes visible.","why":""}
- {"control":"turn-reader","anchor":"sifr","viewType":"sideClose","variant":"as delivered","mustRead":"profile: true","readAsRequired":true,"profile":true,"edge":"right","note":"The person is shown in a true side profile with gray hair, one visible eye and ear, facing toward the right edge of the image.","why":""}
- {"control":"turn-reader","anchor":"sifr","viewType":"sideClose","variant":"mirrored","mustRead":"profile: true, and the OPPOSITE edge from the delivered frame","readAsRequired":true,"deliveredEdge":"right","profile":true,"edge":"left","note":"The person is shown in a true side profile with silver hair, one eye visible, facing toward the left edge of the image.","why":""}

---

## THE FRAMES — his eye closes this (law 9)

Eight sheets are in the production bucket and **all eight were verified to serve
`200` from it** before they were named here. ⚠ **A frame is not visible to him
until a briefing edition names its key inside an `eyeItems` entry and deploys** —
the deployed briefing IS the serving route's allowlist, so uploading publishes
nothing on its own. **The relay ships the edition that names these; this seat does
not edit the briefing.**

| what it shows | key |
|---|---|
| **Front, full length** — the anchor, then three Nano Banana Pro draws, then three Sunburst high, matched scale | `crew-eye/7f81dc0d-eda3-4c00-9607-df57a19ad394.jpg` |
| Front — **torso to hem** out of each of the seven, matched scale | `crew-eye/d9a8e24c-f08e-40a1-9fda-3c9d6ffb82b5.jpg` |
| **Profile, nose to the frame's LEFT** — anchor, three and three | `crew-eye/e53370c1-58be-4f28-914d-40f50649e10b.jpg` |
| Left profile — torso to hem, matched scale | `crew-eye/2a4f4e6e-558a-47c7-9cd8-598e944c339b.jpg` |
| **Profile, nose to the frame's RIGHT** — anchor, three and three | `crew-eye/0df17f38-2b48-4bd5-b7e8-6477392317cf.jpg` |
| Right profile — torso to hem, matched scale | `crew-eye/585538ab-9b21-4578-9489-aaba126b6dba.jpg` |
| **Back, full length** — anchor, three and three. The view that invents the most | `crew-eye/89cd2cfa-a25b-4bef-b54f-c61a1b4037ce.jpg` |
| Back — torso to hem, matched scale | `crew-eye/b327bc75-1461-4232-9acb-d15f02739475.jpg` |

Each sheet is 4340 px wide. Each `-outfit` sheet is the same seven panels cropped
to the outfit band and brought to a common 2352x1822 with **nearest-neighbour**
enlargement, so nothing in the smaller arm's pixels is invented on the way to
matching scale.

**The question for his eye, and it is the only thing this court does not answer:**
on those frames — the back of the dress, the fall of the hem, the shoes, the
hardware, everything the anchor's chest-up crop cannot establish — **is Sunburst's
invention the one he wants the Sign views made of?** His #1394 ruling (*"keep NBP
2k for signing views"*) stands until he says otherwise, and either way the answer
goes on #1451 in his own words.

---

## Provenance, money and what was NOT touched

- **House money only.** Every render is a direct call to the fal provider on the
  house account, the way #1394's arms were. **No customer credits, no Sign, no
  credit-ledger row, no operation, no database write of any kind in either
  world.** His standing rule applies and was followed: *"you never need my word
  to spend credits on a court"* (in stone, 2026-09-22) — the estimate went on the
  card before the run and the actual is on it after.
- **The production database was READ, never written.** `railway run --service
  MySQL` with `--prod-fixtures`, which makes the driver declare
  `MYSQL_PUBLIC_URL` as the world key its answer rests on rather than
  `DATABASE_URL`; `scripts/lib/dbConnection.mts`'s own `assertSameWorld` is the
  second gate and it fired on the first attempt, which is how the reading came to
  be taken correctly.
- **The only production WRITES are the contact sheets**, uploaded to the public
  bucket under `crew-eye/<uuid>.jpg`. Uploading publishes nothing on its own: the
  deployed briefing's `eyeItems` list IS the serving route's allowlist, so the
  relay's edition is what puts them on his Desk.
- **No Railway variable, no deploy, no flag flip.** The driver ships dark: every
  phase refuses to spend without `--run`, and the `outfit` phase refuses outright
  if `--arms` narrows it to nothing, because a court that renders zero pictures
  and exits 0 reads exactly like a clean run.
- **Frames and rows** land under `output/1451-outfit-court/` (gitignored, as
  #1394's were). ⚠ **A verbatim copy of both rows files and of the four composed
  prompts is committed at `docs/specs/sign-outfit-court-2026-09-27/`**, so the PR
  carries the facts and not only the fold — #1394 left its rows on one machine,
  and every number in its record was a claim to anyone reading the diff.

## What this court got wrong about itself, said here rather than found later

- **The reader's token usage was collected and discarded.** `readOutfit` has
  returned the provider's `tokens` and `truncated` since its first line and the
  only consumer threw both away, so the 2026-09-27 rows cannot price the text
  half of this court at all. That is the arm-at-the-producer shape this
  repository already has a worked example of — `packageOrchestrator`'s own
  `dropped`, whose docblock says a cap that silently truncates *"reads, from the
  outside, exactly like a feature that was never there."* **Fixed in the driver
  in the same commit as this document**; the rows already written stay as they
  are, because re-running to fill a field costs $3.43.
- **The balance was read once at each end, not settled.** #1394's price phase
  takes two consecutive equal readings after a move, which is `falSpend.mts`'s
  own stated discipline, and this run did not. The window is honest in direction
  and coarse in value, and it is labelled that way above rather than quoted as a
  price.
- **`keyOf` had a fallback that would have mislabelled this whole court.** It
  returned `"jericho"` for any cast that was not the caveman or the basics
  fixture — true of #1394's three and silently wrong of every other cast in
  either world. Run against Sifr unchanged, every frame would have landed under
  `output/…/jericho/` and every row would have said `anchor: "jericho"`: a court
  reporting confidently about a woman it never rendered. It is derived from the
  cast's own name now, which leaves #1394's paths byte-identical.
