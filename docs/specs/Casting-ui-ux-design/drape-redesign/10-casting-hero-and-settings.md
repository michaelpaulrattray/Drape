# Casting hero column + Cast settings modal

**One PR.** Two things, and they belong together because the modal's only entry point is a control in the hero column.

Live reference: `design_handoff_studio/Klieg Studio.dc.html` → Casting. Open it and use it. **Where this brief and the prototype disagree, the prototype wins** — and do not work from screenshots, this surface moved several times.

Supersedes the left-column half of `design_handoff_casting/casting-hero.md`. The deck half of that spec is unchanged and correct — you built it and it is right.

---

## 1. What changes

**The left column of the hero card.** Same content, restructured, plus one real addition. The right column (`HeroDeck`) is untouched.

**The trait panel behind the settings control is deleted and replaced.** `LOOKS / AGE / BUILD / HERITAGE / HAIR / TEXTURE / COLOUR / EYES / MARKS` has no counterpart in the product — the real settings are **Style** and **Imagination**, and the panel becomes a modal showing those two.

**Excluded:** the deck, the roster, the candidate sheet, the casting room, any query or mutation. `createRoll` still carries `imagination` and `style` exactly as it does now.

---

## 2. The left column

### 2a. Top group / spacer / bottom group — not a centred stack

This is the structural fix and everything else in this section is detail.

The column was one centred stack of ~277px inside a 452px card, so all its slack collected above and below the content: the column visibly floated while the deck beside it read full. Three parts instead:

```html
<div class="dpc-hero__say">        <!-- flex column, no justify-content -->
  <div class="dpc-hero__pitch">…</div>      <!-- flex: none  -->
  <span class="dpc-hero__air" />            <!-- flex: 1; min-height: 24px -->
  <div class="dpc-hero__ask">…</div>        <!-- flex: none  -->
</div>
```

Column: `flex: 1 1 420px; min-width: 344px; padding: 30px 28px 26px`.
Pitch group: `gap: 13px`. Ask group: `gap: 11px`.

Now the headline aligns with the top of the deck and the input row aligns with the deck's brief block at the bottom, so the slack sits in the middle where it reads as air. Deck column drops to `min-height: 424px` to meet it.

**The spacer is an element, never `margin-top: auto`.** Any computed-style read resolves auto margins to hard pixels, which then overflows a wrapping row and gets clipped by the card's `overflow: hidden` — live layout fine, every screenshot and export broken.

### 2b. Pitch group

| Element | Spec |
|---|---|
| Eyebrow | `500 10.5px var(--font-mono)`, `.12em`, `--meta` — `CASTING` |
| Headline | `500 37px/1.05`, `-.042em`, two lines with an explicit `<br>` |
| Explainer | `400 13px/1.65`, `--metaStrong`, `max-width: 430px`, `text-wrap: pretty` |

**Headline goes 31px → 37px.** 31px is the size of an ordinary section `h1` elsewhere in the app; this is the one statement the page makes and it was reading as a section head.

Copy unchanged: **Say who you need. / Meet eight of them.** The second sentence is the differentiator — a brief returns a *sheet*, not one image. Do not cut it to one line.

### 2c. The brief box grows

You already fixed this in `BriefField` and the reasoning in that file is right — this is the same component, in the hero, with its container adjusted.

Row: `display: flex; align-items: flex-end; gap: 10px; padding: 11px 13px 11px 14px`. `align-items: flex-end` so **Cast it** stays on the baseline as the box grows.

Field: `rows="1"`, `resize: none`, `padding: 4px 0 3px`, `max-height: 84px`, `400 13px/1.5`.

Two things to get exactly right, both of which shipped wrong here first:

- **`overflow-y: hidden` at rest, switched to `auto` only when the cap bites.** Set it in the same place you set the height: `el.style.overflowY = el.scrollHeight > CAP ? "auto" : "hidden"`. A `rows="1"` box whose content exceeds one line exposes a scroll widget the `<input>` never had, and the measure only runs on change — so an untouched box is never measured and shows the widget at rest.
- **The placeholder must fit one line at this width.** `a dad in his 30s, dry humour`. The old 100-character placeholder wrapped to three lines in a one-row box and was clipped mid-sentence. The deck's brief block beside it already demonstrates a full-length brief, which teaches it better than a placeholder can.

