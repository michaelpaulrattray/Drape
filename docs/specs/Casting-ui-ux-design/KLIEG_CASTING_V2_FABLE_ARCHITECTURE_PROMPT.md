# Klieg Casting V2 — Fable architecture prompt

Produce the authoritative architecture and execution plan for rebuilding
Drape's Casting experience.

This is planning and review only.

Do not:

- edit any file;
- stage or commit anything;
- push or deploy;
- change Railway variables;
- contact production;
- query any database;
- run paid image generation;
- expose or request API credentials.

Use your tools to inspect the repository and runnable design references. Work
from evidence rather than memory.

## 1. Required reading and inspection order

Start by reading completely:

1. `AGENTS.md`
2. `CLAUDE.md`

Then inspect the design handoff in this exact order.

### First: interact with the runnable references

Open in a browser and click through:

1. `docs/specs/Casting-ui-ux-design/drape-foundation/Drape Foundation.dc.html`
2. `docs/specs/Casting-ui-ux-design/drape-foundation/reference/Drape Studio.dc.html`
3. `docs/specs/Casting-ui-ux-design/drape-foundation/reference/Klieg Casting.dc.html`
4. `docs/specs/Casting-ui-ux-design/drape-foundation/reference/Klieg Canvas.dc.html`

Do not merely read their source. Interact with their flows, states, menus,
theme toggle, responsive behavior and candidate-sheet interactions.

If interactive browser inspection is unavailable, render them and inspect all
meaningful states through screenshots before proceeding.

### Then read completely

1. `docs/specs/Casting-ui-ux-design/drape-foundation/README.md`
2. `docs/specs/Casting-ui-ux-design/drape-foundation/tokens.css`
3. `docs/specs/Casting-ui-ux-design/drape-foundation/casting-brief/README.md`
4. `docs/specs/Casting-ui-ux-design/KLIEG_CASTING_STUDIO_FABLE_PLANNING_BRIEF.md`

After understanding the handoff, inspect the relevant current repository
implementation.

Avoid loading unrelated historical review prompts unless a concrete source
reference requires them. Keep discovery targeted while still reading every
selected specification completely.

## 2. Settled core Casting flow

Do not propose an alternative to this product shape:

natural-language sentence  
→ streaming sheet of eight candidates  
→ Keep / Discard / Follow  
→ Sign one  
→ Casting Room

The visual language and shared foundation are also deliberate:

- shared tokens;
- Archivo and JetBrains Mono typography roles;
- 76px navigation rail;
- 56px topbar;
- persisted light/dark theme;
- restrained editorial styling;
- reusable app-wide primitives.

These must become shared application infrastructure. Do not create:

- a Casting-only rail;
- a Casting-only theme provider;
- a parallel token system;
- a second permanent design system;
- another isolated cockpit.

## 3. Important repository-state correction

The repository is currently at commit `ffc1e0d`.

A large experimental tattoo/projection stack was reverted because it had
become over-engineered and still did not deliver the intended product. The
tracked tree was deliberately restored to the coherent pre-experiment state
represented by `edeeab9`, while retaining useful earlier R7 foundations around:

- snapshot authority;
- identity and package history;
- ownership and access control;
- deletion lifecycle;
- billing and credits;
- idempotent operations;
- refunds and recovery;
- private evidence;
- storage;
- restoration;
- provider queues;
- client projections;
- security hardening.

Therefore:

- inspect the current code and git history directly;
- treat planning-brief passages implying that the reverted all-body projection
  stack still exists as historical context, not current implementation truth;
- do not recommend resuming the custom computer-vision subsystem;
- do not assume the old R7 user interface is the intended future product;
- distinguish reusable backend laws from obsolete frontend orchestration;
- do not expand or polish the old Casting cockpit;
- identify precisely which R7 foundations remain valuable to Casting V2.

## 4. Rebuild boundary

The intended direction is a fresh Casting V2 frontend and orchestration layer
over selected durable backend foundations.

The expected cutover model is:

1. introduce the shared app foundation;
2. build Casting V2 as a separate frontend/domain facade;
3. run it beside the legacy Casting experience behind a server-owned feature
   flag;
4. prove legacy and V2 compatibility;
5. migrate resumable work deliberately;
6. remove obsolete routes, stores, hooks and components;
7. do not leave two permanent Casting systems.

