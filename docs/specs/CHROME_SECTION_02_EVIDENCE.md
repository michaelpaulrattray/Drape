# Section 02 — topbar and rail completion: the evidence pack

**Brief:** `docs/specs/Casting-ui-ux-design/drape-redesign/02-topbar-and-rail.md` (#270).
**Driven at the running app** (`pnpm dev`, localhost:3000, dev database, verify-bot
session), both themes, at the three widths his brief names. Frames in
`output/section02/`.

Founder law 6 governs this file: no visual change ships without being looked at
in the running app. Every row below records **what was seen or measured**, not
what the source says (working law 1).

---

## 1. The frame, at rest, both themes

| frame | what it shows |
|---|---|
| `01-lobby-full-light.png` / `01-lobby-full-dark.png` | the whole lobby inside the new frame |
| `02-topbar-light.png` / `02-topbar-dark.png` | the bar: project chip · divider · breadcrumb — centred search — credits · divider · bug · help · what's new · theme · account |
| `03-railfoot-light.png` / `03-railfoot-dark.png` | the rail's foot: dashed `+`, "Invite", divider, gear. **No face.** |
| `04-right-cluster-light.png` / `04-right-cluster-dark.png` | the right cluster at reading size |
| `06-account-menu-light.png` | the account menu, open, in its new corner |
| `07-bug-form-light.png` | Report a bug, one click from the bar |
| `08-help-menu-light.png` | the help menu — three rows |
| `09-casting-dark.png` | the frame on a casting route, with casting's own content untouched |

⚠ **ONE FRAME WAS RE-TAKEN AND THE REASON IS WORTH KEEPING.** The first
dark-theme photograph showed a white search field and a white Home item on a
dark bar — it was taken 600 ms after the theme toggle and caught the CSS
transition mid-flight, not the product. Measured at rest a second later, the
computed values are the dark ones (`.dp-search` background `rgb(26,26,29)`,
active rail item `rgb(38,38,42)`), and the re-taken frame agrees. A screenshot
of a transition is a photograph of a lie; the fix is to measure the computed
value as well as look.

---

## 2. His three rulings, driven

### The search is a span and takes no keystroke

Read off the live element:

```
tag: span · aria-disabled: "true" · title: "Search — not built yet"
tabIndex: -1 · input/textarea/contenteditable descendants: 0
```

**THE TAB WALK — the reading that matters, because `tabIndex: -1` is what a
browser reports for any span and proves nothing** (00b's own finding). Focus was
blurred and Tab pressed 24 times from the top of the document. The stops inside
the chrome, in order:

```
a:Home  a:Canvas  a:Casting  a:Library
button:Settings  button:Billing  button:Report a bug  button:Help
button:Switch to dark theme  button:Verify Bot
```

**The search is not among them** (`searchStops: []`), and neither is any of the
four inert rail destinations or What's new. Ten stops, every one of them a
control that does something.

**⌘K does nothing**, measured as a delta rather than asserted: `Meta+k` and
`Control+k` were both pressed and the active element and the dialog/menu count
were identical before and after (`changed: false`).

### F1 is reversed — the rail is eight

Read from the product's own list, not from the source text:

```
Home · Create · Canvas · Templates · Cinema · Casting · Assets · Library
```

Cinema sits between Templates and Casting and carries no `href`, so it renders
as an inert stub like Create, Templates and Assets. `Rail.tsx`'s docblock now
says EIGHT and names F1 as reversed rather than contradicted; both sentences the
card asked about were edited, including *"the rail never changes shape"*, which
keeps its reasoning and gains the closing number.

### The account chip crossed to the topbar; the rail's foot took a gear

- Topbar: `.dp-accountchip` present, opens `.dp-account-menu` below and
  right-aligned (menu right edge **1416**, bar right edge **1434** — inside),
  Escape closes it (`closedByEscape: true`). The menu's contents are the same
  `UserCard` as before: **a relocation, not a redesign.**
- Rail foot, read at the DOM: `faces: 0`, `addPlus: 1`, `gear: 1`,
  `.dp-account`/`.dp-accountchip` inside the rail: **0**. The Invite affordance
  is a `<span aria-disabled="true" title="Invite — not built yet">`.

---

## 3. Geometry — nothing behind a scroll

| viewport | bar overflow | search width | everything inside the bar |
|---|---|---|---|
| 1920 | 0 | 400 | yes |
| 1440 | 0 | 400 | yes |
| 1024 | 0 | 353 | yes |

⚠ **THE SEARCH IS NOT ON THE BAR'S TRUE CENTRE, AND THAT IS THE PROTOTYPE'S OWN
BEHAVIOUR RATHER THAN A SLIP.** Measured at 1440: search centre **672**, bar
centre **755** — 83px left, and the same 83px at 1024. The centre zone is
`flex: 1` between two `flex: none` zones, so it is centred in *what is left*,
and the right cluster is the wider of the two. The prototype's markup is the
same three-zone flex with the same `justify-content: center`, so copying it
copies the offset. Recorded rather than silently corrected: making it centre on
the BAR needs a different layout than the design has, and that is his call.

⚠ **BELOW THE BRIEF'S WIDTHS THE BAR ALREADY OVERFLOWED, AND THIS SECTION ADDS
14px TO IT.** At 375px the document scrolls horizontally by **186px** with the
search and **172px** without it (measured as a delta — the centre zone hidden
and re-measured), and **0** with the whole topbar hidden. So the overflow is the
bar's, it predates this section by an order of magnitude, and the search is 8%
of it. Not repaired here: the brief's widths are 1024/1440/1920, a phone-width
fix is unbriefed, and hiding this section's 14px would leave the bar reading as
"works at 375" when it does not. **Filed as a card.**

---

## 4. The negative bar — no page moved

His sharpest line: *"Do not restyle the pages the frame contains. If a lobby
view moves, something overreached."*

`git diff --stat HEAD` over the lobby views, the account card and all four
casting pages is **empty**:

```
client/src/features/lobby/HomeView.tsx      — untouched
client/src/features/lobby/BoardsView.tsx    — untouched
client/src/features/lobby/LibraryView.tsx   — untouched
client/src/components/UserCard.tsx          — untouched
client/src/pages/CastingV2.tsx              — untouched
client/src/pages/CastingRoom.tsx            — untouched
client/src/pages/CastingSheet.tsx           — untouched
client/src/pages/CastingFoundation.tsx      — untouched
```

The only page file in the diff is `AppLobby.tsx`, which the brief's own file list
names, and the change there is the `topbarRight` composition plus the new
`workspace` prop.

⚠ **THE FRAME ITSELF DOES CHANGE ON THE CASTING ROUTES, AND THAT IS THE POINT
RATHER THAN AN OVERREACH.** Four casting pages mount this shell, so they lose the
wordmark, gain the search and gain the eighth rail item. The brief's first line
is *"it must land before any page is rebuilt — everything after this sits inside
this frame"*, and a frame that is one shape on the lobby and another on casting
is not a frame. Casting's CONTENT is byte-identical (`09-casting-dark.png`), which
is what the freeze protects. Two things casting does not get, because it hands
the shell nothing to draw them from: the project switcher (a `topbarLeft` slot
since 00b) and the gear (no settings modal exists on a casting route). It also
loses a control it should never have had — an account button in the rail foot
that, with no `account` prop, opened nothing.

---

## 5. Behaviour that had to keep working

| checked | result |
|---|---|
| Help menu rows | `Send feedback` (button, live), `Documentation` (span, stub), `Keyboard shortcuts` (span, stub) — the brief's list exactly |
| Theme / Cookie preferences | gone from the menu, not greyed (#267/#268 and 02 §1d agree) |
| Report a bug | one click from the bar; opens `role="dialog"` labelled *Report a bug* with its textarea; same mutation, same copy |
| Escape | closes the account menu, the bug form and the help menu |
| Theme toggle | still the shell's, still works (light → dark driven above) |
| Credits chip | unchanged — his *"exists, keep it"* |

---

## 6. What the suite holds, and what it cannot

`client/src/foundation/section02-guard.test.ts` — 23 arms, every absence arm
paired with a positive control. **Driven red six times** by
`scripts/_section02-sabotage-disposable.mts`, each sabotage the exact edit a
helpful hand would make:

| sabotage | arm that went red |
|---|---|
| the search becomes an `<input>` | *renders as a span…* (and *no field element…*) |
| Cinema dropped from the rail | *holds eight destinations…* |
| Cinema grows a route | *Cinema is inert…* |
| the F1 comment put back | *the docblock says eight…* |
| a ⌘K handler added | *nothing in the chrome reads a modifier key* |
| Report a bug put back in the menu | *the help menu no longer offers it as a row* |

Control run first: 23 arms, 0 red. Every file restored in a `finally`.

**What a source guard cannot see, and why this document exists**: the tab order,
the cascade, the geometry, and both themes. Those are §§1–3 above.

⚠ **ONE ARM'S POSITIVE CONTROL CAUGHT ITS OWN MATCHER ON THE FIRST RUN.** The
no-unread-dot arm was written `/\bdot\b/`, and `_` is a word character — so
`dp-iconbtn__dot` has no boundary before `dot` and the sabotage read as clean.
The arm would have been green with a dot on the icon. Fixed to `/dot\b/` with
four controls. This is exactly the failure the pairing rule exists to catch, and
it happened here on the day.

**Two of section 02's rules are deliberately NOT guarded in that file** — the
`projectId` prohibition and his `#E2685A` ruling — because `section00b-guard`
walks the whole client tree for the first and `token-guard` refuses every hex
outside two carved-out files for the second. A second copy would be working law
4 pointed at the suite; writing the literal a second time is also what made
`token-guard` red on this file's first run.


---

## 7. Side by side with the prototype — every difference is a ruling

`docs/specs/Casting-ui-ux-design/design_handoff_studio/Klieg Studio.dc.html`
opened at 1440 and photographed: `10-prototype-topbar.png`,
`11-prototype-full.png`, `12-prototype-railfoot.png`.

**The topbar matches the prototype's structure element for element** — the
project chip, the divider, the breadcrumb, the centred search with its two key
chips, then credits, divider, three icons, theme, account chip with chevron.
Four differences, and each is a decision rather than a gap:

| prototype | shipped | why |
|---|---|---|
| `Acme Skincare` + a brand swatch | `All projects` + a folder glyph, inert | projects do not exist; *"All projects"* is TRUE today, which is what makes the stub honest (00b §4) |
| queue pill, `2 running · 40s` | nothing, space left | no jobs feed; his own words — *"a number in a screenshot that no server produces is a lie that survives into the build"* |
| credits `1,240`, conic dot, Archivo 11.5px | the existing chip, mono | his instruction is *"exists, keep it"*; the chip's own docblock says mono because a balance is a machine fact |
| account chip `MR` | the real avatar + chevron | same shape, real data |

**The rail's foot is where the prototype and his ruling part company, and the
frames show it plainly.** `12-prototype-railfoot.png` draws two member avatars,
the dashed `+`, the word Invite, a divider — **and then the `MR` avatar again**,
which opens Settings. That is exactly the thing he refused: *"Same face in both
corners doing two different things is ambiguous. The face is you, the gear is
settings."* Shipped (`03-railfoot-light.png`): the dashed `+`, Invite, a
divider, a **gear** — and no member avatars, because there is no members API and
two drawn faces would be two invented people.

**Copy audit.** Every user-visible string this section adds, classified:

| string | class |
|---|---|
| `Search frames, faces, prompts…` | **prototype-verified** — byte-identical to the prototype's own label |
| `⌘` / `K` | **prototype-verified** |
| `Cinema` | **prototype-verified** — the prototype's own rail label |
| `Invite` | **prototype-verified** |
| `Search — not built yet` | **adapted** — the `— not built yet` tooltip is `Rail.tsx`'s established stub form (00b §3), applied to a new stub |
| `Invite — not built yet` | **adapted**, same form |
| `Report a bug` / `Help` (button tooltips) | **adapted** — the prototype's `barIcons` say *"Report a bug"* and *"Help & docs"*; the second is shortened because this menu holds no docs yet |
| `Settings` (the gear's tooltip) | **invented** — the prototype's foot avatar has `title="Settings · Klieg Studio"`, and the workspace name is not a thing this product has |

No string in this section makes a claim about a capability. The four inert
elements each say what they are on hover.
