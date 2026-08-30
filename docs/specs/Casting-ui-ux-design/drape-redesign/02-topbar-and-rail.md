# Topbar and rail — completion

**One PR. Small, structural, and it must land before any page is rebuilt** — everything after this sits inside this frame.

Live reference: `docs/specs/Casting-ui-ux-design/design_handoff_studio/Klieg Studio.dc.html`. Where this doc and the prototype disagree, the prototype wins.

## What this is

`Rail.tsx`, `Topbar.tsx` and `AppShell.tsx` are correct in skeleton and shipped. Section 00b brought the menus onto the grammar. What is still missing is the rest of the frame: the topbar has two zones where the design has three, the account chip is in the wrong corner, and the rail is one destination short.

None of it is hard. All of it changes the shape every page is built inside, which is why it comes first.

**Excluded:** any page content, the Settings modal, search behaviour, a jobs feed. Nothing in this PR fetches anything new.

## Files

**Change**
- `client/src/foundation/Topbar.tsx`
- `client/src/foundation/Rail.tsx`
- `client/src/pages/AppLobby.tsx` — the `topbarRight` composition and the `account` prop
- `client/src/foundation/foundation.css` — the new bar elements

**Leave alone**
- `AppShell.tsx`. Widths and gutters are correct.
- `LobbyUtilityMenu`'s position as an ordinary `dp-iconbtn` in the topbar row. It used to sit `absolute top-4 right-5` and became unclickable when the shell put the theme toggle in the same square (#73).
- Every mutation, every query, the role gating in `UserCard`.

---

## 1. The topbar becomes three zones

Today it is two — brand and breadcrumb on the left, chrome on the right, with 800px of nothing between them. The design is **context · search · you**.

```
[ ◐ All projects ⌄ ] │ Home        [ ⌕ Search frames, faces, prompts…  ⌘ K ]        [3 running · 40s] [◔ 1,240] │ 🐞 ? 📣 ☀ [MR ⌄]
```

### 1a. Drop the brand wordmark

The topbar currently opens with a coral tile and the word Klieg. The `BrandOrb` already carries the brand at the top of the rail, two inches away. Remove it; the space belongs to the project switcher.

### 1b. Project switcher — inert, reading `All projects`

Already specified in brief 00b §4 and unchanged: a chip with the project swatch, the name, and a chevron. It ships **inert** because projects do not exist yet — and `All projects` is not a placeholder, it is *true today*, which is what makes the stub honest.

Then a `1px × 18px` `--borderSoft` divider, then the breadcrumb: `400 12.5px Archivo`, `--metaStrong`.

### 1c. The centred search — present, sized, and not focusable

The zone: `flex: 1; display: flex; justify-content: center; min-width: 0`.

The field:

```css
display: flex; align-items: center; gap: 9px;
flex: 1 1 auto; min-width: 0; max-width: 400px;
height: 34px; box-sizing: border-box; padding: 0 11px;
border: 1px solid var(--borderInput);
border-radius: var(--r-md);
background: var(--raised);
cursor: text;
```
Hover: `border-color: var(--sink); background: var(--surface)`.

Contents, in order: a 13px magnifier at `--meta`; the label `400 12.5px Archivo`, `--meta`, `flex: 1; min-width: 0`, nowrap with ellipsis, reading **Search frames, faces, prompts…**; then the key chips, `flex: none`, `gap: 3px` — each `500 10px Archivo`, `--metaStrong`, `1px solid var(--borderSoft)`, `border-radius: 4px`, padding `1px 4px` for ⌘ and `1px 5px` for K.

**It must not be an `<input>`.** Render the label as a `<span>`. A text field that accepts keystrokes and does nothing is claiming a capability — the stub rule says a stub names a place, never a capability. Give it `aria-disabled`, keep it out of the tab order, and `title="Search — not built yet"`.

Do **not** register a ⌘K handler. The chips describe the shortcut the feature will have; binding it to nothing is the same lie in a different form.

### 1d. The right cluster

`display: flex; align-items: center; gap: 6px; flex: none`. In order:

**Queue pill** — leave the space, ship nothing. It needs a real jobs feed, and `3 running · 40s` over nothing is a lie about what the studio is doing. When it does land: `padding: 5px 11px 5px 8px`, `border-radius: var(--r-pill)`, `background: var(--accentWash)`, hover `var(--accentWashHover)`; a 12px ring `1.6px solid var(--accentLine)` with `border-top-color: var(--accentSolid)` spinning on `dp-spin` 1s linear; label `500 11.5px Archivo` `--accentInk`, ETA `400 11px` `--accentInk`.

