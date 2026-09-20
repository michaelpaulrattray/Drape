# 12b — Cinema: amendments and the Script view

Applies on top of `12-cinema.md`. **Where the two disagree, this file wins;
everything not named here stands exactly as written there.** Same vocabulary
discipline, same colour law, same structural rules (§10 of the base brief),
same definition of done.

Nine sections: A–H amend the base brief; §I adds a fourth view. §J
consolidates the new do-nots; §K slots the new work into the build order.

---

## A. Vocabulary — "version" leaves Cinema

§0's noun table changes: **take** and **setup** are the two generation
nouns. A note or a setup edit never re-renders a take — it starts a **new
setup**, and that setup's renders are new takes, numbered fresh. Delete
"version" from the table and sweep all copy.

Where a shot has had more than one setup, label takes `TAKE 03 · SETUP B`.
The prompt drawer's `Edit (starts a new setup)` already uses the right word
— extend it everywhere: `Save as a new setup · free`, "Edit setup starts a
fresh contact sheet", etc.

**Why:** "version" is already a load-bearing word on the casting surface,
where it means a saved edit state of a cast. Two surfaces must not share a
word for two different things, and the thing Cinema was calling a version
already has a name in its own system: a take under a new setup.

## B. The lock pill — a decision, not a readout

§1.6 changes direction. Do **not** derive lock from coverage.

- Full coverage makes the pill *available and suggested*: it gains a quiet
  ring and hover copy — *Every shot is covered. Lock the picture?*
- The user locks it deliberately (one click, one-line confirm).
- **While locked, every draw button in the production is disabled**, each
  reading `Picture locked — unlock to draw`. The three shot actions, the
  proposal footer, "first look" — all of them.
- Unlock is an explicit click with a one-line confirm. Lock state shows who
  and when on hover.

**Why:** people legitimately want more takes at full coverage, so coverage
cannot *be* the lock. And the lock's whole value is protecting a finished
cut and its budget from an accidental click — a lock that does not disable
drawing is a label, not a lock.

## C. The entry flow — New production (new; the base brief starts with a production already existing)

Design the empty state of the Cinema destination and the create flow.

**Three doors, one row of cards:**

