# BUILD TWO — the universal reference road (arrow 5)

> **Status: built.** Design-time record — the feature shipped (the attach door and hair takes; CASTING_REFERENCE_ATTACH_SCOPE / CASTING_HAIR_REFERENCE_SCOPE); the code and CLAUDE.md govern current behaviour (#69 stamping sweep, 2026-08-28).


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

⚠ **THE LINK AND ITS GATE ARE BOTH GONE — this road removed them, which is the
right ending and leaves §1 describing a door that no longer exists** (fable-1103
§2, 2026-08-20). `MAKEUP_READ_ACTION` and `makeupFromReferenceEnabled` appear
nowhere in `client/`, `server/` or `shared/` except the comment in
`server/routes/castingV2.ts` that records the removal: *"THE TWO READ GATES ARE
GONE WITH THEIR DOORS … There are no per-feature read controls any more — the
reading happens inside the refine road and arrives on its answer — so a gate for
one would be a flag about a control nobody draws."* The paragraph is kept because
the link he called stupid is why this whole document exists.

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

⚠ **TWO FORMS ARE BUILT NOW, AND THE SECOND ONE IS THIS DOCUMENT'S OWN §9.** The
hair CROP form shipped — `hairReferenceTake.ts`, `hairReferenceCutter.ts` and
`referenceWordsLane.ts` are all in the tree — and `CASTING_HAIR_REFERENCE_SCOPE`
stands at `users:1` on production. The count sentence is kept as the starting
line it was; §9.11, §9.14 and §9.15 are where it stopped being true.

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

⚠ **ALL THREE ARE BUILT, AND THIS DOCUMENT SAYS SO SIX HUNDRED LINES BELOW ITS
OWN HEADING** — §9.11 (*THE CUTTER — the orchestration, built
(`hairReferenceCutter.ts`)*), §9.14 (*THE CLASS DOOR, BUILT AND COURTED
(`referenceMediumDoor.ts`)*) and §9.15 (*THE ENTRANCE — the stone nobody had
laid (built, courted 8/8)*). **And the heading's own parenthetical is a day
behind too**: `CASTING_HAIR_REFERENCE_SCOPE` is not `off`, it is `users:1` on
production (`scripts/lib/productionFlagPositions.mts`, the declared table the
deploy rite compares to the service on every push). The section is kept as the
record of what landed in `2358ca59`; what it says about TODAY is what moved.

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

### 9.4 The class door, as ruled (fable-1075) — BUILT, courted 8/8, and wired

*Built as `referenceMediumDoor.ts`, wired into the crop lane, and its
false-positive court PASSED before the wire existed — see §9.14. The ruling
below is unchanged and is what it implements.*

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

### 9.7 THE CLARIFYING QUESTION IS GONE — his second word on it (fable-1087)

> *"i want to simplify adding a hair reference lets not ask the user if they
> want the style or the color etc, if they are vague and say copy this hair it
> just means the whole lot unless they specify do you agree?"*
> — the founder, 2026-08-19

**This supersedes §9.1's clarifying question**, which shipped dark on
`2358ca59` and lived for one day. The question, its builder and its `Reask`
kind are deleted; the take map, the scoped ride-along sentence and the heading
fence are untouched. `hairTakeFor` is the default and it returns the whole lot.

Three reasons, and they belong on the page because the question was argued for
on this same page a day earlier:

1. **Law 8.** A stylist handed a picture and told *copy this hair* copies the
   hair. Reading that sentence as under-specified was the product asking a
   person to speak its own vocabulary back to it.
2. **The sentence is the interface.** A take named in words still routes: *"just
   the colour"* to the words road, *"the style, keep her colour"* to the crop
   with its scoped sentence.
3. **The cost asymmetry.** A question taxes EVERY reference ask, every time,
   before anything happens. Guessing wrong costs one follow-up edit on the
   minority that meant a facet and did not say so.

**`hair.open`'s gate restates accordingly** (there are no answers to act any
more): hair opens when the FULL-LOOK road and the two worded takes all act.

#### The open edge, named rather than left to be discovered

*"Copy the hairstyle but keep her colour"* — the founder's OWN sentence from
fable-1048 — names `style` and `colour`. Two takes at once counts as neither,
neither is now the whole lot, and **the whole lot takes the colour his amendment
exists to protect.** The rule was right while the fallback was a question and
became wrong the moment the question was deleted.

It is pinned in the suite by name and marked by `hairTakeIsAmbiguous`, not
fixed, because every candidate fix is a different guess:

```
  first-named wins       "style but keep her colour" → style   ✓
                         "the colour and the cut"    → colour  ✗
  smallest claim wins    his sentence                → colour  ✗
  read the negation      a phrasing list (D-163 outlaws the class), or a model
                         read, which is a different design
```

Nothing is exposed while it is open: the flag is off and absent means off.

### 9.8 OWED COURT ARMS — filed, not yet run

**REGENERATE MUST RE-SEND THE ORIGINAL REFERENCE** (ordered fable-1086, from a
founder question). The design answer is that regenerate is replace-in-place
re-running the SAME ask against the SAME parent state, so the ask holds its
`referenceId`, the recipe re-composes with the ORIGINAL crop, and the failed
attempt's harvest dies with the picture it came from. **The reference keeps
riding until a delivery is KEPT.**

That is reasoning, and this seam is where this product's bugs live — the
reference lane meeting the carry system, the family that produced
`fact-written-under-another-flag`. So it is PROVEN, red-first, with the crop
road's courts:

1. a regenerate after a reference-steered edit re-sends the original reference
   crop **on the outgoing recipe**, asserted at the wire;
2. and does **not** carry the replaced version's harvested hair.

If the behaviour differs from the design answer above, that is a FINDING before
it is a fix.

**THE DRAWING'S QUIETNESS** (ordered fable-1088 §4). Between the two asks the
salon illustration went from three blocks to one. n=2 each way, so it may be
nothing — but the shape is the one `referenceClassGate` already paid for: a
longer, sterner ask made a careful reader quieter everywhere, and the new ask
gained five lines. **Four reads, settled WITH hair's final courts, before
`hair.open` ever flips.** Not chased on n=2 now; not shipped unexamined either.

### 9.9 ORDERING — where the outfit work sits (founder, fable-1085)

> *"whats the current pipeline look like id like to park this test right at the
> end"*

The outfit/wardrobe thread — the default tee, a prompt-named outfit honoured as
a lock and carried into signing, under-clothing ink flipping the register, and
the consistency court that must precede any promise about free-typed outfits —
**parks at the END of the current pipeline**: after the colour hardening, the
hair crop road, hair opening, the drift centrepiece, tattoo routing and its
courts, the attach UI and build two's YES bar, and build three.

It is not ruled final. He has the three-rule shape and the easy-versus-difficult
read (accepting is easy; per-view consistency is the unknown, evidenced by the
trousers finding) and parked it deliberately. **Seats inherit this order;
nothing about the outfit work starts until the pipeline ahead of it is done or
he reorders.**

### 9.10 THE PANEL DECISION — owed before the first crop is cut (§9.3)

*Design only. Nothing here is built, and §9.3's order is explicit that it is
reviewed before a crop road exists to use it.*

His style specimen is a vertical stack of **two photographs of the same man** —
a profile above, the crown and swept fringe from a downward three-quarter below.
Asked *where is the hair*, a segmenter returns either one panel arbitrarily or a
union spanning both with a white bar through the middle, and **a union of two
heads is not a hair crop.** It is two crops and a gap, carried into a repaint as
if it were one head of hair.

#### THE OBVIOUS RULE IS WRONG, AND HIS OTHER SPECIMEN IS THE COUNTEREXAMPLE

The rule that suggests itself is *count the connected components of the hair
mask; more than one means a composite.* **It is wrong, and the frame that
convicts it is already in the corpus.**

`hair-colour-blocked-sections-copper-platinum-black-silver.png` is ONE
photograph of ONE woman, and her hair hangs down both sides of her face. A hair
mask over that frame is at least two components separated by a face. Pigtails,
bunches, a centre-parted curtain and half-up styles are all the same shape.
**Counting hair components cannot tell two panels from one head**, and a rule
that mistakes her for a composite would throw away half of a customer's
reference in the ordinary case.

Nor is it the mask's fault. The discriminator is simply not IN the hair mask:
what separates two panels is background, and what separates two hair components
on one head is a FACE.

#### THE HEAD-COMPONENT DISCRIMINATOR WAS PROPOSED, RATIFIED, AND IS WRONG

The proposal was *count the components of the HEAD mask* — a face that splits a
hair mask is part of one connected head, while two panels are two heads with
background between them. It was ratified (fable-1090 §1) on the strength of the
argument. **Then it was run, and the frames said no**
(`probe-panel-discriminator-disposable.mts`, four segmenter calls, house money):

```
  his STYLE specimen  (736x1309, genuinely two panels)
    head   1 component  101051px  box 476x424 at (125, 18)
    hair   1 component   99859px  box 479x425 at (123, 18)

  his COLOUR specimen (736x981, one woman)
    head   1 component  158146px  box 476x498 at (146, 14)
    hair   1 component  183157px  box 560x721 at (74, 14)
```

**The composite answered ONE head, and that head is the TOP PANEL ONLY** — 424
pixels of a 1309-pixel frame, confirmed by cutting the box out and looking at
it. So the discriminator cannot fire: the composite and the single portrait give
the same answer.

The reason is already on the record — **a segmenter answers a CLASS with an
INSTANCE** (`ask-what-cannot-be-answered-wrong`). Asked *where is the head* on a
frame holding two, it returns one and says nothing about the other.

**And the counterexample was wrong as well.** Her hair was supposed to arrive as
two components split by her face. It arrives as ONE, because hair on both sides
of a face joins over the crown. Both halves of the argument were mask arithmetic
reasoned about rather than looked at — law 1, at my own desk, twice in one
section.

#### WHAT THE SEGMENTER'S REAL ANSWER MEANS, which is the finding that matters

§9.3 feared a union spanning both panels with a white bar through it. **That
shape does not occur with this reader.** What occurs is quieter and worse: the
reader picks ONE PANEL and nobody is told. A carrier cut from a customer's
two-view reference would be half her reference, chosen by a model, with no
record that a choice was made — the no-silent-caps class rather than the
corrupt-carrier class.

#### THE DISCRIMINATOR THAT WORKS IS FREE, AND IT IS NOT A MODEL

A composite is two photographs butted together, so **the seam is a row (or a
column) where the picture stops being continuous** — measurable in image space
with no model at all: the mean absolute difference between one line of pixels
and the next, against the frame's OWN median line-difference.

Measured over the whole corpus, five frames, one composite and four controls:

```
  frame        median   strongest interior line          read
  style          3.60   y=661   98.7   27.4x median      SEAM ← dead centre
  colour         5.80   x=159   15.1    2.0x median      no seam
  tail           3.42   x=451   18.3    3.8x median      no seam
  glasses        2.04   y=502   13.6    6.7x median      no seam
  patchwork      7.61   y=158   21.3    2.8x median      no seam
```

