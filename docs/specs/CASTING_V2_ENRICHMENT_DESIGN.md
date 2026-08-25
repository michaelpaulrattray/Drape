# The enrichment design — **STATED FACTS ARE A FLOOR, NOT A CEILING**

**Status: DESIGN ONLY.** Nothing is built, no court is dispatched, no frame is
rendered, no prompt byte has moved. Ordered fable-1639 §2, re-ordered
fable-1658 §4 with a correction that has to be read before the rest of it.

Origin, verbatim (2026-08-24):

> *"i tested the cyborg cast aswell as by myself i feel like the augments and
> cybernetics delivered were underwelming all the casts look very similar. our
> older cyborg casts had better augements and cybernetic varieties."*

And again a day later, on a fresh sheet (2026-08-25):

> *"even though we asked for specific cybernetics i see very little imagination
> outside our ask"*

And then the mandate, in his own words, the same day (relayed fable-1659 §2):

> *"another issue with the casting of the cyborg is they all look so similar i
> know we asked for specifics which gave us a very specific look so not sure if
> we should allow imagination more to offer the user genuine options?"*

**Read that last sentence carefully, because it names the trade himself.** He is
not asking for his facts back — he knows the specifics are his and that they are
what produced the very specific look. He is asking whether a sheet cast from a
specific brief should still offer him **genuine options**. That is the whole
design: eight candidates that all obey him and are still eight different people.

⚠ **And it carries a design consequence that is easy to miss.** When a brief is
highly specific, the axes the product already spreads — heritage, build, facial
hair, greying, disposition — are the ones his brief has ALREADY closed or made
imperceptible. **Disposition-only variance on a locked look is variance nobody
can see.** So the design's job is to name which axes remain HONESTLY open under
a specific ask — the elaboration's extent, its texture, its hardware style, the
wear and age of it — and spread THOSE. §3.3 is that list.

The albino grammar governs throughout: **no fact is ever inferred from another
fact.** An elaboration direction may extend what he stated; it may never deduce
a new attribute from one he gave.

### ⚠ The governing sentence this design is judged against

Filed fable-1662 as the composer family's bar, and it is his, verbatim:

> *"obviously our compiler has a lot of important things in it but also it cant
> be as the cost of creativity this is especially true for initial casting
> sheets. people are wanting to look at a casting sheet and decide we cant call
> ourselves the midjourney o[f] casting if we can't be as creative as
> midjourney"*

**The compiler's jobs are not negotiable** — identity consistency, framing,
wardrobe, refusal safety, per-slice variance. What has changed is that their
COST in paint conviction stops being an accepted tax and becomes a measured,
bounded quantity. And the **INITIAL SHEET** is named as the moment that matters
most: it is the product's first impression and its Midjourney comparison point.

⚠ **That ranks a sibling court above this design.** `CASTING_V2_DILUTION_COURT.md`
asks whether ~450 characters of his words inside ~13,700 characters of ours are
being drowned — his own raw prompt, sent straight to the same engine, paints his
brief with conviction our compiled prompt does not reach. **If dilution is the
cause, adding another of our sentences is the wrong repair**, and this design's
clause would be one more voice in the room it is trying to quieten. This design
does not ship before that court reports; §5's E2 is explicitly downstream of it.

---

## §0 THE PREMISE, CORRECTED — and 1644's question is still OPEN

fable-1644 closed its relay with a test: *"one flagged roll of his brief with
role present will show whether the restored category block returns the variety
he misses, and the enrichment design only exists if it does not."* fable-1657 §4
then read his second complaint as that test coming back negative — category
restored, variety still absent — and bought this design on it.

⚠ **THE CATEGORY BLOCK WAS NOT RESTORED ON EITHER OF HIS ROLLS.** Read at the
production log rather than assumed:

```
[interpreter] roleNull — a rich brief named no category, and the re-ask agreed;
              the sheet compiles without a CASTING CATEGORY block
  reason="roleNull"  rawNotesChars=450  outcome="stillNull"  role=null
  nullOnCompile=1  rescued=0
```

