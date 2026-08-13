# The body row — design note

*Owed to Fable before any build, per fable-360 ruling 3. Written 2026-08-13,
shift 67. **BUILT shift 71** — see §7 at the end for what shipped, what was
measured on the way, and the two things the note got wrong.*

> **Founder, fable-360:** *"We need body shape/build — larger bust, smaller
> waist, bigger arms, bigger chest etc — this would need a row."*

Four questions were asked of this note: **interpreter vocabulary · the region
story (does SAM cut a torso) · verification facts · how it carries.** A fifth
turned up on its own and outranks all four, so it goes first.

---

## 0. The question nobody asked, and it changes the answer to the others

**Her waist is not in the picture.**

The cast master this whole workstream runs on is `2f00870e`, 1024×1536, and it is
a casting portrait: head, neck, shoulders, chest and upper arms, cropped at
roughly the lower ribs. The delivered anchor #178 frames identically. Both were
opened and looked at, at a size where the crop edge is unambiguous — not inferred
from an aspect ratio.

Against the founder's own four nouns:

| his noun | in this frame? | and |
|---|---|---|
| bigger chest / larger bust | **yes** | under a grey t-shirt |
| bigger arms | **yes** | upper arms, bare below a short sleeve |
| broader shoulders (added) | **yes** | under the same t-shirt |
| smaller waist | **NO — outside the frame** | so are the hips |

So *"make her waist smaller"* on this cast is **not an edit at all.** It is the
fifth member of the refuse-before-dispatch family, and the family's own logic
already covers it:

```
absent        you cannot segment a thing that is not there   (D-213)
silhouette    you cannot segment a shape not yet made        (D-218)
occluded      you cannot edit what nothing can see           (D-226)
already-true  there is nothing to do
OUT OF FRAME  you cannot edit what the photograph does not contain
```

`occluded` is the near neighbour and it is **not the same door**. A waist under a
t-shirt is occluded; a waist below the crop line is not in the file. One could be
answered by a different garment, the other only by a different photograph.

**Consequence for the row: every existing panel row is in frame by construction —
a casting portrait always contains the face — and this is the first row that is
not.** Whatever else the body row is, it needs a per-frame in-shot test before an
ask on it is priced. That is a genuinely new shape and it is why this note exists
before a build rather than after one.

---

## 1. Interpreter vocabulary — measured, not read

Reading `refineSubjects.ts` says there is no `bust`, `waist`, `build`,
`shoulders` or `arms` in `FREE_SUBJECTS`, so a body ask "has nowhere to land."
That is a claim about a stochastic model's behaviour, and this program's own
record prices such a claim at what a probe of it is worth.

Driven — `scripts/probe-body-vocabulary-disposable.mts`, six sentences × n=3
through the real `interpretRefinement`, no renders:

```
"give her a larger bust"    3/3 REFUSED  wall_stage  ("her bust size", "her build")
"make her waist smaller"    3/3 REFUSED  wall_stage  ("her waist/body shape", …)
"give her bigger arms"      3/3 REFUSED  wall_stage  ("her build", "her arm size")
"a bigger chest"            3/3 REFUSED  wall_stage  ("her body", "her body/chest size")
"broader shoulders"         3/3 REFUSED  wall_stage  ("her build", "her shoulders/build")
"a more athletic build"     3/3 REFUSED  wall_stage  ("her build")
------------------------------------------------------------------------
18 samples: 18 refused · 0 filed · 0 other
```

**Nothing filed, on any sample.** That is the good outcome of the four available:
a body ask today is refused **before dispatch**, so it costs the customer nothing.
The alternatives would all have been worse — a bust ask landing in
`skinCharacter` or `marks` would render something wrong and charge for it.

**So the body row is entirely new road, and the road is currently clean.**

### WHY it refuses, and this is the sentence the whole note turns on

The first reading of this said the refusal was the interpreter's unbacked stage
wall — the same door that coin-flips on *"make her albino"*. **That was
incomplete, and chasing it found the real cause**, in the interpreter's own base
system prompt (`refineInterpreter.ts:183`):

> *"Casting decisions are NOT refinements: **age, heritage, sex and build** are
> who was cast rather than how they look today. Reply `{"wall": "stage", "asked":
> "her age"}` and the like — rolling again is the honest answer to those."*

**`build` is named in it.** So the 18/18 is not a model being vague — it is a
model obeying a ruled instruction, precisely and every time. That is also why the
refusals came back worded as *"her build"* on six of eighteen samples: the model
is quoting its brief.

**This puts a founder ruling in direct conflict with a founder ruling.**
fable-360 ruling 3 asks for a body shape/build row; `refineInterpreter.ts:183`
says build is not a refinement. The same sentence names `heritage`, which is how
the model classifies *albino* — so fable-361 §1's approved skin work collides
with it too. Two of the sentence's four words have been re-opened by the founder
in the last day; **`age` and `sex` have not, and nothing here proposes touching
them.**

