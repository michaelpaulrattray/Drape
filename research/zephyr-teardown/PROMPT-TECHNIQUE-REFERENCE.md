# The prompt framework — complete technique reference

Mined from **every prompt in both productions**: 21,749 prompted jobs → 2,034
distinct prompts → **23,217 distinct clauses**, categorised and frequency-ranked.
Not a sample.

Numbers in `[brackets]` are **run counts** — how many generations carried that
exact clause. They are the closest thing to a vote on what the crew believed
worked, since a clause that survives 500 rerolls survived 500 chances to be
rewritten.

The full ranked output is [`data/clause-catalogue.md`](./data/clause-catalogue.md)
(23,217 clauses, top 120 per category); regenerate it with
[`scripts/mine-clauses.mjs`](./scripts/mine-clauses.mjs). This document is the
curated read of it, organised for building.

**Everything below is quoted verbatim.** Chinese is film one, English is mostly
the Special.

---

## 1. The skeleton every shot prompt follows

```
[STYLE BLOCK]        house look, near-identical across shots
[ASSET GLOSSARY]     each reference named + described in words
[SCOPE PER ASSET]    what each contributes, and what it must NOT
[ACTION]             blocking, camera, performance, timing
[AUDIO BLOCK]        foley list or music instruction
[TECHNICAL TAIL]     format, duration, grain, negatives
```

---

## 2. The house style string

**Film one, the single most-repeated clause in either corpus:**

> 写实风格，好莱坞VFX，ARRI 35，变形镜头，高反差光效 `[1958]`
> *(Realistic style, Hollywood VFX, ARRI 35, anamorphic lens, high-contrast
> lighting)*

Extended variant:

> 真实感，好莱坞真人VFX，ARRI 35，长焦镜头，变形镜头，不对称电影感构图，自由镜头，
> 高反差电影光效 `[589]`
> *(Realistic, Hollywood **live-action** VFX, ARRI 35, telephoto, anamorphic,
> **asymmetrical cinematic composition**, free camera, high-contrast cinematic
> lighting)*

**The Special replaced it with a fielded block:**

> **Style:** 8K IMAX, photorealism. Real organic film grain and halation. Shot on
> large-format film. High dynamic range. `[581 / 1261 / 1075]`
> **Camera/Optics:** large-format 65mm spherical prime, natural motion blur at a
> **180° shutter** `[478]`, creamy shallow focus falloff, natural halation around
> highlights, **subtle lens breathing on focus pull** `[250]`
> **Texture:** matte non-reflective surfaces, lived-in worn materials (aged
> concrete, fabric, leather, dust), organic 65mm film grain, **no digital gloss,
> no plastic sheen** `[478]`

**Both name a real camera body.** `ARRI 35` / `ARRI Alexa 35` `[920]` /
`Arri Alexa Mini LF with anamorphic lenses (Panavision-style)` `[216]`.

---

## 3. Lens and optics

| Technique | Verbatim | Runs |
|---|---|---:|
| **Angle of view, not focal length** | *"a **NARROW 34° horizontal angle of view** on a standard Super-35 / full-frame sensor… strong telephoto compression, flattened perspective, background pulled in close and thrown soft, only one to three faces/limbs sharp at a time"* | — |
| Per-segment FOV | *"SEGMENT 2 = **84° classic wide** (inside-cup POV)"* | 174 |
| Shutter | *"Real-time 24fps, **180° shutter**"* | 909 |
| Depth of field | *"Shallow depth of field on the face, documentary framing, photochemical look"* | 670 |
| | *"shallow large-format depth of field with **creamy focus falloff**, natural halation around highlights, subtle lens breathing"* | 668 |
| Anamorphic character | *"Subtle anamorphic lens character — small **horizontal flare streaks and gentle oval bokeh**"* | 203 |
| **Lens change as a move** | *"**35mm → 85mm push-in**"* | 112 |
| Lens lock | *"**No lens drift mid-segment.** LENS LOCK"* | 186 |

**Optical negatives:**

> No artificial flares, no anamorphic streaks `[598]`
> **NO barrel/fisheye distortion, NO vignette** `[414]`
> NOT wide-angle, NOT large-format, NOT a 65mm IMAX look, no fisheye, no edge
> distortion, no deep focus, no full-room coverage

⚠ **The two films disagree here.** Film one used anamorphic everywhere; the
Special forbids anamorphic streaks in some sequences and asks for *"subtle
anamorphic lens character"* in others. **Lens character is per-sequence, not a
house constant.**