The current studio has accumulated too many controls, stores, modes and
confirmation moments. Do not preserve complexity merely because it exists.

Strong backend architecture may be reused. Existing frontend choreography must
earn its place.

## 5. Settled product rulings

These are not open for redesign.

### Natural-language authoring

- Natural language is the primary authoring interface.
- The system should infer technical details rather than making customers
  operate them.
- Master prompts and technical specifications remain internal compiled state.
- They are not normal customer-facing documents or editing surfaces.
- Creative freedom is the default.
- Hard constraints exist only where the customer explicitly asks for them.
- Advanced settings use progressive disclosure.
- Every inferred or non-default active setting remains visible as a removable
  summary chip.
- Locks may expose deliberate invariants, but must not become a required form.

### Candidate sheet

- A roll contains eight candidates.
- Candidate framing should remain sufficiently constant to compare characters
  while the character varies.
- Candidates appear independently as soon as each completes.
- Never wait for the slowest candidate before showing the roll.
- Candidate identity is keyed by durable candidate ID, never grid position.
- Shortlisted candidates survive across rolls.
- Carried-over shortlist members appear in the tray only.
- They must not appear falsely selected on a later roll's grid.
- Keep is reversible shortlist state.
- Discard is a pure candidate deletion.
- Discard does not teach or negatively condition the next roll.
- Discard has one-step Undo.
- Follow creates a new roll with explicit lineage from the followed candidate.
- Rolls are immutable/versioned sets rather than destructively replacing one
  another.

### Sign and identity

- Sign is the single understandable commitment moment.
- Sign is when the chosen character becomes a durable Cast and its core
  identity becomes locked.
- Do not add a second confusing customer-facing "mint", "finalize" or "publish
  identity" ceremony.
- If internal minting must occur, it should be an implementation consequence
  of Sign.
- The customer must see one clear price and one deliberate confirmation.
- No surprise automatic spend.
- No provider work on mount, hover, selection, cache invalidation or a
  disguised free preview.
- A signed Cast receives its complete canonical package as part of the clearly
  priced Sign operation.
- Core likeness remains stable after signing.
- A genuinely different identity opens an explicit new sheet/revision flow
  with lineage.
- The original signed Cast remains unchanged.
- Fork belongs on a new candidate sheet, not as an in-room mutation.

### Casting Room

The default room must remain disciplined rather than becoming the old cockpit
in a new layout.

Primary room concepts:

- master representation;
- supporting canonical views;
- natural-language refinement;
- Takes;
- Voice;
- campaigns;
- clear identity-lock truth.

Secondary cards or tabs:

- Wardrobe;
- detailed Views;
- Versions;
- Export.

Rules:

- Takes represent scenes, outfits, moods, actions, crops, framing or video.
- Takes never mutate the canonical Cast.
- Takes never rewrite historical campaign work.
- Voice is first-class Cast truth.
- Permanent identity changes remain possible through a deliberate, auditable
  revision.
- Accepted permanent revisions should update affected canonical views
  automatically and atomically after one clearly priced approval.
- There must be no hidden free generation before approval.
- "Identity locked" must be enforced by server-owned validation, not merely
  interface copy.

### Design principle

Use the strongest and most durable construction, but never at the expense of
user experience.

The product should feel natural, creative and frictionless even when the
underlying authority is strict.

## 6. Character-casting scope

Casting V2 is for reusable characters, not only photoreal humans.

Subject/body profile and visual style are independent dimensions.

Examples that must fit the domain model:

- photoreal human;
- anime human;
- illustrated human;
- photoreal orc;
- cel-shaded android;
- humanoid alien;
- mascot;
- anthropomorphic character.

Initial certified cohorts should include:

1. photoreal humans;
2. anime/stylized humans;
3. humanlike fantasy characters and androids.

The architecture must not prevent later cohorts.

Broad architecture does not permit false product promises. Every Cast should
expose honest downstream capability truth, such as whether it currently
supports:

- canonical multiview generation;
- identity-preserving revision;
- Takes;
- Voice;
- Wardrobe/VTO;
- Canvas placement;
- animation/video;
- export formats.

A non-human Cast must not be rejected simply because the current human
Wardrobe/VTO pipeline cannot dress it.

