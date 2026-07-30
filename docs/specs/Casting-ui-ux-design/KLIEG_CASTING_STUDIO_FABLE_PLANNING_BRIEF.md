# Klieg Casting Studio — Fable planning brief

**Date:** 2026-07-30  
**Status:** Product direction and codebase assessment for planning; no implementation authority  
**Source handoff:** `C:\Users\Admin\Downloads\Brand Mood\Design inspired by Eleven Labs (1).zip`  
**Related runtime plan:** `docs/specs/CASTING_SYSTEM_R7_REVIEW_AND_EXECUTION_PLAN.md`

## 1. Purpose

Use the attached design handoff as the settled product and interaction direction
for the Casting Studio:

```text
sentence
  → sheet of eight candidates
  → keep / discard / follow
  → sign one character
  → casting room for refinement
```

Do not propose a different core flow. The planning task is to reconcile that
flow with Drape's existing identity, generation, billing, snapshot, evidence,
package, Wardrobe, Canvas, and lifecycle machinery.

Before planning, open `Klieg Casting.dc.html` in a browser and click through the
prototype. Then read the supplied `README.md` in full and read §7 twice.

This document records Codex's independent walkthrough of the prototype,
inspection of the current repository, discussion with the founder, and
recommended interpretation for implementation planning.

## 2. Executive position

The handoff fits Drape. The existing Casting Studio is over-engineered as a
user interface and client-side workflow, but its underlying identity machinery
is not wasted.

The recommendation is now stronger than a reskin or gradual rearrangement:

> Build a new Casting Studio experience and client orchestration around the
> prototype's settled flow. Preserve the hardened R7 backend authorities that
> genuinely work; do not preserve the current cockpit merely because it already
> exists.

This is a deliberate product rebuild, not a big-bang rewrite of the whole
casting system. The new experience should be built alongside the old one behind
a feature flag, consume a clean application service/facade over the R7
authorities, prove compatibility with existing Casts, and then replace and
delete the superseded UI.

The correct direction is:

- preserve the sophisticated identity, snapshot, evidence, version, package,
  and billing systems underneath;
- stop asking customers to operate those systems directly;
- make natural language the primary casting control;
- use the eight candidates as the creative exploration surface;
- expose interpreted facts as concise chips that can be corrected or locked;
- retain the deeper controls through progressive disclosure;
- move post-selection work into the casting room;
- keep master prompts, raw technical schemas, provider prompts, recipes,
  probes, and engine bookkeeping internal by default.

Users should direct the casting. They should not assemble a person from a
database form.

The rebuilt product is a **character-casting system**, not a human-only model
generator. Its architecture must support photoreal people, anime and
illustrated characters, humanoid androids, fantasy characters such as orcs,
mascots, aliens, anthropomorphic characters, and later more anatomically
unusual subjects. Initial calibration may be narrower than the architecture,
but human assumptions must not be embedded as universal product law.

## 3. R7 foundation status: formally closed, product gate still open

The later R7 workstream formally completed R7-7F and published an R7-8 closure.
That closure is not sufficient evidence that the intended product works.

A read-only audit on 2026-07-30 found:

- local `main`, `origin/local-migration`, and the live Railway deployment were
  all at commit `edeeab9`;
- snapshot reads were enabled for all users, while restore, evidence composer,
  and evidence-package authorities remained founder-scoped;
- the anatomy registry defined 110 anatomical tuples, but the release policy
  enabled only eight and refused the other 102;
- every first-unseen projection angle remained unsupported;
- the live founder Cast showed canonical views marked out of sync because
  tattoo coverage was unavailable for those views;
- tattoo authoring still required a draft Cast rather than working naturally
  from the signed casting room;
- the current product flow still exposed review, paid preview, acceptance, and
  later repair/refresh steps rather than one coherent accepted revision;
- a ten-file, uncommitted tattoo projection/laterality patch existed locally
  but had not been reviewed, committed, deployed, or proven as a complete fix;
- typecheck, focused tattoo tests, and build passed, but the full test suite did
  not reproduce a clean closure run in the current environment.

The plans allowed a cohort to count as complete when it either passed or
remained explicitly disabled. That is a valid fail-closed rollout technique,
but it is not the founder's requested product outcome of natural-language ink
placement across the body with correct affected-view synchronization.

Therefore:

> Treat R7's durable backend and safety machinery as substantially complete,
> but reopen the R7-7G product-completion gate. Do not describe R7 as fully
> complete until the common all-body experience and cross-view projection work
> in practice.

Continue and finish R7 because the new experience depends on its foundations:

- stable identity and package snapshots;
- durable paid operations and recovery;
- immutable history and restore;
- selected-version authority;
- explicit identity-evidence revisions;
- evidence-aware view synchronization;
- accurate stale/current/missing truth;
- safe deletion, fork, and lifecycle rules.

The bounded R7 work that should finish before implementation of the new studio
is:

1. finish and review the current projection/laterality patch without absorbing
   unrelated working-tree changes;
2. prove natural-language placement for common real body requests, including
   left/right arms, half/full sleeves, chest, back, abdomen/flank, and legs,
   rather than treating disabled recipes as product completion;
3. make side, three-quarter, walk, back, and first-unseen projection behaviour
   truthful and usable, including pose/view drift;
4. prove that the visibility classifier selects only genuinely affected views
   and that every selected refresh can actually complete;
5. preserve the previous coherent package when any required affected view
   fails;
6. rerun focused, disposable-database where applicable, full-suite, build, and
   founder production verification gates;
7. update the R7-8 closure record so it distinguishes safety-disabled coverage
   from delivered product coverage.

This does **not** require polishing the current tattoo form, Package Health
dialog, slot picker, manual controls, or old Studio layout. Those are temporary
verification surfaces and will be replaced.

However:

- do not add more controls to the current creation cockpit;
- do not polish the current pre-generation form beyond what is required to
  verify R7;
- do not treat the existing UI as the long-term expression of R7;
- do not begin the new candidate-roll runtime by bypassing unfinished R7
  contracts.

