# Section 00 — foundation top-up: evidence pack

**Lobby lane segment 1 (#228). Brief:
`docs/specs/Casting-ui-ux-design/drape-redesign/00-foundation-topup.md`.
Shift: foreman-115, 2026-08-30.**

The founder's acceptance test for this segment is his own sentence on #228:
**"00's acceptance test is that it makes no visible change."** That is the
first section below, and it is measured rather than asserted.

---

## 1. The acceptance test — no existing page changes appearance

**Result: ZERO changed pixels across all four pre-existing sections.**

The subject is `/casting/foundation`, the unlinked gallery route, whose first
four sections render every primitive the foundation already shipped (buttons,
inputs, chips, pills, status, cards, media, skeleton, drop zone, gradient tile,
empty state, progress). If section 00 leaked into anything, it leaks there.

Each section was captured as an element screenshot on this branch and on `main`,
at 1440×1200, light theme, with `document.fonts.ready` awaited, every animation
and transition killed, the caret hidden and the pointer parked at 0,0.

| Section | changed px | of | verdict |
|---|---|---|---|
| 01 · Buttons | 0 | 96,432 | identical |
| 02 · Inputs | 0 | 222,264 | identical |
| 03 · Chips, pills & status | 0 | 224,616 | identical |
| 04 · Cards, media & states | 0 | 678,552 | identical |

Instrument: `scripts/_shift115-pixdiff-disposable.mts` (sharp, per-channel max
delta). Captures under `output/_shift115-evidence/nodock-{branch,main}-sec*.png`.

### ⚠ The first reading said three of four DIFFERED, and both causes are worth having

A naive capture reported section 1 at **5.704%**, section 2 at 0.716% and
section 4 at **29.1%**. None of it was section 00 leaking, and finding that out
is most of what this pack is:

- **Section 4 (29.1% → 7.585% → 0).** The gallery page's sticky `Dock` is
  `position: fixed`. Adding six sections made the page longer, so scrolling
  section 4 into view put the dock over a *different* part of it than on `main`.
  The dock was painting into the screenshot. Hidden, the section is pixel-identical.
- **Section 1 (5.704%).** Intermittent, always the same bbox — the top 23px, the
  section-head row. Cropped and **looked at**: in the `main` capture the head row
  is **blank**, its text not yet painted when the element screenshot fired. So
  the branch was not different; `main`'s frame was incomplete.
  (`output/_shift115-evidence/head-*.png` — the blank one is `head-stable-main.png`.)
- **Section 2 (0.716%, max delta 9)** was the running skeleton shimmer and
  progress bar, and went to zero the moment animations were killed.

**The instrument's own controls, because an all-zeros table is what a broken
comparison returns too:**

| control | expected | measured |
|---|---|---|
| same tree, two captures (branch) | 0 | 0 on sections 1–4 |
| same tree, two captures (main) | 0 | 0 on sections 1–4 |
| a genuinely different pair | non-zero | reported 5.70%, 7.59%, 29.1% before each cause was found and removed |
| two different sections compared | must not read equal | refused on size mismatch |

The third row is the one that matters: this comparison **did** report
differences, three times, and each was chased to a cause. It is not a matcher
that returns zero whatever it is given.

---

## 2. The three measurements the brief asks for by name

Driven at the running app (`pnpm dev`, localhost:3000), not read off the source.

**`SurfaceBar` at 924px** — the brief's own number, from the prototype bug that
put the primary action fully off-screen there.

| width | horizontal scroll | clipped children | primary action |
|---|---|---|---|
| 924px | none (`scrollWidth 918 === clientWidth 918`) | 0 | fully on screen (774→861 of 924) |
| 700px | none (`694 === 694`) | 0 | fully on screen (101→188 of 700); bar wrapped to two rows, 108px |

`overflow-x` computes to `visible`, `flex-wrap` to `wrap`.

**`Marquee` — no jump at the loop point.** `translateX(-50%)` must equal exactly
one copy's stride, which is a measurement rather than an eyeball:

- track width **2232.00px**, half of it **1116.00px**
- one copy's stride, summed from the items' own boxes and margins: **1116.00px**
- track computed `padding: 0px`, `gap: 0px`, `animation-name: dp-marquee`

**`Transcript` speaker column at 80px with `"night shift"`** — rendered width
**80px**, `scrollWidth 80 === clientWidth 80`, so the string is not clipped.

---

## 3. Both themes

Every new component rendered and photographed in light and dark:
`output/_shift115-evidence/gallery-full-{light,dark}.png` plus per-component
frames. Token resolution differs correctly per theme and the theme-invariant
values correctly do not:

| probe | light | dark |
|---|---|---|
| table head background | `rgb(246,246,248)` | `rgb(32,32,36)` |
| critical severity text (`--errorInk`) | `rgb(192,71,58)` | `rgb(224,138,126)` |
| own-entry transcript spine (`--ink`) | `rgb(17,17,18)` | `rgb(237,237,239)` |
| other-entry spine (`--rule`) | `rgb(240,240,242)` | `rgb(42,42,46)` |
| kept bar (`--accentSolid`) | `rgb(226,104,90)` | `rgb(226,104,90)` — invariant, correct |

⚠ **A full-page screenshot is not a reading of a masked, animated element.** The
marquee appears as an empty band in `gallery-full-light.png` and renders
perfectly in the element frame `marquee-light.png`. The stitched capture does
not composite the mask and transform. Judge that component at its own frame.

---

## 4. What shipped

Nine components, one hook, one helper, four keyframes, one CSS rule.

| | where | grammar from |
|---|---|---|
| `MediaCard` (4 states) | `foundation/primitives.tsx` | `10-shared-patterns.md` → Media card, Dashed create tile |
| `HoverActions` | same | → Hover reveal |
| `SurfaceBar` (+ segmented control) | same | brief 00 |
| `DataTable`, `ExpandableRow` | same | brief 00 |
| `CostedOption` | same | brief 00 |
| `MilestoneRail` | same | brief 00 |
| `Transcript` | same | brief 00 |
| `Marquee` | same | → Motion vocabulary (`dsmarq`) |
| `usePopover` | `foundation/usePopover.ts` | → Popover discipline |
| `severityLook` | `foundation/severity.ts` | brief 00 §4 |
| `dp-marquee`, `dp-slidein`, `dp-pop`, `dp-prog` | `foundation/tokens.css` | brief 00 §3 |
| the parent-hover rule | `foundation/foundation.css` | brief 00 §3 |

Guarded in the suite (`foundation/section00-guard.test.ts`, 15 arms, every one
paired with a positive control): the marquee's zero gap and zero padding, the
80px speaker column and the 10.5px mono floor, the surface bar's wrap and its
ban on `overflow-x`, the parent-driven hover reveal, `severityLook`'s tokens and
its single red, and the media card's label row staying in normal flow.

---

## 5. Three declared deviations from the brief's checklist

Each is a place the brief's letter and the brief's own acceptance test — or the
house's own precedence rule — point different ways. None is a shortcut.

**(a) `SEVERITY_COLORS` / `CATEGORY_COLORS` are NOT deleted yet.** §4 asks for
the deletion; nine call sites across `features/admin/` and `features/moderator/`
render those tints, so removing them repaints the audit log, the activity tab
and five modals — **a visible change to existing pages, which is the one thing
this section may not do**. `severityLook` ships now, which is what unblocks it;
the call-site migration belongs to section 02, which owns those directories.
Filed as a queue card. Nothing was left silently: `severity.ts` says this in its
own docblock.

**(b) The four keyframes are in `tokens.css`, not `foundation.css`.** The brief
puts them in `foundation.css`; the shipped foundation already keeps its five
`dp-` keyframes in `tokens.css`, and the brief's own precedence rule is
**shipped foundation → live prototype → handoff docs → these briefs**. A motion
family split across two files is the drift this system keeps paying for. The
parent-hover rule *is* in `foundation.css` as specified — it is a component
rule, not a keyframe.

**(c) The segmented control has no drop shadow.** The grammar names a
`0 1px 2px` shadow on the active segment. There is no shadow token at that
scale, and §6 is explicit that the token set needs no additions. The active
segment is carried by `--surface` against the `--fillStrong` well plus the
weight change — two of the three signals, and the two that survive a dark theme.

One reading worth stating, which is not a deviation: the brief puts
`ExpandableRow`'s evidence paragraph "on `--well`". The open row is *already*
`--well`, so the paragraph sits on `--surface` inside it. The contrast the brief
describes is preserved; putting both on the same token would have erased it.

---

## 6. Copy audit

Every user-visible string added by this segment lives on `/casting/foundation`,
an **unlinked developer route** that describes the foundation itself. No
customer-facing surface gained a word.

| string | class | note |
|---|---|---|
| Section eyebrows 05–10 (`05 · Media cards` …) | **invented** | continues the page's existing 01–04 numbering |
| Component captions ("The label row sits below the media…") | **invented** | each states a rule this section enforces, in the present tense, about code that exists |
| `NEEDED`, `IMAGE`, `Kept`, `New cast member` | **adapted** | from `10-shared-patterns.md`'s pill and create-tile patterns |
| Sample table rows (`stripe.refund.manual`, `auth.login.locked`) | **invented** | real action-string shapes from `getActionCategory`; no real customer data |
| Sample transcript entries | **invented** | describes this very PR; the "you" entry is illustrative, not a quotation of the founder |
| `CostedOption` samples (`TAKE` / `HOLD`) | **invented** | illustrative decisions, not live plan state |
| `MilestoneRail` sample (M1–M4) | **invented** | ⚠ **illustrative, not the real ladder** — the real rungs are N1–N8 |

**Nothing here claims a capability.** The gallery page's own header already says
what it is: *"This route is unlinked: it exists so the system can be checked
before a product surface depends on it."* No new capability copy, no price, no
promise, and no control that looks live and does nothing.

---

## 7. Verification

- `pnpm check` — **exit 0**
- `npx vitest run client/src/foundation` — **44/44** (4 files, including the 15 new guard arms)
- `token-guard.test.ts` — **passes with no new allow-list entries**
- Acceptance test — **0 changed pixels**, §1 above
- Browser drive — three named measurements, §2 above, both themes §3

**Money: $0.00.** No renders, no credits, no segmenter reads, no text calls.
