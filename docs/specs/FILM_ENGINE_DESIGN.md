# The Film Engine — design draft

**Status: discussion draft with the founder (2026-08-24). Nothing scheduled,
nothing built.** Written to the founder's framing: assume the casting studio
is FINISHED (signed casts with custom voices, takes, drift locks, composite
cards) and the Canvas EXISTS. This document designs what happens between
"cast her in a campaign" and a film assembling on the canvas.

**Evidence base:** the ZEPHYR research (`research/zephyr-teardown/`), including
the makers' own briefs — whose pipeline ran on **Claude skills** (an acting
system + CINEDANCE, their video-prompt writer + a diagram skill). This engine
is that pipeline, productised. We are not inventing; we are automating a
proven method and improving it where the research found their gaps.

**Scope note (founder):** casting into a campaign is not only film — UGC ads,
statics, anything. §8 shows how the same entry flow degrades gracefully to
those; everything else here is the film path, because that is what was
researched.

---

## 1. The user experience, end to end

### 1a. The casting call (the modal — kept deliberately small)

From a signed Cast (or from the campaign surface): **"Cast in a campaign."**
A modal opens — but the research warns against front-loading detail. Their
scene documents prove ordinary people can answer six plain questions; a modal
asking thirty is prompt-artistry re-imposed. So the modal collects only what
a producer needs to open a production:

1. **What kind of campaign?** Film / UGC ad / static / … (film path below).
2. **The story.** A logline, a paste-in script, or *"help me write it"*
   (opens a chat with the Writer skill).
3. **Who else is in it?** Multi-select from the cast roster. Each cast
   arrives with everything the studio already holds: composite card (sacred
   face), voice asset + `Voice:` style line, drift locks, outfit cards.
4. **The look.** A style profile picker — presets from the research corpus
   ("Large-format naturalism", "Punk MV high-key", "Anime-action") or
   *"derive from my description."* One profile per production; their
   most-repeated style block ran 1,958 times unchanged, so this is a saved
   setting, not per-shot authoring.
5. **Format.** Target length, aspect.

Submit → a **Production** is created and the user lands on the Canvas.
Everything else is asked progressively, in context, on the canvas — never in
the modal. (Their own lesson: the scene document is answerable by a
non-director *when the questions arrive scene by scene*.)

### 1b. The canvas as the studio

The canvas is the set, the whiteboard and the editing room at once:

```
PRODUCTION (canvas)
 ├─ Script rail        — the story, broken into SCENE CARDS
 ├─ Asset shelf        — THIS PRODUCTION'S call sheet, not the library:
 │                        CAST (one tile per person; outfit/state cards nest
 │                        inside, pulled lazily as scenes need them — takes
 │                        are output, never shelf assets), LOCATIONS, PROPS,
 │                        DIAGRAMS (filed under their scene), and AUDIO —
 │                        music tracks and PROMOTED PERFORMANCE ANCHORS (a
 │                        starred take's audio fed back as reference, their
 │                        716-reuse pattern). A track attaches to a scene in
 │                        one of two modes: AUDIBLE (plays throughout,
 │                        lip-synced) or TIMING ONLY (the unheard-metronome
 │                        lane; real music laid under the cut in post). The
 │                        cast's voice lives inside her cast tile; per-line
 │                        dialogue clips file under their shot; foley is
 │                        prompt-written, not a file. Research scale: nine
 │                        audio files served an entire production. Populated by
 │                        the Line Producer from scene docs as GAP TILES
 │                        ("The case — needed by SC 3 · Mint / Upload /
 │                        Pick"), resolved not authored. Research scale: a
 │                        whole film ran on 54 refs; the Special's registry
 │                        held 33 entries. Shelves are small by design.
 ├─ Scene groups       — each scene: its document + its SHOT NODES
 │    └─ Shot node     — opens to a TAKES fan (contact sheet); starred = keeper
 └─ Cut strip          — keepers in scene order = the rough cut, assembling
                         itself as a side effect of starring favourites
```

Every shot node is **an island** — independently regenerable forever, because
(their words) *"'same as the previous shot' is an instruction to a model that
has no 'before'."* Nothing on the canvas depends on any other node's output;
continuity rides the assets, exactly as researched.

---

## 2. The pipeline the engine runs (their pipeline, automated)

### Phase A — Development (before anything is generated)