The working rule is:

> Finish the missing R7 identity-engine truth, not the old Casting Studio
> experience.

The final Fable plan should label remaining work as one of:

1. **Foundation — finish before the redesign**
2. **Temporary verification UI — minimum only**
3. **Superseded by the handoff — do not polish**

### 3.1 Impact on current R7 and the existing Casting Studio

This direction is a rebuild of the user-facing Casting Studio and its
client-side orchestration. It is not a rewrite of the proven server-side
identity, billing, snapshot, storage, ownership, or recovery machinery.

#### Preserve

The following R7 work remains foundational:

- durable operation receipts, locking, replay, charge, refund, and recovery;
- immutable identity and package snapshots;
- selected-version authority and ledger history;
- signed likeness anchors and post-generation identity checks;
- evidence ingestion, private storage, ownership, provenance, and cleanup;
- visibility classification and strict evidence probes;
- atomic package transitions;
- whole-Cast restore;
- deletion, fork parentage, access control, and public-safe projections.

These systems become invisible intelligence behind the new experience.

#### Adapt

- **R7-7E package synchronization:** its visibility registry, evidence
  composition, probes, retry/refund rules, and commit authority remain useful.
  Its current user-facing law of separate deliberate per-view refresh actions
  is superseded. A future explicitly priced identity-revision operation invokes
  the affected-view work automatically and commits one coherent package.
- **Mint/lifecycle:** the current draft-versus-minted coupling must be audited.
  Sign becomes the one face-lock/roster commitment; internal package sealing
  cannot require a second user-facing Finalize/Mint ceremony.
- **Cast Profile:** it evolves into the casting room rather than remaining a
  separate locked read-only destination.
- **Add/refresh views:** the executors remain useful, but normal Cast creation
  and accepted identity revisions orchestrate them as package work rather than
  asking the user to shop slot by slot.
- **Evidence acceptance:** the safe candidate/approval machinery moves behind
  the focused master editor.
- **Fork:** its durable parentage remains, while its UI returns to a candidate
  sheet with the parent recorded as lineage.
- **Staleness:** it remains critical internal truth and progress/error state;
  it should no longer force the user through a diagnostic repair workflow after
  every accepted edit.

#### Supersede

- the large manual creation cockpit as the default;
- completion percentages and required-field ceremony;
- the one-person initial generation flow;
- a second Cast click after sentence submission;
- raw master-prompt and technical-schema product surfaces;
- Package Health as a required routine workflow;
- manual per-view package assembly as the normal creation experience;
- identity-changing controls mixed casually beside presentation refinement.

#### Add

- durable rolls, candidates, lineage, candidate-ID shortlist, and streaming;
- the Sign promotion/face-lock ceremony;
- complete-package generation as part of creating a Cast;
- Takes and their identity-snapshot provenance;
- first-class Voice and usage truth;
- the shared AppShell, navigation rail, topbar, and theme system.

R7-7E remains the correct production behaviour until the new atomic
synchronization contract is designed, reviewed, feature-flagged, and proven.
Do not weaken the current refusal/manual-action safety boundary incrementally.

### 3.2 Rebuild boundary and cutover strategy

The new Studio should not be implemented by continuing to expand the current
components, stores, and route choreography. In particular, do not make the new
candidate sheet another mode inside the existing control cockpit or make the
casting room a rearranged Package Health screen.

Build a new frontend domain with:

- its own route and screen composition for roster, sheet, Sign, and room;
- server-owned roll, candidate, shortlist, progress, and lineage truth;
- a small client state layer for ephemeral interaction only;
- a clean application service/facade over existing R7 operations;
- explicit DTO projections designed for the new surfaces;
- feature flags and cohort rollout independent of the old UI;
- compatibility adapters for existing drafts, signed Casts, histories,
  Canvas placements, Wardrobe links, and exports.

Reuse from the current client only when the unit is genuinely good and
product-neutral, such as image viewing, compare, progress, or accessibility
primitives. Do not inherit:

- the giant form/cockpit information architecture;
- raw master-prompt or technical-schema editing;
- manual six-slot maintenance as the normal workflow;
- ambiguous Draft/Cast/Mint commitment language;
- Surgical/Eraser and exposed evidence mechanics;
- Package Health as a routine customer task;
- broad Zustand stores whose state duplicates server authority;
- multiple competing entry and return paths.

Recommended cutover:

1. freeze the old UI except safety and R7 verification fixes;
2. ratify one V2 product and authority contract;
3. build the new stack alongside the old one behind a server-owned flag;
4. route newly started casting sessions to V2 first;
5. prove existing Cast, history, restore, Canvas, Wardrobe, and export
   compatibility;
6. expand the cohort after founder dogfood and production evidence;
7. remove the old UI, obsolete stores/hooks, and redundant routes only after
   the replacement is authoritative.

This avoids both bad extremes: endlessly renovating the current cockpit, or
discarding years of production-critical backend hardening.

### 3.3 Current drafts and Canvas-origin casting

#### Current behaviour

Today the lobby/Studio creation path runs two durable operations:

1. `models.create` writes a real `models` row with `status: "draft"`, no public
   Cast ID, and the generated master prompt, technical schema, and preferences;
2. `generation.castingImage` generates and attaches one `frontClose` identity
   anchor.

The draft model exists before its first image finishes. This gives current
operations a durable model owner, but it also means unfinished casting work can
appear as a Draft in the library. A draft is editable and placeable on Canvas
but is not yet a signed/minted roster identity.

Canvas currently opens an empty Cast node into a picker:

- choose an existing signed/minted Cast → stamp that model and its canonical
  headshot onto the node without generation;
- choose an existing Draft → place the same draft model with a Draft badge;
- choose Cast new → open the same Casting takeover bound to the board/item
  origin.

For a Canvas-origin new Cast, the draft and headshot are created by the same
Studio flow. Once the headshot exists, the originating node is filled with the
draft while the takeover may remain open. Later promotion/mint updates that
same model/node. If board placement fails after the paid result exists, the
draft remains recoverable in the model library rather than regenerating or
charging twice.

