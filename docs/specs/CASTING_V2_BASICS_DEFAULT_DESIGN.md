# BASICS IS THE BIRTH STATE — a design for countersign

**Founder direction, 2026-08-25** (relayed fable-1643, with the garment questions
at fable-1645). Supersedes the central ruling of
`CASTING_V2_TWO_PATHS_DESIGN.md`, which carries a notice at its head pointing
here.

**DOC ONLY.** No court has been dispatched, no frame rendered, no segmenter read.
Every court below is costed and none is bought. Ordered fable-1650 §2.

---

## 0. What he said, verbatim

> *"this is how i envision it working, cast without any outfit details (basics)
> -> cast with wardrobe detail (dress them in that wardrobe) but if i said black
> lather jacket, would thhey be wearings pants and shoes? -> refinement wardrobe
> edits allowed -> after signed VTO is its own thing that will get built based on
> the legacy VTO which we will probably rebuild anyway"*

And on the garment itself, with a reference image (a SKIMS-style black bralette
and briefs):

> *"is this too skimp for our female human basics outfit? probably wouldnt fit
> every body type especially if you made an obese or larger woman? also cant be
> hitting the engine fail safe too often otherwise there could be alot of issues
> generating signed views etc do you also think black is the best color for our
> brand or a more neautral color?"*

His reason for the whole change is VTO: *"its alot easier to dress someone from
basics that fighting with their original clothes."*

---

## 1. ⚠ THE FINDING THAT REFRAMES TWO OF HIS THREE QUESTIONS INTO ONE

**His "too skimp" question and his "engine fail safe" question are the same
question, and it already has a measured number.**

The female basics line today is:

> *"a plain black scoop-neck sports top cut well below the collarbones so the
> whole upper chest and sternum are bare, plain black fitted shorts, barefoot"*

`wardrobeLine.ts`'s own docblock records what that sentence costs, measured
rather than feared:

```
6 refused of 24 roll slices across three sheets — every one `content_policy`,
the provider naming `body.prompt`, against 0 of 8 on the ORIGINAL (higher)
wording. ~25%, and on that n the true rate could honestly be 1 in 10 or 1 in 2.
```

**And it is not a wording problem** — that was measured too. A deliberately
milder sentence (no *bare*, no *sternum*, no *upper chest*) refused MORE often,
3 of 8 against 3 of 16. Two phrasings as different as could be written while
keeping the neckline gave the same outcome.

**So the skimpiness IS the refusal rate.** Covering up reduces both.

### ⚠ And there is a standing instruction NOT to do what would fix it

The same docblock ends:

> *"The founder was shown that number and kept the lower top … **Do not "fix"
> this by raising the neckline; that is the decision being reversed, not a
> defect being repaired.**"*

**He is now reopening his own decision, which he is entitled to do — but this
design must put the trade back in front of him rather than quietly take the
other side.** What the low neckline buys is `BASICS_COVERAGE.upperChest = bare`,
which is what lets a chest tattoo be CROPPED and CARRIED. He took that trade
knowingly: *"a missing face on a sheet is visible, recoverable and honestly
refunded — she is charged for what she receives — while a tattoo that renders
and then vanishes on the next edit is the one thing this product promises never
to sell."*

### ⚠ Why the trade is genuinely different now, and this is the argument for revisiting

**Two things changed since he took it.**

**(a) Basics stops being a path somebody CHOOSES and becomes the state every
cast is BORN in.** The refusal rate was accepted for an opt-in path taken by
people who wanted a body record. As the default it is paid by everyone,
including every customer who never wanted a bare chest and only wanted a
person in clothes.

**(b) IT COMPOUNDS AT SIGN, and Sign is 450 credits.** `signService.ts`'s
`currentWardrobeLine` call carries the line into the package views. Per-image
refusals multiply:

```
per-image refusal p     P(a Sign clears)     five views     four
  0.25                     31.6%              23.7%         ← the roll rate
  0.10                     65.6%              59.0%
  0.05                     81.5%              77.4%
  0.02                     92.2%              90.4%
```

⚠ **AND THE LIVE COLUMN IS THE FOUR, NOT THE FIVE — found by court 1's own
pre-dispatch guard refusing to buy a view (2026-08-25).** The guard asserts the
wardrobe line is in every prompt it is about to pay for, and it refused on the
CLOSE-UP. Read at the code, that is correct product behaviour: `wardrobeSpecFor`
returns a view's own spec when it is not the shared one, and the close-up's is
`CLOSE_UP_WARDROBE` — *"at this crop the garment may be barely visible, and that
is fine — if no clothing is in frame, this passes."* **The close-up is never
told the wardrobe line at all, so it cannot be refused for the neckline
sentence.** The risk is carried by four of the five views. Both columns are kept
because the five is the right exponent for a risk that rides every view, and
this particular risk does not.

