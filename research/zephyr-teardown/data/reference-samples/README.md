# Reference plates and clips, downloaded and opened

These are the artifacts behind the claims in the teardown. They are here because
an earlier draft described these files from their **filenames** and got it wrong
— it called them "clean plates, no annotation". They are annotated production
model sheets. Open them.

| File | What it is |
|---|---|
| `shot013_slot1_ZERO_character_sheet.png` | **The actual `<<<image_1>>>` attachment on production shot 013.** Text block (name / height / voice / character), full body front + back, face at three angles, two costume detail crops — all in one 2048×1142 image. |
| `shot013_slot4_cockpit_plate.jpg` | **The `<<<image_4>>>` attachment on the same shot** — the one the prompt tells *"do not use a single pixel of the background from this input image."* Note the white studio ground down both sides and the mech's exterior shoulders framing the canopy. That is what the exclusion is carving out. |
| `Mira.jpg` | A `Characters` bible page. Title, height, voice, character notes; a **headless** costume turnaround front and back; a large face close-up. Note the head is cropped off the body views — costume and face are shown separately. |
| `Reina_s_mecha.png` | Vehicle model sheet. Title, design-intent line, four views (front with pilot visible, back, side), and an annotated weapons close-up. |

## From ZEPHYR Special (the later production)

| File | What it is |
|---|---|
| `Zero_home.png` | A wardrobe-state Element. Same template as `Sheet_zero` — text block, two **headless** bodies, one big face — but a different outfit **and no horns on the face crop**. State plates carry body state, not just clothing. |
| `Sheet_zero.png` | The same character, rock wardrobe, **horns present**. |
| `Home_Scheme.png` | The blocking diagram: top-down room plan, a coloured marker per character showing position and facing, plus a **camera visibility cone** (the pale wedge, lower left). Scoped in prompts as *"layout only, overlays never drawn."* Its base was **generated** from the room Element, then annotated. |
| `special-6shots-in-8s-frames.png` | Eight frames sampled from one finished video whose prompt described six shots over "~24s" on an 8-second job. Five or six distinct setups land inside 8.042s — the model compresses rather than truncating. Zero appears with **no horns**, per her scene override. |
| `audio-anchor-used-716x.wav` | The most-reused audio input in the project: **14.12s, mono, 44.1 kHz**, served from the *results* host. Platform-generated audio fed back in as a performance anchor for 716 generations. |

Sources are the CloudFront URLs recorded in `../production.json`,
`../characters.json` and `../special-job-census.jsonl`; fetched 2026-08-24. Copyright remains
Higgsfield Studio's — held here as research evidence, not for reuse.
