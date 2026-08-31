# The Invite label — #350, measured in the running app

**Shift:** foreman-151, 2026-08-31. **Card:** [#350](../../..) (`founder-ordered`, `bug`).
**Money: zero.** No render, no text call, no credit.

His card's bar was explicit, and it is the reason this file exists: *"Measured
in the running browser, both themes — computed `font-size` on the Invite label
is exactly `9.5px`, **not asserted from the stylesheet**."* A source guard
cannot see a cascade, so the numbers below are the finding and
`section02-guard.test.ts`'s three new arms are only the net that keeps them.

**Driver:** Playwright against the dev server on the shift worktree, 1440×900,
session minted for `verify-bot-local`. Surfaces: `/app` (lobby) and `/casting`.

---

## 1 · The defect, before

| element | computed `font-size` | weight | family |
|---|---|---|---|
| **`Invite`** (`.dp-invite .dp-rail__label`) | **16px** | 400 | Archivo |
| `Home` (active destination) | 9.5px | 500 | Archivo |
| the other seven destinations | 9.5px | 400 | Archivo |
| `document.body` | **16px** | 400 | Inter |

⚠ **HIS FIX WAS RIGHT AND HIS DIAGNOSIS WAS ONE STEP OFF, AND THE DIFFERENCE IS
THE WHOLE SHAPE OF THIS CHANGE.** He read it as *"inheriting the nav label
size"*. The nav labels are **already 9.5px** — `.dp-rail__item` carries
`font: 400 9.5px var(--font-sans)` — so if Invite had been inheriting from the
nav it would have been correct. It sits **outside** any rail item
(`Rail.tsx:206`, in the rail's foot), `.dp-invite` declares no font at all, and
so it inherited past both to the **document**: 16px, exactly the body size,
which is the number in the last row of that table.

His prototype value (`400 9.5px`) is unchanged. Only the reason was different.

**Frames:** `output/350-frames/before-light-rail.png`, `before-dark-rail.png` —
the word `Invite` is visibly larger than every destination above it.

## 2 · After

| reading | light | dark |
|---|---|---|
| `Invite` computed `font-size` | **9.5px** | **9.5px** |
| `Invite` weight / colour | 400 · `rgb(107,107,112)` | 400 · `rgb(154,154,162)` |
| active destination `font-size` | 9.5px | 9.5px |
| **active destination weight** | **500** | **500** |
| the other seven destinations | 9.5px unchanged | 9.5px unchanged |
| `/casting` (the reference surface) | Invite 9.5px · active nav 9.5px/500 | — |
| ≤720px: both labels `display` | `none` (rail 56px) | — |

**Frames:** `after-light-rail.png`, `after-dark-rail.png`.

⚠ **THE ACTIVE-WEIGHT ROW IS NOT DECORATION — IT IS THE TRAP THIS CHANGE HAD TO
STEP AROUND.** The tempting fix is `font: 400 9.5px var(--font-sans)` on the
label, matching the shorthand the rail item already uses. The `font` shorthand
**resets `font-weight`**, and the current destination's bold comes from
`.dp-rail__item[aria-current="page"] { font-weight: 500 }` on the ITEM — the
label gets it by inheritance. The shorthand would have silently un-bolded the
active label while every assertion about size still passed. `font-size` alone;
one arm forbids the shorthand by name.

## 3 · The class sweep (working law 7) — measured, with a positive control

The class is *"a text class whose size lives only on an ancestor, used at a call
site outside that ancestor."* Grepping for it is guesswork; the browser can
answer it directly, because **the foundation's type scale has no 16px step** —
it runs 31 / 27 / 13.5 / 13 / 12.5 / 11.5 / 10.5 / 10 / 9.5 / 9. So any chrome
element computing to exactly the ambient 16px is one that inherited the document
instead of the design.

| run | population | at 16px |
|---|---|---|
| **positive control** — the fix disabled in the live page (`font-size: inherit !important`) | 120 chrome elements | **1 — `dp-rail__label` "Invite"** |
| the fix on | 120 chrome elements | **0** |
| whole document, **account menu open** (163 → 210 elements) | 23 text-owning visible elements | **0** |

The control run is what makes the empty result mean anything: the same sweep,
one line different, finds exactly the defect it was written for.

**Stated limit:** the sweep sees what is mounted. The help menu and the modals
were not opened, and a surface that renders only under other state was not
visited. It is a floor, not coverage.

## 4 · The guard, proven able to fail

Three arms in `client/src/foundation/section02-guard.test.ts`, and the card
named the reason they are shaped this way: *"an arm asserting Invite is smaller
than a destination label would be **vacuous once fixed**"* — both 9.5px, so it
is `<=` not `<`, and it would pass on the bug's absence and on its return alike.
**The arms assert the VALUE.**

Four sabotages, each aimed at reddening exactly one arm
(`scripts/_350-sabotage-disposable.mts`, every file restored in a `finally` and
hash-compared byte-identical afterwards):

```
BASELINE  green · green · green
EXACTLY ONE, the right one  arm 0 · the size is a different number (11px)
EXACTLY ONE, the right one  arm 1 · the size arrives via the `font` shorthand
EXACTLY ONE, the right one  arm 2 · the fix is scoped back to .dp-invite
EXACTLY ONE, the right one  arm 2 · .dp-invite grows a font of its own
RESTORED  byte-identical ✓
```

Three arms that all died on every sabotage would be one arm wearing three names.
