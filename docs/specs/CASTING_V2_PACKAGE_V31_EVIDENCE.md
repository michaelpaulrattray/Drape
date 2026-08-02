# Package v3.1 — evidence pack

**Gate:** D-101. One paid dev Sign against the new close-up band, rendered and
measured, both themes.

**Verification Sign:** `KI-AHYN-73DD-7HFM-7F2V` ("Package Three One"),
2026-08-02. **450 charged, 100 refunded** for two failed views, net 350.
**Five slots rendered — no sixth, and no duplicate rung.**

Timings: signed 12.2s; close-up +79s; three-quarter +91s; full front +125s; two
terminal failures by +199s.

---

## The composition

| # | Tile | Source | Paid | State |
|---|---|---|---|---|
| 1 | Master | anchor (signed sheet image) | — | ready |
| 2 | Close-up | generated 2K | 50 | ready |
| 3 | Three-quarter | generated 2K | 50 | ready |
| 4 | Full front | generated 2K | 50 | ready |
| 5 | Side profile | generated 2K | 50 | **failed-refunded** |
| 6 | Full back | generated 2K | 50 | **failed-refunded** |

Count reads **"3 of 5 views"** — the Master excluded, as always. No `frontClose`
tile appears anywhere: the anchor no longer conjures one.

---

## The close-up sits in the band

`v31-closeup.png`, 1696×2528 native.

Checked against each landmark the spec names:

| Predicate | Result |
|---|---|
| top edge crops across the forehead, crown cut | ✅ |
| whole chin in frame, margin of skin below it | ✅ |
| both eyes fully visible | ✅ |
| hair runs off the left and right edges | ✅ |
| front-on | ✅ |
| not too loose — no shoulders, no headroom above hair | ✅ |

It lands close to founder reference A (the tight preference): brow plus a little
forehead, down to below the chin. The v3 macro this replaces cropped at the
lower lip and would now fail its own successor.

---

## The hero

`v31-hero.png` — Master large, **three-quarter** in the first companion cell.
The second cell is the side profile, which failed on this Sign and therefore
shows its label rather than a stand-in: a companion may never fall back to the
anchor, or the hero shows her twice and calls one of them a view.

The three-quarter reads as a genuinely different viewpoint beside the Master,
which is the whole point of the change.

---

## What the run found — two judge failures, neither the image's fault

**Side profile.** The judge's own note reads: *"This is a true side profile with
only one eye visible… overall it satisfies the 90-degree side profile
requirement."* — and it returned `pass: false`. A passing sentence attached to a
failing boolean. The customer was refunded 50 credits for a correct view.

This is the **judge-consistency** item already on the deferred queue, now with a
clean specimen: the contradiction is between the note and the verdict, in one
reply, on one axis. Worth fixing when the judge work is picked up — a verdict
whose own explanation argues the other way should probably not be trusted in
either direction.

**Full back.** Failed on wardrobe: *"dark leather dress shoes instead of plain
neutral shoes, and trousers with visible button/stitch detailing not specified
as plain."*

**This one was ours, and it is fixed.** The anchor is a chest-up photograph — it
shows no trousers and no shoes — so there was nothing to compare against, and
the judge was left adjudicating our adjective "plain" against its own taste. It
is the maiden-voyage defect class exactly: the customer pays for our
contradiction.

The judged spec now names its own limits ("anything below the frame of the
reference cannot be compared to it and must not fail this check"), and the
garment instruction moved into the three full-length **directives**, which the
generator reads and the judge never sees.

**The trap worth recording:** `spec.wardrobe` is read by BOTH the judge and the
generator (`composePackageViewPrompt`). Scoping it for the judge alone would
have quietly stopped asking for trousers at all — a fix creating a worse defect
than the one it closed. Caught by checking the call site rather than trusting
the field name.

---

## Two consequences fixed with the composition

**The anchor no longer conjures a slot.** `castProjection` counted
`entry.anchor` as evidence a view existed. With `frontClose` unpromised that
would have drawn a Portrait tile out of the Master's own pixels. Verified
against every historical shape, and against the database: **0 signed Casts lack
a durable promise**, so none loses a tile.

**The recovery receipt counted slots, not views.** `activateSignedCast` seals a
`frontClose` slot from the anchor to satisfy D-97, so recovery would have
reported **six views on a five-view Sign** — on the one document support reads
when something has gone wrong. Now intersected with the Sign's own promise.
Regression test verified failing against the old code first.

---

## Anatomy tests

| Assertion | File |
|---|---|
| v3.1 slot list, `frontClose` and `sideFull` absent by name | `roomAnatomy.test.ts` |
| hero fills with `["threeQuarter", "sideClose"]`, stand-in guard intact | `roomAnatomy.test.ts` |
| close-up spec is a band, both failure directions named, v3 language gone | `castViewPackage.test.ts` |
| three-quarter spec intact and reference-relative | `castViewPackage.test.ts` |
| wardrobe axis judges only what the reference establishes | `castViewPackage.test.ts` |
| generator still told about trousers, and only on full-length views | `castViewPackage.test.ts` |
| recovery receipt counts views sold, not slots sealed | `signRecovery.test.ts` |

---

## Copy audit — changed strings only

| String | Class | Note |
|---|---|---|
| `Three-quarter` | prototype-verified | returning label, unchanged since v2 |
| `Portrait` | **retired from new Signs** | kept for every Cast that bought one |
| `Close-up` | unchanged | the spec beneath it changed, not the word |
| Hero placeholder `Three-quarter` | adapted | was `Close-up` |

---

## Suite

3,963 passing, typecheck clean, build green, Atlas fresh. Commit `68ab613d`,
deployed dark.