> The prototype hard-codes `#E2685A` on that ring. That is a token violation in my file, not a value to copy — it is `--accentSolid`.

**Credits chip** — exists, keep it. `padding: 5px 11px`, `border-radius: var(--r-pill)`, `1px solid var(--borderInput)`, hover `background: var(--fill)`; a 9px conic dot, then the balance in `500 11.5px Archivo` at `--secondary`.

**Divider** — `1px × 18px`, `--borderSoft`, `margin: 0 3px`.

**Three icon buttons, discrete** — 30×30, `border-radius: var(--r-sm)`, `--metaStrong`, hover `background: var(--fillStrong); color: var(--ink)`:

| Icon | Action |
|---|---|
| Bug | Report a bug — the existing `bugReports.submit` flow |
| Question mark | Help |
| Megaphone | What's new — **inert**, no unread dot |

**Report a bug moves out of the `···` menu and becomes its own icon.** Two clicks deep gets you fewer bug reports, which is backwards. The utility menu keeps Documentation, Keyboard shortcuts and Send feedback.

**Theme toggle** — exists, unchanged.

**Account chip** — moves here from the rail (§2).

---

## 2. The rail

### 2a. Cinema is the eighth destination

`Rail.tsx` states the rail never changes shape, and ruling F1 (2026-07-31) fixed it at seven. **F1 is reversed once, now, and then the shape is fixed at eight.** Update the comment so the next reader sees a reversal rather than a contradiction.

Cinema sits **between Templates and Casting**, ships inert like Create / Templates / Assets, and gets its route in the Cinema section.

### 2b. The account chip moves to the topbar

Everything reached *through* the account — credits, billing, settings, notifications, theme — is already clustered in the topbar's right end. Leaving the account itself in the opposite corner splits one thing in two.

Move the chip, its menu and its dismissal behaviour to the topbar's right cluster, with a chevron beside the avatar. This is a relocation: `Rail.tsx` already implements all of it correctly, including the capture-phase outside click and Escape.

`AppShell` keeps its `account` prop — pass it through to `Topbar` instead of `Rail`.

### 2c. The rail's foot becomes the workspace

In its place:

- **Member stack** — up to three overlapping avatars, `-7px` margin, from real members excluding Owner and Reviewer roles.
- **A `+` circle** and the word **Invite** beneath, opening the Members surface.
- **A gear**, opening Settings.

**The gear is not optional and not an avatar.** The prototype has the same face in both corners doing two different things — one opens a dropdown, one opens Settings. Same picture, same size, two outcomes is ambiguous by construction. Two symbols, two meanings: the face is you, the gear is settings.

If members data is not wired, ship the stack inert with the Invite affordance visible — same rule as every other stub.

---

## 3. What NOT to do

- **Do not make the search an input.** This is the one thing in the PR most likely to be "improved" into a lie.
- **Do not add an unread dot to What's new.** A dot promises content.
- **Do not thread `projectId` anywhere.** The switcher is inert; no scoped queries, no per-project counts, no brand dots. Speculative plumbing threaded through twenty call sites will be the wrong shape by the time projects arrive.
- **Do not restyle the pages** the frame contains. If a lobby view moves, something overreached.
- **Do not add a fourth width.** 1180 / 1240 / bare, and 790 for reading columns.
- **Do not copy `#E2685A`** from the prototype's queue pill.

## 4. Definition of done

- [ ] Topbar reads: project chip · divider · breadcrumb — centred search — queue space · credits · divider · bug · help · what's new · theme · account.
- [ ] No brand wordmark in the topbar; `BrandOrb` still at the top of the rail.
- [ ] Search is a `<span>`, `aria-disabled`, not tabbable, no ⌘K binding, `title="Search — not built yet"`.
- [ ] Bug and help are discrete icons; Report a bug is one click.
- [ ] What's new is inert with no dot.
- [ ] Rail shows eight destinations, Cinema between Templates and Casting, inert.
- [ ] `Rail.tsx`'s comment records the F1 reversal.
- [ ] Account chip and menu render in the topbar; the rail's foot has the member stack, Invite and a gear.
- [ ] No page content changed. Diff the lobby views: they should be untouched.
- [ ] `token-guard` passes; no new hex.
- [ ] Both themes; the topbar at 1024px, 1440px and 1920px with no element behind a scroll.

## 5. Then the promotion pass

Per `PROMOTION-PASS.md`. This section is small, so it should take ten minutes. The likely candidate is the icon button, if a second surface already has one.
