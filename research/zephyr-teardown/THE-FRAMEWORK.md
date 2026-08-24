# How they make these films — the whole framework, in plain English

Written after reading **23,809 job records** across both ZEPHYR projects, opening
the reference images, downloading the finished videos and measuring them, and
listening to the audio files. Where something is measured, the number is here.
Where something is my inference, it says so.

This is the "how does it actually work" document. The detail and the evidence are
in [`README.md`](./README.md) (first film) and
[`zephyr-special-the-evolution.md`](./zephyr-special-the-evolution.md) (the
later, more advanced one).

---

## The one-paragraph version

They make a film the way a normal film gets made. Someone writes a script.
Someone breaks it into shots. An art department builds a small library of
reference pictures — one per character, one per outfit, one per location, one per
important object. Then, shot by shot, a person writes a paragraph describing one
camera setup, staples the three or four relevant reference pictures to it, and
presses go about ten times until one of the takes is good. The good takes get cut
together somewhere else. **The AI is the camera and the actors. It is not the
director, the writer, or the editor.**

Everything below is the detail of how each of those steps is actually done.

---

## 1. The asset library is the whole trick

Nothing in this system remembers anything. Every generation starts from nothing
and knows nothing about any other generation. **The only reason a character looks
the same in shot 40 as in shot 3 is that the same picture was attached to both.**

Proof: across both projects, **23,809 jobs, not one has a parent** — there is a
field in the platform for linking a generation to a previous one, and it is empty
everywhere. And **zero prompts say "continues from the previous shot."**

So the library is not an art-department nicety. It is the memory.

### What's in it

For the second film, a registry of **33 named assets**, each in a category:

- **`character`** — one per person *per outfit*. `Zero_home`, `Zero_rock`,
  `zero_inside` are the same woman dressed three ways, and each is its own asset.
- **`environment`** — `Home`, `location_scene_1`, `flower_loc`, `water_loca`.
- **`prop`** — `Glass`, `guitar_reina`, `guitar_zero`, `drums_naomi`,
  `zero_mecha`. Note the guitars are *per character*.

The first film did the same thing with filenames in a folder, and the filenames
carried the story state too: `Alex (Battle Mode) [KIA].png`, `Tank (injured).png`,
`Mira (Episode 1 Base) (After shower).png`.

### What a character asset looks like

One image, laid out to a fixed template:

- a **text block** — name, height, personality, and a **`Voice:` line**
- **two full-body views**, front and back, against plain grey or white
- **one or two large face crops** — front, and sometimes profile

The text is **burnt into the picture**, and it is asked for on purpose — one mint
prompt says *"labeled 'Zjasmin' at the top"*. Whether that's wise is a live
question for us, filed at
[`OPEN_TEST_baked-text-on-references.md`](./OPEN_TEST_baked-text-on-references.md).

> **On the headless bodies you spotted:** some sheets have heads on the body
> views, some don't, **in both projects**. And the recipe that mints them asks
> for *"two full-length photos from shoes to head"* — heads requested. So the
> headlessness looks like something the image generator did rather than something
> anyone specified. I originally claimed it was a deliberate design; that claim
> did not survive checking.

### How the sheets are made

By the image model, from two inputs, in one step. The most useful prompt in the
whole corpus:

> *"Character reference sheet of the character shown in `<<<image_1>>>`, **wearing
> the outfit/clothing from `<<<image_2>>>`**, labeled 'Zjasmin' at the top."*

**Identity picture × outfit picture → wardrobe-state sheet.** That is how one
person becomes five wearable assets.

