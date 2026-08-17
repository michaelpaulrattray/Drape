# The open lane — design note

*Owed to Fable per fable-364's sequencing ("the executor's next design
deliverable after those: the OPEN-LANE DESIGN NOTE"). Written 2026-08-13,
shift 70. **Nothing here is built.***

> **Founder, fable-364:** *"yes i think this is the way to move forward it
> allows full creative editing and we can continually build the catalogue at
> the same time."*

Four things were asked of this note: **the interpreter acceptance path · the
open-vocab mint door · demand recording · what changes at `notASlot`.** A fifth
turned up on its own, outranks all four, and decides how two of them are
answered — so it goes first.

---

## 0. The question nobody asked: the closed list is a KEY SPACE, not a vocabulary

Reading `refineSubjects.ts` as a *list of things you may ask about* makes the
open lane sound like a one-line change: delete the check at
`refineDelta.ts:638`, let any noun through. That reading is wrong, and the file
says so in its own opening paragraph:

> *"The tempting shape is a model-authored `{ axis, text }`, and it is wrong for
> D-89's reason: it hands the composition key to the model. 'Her brows' comes
> back as `brows` one time, `brow shape` the next and `eyebrows` the third, so
> last-writer-wins silently becomes accumulation and 'thin' and 'thick' end up
> in one prompt arguing with each other. A closed subject list makes the
> overwrite mechanical again."*

**The open lane hands the composition key to the model. That is not a side
effect of it — it is what it is.** So the architecture the founder ratified
rests on one empirical question that the ruling presupposes and nobody had
measured: *can a model produce the same noun twice for the same thing?*

### What the key has to survive

A key is not a label. Every one of these is decided by looking a subject up in
a table, and each table is a **total function over the closed set** — the type
system will not let a new subject exist without an answer:

| table | what it decides | where |
|---|---|---|
| `FREE_SUBJECTS` | the composition HEADING its prose is written under — and the D-87 footprint sweep looks for `SUBJECT: value`, so a subject with no stable heading is one the sweep cannot see | `refineSubjects.ts:37` |
| `FREE_SUBJECT_KIND` | presence or degree — **whether an ask may ever REFUSE**, which is D-246 class (c) and therefore money | `refineSubjects.ts:180` |
| `SUBJECT_QUALIFIER` | what the edit clause promises, floor included | `subjectQualifiers.ts:79` |
| `CHANGE_AMPLITUDE` | how much of the frame this edit is expected to move | `changeAmplitude.ts:68` |
| `SHARED_HEADINGS` | the facet's heading | `refineFacets.ts:95` |
| `ZONE_SCOPE` | how much of the frame the edit is allowed to touch | `zoneScope.ts:119` |
| `MOVES_ITS_EDGE` | whether the feature's own boundary moves, which the harvest depends on | `maskedRefine.ts:738` |
| `FACET_SLOTS` | where the library files it — **the `notASlot` question** | `referenceSlotCatalogue.ts:384` |

And three more that are **not** total, and decide by omission instead:

| list | what silence means |
|---|---|
| `PLURAL_SUBJECTS` | not a set — so a second ask REPLACES rather than joins, and removal arithmetic changes shape |
| `DEPARTABLE_SUBJECTS` | "remove it" is re-read as an ordinary edit rather than a vacate |
| `PRESENTATION_SUBJECTS` | it files as identity, so **every follow inherits it** |

**Those three are the dangerous ones**, and this campaign has a name for their
failure: an unowned axis falls silently to the loudest prior, identically on
every tile. A kind that is absent from all three is not undecided — it is
decided, invisibly, three times.

The vocabulary these govern, counted off the constants themselves rather than
quoted from a comment (`FREE_SUBJECT_KEYS`, `FREE_SUBJECT_KIND`,
`PLURAL_SUBJECTS`, `DEPARTABLE_SUBJECTS`, `PRESENTATION_SUBJECTS`,
`FACET_SLOTS`, `ZONE_SCOPE`):

```
free subjects   23      presence 4 · degree 19
                        plural 3 · departable 4 · presentation 1
facets          24      in FACET_SLOTS and in ZONE_SCOPE alike
                        notASlot: makeup, ink, expression
```

**Eight tables that will not compile without an answer, three that answer by
silence.** That is the size of "add a kind", and it is the number any estimate
of this build has to start from.

> **Corrected by the build, 2026-08-13 (shift 73, step 2).** Eleven was a hand
> count and it was already low: `SUBJECT_NOUNS` landed the same day, and the
> list above omits every table that decides by OMISSION. Counted by scanning the
> source for declarations keyed on the closed vocabulary — **eighteen**, plus
> `FREE_SUBJECTS` itself. The answers, with the derivation or the reason for
> each, are in `server/castingV2/openKindPolicy.ts`, and its completeness is
> checked against the source on every run rather than against a list somebody
> keeps — which is this paragraph's own moral.

### The precedent is in the codebase, with its cost already measured

`subjectQualifiers.ts` exists because exactly this happened once. `qualifierFor`
was a chain of `if`s covering **three subjects out of twenty-three** and
returning `""` for the rest, and its header records what the silent default
cost on the founder's own walk:

> *"`statedAccessories`, the armed class, delivered **100%**. `marks`, a bare
> one, delivered **33%** … the bare clause moved 17.6% of her face skin at
> freckle amplitude, the qualified one **26.1%** … A shortcut that is declared
> is engineering; a shortcut that falls through a default is the thing this
> module exists to end."*

**The open lane's central risk is that it reintroduces, by construction, the
default this codebase has spent the campaign eliminating.** That is not an
argument against building it. It is the argument for the **open-kind policy
record** (§8 step 2): one written place answering these eleven questions for an
unpromoted kind, rather than eight tables' worth of absent entries and three
silences.

Worth knowing exactly how it fails today, because it is not silent:
`qualifierFor` reads `SUBJECT_QUALIFIER[subject]` and then tests `"exempt" in
entry`. For a kind with no entry that is `"exempt" in undefined`, which
**throws**. So an open kind smuggled through the interpreter without the tables
being answered does not degrade quietly — it crashes the render. Fail-loud is
the good version of this problem, and it is worth not "fixing" into a default.

---

## 1. Does the model produce a stable key? — measured

Driven: `scripts/probe-open-lane-normalization-disposable.mts` part B, five
concepts the catalogue has never heard of, each said three ways, n=3 per
sentence — 45 samples through a **prototype normalizer that does not exist**
(declared: the prompt is a candidate, not a reading of shipped code). Free —
text calls only, no renders, no credits.

The three bars were written into the script before the first call:

```
1. WITHIN-SENTENCE   15/15 sentences gave one noun 3/3          PASS
2. ACROSS-PARAPHRASE  4/5  concepts converged on ONE noun       PASS  (bar: ≥4)
3. DISCRIMINATION     4 distinct keys, 5 concepts, 0 collisions PASS
```

**Read bar 3 first**, because without it the other two are the signature of a
normalizer answering one word to everything — perfectly stable and perfectly
useless (the shape fable-378 §3 flagged on the earring reader). It held, and it
held on the case built to break it: `horns` and `antlers` are a deliberately
near pair and stayed distinct 9 samples each.

**So the key is viable, and D-89's paragraph does not simply repeat itself.**
That is the finding the whole architecture was waiting on.

### The one non-convergence is systematic, and it is the more useful half

```
"give her scales on her cheeks"          → scales · scales · scales
"add reptile scales across her face"     → scales · scales · scales
"her cheeks should be covered in scales" → cheeks · cheeks · cheeks
```

Not drift — **3/3 the other way.** When the sentence makes the SITE its
grammatical subject, the normalizer keys the site instead of the thing. And
look at what it keyed: `cheeks`, which is a hair's breadth from `cheekbones`,
**a subject the closed lane already owns**. The failure mode is not a wobbly
key; it is an open key colliding with the closed vocabulary and quietly
becoming a face edit.

Two things fall out of it, and both are cheap:

- the normalizer must be asked in a form that **cannot name a site** — the
  prototype's rule *"the THING, never the change"* needs its sibling, *"the
  thing, never the place it goes"*;
- and every normalized kind must be **checked against the closed subject
  vocabulary before it is accepted as new**. A kind that collides with a
  closed subject is a routing bug, not a new kind, and it should route rather
  than mint. This check is free, exact, and it is the one guard that makes the
  open lane structurally unable to shadow the closed one.

n=3 on five concepts is a floor, not a ceiling: it is enough to say the key is
not hopeless and to find the site/thing confusion, and it is not enough to
price the collision rate. **A promotion-grade number wants the real corpus** —
which §7's demand table produces as a by-product, so this measurement is one
the product buys for free once the lane is live.

