# The kind-property design — what the catalogue would have known

*Ordered as ONE design, costed together: fable-871 §3 (how-does-the-code-know,
answered once for the view-carry clause and the does-it-extend door), fable-872
§2 ("is this kind paired" joins that list), fable-877 §4.2 (the successor's
second item). Written 2026-08-17, shift 93. **Nothing here is built.***

It carries three things from the founder and they are quoted where they bite:

> **The bound** (fable-876 §2): *"i think yes i just dont know what to expect
> obviously the reference is still king."*
>
> **The obligation** (fable-876 §1): *"we will need to test how it renders once
> you sign the cast so for now yes."*
>
> **The demand** (fable-879 §1): *"im just waiting for the viewer to actually be
> able to detect two wings rather than just 1 but that goes for everything i
> guess."*

---

## 0. Why these three are one design and not three

The open lane's founding problem, stated in `OPEN_LANE_DESIGN_NOTE.md` §0, is
that **the closed list is a KEY SPACE**: eighteen tables decide something about
a subject, and a kind nobody catalogued has no entry in any of them.
`openKindPolicy.ts` answers all eighteen — and it answers them *uniformly*,
with constants, for every open kind alike. That was the right first move and its
own header says what it costs: `openKindIsPlural()` returns the same answer for
`wings` and for `tail`.

The three questions on the order are **the three constants that are wrong often
enough to matter**, and they are one design because they are one shape:

> a fact about a KIND that the catalogue would have held, which nobody has
> catalogued, and which no table can be made to hold because the vocabulary is
> open by construction.

Every one of them needs the same three parts — **a source, a control, and a
store** — and getting those three right once is most of the work. Designing them
apart would buy the same infrastructure three times and, worse, would let three
different answers to *"how do we know?"* into a lane whose entire premise is
that nobody has decided anything yet.

## 1. The three questions, said precisely

They are not the three the order names, because one of them is two.

| | the question | when it is asked | who it is about |
|---|---|---|---|
| **P1** | is this kind **paired** — does the noun denote a matched set? | once per kind, ever | the KIND |
| **P2** | **where on a body is this kind anchored?** | once per kind, ever | the KIND |
| **D1** | did this delivery produce the **right count**? | every delivery of a paired kind | the FRAME |
| **D2** | is this recorded fact **shown** in this frame? | every view that carries words | the FRAME |

**P1 and D1 are not the same question and conflating them is the trap.** *"Wings
are a pair"* is catalogue knowledge and is true forever. *"This render gave her
one wing"* is a fact about one picture. The founder's demand is **D1** — he is
not asking whether wings come in twos, he knows that; he is asking the product
to notice when it delivered one. A design that answers P1 and calls the demand
served would ship a lane that knows wings are paired and cannot tell that it
painted one.