`582656b1` fired on exactly the specimen it was built for and **did not rescue
it**, on both rolls. So his *"very little imagination outside our ask"* was
delivered on a sheet with **no `CASTING CATEGORY (ABSOLUTE)` block at all** —
which is the same condition roll 214 was in when he complained the first time.

**1644's question has not been asked yet.** This design is still right — his
complaint is about elaboration BEYOND the ask, and no category block supplies
that — but it is written knowing that the cheaper repair has never had its
chance. §4 is where that is dealt with, and §4 comes FIRST in the build order
for that reason.

---

## §0b ⚠ AND THE CORRECTION HAS A SHARPER EDGE THAN THE DESIGN IT CORRECTS

**`role` going null looks like a side effect of `CASTING_BRIEF_FIDELITY_SCOPE`,
and that flag is scheduled to widen to `all` promptly.**

Read at the production rows, user 1, the same 553-character cyborg brief family
(`scripts/_role-vs-fidelity-read-disposable.mts`, world PRODUCTION):

```
roll  created                   role                          notes  fidelity
#216  2026-08-25T02:15:07Z      NULL                          434    ON
#215  2026-08-25T01:39:32Z      NULL                          445    ON
#214  2026-08-24T23:21:58Z      NULL                          448    ON
#213  2026-08-24T23:09:36Z      cybernetically augmented man   178    off
#212  2026-08-24T11:33:11Z      cybernetically augmented man   165    off
#208  2026-08-23T11:22:58Z      cybernetic augmented man       165    off
#206  2026-08-17T06:37:30Z      cybernetic augmented man       148    off
```

⚠ **The blob does not record the flag** — no key anywhere in `compiledBrief`
names fidelity. The ON/off column above is read from `intent.statedSkin`, which
`castingIntent.ts` makes null by construction outside the flag and which carries
`{"tone":"pale porcelain","character":"heavily weathered"}` on exactly 214–216.
That is an inference from a field, stated as one. **A roll that recorded its own
flag positions would not need it, and that is a defect worth its own line
(§7).**

```
production alone   role NULL   0 of 4 with the flag off  ·  3 of 3 with it on
                   Fisher exact two-tailed  p = 0.057
```

**This was already measured once and called noise, and that verdict is what
needs re-reading.** `interpreter.ts`'s own docblock records the court:
*"role came back null 2 of 6 with the fidelity lane on and 0 of 5 with it off —
a difference of p = 0.45, which is noise."* Pooling that court's eleven compiles
with the four production rolls above:

```
pooled             role NULL   5 of 9 ON   ·   0 of 9 off
                   Fisher exact two-tailed  p = 0.029
```

⚠ **The pool is a CHOICE and it is stated as one.** The court's arm is dev
compiles of one brief in a batch; production's is four real rolls across eight
days. Same brief, same interpreter, same model — but they are not one
population, and this campaign has been wrong before by pooling runs that shared
a label and not a world. **Production alone is the primary reading (p = 0.057)
and the pool is the secondary one.** Neither is a court; §5's court E1 is.

**The mechanism is plausible and it is not the skin lane.** The flag swaps ONE
sentence in the interpreter's ask (`interpreterSystemPrompt`):

```
off   "Under 25 words."
on    "Say every concrete, visible fact the brief states. Do not pad, do not
       repeat, and add nothing the brief does not contain."
```

Under the cap the model must COMPRESS a 553-character brief, and the natural
carrier of a compressed brief's essence is the category label. Released, it has
room to say everything in `characterNotes` and the label stops earning its
place. **`SKIN_LANE_BLOCK`, appended by the same flag, already carries the
sentence that would prevent this — for its own field:** *"THIS IS IN ADDITION
TO, NEVER INSTEAD OF, 'role' and 'characterNotes'."* The replacement cap
sentence has no equivalent.

**Why this outranks the design it is filed under.** With the flag at `users:1`
the population is the founder. At `all`, every rich brief in the product loses
the CASTING CATEGORY block — the field the interpreter's own docblock calls
*"the ONLY field in the product that produces"* it, whose absence the founder
has now reported twice, five months apart. **This is a blocking prerequisite of
widening `CASTING_BRIEF_FIDELITY_SCOPE`, not a finding about a cyborg brief.**