---

## 2. The interpreter acceptance path

### What happens today — and it is the OPPOSITE of the body row's answer

The body-row note measured its own vocabulary first and found **18 refusals in
18 samples**: a body ask costs the customer nothing today, so that row was
entirely new road on clean ground. The same measurement here, part A of the
same probe, 45 samples through the real `interpretRefinement`:

```
45 samples — 21 refused · 24 FILED · 0 other

WHERE AN OPEN ASK LANDS TODAY
  makeup                       6     "give her wings" → {"makeup":"wings"}
  free.skinCharacter           4
  free.statedAccessories       3     "add horns to her head" → ["horns"]
  free.marks                   3
  free.hairCut                 3     "give her a tail" → {"hairCut":"a tail"}
  free.hairWorn                3
  free.ink                     2     "reptile scales" → a tattoo
```

**Fifty-three per cent of out-of-vocabulary asks file into a face facet today**,
and a filed ask is a render, and a render charges.

### But do not read that as 24 bugs, because it is not

Look at what those readings actually are. *"Give her wings"* → `makeup` is
**winged eyeliner** — for a beauty product that is a good reading, and for the
user who meant it, the right one. *"Give her a tail"* → `hairCut` is a
ponytail. *"Scales on her cheeks"* → `marks` is the nearest honest slot there
is. This is the closed vocabulary doing precisely its job: mapping an unknown
noun onto the nearest plausible reading in the product's own domain.

**Which is exactly why the open lane cannot be additive.** The day `wings`
becomes a nameable open kind, *"give her wings"* stops being eyeliner — and the
user who wanted eyeliner starts getting feathers. An open lane bolted on as a
peer to the closed lane does not merely widen what can be asked; it **silently
re-routes asks the closed lane was reading correctly**.

So, and this is the note's main correction to the shape of ruling 1: **the open
lane is a FALLBACK, never a peer.** It is reached only when no closed subject
claims the ask. The interpreter already arbitrates exactly this class and has
a name for it — the BARE-TERM OWNERSHIP block, where *"fox eyes"* alone is the
eye shape and only *"fox eye liner"* is makeup — and open kinds join that
arbitration at the bottom of it rather than beside the top.

### Two smaller findings, both worth their own line

**The refusals are not consistent across paraphrase, and they use different
walls.** Same concept, three phrasings:

```
"give her horns"                                  wall_content  3/3
"add horns to her head"                           FILED         3/3
"I want her to have horns coming out of her …"    wall_content  2/3, marks 1/3
"give her antlers" (and both its paraphrases)     wall_stage    9/9
```

**`wall_content` is the wrong wall and it is worth fixing on its own merits.**
Content means *"anything unsafe or explicit"*, and the message it produces tells
the user the thing can never be rendered. Horns are not unsafe. The interpreter's
prompt already carries this exact repair for its neighbour — *"A BODY TATTOO IS
NEVER THIS WALL … Sending them here tells the user it can never be rendered when
the body-art studio is coming"* — and the same sentence, same shape, is owed to
fantastical anatomy the moment the open lane is on the roadmap. **Filed for
Fable as a small standalone; it is not gated on any of this.**

**And the whole-delta `null` is latent rather than live.** The acceptance check
is one line — `refineDelta.ts:638`:

```ts
if (!FREE_SUBJECT_KEYS.includes(subject as FreeSubject)) return null;
```

It returns `null` for the **whole delta**, not for that subject — so one unknown
noun would discard every facet in the same instruction, including ones read
correctly, and the user would be told it did not come through clearly. Said
honestly: **the probe did not fire this, and it is nearly unreachable today**,
precisely because part A shows the interpreter almost never emits an unknown key
— it maps to a near slot instead. It becomes live the moment the interpreter is
told it may name new kinds, which is step one of this build. Fix it with the
acceptance path, not before.

### The proposed shape

An unknown subject stops being a parse failure and becomes a **third kind of
entry** beside the guaranteed axes and the free subjects:

```
delta.open = [ { kind: "horns", words: "horns coming out of her forehead" } ]
```

Three properties it must have, and each is there to stop a known failure:

1. **`kind` is normalized by the code, from the model's noun** — never used as
   the model returns it. §1's measurement says how much work that normalizer
   has to do. If the model's noun were the key directly, D-89's paragraph is
   simply true again.
2. **`words` are the user's own, unelaborated** — the free lane's existing rule
   (*"a scar on her cheek stays that; it does NOT become a long knife scar"*),
   and it matters more here, because there is no vocabulary to fall back on.
3. **Every guard the free lane runs, the open lane runs**: brand scrub, the
   proper-noun check, the likeness wall, the length ceiling, `MAX_ITEMS`. The
   open lane widens *what may be named*, and must widen nothing else. In
   particular the **stage wall stays exactly where it is** — an open lane that
   accepts "horns" must still refuse "a red coat", or wall (b) has quietly
   fallen rather than been reconsidered.

---

## 3. What changes at `notASlot`

`FACET_SLOTS` is total over `Facet` and has three `notASlot` entries today —
`makeup`, `ink`, `expression`. Each carries a written reason, and all three are
**decided absences**: makeup rides the anatomy it is worn on, ink waits for the
flash-sheet path, an expression has no zone to cut.

An open kind is a **fourth situation, and it must not wear that label.**
`notASlot` means *"this rides somewhere else, and here is where"*. An open kind
means *"nobody has catalogued this yet, and it may get its own slot when it
promotes"*. Filing the second under the first would blind the demand table at
exactly the place it exists to see — the count of asks that have nowhere to go
is the promotion signal, and it cannot be read out of a bucket that also holds
three permanent residents.

