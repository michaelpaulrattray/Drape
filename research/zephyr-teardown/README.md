# The ZEPHYR teardown

A forensic reverse-engineering of **ZEPHYR**, the mecha short film published by
Higgsfield Studio — read off **18,972 job records** pulled from the project's own
API on 2026-08-24. Every prompt, every model parameter, every reference
attachment.

Why it is in this repo: Drape intends to let an ordinary person produce a film
of this kind, with the craft built into the backend. ZEPHYR is the closest thing
to a complete, inspectable worked example that exists. It also answers a live
casting-studio question — what a cast needs in order to stay consistent across
video generations.

**Read in this order:**

1. **This file** — the pipeline, the prompt grammar, the numbers.
2. **[`narrative-and-continuity.md`](./narrative-and-continuity.md)** — how the
   story was built and how continuity survived, including the 15-second ceiling.
3. **[`implications-for-drape.md`](./implications-for-drape.md)** — what it means
   for the casting studio and the backend.

---

## The corpus

| Folder | Items | What it is |
|---|---|---|
| `Characters` | 54 | Uploaded reference images — no generation records in this folder, one uploading author. (They may well have been generated elsewhere and curated in; "uploaded" is what the data shows.) |
| `Production` | 275 | The keeper shots. All video. |
| `Iterations` | 18,643 | Everything else — the working. |

13 contributors, 2026-03-20 → 2026-04-08 (19 days). The Iterations folder
reports 18,673 and served 18,643, so **30 records are missing** — almost
certainly deleted rows. Nothing else was sampled or estimated.

Raw and derived data is in [`data/`](./data/); the harvest script is in
[`scripts/harvest.mjs`](./scripts/harvest.mjs) and re-runs against the live API.

---

## Finding 1 — one model does the entire film

All 275 finished shots are `seedance_2_0`. Not one uses a different video model.
Settings are uniform to the point of being a house standard:

| Parameter | Value across all 275 |
|---|---|
| `model` | `seedance_2_0` |
| `resolution` / `aspect_ratio` | 720p (1280×720) / 16:9 |
| `mode` | `std` — not `pro` |
| `multi_shots` | `false` — never used, on any shot |
| `speedramp` / `genre` | `auto` / `auto` |
| `generate_audio` | `true` on 272 of 275 |
| `duration` | 4–15s, median **9s** |

The craft is not in model selection. It is entirely in how the prompt is written
and what is stapled to it.

---

## Finding 2 — prompts are compositing instructions, not descriptions

**226 of 275 production prompts (82%)** use `<<<image_N>>>` reference tokens, and
they are used as **noun substitutes dropped inline mid-sentence** — not as a
trailing "use this reference" note.