Cohort-aware systems are required for:

- prompt compilation;
- normalized sheet framing;
- canonical view packages;
- identity validation;
- likeness retention;
- downstream capabilities.

The current photoreal-human prompting architecture should become one cohort
adapter, not universal product law.

## 7. Settled provider strategy

Casting V2 will use two image engines with separate responsibilities.

### GPT Image 2

Use GPT Image 2 for initial creative interpretation:

- natural-language brief interpretation;
- visual exploration;
- candidate diversity;
- initial eight-candidate Casting rolls.

### Nano Banana Pro

Use Nano Banana Pro for identity-preserving work after selection:

- reference-image-guided iterations;
- permanent appearance revisions;
- canonical supporting-view generation;
- synchronized affected-view updates;
- other operations where preserving the signed character matters more than
  creative divergence.

Provider choice is server-owned. Do not return "engine", "model" or provider
selection to the primary or advanced customer interface.

OpenRouter and Fal.ai are transport/provider integrations, not product-domain
concepts.

No real credentials may appear in:

- source code;
- documentation;
- client bundles;
- browser requests;
- tests;
- logs;
- review output.

Use environment-variable placeholders only, such as:

- `OPENROUTER_API_KEY`
- `FAL_KEY`

The actual credentials will be stored separately as deployment secrets.

### Required provider boundary

Design a provider-neutral orchestration layer with explicit capabilities for:

1. creative candidate generation;
2. identity-preserving editing;
3. canonical-view generation;
4. presentation Takes;
5. identity-retention validation.

The provider layer must:

- use adapters rather than scattering provider calls across routes;
- keep all credentials server-only;
- pin and record the provider, model and version used for each artifact;
- normalize progress, timeout, cancellation, retry and failure reporting;
- preserve operation receipts, idempotency, billing and refunds above the
  adapter;
- distinguish retryable transport failures from policy, prompt and capability
  failures;
- prevent retries from charging twice;
- prevent retries from silently retaining duplicate images;
- pass outputs through Drape's evidence/storage authority before exposing
  client projections;
- compile prompts per subject/style cohort;
- preserve candidate-level streaming even when a provider cannot stream a
  partially generated image;
- fail honestly if the identity-preserving engine cannot support the requested
  cohort or view;
- avoid silently falling back to a creative engine that changes the signed
  identity;
- allow later provider replacement without changing the roll, candidate, Sign
  or room domain contracts.

Independently verify from current official documentation:

- exact current model identifiers;
- input/reference-image limits;
- supported output formats and resolutions;
- concurrency and queue behavior;
- cancellation support;
- timeout behavior;
- content-policy behavior;
- pricing;
- whether batch generation is supported;
- whether partial image streaming is supported;
- data-retention/privacy terms relevant to Drape.

Clearly distinguish verified capabilities from assumptions.

Do not use or request actual keys during this planning review.

## 8. Shared-foundation decisions to resolve

Resolve these against the current React 19, Tailwind v4, shadcn and Drape
architecture.

1. How should the supplied CSS variables integrate with the current Tailwind
   and shadcn setup without arbitrary-value drift?
2. Should the foundation live as an internal application layer in this
   repository or a separate package? Assume Canvas is not a separate
   deployment.
3. Should accent configuration be fixed initially but future-ready for
   workspace branding, or configurable immediately?
4. How should the current ThemeProvider migrate without introducing another
   provider or a first-paint theme flash?
5. Should Canvas become fully theme-aware, or remain an intentionally light
   working surface inside a themed shell? Make a clear recommendation.
6. Which current UI primitives should be reused, wrapped, replaced or retired?
7. How should the new shell coexist temporarily with legacy routes during the
   feature-flagged transition?
8. Which Lobby redesign decisions should wait until Casting V2 establishes the
   final vocabulary and domain concepts?
9. How should the 76px rail behave responsively without harming Canvas
   workspace width?
10. How should accessibility, keyboard navigation, focus management and
    reduced motion be enforced across the shared foundation?

Do not paste the new token file beside the old system and leave both alive.
Produce a deliberate migration.

## 9. Inspect the current implementation

Build a targeted inventory of the existing:

