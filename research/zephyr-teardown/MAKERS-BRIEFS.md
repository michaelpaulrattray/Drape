# The makers' own briefs — struggles, lessons, and the pipeline in their words

Captured 2026-08-24 from the three project pages (each carries a "Project
brief" written by the studio). The founder asked whether the research had read
these; it had not — the record-mining went straight past the prose. They turn
out to be the most important documents of the whole research: the studio's own
post-mortems, and the reveal of **how the prompts were actually written**.

---

## The headline: the prompts were written by Claude, running skills

From the Adiliada brief, verbatim:

> **"The tools.**
> **Seedance**: every shot, all the video, all the generations.
> **Claude + skills.** A skill is a playbook of rules that Claude loads and
> works by. They have two: an **acting system** and **CINEDANCE, the
> video-prompt writer**. The acting system decides what exactly I play in a
> shot.
> **Diagram Skill.** In shots with several of us in frame, text alone won't
> hold the staging. The skill turns a frame into a schematic color-coded
> diagram, and Seedance reads exact positions, poses and facing directions off
> it.
> **Depth map.** A depth map is a black-and-white image… the model reads it as
> the depth skeleton of the scene… Without it the space drifts."

**Consequences for this research:**
- The corpus we mined is substantially **machine-authored** — which is why the
  jagan96-era schema is so uniform. We were reverse-engineering skill outputs.
- The founder's plan (*"turn it into skills for Claude"*) is not an idea — it
  is **the proven production pipeline of the studio we studied.**
- CINEDANCE's block order, published by them, validates the mined structure:

> *"Every shot is written by the CINEDANCE skill in the same blocks, in the
> same order: SCENE CONTEXT / ACTIVE REFERENCES / LOCATION MAP / GAZE-EYELINES
> / FIRST FRAME AND BLOCKING / SEGMENTS (timed beats) / DIALOGUE / AUDIO /
> PHYSICS / LIGHTING / STYLE-FORMAT / POSITIVE LOCKS"*

- **Depth maps** are a tool we never spotted in the records — a scene's "depth
  skeleton" attached to hold 3D space. (Some of the unexplained reference
  attachments are likely these.)

---

## The Episode 1 brief (ZEPHYR) — the design-phase lessons

**Personalities first.** *"First and foremost, we fleshed out their
personalities and looks… Knowing your characters makes it much easier to
write their acting performance, reactions, and potential story arcs. Take the
time to do this, and everything down the line will be much smoother."* (They
also note the foundational layer can come from *"brainstorming with the
Higgsfield Supercomputer or Claude."*)