⚠ **THIS TABLE SAID SIX VIEWS AND THE PACKAGE IS FIVE — corrected 2026-08-25
(opus-1272, ruled fable-1654 §1), and the correction WEAKENS my own argument by
about six points at every row.** `CAST_PACKAGE_VIEWS` holds `closeUp`,
`threeQuarter`, `frontFull`, `sideClose`, `backFull`, and
`CASTING_V2_SIGN_PRICE_CREDITS` derives 450 from that length — 200 + 5 × 50.
Package v3.1 retired the Portrait and its own docblock says *"still five
generated views"*; the sentence above, and a dozen others across this product's
prose, never heard. The stale exponent was inflating the headline: at the
measured roll rate the honest figure is **one Sign in four clearing every view,
not one in six**. The direction of the argument is unchanged and its size is
smaller, which is exactly the kind of correction that has to be made before he
reads it rather than after.

⚠ **The 25% was measured on ROLL slices, not on Sign views** — different prompt,
different engine (`Nano Banana Pro` at Sign against `GPT Image 2` at roll). **I
am not claiming 23.7% of Signs fail.** I am saying his instinct is right, the
arithmetic is brutal at any rate above a couple of percent, and **nobody has
measured the Sign side at all.** That measurement is court 1 below and it is the
one I would buy first of everything here.

---

## 2. His five rulings, and the build shape each implies

### 2.1 Basics is the birth default for every cast

The Wardrobe/Basics toggle is removed from the modal;
`CASTING_TWO_PATHS_SCOPE`'s SURFACE retires with it.

**Law 7's ruling clause — what is bolted to the dying branch:** the §6 toggle
UI, the bypass notification, `path` on the roll input schema, the `path` column's
MEANING (likely not the column — see below), `pathRefusedNounIn` /
`subjectsServedOnPath` / `bornPathsServing` in the refine interpreter and subject
cards, `BASICS_COVERAGE` / `inkSurfaceCoverage`'s two-line lookup, and the two
paths' evidence pack. **Each is enumerated and dispositioned in the build, not
swept by grep at commit time.**

⚠ **The `path` COLUMN stays.** 208 rolls carry `path: NULL` (pre-feature) and
one carries `wardrobe`; the column is how a historical roll's own state is read,
and dropping it would make those rows unreadable. What retires is the CHOICE,
not the record.

### 2.2 A stated outfit is obeyed; unstated slots complete from BASICS

