# Outfit edits in Refine — the design (#2544; design parent #1161)

**Written 2026-10-16 by the escalated Fable shift, on his two words that opened and priced
the capability** — *"yes allow it"* (2026-10-15, asked whether outfit changes should work in
Refine) and *"yes refine is all the same price"* (2026-10-16, on #2544, answering the money
question #1161 left open). Every code claim below was read at the tree at `8f57cb955`, with
the `file:line` beside it. **This is a design, not a build**: nothing in the product moves
until he has seen this document's Desk summary, and the build then follows the slice order
in §8 — after #2565 slice 1, which is his own sequencing word on #2544.

---

## 1 · What the customer gets, in their terms

They type into the same Refine box they already use. *"Put her in a long black coat"* works
the way *"give her green eyes"* works: one edit, 100 credits, the same Try again, the same
refund when it fails. Nothing new appears on screen, nothing new is learned, and no decision
is added in front of the button.

Today that exact ask is refused with a sentence telling them clothing *"comes after Sign"* —
a sentence that was true of the retired wardrobe path and is now simply a closed door
(`refineRefusals.ts:126`). This design opens the door and corrects the sentence.

What an outfit ask can be, all through the one box, all in words:

- **Change** — *"swap the hoodie for a tailored charcoal suit"*.
- **Add a layer** — *"a denim jacket over the dress"*.
- **Remove a layer** — *"take the jacket off"*. A removal is an outfit rewrite, never an
  undressed state: the subject card is `departable: false` on exactly this reasoning
  (`subjectCards.ts:832` — *"the product has no undressed state to leave her in"*). An ask
  for an undressed person meets the content wall exactly as it does today.
- **Colour and fabric** — *"the same dress in emerald silk"*.

What never moves: the person, the pose, the light, the set. ⚠ **AND THE SENTENCE THAT STOOD
HERE NAMED THE WRONG MECHANISM FOR THAT — corrected 2026-10-17 by slice 0's court, which read
the dispatched prompt rather than reasoning about it.** It said *"The subject's own qualifier
pins it in the prompt"*, quoting `subjectCards.ts:821`. **That clause reaches no dispatched
prompt.** A wardrobe delta leaves `presentationOf` as a presentation clause, and
`askSentence`'s presentation branch (`recipeAssembler.ts:1058`) pushes
`${possessive} ${noun}: ${words}` with **no qualifier**; `refineService.test.ts:3980` already
pinned that bare shape. The real dispatched string, read at the wire during the court:

> Reference 1 is the photograph of this person — reproduce them exactly: same face, same pose,
> same lighting, same framing, same background. Change only their wardrobe: a tailored
> charcoal suit jacket over a white shirt.

**So what holds the set still is the repaint recipe's own identity clause** — *same lighting,
same framing, same background* — and the court measured it holding: **the backdrop was intact
on 21 of 21 renders, both arms.** ⚠ The design's conclusion is unaffected and the capability
is unaffected; what was wrong is which sentence to thank for it, which matters the next time
somebody edits either one. One level up, that the qualifier table reaches no prompt at all for
any of its 29 subjects is **#2596**, filed on its own rather than folded in here.

## 2 · The four questions #1161 said this design must answer

#1161's closing sentence named them: what the customer sees, what it costs, what happens
when the engine refuses, and how it reads on a cast never cast in that garment.

### 2a · What the customer sees — §1, plus the panel

The edit itself is §1. On the right-hand panel, a garment becomes a **kept item** — a small
picture of the piece on this cast — through the #2566 reader and #2565 slices 2–3, which is
his own word on #2544 (*"garments become kept items through the #2566 reader"*). Until those
slices land, the chosen outfit is carried in the cast's one current description (#2565
slice 1, words), which is already enough for the edit to stick across later edits. No
word-only panel rows are drawn — his #2532 ruling — so the panel changes nothing on this
card alone.

### 2b · What it costs — settled by his word, and the answer is NOTHING NEW

