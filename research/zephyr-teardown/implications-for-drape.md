# What ZEPHYR means for Drape

The ambition is to put film-making of this kind inside Drape, with the craft
built into the backend so an ordinary person gets the result without knowing any
of it. This document is the bridge: what the teardown found, checked against
what Drape already has, and what that implies.

Everything about ZEPHYR here is counted from its job records, and the reference
images quoted below were **downloaded and opened**, not inferred from filenames.

What was read at the Drape code on 2026-08-24: `server/routes/characterSheet.ts`
(the route and its docblock), `server/castingV2/castViewPackage.ts` (the six-view
package), and `docs/specs/DECISION_LOG.md` line 652 (the D-62 boundaries).
Everything else said about Drape below is attributed to CLAUDE.md rather than
asserted as a code reading.

---

## The founder's question, answered first

> *"Do we need to build character sheets for our casts?"*

**Yes — and ZEPHYR's answer to what one should contain is more specific, and
more surprising, than I expected.**

I opened the actual reference images fed to production shot 013. This is what
Seedance received in slot 1:

> **A single composite plate** carrying, in one 2048×1142 image:
> - A **text block**: `Name: ZERO` / `Height: 173 cm` / `Voice: calm, measured,
>   confident` / `Character: calm, spontaneous (awkward poses), slightly
>   slouched posture, indifferent`
> - **Full body, front and back**, on white
> - **Face at three angles** — front, three-quarter, profile
> - **Two costume detail crops** — the jacket/top, and the boots

That is a character sheet in the classical art-department sense, and **the whole
annotated sheet goes to the engine as one attachment.** It is not cropped, not
stripped, not decomposed into separate references.

### The uncomfortable part: it has baked-in text, and they ship it anyway

`server/routes/characterSheet.ts` keeps Drape's sheet deliberately text-free.
The docblock's stated reason: *"labels never bake into pixels anywhere, because
the export is exactly what gets fed to external engines and those reproduce
whatever letters they see."*

**ZEPHYR does the opposite and it evidently works.** Every sheet I opened —
`Mira.jpg`, `Zero`, `Reina's mecha` — carries a title, measurements and prose
annotations burnt into the pixels, and those files are the attachments on
finished, shipped shots.

I am not saying Drape's rule is wrong, and nothing here proposes changing it.

⚠ **Two things I got wrong when I first wrote this section, corrected at the
code.** The rule is a **founder ruling**, not an engineering preference —
`4994e953`: *"the founder extended it to the export."* And its premise is not
unsupported: the M3 mug incident
(`server/castingV2/briefCompiler.test.ts`) has text beating the framing block's
own *"no text, no logos"* constraint. The sheet's textlessness is also properly
tested — for **compliance** (*"never draws a label, whatever the label says"*).

What is genuinely untested is narrower than "the rule": specifically the
**reference-image** case — whether text on an attached plate reaches the
delivered frame. Filed with a four-arm design, controls that let it fail, and a
pre-registered bar:
[`OPEN_TEST_baked-text-on-references.md`](./OPEN_TEST_baked-text-on-references.md).

### What Drape already has right

The other decision in that file is straightforwardly confirmed: the native
rendering is composed in-process and handed to an engine as bytes, *"because a
URL is not something an image model can eat."* That is exactly how ZEPHYR's
references reach Seedance — as attached media, never as links.

---

## Gap 1 — the six views are the right content in the wrong packaging

Drape's signed package (`server/castingV2/castViewPackage.ts`) and ZEPHYR's
sheet contain strikingly similar material:

| ZEPHYR's `Zero` plate | Drape's signed package |
|---|---|
| Face, front | Close-up (the beauty band) |
| Face, three-quarter | Three-quarter, 45° |
| Face, profile | Side profile, 90° |
| Full body, front | Full front, 0° |
| Full body, back | Full back, 180° |
| — | Master, chest-up 0° |
| Costume detail crops (jacket, boots) | — |
| Text block (name, height, voice, character) | — |

**The content overlap is almost complete. The difference is that ZEPHYR ships
one image and Drape ships six.**

That is not cosmetic, and it is the finding with the sharpest engineering
consequence in this document. A Seedance shot attaches a **median of 3–4 image
references** (max 9 observed). Shot 013 spends its four on: character, mech,
cockpit, city. **If a single character costs six attachment slots, you cannot
compose a shot at all** — one character would consume more references than an
entire finished ZEPHYR shot uses.

