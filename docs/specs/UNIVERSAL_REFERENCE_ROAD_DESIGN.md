# BUILD TWO — the universal reference road (arrow 5)

*Design filed for review before any code (fable-1055 §2). Spec is the founder's
own, across fable-1047 / 1048 / 1050 / 1051.*

> *"you put a small link take makeup from a photo???? this is stupid, you should
> be able to upload any image like grok and use it as a reference for anything"*
> — the founder, 2026-08-19

> *"things which would carry fine as words alone such as makeup or hair color
> stay as words but specific looks and feature must always ride as cropped
> refrences. from the reference photo supplied."*

---

## 1. What exists today, read at the code — three doors, none of them his

**(a) The makeup link.** `castingV2.reference.readMakeup` takes `imageBase64`,
asks a describer four named cosmetic surfaces, composes a sentence and
**discards the bytes**. No object, no row, no purge path. The client shows it
behind `config.makeupFromReferenceEnabled` as the text link he called stupid
(`MAKEUP_READ_ACTION = "Take the makeup from a photo"`, `RefinePanel.tsx:256`).

**(b) The ink upload.** `castingV2.ink.upload` stores OUR copy of the design
under the candidate's purge path, capped at 8 per Cast, against a closed
placement vocabulary and a declared intent.

**(c) The refine ask itself carries no image at all.** `castingV2.refine`'s
input schema (`routes/castingV2.ts:926`) is `instruction` + five optional
scoping fields, all strings. **There is no reference lane into a refine.** That
is the hole this build fills, and it is why the two doors above exist as
side-channels rather than as parts of one road.

**(d) The intent vocabulary is already the founder's law**
(`shared/referenceIntents.ts`): four intents, each with a FORM —
`tattoo: mannequinPlate` (now deferred, fable-1053 §2), `hair: crop`,
`makeup: words`, `eyeColour: crop` — and an `open` flag saying whether that form
is built. Today exactly one form is built (`makeup: words`) plus the ink upload.

## 2. THE SHAPE — one attach, one sentence, the interpreter routes

```
[+] attach ──► reference.attach ──► our copy under the candidate's purge path
                                    (the ink door's storage discipline, reused)
                                    returns a handle: referenceId
       │
       ▼
  refine({ instruction, referenceId })
       │
       ▼
  the INTERPRETER, told an image is attached, answers WHAT IS BEING TAKEN
       │
       ├── carries fine as words  ──► one describer read, scoped words ride,
       │                              bytes discarded (the makeup contract)
       ├── a specific look/feature ─► segmentation cuts THAT REGION ONLY,
       │                              the crop rides as a carrier
       └── the product cannot yet ─► an honest sentence on the surface
```

**The attach is its own door, not a field on `refine`.** Three reasons, and the
first is decisive: `refine` is a **spendable** procedure behind a generation
rate limit, and hanging a multi-megabyte base64 on it makes every paid ask carry
an upload. Second, the chip must appear in the box the moment she attaches —
before she has typed the sentence — so the upload cannot wait for the ask.
Third, an attach that stores its own copy inherits the ink door's purge path,
cap and provenance for free rather than inventing a second discipline.

**One reference per ask** to start. The founder's examples are all singular, and
a second reference doubles every question below (which crop from which photo,
which sentence scopes which) for a case nobody has asked for.

## 3. THE ROUTING — the founder's law, and where it is decided

His law is *properties that carry fine as words stay words; specific looks and
features ride as cropped references*. That is a judgement about the ASK, and the
only component that reads the ask is the interpreter.

**So the interpreter gains one input and one output.** Input: *an image is
attached*. Output: a `reference` reading naming the INTENT (which of the four,
or none) and, for a crop, the region to cut. Everything downstream —
`referenceIntentEntry(intent).form` — is the existing derived map, so a form
that ships later changes one flag and the road follows (law 4, and the reason
`intentNotThisDoor` was built derived rather than as `open:false`).

**The clarifying question is part of this build, not beside it** (fable-1047 §3,
amended fable-1048): *colour, style, or full look*. Colour composes the WORDS
sentence; style and full look compose the crop — and the style answer's sentence
**claims the cut and explicitly not the colour**. Its test is red-first at the
wire: a style-scoped ask whose outgoing prompt mentions the reference's colour
is the failing case.