---

## 4. Camera movement — a graded vocabulary

This is the most developed vocabulary in either corpus. **Handheld is the
default**, and its intensity is a scale:

| Intensity | Verbatim | Runs |
|---|---|---:|
| barely there | 轻微手持呼吸感 *(slight handheld breathing)* | **535** |
| | *"handheld, gentle, faint micro-jitter"* | 138 |
| | *"tiny breathing jitter"* | 108 |
| | *"only the faint natural micro-jitter of a held camera"* | 70 |
| alive | *"alive with **operator breath, hand tremor, micro weight-shifts and small reframes**"* | 111 |
| | 充满生命力的手持镜头 *(handheld full of life)* | 70 |
| energetic | *"energetic handheld movement with intentional moves between subjects and quick zoom/push-ins"* | 69 |
| | *"Raw organic jitter, fast but legible reframes timed to the action"* | 80 |
| extreme | 激烈手持剧烈颤抖从不静止 *(intense handheld, violent shake, never still)* | 190 |
| | 摄像机手持极度颤抖 *(camera handheld, extreme shake)* | 157 |

**Handheld ≠ moving.** They separate operator presence from camera travel:

> *"**Handheld but STATIC**"* `[66]`
> *"**essentially static, no pan**"* `[138]`
> *"locked off, not moving, only the faint natural micro-jitter of a held camera"* `[70]`

**Authenticity negatives — this is the one most people would miss:**

> *"**No locked-off tripod shots, no gimbal float, no digital jitter.**"* `[111]`

They distinguish *real* handheld from three kinds of fake handheld.

**Named moves:**

| Move | Verbatim |
|---|---|
| push-in | *"**SLOW PUSH-IN (dolly), not slow-mo**"* `[88]` — disambiguating move from time |
| | *"handheld slow push-in from directly behind the mecha, **following its eyeline**"* `[111]` |
| micro-adjust | *"a **micro snap-in** on the choke, a **small loosen** later for her hand-flare"* `[108]` |
| roam | *"Single energetic **ultra-handheld take that roams between them**"* `[69]` |
| | *"a long-lens handheld camera **roams between them and zooms onto faces, legs and hands**"* `[69]` |
| spin | 不移动，不位移，仅在原位锐利瞬时旋转 *(no move, no displacement, only a sharp instant rotation in place)* `[131]` |
| reactive | *"a **small reactive reframe up** as she rises"* `[65]` |
| | *"Handheld camera **jolts with her panic**"* `[80]` |

**Movement negatives:**

> *"**No dolly, no zoom, no push-ins, only the clockwise spin**"* `[88]`
> *"NO wide establishing pull-back, no fisheye sweep"* `[69]`
> *"Handheld camera tightens with the shift, **never cuts**"* `[67]`

**Per-character operator instruction** — one of the most elegant things in the
corpus:

> MIRA, CLOSE-UP (**operator: slow orbit**) `[59]`
> HARU MIN, CLOSE-UP (**operator: slow push-in**) `[59]`
> ZERO, CLOSE-UP (**operator: low push-in**) `[59]`
> NAOMI, CLOSE-UP (**operator: slow arc**) `[59]`

Four coverage shots of four characters, each given a different move so the
sequence doesn't read as repetitive.

---

## 5. Shot size, angle, framing

**Shot headers follow a fixed grammar** — `LOCATION, SUBJECT, ACTION, SIZE (technique)`:

> BRIDGE, HARU LOW-ANGLE CLOSE (handheld) `[153]`
> MECH CABIN, TIGHT 3/4 CLOSE-UP, OFF-CENTER (handheld) `[117]`
> CABIN, REINA SPRAWLED, SMOKING (handheld) `[95]`
> CABIN, REINA, FRONT MED-CLOSE, LOW ANGLE, OFF-CENTER (handheld) `[60]`
> WIDE/MEDIUM, MEADOW (handheld) `[58]`

**Sizes used:** BIG CLOSE-UP / VERY TIGHT CLOSE-UP / CLOSE-UP / MEDIUM CLOSE /
MEDIUM / WIDE / TWO-SHOT / WAIST-UP / CHEST-UP / FULL-BODY. Chinese: 特写 /
近景 / 中景 / 全景 / 中近景.

**Relative sizing between cuts** — so a cut reads as a cut:

> *"VERY TIGHT 3/4 CLOSE-UP handheld (~5s, **larger than Shot 1**)"* `[74]`

**Special angles:**

