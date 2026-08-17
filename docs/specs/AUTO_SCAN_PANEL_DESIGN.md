# The auto-scan prefill — design note

*Owed before the build. Written 2026-08-13, shift 68, against fable-352 (the
founder's report), opus-293 (the costing), fable-358 (the payload item and the
512px boundary) and fable-360 (his three rulings that closed the design fork).
Nothing here is built. Three decisions are named as OPEN at the end.*

> **Founder, fable-352:** *"you never mentioned original image analyzing to
> prefill the library at the moment it still shows blank slots completely
> unrelated"* — with a screenshot of a panel of empty boxes.

---

## 1. What the scan is, in one paragraph

When a cast is selected, the product reads her ORIGINAL face once and fills the
panel from what it finds. Today the panel's rows come from the catalogue and
their content comes from the library, and the library holds only what an EDIT
minted — so an untouched face shows fourteen empty boxes. After this build, the
same panel shows her own eyes, brows, lashes, nose, lips, ears, hair and facial
hair as pictures of HER, with the rows the scan could not find absent rather
than blank.

**It mints nothing.** fable-360 ruling 5 is the founder's own: *"we dont need to
reference anything if it hasnt been changed from the original."* The scan's
output is PANEL FURNITURE — display and words. The reference library stays
edit-minted, full-resolution, and untouched by this build. That boundary is the
first thing a reviewer should check any diff against.

## 2. What it asks, and why twelve