So: a new `UnfiledReason` — `openKind` — beside the existing four in
`mintedSlots.ts:119`, whose own header already sets the standard (*"`notASlot`
is a DECIDED absence … `uncataloguedFeature` should be unreachable"*).

### And the real build is one layer down, in `repaintAsks`

This is the part worth saying loudly, because it is bigger than the interpreter
work and it is not on the interpreter's road at all.

`repaintAsks` refuses an ask it cannot name, and the refusal is
`RepaintCannotSayError` — **non-retryable by construction, and it settles into
a refund.** Its own table lists `notASlot` and `uncatalogued` among the
refusals. So on today's code, the more successfully the interpreter accepts an
open ask, the more reliably the repaint road refuses it and hands the money
back.

The open lane therefore is not "let the interpreter say yes". It is **"teach
the recipe assembler to carry an ask whose slot does not exist"** — a slotless
`Ask` whose state phrase is the user's own words and whose reference is
nothing on the first render and a minted crop on every render after. That is a
compositor-road build, it is the majority of the work, and any estimate that
counts only the interpreter change will be wrong by most of the job.

---

## 4. The open-vocab mint door — and the risk that decides whether it can exist

fable-364 ruling 2 makes crop-and-carry the **default**: on delivery the
segmenter is asked for the new thing in open vocabulary, and a cut that passes
the generic door mints a carry crop that rides every future render. The
founder's requirement behind it is explicit — *"i dont want them regenerating
every edit"*.

The door already exists and is the right shape. `referenceMint`'s guard is a
**second, independent read** of the crop's own region on its own frame, with
the reader injected so the module cannot hand the guard the mask that cut the
crop — *"the checker that cannot fail is unreachable rather than merely
avoided"*.

**But that guard was designed against a CLOSED question set.** Every region it
has ever been asked about is one the catalogue names, and each was armed
through a court. An open-vocabulary question is different in kind, and this
program measured the difference three days ago:

> **fable-378 §3, on the earring reader:** *two-sided on all six faces at a
> suspiciously uniform 0.02–0.03% of frame … a reader that answers something on
> every face cannot ever say absent, which is the coin-flip/vacuous shape and
> must be settled before earring ever arms.*

A segmenter asked *"where are the horns"* on a face with no horns will, on that
evidence, return **something** — a small confident region of forehead. It will
pass a geometry-sanity check. A second reader asked *"does this crop show
horns"*, looking at a crop that was cut precisely because something answered,
is being asked a leading question.

**And the consequence is worse here than anywhere else the shape has appeared**,
because of what a minted crop does: it is not a diagnostic, it is a reference
that rides *every future render of that face*. A false crop of nothing is a
permanent instruction to paint nothing, in a place, forever.

### So the door needs one thing it does not have: a per-kind absence control

**No open kind may mint a crop until the segmenter has been shown a frame that
does not contain it and has declined.** Concretely, and cheaply:

- the first time a kind is asked for, the delivery mint asks its question of
  **the pristine master as well as the delivered frame**. The master is the
  before-picture, and for an ADDITIVE open ask (which nearly all of them are —
  horns, wings, a tail) the thing is by definition not in it;
- **a reader that answers on both is not a reader for that kind.** It mints no
  crop, the ask falls back to words — which fable-364 ruling 2 already provides
  for and calls declared — and the kind is flagged in the demand table as
  *unreadable*, which is a far more useful promotion signal than a raw count;
- it costs **one extra segmenter call per kind per delivery**, on the frame the
  harvest already has in hand. Beside a paid render this is house-money noise.

This is the same instrument shift 69 spent its eyes court on, pointed one
surface along: *a null from an instrument never seen to fail is not evidence*
— and its mirror, *an affirmative from an instrument never seen to decline is
not evidence either*.

---

## 5. The pair trap, and why it is sharper than it looks

fable-364 ruling 3 names it: any paired open kind inherits the earring lessons
at promotion, and until then pair handling is best-effort with removal of one
of a pair refusing into refund.

The note's addition: **the ruling's own example is a pair.** Horns are two.
Wings are two. Antlers are two. The overwhelmingly likely first open-lane asks
are bilateral, so "until promoted" is not a rare corner — it is the common
case on day one.

`PLURAL_SUBJECTS` decides by omission (§0), and an open kind absent from it is
treated as singular: one slot holding one value. For *"give her horns"* that is
right — the pair is one ask, one value, one carried crop of the whole thing.
It only breaks when someone says *"make the left one longer"*, and the honest
answer there is the refusal the ruling already specifies. **So the design is:
open kinds are singular until promoted, per-instance geometry is what promotion
buys, and the one-of-a-pair ask refuses into refund rather than guessing.**
That is not a compromise; it is the earring history not repeated.

> ### CORRECTED 2026-08-17 — *"one carried crop of the whole thing"* was the half nobody measured
>
> **RULING, fable-872 §2: a paired open kind is WORDS-ONLY UNTIL PROMOTED.** No
> crop of one instance ever files under a name that means both.
>
> The paragraph above is right about the SLOT and was wrong about the CROP, and
> the two were joined by an assumption rather than a reading: that a whole-frame
> read returns the whole thing. For a pair it does not.
>
> ```
> the court's wings frame, one reader, one sitting
>   whole frame, as the mint asks it     115,255 px   7.3277% of frame — ONE wing
>   cut at her face's centroid, per half 115,268 px   the image-left wing
>                                        104,569 px   the image-right wing
>   whole − image-left                       −13 px   the SAME mask
> ```
>
> Thirteen pixels in 115,268. What the mint would have carried is one instance,
> exactly, under a noun that means two — and the number alone reads like a clean
> pass, which is why the finding is in an overlay
> (`output/wings-per-side/PANEL-wings-per-side.png`) and not in a table.
>
> **The split-frame measure is PROMOTION-DESIGN data and not a mint route.** It
> says the capability exists for whoever promotes a paired kind: the closed
> lane's own method — cut at her midline, ask each half — finds the second
> instance, with both halves declining on a frame of the same subject wearing
> none. It cannot be reached from the lane as it stands: `regionSides` answers
> `null` for an open kind **before spending a call**, because `BILATERAL` derives
> from the slot catalogue's `frame: "ownSide"` column and an open kind has no
> card. That is the door being shut by construction rather than by a frame.
>
> **And the property is the open question, not the policy.** *Is this kind
> paired* is not something the lane can answer today. It joins *does-it-extend*
> (fable-868 §4) as a kind-property the interpreter answers in ONE design —
> designed together and costed together, per fable-872 §2. Until that lands the
> safe reading is the conservative one: **no open kind mints a crop**, because a
> lane that cannot tell a pair from a single would file the pair's half under the
> pair's name. That is where step 3's door already stands (inert), so it costs
> nothing today and it is the sentence step 5 has to honour.

---

## 6. Verification — the one column where the open lane is better off

Every ask in the body-row note was a **degree** ask (larger, smaller, broader),
and the honest conclusion there was that the row would ship with a verification
column that cannot say no.

The open lane is the opposite, and it falls out of what an open ask *is*: it
asks for a thing that is not in the picture to be in it. That is **presence**,
the crisp half of `FREE_SUBJECT_KIND`, where a photograph settles the question
and two honest people agree. So:

- open kinds are `presence` **by derivation, not by default** — there is no
  judgement call to get wrong;
- D-246 class (c) applies exactly as the founder ruled it: the asked thing
  completely absent refunds;
- and the absence gate protects it from the run-10 failure — a reader
  quibbling that the horns are *"small and understated"* is not an absence, so
  it cannot refuse.

This is the strongest part of the architecture and it is worth saying plainly,
because §0 and §4 are both cautionary: **the open lane's money story is
cleaner than the closed lane's**, since it is made entirely of the ask class the
product can honestly hold a reader to.

---

## 7. Demand recording

Ruling 4, with the staff boundary taken as the binding constraint.

```
open_lane_demand
  kind            the NORMALIZED noun          "horns"
  outcome         delivered | refunded | words-only | unreadable | refused
  createdAt       timestamp
```

**And nothing else.** Not the prompt text, not the cast, not the user id, no
image key. That is ruling 4's own instruction and it is also invariant 8: the
projection is explicit, and the creative content is absent *by construction*
rather than by a caller remembering to omit it. A staff member reading this
table learns that eleven people asked for horns and seven got them; they learn
nothing whatever about any one of them.

Two things the build must honour, both from this campaign's own scar tissue:

- **migration before code.** A new table is in every INSERT the moment the
  writer ships; there is no dark landing for it. The migration goes first, by
  ceremony, the way `casting_reference_library` did.
- **the writer must not be able to block a render.** The demand row is
  telemetry riding a paid path. It fails soft and loud — logged, never thrown —
  for the same reason the mint does: *nothing here may take that picture back*.

The table is the promotion instrument, and per ruling 5 promotion stays a human
decision reading it.

### The class the promotion queue has to budget for: FINE SURFACE TEXTURE DEFEATS READERS

*Named here on fable-872 §3's order, because this is where the promotion queue
lives and a class named anywhere else is a class the next promoter does not
read.*

Two of the five specimen kinds were delivered by the engine, are unmistakable to
an eye, and read **0.0000%** to the segmenter: `scales` (a plain reptilian
pattern across his neck and jaw) and `gills` (three slits each side of the
throat). That is not two instances, it is a **class**, and it has already been
paid for once on a different modality — the DESCRIBER failed the same way on
freckles, which is the origin of the founder's law 9. Fine, sparse, low-contrast
surface texture is what readers of every kind under-report.

Three consequences, and they are cheap to honour now and expensive to discover
later:

- **a promotion of such a kind budgets for reader blindness from day one.** The
  reader is not a detail that gets tuned afterwards; for this class it is the
  binding constraint on whether the kind can carry at all, and a plan that
  assumes a working reader is a plan with no delivery road.
- **no reader verdict ever closes a surface-texture court without an eye.** Law
  9 is general, and this class is where it bites hardest: on scales the reading
  and the frame said opposite things, and only the frame was right.
- **the demand table's `unreadable` outcome is where these surface**, and it is
  the more useful signal of the two it can record. A kind with demand and no
  reader is a promotion that has to buy a reader; a kind with demand and a
  reader is a promotion that only has to buy a court.

---

## 8. What I recommend, and the tradeoff in one paragraph

**Build it, in the order the risks fall rather than the order the pieces are
listed** — and treat §1's measurement as the gate on the whole thing, because
if the key is not stable nothing downstream can be.

0. **The open lane as a FALLBACK, not a peer** (§2) — decided before anything
   is built, because it is the one choice that cannot be retrofitted. An open
   kind is reached only when no closed subject claims the ask, and every
   normalized kind is checked against the closed vocabulary before it counts as
   new. Without this, shipping the lane silently re-routes asks the product
   reads correctly today, and *"give her wings"* stops being eyeliner.
1. **The normalizer, with its three bars** (§1). It is the load-bearing piece
   and the cheapest to measure; everything else is wasted if it fails. Its one
   measured weakness — keying the SITE when the sentence leads with it — is
   caught for free by the collision check in step 0.
2. **The open-kind policy record** (§0) — one written place answering the eight
   total tables' questions for an unpromoted kind, with the answers *derived*
   where they can be (`presence` from what an open ask is; singular from §5)
   and *stated with a reason* where they cannot. Not eight defaults in eight
   files.
3. **The absence control at the mint door** (§4). Without it the library
   acquires permanent references to things that were never there, and that is
   the one failure in this design that is not self-correcting.
4. **The slotless `Ask` in the recipe assembler** (§3) — the largest build, and
   the one that decides whether an accepted ask becomes a picture or a refund.
5. **The interpreter's acceptance path** (§2), including the fix to the
   whole-delta `null`, which is worth doing on its own merits either way.
6. **The demand table** (§7), last, because it records outcomes that do not
   exist until 1–5 do.

The tradeoff, plainly: this is the first thing the product will ship where **the
code does not know what it is painting**. Every guarantee the casting pipeline
has — engineered vocabularies, armed courts, measured delivery floors, a
catalogue with a question per region — was bought by knowing the subject in
advance, and none of them transfer to a noun nobody has seen. What replaces
them is narrower and honest: a stable key, a presence bar a photograph can
settle, a mint door that has been shown it can decline, and words when the
picture cannot be trusted. That is a real floor, and it is a lower one — which
is the correct trade for *"full creative editing"*, provided it is the declared
trade rather than the discovered one.

**Open for the founder:** whether a kind that fails the mint door's absence
control should still be *offered* (words-only, delivered, charged) or refused
until someone promotes it — that is a product call about how much a
words-only render is worth, and §7's `unreadable` outcome is designed to give
him the number before he has to answer.

---

# §9 — V5 PREP: this note reconciled against the world that was built under it

*Written 2026-08-16, shift 79, ordered by fable-757 §4. **No build and no spend
in this section** — every figure below is read off the source, the suite or a
report already on file, and each row says which. The shape is V4's close
(`VOCABULARY_OVERHAUL_REVIEW.md`): clause, state, evidence.*

The note was written 2026-08-13 and immediately went to the bottom of a queue
that then ran for three days. What ran instead was the compositor detour — the
repaint road, the reference library and its mint door, the segment store, the
face scan and its table — plus **V1's card registry**, **V4's detection map**,
and one thing nobody planned: **the note's own worked example shipped down the
other road.**

## 9.1 The headline: horns is a CLOSED subject now

Read off the source today, not from a report:

```
free subjects   29   (the note counted 23)
horns           nouns ["horns","horn","antlers"] · kind `presence`
                subject card · facet · a per-side reference-library slot
                and it is IN the guidance string the interpreter is sent
```

That last line is the one that matters, because it is the assertion at the wire:
`freeSubjectGuidance()` names `horns` to the model, so *"give her horns"* is a
filed ask today rather than the `wall_content` refusal §2 measured.

**Four things follow, and they reshape V5 rather than decorate it.**

1. **§1's discrimination bar has lost its specimens.** `horns` and `antlers`
   were the deliberately-near pair that proved the normalizer discriminates;
   both now fold to the closed subject `horns`, so `closedSubjectFor` returns a
   collision for each. Any re-measurement of the three bars needs concepts the
   catalogue still does not own. Checked today: `fangs`, `wings`, `tail`,
   `scales`, `pointed ears`, `gills` are all still open; `freckles` folds to
   `marks` and `cheeks` to `cheekbones`, which is §1's measured site/thing
   confusion arriving exactly where it was predicted.
2. **§2's part-A numbers are stale in a known direction.** Twenty-one of those
   forty-five refusals were horns and antlers. The measurement is not wrong —
   it is a photograph of a vocabulary that has since grown by six subjects.
3. **The promotion path got cheap, and it is the open lane's competitor.** V1
   made a kind one card feeding every table; the horns court measured it; the
   founder's fable-566 ruling gave it a reference slot. That is the whole
   pipeline for *a kind somebody names in advance*, and it now runs in one
   shift.
4. **So V5's warrant narrows to the kind nobody named in advance** — and there
   is a measured number for that, below.

## 9.2 The demand, measured — and what it does to the founder gate

From the corpus reader (opus-489, `read-vocabulary-demand-disposable.mts`;
production, 205 briefs + 55 refine instructions):

```
ASKS NAMING NOTHING THE VOCABULARY KNOWS
  EDITS  1 of 55  (1.8%)   — and in full: "give her vampire fangs"
```

**One paid production ask, ever, that the closed lane could not name.** Verified
today that `fangs` is still open, so the number has not been absorbed by a
promotion since it was taken.

The reader's limits are its own and they are declared: a floor on demand rather
than a measurement, and blind to any kind asked for in words nobody registered.
It is also the instrument that exists *because* `casting_open_lane_demand` has
no writer — the table cannot report demand for a lane that has never run, which
is the disjoint-chain trap and the reason this figure is a floor.

**The founder gate — *the first spendable open-lane render class* — sits
exactly here, and this is the reading it should be brought with**, per fable-708
§2. My recommendation, offered as a recommendation and not filed as a ruling: it
is a genuine question whether V5 should ship the lane before promoting fangs
through the path that has just been proven on horns, and he should be shown both
prices rather than one.

## 9.3 The clause table

| The note's clause | State | Evidence |
|---|---|---|
| §0 the closed list is a KEY SPACE — every table that decides by type, and the three that decide by silence | **DELIVERED** | `openKindPolicy.ts`, keyed by each table's own symbol, with `derived` vs `stated` on every answer; `openKindPolicy.test.ts` scans the source on every run so the count cannot drift |
| §0 *"eleven tables"* | **SUPERSEDED — twice.** 11 (hand count) → 18 (the module's header) → **21 today**: 3 `policy`, 9 `silence`, **9 `owed`** | `owedByThePolicy()` run today. The drift is the argument for the scan, and the scan caught it |
| §1 the normalizer, and its three bars | **DELIVERED as a module**, bars measured before it existed (15/15 · 4/5 · 4 keys 0 collisions) | `openLaneKind.ts`; `openLaneKind.test.ts` 20 tests green today |
| §1 the specimen set the bars were measured on | **SUPERSEDED** — `horns`/`antlers` are closed; a re-measurement needs new concepts (§9.1) | `closedSubjectFor("antlers") → horns`, run today |
| §1 every key checked against the closed vocabulary before it counts as new | **DELIVERED** | `closedSubjectFor` + `foldNoun`, exact-after-folding, with the not-a-stemmer reasoning declared |
| §2 **the open lane is a FALLBACK, not a peer** | **DELIVERED as the decision, REMAINING as enforcement** — recorded in `openLaneKind`'s header; there is no routing code yet because there is no lane yet | module header; no caller of `normalizeOpenKind` outside its own tests |
| §2 the wrong wall (*"give her horns"* → `wall_content`, told the user it can never be rendered) | **DELIVERED** — the content wall now carves out fantastical anatomy, and `wall_stage`'s unbacked half stopped claiming antlers are a prop | `refineRefusals.ts:56`; `stageWallBackstop.test.ts:291` asserts the sentence **in the prompt actually sent** |
| §2 the acceptance path — a third kind of entry, `delta.open` | **REMAINING** | not built |
| §2 the whole-delta `null` (one unknown noun discards every facet in the instruction) | **DELIVERED 2026-08-17 (step 5a), for the live boundary only** — a caller that passes a `check` gets the unowned subject recorded and skipped and keeps the facets that read; a caller with no `check` (our own record re-entering) still nulls the whole delta, because there an unowned subject is corruption. Both halves driven, each sabotaged | `refineDelta.ts`, `FreeLaneCheck.unowned`; `refineDelta.test.ts` |
| §3 `openKind` as its own `UnfiledReason`, never `notASlot` | **DELIVERED** as declared scaffolding, landed before anything can produce it, with a negative control that today's producer cannot emit it | `mintedSlots.ts:184–220`; `mintedSlots.test.ts` 33 tests green today |
| §3 the slotless `Ask` in the recipe assembler — *"the largest build, and the majority of the work"* | **REMAINING** — `repaintAsks` still refuses `uncatalogued`, and that refusal is `RepaintCannotSayError`, non-retryable, settling into a refund | `repaintAsks.ts:190, 509, 659` |
| §4 the mint door's per-kind absence control | **REMAINING — and PROMOTED in importance** (§9.4) | the phrase appears in one file in the repository, and it is the policy record describing what is owed |
| §5 open kinds are singular until promoted; one-of-a-pair refuses into refund | **DELIVERED as policy** | `openKindIsPlural() → false`, with §5's reasoning as its basis |
| §5 the pair trap in the flagship instance | **SUPERSEDED** — horns arrived as a pair and got **per-side geometry** through promotion, not through the open lane | `referenceSlotCatalogue.ts:612–655`, `perSide` |
| §6 open kinds are `presence` by derivation; D-246 class (c) applies | **DELIVERED as policy, REMAINING as enforcement** (`FREE_SUBJECT_KIND` is one of the nine `owed`) | `openKindBinds()`; `owedByThePolicy()` |
| §7 the demand table, and nothing else in it | **DELIVERED in dev** — migration `0031`, schema, ceremony with a positive control on the existence reader and a check that none of the four forbidden columns appeared | `drizzle/0031_casting_open_lane_demand.sql`; opus-307 §2 |
| §7 the same table in production | **REMAINING — an open founder-queue item since shift 72b**, one idempotent command, nothing waiting on it | `founder-queue.md:997` |
| §7 the writer | **DELIVERED 2026-08-17 (step 6), landed WITH the acceptance path rather than behind it** (fable-874 §3b: no window where the lane sells untracked). Fails soft and loud, refuses a key that is not the normalizer's, and writes no row at all when no kind could be named | `server/db/castingV2OpenLaneDemand.ts`; called from the acceptance door |
| §7 *"migration before code"* | **HELD** | the table landed first, by ceremony, as the rule requires |
| §8 the recommended order (steps 0–6) | **steps 0, 1, 2 DELIVERED · steps 3, 4, 5, 6 REMAINING** | this table |

## 9.4 The one clause whose STATUS changed, not just its state

§4's absence control was written as a **safeguard on** the mint door: without it
the library acquires permanent references to things that were never there, and
that is *"the one failure in this design that is not self-correcting."* It is
now a **gate on the lane itself**, because of a founder ruling that landed
after the note:

> **Founder, fable-566:** *"horns should be carried by reference as well — it's
> a feature, otherwise they would change on every refinement."*

The horns court had crowned WORDS on survival, and the ruling overturned the
tie-break: a presence tie does not decide a carrier question, because neither
arm was ever asked whether they are **the same horns**. An axis nobody pins
re-rolls — this campaign's own unowned-axis-collapse class.

So a words-only open kind is not a cheaper delivery of the same thing. **It is a
kind that changes on every subsequent render**, which is the defect the ruling
exists to prevent. That lands directly on the note's closing question to the
founder — *should a kind that fails the absence control still be offered,
words-only and charged?* — and it moves the honest recommendation. I would put
it to him as: **refuse rather than sell a feature that will not hold still**,
with `words_only` kept as an outcome the table can record if he decides
otherwise. Recommendation only; not filed.

**And it is now sizeable rather than hand-waved.** The note priced the control
at *"one extra segmenter call per kind per delivery … house-money noise"*. The
scan economy has since measured that call: **20 segmenter reads at $0.100 per
version scanned, so $0.005 a read** (counted through `scanFace` with a recording
reader, after two hand-derivations were wrong in a row). One extra read per kind
per delivery is half a cent. The note's instinct was right and now it has a
figure.

## 9.5 The size

Stated in the note's own step numbering, with the derived counts rather than an
adjective:

```
step 0  fallback-not-peer            DECIDED, unenforced   — routing, ~1 site
step 1  the normalizer               DONE                  — 0 callers
step 2  the open-kind policy record  DONE                  — 21 tables, 9 owed
step 3  the mint door's absence control   BUILT 2026-08-17  — +1 read/kind/delivery
                                                             ($0.005) as designed,
                                                             and INERT until step 5
                                                             hands the mint an open
                                                             slot. The specimen set
                                                             is still owed: see
                                                             §9.8
step 4  the slotless Ask             PART BUILT            — see §9.7: the scout
                                                             moved this figure, and
                                                             the assembler is not
                                                             where the work is.
                                                             Built (shift 80): the
                                                             record's `open` field,
                                                             its composition (the
                                                             carry, and the drop by
                                                             recomposition), the
                                                             reader split, the
                                                             promotion migration,
                                                             and the ask loop.
                                                             REMAINING: the CROP,
                                                             which is step 3 — with
                                                             words alone the kind
                                                             re-rolls, so the lane
                                                             does not ship on this.
                                                             **The DOOR is built;
                                                             what still has no
                                                             producer is the slot
                                                             that walks through it,
                                                             and that is step 5**
step 5a the acceptance path          BUILT 2026-08-17      — the whole-delta null
                                                             closed at the live
                                                             boundary, the door at
                                                             the CALLER
                                                             (`openLaneAccept.ts`),
                                                             every free-lane guard
                                                             carried across
                                                             INCLUDING the stage
                                                             wall. **DARK**: the
                                                             interpreter is not told
                                                             it may name a new kind,
                                                             so nothing routes in —
                                                             see §9.11
step 5b the mint wire                BLOCKED               — on the kind-property
                                                             design (paired +
                                                             does-it-extend, one
                                                             design, costed together
                                                             — fable-872 §2). The
                                                             pair door before the
                                                             first crop, never after
step 6  the demand writer            BUILT 2026-08-17      — landed WITH 5a, not
                                                             behind it (fable-874
                                                             §3b). The table was
                                                             already in production
```

> **Step 6's "after the prod ceremony" is spent, and it was spent before it was
> written** (fable-840 §B.2, confirmed 2026-08-17 against production
> `:23768` — `casting_open_lane_demand` APPLIED, columns id/kind/outcome/
> createdAt, **0 rows**, which is the correct newborn state because nothing
> writes it yet). The founder ran that ceremony himself weeks ago; a later card
> asked him for it a second time and the re-run answered ALREADY APPLIED.
> **So the writer has no ceremony to wait for** — it goes live on this build's
> own schedule, behind its own flag, the day step 5 gives it something to
> record. Nothing about the privacy shape changes: the four columns ARE the
> boundary (a word and how it went, never a sentence, an account, a cast or a
> picture).

**The nine `owed` answers ARE the step 3–5 work list**, which is what
`owedByThePolicy()` was built to return: `FREE_SUBJECT_KIND`,
`SUBJECT_QUALIFIER`, `ZONE_SCOPE`, `MOVES_ITS_EDGE`, `FACET_SLOTS`,
`DEPARTABLE_SUBJECTS`, `OUT_OF_FRAME`, `REGION_OF_FACET`, `OPEN_QUESTIONS`. A
build that closes one has to name it, so the list shrinks by construction
rather than by anybody remembering.

Two of them carry a warning worth repeating here, because they are the two most
likely to be satisfied wrongly:

- **`DEPARTABLE_SUBJECTS`** — its own basis says the dropped-carry removal is
  *"a claim about the repaint road that the step-4 build must PROVE rather than
  assume."* The library-holds-presence-not-absence defect was exactly this
  reasoning being right about the architecture and wrong about the code.
- **`OUT_OF_FRAME`** — *"give her a tail"* is below the crop line of every frame
  this product makes, the fifth door cannot decline it, and the render gets
  bought. Declared, unfixed, and the demand table is where it would show up.

## 9.6 What V5 owes a decision on before it builds

Not decisions made here — the three questions the reconciliation surfaced,
each with a recommendation and none of them filed:

1. **Promote fangs, or ship the lane?** The measured production demand is one
   kind, and the promotion path has just been proven end-to-end on horns in a
   single shift. *Recommendation: bring both prices to the founder gate rather
   than treating V5's ordering as settled by the plan that predates the horns
   promotion.*
2. **The words-only question, re-asked under fable-566** (§9.4). *Recommendation:
   refuse rather than charge for a feature that re-rolls.*
3. **New specimens for §1's bars and §4's absence control.** Horns and antlers
   are closed; the control's whole point is a frame that does **not** contain
   the thing, and it must be measured on kinds the catalogue still does not own.
   *Recommendation: `fangs`, `wings`, `tail`, `scales`, `gills` — confirmed open
   today, and `fangs` is the only one with a real customer behind it.*

## 9.7 The step-4 scout — the largest build is not where the note put it

*Read 2026-08-16, ordered by fable-759 §2, on the 3b-scout shape: read the code
before sizing it. Free — no render, no call, no credit. §9.5's step-4 line was
derived from file lengths, which is the weakest evidence in this document, and
the scout replaces it.*

### The assembler does not need to change

`recipeAssembler.ts` was built facet-free **on purpose**, and it says so:

```
FeatureSlot = string                      not a union, not a catalogue key
"facet" appears ONCE in 984 lines, in a comment: a library key is a PANEL
  SLOT — the stylist's ontology, never `facet@region` (fable-173)
slotDefinition() called once, in `whereItIs`, and a null definition
  degrades to "" rather than throwing
Ask.noun already exists, and its comment is this exact case:
  "Needed only for a slot the library has never held"
```

An `Ask` carrying an unknown slot string is a thing this module already accepts.
That is not luck; it is fable-173's boundary holding.

### And a slotless channel is ALREADY IN PRODUCTION

`expression` is the precedent, in the same function, shipped:

> *"`expression` is the first specimen of an ask the road could not state: no
> slot by decision (D-136), no zone to cut, nothing to carry. It used to meet
> `notASlot` below and refuse into the refund, which was honest and was still a
> customer typing *make her smile* and being told the product could not. Now it
> rides the change clause."* — `repaintAsks.ts:521`

The carrier is `PresentationClause = { noun: string; words: string }`. No slot,
no facet, no catalogue lookup, reaching the render's change clause. **A slotless
ask already travels this road every day.**

### So the work is at the ENTRY, and the entry is `Facet`

The ask loop is driven by `facetsWrittenBy(input.delta)` (`repaintAsks.ts:561`),
and every gate inside it keys on the closed union in turn:

```
facetOfSubject → FACET_SLOTS[facet] → slotsForFacet → slotDefinition → statePhrase
```

An open kind has no facet and is not in the delta, so it cannot enter through
that loop at all. It needs **its own loop, parallel to the presentation loop it
would sit beside** — which is a smaller and much better-precedented build than
"teach the recipe assembler to carry a slotless ask" implied.

### The one part with no precedent: presentation does not CARRY

And this is the honest remainder. Presentation is slotless **and carry-less by
design** — D-136, a follow must never inherit a smile. An open kind is the
opposite: fable-566 requires it to carry by reference or it re-rolls every
render. So step 4 is *presentation's channel plus a carry*, and the carry is the
part nothing has done before.

**The design question that the line counts were hiding:** a carrying open kind
needs a slot key, and the slot catalogue cannot answer for a noun nobody has
catalogued. Two shapes were scouted — a synthesized key the catalogue can answer
for, or a carry that rides the ask rather than the library.

> **RULED, fable-760 §2 — shape (a), synthesized keys, bounded.** Ruled rather
> than carded because it is architecture: the founder's ontology never meets a
> slot catalogue. The three bounds are part of the ruling:
>
> a. open kinds mint under a **derived namespace** (`open@<noun>`), and
>    `slotDefinition` gains **one** dynamic branch, confined to it;
> b. **the closed catalogue's guarantees are pinned mechanically, not hoped
>    for** — a test proves no `open@` key can enter the closed tables, the
>    closed union stays closed for every non-open key, and the 8 call sites are
>    swept with each one's tolerate-or-answer decision recorded;
> c. **open crops ride the same library lifecycle as everything else** — minted
>    at delivery, digests, frozen bytes, purged with their candidate. The
>    ask-riding carry was refused for a named reason: it breaks fable-566's
>    promise at the first reload, which is the build-lost class.

**That ruling is executed in `OPEN_LANE_CARRY_DESIGN.md`** — the key form (and
why it is `open:<noun>` rather than `open@<noun>`: `@` is the instance separator
and its suffix is checked against a two-member closed list), the one branch's
field-by-field answers, the five pinning tests, and all sixteen slot-keyed call
sites walked with each decision recorded.

The ripple I quoted here as *"8 `slotDefinition` call sites"* was low, in the
same way as every other hand count in this milestone: it counted one function.
The real surface is **16** — `slotDefinition` 8, `facetsOfSlot` 5,
`accessoryKindOfSlot` 2, `slotsForFeature` 1.

### A footnote that discharges half of an `owed`

`DEPARTABLE_SUBJECTS`' policy answer — removal by dropping the carry — was
marked *a claim the step-4 build must PROVE rather than assume*. It has been
measured since, and the proof is quoted in `recipeAssembler.ts:216`: **the horns
removal court read 3/3 gone and 3/3 clean by dropping the carry alone.** On a
promoted kind rather than an open one, so the mechanism is proven and its
transfer to a slotless ask is not — which is exactly half of what was owed, and
the half that was likeliest to be wrong.

---

And one dependency the note could not have known: **fable-711 put
reference-guided edits inside M12's close-out** — the customer supplies an image
and the edit takes the feature from it. Its plumbing is the same mint door and
the same carry machinery this section is about, and fable-711 §4 says so
explicitly. Whatever step 3 decides about a crop minted from a frame, the
reference-edit era will ask the same question about a crop distilled from an
upload.

## 9.8 Step 3 as built — the door, its two declared choices, and what is still owed

*Built 2026-08-17 (shift 91). Red-first: five arms written and watched failing
before a line of the door existed; three sabotages, each reddening only its own
arm. Nothing on the paid path can reach it yet — see "inert", below.*

**What the door is.** An open kind's crop has two ways of being worthless, and
they need two instruments rather than one:

| failure | instrument | where |
|---|---|---|
| the crop is a picture of NOTHING — the segmenter answers *something* on every face | **the absence control**: the same reader, the same question, asked of the frame this render was painted FROM | `absenceRefusal`, `referenceMint.ts` |
| the crop is part of the thing wearing the whole thing's name | **the ceiling**: the crop holds every pixel of an independent second read of its own region | `guardReference`'s ceiling clause, via `ceilingIsTheBar` |

Two refusals were added to the guard's own derived table, and neither keeps its
pixels: `absenceUnproven` (the reader answered on the before-picture, so its
answer on the delivered frame cannot be told from a confident region of nothing)
and `absenceUnread` (the control could not be RUN — no before-picture, or no
reader — which is a NO-READ and therefore not a pass).

**Declared choice 1 — the floor is ZERO, and it is the strict direction.** Any
non-empty answer on the before-picture refuses. The one time this procedure has
been run on a real kind it read *0.0000% on three visibly bare frames* against
0.39–0.87% on twelve worn ones (§6's horns court), so zero is what a reader that
can decline actually does — measured, rather than chosen for tidiness. A floor
above zero would be a number nobody has measured for a kind nobody has
catalogued. It errs toward words and never toward a crop: a stray pixel costs a
kind its carry for one render and costs nobody a picture.

**Declared choice 2 — the ceiling exemption widens by ONE case, and it is a
policy the caller asserts rather than a name the guard recognises.** fable-306's
`ceilingAccepted` clause was scoped to kinds with a measured family, on the
ground that *"for that kind we cannot yet say what complete means at all."* That
is right about the family and over-reaches by exactly this case: at a reading of
1.0 there is no shortfall left for any bar to divide, so a family would add
nothing a second read has not already said. What a family would still have
caught is the other failure — and that failure now has its own instrument, in
front of this one. **Below the ceiling nothing changes**: an open kind's
sub-1.0 crop still refuses `noSpecimen`, still keeps its pixels, and still waits
for the specimen only a human can supply. That negative is a driven arm, because
without it the flag could be accepting everything.

**The before-picture costs no plumbing.** `MintInput.anchorFrame` is the frame
the render was anchored on — the pristine master under recipe v3 — and
`refineService` already passes it on every render for the delivery court's
ruler. The control is bought lazily: only for an open kind that actually cut a
crop this render, so a kind the delivered frame said nothing about spends
nothing proving the absence of a thing nobody found. `absenceReads` is counted
apart from `groundReads` in the mint's log line, because *what did the absence
control cost* is a question the promotion decision asks.

**IT IS INERT, AND THAT IS THE HONEST STATE.** `mintedSlotsForRender` builds the
mint's slot list from FACETS, and an open kind is not a facet — so nothing in
production hands the mint an `open:` slot today, and the `openKind` unfiled
reason in `mintedSlots.ts` is still the declared scaffolding its own comment says
it is. **The wire lands in step 5**, and it lands at `mintedSlots` rather than at
the mint. Until then this door is written and driven at its own seam, and it has
never been walked through on a paid render — which is the sentence any later
reader should hold it to.

**Still owed, and unchanged by this build: the specimen court** (§9.6 question 3).
The runtime control makes every render SAFE regardless of the answer — a reader
that cannot decline simply costs that kind its crop — but whether real unarmed
kinds read clean zeroes is what says whether the lane delivers crops at all or
falls back to words in practice. That is a measurement on kinds the catalogue
does not own (`fangs`, `wings`, `tail`, `scales`, `gills`), it is house money at
$0.005 a read, and it wants frames that hold the thing as well as frames that do
not.

**One finding filed on the way past, not fixed here.** fable-306's clause says
*"`ceilingAccepted` marks the row, so a later count of bar-measured specimens
cannot silently include crops no bar ever divided."* It marks the VERDICT: no
column, no consumer, and `grep` finds it read by nothing but its own tests. The
claim was harmless while the exemption was scoped to kinds with families; step 3
makes it load-bearing, because every open kind that carries will now be a
ceiling acceptance. The nearest honest derivation from what IS persisted is
`guardThreshold == 10000`, which is not the same claim.

## 9.9 The specimen court — run 2026-08-17, and it changes what step 5 can promise

*Ordered fable-866 §3c, extended by fable-868 §3. DEV world, house money
$0.66 of a $3.00 ceiling (33 reads at $0.005, 5 transport frames at $0.099),
zero credits, no production write. Driver:
`scripts/court-open-absence-disposable.mts` (untracked, per the standing
disposable convention); artifacts and the co-sign panel in
`output/open-absence-court/`.*

**What it does not prove, stated first** (fable-871 §4): the positive specimens
are made through the image transport DIRECTLY, because no ask path into the
lane exists until step 5. This court reads the mint door's instrument on
delivered-shaped frames. It is not an end-to-end proof of the product path, and
no sentence from it may stand in for one.

**The controls, both green, printed before any verdict.** `hair` must ANSWER on
every frame (4.5176% · 4.9739% · 5.8818% · 4.5525%) — without it a reader that
had quietly stopped answering anything would score a perfect absence control.
`horns` must DECLINE on every frame (0.0000% ×4) — it is the catalogued,
courted kind whose 0.0000%-on-bare-frames reading the absence control's floor
was derived from, so it is the one kind whose expected answer was already on the
record.

```
                bare masters (n=4)        a frame MADE to hold it
fangs           declined 4/4  0.0000%     ANSWERS   0.0549%
wings           declined 4/4  0.0000%     ANSWERS   7.3277%
tail            declined 4/4  0.0000%     ANSWERS   1.6935%
scales          declined 4/4  0.0000%     declines  0.0000%
gills           declined 4/4  0.0000%     declines  0.0000%
```

**§4's central worry is REFUTED for all five kinds.** The note reasoned that a
segmenter asked *"where are the horns"* on a face with none *"will, on that
evidence, return something — a small confident region of forehead."* On this
reader, on these nouns, it returns exactly nothing: twenty bare-frame readings,
every one 0.0000%. The absence control will not be the thing that stops an open
kind carrying.

**But three of five carry and two are INVISIBLE TO THE READER, and that is the
finding.** `scales` and `gills` were delivered by the engine and are plainly
there — I looked at both frames — and the reader answered 0.0000% on each. A
kind the reader cannot see on a frame that holds it gets no region on the
delivered frame either, so it falls to `noRegion` and files words. **It is not a
safety failure and it is not the control's doing**; it is a delivery ceiling,
and it is the promotion signal the demand table exists to collect. Both failures
are fine-grained surface texture on the neck, which is a CLASS rather than two
instances — the same class the describer failed on the freckle court, arriving
now on the segmenter.

**The bilateral finding, which only the frames show.** On `wings` the reader
found ONE wing (7.33% of frame, the image's left) and not the other, and the
number alone reads like a clean pass. §5 rules open kinds SINGULAR until
promoted — *"one slot holding one value, one carried crop of the whole thing"* —
and the whole thing is not what a whole-frame read returns for a pair. **A
paired open kind would carry a crop of one instance under a name that means
both.** That is the earring history in a new lane, and it wants a ruling before
step 5 files a pair: the honest options are to treat a paired open kind as
words-only until promoted, or to route it through the per-side reader the
closed lane already has (`regionSides`), which is a capability question rather
than a policy one.

> **RULED, fable-872 §2 — the first option, and the second is measured as
> promotion-design data rather than taken.** *"Paired open kinds are WORDS-ONLY
> UNTIL PROMOTED. No crop of one instance ever files under a name that means
> both."* Grounds: §5's singular rule is design law for open kinds precisely
> because pairedness is CATALOGUE knowledge, and an open kind by definition has
> no catalogue. The ruling's full text and its consequence for step 5 are at
> §5 above; the measure it ordered is §9.10 below.

**And the founder's own tail question is answered by a frame** (fable-868 §1).
Asked for a tail on our standard head-and-shoulders framing, the engine painted
one **floating beside his shoulder, anchored to nothing** — the hip it grows
from is out of frame, so what arrives is a detached appendage rather than
anatomy. The reader found it perfectly. So class (b) *"extends into frame"* is
real and is not automatically SELLABLE: a stylist would not keep this frame.
Wings, by contrast, present naturally past the silhouette and read as worn.
Observed, not built for.

**One instrument defect, mine, found by reading my own output.** The court's
summary line printed `CARRIES fangs, wings, tail, scales, gills` off the
bare-frame arm alone, because passing the absence control had been coded as
carrying. It is not: a kind that declines on a frame that HOLDS the thing never
gets a region either. The classification now needs both arms and prints
`CARRIES` / `BLIND` / `REFUSED`, plus `UNPROVEN` when the positive arm was not
run at all — since a clean absence control and a reader with no concept of the
word are indistinguishable without it. The per-kind rows above were correct
throughout; only the sentence over them was wrong.

## 9.10 The per-side measure — ordered fable-872 §2, and it moved a sentence in §5

*Run 2026-08-17 (shift 92) on the specimen the court had already bought, so the
frames cost nothing twice. DEV world, house money, **7 segmenter reads at
$0.005 = $0.035 modelled** (the order said $0.01 for two reads; the control and
the two midline reads are the difference, and they are named below because a
positive without them is worth nothing). Zero credits, no render, no row.
Driver: `scripts/measure-wings-per-side-disposable.mts`; panel and masks in
`output/wings-per-side/`.*

**PROMOTION-DESIGN DATA. Not a mint route** — the ruling it serves is already
made and is not in question: paired open kinds are words-only until promoted.
What this settles is whether the capability the ruling defers to promotion
actually exists.

```
1. regionSides("wings")          null, BEFORE any call is spent
                                 BILATERAL derives from the catalogue's
                                 `frame: "ownSide"` column; an open kind has no
                                 card. The door is shut by construction.
2. whole frame, as the mint asks 115,255 px · 7.3277% — ONE wing
3. control: the same subject wearing none (the court's `scales` frame)
     image-left   0.0000%  declines
     image-right  0.0000%  declines          both halves must decline — pass
4. the specimen, cut at her face's centroid (519 px), one side to a picture
     image-left   115,268 px · 14.4594% of its half   ANSWERS
     image-right  104,569 px · 13.4809% of its half   ANSWERS
```

**The arithmetic is the finding, and it is taken off the mask bytes rather than
off the percentages.** The whole-frame mask and the image-left half differ by
**13 pixels in 115,268** — they are the same wing, not "one wing and a bit". So
the mint's read is one instance exactly, and the split adds 104,569 px it never
returned: a second wing 90.7% the size of the first. **I opened the panel.**
Cell 2 paints the viewer's-left wing and leaves the other white; cell 3 paints
both. Law 9's point, on a frame where the number was never going to say it.

**The control is why the positive counts.** Two halves both answering is also
what a reader that answers something to every crop looks like — the vacuous
shape this program met on the earring reader (fable-378 §3) and the exact
failure the absence control exists for. Asked of the same subject wearing no
wings, both halves read 0.0000%.

**Two substitutions, declared** (court-must-assert-its-road). `bilateralHalves`
is module-private, so the halves are cut here and asked through the reader's
public `region`, which asks a non-bilateral name in instance mode `"first"`
where the real path asks a half in `"all"`. `first ⊆ all`, so the substitution
can only ever UNDERSTATE a half — a positive finding is safe in this direction
and a null one would have been ambiguous, and the verdict leans only on the
positive. The midline comes from a `face` read taken the same way. It is not an
end-to-end proof of anything on the product path and nothing here mints, files
or writes.

**What it means for whoever promotes a paired kind:** the closed lane's method
transfers. Cut at her midline and ask each half and both instances come back,
on a kind the catalogue has never heard of, with the negative arm clean. What
does NOT transfer is the *knowledge that the kind is a pair* — that is
catalogue knowledge, it is what promotion buys, and it is why the ruling is
words-only in the meantime.

## 9.11 Step 5a and step 6 as built — the door, and the sentence it is waiting for

*Built 2026-08-17 (shift 92), ordered fable-874 §3. No spend of any kind: this
is code and tests, no render, no read, no credit, no row in either world.*

**What shipped.**

| the piece | where | what it does |
|---|---|---|
| the unowned subject is RECORDED, not fatal | `refineDelta.ts`, `FreeLaneCheck.unowned` | §2's standing defect closed at the live boundary: one unknown noun no longer discards the facets read correctly beside it |
| the acceptance door | `openLaneAccept.ts` | names the kind from the customer's SENTENCE, after the closed lane has declined, and files `delta.open` |
| the demand writer | `server/db/castingV2OpenLaneDemand.ts` | one row per open ask: the normalized noun and how it went, and nothing else |

**The decision is at the CALLER and that is the whole architecture of it.**
`readDelta` guards the boundary where a model's reply enters the record and it
stays closed to open kinds — a reader free to accept a model-authored subject
key hands the composition key to the model with no closed lane in front of it,
and *"give her wings"* stops being eyeliner (§8 step 0). So the reader carries
the FACT and never the verdict, `refineInterpreter` runs `normalizeOpenKind`,
and that answer is checked against the closed vocabulary before it counts as
new. **A collision refuses.** It is a routing bug, not a new kind, and each one
names either a missing entry in `SUBJECT_NOUNS` or a real gap in the closed
interpreter.

**The reader split is pinned in BOTH directions, and each was sabotaged.** A
caller with no `check` — the persisted re-read, the paste road, the legacy
migration — still nulls the whole delta, because there an unowned subject is
corruption rather than an ask and partially accepting corruption is worse than
refusing it. Recording without a `check` reddens exactly the control; recording
without continuing reddens exactly the facets-survive arm.

**WALL (b) NEARLY FELL HERE, and the arm that caught it was an existing one.**
The closed reader refuses a garment by having no subject to file it under — so
`{coat: "red"}` arrives at this door as an unowned subject exactly like
`{fangs: …}` does, and the first cut of the acceptance would have minted
`open:coat`. The one wall that keeps a face edit from repainting the room would
have become the new lane's front door. The lexicon is now asked of the NOUN as
well as the words, because in that ask the garment is the key and the value is
just *"red"*; the accessory carve-out travels with it, so *"wearing small gold
hoops"* is untouched. §2's property 3 — *the open lane widens what may be named
and must widen nothing else* — was right to be written down, and it was one
test away from being written down and not kept.

**IT IS DARK, and this is the honest state.** The interpreter is not told it may
name a kind outside its vocabulary, so its replies still key onto the nearest
closed subject — which is exactly what §2's part A measured, and why the
whole-delta null was latent rather than live in the first place. **Nothing in
production routes into this door today.** The prompt clause that would open it
is its own step behind its own measurement, for the reason
`context-is-not-additive` names: a sentence added to that prompt moves routing
for asks that have nothing to do with this lane, and this program has already
measured a SUBSET of prompt context raising a wall twice as often as its
superset. A door built and driven at its own seam is the same shape step 3
landed in, deliberately.

**What the demand table can and cannot say today.** At the acceptance point the
knowable outcomes are `words_only` (accepted — and that is not a placeholder:
under the pair ruling's conservative interim an accepted open kind carries no
crop, so words are what it is), `refused` (collided, or a guard turned the words
away) and `unreadable`. `delivered` and `refunded` are render outcomes and are
reachable only when 5b wires the render's own result back. **And no kind means
no row**: when the normalizer could not name the thing at all there is nothing
honest to put in the one column that is not a timestamp, and a placeholder noun
would be a word nobody asked for sitting in the table built to hold only words
people did ask for. It is a log line instead.

## 9.12 The clause and its flag — built 2026-08-17 (shift 93), DARK

*Countersigned fable-878. No spend of any kind: code, tests and one read-only
database select. The flag is `off`, no Railway variable is set, and nothing in
production behaves differently because of this commit.*

### The corpus is 23 asks, and the figure this note carried was a different thing

`scripts/scout-open-lane-clause-disposable.mts`, read-only against production:

```
variant rows with instructions:      27
SUM of chain lengths (with repeats): 63     <- the shape the "55" figure had
DISTINCT ATOMS — what the interpreter is ever called with: 23
```

`casting_candidate_variants.instructions` holds the **cumulative chain**, not
the ask. opus-489's *"55 refine instructions"* answered *how much has been
typed* and was right about that; quoted as *how many prompts an arm costs* it
overstates by the depth of the chains. The distinct-atom table is the corpus of
record, and two of its twenty-three are open-lane asks already — *"give her
vampire fangs"* and *"give her horns and dangly cross earrings"*.

### THE LANE HAD NO FLAG, and the casting scope is `all`

Found before the sentence was written, not after. The acceptance door (§9.11)
shipped ungated: it was dark only because no reply emitted an unknown subject
key. With `CASTING_V2_SCOPE=all` in production that made the clause **a one-line
prompt edit away from opening this lane for every user in a single deploy**, and
it left the door reachable — rarely — by a reply that named an unknown key of
its own accord.

`CASTING_OPEN_LANE_SCOPE` now gates **both halves**: the prompt gains the clause
only when it is on, and the door is consulted only when it is on. Gating the
prompt alone would have been the difference between *dark* and *nearly always
dark*, which is not a difference a money path should rest on.

**Its parent is the REPAINT scope, not the casting scope** — see the next
section for why, and it is the reason this flag is stricter than its siblings'
convention required.

### The clause is TWO edits, and the second is why it was never additive

The addition is the last resort at the end of the free-lane rules. Three of its
sentences are load-bearing and each answers a measured failure: *a listed
subject that is genuinely about it always wins* (§2 — the lane is a FALLBACK,
never a peer, or *"give her wings"* stops being winged eyeliner); *the key is
the THING, never where it goes* (§1's one non-convergence, 3/3 the other way,
where *"scales on her cheeks"* keyed `cheeks` — a hair's breadth from a subject
the closed lane owns); and *widens what may be NAMED and nothing else* (§2
property 3, the sentence wall (b) nearly fell through on the 5a build).

The swap is the half that is not additive. The walls block routes fantastical
anatomy to the STAGE wall — a repair this programme measured 3/3 six days ago,
replacing a CONTENT wall that told the user it could never be rendered — and
**the wall check sits above the acceptance door**. Left alone, the addition is
inert for exactly the population the lane exists for.

**The OFF prompt is byte-identical to the one that shipped**, held to a fixture
captured from the code before the clause was written and never regenerated. The
routing bench's before arm IS this function with the flag off, so a drift of one
character would turn the measurement into a comparison of two things neither of
which ships. Three sabotages, each reddening only its own arms: the door's gate
removed (2 arms), the OFF prompt given the clause (5), the runtime parent AND
removed (1).

## 9.13 WALL (d) DROPS AN OPEN KIND — the re-read, read, and it is a BLOCKER

*The second of the two readers `refineDelta`'s header named as step 5's to
close. `filedSubjectsOf` was closed; this one was not, and the header's estimate
of it was too kind.*

The header said it *"costs nothing on the road the open lane runs on"*. Driven
rather than read (`scripts/probe-wall-d-open-disposable.mts`):

```
readDelta       on { free, open }  →  free survives, open ABSENT     (drops)
readStoredDelta on { free, open }  →  both kept                      (keeps)
readStoredDelta on { open }        →  kept
readDelta       on { open }        →  NULL
```

`refineService.ts:3148` re-reads the persisted row with **`readDelta`**, and
line 3149 throws when it is null. That line sits **above** the road split, so
it is not paste-road-only:

- **the ordinary open ask has no other content.** *"Give her vampire fangs"* is
  one ask and it is the open one, so the row is `{ open: … }` and wall (d)'s
  reader returns null → `"the refinement was not recorded in a readable shape"`.
  The throw settles into the request's own catch, which refunds — so the money
  is safe and the picture is not. **Sell-don't-refuse would become sell,
  then-refund** on the lane's headline ask;
- **on a face with prior edits the row survives and the open kind is silently
  dropped** from the composed prompt — the paste road's failure, and the worse
  of the two because nothing sees it.

**What the flag can and cannot do about it.** Making the parent the REPAINT
scope removes the silent-drop half by construction (the repaint recipe reads
`delta.open` and the composed state's, so the kind reaches the paint) and it is
why the parent is what it is. **It does not remove the throw**, which is above
the split and hits both roads.

**FIXED 2026-08-17 in the same shift, ruled fable-881 §3.** Wall (d) re-reads
**our own persisted row**, which is exactly the boundary `readStoredDelta`
exists for — its own header draws that split. So the reader at
`refineService.ts` is `readStoredDelta` now, and the two rejected alternatives
are on the record with it: a hand re-attach of `open` beside `readDelta` would
have been seventeen copied lines of a discriminator that already exists, waiting
to drift on a money path (working law 4), and exporting the discriminator is the
fallback only if the legacy behaviour below ever proves wrong.

**The declared behaviour change, driven both ways.** `readStoredDelta` also
migrates retired subjects, so a legacy row naming `free.hair` **threw here
before and composes now**. That is the defensible direction, and the reason is
that the throw was never a judgement about that row — it was the strict reader
refusing a vocabulary that predates it, which is the exact thing
`readStoredDelta` was written to stop one boundary over. Both directions are
arms in `wallDOpenKind.test.ts`, with a negative control: a row whose other
content is genuinely unreadable still returns null, so the fix cannot have
quietly removed the guard.

**Proven at the money, not only at the reader** (fable-881 §3c — the
harness-supplied-argument class, where a reader arm passes on a value the caller
never hands it). `refineService.test.ts` drives *"give her vampire fangs"* — one
ask, and it is the open one — through the service: it lands, it charges, and it
refunds nothing. That arm was **red before the fix and green after**, and the
sabotage that reddened it reddened nothing else.

**The lane is now turnable, and turning it on is still a deliberate recorded
act** — it waits on the routing bench, not on this.
