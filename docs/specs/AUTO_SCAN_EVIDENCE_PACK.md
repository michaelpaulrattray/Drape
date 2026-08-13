# The auto-scan — evidence pack

*For the founder, before `CASTING_FACE_SCAN_SCOPE` is offered for his own
account. Written 2026-08-13, shift 69, against the UI milestone completion
contract and fable-378's riders. Every number here was produced by a run whose
artifacts are on disk in `output/face-scan/`; nothing is quoted from memory.*

> **His report (fable-352):** *"you never mentioned original image analyzing to
> prefill the library at the moment it still shows blank slots completely
> unrelated"* — with a screenshot of a panel of empty boxes.

---

## 1. What changed, in one line

A face nobody has edited is read once when it is selected, and the panel shows
her own eyes, brows, nose, ears, hair and glasses instead of empty squares.

## 2. The before and after, both themes

| | file |
|---|---|
| Before — the library alone, his own screenshot | `panel-before-dark.png`, `panel-before-light.png` |
| After — the scan merged in | `panel-after-dark.png`, `panel-after-light.png` |
| The whole surface | `sheet-dark.png`, `sheet-light.png` |
| The photograph, unchanged | `picture-dark.png`, `picture-light.png` |
| Each cutout at its own size | `tile-00-her-eyes.png` … `tile-05-her-glasses.png` |
| Controls | `control-no-frame.png`, `control-moved-crop.png` |

```
BEFORE  16 rows · 1 thumbnail (her lips, minted by an edit) · 1 click target
AFTER   16 rows · 7 thumbnails · 7 click targets
        six of them scan-born: eyes, brows, nose, ears, hair, glasses
```

**There is no prototype comparison in this pack, and that is deliberate.** The
panel's structure and copy were verified against his mock in shift 27; this
build changes what fills the rows, not what the rows say. The one new
user-visible string is in §5.

## 3. What it costs him — the numbers he should have before he flips it

| | |
|---|---|
| **First look at a version** | **21.0 s** from the panel appearing to the cutouts arriving |
| Every look after | **0.0 s** — the panel arrives complete in its first payload |
| What he sees during those 21s | today's panel exactly: rows, words, the one minted crop |
| Money | **$0.060 per version looked at**, once — 12 segmenter calls at $0.005 |
| **His credits** | **zero. A scan is house money on a read he never asked to pay for.** |
| Payload | 3,088 bytes of stencil for a whole face |
| Storage | none. No object is written, so nothing is purged and nothing can be orphaned |

**The 21s is the honest cold-start number and it is not hidden here.** It was 14
calls when the build landed and is 12 now (the midline is read once per frame
rather than once per pair), which takes money from $0.070 to $0.060 but only a
little of the waiting — the calls run in parallel, so the wall clock is the
slowest of them.

**What is expected to shave it: nothing measured yet.** The 512px cheap eye was
the candidate and it was **refused on the evidence** (§6). If the 21s reads as
too long in his own hand, the next lever is fewer questions per scan, not
cheaper ones, and that is a product decision about which rows are worth a call.

## 4. Where it is dark

`CASTING_FACE_SCAN_SCOPE` — off everywhere including production, and the server
**refuses to start** if it is set for a user whose panel cannot render:

```
CastingFaceScanCoverageError: CASTING_FACE_SCAN_SCOPE cannot be enabled while
CASTING_REFERENCE_LIBRARY_SCOPE is off — the scan fills a panel that does not render
```

Rehearsed, not assumed: that is the real boot log of a real start attempt.

## 5. The copy audit

| string | where | classification |
|---|---|---|
| every panel row name, heading and provenance line | unchanged | VERIFIED — shipped, founder-cleared in shift 27 |
| **"Her right eye"** (and its siblings) on a region's tag | new | **DERIVED** — composed by the server from the slot catalogue's own noun and this face's pronoun, the same function that writes "Her left earring". It appears only where a matched pair's rectangle covers ONE instance (fable-378 (c)): the row still reads "Her eyes"; the box says what it actually covers |
| anything else | — | nothing invented. No new sentence ships with this build |

## 6. What was measured and refused

**The 512px cheap eye: DO NOT ADOPT.** Bar pre-registered and committed before
the first call; 16 of 18 regions inside it, and the bar says every region.

```
FAIL  lips      IoU 0.459   area 54% off      ← a rectangle that has slid off her mouth
FAIL  eye@left  IoU 0.713   area 40% off
ok    16 others IoU 0.825–0.997, centre ≤ 0.62% of the longer side
```

It would have saved between 1.3× and 2.9× of the wait and **nothing at all in
money** — SAM 3 charges per request, not per pixel.

## 7. What this pack does NOT prove

Said plainly, because a pack that reads as complete is worse than one with a
list:

- **That every cutout is the right feature on every face.** Three controls prove
  the tiles are real, distinct, and cut where the geometry says (frame removed:
  Δ38.40; crop moved to the far corner: Δ34.03; all 15 tile pairs distinct,
  closest 34.09). **Whether that is genuinely her ear rather than her jaw is a
  human judgement**, and the six tiles are in the pack at their own size so it
  can be made.
- **One face.** The panel walk is the fixture face. The eyes court read six more
  and the 512 court two, but the *panel* has been driven on one.
- **That a scan never fails.** When the reader is down the panel is exactly
  today's panel; nothing is charged and nothing is shown that was not measured.
  That path is unit-tested, not driven in the browser.
