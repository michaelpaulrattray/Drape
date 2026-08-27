# Package v3 — evidence pack (items 2, 4, 5, 6)

> **Status: dated record.** A measurement/evidence/court document from the date it states — it records what was true then; individual verdicts may since have been superseded. Current law: CLAUDE.md, the capability atlas, `DECISION_LOG.md` (#69 stamping sweep, 2026-08-28).


**Gate:** D-101's exit condition for the close-out batch. One paid production
Sign, both themes, every user-visible string classified.

**The verification Sign:** `KI-MUQH-Q4NT-LBXC-C2MX` ("Package Three"), signed on
2026-08-02 from candidate `6dbad1e1`. **Five of five views landed. 450 credits
charged, nothing refunded, no room notice** — which is itself the D-103 test
passing in the negative direction, since a partial or total loss would have said
so.

Timings, measured: signed in 12.4s; first view at +76s; all five terminal at
+135s.

---

## Item 2 — the package v3 strip

**Screens:** `pack-room-dark.png`, `pack-room-light.png` (1440×1150 @2x, full page).

The strip presents **six things, and the first costs nothing**:

| Position | Label | Source | Paid |
|---|---|---|---|
| 1 | Master | the signed sheet image (anchor) | no — presentation only |
| 2 | Close-up | generated 2K | 50 cr |
| 3 | Portrait | generated 2K | 50 cr |
| 4 | Full front | generated 2K | 50 cr |
| 5 | Side profile | generated 2K | 50 cr |
| 6 | Full back | generated 2K | 50 cr |

The count reads **"5 of 5 views"** — the Master is excluded, because it was never
a paid view. Pinned in `roomAnatomy.test.ts` ("leads the package strip with the
Master"), which asserts the Master tile draws from `data.anchorUrl` and the
count expression does not.

The hero's two companions are the close-up and the side profile, per the ruling.

**Retirements verified:** the profile contains no `sideFull` (the walk, retired
in v2) and no `threeQuarter` (retired in v3). Pinned by the same file, because a
profile that quietly regained a slot would move the real price without moving
the price constant.

### The true close-up, and the smoothing question (item 3)

**Verdict: no edit-engine smoothing. The opposite.**

Measured at the same facial region — brow to lower lip, same aspect:

| | pixels across that region |
|---|---|
| sheet candidate (source) | **206 × 307** |
| v3 close-up | **1696 × 2528** |

Roughly **8× linear resolution** on the face. At matched display size the
close-up resolves pore structure, vellus hair on the cheek and jaw, individually
separated lashes and iris striation; the sheet candidate at the same crop is an
upscale — skin reads as soft and waxy, freckles as blobs, no pore structure at
all.

Comparison images: `smoothing-a-sheet.png` (sheet, same crop) and
`smoothing-b-closeup.png` (v3 close-up).

**Consequence: build nothing.** Progressive reference enrichment was the queued
lever *if* smoothing were confirmed. It is not, so per the founder's instruction
that work stays a design note and is not started.

---

## Item 4 — credit-label fatigue

**Screens:** `pack-sheet-dark.png`, `pack-dock-dark.png`, `pack-dock-light.png`.

As approved in the mock — the TRY-chip mechanism applied to Follow:

- Per-tile action chips read **`Follow`**, unpriced. Eight of them on a sheet, so
  eight repetitions of a price nobody re-reads.
- The dock carries the price once, persistently: **`Rolls and follows · 160 cr`**.
- The primary buttons still price themselves, because they are the commitment:
  **`Roll again · 160 cr`**, **`Sign to roster · 450 cr`**.

**No unpriced tap.** The mechanized law was rewritten to match the ruling — it
now fails only when a paid action has *no price anywhere in view*, rather than
demanding every button carry one. Measured on the live sheet:
`unpricedWithNoPriceInView: []`.

---

## Item 5 — the Sign confirm leads with her

**Screens:** `pack-signconfirm-dark.png`, `pack-signconfirm-light.png`.

In reading order: her image at full card width → her persona line ("Quietly
cool") → **"Sign her to your roster"** → what it does → **"Her name"** with the
field focused → `Not yet` / **`Sign to your roster · 450 cr`**.

**The tile number never appears.** Pinned in `dockAnatomy.test.ts` ("requires a
name before anything is spent"), which asserts `dpc-sign__portrait` is present
and `Sign {indexLabel}` is absent, that the button is disabled while the name is
empty, and that the server's own input schema refuses an absent name — three
places, because a rule that lives only in the dialog is a rule the next caller
skips.

---

## Item 6 — room media interactions

Measured on the live room: `hasActions: true`, `downloadLinks: 7`,
double-click-to-open present on the master. The viewer walks the package with the
Master included (`onStep`), arrow keys move, Escape closes. Pinned in
`dockAnatomy.test.ts` ("opens a room image large, and offers it for download").

---

## Mechanized design laws — measured, not reviewed

Run against the live sheet at 1440×1150:

| Law | Result |
|---|---|
| No mono on sentences (>6 words) | `monoSentences: []` |
| No inner-element focus outlines on text fields | `textFieldOutlines: 0` |
| Dock visible without scrolling | `true` |
| No unpriced paid tap with no price in view | `[]` |

---

## Copy audit

Every user-visible string on the three surfaces, classified. **Prototype-verified**
= present in the drawing. **Adapted** = drawn, changed for capability truth.
**Invented** = written for this build with no prototype source.

### The room

| String | Class | Note |
|---|---|---|
| `PERFORMER` | prototype-verified | kind chip |
| `Back to the sheet` | prototype-verified | |
| `MASTER` | prototype-verified | chip, top-left of the master |
| `Every view here was checked against the face you signed.` | adapted | drawing said "identity verified"; this states the mechanism that actually ran |
| `IDENTITY LOCKED` | prototype-verified | |
| `Refine without recasting` | prototype-verified | |
| `Face stays locked. Everything else is fair game.` | prototype-verified | |
| `Refining a signed Cast arrives with refinement. Until then, a new direction means a new sheet.` | invented | honest-capability line; the control is disabled and says why |
| `Takes` / `No takes yet` | prototype-verified | |
| `THE PACKAGE` | prototype-verified | |
| `5 of 5 views` | invented | the drawing showed no count |
| `Master` | invented | v3 label for the free leading tile |
| `Close-up` | invented | v3's new true macro |
| `Portrait` | adapted | was "Close-up" in v2; relabelled because the pixels are head-and-shoulders and always were |
| `Full front` / `Side profile` / `Full back` | prototype-verified | |
| `VOICE` / `No voice yet` / `A designed voice and an audition clip arrive with voice.` | adapted | drawing showed a working player; capability truth replaces it |
| `IN CAMPAIGNS` / `Campaigns aren't built yet…` | adapted | same reason |
| `SIBLINGS` / `Variants cast from the same sheet. Useful when a campaign needs a near-miss rather than a new face.` | adapted | drawing had the card, not the sentence |
| `Open in canvas · soon` / `Cast in a campaign · soon` | adapted | drawn as live buttons; `· soon` + disabled is the capability truth |
| `Sharp edges. Cast from a sheet on 1 August` | invented | persona line + provenance, composed server-side |
| **`The package didn't arrive — everything you paid has been refunded, including the Sign itself. The face you chose is still yours; the views can be rebuilt when repairs ship.`** | invented | D-103. **Not exercised by this Sign** — five of five landed. Its wording is pinned in `castProjection.test.ts` |

### The sheet and its dock

| String | Class | Note |
|---|---|---|
| `Everyone on this sheet is cast as a street cast — in their mid 20s. The eight differ by disposition.` | invented | the brief echo; composed from the interpreted brief |
| `Keep` | prototype-verified | |
| `Follow` | adapted | drawn with a price; item 4 moved the price to the dock line |
| `Roll again · 160 cr` | prototype-verified | price is server-derived (D-15) |
| `Rolls and follows · 160 cr` | invented | item 4's persistent price line |
| `Keep the ones worth a second look` | prototype-verified | |
| `Keep the one you want, then sign her` | adapted | drawing said "sign them" — F2 is one candidate per ceremony |
| `Sign to roster · 450 cr` | adapted | drawn as "Sign 3 to roster"; the count states a ceremony that does not exist |

### The Sign confirm

| String | Class | Note |
|---|---|---|
| `Sign her to your roster` | adapted | drawn without the possessive |
| `This locks the face and builds the complete package — 5 views of this exact person, included in the price. Nothing else on the sheet changes, and a candidate can only be signed once.` | invented | the view count is derived from the profile, never a literal |
| `Her name` / `Give her a name` | invented | naming is part of the ceremony (founder ruling) |
| `Not yet` | prototype-verified | |
| `Sign to your roster · 450 cr` | adapted | drawn unpriced |

---

## Known non-defect

In the light-theme **full-page** screenshots the left rail's background stops at
the viewport height. That is an artifact of capturing a `position: fixed`
element in a full-page shot — in a real browser the rail is fixed and always
fills the viewport. Recorded so it is not re-reported as a theme bug.