Likewise **P2 is prospective and D2 is retrospective**: P2 decides whether to
sell at all (fable-868's class (b) versus class (c)); D2 decides what words a
later view must carry because the anchor could not show them.

> **CORRECTED 2026-08-17 (shift 94, ruled fable-897 §3): P2 IS A PLACE, NOT A
> BOOLEAN — and the sentence it replaced was wrong for seven of this product's
> eight framings.**
>
> P2 was written above as *does this kind extend — anchored outside the frame,
> does it present inside it?* **That question contains a framing and this table
> holds one row per kind.** The premise was checked before the prompt was
> written, and the product does not have one framing:
>
> ```
> the REFINE road   waist-up, "from mid-torso up in a 2:3 portrait"
>                   (`cohortPhotorealHuman` FRAMING — and `castingFrame.ts` leans
>                    on exactly this: one framing, one answer, no read)
> a SIGNED cast     closeUp                                 eyebrows-to-chin
>                   frontClose / threeQuarter / sideClose    head-and-shoulders
>                   frontFull / sideFull / backFull          HEAD TO FEET
> ```
>
> So *does a tail present in the frame* is **no** on the road that paints it and
> **yes** on three of the views a Cast is signed into. A single boolean forces one
> of those answers onto the other seven, and the place it would have surfaced is
> §7 — the founder's own obligation court, which is the worst place to discover a
> schema mistake.
>
> **The repair splits the question along the line between a fact and a
> derivation**: the model answers WHERE the thing is anchored, from a closed list
> of eight places, and the code answers whether that place is inside a given
> framing (`shared/bodyAnchorRegions.ts`, a total table over all eight framings,
> so a new view does not compile until somebody decides what it shows). Same one
> call per kind, one fewer model opinion in the product, and a control that can be
> answered wrong in an obvious way — `nails → hands`, never `nails → head`.
>
> It is `castingFrame.ts`'s own method — a table of regions against a framing —
> generalized to a kind that has no facet.

## 2. Where the answers come from — and the one place they must not

### The rejected source: the interpreter's own reply

The obvious move is to add `{ paired: true, extends: true }` to the reading the
interpreter already returns. It is free, it is one call, and **it is wrong for
two measured reasons.**

First, **the prompt is not a free surface.** This shift's routing bench measured
what a single clause does to a prompt whose job is elsewhere: one atom of seven
in the collateral set moved between closed subjects for no reason but the
clause's presence. Asking the interpreter two more questions per ask is a change
to every ask, priced against a benefit that only exists for open ones.

Second, **it buys a per-KIND fact at per-ASK frequency**, so the same question
about `wings` is asked and paid for on every render, and — worse — may be
answered differently on two of them. That is the unowned-axis collapse with an
extra step: a property that wobbles per ask is a property nothing can key on.

### P1 and P2: one text read per NEW kind, ever

A kind arrives at the acceptance door already normalized to a single noun
(`openLaneKind.ts`). At that point, if the kind has never been seen, **one text
call answers both properties at once** and the answer is stored against the
kind, not the ask.

The question is asked of the WORD, with no frame and no customer sentence in it,
because both properties are facts about the thing rather than about this
picture. Keeping the sentence out is also what stops the read from becoming a
second interpreter with an opinion about the ask.

**It is asked in a form that cannot be answered wrong** (the class this campaign
named on SAM3's laterality): not *"is it paired?"* — which invites yes — but a
forced count with a named alternative, and a reach question with a named
alternative. The exact wording is a build decision; the design bar is that
**both answers must have a cheap negative control**, §4.

### D1 and D2: one vision read per delivery, and the instrument already exists

`referenceMint`'s absence control (design note §9.8) already asks a segmenter
its question of **the frame this render was painted FROM** as well as the
delivered frame, and refuses a crop when the reader answers on both. D1 and D2
are that instrument pointed one surface along:

- **D1** is the same read, counting instances rather than asserting presence.
  Gated on P1: a kind that is not paired is never counted, so nothing is spent
  asking how many tails she has.
- **D2** is the same read asking presence on the view being rendered. A fact the
  read cannot find in this frame is a fact the anchor cannot show, which is
  exactly the set the view-carry clause is allowed to speak about.

**This is the whole of the how-does-the-code-know question, and the answer is
that the code LOOKS.** It does not infer visibility from geometry, from the
frame's cut line, or from what the recipe said it painted — three things this
program has been wrong about before, each time because a claim about a picture
was derived instead of read.

## 3. THE FOUNDER'S BOUND, and where it binds

> **THE REFERENCE IS STILL KING.**

D2's output is a list of facts, and the temptation is to hand that list to the
view prompt as a description. **The bound forbids it.** The clause a fuller view
carries may say only what the anchor cannot show, never re-describe the person,
and where words and pixels could disagree the pixels win.

Mechanically, that is three properties of the clause and each is checkable:

1. **It is built by SUBTRACTION, never by selection.** The clause's content is
   *(everything recorded) minus (everything D2 found in the anchor)*. A design
   that picks facts to include would drift into description one commit at a
   time; a design that removes what the anchor already shows cannot, because
   anything the anchor shows is structurally absent from the clause.
2. **It names only OPEN kinds and their words.** Closed facets are the anchor's
   business — the anchor was rendered from them.
3. **It has a conformance control BEFORE it rides six paid views** (fable-871 §3,
   invariant 7). The control is a view rendered with an EMPTY clause beside one
   rendered with the clause: if the judge cannot tell them apart on a cast whose
   record holds an invisible fact, the clause is doing nothing and must not be
   sold as if it were.

## 3b. A WORN GRAPHIC RIDES AS AN IMAGE, NEVER AS WORDS — founder requirement,
## fable-891 §1

> *"tatoo flash sheets will need to be referenced when creating the different
> cast angles also after signing also otherwise they will be hallucinated."*

**REQUIREMENT.** Any worn graphic — tattoos first, with the flash sheet as the
canonical reference — rides into view generation as an **image reference beside
the anchor**, not as a sentence in the clause §3 governs.

The grounds are already measured on our own record: opus-642 §3 proved a view
renders from the anchor plus a constant. A tattoo is a precise graphic seen from
exactly ONE angle in the anchor, so a three-quarter or back view has nothing to
copy from and the engine invents one. That is not a likeness drift the clause
can fix by describing the design harder — a description of a graphic is a brief
for a *different* graphic.

### This is the bound applied, not an exception to it

The temptation is to read this as a carve-out from *the reference is king*. It is
the opposite, and the distinction decides how it gets built: **where the anchor
cannot show something, the answer is another REFERENCE, never a description.**
The founder's bound says pixels win over words; this requirement supplies pixels
for the one case where the anchor has none to offer. The sheet references the
GRAPHIC and never re-describes the person — the same likeness-drift guard, on
the same side of the argument.

### The two carriers must not be conflated — and §3's subtraction proves it

§3.1 builds the word clause by subtraction: *(everything recorded) minus
(everything D2 found in the anchor)*. **A tattoo IS in the anchor** — that is the
whole problem — so subtraction correctly strikes it from the word clause, and
§3.2 strikes it again for being a closed facet rather than an open kind. Under
§3 alone a tattoo is therefore silent in every view, which reads as correct
right up until the back view paints a design nobody chose.

So the two mechanisms answer different questions and neither substitutes:

| | what the anchor is missing | the carrier |
|---|---|---|
| §3's clause | a FACT the anchor cannot show (an out-of-frame open kind) | words, built by subtraction |
| this section | a GRAPHIC the anchor shows from one angle only | the sheet, as an image reference |

The trigger is therefore **not** "D2 could not find it". It is "the record holds
a graphic", which is a property of the recipe rather than a reading of the frame
— and that means this requirement needs no vision call to decide it fires.

### It is covered by the control that already exists

No new control (fable-891 §1, and fable-871 §3 governs): the conformance pass
proves a clause LANDED rather than assuming it, and an image reference is a
clause like any other. The shape transfers with one substitution — a view
rendered without the sheet beside one rendered with it, on a cast whose anchor
carries a tattoo, judged on whether the graphic is the SAME design. If the judge
cannot tell them apart, the reference is doing nothing and must not be sold as
if it were.

### The wordside tattoo is a NAMED GAP, not a silence — ruled fable-892 §3

A cast whose tattoo arrived by WORDS has no flash sheet to reference, and this
requirement cannot invent one. The ruling is that this case is **recorded rather
than dropped**: when a graphic-class feature is delivered wordside, the record
files it toward the flash-sheet mint (D-138 lineage — a sheet is derivable from
the delivered frame later) and says **the sheet is owed.**

The distinction is the whole of it. "No sheet, so the anchor alone" is a silent
degradation that will read as working until a back view paints a design nobody
chose. "No sheet, and one is owed" is a fact the view-carry build can act on and
the conformance control can look for. No inventing, no silent drop — the same
shape as `noSpecimen` in `OPEN_LANE_CARRY_DESIGN` §5, where silence became a
loud written decision.

**Still open for the build:** whether the sheet is minted at the moment the
wordside graphic is delivered, or lazily at Sign when the views are about to be
rendered. This note does not decide it; the ruling requires only that the debt
is written down.

## 4. The controls, and each one can fail

Every answer above is a reader's answer, and this campaign's standing rule is
that a reader never seen to decline is not a reader (design note §4, law 9).

| answer | the control that could redden | what it costs |
|---|---|---|
| **P1** paired | kinds that are definitely singular — `tail`, `halo`, `beak`, `horn` (singular) — must come back NOT paired. A reader that pairs everything is the earring reader's vacuous shape (fable-378 §3) | one text call each, once |
| **P2** anchor | `nails` must come back `hands` — fable-868's class (c) example, restated as a place. Answerable wrong in an obvious way, which is what the boolean form was not | one text call, once |
| **D1** count | **a frame holding ONE of a pair must read one.** This is the hard control and the specimen already exists: it is the founder's own one-winged frame, which is what produced the demand | a frame he has already paid for |
| **D2** shown | the absence control's existing shape: the reader must decline on a frame that does not hold the thing, or its answer on one that does cannot be told from a confident region of nothing | one read, already budgeted by §9.8 |

**D1's control is the one that decides whether the founder's demand is
servable.** If a segmenter asked *"how many wings"* answers "2" on a frame
holding one, the count is not measurable with the instrument we have and the
honest design says so and stops — rather than shipping a counter that agrees
with the recipe. That is the fine-texture-blindness lesson (fable-872 §3)
arriving in a second modality: **budget for reader blindness from day one, and
declare what the instrument cannot see rather than silently missing it.**

## 5. The store — and the migration lands first

P1 and P2 are per-kind facts and the demand table is per-ask
(`casting_open_lane_demand`: kind, outcome, timestamp). They do not belong in
it: a property written onto every ask row is the same fact stored N times,
waiting to disagree with itself.

So: **a new table, one row per kind ever seen**, holding the two properties, the
model and prompt version that answered, and when. Small — it grows by one row
per new noun in the language, which the corpus prices at a handful a month.

**The migration lands before any code writes to it**, per this campaign's own
rule: a new column on a written table is in every INSERT, so there is no dark
landing available. Production takes it by the ceremony script, as `0025`, `0028`
and `0032` did.

D1 and D2 are facts about a FRAME, not about a kind, and they already have a
home: the delivery's own record, beside the mint's verdict.

## 6. What it costs, in full

```
P1 + P2   one text call per NEW kind, ever          $0.0148   (measured this shift,
                                                               not estimated)
          at 100 distinct kinds — more than the whole corpus has produced —
          $1.48 TOTAL, forever
D1        one segmenter read per delivery of a
          PAIRED open kind                          ~$0.005   beside a paid render
D2        one segmenter read per view carrying
          words                                     ~$0.005   × 6 views at Sign
controls  P1 four negatives, P2 one, D1 one frame   ~$0.08 of text + a frame
                                                               already bought
```

**The whole per-kind half is a rounding error and the per-frame half is the
house-money argument §4 already made.** The only real cost in this design is the
founder's obligation, next.

## 7. THE FOUNDER'S OBLIGATION — a court, not a build

> *"we will need to test how it renders once you sign the cast so for now yes."*

The free-accept interim (an out-of-frame ask is recorded free, no render bought)
stays *"for now"* until this passes his eyes. The court:

1. a cast whose record holds an open kind that is **not visible in its anchor** —
   the exact case free-accept creates;
2. **Sign it**, which renders the six fuller views. This is real money and it is
   the only line in this design that is;
3. put the six frames in front of him with one question: **does the fact he
   recorded appear, and does she still look like herself?**

Both halves matter and the second is the bound: a view that grows the wings and
loses the woman has failed, and only his eye closes that. Law 9 governs — no
reader verdict closes this court.

**It is also the natural home for D1's control**, because a paired open kind
carried into six views is six independent chances to observe the count, on
frames somebody was going to look at anyway.

## 8. What this unblocks, and what it does not

**Unblocks 5b.** The pair ruling's conservative interim — *no open kind mints a
crop, words only, until promoted* (fable-872 §2) — exists precisely because
nothing can tell a pair from a single. P1 answers that, and P1 plus a passing D1
is the condition under which a crop of a paired kind may file under a name that
means both. Until D1's control passes, **the interim stands and the honest
answer is still words.**

**Unblocks the view-carry clause**, whose whole content is D2's subtraction and
whose bound is §3.

**Does NOT unblock the auto-discovery scan** (`POST_SIGN_ROADMAP.md` §5c). His
gate on that names this design as its first precondition, and rightly: a scan
that discovers uncatalogued features needs to know whether it found one thing or
half of a pair before it fills a panel row.

**And it does not decide promotion.** Which kinds get catalogued is the demand
table's job and stays there. This design tells the product what it does not know
about a kind; the table tells it which unknowns are worth buying.

---

## 9. STAGE A AS BUILT — the store, 2026-08-17 (shift 94)

*Countersigned fable-896. No spend of any kind: a migration, a schema entry, a db
module, eight unit tests, and a rehearsal against throwaway tables. No render, no
model call, no credit.*

| the piece | where |
|---|---|
| the table | `drizzle/0033_casting_open_kind_properties.sql` |
| the typed schema | `drizzle/schema.ts`, `castingOpenKindProperties` |
| the two doors | `server/db/castingV2OpenKindProperties.ts` |
| the ceremony | `scripts/ceremony-open-kind-properties.mts` (dev APPLIED, production owed) |
| the shape check | `scripts/lib/openKindPropertyShape.mts` — shared, so the rehearsal drives the ceremony's own assertions |

**§5's shape, with two decisions it left open now made and written where the next
reader is.**

1. **The unique key is `kind` ALONE, not `(kind, promptVersion)`.** The tempting
   key lets a re-ask under a better prompt land beside the old answer. That is
   two rows for one question, which forces every reader to invent a rule for
   picking — and a rule that can differ between readers is how a property that
   must be stable per kind starts wobbling per caller, which is the exact defect
   §2 rejected the interpreter's own reply for. The answering model and prompt
   ride on the row as provenance; a re-ask is an UPDATE by a build that decided
   to re-ask.
2. **Both properties are NOT NULL, and a DECLINED READ WRITES NO ROW.** The
   absence of a row is the third state. A nullable `paired` read by a gate that
   treats null as false would mint a crop of one wing under the name of two —
   fable-872 §2's own prohibition, arriving through the store rather than the
   gate. Its cost is stated on the migration: while the text transport is down,
   a kind with no row re-buys the read and gets nothing, which is bounded by the
   render needing the same transport.

**`anchorRegion` LANDS STORED AND UNREAD, AND ITS HEIR IS NAMED** (the bound
fable-896 §2 attached to the approval). P1's consumer is the mint gate, in this
build. P2's consumer is the **out-of-frame build** — the one deciding whether an
invisible-now ask is accepted free (fable-869 §2, fable-876 §1) or dispatched.
The condition under which storing it becomes a defect is exact and is written on
the module: *that build shipping while it still decides class (b) from anything
other than this column.* A fact collected and never asserted is the `about`-column
incident; the way that is not repeated is naming the heir in the store.

### The instrument was proved before its greens counted

The ceremony applied on dev (`:52008`), printed its three lines, and said ALREADY
APPLIED on the re-run. That is worth nothing on its own, so the same three
assertions were driven against four throwaway tables
(`scripts/rehearse-open-kind-properties-disposable.mts`, dev only, dropped by the
names it minted):

```
RIGHT     expected PASS    → PASS
NO KEY    expected REFUSE  → REFUSE — uq_…_kind is not a UNIQUE index on `kind`
NULLABLE  expected REFUSE  → REFUSE — `paired` is nullable
EXTRA     expected REFUSE  → REFUSE — columns nobody designed: userId
```

And the store's own key guard was sabotaged before it was believed: widening
`isKey` to admit spaces and 640 characters reddened **exactly** the two arms that
assert it and no others. The reason those arms assert *the database was never
reached* rather than a `null` return is that with no pool a refused key and a
missing database are the same return value — the misaimed-guard shape, which
would have shipped a green guard that had never fired.

**The production ceremony is owed, not run.** It is a production-database change
and therefore founder-run or delegated by name; nothing in production reads or
writes this table while `CASTING_OPEN_LANE_SCOPE` is off, so there is nothing
waiting on it. Rehearsal now, ceremony the day the lane opens for anybody.

---

## 10. STAGES B, C AND D AS BUILT — 2026-08-17 (shift 94)

*Countersigned fable-896, fable-897 and fable-898. Spend: **nine text calls plus
a four-call stability pass, ≈$0.18 of house money, and not one credit.** No
render, no production change, no flag set.*

| the piece | where |
|---|---|
| the read | `server/castingV2/openKindProperties.ts` — the prompt, the parse, the cache |
| the derivation | `shared/bodyAnchorRegions.ts` — eight places against eight framings |
| the mint's producer | `mintedSlots.ts` — the `open` input, `unfiledOpen`, the two reasons |
| the wire | `refineInterpreter.ts` buys the property; `refineService.ts` reads it at the mint |
| the outcome | `openLaneAccept.openLaneOutcomeOf`, called from three terminal sites |
| the court | `scripts/court-kind-properties-disposable.mts` |

### The court, and ONE BAR WAS CORRECTED POST-HOC — here is the audit trail

Nine arms, `anthropic/claude-sonnet-5`, bars written into the script above the
spend, scoring dry-run first with a deliberately wrong canned answer so the
comparison was seen to fail before the money moved.

```
tail     single  belowWaist    P1 negative · P2 positive
halo     single  head          P1 negative
beak     single  head          P1 negative
crest    single  head          P1 negative (replaces `horn`)
wings    paired  torso         P1 positive
fangs    paired  head          P1 positive
horn     paired  head          P1 positive — the catalogue's own pair
nails    paired  hands         P2 negative — the design's own control
scales   paired  wholeBody     the `many` fold
```

**`horn` was written as a NEGATIVE and the reader answered PAIRED.** The bar was
wrong, and the thing that settles it predates the court: **this product's own
catalogue holds `horns@left` and `horns@right`** — `referenceSlotCatalogue.ts`,
`instances: { of: "perSide", pairNoun: "horns" }`, with `noun: "horn"` singular
beside it, declared by founder ruling on 2026-08-15 and minted from real renders
on his own cast. The product's lived answer to *how many horns does someone who
has them have* is two. The reader agreed with the product; the bar did not.

Corrected on that ground alone, ruled fable-898 §2a, and recorded here rather
than quietly: **re-arguing a bar from the court's own data would be optional
stopping; moving one against independent prior evidence, with the evidence named,
is not.** `crest` replaces it as the fourth negative — unambiguously one thing,
absent from the prompt, and the catalogue holds no crest.

**The stability pass was pre-registered before it was bought** (fable-898 §2b),
with dispositions that did not depend on which way it fell: `3/3` the same answer
means a considered one; MIXED is a stop on P1 whatever the majority says, because
a gate on a property that wobbles per call is the unowned-axis collapse with a
coin flip in it.

```
horn ×3: paired, paired, paired    STABLE
```

### What the build honours, in the order it would break if it did not

1. **A SINGULAR open kind mints a crop; a PAIRED one does not.** fable-872 §2,
   and the gate is a pure function so it is driven without a database, a frame or
   a vision call.
2. **`null` is not `false`.** A kind nobody has answered for files
   `openKindPairUnread` and cuts nothing. Two words rather than one, because
   *"we asked and it is a pair"* and *"we never got an answer"* are two facts and
   only the second is worth chasing.
3. **Structure is judged before policy.** A malformed key or an ask with no words
   is a DEFECT, and counted as *"words-only because it is a pair"* it would
   inflate the one number the promotion decision reads while hiding a bug behind
   a ruling. So `openKindPaired`'s count is a count over well-formed asks.
4. **The prompt asks WHERE and never whether the thing extends** (fable-897 §3c),
   and it names none of the control specimens. Both are asserted mechanically,
   with a positive control that the prompt does carry the examples it should —
   `not.toContain` over an empty string is the assertion that cannot fail.
5. **The property is a CACHE and the arms count the calls.** One text read per new
   noun ever; every ask after that is a table read. Asserted at the seam, because
   a cache that silently re-bought would look identical from the return value —
   the shape the face-scan re-buy wore for two days.

### The demand row moved to the terminal moment, and one hole was closed

`words_only` at the acceptance door was true by construction while no crop could
ever mint. It is now a PREDICTION, so an accepted ask writes ONE row when its ask
ENDS — `delivered` (a crop filed), `words_only` (served, no crop), `refunded`
(money back) — and a refusal still writes at the door, where the door is terminal.

Closed in the same sitting: the out-of-frame refusal at `refineService` is BEFORE
`admit`, so it reaches neither the delivered path nor the refund catch. An
accepted open kind arriving beside closed facets all out of shot would have ended
there having filed **nothing**, leaving the tally short by a whole class of ask
rather than by the occasional process death. It now files `refused`, which is the
table's own word for *a door turned it away for free*.

**The undercount that REMAINS is named**: a row lost to a process death between
the render settling and the insert — a deploy landing mid-render, a sweep-settled
refund. It is unbiased, it is the fail-soft the writer has by design, and the
demand reader's own header now says so, because a reader that knows its hole beats
one that discovers it in a ratio.

### What is still owed after this

- **D1, the count**, and it is a court rather than a build: §8's condition for a
  PAIRED kind's crop is *P1 plus a passing D1*, and D1's control is the founder's
  own one-winged frame. 5b opens the singular kinds; the paired half stays
  words-only with its reason now NAMED rather than blanket.
- **`anchorRegion`'s consumer** — the out-of-frame build. Stored and unread, with
  its heir named on the module and the exact condition under which storing it
  becomes a defect.
- **The production ceremony for 0033**, founder-run or delegated by name. Nothing
  in production reads or writes the table while `CASTING_OPEN_LANE_SCOPE` is off,
  so nothing waits on it.

---

## 11. THE CARRY DROP — the defect 5b's own walk found, and the sweep that came
## with the fix (2026-08-17, ruled fable-900 §2)

*Found by a paid dev render, not by reading. Fixed with its class, per law 7.*

### What happened

5b minted the first crop this product has ever held for an uncatalogued word —
a halo on dev #375. The very next edit, *"give her copper hair"*, dispatched
**one reference: the master.** The persisted dispatch record is the evidence:

```
references: [ { key: casting-v2/candidates/0cacbf7d….png, kind: "master",
                digest 681c16a7…, sentGeometry 1024x1536 } ]
the halo crop by KEY:    false      the halo crop by DIGEST: false
```

The service's own log named the cause while the render was in flight:
`dropped: ["open:halo"]` · *"a crop stopped riding because the chain no longer
asks for it"*. **And the delivered frame had no halo at all** — not re-rolled,
absent — while the recipe said *"Change only her halo: a halo"*. Charged 25,
refunded 0.

### The cause is a derivation

`prunedCarries.slotsNamedByChain(composed)` built its set from
`facetsWrittenBy(composed)` — facets only — and an open kind has none, by the
open lane's own premise. So `open:<kind>` could never be named; its row is not
master-minted and not re-minted every render; **every open kind's crop was
dropped on every subsequent render, by construction.** Two answers to *what does
this recipe name* with the second invisible to the first (working law 4).

The repair derives from the same delta the carry reads (`composed.open`) rather
than exempting the namespace — an open kind whose step is PRUNED must still lose
its crop, and that arm sits beside the regression arm in
`prunedCarries.test.ts`. Both were written RED and seen to fail on the old
derivation.

### THE SWEEP — every consumer of `facetsWrittenBy`, classified

Law 7's requirement, and it found a second live instance:

| site | verdict |
|---|---|
| `prunedCarries.ts` — the carry list | **FIXED**, this commit. The defect above |
| `refineService.ts` — the out-of-frame survival test | **FIXED**, this commit. `survives = facetsWrittenBy(inFrame).size > 0` counted an open-kind-only remainder as nothing, so *"give her a halo"* beside an out-of-shot waist refused the WHOLE ask including the half we could serve |
| `refineService.ts` — `writtenFacets`, `deliveredByChain`, `composedFacets` | NOT APPLICABLE, and it is a fact rather than an assumption: all three feed CAPTION machinery, and an open kind produces no caption (no facet, so no caption reader is ever asked). Nothing to drop, keep or invalidate |
| `refineService.ts` — the verification `facts` list | **A REAL GAP, ALREADY DECLARED**: an open kind gets no verification fact, so its presence is never checked and D-246 class (c) cannot fire for the one lane whose money story IS presence. This is `FREE_SUBJECT_KIND` standing `owed` in `openKindPolicy`, refiled by fable-900 §3 at the head of the post-fix queue with its true exposure — the lane is LIVE for user 1 |
| `refineService.ts` — `removedFacets` on a prune | NOT APPLICABLE. A pruned open-only step contributes no facets and needs to: its crop drops correctly because the RECOMPOSED chain no longer holds the kind, which is the negative-control arm |
| `refineService.ts` — the `rephrased` telemetry | FILED, not fixed. Two consecutive open-only asks about one kind are not marked `rephrased`, which costs a satisfaction signal and nothing else. Named so it is a decision rather than an oversight |
| `refineDelta.ts` — `composePreservation` | NOT APPLICABLE. The preservation clause names facets to hold still; an open kind is held by its own carry clause, which `repaintAsks` builds from `delta.open` directly |
| `refineDelta.ts` — the departure list | FILED with the departure gap: `DEPARTABLE_SUBJECTS` is `owed`, and its own basis says the drop-the-carry claim *"must be PROVED rather than assumed"*. Removing an open kind is not this commit and now has a second reason to be courted |
| `refineRemoval.ts` — `facetsOfStep` | FILED, same gap. The matcher narrows by a CLOSED subject's facet, so *"remove her halo"* has no facet to narrow on. It cannot silently drop the wrong step (an open kind's facet set is empty, so it matches nothing rather than everything), which is the safe direction |
| `repaintAsks.ts` | ALREADY HANDLED. It reads `delta.open` explicitly and its own comment says so — the one consumer that was written after the open lane existed |

**The pattern worth carrying out of this**: `facetsWrittenBy` is how this codebase
answers *what does this recipe name*, and the open lane's premise is a key with no
facet. Every list built on it is a place where a delivered open kind can quietly
stop existing, and the two that mattered were both about what a render is ALLOWED
TO DO rather than about what it says.