---

## §1 What actually varies across his eight — read, not reasoned

Roll 214, the eight compiled per-slice prompts, ~13,700 characters each
(opus-1262 §1):

```
159 distinct sentences  ·  140 IN ALL EIGHT  ·  19 vary
```

Every augment sentence is in the shared 140, byte-identical on all eight:

```
Matte-black implant ports embedded in the skull above the right temple;
fine metal seams running across the scalp like plate joins;
a dark mechanical plate along the jawline;
a small black implant stud below each ear;
right eye glowing faint amber-red.
Augmentations surgically integrated into the skin, not worn.
```

The 19 that vary are heritage, build, facial hair and greying. **Nothing about
the cybernetics is an axis at all.** His read — *"all the casts look very
similar"* — is exactly right about the prompts.

That is not a bug in the fidelity lane. It is the lane doing what it says: his
facts survive, whole, on every frame. **The missing thing is that the product
has no way to say *"and more of it, differently, on this one."***

---

## §2 What this design is NOT

- **Not a loosening of fidelity.** Every stated fact appears on every frame,
  unchanged. A frame that drops one of his facts is a failed frame under this
  design exactly as it is today.
- **Not the category block.** That is §4, it is cheaper, and it comes first.
- **Not a taste vocabulary for cybernetics.** A closed list of augment types
  would be the product designing his character for him, and it would not
  generalise past one brief.
- **Not a licence to invent facts.** The invitation is to elaborate what he
  stated, in his own design language — never to add a detail of a different
  kind.

---

## §3 The design

### 3.1 The shape, in the user's ontology

Law 8: how would a casting director describe what changes? Looking at eight
cyborgs cast from one brief, they would say — *"they should all have his
implants, but they shouldn't be the same man. One has more of it. One's is older
and scuffed. One's is barely showing under the hair. One is exactly what you
asked for and nothing else."*

**That is the design.** The stated facts are the floor every candidate stands
on; each candidate additionally carries a DIRECTION in which that floor is
extended, and the eight directions differ.

### 3.2 ⚠ Why a single flat clause CANNOT work, and this is the load-bearing part

The obvious cheap version — one sentence appended to every prompt saying *"the
above is the minimum; extend it, and differ from the other candidates"* — is
**unobeyable, not merely weak.**

The eight slices are eight independent engine calls. **No candidate's render can
see any other candidate's render.** An instruction to differ from images the
engine has never seen is an instruction with no referent, and the engine's only
available reading of it is its own prior — which is what produces eight similar
faces in the first place.

This is exactly why `energy` works and why it is the axis to copy: the product
resolves a DIFFERENT energy per candidate **in code**, cycling one-of-each with
a per-roll offset, and states that candidate's own energy in that candidate's
own prompt. The model is never asked to coordinate.

### 3.3 The mechanism — a per-candidate enrichment direction, cycled

A closed vocabulary of **eight directions**, resolved per candidate exactly the
way `energy` is (`ENERGY_KEYS[(position + hash(rollSeed) % n) % n]`), so eight
candidates get one of each and two rolls of the same brief do not open on the
same one:

```
EXTENT       carried further across the visible body than the brief spells out
CONDITION    worn, healed, lived-with — not newly fitted
MATERIAL     the same elements in a different finish or material register
DENSITY      more of it, closer together, in the places already named
PROMINENCE   more openly displayed — less hidden by hair, clothing or angle
INTEGRATION  more deeply part of the body rather than sitting on it
ASYMMETRY    concentrated on one side rather than evenly distributed
RESTRAINT    deliberately minimal — exactly what was stated, cleanly finished
```

**`RESTRAINT` is not filler and it is the member that makes this safe.** It
guarantees that at least one candidate on every sheet is the pure floor — what
he asked for and nothing more — so the design is a SPREAD around his brief
rather than a one-way push away from it. Its clause is close to a no-op by
construction, which is also the cheapest possible negative control living inside
the feature itself.