*"A weak scene costs real money: you find out it doesn't work only after
you've generated it."* — so the engine does what their team did by argument:

- The **Writer skill** turns the story into scenes, each with the six-field
  scene document: `who_and_where / what_happens / tone / what_we_read /
  what_we_do_not_show / purpose`.
- A **dramaturgy pass** challenges every scene: what is the event, what does
  the character want, where is the turn? Scenes that fail are flagged to the
  user *before* credits are spent.
- Output: scene cards on the canvas, editable in plain English.

### Phase A-2 — How scenes are generated and what is editable (founder Q, 2026-08-24)

Three story inputs, one convergent flow:
- **Full script pasted** -> the Writer PARSES, never invents: scenes split at
  location/time changes, each six-field document DISTILLED from the user's
  own text (read-back pattern at production scale; the script stays visible
  and untouched as "your script").
- **Logline** -> the Writer PROPOSES a scene list; it passes through the same
  approve/edit/delete/reorder screen as the shot list. Nothing below a scene
  exists until approved.
- **"Help me write it"** -> conversation ending in the same proposed list.

Editability: everything, each at its level, and edits flow DOWNSTREAM only.
Editing the script after scenes exist never silently rewrites them — affected
scenes flag "script changed — may be stale" and the user chooses to refresh
(island principle + money safety). Scene-doc corrections feed the NEXT shot
proposal, never drawn takes.

### Phase B-0 — How required assets are determined (the Line Producer's test)

Not every noun becomes an asset — the pros shelved ~10 props out of
everything on screen; scene dressing lived in prompts. An object becomes a
GAP TILE only when **drift between shots would hurt**, detected as any of:
1. a character handles it and action depends on it (the lemonade glass);
2. it appears across multiple shots/scenes (continuity risk);
3. it is deliberately withheld ("stays out of frame until SC 4" in
   what_we_do_not_show — the strongest signal: you cannot withhold an
   undefined object);
4. it carries story weight by name in the script.
Everything else stays prompt-described. Gap tiles SHOW THEIR REASONING (click
-> the script lines that triggered them) and the user ratifies: dismiss
("does not need a card") or promote any mentioned object. Detect-then-ratify,
the drift-lock shape. Cast and locations extract the same way: named person
-> cast gap tile; distinct setting -> location tile.

### Phase B — Pre-production (assets first, then nothing else moves)

Their law: *"Not a single shot until every character, location and prop is
built, named and locked."*

- **Asset checklist derived** from the scene documents (`who_and_where` names
  the people and places; `what_happens` names the props).
- **Casts resolve from the studio**: the composite card (face = the same
  untouched pixels everywhere — their sacred-pixels rule is already how a
  signed Cast works), outfit cards minted on demand via wardrobe composition
  where a scene's wardrobe differs, drift locks attached.
- **Locations minted**: a reference frame per location (one image the whole
  production leans on for grade and light), with **visual anchors planted**
  (the chair, the window — their trick for holding scenes steady).
- **Blocking diagrams** generated per multi-character scene (their Diagram
  Skill: top-down, colour-coded positions and facings, camera cone), scoped
  *"layout only, overlays never drawn."*
- **Depth maps** minted for space-critical scenes (their tool for stopping
  the room rearranging itself).
- All ids derived, never typed (their registry drifted; ours must not).

### Phase B-1 — State flips at story events (founder walkthrough, 2026-08-25)

Asset states are not just picked per scene — they FLIP at story events, and
the flip is automatic downstream. The rooftop example: "they are talking when
the building across the street explodes" -> shots before the event inherit
the location's INTACT state; the event shot renders the explosion; every shot
AFTER automatically inherits the BURNING state (smoke in the skyline, orange
glow). A later shot cannot accidentally show the healthy building, because
that state no longer exists past the event in this scene's timeline. Same
mechanism as the pros' Tank / Tank (injured) cards, made automatic: the
Writer marks the event in the beat order, the Line Producer mints the after
state as a nested state card, and inheritance switches at the boundary. The
user sees it as a state chip on the scene timeline and can override it like
any other inheritance.

What makes a multi-shot event seamless, stated for the record (the four
glues, none requiring shots to know about each other): same world cards in
every shot; the state flip at the event; SOUND carried across the cuts (the
boom starts before the cut, debris rumbles under the reactions); and shared
eyelines from the blocking map (everyone looks toward the event, light from
that side). This is how physical film does it too — the engine simply does
the gluing automatically.