#### Future behaviour

Roll candidates must not be `models` rows and must not appear as Drafts in the
Cast library. Eight candidates are roll-owned exploratory records. An
unfinished roll may be resumed as an **Unsigned casting session/sheet**, but it
is not yet a roster member and does not occupy eight library entries.

Only Sign creates/promotes the actual Cast identity:

```text
unsigned roll and candidates
  → Sign candidate
  → one roster Cast with immutable face
  → full canonical package streams into that Cast
```

The existing `draft` database state may remain during migration and for legacy
records, but the Fable plan must define whether the future runtime replaces it
with explicit roll/sign/building states or narrows it to internal transitional
use. Do not merely rename candidate rows "draft."

Existing customer drafts and placed draft nodes require an explicit
compatibility route:

- retain them without data loss;
- present them as legacy Unsigned Casts or resumable casting work;
- let the owner deliberately Sign, delete, or continue them;
- never silently convert, charge, or discard them.

#### Future Canvas flow

Canvas and the roster use the same casting product with different return
destinations:

1. The user creates/selects an empty Cast node.
2. The picker offers:
   - choose an existing signed roster member;
   - resume appropriate unsigned work;
   - Cast new.
3. Cast new opens the sentence → streaming sheet → keep/discard/follow flow,
   carrying a server-owned board/item origin.
4. Sign creates one real Cast, locks the face, and immediately fills the
   originating node with the signed master portrait.
5. The complete canonical package continues generating durably and streams
   into the node's compact character sheet as views validate.
6. Closing the overlay, navigating away, refreshing, or changing tabs cannot
   lose the operation; the node and roster recover from server-owned truth.

Choosing an existing signed Cast remains immediate and free: Canvas places a
reference to that Cast rather than copying or regenerating it.

There is one Cast source of truth. The roster room and every Canvas placement
reference the same signed identity/package snapshots. Canonical identity
revisions synchronize that Cast and its placements; campaign Takes remain
separate historical outputs.

## 4. Why the current experience feels over-engineered

The original visible controls solved a legitimate blank-page problem: a user
who did not know whom to cast could choose from menus. The weakness is that the
menus became the primary authoring model.

The current form exposes dozens of values such as:

- brand direction and commercial/editorial/runway blend;
- gender, exact age, ethnicity blend, and body type;
- face shape, jawline, cheekbones, eyes, nose, lips, and brows;
- skin tone, texture, and finish;
- eye colour;
- hair colour, style, length, texture, fringe, parting, volume, flyaways,
  tuck, facial hair, and fade/taper;
- freeform features;
- Engine's choice switches;
- completion percentage and required-field state;
- model name, randomization, and a separate Cast button.

This creates two problems:

1. It asks ordinary users to think like prompt engineers.
2. It turns descriptive details into an overly literal checklist that can
   reduce the generator's creative latitude.

For example, "mid-20s Korean male K-pop star" should lock the important
identity facts while allowing the engine to explore different plausible faces,
hair, energy, and editorial interpretations. It should not become a rigid
twenty-field construction recipe.

## 5. Recommended authoring model

Use three levels of authority.

### 5.1 Intent

The sentence expresses the creative brief:

> Mid-20s Korean male K-pop star with polished editorial energy.

Intent guides the roll but is not a demand that every inferred detail remain
identical.

### 5.2 Locked facts

Only explicit or deliberately locked facts must remain stable across all eight
candidates.

Examples:

- male;
- Korean;
- mid-20s;
- a user-locked hair colour;
- a specifically required permanent feature.

### 5.3 Creative latitude

Omitted or open details vary across candidates:

- facial structure;
- exact age within a stated range;
- hairstyle;
- expression;
- casting energy;
- other appearance details not explicitly locked.

Default interpretation:

- explicitly stated fact → **Locked**
- omitted fact → **Varying**
- current "Engine's choice" → user-facing **Varying** or **Open**

The system may support a lock per parameter internally, but the UI must not
show twenty-five lock icons at once. Show group locks first, with per-field
locks available after expanding a group.

Every non-default interpreted setting remains visible as a summary chip while
Advanced is collapsed.

### 5.4 Subject and visual style are independent

Do not model "anime", "orc", "android", or "photoreal" as one flat human
template with exceptional fields.

The compiled casting brief needs at least two independent dimensions:

1. **Subject/body profile**
   - human;
   - humanlike or humanoid;
   - anthropomorphic;
   - creature or other non-standard subject.
2. **Visual style**
   - photoreal;
   - anime;
   - manga;
   - cel-shaded;
   - 3D animation;
   - painterly, comic, game-concept, or another authored treatment.

Examples the first-class natural-language path should understand include:

- "mid-20s Korean male K-pop star with polished editorial energy";
- "anime silver-haired streetwear idol";
- "cel-shaded cybernetic bounty hunter";
- "huge middle-aged orc mercenary with a broken left tusk";
- "anthropomorphic fox creative director in luxury tailoring".

When style is stated, it remains stable across the sheet, canonical package,
and room unless the user explicitly asks to explore styles. Candidate identity
varies; the comparison treatment should not jump unpredictably between
photorealism, anime, and illustration.

The identity contract must preserve the traits that define the particular
subject. For a human this may include facial geometry and hair. For an anime
character it may include eye shape, hair silhouette, proportions, linework, and
rendering treatment. For an orc it may include tusks, ears, skin colour,
build, scars, and non-human proportions.

Do not make human-only fields mandatory. Ethnicity, human gender presentation,
human hair taxonomy, standard human anatomy, and human garment compatibility
are conditional capabilities, not columns every Cast must pretend to possess.

Recommended rollout law:

> Broad by design, calibrated in cohorts.

The first certified cohorts should include photoreal humans, anime/stylized
humans, and humanlike fantasy/android characters. More unusual bodies can
follow without requiring a schema or product rewrite.

## 6. Surface mapping

### 6.1 Roster / first screen — primary

Keep primary:

- one natural-language sentence field;
- TRY/example prompts for blank-page inspiration;
- Surprise me as an immediate roll;
- the roll cost before generation;
- Upload a real person as a separate, rights-aware route;
- Browse roster, mapped to the existing Models library;
- existing signed Cast members.

Submitting a sentence or choosing Surprise me should immediately begin the
roll. Do not require a second review screen and another Cast button.

The example prompt system replaces the old menu's inspiration function
without forcing manual assembly.

### 6.2 Candidate sheet — primary

The sheet owns:

- eight candidates;
- per-candidate Keep, Discard, and Follow;
- streaming arrival: each ready candidate renders immediately without waiting
  for the slowest member of the roll;
- pure-delete Discard with one-step-per-click Undo;
- natural-language roll nudges;
- one clear New roll action and its cost;
- immutable roll history;
- lineage for followed candidates;
- a persistent cross-roll shortlist;
- visible summary chips;
- a concise Locked/Varying strip.

The README §5.7 state laws are binding:

- counts derive from the rendered filtered list;
- discard collections are deduplicated;
- discarding also removes a keep;
- each roll is an immutable version;
- a new roll does not accidentally carry rings onto unrelated candidates.

Recommended keep behaviour:

- every keep is keyed by stable candidate ID, never grid position;
- each roll preserves its own candidate-ID keep state;
- kept candidates also appear in a persistent shortlist tray keyed by
  candidate ID;
- a new roll is visually clean;
- carried-over shortlist members appear in the tray only and never create
  selected rings on a new roll's grid;
- returning to an earlier roll restores that roll's original candidate-ID
  keeps.

Discard is not preference learning. It removes that candidate from the current
roll only, removes any keep for the same candidate, and adds one reversible
entry to the Undo stack. It must never alter the next roll's prompt, weights,
or candidate distribution. Undo is cleared when the user starts the next roll.

### 6.3 Advanced disclosure

Group parameters as follows.

#### Identity

- gender;
- age or age range;
- ethnicity;
- build;
- face structure;
- skin;
- eyes;
- hair;
- facial hair;
- distinctive or permanent features.

#### Creative direction

- the original sentence;
- brand direction;
- archetype;
- commercial/editorial/runway energy;
- other high-level character direction.

#### Variation authority

- Locked versus Varying/Open at group level;
- per-field locks on drill-down;
- explicit sentence facts pre-locked;
- omissions varying by default.

#### Expert technical

- engine choice when the product truly supports a meaningful choice;
- reproducible seed controls only if a real backend seed contract exists.

Do not put camera, lens, lighting, clothing, makeup, or campaign styling into
candidate identity variation. The sheet should compare characters under a
normalized casting treatment appropriate to the chosen visual style and body
profile. Otherwise the user is partly choosing presentation rather than
identity.

### 6.4 Casting room

The room must not become the old cockpit relocated to a new screen. Its
default composition is deliberately narrow:

- a three-slot master block:
  - large front full-body master;
  - portrait/face anchor;
  - side/profile full-body coverage;
- name and profile;
- a compact natural-language take/refine control limited to light, wardrobe,
  crop, framing, and mood;
- a compact canonical-view strip;
- a first-class Voice card;
- an In campaigns card;
- a Siblings card for related candidates from the signed member's sheet;
- visible `IDENTITY LOCKED` status and usage truth.

Deeper capabilities use tabs or right-column cards rather than competing in
the default view:

- Wardrobe;
- detailed Views/package management;
- Versions, compare, and restore;
- Export;
- rights and consent;
- voice selection/cloning parameters;
- per-campaign overrides;
- engine pinning where genuinely supported.

References used for presentation may live inside the relevant room tool, but a
reference or instruction that could change the person's face cannot mutate the
signed Cast through ordinary Refine.

Permanent identity changes such as a tattoo, scar, cybernetic trait, or
hairstyle change are not ordinary room refinements. If the product permits one,
the action exits the locked room into an explicit identity-revision/new-sheet
ceremony with the current member as lineage. The existing R7 evidence system
remains useful authority underneath that ceremony; it must not make
`IDENTITY LOCKED` untrue.

Fork is not a room mutation. "Create a different person" returns to a new
candidate sheet with the current member recorded as lineage while leaving the
signed member unchanged.

#### Takes are derived portrayals, not identity

The Takes section is a first-class part of the default room. A Take shows the
same signed person in a scene, outfit, crop, mood, action, campaign setup, or
video:

- holding a product;
- walking and talking;
- in a kitchen;
- outdoors in soft light;
- wearing a campaign outfit;
- laughing or looking tired.

Creating a Take never changes the master Cast or its canonical identity views.
Every Take records the exact signed identity snapshot it used. Existing Takes
and live campaigns remain historically stable after a later identity revision;
the user may deliberately create a new Take from the latest identity, but
Drape never rewrites past campaign work automatically.

The room therefore has three distinct verbs:

```text
New take       → portray the same signed person differently
Edit identity  → change a lasting trait and synchronize canonical views
Fork           → return to a sheet and create a related different person
```

The master block is the only normal doorway into identity editing. Hovering it
may reveal **Edit** and **Fork**, but neither action may be hover-only: touch,
keyboard, and accessibility paths need persistent equivalents. Avoid
**Replace**, which suggests destructive overwrite and weakens lineage.

### 6.5 Cut from the normal product path

- the initial 320px control cockpit;
- completion percentages;
- "Fill required fields";
- a second Cast button after submitting a sentence;
- a separate Randomize action when Surprise me/TRY already provides it;
- model naming before a face exists;
- admin/debug controls in the product UI;
- raw master-prompt editing;
- raw technical-schema JSON as a primary tab;
- provider prompt, recipe, probe, or ontology controls;
- seed UI before reproducible seeds exist;
- a second user-facing Finalize/Mint commitment after Sign;
- Fork presented as an in-room mutation;
- Surgical, Eraser, brush, mask, reveal-layer, and Photoshop-style toolbars
  anywhere in the customer product.