**27x on the composite, nothing above 6.7x on any single photograph.** The
threshold sits at **10x**, in the gap, and it is relative to each frame's own
median on purpose — a grainy scan and a clean studio frame have very different
absolute line-differences and the same seam.

Cutting at `y=661` yields two panels that are exactly the two photographs, which
was checked by writing them out and looking at them rather than by trusting the
number.

**And splitting first is what fixes the silent pick**: the segmenter is asked
once per PANEL instead of once per frame, so both heads are read deliberately
and neither is chosen on our behalf.

##### What it does not settle, stated rather than implied

- **One composite.** A collage whose panels are continuous at the join — same
  background, aligned — would be missed, and a single photograph with a genuinely
  hard horizontal edge could fire it. Both are cheap to add when a specimen
  exists; neither is in his corpus.
- It finds a CUT, not panels, and says nothing about how many heads are in each.
- It does not decide the carrier.

#### THE CARRY RULE IS UNDECIDED, AND THE PRECEDENT I REACHED FOR WAS CONVICTED

§9.3 asked for *a stated rule for which panel carries*, and the first version of
this section proposed that **both panels ride as one sheet**, on the grounds
that the ink road already carries a wrapping tattoo as *"multiple views on the
same sheet, like a character sheet, so it stays consistent from any angle."*

**That precedent does not exist any more, and citing it was the error**
(corrected fable-1090 §2). The wrap court convicted the multi-view sheet
(opus-745): **one neck tattoo arrived as TWO**, because a sheet showing a design
from two angles reads as one design PER VIEW. The founder's single-view ruling
was the fix. So proposing a profile-plus-crown hair sheet is not inheriting a
precedent — **it is re-proposing the convicted shape in a new lane**, and the
only honest thing to say for it is that its geometry MIGHT be innocent here: a
head cannot show its profile and its crown at once the way a neck genuinely
shows a front and a side, so the two views may not be confusable as two heads of
hair. *Might.* Nobody has measured it.

**So the sheet-as-carrier is a HYPOTHESIS and the measurement decides it**
(ruled fable-1090 §3), rather than the measurement being a confirmation run
after the decision. The arms are declared here before anything is bought, which
is the wrap court's own method:

```
  ARM A   the two-view sheet as carrier
  ARM B   the largest single panel as carrier      the control
```

judged on two things, in this order:

1. **one haircut, delivered once** — no doubling, and no blending of the two
   views into a chimera. This is the arm the wrap court failed, and it is what
   the sheet is on trial for;
2. **fidelity to the cut**, against BOTH source views, by eye (law 9).

If the sheet is clean, both panels ride. If it doubles or blends, **the largest
head by mask area carries** — a measurement rather than a judgement — and the
customer is told plainly that the second view was not used.

**Either way the fallback is the same**: a panel that cannot be cut cleanly is
never carried as a sheet with a hole in it, and the ask is never failed for it.

#### WHAT COULD MAKE THIS PROPOSAL WRONG, stated so the review has a target

1. **Two heads may not be one person.** A mood board of three different models
   is also two-or-more heads, and carrying all of them as one hair sheet would
   be carrying three haircuts as one. *Same person* is a judgement, and law 9
   says a reader's verdict on it is a pointer rather than a fact — so a
   sameness test is the expensive part of this design and may not be affordable.
   The honest interim may be a CAP (two panels ride, three or more asks her
   which) rather than a sameness read.
2. **A sheet is a different picture from a crop**, and `crop-holds-the-region-
   it-depicts` says a carrier pins what it PICTURES. A two-view sheet pictures
   two views; whether the engine reads that as one haircut or as two people is a
   measurable question and it is not measured yet. **It is measurable cheaply**,
   which is the argument for settling it before the crop road is built rather
   than after.
3. **The vertical stack is not the only composite shape.** Side-by-side and
   grids exist. The head-component rule does not care, which is a point in its
   favour, but the sheet composition does.

#### Standing — SUPERSEDED, and the block it replaces is kept above on purpose

The section above is the record of how this was reasoned, and two of its
conclusions did not survive contact with the frames. **What follows is what is
true now**, so that nobody builds from a ratification that has since been
withdrawn.

- **(a) the head-component discriminator is WITHDRAWN** (fable-1090 §1 ratified
  it; fable-1091 withdrew it at the frames). Run on his own specimens, the
  composite answered ONE head and that head was the top panel alone — a
  segmenter answers a class with an instance — and the counterexample failed too,
  because hair joins over the crown. **The shipped discriminator is the SEAM**,
  deterministic and with no model in it: 27.4x its own median line-difference on
  the one composite against 6.7x on the loudest single photograph, threshold at
  10x in the gap (`hairReferenceCrop.findSeam`).
