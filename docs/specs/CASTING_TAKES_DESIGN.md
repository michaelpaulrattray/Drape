# Takes — design brief

**Status: founder-endorsed design direction (2026-08-24), not yet a build
order.** The founder reviewed this design in conversation and asked for it
written down so the casting-studio build can be directed to it later. Nothing
here is scheduled; pricing and the scene hierarchy carry founder gates (§8).

**Where it sits:** takes are a **post-Sign** surface — the founder's own
placement: *"takes only happens once the cast is refined and been signed."*
Roll and refine are untouched by this document.

**Evidence base:** the ZEPHYR teardown, `research/zephyr-teardown/` — 23,810
production job records from two real AI films, every prompt read. The measured
findings and the design proposals are separated in §7, deliberately.

---

## 1. What a take is

> **A take is one more engine sample of an UNCHANGED setup.** Same cast, same
> references, same words, same parameters. The variation between takes is the
> engine's own — and that variation is the product, not a defect.

Not an edit. Not a version. A pull of the handle. The distinction is
structural, not conventional:

- Versions answer *"what did I ask for?"*
- Takes answer *"which sample of that ask?"*

Measured basis: of ZEPHYR's re-run prompts, **1,053 kept byte-identical input
vs 70 that changed anything**; the most-pulled setup ran **75 times unchanged**;
median **5 pulls to a keeper** (p95: 34). Three independent measurements show
rewriting the prompt does **not** reduce the pull count — so the product
absorbs the volume and prices it honestly rather than promising convergence.

Drape already owns the twin of this fact: the carry-noise-floor measurement
(same recipe twice → 0.0% vs 21.3% drift) is take-variance read as a
*verification problem*. Takes harvest the same variance as the *creative
spread the user chooses from*.

## 2. Data model

```
Project   — the work ("Summer campaign", "Episode 1")
 └─ Scene   — the situation: location, lighting, who is present, where they
 │            stand, scene-level overrides ("no horns in this scene")
 │   └─ Setup — ONE shot: framing, action, dialogue. FROZEN once first take
 │       │      is pulled. References the signed Cast(s) by id.
 │       └─ Take (1..N) — one engine sample of the Setup
 │            └─ Keeper (0..n) — a take starred by the user's eye
```

Rules:

- **The Setup is the unit; takes are its samples.** "More takes" re-submits
  the Setup untouched. **Changing anything mints a new Setup** — with
  everything carried over and pre-filled, so to the user it just feels like
  editing the prompt. The split exists for bookkeeping honesty: it keeps each
  wording's takes in its own pile, so "did my tweak help, or was that luck?"
  stays answerable. Engine variance is large enough to fool anyone otherwise.
- **Multi-keeper is legitimate.** One ZEPHYR setup yielded four keepers used
  as four separate shots. Never cap keepers at one.
- **Unpicked takes are swept** on the roll's `candidateRetention` pattern:
  keepers persist, the rest die with their retention window. Curation is the
  act.
- **Takes belong to the project, never to the cast.** The cast is the actor;
  takes are the footage. A cast's page may show a *derived* filmography
  ("used in 3 projects, 41 keepers") — computed, never stored as a second
  list (working law 4).
- **Inheritance down the ladder:** project holds the look; scene holds place,
  light, people, positions, and exceptions; setup holds only what is specific
  to this shot. A second shot added to a scene arrives ~90% pre-filled.
- **No forced ceremony:** shooting from a cast's own page files into a
  personal scratch project/scene. Structure available, never demanded.
- **Identifiers are derived, never typed.** ZEPHYR's hand-typed registry
  drifted to `Sheet_MIRA` beside `Sheet_mira` within seven weeks.

## 3. UX shape

- **Fan, not single-shot.** One submission buys a fan (default ~4) shown side
  by side as a contact sheet, with a cheap "4 more" gesture stacking into the
  same sheet. Median-5-to-a-keeper as a sequence of single rejections feels
  like failing five times; as a contact sheet it feels like choosing. Same
  odds, different product.
- **"More takes" and "edit the prompt" are visibly different actions.** One
  button must never do both.
- **The keeper is picked by eye** (law 9). Takes-to-keeper telemetry measures
  cost; no metric ever picks the keeper.