Surgical/Eraser retirement is a product-surface decision, not a ban on internal
image-processing primitives. Drape may derive masks, crops, target regions, or
generative erase instructions behind a natural-language request. Those
implementation details remain server-owned and produce an immutable,
versioned result rather than a customer-managed layer stack.

Examples:

- "remove the tattoo from her left arm" → explicit identity-evidence removal
  revision and canonical-package synchronization;
- "remove the bag from this campaign image" → a new Take version;
- "shorten her hair" → focused identity edit if the signed face can be
  preserved, otherwise Fork/new sheet.

If natural language is genuinely ambiguous, ask one human clarification or
allow a temporary point-to-region gesture inside the focused editor. Do not
turn that exception back into a persistent surgical toolbox.

The current "Set details myself" entry should become **Advanced brief**, not a
separate creation journey.

### 6.6 Capability truth for non-human and stylized Casts

Casting a character and supporting every downstream operation are different
promises. A non-human Cast must not be rejected merely because the current VTO
system cannot dress it.

Each signed Cast exposes server-owned capability truth, for example:

| Cast cohort | Casting | Takes | Voice | Wardrobe/VTO |
|---|---|---|---|---|
| Photoreal human | Full | Full | Full | Full |
| Anime/stylized human | Full | Full | Full | Calibrated support |
| Humanoid android/orc | Full | Full | Full | Garment/body dependent |
| Non-humanoid creature | Full | Full | Possible | Unsupported initially |

This is not a fixed UI matrix or a reason to create dozens of subject forms.
The server resolves a Cast's body/style profile and returns the capabilities
the current product can honestly perform. Unsupported downstream actions remain
clearly unavailable without invalidating the Cast itself.

Canonical views also come from a view-package profile rather than one universal
six-human-pose assumption. Humanlike cohorts may share portrait, front
full-body, profile, three-quarter, back, and motion coverage. A non-standard
body may require a different package while preserving the same snapshot,
version, identity-lock, and Takes laws.

Identity validation must be cohort-aware. A photoreal face recognizer cannot be
the sole authority for anime, illustration, masks, non-human faces, or
creatures. The plan must define suitable multimodal and structural checks for
each released cohort and fail closed when no trustworthy verifier exists.

## 7. Master prompt and technical specification

### 7.1 Master prompt

The master prompt remains useful internally for:

- consistent identity across views;
- refinement;
- reconstructing generation context;
- audit and provenance;
- downstream generation context.

It is a compiled provider instruction, not a normal customer document.

Recommendation:

- retain it internally;
- store it where required for audit/recovery;
- derive or version it from authoritative identity state;
- remove it from the normal Casting Studio interface;
- expose it only in an expert/debug/provenance surface if a real customer need
  appears.

### 7.2 Technical specification

The structured identity state remains useful for:

- stable identity facts;
- lock/vary authority;
- snapshot and revision comparisons;
- consistent views;
- Wardrobe, Canvas, and export consumption;
- durable lifecycle and conflict detection.

The raw JSON is not useful to ordinary users.

Show a human summary instead:

> Korean man, mid-20s · lean build · dark hair · editorial K-pop energy

Users adjust or lock those facts through chips and Advanced. The raw schema
can remain an internal representation and, if justified later, an expert
provenance/export view.

## 8. Current pipeline conflicts

### 8.1 The current mutation produces one person, not one roll

Today's initial flow:

1. calls `models.create`;
2. creates one draft model and identity documents;
3. charges for one `castingImage`;
4. generates one `frontClose`;
5. uploads and commits one image;
6. returns only after that image is terminal.

At current pricing, one initial image is 350 credits. Naively invoking this
eight times would create:

- eight draft models;
- eight independent receipts and charges;
- 2,800 credits of retail work;
- at least two provider waves with the default image concurrency of five;
- no shared roll, lineage, selection, or signing contract.

Six candidates are not a meaningful architectural shortcut: six also exceeds
the default five-call concurrency and still requires a second wave.

### 8.2 Required roll architecture

Do not implement the sheet as eight client calls to the current mutation.

Introduce a server-owned roll operation with durable candidate state, for
example:

```text
casting_rolls
  id
  user/workspace owner
  normalized brief
  lock/vary contract
  operation and billing authority
  immutable version/parent roll
  status

casting_roll_candidates
  id
  roll id
  position
  lineage parent candidate
  interpreted identity state
  generation attempt/result
  keep/discard/follow state
  cleanup/provenance state
```

Exact schema design remains Fable's planning task, but the authority laws are:

- the server owns the roll and all candidates;
- a candidate is not a full Cast model;
- one roll owns its billing/idempotency/refund ceremony;
- each candidate reports generating/ready/failed independently;
- candidates may arrive progressively;
- retries do not double-charge or regenerate successful candidates;
- losers have an explicit retention/cleanup policy;
- one signed candidate is atomically promoted/instantiated as the actual Cast;
- no unchosen candidate can become Cast authority.

The existing durable-operation polling bridge can support progressive UI
updates, but current public operation DTOs do not contain candidate-level
state. A roll-specific projection or stream is required.

### 8.3 Eight-up streaming

Eight-up streaming is not feasible on the current single-image call.

It becomes feasible after:

- the roll operation exists;
- candidate attempts are independently durable;
- provider concurrency and queue pressure are bounded server-side;
- incremental candidate projections exist;
- pricing and refund semantics are designed for a roll;
- partial success and retry rules are explicit.

Do not compromise the final product to six solely because the current call is
single-image. Eight is the correct UX target. Build the operation required to
support it honestly.

### 8.4 Sign is the one user-facing commitment

The product must not ask the user to understand both Sign and a later
Finalize/Mint ceremony.

The recommended product law is:

- before Sign, candidates are exploratory and replaceable;
- Sign is the single commitment to this person;
- at Sign, the selected face becomes the immutable likeness anchor and the
  member enters the roster;
- after Sign, the room may create new takes and package views only when the
  signed face is preserved;
- Sign starts completion of the full canonical Cast package automatically,
  with every view included in the quoted Cast-creation price rather than sold
  as a series of manual slot purchases;
