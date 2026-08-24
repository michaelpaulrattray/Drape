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
| Prompt language | **Chinese 216/275** | **English dominant; 12 jobs still Chinese** |
| Prompt form | prose | prose + **structured JSON** (886 jobs) |
| Reference addressing | `<<<image_N>>>` positional | positional **still dominant**, UUID Elements **added alongside** |
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

The Special **adds** a second grammar: a named, categorised, persistent Element
addressed by UUID. Where a prompt carries UUID tokens, **2,955 of 2,955 (100%)
resolve to a `reference_elements` id** — that figure holds.

⚠ **But an earlier draft of this section said "nothing is positional any more",
and that was flatly wrong.** Counted at the job level:

| Grammar | Jobs | Distinct prompts |
|---|---:|---:|
| Positional `<<<image_N>>>` | **2,548** | 258 |
| UUID Element `<<<uuid>>>` | 1,065 | 86 |
| `@name` mention, no UUID | 213 | — |
| **Both positional AND UUID** | **0** | 0 |

**Positional addressing still dominates, and the two grammars are never mixed in
one prompt** — zero jobs use both. So this is not a migration; it is **two
parallel methods**, and the UUID one is heavily correlated with @jagan96's JSON
approach. There is also a third, looser form — `@name` mentions (`@Naomi`,
`@bridge`, `@музыка`) — that the first draft did not mention at all.

The 100% figure was a true numerator over the wrong denominator, which is the
exact shape of mistake this repo keeps re-learning.

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

⚠ **The naming is the system, and the system has already drifted.** The registry
contains **both `Sheet_MIRA` and `Sheet_mira`**, plus `zero_sheet` sitting beside
`Sheet_zero`. That is working law 4 arriving in someone else's data: a hand-typed
parallel naming scheme diverges from itself. Any Drape equivalent needs the name
to be derived or constrained, not typed.

### What actually gets attached to a shot, and why

Counted across the 1,034 seedance jobs that use Elements — **the categories tell
you the grammar of a scene**:

| Category | Attachments |
|---|---:|
| `character` | 2,859 |
| `environment` | 911 |
| `prop` | 568 |

The most common combinations per generation:

| Jobs | Combination | What it is |
|---:|---|---|
| 200 | 5×character + environment | the whole band in a room |
| 172 | character + environment + prop | one actor, a place, a thing |
| 161 | 2×character + environment + prop | a two-hander with a prop |
| 106 | 5×character + environment + prop | the group scene with the lemonade |
| 98 | character alone | a clean single |

**One Element per person** — five characters means five attachments, not one
group plate. Elements per generation runs 1–7, with modes at 6 and 3.

**The prop is not decoration; it is a continuity object with a per-beat state.**
The `Glass` Element is attached **349 times**, and its scope line changes every
beat: *"HERE: Zero is mid-sip from it when she chokes; liquid sloshes and a drop
catches her lip"*, then *"the lemonade rocks glass held in her hand the whole
take, mid-sip at the open"*. The same object, tracked through a scene.

**And Elements ride OUTSIDE the image-attachment count** — 620 seedance jobs use
Elements with **zero** image attachments; 2,609 use attachments with no Elements;
414 use both. That is important enough to have superseded an argument in
[`implications-for-drape.md`](./implications-for-drape.md); see the note there.

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

**It also carries a camera visibility cone** — the pale wedge from the lower
left, which the JSON prompts cite as *"the schematic's visibility cone"*. So the
diagram encodes **camera blocking as well as character blocking**: where the
lens is, and what is inside its view. I missed that on first reading and it is
the more sophisticated half.

And per §9, the base image was **generated** — a top-down of the room Element —
then annotated. The whole artifact is minted, not drawn by hand.

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

They **source the face and the body from different references on purpose.** That
technique is real, quoted verbatim, and used in **63 jobs**.

⚠ **But I linked it to the headless sheets, and the data does not support that
link. Three separate checks kill it:**

1. **DUAL REFERENCE jobs attach separate images, not one sheet.** All 63 carry
   **zero `reference_elements`** and a mean of **4.0 image attachments**, and
   their own text names *"the CLOSE-UP head ref (image 2)"* and *"the WIDE
   cockpit ref (image 1)"* — two distinct files, not two panels of one plate.
   **Not one DUAL job attaches a `Sheet_*` Element.**
2. **The headless template is not new.** `Mira.jpg` — a **first-film** bible page,
   already committed in this repo — is headless in exactly the same layout. Both
   templates coexisted inside film one, so there was no between-productions
   change to explain.
