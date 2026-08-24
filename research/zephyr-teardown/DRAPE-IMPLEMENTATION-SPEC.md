# Drape implementation spec — the film framework

> **STATUS: RESEARCH OUTPUT. NOT A BUILD TICKET. NOTHING HERE IS SCHEDULED OR
> STARTED.**
>
> This is the last document of the ZEPHYR teardown: the framework written down in
> the shape Drape would need it, so that whoever builds it later starts from a
> measured design instead of from the raw corpus. It proposes new capability and
> it touches a permanent product boundary (D-62), so **§11 lists what needs a
> founder ruling first**. No code has been written. No milestone exists.
>
> Read §12 as "the order this would sensibly go in", not as a plan of record.

Grounded in: the ZEPHYR teardown (23,810 job records, both productions) for what
the framework is, and the Drape code read on 2026-08-24 for what already exists —
`server/castingV2/recipeAssembler.ts`, `server/castingV2/referenceLibrary.ts`,
`server/castingV2/castViewPackage.ts`, `server/routes/characterSheet.ts`,
`docs/specs/DECISION_LOG.md`.

---

## 1. The architecture in one sentence

**A film is a list of shots; a shot is a sentence plus a set of scoped asset
references; and the backend's whole job is turning the user's sentence into that
reference set and the prose that goes with it.**

Everything ZEPHYR does by hand — pick the plates, write the glossary, scope each
reference, append the negative stack, lock the opening frame — is mechanical
given a good asset registry. That is the product.

---

## 2. What Drape already has, and how well it maps

This is the encouraging part. `recipeAssembler.ts`'s own docblock describes the
job almost exactly:

> *"This module turns a cast's reference library plus a set of asks into the
> exact list of references and word stacks one render sends. It is the single
> place those decisions are made, so there is no second list to drift from it."*

| ZEPHYR does this by hand | Drape already has |
|---|---|
| `<REF>` : **100% match** | `ReferenceRole = "carry"` — rides its minted crop, pixel-frozen |
| the reference being *edited* | `ReferenceRole = "anchor"` |
| a thing that is absent | `ReferenceRole = "vacancy"` |
| "one reference per thing" | **`slotTwiceReferenced` refusal** — fable-174, already law |
| naming the thing in words beside the picture | `StoredReference.noun` + `.words` |
| where on the frame it sits | `StoredReference.geometry` |
| the composite plate | `composeCharacterSheet` |
| a turnaround of one person | `CAST_PACKAGE_VIEWS`, six views |

**Drape's system is the same shape, one scale down.** It composes *features of
one person* (eyes, hair, ink). The film case composes *entities in a scene*
(people, places, props). The vocabulary widens; the machinery does not change.

D-244's "words change, crops carry" is the same rule ZEPHYR expresses as *"100%
match"* versus a described edit.

---

## 3. The gaps, named

1. **No scene-entity registry.** Drape has references *within a cast*. There is
   no object for "this location", "this prop", "this person in this outfit".
2. **No shot object.** Nothing represents a camera setup, its duration, its
   reference set, its opening frame.
3. **No composite plate for external engines.** The six views are six files;
   video engines take 3–6 attachments total.
4. **No negative-stack emitter.** Every one of ZEPHYR's 2,403 negative clauses
   is typed by hand, repeatedly.
5. **No blocking representation.** Nothing expresses where people stand.
6. **No audio lane.**

---

## 4. Data model

Four new objects. Names are indicative.

### 4.1 `SceneAsset` — the registry entry

The single most valuable thing to copy, and the thing ZEPHYR got 80% right.

```ts
type SceneAsset = {
  id: string;                    // DERIVED, never typed — see the naming note
  projectId: string;
  kind: "character" | "environment" | "prop" | "diagram";
  displayName: string;           // what the user typed
  plateKey: string;              // R2 key of the composite plate
  digest: string;                // byte identity, like StoredReference.digest

  // the words that ride beside the picture, every time
  description: string;           // "Asian female, 173cm, platinum hair…"
  permanentFeatures: string[];   // "dark curved horns — keep in every frame"
  knownDrift: string[];          // "BROWN eyes (never blue/green)"

  // what this asset is allowed to contribute
  defaultScope: string;          // per kind, see §5.2
  sourceCastId?: string;         // if minted from a Drape cast
  sourceGarmentId?: string;      // if a wardrobe state — see §11
};
```

⚠ **`id` is derived, never hand-typed.** ZEPHYR's registry already drifted —
`Sheet_MIRA` beside `Sheet_mira`, `zero_sheet` beside `Sheet_zero`. That is
working law 4 arriving in someone else's data, and it costs nothing to prevent
now and cannot be retrofitted. Derive from `(projectId, kind, slug(displayName))`
and reject a collision at write.

### 4.2 `Shot`