- there is no later user-facing identity lock or mint moment.

Current internal mint/seal semantics do not map cleanly to that law because
they couple identity/package finality to the existing draft workflow. The
implementation plan must audit and refactor that lifecycle. Internal snapshot
or package seals may still occur, but they are system bookkeeping rather than
a second product commitment.

Campaign readiness or export eligibility may require particular views,
rights, or usage data. Those are honest readiness requirements, not another
moment where the person becomes immutable.

The face is locked **at Sign**, not later.

The room opens immediately with the signed candidate portrait and streams the
remaining package views into their slots as they pass validation. It does not
wait for the slowest view before showing progress.

### 8.5 Room refinement must prove identity preservation

`IDENTITY LOCKED` cannot be a prompt-only promise.

Every generated room take must:

- derive from the signed master/identity snapshot;
- change only allowed presentation dimensions;
- pass a server-owned identity-preservation gate against the signed anchor;
- refuse to land if the gate is false or uncertain;
- preserve the operation's honest charge/refund behaviour.

Hair, facial geometry, age, ethnicity, permanent features, and other
identity-bearing changes route back to a new sheet or explicit identity
revision. If the engine drifts face geometry while attempting an allowed
lighting, crop, framing, mood, or Wardrobe change, that output is rejected
rather than silently replacing roster truth.

### 8.6 Upload a real person is a separate ingestion product

Current creation deliberately refuses creation-time reference images and
presentation/wardrobe language. References may join after a base headshot
through a controlled refinement path.

The handoff's Upload action is valid, but it requires a separately planned:

- rights/consent boundary;
- owner-scoped private upload;
- likeness-ingestion contract;
- retention/deletion policy;
- identity-anchor generation path.

Do not silently treat it as the current post-headshot reference input.

### 8.7 Voice is first-class roster truth

A roster member is summarized by **face, voice, and usage**. Voice is not
another creation-form parameter and must not disappear behind Wardrobe or
Export.

The default room includes a Voice card where the voice can be auditioned and,
subject to rights and consent, selected or configured. Voice implementation
needs its own provenance, consent, usage, and cloning-parameter plan, but its
place in the room and roster-card summary is settled.

### 8.8 Seed controls are unsupported

The current Gemini path has no trustworthy reproducible seed contract. Do not
expose seed metadata or seed locks merely because the prototype contains
them. Reproducible inputs and provenance are valuable; exact pixel replay
must not be promised.

### 8.9 A signed Cast is a complete synchronized package

The user should not assemble a Cast by buying one angle at a time. Creating a
Cast includes the full canonical package. The product may distinguish roll
exploration cost from the cost of signing/building a roster member, but it
must quote those prices clearly before each deliberate action. There is no
surprise per-slot purchasing ceremony after Sign.

The room's three-slot master block shows the most useful coverage:

1. front full body;
2. portrait/face anchor;
3. side/profile full body.

The complete underlying package may retain additional canonical views such as
three-quarter, side close, walk, and back. Those live in the detailed Views
surface rather than competing in the default room.

When the user accepts a permanent identity revision, the Cast must appear to
update as one coherent package. Under the hood, do **not** regenerate images
that provably cannot show the changed trait: unnecessary regeneration costs
money and creates fresh identity-drift risk.

Instead, one explicitly priced revision operation:

1. freezes the current signed snapshot;
2. derives visibility for every canonical view;
3. regenerates every affected view automatically;
4. reuses every unaffected view;
5. verifies presence where the trait must show and absence where it must not;
6. verifies the signed face in every generated result;
7. commits one new synchronized package snapshot only after the required
   affected views pass.

If the batch cannot complete safely, the previous coherent package remains
current. The UI may show per-view progress, retry, and honest refund state, but
must not leave a half-old/half-new Cast as canonical truth.

#### Focused master editor

The three-slot master block has one **Edit identity** entry. Opening it launches
a focused editor rather than expanding the entire room into a cockpit.

The editor should provide:

- a large pan-and-zoom canvas;
- the relevant master frame at useful resolution;
- natural-language instruction;
- optional owned reference upload;
- clear current-versus-proposed comparison;
- one total revision/synchronization price before provider work;
- explicit Apply/Approve and Cancel;
- closed progress and failure/refund truth.

The user does not need to choose an anatomical ontology, evidence source,
visibility map, engine, canonical slot, or sibling refresh list. Drape derives
those from the request and the signed package.

The visible image the user clicks may seed the editor, but the server owns the
authoring source:

- face or hair request → portrait/face anchor;
- chest, sleeve, body mark, or silhouette request → front full-body master;
- side-specific trait → the best master coverage for that side;
- insufficient coverage → ask for or generate the required evidence inside the
  quoted revision ceremony rather than guessing.

The editor classifies intent before spending:

- scene, outfit, light, crop, action, or mood → route to **New take**;
- lasting trait that preserves the signed face → **Edit identity**;
- facial geometry or genuinely different person → **Fork/new sheet**.

After the user approves the edited master candidate, Drape automatically
synchronizes the affected canonical views through the atomic package operation
above. Existing Takes are not synchronized: they remain outputs of their
recorded identity snapshot.

### 8.10 Body-wide natural-language placement is required

The current R7 Ink runtime supports only one deliberately bounded calibration
recipe: anterior upper-torso/pec placement authored from `frontFull`. That was
the first proof that owned evidence, explicit acceptance, selective
visibility, probes, retries, refunds, and package synchronization could work.
It is not the intended final tattoo product and must not become a permanent
chest-only limitation.

The product end-state is:

> The user describes or points to the tattoo location naturally. Drape maps it
> to server-owned anatomy and synchronizes every view that can show it.

Required internal coverage includes, at minimum:

- face, scalp, neck, and behind-ear regions;
- chest, abdomen, ribs/flank, shoulders, and back;
- left/right upper arm, elbow, forearm, wrist, and hand;
- left/right thigh, knee, calf/shin, ankle, and foot;
- centre, bilateral, and cross-body placement;
- multi-zone designs such as half sleeves, full sleeves, chest-to-shoulder
  pieces, back pieces, and leg sleeves.

