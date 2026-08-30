# Section 00b — chrome and menus: the evidence pack

Brief: `docs/specs/Casting-ui-ux-design/drape-redesign/00b-chrome-and-menus.md`
Lane: the lobby side lane (#228), segment 2 — **the last PR before the lane stops for his eye**.
Shift: foreman-116, 2026-08-30.

Everything below was **driven at the running app** (dev server on `localhost:3000`,
signed in as `verify-bot-admin` so the STAFF group is reachable), not read off the
source. The source guards live in `client/src/foundation/section00b-guard.test.ts`
and cover what a source read can cover; this file is what a source read cannot.

---

## 0. The one defect the driving caught, before anything else

Founder law 6 exists for this. The build passed 33 source arms and a typecheck,
and then **the app was wrong in a way no arm could see**.

`usePopover` owns four of the five ways this panel closes — Escape, capture-phase
click-away, outside scroll, and a second click on the trigger. All four call the
hook's own setter. The reset that clears the form (`setMode(null)`,
`setDescription('')`) was written into the component's local `close()`, so it ran
on **exactly one** of them.

What that looked like: type half a bug report → press Escape → open the menu
again → you are staring at your half-typed form instead of the menu.

The previous version did not have this bug, because it owned its own key handler.
Centralising the discipline in the hook quietly took the reset away — which is a
change to what the menu *does*, and 00b's scope clause forbids exactly that.

**Fixed** by hanging the reset off `open` rather than off a handler, and re-driven
on both close paths:

| close path | menu closed | reopened showing | textarea survives |
|---|---|---|---|
| Escape | yes (0 panels) | `HELP` / `PREFERENCES` | no (0 textareas) |
| click-away at (600,600) | yes (0 panels) | `HELP` / `PREFERENCES` | no (0 textareas) |

---

## 1. The inert rows, read at the DOM

Every row in the utility panel, as the browser reports it:

| row | tag | `aria-disabled` | `tabIndex` | colour | title |
|---|---|---|---|---|---|
| Send feedback | `BUTTON` | — | `0` | `rgb(180,180,186)` | — |
| Report a bug | `BUTTON` | — | `0` | `rgb(180,180,186)` | — |
| Documentation | `SPAN` | `true` | `-1` | `rgb(110,110,119)` | `Documentation — not built yet` |
| Keyboard shortcuts | `SPAN` | `true` | `-1` | `rgb(110,110,119)` | `Keyboard shortcuts — not built yet` |
| Theme | `SPAN` | `true` | `-1` | `rgb(110,110,119)` | `Theme — not built yet` |
| Cookie preferences | `SPAN` | `true` | `-1` | `rgb(110,110,119)` | `Cookie preferences — not built yet` |

Groups present: `["HELP", "PREFERENCES"]`.

**The tab walk is the reading that matters**, because `tabIndex: -1` on a `<span>`
is what the browser reports for *any* span and proves nothing on its own. Focus
starting on `Send feedback`, six `Tab` presses:

```
BUTTON:Send feedback  →  BUTTON:Report a bug  →  BUTTON:Switch to dark theme
→  BUTTON:01 Casting Studio…  →  BUTTON:02 Wardrobe…  →  BUTTON:03 New Canvas…
```

**All four stubs are skipped.** Focus leaves the panel straight for the shell's
theme toggle.

### Hover, with its own positive control

An all-unchanged table is also what a broken hover probe returns, so a live row
was measured in the same pass:

| element | background before | background on hover | changed |
|---|---|---|---|
| `Documentation` (stub) | `rgba(0,0,0,0)` | `rgba(0,0,0,0)` | **no** |
| `Send feedback` (live) | `rgba(0,0,0,0)` | `rgb(246,246,248)` | **yes** |

---

## 2. One width in both states

The DoD line, measured at the panel's own box rather than at the constant:

| state | x | y | width | height |
|---|---|---|---|---|
| menu | 1070 | 48.5 | **264** | 250 |
| bug form | 1070 | 48.5 | **264** | 188 |

Same width, same origin. It was `mode ? 300 : 200`.

The origin is also the proof that `usePopover`'s containing-block correction
fired: the topbar is a `backdrop-filter` glass bar, and `y = 48.5` is the
trigger's own bottom (42.5) plus the hook's 6px gap — not an offset by the bar's
height, which is the bug the hook exists to prevent.

---

## 3. The topbar stubs

| | project switcher | What's new |
|---|---|---|
| tag | `SPAN` | `SPAN` |
| text | `All projects` | — |
| title | `Projects — not built yet` | `What's new — not built yet` |
| `aria-disabled` | `true` | `true` |
| `tabIndex` | `-1` | `-1` |
| colour | `rgb(180,180,186)` (`--muted`) | `rgb(180,180,186)` |
| cursor | `default` | `default` |
| child `<span>`s | — | **0 — no unread dot** |

Position: the switcher's right edge is `280.3`, the breadcrumb's left edge is
further right — `switcherIsBeforeCrumb: true`. It sits after the brand block and
before the breadcrumb (see §6 for why not before the brand).