`height: auto` before reading `scrollHeight`, as `BriefField` already documents.

### 2d. The receipt line — new

Directly under the field:

```
8 CANDIDATES · 4 CR · ~40 SECONDS ─────────────────────────
```

`400 10.5px var(--font-mono)`, `.03em`, `--faint`, `flex: none`, then a `flex: 1` hairline in `--rule`.

**Every paid button in the product is priced except this one.** The sheet's own `Cast eight` says `4 cr`; the composer says `4 credits`; the templates modal prices its run. The hero's primary was the only unpriced spend, and this also answers *what do I get* before you commit.

Numerals, not words — mono is the machine-value face.

**Derive all three from the same constants the roll uses.** A hand-written price that disagrees with the charge does the opposite of what this line is for.

### 2e. The actions row

One row, `gap: 12px`, `flex-wrap: wrap`, with a `flex: 1` spacer between the two:

**Left — the settings control.** Icon + current value, opening the modal:

```css
display: flex; align-items: center; gap: 7px;
padding: 5px 11px 5px 9px;
border: 1px solid var(--border);
border-radius: var(--r-sm);       /* 8px — NOT a pill */
background: var(--surface);
```
Hover: `border-color: var(--lineStrong); background: var(--fill)`.
Value: `400 10.5px var(--font-mono)`, `.02em`, `--secondary` — `Photoreal · Low`, from `castSettingsSummary`.
Glyph: the sliders mark (`P.filters`) at `--meta`.

Three deliberate choices, each correcting a misread:

- **No chevron.** The topbar already encodes this distinction: the account chip has a chevron and opens a dropdown, the credits chip has none and opens a modal. A chevron-down means "a list drops from here," and this control opened a modal while wearing dropdown grammar.
- **Radius 8, not a pill.** Pills in this system are read-only state — kind badges, count pills, `IN USE`. A rounded rect is what clickable controls use, so the shape says press rather than read.
- **Value in mono.** These are set values, and it ties the control to the receipt line directly above it, so the row reads as one thought: what this costs, how it is set.

**Right — `Start from photos`.** Image glyph + `400 11.5px`, `--metaStrong` → `--ink` on hover. Opens `ConceptUploadCard`'s flow.

The explainer already promises photos, and the flow already exists — but the only way in was a card further down the page. Both paths are now named in the row where you decide.

Different weights are correct here: the settings control displays state as well as acting, so it is a chip; `Start from photos` is purely an action, so it is a link.

### 2f. What is NOT in this column

**No TRY chips.** #375 removed them and the reasoning holds: a deck card already fills the field with a real brief, and a chip filled it with a sentence somebody wrote. Two mechanisms for one job; the deck is the better one.

**No candidate-count selector.** Eight is the promise, not a parameter — the headline says so. Below about six it stops being a comparison set, the saving is 2cr, and every decision placed before the button is a reason not to press it. If it is ever wanted it belongs in the settings modal as sheet size, not in the hero.

---

## 3. The Cast settings modal

Opened only by the control in §2e. Reachable at `max-width: 788px`.

### 3a. One card, two columns — no nav

The first version had a left nav (Style / Imagination) after the reference we were working from. It was wrong: the nav cost 182px of a 724px modal to switch between two things that both fit on screen, and the two settings are *read as one sentence* — `Photoreal · Low` — so hiding half of it behind a click is pure cost.

