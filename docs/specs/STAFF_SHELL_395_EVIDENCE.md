# Staff shell — evidence pack (#395, brief 05)

**Founder law 6: no visual change ships without being looked at in the running
app.** This is what was looked at, what was measured, and the two things the
measuring got wrong before it got them right.

Brief: `docs/specs/Casting-ui-ux-design/drape-redesign/05-staff-shell.md`.
Promotion pass: `docs/specs/PROMOTION_PASS_SECTION_05.md`.

---

## 1 · What a person sees

Admin and Moderation used to be nine full-page routes that **replaced the
app**. Opening Admin meant the rail vanished, the topbar vanished, the account
menu and the credits chip vanished, and you arrived at a grey page with a
`Studio` button in the corner to get back. It looked like a different product.

They are now surfaces **inside** Klieg. Same rail, same topbar, same account
menu — with one staff bar carrying the section tabs. Nothing announces that you
have left, because you have not.

**Every page's content is byte-for-byte what it was.** The tables are the same
tables, the modals are the same modals, the queries are untouched. That is the
card's own acceptance test — *"same data, same actions, same everything — new
frame"* — and it is why the pages still look dated inside the new frame. They
get fixed in briefs 06–09, one at a time.

## 2 · The frames

`output/395-frames/`, both themes, 1440 and 1024:

| frame | what it shows |
|---|---|
| `after-admin-overview-{dark,light}.png` | the frame, the bar, the seven tabs, the refresh cluster |
| `after-admin-audit-{dark,light}.png` | the bar over a long table |
| `after-admin-crew-{dark,light}.png` | Crew at the reading measure |
| `after-moderation-{dark,light}.png` | the moderation bar, its five tabs, `New Request` |
| `after-admin-1024-{dark,light}.png` | the bar wrapping at 1024 |

## 3 · The measurements

`scripts/_395-drive-disposable.mts`, run against **both trees** — the branch on
:3000 and `main` on :3100, same instrument, same session.

| | `main` | branch |
|---|---|---|
| rail + topbar on a staff route | **absent** | present |
| pages setting `min-h-screen` | 1 | **0** |
| elements drawing `max-w-7xl` | 2 | **0** |
| a page's own sticky header | 1 | **0** |
| `Studio` buttons on the surface | 2 | **0** |
| `Live` / `Paused` buttons | 1 | **0** |
| the content column | *(none)* | **1240px**, and 790px on Crew |
| the bar's top after scrolling the pane 1,475px | *(no pane)* | **56px → 56px** |
| admin tabs | *(a nav row)* | **7 links**, hrefs 7/7 |
| horizontal scroll at 1024 | none | **none** |

**56 readings pass on the branch. The same instrument fails 44 on `main`.**
That contrast is the evidence; the branch's green alone would not be.

### The one that matters

> `⚠ THE BAR STAYS PUT WHILE THE PANE SCROLLS UNDER IT → SAW: bar top 56px → 56px, pane scrolled 1475px`

Staff surfaces are working tools. The audit table is thousands of rows, and the
tabs are what you reach for half way down it. `overflow: hidden` on the frame,
`overflow-y: auto` on the pane inside it.

## 4 · ⚠ Two of my own arms were wrong before they were right

Recorded because a driver pointed only at the fixed tree cannot tell a working
arm from a vacuous one — and both of these were caught by running the **before**
arm.

- **The sticky-header arm failed 4/4 on a correct tree.** It counted every
  sticky `<header>`, and the shell's own topbar is one — so the arm was
  reporting the very frame this card installs. Probed at the element rather
  than argued about (`header.dp-topbar`, `position: sticky`), and `.dp-topbar`
  is now excluded **by name**, so the arm still finds a page's own header. It
  finds one on `main`.
- **Five arms passed on `main` over an empty population.** "Every tab is a real
  link" passed over **zero** tabs; "labels are sentence case" passed over an
  empty string. Each was reporting *the element is not on screen* in the words
  of a success — the same shape the previous card hit on `0 inline-styled
  nodes`. They report **`NOT MEASURED`** now, which is the honest answer for a
  tree that legitimately has no tabs.

## 5 · The guard, and its negative control

`client/src/features/staff/section05-guard.test.ts` — **24 arms**, source
guards in the shape of `section02-guard.test.ts`. Its population is **derived
from the pages folder**, not typed out, because a hand-written list of staff
pages is exactly the blind spot that produced two headers instead of one.

**Negative control** (`scripts/_395-sabotage-disposable.mts`): **21 sabotages,
21 caught, each reddening EXACTLY its own arm.** Control green (0 failing arms)
before and after; every file restored in a `finally`.

⚠ **The control found two real weaknesses in the guard, which is what it is
for:**

- The *"use `SurfaceBar`, do not fork it"* arm asked only that `<SurfaceBar`
  appear **somewhere** — so forking ONE of the two bars walked straight past
  it. It counts now: one exported bar per role, both must be the foundation's.
- The *"count omitted at zero"* arm matched `/option\.count\s*\?/` — which also
  matches `option.count ?? 0`, **the exact defect it exists to catch**. It
  matches the ternary now and bans the nullish form by name.

## 6 · What was deliberately NOT done

- **No page content was touched.** No table, card, chart, modal, query or
  mutation is in the diff.
- **The ladder of moderation's tabs was not converted to routes.** They are one
  page's five panes, each gating its own query with `enabled: activeTab === …`;
  converting them would restructure that page's data loading, which the card
  excludes. The brief's *"tabs are routes"* is a rule against converting the
  **admin sections**, which really are seven URLs.
- **`AdminFoundation` got no tab and no frame** — his ruling. It is a component
  specimen, not a staff surface.
- **The 134 hard-coded colour literals in page content were left in place** and
  listed per page in the promotion pass §6, per his instruction to *log them
  for the later briefs rather than fixing them here*.
- **No count was invented.** Moderation's three pills come from the three
  readers `TabNavigation` already had; admin's tabs carry no pill because
  nothing on that path reads a number.

## 7 · The honest state after this card

**A staff page in dark mode is a dark shell around white cards.** The frame
follows the theme; the content does not, and never has — staff has simply
never been dark-tested. That is not a regression this card introduced, it is
one it makes visible, and it is what briefs 06–09 exist to fix. Doing it now
would have meant restyling content inside pages that still owned their own
background, and then doing it again.
