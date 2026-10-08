# Cinema — the production surface (consolidated brief)

> **Provenance note (2026-10-08):** this file is the verbatim reconstruction of
> `12-cinema-full.md`, the design agent's consolidated brief plus the founder-
> ruled §16 amendments, recovered into the repo after the original Downloads
> copy was lost in the PC migration. Reconstructed from the full text read into
> the relay's session on 2026-10-04–08; content unchanged except this note.

**This file replaces `12-cinema.md` and `12b-cinema-amendments.md`.** Everything in those two that still stands is folded in here; everything that changed since (the entry modal, the frames stage, camera by eye, the notes flow, the drawer, the retired lock and readouts) is written the way the prototype now behaves. Where this file and the older two disagree, this file wins.

Live reference: `Klieg Studio.dc.html` → **Cinema** in the rail. Every screen described here is in that file; where this text and the file disagree, **the file wins**. Do not work from screenshots.

**What this is.** A design and a workflow, not a functional spec. Nothing in the codebase corresponds to Cinema, and nothing in the prototype actually draws — every generation is a placeholder. Build the skeleton to this shape and wire the engine underneath it; the shape is what is being handed over, and it is the thing that must not drift.

---

## 0. What Cinema is, and the words it uses

A place to make a short film with a signed cast. You arrive with a script or one line. The studio reads it into scenes; you approve the scenes and pick a look by eye. On the Desk each scene becomes a scene document and a proposed shot list; you approve shots; each approved shot gets four still frames first, you keep one as the anchor, and video takes are drawn from it; you keep the takes you like; kept takes become the cut. Four views of one production — **Script · Wall · Desk · Composer** — in pipeline order: write it, oversee it, work it, cut it.

### Vocabulary — fixed

| Word | Means |
|---|---|
| **Production** | the film — `ZEPHYR — Episode 1` |
| **Scene** | a unit of story with a place and people — `SC 1` … `SC 6` |
| **Shot** | one camera setup inside a scene — `WS — ROOFTOP`, `CU — ZERO` |
| **Frame** | a still drawn for a shot before any video; the kept one is the **anchor** |
| **Take** | one rendered video attempt at a shot, drawn from the anchor |
| **Setup** | the assembled instruction a take is drawn from; a note or a prompt edit starts a **new setup**, and its takes are numbered fresh (`TAKE 03 · SETUP B`) |
| **Keep / kept** | a take starred into the cut |
| **The cut** | every kept take in story order |
| **The shelf** | the production's cast, locations, props and audio |
| **The manifest** | the Script view's derived list of people, places, things and sound |
| **Drawn** | the verb for generation, always — *nothing drawn*, *being drawn*, *drawn 14 Aug* |

Rules of the vocabulary:
- **Frames, takes and setups are the only generation nouns.** Never *version* (that word belongs to the casting surface), never *render*, *output*, *generation*, *result*.
- **Nothing on a button says `free`.** Cost is shown only where there is one (`· 24 cr`). A button without a price is free; the copy near it may say *costs nothing* where it matters.
- Mono for everything measured or machine-named (scene numbers, shot types, durations, clocks, take numbers, credits, prompt text, note slots). Archivo for everything a person wrote or reads.

---

## 1. The frame

Cinema is a full-viewport working surface, like the canvas editor — **not** a scrolling lobby page.

```css
height: calc(100vh - 56px);
display: flex; flex-direction: column;
min-height: 0; overflow: hidden;
background: var(--page);
```

Stack, top to bottom: **production bar · shelf · the active view · cut strip.** Bar, shelf and strip are `flex: none`; the view is `flex: 1; min-height: 0`. **The frame never scrolls; each view owns its own scrolling.** The rail and topbar stay; no `AppShell` width.

### 1.1 Production bar

One wrapping row, `padding: 13px 24px`, `--surface`, `--border` bottom:

1. **Production chip** — eyebrow `PRODUCTION`, title `ZEPHYR — Episode 1` (`500 14px`, `-.015em`, ellipsised) with a small sliders glyph. Hover `--fill`. **Clicking it opens Production settings (§9.2).** This is the only way to switch productions.
2. `1 × 28px` `--borderSoft` divider.
3. **View toggle** — segmented control **Script · Wall · Desk · Composer**, each with a 13px glyph. Selected: `--surface` + `0 1px 2px` shadow + `500`; unselected `400 --metaStrong`. Tooltips: *Write and rewrite the script as a page* · *Every scene at once — where the film stands* · *One scene or one shot — where the work happens* · *The whole film, holes included, with a player*.
4. Spacer `flex: 1 1 0; min-width: 0`. *Never `margin-left: auto`.*
5. **`+ New production`** — outline button.
6. **`Export cut`** — the one ink button on the bar.

**What is deliberately not on the bar:** no coverage readout (`7 OF 10 SHOTS COVERED`), no credit balance, no lock pill. All three were built and removed — they were noise. Coverage lives on the Wall's Map density and in the Composer's `0:33 intended · 0:21 kept`; balance lives in the topbar; picture lock was judged unnecessary for now.

### 1.2 Landing

When the user has **no production**, the Cinema destination opens with the **New production modal already open** (§2) over the empty frame. When they have one, they land on the **Wall**.

---

## 2. New production — the entry modal

A modal over the Cinema frame (`position: absolute; inset: 0; z-index: 56`, scrim + 4px blur). Card: `max-height: 640px`, width `820px` on the doors step, `680px` on the road steps, `940px` on the look step; `--surface`, `--borderCard`, `16px` radius, `shadowCard`; header row `NEW PRODUCTION` eyebrow + step title + close.

It is a modal, not a page, so the user never leaves the frame they are about to work in.

### 2.1 Doors — *Two ways in*

- **Hero banner** at the top: `clamp(190px, 30vh, 260px)` tall image (an `image-slot`, the house look), a top scrim and a bottom gradient, and in the **bottom-left**: eyebrow `CINEMA` + `400 26px` white line *A film with your cast in it, from one line or a whole script.* The title sits bottom-left, never top-left.
- Below: *What are you starting from?* and the explainer *Nothing is drawn and nothing is charged until you approve a shot list. Reading a script, proposing scenes and picking a look are all free.*
- **Two door cards**, `minmax(248px, 1fr)` grid:
  1. **I have a script** — `MAIN ROAD` pill, `--lineStrong` border, `shadowPop`. *Paste it or drop the file. It gets read into scenes, people and places before anything is drawn — and you approve every scene.* Meta `THE FASTEST ROAD IN`.
  2. **I have an idea** — *One line about the film — or about one scene, if that is all you have. The scene list comes from it, and the length question is a single choice, never a number field.* Meta `GOOD FOR A SHORT`.

**There is no "Start blank" door.** It was designed and cut: nobody can start a film from nothing — they have at least an idea, and the idea road accepts one scene's worth of a line. Two cards also balance; three did not.

### 2.2 The script road — *From a script*

`YOUR SCRIPT` · *Paste it in, or drop the file* · *Formatting is optional. Plain prose reads fine — scene breaks, people and places get picked out either way, and you correct them after.*