- App shell and navigation;
- ThemeProvider and tokens;
- design-system primitives;
- shadcn usage;
- Lobby;
- Models library;
- Casting Studio;
- Casting stores and hooks;
- Studio routes;
- Canvas casting entry;
- Wardrobe casting entry;
- client tRPC consumers;
- casting routes and services;
- Gemini/provider integration;
- prompt compilation;
- snapshots;
- identity state;
- package/view state;
- operation receipts;
- credits;
- refunds;
- queues;
- retries and recovery;
- cleanup;
- storage and evidence;
- database schema;
- deletion lifecycle;
- resumable draft behavior;
- deployment feature flags.

Do not assume current screen boundaries are correct domain boundaries.

For each important current module, classify it as:

- reuse unchanged;
- reuse behind a Casting V2 facade;
- adapt;
- temporary compatibility layer;
- retire after cutover;
- delete because it is dead, superseded or unsafe.

Support classifications with file paths and reasons.

## 10. Pipeline questions requiring concrete answers

Answer these from the actual current implementation and verified provider
capabilities.

1. Can GPT Image 2 produce eight genuinely independent candidates in one
   operation?
2. If not, what server-owned roll operation should fan out candidate jobs
   without becoming eight uncontrolled client mutations?
3. How will candidates appear independently as they finish?
4. What is the maximum safe per-roll concurrency?
5. How do queue pressure and provider rate limits affect the design?
6. How are partial roll failures shown and refunded?
7. Does one roll create:
   - draft models;
   - temporary candidate records;
   - temporary storage objects;
   - or a purpose-built roll/candidate domain?
8. When does a durable Cast/model record come into existence?
9. What becomes immutable at Sign?
10. How does Sign promote exactly one candidate atomically?
11. How are rejected, discarded, expired and failed candidates cleaned up?
12. How long are shortlist candidates retained?
13. How are lineage and roll history represented?
14. How are carried shortlist candidates represented without coupling them to
    grid position?
15. How do old and new clients behave during mixed deployments?
16. How are unfinished legacy drafts resumed or migrated?
17. Can Nano Banana Pro reliably preserve signed identity across canonical
    views and revisions?
18. What independent validation is required before an identity-preserving
    output may commit?
19. What happens if an edit succeeds for some affected canonical views and
    fails for others?
20. How are Takes prevented from altering canonical identity or history?

Do not solve eight-up by making eight client-side calls to the existing create
mutation.

Do not create eight draft models.

Candidate IDs are references, not authority.

## 11. Security and durable authority requirements

Preserve the existing access-control laws.

- User/workspace authority comes from authenticated server context.
- Client-supplied user IDs, roles, read modes, provider names or snapshot IDs
  are never authority.
- Ownership belongs in the database statement that reads or writes.
- Client-supplied child IDs must be anchored to the owned parent in that same
  statement.
- Bulk operations must refuse atomically on mixed, missing or duplicate
  cohorts.
- Client responses use explicit allowlist projections.
- Provider credentials and internal prompts never cross the wire.
- Operation IDs are idempotency keys, not customer authority.
- A control that is not called on a request path does not count as
  enforcement.
- Behavioral tests must prove cross-user refusal and unchanged victim state.

Future teams/workspaces must remain possible without replacing these laws with
shared account passwords.

## 12. Required planning output

Return one conflict-checked report containing the following.

### A. Executive judgment

- Does the supplied foundation fit Drape?
- Does Casting V2 fit the current backend?
- Is the fresh-frontend/preserved-authority rebuild boundary correct?
- What should begin immediately?
- What should stop immediately?

### B. Handoff conflict report

Identify every material conflict between:

- the foundation package;
- Casting prototype;
- planning brief;
- current repository;
- provider capabilities;
- current R7 implementation.

Recommend one resolution for each conflict.

Do not reopen settled product rulings.

### C. Current-to-future module map

Provide a table of exact modules/files classified as:

- reuse;
- wrap;
- adapt;
- compatibility;
- retire;
- delete.

### D. Shared App Foundation plan

Cover:

- token migration;
- Tailwind integration;
- shadcn integration;
- AppShell;
- rail;
- topbar;
- typography;
- theme persistence;
- first-paint behavior;
- responsive shell;
- accessibility;
- Canvas theme ruling;
- legacy route coexistence;
- component primitives;
- Lobby migration sequence.

### E. Casting V2 domain architecture

