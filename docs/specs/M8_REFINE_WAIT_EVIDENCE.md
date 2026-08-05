# The refining wait, shipped — evidence pack

**D-169 (loader) and D-180 (chips), wired 2026-08-05** after the founder's r3
sign-off on `docs/specs/mocks/casting-refine-wait.html`. Posted for the Fable
law skim before the founder's verification pass, per the UI milestone contract.

## What was captured, and how

Six states driven in the **real app** at `localhost:3000`, both themes, on a
real roll with a real unrefined candidate. Screenshots at 2× in
`scratchpad/ship/{dark,light}-0*.png`.

The three wait states are captured by **splicing a `pending` row into the live
`castingV2.variants` response** — the render path, the CSS and the data shape
are all the real ones; only the row's existence is staged. This is deliberate
and it is not the proof that it runs: **the proof that it runs is the
production walk (D-174)**, recorded at the end of this file, where a real
refinement was bought and watched.

A note on why the splice needs a remount: the variants query only polls *while
something is pending*, so a spliced response is never requested until the panel
remounts. The driver closes and reopens the face. That is a fact about the
product, not about the driver.

| # | State | What it shows |
|---|---|---|
| 01 | Submitted | The picture soft, dots up, `in line`, the ghost slot holding the same treatment in miniature |
| 02 | Refining | `being drawn` — the one transition the wait actually contains |
| 03 | The long wait | Identical to 02 plus the two-minute sentence in the panel. **Nothing about the picture changes**, because nothing was learned |
| 04 | Resolved | Sharp, in colour, no sentence — a paid render announces itself by being the picture |
| 05 | Which part? | The cold-start question with three chips, free |
| 06 | Did you mean? | The typo question with two chips, free |

## Copy audit

Every user-visible string this batch introduces or changes.

| String | Class | Note |
|---|---|---|
| `in line` | **invented** | Plain-English for the row's `queued`. The state is real; the wording is ours |
| `being drawn` | **invented** | Plain-English for `dispatched` |
| `usually about half a minute` | **measured** | Median of the last 64 successful production refines, 2026-08-05: 19s min, 25s p25, **31s median**, 41s p75, 60s p90. A copy constant with its provenance written beside it — re-measuring is a deliberate edit, never automatic |
| `pinker — which part? Nothing's been coloured yet, so I don't want to guess.` | **adapted** | Mock-verified. The trailing *"Say the hair, the eyes, makeup"* clause is **retired** — it existed only because there were no chips |
| `Did you mean pink?` | **adapted** | Mock-verified. Trailing *"Say yes, or type it again your way"* retired for the same reason |
| `the hair` · `the eyes` · `makeup` | **prototype-verified** | Chip labels, exactly as mocked |
| `Yes — pink` · `No, piink is right` | **prototype-verified** | Chip labels, exactly as mocked |
| `and N more running` | **invented** | Only when more than one refinement is out. The picture narrates the newest; the rest are counted, because a picture cannot narrate two things |
| `This one is taking longer than usual…` | **unchanged** | Pre-existing, and the taker-backer for the "usually" line on a slow day |
| Refusal and free-outcome sentences | **unchanged** | Quoted verbatim in the mock from the live strings; not touched here |

## Where shipped differs from the mock

- **The ghost chip.** Shipped first as the old empty dashed box with "Refining…"
  in it; corrected to the mock's version — the base under the same treatment,
  small and dim — before this pack was cut. The word left with the box, because
  the picture is narrating now.
- **Nothing else.** The treatment, the type, the falloff, the dot geometry and
  the two-line status are the mock's, and the mechanizable half is pinned by
  `client/src/features/castingV2/refineWait.test.ts` (14 assertions).

## The laws that are now assertions, not memory

`refineWait.test.ts` holds: the blur is clipped to the plate; the dot field is
uniform and full-frame; no keyframe animates a width (a growing bar is a
progress bar whatever it is called); the status is set in the sans face, never
mono; exactly two stage words exist; no percentage, no `setInterval`, no
`Date.now()` in the wait; the typical-wait constant carries its date and its
median; a chip submits its **label** (so tapping and typing are one server path,
never two); the box stays live beside the chips; nothing in the path is a
dialog; and the question and its chips both clear on the next submission and on
dismissal.

## Production walk (D-174)

Recorded after deploy — see the batch report.