This does not imply a body-zone form in the UI. Natural language remains
primary, the zoomable editor may accept a temporary point/region gesture, and
Drape asks one clarification only when necessary (for example, "Which arm?").

The underlying architecture must support single- and multi-zone feature
graphs. Every enabled zone/recipe owns:

- anatomical surface and laterality;
- suitable authoring/master views;
- visibility/occlusion rules for every canonical angle;
- placement guidance and design continuity;
- presence, absence, laterality, framing, and identity probes;
- retry/refund and atomic synchronization law.

A full sleeve is not treated as a generic "arm" label. It spans connected
shoulder/upper-arm/elbow/forearm regions and must preserve one design across
pose, foreshortening, occlusion, and multiple views.

Rollout may enable recipes in calibrated groups, but the schema and plan must
target broad body coverage from the start. Until a particular recipe passes
calibration, the live system refuses that unsupported request honestly rather
than guessing. That temporary refusal is a release-safety boundary, not the
finished user experience.

## 9. Necessary pushback on README §7

The depth fits within the proposed three surfaces. A fourth product surface is
not needed. The following corrections are necessary:

1. **Do not put camera, lens, lighting, wardrobe, or makeup into sheet
   variation.** Normalize presentation so users compare identities fairly.
   Move those controls to the room.
2. **Do not make every lock equally visible.** Keep per-field authority in the
   data model, but use group locks and progressive drill-down in the UI.
3. **Treat `IDENTITY LOCKED` literally.** Ordinary room actions cannot change
   the signed person's face or identity. A permanent identity change exits to
   a separately labelled revision/new-sheet ceremony with lineage.
4. **Make Sign the only product commitment.** The face locks at Sign. Internal
   package sealing remains implementation detail, not a later Finalize/Mint
   ceremony.
5. **Do not treat current slot versions as roll history.** Rolls need their own
   immutable identity and lineage model.
6. **Do not expose a seed until the provider/backend can honour it.**

Recommended room promise:

> The face is locked at Sign. Room takes may change presentation only, and an
> output that drifts the signed face does not land.

## 10. Answers to README §12

### 10.1 Eight candidates or six?

Eight is the correct final product target.

Do not use the current 350-credit mutation eight times, and do not choose six
merely as a queue workaround. Design roll economics and provider orchestration
as one product operation. If a temporary internal calibration harness uses a
different count, it must not silently redefine the final UX.

### 10.2 Do keeps survive a new roll?

Use the hybrid model:

- keep rings remain scoped to candidate IDs inside their immutable roll;
- a persistent candidate-ID-keyed shortlist tray spans rolls;
- a new roll starts visually clean;
- carried-over shortlist members appear only in the tray, never as selected
  rings on the new grid;
- navigating back restores the earlier roll's keeps;
- no favorite is lost accidentally.

### 10.3 How should parameters be grouped?

1. Identity
2. Creative direction
3. Variation authority
4. Expert technical

Presentation/camera/wardrobe are room concerns, not identity groups.

### 10.4 Where does Wardrobe belong?

Per signed Cast in the casting room. Candidate sheets use standardized neutral
casting clothing. A brief may communicate persona, but actual garments,
accessories, makeup, and campaign styling remain downstream.

## 11. Shared app foundation

README §0 is a shared-platform migration, not casting-local styling.

The repository already has:

- an application lobby;
- a 216px text-forward rail;
- Studio-specific headers;
- a global ThemeProvider;
- Canvas-specific absolute light tokens;
- an existing token system based around Inter and current Drape variables.

The 76px rail, 56px topbar, theme toggle, Archivo/JetBrains Mono typography,
and new tokens should replace or deliberately migrate those systems through a
shared `AppShell`.

Do not:

- paste the prototype token file beside the existing tokens;
- add a casting-only rail/topbar;
- build a second theme provider;
- leave Lobby, Studio, Canvas, and Wardrobe on unrelated shell rules.

The current Canvas light-only ruling conflicts with an app-wide dark/light
toggle. The plan must explicitly choose and record whether:

1. the new theme system supersedes that ruling and Canvas becomes theme-aware;
   or
2. Canvas intentionally stays a light work surface inside a themed shell.

Do not let this emerge accidentally from CSS.

## 12. Recommended planning sequence

Fable should produce a dependency-ordered plan, not begin coding immediately.

### Phase A — Reopen and finish the honest R7 product gate

- retain the completed snapshot, restore, evidence, package, deletion,
  ownership, billing, and recovery foundations;
- complete and review the current all-body projection/laterality work;
- replace the "pass or remain disabled" completion loophole with product-level
  acceptance for common body regions and multi-zone requests;
- prove side, three-quarter, walk, back, and first-unseen view projection;
- prove selective affected-view synchronization and previous-package rollback;
- rerun focused, disposable-database, full-suite, build, founder, and
  production gates in proportion to the final diff;
- correct the R7-8 closure record;
- classify every remaining current UI task as foundation, temporary proof, or
  superseded UI;
- do not expand the old UI while completing this work.

### Phase B — Ratify product contracts

- ratify the rebuild boundary: new frontend/orchestration, preserved R7
  authorities, feature-flagged side-by-side cutover;
- ratify the character-casting scope: subject/body profile and visual style as
  independent dimensions;
- define the first certified cohorts—photoreal humans, anime/stylized humans,
  and humanlike fantasy/android characters—without hard-coding future cohorts
  out of the schema;
- define cohort-aware identity verification, canonical-view profiles, and
  downstream capability truth;
- Sign as the single commitment and face lock;
- removal or hiding of the later user-facing mint ceremony;
- full canonical package generation included in the Cast-creation contract;
- clear roll-versus-Sign price presentation without per-view purchasing;
- technical identity-preservation gate for every room take;
- locked/varying interpretation rules;
- roll history and persistent shortlist;
- eight-candidate roll pricing;
- partial-failure/refund semantics;
- candidate retention and cleanup;
- real-person upload rights and consent;
- shared theme treatment for Canvas;
- human-facing identity summary boundary.

