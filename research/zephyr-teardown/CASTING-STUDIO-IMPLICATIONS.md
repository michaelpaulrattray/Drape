# What the film research means for the casting studio

**Research, not a build.** The casting studio (Casting V2) is under active
construction by another seat; this document maps the ZEPHYR findings onto it so
the design questions land while they are still cheap. Two founder questions
drive it:

1. **"Takes" do not exist yet** — and takes happen only once a cast is refined
   and **signed**. What should a take actually be?
2. **Character reference sheets** — do they need to be generated alongside the
   casting views so they can feed future campaigns and works?

Grounded in the teardown corpus (23,810 job records, both productions) and read
at the Casting V2 code on 2026-08-24 where cited.

---

## 1. The lifecycle correspondence — why this research maps so cleanly

ZEPHYR's production has exactly the casting studio's shape, run by hand:

| ZEPHYR | Casting V2 |
|---|---|
| Design phase (Mar 20–23: characters iterated, **zero video**) | Roll → refine: iterating until the character is right |
| The bible (`Characters` folder / the Elements registry) | **The signed Cast** — identity frozen, package minted |
| Production shots against the fixed bible | **Takes** — the signed Cast at work |
| `Iterations` folder (18,643 kept) | take history |
| `Production` folder (275 curated keepers) | what lands in the campaign / board / film |

The founder's placement — takes only after Sign — is the same boundary ZEPHYR
drew: **nobody re-designs the character during a shoot.** The bible is fixed;
the takes sample against it. Their crew never once edited a character mid-take
(1,053 rerolled prompts kept an identical reference set; the 70 that varied it
were changing the *shot*, not the person).

---

## 2. What a take actually is — the measured definition

The corpus gives a precise answer, and it is narrower than "try again":

> **A take is one more sample of an *unchanged* setup.** Same references, same
> words, same parameters. The entropy comes from the engine, nothing else.

Evidence: of prompts run more than once, **1,053 kept an identical reference set
vs 70 that varied it**; the most-rerolled setup was submitted **75 times with
byte-identical input**; and three independent measurements show that changing
the words does **not** reduce the number of attempts (scoped prompts: no reroll
advantage; learning curve flat over two weeks; still→video handoff: no help).

So a take is **not** an edit and **not** a version. It is a pull of the handle.
That distinction should be structural, not conventional:

### The data model this implies

```
Setup   = signed cast ref(s) + scene/asset refs + the ask + params   (frozen)
  └── Take (1..N)   = one engine sample of that Setup
        └── Keeper (0..n)  = a take promoted by the user's eye
```

- **The Setup is the unit; takes are its samples.** A "same again" gesture
  re-submits the Setup untouched — deliberately *not* an edit box, because the
  measured behaviour says re-rolling and re-writing are different acts, and a UI
  that blurs them will produce accidental new Setups where the user wanted
  another sample.
- **Changing anything mints a new Setup.** That is the takes-vs-versions line:
  versions answer "what did I ask for", takes answer "which sample of it".
- **Multi-keeper is legitimate.** ZEPHYR shots 015–018 are one byte-identical
  prompt with **four separate keepers**, used as four shots. A Setup that yields
  two frames the user wants should allow both to be kept. (Refine is the
  opposite — one winner continues the chain — which is another reason takes
  should not be built as "refine again".)
- **Unpicked takes are swept.** The roll's `candidateRetention` pattern is the
  precedent: keepers persist, the rest die with their retention window.
  Curation is the act; ZEPHYR kept 18,643 iterations *visible* but only 275
  entered the film.

### Why this cannot be "refine, again"

Confirmed at the code: a refine is **one image per paid ask** — D-121,
`castingCreditCosts.ts`: *"One unit, not eight slices. A refine is a single
image."* The roll is the opposite: 8 independently-billed candidates and a
contact sheet. **A take fan is the roll's shape applied to a signed cast** —
N samples, pick by eye, per-slice billing so a mid-fan failure refunds only its
slices (the deploy-collision contract already guarantees exactly this).

### The numbers to design the fan around