His jacket question answered: **"black leather jacket" = the jacket, plus
neutral basics below, fully dressed, no freelancing.** This is fable-1638's
stated-facts grammar applied to clothing — each stated fact obeyed, variance
(here: the engine's styling latitude) filling only what was left open.

An OPEN styling ask (*"build an outfit around this jacket"*) is the explicit
invitation and routes to the picker. **The shape-A wardrobe picker is therefore
not wasted work** — it becomes the engine behind that ask rather than a path.

### 2.3 Basics is CATEGORY-SUITED, keyed off `intent.role`

His words: *"making a caveman in basics would look weird… if its a monster they
might not even wear anything"*.

⚠ **HARD DEPENDENCY, and it is measured.** A null `role` has no category to suit,
and `role` is null on **26 of 213 real production rolls (12.2%)** — a census taken
2026-08-25. The re-ask shipped at `582656b1` recovers the rich-brief cases; the
remaining nulls are short briefs that genuinely name no category, and those are
the ordinary ones.

**So the fallback is not an edge case, it is one cast in eight**, and it must be
designed rather than defaulted: **a null role takes the HOUSE neutral basics**,
which is the contemporary-human garment and is stated as such rather than
arrived at by an undefined lookup returning undefined.

### 2.4 Refine wardrobe edits unchanged

Words or reference, exactly as today. Nothing in this design touches them.

### 2.5 VTO is its own post-Sign program

On the legacy VTO's bones, probably rebuilt, refine-shaped outfit building. **Not
part of this design beyond one interface promise: a signed cast arrives in basics
as VTO's canvas**, which is the entire reason he wants the default changed.

---

## 3. His three garment questions

### 3.1 Silhouette — how much garment?

**Recommendation: one notch up from underwear.** Female: a fitted sports-style
top with a normal athletic neckline plus high-waist bike shorts. Male: a fitted
tee or tank plus fitted shorts (today's male line is *shirtless*, which has the
same dignity question at scale).

**Why:** it reads as dignified across every body type — his own concern about a
larger or older subject — and it preserves the silhouette VTO needs, which is
the point of the state.

⚠ **THE COST, STATED SO HE DECIDES IT AND NOT ME: it gives up
`BASICS_COVERAGE.upperChest = bare`, and with it the ability to crop and carry a
CHEST tattoo on a basics-born cast.** That is the exact trade he took the other
way on 2026-08-23. My recommendation reverses it, and the reason it is defensible
now is §1(a) and §1(b) — it is no longer an opt-in path's cost, it is everyone's,
and it compounds into a 450-credit operation.

**If he wants chest ink kept, the honest answer is not a middle wording** —
that was measured and the milder sentence refused more often. It would be a
SECOND basics variant chosen when the brief asks for chest ink, which is a real
design and is out of scope here; it is named so it is not re-derived.

### 3.2 Refusal rate — his instinct, made a shipping gate

**Adopted as a GATE, per fable-1645 §2: the basics garment does not ship on
taste.** A refusal court rolls the candidate garment and counts walls per
operation class, and the chosen wording must measure clean before it is the
default for everybody.

**And it must include Sign**, per §1(b) — that is where the odds compound and
where nothing has ever been measured.

⚠ **AND THE MALE HALF OF §3.1's RECOMMENDATION IS SUPERSEDED — HE RAN HIS OWN
WORDING TEST AND IT WON WITHOUT COSTING THE TRADE** (2026-08-25, relayed
fable-1659 §1; the swap is in `wardrobeLine.ts`). His words:

> *"shirtless is a genuine NSFW flag for gpt image 2 so i tried 'bare chested'
> and it seemed to work for 4/4 where as shirtless was a 2/4"*

The male line is now `bare chested, in plain black fitted shorts, barefoot`.
**It preserves the trade instead of reversing it** — same body, same coverage,
`BASICS_COVERAGE.upperChest` still `bare`, the chest-ink road untouched — which
is strictly better than §3.1's tank recommendation, whose whole cost was giving
that up. No court was bought: the refusal counter by wardrobe line gives the
real rate free on his next Basics rolls, and if `bare chested` still refuses
materially the garment question re-opens with numbers.

⚠ **THIS IS DIRECT EVIDENCE FOR COURT 2's CENTRAL HYPOTHESIS AND IT CHANGES THE
COURT'S SHAPE.** The legacy VTO road's `SAFETY_TERM_MAP` works by renaming the
flagged **NOUN** (`bralette` → `cropped top`) and never by softening a
DESCRIPTOR — and the milder-sentence arm that failed here (3 of 8 against 3 of
16) softened descriptors, which is why it could not separate the two mechanisms.
`shirtless` → `bare chested` is a noun-register swap and it moved. **So court 2
gains MALE cells as first-class, not as an afterthought**: today's line, the
fitted-tank swap, and a construction-register rephrasing — beside the female
cells, whose candidate wordings should now be drawn the same way, by renaming
what the garment IS rather than by describing it more gently.

### 3.3 Colour — black, or neutral?

**Recommendation: NEUTRAL (mid-grey / stone), decided by a reading rather than
by prose.** Two reasons, and only the first is aesthetic:

- **Black loses edge definition on dark skin**, for his eye and for the
  segmenter alike; and black-on-black kills contrast for every dark-garment
  edit and every VTO read. The basics state exists to be READ from.
- **Brand black lives in the UI, not on the cast.**

⚠ **Decided by a segmenter-contrast reading, not by taste**: garment-region
reads on dark-skinned subjects in both candidate colours, counting whether the
garment boundary is found at all. That is court 3 below.

---

⚠ **THE RECOMMENDATION ABOVE IS OVERTURNED BY ITS OWN COURT — the segmenter
argument is DEAD, and BLACK STANDS pending his aesthetic word** (court 3, run
2026-08-25 inside `CASTING_BRIEF_FIDELITY_SCOPE`; ruled fable-1656 §3, closed
fable-1658 §5). **The corrected party is the Fable seat**, whose fable-1645 §3
made the neutral recommendation; the executor seat wrote it into this section
and built the instrument that refuted it.

The claim was *"black loses edge definition on dark skin, for his eye and for
the segmenter alike."* Asked, on the funded population:

```
BLACK    rendered 4/4  ·  control answered 4/4  ·  subject found 4/4
         subject px: 178572, 164677, 149743, 115169
NEUTRAL  rendered 3/4  ·  control answered 3/3  ·  subject found 3/3
         subject px: 150688, 146458, 178130
```

**`sports top` is found on every black frame, on genuinely deep dark brown
skin.** The boundary does not disappear. The refusal direction runs the same
way — **0 of 8 BLACK, 2 of 8 NEUTRAL** across both runs (Fisher p ≈ 0.47, quoted
as a direction and not a rate).

⚠ **Run 1 measured the wrong population and that is why there are two runs.**
The brief said *"deep dark brown skin"*, the phrase reached 4 of 4 compiled
prompts, and six of seven delivered frames came back medium or light brown — the
interpreter had invented *"mostly Middle Eastern heritage with Western European
features"* and put it in the ABSOLUTE block one paragraph above the skin
sentence, where it beats the skin at the frames. A bare compiler call sits
OUTSIDE `CASTING_BRIEF_FIDELITY_SCOPE`, so `statedSkin` is null by construction
and the pin never runs. Re-run inside the flag, the heritage is gone, the skin
speaks in its own lane, and all seven frames read as genuinely dark. **The two
runs are two independent populations, not a paired comparison.**

**What is left of §3.3 is the aesthetic call, and it is HIS** (law 9 — a
segmenter cannot settle *"which looks right for the brand"*). The contact sheet
is `output/basics-colour-court-run3/CONTACT-black-vs-stone-grey.png`.

✅ **HE HAS RULED AND THE COLOUR QUESTION IS CLOSED: BLACK** (2026-08-25, relayed
fable-1661 §2). Verbatim:

> *"if the image analyzer fails to pickup grey go with black"*

**His condition is met and it was met by the court's own rows.** The NEUTRAL
cell rendered 3 of 4 in run 3 and 3 of 4 in run 1 — a refused slice in both —
and run 1's neutral cell is where a garment read came back short. BLACK rendered
4 of 4 and was found 4 of 4 on genuinely deep dark brown skin. So the answer is
his stated fallback, arrived at by the reading he asked for rather than by
anyone's taste.

**Consequences, discharged here:** the colour question comes off his desk; the
basics garment is black; and **court 2 drops the colour axis entirely** — it
tests wording, never colour. This section is now a record rather than an open
question.

---

## 4. The courts — costed. **COURT 3 HAS RUN (twice); 1, 2 and 4 have not**

⚠ This section read *"NONE RUN"* and *"fal stands at $15.18"* when it was
written. Court 3 was funded by his own *"3) yes"* and ran on 2026-08-25 — twice,
because run 1 bought the wrong population (§3.3). **Its verdict is above and it
overturned this document's own recommendation.** Court 1 is BUILT, guard-proven
and HELD on funding (fable-1658 §3); courts 2 and 4 are unbuilt.

⚠ **The balance figure below is a DATE-STAMPED READING and not a standing fact.**
It has been $15.18, $14.33, $13.15 and $12.55 inside four days, and it moves on
its own — production rolls spend from this same account, so it falls while
nobody here is spending. Read it at dispatch, never from this page.

Prices for his word:

```
1  THE SIGN REFUSAL READING          ⚠ MY FIRST BUY. The 25% is a ROLL figure
   ~2 Signs, dev, ≈ TBD at the        and Sign is where it compounds into 450
   Sign price + fal renders           credits. Two Signs on today's basics line
   PRIORITY: highest                  is a floor reading, not a rate — but even
                                      "it refused once in twelve views" changes
                                      which garment ships
2  THE GARMENT REFUSAL COURT         the shipping gate of §3.2. Candidate
   ~3 sheets × 8 slices = 24 slices   wording vs today's, counted per operation
   ≈ $2.85 fal at the measured        class, across body types INCLUDING
   $0.95/sheet                        large-bodied and older subjects
3  THE COLOUR CONTRAST READING       segmenter reads of the garment region on
   ~8 frames + ~16 region reads       dark-skinned subjects, black vs neutral.
   ≈ $1.03                            Cheapest of the three and it decides §3.3
                                      outright
4  THE BODY-TYPE STRIP               HIS EYE judges dignity, not a reader
   frames from court 2, no new spend  (law 9). Rides court 2's output
```

**Sequencing recommendation: 1 before 2.** If Sign refuses materially on today's
line, the garment question is already answered and court 2 only has to confirm
the replacement.

---

## 5. What needs HIS word, and what does not

```
HIS       the silhouette level, because it reverses his own 2026-08-23 trade
          and costs chest ink on a basics-born cast (§3.1)
HIS       whether chest ink keeps a road at all (the second-variant option)
HIS       the colour, AFTER court 3 reports — he asked, so he decides, but he
          should decide on the contrast reading rather than on brand feeling
NOT HIS   the toggle removal, the stated-outfit-completes-from-basics grammar,
          the null-role fallback, the `path` column staying. All follow from
          rulings already given
```

---

## 6. Open, and deliberately not answered here

- **The refusal→refund path at Sign.** If a view refuses, what does she pay? The
  existing per-slice refund covers roll; Sign's behaviour under a content-policy
  refusal is not read in this design and court 1 will surface it.
- **`inkSurfaceCoverage`'s two known basics lines** become one plus whatever
  ships; the constant is derived from `basicsWardrobeLine` already, so it
  follows rather than drifts — noted so nobody re-mirrors it.
- **The male line's dignity question.** *"shirtless"* has the same problem his
  question raises about the female line and he did not ask about it. Flagged,
  not decided.