```
┌──────────────────────────────────────────────────────────────┐
│  Cast settings                          Reset all       ✕    │
├─────────────────────────────────┬────────────────────────────┤
│  STYLE                          │  IMAGINATION               │
│  The locked bundle every        │  What the studio does with │
│  candidate is photographed with │  the words you leave out.  │
│ ┌─────────────────────────────┐ │ ┌────────────────────────┐ │
│ │        ┌─────────┐          │ │ │ Low        DEFAULT  ✓  │ │
│ │  ‹  ╱  │ 4:5     │  ╲   ›   │ │ │ Your words, then the…  │ │
│ │        │Photoreal│          │ │ └────────────────────────┘ │
│ │        └─────────┘          │ │ ┌────────────────────────┐ │
│ └─────────────────────────────┘ │ │ Max                    │ │
│  A photographic casting…        │ │ Your words, rewritten… │ │
│            [ IN USE ]           │ └────────────────────────┘ │
├─────────────────────────────────┴────────────────────────────┤
│  These are defaults — your brief overrides them.      Done   │
└──────────────────────────────────────────────────────────────┘
```

Columns: Style `flex: 1 1 372px; min-width: 320px; min-height: 0`. Imagination `flex: 1 1 296px; min-width: 280px`, on `--raised` with a `--rule` left border. They wrap to stacked below ~700px.

### 3b. Shell

Scrim `var(--scrim)` + `blur(4px)`, `z-index: 48`, `padding: 28px`. Card `height: 100%; max-height: 524px`, `--r-2xl`, `overflow: hidden`. Header and footer `flex: none`; body `flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden`.

Header: **Cast settings**, spacer, **Reset all** (secondary, only when not at defaults), close button.
Footer: *"These are defaults — anything your brief says about the look, light or setting overrides them."* then **Done**.

⚠️ Mount at the app root. A `position: fixed` child resolves against the nearest ancestor with `transform`, `filter`, `backdrop-filter`, `perspective` or `will-change` — and the topbar has `backdrop-filter`. Verify the scrim's `getBoundingClientRect()` equals `{0, 0, innerWidth, innerHeight}`.

### 3c. Style — a carousel, because a style is a look

`CAST_STYLES` has one member and `COMING_CAST_STYLES` has two. A single chip plus a text list of two names reads as a broken selector; **one browsable deck of three cards** does not, and it shows what is coming instead of listing it.

Stage: `flex: 1 1 0; min-height: 118px; max-height: 268px; overflow: hidden; container-type: size`, `padding: 10px 20px`, `--page` background with `--rule` borders top and bottom.

Three cards from `[-1, 0, +1]` around the index, absolutely positioned, `aspect-ratio: 4/5`, `height: auto`:

| | Centre | Peeks |
|---|---|---|
| width | `min(46%, calc((100cqh - 6px) * 0.82))` | `min(34%, calc((100cqh - 6px) * 0.62))` |
| transform | `none` | `translateX(±80%) rotate(±6deg) scale(.88)` |
| opacity | 1 | 0.44 |
| border | live `--borderCard` solid / coming `--dashed` dashed | `--border` |
| shadow | `--shadowCard` | none |

Live styles solid, coming styles dashed — the system's existing rule: solid is a fact, dashed is not yet.

**Arrows sit on the stage**, `position: absolute`, 28px circles at `left/right: 12px; top: 50%`, `--barGlass` + blur + a `--border` ring. Not a row beneath — that row cost 52px and this is where a carousel's arrows live.

**The name is a caption on the centre card**, in a bottom scrim: `500 12px` `--onScrim`, with `COMING SOON` in `500 8px` mono beneath it when the style is not live. Both facts about a card sit together.

Below the stage, in a `flex: none` group:
- Description — `CAST_STYLE_LINES[style]`, `400 11.5px/1.6` `--metaStrong`, **`min-height: 38px`**
- One centred action, **`min-height: 26px`**, resolving to exactly one of:
  - current → `IN USE` pill, `--accentWash` + `--accentLine` ring + `--accentInk`
  - live and not current → ink button `Use {name}`
  - not live → `Not available yet — we'll say when it lands.` in `--faint`

**Those two `min-height`s are load-bearing.** Without them the flex stage absorbs their variance — the description is two lines for Photoreal and one for the coming styles, and the action swaps between a 26px pill and a 17px line — so the preview resized 18% every time you stepped the carousel. A comparison surface whose subjects change size as you step through them has no comparison left, the same argument as equal-width plan cards.

### 3d. Imagination — two cards, not a slider