### Phase C — Shared app foundation

- shared token migration;
- `AppShell`;
- 76px navigation rail;
- 56px topbar;
- persisted theme toggle;
- responsive shell behaviour;
- migration of Lobby, Casting, Wardrobe, Models, and Canvas;
- no casting-local duplicate foundation.

### Phase D — Roll domain and operation

- a purpose-built Casting V2 application service/facade over the preserved R7
  authorities rather than direct reuse of old screen orchestration;
- extensible subject/body-profile and visual-style contracts;
- cohort-specific normalized sheet framing, canonical-view packages, and
  identity-preservation policies;
- explicit capability projections for Takes, Voice, Wardrobe/VTO, Canvas, and
  Export;
- durable roll/candidate schema;
- ownership and access-control laws;
- operation receipt, billing, refund, retry, and cleanup contracts;
- queue/concurrency design;
- candidate-level progress projection;
- streaming delivery that renders each candidate independently;
- immutable version and lineage model;
- atomic Sign promotion;
- automatic full-package generation after Sign;
- atomic affected-view synchronization for accepted identity revisions;
- mixed-version/deployment compatibility;
- disposable-database and concurrency tests.

### Phase E — Roster and candidate sheet

- sentence-first entry;
- TRY prompts and Surprise me;
- progressive arrival;
- candidate-ID-keyed keep/discard/follow;
- pure-delete Discard and one-step Undo;
- lineage;
- shortlist and roll history;
- summary chips;
- Advanced locks;
- no second Cast confirmation after sentence submission.

### Phase F — Casting room

- selected likeness;
- identity-preserving presentation refinement;
- three-slot full-body/portrait/side master block plus Voice, campaigns, and
  siblings;
- first-class Takes for scenes, outfits, actions, moods, and video without
  changing canonical identity;
- focused pan/zoom master editor with Edit-versus-Fork routing;
- tab/card treatment for Wardrobe, detailed Views, Versions, and Export;
- reference use that cannot bypass the face lock;
- separate identity-revision/new-sheet routing for permanent changes;
- lineage-preserving return to a new sheet for a genuinely different person;
- human summaries rather than raw internal documents.

### Phase G — Cutover and retirement

- map old routes and cached client state;
- route new casting sessions to V2 before migrating legacy resumable work;
- preserve active operations across deploy skew;
- remove the obsolete cockpit only after replacement paths are proven;
- delete superseded stores, hooks, components, and redundant route
  choreography rather than leaving two permanent studios;
- migrate deep links and browser history;
- verify no old surface can bypass roll/sign authority;
- founder dogfood and production rollout gates.

## 13. Required plan quality

The Fable plan should include:

- an explicit judgment on the rebuild boundary and which current frontend
  modules should be reused, wrapped, or retired;
- a reconciliation of the formal R7-8 closure with the 2026-07-30 live audit;
- exact current file/module inventory;
- proposed schema and migration boundaries;
- durable state machines for rolls, candidates, Sign, retries, and cleanup;
- billing/idempotency laws;
- ownership predicates in durable database statements;
- mixed-version deploy behaviour;
- privacy/projection boundaries;
- failure and recovery behaviour;
- test strategy, including real disposable-DB concurrency tests;
- feature-flag and cohort rollout;
- explicit founder decisions;
- UI cutover plan;
- removal plan for superseded surfaces;
- production verification and rollback gates.

Avoid:

- one giant implementation batch;
- eight client-side calls to the existing mutation;
- a new UI built on client-only roll state;
- creating eight draft models;
- using candidate IDs as authority;
- reusing evidence-composer candidate tables without a deliberate domain
  ruling;
- free provider previews;
- auto-spend on mount, hover, selection, or cache invalidation;
- waiting for the slowest candidate before showing any of the roll;
- using grid position as shortlist identity;
- treating Discard as a hidden negative-learning signal;
- allowing room generation to land on prompt compliance without a
  server-owned likeness check;
- exposing raw master prompts or technical JSON as the default experience;
- polishing the old cockpit before replacing it.

## 14. Founder principles to preserve

- Use the strongest and most durable construction, but never at the expense of
  user experience.
- Natural language should feel frictionless.
- The system should infer technical detail rather than make the user operate
  it.
- Creative freedom is the default; hard constraints exist only when the user
  explicitly requires them.
- Casting is for reusable characters, not humans only.
- Subject kind and visual style are independent: an anime human, photoreal
  orc, cel-shaded android, or illustrated mascot all belong in the same casting
  product.
- Broad architecture does not justify false capability promises. Release
  cohorts deliberately and state downstream support honestly.
- No surprise automatic spend. One deliberate, clearly priced Sign or identity
  revision may include all dependent view generations automatically.
- No hidden generation disguised as a free preview.
- Core likeness remains stable after signing.
- Takes never mutate the master Cast or rewrite historical campaign work.
- Permanent identity changes remain possible through deliberate, auditable
  revision.
- Wardrobe and Canvas own presentation; Casting owns the reusable person.
- Existing R7 trust, billing, snapshot, evidence, and deletion laws must not be
  weakened to deliver the new UI.

## 15. Desired Fable output

Return:

1. a conflict-checked architecture and execution plan;
2. a current-to-future component and route map;
3. the roll/candidate/Sign state machines;
4. the subject/body-profile, visual-style, view-package, validation, and
   downstream-capability model;
5. the proposed schema and migration slices;
6. billing, retry, refund, cleanup, and provider-concurrency contracts;
7. the shared-shell migration plan;
8. the UI implementation sequence;
9. the exact R7 work that must finish first;
10. the obsolete current UI work that should stop;
11. founder decisions that cannot be inferred safely;
12. a side-by-side feature-flagged cutover and deletion strategy;
13. review, test, deployment, cohort rollout, and rollback gates.

Do not implement until the founder has reviewed and ratified that plan.
