# The topbar's six chrome glyphs — evidence (#423)

**His words, 2026-09-02:** *"we closed out top bar icons work prematurely as the
topbar icons havent been changed yet"* and *"the icons are not the same as the
prototypes on the top bar e.g the bug icon the theme icon notification icon
etc."*

**He was right on both, and the second sentence is the one that matters** — the
first reads as a process complaint and is actually a measurement.

---

## 1 · What was wrong, and why every check passed anyway

`client/src/foundation/icons.tsx` and the founder's handoff copy under
`docs/specs/Casting-ui-ux-design/drape-redesign/icons.tsx` were **byte-identical
on all 28 keys**, and `icons-guard.test.ts` had an arm asserting exactly that.
It was green throughout.

⚠ **But the handoff is not the prototype.** His own diagnosis on the earlier
card: the prototype draws the topbar's icons **inline in its markup** rather
than through its icon map, so exporting the map produced the rail, the tool
modes and the settings sections and **missed the chrome**. The six were then
drawn fresh to fill that hole — into both files at once.

**A guard comparing two copies of one mistake cannot see the mistake.** The
verification chain was `code ↔ his file ✅` … and `his file ↔ prototype` never
checked at all.

## 2 · The six, read at the prototype

Source: `docs/specs/Casting-ui-ux-design/design_handoff_studio/Klieg Studio.dc.html`
— the refreshed copy he supplied himself (his acceptance check holds: `cinema`
appears 15 times, `staff` 12). Three glyphs live in its `barIcons` array, two in
`themeIcon`, and search is drawn inline in the search field's own markup.

| glyph | the difference |
|---|---|
| **What's new** | ⚠ **A different OBJECT.** His is a SPEAKER with one arc; ours was a MEGAPHONE with a handle. |
| **Report a bug** | ⚠ **A different drawing.** His has a separate antennae stroke above a domed body with **six** legs; ours was a capsule with two antennae and **four**. |
| **Search** | Circle centred (11,11) r7 with a handle from 16.5 to 21; ours was centred (10.5,10.5) with a shorter handle. |
| **Theme · sun** | Longer rays and a larger core; ours had shorter rays on a 3.6r centre. |
| **Theme · moon** | 8.5r against our 8.6r — visibly the same glyph. |
| **Help & docs** | The hook and the dot are drawn differently; 8.5r against 8.6r. Visibly the same glyph. |

⚠ **Two of the six are near-identical to the eye** (`moon`, `help`) and are said
so here rather than folded into "all six changed". The two he named first —
the bug and the notification — are the two that are different objects.

## 3 · The one that is not a copy, and it was MEASURED

The prototype draws search as a `<circle cx=11 cy=11 r=7>` **element** plus a
`<path>`. `Icon` splits a path string on `M` and renders `<path>` and nothing
else, so a circle element cannot go into `P` as drawn: either `Icon` gains a
second primitive, or the circle is written as this set's arc pair.

The card's instruction was *"measure it, do not assume; a curve that is
'basically the same' is what produced this card."* So it was rendered, not
reasoned about:

| rendered at | prototype `<circle>` vs the arc pair | vs a control moved 0.1 units |
|---|---|---|
| 13px | 52/169 px differ · max delta **54**/255 · mean 5.3 | max delta 54 |
| 15px | 56/225 px differ · max delta **62**/255 · mean 5.1 | max delta 46 |
| **120px** | 454/14400 px differ · max delta **66**/255 · mean **0.65** | max delta **188** · mean **2.47** |

The differing pixels form **two hairline rings** at the inner and outer edge of
the stroke — the renderer's antialiasing of an arc against a native circle —
and the handle shows **zero** difference. The 0.1-unit control produces a
crescent at nearly three times the delta.

**Verdict: the circle becomes an arc path. `Icon` gains nothing.** The
conversion is written out inside the guard rather than trusted.

⚠ **AND THERE IS ONE RESIDUAL DIFFERENCE ON THIS GLYPH, NAMED HERE RATHER THAN
LEFT SILENT** (the fidelity law asks for exactly that, and the gate reviewer
was right to ask): **the prototype draws its topbar search inline at
`stroke-width="2"`; the product renders it through `Icon` at 1.7.** The curve is
proven identical above; the stroke weight is not.