**The topbar's complete focusable set** is three elements:
`["5,000 credits", "Help and preferences", "Switch to dark theme"]`. Neither stub
is in it.

---

## 4. The account menu

Read at the open panel:

- name — `500 12.5px Archivo` (**not 600**)
- credits — `"JetBrains Mono"`, `10.5px`, reading `5,000 credits`
- `STAFF` label — `"JetBrains Mono"`, `8.5px`, letter-spacing `1.105px` (`.13em` of 8.5px)
- every row's computed `font-weight`: `400`, including `Log out`
- rows in order: Settings · Billing · Share Drape · **STAFF** · Admin · Moderation · Log out
- count pills rendered: **0** — nothing passes a count yet (see §6)

Frames: `output/_shift116-evidence/shift116-account-{dark,light}-element.png`
(element shots — a full-page frame of a popover is not a reading of it).

---

## 5. Nothing else moved

**Casting is frozen in this lane** and was checked rather than assumed. On
`/casting`:

```
.dp-projswitch  →  0
.dp-iconbtn--stub  →  0
topbar text  →  "Klieg Casting"
```

**The mutation is unchanged, proven at the rows rather than at the toast.** Two
submits were driven through the redesigned panel; the DOM reads of the toast were
badly timed and said nothing had happened, and the database said otherwise:

| id | category | page | description |
|---|---|---|---|
| 1 | `feedback` | `/app` | `shift116 00b verification — utility menu submit path, ignore.` |
| 2 | `other` | `/app` | `shift116 00b verification #2 — bug path, ignore.` |

Same categories the two modes have always sent, same `page`. The short-input
guard also still refuses: `"Please describe it in at least 10 characters."`

(Both rows are in the DEV database and were left there as evidence. Nothing reads
`bug_reports` in the product today — that is #255.)

---

## 6. Three declared deviations

1. ⚠ **THE COUNT PILLS ARE PROP-DRIVEN AND NOTHING PASSES THEM.** 00b §2 and its
   DoD name live counts; `START-HERE.md`'s own gap table assigns them to **brief
   01 §3** ("Staff count badges … covered in brief 01 §3"), and 00b's scope clause
   excludes *"any change to what the menus do"*. They need a server reader that
   does not exist — pending change requests + unanswered Crew cards, and audit
   rows above `info` in 24h — and wiring a new query into the lobby's account menu
   on every load is that excluded change. So the **look** ships and is proven
   (`showsMenuCount` is driven directly: `3 → true`, `1 → true`, `0 → false`,
   `undefined → false`, with both tempting wrong spellings shown answering `true`
   at zero), and **01 passes the numbers** in one line.

2. **The project switcher is a `topbarLeft` SLOT, not unconditional chrome.** The
   more natural shape would be for `Topbar` to draw it for everyone. Four casting
   pages mount the same shell, and casting is frozen in this lane — unconditional
   chrome would have redesigned a frozen page as a side effect. §5 above is that
   decision measured.

3. **"Far left" is after the brand block, not before it.** 00b §4 says the
   switcher sits *"at the far left of the topbar, before the breadcrumb"*; in the
   prototype the brand lives in the rail, and in the shipped shell it is also in
   the topbar. 00b may not touch the brand block, so the switcher takes the
   position the brief's operative clause names — before the breadcrumb.

---

## 7. What was NOT built, on purpose

- **The queue pill.** 00b §5 leaves the slot and forbids shipping one: it needs a
  real jobs feed (section 04), and a pill reading "2 running · 40s" over no feed
  is a lie about what the product is doing right now. An arm asserts no chrome
  file draws one.
- **`projectId` anywhere.** An arm walks the whole client tree (464 `.ts`/`.tsx`
  files) and requires zero occurrences outside comments.
- **Per-project counts and the brand dot.** They encode a thing that does not
  exist.
- **The unread dot on What's new**, which the refreshed prototype *does* carry.
  This is the one place 00b deliberately departs from the design source, so it has
  an arm rather than a comment.

---

## 8. Frames

All under `output/_shift116-evidence/`:

| file | what |
|---|---|
| `shift116-topbar-dark.png` | the whole topbar with both stubs, dark |
| `shift116-utility-dark.png` | utility menu open, dark |
| `shift116-utility-light-menu.png` | utility menu open, light, live row hovered |
| `shift116-utility-form-dark.png` | the bug form at the same 264px |
| `shift116-utility-light.png` | ⚠ **taken BEFORE the §0 fix** — it shows the form on reopen, which is the defect itself |
| `shift116-account-dark.png` / `-light.png` | account menu in page context, both themes |
| `shift116-account-dark-element.png` / `-light-element.png` | the same menu at the element |

---

## 9. Suite and checks

- `npx vitest run client/src/foundation` — **77/77** (33 of them this section's)
- `pnpm check` — exit 0
- Every absence arm carries a positive control; four arms failed on their first
  run **by reading their own subject's prose**, which is why `code()` strips
  comments before matching.