```ts
type Shot = {
  id: string;
  sceneId: string;
  order: number;

  intent: string;                // the user's sentence, verbatim
  durationSeconds: number;       // 4–15 today; the engine's cap is authoritative

  references: ShotReference[];   // ≤ 6, see §5
  openingFrame: OpeningFrame;    // §7.1 — always specified
  ending: "hold" | "button";     // §7.2 — never a match
  camera: CameraSpec;            // §6
  beats?: { fromSec: number; toSec: number; action: string }[];
  dialogue?: { speaker: string; line: string; delivery: string }[];
  audio: AudioSpec;              // §8
};

type ShotReference = {
  assetId: string;
  scope: string;                 // overrides the asset's defaultScope
  overrides?: { feature: string; state: string; reason: string }[];
};
```

`reason` on an override is required, not decorative. ZEPHYR's own: *"NO horns in
this scene (**omit the horns entirely, for continuity with the burger-story
shots**)"*. The reason is what stops the next person undoing it.

### 4.3 `StyleProfile` — one per project, not per shot

ZEPHYR's most-repeated clause ran **1,958 times unchanged**. It is configuration,
not authoring.

```ts
type StyleProfile = {
  look: string;          // "8K, photorealism, real organic film grain and halation"
  operatingStyle: string;// "Hoyte van Hoytema naturalism: intimate ultra-handheld…"
  lighting: string;
  colourDoctrine: string;// "~70% desaturated green-grey; ~20% warm amber; ~10% cool blue"
  texture: string;
  optics: string;        // "large-format 65mm spherical prime, 180° shutter…"
  skin: string;
  physics: string;
  acting: string;
  negatives: NegativeStack;  // §5.3
};
```

### 4.4 `BlockingDiagram`

A generated top-down of an `environment` asset, annotated with a marker per
character (position + facing) and a camera cone. Stored as a `diagram` asset
whose `defaultScope` is fixed to **`"layout only, overlays never drawn"`**.

---

## 5. The prompt assembler

Extends `recipeAssembler`'s contract to scene entities. Emits in this order.

### 5.1 Block order

```
1. StyleProfile           (from config, unchanged between shots)
2. Asset glossary         (one line per reference: noun + description)
3. Scope per reference    (what it contributes / must not)
4. Opening frame          (§7.1)
5. Action + beats
6. Dialogue with delivery
7. Audio block            (§8)
8. Negative stack         (§5.3)
9. Technical tail         (format, duration, grain)
```

### 5.2 Default scope per kind

Drawn from the measured corpus, not invented:

| Kind | Default scope | Corpus runs |
|---|---|---:|
| `character` | `100% match` | 920 |
| `environment` | `location AND lighting` | 297 |
| `prop` | *(per-beat state — must be authored)* | — |
| `diagram` | `layout only, overlays never drawn` | 531 |

Plus the exclusion pattern for any reference contributing only part of itself:

> *"interior only — **do not use a single pixel of the background from this input
> image**"*

**A `prop` with no authored scope is a refusal, not a default.** ZEPHYR's glass
carries a different state every beat (*"HERE: Zero is mid-sip when she chokes"*);
a prop attached with no state is the caller forgetting to say what it's doing.

### 5.3 The negative stack, emitted automatically

This is the highest-leverage, lowest-risk piece of the whole spec. Composed from
the ranked corpus (`PROMPT-TECHNIQUE-REFERENCE.md` §13):

```ts
const NEGATIVE_STACK = {
  render:  "NOT a 3D render, NOT a game engine, NOT game-cutscene aesthetic, NOT a cartoon",
  skin:    "no smoothing, no retouching, NOT waxy/plastic/airbrushed/CGI/doll, skin matte, does not shine",
  face:    "no frozen mask-face, no dead eyes",
  optics:  "no artificial flares, no anamorphic streaks, NO barrel/fisheye distortion, NO vignette",
  motion:  "no flicker, no warping, no morphing",
  text:    "no subtitles, no on-screen text or watermarks",
  audio:   "NO MUSIC",           // 2,487 runs — the most-repeated instruction in the corpus
  grade:   "no HDR, no glow, no tone mapping",
};
```

Toggleable per `StyleProfile`, because the two productions disagree on
`slow-motion` and `anamorphic`. **Read that list as a design brief**: nearly
every line is a model default failure suppressed by hand, thirteen people, over
and over.

### 5.4 Refusals to inherit

`recipeAssembler` already refuses rather than repairs. Extend the same
discipline:

- `slotTwiceReferenced` → **two assets claiming one role in one shot**
- `emptyWordStack` → **an asset attached with no description**
- new: `propWithoutState`, `referenceCountExceeded`, `assetDigestMoved`
  (the plate's bytes changed since the shot was authored — the same check the
  ink road already makes)

---

## 6. Camera

`CameraSpec` should express what the corpus actually says, which is more than
"85mm":