Derived from `SLOT_CATALOGUE`, never a second list beside it (law 4). Twenty-one
facets fan onto eight distinct regions, and a bilateral region is two reads —
one per side — because a plain bilateral noun returns one instance sitting on
one side (measured, `falRegionReader`'s own header).

```
region         calls   the rows it feeds
------------------------------------------------------------------
face skin        1     skinTone, skinCharacter, marks  (words-only rows)
hair             1     hair.cut, hair.colour, hair.texture, hairFinish, hairWorn
eyes             2     eye.colour, eye.shape
lashes           2     lashes
lips             1     lips, teeth
eyebrows         2     brows
ear              2     ears
facial hair      1     facialHair
nose             1     nose
glasses          1     the one ARMED born-worn class (fable-324/340)
------------------------------------------------------------------
```

**$0.005 per call, so $0.060 per cast selection, once, cached** (SAM 3's
published price, read off the model page).

> **The number went to 14 and came back, 2026-08-13.** Built, a scan cost
> FOURTEEN: each of the three bilateral reads bought its own `face` read to find
> the midline, and the bench proved it on a real face — `midline: 513 · 513 ·
> 513`, three identical questions about one photograph. A frame has one midline,
> so the axis is now read once per picture and shared (`falRegionReader.axisOf`,
> holding the promise so the scan's parallel regions join one read rather than
> all missing). **Twelve again, and $0.060 is the honest figure.** Earring and nose stud stay unarmed
until their three-class courts pass — arming a detector kind without its court
is how a false positive becomes a row on her face.

> **CORRECTION, 2026-08-16 (shift 91). The sentence above is out of date and the
> table with it — kept rather than rewritten, because this is the design as it
> was decided.** The earring per-side court has since passed and the class is
> ARMED; only nose stud remains unarmed, and its floor is still `null`
> ("NOT MEASURED"). The rule in that sentence is unchanged and is the point of
> it; the roster is not maintained here, and this was one of five prose sites
> found carrying it after it went false. Read the live answer from
> `armedBornWornClasses()`; `faceScan.test.ts` asserts the plan equal to it in
> both directions.
>
> **What the plan asks today**, printed from `scanPlan()`: twelve questions —
> hair · facial hair · eyes · eyebrows · nose · lips · all the teeth · ear ·
> face skin · horns · earring · glasses. Five of them are bilateral (eyes,
> eyebrows, ear, horns, earring) and a bilateral question is read as two
> half-frames.
>
> **The call count is 20, and $0.100 — COUNTED, not derived**
> (`scripts/count-scan-reads-disposable.mts`, a recording reader driven through
> `scanFace` itself). The derivation this correction was first written with said
> 18 and was wrong: it forgot that `build` is COMPOSED rather than asked, and
> costs a head read plus a subject matte while sending no question at all. Two
> attempts at hand-arithmetic on one figure is what the instrument is for.
> Twelve is a question count and was never the call count once horns and
> earrings joined the plan. The describer is a further call on a different
> transport and is deliberately not inside this total.
>
> **FILED while counting: `"face"` is asked TWICE per picture.** The below-head
> slot reads it for the head, and `bilateralHalves` reads it again for the
> midline — same prompt, same frame, two provider calls, because one keeps the
> first component and the other keeps all. The five bilateral questions already
> share their axis read between them, so this is the last duplicate of that
> question; it is ~$0.005 a scan and it is the same shape as the defect the
> paragraph above this one records fixing.

## 3. What the panel shows — the founder's third shape

fable-360 replaced the (a)/(d) fork with his own answer, and it simplifies the
build:

- **Cutouts appear only on rows that have a real picture of their own.** No
  shared thumbnails: a "chin" row showing a cutout of her whole face reads as
  broken even though it is correct, and four rows wearing one face-skin crop is
  the fringe-as-forehead-patch mistake with a thumbnail on it.
- **FACIAL STRUCTURE replaces chin/jaw/cheekbones** as one words-only concept —
  askable, carried in the word stack, no thumbnail, not listed among the
  cutouts.
- **Skin is words** until the texture-patch measurement says a patch reads as
  skin at thumbnail size (fable-360 ruling 2 — a measurement, not a decision).
- **Rows the scan did not find do not render.** An ear nobody can see is not an
  ear wearing nothing: an occluded site files NOTHING rather than an absence.

## 4. The three things that need deciding before code

### 4a. WHERE A DISPLAY CROP LIVES — recommendation: nowhere

The library's thumbnails are a content URL plus a mask URL, both objects in R2,
minted by an edit and purged with the candidate. The obvious build repeats that
for the scan: cut eight crops, write sixteen objects per face-version, hand them
to the cleanup worker with a manifest, purge them with the candidate.

**I recommend the scan store no objects at all, and carry GEOMETRY only.**

The panel is already looking at the frame — the viewer has it decoded on screen
beside the panel. A box in the frame's own pixels is all a thumbnail needs: the
row draws the frame with `background-position` and `background-size` set from
the box, and the browser cuts the picture it already has. That gives us:

- **zero new objects**, so no manifest, no cleanup path, no purge ordering, and
  none of the born-held race the mint writers just had to be fixed for;
- **no second resolution of the truth** — the scan's crop cannot drift from the
  frame it came from, because it IS the frame;
- **a re-scan costs $0.06 and no storage at all.**

What it costs: a scan row shows a RECTANGLE of her eye where a library row shows
a masked CUTOUT of her earring. They will not look identical. I think that
difference is honest — one is what the picture already contains, the other is
what an edit made — but it is a look, so it is the founder's call, and it is
cheap to show him both.

*(A middle path exists if he wants the cutout look: store the MASK only — a
one-bit PNG, small — and keep using the frame as the content. It costs eight
objects per face-version and a cleanup manifest, so it should be chosen
deliberately rather than by drift.)*

### 4b. WHERE THE SCAN RESULT LIVES BETWEEN CLICKS

Geometry is a few hundred bytes of JSON per face-version. Two shapes:

- **A table** (`casting_face_scans`), which is the durable answer and a
  MIGRATION — and a migration lands before the code that writes it, with
  production taken by the founder's own ceremony.
- **An in-memory cache** keyed by (candidate, variant), which is instant, has no
  migration, and is lost on every deploy.

**I recommend memory first, DECLARED as the shortcut it is** (fidelity law:
scaffolding is legitimate when named, and the real source is on the board). The
cost of losing it is one re-scan at $0.06, and only for a user who selects a
face in the minutes after a deploy. If the re-scan rate proves real in
production, the table follows with its migration.

### 4c. WHEN IT RE-RUNS

A scan is about ONE frame. Selecting a different version of the same face is a
different picture and a different scan. My proposal: key the cache on
(candidateId, variantId), scan on first read of a key, never re-scan a key, and
let a new version scan itself when it is first looked at. **A refine landing
does not invalidate anything** — it creates a new version, which is a new key.

## 5. The payload item (fable-358 §3), which is part of this build

The reader base64-encodes the frame into EVERY call, so one scan uploads ~38 MB
of the same 2.3 MB picture. fal takes a URL for `image_url`, and the master is
already at a public URL, so **the six whole-frame calls can reference it and
upload nothing**.

**The URL and the bytes must be provably the same picture**, not assumed — a
reader whose geometry is computed against one image while the segmenter looked
at another is the wrong-frame class this program keeps paying for. So the reader
fetches the URL ONCE per scan, uses those bytes for its own geometry and its
half-frames, and sends the URL to the segmenter: identical by construction
rather than by trust, and one download replaces six uploads.

The six SIDE reads still upload, because a half-frame is a derived picture with
no URL. Encoding them more cheaply is the same question as §6 and waits for it.

## 6. The 512px question — MEASURED AND REFUSED, 2026-08-13 (shift 69)

> **VERDICT: DO NOT ADOPT. 16 of 18 regions inside the pre-registered bar, and
> the bar says every region on every face.**
> `scripts/bench-scan-512-court-disposable.mts`, bar committed before the first
> call (`e590a760`).

```
FAIL  cand 369  lips        IoU 0.459   centre 0.72%   area 54% off
FAIL  cand 368  eye@left    IoU 0.713   centre 0.10%   area 40% off
ok    the other 16 (hair, nose, both ears, both brows, the other three eyes,
      the other lips): IoU 0.825–0.997, centre ≤ 0.62%, area ≤ 21%
```

Two things the run settled beyond the verdict:

- **The 31× was never the scan's number.** opus-293 timed ONE call. A scan is
  fourteen calls in parallel, so its wall clock is the slowest of them, not the
  sum: **20.3s → 7.0s and 11.4s → 8.9s** across the two faces. The cheap eye
  buys between 1.3× and 2.9× of waiting.
- **It buys nothing at all in money.** SAM 3 charges per request, not per pixel,
  so both arms cost exactly the same $0.005 a call. The whole upside was
  latency, and 2 of 18 regions is too much of her face to pay for it.

The failures are the shape the bar was written to catch: a lips box 54% off with
IoU 0.46 is a rectangle that has slid off her mouth, and a percentage-of-frame
comparison — opus-293's 0.24% against 0.27% — would have called it agreement.

*(Original statement of the question, kept for the record:)*

## 6a. The 512px question — measured, never assumed (fable-358 §4)

opus-293 measured a 512px JPEG answering the same nose question 31× faster at
0.24% of frame against the full read's 0.27%. That is close, and close is not a
finding: **the boundary Fable drew stands — a crop that can ever ride a recipe
is cut from the full-resolution master, no exceptions.** Only the scan's DISPLAY
reads may adopt a cheaper eye, and only after this measurement:

> For each of the eight regions, on at least two faces, read at full resolution
> and at 512px and compare the resulting BOXES: centre offset and area, each as
> a percentage of the frame. Adopt only if every region agrees within a
> pre-registered bar, and print every region that does not. A region whose
> cheap box lands on the wrong feature must be countable as a failure, or the
> measurement cannot fail.

## 7. Known build inputs, carried rather than rediscovered

- **The eyes read returned ONE side** on the founder's master while brows and
  ear returned two, reproducibly (opus-293 §4). Under per-instance boxes that
  mints one eye and not the other. It needs a multi-face look before the
  per-instance build, not a conclusion from one frame.
- **Smallest-selected-wins hit-testing** and **a pair row lighting both instance
  boxes** are already ruled (fable-270/278) and are display behaviour, so they
  belong to this build.
- **The region layer goes inert while a refinement is in flight** (fable-365) —
  shipped ahead of this build in `4328bd5c`, same surface.
- Rectangles stay (fable-278). No rounded feature blobs.

## 8. What this build is NOT

No library writes. No makeup or ink slots (both `notASlot` for stated reasons).
No body row — that has its own note. No engine or routing change — closed on the
founder's own eye (fable-371). No new charged action: **a scan is house money on
a read the user did not ask to pay for**, and nothing here touches the refund
law or the credit path.

---

## 9. THE VISUAL-ANCHOR LAW — founder ruling, 2026-08-17 (via fable-903)

> *"my rule was never have a feature in the right panel if it has no bounding box
> or picture with it otherwise it looks odd against everything else if anything do
> it for the UX and consistency"*

**STANDING LAW, and it governs every row this panel will ever gain: no feature
row ships without a visual anchor** — a bounding box on the frame, a row picture,
or both. A row of words beside eight rows that each carry a cutout does not read
as information; it reads as the one row that is broken. His reason is consistency
and it is a design reason, not a technical one, so it outranks any argument about
what is convenient to compute.

**Obeyed from birth, not retrofitted.** A none-state, a new catalogued feature, a
promoted open kind — each arrives with its anchor or does not arrive. The bald row
shipped words-only on 2026-08-17 and this ruling is what it produced; a row is not
finished until somebody has looked at it beside its neighbours.

### THE SCALP BOX IS DECIDED, and it is the law's first instance

When hair reads EMPTY, **one additional scan question locates the crown**, and the
bald row gains its rectangle and a scalp cutout as its row picture. It is a
CONDITIONAL read: a haired face never buys it, so the cost lands only on the faces
that need it (~$0.005 per fire, on the scan's own budget line and never a
customer's credits).

**Clean-shaven gets the same treatment** — the jaw and chin region — because the
law covers it identically and the two none-states are the same shape.

### The bounds the build carries

1. **The box stays a READING.** It is the region a hair edit would actually paint,
   located by a segmenter on this frame — never geometry invented from a face's
   proportions. That is the whole reason the row can carry a box honestly, and it
   is why the answer to *"bald has no extent"* is a scalp read rather than a
   drawn rectangle.
2. **Two controls before the word ships** (the bald row's own discipline): the box
   lands on the crown for a bald face, and it is judged BY EYE on the founder's
   cyborg cast before shipping — law 6 renders it, law 9 closes it.
3. **Both themes screenshotted**, per the UI evidence discipline.
4. It is a panel/scan build and belongs after the open lane's carry work.