⚠ **`ASYMMETRY` is the risky member and it is named as such before it is built.**
His brief states *"a small black implant stud below each ear"* — a symmetric
fact. Asymmetry of the ELABORATION must not become asymmetry of the FLOOR. The
clause's own wording forbids it and court E2 watches that candidate
specifically; if it cannot be made safe at the frames, it is dropped and the
cycle runs at seven.

The directions are generic on purpose. They are not about cybernetics: they
apply to freckles, scars, tattoos, jewellery, weathering — any stated visible
detail. Nothing in the vocabulary knows what a cyborg is.

### 3.4 The clause

One sentence, placed immediately after `Character detail:` so that it qualifies
the user's own words rather than competing with them — the same placement rule
`coveringFor` and the stated-skin lane already follow:

```
DESIGN EXTENSION: the detail above is the MINIMUM this person carries, never
the maximum. Extend it for this candidate in one direction — <direction> — in
the same design language, adding nothing of a different kind and omitting
nothing that was stated.
```

It renders **only when `characterNotes` is non-empty.** A brief that states no
visible detail has no floor, and inviting elaboration of nothing is a prompt
change on a population that never asked for one.

### 3.5 ⚠ The apparent contradiction, stated so nobody has to discover it

The fidelity lane tells the INTERPRETER *"add nothing the brief does not
contain."* This clause tells the IMAGE ENGINE to extend what the brief contains.
**Two different addressees, and the boundary between them is the whole
architecture:** the interpreter's job is to record what she said without
inventing; the engine's job has always included everything she left open. This
design moves the DETAIL of a stated subject from "closed because she mentioned
it" to "open in a named direction" — it does not move it into the interpreter.

### 3.6 The axis must be REGISTERED, not merely resolved

`axisRegistry.ts` is where an axis declares its footprint reader. A persisted-
but-never-rendered axis is a filed collapse class in this campaign. The
enrichment direction gets a registry entry with a `footprint` that finds its own
clause in the prompt, so a resolved direction that never reaches the wire
reddens rather than reading as a working feature.

---

## §4 THE RE-ASK'S OWN QUESTION — and it comes FIRST

Ordered fable-1658 §4: his brief says *"cybernetic augmentation as part of his
body"*, the interpreter twice declined to mint a category from it, and the same
brief minted `cybernetic augmented man` 4 of 4 in production under the old
framing and 9 of 11 in the role court. **Should the re-ask ask DIFFERENTLY?**

**Recommendation: NO — and the reason is that the re-ask is not where the defect
is.**

The re-ask's design property is deliberate and it is stated in its own docblock:
*"one more sample of the SAME interpretation, never a differently-worded second
question. That is what makes it unable to invent."* A re-ask that names the
category the brief implies is a re-ask that can put a category on a brief that
has none — and 25 of the 26 real null-role rolls in production are short briefs
that genuinely name no category. **A differently-worded re-ask would fire on
that population too, and its whole job is not to.**

The measurement says the model CAN name this category and stops doing so under
one specific framing (§0b). That makes this a suppression at the ASK, not a
weakness in the RETRY, and repairing the retry would be treating the symptom
while spending the one property that makes the retry safe.

**The proposed repair is one sentence, in the sentence that caused it.**
`NOTES_CAP_RELEASED` gains the clause `SKIN_LANE_BLOCK` already carries for its
own field:

```
today     "Say every concrete, visible fact the brief states. Do not pad, do
           not repeat, and add nothing the brief does not contain."

proposed   … same, plus:
           "This is IN ADDITION TO, never instead of, naming the casting
            category in \"role\" — a full characterNotes does not excuse a null
            role."
```

It is text-only, it is inside a flag that is already dark for everyone but the
founder, and court E1 settles it for cents.

⚠ **If E1 shows the clause does NOT restore the rate, the re-ask question comes
back open** and this section is re-argued with that reading in hand. It is not
being closed on the recommendation; it is being sequenced behind the cheaper
test of the cheaper hypothesis.

---