They also revise sheets while *keeping the text* (*"make a new character sheet,
all the text information must remain"*), mint props on white backgrounds
(*"realistic item asset whiskey cup with transparent lemonade"* — that's where
`Glass` came from), and generate the blocking diagram (below).

---

## 2. How a shot gets written

A shot prompt has four parts, in this order. This is consistent across both films
and every author.

**(a) The look.** A block of style that barely changes between shots — it's
copy-pasted house style. The second film formalised it into named fields:

> **style**: 8K, photorealism, real organic film grain and halation. **NOT a 3D
> render, NOT a game engine, NOT a game-cutscene aesthetic, NOT a cartoon.**
> **operating_style**: *Hoyte van Hoytema naturalism* — intimate ultra-handheld
> closeness, tactile textures, atmospheric haze, documentary framing.
> **lighting**: motivated natural light, one soft key, no heavy grade.
> **skin**: pore-level realism — visible pores, fine vellus hair, natural
> asymmetry, no smoothing.
> **physics**: real gravity and mass; sofa cushions compress and rebound under
> jumping; nothing floats or slides.
> **acting**: natural blinking throughout; no frozen mask-face, no dead eyes.

**(b) The cast list.** Every reference gets named and described *in words as well
as pictures* — they never trust the picture alone:

> `<<<image_1>>>` — Asian female, 173cm, platinum blonde hair, small black horns,
> grey-blue eyes, khaki moto jacket with blue detailing, khaki shorts, dark green
> high boots.

**(c) What each reference is allowed to contribute — and what it must not.**
This is the single highest-craft move in the corpus:

> `<<<image_4>>>` — **interior only** … **do not use a single pixel of the
> background from this input image.**
> `<<<image_3>>>` — post-apocalyptic city — **the background behind the glass
> comes strictly and solely from here, in every shot, without exception.**

You can watch them learn this: an early shot says only *"interior only, don't take
the background"*; six shots later it has hardened into the pixel wording. And
opening the actual reference explains why — the cockpit picture has plain white
studio wall visible down both sides, which would otherwise fight the city.

**(d) The action**, then a clipped technical tail:

> *85mm. Realistic. 16:9. 7 seconds. SFX only. Cinematic. 8K. Handheld. Heavy
> grain. Crushed blacks.*

---

## 3. Camera language

The first film wrote camera moves in Chinese shorthand. The second film is far
more precise, and this is measured across its 4,837 jobs:

| | Share |
|---|---:|
| handheld | 53% |
| **angle of view stated in degrees** | 51% |
| focal length in mm | 50% |
| **180° shutter** | 45% |
| **named cinematographer** | 43% |
| depth of field / bokeh | 40% |
| **"no slow-mo"** | 28% |
| second-by-second action beats | 27% |
| push-in / dolly | 19% |
| percentage framing (`~35%x / 55%y`) | 7% |

Four techniques worth stealing:

**Name a real cinematographer.** *"Hoyte van Hoytema naturalism"* compresses a
paragraph of description into three words the model already understands.

**Specify the lens as optics, not as a number.** Not "85mm" but *"a NARROW 34°
horizontal angle of view… strong telephoto compression, background pulled in
close and thrown soft, only one to three faces sharp at a time. NOT wide-angle,
NOT large-format."*

**Budget colour as percentages.** *"~70% desaturated green-grey room tone; ~20%
warm orange-yellow accent; ~10% cool daylight blue as a counter-note."*

**Place the subject numerically.** *"First frame on Haru at ~35%x/55%y, leaning
forward over her knees."*

**A note on style drift between the two films:** the first asked for slow motion
in 23% of its keeper shots; the second explicitly *forbids* it in 28%. They moved
from stylised action to documentary naturalism.

---

## 4. The rules and constraints they lean on

Almost all the control in this system is **negative** — telling the model what
*not* to do. The recurring ones:

- **Anti-CG:** `NOT a 3D render, NOT a game engine, NOT a game-cutscene
  aesthetic, NOT a cartoon` (the second film) / `非3D动画` — "not 3D animation"
  (the first). This is the most repeated instruction in either corpus.
- **Anti-plastic-skin:** *"NO waxy/plastic/airbrushed/over-smoothed/CGI/doll/
  mannequin look, no uncanny smoothness."*
- **Anti-dead-eyes:** *"no frozen mask-face, no dead eyes; forehead and eyebrow
  movement must precisely match the emotion of each line."*
- **Reference scoping:** *"not a single pixel of the background from this input."*
- **Diagram scoping:** *"layout only, overlays never drawn."*
- **Audio scoping:** *"no music in the audio, no subtitles, no on-screen text."*
- **A whole scene-level field for it** in the JSON schema:
  `what_we_do_not_show`.

And a striking inverse — they sometimes direct *imperfection* on purpose:
*"shouting the lyrics a little off-key, raw and sincere"*, *"no polished lip-sync
(shouty and a bit off)"*.

---

## 5. Character consistency — how it's actually held

Four mechanisms, all in the asset rather than in the prompt:

1. **The same picture every time.** Non-negotiable, and it is the whole system.
2. **Permanent features flagged as permanent** in the asset's own description:
   *"PERMANENT dark curved horns (keep in every frame)"*, *"PERMANENT
   holographic glitter strip across the bridge of the nose (keep in every
   frame)"*.
3. **Known failure modes pre-empted in the asset:** *"BROWN eyes (never
   blue/green)"*. The model had evidently drifted her eye colour, and the fix
   lives with the character, not in every prompt someone writes.