**Nothing can be built for this row until that sentence is amended**, and it is
not the executor's to amend — a code-side backstop that overrode it would be one
list quietly contradicting another, which is the defect this program names most
often. It is with Fable, with the measurement attached.

**The stage-wall backstop shipped this shift is still the right fix and is not
this one.** It makes the code adjudicate an unbacked claim, and it is proven both
ways (25 scene samples, zero wrong filings; freckles recovered 5/5). It simply
cannot reach a refusal the prompt genuinely instructs.

---

## 2. Is it one facet or several? — D-142's question, and it decides the shape

D-142: *two things that can be true at once need two slots, or the second
silently deletes the first.* Its counterpart: two things that **cannot** both be
true must share one slot, or last-writer-wins has nothing to arbitrate.

*"Larger bust"* and *"smaller waist"* can both be true at once. Filed as one
`body` facet, the second ask would annihilate the first — the exact mullet/copper
defect D-142 was written for, rebuilt in a new place.

**So: several facets.** And this is the stylist's own ontology rather than a
programmer's decomposition (law 8) — a model's comp card lists bust, waist and
hips as separate numbers, and a casting director says *"broad shoulders, slight
build"* in one breath about two different facts.

**But the founder asked for ONE row, and one row is right.** Rows are not facets:
`skin` is already one panel row folding three facets (`skinTone`,
`skinCharacter`, `marks`), because a stylist says *"her skin"* about all three
while supersession still runs per facet. The body row takes the same shape, and
the precedent is load-bearing rather than convenient.

```
one catalogue slot     build      group: body      noun: "build"
                                  panel row: "Her build"

facets it folds        bust       "a larger bust", "a bigger chest"
                       waist      "a smaller waist"          ← out of frame today
                       shoulders  "broader shoulders"
                       arms       "bigger arms"
                       build      "athletic", "slight", "curvy" — the whole figure
```

`hips` is **deliberately not in the list.** A comp card has it and his *"etc"*
might mean it, but it is out of frame on every portrait this product makes and
adding it would be inventing a row nobody can currently use. **Flagged for his
call rather than smuggled in.**

`build` sits beside the specifics rather than above them: *"an athletic build
with a larger bust"* is a coherent sentence, so they can be true at once, so they
are separate facets by the same rule that split them from each other.

---

## 3. The region story — does SAM cut a torso?

**UNMEASURED. This is the note's one open question, and the probe is written and
costed rather than guessed at.**

The honest prior, and it is a strong one. The (c) measurement this shift asked
SAM 3 for `chin`, `jaw` and `cheekbones` on two faces and got **NO READ on all
six** while `face skin` and `nose` read correctly in the same runs. The pattern:
SAM's vocabulary is coarse on a **sub-region of a region it already knows**. A
waist is to a torso exactly what a chin is to a face.

So the expected outcome is `torso` reads, `waist` and `bust` do not — which puts
the body row in the same place as facial structure and skin, and **fable-360
ruling 1 already governs that case**: only rows with a genuinely distinct picture
carry a thumbnail; the rest are words. **The body row is very likely a words row,
and that is a consistent outcome rather than a disappointing one.**

The probe, to be run when the bench's uplink is free (five nouns × two faces, 10
calls, ~$0.05, off-ledger), with its criteria fixed in advance the way (c)'s
were:

| noun | a USABLE cut means | fails if |
|---|---|---|
| `torso` | below the face, spans the shoulders, ≥3× the face's area | returns the whole subject (indistinct from `person`) |
| `chest` | upper torso, above the crop's midpoint | ≈ `torso`'s own mask (≥70% ⇒ RELABELLED) |
| `waist` | below `chest`, narrower than the shoulders | NO READ, or ≈ `torso` |
| `arm` | lateral, paired, outside the torso's box | one instance for two arms (the laterality failure) |
| `shoulders` | the torso's top edge, spanning its full width | ≈ `torso` |

**A read that returns the torso's own mask wearing a waist's name must be
COUNTABLE as a failure**, or the measurement cannot fail — the same rule that
made (c)'s null result mean something.

---

## 4. How it carries

**As words. Not as a crop — and the reason is measured this shift, not asserted.**

fable-361 §3's taxonomy says features get crops and diffuse qualities carry as
words. Build looks superficially like a feature (it is enumerable: bust, waist,
arms). But a body crop on this frame would be **most of the frame**, and a
reference that is most of the frame is a second master. This shift measured what
a second reference at the wrong scale does to a render — the founder's own
complaint, +7% to +10% face-height drift across three repeats — and the fix was
to make the carried crop **dimensionally identical to the master**. A body crop
padded to master geometry would be a near-copy of the master with a hole in it,
sent as reference 2 alongside the master itself. There is no version of that
which is not two masters.

So build joins facial structure and skin in the word stack, and the master
carries everything unchanged (fable-360 ruling 5). **Nothing about the body row
touches the library.**

---

## 5. Verification facts — the weakest column, said plainly