## §5 The courts — costed, NONE DISPATCHED

```
E1  THE ROLE SUPPRESSION COURT       ⚠ FIRST, and it gates everything else.
    text only, ZERO fal              His 553-char brief through the REAL
    3 cells x 12 compiles = 36       interpreter. Cells: fidelity OFF (the
    ~$0.35 openrouter                control that minted 4/4 in production),
    PRIORITY: highest                fidelity ON (today), fidelity ON + the
                                     §4 clause. Outcome per compile: role
                                     minted or null, and the notes length
                                     beside it so a clause that buys role by
                                     rationing notes is visible rather than
                                     celebrated.
                                     BAR: the ON+clause cell's mint rate is
                                     not distinguishable from the OFF cell's,
                                     AND notes length does not collapse.

E2  THE ENRICHMENT COURT             The SHEET is the unit, not the frame —
    2 cells x 8 renders = 16         his complaint is about variety ACROSS
    ~$0.64 fal + one compile         eight. Cells: today / with the clause,
    HIS EYE on two strips            same brief, same seed, same eight people.
                                     ⚠ RUNS WITH ROLE RESTORED (after E1) or
                                     it measures the missing category block
                                     instead of the missing enrichment.
                                     Judged by eye: "variety" is exactly the
                                     adjective judgement law 9 gives him.
                                     Refusals counted per cell — an invitation
                                     to elaborate a fantastical brief is a
                                     stage-wall risk and its cost belongs
                                     beside its benefit.

E3  THE NO-FLOOR CONTROL             The widening gate, not the shipping gate.
    2 cells x 8 renders = 16         An ORDINARY brief with short notes, clause
    ~$0.64 fal                       off/on. `context is not additive` is this
    HIS EYE                          product's own measurement: a clause that
                                     helps a 450-character brief may damage a
                                     20-character one, and that population is
                                     everybody.
```

**Sequencing is not a preference here.** E1 → (repair) → E2 → E3. E2 run before
E1 buys sixteen frames of the category-block question wearing the enrichment
question's clothes.

Total if all three run: **~$1.28 fal, ~$0.35 openrouter, no credits, no rows.**

---

## §6 How it ships

- **`CASTING_ENRICHMENT_SCOPE`** — `off`/absent, `all`, or `users:<ids>`.
  Parent `CASTING_V2_SCOPE` and nothing narrower: what it governs is the compile
  of a ROLL. Off, and absent means off, **the prompt is byte-identical to
  today's** — the clause does not render, the direction is not resolved, and no
  axis appears in the registry's output. That property is the flag's own arm,
  asserted at the wire, because *context is not additive* means a leak to
  unflagged accounts is a change to every cast in the product.
- **§4's clause is NOT behind this flag.** It lives inside
  `CASTING_BRIEF_FIDELITY_SCOPE`, whose swap it repairs, and it ships with E1's
  reading rather than waiting for the enrichment build.
- No table, no migration, no new engine call, no segmenter call, no credit.
  `assertFalBudget` is untouched.
- Widening past `users:1` needs E2 AND E3 in front of his eyes, per the standing
  ratchet.

---

## §7 Filed, not designed

- **A roll does not record its own flag positions.** §0b's ON/off column had to
  be inferred from `intent.statedSkin`. Every future reading that asks *"which
  road did this roll take"* will pay the same tax, and an inference is not a
  reading. A `flags` object on the compiled blob is small, additive and would
  have answered §0b outright.
- **`interpreter.ts`'s docblock says the fidelity/role difference is `p = 0.45`,
  which is noise.** That sentence was true of its eleven compiles and is not
  true of the pooled fifteen. It is corrected when E1 reports, not before —
  moving a bar on the strength of the data that failed it is optional stopping,
  and it is E1's job to be the reading rather than the argument.
- **The `cannot-clear-hair` decline reason** (fable-1658 §1b) is a geometry
  refusal wearing a hair name; renamed `insufficient-headroom` in this shift's
  next commit rather than deferred to "whenever the file is next touched", which
  the mailbox protocol refuses as a drop.
