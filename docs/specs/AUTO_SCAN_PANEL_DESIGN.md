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
published price, read off the model page). Earring and nose stud stay unarmed
until their three-class courts pass — arming a detector kind without its court
is how a false positive becomes a row on her face.

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

## 6. The 512px question — measured, never assumed (fable-358 §4)

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