`IMAGINATIONS = ["low", "max"]`. Two cards, `gap: 9px`, each `padding: 13px 14px`, `--r-lg`; selected gets `--accentLine` border, `--accentWash` background, `--accentInk` name and an `IN USE` pill. `DEFAULT` in mono `--faint` beside Low.

Each card carries its full `IMAGINATION_LINES` text at `400 11.5px/1.6`.

**Not a slider, and not a segmented control that hides the unselected line.** Max does not do *more* of Low — it rewrites your brief. A track between two stops invites someone to drag toward a middle that cannot exist and frames a behaviour switch as a magnitude; and either control would show only the selected consequence, when the consequence is the entire decision. Both lines stay on screen.

### 3e. What this modal must not become

- No third setting, no candidate count, no advanced section.
- No trait controls. Age, build, heritage, hair, texture, colour and marks are not settings in this product.
- No style chip row alongside the carousel — one mechanism.
- No green anywhere, including on `IN USE`.

---

## 4. What NOT to do

- **Do not centre the hero's left column.** Top group / spacer / bottom group.
- **Do not use `margin: auto`** in either the hero row or the modal. Spacer elements.
- **Do not leave the textarea's `overflow-y` on `auto`** at rest.
- **Do not restore the TRY chips.**
- **Do not put a chevron on the settings control**, and do not make it a pill.
- **Do not give the modal a nav column.**
- **Do not drop the two `min-height`s** below the carousel stage.
- **Do not put a fixed pixel height on the carousel stage.** It must flex, so it absorbs surplus rather than demanding height the card may not have. A `24vh` version of this was also wrong — it asks for a second independent viewport fraction that only pays out above ~1130px of window.
- **Do not let the card content-size.** `height: 100%` with a `max-height`, or it stops short and leaves height unused while the preview shrinks.
- **Do not hand-write the price, the count or the duration.**

---

## 5. Definition of done

**Hero column**
- [ ] Structure is pitch / spacer / ask; headline top-aligns with the deck, input row bottom-aligns with the brief block.
- [ ] Headline 37px, both sentences.
- [ ] Field is a textarea, one row at rest, grows to four then scrolls; no scroll widget at rest (probe an untouched field: `scrollHeight === clientHeight`, `overflowY === "hidden"`).
- [ ] Placeholder is one line at 320px column width.
- [ ] `Cast it` stays baseline-aligned as the box grows.
- [ ] Receipt line present, numerals, all three values derived.
- [ ] Settings control: no chevron, radius 8, mono value from `castSettingsSummary`.
- [ ] `Start from photos` opens the concept flow.
- [ ] No TRY chips, no count selector.

**Modal**
- [ ] Two columns, no nav; wraps to stacked below ~700px.
- [ ] Card `height: 100%; max-height: 524px`; header and footer `flex: none`; the action is never inside a scrolling region.
- [ ] Carousel: three cards, arrows on the stage, name as centre caption, coming styles dashed with `COMING SOON`.
- [ ] **Step through all three styles and measure the centre card — the size must not change.**
- [ ] Action resolves to exactly one of `IN USE` / `Use {name}` / not-available.
- [ ] Imagination: two cards, both `IMAGINATION_LINES` visible, `DEFAULT` on Low.
- [ ] `Reset all` appears only when off defaults and returns to `photoreal` + `low`.
- [ ] Scrim rect equals the viewport.
- [ ] **Check at 540px viewport height specifically** — every defect in this modal's history was viewport-height dependent and looked fine in a tall window.
- [ ] Escape and scrim-click dismiss; both themes; `token-guard` passes.

---

## 6. Then the promotion pass

Per `PROMOTION-PASS.md`.

**The fanned card deck now has three consumers** — the casting hero, the templates run modal, and this style carousel. It was deferred at one. Promote it: the stage, the three-card fan, the container-query sizing and the tilt as one component, with rotation, ratio and what-sits-beneath as settings. Each consumer keeps its own caption and its own footer.

Also check the receipt line (mono label + `flex: 1` hairline) — it is on the hero, the deck's brief block, Crew's section heads and the modal's column heads. If the section-head component from the staff briefs does not already cover it, this is the round where it should.
