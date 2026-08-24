# ZEPHYR Special — what changed in four months

A second project, **"ZEPHYR Special FINAL"**, 4,838 job records, **2026-06-25 →
2026-08-14** (seven weeks). Harvested complete: the API served 4,838 against a
stated 4,838, and 90 in a `regenerations` subfolder.

The first film ran 2026-03-20 → 04-08. This one starts eleven weeks later with a
**largely different crew and a fundamentally different method.** Almost every
technique documented in [`README.md`](./README.md) has been replaced or
formalised. Where the two disagree, this document is the newer practice.

> **Read this next to the first teardown, not instead of it.** The first project
> is how a crew figures something out; this one is what they do once they know.

---

## The headline changes

| | ZEPHYR (Mar–Apr) | ZEPHYR Special (Jun–Aug) |
|---|---|---|
| Prompt language | **Chinese 216/275** | **English 3,647 / zero Chinese** |
| Prompt form | prose | **structured JSON** (18%, and it is the best 18%) |
| Reference addressing | `<<<image_N>>>` positional | **`<<<UUID>>>` naming a saved Element** |
| Resolution | 720p, all 275 | **4K (2,160) and 1080p (1,393)** |
| Aspect | 16:9 only | 16:9 + **21:9** on Seedance 2.5 |
| Slow motion | requested, 23% | **forbidden, 28% say "no slow-mo"** |
| Audio files | 58 attachments | **1,199 attachments, 9 distinct tracks** |
| Lead | @kurogatsu | @askar_yedil (2,378), @jagan96 (981) |

Models: `seedance_2_0` 3,553 · `soul_cinematic` 553 · `nano_banana_2` 346 ·
**`gpt_image_2` 250** (model id `videotape-alpha`) · **`seedance_2_5` 90** ·
`text2image_soul_v2` 41 · **`cinematic_studio_video_3_5` 4`**.

---

## 1. The Elements registry — the biggest structural change

In the first film, references were positional: `<<<image_1>>>` meant "the first
file I attached", and its meaning changed shot to shot.

**Now every reference is a named, categorised, persistent Element, addressed by
UUID.** Measured: **2,955 of 2,955 prompt tokens (100%) resolve to a
`reference_elements` id.** Nothing is positional any more.

33 distinct Elements. The naming is the system:

| Element | Category | Uses |
|---|---|---|
| `Zero_home`, `Mira_home`, `Reina_home`, `Haru_home`, `Jasmin_home` | `character` | 331–590 each |
| `Zero_rock`, `Mira_rock`, `Reina_rock`, `Naomi_rock`, `Jasmin_rock`, `Haru_rock` | `character` | 8 each |
| `zero_inside` | `character` | 106 |
| `Sheet_zero`, `Sheet_MIRA`, `Sheet_reina`, `Sheet_jasmin`, `Sheet_naomi`, `Sheet_narumin` | `auto:character` | 52–130 |
| `Home`, `location_scene_1`, `flower_loc`, `water_loca` | `environment` | 30–566 |
| `Home_Scheme` | `auto:environment` | 52 |
| `Glass`, `guitar_reina`, `guitar_zero`, `drums_naomi`, `zero_mecha` | `prop` | 27–349 |

**This is the state axis, solved.** `Zero_home` / `Zero_rock` / `zero_inside` are
the same person in three wardrobe states, each a separate named Element with its
own plate. The first film handled this with filenames in a folder; this one makes
it a first-class addressable object the prompt can name.

Note also **props per character** (`guitar_reina` vs `guitar_zero`) and the
`auto:` category prefix, which appears to be platform auto-classification.

### Each Element carries a written identity block

The prompt's `assets` map pairs every UUID with a persistent description:

> `<<<6aa0dec5…>>>` — **ZERO** — ashy-blonde shag with dark roots, light eyes;
> **PERMANENT dark curved horns (keep in every frame)**. Olive thin-strap
> bra-top, olive/cream vertical-striped wide lounge trousers, barefoot.
>
> `<<<eb1141b1…>>>` — **REINA** — Korean features, black hair with light-brown
> ends, wet-look mid-length shag with ragged side-swept fringe; heavy smoky eye,
> full lips; **BROWN eyes (never blue/green)**; silver hoop earrings.

Two things worth stealing: **permanent features are flagged as permanent**
("keep in every frame"), and **known failure modes are pre-empted with a
negative** ("BROWN eyes (never blue/green)") — the model has evidently drifted
her eyes before, and the fix lives in the asset, not in each prompt.

### And continuity can override the permanent flag

> `<<<6aa0dec5…>>>` — ZERO — … **NO horns in this scene (omit the horns
> entirely, for continuity with the burger-story shots).**

The Element says *permanent, every frame*; a scene-level scope says *not here,
and here is the story reason*. That is a continuity system with an override
channel, which is more than most human productions write down.

---

## 2. Structured JSON prompts

886 prompts (18%) are JSON objects rather than prose — **858 of them by one
author, @jagan96.** This is one person's method, and it is markedly the most
developed thing in the corpus.

The schema, from 588 jobs sharing it exactly:

```
style_prefix: {
  style, operating_style, lighting, color_accent_doctrine, texture,
  camera_lens, skin, acting, physics, composition, technical, audio, continuity
}
scene_summary: {
  who_and_where, what_happens, tone,
  what_we_read, what_we_do_not_show, purpose
}
assets:  { "<<<UUID>>>": "persistent description", … }
shot:    { id, type, duration_seconds, scene_context, active_references,
           first_frame_and_blocking, camera, action_timing, physics, lighting }
