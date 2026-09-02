# The Script Room — design

**Status: founder-directed design (2026-09-01), written to be folded into the
Cinema surface. Nothing scheduled, nothing built.** The founder's brief: a
feature that helps users write short-film scripts, suggests camera angles per
scene, shows which characters / locations / props the script requires, and
supports continuous development — from short film up to a full feature.

**Evidence base:** the ZEPHYR research (`research/zephyr-teardown/`), whose
makers' own conclusion frames this whole surface: *"Direct, don't describe.
The scene event, the motive, the goal, the obstacle, the tactic — directing is
the one part the model still won't invent for you."* The Script Room is where
Drape helps the user do that one part, and it is deliberately placed where
their other law bites hardest: *"a weak scene costs real money — you find out
it doesn't work only after you've generated it."* Writing is the only free
stage of filmmaking; this room front-loads all the thinking into it.

**Relationship to the rest:** sits in front of `FILM_ENGINE_DESIGN.md`'s
Production (Wall / Desk). The script is the **single source of truth**;
scenes, shot lists, the shelf manifest and the budget are all derived views.
How it mounts into the Cinema page (third view toggle vs pre-production
surface) is the fold-in decision the founder will make with the design agent —
this document is surface-agnostic on that one point and opinionated on
everything else.

---

## 1. One script, two synced views

Writers think in prose; engines eat structure. The room holds both, always in
sync — edit either, the other updates:

- **The Page** — the script as a screenplay-style document. Type freely,
  paste a draft, or write in conversation with the Writer skill. Sluglines,
  action lines and dialogue are recognised but never required — plain prose
  parses too.
- **The Cards** — the same script as scene cards in act/sequence order, each
  carrying the six-field scene document underneath (who & where / what
  happens / tone / what the viewer should read / what we don't show /
  purpose), distilled from the user's own text on the read-back pattern:
  derived, shown, correctable — never invented over their head.

Three entry paths, converging: paste a script (the Writer parses, never
invents), give a logline (the Writer proposes a scene list through the same
approve/edit/delete screen as shot lists), or "help me write it" (a
conversation ending in that same proposed list).

## 2. The script critiques itself while you write

The dramaturgy pass runs **continuously during writing**, not as a gate at
the end — advisory always, blocking never:

- **Per scene:** what is the event, what does the character want, where is
  the turn. A scene missing one gets a quiet chip ("no turn in this scene"),
  the same "WORTH A LOOK" treatment already designed on the Desk.
- **Per act:** the studied crews' proven structure — *"design a standout
  scene and build the surrounding edit toward that culmination"* — becomes a
  standing prompt: *"which scene is your centrepiece?"* The room flags an act
  with no peak.
- **Pacing read:** scene-length rhythm, dialogue-vs-action balance, repeated
  settings back to back ("three kitchen scenes in a row").

## 3. The live manifest — the script's requirements, derived while typing

A persistent rail that fills itself in as the script grows. This is the
casting call and the shopping list as a side effect of writing, and it is the
Line Producer's logic (`FILM_ENGINE_DESIGN.md` Phase B-0) running early:

- **Characters** — every named person, with a presence map (which scenes,
  rough line counts) and a **wardrobe timeline** derived from the text
  ("grey coat SC 1–4, gown SC 9" — the nested state cards, pre-planned).
  Each row links to the casting studio: *"cast this role"* (pick a signed
  Cast) or shows as a gap. A cast's personality and `Voice:` fields ride in
  with her, and the room can suggest casting *against* the script's own
  character description.
- **Locations** — every distinct setting, **with state flips detected from
  story events**: *"The rooftop: intact SC 1–2 → burning from SC 3."* The
  room knows the building cannot un-explode before production ever exists.
- **Props** — only what passes the drift-would-hurt test: handled and
  action-dependent, recurring across shots/scenes, deliberately withheld
  (the strongest signal — `what we don't show` names it), or story-weighted
  by name. Everything else stays prompt-described scene dressing.
- **Reasoning is visible, the user ratifies:** every manifest row can show
  the script lines that summoned it; dismiss ("doesn't need a card") or
  promote any mentioned object. Detect-then-ratify, the drift-lock shape.

When the script goes to production, the shelf arrives **pre-populated** —
identities, nested states, and gap tiles already named.

## 4. Coverage suggestions per scene — the beat taxonomy

The corpus's scene types each carry a *measured* coverage grammar. The Writer
tags each scene's beat type; the DP proposes a **coverage strip** under the
scene card — suggested shots with size, angle and move in director language,
through the same approve/edit/delete flow as every proposal:

| Beat type | Suggested coverage (from the corpus) |
|---|---|
| Dialogue (two-hander) | CU per speaker + a two-shot + reaction cutaways; one speaker per shot; eyelines from the blocking map |
| Ensemble / group | Roaming long lens (~34° FOV) with per-character detail zooms; scattered depth staging, never a line-up |
| Action | The camera itinerary: numbered legs, per-segment lens locks, at most one slow-mo accent |
| Quiet / establishing | Wide with negative space, near-locked handheld; "no empty establishing frame" — open on the subject |
| Suspense | Cross-cut grammar: watcher → watched → trigger → payoff; cause and effect never share a frame; sound bridges the cuts |