3. **My own committed file already said so.** `data/reference-samples/README.md`
   has carried the line *"Note the head is cropped off the body views"* about
   `Mira.jpg` since the first commit. I wrote a contradiction of my own evidence
   and did not check it.

**What survives, and it is still worth having:** the sheets *are* built as
face-and-body-in-separate-panels, and the prompts *do* split face and body
sourcing. Whether the second is the reason for the first is **unestablished** —
they are two expressions of the same instinct, and I have no evidence of a causal
link between them.

**And the reading of "why headless" has now been overturned TWICE, ending at
deliberate.** This paragraph first claimed the headless template was a design;
Fable's review killed that (ZEPHYR's own mint asks for *"two full-length photos
**from shoes to head**"* — heads requested), so it was refiled as "probably
something the generator did." Then the founder produced a THIRD production —
**Adiliada** (11,142 jobs, Apr–Aug 2026) — whose sheets follow the same
template, and its mint prompt settles it verbatim (21 jobs, 2026-07-12,
`nano_banana_2`):

> *"A two-panel character reference sheet … on the left a full-body figure
> standing front-facing and **cleanly headless cut at the base of the neck**,
> on the right a front-facing head-and-shoulders close-up"*

So the honest arc is: ZEPHYR asked for heads and sometimes got headless bodies
anyway → the crews **kept and curated the headless outputs** → Adiliada wrote
the cut into the recipe. An accident, adopted, then codified. And the face
count converges the same way across productions: film one's sheets carry faces
at three angles, the Special's carry one, Adiliada's recipe demands exactly one.

**The founder then produced the artifact that closes the loop — the POSE
PLATE.** For a non-standard orientation (Naomi hanging inverted in her
cockpit), the crew mints a bespoke reference of the exact pose — body, harness
and cabin, shot as needed — **and crops her head out of frame even there.**
The shot prompt then reassembles her by DUAL REFERENCE: *"FACE/HEAD from the
CLOSE-UP head reference (image 2) at full close-up fidelity; body/harness/cabin
from the WIDE cockpit reference (image 1)."* So the one-face rule is not a
sheet template — it is enforced across the ENTIRE reference stack of a shot:
however many images ride, the face exists in exactly one of them.

Two further consequences of that specimen:

- **It explains film one's bespoke tail.** 39.4% of production references were
  used in exactly one shot and we did not know what they were. They are pose
  plates — minted per unusual setup, headless by rule, paired with the
  permanent face close-up, discarded after.
