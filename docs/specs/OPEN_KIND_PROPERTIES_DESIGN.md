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
| **P2** | does this kind **extend** — anchored outside the frame, does it present inside it? | once per kind, ever | the KIND |
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
| **P2** extends | `nails` on a waist-up framing must come back NOT extending — fable-868's own class (c) example | one text call, once |
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