Per-character operator moves are varied automatically (orbit for one, push-in
for the next) so coverage never reads repetitive — straight from the
playbook's technique #4/#38 family. Suggestions are written as director
language ("low 3/4, looking up at her"), never lens jargon; the jargon lives
in the assembled prompt where it belongs.

## 5. Continuous development — safe edits, downstream only

The script versions like code. Edit anything at any time; changes flow
**downstream only**:

- A rewritten scene flags its derived shot list — and any drawn takes — as
  *"script changed — may be stale."* Nothing regenerates silently (islands +
  money safety, unchanged from the film engine spec).
- The manifest updates live: a character written out of SC 4 loses that
  presence cell; a new prop mention appears as an unratified row.
- Scenes can go to production early while the rest of the script is still
  being written; script and production stay linked and neither can wreck the
  other.

## 6. Short film → feature: same machine, honest arithmetic

Structure scales without change: acts → sequences → scenes → shots. What
changes is quantity, and the room says it plainly with a **running budget
line** as the script grows: *"current script: ~74 shots · est. 2,900–4,400
cr"* (from the measured planning numbers: median ~5 takes per keeper, fans
of 4). A feature becomes **one script, several productions** (per act or
sequence) sharing one manifest and one cast roster — which the identity
system supports for free, since the same casts and location cards ride into
every production untouched. Nobody discovers the cost after writing the epic.

## 7. What the room deliberately does not do

- **No gates.** Dramaturgy, pacing and budget are advice chips; the user can
  always write and always proceed.
- **No silent rewrites of drawn work.** Ever.
- **No auto-casting.** The room suggests; the user casts (law 9 shape: the
  eye decides).
- **No prompt language on the surface.** Coverage suggestions are director
  words; the assembled prompt stays in the shot view's receipt drawer.

## 8. Fold-in question for the Cinema page (open, founder + design agent)

The prototype already carries a three-way toggle (Wall / Desk / Composer).
Options, with a recommendation:

- **A (recommended): the Script Room is the third view** — Script / Wall /
  Desk — one Production, three lenses, matching the existing toggle pattern.
  The manifest rail becomes the Shelf's upstream twin (same tiles, earlier
  stage), so the vocabulary stays one system.
- **B: a pre-production surface before a Production exists**, handing off on
  "Start production." Cleaner separation, but it breaks the one-Production
  mental model and duplicates navigation.

Recommendation is A because the research's deepest structural fact — script,
scenes, shots, takes, cut are one derivation chain — argues for one surface
with lenses, not two surfaces with a hand-off.

## 9. Founder gates — RULED 2026-09-01

1. **The fold-in: THIRD TAB.** Ruled by the founder: the Script Room is the
   third view beside Wall and Desk (option A). One Production, three lenses.
   ⚠ **Seating collision found 2026-09-02 (marriage review): the skeleton's
   third tab is already the COMPOSER**, and the Desk's left rail is already
   headed SCRIPT. The ruling's intent (a peer lens) needs a seat.
   **Resolved as a founder LEANING (2026-09-02 — his words: "i guess? not
   sure"), shape confirmed, seat provisional:** four tabs; the **Script tab
   is the dedicated development room** and the **Desk is where the script
   has automatically become scenes**. The main road bypasses the Script tab
   entirely: the script is uploaded on entering the studio, the AI splits it
   into scenes, and the user lands on the Desk with takes ready to draw —
   his described intent, verbatim: "you uploaded your script on entering
   the studio and ai looked at the script and split it up into different
   scenes in which you can generate takes for them." The Script tab serves
   the other two entries (develop from an idea; keep rewriting
   mid-production with downstream staleness flags). Ratify the seat when
   the full skeleton brief is reviewed.
2. **Writing assistance USES CREDITS — SCOPED 2026-09-02 (founder:
   "agreed"): thinking free, rendering paid.** Script help, scene
   proposals, read-backs and dramaturgy are free (text calls, cents);
   credits are spent where frames are drawn — the take fan is the billing
   unit. The Desk's "Propose more shots · free" button is correct as drawn;
   the paid side states its price on the button ("4 more takes · 24 cr").
3. Feature-length productions (one per act vs one long): **still open** — the
   founder has no lean yet; decide when canvas performance is measurable.

---

*Companions: `FILM_ENGINE_DESIGN.md` (the Production this feeds),
`CASTING_TAKES_DESIGN.md` (the takes mechanic), `research/zephyr-teardown/`
(all measured claims; the beat taxonomy from `THE-CRAFT-PLAYBOOK.md` and the
scene-document fields from the makers' own CINEDANCE block order).*