- **This is the roll's chassis, deliberately.** Per-slice billing, contact
  sheet, pick, sweep. It is NOT "refine again": a refine is structurally one
  image per ask and one winner per chain (D-121 — *"One unit, not eight
  slices"*), and both properties are wrong for takes.

## 4. Billing

Per-slice, like the roll: each take in a fan is an independently refundable
unit, so a mid-fan failure refunds only its slices (the deploy-collision
contract already guarantees exactly this behaviour). Price the fan around the
measured median of ~5 samples per keeper — **absorb the volume, price it
honestly, do not promise that clever prompting reduces it** (measured
three-for-three that it does not). Actual prices are a founder decision (§8).

## 5. What rides into every take — the cast side

- **The composite plate, not six files.** A generation's reference budget is
  3–4 attachments; the signed package travels as ONE composed sheet (the
  export `composeCharacterSheet` already builds — composed from bought views,
  never generated). Record the **digest** of the bytes actually sent, so
  "which sheet did this shoot against" stays answerable later.
- **Drift locks.** Per-cast rules recording what engines get wrong about her
  (*"BROWN eyes — never blue/green"*), emitted into every render where that
  feature is **unmentioned**. Key mechanics, founder-refined 2026-08-24:
  - **A lock guards silence; an explicit ask always beats it** — by
    construction, no unlocking step. Drift is an unasked change, so the lock
    is only emitted when the ask does not touch that slot.
  - After an explicit ask overrides a lock, one follow-up settles it: *"just
    this look"* (lock survives, this version varies) or *"update the rule."*
  - **Capture is detect-then-ratify:** the server detects the same
    correction-shaped ask twice on a never-edited slot (pure ask-history
    pattern, no vision reader) and OFFERS the lock; filing is the user's tap.
    Never auto-filed: law 9 forbids a reader's verdict silently becoming a
    permanent rule, and *context-is-not-additive* prices every emitted clause.
- **Outfit cards on demand, not at Sign.** A scene needing the cast in a
  different outfit mints a person×garment card once (the wardrobe/VTO
  composition) and reuses it — never re-described per shot. Ownership of that
  artifact is the D-62 fork (§8).

## 6. Instrumentation from day one

- **Takes-to-keeper per Setup.** ZEPHYR's median 5 is the external benchmark.
- Fan-size distribution actually purchased vs offered default.
- Both are census-lane facts, added with their reader in the same commit
  (collected-never-asserted).

## 7. Measured vs designed — read before building

**Measured at ZEPHYR (evidence in `research/zephyr-teardown/`):** the take
definition and its counts (§1); keepers curated into a separate pile;
multi-keeper from one setup; scene-level inheritance and scene-scoped
overrides; takes living with the production while characters live above it;
drift notes written on the character.

**Designed here, NOT in their data:** the explicit Project→Scene→Setup→Take
ladder as product structure (their folders were nearly flat — the structure
lived inside hand-written prompts); the side-by-side fan UX (their stills ran
batch-4, their video takes were pulled one at a time); detect-then-ratify and
ask-beats-lock (shaped by Drape's own laws, not their practice); the scratch
defaults. These are the parts deserving scrutiny before build.

**Transfer cautions (each with in-house evidence):** words-beside-picture is
per-feature-class (`slotWordsRefusal` measured the opposite for ink); no prompt
clause is appended without a controlled pair (*context-is-not-additive*: a
subset of context beat its superset); `PHOTOREAL_HUMAN_BLOCKS` already covers
part of the negative-stack ground — check overlap before adding anything.

## 8. Founder gates — CLOSED 2026-09-01, with a standing correction

⚠ **Architecture correction from the founder, recorded first because this
document repeatedly got it wrong: CASTS ARE A STANDALONE PRIMITIVE, THE
CINEMA STUDIO IS A SEPARATE FEATURE THAT MERELY CONSUMES THEM.** His words:
*"making a cast is its own feature, the cinema studio is its own feature —
it just happens to link to casts, but you could use casts technically
anywhere, not just in the cinema studio."* Takes are a CASTING-PAGE feature;
nothing about them presumes cinema.

1. **Pricing — already answered by the codebase** (founder): takes price on
   the same pattern as casting a character and refining one. No new decision;
   read the existing credit-cost modules at build time.
2. **Scope/home — already answered by the codebase**: the takes surface is
   the existing casting profile page (`client/src/pages/CastingRoom.tsx`),
   where a Takes section already exists as a drawn placeholder grid
   (`TAKE_PLACEHOLDERS`, "No takes yet", a "New takes" action). Building
   takes = replacing that stub, not choosing a new surface.
   **The VOICE feature follows the identical pattern** (founder, 2026-09-01,
   verified at the code): the same page carries a VOICE card stub — player
   skeleton at rest, "No voice yet", and its own promise line: *"A designed
   voice and an audition clip arrive with voice."* Voice is built into the
   casting studio/profile the same way takes is: replace the stub in place.
   The research's voice recommendation (the asset for identity + the `Voice:`
   text line for performance style, typed fallback when no recording exists)
   lands there.
   **PERSONALITY is the third planned casting feature** (founder, 2026-09-01)
   — no stub exists yet (verified: zero hits in `CastingRoom.tsx`). The
   research's shape for it: a plain-text personality line set on the cast
   (the studied sheets all carried one — *"Character: calm, spontaneous
   (awkward poses), slightly slouched posture, indifferent"*), stored as
   words, ridden into every video generation, and translated per shot into
   RENDERABLE BEHAVIOUR (posture, gaze, timing — never psychology adjectives
   alone; law 8's ontology). It is what makes a cast directable rather than
   merely consistent-looking, and the film engine's Acting skill consumes it
   directly.
3. **Vocabulary — RULED: keep it as it is.** The earlier two-noun
   recommendation is REVERSED. Words are scoped per surface by design:
   the casting page speaks **candidates** (rolling) and **versions**
   (editing); **takes** and **frames** belong to the cinema page. The
   surfaces are different products with their own languages.
4. **D-62** — ruled 2026-09-01: outfit cards live in Casting, for now
   (see gate 3's note above in this file's earlier section).

## 9. The name

**"Takes" is the recommended name, considered rather than defaulted** (founder
asked 2026-08-24). It names the act, not the object: "take two" universally
means *repetition without change*, which is precisely the semantics — and it
completes the actor vocabulary the studio already speaks (cast, casting, sign),
bringing its family for free: retake, "more takes", and **keeper**, which is
the film word for the take you keep. The one alternative weighed was
**"frames"** (the photographer's word, pairs with "contact sheet") — rejected
because it names the artifact rather than the act, and collides with video
frames the day film arrives.

## 10. Related documents

- `research/zephyr-teardown/CASTING-STUDIO-IMPLICATIONS.md` — the full mapping
  with all run counts and the sheet analysis.
- `research/zephyr-teardown/THE-FRAMEWORK.md` — the film framework in plain
  English.
- `research/zephyr-teardown/DRAPE-IMPLEMENTATION-SPEC.md` — the film-scale
  spec (scenes, shots, blocking); takes are its casting-studio-sized slice.
- `docs/specs/POST_SIGN_ROADMAP.md` — the canonical post-Sign roadmap. This
  document should be linked from there **when that file is not in flight**
  (another seat was editing it the day this was written).