### Phase C — Production (shots and takes)

Per shot node, the engine assembles the prompt with the **DP skill** — our
CINEDANCE — in the proven block order:

```
SCENE CONTEXT → ACTIVE REFERENCES (scoped per asset) → LOCATION MAP →
GAZE/EYELINES → FIRST FRAME AND BLOCKING → SEGMENTS (timed beats) →
DIALOGUE → AUDIO → PHYSICS → LIGHTING → STYLE/FORMAT → POSITIVE LOCKS
```

…with the craft applied automatically (the 40-technique playbook): the
style profile, per-kind reference scopes, drift locks, the graded handheld
scale, numeric framing, causal physics, the emotion fences, countable events,
held endings, hard cuts. Failure-mode bans go to the **negative field**, and
the prompt body stays positive — their matured rule: *"the words you write
are the words you summon, including the ones sitting inside a 'no'."*

- The **Acting skill** converts each cast's personality + `Voice:` line into
  renderable behaviour per beat (their acting system: *"decides what exactly
  I play in a shot"*), calibrated baseline-plus-exception.
- **Takes**: each generation buys a fan (default 4) into the shot node's
  contact sheet; the user stars keepers by eye; unstarred takes sweep on
  retention. Median-5-to-a-keeper is the planning number; rewording is a new
  setup, never a hidden mutation.
- **Dialogue audio**: the cast's custom voice generates the line as a clip;
  the clip is attached *"plays throughout, lip-synced"* — their proven
  716-reuse delivery lane, now with true per-cast voice identity they never
  had. (Whether every line needs the clip or description suffices for
  background lines: `OPEN_TEST_voice-clips-vs-descriptions.md` decides the
  default.)
- **Music**: an attached track as the timing metronome where performance
  matters (their unheard-87-BPM trick), real music laid under the cut in post.

### Phase D — Post (the canvas cut)

**Surface note (2026-09-02, from the skeleton mockups):** Phase D has its own
view — the **COMPOSER** (player + story-order timeline with dashed
not-yet-kept segments + audio rows + "intended vs kept" runtime). The
skeleton promoted the cut strip to a full third tab beside Wall and Desk,
and the research supports it (post was a named stage; "half the work is
editing"). Adopted. See `CINEMA_SKELETON_MARRIAGE_REVIEW.md`.

- Keepers assemble in the **cut strip** in scene order — the rough cut exists
  the moment picking does.
- **Generation supervision** (their named QC stage): the engine flags weak
  shots — coverage holes, continuity misses — for re-takes.
- **Picture lock**: the user locks the cut; after lock, no new generations
  except flagged emergencies (their rule, adopted verbatim).
- Export; grade unification is a later concern (their colourist's job was
  unifying neighbouring shots — a future automated pass).

---

## 3. The skills roster (the founder's stated end-goal, now their proven shape)

Higgsfield ran this with two skills plus a diagram tool. Drape's roster,
mapped to the pipeline:

| Skill | Their analogue | Job |
|---|---|---|
| **The Writer** | (human writing + "brainstorm with Claude") | story → scene documents; dramaturgy pass |
| **The Line Producer** | (manual) | scene docs → asset checklist → minting orders |
| **The DP** | **CINEDANCE** | scene doc + assets → the 12-block shot prompt, craft applied |
| **The Acting Coach** | their acting system | personality + voice line → per-beat behaviour |
| **The Stager** | their Diagram Skill | blocking diagrams + depth maps from location assets |
| **The Editor** | (manual post) | cut assembly, QC flags, coverage-hole detection |

The 40-technique playbook, the clause catalogue, and the makers' rules are
the training material these skills encode. That corpus already exists in
`research/zephyr-teardown/` — the skills are its executable form.

---

## 4. What the casting studio must hand this engine (the interface)

Assumed finished, per the founder. The engine consumes:

- **The composite card** — one attachment per cast, sacred-pixels face panel.
- **Outfit/state cards** on demand (person × garment; the D-62 fork decides
  where they live, not whether the engine consumes them).
- **The voice asset** + `Voice:` style line.
- **Drift locks** (emitted into every unmentioned-slot render; explicit asks
  win).
- **Takes machinery** (fans, keepers, retention, per-slice billing) — the
  film engine calls it per shot node rather than reimplementing it.

Nothing else. The casting studio never needs to know a film exists; the
engine composes what the studio already sells.

---

## 5. What we do better than the studio we studied

Improvements the research licenses, not speculation:

1. **True voice identity** — they faked voices with masking; casts bring real
   ones. Dialogue scenes stop needing sloppiness, one-speaker-per-shot and
   non-verbal lanes as *workarounds* (they remain available as styles).
2. **Derived asset ids** — their registry drifted (`Sheet_MIRA`/`Sheet_mira`)
  within weeks; ours cannot.
3. **Drift locks captured semi-automatically** — they hand-typed "BROWN eyes
   (never blue/green)"; we detect the repeated correction and offer the lock.
4. **The reroll economics stated up front** — fans priced honestly around
   median-5; they learned it by spending.
5. **The scene document as the actual UI** — they wrote them by hand inside
   prompts; our users fill six labelled fields and never see a prompt.

## 5b. The control ladder — the form is the default, never the limit (founder challenge, 2026-08-24)

The founder asked whether the scene-document interface takes control away:
what if the prompt needs altering, or the director has a specific action in
mind? Answer, pinned: **control is layered, not removed.**

- **Level 0 — the six fields.** The engine writes everything.
- **Level 1 — director controls, presented as a NOTES flow (superseded from
  a field form, 2026-08-25, after the founder found five open fields
  confusing).** Under the takes: three actions — Keep, More takes, **Give a
  note**. A note is one plain-text box spoken like a director between takes
  ("she keeps looking at camera — she never should"); the engine FILES it
  into the right structured slot and shows the filing as a removable chip
  with its slot label (DON'T SHOW · looks at camera ×). The five fields
  remain as the filing system underneath, reachable via a muted link — where
  notes land, never a form the user faces. Same detect-file-ratify shape as
  drift locks and the read-backs. An escalation helper appears when a fan
  disappoints: more takes first (often luck), a note if the same thing keeps
  failing, Edit setup if the ingredients are wrong.
- **Level 1 detail — director controls, in director language.** The precision the
  pros used when they wanted it — timed beats ("0-2s: she reaches for the
  case"), first-frame placement, gaze, don't-show, locks — exposed as
  structured FIELDS on the shot card. A specific action or cut is written
  here in plain sentences with timestamps, exactly as the studied crews wrote
  it, never as prompt syntax. The shot list is proposals: approve, edit,
  delete, add by hand. The cut strip reorders freely.
- **Level 2 — the assembled prompt, visible always, editable on demand.**
  Every shot node carries a drawer showing the FULL prompt the engine wrote
  (transparency, and it teaches). Editing it starts a NEW setup (the takes
  law: tweaks and re-rolls never blur) and shows a diff of engine-text vs
  user-text, with the offer to keep the change as a standing rule for the
  scene — the drift-lock idea applied to prompts.
- **Level 3 — blank page.** Full prompt authorship for power users.

**The failing-shot flow leads with the levers that measurably work.** The
research showed rewording rarely fixes a failing setup; changing the INPUT
does (the inverted-sheet lesson). So when takes keep missing, the UI offers,
in order: swap/fix the reference -> add a blocking diagram -> harden a lock ->
edit the prompt. The prompt editor is always available and deliberately
fourth.

## 5c. Design-review amendments (Opus designer rebuttal, adjudicated 2026-08-24)

Five rebuttals from the prototype build, adjudicated against the research;
four accepted, one split:

1. **The Wall is a reading surface only.** Health map, hover-preview, drag
   between lanes, click-through to Desk. No starring or re-rolling on the
   Wall — the research shows curation happened at contact-sheet density and
   organization in folders: two modes, never a hybrid.
2. **Authoring is inverted: one line first, fields as corrections.** The
   measured practice is accretion — their setups grew precision AFTER seeing
   takes (the choke scene's purpose string gaining "+directed eyelines"),
   and their own brief chose "less strict prompting… key anchor points"
   then harvested. Flow: one-line scene -> proposed shots -> first takes ->
   the eleven fields arrive PRE-FILLED from the model's inferences, edited
   rather than authored. The dramaturgy check survives as an advisory chip
   ("this scene has no turn"), never a gate.
3. **Accent carries two states**: generating (pulse — transient and urgent)
   and keeper (solid underline — permanent and quiet). Idle is colourless.
4. **The wait is designed.** Takes run 30–90s+; casting's supervised-wait
   language (distribution and marker) ports to take cards, with lane-level
   aggregates for shots mid-generation.
5. **Continuity is structural, not prose.** The pros wrote LOCKS as text
   because their platform had no mechanism; identity in their system rode the
   attached assets. Drape has the mechanism: the signed Cast's card and drift
   locks are INHERITED by every shot as a hard constraint (an identity-locked
   badge, not editable text). The LOCKS field becomes "Staging locks",
   scoped to shot-specific rules only.

**Vocabulary — RULED (founder, 2026-09-01): keep it as it is.** The two-noun
recommendation is REVERSED. Words are scoped per surface by design: the
casting page speaks **candidates** (rolling) and **versions** (editing);
**takes** and **frames** are cinema-page words. Casts are a standalone
primitive consumed by many surfaces — cinema is one of them — so each
surface keeps its own language.

## 6. What we deliberately do NOT build

- **Shot-to-shot memory / frame handoffs** — measured across 23,809 jobs:
  never used, and rerolls would break it. Islands + assets + hard cuts.
- **A prompt editor as the PRIMARY surface** — the scene document leads; the
  full control ladder (§5b) keeps the prompt visible always and editable on
  demand, so nothing is hidden, but prompt syntax is never the price of
  entry.
- **Automatic keeper selection** — the eye picks; telemetry measures cost
  only (law 9).

## 7. Economics (planning numbers, from the research)

- ~5 takes median per keeper shot; p95 ~34. A 60-shot short ≈ 300–500
  video generations plus asset minting. Price the *production*, not the shot
  fantasy.
- Asset minting is cheap and front-loaded (their glass: one mint, 349 reuses).
- Dialogue clips add a per-line voice-generation cost — the voice test
  decides how often it's needed.

## 8. Non-film campaigns (the same door, shorter corridors)

The modal's first question routes:

- **Static ad / image** — one scene document, one shot node, image engines,
  takes fan, no cut strip. (The scene doc degrades cleanly: a static is a
  shot with no duration.)
- **UGC ad** — one to three shot nodes, talking-head acting profile, the
  voice clip lane doing the heavy lifting.
- **Film** — everything above.

One entry flow, one asset system, one takes mechanic; only the pipeline
length differs. The casting studio's product ("a cast that works everywhere")
is exactly this door.

## 9. Founder gates

1. The surface. Discussed with the founder 2026-08-24: his instinct is the
   canvas for the bird's-eye overlook; the recommendation on the table is a
   **dedicated cinematic-studio surface built ON canvas technology, with two
   views over one Production** — the WALL (canvas-tech bird's-eye: every
   scene, shot, take and asset spatially, where curation and review happen —
   validated by the research: picking 275 keepers from 18,900 generations was
   their central activity, and their flat folders failed them at exactly this)
   and the DESK (structured editors: script rail, scene document, takes
   contact sheet, reorderable cut strip — because a film's spine is ordered
   and half the work is editing, not arranging). Evidence for dedicated over
   generic: the studied studio built its own Cinema Studio surface rather
   than using its boards product, and their standout-scene lesson means
   creation order ≠ cut order permanently, so the cut must be a strip
   independent of any board layout. Not yet decided — needs the Canvas
   team's shape.
2. Pricing model for productions (§7).
3. D-62: where outfit/state cards live.
4. The two deferred tests (baked text; voice clips vs descriptions) — their
   outcomes set two engine defaults.
5. Skills roster scope for v1 — Writer+DP+Stager is a plausible minimum;
   Acting Coach and Editor can start as parts of the DP.
6. **RULED (founder, 2026-09-02: "agreed"): thinking free, rendering
   paid.** Proposals, read-backs and script development are free; credits
   are spent where frames are drawn (the take fan). The Desk's "free"
   button copy stands; every paid button states its price.

---

*Companion documents: `research/zephyr-teardown/MAKERS-BRIEFS.md` (their
pipeline, verbatim), `THE-CRAFT-PLAYBOOK.md` (the 40 techniques the DP skill
encodes), `DRAPE-IMPLEMENTATION-SPEC.md` (data model detail),
`CASTING_TAKES_DESIGN.md` (the takes mechanic this engine calls).*