> *"CAMERA: **locked 90-degree TOP-DOWN overhead**, pointing straight down"* `[184]`
> *"POV FROM INSIDE THE NOODLE CUP"* `[174]`
> *"camera positioned at **near-floor level**, extremely low angle looking across the debris-covered floor"* `[120]`
> *"MONOCULAR VIEW (SINGLE-EYEPIECE), NO INTERFACE"* `[59]`

**Composition rules, stated as negatives:**

> **never centred** `[292]`
> 不对称电影感构图 *(asymmetrical cinematic composition)*
> *"off-centre, non-symmetrical compositions; subjects scattered across
> foreground, mid-ground and background **at different depths**"*
> *"Maintain strong negative space"* `[276]`
> *"the long lens **isolates one detail at a time**"*

**Numeric framing** — subject position and crop as percentages:

> *"First frame on Haru at **~35%x/55%y**, leaning forward over her knees"*
> *"a handheld close shot on the open back battery bay, **x 35%–75%, y 25%–80%**"* `[71]`

---

## 6. Motion and time

| Verbatim | Runs |
|---|---:|
| **real-time 24fps, no slow-mo** | 553 |
| *"real time, smoothly transitioning to slow motion"* (film one's signature ramp) | — |
| 慢动作 / 升格 *(slow motion / overcranked)* | — |
| *"**SLOW PUSH-IN (dolly), not slow-mo**"* | 88 |
| *"Technical: smooth stable motion, 8K, **no flicker, no warping, no morphing**"* | 584 |

**The two films are opposites here.** Film one asked for slow motion in 23% of
keepers; the Special forbids it in 28% of all prompts. **Speed is a
per-production style decision, not a technique to always apply.**

---

## 7. Lighting

> **Light:** motivated natural light, **one soft key**, desaturated rich earthy
> colour, faithful skin tones, soft roll-off, **no heavy grade** `[489]`
> *"Source-motivated cold natural light, desaturated earthy palette, **no sun**,
> no heavy grade"* `[659]`
> *"only natural SUNLIGHT, warm directional, real soft shadows"* `[195]`
> *"Lighting: natural sunlight only, **high-contrast, hard defined shadows** on her face and figure"* `[139]`
> *"Flat, diffuse, **fog-filtered overcast light exactly like the `<REF>` reference**"* `[162]`
> *"half-face roll-off across the 3/4 angle"* `[138]`

Film one: 高反差光效 *(high-contrast lighting)*, 低调布光 *(low-key)*, 无补光
*(no fill)*, 硬质光 *(hard light)*.

**Key move: lighting is inherited from the location reference.**

> 光照与城市 `<REF>` 一致 *(lighting consistent with the city ref)* `[431]`
> *"Lighting matches location `<REF>`"* `[248]`
> *"`<REF>` : **location AND lighting**"* `[297]`

---

## 8. Colour

**Budgeted as percentages** — the most transferable colour technique here:

> **~70%** desaturated green-grey room tone + raw concrete; **~20%** warm
> orange-yellow accent (warm daylight + ceiling-panel light through the camo
> netting); **~10%** cool daylight blue as a counter-note from the windows

Negatives: *"No HDR, no glow, no tone mapping"* `[356]`, *"Natural filmic
contrast only"* `[156]`, *"no heavy grade"*.

---

## 9. Skin, face, realism

> visible pores, fine vellus hair, natural asymmetry, **no smoothing, no
> retouching** `[877]`
> **NOT waxy/plastic/airbrushed/CGI/doll** `[686]`
> *"Skin matte, **does NOT shine**"* `[464]`
> *"plastic/waxy/airbrushed/poreless skin, oily/glossy/shiny skin sheen, doll,
> mannequin, CGI/3D/game face, uncanny valley, beauty-filter, warped face"*
> 真实皮肤 / 真实质感 *(real skin / real texture)*

---

## 10. Physics and materials

Named explicitly as a field — prose almost never does this:

> **real gravity, inertia and mass**; weighted body movement, bouncing/jumping
> with real impact and recovery, **sofa cushions compress and rebound under
> jumping**, hair and loose fabric whip with the motion, accurate contact
> shadows, **nothing floats or slides** `[80]`
> 真实质感，真实重量，真实动态模糊 *(real texture, real weight, real motion blur)*

---

## 11. Acting and performance

> natural eye blinking throughout; active forehead and brow micro-expression;
> **no frozen mask-face, no dead eyes** `[841]`
> **FOREHEAD AND EYEBROW MOVEMENT MUST PRECISELY MATCH THE EMOTION OF EACH LINE** `[525]`
> *"EYELINE: soft drift"* `[106]`
> *"small reactive head/eye tracking, faint amused micro-expressions"* `[58]`
> *"calm baseline that **cracks upward only on the outburst**"* `[227]`
> *"They glance and grin at **EACH OTHER (never at camera)**"*

**Behavioural negatives, which are unusually specific:**

> **NO hugging** `[791]`
> *"no synchronized identical choreography"*
> *"**no polished lip-sync (shouty and a bit off)**"*

---

## 12. Reference scoping — the control system

The most important section for building this.

**Positive scoping — what an asset contributes:**

| Verbatim | Runs |
|---|---:|
| 外观严格按参考图 *(appearance strictly per the reference)* | **1057** |
| 环境严格按参考图 *(environment strictly per the reference)* | 653 |
| `<REF>` : **100% match** | 920 |
| `<REF>` : location AND lighting | 297 |
| *"Controls **geography, materials, atmosphere, and weather only**"* | 130 |
| 仅外观严格按参考图 *(**only** the appearance, strictly per reference)* | 163 |

**Negative scoping — what it must not contribute:**

> *"**interior only** … do not use a single pixel of the background from this
> input image"*
> *"the background behind the glass comes **strictly and solely from here, in
> every shot, without exception**"*
> *"**layout only, overlays never drawn**"* / *"**markers never generated**"* `[531]`
> *"— **preserve** cockpit materials and details / — keep interior sharp and
> readable / — **match** lighting, shadows, and perspective"* `[142 each]`

**Identity locks, carried on the asset itself:**

> **PERMANENT holographic glitter strip across the bridge of the nose (keep in
> every frame)** `[823]`
> **BROWN eyes (never blue/green)** `[470]`
> *"keep face and identity unchanged"* `[179]` / *"Use her exactly"* `[194]`

**Per-scene overrides of a permanent lock:**

> `<REF>` : **100% match, NO horns** `[553]`
> *"NO horns in this scene (omit the horns entirely, **for continuity with the
> burger-story shots**)"*