4. **A per-scene override channel**, with the story reason attached: *"NO horns
   in this scene (omit the horns entirely, **for continuity with the burger-story
   shots**)"*.

**All four demonstrably work.** I sampled frames from a finished shot and looked:
Zero appears with no horns exactly as the override says, and Haru's nose glitter
strip is present in every frame she's in.

The standard fidelity instruction is literally `100% match`, and a single scope
line often carries identity, blocking and voice at once: *"100% match, NO horns;
low female voice; seated strictly on the sofa corner."*

---

## 6. What gets attached to a shot, and why

Measured across the 1,034 second-film shots that use the asset registry:

| Jobs | Combination | What it is |
|---:|---|---|
| 200 | 5×character + environment | the whole band in a room |
| 172 | character + environment + prop | one actor, a place, a thing |
| 161 | 2×character + environment + prop | a two-hander with a prop |
| 106 | 5×character + environment + prop | the group scene with the lemonade |
| 98 | character alone | a clean single |

**One asset per person** — five people means five attachments, not one group
photo. Typical load is 3–6 assets; the first film averaged 3–4 attached images
with a max of 9.

**Props carry a per-beat state**, which is the part most likely to be
under-appreciated. The lemonade glass is attached **349 times**, and its scope
line changes each beat: *"HERE: Zero is mid-sip from it when she chokes; liquid
sloshes and a drop catches her lip"*, then *"held in her hand the whole take,
mid-sip at the open."* It is one continuity object tracked through a scene.

---

## 7. The audio — what those files actually are

**Your question was: samples, or the real spoken dialogue? Neither.**

Downloaded and measured: **nine mono `.wav` files, ~13.6–14.1 seconds each**,
44.1 kHz. One of them is attached to **716 separate generations**.

Two things identify them. Every filename ends `_sfx.wav` — the platform's own
generated-audio naming — and they are served from the **results** host, the same
one the finished `.mp4`s come from, not the uploads host.

**So the audio is the platform's own output, fed back in as an input.** They
generated a shot with audio, kept the take whose performance they liked, and then
attached that ~14-second clip to hundreds of later generations. It is a
**performance anchor** — the audio equivalent of a character sheet.

### How it's used

- **25% of shots** carry one (always exactly one, always `.wav`).
- The other 75% still have `generate_audio: true` — the model invents audio from
  the prose, and the prompt directs it with an itemised foley list: *"SFX only:
  the tautening creak of a single-strap harness pulled by anxious hands, heavy
  breathing pressed against the belt, the sharp snap of a car-type release catch.
  **No music.**"*
- When a clip *is* attached, the prompt always says to follow it. That
  correlation is **perfect**: 493 "follow the audio" instructions among shots
  with a file, **zero** among shots without.
- It gets its own slot token: *"MUSIC / VOCALS: `<<<audio_1>>>` plays throughout;
  Mira sings lead (lip-synced); the others play their instruments in time."*

### The clever part

The attached clip is a **metronome, not a soundtrack**:

> *"diegetic singing ONLY. **The DnB track itself is NOT audible / NOT present in
> the mix** — we hear only the girls' voices, their laughter and the room. They
> sing in time as if the **(unheard) 87 BPM** track is playing."*

They attach it so the performance lands on the beat, then instruct the model to
leave it out of the output. Music is laid under the finished cut elsewhere.
Verified at job level: **171 of 171** shots saying "87 BPM" carry an attached
audio file, and **139 of 139** saying "NOT audible" do too.