Define boundaries for:

- brief compiler;
- cohort adapter;
- roll service;
- candidate service;
- provider orchestration;
- streaming progress;
- shortlist;
- Sign;
- Cast package creation;
- identity revision;
- Takes;
- capabilities;
- recovery;
- cleanup.

### F. Durable state machines

Provide explicit state machines for:

- roll;
- candidate;
- generation progress;
- keep;
- discard;
- undo;
- follow;
- shortlist;
- Sign;
- package completion;
- identity revision;
- canonical synchronization;
- Take;
- retry;
- refund;
- cancellation;
- cleanup.

Include invalid transitions and recovery behavior.

### G. Data model and migrations

Propose:

- tables;
- important columns;
- foreign keys;
- unique constraints;
- operation keys;
- lineage;
- expiry/cleanup fields;
- versioning;
- ownership predicates;
- migration slices;
- compatibility with current models and snapshots.

Do not casually reuse current candidate/evidence tables unless their semantics
genuinely match.

### H. Billing and provider contracts

Define:

- when price is displayed;
- when credits are reserved or deducted;
- roll pricing;
- Sign pricing;
- partial-failure refunds;
- retry laws;
- cancellation laws;
- no-double-charge guarantees;
- provider timeout handling;
- rate-limit handling;
- queue admission;
- cleanup after ambiguous failures.

### I. Character/cohort model

Define:

- subject/body profile;
- visual style;
- cohort;
- brief compiler;
- view package;
- validation policy;
- identity-retention policy;
- capability projection;
- unsupported-combination behavior.

### J. Privacy and projections

Define exactly what the client may receive for:

- roll;
- candidate;
- shortlist;
- signed Cast;
- Casting Room;
- Versions;
- Take;
- provider progress;
- failure.

Internal prompts, schemas, evidence details, storage keys and provider payloads
must remain private.

### K. Dependency-ordered implementation milestones

Produce small, independently reviewable milestones.

For every milestone include:

- purpose;
- exact modules;
- schema impact;
- product effect;
- tests;
- compatibility;
- rollout gate;
- rollback strategy;
- founder decision, if any.

Do not produce one giant implementation batch.

### L. Cutover and deletion plan

Cover:

- feature flag;
- cohort targeting;
- new sessions;
- existing drafts;
- deep links;
- browser history;
- deploy skew;
- cache compatibility;
- founder dogfood;
- production rollout;
- old UI retirement;
- deletion of superseded stores, routes and components.

The end state must not contain two permanent Casting Studios.

### M. Test strategy

Include:

- unit tests;
- source/contract guards only where appropriate;
- behavioral route tests;
- disposable-MySQL tests;
- concurrency tests;
- provider-adapter contract tests;
- billing/idempotency tests;
- browser tests;
- accessibility;
- theme parity;
- founder verification;
- production smoke;
- rollback gates.

### N. R7 reconciliation

State:

- which current R7 foundations remain;
- which R7 UI work is superseded;
- whether any R7 correctness work genuinely blocks V2;
- what should not be rebuilt;
- what must be documented as abandoned after the rollback.

### O. Founder decisions

End with a compact section titled:

`Founder decisions required before implementation`

Include only decisions that cannot safely be inferred.

Do not include questions whose answers are already settled in this prompt.

## 13. Explicit anti-patterns

Do not recommend:

- one giant rewrite commit;
- eight client-side generation calls;
- eight draft models;
- client-only roll state;
- grid-index candidate identity;
- implicit negative learning from Discard;
- free provider previews;
- auto-spend on mount or selection;
- waiting for all candidates before showing any;
- exposing engine selection;
- exposing raw master prompts or technical JSON;
- trusting candidate IDs as authority;
- using prompt compliance as the only identity-retention check;
- silent creative-engine fallback for failed identity-preserving edits;
- leaving the old and new studios permanently alive;
- polishing the obsolete cockpit before replacing it;
- reviving the reverted custom computer-vision projection subsystem;
- forcing every character into a photoreal-human schema;
- claiming unsupported downstream capabilities.

## 14. Final instruction

Be decisive and evidence-backed.

Prefer the strongest durable construction that preserves the settled
low-friction experience.

Do not implement anything.

The founder will review and ratify this architecture before implementation
begins.