So the requirement is not more views. It is a **composite plate**: the views
Drape already renders, laid out into one image, as one attachment. Drape's
`composeCharacterSheet` already does exactly this kind of composition for the
export route — which suggests the machinery exists and the question is what it
lays out and where it is allowed to go.

## Gap 2 — the state axis, and the founder ruling that already governs it

ZEPHYR's bible has a second axis Drape's package does not: **state**.

| ZEPHYR's state axis | Examples |
|---|---|
| Wardrobe, scoped to a sequence | `Mira (Episode 1 Base).png`, `Mira (Episode 1 Base) (After shower).png`, `Naomi (Episode 1 Concert).jpg`, `Reina (Episode 1 Base) (Gym).png` |
| Situational placement | `Mira in cockpit.png` — five of these |
| Story state | `Alex (Battle Mode) [KIA].png`, `Tank (injured).png` |
| Owned objects, two orientations | `Reina's mecha.png` 3000×1688 + `Reina's mech.jpg` 1792×2400 + `(back)` |

A six-view turnaround of a woman in a crew tee cannot produce a shot of her in a
concert outfit, in a cockpit, injured.

**But this is not an open design question, and I was wrong to leave it as one.**
D-62 already rules on it (`docs/specs/DECISION_LOG.md:652`, verbatim):

> **Permanent product boundaries:** Casting defines the reusable
> person/character sheet; Wardrobe and Canvas own outfits. … Temporary iteration
> references are not persistent plates.

That settles the shape. **The wardrobe axis belongs to Wardrobe, not to
Casting** — so `casting_reference_library` becoming an outfit bible would cross
a permanent boundary, and the answer to my earlier open question is *no*, not
*undecided*. The second sentence bites too: ZEPHYR's per-sequence wardrobe files
are exactly *persistent plates*, and D-62 says iteration references do not
become those.

What the film use-case actually needs is therefore a **Casting↔Wardrobe
composition story** — a way to put a Casting-owned person into a Wardrobe-owned
outfit and get a stable plate out — rather than a second asset library inside
Casting. That is a real product question and a founder one; it is named here as
a finding, not proposed as work.

> **Also worth orienting against:** `CASTING_TWO_PATHS_SCOPE` went live at
> `users:1` on 2026-08-24, giving casts a `path` and a `wardrobeLine`
> (`docs/specs/CASTING_V2_TWO_PATHS_DESIGN.md`, migration 0051). Per CLAUDE.md
> that is the beginning of a wardrobe axis on the cast itself. Anything written
> here about "Drape has only one axis" should be read against that flag rather
> than around it.

---

## The pipeline has three layers, and Drape currently owns one

This is the shape the backend would have to reproduce:

| Layer | ZEPHYR's tool | Volume | What it does |
|---|---|---|---|
| **1. Bible** | Hand-made, uploaded | 54 files | Annotated model sheets. The identity anchor. |
| **2. Shot plate** | `nano_banana_2`, 3 refs, 16:9 | 2,157 jobs | Composes *this character, this outfit, this place, this angle* into one frame. |
| **3. Motion** | `seedance_2_0` | 10,066 jobs | Turns a plate plus prose into a shot. |

**Drape today is strong at layer 1 and has nothing at layer 2.** The signed
package is a bible artifact. The refine road edits a cast. But there is no step
that takes *"Mira, in the cockpit, scared, low angle"* and mints the 16:9 frame
that a video model can act on.

That middle layer is where the 39% bespoke references come from, and it is
probably the single most important thing to understand before designing the film
capability. It is also the layer where the everyday-person promise lives: the
user describes a shot, and layer 2 is what turns their sentence into pictures.

**The two grammars matter here.** The still compositor assigns references by
*attribute* ("face from image 3, priority identity; palette from image 1"); the
video model takes references as *whole entities* substituted inline. A backend
that emits one grammar to both engines will be wrong at one of them.

---

## The four findings that should shape the backend

### 1. Continuity is a filing system, not a model feature

`job_set_parent_id` is null on all 18,918 ZEPHYR jobs. No chaining, no memory,
no state. 275 shots by 13 people over 19 days hold together **because every shot
re-attaches the same reference files**.

**But "the same bytes everywhere" is not what they did, and I measured it after
assuming otherwise.** The 275 production shots attach **1,011 image references
drawn from 353 distinct images** — a mean of 2.86 shots per reference, with
**39.4% of references used in exactly one shot** and the most-reused appearing in
only 18. So the pool is not a small canonical set re-stapled everywhere. It is a
**reused core (214 images appear in 2+ shots) plus a long bespoke tail**.