- **(b) the carry rule is RULED: LARGEST PANEL CARRIES** (fable-1093 §1, on the
  court's own reading in opus-801). The two-view sheet did not double and did not
  blend — the wrap court's failure did not reproduce in this lane — and it also
  bought nothing a person could see, so it does not earn a second segmenter call,
  a composition step, an ordering rule and a cap. The panel holding the most hair
  carries, and **the second view's non-use is said plainly to her**
  (`SECOND_VIEW_UNUSED_NOTE`). The sheet's re-audition is tagged to the length
  question: if length ever proves view-dependent, it returns to trial with its
  repeat.
- **(c) the measurement RAN**, arms as declared, before anything shipped.
- **AND THE CARRIER PICTURES ITS OWN SCALE** (ruled fable-1094 §2, from the
  length court in opus-802). A hair cutout on transparency lost the length on
  every arm; with the length words held constant the plain carrier still came
  back short 2/2 while the scale carrier went long 2/2. So the hair rides on the
  head's **redacted form** — the `face` region minus the hair, flat-filled, no
  face at all — and a carrier whose form is a rounding error is REFUSED rather
  than sent (`carrierPicturesScale`, floor at 10% of the hair's own area). The
  region is asked as `face` and not `head` because the head answer IS the hair
  (99,677px against 99,220px), which was read before a render was bought.
- **The two-panel cap stands and is now structural**: the seam finder returns one
  cut or none, so a frame is one panel or two and there is no path on which three
  arrive. The mood-board residual (2+ heads may be 2+ people, and sameness is
  law-9-expensive) is unchanged and still deferred.

### 9.11 THE CUTTER — the orchestration, built (`hairReferenceCutter.ts`)

The geometry above is pure and drives for nothing. The cutter is the half that
spends money and can go wrong: which questions are asked, of which picture, in
which order, what is refused, and what is written.

```
  1. decode          one greyscale read, for the seam alone
  2. the seam        findSeam / panelsOf — deterministic, no model
  3. hair PER PANEL  the step that fixes the silent pick
  4. the carry       most hair carries; the second view's non-use is SAID
  5. the scale       `face`, on the carrying panel only
  6. compose + GUARD composeCarrierPixels, then carrierPicturesScale
  7. mint            manifest, then bytes — the keeper-receipt order
```

**What it costs: two segmenter calls for one photograph, three for a composite.**
The extra call is what buys a deliberate answer instead of a model's private
choice of panel.

**Every refusal is free** — nothing here is reached after a claim — and they do
not share a sentinel. `noHair` (the reader answered, and the answer is none) is
kept apart from `couldNotRead` (the reader did not answer) by construction: the
hair questions are asked with `absentIsAnswer`, so an empty mask is a reading and
a thrown error is a failure. A mask that is not in its panel's space is
`wrongSpace` — refused, never resampled, because a resample inside the one path
that promises not to have one moves every edge it touches.

**How long a carrier lives.** It is written under a cleanup manifest born HELD
and **nothing discharges it**, so the worker collects it when the hold lapses
unless a caller records a row naming the key. That is the right life for an
ask-scoped artifact: the candidate purge collects by ROW, so an object with no
row would otherwise outlive the Cast it was cut from.

### 9.12 THE WIRE — and the FOURTH REFERENCE ROLE it needed (approved fable-1096)

A recipe reference was one of three things, and a customer's own photograph is
none of them: not the `master`, not an `anchor` (an INTRODUCED item's frozen
introduction reference — and D-244 line 3 gives anatomy no anchor, its anchor is
the master), not a `carry` (minted from a delivery of hers). So the role is a
fourth: **`{ kind: "source"; slot }`** — a picture SHE supplied, for one ask.

The alternative — widening `anchor` to accept an anatomy slot — was rejected:
an anchor meaning both *the thing this feature regenerates from* and *a picture
she attached once* is how a slot loses its meaning three shifts later.

Three bounds ride with it:

- **the assembler writes the sentence**, never a caller. Ordinals are true of
  the array that is dispatched, which is the whole reason the prompt is built
  where the references are;
- **the sentence describes the source HONESTLY** — a redacted-form carrier is
  said to be one, in the scale arm's own wording, because that is the wording
  that DELIVERED (long 2/2 with the grey form described and excluded; short 2/2
  on a plain cutout carrying the same length words). Honesty here is not
  manners, it is part of what worked;
- **per ask by construction**, which is what makes §9.8's regenerate answer true
  by TYPE rather than by care: a regenerate re-runs the same ask, the ask holds
  its `referenceId`, so the source is cut and sent again and the replaced take's
  crop cannot take its place.

#### What the request path now does, and where the money line is

Everything the cut touches happens **before the claim**. In order: read the take
(free — a `colour` take carries as WORDS and buys no segmenter call at all);
ask whether this reading touches hair at all, through the same catalogue the
recipe's asks come from; cut; mint; send. A refusal at any of those returns her
own picture with a sentence and takes nothing, in credits **or** in calls — a
picture with no hair in it never buys the scale question.

Two things are SAID rather than dropped, joined into the same owed-lines list
every other half-served ask travels in: **the second view of a two-panel
reference**, and **an attachment that went unused** because the ask turned out
not to be about hair. Nothing is cut in that second case, so the temptation to
say nothing is at its strongest exactly where D-181's law applies.

**A source is never padded to her frame.** A crop cut FROM this master has a
position to be put back into; a carrier cut from somebody else's photograph has
none, and padding it would place a stranger's head at a coordinate that means
nothing.

#### Still not built, and named

The drawing's quietness (§9.8) and the cross-sex regression arm, both of which
land with hair's final courts before `hair.open` flips.

### 9.13 THE COLOUR TAKE'S WIRE — words, and a sentence she adopts

The crop road carries a specific LOOK. The colour take is the other half of his
general law and it carries as WORDS, so it has no carrier, no cut and no
segmenter call at all: the road takes the handle of a picture she has already
attached, reads it once on house money, and hands back a SENTENCE. (It had a
procedure of its own until 2026-08-20 — see the end of this section.)

**It reads our own copy and takes no upload.** The makeup read next door carries
its bytes in the request because makeup has no attach door — the picture is
looked at once and dropped. Hair does have one, so a second upload of a
photograph we already hold would be a second copy of somebody's picture on the
wire for no reason. The handle resolves through `resolveAskReference`, the same
three questions a refine asks: her account, her Cast, THIS Cast.

**What comes back is a suggestion, and that is what makes it legal.** The
sentence goes to her as words she adopts or edits before anything is charged
(fable-940 bounds 3/4). It is also structural: `refineDelta` requires a free
`hairShade` value to appear in the customer's own instruction, so a reading
routed silently around her would be refused by a guard standing since D-171.
Nothing is charged, the read is rate-limited on the makeup read's own bucket
(the thing being paced is the same thing — reads on our money), and the demand
row records THAT a hair read happened and how it ended, never the sentence.

**Two words of migration came with it** (`0044`): the hair reader's refusals end
in ways the makeup reader has no word for — `no_hair_visible` (its presence gate
said no) and `no_colour_readable` (there is hair and no block of colour could be
spoken for). Two values rather than one, and neither reusing
`no_makeup_visible`: telling a customer her photograph has no hair in it because
a reply came back shaped wrong is a claim about her picture that no reader made,
and a shared word would merge two readers' gates in a tally that exists to tell
them apart. Applied to dev; production takes it by the ceremony script.

**The DOOR is deleted and the reading is not** (fable-1103 §2, 2026-08-20).
`castingV2.reference.readHairColour` existed to be called by a surface, and the
founder deleted the only surface that could honestly call one — so the reading
now happens inside the refine road (§9.16) and the procedure went the way
`isHairTake` went. An export nobody calls is a claim.

**The flag is pinned at the source it now shuts**, because a dark road has no
other arm that could go red: `resolveAskReference` consults it before any
database read, answers with nothing rather than a code that advertises the road,
re-anchors the handle to THIS Cast in the same resolution, and the storage key
never leaves the process.

### 9.14 THE CLASS DOOR, BUILT AND COURTED (`referenceMediumDoor.ts`)

One question — *is this a PHOTOGRAPH taken with a camera, or is it DRAWN* — with
a closed one-word answer, so there is no field for a hedge or for a claim about
the person to arrive in.

```
  photograph   both roads — the crop takes and the words take
  drawn        the WORDS take only; the crop is declined and the words road is
               offered in the same breath, naming the sentence she could type
  unreadable   BOTH ROADS, exactly as if this door were not here
```

**The third row is load-bearing.** A door that narrows on silence turns
customers away on a provider's bad minute — the verdict fable-1052 forbids — so
the licence to narrow comes from a positive `drawn` answer or from nowhere.

#### THE FALSE-POSITIVE COURT — the bar was ZERO, and it passed 8/8

Ruled to ship before the door is live anywhere. Three of the four arms are REAL
pictures, because the failure that matters is not a drawing read as a photograph
(the words road serves a drawing well, 4/4 — §9.13) but a real customer's real
photograph read as a drawing and quietly denied the crop road she asked for.

```
  A  his colour specimen     real, stylised, four blocked tones    photograph  2/2
  B  the retouched portrait  real, smoothed studio frame           photograph  2/2
  C  THE CYBORG              a real photograph of a man in metal
                             prosthetics with one glowing red eye  photograph  2/2
  D  the salon illustration  ink and gouache, pencil lines showing  drawn      2/2

  VERDICT: PASS — 0 misses, 0 real photographs turned away.  $0.053478
```

**Arm C is the court's centre.** A photograph that looks synthetic is the exact
shape of a false positive, and those are the same bytes that fooled the makeup
reader in the opposite direction — it called prosthetic circuitry a cosmetic
look. One specimen catching two readers' opposite defects.

The bar is zero rather than a rate because the cost of one false positive is a
real customer's real photograph turned away from the crop she paid for, and she
has no way to argue with it.

#### On the request path, and what it costs

Asked only once both cheap doors have said this ask wants a crop of her hair: a
non-hair ask and a colour take buy nothing. One vision read of house money per
crop-take refine, before the claim, so every outcome here is free to her.

#### The count is deferred, and named

§9.4 asks for the narrowing to be counted so a false-positive rate has a signal.
The demand column has no value for it, adding one is a migration, and this door
cannot be reached by anybody until the hair flag flips — so the value rides with
that flip in one ceremony rather than sitting on the founder's desk twice. Until
then the narrowing is a log line, said here rather than left to be discovered by
somebody looking for a tally.

### 9.15 THE ENTRANCE — the stone nobody had laid (built, courted 8/8)

**Every sentence this road was built for refused at the interpreter, 1,860
lines before the road.** Found by driving the real `interpretRefinement` before
wiring anything to it, on 2026-08-20:

```
  "copy this hair"                            REFUSED  wall_likeness
  "give her the hairstyle from this picture"  REFUSED  wall_likeness
  "give her hair like this"                   REFUSED  unreadable
  "give her this hair"                        REFUSED  wall_stage
  "take the hair colour from this picture"    REFUSED  unreadable
  "give her the makeup from this photo"       REFUSED  wall_likeness
```

`refineService.ts` throws on `!parsed.ok` long before the reference block runs,
so the cutter, the class door, the carrier mint and every court behind them sat
on the far side of a door that shuts first. The cause is one absence: **the V2
interpreter had never been told a photograph might be attached**, so *"this
photo"* read as a real person and the likeness wall did exactly its job. (The V1
legacy road has taken `referenceAttached` since it was written; the newer road
never did.)

**The clause** (`REFERENCE_CONSTRAINT`, appended only when a picture actually
rides the ask, so the blast radius on every other ask is structurally zero):
*this / the photo / the reference / like this* mean the attached picture, so
pointing at it for a feature is not the likeness wall; the feature files in the
FREE lane with words naming where it comes from, never an exact vocabulary word,
because the model reading it has no image and may not guess a value out of one.

**`fromReference` is a contract field, not a word test.** It is read only when a
picture rides the ask, and it is what separates *"copy this hair"* from *"make
her hair copper"* — without it the take resolver's whole-lot default would cut a
picture she attached and never mentioned. A list of pointing words was refused
for D-163's reason: it is a phrasing list, and *"like this"*, *"from the photo"*
and *"copy that"* all point.

#### The court — PASS, both arms, bar as ruled (fable-1104 §2/§3)

```
  A  a picture IS attached          8/8
     the six picture-pointing sentences FILE with fromReference
       (makeup refuses wall_unfileable — see below, and it is correct)
     "make her face like the woman in this photo"   wall_likeness   ← the wall
       is not opened a millimetre by knowing a picture is there
     "make her hair copper"                          files, NO fromReference
       ← the clause did not make the interpreter reference-happy
  B  no picture                     unchanged, and `fromReference` never once
     arrives — that half is code rather than prompt
```

The makeup arm's bar moved during the court, off an artifact older than it:
§9.13 already says only a READER can supply a makeup value, and containment
(D-172) enforces it. The entrance's own bar is that the ask reaches that
refusal; turning it into a sentence she can adopt is §9.16's job.

### 9.16 THE WORDS LANE — a words take is answered with a sentence to adopt

Ruled fable-1103 §1, sited fable-1104 §4. `referenceWordsLane.ts` decides;
`refineService` performs it above the refusal and below the parse, because with
the entrance live the same fact — *only a reader can supply this value* —
arrives at two outcomes one line apart: a colour ask FILES an unusable value
(`hairShade: "the hair colour in the attached picture"`) and a makeup ask
REFUSES at containment.

```
  fires when   she POINTED (fromReference, or a refusal a picture can answer)
               AND her sentence names a property a reader speaks for
  hair         the sentence is about hair and names the colour take alone
  makeup       the sentence says "makeup" (not a cosmetic SURFACE — "her eyes
               green like this" is a feature ask and routing it to a makeup
               reader would answer a question she did not ask)
  never over   wall_content (an answer, not a gap) or wall_stage (no reader
               here speaks for a garment)
```

Everything about it is free: no claim, no credit, no row, no render. What comes
back is `offer` on the refine's own answer — the sentence, what the reading
could not fit (NAMED, never counted), and a provenance token the adopted ask
carries back so `verbatim` or `edited` is derived rather than claimed.

**Both read procedures are DELETED with it** (`reference.readMakeup`,
`reference.readHairColour`) and their two config gates with them. The readers
are alive and busier than ever; what went is the per-feature door, because with
the makeup link deleted no surface can honestly call one — a control that said
WHICH reader to run is the entry point fable-1051 killed, wearing a new coat.

## 10. THE ATTACH SURFACE — BUILT (2026-08-20)

*Written here in full because it lived only in review messages, and a ruling is
not landed when it is relayed — it is landed when it is written where the next
person will act on it. §9.10's stale standing block is what that costs.*

**Built and photographed 2026-08-20**, both themes, 42 checks with what each one
SAW: `scripts/drive-attach-surface-evidence.mts`, frames under
`output/attach-surface/`. What §10.2 said would be true turned out to be false
in one place and that is §9.15 — the four calls answered, and no sentence could
reach them.

### 10.1 His words, and the ruling they bought (fable-1051)

> *"you put a small link take makeup from a photo???? this is stupid, you
> should be able to upload any image like grok and use it as a reference for
> anything"*

1. **ONE attach affordance, in the refine ask box** — a `+` / image control in
   the ask box's own row. An attached picture shows as a **thumbnail chip above
   the input** (his Grok reference; 32px, fable-1101 §3). The *"Take the makeup
   from a photo"* text link is **REMOVED**.
2. **Any image, any ask.** The SENTENCE is the instruction; the road decides
   what the reference contributes — words for word-safe properties, a cropped
   region for a specific look. **No per-feature entry points, ever.**
3. **Capability honesty moves to the REPLY.** Where a take is not yet
   buildable, the answer is an honest sentence on the surface — never a hidden
   or absent control. The box is always there; what it can do is said when
   asked.

Riders that survive the re-skin (fable-1051 c): the makeup read's
read-and-discard contract, the price line on the paid affordance, and D-172's
shown-and-adopted shape. **The UI unifies the door, not the rules behind it.**

### 10.2 What is ALREADY BUILT behind it, so the surface is only a surface

Every server road this control needs exists and is deployed dark:

```
  castingV2.reference.attach          the picture → a handle (build two's only write)
  the words lane (§9.16)              the colour take's words, for her to adopt
                                      — inside the road, not a door of its own
  castingV2.refine { referenceId }    the ask carries the handle
  hairTakeFor / resolveHairTake       what she is taking, read from her sentence
  referenceMediumDoor                 a drawing gives its colour, not its cut
  hairReferenceCutter + the source role   the crop, cut, guarded, sent
```

So the build is the control, the chip, the wiring of four calls that already
answer, and the honest sentences. **Nothing behind it needs designing.**

### 10.3 What the surface must SAY, because the road can now say several things

Each of these already comes back from the server as a note or a refusal, and
each needs somewhere to be read:

- the picture went **unused** (the ask turned out not to be about hair);
- her two-view reference had **one view carry**;
- the picture is a **drawing**, so the cut cannot come from it — and the colour
  can, in the same sentence;
- the carrier **pictures no scale** (not enough head around the hair);
- there is **no hair** in the picture;
- and the colour read's **blocks that did not fit**, returned so she can type
  them herself.

### 10.4 The milestone contract (founder, 2026-08-01) — this is a UI milestone

No UI milestone reaches the founder without an **evidence pack**: side-by-side
screenshots (shipped vs. design, per surface, **both themes**) and a copy audit
classifying every user-visible string as prototype-verified / adapted /
invented — **to the reviewer DURING the build**, not after. Render before
shipping: no visual change ships without being looked at in the running app.

### 10.5 The flags flip WITH the surface — one card, one sitting

`CASTING_REFERENCE_ATTACH_SCOPE` and `CASTING_HAIR_REFERENCE_SCOPE` are absent
from production and stay absent until there is something to click. Flipping them
first would open two doors into a room with no handle on his side, and carding
that flip would read as *the feature is ready for you*.

When the surface lands, ONE card carries: the two flags, the `0044` ceremony
already waiting, and the class door's deferred count value (§9.14) as one more
line on the same ceremony. One sitting, one announcement, a feature he can
actually touch.

⚠ **THE SURFACE LANDED AND THE FLAGS FLIPPED WITH IT, EXACTLY AS THIS SECTION
ORDERED — so the first sentence above is now a false statement about production
and is the one line in this document a seat could act wrongly on.** Both stand at
`users:1`: `CASTING_REFERENCE_ATTACH_SCOPE` (*"the door that takes her picture at
all; parent of the two reference lanes"*) and `CASTING_HAIR_REFERENCE_SCOPE`
(*"taking hair from an attached picture; his account"*). Read at
`scripts/lib/productionFlagPositions.mts` — the declared table the deploy rite
compares to the SERVICE on every push — not from prose. **The plan is kept
because it was followed**; what survives of it is the bound rather than the
absence: his account only, and a widening is its own decision.

### 10.6 And the YES bar's centrepiece is HIS EYE on the first real crop

Build two's YES declaration carries the surface's evidence pack **and the
founder-eyes crop gate** (fable-1074 §4): his own eye on the first real hair
crop, riding the declaration as its centrepiece frames, exactly as build one's
tail did. Every court behind it is already in the record — the panels, the scale
form, the cross-sex question, the drawing, the class door.

---

## 11. BUILD TWO'S YES (assembled 2026-08-20, ordered fable-1110 §4)

The §7 bar, item by item, against the record rather than against memory. Every
line names the artifact a later reader can open.

**1 · The ingestion courts pass, red-first.** Attach (`referenceAttachSchema`,
`referenceAttachService`, `referenceAttachScope`), route (`askReference`,
`referenceIntents`, `referenceClassGate`), crop (`hairReferenceCutter`,
`hairReferenceCrop`, the panel decision), ride (`refineService`'s carrier block,
`recipeAssembler`'s fourth role). Red-first is not a claim about intent here: the
last of them, the style-not-colour arms, were **run red before the fix existed**
and their failure output is quoted in opus-815.

**2 · A face-bearing reference produces a crop with ZERO person content.** Proved
twice, in the two places that answer different questions:

- *at the frames* — `output/panel-probe/carrier-scale-redacted-head.png`: hair
  cut from a real photograph, sitting on the head's REDACTED form, filled flat.
  It says *this much head, this much hair* and nothing about whose head it was.
- *at the wire* — `refineService.test.ts`, "carries NOTHING of the person in her
  photograph": every opaque pixel of the DISPATCHED reference is either the
  hair's own colour or `FORM_FILL`, read off the request rather than off the
  cutter's promise.

**His eye on that frame is the one half a suite cannot supply**, and it is on his
card. Note the lifetime that makes this awkward and is correct anyway: a carrier
lives for its ask (fable-1096), so the walk's own carrier was already swept when
I went looking for it — the frame above is the cutter's, from the panel court.

**3 · The style-not-colour split, proven at the wire.** `cc9cf8db`. The take had
been resolved, courted, logged and then DROPPED one line before the recipe, so
`style` and `fullLook` dispatched byte-identical prompts. The scope is now a
REQUIRED field on a recipe source — a picture that says nothing about what it
claims does not compile — and the proof is the dispatch record of a real paid
request (§10.7 below), not a fixture.

**4 · The honest-refusal sentence for an ask this product cannot yet serve.** An
attached picture that no lane can use is not silently ignored: the ask renders,
the picture goes unused, and she is TOLD in the same list every other half-served
ask is confessed in (`attachedPictureUnused`; driven in `refineService.test.ts`,
"CUTS NOTHING for an ask that does not touch hair — and says the picture went
unused"). The ink door's own `intentNotThisDoor` carries the same shape for a
declared feature. ⚠ **Both are driven at the service and the door, not through a
browser** — stated rather than rounded up, because §7 says *driven* and a later
reader should know which kind of driving bought this line.

**5 · The UI evidence pack.** Both themes, 42 measured checks with what each SAW,
the copy audit with its load-bearing negatives, and the law skim to Fable during
the build (opus-812, ratified fable-1105 §3). Frames in `output/attach-surface/`.

**6 · The tripwire does NOT retire at this YES** — and that is a statement about
scope, not an omission. Its retirement was conditioned on the crop road being the
only road to a MINT; the mannequin road is parked (`MANNEQUIN_ROAD_DEFERRED`), so
the condition is unmet and the guard stays for the sitting that resumes that
road. **A YES that quietly took a live control with it is exactly the failure law
7's second half names**, and this build will not be the fourth instance.

### 11.1 The declaration fires when he touches it

The arrow reads FULLY YES on the record — every court, the surface, and a walk
driven by a customer's own hand. **His sitting is the ribbon.** The flags are
absent from production, so nobody, him included, can reach this road until he
flips; a yes he cannot click is not his yes. The declaration is written here and
spoken there.

### 11.2 The walk, and the one thing its frames do not prove

His own two-panel specimen, attached through the real picker, *"give her this
haircut but keep her own hair colour"*, one real render. Frames:
`output/hair-crop-walk/1-master-before.png` and `3-delivered-after.png` — tight
corkscrew ringlets before, looser soft waves with volume through the top after,
same face, pose, lighting and framing. The request is in the variant's own
dispatch record.

**The Cast was a MAN, which nobody staged**, so the sentence that went out reads
*"Take his hair from the reference… keep his own"* — the pronoun fix of the same
morning, on the one case that would have exposed its absence.

⚠ **And the colour half is NOT proved by those two frames.** The reference's hair
and the Cast's hair are both near-black: there was no colour difference to hold
back, so the pair shows the CUT arriving and is silent on the disclaimer. A null
with no fixture that could have gone non-null is not a reading. The colour half
stands on the wire alone until an ask runs with a reference whose colour plainly
differs from the Cast's — which is the first thing worth trying after the flip,
and it is on his card in those words.

## 12. THE OPEN LANE FOR REFERENCE TAKES — scheduled, and what it OWES

Scheduled by the founder in one word (*"yeah schedule that"*, filed fable-1139
§3), after the tattoo carry wire: attach a reference, name ANYTHING (wardrobe
and disallowed content excepted), the cutter cuts it by the ask's own noun, and
it carries like any crop — best-effort tier, honest refunds, measured lanes
upgrading categories over time.

### 12.1 Three lines it inherited on 2026-08-20, and why they are HERE

The attach-pointed ink mint (road (D)) landed serving the **measured three**
placements only — `neck`, `upperArm`, `upperChest` — and an ask naming any other
surface is refused free with a capability sentence naming those three. That is a
deliberate narrowing, ruled fable-1152 §1 after the alternative was measured,
and **this build is where the narrowing is paid off**. It is written down here
rather than left in a mailbox message because a ruling is landed when it is
written where the next person will act on it.

What the widening actually requires, in the order the compiler finds it:

1. **THE DATABASE TYPE OPENS.** `casting_ink_designs.placement` has been
   `varchar(64)` since migration 0046 and holds any word already; what is still
   narrow is the `$type<InkPlacement>()` on it (and on
   `casting_ink_form_demand`). `server/castingV2/inkPlacementCoupling.test.ts`
   is the keeper built for exactly this day — it insists the narrowings move in
   ONE commit and tells whoever reddens it what to do. **That keeper is TRUE
   today and must stay true until this build**: the mint writes measured words
   only, so the type's promise is still kept.
2. **THE MANNEQUIN ROAD'S TYPE SITES** — three in `inkPlateMint.ts`.
   `inkTemplateFor` has no template for an unmeasured surface, and CLAUDE.md
   already says so: *"an open placement has no template at all, so 'no torso
   form for this build' is not what an open ask is missing."* The mannequin road
   is parked, so this is a decision the resumption sitting owns; it must not be
   answered by a silent fall-through.
3. ⚠ **THE SIGN-ROAD MEASUREMENT, and it is a measurement rather than a
   judgement.** `signService` carries a signed Cast's tattoos into package views
   through `placementRidesPackageViews(placement)` and `inkPlacementPhrase(...)`,
   both of which take the closed three — which were measured on sixteen
   production masters. For a word nobody has measured there are only two
   answers available today and **both are this program's named sins**: an
   unknown key falling through a lookup to falsy is a SILENT DROP on a paid,
   shipped road, and answering *"yes it rides"* is an unread claim that a
   sleeve appears in a waist-up framing. So the widening carries a reading —
   frames, in front of eyes (law 9) — and never a lookup's default.

Until all three are answered, the capability sentence stands. It is not
fable-1078's document wall rebuilt: that ruling removed the wall that refused a
design she had SUPPLIED, and this is a capability said honestly, with the three
surfaces she can use in her next message named in the same breath.

---

## 12. The stale-row reading this document was swept by (2026-08-24, opus-1175)

Nine candidate state claims read, **four stale**, all four repaired above in the
additive form — the clause kept, the correction beside it with its artifact.
They were §1(a) (a door removed by this road's own build), §1(d) (the
one-form-built count), §9.1 (its `off` parenthetical and its *not built* tail,
both contradicted by §9.11/§9.14/§9.15 of this file), and §10.5 (both flags
described as absent from production while both stand at `users:1`). §10.5 is the
one that mattered: a live design document making a false present-tense claim
about production state.

**The pattern is worth more than the four**: every one is a section that was
TRUE when written and was overtaken by work this same document commissioned. The
build's own later sections are correct; the framing prose in front of them is
what rotted.

⚠ **The sweep that found them is PHRASE-ANCHORED and is a FLOOR, not coverage.**
Measured on the one population where truth was already known (V3B's six stale
rows, found by hand): a mechanical not-yet-phrase grep matched **three of the
six** while producing nearly three times the noise, and one of the three misses
carried no stale-claim word at all. The per-row read of this document's 1,300
lines is not retired by this and is not claimed to be.