- **Object sheets play by different rules.** Haru's mecha sheet is rich —
  four views, an annotated capability note (*"Two retractable blades from the
  forearms… fast piercing or slashing movements"*), a pilot-in-cabin cell. The
  one-face economy governs CHARACTER identity; a vehicle can afford detail
  panels because no face competes.
- Her asset line also shows the permanent-accessory lock in the wild:
  *"rimless oval glasses **(always)**, lower-lip ring **(always)**"* — the
  same grammar for accessories as for anatomy.

**Why? Never stated in any of the 34,000 records — but the founder's hypothesis
(multiple faces on a reference confuse the video engine's identity read) fits
every observed habit:** *"Use image 1 (face close-up) as the **main
identity**"* (111 runs), *"face from image 2 (**priority identity**)"*, the
DUAL REFERENCE face/body split. The whole practice engineers each sheet toward
**one unambiguous identity anchor**. Filed as the leading hypothesis, not fact
— and cheaply courted: same setup, one-face sheet vs multi-face sheet, frames
judged by eye. ⚠ **Direct Drape consequence:** a composite of the six-view
package would carry a face at four or five angles on one plate — exactly the
shape these crews evolved away from. The composite's layout is now a flagged
question, not a decided one.

⚠ **Also corrected: `Zero_home` and `Sheet_zero` do not differ "only in
wardrobe".** Opened side by side, `Sheet_zero`'s face crop **has horns** and
`Zero_home`'s **does not**. A wardrobe-state Element carries **body state as
well as clothing** — which matters for Drape, because horns are a Casting-owned
feature, not an outfit.

Both plates are committed under
[`data/reference-samples/`](./data/reference-samples/).

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

### What the 9 audio files actually ARE — downloaded and measured

Not uploaded songs. **Nine mono `.wav` clips, each about the length of one
shot:**

| Asset | Uses | Duration | Format |
|---|---:|---:|---|
| `47480bd1…_sfx.wav` | **716** | **14.12s** | 44.1 kHz, **mono**, 16-bit |
| `783cdc43…_sfx.wav` | 148 | 13.64s | 44.1 kHz, mono, 16-bit |
| `f9f3e6f7…_sfx.wav` | 135 | 13.64s | 44.1 kHz, mono, 16-bit |

Two things identify them. Every URL ends **`_sfx.wav`**, the platform's own
generated-audio naming; and they are served from
**`d8j0ntlcm91z4.cloudfront.net`, the RESULTS host** — the same host the finished
`.mp4`s come from, not the `d2ol7oe51mr4n9` host that serves uploads.

**So the audio is the platform's own generated output, fed back in as an input.**
The crew generated a shot with audio, kept the take they liked, and then attached
that ~14-second clip to hundreds of later generations so the performance stayed
consistent. One 14-second clip drove **716 generations**.

That makes it neither a music track nor a sample library. It is a **performance
anchor** — the audio equivalent of the character sheet. The most-used one is
committed at
[`data/reference-samples/audio-anchor-used-716x.wav`](./data/reference-samples/audio-anchor-used-716x.wav).

### And the attached clip is a *timing* reference, not the soundtrack

> `"audio"`: **diegetic singing ONLY. The DnB track itself is NOT audible / NOT
> present in the mix** — we hear only the girls' voices, their laughter and the
> room. **They sing in time as if the (unheard) 87 BPM track is playing.** No
> music in the audio. No subtitles.

They attach the clip so the performance lands on the beat, then **instruct the
model to exclude the music from the output**, leaving only diegetic voices. The
BPM is stated numerically. Music gets laid under the cut later — the same
"SFX only, no music" discipline as the first film, now with a timing carrier.

**Verified at the job level, because this was challenged:** every job whose
prompt says `87 BPM` — **171 of 171** — carries an attached `audio_input`. Every
job saying *"NOT audible / not present in the mix / diegetic singing ONLY"* —
**139 of 139** — carries one too. Only 11 of those 139 also use an
`<<<audio_N>>>` token, so **token presence badly under-counts attachment** and
must not be used as a proxy. The per-job evidence is committed as
[`data/special-job-census.jsonl`](./data/special-job-census.jsonl) (one row per
job: audio count, audio host, grammar, elements, and these flags).

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

## 9. `gpt_image_2` is the asset factory — this is how the sheets get made

The biggest thing the first draft under-read. 250 jobs, 30 distinct prompts, and
only 6 of those are the *"Create a photorealistic cinematic film still…"* shape.
**The rest mint the production's assets**, and several are in Russian.

### The character-sheet recipe, in their own words

> **сделай коллаж персонажа из image1** — должна быть **две фотографии в полный
> рост с обуви до головы, спереди и сзади**, **крупный кадр лица и крупный кадр
> профиля**, должна быть видна текстура кожи, матовая… она должна стоять на фоне
> нейтральной серой стены
>
> *(make a character collage from image1 — two full-length photos from shoes to
> head, front and back, a large face shot and a large profile shot, skin texture
> must be visible, matte… she should stand against a neutral grey wall)*

That is the sheet template as an instruction. Note it **asks for heads** — see
§5 for why that matters.

### Sheet = person × outfit, in one step

The single most Drape-relevant prompt in the entire corpus:

> **Character reference sheet of the character shown in `<<<image_1>>>`, wearing
> the outfit/clothing from `<<<image_2>>>`, labeled "Zjasmin" at the top.** The
> character is in a photo studio with a neutral seamless…

One identity reference, one outfit reference, one composition step, out comes a
wardrobe-state sheet. **And the label is explicitly requested** — the baked-in
text is not an accident of the template, it is asked for by name. That is
material for
[`OPEN_TEST_baked-text-on-references.md`](./OPEN_TEST_baked-text-on-references.md).

### It also revises sheets, and mints props and the blocking diagram

- **Sheet revision preserving the text:** *"сделай новый character sheet, должна
  остаться вся текстовая информация…"* — make a new sheet, all the text
  information must remain, change the background.
- **Props on white:** *"realistic item asset whiskey cup with transparent
  lemonade"* — this is where the `Glass` Element comes from.
- **The blocking diagram is MINTED, not drawn:** *"exact right topdown view of
  that room. keep positions of all items"*, run against the room Element. The
  `Home_Scheme` base is a generated top-down of the existing location, which was
  then annotated with the character markers.

Sheet-mint prompts appear across models: **108 `gpt_image_2`, 102
`seedance_2_0`, 6 `seedance_2_5`** (216 jobs, 31 distinct).

## 9b. The other new models

- **`gpt_image_2`** — model id `videotape-alpha`, 2816×1408, `quality: high`,
  `resolution: 2k`, `aspect_ratio: auto`, plus a `remove_bg` flag. *(These
  parameter values are read from the harvest, not from the committed digests.)*
- **`seedance_2_5`** (90) — the entire `regenerations` folder, all on
  **2026-08-11**, **all 90 at 720p**, 21:9 (2016×864), with an `extension_mode`
  field Seedance 2.0 does not have.
  ⚠ **This is NOT finishing or upscaling, and an earlier draft implied it was.**
  720p at the tail of a project that shot 2,160 jobs in 4K is *cheaper* than the
  work it follows. The honest reading is a **model trial / re-take pass** — new
  engine, low resolution, one day, done.
- **`cinematic_studio_video_3_5`** (4) — barely touched.

---

## 9c. The story layer — screenplay format, and a rehearsal tier

**Still no script in the platform.** `cs_chat_ids` is empty on the Special's
folders too, so across both productions there is no story artifact anywhere. The
writing happens outside and arrives as prose.

But the Special's JSON exposes how the writing is *organised*, through a field
the first film had no equivalent of: **`scene_summary.purpose`**, 19 distinct
values. The production is built from **beats**, not scenes:

| Jobs | Purpose |
|---:|---|
| 129 | *"Zero dialogue beat — single-take CU, brow/forehead acting accuracy, directed eyelines, low female voice."* |
| 58 | *"two-shot dialogue beat — both framed BIG: Jasmin big 3/4 CU with brief downward glance, Zero very tight 3/4 CU…"* |
| 57 | *"high-energy musical group beat — long-focal 34°-FOV lens roaming between dancers…"* |
| 54 | *"two-shot dialogue beat — Zero CU with directed eyelines + brow accuracy, then hard-cut Haru CU reaction."* |
| **43** | *"**placement / blocking test** of the character scheme on the location."* |
| **20** | *"**expressive-acting + reaction-cutaway test** on the established placement scheme."* |

**Two of those are not shots at all.** 63 jobs declare themselves *tests* — of
blocking against the diagram, and of acting coverage. That is a **rehearsal
tier** the first film had no sign of: they generate to check staging works before
generating the take.

### The prompts are written in screenplay format

Character cues with parenthetical direction, exactly as a script would:

> **Haru (high, excited, childlike):** "…"
> **Haru off-screen (continuing):** "…"
> **Haru (escalating):** "…"
> **Haru (muffled, struggling, then triumphant):** "…"

And per-shot foley, different for every cut:

> *Room tone, fabric rustle. No music.*
> *Faint sofa creak. No music.*
> *Fabric rustle on the big gestures. No music.*

### The content is comedy, not action

The first film was mecha peril. The Special's dialogue spine is a sitcom
anecdote — "HARU'S STORY":

> *"And she's just hanging there! And the wind goes—"*
> *"She just grabs the radio and goes: 'I'm fucked up!'"*

with segment titles like *"Lunch on the Dead Bridge"*, *"Chill Zone"*, *"GAME
ON"*, *"VIBES"*. A character special about the same cast off-duty — which is why
the whole method shifted from stylised action to handheld naturalism.

### And the "scenes" are blocking positions

The recurring named locations in prompts are not story locations, they are
**marked positions on the scheme**: *"seated on the green sofa in her marked
position (to the right of Reina)"*, *"standing/jumping ON the green sofa cushions
in the mid-ground"*, *"seated cross-legged on the PINK yoga mat at the front of
the room"*. The blocking diagram and the script are the same document.

---

## 10. What carries over unchanged

Worth stating, because it is the durable part:

- **No chaining.** Counted for this project too: `job_set_parent_id` is set on
  **0 of 4,837** jobs. Two productions, 23,809 jobs, zero lineage.
- **`multi_shots: false`** on every video job, in both projects.
- **Negative constraints do the heavy lifting** — `NOT a 3D render, NOT a game
  engine, NOT game-cutscene aesthetic, NOT a cartoon` is the direct descendant
  of the first film's `非3D动画`.
- **Reference-slot substitution** as the core grammar, now UUID-keyed.
- **The sheet-plus-text-block template**, with baked-in text, unchanged and now
  used across two productions. See
  [`OPEN_TEST_baked-text-on-references.md`](./OPEN_TEST_baked-text-on-references.md).
