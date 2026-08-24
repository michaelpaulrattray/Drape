# How ZEPHYR held a story together — and how it handled the 15-second ceiling

Read off 18,972 job records from the FIRST production's own API, 2026-08-24.
⚠ A later production (ZEPHYR Special) changed much of this — see
[`zephyr-special-the-evolution.md`](./zephyr-special-the-evolution.md). Every number
here is counted, not estimated. Where something is not established by the data,
this document says so rather than filling the gap.

---

## The short answer

**They never solved the 15-second problem, because they never had it.**

There is no shot-to-shot continuation anywhere in this project. No chaining, no
last-frame hand-off, no memory, no state. Each of the 275 finished shots is an
independent generation that knows nothing about any other shot.

What holds the film together is one thing only: **every shot re-attaches
reference images, drawn from a pool with a heavily reused core.** Continuity is a
filing system, not a model capability.

(The pool is larger and less canonical than that sentence first suggests — 353
distinct images, 39% of them used only once. Measured in §2.)

That is the finding with the most direct consequence for Drape, so it is worth
stating precisely before anything else.

---

## 1. The evidence that there is no chaining

Three independent reads, all agreeing:

| Check | Result |
|---|---|
| `job_set_parent_id` set on any job | **0 of 18,918** |
| Production shots per `job_set_id` | **275 sets, all of size 1** |
| Prompts saying "continues from the previous shot" | **0 of 275** |

The platform *has* a parent/child field. It is null everywhere in this project.
275 finished shots produced 275 distinct job sets, each containing exactly one
job. Nothing points at anything else.

And the prompts never refer to a previous shot. Not once. The regex covered
`承接上一镜`, `接上一镜`, `上一个镜头`, "continues from", "previous shot" —
zero hits across the whole production folder and zero across 18,643 iterations.

Related continuity phrasing is nearly as rare:

- "lighting consistent with \<reference\>" — **3 of 275**
- "keep identical / exactly the same as" — **2 of 275**
- "same angle as the reference" — **1 of 275**

So they are not maintaining continuity by *instructing* the model about
continuity either. They are maintaining it structurally.

---

## 2. What actually carries continuity

The reference stack, re-attached to every single shot.

Production shots carry a **median of 3–4 image references**, up to 9: a
character's sheet, that character's mech, the cockpit interior, the location.

**How fixed is that pool? Measured, because the first draft of this document
asserted it.** The 275 shots make **1,011 image attachments drawn from 353
distinct images** — mean 2.86 shots per reference, most-reused appearing in 18
shots, and **39.4% (139 images) used in exactly one shot**.

So it is not one canonical sheet stapled everywhere. It is a **reused core** —
214 images appear in two or more shots — **plus a substantial bespoke tail**.
The anchor holds identity; roughly 40% of what any given shot needs was made for
that shot. Both halves are part of the method.

Two supporting mechanisms:

**The written glossary.** The most disciplined prompts re-state each character
in words alongside the image — *"Asian female, 173cm, platinum blonde hair,
small black horns, grey-blue eyes, khaki moto jacket with blue detailing"* —
every time. The image is not trusted alone. If the model's read of the
reference is weak on a given roll, the text is there to catch it.

**Per-reference scoping.** Each reference is told which part of itself to
contribute, and explicitly what *not* to: *"do not use a single pixel of the
background from this input image"*, *"the background behind the glass comes
strictly and solely from here, in every shot, without exception."* Note the
phrase *in every shot* — that is a continuity instruction aimed at the reference,
not at the timeline.

**Consequence:** continuity survives because the inputs are identical, not
because the system remembers. Thirteen different people shot this film across
19 days with no shared session state, and it holds together.

---

## 3. The 15-second ceiling was not a binding constraint

Durations across the 275 keepers:

```
 4s   9     8s   7      12s  30
 5s  50     9s  20      13s   4
 6s  20    10s  51      14s   4
 7s  27    11s   9      15s  44
```

Median **9 seconds**. Only 44 shots (16%) run to the 15-second maximum. They
were not pressing against the ceiling — most shots are half of it.

This is simply how film is shot. A live-action production also captures short
independent setups and assembles them later. The ceiling only bites if you are
trying to generate a *scene* in one go; they were generating *shots*.

### Where they did want length, they bought it two ways

**Cuts written into the prompt.** 60 of 275 prompts (22%) contain hard cuts
written as prose — `第一镜 / 第二镜 / 第三镜` ("shot one / two / three") or
`切镜` ("cut to") or `硬切` ("hard cut"). One prompt contains six.

Crucially, the platform's own `multi_shots` parameter is **`false` on all 275
shots**. They never used the built-in feature. They wrote the edit into the
prose and let a single generation produce a cut sequence.

**Slow motion.** 63 of 275 shots (23%) call for `慢动作` / `升格` / slow motion,
usually as a ramp: *"real time … smoothly transitioning to slow motion"*. This
stretches a short beat of action across a longer take, and it is the most
common single stylistic device in the corpus.

### And more often, they explicitly asked for *no* cuts

`一镜到底` — "one continuous take" — appears in **27 production prompts** and
**1,564 iterations**, more often than hard cuts do. The default intent is a
single unbroken shot; cutting inside a generation is the exception they reach
for deliberately.

