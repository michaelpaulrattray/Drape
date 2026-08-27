# The casting room — per-element reconciliation against the drawing

> **Status: dated record.** A measurement/evidence/court document from the date it states — it records what was true then; individual verdicts may since have been superseded. Current law: CLAUDE.md, the capability atlas, `DECISION_LOG.md` (#69 stamping sweep, 2026-08-28).


**Source of truth:** `docs/specs/Casting-ui-ux-design/design_handoff_studio/Klieg Studio.dc.html`,
rendered in headless Edge at 1440×1150 and measured from the DOM. Not read, not
described — rendered. Every number below is measured, not estimated.

**Why this file exists:** the first room was built from prose descriptions of the
prototype's markup with the styles stripped out. The parts list was right and the
design was invented. Descriptions of a drawing are not the drawing.

**How to read the table:** every row either MATCHES the drawing or carries a
DEVIATION with the ratified ruling that overrides it. A deviation without a
citation does not get built.

---

## Frame

| Drawn | Measured | Build |
|---|---|---|
| Two columns | left **678**, right **418**, gap **20** (content 1116) | match — expressed as `minmax(0,678fr) / minmax(0,418fr)` so it holds at other widths |
| Column stacks | gap **14** both columns | match |

## Header

| Drawn | Measured | Build |
|---|---|---|
| Back link | "‹ Casting", 12.5px/400 | match |
| Name + kind | name row h30 gap 10; kind pill 9.5–10.5px/500 uppercase | match |
| One-line read | 13px/400, one sentence | match — copy is persona + provenance |
| Actions | gap 8; **"Open in canvas" 128×34 r8 pad 9/13 12px/400 OUTLINE**; **"Cast in a campaign" 149×32 r8 pad 9/14 12px/500 FILLED** | geometry and weights match. **DEVIATION: both render disabled with "· soon"** — §I honest-capability law: neither capability exists, and a control that refuses is worse than a label that explains. Weights are preserved because the drawing's hierarchy is the point |

## Master block — one card, media + attached footer

| Drawn | Measured | Build |
|---|---|---|
| Card | **678×532**, r14, 1px solid | match (aspect held, not fixed px) |
| Media region | 676×489, **1px gutters** | match |
| Master pane | **392×489 (58%)** | match |
| Companion column | 284×489 (42%), two cells **284×244** | match |
| MASTER chip | **+11,+11 TOP-LEFT**, 57×21, r999, pad 4/9, 9.5px/500 | **fixed — was bottom-left and blend-moded** |
| Footer bar | **inside the card**, 676×41, border-top 1px, pad 13/15 | **fixed — was a detached line below the block** |
| Footer left | 11.5px/400 — *"99.4% identity retention across 18 frames"* | **DEVIATION: copy only.** Invented number → "Every view here was checked against the face you signed." F5 (strip false claims, keep structure) + no-invented-numbers. **Geometry unchanged** |
| Footer right | "IDENTITY LOCKED" 11px/500 + lock glyph 11×11, gap 5 | match |
| Master fill | placeholder | master = the signed anchor; companions = close-up, three-quarter (founder hero-fill ruling, 2026-08-02) |

## Refine card

| Drawn | Measured | Build |
|---|---|---|
| Card | 678×**142**, r14, pad 15/16, gap 12 | match — **was flattened to a prose paragraph** |
| Row 1 | title 12.5px/500 left, hint 11px/400 right, space-between | match |
| Row 2 | input shell 644×48 r10 1px solid pad 10/12; button **80×26 r8 pad 7/13 11.5px/500 filled**, inside the shell | match |
| Row 3 | 5 chips, h24, r999, pad 5/10, 1px solid, 11.5px/400, gap 7 | match |
| State | live | **DEVIATION: inert with honest state** — input and button disabled, chips disabled, one honest line. Founder ruling this batch + the F5 Upload-a-real-person precedent (present, honest coming-soon, not omitted) |

## Takes

| Drawn | Measured | Build |
|---|---|---|
| Section | gap 11 — **was absent entirely** | built |
| Header | "Takes" 12.5px/500 left; count 11.5px/400 right | match. **DEVIATION: count copy** — "No takes yet" rather than "18 frames on file". No invented numbers |
| Grid | tiles **105×131 r9 1px solid**, gap 10, 6 per row | match, as placeholders |
| Duration pill | 46×18 r999 pad 3/7/3/5, 9px/500, inset +6,+6 | not rendered — no takes exist to have durations. Structure returns with M8 |
| Last tile | 1px **dashed** + glyph | match, inert |

## Voice card

| Drawn | Measured | Build |
|---|---|---|
| Card | 418×159, r14, pad 15/16, gap 13 | match — **was a paragraph** |
| Header | "VOICE" 10.5px/500; "Change" 11.5px/400 right | match, Change inert |
| Player | play 38×38 r50%; waveform 298×34 gap 2; duration 10px/500 | match as a skeleton (bars at rest, no fake duration) |
| Divider | border-top 1px, pad-top 2 | match |
| Name / line | 12.5px/500 / 11.5px/400 | **DEVIATION: copy** — honest "no voice yet" instead of a fabricated voice name |

## In campaigns card

| Drawn | Measured | Build |
|---|---|---|
| Card | 418×207, r14, **pad 0** (rows own their padding) | match — **was a paragraph** |
| Header | 416×41 pad 13/16; "IN CAMPAIGNS" 10.5px/500 + count right | match, count **0** |
| Rows | 416×65 pad 11/16 gap 11; thumb 34×42 r6; name 12px/500; meta 10.5px/400; chevron 12×12 | none exist — the drawn empty case |
| Add row | 416×34 pad 11/16 gap 7, 11.5px/400, "+ Cast into a new campaign" | match, inert |

## Siblings card

| Drawn | Measured | Build |
|---|---|---|
| Card | 418×169, r14, pad 15/16, gap 10 | match — **was a paragraph** |
| Label + sentence | 10.5px/500 / 11.5px/400 | match, sentence verbatim from the drawing |
| Tiles | **52×64 r7 1px solid**, gap 8, label 9px/500 at the foot; last tile dashed + | match as placeholders. **DEVIATION: no V2/V3/V4 labels** — those are prototype fiction; unlabelled placeholders instead |

## The package strip

| Drawn | Build |
|---|---|
| **Not in the drawing** | Added below Takes as a quiet strip. **Citation: founder ruling 2026-08-02** — "the package renders as a quiet strip below, not as the room's content; it's infrastructure, not the show." Slot tiles carry the failed-slot confession (D-92 gate condition) |

---

## Deviation summary — every one carries a ruling

| # | Deviation | Ruling |
|---|---|---|
| 1 | Header CTAs disabled, "· soon" | §I honest-capability |
| 2 | Footer copy replaces the retention number | F5 + no-invented-numbers |
| 3 | Refine inert | Founder ruling + F5 Upload-card precedent |
| 4 | Takes count copy, no duration pills | No-invented-numbers |
| 5 | Voice copy honest, skeleton player | §I honest-capability |
| 6 | Campaigns count 0, no rows | Honest empty state |
| 7 | Sibling tiles unlabelled | No-invented-numbers |
| 8 | Package strip added | Founder ruling 2026-08-02 |

**Geometry deviations: none.** Every deviation above is copy or state.


---

# The sheet dock — reconciliation (2026-08-02)

Rendered from the same prototype, sheet screen, **with three candidates kept**
so the dock shows its committed state. Measured from the DOM.

## What is drawn

| Element | Measured |
|---|---|
| Bottom row | h34; NUDGE label 10px/500 + 5 chips h24 r999 pad 5/10 1px solid 11.5px/400, gap 7 |
| Right group | 196×34, gap 10 |
| Thumb cluster | three tiles **24×30, r6, 16px stride → 8px overlap**, 48px total |
| Sign button | **130×34, r9, pad 10/15, 12px/500**, label + 12×12 arrow glyph |
| Label | **"Sign 3 to roster"** — the count is the number kept |

## What is built, and why it differs

| Drawn | Build | Ruling |
|---|---|---|
| Thumb cluster beside the button | **removed** | **F2 — one candidate per ceremony.** A cluster next to "Sign 3" states a ceremony that does not exist. The reconciliation already recorded the multi-sign label as a prototype seam; the cluster is the same seam drawn instead of written |
| "Sign N to roster" | **"Sign to roster · 450 cr"** | F2 (no count) + D-15 (price on the affordance). No tile number either: the selected tray thumb says who, and the confirm shows her face before money moves |
| Button geometry, radius, type weight | **match** | — |
| Selection | not drawn (the prototype signs "all kept") | **selection lives on the kept tray**: single, radio semantics, accent ring on the selected face, most recent keep as default. The ring is the standard selection grammar already used for kept cards in the drawing |
| Nudge chips | match | — |

## Bugs fixed in the same pass

| Report | Cause | Fix |
|---|---|---|
| No way to pick from ten keeps | the tray's click opened the viewer and nothing selected | click selects; double-click and the arrow keys open and walk the viewer |
| Signed candidate stayed in the tray | `listKeptCandidates` admitted `signed` — §F's law was written and never implemented | tray is `ready` only; her row still anchors the Cast's lineage and her siblings' retention |
| Sheet card previewed blank after a Sign | the signed face was still "kept" but no longer projectable, so the preview had a source and no images | signed leaves the tray, **and** the fallback now applies to the projectable result rather than to the source — a card always previews |
| Kept thumbs overlapped the helper line | no clearance on a row that grows | `margin-left` on the tray, pinned by an anatomy assertion |

## Anatomy assertions added

`dockAnatomy.test.ts` — no count in the Sign label, no hardcoded price, no thumb
cluster classes anywhere, radio semantics and a selection ring on the tray,
expandable browsing, arrow-key stepping and Escape in the viewer, and the
helper-line clearance as a rule rather than a screenshot.