- A `--raised` paste box (min 120px, mono placeholder showing a formatted page) with a dashed **Drop a file** chip and `FDX · PDF · TXT · DOCX`.
- **Read back card** — the system answers before anything exists: eyebrow `READ BACK · FREE`, then *Six scenes, two people, one apartment — reads as a ~2-minute short.*
- Buttons: **Propose scenes** (ink) · Back.

### 2.3 The idea road — *From an idea*

`YOUR IDEA` · *One line is enough* · *Say what the film is about. The scene list comes from this, and you approve every scene before anything below it exists.*

- `THE FILM, IN A LINE` box (placeholder *a heist film where the thief is the detective's daughter*).
- `HOW LONG` — one chip row: **`~30s` · `1–2 min` · `5 min+`** (default `1–2 min`). *Sets roughly how many scenes get proposed. You can add and cut them after.* Never a number field.
- **Propose scenes** · Back.

### 2.4 Proposed scenes — *Read from your script* / *Built from your line*

`PROPOSED SCENES` · *6 scenes, in the order they run* (script) or *4 scenes to start from* (idea; 3 / 4 / 6 by length chip) · *Nothing below a scene exists until you approve it — no shots, no takes, no charge. Approve the ones that are right, cut the rest.*

Each proposed scene is a card: numbered circle (→ ink check when approved) · name · who (mono) · `APPROVED` pill · one-line what · **Approve / Approved** toggle · rename · cut · drag handle. **Unapproved = dashed border, transparent; approved = solid border, `--surface`.** `+ Add a scene` dashed tile at the end.

Footer: **Choose the look for n** — inert (`--fill`, `--muted`, `not-allowed`) reading *Approve a scene to continue* until one is approved. Note: *Nothing is charged either way — approving only decides what exists.* / *Still nothing drawn. The look is next, then you break a scene into shots when you are ready.*

### 2.5 The look — *Choose the look* / *Pick it by eye*

*Every shot in the production inherits this. You can change it later in production settings, and any scene can override it.*

- **Six look cards**, `minmax(212px, 1fr)`: a `16:9` rendered reference frame, name (`Anamorphic, cold`), meta (`2.39:1 · 40mm · practical light`). Picked card: `--accentLine` border, `3px --accentSolid` underline, `PICKED` accent pill. This is one of the two accent states — a kept thing.
- Two dashed **escape hatches** beneath: **Describe it** (*Say it in a sentence and the profile gets read back for you to confirm.* — opens a one-line input) and **Match this** (*Upload any still and the look is read off it — grade, lens, light.*).
- Footer: **Open the desk** + *n scenes and anamorphic, cold. Nothing has been drawn and nothing has been charged — the first cost is a shot list you approve.* Lands on the Desk, SC 1, approved scenes in the rail.

**Why the eye:** the look is the one creative decision a novice cannot phrase. Frames are answerable by anyone.

---

## 3. The shelf — the production's call sheet

A collapsible drawer under the bar. **Shown on Wall and Desk, hidden on Script and Composer** (each of those has its own list of the same material — the manifest and the source panel — and two lists of one thing on one screen is a duplicate).

```css
flex: 0 1 auto; min-height: 0; max-height: min(232px, 34vh);
overflow-y: auto; background: var(--raised); border-bottom: 1px solid var(--border);
```

**Header row** (always visible, click toggles): chevron · `THE SHELF` · hint *21 identities — open to browse* (blank when open) · spacer · **gap chip** — dashed pill with `!` glyph reading `6 GAPS`, shown only while gaps exist. *The shelf reports what is blocking the production even when shut.*

**`NEEDED` row** (when open and gaps exist): a single horizontal row of dashed chips, one per gap — `The courier · not cast yet · needed by SC 5`. Click → that tile. This row is the shelf's summary of itself; it is the only place gaps are listed production-wide.

**Body** (when open): four groups in a horizontal scroll, each a labelled column separated by a `--rule`:

| Group | Source line | Tile | Nested states called |
|---|---|---|---|
| `CAST` | *from your casts* | 78 × 110 face crop | **looks & poses** |
| `LOCATIONS` | *pick · upload · mint* | 78 × 110 reference frame | states |
| `PROPS` | *pick · upload · mint* | 78 × 110 object | states |
| `AUDIO` | *pick · upload · write* | 128 × 56 waveform | cuts |

Each group ends in a dashed **add** tile.

### 3.1 The identity model — one tile per thing, states nested

**A tile is an identity; its variations are state cards inside it.** Zero is one tile with looks `hero jacket · IN 4`, `rooftop coat · IN 2`, `workshop tee · IN 1`. The apartment: `morning · IN 3`, `night · IN 1`. The case: `closed · IN 2`, `open · IN 1`.

- Top-level tile count always equals the number of distinct people, places, things and tracks. **Never two tiles for one identity.**
- The tile caption is a state summary, not a state: `Zero · 3 looks`, `The case · closed / open`. Count badge top-right.
- Click a tile → a nested row of state cards in a `--well` tray, each a real attachable asset with its own `IN n`. Nested gaps are dashed cards: `swimsuit · NEEDED`.
- **Scene assignment never happens on the shelf.** The Desk's context panel is where a state is chosen; the shelf is the inventory.
- Cast's source reads **from your casts** — never *browse files*. A face comes from the casting studio or nowhere. Cast gaps offer `Mint · Pick` only.
- **Poses are cast states too.** `on her back — under the bench` sits inside Zero's tile beside her looks (see §6.5).

### 3.2 Gap tiles

A needed-but-unmade identity renders as a **dashed tile** with `+` and `NEEDED`, its state line replaced by what is blocking: `not cast yet · needed by SC 5`. Hover → glass action row `Mint · Upload · Pick` (cast: `Mint · Pick`; audio: `Write · Upload · Pick`). **Gaps derive from the scene documents and the script**, never typed. Resolving one animates it into a normal tile. **The gap counter counts nested gaps too.**

### 3.3 Audio tiles

Waveform (14 bars `--lineStrong`), name, duration badge. When attached to a scene, a two-way toggle beneath: **Audible / Timing only**. The same toggle appears on the scene's context chip and on the Composer's audio clip.

### 3.4 Not on the shelf

Blocking diagrams (filed under their scene, shown in the context panel). Anything from the Script view's manifest that has not been resolved yet is a **gap here**, not a second tile.

---

## 4. The Script view — the page and the manifest

A room for writing and rewriting the script as a document. **Writing costs nothing and nothing on this view can spend a credit.** Two columns: **the page** (`flex: 1; min-width: 420px`, `--surface`) · **the rail** (`flex: 0 1 332px; min-width: 250px`, `--raised`, left border).

### 4.1 Page bar

`THE PAGE` · *4 notes in the margin* · spacer · *Notes in the margin are read when a scene is broken into shots. Camera is decided there, not here.*

### 4.2 The page

`max-width: 860px`, centred, `padding: 26px 214px 34px 40px` — the wide right padding is the margin where notes live.

- Optional **act header**: `ACT ONE` + hairline + a `WORTH A LOOK` chip carrying the act-level advisory (*No centrepiece yet — which scene is this act building to?*).
- **One block per scene**, a 2px left rule that goes `--ink` when the scene is **focused** (click anywhere in the scene). Scene head: mono `SC 3` (click → that scene on the Desk) · name · hairline · then either a staleness chip `2 SHOTS TO REVIEW` (↩ glyph), or the built line `3 shots · 1 kept`, or `nothing drawn`.
- **Screenplay geometry**, recognised never required: slug (`500 12.5px` mono, `.08em`), action/prose (`400 13.5px/1.7` Archivo, `58ch`), character (`500 12px` mono, indented `12ch`), line (`32ch`, indented `8ch`).
- **The margin.** Any action or dialogue block can carry a **director's note** — shown to the right of the block, `168px` wide, on a `1.5px --lineStrong` left rule: *Hold wide. She should be small against all of it.* Blocks without a note show a dashed `+` on hover. Notes are **intent, never camera spec**; they are read when that scene's shot list is proposed. The page stays a script.
- **Scene advisories** sit under their scene as an outline card `WORTH A LOOK · NOT A BLOCKER` with a one-line reason and a dismiss ×. Advice never gates anything.
- Footer of the page: *Keep typing, paste more, or talk it out.* — "talk it out" is the Editor tab (§4.4).
- **Nothing regenerates from an edit here, ever.** Editing a built scene raises staleness chips (§5.6) downstream.

### 4.3 The rail — Manifest tab

Header: segmented **Manifest · Editor**, the Manifest tab carrying an `n` badge for unresolved rows. Under it, `SHOWING` **This scene · Whole script** — *This scene* is live only when a scene is focused on the page, and reads as that scene's number (`SC 3`).

**Four groups**, mono eyebrows, each with a `→ CAST` / `→ LOCATIONS` / `→ PROPS` / `→ AUDIO` map label (tooltip: *PEOPLE on the page are CAST on the shelf — same identity, two registers*):

`PEOPLE · PLACES · THINGS · SOUND`

**Rows, not tiles** — this rail is derived reading: 34px thumbnail (face `4:5`, place `16:9`, thing `1:1`, sound a small waveform; unresolved shows a dashed `+`) · name · presence in mono (`SC 1–4, 6`) · a state note implied by the text (`hero jacket SC 1–4 → workshop tee SC 4`, `closed → open at the bench`, `not written`) · chevron. Unresolved rows are dashed. **Hover shows nothing** — the row's one gesture is click, which opens the drawer.

Empty focused scene: *SC 5 names nobody and nothing yet. Write it and the rail fills in.*

The two vocabularies are deliberate and mapped 1:1 in the model: `PEOPLE→CAST · PLACES→LOCATIONS · THINGS→PROPS · SOUND→AUDIO`. Resolving a shelf gap turns its row solid here; resolving here turns the shelf tile solid. One identity, two readings.

### 4.4 The rail — Editor tab

A conversation whose **only output is text that lands on the page when you keep it.** Header adds *New conversation* and *Past conversations* icons. Opening line: *I have read the six scenes. Ask me for a line, a rewrite, or what a scene is missing — I will show you the words and you decide whether they go on the page.* / *Nothing I write lands until you keep it.*

- Your turns: right-aligned `--fillStrong` bubbles.
- Its turns: plain text; when it drafts script, the draft is a block on a `2px --ink` left rule in screenplay geometry, with **Add to SC 5** (ink) and **Strike it** (outline), plus useful / not-useful thumbs.
- Composer at the foot: 2-row auto-growing textarea (`max-height: 110px`), one send button (ink when there is text). **No scene selector, no scope selector, no `FREE` label** — the whole script is always in context.
- The editor never creates scenes or shots directly. Page only.

### 4.5 The drawer — one identity, every way to resolve it

Clicking any manifest row slides a drawer over the rail (`inset: 0` of the rail, `--raised`, `cinIn .22s`). Back arrow · `PEOPLE · SC 1–4, 6` eyebrow · name.

1. **The reference** — the identity's image or waveform, sized to its kind (face `150px` `4:5`; place full-width `16:9`; thing `160px` `1:1`; solid frame when resolved, dashed when not), then its state line and, when resolved, `Open on shelf →`.
2. **`LOOKS & POSES`** (cast only) — the shelf's nested states as chips (`hero jacket · IN 4`, dashed `swimsuit · NEEDED`) + dashed `+ Add a state`.
3. **`WAYS IN`** (or **`REPLACE IT`** when resolved) — the sources, as cards. The primary one has a `--lineStrong` border; the others are quiet:

| Kind | Ways in, in order |
|---|---|
| Person | **From your casts** — *A signed face, already consistent across every frame. Pick one and the role is cast.* + a row of your cast thumbnails · **Mint a new cast · 4 cr** — *Opens casting with the brief written from the page. Eight candidates, you sign one.* + the quoted lines that summoned it |
| Place / thing | **Generate from the script · 4 cr** — *Drawn in the production's look, from the lines below. Four options, you keep one.* + quote · **From your assets** + thumbnails · **Upload** — *Any still. The look is matched on the way in.* |
| Sound | **Write it · 3 cr** — *Say what it should do and the cue gets composed to the scene's length.* + quote · **From your assets** · **Upload a track** — *MP3, WAV or AIFF.* |

**People are never uploaded.** A face comes from casting or nowhere.

4. **`ON THE PAGE`** — the sentences that summoned this identity, each with its `SC n`, so *why does this exist* is always answered.

Clicking a row also **lights the summoning lines on the page** (`--accentWash` fill with `--accentLine` inset ring) — the one time accent appears on the Script view, and it is a selection, not a state.

---

## 5. The Wall — a reading surface

Every scene as a horizontal lane. **Reading only:** health map, hover-preview, drag a shot between lanes, click through to the Desk. **No card-level actions.**

### 5.1 Wall bar

Left: **`NEXT`** + one derived sentence — a director's glance answer and a new user's instruction, clickable, priority order:

1. a stale shot → *SC 3 changed after its shots were drawn — review them*
2. takes with nothing kept → *CU — ZERO has takes and nothing kept — pick one*
3. something drawing → *SC 4 is being drawn — write SC 5 while you wait*
4. a scene with nothing written → *SC 5 has nothing written — one line is enough*
5. otherwise → *Every shot is covered — open the Composer and watch it through*

Right: a three-segment **density** icon control: **Map · Mid · Detail**.

### 5.2 Lanes

Dot-grid floor (`--dots`, 26px). Each lane: a **sticky 226px header** (`--barGlass`, `sticky left`, `z-index: 2`) and a horizontally scrolling body.

Header: scene number (mono) + **status chip**; name (`500 12.5px`); then, in order and only when true: pulsing accent chip `1 BEING DRAWN`; staleness chip `2 SHOTS TO REVIEW` (↩); advisory chip `WORTH A LOOK` (`!`) — **staleness hides the advisory while both apply**; who / what lines (Mid and Detail only).

**Status is derived, never set:**

| Status | Rule | Treatment |
|---|---|---|
| `DRAFT` | no shots | transparent, `--borderInput` line |
| `READY` | shots, none in flight, not all kept | `--fill` |
| `RENDERING` | any shot in flight | `--accentWash` / `--accentLine` / `--accentInk`, pulsing dot |
| `COVERED` | every shot has a keeper | solid `--ink`, `--surface` text |

A blank scene's lane body holds one dashed tile: **Write this scene** / *One line is enough — the shots follow from it.* → the Desk's blank state.

### 5.3 Three densities

**Detail** (default) — 172px cards, 96px media, type + duration, a take-fan (one 2px bar per take, kept ones `--ink`), `6 takes · 1 kept` / `being drawn` / `in line` / `nothing drawn`, the **identity line** (padlock + `Zero · Mara locked`), and a `SCENE CHANGED` chip when stale. Hover lifts the card 4px.

**Mid** — 132px cards, 74px media, no fan, no identity line.

**Map** — the health map. Each lane one row; the body is a single contiguous meter, one segment per shot, `flex: <seconds>` so width is proportional to duration; `--ink` kept, pulsing `--accentWash` in flight, `--fill` drawn-not-kept; an empty meter reads `NOTHING DRAWN`. Right-aligned per lane: `3/3 covered` (`--ink`), `1 being drawn` (`--accentInk`), `no shots` (`--faint`). All six lanes fit without scrolling.

**Why proportional:** equal segments would give a 2s insert the weight of an 8s two-shot and lie about how much of the film is covered.

### 5.4 Generating state on a card

Accent spinner ring, the live clock `50s`, an honest ETA (`half land by 34s` / `past the usual` after p90 / `after the one above` when queued), a pulsing 2px accent bar at the media's foot. The lane header gets `1 BEING DRAWN`. **Same wait language everywhere a take can exist** — card, lane, Desk banner, Composer clip.

### 5.5 Colour law

Accent is spent on exactly two states across the whole surface: **generating** (pulse) and **kept** (solid underline, `PICKED` / `ANCHOR` / `IN THE CUT` pills). Idle is colourless. Types, kinds, statuses and priorities never get colour. Dashed = does not yet exist; solid = exists. No green, amber or blue anywhere in Cinema.

### 5.6 Staleness

When a scene's line, document or page text is edited **after** shots exist, each affected shot gets a quiet greyscale chip with a **return arrow** (`↩`): `SCENE CHANGED` on a shot subject (Wall card, shot view header banner *The scene changed after these were drawn.* + Dismiss), `2 SHOTS TO REVIEW` aggregated on a scene subject (lane header, script-rail card, page scene head). It clears when the shot's setup is next edited or on dismiss. **Nothing regenerates by itself, ever.** Never a pencil glyph (that means *edit this*); never the advisory's `!`.

---

## 6. The Desk — one scene, then one shot

Three columns: **script rail** (280px, `--raised`) · **work area** (`flex: 1; min-width: 340px`, `--surface`) · **context panel** (`flex: 0 1 320px; min-width: 186px`, toggleable on the shot view).

### 6.1 Script rail

`SCRIPT` + hairline + `6 scenes`. One card per scene: number + status chip · name · one-line what · staleness or advisory chip · `3 shots · 2 kept`. The **selected scene expands** to list its shots inline: dot (`--accentSolid` pulsing in flight, `--ink` kept, `--muted` otherwise) · type in mono · `6 takes` meta. Click a shot → shot view.

### 6.2 Work-area header

Breadcrumb `SC 3 — The apartment, morning / TWO-SHOT — KITCHEN` (scene clickable; shot in mono). On the shot view, right: **Context** toggle (filled when open) · **Edit setup**.

### 6.3 Scene authoring — inverted

**The order is: one line → proposed shots → first frames → the document appears pre-filled.** Not a blank form first.

**Blank scene** (`max-width: 620px`):

```
SC 5 · NOTHING HERE YET
The handover
[ WORTH A LOOK · NOT A BLOCKER — Nobody wants anything in this scene yet. Worth a line on what changes. ]
One line is enough to start. Say what happens and who it happens to — the shot list,
the scene document and the direction all get filled in from it, and you correct them after.

┌ THE SCENE, IN A LINE ──────────────────────────────────┐
│ e.g. Zero meets the Broker on the concourse and        │
│ neither of them hands anything over.                   │
│ [ Propose shots ]  Reading costs nothing. You approve   │
│                    each shot before a take is drawn.    │
└────────────────────────────────────────────────────────┘
```

**Scene document** (`max-width: 720px`), once the scene came from a script or a line:

- Eyebrow `SC 3 · SCENE DOCUMENT`, name, and an explainer **that follows the road**:
  - script road: *Read back from your script. Correct anything wrong — the next shot list uses this, not the script directly.*
  - line road: *Read back from your line. Correct anything wrong — the next shot list uses this.*
- **Source block** in `--well`: `FROM YOUR SCRIPT · SC 3` quoting the scene's own excerpt, clamped to 3 lines with **Show all** and **Open in Script →**; or `YOUR LINE` quoting the sentence verbatim.
- Six fields, each: mono label · badge `READ FROM YOUR SCRIPT` / `READ FROM YOUR LINE` when inferred · helper · value box. **On the script road every field arrives filled** — an empty question never appears when the script already answered it. Empty values (line road only, before there is enough) read *Not answered yet*, 44px floor.

| Field | Helper |
|---|---|
| `WHO & WHERE` | the people and the place, plainly |
| `WHAT HAPPENS` | the events, in order |
| `TONE` | how it should feel to sit through |
| `WHAT THE VIEWER SHOULD READ` | the thing they work out without being told |
| `WHAT WE DON'T SHOW` | held back on purpose |
| `PURPOSE` | why the scene is in the film |

- Footer: **Break into shots** (or **Propose more shots** when shots exist) + *Proposes a shot list from these six answers. You approve each one before any take is drawn.* / *Reads what is already here and proposes what is missing…*

**Why inverted:** a six-field form before anything exists is homework. Once the machine has read the line or script, the same six answers are obvious and the form becomes a review — *check this*, not *fill this in*.

### 6.4 The proposal — nothing generates until approved

`SC 4 · PROPOSED SHOT LIST` · *Four shots from your six answers* · *Nothing has been drawn and nothing has been charged. Approve the ones you want and they join the lane; the rest never happen.*

**Reassurance block** (`--well`, padlock): *All four shots share the scene's cast, location, light and blocking — they're angles on one moment, not separate ideas.* followed by the **inheritance chips**: `Zero (hero jacket) · Workshop (night) · The case (open) · SC 4 blocking · scene overrides` — mono chips; click one and it highlights in the context panel.

Each proposed shot is a card: numbered circle (→ ink check) · type in mono · duration · `APPROVED` pill · setup line · optional camera line · **Approve / Approved** · **camera icon** · trash. Unapproved: dashed, transparent. Approved: solid, `--surface`. All three signals together, because this is where a mistaken click costs credits.

- **Camera on a proposed shot.** The camera icon opens **Camera, by eye** (§8) for that shot. Stacked moves show under the setup as numbered chips `1 Push in · 2 Rack focus`. When the script itself said it (*PUSH IN on the case*), the chip row carries the badge `CAMERA READ FROM YOUR SCRIPT` — camera language in a script is honoured, never ignored.
- **Pose gap, road 1.** When a setup describes an orientation none of the cast's references show (*on her back*, *upside down*, *submerged*, *mid-fall*, *hanging*), the card grows a dashed line: *Needs a pose reference — Zero, on her back* with **Transform · free** (flips an existing plate, bakes the physics) · **Mint · 4 cr** · **Upload**. Tooltip explains why: *Drawing without one usually costs several takes to the same wrong thing.* **Detected, never enforced** — approve and draw stay open. Resolved, it reads `Zero, on her back · attached to this shot only` and the pose appears in Zero's shelf tile under looks & poses.

`+ Add a shot` dashed tile at the end.

Footer: **Draw first frames for 2 · 2 cr** — inert reading *Approve a shot to continue* until one is approved. Note: *Stills first, image-priced. Wrong reference, blocking or light gets caught for pennies; the frame you keep is what the video is drawn from.* / *Nothing is charged until you approve at least one.*

### 6.5 The context panel

Three sections, mono eyebrow + hairline:

- **`IN THIS SCENE`** — 2-column grid of attached assets: 112px media, kind badge (`CAST` / `LOCATION` / `PROP` / `BLOCKING`), name, state. Blocking diagrams render here as a small schematic. **This is where a state is chosen.** Things that can plausibly change mid-scene carry a small **changes →** chip: set the after-state and the beat it turns on and the chip reads `closed → open · when she sets it down`; shots before the beat inherit the before-state, shots after inherit the after-state, automatically. Clicking an inheritance chip elsewhere rings its card here (`--accentLine`).
- **`STYLE IN FORCE`** — one card: `Zephyr — anamorphic, cold` / *2.39:1, 40mm, practical light only. Grain held at 12. Inherited from the production.*
- **`SCENE OVERRIDES`** — removable chips (`no score`, `handheld`, `practical light only`), reason on hover. *Overrides apply to every shot in this scene.*

---

## 7. The shot view — stills, then takes

The soul screen. **The standing furniture is: header · ONE contact sheet · one action row · the note chips · the collapsed prompt drawer.** Everything else arrives when summoned. If a state shows more, something is at the wrong altitude.

### 7.1 Header block

Setup line (`400 13.5px --secondary`) + `7 TAKES · 2 KEPT` mono meta; a quiet gap line when a gap blocks this scene (*2 gaps block this scene · open shelf* — the **only** gap surfaced on a shot screen); the **inheritance row** `↳ Zero (hero jacket) · Mara (grey coat) · Apartment (morning) · The case (out of frame) · SC 3 blocking · scene overrides`; the staleness banner when stale. The text column has `min-width: 220px` and the row wraps — never `min-width: 0` on the label.

### 7.2 Generating banner (when in flight)

`--accentWash` band: spinner · *Drawing the first take* · live clock (`--accentInk` past p90) · the read-back sentence · **Stop this take** / **Take it out of the queue**. The read-back branches on elapsed against the measured distribution `{p50, p90}` (placeholders 34s / 62s; the build derives them per engine):

- queued → *Nothing has been drawn for this shot yet — it goes next. Once it starts, half of takes land inside 34s.*
- < p50 → *Half of takes land by 34s. You are 18s in, so on a normal one there are about 16s to go.*
- p50–p90 → *Past the median. Half had landed by 34s and nine in ten land by 62s, so most of what is left arrives inside the next 24s.*
- > p90 → *Past 62s, where nine in ten have already landed. Unusual but not broken — it will still appear here, and if it never does the credits come back on their own.*

This is the same language as casting's refine wait. Do not invent a different sentence.

### 7.3 Stills before video — the frames stage

Expensive video is gated behind a cheap image step. **While a shot has no video takes, frames ARE the body:**

- A bordered stage (dashed until a frame is kept, solid after): `FIRST FRAME` + *Four stills, image-priced. Keep the one that has the reference, the blocking and the light right; video is drawn from it.*
- Four `16:9` frame tiles (`minmax(196px, 1fr)`). Hover → glass **Draw video from this**. The kept one: `3px --accentSolid` underline + `ANCHOR` accent pill; caption `FRAME 02`.
- Action row: **Draw 4 video takes from frame 02 · 24 cr** (inert *Keep a frame to draw video* until one is kept) · **4 more frames · 4 cr** · note *Nothing moves until a frame is kept. A still costs a sixth of a take.*

**The moment video takes exist, the stage collapses itself to one line**: a 44 × 25 anchor thumbnail with accent underline · `ANCHORED ON FRAME 02` · *· change*. Click to expand; **Done** collapses it again. The two contact sheets are never both open, and there is no manual "hide" link.

**One paid draw button per screen state.** Before takes exist the frames stage owns it; after, the takes row owns it. Never two.

### 7.4 The takes grid

`repeat(auto-fill, minmax(212px, 1fr))`, `gap: 16px`. Pending slots first (dashed `16:9`, spinner on the live one, *take renders here* on the live slot only — never *or browse files*; empty slots carry nothing). Then takes:

- `16:9` tile, `--media`, `--border`; `--accentLine` when kept; `cursor: zoom-in`; click → take viewer.
- **One hover control: the star**, a 28px glass circle top-right. Filled when kept. There is no play button on the tile — hover plays the take in place; the star is the only thing that competes for the thumb.
- Kept: `3px --accentSolid` underline. One state, one signal — no border change, no check badge.
- **Starring animates the take into the cut strip** (`cinSlide .42s`). Multiple keepers per shot allowed.
- Caption: `TAKE 03` (or `TAKE 03 · SETUP B`) + duration.

### 7.5 The action row — two buttons

Under the grid, `max-width: 680px`, hairline above:

**`+ Draw 4 takes · 24 cr`** (reads **`+ Draw 4 more · 24 cr`** once takes exist; hidden while the frames stage owns the draw) · **`✎ Give a note`** (tooltip *A note between takes — filed into the setup, shapes the next draw*).

Keep is not a button here — it is the star on the tile and in the viewer. The `2 kept` count lives in the header meta. Three things in one row read as clutter; two do not.

### 7.6 Notes — not a form

**Give a note** swaps itself for one inline input (ink border): placeholder *What should change next time? — she keeps looking at camera*, a file button, a close ×. Enter files it. The engine routes the note to a structured slot and shows it as a removable chip under `YOUR NOTES` with its slot label — `DON'T SHOW · looks at camera ×`. Click to edit, × to remove.

| Pattern | Slot |
|---|---|
| `0–2s …`, `3s: …` | `BEATS` |
| open on / start on / first frame / we open | `FIRST FRAME` |
| must not move / stays put / same mark / don't move | `STAGING LOCKS` |
| no / not / don't / never / keeps looking / out of frame / hide / avoid | `DON'T SHOW` |
| lens / mm / handheld / dolly / push / pan / tilt / tighter / wider / angle / eye level | `CAMERA` |
| otherwise | `BEATS` |

No notes yet: *No notes on this shot — the model is working from the scene alone.* A muted underlined **all direction fields** link opens the full five-field view (`BEATS` with timed rows + *Add a beat*, `FIRST FRAME`, `CAMERA`, `DON'T SHOW`, `STAGING LOCKS`) in `--well` boxes with 9px labels — *Optional. Fill any of these and the next contact sheet gets tighter — leave them and the model works from the scene alone.* The `CAMERA` row carries **Pick moves by eye** → §8, and shows the stacked moves as numbered chips.

`STAGING LOCKS`, never `LOCKS` — cast identity is not a lock you type.

**The escalation ladder**, shown once, when takes exist and none is kept: *Not what you wanted? Try more takes first — often it's luck. If the same thing keeps going wrong, give a note. If the ingredients are wrong, **Edit setup**.*

**Pose gap, road 2.** When two or more filed notes name orientation or physics (*back*, *lying*, *upside*, *harness*), a dashed card names the real fix: *Two notes running name how she is lying. That is usually a reference problem, not a wording problem — the model has never seen her like this.* → **Make "Zero, on her back" · free**. Resolving it attaches the pose to this shot and adds it to Zero's shelf tile.

**Edit setup starts a fresh contact sheet.** Label it so.

### 7.7 The prompt drawer — always visible

A collapsed handle at the foot of the work area, always present on a shot: `▴ THE PROMPT` — *the exact text sent to the engine · read-only*.

**Open:** the assembled prompt in mono `pre-wrap`, capped at 176px and scrolling, fixed-width labels `SCENE / WHO / WHERE / SHOT / SETUP / FRAME / CAMERA / BEATS / TONE / READ / EXCLUDE / STAGING / STYLE / OVERRIDES`. One action **Edit (starts a new setup)** + *Assembled from the scene document, your direction, and the style in force. Read-only here on purpose.*

**Editing:** eyebrow `EDITING · THIS STARTS A NEW SETUP`; draft in a `--lineStrong` box; `WHAT CHANGED` diff with `− ENGINE` (`--well`) and `+ YOURS` (`--accentWash`) rows; **Save as a new setup** · Discard · *Saving does not draw anything — the next take uses it.* On save, an offer card: *Keep this change for every shot in SC 3?* → **Whole scene** / **Just this shot**.

Its constant presence is the trust signal. Hiding it behind a menu says there is something to hide.

### 7.8 The take viewer

Fixed scrim (`--viewerScrim` + 6px blur), `2.39:1` frame up to 1000px, accent underline when kept. Beneath: `TAKE 03` + setup · **Save this take's sound** (kept takes only — lands on the shelf under `AUDIO` as `anchor · take 02`, then reads *On the shelf*) · **Keep this take / In the cut** star button · close. Escape closes; ←/→ step takes **with no on-screen hint** — it is discoverable. This viewer is not Create's viewer; different job, stays separate.

---

## 8. Camera, by eye

A modal (`max-width: 820px`, `max-height: 600px`) opened from a proposed shot's camera icon or the `CAMERA` direction row. Title *Camera, by eye* · *Proposed shot 2 · pick a move, or stack a few in order. The loop is the label.*

Grid `minmax(148px, 1fr)` of **13 moves**, each a `16:9` tile with a **looping CSS preview of the move** (push, pull, pan, tilt, handheld, orbit, crane, dutch roll, whip pan, rack focus, crash zoom, snorricam — static does not move), name and one line (*Camera fixed to the body; the world moves, she doesn't.*). Click stacks it: a numbered ink circle appears on the tile. Footer: `STACKED` · *Push in → Rack focus* · Clear · **Done**.

Stacked moves file into the shot's `CAMERA` slot as ordered chips. Nobody knows what a snorricam is; everyone knows it when the loop plays — the same principle as the look cards.

---

## 9. Modals off the production bar

### 9.1 Export cut — not designed yet. Stub the button.

### 9.2 Production settings (click the production chip)

`max-width: 560px`, `max-height: 552px`. Header `PRODUCTION` + name + close. Sections with mono eyebrows:

- **`YOUR PRODUCTIONS`** + `+ New` — a list of every production in the workspace: status dot · name · derived line (`6 scenes · 7 of 10 shots covered`, `3 scenes · nothing drawn yet`) · last worked · `OPEN` pill on the current one. Click switches production. **This is the only project switcher.**
- **`NAME`** — editable.
- **`THE LOOK`** — `INHERITED BY EVERY SHOT`; a horizontal row of the six look cards, current one underlined. Note: *2.39:1 · 40mm · practical light · Changing it flags the 7 shots already drawn for review rather than redrawing them.*
- **`ASPECT`** — segmented `2.39:1 · 1.85:1 · 16:9 · 9:16`.
- **`INTENDED LENGTH`** — the same three chips as the idea road, with a derived note about where the film stands against it.

Footer: *Changes save as you edit. Nothing already drawn is redrawn.* · **Done**.

---

## 10. The Composer — the whole intended film

**The shelf and the cut strip hide here**; the timeline *is* the cut at full size.

Three regions: **source panel** (246px, left) · **player** (centre, large) · **timeline** (bottom).

### Source panel — the production's own material, no uploads

`IN THE CUT` + `7 takes`. Per scene: number, name, then kept takes as rows (thumb with accent underline, type, `take 02 · 8s`); scenes with nothing kept show one dashed row (`BEING DRAWN` / `NOTHING KEPT`) linking to the Desk. Then `AUDIO`: the shelf's tracks. **There is no upload panel.**

### Player

Fills the centre: `width: min(100%, 100cqh × 2.39)`, `2.39:1`, with a slate `SC 3 · TWO-SHOT — KITCHEN` top-left. In a hole the player says why: `BEING DRAWN` / *The first take of this scene is being drawn now.* · `NOTHING KEPT YET` / *Shots exist but no take has been kept.* · *No shots yet — write the line on the Desk.* Transport: time `0:06 / 0:33` · step back · **42px ink play/pause** · step forward · `2.39:1`.

### Timeline — holes included

`THE TIMELINE` · `0:33 intended · 0:21 kept`. A 64px label column and three rows: **scene bands** (`flex: <span>`), **`PICTURE`** (one solid clip per kept take with an accent top edge; one dashed clip sized to the planned duration for scenes with nothing kept — `being drawn` pulsing / `nothing kept` / `no shots`; click a dashed clip → that scene on the Desk), **`AUDIO`** (clips with `AUDIBLE` / `TIMING ONLY`; unwritten cues dashed). Ticks at 0/25/50/75/100%; a 2px accent playhead through all rows.

`0:33 intended · 0:21 kept` is the production's real state in six words.

---

## 11. The cut strip

`flex: none; height: 76px`, `--surface`, on Wall and Desk only. `THE CUT` + `7 takes`; keepers as 88 × 50 thumbs in story order with a `1.1` / `1.2` / `2.1` badge (scene.shot, reads as a slate), type and duration; first item carries the playhead; right: `0:21` + play. Empty: five dashed ghosts + *Star takes to build your cut.* Starring on the Desk slides into the strip; drag to reorder; click → that shot.

---

## 12. Structural rules — each shipped as a real defect in the prototype

1. **The frame never scrolls; each view owns its scroll.**
2. **Any `flex: 1` text beside `flex: none` controls gets a `min-width` floor and the row wraps.** Never `min-width: 0` on a label.
3. **No `margin-*: auto` in any wrapping row.** Spacer elements only.
4. **Dashed vs solid is load-bearing.** Never dash a thing that exists or solidify a thing that does not.
5. **Every count, status, gap, ETA and next-action is derived.** None typed.
6. **Every paid action shows its price on the button; nothing says `free`.**
7. **Accent appears only on generating and kept.** Grep for `accent` and justify each hit.
8. **A stub names a place, never a capability.** Where the engine is not wired, the button is inert and says so.
9. **One paid draw button per screen state.**
10. **Nothing regenerates from an edit.** Chips only.

---

## 13. What NOT to do

- Add actions to Wall cards, or a third "Start blank" door.
- Show the six scene fields before a line or script exists, or as empty questions on the script road.
- Block on dramaturgy. Advisory chips only.
- Draw before approval; charge before a take lands; draw video before a frame is kept.
- Show the five direction fields by default, or a play button on the take tile, or a `kept` counter in the action row.
- Make cast identity editable text, or offer upload for a face.
- Put a coverage readout, credit balance or lock pill on the production bar.
- Show the shelf on Script or Composer; put a scene selector on the Editor; let the Editor create scenes.
- Give a manifest row hover buttons — click opens the drawer.
- Write *version*, *render*, *generate*, *output*, or `free`.
- Merge the take viewer with Create's; hide the prompt drawer behind a menu; show arrow-key hints in the viewer.
- Size Map segments equally; invent an ETA sentence; use `LOCKS` for staging.

---

## 14. Build order

Ship as separate PRs. Each ends with a promotion pass.

1. **Frame + production bar + view toggle + empty views + production settings shell.** Rail destination goes live.
2. **Data model.** Production → scenes → shots → frames → takes → setups → keepers; the shelf's identity/state model; the manifest ↔ shelf 1:1 map; derived status, coverage, gaps, staleness, next-action.
3. **New production modal.** Doors, both roads, proposed scenes, the look.
4. **The Desk — scene half.** Rail, blank scene, document (source block follows the road), proposal (inheritance, camera chips, pose road 1), context panel with mid-scene changes.
5. **The Desk — shot half.** Frames stage + self-collapse, takes grid, star, two-button row, notes + routing, direction fields, pose road 2, ladder, prompt drawer, take viewer, generating states.
6. **Camera, by eye.**
7. **The cut strip.**
8. **The Wall.** Three densities, NEXT line, drag between lanes.
9. **The shelf.** Four groups, nested states and poses, gaps, NEEDED row, audio modes.
10. **The Script view.** Page, margin notes, advisories, manifest, drawer, editor.
11. **The Composer.**
12. **Wiring to the engine.** Until this lands, every draw button is an honest inert stub.

---

## 15. Definition of done — per PR

- [ ] Both themes, against real media.
- [ ] No hex literals; `token-guard` extended over `features/cinema/`.
- [ ] Every count on screen is derived; change the data and the number moves.
- [ ] Accent only on generating and kept states.
- [ ] Dashed only on things that do not yet exist.
- [ ] Every paid button shows a price; no button says `free`.
- [ ] No `margin-*: auto` in a wrapping row; no `min-width: 0` on a text label beside `flex: none` siblings.
- [ ] The frame's `scrollHeight === clientHeight` on every view.
- [ ] 1024 × 540: nothing clipped, nothing behind a horizontal scroll.
- [ ] Every screen state matches the prototype file, not this document's memory of it.

---

## 16. Amendments agreed after consolidation

**This section is part of the brief. Where it and §§0–15 disagree, §16 wins.** Everything here was decided with the founder after the consolidated file was written; nothing here has a prototype screen yet unless noted.

### 16.1 Staleness — "See what changed"

The staleness banner (§5.6) gains one action: **See what changed** — a small before/after of only the changed scene-document fields (`WHAT HAPPENS · was → is`), in the prompt drawer's diff treatment (`− WAS` / `+ IS`). Dismiss and review both remain; the diff is how the user decides whether drawn takes are still good. Never decide blind.

### 16.2 Supply roads — casting stays in the studio; gaps watch

The manifest drawer's Person card (§4.5) is corrected:

- **From your casts** — import; the primary road. Unchanged.
- **Make them in casting →** — this **navigates** to the casting studio with the role's brief carried from the page. The manifest row stays behind as a **watching gap**: it resolves itself the moment the new cast is signed, with no re-import step. Casting is never embedded inside Cinema.
- **Generate a reference · price** — the Editor draws a look reference in the production's look. Honest line: *A look to hold onto, not a guaranteed identity — right for background people and crowds. Cast your leads.*

Fidelity is a recommendation, never a gate: casting the mains/sides/groups is *recommended* for a high-fidelity film, and nothing blocks without it. Faces are still never uploaded.

### 16.3 States — derived from the master, born where needed

- **Every bucket has a MASTER reference** (a cast's: the signed face + default sheet). Every state card — outfit, pose, condition (`wrecked`), machine config (`hatch open`) — is **generated FROM the master** (base untouched), never from scratch. `+ Generate from master` lives in the bucket's open tray **on every surface** (shelf tray, drawer, casting studio): describe the state in a line, four options, keep one.
- **Depth scales with use.** A state starts as a single view — that is enough, because identity rides the master into every shot (the face panel attaches alongside; the state card only has to show the clothes/pose). When a state's `IN n` reaches ~3, its card quietly offers *Build the full sheet · price* (2–3 derived views). Never required.
- **Angle tip**: when a shot's camera films a side its attached state card doesn't show (*shot from behind; the card is front-only*), the shot card grows a dashed line offering the missing view (*Add the back view · price*). Detected, never enforced.
- Mid-scene changes (§6.5 `changes →`) and pose roads 1–2 (§6.4, §7.6) are unchanged; poses, conditions and wardrobe are **one state grammar** — same decision roads, same mint options, same per-shot attach scoping.

### 16.4 Masters are immutable; promotion lands one level down

- A master is written once (at casting's Sign) and is **immutable**. No generated output can become or overwrite one; no gesture outside Sign creates one.
- A take is only ever an output until explicitly saved, and saving files it **one level down** — a card inside a bucket, under its master. Never as a master.
- **Every generated image records its parents** (the masters/states attached when it was drawn), shown quietly on its card: `drawn from Zero · The mecha`. A two-parent take saved to a bucket becomes a **relation card** (filed in one chosen bucket, default the cast in frame; both parents shown) — attachable to shots where those identities appear together, locking their scale and placement.

### 16.5 The posture — defaults, tips, and tools; never gates

Nothing about references is gated. Save anything to a bucket **as-is**. The system's knowledge appears exactly three ways:

- **Defaults** — the engine scopes and attaches references well on its own when it writes prompts (identity plates scoped broad; contextual images scoped narrow — *pose and placement from this image only*). The user never manages scoping.
- **Tips** — one quiet dismissible line where the research says a choice underperforms (*Busy backgrounds tend to drag their scene into the shot — outfits work best as clean plates*). Never a refusal.
- **Tools** — the **Plate Maker**: drop any image (a take, an upload), get a clean reference plate anchored on the master where one exists; priced on the button; offered in the bucket tray, the take viewer, and upload flows. Reached for, never required.

Cards may carry a **job hint** (`identity` / `look` / `pose & relation`) that the engine reads for scoping; hints are inferred, editable, and never something the user must manage. Two rules stay hard because they are product law, not craft: **faces are never uploaded; masters are immutable.**

### 16.6 The attach picker — ranked, never restricted

Opening a cast's bucket anywhere in Cinema shows **everything she has**: master and plates first, states next, then **all her takes**, browsable and searchable. Everything is attachable — including a "wrong" choice, which gets one dismissible tip with the Plate Maker beside it. Ordering is the only lever.

### 16.7 New take, anywhere

`+ New take` on any open bucket tray (shelf, drawer): a one-line ask with @-mentions — *"@maria holding @the-case in front of @mecha"* — mentions resolve to removable attachment chips under the input; fan of four, priced on the button. Outputs file under the **primary cast's takes** (visible in her bucket on every surface), tagged with the production they were made in. Same takes engine as casting; one home.

### 16.8 Tags — nobody names anything; the @ picker is a thumbnail browser

`@` works in **every prompt and free-text input across the app** (Cinema, casting takes, the Editor, Assets, future surfaces). The rules:

- **A tag always points at real media** (an image, video, or audio reference). A script-mentioned thing with no reference yet is a **gap wearing a name**: it appears in the @ picker greyed with *no reference yet — make one?* (generate / upload right there); it becomes a real tag the moment it has media. Plain prose ("a briefcase") remains the road for things that don't need to be the *same one* every time.
- **There is no naming step, anywhere.** Keeping anything — a take starred, a look saved to a bucket, an upload kept, one image out of a thousand generated in a future endless-generation surface — makes it **instantly @-findable**. The system derives a handle silently from the words that made it and what it shows; the user never types, confirms, or sees a naming form.
- **Finding is visual, not a memory test.** Typing `@` opens a **thumbnail picker**: current production's material first, then recent, then everything; a few typed letters filter against the handle, **the prompt that made it**, and the identities in it (`@grey`, `@alley`). The user recognizes the picture and clicks — the same eye-picks-from-a-contact-sheet gesture as everywhere else.
- **Casts keep their real names from Sign** (`@maria` — the one place names are first-class). States and derived cards show **under their owner** in the picker. Renaming anything is optional curation, available everywhere, and propagates (the name is referenced, never copied).
- **One dialect** on every surface; translating to each engine's addressing (tags, image numbers, prose roles) is the prompt assembler's job — the user never learns that dialects exist.

Against the competitor: Higgsfield makes you stop, open a menu, "Create Element," and name it. Here, **keeping is the filing** — there is nothing else to do.

### 16.9 Build notes for the wiring PR (§14.12)

1. **The wire attachment rule**: what "the master rides into every shot" means at the wire is the **face panel** (head crop, outfit-free) — never the birth-outfit body views. Per shot: face panel + the one applying state card + a scope line per reference; or a complete per-state sheet (face assembled inside it) alone. **Two outfits never share an attachment list.**
2. **Picture lock is deferred, not deleted**: when Export (§9.1) is designed, exporting freezes a **named version of the cut** — that is the lock. Until then, every draw sits behind an explicit priced click and that is the money guard.
3. **The first-frame promise softens per engine**: "video is drawn from it" holds only on engines that accept a start frame. Where one doesn't, the anchor attaches as the strongest reference and the copy must not promise "drawn from it."
4. **Real prices at build**: the drawer's `Mint a new cast · 4 cr` and every other placeholder price must carry the live credit table's numbers. The every-paid-button-shows-its-price law means the truth, not the placeholder.
5. Wait numbers (`34s` / `62s`) derive from the live per-engine distribution — already stated in §7.2; restated here because it is a wiring task.

### 16.10 The Yuna-thread amendments (founder-ruled 2026-10-08; this subsection wins where it disagrees with anything above)

From the design conversation with the founder's Grok team (Notion, Yuna's "Cinema editor" page), each point his word:

1. **TRY THE SHELL.** One frame instead of four tabs: characters, scenes, script and media pinned in a LEFT PANE (Script becomes a left-pane tab); the CENTRE switches between two modes — **Shots** (the Desk work: scene document, proposals, takes contact sheet, "In this scene", with the Wall as its zoomed-out read-only view) and **Watch** (the Composer, three tracks: picture / voice / music, all dashed where nothing is kept); the ASSISTANT stays right in both modes. The four stages and all their laws survive inside the shell: the zoomed-out view only reads; ONE list of materials (gaps as dashed rows under their left-pane sections — characters, places, voice — never a second shelf); approval before anything paid; staleness chips never regenerate.
2. **THE PROMPT LEAVES THE MAIN ROAD.** §7.7's always-visible drawer is superseded: each take carries a quiet **"How this was made"** in its details — plain words only (the references used, the notes applied, the look; no engine names, no block order). The exact assembled text sits one click deeper behind **"Show the exact instructions"**; editing it starts a new SETUP in the model and the record ("setup" stays the internal noun; "version" never appears anywhere). **On screen the noun is dropped entirely — the founder picked the plain line on sight of the round-3 frames (2026-10-08):** the line reads "Changing this only affects new takes. Your current takes stay." and the button reads "Edit for new takes". No "setup" and no "version" in customer copy.
3. **TAKE COUNT IS THE CUSTOMER'S CHOICE, STARTING AT ONE.** Nobody is forced into a fan. The button reads **"Make 1 take · N credits"** with a small − / + beside it (+ greys at 4); the price updates live. **The film does NOT remember a last take count — every shot starts at 1, every time, and choosing more is the customer's act each time (founder, 2026-10-08 9:29pm, superseding the earlier remembered-count line).** The SERVER caps takes per click (~4) and charges only for takes it actually starts; **the click carries the total the button showed, and the server refuses a mismatched total (stale page, another tab) and returns the new total for the customer to confirm — the price shown is always the price charged (Squall's check, 2026-10-08);** credits for every take are set aside at click; **each failed take refunds itself** ("3 of 4 takes came back. N credits returned for the one that didn't"). Same price per take, no multi-take discount. Insufficient balance: the button reads "You have enough for 2 takes" (Free accounts link to plans; paying accounts to top up). Wait copy shows no invented numbers — "Making N takes…" until OUR per-engine timing distributions are logged (the §7.2 sentences activate only on our own measurements).
4. **Smaller ruled details:** uploads wear a quiet greyscale tray glyph ("Uploaded"), normal fill on tracks, library filter All · Made here · Uploaded, never priced; the timeline readout says **"planned"**, not "intended"; screens say **"characters"** (specs may say casts); paid buttons read "Make · N credits"; the export popover (the face of lock-in-export) shows length, size, cost and what's missing — **no watermark line** (no watermarks exist on any plan); everything before the shot list is approved is words and preset stills with no prices on screen; staleness copy names the count ("This scene changed. Check these 3 shots.").
