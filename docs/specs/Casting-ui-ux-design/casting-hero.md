# Casting hero — build spec

Replaces whatever currently sits at the top of the Casting page. Live reference: `Klieg Studio.dc.html` → Casting tab (the panel above the search row). Where this doc and the prototype disagree, the prototype wins.

Everything here uses tokens from `client/src/foundation/tokens.css`. No hex literals — the token-guard test will fail you.

---

## 1. What this section is for

The old casting page opened straight into the roster. That answers "who do I already have?" but not "how do I get someone?", which is the only question a new user has. This hero answers it in one screen and does three jobs at once:

1. **States the promise in one line** — you describe a person, you get eight of them.
2. **Takes the input right there** — the prompt field is in the hero, not behind a button.
3. **Shows the output before you commit** — a live deck of already-signed cast, each with the brief that produced them.

That third job is the one that matters. A prompt field alone asks the user to imagine the result; the deck shows it. Every card in the rotation is paired with the exact words that cast that person, so the user learns what a good brief looks like by reading real ones rather than by reading instructions.

**Do not replace the deck with a static illustration or a stock hero image.** The whole argument of the section is that these are real signed performers and those are their real briefs.

---

## 2. Structure

One card, two columns, wrapping to stacked below ~700px.

```
┌───────────────────────────────────┬────────────────────────────┐
│ CASTING                           │      ╱‾‾╲   ┌────────┐     │
│                                   │     ╱ pk ╲  │        │  ╲  │
│ Say who you need.                 │              │ CENTRE │   ╲ │
│ Meet eight of them.               │              │  4:5   │    │
│                                   │              │        │    │
│ A cast member is a face, a voice  │              │ Maya R.│    │
│ and a way of talking — signed     │              └────────┘    │
│ once, reusable in every campaign…  │                            │
│                                   │  CAST FROM THESE WORDS ──── │
│ ┌───────────────────┬───────────┐ │  "A skincare founder in her │
│ │ a dad in his 30s… │ Cast it → │ │   forties, unbothered…"      │
│ └───────────────────┴───────────┘ │                             │
│                                   │  ▬▬ ── ── ── ──             │
│ ⚙ Prefer controls? Set the spec   │                             │
│                                   │                             │
│ TRY  (chip)(chip)(chip)(chip)     │                             │
└───────────────────────────────────┴────────────────────────────┘
```

**Container**
```css
border: 1px solid var(--borderCard);
border-radius: var(--r-2xl);          /* 14px */
background: var(--raised);
overflow: hidden;
display: flex; flex-wrap: wrap; align-items: stretch;
```

**Left column** — `flex: 1 1 420px; min-width: 344px; padding: 28px 28px 24px;` column flex, `gap: 14px`, `justify-content: center`.

**Right column** — `flex: 1 1 330px; min-width: 302px; min-height: 452px;` `background: var(--page)`, `border-left: 1px solid var(--border)`, `overflow: hidden`.

The two `flex-basis` values are the load-bearing numbers. They let the columns share a row down to ~750px and then wrap cleanly, with no media query. Don't convert them to percentages or fixed widths.

---

## 3. Left column, top to bottom

| Element | Spec |
|---|---|
| Eyebrow | `500 10.5px var(--font-mono)`, `letter-spacing: .12em`, `--meta` — `CASTING` |
| Headline | `h1`, `500 31px/1.08 var(--font-sans)`, `letter-spacing: -.038em`, two lines with an explicit `<br>` |
| Explainer | `400 13px/1.65`, `--metaStrong`, `max-width: 430px` |
| Prompt field | wrapper `padding: 12px 14px; border: 1px solid var(--borderInput); border-radius: var(--r-md); background: var(--surface)`; hover `border-color: var(--lineStrong)`. Input is borderless/transparent, `400 13px`, `--ink`, `flex: 1; min-width: 0` |
| Cast it | `padding: 8px 14px; border-radius: var(--r-btn); background: var(--ink); color: var(--surface); 500 12px` + 12px arrow. `flex: none`. Hover `opacity: .86` |
| Spec toggle | icon + `400 11.5px`, `--metaStrong` → `--ink` on hover. Label flips between "Prefer controls? Set the casting spec" and "Hide the casting spec" |
| Locked-traits pill | only when ≥1 trait is set: `--accentWash` bg, `0 0 0 1px var(--accentLine)` ring, `--accentInk` text, `500 9.5px` mono. Reads "3 traits locked" |
| TRY row | mono `500 10px` `.1em` `--muted` label, then the seed chips |

### The headline is two sentences, deliberately

**"Say who you need. Meet eight of them."** The second sentence is the product's actual differentiator — that a brief returns a *sheet of candidates*, not one image. Cutting it to a single line loses the only fact a new user needs.

### Seed chips — the detail that gets broken

```css
flex: none;                 /* ← REQUIRED */
white-space: nowrap;        /* ← REQUIRED */
padding: 5px 10px;
border: 1px solid var(--border);
border-radius: var(--r-pill);
background: var(--surface);
font: 400 11.5px var(--font-sans);
color: var(--secondary);
```
Hover: `border-color: var(--accentLine); background: var(--accentWash); color: var(--accentInk)`.

`flex: none` is not optional. These are flex children in a wrapping row; with the default `flex-shrink: 1` they compress below their own text and each chip breaks onto two lines, which drags the whole column taller. This exact bug shipped in the prototype twice.