**1.7 is deliberate and is the right answer.** The prototype's own `svg()`
helper — the one that draws the *other five* chrome glyphs — is itself
**strokeWidth 1.7** (`Klieg Studio.dc.html:4406`), so the inline `2` is the
prototype disagreeing with itself on one element rather than a decision about
search. Matching it would give this product one glyph a fifth heavier than
every neighbour in the same bar, against the set's own standing rule that icons
get bigger and never heavier. The frames went to his eye at 1.7.

## 4 · The guard that was missing

A new block reads the **prototype itself** as a third artifact — it is in the
repository, so this is a file read and not a screenshot. It is deliberately a
different resolver from the existing arm: that one compares two TypeScript
files, this one parses HTML, so neither inherits the other's blind spot.

**Six sabotage arms, driven** (`baseline` first, so a RED cannot be the driver):

| # | sabotage | handoff arm | prototype arm |
|---|---|---|---|
| 1 | none (baseline) | — | **GREEN (42)** |
| **2** | ⚠ **BOTH copies reverted together** | **GREEN** | **RED** |
| 3 | one copy only | RED | RED |
| 4 | the prototype's own megaphone edited | — | RED |
| 5 | the prototype moved away | — | RED |
| 6 | search moved 0.1 units | — | RED |

**Arm 2 is the whole point**: it is the exact shape that hid this for weeks, and
the old arm stays green through it while the new one fails.

⚠ **The sabotage driver's first run was itself wrong and is recorded rather than
quietly fixed.** With `shell: true` on Windows, `spawnSync` joins argv into one
command line with no quoting, so an unquoted `-t` pattern containing spaces was
re-split by cmd and the words after the first became extra FILE filters. It
reported `GREEN (129)` and `RED (2/99)` **over a 42-arm file**. Every verdict
looked like a finding; **the tell was the COUNT**. The driver now refuses a run
whose scope or arm count is not what it asked for.

## 5 · Driven in the running app — law 6

`/app` at 1440×900, deviceScaleFactor 2, both themes, against the branch build.
**24/24 readings.** Each records what it SAW.

- Every prototype subpath found in the live DOM: bug 8/8, help 3/3,
  megaphone 2/2, search 2/2.
- The theme toggle draws exactly one of the pair, and the right one:
  **sun in dark, moon in light** — which is the prototype's own binding (its
  hint reads *"switch to light"*).
- The old bug drawing is **absent** from the screen in both themes, so this is
  not a stale bundle.
- The theme was read back off `document.documentElement.dataset.theme` rather
  than trusted, so the light arm cannot be a second dark arm.

**The driver's own control**: the glyph was reverted in the running tree, Vite
rebuilt, and the drive re-run — **20/24, failing exactly the `bug` arm and the
"old drawing is gone" arm, in both themes, and nothing else**. Restored and
back to 24/24. A 24/24 with no such control is a floor, not a reading.

**Frames**, both themes, in his gallery:
`output/429-frames/glyphs-{dark,light}.png` (BEFORE · HIS · AFTER, at 15px and
56px) and `output/429-frames/topbar-{dark,light}.png`.

## 6 · What was deliberately NOT touched

- **Chevrons and the folder** — on his stays-Lucide list, and both sit in this
  same bar. Untouched on purpose, not overlooked.
- **The account chip.** His own word closed it: *"the person icon is my profile
  picture? its for my profile its the dropdown menu?"* The Lucide `User` there
  is the fallback when an account has no photo and no initials; the prototype
  draws initials in a gradient circle. That is a different question.
- **The rail.** Judged and passed by his eye already.
- **Every other key in `P`.** The rail's destinations and the tool modes come
  through the map he exported and are the existing arm's business.

## 7 · Both copies moved, in one act

`icons.tsx`'s own provenance docblock says the handoff *"is never edited to
match code"* — that clause bans papering over a transcription slip by moving his
file to wherever ours ended up. This runs the other way, on the earlier
precedent: **his own newer word moved the glyph, and both copies changed
together**, so the mirror arm still does its whole job. The test of which kind a
change is: *did the correction come from him, or from this repository?* It came
from him, at the frames.