| Measured (ZEPHYR video takes) | Value |
|---|---:|
| Attempts before the keeper landed (median) | **5** |
| Attempts of that setup, total (median / p75 / p95 / max) | 11 / 17 / 34 / 75 |
| Their stills batch size (dominant) | 4 |

A default fan of ~4 with a cheap "four more" gesture covers the median case in
one to two pulls and the p75 in three or four. The pricing consequence is the
one §10 of the implementation spec already states: **absorb the volume and price
it; do not promise that clever prompting will reduce it** — the evidence is
three-for-three that it does not.

### The instrument that comes free

Log **takes-to-keeper per Setup** from day one. ZEPHYR's median-5 is the
external benchmark, and Drape already owns the internal half of this number:
the *carry noise floor* measurement (same recipe twice → 0.0% vs 21.3% drift)
is take-variance measured as a **verification problem**. Takes are the same
variance harvested as a **feature** — the drift between identical runs is
exactly the creative spread the user is choosing from. One phenomenon, two
readings; the instrument for one prices the other.

---

## 3. The character-sheet question, answered

> *"Do reference sheets need to be generated alongside casting views so they can
> be fed into future campaigns or works?"*

**No new generation — compose, never generate. And Drape already owns the
better half of this.**

ZEPHYR minted its sheets with an image model, and the mint **disobeyed its own
recipe**: the prompt asks for *"two full-length photos from shoes to head"* and
*"no text, no logos"*, and the delivered sheets are headless and carry a baked
text block. A generated sheet is one more render that can drift.

Drape's `composeCharacterSheet` is **deterministic composition of views the Sign
already bought** — no new pixels, no drift, no extra generation cost, and the
sheet dies with the cast because it is composed on demand. That design is
correct and the research strengthens it. What the research *adds*:

### 3a. The composite is the campaign hand-off artifact — treat it as first-class

The engine arithmetic from the teardown: a video shot attaches a **median of 3–4
images** (Elements aside), and ZEPHYR carries an entire character as **one
composite plate**. Six separate view files would spend a whole shot's reference
budget on one person. Drape already has the one-attachment export
(`/api/cast/:castId/sheet`, 4096px, ≤10MB, engine-tool limits deliberately
matched). The upgrade is standing, not structural: **the export is not a
convenience download; it is the unit a signed Cast travels in.** Takes,
campaigns, and any future film surface should consume the composite, not the
six files.

One design consideration for reproducibility: the sheet is composed on demand,
so a campaign that fed it to an engine should **record the digest of the bytes
it actually sent** (the pattern `StoredReference.digest` and the ink route's
sha256 refusal already use). Then "which sheet did this campaign shoot against"
stays answerable after views change.

### 3b. Keep the DUAL-REFERENCE layout logic — and the one-face question (added 2026-08-24)

⚠ **The composite plate's layout is now a flagged design question.** A third
production (Adiliada) settled that the headless-body/one-face sheet is a
deliberate house convention — its mint prompt orders *"cleanly headless cut at
the base of the neck"* beside a single close-up. The founder's hypothesis for
why — **more than one face on a reference confuses the engine's identity
read** — is unstated in all three corpora but consistent with every habit in
them. Drape's six-view package composed naively would put a face at four or
five angles on one plate. Before the composite ships as the engine-facing
artifact, court the layout: one-big-face-plus-bodies vs all-six-views, same
setup, identity fidelity judged by eye.

**And the founder's second observation (same day) extends it: they use 2–3
panels, not five or six.** Counted on the opened sheets, the panel count
converges exactly like the face count: film one's early sheet had ~7 cells
(bodies front+back, face at three angles, two costume crops); the bible and
Special sheets have **3** (body front, body back, one big face); Adiliada's
recipe orders **2** (*"two-panel character reference sheet"* — one headless
body, one close-up). Five months of production experience kept only the
non-redundant panels: outfit front, outfit back, identity once. The
three-quarter and profile views evidently earned nothing at the engine.