**A refine has no conversation turn today.** The panel has one adjacent shape —
the outstanding question the `answering` field resolves (D-180: the client sends
the SENTENCE, the server re-derives what was asked, so a client cannot invent an
option). **The clarifying question rides that existing mechanism.** Building a
second question channel beside it is the second-list defect with a UI on top.

## 4. THE CROP — segmentation, region-only, and the face

**The tool is the one the product already runs on her own frames**
(`falRegionReader`, the segmenter behind the face scan). The subject is
different — a photograph she uploaded rather than a frame we rendered — and the
question asked of it is the same one: *where is the hair in this picture*.

**The face never rides, and it is met by CONSTRUCTION rather than by a filter.**
A hair crop is the hair region's own cutout; a tattoo crop is the tattoo
region's. Neither is a rectangle containing a face, and the fidelity law's
named violation is exactly the rectangle that would be. **`crop-holds-the-region-
it-depicts` governs**: the carrier pins the region it PICTURES, not the property
its words label.

**And this is what retires the ink tripwire** (fable-1052 §2): once a design
reaches the mint as a cut region rather than as the raw upload, the sentence
*"uploads ride uncropped to the mint"* stops being true and the `users:1` bound
is no longer holding anything. **The tripwire's retirement is a deliverable of
this build and is not assumed by it** — it retires when the crop road is the
only road to the mint, not when the crop road exists beside it.

**Refusals are honest and free.** A segmenter that finds no such region, a crop
that fails its completeness guard, an intent whose form is not built — each
answers with a sentence naming what it could not do, and none of them charges.
`false-pass-guard`: an affirmative without a `saw` is not a reading.

## 5. CAPABILITY HONESTY IN THE REPLY (fable-1051 §3)

The box is **always there** and takes **any** image. Where the road cannot yet
serve the take, the answer is a sentence on the surface — never a hidden
control, never a disabled one, never silence. Two shapes:

- *"I can take her hair from this — colour, the style, or the whole look?"* —
  the clarifying question;
- *"I can't take a nose from a photo yet. I can take hair, makeup, eye colour or
  a tattoo design."* — the honest refusal, naming what it CAN do, derived from
  `openReferenceIntents()` rather than typed into the copy.

## 6. THE BOX — the UI, sketched against the design system