**For Drape:** do not build shot-to-shot memory, and do not wait for a model that
has it. But the lesson is subtler than "pin one sheet": the canonical sheet
anchors *identity*, and roughly 40% of what a shot needs is made for that shot.
A film pipeline needs both a stable anchor and a cheap way to mint one-off
plates — and D-62 has already ruled the one-offs are not persistent plates.

Per CLAUDE.md, the repaint road's anchoring on `candidate.imageKey` (the pristine
master) rather than on the previous frame is the same principle one level down.

### 2. The prompt is a compositing instruction with named reference slots

82% of ZEPHYR's finished shots use `<<<image_N>>>` tokens dropped inline as noun
substitutes — *"Mira `<<<image_1>>>`'s chest and lips in close-up"* — with a
glossary block up front defining each slot in words as well as pictures.

**For Drape:** this is the API shape the backend should be generating on the
user's behalf. The everyday person types *"Mira, in the cockpit, scared."* The
backend resolves `Mira` → her sheet, `cockpit` → the cockpit plate, assembles
the glossary block, and emits the slot grammar. **That resolution step is the
product.** It is also close to what `recipeAssembler` already does for refines,
which is an encouraging sign that the shape is native to the codebase.

### 3. Every reference needs a declared scope

The most distinctive sentence in the corpus: *"do not use a single pixel of the
background from this input image"*, paired with *"the background behind the glass
comes strictly and solely from here, in every shot, without exception."*

Each reference is told what it owns **and what it must not contribute**. You can
watch the phrasing harden across takes 008 → 013 as they learned it.

**Opening the reference explains why.** The cockpit plate in shot 013 is not a
clean interior — it shows the cockpit *with the mech's exterior shoulders around
it and plain white studio background visible down both sides*. The city plate
owns the view through the glass. Without the exclusion, the white studio ground
would compete with the city. **The scoping sentence is derived from what the
reference image actually contains.**

**For Drape:** this is the actionable form. Scoping is not generic discipline to
apply everywhere — it is a function of what is in the plate. Two consequences:

- If Drape controls plate generation, it can make cleaner plates and need less
  scoping. A cockpit rendered on transparent or neutral ground needs no
  exclusion clause.
- Where it cannot, **the backend has to know what is in each reference in order
  to write the exclusion** — which is a metadata requirement on the asset, not a
  prompt-writing trick.

Caveat carried from the README: scoped prompts show **no measured reroll
advantage**. The argument for scoping is compositional (it is how you get four
references to cooperate), not statistical.

### 4. Volume is the method — but the per-shot price is lower than it first looks

The crude ratio is **36.6 video generations per keeper**, and that number is
misleading in Drape's favour. It divides every Seedance attempt — including
abandoned setups that never yielded a shot — by the 275 survivors.

The per-shot funnel is directly measurable, because 267 of the 275 keepers have
their exact prompt in the Iterations folder:

- **Median 5 attempts before the keeper landed.**
- Median 11 attempts of that prompt in total, p95 34, max 75.

**A working shot costs a median of five tries.** That is an ordinary-person
number. The 36.6 is the cost of *figuring out the film*, which is exactly the
part Drape intends to absorb into the backend.

### And the reroll is pure sampling — which decides the answer

The most-rerolled Seedance prompt was submitted **75 times with one reference set
and identical parameters throughout**. Across the corpus, of the prompts run more
than once, **1,053 kept an identical reference set and only 70 varied it.**

So a reroll is a **re-submit of the same input**, not an edit. Nobody is
tweaking their way to a keeper; they are pulling the handle again.

Two more measurements point the same way:

- **The learning curve is flat.** Attempts-before-keeper by day, 25 Mar → 7 Apr,
  medians bounce between 2 and 9 with no trend. Two weeks of practice on the same
  model did not measurably reduce the tries needed.
- **Feeding a generated still back in did not help.** Prompts using an
  `image_job` reference median 8 rerolls vs 7 for uploads only (n=38 vs 1,124) —
  no advantage, possibly slightly worse.

**Recommendation, stated first as CLAUDE.local.md requires:** Drape should plan
to **absorb the volume rather than engineer it away.** Buy the takes in the
backend, show the user a small number of good ones, and price it accordingly.
The evidence that better prompt assembly reduces the take count is absent —
across three separate measurements — and the evidence that the take count is
irreducible sampling is direct. Designing on the hope that a smarter assembler
converges faster would be building on a premise this corpus does not support.

The tolerable part is that **five tries per shot is affordable**. The 36:1 is
exploration, which is exactly the layer Drape intends to own.

