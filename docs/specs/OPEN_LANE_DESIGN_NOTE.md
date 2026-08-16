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
| §2 the whole-delta `null` (one unknown noun discards every facet in the instruction) | **REMAINING, and still latent rather than live** — the line moved from `refineDelta.ts:638` to **`:721`** and is unchanged | read today |
| §3 `openKind` as its own `UnfiledReason`, never `notASlot` | **DELIVERED** as declared scaffolding, landed before anything can produce it, with a negative control that today's producer cannot emit it | `mintedSlots.ts:184–220`; `mintedSlots.test.ts` 33 tests green today |
| §3 the slotless `Ask` in the recipe assembler — *"the largest build, and the majority of the work"* | **REMAINING** — `repaintAsks` still refuses `uncatalogued`, and that refusal is `RepaintCannotSayError`, non-retryable, settling into a refund | `repaintAsks.ts:190, 509, 659` |
| §4 the mint door's per-kind absence control | **REMAINING — and PROMOTED in importance** (§9.4) | the phrase appears in one file in the repository, and it is the policy record describing what is owed |
| §5 open kinds are singular until promoted; one-of-a-pair refuses into refund | **DELIVERED as policy** | `openKindIsPlural() → false`, with §5's reasoning as its basis |
| §5 the pair trap in the flagship instance | **SUPERSEDED** — horns arrived as a pair and got **per-side geometry** through promotion, not through the open lane | `referenceSlotCatalogue.ts:612–655`, `perSide` |
| §6 open kinds are `presence` by derivation; D-246 class (c) applies | **DELIVERED as policy, REMAINING as enforcement** (`FREE_SUBJECT_KIND` is one of the nine `owed`) | `openKindBinds()`; `owedByThePolicy()` |
| §7 the demand table, and nothing else in it | **DELIVERED in dev** — migration `0031`, schema, ceremony with a positive control on the existence reader and a check that none of the four forbidden columns appeared | `drizzle/0031_casting_open_lane_demand.sql`; opus-307 §2 |
| §7 the same table in production | **REMAINING — an open founder-queue item since shift 72b**, one idempotent command, nothing waiting on it | `founder-queue.md:997` |
| §7 the writer | **REMAINING** — three files name the table: the schema, the migration, the ceremony. Nothing inserts a row | grep, run today |
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
step 3  the mint door's absence control   REMAINING        — +1 read/kind/delivery
                                                             ($0.005), a specimen
                                                             set that must be NEW
step 4  the slotless Ask             REMAINING             — see §9.7: the scout
                                                             moved this figure, and
                                                             the assembler is not
                                                             where the work is
step 5  the acceptance path          REMAINING             — refineDelta:721 +
                                                             the interpreter's reply
                                                             shape (`delta.open`)
step 6  the demand writer            REMAINING             — after the prod ceremony
```

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
catalogued. Two shapes, neither decided here:

- **(a) a synthesized key** the catalogue can answer for — an open kind mints
  under a derived slot (`open@horns`) and `slotDefinition` gains one dynamic
  branch;
- **(b) a carry that is not slot-keyed** — the crop rides the ask itself rather
  than the library, which keeps the catalogue closed and makes the open lane's
  memory weaker than the closed lane's.

The ripple either way is countable: **8 `slotDefinition` call sites** outside
the catalogue and its tests — 5 in `refineService.ts`, 2 in `repaintAsks.ts`, 1
in `recipeAssembler.ts`. That is the whole surface that would have to tolerate,
or answer for, a slot the catalogue did not author.

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