**An outfit edit is an ordinary Refine.** His word, verbatim: *"yes refine is all the same
price"*. Concretely, at the code:

- **Price**: `CASTING_V2_REFINE_PRICE_CREDITS = 500` ledger = **100 display**
  (`castingCreditCosts.ts:302`, his *"launch at 100"*).
- **Operation**: the refine's own — same claim, same settle
  (`refineService.ts:1205` reads the one constant; the walls sit above the claim, so a
  refused ask charges nothing).
- **Refund**: the refine's own — one unit, the whole charge refunds on any failure
  (`castingCreditCosts.ts:297–301`), and the checker stays catastrophic-only (#1903).

#1161 reasoned it would need *"a price, its own operation, its own refund key"* — that
paragraph is superseded by his word. **The money diff of this capability is zero lines**,
which is the second reason it could be designed as a subject rather than a feature with its
own till.

### 2c · What happens when the engine refuses

Two layers, both already built; one sentence changes.

**Before any charge — the walls.** The interpreter's refusals are free by construction
(`refineService.ts:1208`, *"free refusals: nothing claimed, nothing charged"*; every
`REFINE_REFUSALS` wall entry is `charge: "free"`). Scenery, props and the set still refuse
— that is the whole point of §4 — but the backed stage refusal's copy must change, because
today it reads:

> *"Refining changes the person, not the shoot — their coat is a garment, a prop or the set,
> which comes after Sign."* (`refineRefusals.ts:126–128`)

Once clothing works, "a garment … comes after Sign" is false, and a garment ask never
reaches this wall anyway. The replacement names only what still refuses:

> **"Refining changes the person, not the shoot — ‹word› is part of the set, which a refine
> never touches. Clothing, jewellery and glasses do work here. Nothing was charged."**

It says what was refused and what to do, and no engine is named — the refusal law as it
already binds every door. The law-7 sweep in the build: grep every customer string for the
garments-come-after-Sign claim (the `referenceWordsLane.ts:93` docblock carries the sibling
reasoning and is corrected in the same act).

**After the charge — the render.** Identical to every refine today: an engine refusal or a
catastrophic checker verdict refunds the whole charge and says so; an *unsure* outfit read
delivers the picture charged, with the free Try again — #1612's shape, where only the
identity axis stays fail-closed. The D-185 facts-contained check reads the composed recipe,
so the wardrobe line becomes one of the facts the picture has to contain; it enters as
**advisory** (deliver + free Try again on a miss), identity stays **binding**. No new
refusal door is minted — the capability atlas gains corpus rows for the asks that now pass,
not new doors.

### 2d · How it reads on a cast never cast in that garment

The repaint paints the **whole frame from the pristine master** plus the words
(`repaintRender.ts:1–15`; one road since #1577 slice 4b, `refineService.ts:7471–7498`).
So the garment is *invented from their words* onto the person — exactly what the product
already does every time it dresses a cast it has never seen in that outfit: the Sign
wardrobe plate invents an outfit on the same engine family, and his own eye chose that
engine for outfit invention in the #1451 court (*"sunburst produced the best result
easily"*). The edit lands as a new **version**; the master is untouched; the identity check
runs as on every refine. Whether the invented garment is GOOD on a real master is the one
open question, and it is measured, not assumed — §5's court, before the flag moves anywhere.

Sign carrying the edited outfit into the signed views is **#2565's territory** (in flight,
PR #2571) and deliberately not this card's.

## 3 · The disappearing-technology gate, answered in this body

1. **What must the customer learn to use this?** Nothing. The box they already use stops
   refusing one category of ask. No mode, no control, no new surface.
2. **What decision does it put in front of them, and do they have a basis?** None new. They
   already decide what to type. There is no garment picker and none is wanted — the words
   are the control, and a picker here would be a decision placed before the button.
3. **Where does the technology show?** Nowhere new. One refusal sentence becomes *more*
   honest (it stops claiming wardrobe belongs to a later step). No engine name on any path;
   the loader's stage words are unchanged (*"rendering"* names what happens to the picture,
   `refineService.ts:7497`).

## 4 · The wall — what actually changes in the code, and why it is five places

The capability is withheld today by **one value**: `bornPathsServing: "wardrobeOnly"` at
`subjectCards.ts:836`. `SERVED_SUBJECTS` derives from it (`refineSubjects.ts:283`), the
interpreter's guidance string derives from that (`refineInterpreter.ts:141`), and the
stage-word lexicon backstops it in five places. The subject card itself is **complete** —
nouns, qualifier, replacement amplitude, `plural: false` (an edit REWRITES the one stored
wardrobe line; `deltas.free.wardrobe` is the carrier, no column, no migration — fable-1455
Q2), `admittedOn: "repaintOnly"`, which since #1577 slice 4b describes every refine there is.

**The lexicon splits in meaning, not in membership.** `STAGE_WORDS` (`refineDelta.ts:1157`)
today holds two populations in one list: the shoot (`backdrop, background, wall, studio,
set, scene, location, prop, chair, table, holding`) and the wardrobe (`coat, jacket, shirt,
dress, suit, hat, scarf, wearing`). The design keeps **one lexicon with two named halves**
— scenery and garment — and adds a **per-subject licence** in the exact shape the accessories
subject already has (`ACCESSORY_ALLOWED`, `refineDelta.ts:1171`): where the filed subject is
`wardrobe`, the garment half does not fire; the scenery half fires everywhere, always. So
*"a coat against a red backdrop"* still refuses on `backdrop`, filed under any subject.

The five sites, one decision each:

| site | today | with wardrobe served |
|---|---|---|
| `refineDelta.ts:1157` (the lexicon) | one flat list | same members, two named halves; garment half gains nothing and loses nothing |
| `refineDelta.ts:1602` (wall b, parsed values) | any stage word in any value refuses | wardrobe-subject values are licensed for the garment half; scenery half still refuses |
| `refineInterpreter.ts:1636` (the backing check) | a model stage-claim backed by ANY lexicon word stands | a claim backed only by a garment word is a misfile once wardrobe is served → the existing one re-look fires, exactly as an unbacked claim does today |
| `openLaneAccept.ts:231` (collision) | a garment noun colliding = the stage wall's sentence | with wardrobe served, a garment collision is a routing miss (the interpreter should have filed it closed) → refuse as `collides`, logged, never the stage sentence |
| `openLaneAccept.ts:283` (open-lane scenery) | garment noun in key or words refuses as scenery | garment half deferred to the collision answer above; scenery half unchanged |

**And the one arm that matters most is the negative one**: a flag-on test proving `backdrop`,
`set`, `prop`, `chair` and `holding` still refuse on every one of the five sites, because the
scenery half of this lexicon is the only thing standing between an outfit edit and a paid
edit that repaints the room.

**Headwear joins the subject.** The wardrobe nouns (`subjectCards.ts:815–820`) never held
`hat` or `scarf`, so *"add a beanie"* would keep refusing while *"add a hoodie"* works — a
distinction no customer has any basis to predict, which is the gate's question 2 failing.
Both words move from the garment half's refusals into the subject's nouns in the same act.
The noun list stays deliberately incomplete beyond that — the model files any garment word
under the `wardrobe` subject key (the nouns exist for routing and collision, not as a
whitelist), which is N3's own ruled principle: no fixed lists in a fluid editing
application.

## 5 · The court — slice 0, before the flag moves anywhere

There is no road to choose (one engine since #1577 slice 4b), so the court measures
**quality**: does a worded outfit change land on a real master with the person, pose, light
and set intact?

- **Arms**: change / add-a-layer / remove-a-layer / colour-specific fabric, on three of his
  production masters (the #801 pattern), through the repaint's own engine factory
  (`createFalMaskedEditEngine`) with the recipe shape the build will send — the product
  entrance still refuses outfits until the flag exists, and the court must not wait on the
  build.
- **Cost and latency, stated**: ~16–24 engine calls at the measured $0.015–$0.03 band
  (`castingCreditCosts.ts:276`) ≈ **under $1** of house money plus cents of text — far under
  the threshold, so it runs without asking and the actual is read from the provider's books.
- **His eye closes it** (law 9): the strip on his Desk, old outfit beside new, before the
  flag leaves `off`. Running the arms is execution (#541 rule 3) — an Opus seat runs them;
  the arms are fixed here so nothing about what he judges is designed downstream.

## 6 · The prompt, the pin, and the measured risk

Serving wardrobe adds one word to the guidance string in **every** interpreter call
(`refineInterpreter.ts:141`), and this program's own measurement is that prompt context is
not additive — a SUBSET of context raised the stage wall twice as often as its superset
(`refineSubjects.ts:293–301`). The shipped prompt is pinned by sha256
(`refineOpenLaneClause.test.ts`), and that pin has already caught this exact addition once.
So:

1. The flag-off prompt stays **byte-identical** to today's shipped prompt — the pin holds
   unmoved for every account outside the scope.
2. The flag-on prompt is pinned as a second arm the day it is written.
3. **Before the flag widens past `users:1`**, the wall rate on *unrelated* asks is measured
   on both prompts over the existing corpus fixtures, and the before/after numbers go on the
   card. A raised wall rate on non-outfit asks is a stop, not a footnote.

## 7 · The flag

`CASTING_OUTFIT_EDIT_SCOPE`, child of `CASTING_V2_SCOPE`, standard boot guard (a child
naming users outside its parent refuses boot). It gates exactly one thing: whether the
requesting account's interpreter serves the wardrobe subject — `SERVED_SUBJECTS` stays the
constant base and the serving becomes per-request where the flag says so, so flag-off is
byte-identical by construction, not by promise. Road: dark → `users:1` → his eye on real
edits on his own account → `all` on his word → **the flag retires** (N2's law: flags go
home). The flag's catalogue entry, capability-atlas rows and
`productionFlagPositions.mts` line ride the same commits that create and retire it.

## 8 · Slices, in order (build starts only after he has seen this design)

0. **The court** (§5) — house money, his eye on the strip. Can run immediately.
1. **Serve + walls + copy**, dark behind `CASTING_OUTFIT_EDIT_SCOPE` (§4, §7): the one
   subject value made flag-conditional, the licence at the five sites, the rewritten stage
   copy and its law-7 sweep, both prompt arms pinned, the scenery-still-refuses arm. ⚠ This
   slice waits on **#2565 slice 1** (his word on #2544): an outfit edit must compose from
   the pristine master + current description, not stack.
2. **`users:1`** + the §6 wall-rate measurement + his eye on real outfit edits.
3. **Widen on his word; retire the flag.**
4. Garment **kept-item rows** arrive through #2566 and #2565 slices 2–3 — their cards, not
   this one.

Not in scope, each already owned elsewhere: Sign carrying the edited outfit (#2565,
PR #2571); garment *reference pictures* (#14 marries into #2565's selector); the panel
(#2532/#2566); the Refine cost investigation (#1689).

## 9 · Deliberately absent, so nobody re-asks

- **A new price, operation or refund key** — his word; §2b.
- **A mask or region** — the repaint repaints the whole frame; a regionless facet routes
  full-frame by design (`maskedRefine.ts:1029`, D-233); `harvestRefinement` has no
  production caller.
- **An engine choice** — one refine road exists (`refineService.ts:7471–7498`).
- **A garment picker, wardrobe library or outfit presets** — the words are the control
  (§3). A library of kept garments emerges from #2565 on its own design, not here.
- **An undressed state** — `departable: false`; a removal rewrites the outfit (§1).

One stale docblock found on the way and left for slice 1's commit (doc-only, same files):
`repaintRender.ts:39` still reads *"Nothing calls this yet. It lands dark by having no call
site"* — it has been every refine's renderer since #1577 slice 4b.