---

## 4. How dialogue scenes were made without chaining

This is the part that most directly contradicts the assumption that
conversation needs multiple linked generations.

**They put whole conversations inside one prompt.** Production shot 162
contains five lines of two-hander dialogue in a single 15-second generation:

> "Get the fuck away from my mech."
> "I—I was just checking the vitals. Everything is.."
> "You don't know shit. Go check the rest and stay out of my cockpit."
> "I've already... Trust me, I know these systems inside out."
> "You've seen the manuals, not the monsters."

Shot 175 does the same with three lines and a character introduction. Shot 114
runs a four-beat exchange with a deliberate repetition gag ("Clean. My.
Barrel."). Seedance 2.0 is generating multi-speaker scenes, with performances,
in one shot.

**73 of 275 shots (27%) carry spoken dialogue.** The pattern is consistent:
Chinese direction for *how* the line is delivered, English inside quotes for
*what* is said —

> …开口说话，口吃完全由恐惧驱动，声音比她希望的要小：
> "Girls… I think I need some backup."
>
> (…begins to speak, the stutter driven entirely by fear, her voice smaller
> than she wants it to be: "Girls… I think I need some backup.")

---

## 5. How the story was actually developed

### There is no script in the platform

`cs_chat_ids` is **empty on all three folders**. The Cinema Studio chat surface
— where a script or beat sheet would live — holds nothing for this project.
The community page credits "Frames and Scenes / Cinema Studio" as the tool, but
**no story artifact exists in the data**. The screenplay was written by humans,
outside, and enters the system only as prose inside individual shot prompts.

This is worth being blunt about: **the storytelling was not done by an engine.**
The engines rendered shots. The story is human work that never touched them.

### They shot the spectacle first and the story second

Ordering the 275 shots by creation time and reading the dialogue as it appears:

- **Shots 3–12** (25–26 March): combat and action. *"Sorry for being late."*
  *"I hope I will be MVP today."* *"Spotted her. Sending a mark."*
  *"Girls… I think I need some backup."* — pure setup and peril.
- **Shots 63–98** (early April): consequence and banter. *"We could have easily
  failed."* *"Don't tell me it's the battery again.."* *"Bullshit! Zero is down,
  we're next!"*
- **Shots 111–230** (later April): the actual character story. Kai the new
  mechanic arrives, gets hazed, earns a name. *"Mira. Meet your new mechanic."*
  *"My name is Kai. Just…"* *"Kai Jun, huh."* *"Bye, Jun! Good luck with her."*

The relationship spine — the thing that makes it a film rather than a showreel —
was built **last**, connecting action material that already existed.

> **Stated limit.** This is creation order, not cut order. We know when each
> shot was made; we do not know where it sits in the finished film. The claim
> "spectacle first, story second" is about production sequence and is solid.
> Any claim about the edit's running order would not be.

### The emotional spine is a death

`Alex` is the most-mentioned character in production prompts (**54 shots**), and
the asset bible contains exactly one file with a story state baked into its
name: **`Alex (Battle Mode) [KIA].png`**. The reference file itself records that
the character dies. Beside it sits `Tank.jpg` and `Tank (injured).png`.

Continuity of *story state* — who is hurt, who is dead, what they were wearing —
is handled the same way as visual continuity: by having a separate reference
file for each state and picking the right one.

### The finale was a different crew

58 shots carry an attached audio track, and they cluster in exactly three blocks:
shots **20–48**, **151–154**, and **246–275**.

That last block is 30 consecutive shots, all with audio, and it was made almost
entirely by people who barely appear earlier: `@ameerr`, `@rinan`,
`@craftingpanda1082`, `@askar_yedil`, `@kurogatsu2`. The music-driven climax was
handed to a second unit, working to an attached `.wav`, while the leads had been
carrying the drama shots.

Four shots sync explicitly to that track using an `@музыка` token —
*"editing and movement synchronised to the music @музыка"*.

---

## 6. Where generated images re-enter as references

Not chaining, but adjacent and worth recording:

| Reference type | Across all jobs | In production |
|---|---|---|
| `media_input` (uploaded file) | 40,241 | 1,008 |
| `audio_input` | 975 | 58 |
| `image_job` (a previous generation's output) | **593** | **8** |
| `video_input` | 196 | **1** |

So **593 times** across the corpus, a generated still was fed back in as a
reference for a later job. That is the still→video handoff: build a frame in
`soul_cinematic` or `nano_banana_2`, then hand that frame to Seedance as the
look reference.

Video-to-video is essentially absent — **one** production shot uses a
`video_input`. They did not extend clips by feeding video back in.

---

## 7. What this means in one paragraph

ZEPHYR is a conventionally-produced film that happens to use generative
renderers. The story is written by people. The shots are broken down by people.
Continuity is enforced by a hand-built asset library and a strict citation
discipline in every prompt. The models render individual shots, with no
knowledge of each other, and the film is assembled somewhere off-platform. The
15-second limit never became a problem because nobody asked a single generation
to carry more than a shot.

The implications for Drape are in
[`implications-for-drape.md`](./implications-for-drape.md).