shots:   [ … ]          // 240 jobs carry an array
total_runtime
```

`style_prefix` is a **reusable house-style block** — identical across hundreds of
jobs, changed only when the look changes. `scene_summary` is the human-readable
intent. `assets` is the registry. `shot` is the actual instruction.

### The fields that do the most work

**`camera_lens`** — no longer "85mm" but a full optical specification:

> Shot on a LONG-FOCAL / TELEPHOTO lens — a **NARROW 34° horizontal angle of
> view** on a standard Super-35 / full-frame sensor… strong telephoto
> compression, flattened perspective, background pulled in close and thrown soft,
> only one to three faces/limbs sharp at a time. **NOT wide-angle, NOT
> large-format, NOT a 65mm IMAX look**, no fisheye, no edge distortion, no deep
> focus. Natural **180°-shutter** motion blur, creamy shallow depth of field,
> gentle halation, subtle lens breathing. No artificial flares, no anamorphic
> streaks.

**`operating_style`** — a **named cinematographer** as compression:

> **Hoyte van Hoytema naturalism**: intimate ultra-handheld closeness, immersive
> in-camera feel, tactile textures, atmospheric haze and volumetric light.
> Shallow depth of field on faces, documentary framing, photochemical look.

**`color_accent_doctrine`** — colour budgeted as **percentages**:

> ~70% desaturated green-grey room tone + raw concrete; ~20% warm orange-yellow
> accent (warm daylight + ceiling-panel light through the camo netting); ~10%
> cool daylight blue as a counter-note from the windows.

**`physics`** — named explicitly, which prose never did:

> real gravity, inertia and mass; weighted body movement, **sofa cushions
> compress and rebound under jumping**, hair and loose fabric whip with the
> motion, accurate contact shadows, nothing floats or slides.

**`acting`** — the anti-dead-eyes block:

> natural eye blinking throughout; active forehead and brow micro-expression; no
> frozen mask-face, no dead eyes. **FOREHEAD AND EYEBROW MOVEMENT MUST PRECISELY
> MATCH THE EMOTION OF EACH LINE.**

**`what_we_do_not_show`** — a first-class negative field on the *scene*, not
just on references.

---

## 3. Per-shot reference scoping, formalised

The first film's negative scoping was prose the crew learned over takes. It is
now a **structured per-shot map**:

```json
"active_references": {
  "<<<036454a9…>>>": "Haru position (deeper lower-left); layout only, overlays never drawn.",
  "<<<b84d9fb5…>>>": "100% match, keep nose glitter strip.",
  "<<<2ffd30f1…>>>": "location AND lighting."
}
```

Each shot declares **which Elements are live and exactly what each contributes.**
The most common scoping strings across the project:

| Count | Scope |
|---:|---|
| 297 | `location AND lighting reference.` |
| 138 | `…the lemonade glass. HERE: Zero holds it throughout and slightly raises it…` |
| 75 | `100% match, NO horns; low female voice; seated strictly on the sofa corner.` |
| 68 | `100% match, keep nose glitter strip; jumping ON the sofa, mid-ground.` |

`100% match` is the standard identity-fidelity instruction. Note that a single
scope string can carry **identity + blocking + voice** at once.

---

## 4. The blocking diagram — staging as an image

`Home_Scheme` is an Element used 52 times, and it is a **top-down floor plan of
the apartment** with a coloured, shaped marker per character showing **position
and facing direction**, each labelled with the character's Element name
(`@reina_home`, `@mira_home`, `@zero_home`, `@haru_home`, `@jasmin_home`).

It is attached as a reference and scoped:

> **"layout only, overlays never drawn."**

So the model reads the geometry and is forbidden from rendering the arrows. This
solves "where is everyone and which way are they facing" — a thing prose is bad
at and a diagram is perfect for.

The plate is committed at
[`data/reference-samples/Home_Scheme.png`](./data/reference-samples/Home_Scheme.png).

---

## 5. The headless bodies — answered, with their own words

**The question:** the character sheets show *headless* full-body front/back views
beside a large face close-up. Why?

**The answer is in the prompts, and they have a name for it — DUAL REFERENCE:**

> **DUAL REFERENCE (face from image 2 sharp from frame one, body/cabin from
> image 1)**
>
> take **BODY POSE + HARNESS + CABIN** from the WIDE cockpit reference (image 1);
> take the **FACE / HEAD — skin, pores, glasses, lip ring, hair, eyes** — [from
> image 2]
>
> head references (image 1 face + image 4 inverted) **at full close-up fidelity**;
> **body/costume** from the character reference; harness/cabin from…

They **source the face and the body from different references on purpose.** The
sheet is built to support that split:

- **Headless body views** carry the *costume* — cleanly, with no small
  low-resolution face competing for the model's attention.
- **The large face crop** carries the *identity* at maximum pixel density.

The template is fixed across the whole project. `Zero_home` and `Sheet_zero` are
byte-for-byte the same layout — title block (`ZERO` / `Height: 173 cm` /
character traits / `Voice: calm, measured, confident`), two headless bodies,
one big face — differing **only in wardrobe**. Both are committed under
[`data/reference-samples/`](./data/reference-samples/).

> **Note the evolution.** The first film's shot-013 sheet had **heads on the body
> views**. This project removed them. That is a deliberate template change
> between productions, and the DUAL REFERENCE prompts are what it was changed
> *for*.

Also worth recording: the identity text block is **identical** across a
character's wardrobe Elements. Identity is constant; only the outfit varies.

---

## 6. Audio — how, when, and how voices are directed

**25% of jobs (1,199 of 4,837) attach an audio file.** Always exactly one.
Always `.wav`. Only `seedance_2_0` (1,190) and `seedance_2_5` (9) take them.

**There are only 9 distinct audio assets in the entire project.** One is attached
**716 times**. These are the songs — the Special is a musical.

### When audio is attached

`generate_audio: true` on 3,602 jobs, but **2,403 of those attach no file.** So
the flag is the default and a track is attached only for the sung and synced
shots. The correlation is overwhelming:

| Prompt marker | With audio file | Without |
|---|---:|---:|
| "audio-follow" instruction | **493 / 1,199** | **0 / 3,638** |
| sings / singing | 588 / 1,199 | 68 / 3,638 |
| lip-sync | 412 / 1,199 | 32 / 3,638 |
| SFX only / no music | 139 / 1,199 | 1,222 / 3,638 |

The follow-the-audio clause has **perfect separation** — 493 hits when a track is
attached, zero when not. Attaching a track and instructing the model to follow it
are one act.

### The audio has its own slot token

> **MUSIC / VOCALS: `<<<audio_1>>>` plays throughout; Mira sings lead
> (lip-synced); the others play their instruments in time.**
>
> `<<<audio_1>>>` plays throughout; the girls perform the synchronized
> choreography and **sing/lip-sync the lyrics in unison**.

Same grammar as the image slots.

### The most interesting part: the track is a *timing* reference, not a soundtrack

> `"audio"`: **diegetic singing ONLY. The DnB track itself is NOT audible / NOT
> present in the mix** — we hear only the girls' voices, their laughter and the
> room. **They sing in time as if the (unheard) 87 BPM track is playing.** No
> music in the audio. No subtitles.

They attach the song so the performance lands on the beat, then **instruct the
model to exclude the song from the output**, leaving only diegetic voices. The
BPM is stated numerically. Music gets laid under the cut later — the same
"SFX only, no music" discipline as the first film, now with a timing carrier.

### And they direct imperfection

> shouting the lyrics **a little off-key, raw and sincere**
>
> no polished lip-sync (**shouty and a bit off**); no synchronized identical
> choreography; NO music in the audio

For documentary-feel shots they explicitly ask for *bad* lip-sync. Elsewhere,
`"Clean crisp image, matte skin, soft facial shadows, precise lip-sync"`. The
quality of the sync is a directed variable, not a constant.

### Voice direction rides on the character Element

`100% match, NO horns; **low female voice**; seated strictly on the sofa corner.`

Voice is scoped to the character reference alongside identity and blocking — and
the sheets themselves carry a `Voice:` line in their text block.

---

## 7. Camera language, measured

English now, and far more technical than the first film's Chinese vocabulary:

| Marker | Share of 4,837 |
|---|---:|
| Handheld | 53% |
| Angle of view in degrees | 51% |
| Focal length in mm | 50% |
| 180° shutter | 45% |
| **Named cinematographer** | **43%** |
| Depth of field / bokeh | 40% |
| **"no slow-mo"** | **28%** |
| Second-by-second action beats | 27% |
| Push-in / dolly | 19% |
| Orbit / arc | 7% |
| Percentage framing (`~35%x / 55%y`) | 7% |

**The slow-motion reversal is the clearest stylistic shift.** The first film
asked for slow motion in 23% of keeper shots; this one explicitly forbids it in
28%. Stylised action gave way to naturalism.

**Percentage framing** is new and precise: *"First frame on Haru at ~35%x/55%y,
leaning forward over her knees"* — subject position specified numerically.

**`action_timing`** breaks a shot into second-by-second beats:

> 0–2s: hands spread wide apart showing huge size, then even wider, eyes
> following her own hands in awe. 2–3.5s: she stacks flat hands one over the
> other counting…

---

## 8. Multi-shot arrays — the 15-second problem, revisited

240 jobs carry a `shots[]` array: **208 with 2 shots, 12 with 3, 20 with 6.**

Each entry is a full shot object — `id`, `type`, `duration_seconds`,
`scene_context`, `active_references`, `first_frame_and_blocking`, `camera`,
`action_timing`. It is a scene broken into cuts, handed to one generation.

**The arithmetic never closes, and it is systematic:**

| Shots described | `duration` param | Sum of shot durations | Jobs |
|---:|---:|---:|---:|
| 2 | 7s | 9s | 90 |
| 2 | 10s | 13s | 42 |
| 6 | 8s | **24s** | 12 |
| 6 | 15s | 24s | 4 |

Every one of these prompts describes more film than the job is set to produce.
`multi_prompt` is empty on all 240, `multi_shot_mode` is `custom`, and
`multi_shots` is still `false` — as in the first film.

### Resolved at the artifact — I downloaded the videos and measured them

Three results pulled and read at the MP4 header, plus a single-shot control at
the same duration:

| Job | Shots described | `duration` param | **Actual video** |
|---|---:|---:|---:|
| control, single `shot{}` | 1 | 7s | **7.059s** |
| 2-shot, `total_runtime "~9s"` | 2 | 7s | **7.059s** |
| 6-shot, `total_runtime "~24s"` | 6 | 8s | **8.042s** |

**The `duration` parameter is authoritative.** Describing 24 seconds of film in an
8-second job yields 8 seconds. Nothing about `shots[]` or `total_runtime`
extends a generation.

### But the cuts DO land — I sampled the frames

Eight frames from the 6-shot / 8-second video
([`data/reference-samples/special-6shots-in-8s-frames.png`](./data/reference-samples/special-6shots-in-8s-frames.png)),
looked at rather than inferred:

| t | What is on screen |
|---:|---|
| 0.3s | Haru mid-story, mouth open |
| 1.2s | Haru, hands up — same setup continuing |
| 2.2s | **CUT** — three girls on the sofa, reacting |
| 3.0s | **CUT** — back to Haru |
| 4.2s | **CUT** — Zero in close-up |
| 5.2s | **CUT** — Haru holding a giant burger to her face |
| 6.2s | Haru, grinning |
| 7.6s | **CUT** — wide of the whole room |

**Five or six distinct camera setups inside eight seconds.** The model executed
the whole sequence and **compressed** it — it did not truncate at shot one.

**So the answer to "how do you exceed the duration cap" is: you do not.** What
`shots[]` buys is *more cuts per second*, not more seconds. A described 24-second
scene becomes an 8-second cut-down of that scene. That is a real capability and a
real limit, and they are different things.

> **Two continuity claims verified in the same frames**, which is worth more than
> the timing finding: Zero appears at 4.2s **with no horns**, matching the
> scene-level override *"NO horns in this scene (omit the horns entirely, for
> continuity with the burger-story shots)"* — while her Element description says
> horns are permanent. And Haru's **holographic nose glitter strip is present in
> every frame she appears in** (0.3s, 1.2s, 3.0s, 6.2s), matching *"PERMANENT …
> keep in every frame"*. The permanent-feature flag and its override channel both
> demonstrably work.

---

## 9. New models

- **`gpt_image_2`** (250 jobs, model id `videotape-alpha`) — 2816×1408,
  `quality: high`, `resolution: 2k`, `aspect_ratio: auto`, and a `remove_bg`
  flag. Prompts open *"Create a photorealistic cinematic film still…"*.
- **`seedance_2_5`** (90) — the entire `regenerations` folder, all on
  **2026-08-11**, all 720p, **21:9 (2016×864)**, with an `extension_mode` field
  Seedance 2.0 does not have. This is the newest work in the corpus: re-running
  finished shots through a newer model at cinemascope.
- **`cinematic_studio_video_3_5`** (4) — barely touched.

---

## 10. What carries over unchanged

Worth stating, because it is the durable part:

- **No chaining.** Still no shot-to-shot lineage.
- **`multi_shots: false`** on every video job, in both projects.
- **Negative constraints do the heavy lifting** — `NOT a 3D render, NOT a game
  engine, NOT game-cutscene aesthetic, NOT a cartoon` is the direct descendant
  of the first film's `非3D动画`.
- **Reference-slot substitution** as the core grammar, now UUID-keyed.
- **The sheet-plus-text-block template**, with baked-in text, unchanged and now
  used across two productions. See
  [`OPEN_TEST_baked-text-on-references.md`](./OPEN_TEST_baked-text-on-references.md).
