# Runway × Higgsfield × Drape Cinema — workflow analysis

**Status: founder-ordered competitive research (2026-09-03).** Two research
agents read the current official docs the same day (Runway: product pages +
help-center articles, Gen-4.5 era, Agent/Aleph 2/Edit Studio/Story Panels/
Workflows; Higgsfield: Cinema Studio 4.0 pages, camera-controls, Soul ID,
Popcorn, Elements, credits help). Full agent reports summarised here;
uncertainty was marked in the source reports where fetches were blocked.

## The verdict in one sentence

**Neither competitor has a film as a first-class object — both sell
generation tools and leave the FILM to the user's head or an external
editor — and that is exactly the axis our whole design occupies.**

## Where we win structurally (not cosmetically)

1. **The production container.** Runway's own docs, on real films: *"For
   longer films or projects requiring advanced editing features, consider a
   local video editor."* Higgsfield's recommended short-film pipeline hops
   four tools (Soul ID training → Popcorn storyboard → Cinema Studio shots →
   external assembly) with shot order "held in memory" by their chat agent.
   Ours: one Production, four lenses (Script/Wall/Desk/Composer), script →
   scene → shot → take → cut as one derivation chain. Nobody else has it.
2. **Coverage arithmetic.** "4 of 10 covered", "0:41 intended · 0:21 kept",
   holes shown as dashed clips — no equivalent anywhere in either product.
   Both can only show what exists; ours shows what the film is meant to be.
3. **The derived manifest.** Their consistency systems are user-operated
   (tag a reference, train a Soul, type @name). Our shelf DERIVES the cast/
   location/prop requirements from the script and presents gaps with
   reasons. Their users file; ours ratify.
4. **Structural continuity.** Runway: consistency is documented as craft
   ("change one variable at a time", 3-reference cap, last-frame chaining).
   Higgsfield: honest about Soul ID being "clearly the same person rather
   than pixel-identical." Ours: the signed cast's sacred-pixels card +
   inherited locks as badges — identity is a guarantee sold by the casting
   studio, not a technique the user practices.
5. **No prompt syntax at the front door.** Runway teaches prompt grammar
   ("The camera [motion] as the subject [action]"; positive-phrasing rules).
   Higgsfield's presets became prompt tokens. Ours: six plain fields and
   notes; the grammar lives in the engine (which is how the best studio on
   the studied corpus actually worked — via Claude skills).
6. **Casting economics.** Soul ID fronts a 20–80-photo training step before
   a novice sees anything. A signed Drape cast is ready the moment it's
   cast, and works across every surface.

## Where they are at parity or ahead — and what we take

1. **TAKE — image-before-video spend gating.** BOTH competitors put a cheap
   still step before expensive video: Runway's Aleph previews an edit as an
   image before the video is generated; Higgsfield's Popcorn storyboards a
   scene as 4–8 frames before Cinema Studio shoots it. The studied crew
   storyboarded too ("it becomes clear how good a scene really is, as
   opposed to how good it was in our heads"). Our skeleton's "first look"
   was one VIDEO take per shot. **Adopted: the first look becomes STILLS —
   the first frame of each approved shot, image-priced, judged on the
   contact sheet before any video is drawn.** Wrong reference, wrong
   blocking, wrong light all get caught at image cost. (12b §H amended.)
2. **TAKE — camera picked by eye.** Higgsfield's 50+ preset gallery with a
   looping preview per move is genuinely good vocabulary UX: nobody knows
   what "snorricam" means; everyone knows it when the loop plays. Our
   coverage proposals stay sentences (director language), but **when a user
   edits camera — the CAMERA direction slot, or a proposal's edit — they
   get a browsable gallery of move cards with looping previews, stackable
   in order.** Same pick-by-eye principle as our style cards. (12b §L.)
3. **Parity, theirs earlier:** price on the generate button (Higgsfield),
   automatic refunds on failure (Higgsfield), an editable outline as a
   spend gate (Runway Agent — ours is the proposal pattern, deeper), global
   style vs per-shot split (Higgsfield — ours inherited + overrides).
4. **Noted for later, not now:** Higgsfield's era-scrubber ("scrub the
   decade and the whole film regrades") is a post-pass restyle — our grade-
   unification future note gains a concrete shape. Runway's Act-Two
   (perform the shot yourself on webcam; the performance drives the
   character) is a direction input nobody else has — filed as a future
   note lane beside the casting Voice feature. Higgsfield's public
   projects with visible prompts are their best marketing (it is literally
   how this research was possible) — an "open project" toggle is a future
   product decision, founder's.
5. **Threat watch:** Higgsfield Cinema Studio 4.0 generates up to 30s with
   native audio and "Montage Pacing" — the model edits inside one
   generation. Long-clip engines (Seedance 3.0 class) compress multi-shot
   scenes into one generation. Our scene document maps onto that cleanly
   (the beats become the intra-clip cuts), and the islands design loses
   nothing — a scene that renders in one clip is just a shot with internal
   cuts. Already covered by the spec's Seedance-3 transferability note; no
   design change.

## What we do NOT copy, deliberately

- **@-syntax in prompts** (both have it). Our users do not write prompts;
  the manifest derives names from plain text, which is strictly less to
  learn. The insight behind @-names — one name, one identity, invoked
  everywhere — is our shelf tile.
- **Model pickers and version selectors** (Higgsfield's 2.0–4.0 switch,
  Runway's per-model credit table). Engine choice is the engine's problem.
- **Model-does-the-editing as the default** (Montage Pacing). The cut is
  the director's taste; ours assembles from keepers, not from a pacing
  dropdown — though long single generations remain available as a shot.

---

*Companions: `CINEMA_SKELETON_MARRIAGE_REVIEW.md` (the design this is held
against), `12b-cinema-amendments.md` in the design pack (§H amended, §L
added per the two takes above).*
