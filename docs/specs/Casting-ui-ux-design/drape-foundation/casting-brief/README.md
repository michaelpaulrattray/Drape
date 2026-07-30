# Pitch + Handoff: Klieg Casting Studio

**To:** the agent building the Casting Studio
**From:** the agent that owns the Lobby and Canvas UI
**Reference file:** `Klieg Casting.dc.html` (open it — it's interactive; click through it before reading the rest)
**Screenshots:** `screenshots/01`–`07` — roster, sheet mid-generation, sheet with keeps, after a discard, back to roster, casting room, dark mode

---

## 0. Read first: the lobby doesn't exist yet

This document describes Casting as a room inside a studio whose **chrome and token system aren't built yet**. Everything in §4–8 assumes three things exist. They don't. So Casting is going to be the surface that **introduces** them, and you should build them as shared foundation rather than as part of the casting feature — otherwise the lobby has to be retrofitted to Casting later, which is the wrong direction.

### 0.1 Three dependencies, in build order

**1. The token file.** One stylesheet, `:root` for light and `body[data-theme="dark"]` for dark. Not casting-scoped — this is the app's palette. Paste both blocks verbatim from `Klieg Casting.dc.html`'s `<style>`; they are already the lobby's and canvas's system, so nothing needs reconciling later.

```css
:root{
  --surface:#FFFFFF; --raised:#FAFAFB; --page:#FCFCFD; --wellSoft:#F7F7F9; --well:#F6F6F8;
  --fill:#F4F4F6; --fillStrong:#F2F2F4; --media:#F1F1F3; --rule:#F0F0F2; --ruleSoft:#EFEFF1;
  --border:#ECECEE; --borderSoft:#EAEAED; --borderMedia:#E8E8EB; --borderInput:#E6E6E9; --borderCard:#E4E4E7;
  --dots:#DEDEE2; --dotsStrong:#DADADE; --dashed:#D6D6DA; --sink:#D2D2D6;
  --lineStrong:#C8C8CC; --lineSoft:#BFBFC5; --muted:#B4B4BA; --faint:#A0A0A6;
  --meta:#8E8E94; --metaStrong:#6B6B70; --linkHover:#5C5C61; --secondary:#3E3E42;
  --ink:#111112; --inkDeep:#0A0A0B;
  --barGlass:rgba(255,255,255,.92); --dockGlass:rgba(255,255,255,.94);
  --accentWash:#FEF2F0; --accentLine:#F1CDC6; --accentInk:#A23E33; --accentSolid:#E2685A;
  --accentWashHover:#FCE6EC; --onWash:#FFFFFF;
  --shadowCard:0 12px 34px rgba(17,17,18,.14);
}
body[data-theme="dark"]{
  --surface:#1C1C1F; --raised:#1A1A1D; --page:#141416; --wellSoft:#1F1F23; --well:#202024;
  --fill:#232326; --fillStrong:#26262A; --media:#232326; --rule:#2A2A2E; --ruleSoft:#2A2A2E;
  --border:#2C2C30; --borderSoft:#2C2C30; --borderMedia:#303036; --borderInput:#33333A; --borderCard:#33333A;
  --dots:#3A3A42; --dotsStrong:#3E3E46; --dashed:#44444C; --sink:#494951;
  --lineStrong:#55555E; --lineSoft:#5E5E66; --muted:#6E6E77; --faint:#8A8A92;
  --meta:#9A9AA2; --metaStrong:#9A9AA2; --linkHover:#B4B4BA; --secondary:#B4B4BA;
  --ink:#EDEDEF; --inkDeep:#F5F5F7;
  --barGlass:rgba(28,28,31,.92); --dockGlass:rgba(28,28,31,.94);
  --accentWash:rgba(226,104,90,.14); --accentLine:rgba(226,104,90,.32); --accentInk:#E88778; --accentSolid:#E2685A;
  --accentWashHover:rgba(226,104,90,.22); --onWash:#FFFFFF;
  --shadowCard:0 12px 34px rgba(0,0,0,.5);
}
```

Two rules that keep this from rotting: **never a raw hex in a component** (the only exceptions are white glyphs on a dark scrim and the brand orb's gradient), and **dark mode is only ever the `data-theme` attribute on `<body>`** — no per-component dark variants, no `prefers-color-scheme` branching in components.

**2. The app shell.** A 76px left rail + 56px topbar, both of which the lobby will reuse unchanged:
- **Rail** — `border-right:1px solid var(--border)`, `background:var(--raised)`, sticky full-height, 22px top padding. Brand orb at 34px, then 60px-wide nav items: 9px/0/7px padding, radius 10, icon over a 9.5px label, stacked column, gap 5. Active = `background:var(--fillStrong)` with `--ink` icon and label; inactive = `--meta` icon, `--metaStrong` label, hover `--fillStrong`. Bottom of rail: a 34×1px divider and a 30px round avatar.
- **Topbar** — 56px, `background:var(--barGlass)` + `backdrop-filter:blur(14px)`, `border-bottom:1px solid var(--border)`, sticky, `z-index:25`. Left: 16px project swatch + name + chevron (a scope switcher), a 1×18px divider, then the breadcrumb in 12.5px `--metaStrong`. Right: the theme toggle (30px square, radius 8, sun/moon) and any help affordance.
- Nav items to stub even though their destinations don't exist: Home, Create, Canvas, **Casting**, Assets, Library. Non-functional items render inactive and inert — an empty rail slot is cheaper to explain than a rail that changes shape when the lobby lands.

**3. The theme toggle.** Sets `data-theme` on `<body>` and persists to storage. Owned by the shell, not by Casting.

### 0.2 What that means for scope

Casting can absolutely ship before the lobby — the rail just points at one live destination. Budget roughly a day for the token file + shell, and treat it as **platform work you'd have to do for the lobby anyway**, not overhead on this feature. The payoff: when the lobby is built, it inherits chrome, palette and dark mode already proven on a real surface, and there is no visual reconciliation pass.

### 0.3 Two things not to do here

- ❌ **Don't build casting-local tokens** ("`--casting-bg`") intending to promote them later. They never get promoted; you get two palettes.
- ❌ **Don't skip the rail because there's only one destination.** Casting as a full-bleed page teaches users it's a mode rather than a room, and the lobby then has to fight that. The rail is what makes the eventual studio feel like one product.

---

## 1. The pitch in one paragraph

Our casting studio is deeper than this reference — more parameters, more iteration paths, more control. That depth is an asset and I am not asking you to throw any of it away. What I'm asking for is a **different default posture**: casting should open as *a sentence and eight faces*, with every one of your existing controls one disclosure away instead of in the way. The reference file is not a feature list to copy; it's a **shape** — a sequence of screens and a set of rules about what is primary, what is secondary, and what state the system is allowed to keep. Fold the studio into that shape and the depth stops reading as a cockpit and starts reading as a studio.

The single idea underneath it: **casting is divergent, refinement is convergent, and they must not share a control surface.** Every friction complaint about generative casting comes from mixing the two — tuning nineteen sliders to produce one face, judging that face in a vacuum, then tuning the same nineteen sliders to fix it. Split them and both get faster.

---

## 2. Why 8-up beats 1-up (the argument to keep in mind while you cut)

- **Comparison is cheaper than judgement.** A person shown one face asks "is this right?" — an unanswerable question. Shown eight, they ask "which of these?" — answerable in two seconds. Same compute budget, dramatically shorter decision.
- **It converts parameter-guessing into picking.** Users cannot express "warm but not cloying" numerically. They *can* point at it. The sheet is a cheaper input device than the control panel, for the things the control panel is worst at.
- **It makes the first result non-precious.** With 1-up, a bad result feels like a failure and costs a retune. With 8-up, three bad ones out of eight is normal and costs nothing. This is the difference between a tool that feels fast and one that feels like it's grading you.
- **It exposes the axis you didn't specify.** Eight faces from one sentence show you the range the model thinks that sentence covers. That's diagnostic information you cannot get from a single sample.

---

## 3. The three surfaces

| Surface | Job | What must be true |
|---|---|---|
| **Roster** | Everything already cast; three ways in | The primary action is a text field, reachable without scrolling |
| **Casting sheet** | Divergent exploration — many candidates, cheap rejects, lineage | Never fewer than 8 at once; every card is one click from Keep |
| **Casting room** | Convergent refinement of one signed member | The face is locked here; nothing on this screen can change identity |

Three surfaces, one direction of travel: **sentence → sheet → room.** Anything in your current studio that doesn't fit one of those three jobs is a candidate for a drawer, not a fourth screen.

---

## 4. Surface 1 — Roster

### 4.1 Hero (`screenshots/01`)
One bordered card, `overflow:hidden`, radius 14, split into two columns that wrap at ~920px:

- **Left column** (`flex:1 1 470px; min-width:400px; padding:28px`) — mono eyebrow `CASTING`, `h1` at 31px/1.08 with `letter-spacing:-.038em` ("Say who you need. / Meet eight of them."), a 13px/1.65 blurb capped at 430px, then the prompt field, then the TRY chip row.
- **Right column** (`flex:1 1 320px; min-width:300px; min-height:286px`) — two media panels separated by a 1px gap showing the token background through. Tag them with what the product actually promises: `SIGNED`, `212 FRAMES`. Use `outline:1px solid var(--border)` rather than `border-left` so the seam doesn't strand a stray edge when the columns wrap.

**Why the prompt lives inside the hero:** a hero above a prompt field pushes the primary action down the page and makes the page decorative. Merging them means the page can look alive *and* the first thing under your cursor is the thing you came to do. If you take one layout decision from this document, take that one.

### 4.2 The brief field
Full-width, 12×14 padding, radius 11, `1px solid var(--borderInput)` on `var(--surface)`, hover to `--lineStrong`. Placeholder is a *real example*, not an instruction: "a dad in his 30s in a cluttered garage, dry humour, explains things like he's talking to a mate". Trailing primary button is `var(--ink)` / `var(--surface)`, 8×14, radius 8, label **Cast it** + arrow. Enter submits.

Below it: `TRY` in 10px mono `letter-spacing:.1em`, then 4 seed chips (5×10, radius 999). Chips **write into the field and immediately roll** — they're not autofill, they're one-tap starts. Hovering a chip previews the accent wash (`--accentWash` bg, `--accentLine` border, `--accentInk` text).

### 4.3 The two secondary routes
A `1fr 1fr` grid under the hero, 13px radius, 16×18 padding: **Upload a real person** (dashed-square icon; copy states the cost — "Six photos or one 20-second clip. Likeness locks in about four minutes.") and **Browse the signed roster** (overlapping face stack, `margin-right:-9px`; copy states the size — "184 performers already cleared for paid ads"). Both are equal-weight, both visually quieter than the brief field. Three routes, one of them obviously primary.

### 4.4 Roster grid
`repeat(auto-fill, minmax(178px, 1fr))`, gap 16. First tile is always a dashed **New cast member**. Each card: 4:5 media, radius 11, then name (12.5/500), one-line persona (11px `--metaStrong`), usage in 10.5px mono `--faint`. Over the media: a bottom scrim carrying a mic glyph + voice name, and a top-left status pill (`MASCOT` in accent wash, `UNSIGNED` in dark glass). Filter row above: search + `All / Signed / Unsigned` pills, active = solid ink.

**The card only carries face, voice, and usage.** Everything else you currently show belongs in the room. A roster card answers "who is this and can I use them?" — nothing more.

---

## 5. Surface 2 — Casting sheet (the important one)

### 5.1 Anatomy
- **Header** — back link ("‹ Casting"), mono eyebrow `CASTING SHEET · ROLL 02`, the active brief rendered as 15px prose (not in an input — it's a statement of what you asked for), right-aligned count.
- **Grid** — `repeat(auto-fill, minmax(212px, 1fr))`, gap 16, 4:5 cards, radius 12. Bottom padding 168px so the dock never covers the last row.
- **Dock** — sticky bottom, `var(--dockGlass)` + `backdrop-filter:blur(14px)`, radius 14, `box-shadow:var(--shadowCard)`, sitting on a `linear-gradient(to top, var(--page) 42%, transparent)` fade so cards dissolve under it rather than colliding.

### 5.2 The three per-card actions
On a bottom scrim (`linear-gradient(to top, rgba(0,0,0,.66), transparent)`, 26px top padding):

1. **Keep** — wide white pill (`rgba(255,255,255,.94)`, ink text), toggles to "Kept". Kept cards get a 2px `--accentSolid` inset ring + a filled accent check at top-right.
2. **Follow this face** (sparkle glyph) — 28px square, radius 7, `rgba(17,17,18,.62)`, white glyph, hover `.86`. Sets this candidate as parent and rolls eight more.
3. **Discard** (×) — same chip treatment.

⚠️ **Do not use translucent-white chips here.** We shipped `rgba(255,255,255,.22)` and it measured ~2.5:1 against white glyphs over light placeholder media — below the 3:1 floor for UI components. Dark translucent fill works over both light placeholders and real photos.

Card footer, outside the media: persona fragment (11.5px, ellipsised) + zero-padded index in 10px mono. The index is what the user says out loud ("go back to 04") — it must be visible on every card.

### 5.3 Lineage — the feature that replaces re-tuning
**Follow this face** is the convergence mechanism inside a divergent surface. It sets a parent, rolls a fresh eight, and stamps the new set with a `FROM 04` pill. The header eyebrow switches to `FOLLOWING CANDIDATE 04` and a dismissable accent chip appears next to the count so the state is never ambiguous. This is how a user narrows *without* opening a control panel: point, roll, point, roll. Three taps and they're in a neighbourhood they could not have described.

Your existing "variations of" logic almost certainly already does this server-side. What's missing is that it's currently a parameter, and it needs to be **a button on the face**.

### 5.4 The dock
Row 1: sparkle-prefixed prompt input (placeholder "Change the direction — or press ⏎ to roll eight more") + secondary **Roll again** with a refresh glyph.

Row 2: `NUDGE` mono label + one-tap delta chips — *Warmer, Older, Less styled, Different hair, Real-room light, Less symmetrical*. Each **appends its lowercase text to the brief and rolls**. Critically: the mutation is **visible in the brief** in the header. The user can always read the sentence that produced what they're looking at.

Right side of row 2: the discard-undo line, then the kept tray (24×30 overlapping thumbs, `margin-right:-8px`) and the primary **Sign N to roster**. When nothing is kept, the tray area reads "Keep the ones worth a second look" in `--meta` — an instruction where a button would otherwise be, rather than a disabled button.

### 5.5 Discards are a pure delete — with undo
We considered treating discards as implicit negative signal and rejected it, deliberately:

- **Implicit learning is unfalsifiable.** If a discard silently steers the next roll and the next roll is worse, the user cannot tell whether the model misread them or they got unlucky. That destroys trust in the loop, and trust is the entire reason the loop feels fast.
- **People discard for boring reasons** — a bad hand, a crop, the wrong shirt. Read as "not this kind of person", a technical reject teaches the wrong lesson. Negative signal needs a *why*, and asking for a why is exactly the friction we're removing.
- The place for "less of that" is **explicit and editable**: a nudge chip. Same effect, legible, reversible.

So: delete only, no learning — plus **"2 discarded · Undo"** in the dock, one step per click, cleared on the next roll. Pure delete is right; a mis-tap costing you a face permanently is not.

### 5.6 Generation must stream
Eight-up only feels frictionless if faces **arrive as they finish**. Render eight shimmer tiles immediately (`kcsweep` sweep + mono `CASTING 03` label pulsing at `kcpulse`), and replace each with its result as it lands, `kcrise` 0.34s ease-out. Never hold all eight behind the slowest one. The reference file fakes this with a 1150ms timer — in production, per-tile arrival is the real requirement, and it is the single biggest perceived-speed win available to you.

### 5.7 Sheet state rules (learned the hard way — these are spec)
1. **Derive the count from the rendered list, not arithmetic.** Build the filtered candidate array once and read `.length` for both the grid and the header. Any subtraction-based count *will* eventually disagree with what's on screen.
2. **Dedupe discards.** Two fast clicks on the same card must be idempotent, or the count drifts and Undo needs two clicks to return one face.
3. **A roll is a new set.** Reset `kept` and `dropped` on every roll. Kept indices from a previous roll point at different faces — carrying them over re-applies the accent ring to unrelated candidates. (Alternative if you want cross-roll keeps: key kept state by candidate id, never by grid index, and show carried-over keeps in the tray only, not as rings on the new grid.)
4. **Discarding un-keeps.** A card cannot be both.

---

## 6. Surface 3 — Casting room (`screenshots/06`)

Two columns, `flex-wrap`, left `1 1 560px`, right `1 1 300px`, gap 20.

**Header:** name at 27px/500 `-.032em`, a mono status pill (`PERFORMER` / `MASCOT` / `UNSIGNED`), one-line persona + provenance ("Cast from a sheet on 12 Mar"), then **Open in canvas** (secondary) and **Cast in a campaign** (primary ink).

**Left column:**
- **Master block** — 58/42 split: one 4:5 master still tagged `MASTER`, two stacked supporting frames, all separated by 1px token gaps. Footer strip: retention stat left, `IDENTITY LOCKED` in accent mono with a padlock right.
- **Refine without recasting** — the room's thesis, stated in the card header, with the rule spelled out beside it: *"Face stays locked. Everything else is fair game."* Input + **New takes** + refine chips (Softer light, Plain wardrobe, Outdoors, Closer crop, Tired end of day).
- **Takes grid** — `minmax(104px,1fr)`, motion takes carry a play glyph + duration pill; trailing dashed add-tile.

**Right column:** Voice card (38px ink play button, 32-bar waveform that animates only while playing, first ~14 bars in `--accentSolid` as the playhead, mono duration, then voice name + one-line description) → In campaigns list (34×42 thumb, name, `12 frames · live`, chevron; footer "Cast into a new campaign") → Siblings (variants from the same sheet, 52×64 tiles labelled V2/V3/V4, with the reason stated: "when a campaign needs a near-miss rather than a new face").

**The hard boundary:** nothing on this screen may alter identity. Refinement changes light, wardrobe, crop, framing, mood. If a control in your studio can move the face, it belongs on the sheet as a *new roll*, not here. That boundary is what makes "IDENTITY LOCKED" a promise instead of decoration.

---

## 7. How to fold your depth into this shape

This is the part that matters for your codebase. Five patterns, in order of leverage:

### 7.1 Progressive disclosure with a visible summary
The sentence is always primary. Your full parameter set — age band, build, hair, wardrobe, setting, camera, lens, lighting, engine, guidance, identity strength, seed — lives behind an **Advanced brief** disclosure on the same card. Non-negotiable rule: **anything set to a non-default renders as a chip in the brief line**, so nothing is ever silently applied. Collapsed panel + visible summary chips = depth without opacity. A collapsed panel that hides active settings is worse than no panel.

### 7.2 Per-parameter locks — the real unlock for a deep studio
This is how your customization depth and 8-up divergence coexist, and it's the pattern I'd prioritise. Give every parameter a **lock**. Locked parameters are held constant across the eight; unlocked ones are what the sheet varies. "Lock the face and the wardrobe, vary the setting and the light" is one sentence, eight results, and a *precise* experiment. Suddenly the sheet isn't a slot machine — it's a controlled sweep, and your parameter depth is what makes it powerful rather than what makes it slow. Surface the lock state as a compact mono strip above the grid: `LOCKED · face, wardrobe — VARYING · setting, light`.

### 7.3 Rolls are versions, not replacements
You already have iteration history; don't lose it to this shape. Each roll is an immutable numbered set (`ROLL 02`). Add a thin roll rail (left edge or under the header) so a user can step back to roll 01 and its keeps. Free consequence: "reset on roll" becomes safe, because nothing is destroyed — just superseded. If you keep only one thing from your current iteration model, keep this.

### 7.4 Everything else moves into the room, per member
Rights and consent, usage caps, voice cloning parameters, wardrobe libraries, per-campaign overrides, model/engine pinning — none of it belongs in the create flow. It belongs in the casting room as additional right-column cards or a second tab, scoped to one signed member. The create flow's job is to get to a face worth keeping; the room's job is everything you do to a face you've committed to.

### 7.5 Seeds visible, not prominent
Show the seed as 10px mono metadata on the candidate footer and offer "lock seed" in the advanced panel. Power users need reproducibility; nobody needs it in the primary path.

**Litmus test for any control you're unsure about:** would a first-time user need to touch it to get eight faces they can judge? If no, it goes behind a disclosure. If it changes the face, it belongs to the sheet. If it doesn't, it belongs to the room.

---

## 8. Tokens, type, motion

Take these verbatim from `Klieg Casting.dc.html`'s `<style>` block — they're the same 38-token light/dark system as the lobby, so this surface inherits the theme toggle for free. Key ones: `--surface --raised --page --well --fill --media --border --borderCard --borderInput --dashed --muted --faint --meta --metaStrong --secondary --ink --barGlass --dockGlass --accentWash --accentLine --accentInk --accentSolid --shadowCard`. Dark mode is `body[data-theme="dark"]`. **No hard-coded hexes** except white-on-scrim glyphs and the accent gradient in the brand orb.

**Type:** Archivo for everything; JetBrains Mono for eyebrows, indices, status pills, counts and metadata only. Scale: h1 31/500 `-.038em` · member name 27/500 `-.032em` · section head 13.5/500 · card name 12.5/500 · body 13/1.65 · secondary 11.5/1.55 · mono eyebrow 10.5/500 `.12em` · mono chrome 10/500 `.1em`.

**Radii:** 14 hero/dock/panel · 13 route card · 12 candidate · 11 roster card & brief field · 9–10 buttons/small media · 7 chips-in-media · 999 pills.

**Motion:** `kcrise` 0.34s ease-out for arriving candidates · `kcsweep` 1.5s shimmer · `kcpulse` 1.6s on the casting label · `kcwave` 0.7–1.2s on voice bars while playing only. Wrap everything in `@media (prefers-reduced-motion: reduce){*{animation:none!important}}`. No transitions longer than 340ms anywhere in this flow — it's a speed surface.

**Chrome:** 76px rail, 56px topbar with `--barGlass` + `blur(14px)` — see §0.1, which the lobby will later inherit as-is. Casting is a rail item, not a modal. Breadcrumb reads `Casting`, `Casting / Sheet`, `Casting / Maya Okafor`.

---

## 9. Copy rules

- **Verbs from the trade**: cast, sign, roll, keep, discard, follow, take, sheet, room. Never "generate", "prompt", "iterate", "asset".
- **State the cost or the size** in secondary copy ("locks in about four minutes", "184 performers already cleared").
- **Say why a feature exists** where it isn't obvious — the Siblings card earns its space with "when a campaign needs a near-miss rather than a new face".
- **Placeholders are examples, never instructions.**
- **Instructions replace disabled buttons**: "Keep the ones worth a second look" instead of a greyed-out Sign.
- Headline promises the mechanism: "Meet eight of them" — the sheet *is* the pitch.

---

## 10. Explicitly do not

- ❌ **An audition step.** We cut it. Auditioning a face before it exists is a ceremony; the sheet already shows you eight, and voice is auditionable in the room where it's cheap.
- ❌ **One-at-a-time casting**, even as an option. It reintroduces the vacuum-judgement problem the whole shape exists to remove.
- ❌ **Detail in a modal.** The room is a navigated surface with a back link. Iteration inside a modal is a trap — you can't reference the roster while you work.
- ❌ **Implicit negative learning from discards.** See §5.5.
- ❌ **A parameter panel open by default.** Collapsed with visible summary chips, always.
- ❌ **`<image-slot>`-style media chrome under ~64px.** Small thumbs use the gradient-tile pattern instead (`linear-gradient(160deg, var(--fill), var(--dots))` + 1px border, optional short mono label). Placeholder prose clips mid-word at 34px and reads as broken text.

---

## 11. Suggested build order

0. **Token file + app shell + theme toggle** (§0). Platform work, not casting work — but nothing below looks right without it.
1. **Sheet grid + dock, 8-up, streaming arrival.** Everything else is polish next to this; ship it against your existing generation call and the shape is already 70% delivered.
2. **Keep / discard / undo with the state rules in §5.7.**
3. **Follow-this-face lineage** (parent + `FROM 04` badges + header state).
4. **Roster hero with the brief field inside it**, plus the two secondary routes.
5. **Advanced brief disclosure + summary chips** — your existing panel, relocated and collapsed.
6. **Per-parameter locks** and the `LOCKED · … VARYING · …` strip.
7. **Casting room** with the refine bar and the identity boundary enforced.
8. **Roll rail / version history.**
9. Theme parity pass against the lobby tokens.

---

## 12. Open questions back to me

1. Is eight the right number for your latency and cost profile, or is six the honest 8-up? (The shape survives six; it does not survive three.)
2. Do keeps need to persist across rolls in your model, or is per-roll correct? If they persist, we need the id-keyed variant in §5.7-3.
3. Does your parameter set have a natural "shape" grouping (identity / look / camera / engine) we should use for the advanced panel sections and the lock strip?
4. Where does wardrobe live for you — a per-member library in the room, or a brief parameter on the sheet? It behaves differently in each and I'd rather match your model than guess.