**Exclusivity — who and what may appear or act:**

> *"**Only** `<REF>` (the pilot) and `<REF>` (the mecha) are present"* `[186]`
> *"**only Zero speaks**"* `[267]` · *"**only Haru moves**"* `[186]`
> *"IMPORTANT: **No humans, no silhouettes, no living beings**"* `[504]`

---

## 13. The negative stack, ranked

The single largest category — **2,403 distinct negative clauses**. Ranked by
runs, this is effectively their whole quality-control system:

| Runs | Constraint |
|---:|---|
| **2487** | **NO MUSIC** |
| 1293 | No subtitles |
| 1281 | No on-screen text or watermarks |
| 902 | NO words |
| 877 | no smoothing, no retouching |
| 841 | no frozen mask-face, no dead eyes |
| 791 | NO hugging |
| 686 | NOT waxy/plastic/airbrushed/CGI/doll |
| 649 | NOT 3D/game/cartoon |
| 598 | No artificial flares, no anamorphic streaks |
| 584 | no flicker, no warping, no morphing |
| 582 | NOT a 3D render, NOT a game engine, NOT game-cutscene aesthetic, NOT a cartoon |
| 553 | real-time 24fps, no slow-mo |
| 531 | markers never generated |
| 504 | No humans, no silhouettes, no living beings |
| 470 | BROWN eyes (never blue/green) |
| 464 | Skin matte, does NOT shine |
| 423 | NOT pale, NOT clear |
| 414 | NO barrel/fisheye distortion, NO vignette |
| 356 | No HDR, no glow, no tone mapping |
| 292 | never centred |
| 284 | No dialogue |

**Read that list as a design brief.** Almost every one is the model's default
failure mode being suppressed by hand. A backend that emits these automatically
removes the single biggest source of manual prompt labour.

---

## 14. Audio and voice

> **NO MUSIC** `[2487]` — the most-repeated negative in the corpus
> **SFX only** `[326]`
> *"MUSIC / VOCALS: `<<<audio_1>>>` plays throughout; Mira sings lead
> (lip-synced); the others play their instruments in time"* `[59]`
> *"AUDIO: **locked to the input music track**"* `[184]`
> *"The DnB track itself is **NOT audible/NOT present in the mix**"* `[128]`
> *"They sing in time as if the **(unheard) 87 BPM** track is playing"* `[128]`
> *"**Vocals: non-verbal only**"* `[237]`
> *"environmental SFX + diegetic dialogue (only Zero speaks)"* `[173]`
> *"Room tone, fabric rustle. No music."* — per-shot foley, changed every cut