Every body ask in the founder's list is a **DEGREE** ask: larger, smaller,
bigger, broader. Under the presence/degree table shipped in `ac749e26`, a degree
ask cannot refuse — and fable-349 confirmed on a real paid render that the reader
is **blind to subtle degree**: it looked at delivered fuller lips and wrote *"lips
appear naturally thin, not fuller."*

**So a body row would ship with a verification column that cannot say no.** That
is not a reason to refuse to build it — the lips row lives with the same limit
and delivers — but it must be stated in the build rather than discovered in a
refund. What can honestly be measured, if and only if §3's probe gives a usable
`torso` cut:

- **shoulder width ÷ torso height** and **waist width ÷ shoulder width**, both
  dimensionless, both read off the same frame before and after;
- a **before/after pair on the same anchor**, which is how the lip instrument
  earned the right to grade this shift (+16.7% on a known-delivered edit against
  a pre-registered 5% bar).

Bust is the one that resists measurement from a frontal clothed frame, and I
would rather write that here than invent a number for it.

---

## 6. What I recommend, and the tradeoff in one paragraph

**Build the row scoped to what a casting portrait actually contains — shoulders,
arms, chest/bust — and give "waist" and "hips" an out-of-frame door that says so
in a sentence.** The alternative is to hold the whole row until the product makes
a full-length or three-quarter frame, which is a much bigger ask than a row and
is not on any current roadmap. A row that honestly serves three of his five nouns
and explains the other two beats a row that silently renders a waist that was
never photographed.

**Three things must land together or not at all:** the amendment to
`refineInterpreter.ts:183` (§1 — until `build` comes out of that sentence the
door refuses the new vocabulary 18 times in 18, correctly, by instruction), the
vocabulary (five facets, one slot, one row), and the **out-of-frame door** (§0). The
region probe (§3) decides only whether the row gets a thumbnail, and under
fable-360 ruling 1 the answer "no thumbnail" is already a supported outcome.

**Open for the founder:** `hips` in or out · whether an out-of-frame waist ask
should offer a re-cast at full length rather than simply declining.


---

## 7. What shipped (shift 71), and what the run corrected

Ruled by fable-381 §A and narrowed by the founder in fable-382 §3 (*"their body
should just be a single thing like body type or body shape it doesnt need
individal pieces like hips chest etc"*). The trio landed together, as required.

### The sentence amendment — measured both ways

`build` came out of `refineInterpreter.ts`'s casting-decision sentence, and a
scoped carve-out went in beside the colouring one. Re-run of the same probe,
n=3, plus four controls the amendment must NOT have opened:

```
give her a larger bust    3/3 FILED → free.bust        (0/3 before)
make her waist smaller    3/3 FILED → free.waist
give her bigger arms      3/3 FILED → free.arms
a bigger chest            3/3 FILED → free.bust
broader shoulders         3/3 FILED → free.shoulders
a more athletic build     3/3 FILED → free.build
------------------------------------------------------ controls
make her look older       3/3 REFUSED  wall_stage "her age"
make her korean           3/3 REFUSED  wall_stage "her heritage"
make her a man            3/3 REFUSED  wall_stage "her sex"
put her on a beach        3/3 REFUSED  wall_stage "beach"

30 samples: 18 filed, 12 refused, 0 other.
```

Every sentence landed in its OWN facet — nothing fell into `skin`, `marks` or
`makeup`, which was the charge risk the note named.

### The row, and the shape the founder chose

One catalogue slot (`build`, group Body, row *"Her build"*), five facets folded
into it exactly as three fold into `skin`. The split is plumbing and is
invisible at every surface: one row, one prefill, one ask. **No `hips`, no piece
rows.** The panel test asserts the absence of all six piece names.

### The out-of-frame door — the fifth refusal, at its call site

`castingFrame.ts` holds what the photograph contains; `refineService` consults it
before anything is claimed. Two halves, both driven through a fake interpreter so
the model cannot rescue them:

- *"make her waist smaller"* → refused for free, one sentence, no recast offer,
  **nothing charged** (`journal` has no `begin`, no `deduct`);
- *"a smaller waist and bigger arms"* → **served and charged**, because refusing
  a sentence with a renderable half would take the arms away to be tidy.

Sabotaged both ways: firing on any out-of-frame facet reddens the second;
removing the door reddens the first.

### Two things the note got wrong

1. **§0's "per-frame in-shot test" is not what shipped, and the substitute is
   declared.** The product makes exactly ONE framing, so the answer needs no
   read — and `castingFrame.test.ts` asserts that premise against the cohort's
   own `FRAMING` constant. The day a full-length frame ships, that test fails and
   the table must become a measurement.
2. **§3's region probe was never needed for the build.** Five facets route
   `fullFrame` and carry words, which §4 had already concluded; the probe would
   only decide a thumbnail the founder's own ONE-ROW ruling does not ask for.
   Not run, not owed — reopened only if open-vocabulary regions make a torso cut
   honest.