```ts
type CameraSpec = {
  size: "BCU" | "CU" | "MCU" | "MEDIUM" | "WIDE" | "TWO-SHOT" | "WAIST-UP" | "FULL";
  angle?: "low" | "high" | "eye" | "top-down" | "three-quarter" | "profile";
  fovDegrees?: number;          // they specify FOV, not focal length
  handheld: 0 | 1 | 2 | 3 | 4;  // the graded scale, §6.1
  move?: "static" | "push-in" | "pull-back" | "orbit" | "arc" | "roam" | "spin";
  moveScale?: "micro" | "slow" | "energetic";
  offCentre: boolean;           // default TRUE — "never centred", 292 runs
};
```

### 6.1 The handheld scale, verbatim from the corpus

| Level | Emitted phrase |
|---:|---|
| 0 | `locked off, not moving, only the faint natural micro-jitter of a held camera` |
| 1 | `handheld, gentle, faint micro-jitter` |
| 2 | `alive with operator breath, hand tremor, micro weight-shifts and small reframes` |
| 3 | `energetic handheld, intentional moves between subjects, quick zoom/push-ins` |
| 4 | `intense handheld, violent shake, never still` |

**Always append the authenticity negative** — this is the one nobody guesses:

> `No locked-off tripod shots, no gimbal float, no digital jitter.`

**And always disambiguate move from time:** `SLOW PUSH-IN (dolly), not slow-mo`.

**Coverage variation.** When a scene emits several shots of different people at
the same size, vary the move per subject, as they do — *"MIRA (operator: slow
orbit) / HARU (slow push-in) / ZERO (low push-in) / NAOMI (slow arc)"*.
Otherwise coverage reads as repetitive.

---

## 7. The shot contract — heads, tails, cuts

**The most important section, and the least obvious.** Measured across 13,991
video jobs: they never match one generation's end to the next one's start.

### 7.1 The opening is always specified

```ts
type OpeningFrame = {
  subject: string;
  x: number; y: number;          // percentages — "at ~35%x/55%y"
  posture: string;
  eyeline: "to camera" | "off-left" | "off-right" | "down" | "up" | "at <asset>";
  background: string;
};
```

Emitted as: *"First frame on `<subject>` at ~35%x/55%y, leaning forward over her
knees, eyes huge; sofa group soft behind her."*

### 7.2 The ending is a hold, never a match

Two allowed values, both from the corpus: **`hold`** (*"holds on Zero"*, 1,144
runs) and **`button`** (*"CU on Jasmin → loose WIDE button"*, 131 runs).

**Frame-matched handoffs are explicitly out of scope, and the reason is
rerolls.** A shot is re-pulled a median of five times. Anything depending on the
exact end state of the previous take breaks on every reroll. A held tail can be
cut at any frame; a matched tail can be cut at one.

### 7.3 Continuity across the cut carries in three channels, none of them pixels

| Channel | Emitted |
|---|---|
| **Screen direction** | `off-screen-left` / `off-screen-right`, derived from the blocking diagram so every eyeline agrees |
| **Sound** | `<speaker>'s voice continues off-screen`; continuous `room tone` under every shot in a scene |
| **Light** | inherited from the `environment` asset, `consistent light` |

The join itself is a **hard cut**. 2,083 hard-cut instructions in the corpus
against 30 match-cuts. A hard cut is the only join that cannot drift.

---

## 8. Audio

```ts
type AudioSpec =
  | { mode: "foley"; items: string[] }               // default
  | { mode: "anchor"; clipId: string; bpm?: number;
      audible: boolean; performance: string };
```

- **`foley`** is the default: an itemised list in shot order, plus `NO MUSIC`.
- **`anchor`** attaches a clip. ZEPHYR's anchors are ~14s mono clips *generated
  by the platform and fed back in* — one drove 716 generations. When
  `audible: false`, emit *"the track is NOT audible / NOT present in the mix;
  they perform in time as if the (unheard) `<bpm>` BPM track is playing."*
- Dialogue is **written, never attached**, in screenplay form:
  `Haru (high, excited, childlike): "…"`.

---

## 9. Asset minting

Every asset type has a measured recipe. These are the prompts, not descriptions
of them.

| Asset | Recipe |
|---|---|
| **Character plate** | *"Character reference sheet of the character shown in `<identity>`, wearing the outfit/clothing from `<outfit>`"* — person × outfit, one step |
| | Layout: `Left frame: full-body shot` + `Right frame: close-up portrait of the face`, `head-to-toe, no cropping`, neutral seamless ground |
| **Prop** | *"realistic item asset `<noun>`"*, plain white ground |
| **Environment** | FOREGROUND / MIDGROUND / BACKGROUND as literal headers, named objects not adjectives, opened with a negative (*"No humans, no silhouettes, no living beings"*) |
| **Blocking diagram** | *"exact top-down view of `<environment>`, keep positions of all items"*, then annotate markers + camera cone |