1. **`I have a script`** — paste or upload. The main road.
2. **`I have an idea`** — one line ("a heist film where the thief is the
   detective's daughter").
3. **`Start blank`** — an empty production; the first scene gets written on
   the Desk (base brief §4b).

**The script road:** the system reads the script and answers back before
anything exists — *"Six scenes, two people, one apartment — reads as a
~2-minute short."* Then the **proposed scene list**, using exactly the §4c
proposal pattern one level up: proposed scene cards (name, one-line what,
who), approve / edit / delete / reorder, dashed until approved, nothing
below a scene exists until approved. Approve → land on the Desk with the
approved scenes in the rail.

**The idea road:** same, except the scene list is proposed from the line,
and one extra question first — length, as a single chip row: `~30s` ·
`1–2 min` · `5 min+`. Never a number field.

**The style step (both roads, after scenes are approved):** a card grid of
**actual rendered frames** — pick the look by eye. Each card: the frame,
a name (`Anamorphic, cold`), one meta line (`2.39:1 · 40mm · practical
light`). Beneath the grid, two escape hatches:

- **`Describe it`** — one sentence in ("like a 90s heist movie at night"),
  the derived profile read back as a card to confirm.
- **`Match this`** — upload any still; the look is read off it and read
  back the same way.

One style per production, inherited by every shot (base brief's `STYLE IN
FORCE`). Changeable later — give style, aspect and intended length a home:
a small **Production settings** sheet reachable from the production bar
(same modal shell as Settings).

**Why the eye and not words:** the look is the one creative decision a
novice cannot phrase. Frames are answerable by anyone; "what lens language
do you want" is answerable by nobody we are building for. And length is
derived where a script exists because the script already knows.

## D. Staleness chips (new, Desk)

When the scene line or any document field is edited **after** shots exist,
every affected shot gets a quiet chip: `SCENE CHANGED · review` — outline,
greyscale, never accent. It appears on the shot's Wall card meta, script-
rail row, and shot-view header. It clears when the shot's setup is next
edited or the user dismisses it. **Nothing regenerates by itself, ever.**

**Why:** edits must flow downstream as flags. Silently rewriting work that
cost money is the one betrayal this surface can never commit; silently
ignoring the edit is the other. The chip is the honest middle.

## E. Mid-scene state changes (new, context panel)

In `IN THIS SCENE`, a chosen state can be marked **"changes during this
scene"**: pick the after-state and the beat it turns on. The chip then
reads `closed → open · at the blast`. Shots ordered before the beat inherit
the before-state; shots after inherit the after-state, automatically; a
shot can still override its own inherited state like any other.

**Why:** when something opens, breaks or burns mid-scene, a later shot must
not accidentally show it un-happened. One control, no new surface.

## F. Anchor promotion (new, take viewer)

In the take viewer, on a **kept** take only, one additional quiet action:
**`Save this take's sound to the shelf`**. It lands in the AUDIO group as
`anchor · take 02` — a normal audio tile, attachable to other scenes with
the same Audible / Timing-only toggle.

**Why:** when a performance's sound is right, the production wants it as
the reference elsewhere. Promotion is one click at the moment of liking it.

## G. The wait numbers are derived, not constants

§5's generating banner keeps its four-branch sentence machinery exactly as
written — but `34s` / `62s` are placeholders. The build derives them from
the live distribution per engine; the copy templates take the numbers as
inputs. Add a note to that section; change no copy.

## H. Name the two-step economics

§4c draws one take per approved shot; §5 draws fans of four. Deliberate —
make the copy say so instead of looking inconsistent:

- **The first look is STILLS, not video.** §4c's footer button becomes
  **`Draw a first look for 2 · 4 cr`** — it renders the FIRST FRAME of each
  approved shot as a still image (image-priced, fast), laid out as a
  contact sheet. Note: *Still frames first, so you see the framing, the
  people and the light before video is drawn.* A still that looks right
  gets `Draw takes · 24 cr` on its card; one that looks wrong gets fixed
  (state, reference, note) at image cost. A kept still becomes the shot's
  first-frame anchor for its video takes.
- The shot view's zero-state button stays `Draw 4 takes · 24 cr` — by the
  time someone is on one shot, they are past scouting.

**Why stills:** wrong reference, wrong blocking and wrong light are all
visible in one frame, and a frame costs a fraction of a clip. Judging the
cheap artifact before buying the expensive one is the whole economics of
this surface in miniature.

## I. The Script view — the fourth segment

**What it is, in one paragraph.** A room for writing and rewriting the
production's script as a document. The Desk already shows the script as
scenes; the Script view shows the same script as a **page**. One document,
two lenses — someone who arrived with a finished script may never open this
tab. It exists for two people: the one starting from an idea who wants to
develop a script from nothing, and the one who keeps rewriting while shots
are being drawn. **Writing is free, always; nothing on this view can spend
a credit.**

**The toggle becomes `Script · Wall · Desk · Composer`** — pipeline order:
write it, oversee it, work it, cut it. Same segmented control. **The shelf
drawer is hidden here** (like the Composer): the manifest rail below does
that job for a writer, and two lists of one material on one screen is a
duplicate.

**Layout:** the Page (`flex: 1; min-width: 420px`) with advisory chips in
its margin · the manifest rail (`flex: 0 1 300px`, right).

### The Page

- A screenplay-styled editor. Free typing; plain prose is welcome —
  sluglines and dialogue formatting recognised, never required.
- **Scene boundaries are derived**, drawn as quiet dividers carrying mono
  `SC 3` + the scene name; the writer can also insert a break by hand.
  Optional `ACT` headers group scenes.
- A scene that already has drawn work shows a small greyscale meta line
  under its divider (`3 shots · 1 kept`) so the writer knows they are
  editing under a built scene. Editing it raises §D's `SCENE CHANGED` chips
  on its shots. **Nothing regenerates from here, ever.**
- Empty state: *Start typing, paste a script, or talk it out.* — "talk it
  out" opens a side conversation whose only output is text landing on the
  page for the writer to keep or strike. The conversation never creates
  scenes directly; the page is the sole source.

### The margin — advice, never gates

Chips attach to their scene's divider, all outline greyscale, all
dismissable: `WORTH A LOOK · NOT A BLOCKER` with a one-line reason; at most
one per act: *No centrepiece yet — which scene is this act building to?*;
occasional pacing notes (*three kitchen scenes in a row*). The same
advisory system as the Desk's, surfaced where writing happens.

### The manifest rail — requirements deriving themselves while typing

Three groups with mono eyebrows: `PEOPLE` · `PLACES` · `THINGS`. **Rows,
not tiles** — this rail is derived reading, not an inventory:

- A row: name · presence in mono (`SC 1–4, 6`) · a state note when the text
  implies one (`grey coat SC 1–4 → gown SC 9`; `intact → burning from
  SC 3`).
- Every row can show **why it exists**: click → the sentences that summoned
  it highlight on the page. Hover: `Dismiss` / `Track` (promote any
  mentioned thing).
- A person row offers `Cast this role` (routes to picking from signed
  casts). Unresolved rows are dashed — the dashed-vs-solid law holds.
- **This rail is the shelf's upstream twin, never a second shelf**: same
  identity/state grammar, earlier stage. When the shelf resolves a gap, the
  row goes solid here too — one truth, two readings.

### The footer — honest arithmetic

One line, always visible: `~10 shots implied · est. 380–560 cr to cover ·
writing is free`. The estimate moves as the script grows.

### Script view do-nots

No prompt text anywhere; no draw buttons; no gates on weak writing; no
six-field scene documents here (they live on the Desk — this view is the
page, that view is the cards); no attachable assets in the rail; the view
is almost entirely colourless — §8's two accent states hold.

## L. Camera picked by eye — the move gallery (new)

Coverage proposals stay written in plain sentences. But wherever a user
EDITS camera — the `CAMERA` direction slot's expanded view, or editing a
proposed shot — offer a **browsable gallery of camera-move cards**, each a
small looping preview of the move (push in, orbit, whip pan, crash zoom,
handheld, locked-off…), name beneath in mono. Pick one or stack several in
order; picks file into the `CAMERA` slot as ordered chips (`push in →
hold`), removable like any note chip. A search field over the gallery; the
gallery never replaces typing — a typed camera note still files as before.

**Why:** nobody we build for knows what a move's name means, and everyone
knows it when the loop plays. Same principle as the style step: the eye
answers what words cannot ask.

## M. The shot view — de-crowding (amends §H's frames strip and base §5; from the founder's overload read of the prototype)

The law: **information appears at the altitude where it is actionable, and
only one stage stands on stage at a time.**

1. **The frames strip is a stage, not a section.** While a shot has no
   video takes, frames ARE the body: large tiles, anchor pick, one button
   (`Draw 4 video takes from frame 02 · 24 cr`). The moment video takes
   exist, the strip collapses itself to one line — small anchor thumbnail +
   `ANCHORED ON FRAME 02 · change` — click to expand. The two contact
   sheets are never both open. Remove the manual "Hide the frames" link;
   self-collapse replaces it.
2. **One paid draw button per screen state.** Before takes exist the
   frames stage owns it; after, the takes row owns it. Never two.
3. **Gap chips leave the shot view.** The NEEDED row renders only inside
   the expanded shelf; production-wide gaps live behind the shelf header's
   GAPS counter chip. The only gap surfaced on a shot/scene screen is one
   quiet context-panel line when a gap blocks the CURRENT scene
   (`2 gaps block this scene · open shelf`).
4. **Tiles never say "or browse files"** — base brief §5 already rules it;
   restore. Pending tiles read `take renders here` / `frame renders here`
   on the live slot only; empty slots carry nothing.
5. **Notes return to the three-action row** — Keep · Draw 4 more · Give a
   note (the input opens on demand, never standing open). Filed chips stay.
6. **Target**: a shot view's standing furniture is the header, ONE contact
   sheet, one action row, the note chips, and the collapsed prompt drawer.
   If a screen state shows more, something is at the wrong altitude.

## N. The scene document's source block follows the road (small copy/state fix)

The document's quoted-source block and field badges reflect where the scene
came from:

- **Script road:** the block is `FROM YOUR SCRIPT · SC 3`, quoting the
  scene's own excerpt (collapsed to ~3 lines, "show all" expands;
  click-through opens the Script view at that scene). Badges read
  `READ FROM YOUR SCRIPT`. Header explainer: *Read back from your script.
  Correct anything wrong — the next shot list uses this, not the script
  directly.*
- **Line road** (scene written on the Desk from one line): as built —
  `YOUR LINE`, `READ FROM YOUR LINE`.
- **Never** show empty fields as questions on the script road; if the
  script exists, every field arrives filled. Empty-question fields exist
  only on the blank road before a line is written.

Why: the document must always read as the machine's reading of what you
wrote, never as a form asking things your script already said. (Founder
question, 2026-09-03: "wouldn't that defy the script?" — it must be visibly
impossible to mistake the document for a questionnaire.)

## O. Camera cues written in the script are honored, not asked for

The Script view has no camera controls — the page stays story. But a
screenplay sometimes carries camera language (`CLOSE ON her hands`,
`WE PUSH IN`, `ANGLE ON the door`). The parser reads those cues into the
PROPOSED SHOT LIST for that scene (a proposed `CU — HER HANDS` carrying the
cue as its setup line), badged `READ FROM YOUR SCRIPT` like every other
inference — editable and deletable in the proposal like any proposed shot.

Why: a writer who wrote camera meant it; ignoring it defies the script,
and asking about it again is a question the script already answered. The
four camera altitudes stand: style (production) → scene overrides → the
proposal / CAMERA field with the move gallery (shot) → notes (take to
take). The script is input to the second and third, never a fifth control.

## J. Additions to §11 (what NOT to do)

- Do not write "version" anywhere in Cinema. *Take* and *setup*.
- Do not auto-lock on coverage, and do not leave a draw button enabled
  while locked.
- Do not regenerate anything from a script or document edit. Chips only.
- Do not ask for length as a number, or style as words-first. Chips and
  frames.
- Do not put scene documents, a shelf, or any paid action on the Script
  view.
- Do not let "talk it out" create scenes. Text onto the page only.

## K. Build order

The base §12 order holds, amended: the **entry flow (§C)** joins PR 3 (the
Desk's scene half needs a way for scenes to exist); §D and §E join PR 4;
§F joins PR 4's take viewer; the **Script view (§I)** lands as its own PR
after PR 4, before the Wall — it defines no new nouns but consumes scenes,
shots and keepers, which exist by then.