**Consequence, stated carefully:** the six-view package is the PRODUCT Sign
sells — untouched by this. The ENGINE-FACING composite is a different artifact,
and the court above should include a 2–3-panel arm (big face + body front ±
body back) beside the six-cell one. If the minimal layout wins, the composite
is also smaller, cheaper to attach, and leaves more of the attachment budget
for the scene.

Their prompts source **face and body from different references on purpose** —
*"take the FACE/HEAD — skin, pores, hair, eyes — [from the close ref]; take
BODY POSE + COSTUME from the wide ref."* The sheet layout serves that split: a
**large face panel at maximum pixel density** beside full-body views. Drape's
package already separates the close-up from the full views; the composite's
layout should preserve the big-face-panel prominence rather than tiling six
equal cells.

### 3c. What the signed package does NOT yet carry (gaps, with their owners)

| ZEPHYR's sheet carries | Drape's package | Owner of the gap |
|---|---|---|
| Costume detail crops (jacket, boots) | — | **D-62 seam** — outfits are Wardrobe's; this is the Casting↔Wardrobe composition question again, not a Casting to-do |
| Identity text block baked in | textless by founder ruling | **Deferred test** (`OPEN_TEST_baked-text-on-references.md`) |
| `Voice:` line | — | Note only — matters the day casts step into video; cheap to record at Sign, pointless to render |
| Wardrobe-state variants (`Zero_home` / `Zero_rock`) | — | The D-62 founder fork, already filed in the implementation spec |

### 3d. The genuinely new idea: drift locks on the cast

The best transferable invention in their registry is a **pre-empted failure
mode stored on the asset**:

> *"BROWN eyes **(never blue/green)**"* — 470 runs
> *"PERMANENT holographic glitter strip across the bridge of the nose (keep in
> every frame)"* — 823 runs

The engine drifted her eyes once; the fix was written **on the character**, and
every subsequent prompt inherited it for free. Casting V2 holds the recipe
(`masterPrompt`, `technicalSchema`) but — as far as I read, unverified beyond
the reference-library shape — no accumulated record of *what engines get wrong
about this cast*. A `knownDrift` list on the signed Cast, populated when the
founder's eye catches a drift, emitted into every take thereafter, is small,
additive, and exactly the "fix the class, not the instance" shape: the
correction outlives the prompt it was typed into.

Its sibling, the **override channel with a mandatory reason** (*"NO horns in
this scene — omit entirely, for continuity with the burger-story shots"*), is
what keeps a permanent flag usable: scenes can vary a locked feature without
anyone deleting the lock.

**Refined with the founder (2026-08-24), and this is the load-bearing design
sentence: a lock guards SILENCE, and an explicit ask always beats it.** Drift is
by definition an unasked change, so the lock is emitted only into renders whose
ask does not touch that feature. The moment the user explicitly asks for the
"forbidden" thing (blue eyes on a never-blue cast), that is an edit, not drift —
the lock steps aside with no unlocking ceremony, and one follow-up settles the
rule's future: *"just this look"* (rule survives, this version varies — the
ZEPHYR horns pattern) or *"update the rule"* (the lock now protects the new
value). A lock can therefore never fight an intentional edit, by construction.

**Capture is semi-automatic: the server detects, the founder ratifies.** The
detection signal needs no vision reader — a correction-shaped ask on a slot
nobody ever edited, appearing twice, is drift evidence read from the ask
history alone. On the second occurrence the studio offers the lock; one tap
files it. Fully automatic filing is rejected on two in-house grounds: law 9 (a
reader's verdict silently becoming a permanent rule is the engine ruling
without his eyes), and *context-is-not-additive* (every emitted clause has a
measured cost, so a wrongly auto-filed rule would quietly degrade every future
render of that cast with no author to ask). Detection automatic; filing his.

---

## 3e. Producing better casts — what the ENGINE does underneath (founder-corrected 2026-08-24)

First framing of this section put suggestions on the wrong side of a line the
founder then drew: **what gets cast is the director's decision — always.** The
signature detail, the palette, who the character is: theirs. Drape's engine
underneath owns **style, realism, energy, vibe and detail, deciphered from the
prompt and the chosen settings.** Re-sorted onto the engine's side, three
ZEPHYR habits transfer:

1. **The realism recipe, applied silently.** ZEPHYR hand-typed the anti-polish
   craft onto every character prompt — *"natural, unpolished attractive look"*,
   *"avoid overdesign, keep natural imperfection"*, *"visible pores, fine
   vellus hair, natural asymmetry, no smoothing"*, *"subtle dark circles
   (light, aesthetic)"*. They buy flaws because flaws read as a person. In
   Drape this is house craft under every photoreal cast — the user never types
   or sees it; it is why the casts look like people and not renders. Cohort
   territory (`PHOTOREAL_HUMAN_BLOCKS` already covers part of it — check
   overlap, court the rest).
2. **Vibe words translated into renderable behaviour.** A picture cannot draw
   "shy". ZEPHYR's crew translated by hand on every card — *"calm, spontaneous
   (awkward poses), slightly slouched posture, indifferent"*. In Drape that
   translation is the brief compiler's natural job: the director says the
   vibe, the engine works out what it looks like (posture, gaze, stance,
   grooming). Law 8's ontology, running in the correct direction — the user's
   word is the spec, the engine renders its visible form.
3. **Art styles as saved recipes, not re-descriptions.** Their entire look was
   carried by ONE saved style (`General_Olzhas`) applied unchanged to 5,275
   stills — never re-described per prompt. That is what an art-style setting
   should be on Drape's side: chosen once, a tested craft block rides
   underneath every render of that cast.

Retired from the earlier draft as director-side, not ours: the signature
anchor, the per-character palette, silhouette-first design. (One residue
survives on the engine side: drift locks guard whatever details the director
*did* choose — the engine protects their decisions, it does not make them.)

⚠ **Standing caution unchanged:** nothing lands in prompts without a
controlled pair — context-is-not-additive priced every added clause.

## 4. Cautions — where blind transfer would collide with Drape's own measurements

These are the places the research must NOT be applied as-is, each with the
in-house evidence:

1. **Words-beside-picture is not class-independent.** ZEPHYR restates identity
   in words beside every reference. Drape measured the opposite for ink:
   `slotWordsRefusal` exists because re-stating a tattoo beside its crop paints
   a second one (fable-1399 §3). Identity words: probably; marks: measured no.
   **Court it per feature class.**
2. **More context can make things worse.** The *context-is-not-additive*
   finding (a subset of prompt context raised the stage wall twice as often as
   its superset) means the negative stack cannot simply be appended to casting
   prompts. Any stack addition needs a controlled pair, and
   `PHOTOREAL_HUMAN_BLOCKS` already covers part of this ground — check overlap
   before adding a single clause.
3. **Their registry hygiene failed and Drape's must not.** `Sheet_MIRA` beside
   `Sheet_mira` — hand-typed identifiers drifted within seven weeks. Any Setup
   or take naming is derived, never typed (working law 4).
4. **The reader is not the judge.** Keeper selection is the founder's-eyes
   surface par excellence (law 9). Takes-to-keeper telemetry measures cost, not
   quality; no metric picks the keeper.

---

## 5. Summary for the two questions

**Takes:** a take is one more engine sample of a frozen Setup against a signed
Cast — never an edit, never a version. Build it as the roll's contact-sheet
shape (fan of ~4, per-slice billing, keeper promotion, unpicked takes swept),
not as "refine again" — refine is structurally one-image-per-ask and
one-winner-per-chain, and both properties are wrong for takes. Expect a median
of ~5 samples per keeper and design the price and the telemetry around that
number rather than around the hope of reducing it.

**Sheets:** never generate one — compose it from the views Sign already bought,
exactly as `composeCharacterSheet` does. The research's additions are standing
(the composite is *the* artifact a signed Cast travels in; record the digest per
use), layout (keep the big face panel), and two small cast-level fields worth
considering at Sign time: **drift locks** ("never blue/green") and permanent
features with a reasoned override channel. The costume-crop and wardrobe-state
gaps are real but belong to the D-62 founder fork, not to the casting build.