Chips must be **labels, not sentences** — "Skincare founder, 40s", "Gym rat, ring light", "Bodega owner, gravelly", "Night-routine whisper". Four of them. If a chip needs a comma and more than four words, it's prose and belongs in the placeholder instead.

Clicking a chip fills the prompt field; it does **not** submit. The user should see what they're about to send.

---

## 4. Right column — the deck

Two stacked areas: the deck (`flex: 1`, centred) and the brief block (`flex: none`).

### Deck geometry

Three cards from one array, offsets `[-1, 0, +1]` around a rotating index. All three are absolutely positioned in a centred flex container.

| | Centre | Peeks |
|---|---|---|
| width | `min(58%, calc((100cqh - 18px) * 0.8))` | `min(46%, …)` |
| transform | `none` | `translateX(±62%) rotate(±7deg) scale(.9)` |
| opacity | 1 | 0.34 |
| z-index | 3 | 1 |
| border | `var(--borderCard)` | `var(--border)` |
| shadow | `var(--shadowCard)` | none |

Every card is `aspect-ratio: 4/5`, `height: auto`, `border-radius: var(--r-lg)`, `overflow: hidden`, `background: var(--media)`.

**The width expression is doing real work.** Set `container-type: size` on the deck's wrapper, then `100cqh` is the deck's own height. Width is capped by *both* the container's width (58%) and by what fits the available height at 4:5 — so the deck reflows correctly whether the column is short and wide or tall and narrow, with no media query and no JS measurement. Setting `height` and `width` together instead will break the ratio: `aspect-ratio` only resolves an `auto` axis.

Transition on the centre-swap: `transform .52s var(--ease), opacity .52s ease, box-shadow .52s ease`.

### Rotation

- Advances every ~4s.
- **Pauses on hover of the whole right column** (`onMouseEnter` / `onMouseLeave` → a `heroHeld` flag). A moving target the user is trying to read is hostile.
- Clicking a **peek** brings it to centre and releases the hold.
- Clicking the **centre** opens that cast member's room.

Both clicks are required. A carousel where the off-centre cards are decorative teaches the user the deck isn't interactive.

### Centre card caption

Only the centre card gets one — name + frame count over a scrim gradient:
```css
background: linear-gradient(to top, var(--scrimPill), transparent);
padding: 26px 11px 10px;
pointer-events: none;
```
Name `500 11.5px`, `--onScrim`, ellipsis-truncated. Meta `400 9px` mono at `rgba(255,255,255,.72)`.

### Brief block — the point of the section

```
CAST FROM THESE WORDS ────────────────
"A skincare founder in her forties, unbothered, talks
 like she has said this a hundred times and still means it."
▬▬ ── ── ── ──
```

- Eyebrow: `500 8.5px` mono, `.13em`, `--faint`, followed by a `--rule` hairline filling the row.
- Brief: `400 13.5px/1.6`, `--ink`, `text-wrap: pretty`, in typographic quotes.
- **`min-height: 60px`** on the brief — briefs vary in length, and without a floor the deck above jumps every rotation.
- Progress ticks: one 3px bar per card. Current = `--ink`, past = `--lineStrong`, future = `--border`. The current tick animates its width over the dwell time, and freezes when hovered.

The brief must be the **real** brief for the card on screen — same array index, changing together. Pairing a face with someone else's words destroys the only thing this block is for.

---

## 5. Data

One array, three fields per entry: display name, frame count, and the brief that cast them. Five to seven entries.

Use **real signed cast from the account** where available, newest first, so the hero is a live shelf rather than marketing copy. Fall back to a curated set for a new workspace with an empty roster — and in that case say so in the eyebrow (`EXAMPLE CASTS`), because claiming an empty roster has signed performers is a lie the user will catch immediately.

---

## 6. Behaviour

- **Enter** in the prompt field submits, same as Cast it.
- Submitting starts a casting roll from the typed text and moves the user to the candidate sheet.
- The spec toggle expands the full trait panel (age / build / heritage / hair / texture / colour / eyes / skin / marks / looks) **in place, below the hero** — never as a modal. Its locked-trait count feeds the accent pill.
- Nothing in the hero is charged. The first credit spend is the roll itself, priced on the roll button.

---

## 7. Definition of done

- [ ] Deck visible without scrolling at 1440×900, with both peeks in frame.
- [ ] Seed chips are one line each at every width from 344px column upward.
- [ ] Brief text always matches the centre card.
- [ ] Rotation pauses on hover; peeks are clickable; centre opens the cast room.
- [ ] Deck reflows without a media query — check at 700px, 1024px, 1440px, 1920px.
- [ ] Columns wrap to stacked below ~700px with no overflow.
- [ ] `min-height: 60px` on the brief; no vertical jump between rotations.
- [ ] No hex literals; token-guard passes.
- [ ] Both themes: the peek cards must still read as cards in dark, not as holes.

---

## 8. One thing to watch when you integrate

The hero, the search row and the roster grid must all live inside **one** `max-width: 1240px; margin: 0 auto` container. In the prototype a stray closing tag put the hero inside it and the roster outside, and the roster silently stretched edge-to-edge on wide screens while the hero stayed centred. It looks like a design decision until you notice the left edges don't line up.