⚠ **Whether Drape's plates carry a text block is NOT decided here.** Drape's
sheet is textless by founder ruling (`4994e953`); ZEPHYR's carry text and ship.
The question is filed with a runnable design at
[`OPEN_TEST_baked-text-on-references.md`](./OPEN_TEST_baked-text-on-references.md)
and is deferred at the founder's instruction.

---

## 10. The economics

**This is the hardest product problem and it should not be designed around
quietly.**

- A finished shot cost a **median of 5 attempts**; the crude project ratio was
  36.6:1.
- Three independent measurements say better prompting does **not** reduce the
  attempt count: scoped prompts show no reroll advantage, the learning curve is
  flat over two weeks, and feeding a generated still back in does not help.
- A reroll is an **identical re-submit** — 1,053 prompts kept an identical
  reference set against 70 that varied it. It is sampling, not iteration.

**So the backend must absorb the volume rather than engineer it away.** Buy N
takes, show the user a small number of good ones, and price it. Designing on the
hope that a smarter assembler converges faster is building on a premise this
corpus does not support.

**On Seedance 3.0 (30s):** the framework transfers — none of §4–§9 depends on
clip length, and multi-cut scene documents stop being a compression trick. The
cautions are that per-attempt cost rises while the attempt count does not fall,
and that rejecting a 30-second take discards 30 seconds. Recommendation: keep
shooting short; spend the length only on genuinely continuous action.

---

## 11. Founder gates — nothing below is decided

1. **D-62.** `DECISION_LOG.md:652`: *"Casting defines the reusable
   person/character sheet; **Wardrobe and Canvas own outfits**. Temporary
   iteration references are not persistent plates."* A `SceneAsset` of kind
   `character` in a specific outfit is a persistent per-state plate. **Where it
   lives — Casting, Wardrobe, or a new Film domain — is a founder fork**, and
   §9's person × outfit mint is exactly the Casting↔Wardrobe composition step
   the boundary implies must exist.
   Sharpening it rather than softening it: a state plate carries **body** state
   too, not just clothing — ZEPHYR's `Zero_home` and `Sheet_zero` differ in
   *horns*, which is a Casting-owned feature.
2. **New capability.** Shots, scenes and an edit list are a new product surface,
   not an extension of refine. It needs its own gate.
3. **Credit model.** §10 has real cost implications.
4. **Baked text on plates** — deferred, see §9.
5. **Adjacent live thread:** `CASTING_TWO_PATHS_SCOPE` (`path` / `wardrobeLine`
   on the cast, `users:1` since 2026-08-24) is the nearest existing work.

---

## 12. The order this would sensibly go in

**Not a plan — nobody has approved or scheduled any of it.** Recorded because
the dependency order is a research finding in its own right: each step is
independently useful and independently abandonable.

| # | Step | Useful alone? |
|---|---|---|
| 1 | **Negative-stack emitter** on existing refine prompts | Yes — pure quality, no new surface, no schema |
| 2 | **Composite plate** from `CAST_PACKAGE_VIEWS` via `composeCharacterSheet` | Yes — one attachment instead of six for any external engine |
| 3 | `SceneAsset` registry + derived ids | Foundation |
| 4 | Prompt assembler extension (§5) | Foundation |
| 5 | `Shot` object + opening/ending contract (§7) | First real film surface |
| 6 | Blocking diagram mint + screen-direction derivation | Multi-character scenes |
| 7 | Audio lane (§8) | Dialogue and music |

If any of this is ever picked up, **1 and 2 are the cheap ones**: both are
contained, both improve work Drape already does today, and neither needs a
founder ruling on boundaries. Everything from 3 onward is the film capability
proper and is gated by §11.

---

## 13. What would prove it works

Not "the prompts look right" — that is the failure mode this repo has a law
about. Proposed acceptance, per working law 2 (a checker that cannot fail proves
nothing):

- **Negative-stack emitter:** a controlled pair — same ask with and without the
  stack, N ≥ 12 each, frames judged by eye. If the stack changes nothing
  visible, it is cargo cult and should be dropped.
- **Composite plate:** identity fidelity of a six-file reference set versus one
  composite, same shot prompt, same N.
- **Assembler:** a golden-file test that a known scene emits the exact expected
  prompt — the assembler is deterministic, so this is cheap and catches drift.
- **Shot contract:** generate a three-shot scene, cut it, and look. Screen
  direction consistent? Room tone continuous? That is an eyes test, not a metric
  (law 9).
- **The honest bar:** measure attempts-to-keeper against ZEPHYR's median of 5.
  If Drape's assembly does not beat a hand-written prompt, the value is in
  *removing labour*, not in *improving output* — and the product should say so
  rather than claim otherwise.