**Spoken dialogue is different and is written, not attached.** The lines are
typed into the prompt in quotes, with the delivery directed around them:

> *…begins to speak, the stutter driven entirely by fear, her voice smaller than
> she wants it to be: **"Girls… I think I need some backup."***

In the first film the direction was in Chinese and only the quoted line was in
English, so the characters would speak English. **27% of finished shots carry
dialogue this way**, including five-line conversations between two people inside
a single generation.

---

## 8. The 15-second problem, and what it means for Seedance 3.0

**They never solved it. They never needed to.** Median shot is 9 seconds; only
16% of finished shots run to the 15-second cap. Film is short setups cut
together, and that is what they made.

Where they wanted more film in one pull, they wrote several cuts into one prompt.
I tested whether that works:

- Downloaded a job whose prompt describes **six shots totalling "~24s"** while
  the duration parameter says **8 seconds**.
- Read the MP4 header: the delivered video is **8.042 seconds**. A 7-second job
  delivers 7.059. **The duration parameter is authoritative — describing 24
  seconds does not buy 24 seconds.**
- Then sampled eight frames and looked at them: **five or six distinct camera
  setups land inside those 8 seconds.** The model **compressed** the sequence
  rather than truncating it.

So multi-shot prompting buys **more cuts per second, never more seconds**.

### Is the framework transferable to Seedance 3.0 (30s)?

**Almost entirely, and the parts that transfer are the parts that matter.** My
reasoning, marked as reasoning — I have no 3.0 data:

**Transfers unchanged**, because none of it depends on clip length:
- the asset library and one-picture-per-character-per-outfit discipline
- reference scoping, positive and negative
- the negative style stack (anti-CG, anti-plastic-skin, anti-dead-eyes)
- permanent-feature flags and per-scene overrides
- camera specification by optics, colour budgeting, numeric subject placement
- the audio anchor and the "attached but not audible" trick
- writing dialogue in quotes with the delivery directed around it

**Gets easier:** the `shots[]` multi-cut technique stops being a compression
trick. A six-shot, 24-second scene document would fit a 30-second generation at
its intended pace rather than being crushed into 8 seconds. That is a real
quality gain, not just convenience.

**Gets harder, and this is the honest caution.** Everything above is calibrated
to a ~10-second unit of work:

- **The reroll economics get worse per attempt.** They needed a median of five
  attempts per keeper. If a 30-second generation costs meaningfully more than
  three 10-second ones, "roll again" becomes a much more expensive habit — and
  the evidence across three separate measurements is that better prompting does
  *not* reduce the number of attempts.
- **A longer take is a bigger thing to reject.** At 10 seconds a flaw costs you
  10 seconds. At 30 it costs 30, and a single bad beat at second 24 throws away
  the good 23 in front of it.
- **`action_timing` would need real extension.** Their second-by-second beat
  lists currently cover 8–15 seconds; 30 seconds of directed action is three
  times the writing, and nothing in this corpus shows how well the model holds a
  beat sheet that long.
- **Nothing here tests identity drift over 30 seconds.** Consistency is held by
  one attached picture; whether that grip holds for 30 seconds as well as it does
  for 10 is exactly the sort of thing that would need measuring rather than
  assuming.

**My recommendation if we ever build on 3.0:** keep shooting short. Use the extra
length for genuinely continuous action — a developing move, a long performance
take, an unbroken conversation — not as a default. The economics and the
rejection cost both argue for short takes, and this corpus is 23,809 jobs of
evidence that short takes cut together are enough to make a film.

---

## 9. What none of this does

Worth being blunt, because it bounds the ambition:

- **No engine wrote the story.** The script-and-chat surface on the platform is
  empty for both projects. The screenplay — a real one, with character arcs, a
  hazing subplot and a death — is human work that enters only as prose inside
  individual shot prompts.
- **No engine broke the story into shots.** Someone decided this beat is a
  7-second close-up on a seatbelt with the face never entering frame.
- **No engine edited it.** The platform holds no timeline. The film is assembled
  elsewhere.
- **Nothing remembers anything.** Every generation is an island.

For Drape, that is the map of what would have to be built rather than bought.
The implications are in
[`implications-for-drape.md`](./implications-for-drape.md).