**Toolchain attribution, their words:** characters and costumes born in Soul 2
(*"the best way to get a photo-realistic, lifelike character"*; *"unmatched
fashion capabilities"*), sheets then *"polished… using Nano Banana 2 Pro and
Seedream to compile them into final assets."* Matches the asset-factory
finding, with the division of labour confirmed.

**THE MECHA-SHEET FAILURE — their hardest-won lesson, and the general law
behind half our findings:**

> *"At first, we created sheets that specified and showed everything —
> descriptions of their weapons, how the cockpit opening mechanism worked…
> However, the model's generation rules don't quite work that way — **if it
> sees a detail, it will try to show it.** …the model prioritized the detail
> of the open hatch over the standard look of the mecha… **most generations
> failed**… Because of this, **we erased that mecha state from all character
> sheets** and became more cautious with retractable parts… **we recommend
> taking the extra step to create multiple character sheets for different
> scenarios, even if the differences seem minor**… upload a sheet with
> extended weapons only when it actually exists in the scene. Better yet,
> upload a close-up of the weapon as a separate input."*

**A reference is a demand, not a menu.** Everything visible on a sheet fights
to appear. This is the unifying principle behind the one-face rule, the
headless bodies, the per-state sheets, and DUAL REFERENCE — stated by the
makers as the lesson that cost them the most failed generations.

**And their verdict on baked-in annotations** (direct evidence for the
deferred baked-text test):

> *"By the way, **those little descriptions under the detail are almost
> useless for the video generation**, because you still have to describe the
> whole weapon operation process in the prompt. A model won't act like 'I got
> you! Retractable revolver in the arm! I know how to show it off…' — be
> prepared to think through and describe such subtle things."*

A practitioner verdict, not a controlled measurement — but it is the makers
themselves saying the baked text does NOT function as a prompt for the video
engine (at least for operational descriptions).

**Self-assessment:** *"Team Zephyr's main strength lies in **planning,
teamwork, and structuring the story through editing**. These are fundamental
skills in traditional filmmaking as well."* And on Episode 1's roughness:
*"Seedance 2.0 had just come out. We were experimenting heavily and **hadn't
yet established an efficient fixed pipeline or a unified style prefix**"* —
confirming the film1 → Special evolution the research measured.

**Design-lore coupling:** each mech expresses its pilot (*"Naomi is the most
selfless and caring member, so her mecha is a modified cargo robot, armed
primarily with hooks, cables, and a fire extinguisher"*). Costume logic serves
audience recognition (*"in the first musical segment the heroines stay in
their standard battle gear because the audience hasn't yet learned to tell
them apart by facial features alone"*).

---

## The Special brief — the impossible shots

**The inverted character sheet** (confirming the pose-plate finding, with the
general principle attached):

> *"Her mech is trapped upside down… At first, we tried tackling this purely
> through precise prompting, but the results fell short. Eventually, one of
> the geniuses on our team came up with a counterintuitive solution: **change
> the input.** We inverted the character sheet. **By baking the required
> physics directly into the input stage, we guided the model through the
> generation process. This freed us to prompt more casually**… Now, Naomi has
> a new 'inverted' state :D"*

**When prompting fails, change the input.** Bake the desired state into the
reference; the prompt then relaxes.

**Layout images as positional guides — with a nuance the records could not
show:** *"We solved this using reference layout images. **We didn't feed them
as direct shot inputs**, but rather used them as a positional guide… its core
relies on something more crucial: **knowing exactly what you want and
pre-choreographing the action.**"* So the blocking diagram is sometimes
attached (the burger scene's 52 jobs) and sometimes used only by the humans
writing the prompt.

**Loosening as a deliberate technique:** *"Here, we opted for **less strict
prompting and gave the model more creative control, dictating only key anchor
points**… The result was a series of strikingly consistent sequences that
preserved object placement from take to take while offering fluid variation in
camera motion and angles. From there, we simply edited together the most
cinematic cuts."* Strictness is a dial: tight when physics is at risk, loose
when variation is the harvest.

**Structure:** *"All three of these complex shots belong to a single sequence,
set in one location, but **distributed throughout the narrative edit** to
build tension… design a standout scene and build the surrounding edit toward
that culmination."*

**Openness:** *"In the attached project file, you will find all of our assets,
**including bloopers/failed takes** alongside the final cuts… All prompts are
open-sourced."* And a promised *"comprehensive video breakdown… character
development, spatial consistency, dialogue setups"* — worth watching for.

---

## The Adiliada brief — the mature pipeline, end to end

**The face is never regenerated — sacred pixels.** The deepest principle in
any of the three briefs:

> *"Soul Cinema makes the face: **always generated in close-up, so the model
> captures the identity at maximum detail. That close-up face is the anchor
> every following asset of the character is checked against.** Soul 2.0 then
> builds the looks… Then both passes are assembled into the character sheet in
> Seedream / Nano Banana / ChatGPT, with one hard condition: **the original
> close-up portrait stays untouched. It never runs through a model again; the
> assembly happens in editing tools around it.** Every detail that changes
> between states goes in point by point, with masks, without touching the
> base… **The base image stays the same pixels.**"*

And across universes: *"an alternate version of the character is built from
the same base face… **the face stays the same set of pixels. Which is why in
any world Adil reads as Adil, even when he's the villain there.**"*

This is the one-face rule at its true depth: not just one face per sheet —
**the same literal pixels on every sheet, every state, every universe.**
Identity is a byte-level constant; everything else is masked edits around it.

**Assets are text+image pairs:** *"An asset is a pair: text plus image. The
text descriptor goes into every prompt **word for word**; the image is the
reference the model anchors to."*

**Visual anchors planted in locations:** *"the chair a character sits in, the
window two of them talk by"* — objects placed to hold scenes consistent
across generations.

**Every prompt is an island:** *"Seedance only sees the text in front of it,
so every prompt is an island: positions, poses, wardrobe, props, optics,
light, all spelled out from scratch, every single time. **'Same as the
previous shot' is an instruction to a model that has no 'before'.**"*

**Development discipline:** *"On an AI film **a weak scene costs real money:
you find out it doesn't work only after you've generated it.** So before
anything is generated, the team writes every scene out in terms of drama…
what the event is, what the character wants, where the turn happens"* — then
a storyboard, where *"it becomes clear how good a scene really is, as opposed
to how good it was in our heads."*

**Post-production has a named QC stage:** assembly → rough cut →
**"generation supervision"** (*"regenerating broken shots, clearing out AI
slop"*) → fine cut → picture lock (*"after lock there are no new
generations"*) → cleanup, colour (*"every generation arrives with its own
grade baked in, so the colorist's job is unification"*), sound.

**Their five conclusions, verbatim:**

> *"**Assets first.** Not a single shot until every character, location and
> prop is built, named and locked.
> **Describe everything, every time.** The model has no memory.
> **Hold the face, change everything else.** A new universe is a new look, not
> a new person. The base is never touched.
> **Say what you want, not what you're avoiding.** The words you write are the
> words you summon, including the ones sitting inside a 'no'.
> **Direct, don't describe.** The scene event, the motive, the goal, the
> obstacle, the tactic. **Directing is the one part the model still won't
> invent for you.**"*

⚠ **"Say what you want, not what you're avoiding" refines our negative-stack
finding.** Their prompts DO carry heavy negatives — but the mature practice
splits them: failure-mode bans live in the **dedicated negative field** (where
they cannot summon), while the prompt body trends positive, because *"the
words you write are the words you summon, including the ones sitting inside a
'no'."* The negative stack stands; where it lives matters.

---

## Scorecard: the research against their own account

| Their words | Our finding | Verdict |
|---|---|---|
| "Every prompt is an island… no 'before'" | No chaining, 0 of 23,809 jobs | **Confirmed** |
| CINEDANCE's 12-block order | The mined prompt skeleton | **Confirmed, near-exactly** |
| "If it sees a detail, it will try to show it" | One-face rule, per-state sheets, reference scoping | **Confirmed — and unified under their general law** |
| Inverted character sheet | The pose-plate finding | **Confirmed, with the principle: change the input when prompting fails** |
| Face assembled around untouched pixels | One face per sheet | **Deepened — same literal pixels everywhere** |
| Diagram Skill / color-coded staging | `Home_Scheme` blocking diagram | **Confirmed — and it is skill-generated** |
| "Almost useless" sheet annotations | Baked-text open test | **Maker verdict logged as evidence** |
| "Say what you want" | The negative stack | **Refined — bans belong in the negative field, prompt body positive** |
| Claude + skills wrote the prompts | (not visible in records) | **New — and it is the founder's plan, already proven** |
| Depth maps as spatial skeleton | (never spotted) | **New tool** |
| Generation supervision, picture lock, grade unification | (post was invisible to records) | **New — the post pipeline** |