> 米拉 `<<<image_1>>>` 的胸口与嘴唇特写
> *(Mira `<<<image_1>>>`'s chest and lips in close-up)*

Identity is carried by the image. The words carry only the action.

### The three-part structure

The most disciplined prompts — @jennifer_lopez's, repeated near-verbatim across
shots 008, 009 and 013 — follow a strict shape:

**(a) The glossary block.** Every slot gets a written description *as well as*
the image:

> `<<<image_1>>>` — Asian female, 173cm, platinum blonde hair, small black
> horns, grey-blue eyes, khaki moto jacket with blue detailing, khaki shorts,
> dark green high boots.
> `<<<image_2>>>` — white angular mech ~8m tall, deep teal detailing,
> transparent glass canopy at front.

The picture is never trusted alone.

**(b) Per-reference scoping — the technique they visibly learned.** Each slot is
told which part of itself to contribute, and what *not* to:

> `<<<image_4>>>` — **interior only**: black racing seat, one control stick each
> side, technical panels — **do not use a single pixel of the background from
> this input image.**
> `<<<image_3>>>` — post-apocalyptic ruined city — **the background behind the
> glass comes strictly and solely from here, in every shot, without exception.**

The mechanism is legible — it is how you stop four references fighting over the
same pixels — and you can watch them *learn* it: shot 008 says only "interior
only, don't take the background"; by shot 013 it has hardened into the pixel
formulation, and the city reference has gained "strictly and solely… without
exception".

That escalation is the evidence: people who were already shipping shots chose to
spend more words on this specific thing. It is **not** supported by attempt
counts — see the warning under Finding 7, where scoped prompts show no measurable
reroll advantage.

**(c) The action block**, and then a clipped technical tail:

> 85毫米。写实。16:9。7秒。仅音效。电影感。8K。手持。重颗粒感。压暗黑部。
> *(85mm. Realistic. 16:9. 7 seconds. SFX only. Cinematic. 8K. Handheld. Heavy
> grain. Crushed blacks.)*

Duration and aspect ratio are restated **in the prompt** even though both are
already set as parameters.

### The anti-CG constant

The most repeated instruction in the corpus is a negative one: **非3D动画 /
无3D动画** ("not 3D animation"), plus 真实质感，真实重量，真实动态模糊 ("real
texture, real weight, real motion blur"). They fight the model's pull toward a
CG-cartoon look on nearly every shot, with explicit negation rather than style
words.

| Marker | Production |
|---|---|
| `<<<image_N>>>` slots | 226 / 275 |
| anime / 动画 framing | 157 / 275 |
| Chinese camera verbs | 136 / 275 |
| Spoken dialogue | 73 / 275 |
| slow motion / 慢动作 | 63 / 275 |
| "no VFX" / 无特效 | 48 / 275 |
| "real skin" / 真实皮肤 | 40 / 275 |
| English camera verbs | 15 / 275 |

---

## Finding 3 — they write in Chinese and speak in English

216 of 275 production prompts are Chinese (7,709 vs 2,357 across iterations).
Seedance 2.0 is a ByteDance model; the team — Russian and Kazakh usernames — is
writing in the model's native training language.

The dialogue inside those Chinese prompts is English, in quotes:

> …开口说话，口吃完全由恐惧驱动，声音比她希望的要小：
> "Girls… I think I need some backup."

Direction for *how* the line lands is Chinese; the line itself is English.
Chinese camera vocabulary (推镜, 跟拍, 手持) outnumbers English nine to one.

---

## Finding 4 — audio is directed, as its own paragraph

With `generate_audio: true` on 272 of 275, the track gets a written block —
almost always sound effects only, no music:

> 仅音效：单股安全带被紧张双手拉扯时的绷紧声、胸口顶着安全带的沉重喘息声、
> 手指抓向底部插扣的金属摩擦声、汽车式插扣的急促弹响。无音乐。
>
> *(SFX only: the tautening creak of a single-strap harness pulled by anxious
> hands, heavy breathing pressed against the belt, the metallic scrape of
> fingers grabbing at the buckle below, the sharp snap of a car-type release
> catch. **No music.**)*

That is a foley list in shot order. Music is excluded at the prompt so it can be
laid under the whole cut later. 58 shots go the other way and attach a real
`.wav` as an `audio_input`, four of them syncing with an `@музыка` token.

---

## Finding 5 — the asset bible, and who made it

One person — **@serveresta** — uploaded all 54 files in `Characters` and appears
nowhere in the generation logs. A genuine art-director role, separated from the
shooting crew. The naming convention *is* the continuity system:

- **Base** — `Mira.jpg`, `Zero.jpg`
- **Wardrobe state, scoped per sequence** — `Mira (Episode 1 Base) (After shower).png`
- **Situational** — `Mira in cockpit.png`
- **Story state** — `Alex (Battle Mode) [KIA].png`, `Tank (injured).png`
- **Objects, two orientations** — `Reina's mecha.png` 3000×1688 *and*
  `Reina's mech.jpg` 1792×2400, plus `(back)`
- **Locations, all 2048×1152** — `City 1–5`, `Main hangar`, `Gym`, `Shower room`

Full list: [`data/characters-manifest.md`](./data/characters-manifest.md).

### What one actually looks like — opened, not inferred

An earlier draft of this document called these "clean plates, no annotation".
**That was wrong**, and it was wrong in the way law 1 exists to catch: it read 54
filenames and described 54 images. Downloaded and opened, they are **annotated
production model sheets**.

The `Zero` plate — the actual attachment on production shot 013, 2048×1142, one
image — carries all of this:

- A **text block burnt into the pixels**: `Name: ZERO` / `Height: 173 cm` /
  `Voice: calm, measured, confident` / `Character: calm, spontaneous (awkward
  poses), slightly slouched posture, indifferent`
- **Full body, front and back**, on white
- **Face at three angles** — front, three-quarter, profile
- **Two costume detail crops** — the jacket, the boots

`Reina's mecha` follows the same pattern: title, a design-intent line (*"Tall,
narrow, and lightweight. Designed for fast and stealthy movement."*), four views
including a pilot-in-cockpit front, and an annotated weapons close-up (*"A long,
heavy sniper rifle. Armor-piercing rounds. Accuracy is increased when
kneeling."*).

Three things follow:

1. **The whole annotated sheet goes to the engine as one attachment.** Not
   cropped, not stripped of text, not split into separate references.
2. **The prompt's glossary block is a transcription of the sheet.** Shot 013's
   *"173cm, platinum blonde hair, small black horns, grey-blue eyes, khaki moto
   jacket with blue detailing"* is reading the plate back in words. Belt and
   braces, deliberately.
3. **Baked-in text does not appear to have stopped them shipping.** That is worth
   sitting with, because it cuts against a reasonable and widely-held instinct.

### And it explains the negative scoping

The cockpit reference on the same shot is not a clean interior — it shows the
cockpit **with the mech's exterior shoulders framing it and plain white studio
background down both sides**. That white ground is exactly what *"do not use a
single pixel of the background from this input image"* is carving out, while the
city plate is told it owns everything behind the glass.

**The exclusion clause is written against what the plate actually contains.**
It is not generic prompt hygiene.

> ⚠ **The published bible is not the working set.** Only 26 of the references
> attached to production shots (2.4%) resolve back to these three folders; the
> rest were uploaded into individual artists' own workspaces. The per-shot
> reference URLs are all still readable in the job records, and fetchable — which
> is how the plates above were opened.

**How concentrated is the working set?** Measured: the 275 shots make **1,011
image attachments drawn from 353 distinct images**.

| | |
|---|---:|
| Distinct reference images | 353 |
| Total image attachments | 1,011 |
| Mean shots per reference | 2.86 |
| Used in exactly one shot | **139 (39.4%)** |
| Used in 2+ shots | 214 |
| Most-reused single image | 18 shots |

So continuity does **not** come from a tiny canonical set stapled everywhere. It
comes from a reused core plus a substantial bespoke tail — roughly 40% of what a
shot needs was made for that shot.

---

## Finding 5b — the middle layer: shot plates, and a second reference grammar

The bible is not fed straight to the video model in every case. There is a step
in between, and it accounts for the bespoke 39% above.

**`nano_banana_2` is the shot-plate compositor.** 2,157 jobs, and its shape gives
it away:

| | |
|---|---|
| Input images | **3 is the mode** (1,090 of 2,157); 1 or 2 in most of the rest |
| Aspect ratio | **16:9 dominant** (1,320) — it is minting *frames*, not portraits |
| Prompt length | median **301 chars** — short, because the images carry the load |
| Intent | background 37%, expression 37%, outfit 33%, camera angle 18%, identity-hold 15% |

So: take three bible references, compose a specific 16:9 frame — this character,
in this outfit, in this place, at this angle — and *that* becomes the plate the
video model gets.

### The second grammar: attribute assignment

Seedance prompts use `<<<image_N>>>` as inline noun substitution. The still
compositor does something different — it assigns each reference a **named
attribute**:

> **Face from image 3 (priority identity), overall vibe from image 2.**
>
> Character: young Asian female, very attractive, slightly edgy, messy sexy vibe.
> Details: — subtle dark circles under eyes — sharp, styled nails — small horns
> (stylized, natural integration, not fantasy-overkill)
> Outfit: carelessly sexy, futuristic-grunge — asymmetrical, slightly messy,
> partially undone / imperfect fit
> **Color palette (image 1):** deep blue / teal tones / soft light accents
> Style: raw, slightly chaotic, sensual but not clean, fashion-forward.
> White studio background, soft cinematic lighting, realistic.
>
> **Important:**
> — keep face accurate to image 3
> — avoid overdesign, keep natural imperfection and attitude

Three things to notice: each reference owns **one named attribute** (face / vibe
/ palette); identity is marked **priority**; and the prompt closes with an
`Important:` block that **repeats the identity constraint it already stated.**

A second author uses demonstratives instead of slots entirely — *"That woman
character sits in the cockpit of that mecha… Similar lighting and composition as
in reference image 3. No hud. Pedals under feet. Space behind."*

**So this corpus contains two distinct reference grammars, used per engine:**

| | Video (`seedance_2_0`) | Stills (`nano_banana_2`) |
|---|---|---|
| Grammar | `<<<image_N>>>` inline, as a noun | "X from image N", by attribute |
| Prompt length | median 359 chars | median 301 chars |
| What refs carry | whole entities (person, mech, place) | attributes (face, vibe, palette) |

### And the tiniest prompts are surgical edits

Sorted by length, the shortest prompts are micro-revisions in Russian on an
existing plate — `убери персонажей` ("remove the characters", stripping figures
out of a location plate to get a clean empty set) and `change belt to crossbelt`
(a costume revision, propagated to the plate rather than re-described in every
shot).

Both were rerolled 8–10 times. Even a two-word edit gets the same treatment.

---

## Finding 6 — eleven models, each with one job

| Model | Jobs | Configuration | Role |
|---|---:|---|---|
| `seedance_2_0` | 10,066 | 720p 16:9 std | All motion. Every finished shot. |
| `soul_cinematic` | 5,275 | 2048×1152, batch 4, `enhance_prompt: false`, custom style **General_Olzhas** | The workhorse still. Prompt median **1,953 chars**. |
| `nano_banana_2` | 2,157 | 1792×2400 (3:4), 2k, `input_images` | Reference-driven composition. Prompt median **301 chars**. |
| `text2image_soul_v2` | 624 | 2048×1536, `enhance_prompt: true` | Exploration — the one place they let the platform rewrite. |
| `nano_banana_flash` | 366 | 3:4, 1k, up to 5 refs | Cheap multi-reference sketching. |
| `seedream_v4_5` / `v5_lite` | 86 | 16:9, 2560×1440 | Tried, largely dropped. |
| `ai_influencer` | 35 | 9:16, config presets | Character builder. |
| `cinematic_studio_soul_location` | 19 | 2048×1152, style **Location** | Dedicated location generator. |
| `soul_cinema_studio` | 12 | 2048×1152 | Trialled late. |
| `kling3_0_motion_control` | 3 | pro, 6s | Motion transfer — essentially rejected. |

**A custom house style carried the look.** `General_Olzhas` is a named style ID
applied to all 5,275 `soul_cinematic` jobs and never varied. The visual
consistency of the stills is carried by a saved style, not by prompt wording —
a reusable asset invisible from the film itself.

**Prompt length is inversely proportional to reference count.**
`soul_cinematic` generates from nothing and gets ~1,950 characters;
`nano_banana_2` is handed input images and gets ~300.

### The location method

Explicit depth planes as literal headers, populated with named objects rather
than adjectives, opened with an aggressive negative:

> A vast abandoned multi-level shopping mall interior, **completely devoid of
> any human presence and completely devoid of any vegetation. Pure urban decay —
> no moss, no vines, no greenery of any kind.**
>
> **FOREGROUND — extreme macro detail, every object physically legible:** an
> overturned shopping cart, its wire basket bent and rusted, wheels frozen
> mid-spin… a shattered jewelry display case, velvet inserts still inside,
> faded from red to dusty pink…
>
> **MIDGROUND:** the dry fountain, a multi-tier water feature, now completely dry…

The opening negative exists because every model's default post-apocalypse is
overgrown, and they wanted dry decay.

---

## Finding 7 — the rhythm, and the cost

| Phase | Dates | Shape |
|---|---|---|
| Design | Mar 20–23 | 2,419 image jobs, **zero video**. Characters, creatures, mechs, locations. |
| Video enters | Mar 25 | 377 video alongside 660 stills. First 6 keepers. |
| The burst | Mar 26 | 953 video, 20 stills — **61 keepers**, the biggest day of the project. |
| Back to art dept | Mar 28–30 | Mar 30 is the largest day overall (2,642) but mostly stills. They hit a wall and built more assets. |
| The grind | Apr 1–8 | Video dominates daily. 176 of 275 keepers. |

Two different numbers describe the cost, and **the difference between them
matters more than either one**.

**The crude ratio is 36.6:1** — 10,066 Seedance iterations against 275 keepers.
But that divides *all* video attempts, including whole setups that were
abandoned and never produced a keeper, by the shots that survived. It is the
cost of the *project*, not the cost of a shot.

**The per-shot number is far smaller.** 267 of the 275 keepers have their exact
prompt present in the Iterations folder, so the real funnel is directly
measurable:

| Attempts of the exact prompt that produced a keeper | |
|---|---:|
| Median attempts **before the keeper landed** | **5** |
| Median attempts total | 11 |
| p75 / p95 total | 17 / 34 |
| Maximum | 75 |

**A shot that works takes a median of five tries.** The 36.6 figure is real but
describes exploration and dead ends; it should not be quoted as the price of a
finished shot.

Supporting texture: 1,572 distinct prompts produced 16,643 runs, only 3% run
once, and the most-rerolled prompt was submitted **477 times**. Production shots
015–018 carry a byte-identical prompt — four separate keepers of one setup.

### A reroll is a re-submit, not an edit

The most-rerolled Seedance prompt was submitted **75 times carrying one single
reference set and identical parameters throughout**. Across the corpus, of all
prompts run more than once, **1,053 kept an identical reference set and only 70
varied it**.

They are not tweaking their way to a keeper. They are pulling the handle again on
unchanged input.

### Three measurements that all point the same way

> ⚠ **Claims I expected to make and could not.**
>
> **Prompt discipline does not reduce attempts.** Median rerolls are **7 for all
> three groups** — negative-scoped (n=30), slot-syntax-only (n=876), plain prose
> (n=256). Means 7.8 / 8.8 / 8.3, scoped group lowest, but n=30 against identical
> medians is far too weak to claim.
>
> **The learning curve is flat.** Attempts-before-keeper by day, 25 Mar → 7 Apr:
> medians bounce between 2 and 9 with no trend. Two weeks of daily practice on
> one model did not measurably reduce the tries needed.
>
> **Feeding a generated still back in did not help.** Prompts using an
> `image_job` reference: median 8 rerolls against 7 for uploads only (n=38 vs
> 1,124) — no advantage, possibly slightly worse.
>
> Taken together: **nothing in this corpus supports the idea that better prompt
> craft converges faster.** Reroll count cannot see *quality*, so this is an
> absence of evidence rather than evidence of absence — but it is three
> independent absences, and it should not be argued past.

### Division of labour

`@kurogatsu` leads on both volume and keepers (5,197 iterations, 69 of 275
shots). `@dinitrobenzol`, `@askar`, `@gauss_frog_1070`, `@jennifer_lopez` and
`@ilya_k` carry the rest. The final 30 shots — the music-driven climax — were
made almost entirely by a second unit that barely appears earlier.

---

## Method and honesty

All figures are read directly from job records via `fnf-api-gw.higgsfield.ai`,
the project's own unauthenticated folder API. Counts are exact, not sampled.
Chinese translations are mine; originals are quoted verbatim beside them.

**Every claim about image *content* was made by downloading the image and
looking at it.** Four of those plates are in
[`data/reference-samples/`](./data/reference-samples/) so the reading can be
checked. This matters because the first draft did the opposite — described 54
images from 54 filenames — and got the central fact about them backwards. That
correction is left visible in Finding 5 rather than quietly patched.

**Corrections made after review** (each replaced an assertion with a
measurement): the reference pool is 353 images with a 39% bespoke tail, not a
small fixed set; prompt discipline shows no reroll advantage; the learning curve
is flat; rerolls are identical re-submits; the plates carry baked-in text.

**Not established here:** whether the 275-shot Production folder is the final cut
or a curated selection; what post-processing happened off-platform; and the
contents of the ~1,049 reference images that live outside the published folders.