> ⚠ **What I expected and could not show.** I assumed the disciplined prompts
> would converge faster. They do not, measurably: median rerolls are **7 across
> all three groups** (negative-scoped n=30, slot-syntax-only n=876, plain n=256).
> So the case for the prompt discipline below rests on *what it lets you compose*
> — a shot with four references that don't fight — and **not** on any measured
> reduction in attempts. Reroll count cannot see quality, so this is an absence
> of evidence rather than evidence of absence; it should not be quoted either way
> without a quality measurement that does not exist yet.

---

## What the engines did and did not do

Worth stating because it bounds the ambition honestly.

**The engines rendered shots. They did not tell the story.** `cs_chat_ids` is
empty on all three project folders — no script, no beat sheet, no story artifact
exists in the platform. The screenplay is human work that enters the system only
as prose inside individual shot prompts. The dialogue reconstructed from the
prompts is a real screenplay with character arcs, a hazing subplot and a death;
none of it was machine-generated as far as the data shows.

**Shot breakdown was human too.** Someone decided this beat is a 7-second
close-up on a seatbelt with the face never entering frame. That decision is
carried in prose and nothing in the platform helped make it.

So an honest reading of the ambition: to let an everyday person make a film like
this, Drape must supply **the two layers ZEPHYR did by hand** — story-to-shot
breakdown, and reference resolution per shot — on top of rendering it can
already do. The second of those is well within reach and partly built. The first
is a genuinely new capability and should not be quietly folded into a roadmap
row as though it were an extension of refine.

---

## Things that transfer immediately, cheaply

Regardless of the larger ambition, these are small and independently useful:

1. **Settle the baked-text question with a test, not an argument.** Drape bans
   text in engine-facing exports on stated reasoning; ZEPHYR bakes it in and
   ships. One controlled pair of renders answers it. Cheap, and it currently
   governs the design of the one artifact this whole question is about.

2. **Compose the six views into one plate.** The attachment-slot arithmetic above
   is the reason, and `composeCharacterSheet` is already the machinery.

3. **Two orientations per object.** Every ZEPHYR mech exists as both a 3000×1688
   landscape and a 1792×2400 portrait, because a standing shot and a running shot
   need different reference framings. Drape's package has no equivalent choice.

4. ⚠ **"Restate identity in words alongside the image" — do NOT transfer this
   blind.** ZEPHYR's prompts re-state hair, height and garment colour beside the
   picture, and it is their most consistent habit. But **Drape has measured the
   opposite in at least one class and built a fence on it**: per CLAUDE.md,
   `slotWordsRefusal` and `selectCarriedFeatureWords` exist precisely because
   re-stating a tattoo in words beside its crop asks the engine to paint a second
   one (fable-1399 §3), and the "context is not additive" finding recorded there
   has a *subset* of prompt context raising the stage wall twice as often as its
   superset.

   So words-beside-picture is **not class-independent in this product**. ZEPHYR's
   evidence is that it works for *identity* (a person who must stay the same);
   Drape's evidence is that it fails for *marks* (a thing that must not be
   duplicated). The transferable rule is the narrow one — restate what must be
   held constant, never restate what must be placed exactly once — and even that
   deserves a court per class before it ships. The fidelity law says name the
   tradeoff before it ships, not after; this is that.

5. **Story state belongs in the asset identity.** `[KIA]`, `(injured)`,
   `(After shower)`. If Drape ever carries a cast across scenes, the state has to
   live somewhere retrievable, not in a user's memory. Note D-62 puts the outfit
   half of this in Wardrobe's hands.

---

## Open questions this research cannot settle

**Answered since first draft** (both were open questions here; both are now
measured, and the results are folded in above):

- ~~Is 36:1 reducible by better prompts?~~ **No evidence that it is.** Rerolls
  are identical re-submits, the learning curve is flat, and prompt discipline
  shows no reroll advantage.
- ~~Does `casting_reference_library` become the wardrobe bible?~~ **D-62 already
  rules it does not** — outfits belong to Wardrobe and Canvas.

**Still open:**

- **Does baked-in text on a reference actually harm the render?** ZEPHYR says
  no by demonstration; Drape says yes by argument. Nobody has run the pair.
- **What did post-production do?** Nothing about the edit, grade, upscale or
  sound mix is visible. The film is 720p at source; whatever made it look
  finished happened off-platform.
- **Is the 275-shot Production folder the final cut or a curated selection?**
  Unknown. Creation order is solid; cut order is not established.
- **What is in the 39% of references used only once?** They are fetchable. If
  they are mostly per-shot pose plates, that shapes what a Drape "shot setup"
  would have to mint.