**One control, no toolbar.** A `+` glyph at the left of the ask box's own row
(where a stylist's hands already are), 20px, the same weight as the box's other
affordances. No label, no tooltip chrome, no second row of icons.

**The chip is IN the box, above the input** (his Grok reference): a 32px
rounded-square thumbnail of the attached image, its filename never shown, one
`×` to remove it. Monochrome frame at `--token` border, no drop shadow, no
coloured accent. Restrained and editorial: the picture is the only colour in it.

**The makeup link is deleted** — `MAKEUP_READ_ACTION` and its call site — and
its behaviour survives inside the universal road, which is the point of the
re-skin: *the UI unifies the door, not the rules behind it* (fable-1051 §c).

**Evidence pack before his eyes** (the UI milestone contract): shipped-vs-design
screenshots per surface in BOTH themes, plus a copy audit classifying every
visible string, with the law skim to Fable DURING rather than after.

## 7. THE YES BAR (fable-1055 §2)

1. the ingestion courts pass **red-first** — attach, route, crop, ride;
2. **the face-bearing reference produces a crop with zero person content, at the
   frames, in front of the founder** (fable-919 §3 — the court the interim gate
   would have disarmed, which is why it was refused);
3. the style-not-colour split proven at the wire;
4. the honest-refusal sentence driven for an unbuilt intent;
5. the UI evidence pack, both themes, law skim to Fable;
6. **the tripwire retires** — and only if §4's condition is met.

## 8. WHAT I AM PUTTING TO REVIEW

**(a) Attach door vs. inline bytes.** I recommend the separate door (§2). It
costs one more procedure and one more storage discipline to review; inline costs
every paid refine an upload payload.

**(b) Does the attached reference survive the ask, or die with it?** The ink
door KEEPS designs (8 per Cast, purged with her Cast). A universal attach could
keep the image (so a second ask can reuse it) or discard it after the ask (the
makeup contract, minimum retention). **My recommendation: KEEP, under the
candidate's purge path** — because a crop minted from it becomes a library
carrier that must be re-derivable, and because "attach it again" is exactly the
friction he was complaining about. But it is a retention decision and it is
yours before it is built.

**(c) Which intents open first.** `hair` (his own example, and the clarifying
question is specced) or `tattoo` (the door is live and its tripwire is waiting
on this). I recommend **tattoo first** — it is the one with a live exposure
bounded by a tripwire, and closing it retires that bound; hair follows
immediately with the clarifying question. The founder's deferral of the
MANNEQUIN (fable-1053 §2) does not defer this: with plates parked, an uploaded
tattoo carries as an ordinary cropped reference on the carrier road, which is
his step (v).

**(d) Cost per attach — RULED "price first" (fable-1063 §4), PRICED 2026-08-19,
and the answer corrected my own estimate.**

Measured at the wire on one real read (`price-attach-read-disposable.mts`,
`withCallCensus` over the shipped `readMakeupFromReference`, tokens off the
provider's own `payload.usage` rather than off the balance — which lags, and was
eight-fold wrong the one time this program trusted it):

```
openrouter/anthropic/claude-sonnet-5  read/describe  2528 in / 75 out
  in  2528 × $3.00/M  = $0.007584
  out   75 × $15.00/M = $0.001125
  ONE ATTACH READ     = $0.0087    (upstream rate; OpenRouter's margin on top)
```

**Two corrections to the modelled figure this replaces**, both in the same
direction and the second larger than the first:

- the modelled $0.021 was **2.4× high**;
- the crop road's segmenter calls were counted against the OpenRouter balance.
  **They are fal calls.** The two houses are not one purse, and a court's
  exposure has to be stated per house or it is not stated.

```
                    modelled            measured / corrected
per attach, words   ~$0.021             $0.0087            OpenRouter
per attach, crop    folded in above     $0.005–0.015       FAL
a ~30-attach court  $1.05–$1.50 (OR)    ~$0.35 OR + ~$1.15 fal
share of $5.48      20–27%              ~6%
```

**So the courts are NOT what threatens the balance; the balance is.** $5.48 of
$210 is 2.6% remaining on the transport that reads every customer instruction,
and at zero every paid roll and refine fails at dispatch. The fable-1055 §4 line
went to the founder on that ground, with the court arithmetic corrected on his
card rather than left to be corrected on his desk later.

**(e) A REFUSAL THE DESIGN DOES NOT YET HAVE, found while pricing (opus-785 §3).**

The pricing read handed the shipped makeup reader a photograph of a bald cyborg
— no cosmetics anywhere in it — and it answered, in the makeup vocabulary and
with no hedge:

> *"glowing red iris effect, mechanical seam detailing, prosthetic circuitry and
> metallic implant detailing"*

It read **prosthetics as cosmetics**. Harmless there — the picture was a stand-in
for a token count and nothing was written — but this build hands that same reader
**a customer's own uploaded photograph** and rides its sentence into a paid
render. `CASTING_REFERENCE_READ_OUTCOMES` already has `no_makeup_visible`, so the
vocabulary for the honest answer exists; what is missing is any evidence the
reader reaches it rather than describing whatever it finds in makeup words.

**This is a `false-pass-guard` shape** — an affirmative with no `saw` behind it.

**ORDERED (fable-1068 §4): the words road gains an OUT-OF-CLASS REFUSAL, and it
is driven red-first before the first court.** The reader must be able to answer
*"this is not makeup"* — and each intent's sibling for its own class — rather
than describing whatever it finds in the vocabulary it was handed. It joins §4's
refusal set as a **peer of the segmenter's no-such-region**, not as a nicety
beside it: a reader that answers confidently outside its class, riding a
customer's photograph into a paid render, is the same defect as a crop of a
region that was never there.

**The specimen is already in hand and costs nothing**: the cyborg frame above is
an out-of-class subject with a known-correct answer, so the red-first arm can be
driven the moment the reader is touched.

**BUILT 2026-08-19, and the shape it took is the FIELD.** Not a stricter ask and
not a second read. Read at the code, the defect is not the reader's fault: handed
a cyborg it had exactly two shapes available to it — four cosmetic surfaces and
*is this face wearing makeup* — and **no field in which "these are prosthetics"
could arrive.** A model with no word for what it sees reaches for the nearest one
it has been given. So the ask gained a `subject` field whose closed list NAMES
the out-of-class answers (`prosthetics, mask, body paint, digital effect, injury,
something else`), and `referenceClassGate.ts` reads it before a single surface is
consulted. Structure is the fence — the ink door's own idiom, which is handed no
filename *because there is no field for a claim to arrive in*.

Three arms, three sentences, because they are three different facts: an explicit
out-of-class answer refuses as `outOfClass` (migration 0042 gives the tally its
column value); `nothing` takes the road's existing empty answer; and a reply that
never addressed the question takes `unreadable` — telling somebody *"what's on
that face isn't makeup"* because a transport hiccupped would be a claim about a
real person's photograph that no reader made.

Driven **red-first** (`4 failed | 30 passed` before the gate existed), then
bought on the real reader in both directions — `court-out-of-class-disposable.mts`,
three reads each: **cyborg refused 3/3 · made-up face delivered 3/3.**

**And the first shape of the ask was wrong in a way no suite could see.** It
asked across six lines with a sterner preamble, and on a matched before/after
against the shipped ask — same frame, three reads each, the prior file taken from
a pinned commit rather than rebuilt — the smoky eye went from spoken **3/3 to
1/3**. A class question is not supposed to cost a surface. Tightened to three
lines and one flat list, it reads **3/3 both sides** with the refusal intact. The
lesson is filed where the lines are composed: an announced list is a BRIEF, and
the scolding around it is what made a careful reader quieter everywhere.

The gate is keyed by intent and total over the vocabulary, so **tattoo's sibling
is a compile-visible gap rather than an invented list** — no other road's words
are declared, because no other road has bought specimens for them.

---

## 9. HAIR — what is built, and what HIS OWN SPECIMENS say before a result is bought

*Ordered fable-1077: his specimens are the acceptance corpus, they are preferred
over authored ones, and each one's flags are surfaced HERE before its court
runs. What follows was read by eye from the frames themselves (law 9), not from
a filename and not from a reader.*

### 9.1 Built and deployed dark (`2358ca59`, `CASTING_HAIR_REFERENCE_SCOPE` off)

- **The take map.** Hair is five subject cards since D-142, so a take is a claim
  over facets: `colour` declares `{hairShade}`, `style` is that list read
  backwards, `fullLook` is the total. The disclaimer is arithmetic, not a second
  list, and a future hair card headed COLOUR that the colour take does not claim
  reddens the suite.
- **The clarifying question**, on the existing `answering` mechanism (D-180), so
  no model decides whether to ask and the answer path can rebuild it.
- **The reference lane**: `refine` carries a `referenceId`, resolved with the
  owner in the statement and re-anchored to this Cast.

Not built: the reads, the crop, and the class door ruled in fable-1075.

### 9.2 HIS COLOUR SPECIMEN IS NOT A MULTI-PANEL, AND ITS DIFFICULTY IS SPATIAL

`hair-colour-blocked-sections-copper-platinum-black-silver.png` — ask: **hair
colour only**.

Read at the frame: **one photograph, one person, no panels.** It was filed as
`hair-colour-multipanel-copper-blonde-black.png`, and fable-1077's mapping note
still calls it a multi-panel; both came from a caption and a glance rather than
from the file at working size. It is not a composite, nothing should be built to
split it, and **the file has been renamed** (ordered fable-1079 §1) so the name
stops telling every future reader of the corpus the opposite. `blonde` went with
it: the frame holds FOUR blocked tones, not three, and one of them is a
silver-white the old name never mentioned.

Its real difficulty is harder than the one that was flagged. The colour is not a
blend and it is not one tone — it is **BLOCKED BY SECTION**: a bright
orange-copper fringe panel, a platinum-blonde panel beside it, near-black roots
and lengths behind, and a silver-white section on the far side.

**So "does the reader flatten it to one word" is the wrong bar, and a reader
that passes it can still be completely wrong.** *"Copper, blonde and black"*
names every tone in the frame and describes a different head entirely — an
ombré, a balayage, anything. **The colour take's words have to carry WHERE each
tone sits**, or they are not a description of this reference. That is a real
constraint on the hair reader's slot contract and it lands before the reader is
written, which is the point of surfacing it here.

The `hairShade` card's own vocabulary already reaches for the right words —
`hair colour`, `highlights`, `roots` — so the slot is not being invented; it is
being asked for placement it has always implied.

### 9.3 HIS STYLE SPECIMEN IS A GENUINE TWO-PANEL, AND IT IS TWO HEADS

`hair-style-dark-waves-two-panel.png` — ask: **hair style with a different
colour, carried through multiple edits without drift.**

Read at the frame: a vertical stack of **two photographs of the same man** — a
profile above, the crown and fringe from a downward three-quarter below. Dark,
near-black, soft-waved, volume through the top, swept fringe.

**Two flags, both about the crop rather than the words:**

1. **The segmenter meets TWO heads in one frame.** *Where is the hair* returns
   either one panel arbitrarily or a union spanning both with a white bar
   through the middle — and **a union of two heads is not a hair crop**, it is
   two crops and a gap, carried into a repaint as if it were one head of hair.
   His order is explicit that this shape is handled and not rejected, so the
   crop road needs a panel decision — connected components, and a stated rule
   for which one carries — designed and reviewed before the first crop is cut.
2. **The reference is a MAN and the Cast may not be.** The take's ride-along
   sentence says *"Take HER hair from the reference"*, and that is correct as
   written: the pronoun is the CAST's, because a reference is a source and never
   a subject. Stated here so it is not later "fixed" into agreeing with the
   photograph, which would be the reference quietly becoming the person.

And the ask itself is the corpus's centrepiece for a reason: **style WITH a
different colour is exactly the split ruling 5 scopes**, and *carried through
multiple edits without drift* puts the carry court on top of it. The
style-not-colour assertion at the wire is the first half; the drift court is the
second, and it needs the `carry-noise-floor` bought before any figure from it
means anything.

### 9.4 The class door, as ruled (fable-1075) — not yet built

Measured, four specimens, both directions: **hair does not have makeup's
out-of-class defect.** Handed the cyborg — the very bytes on which the makeup
reader called prosthetic circuitry a look — a bare hair reader answered
`present: "no"` with every slot null, 2/2; so did a golden retriever, 2/2.
**A presence question anchored on a body part is a gate; one anchored on a
judgement is a prompt.**

It has a different defect, in the one place a presence flag cannot help: a
**salon illustration** — ink and gouache on paper, pencil construction lines
showing — answered `present: "yes"` and described *"copper red with auburn
tones", "long length, center part, face-framing", "wavy", "down"*, 2/2, with no
hedge.

**It ROUTES, it does not refuse** (fable-1075 §1): 1052 forbids a reader's
photo-versus-drawing verdict that turns a customer away, and tolerates one that
only narrows the lane. So the drawn answer may refuse the CROP takes — a drawn
look cannot be carried onto a photograph faithfully — and **never the WORDS
one**, because a colour read off a drawing is honest. Three riders ship with it:
the refusal copy is humble and two-part, offering the words road in the same
breath; the outcome is counted so a false-positive rate has a signal; and **the
false-positive court ships FIRST** — a real, stylised, heavily-retouched
photograph must read through before the door is live anywhere.

### 9.5 THE COLOUR TAKE'S WORDS ROAD — built, and what its court measured

`server/castingV2/hairColourFromReference.ts`, approved fable-1080 §2/§3.

**The contract is a SECTION LIST, and it is spatial by construction.** The
reader does not answer a `colour` string. It answers a list of pairs — a tone,
and where that tone sits — so **there is no field a tone can arrive in without a
place.** §9.2's wrong answer (*"copper, blonde and black"*) has nowhere to go:
it is either one section claiming to be all over, which is visibly false and is
a readable failure, or it is a section with no place and is dropped. The
instructed version of the same rule is the thing `refineDelta` calls not a rule
at all — *a rule enforced only by asking nicely.*

The ordinary head is the same shape with no special path: one section, `where:
"all over"`, composing to *"chestnut brown all over"*. The `where` field carries
its own preposition, which is what lets one join serve both — and a reader that
answers a bare `"fringe"` degrades to *"copper fringe"*, still English and still
carrying the place.

**One door, and it is the measured one.** The presence gate, anchored on the
body part. No class question: fable-1075 rules that hair's drawn-versus-real
verdict may narrow away the CROP takes and **never the WORDS one**, and this is
the words one. The drawn detector ships with the crop, false-positive court
first.

#### What the court found (`court-hair-colour-words-disposable.mts`, 10 calls, $0.076842 at the wire)

Five arms, two runs each, driving the SHIPPED reader — not a copy of its ask.

**PASSED, and one of these could have killed the design:**

- **The invention control clears.** A contract demanding a place for every tone
  is a contract that could push a reader into finding panels in a plain head.
  The one-tone studio portrait came back as **one section, twice** —
  *"deep black all over"*. The ordinary head is not made strange to buy the
  strange one its words.
- **The gate holds through the PRODUCT**, not merely through a probe: the
  retriever and the cyborg refuse `noHairVisible` 2/2 each.
- **The drawing delivers 2/2**, which is fable-1075's routing as code.
- **On his own head, every tone came back with a place**, and read against the
  frame by eye (law 9) each pairing is true of the picture.

**AND THE BUDGET STRANGLED, 4 RUNS OUT OF 4.** Every run on his specimen dropped
at least one block of colour. Run 1's own answers need 126 characters against
the destination's 120 — six characters, and a block of his hair goes back to her
as text instead of riding in the sentence. This is `makeupSlots`' incident
happening in a new place; the difference is that his specimen met it before a
customer did.

**The stated rule for which sections are spoken for** (reserved fable-1080 §2,
so it is named rather than improvised): **the reader's own prominence order.**
The ask instructs *"work from the most obvious block to the least"*, the
composer consumes the list in that order, and the suite pins it. It is the
reader's answer to a question we asked — not measured area, and not our
judgement about her hair.

The field caps were deliberately NOT narrowed to force four blocks to fit.
An announced cap is a brief, so buying the fourth block that way costs *pale*,
*orange* and *at the ends* on all four. **A dropped block is returned to her and
she can type it; a flattened one is gone and nobody is told.**

#### The open finding: "one side" is not a place a repaint can use

The `where` answers reach for unanchored side words — *down one side*, *down the
other side* — and twice in one sentence two different tones both landed on *down
one side*, a contradiction in prose even though both are true of the frame.

This road already owns the answer: the engine paints by position rather than by
anatomy, which is why `sidePhrasing.imageHalfClause` exists and why the eye
edits say *"(on the left of the picture as you look at it)"*. **Not built** —
whether a colour block's side is the same fact as an eye's is a ruling, not an
implementation detail, and it is out with the reviewer.

#### One honest limit on the court itself

It cannot see a section the fence DROPPED, because the drop happens inside the
reader. So *"every tone came back with a place"* is a statement about what
reached the sentence, not proof the reader never wrote a placeless one. The
reader now logs its refused sections with the raw reply, so the next run of this
court reads the fence's own firing rate rather than inferring it.

### 9.6 The corpus, as corrected and extended

Six specimens now, and two entries below correct what fable-1077 first recorded.
Each was opened at working size before its line here was written.

1. `tail-scorpion-fashion-photo.png` — **tail**. Open-kind crop from an upload,
   region-only.
2. `hair-style-dark-waves-two-panel.png` — **hair style with a different
   colour, carried through multiple edits.** A genuine two-panel, and §9.3 is
   the reading: it is TWO HEADS, so the crop road owes a panel decision before
   the first cut.
3. `tattoo-sleeve-trex-geometric-design.png` — **sleeve tattoo, left arm,
   through signing.** Flash art with an artist monogram; `sleeve` is outside the
   placement vocabulary and is a demand-backed card, never a silent map to
   `upperArm`.
4. `glasses-cateye-blond-model.png` — **glasses.** Outside the intent
   vocabulary; this specimen tests the honest refusal road.
5. `hair-colour-blocked-sections-copper-platinum-black-silver.png` — **hair
   colour only.** *Renamed* (fable-1079 §1) from
   `hair-colour-multipanel-copper-blonde-black.png`: it is one photograph rather
   than a composite, and it holds four blocked tones rather than three. §9.2 and
   §9.5 are its readings.
6. `tattoo-patchwork-torso-neck-continuation.png` — **use all these tattoos,
   onto the neck** (fable-1083). *"One more reference photo to test if the
   tattoos will pop out the top of the shirt."* Read at the frame: a barbed-wire
   band at the base of the neck with throat work above it, chest and stomach
   pieces below, both sleeves worked, cropped at the chin. **It carries both
   halves of the visible-extent promise in one specimen** — the neck work MUST
   show above a crew collar, the chest and stomach work MUST NOT — which is
   exactly what `court-view-reference-disposable.mts` now refuses to run
   without. Two things it raises before any render is bought: it is a PATCHWORK
   (many designs in one photograph, and his ask is to use all of them), so the
   crop road must rule one-region-or-many deliberately; and several of its
   pieces are TEXT, which the engines render unreliably, so a court records what
   the text actually came out as rather than scoring the shapes and moving on.
