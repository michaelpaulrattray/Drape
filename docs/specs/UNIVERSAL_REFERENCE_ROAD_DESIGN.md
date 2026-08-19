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
driven the moment the reader is touched. Which shape the fix takes — a stricter
ask, an explicit refusal arm in the prompt, or a second confirming read — is
still open and is decided here.