**Dialogue format** — screenplay cues with parentheticals:

> **Haru (high, excited, childlike):** "…"
> **Haru off-screen (continuing):** "…"
> **Haru (muffled, struggling, then triumphant):** "…"

---

## 15. Shot structure

> *"CLOSE-UP handheld **SINGLE CONTINUOUS TAKE (~10s, no cut, no multishot)**"* `[157]`
> 一镜到底，手持镜头，轻微抖动，镜头自由 *(one continuous take, handheld, slight shake, free camera)* `[79]`
> *"Every segment is handheld"* `[222]`
> *"**First frame:** …"* — nearly every Special shot opens by specifying frame one
> *"0–2s: hands spread wide apart… 2–3.5s: she stacks flat hands one over the other"* — second-by-second beats
> 第一镜 / 第二镜 / 第三镜, 切镜, 硬切 — cuts written into a single generation

---

## 16. The asset-mint prompts

**Film one's character-sheet recipe** — and it explains the layout exactly:

> **Left frame: full-body shot** `[1077]`
> **Right frame: close-up portrait of the face** `[690]`
> *"Use image 1 (face close-up) as the main identity"* `[111]`
> *"Generate a full-body shot (**head-to-toe, no cropping**)"* `[111]`
> *"Clean studio lighting, realistic textures, **character-sheet feel**,
> photorealistic, high detail, **no text, no logos, no watermark**"* `[348]`

⚠ **Note the contradiction worth knowing about:** this mint asks for
*"head-to-toe, no cropping"* **and** *"no text"* — yet the delivered sheets are
often headless and do carry a text block. The instruction and the artifact
disagree, which is more evidence that the headlessness is the generator's doing.

**The Special's recipe** (Russian):

> *сделай коллаж персонажа из image1 — две фотографии в полный рост с обуви до
> головы, спереди и сзади, крупный кадр лица и крупный кадр профиля*
> *(make a character collage from image1 — two full-length photos from shoes to
> head, front and back, a large face shot and a large profile shot)*

**Person × outfit, one step:**

> *"Character reference sheet of the character shown in `<<<image_1>>>`, **wearing
> the outfit/clothing from `<<<image_2>>>`**, labeled 'Zjasmin' at the top"*

**Mech sheet:** *"Photorealistic full body 3/4 front view, 5 meters tall bipedal
walker, industrial science fiction design"* `[579]`

**Prop on white:** *"realistic item asset whiskey cup with transparent lemonade"*

**Blocking diagram:** *"exact right topdown view of that room. keep positions of
all items"*

**Location:** *"IMPORTANT: No humans, no silhouettes, no living beings"* `[504]`,
*"abandoned, not clean"* `[332]`, *"Scene must feel empty but not sterile"* `[284]`,
*"avoid clutter"* `[296]`, FOREGROUND / MIDGROUND / BACKGROUND as literal headers.

---

## 17. What a Drape implementation would emit

Reading the corpus as a spec rather than as history, a shot request needs:

1. **A style profile** — one stored block per production, not per shot. Their
   most-repeated clause ran 1,958 times unchanged.
2. **An asset resolver** — name → plate, with a category (`character` /
   `environment` / `prop`) and a **default scope sentence per category**
   (`character` → "100% match"; `environment` → "location AND lighting";
   diagram → "layout only, overlays never drawn").
3. **Identity locks stored on the asset**, not written per prompt — permanent
   features, and pre-empted failure modes like "BROWN eyes (never blue/green)".
   Plus an **override channel** that takes a reason.
4. **The negative stack, emitted automatically** — §13 is the list.
5. **A camera vocabulary with graded intensity** — handheld from "faint
   micro-jitter" to "violent shake, never still", and the authenticity negatives
   that separate real handheld from gimbal float.
6. **Numeric framing** — subject at x%/y%, crop bounds, FOV in degrees.
7. **An audio lane** — foley list by default; attached anchor clip plus
   "not audible" when timing matters.
8. **Beat timing** — `0–2s: … 2–3.5s: …`.

**The one thing worth doing better than they did:** their registry has already
drifted — `Sheet_MIRA` beside `Sheet_mira`, `zero_sheet` beside `Sheet_zero`.
Names typed by hand diverge. A derived, constrained identifier costs nothing now
and cannot be retrofitted later.
