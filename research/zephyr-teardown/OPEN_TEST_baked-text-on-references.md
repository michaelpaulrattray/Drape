# OPEN TEST — does baked-in text on a reference plate leak into the render?

**Status:** filed, not run. Founder-acknowledged as important (2026-08-24).
**Cost estimate:** small — a few dollars of image generations, no Drape credits.
**Blocks:** any decision to put labels on a Drape character sheet, and the
composite-plate work in [`implications-for-drape.md`](./implications-for-drape.md).

---

## Why this matters

> ⚠ **This is a FOUNDER RULING, not an engineering preference.** `4994e953`,
> verbatim: *"The law was applied to the engine-facing rendering only; **the
> founder extended it to the export**, and the reasoning is the same one step
> removed."* Nothing here proposes changing it. This test exists so that if it is
> ever revisited, it is revisited on evidence — and that is his call to make.

**Drape's rule** (`server/routes/characterSheet.ts:39`, verbatim):

> *"It carries no text: labels never bake into pixels anywhere, because the
> export is exactly what gets fed to external engines and those reproduce
> whatever letters they see. Labels are page-rendered UI in the room, over the
> image."*

**The rule is tested — for compliance, not for its premise.** This distinction is
the whole reason the test is worth filing.
`server/castingV2/characterSheet.test.ts` proves Drape *obeys* the rule, and
proves it well: *"No label band anywhere"* (line 97), and *"never draws a label,
whatever the label says"* (line 191) driven with a hostile string. Those are good
tests of the implementation.

**None of them tests whether text on a reference actually harms a render.** That
premise — *engines reproduce whatever letters they see* — has never been driven.
A green suite here means the sheet is textless, not that textlessness is
necessary.

**There is real supporting evidence for the premise, and it should be weighed.**
The M3 §4.2 incident (`server/castingV2/briefCompiler.test.ts`): the interpreter
invented *"a handyman holding a mug reading 'World's Okayest Handyman'"* and **the
mug's text overrode the framing block's own "no text, no logos" rule.** Text
propagated and beat a constraint written to stop it. That is text arriving via
the *prompt* rather than via a *reference image*, so it is adjacent rather than
identical — but it is a point on the same board and the founder's extension was
not made in a vacuum.

**And ZEPHYR does the opposite and shipped a film.** Every reference plate opened
in this research carries text burnt into the pixels — `Name: ZERO / Height: 173
cm / Voice: calm, measured, confident / Character: calm, spontaneous (awkward
poses)…` — and those exact files are the attachments on finished production
shots. See [`data/reference-samples/`](./data/reference-samples/).

So: a founder ruling, supported by an adjacent measurement, against a large body
of contrary practice in another shop. **That is a good reason to measure the
specific case rather than to assume either side.**

The stake is not academic. If baked text is safe, a Drape sheet can carry the
identity block ZEPHYR carries — name, height, and the visible attributes — which
is the belt-and-braces that makes their references work when the picture alone
reads weakly. If it is unsafe, the current rule stands and the composite plate
must keep labels as page-rendered UI.

---

## The question, stated so it can be answered wrong

> When a reference plate carries legible text, does the delivered frame contain
> lettering it would not otherwise have contained?

Note the phrasing. Not *"does text appear"* — engines emit spurious lettering on
their own. The question is about the **difference the plate makes**, which means
the no-text arm is not optional.

---

## Design

Four arms. Everything identical except the plate.

| Arm | Plate | Purpose |
|---|---|---|
| **A — negative control** | Composite plate, **no text at all** | Establishes the **base rate of spurious lettering**. Without this number, any text in arm B is unattributable. |
| **B — the real question** | Same plate + a ZEPHYR-style label block (name, height, one attribute line), same size and placement they use | The condition under test. |
| **C — positive control** | Same plate + **deliberately large, high-contrast text** across it | Proves the instrument can detect leakage **at all**. If C does not leak, the test measured nothing and A/B are uninterpretable. |
| **D — semantic control** | Same plate + a label block of **human-only metadata** (`Voice: calm, measured`) with no visible referent | Separates "the engine copies letters" from "the engine renders what the words describe". ZEPHYR's sheets carry exactly this kind of unusable text. |

**Controls are the point.** Per working law 2, a checker that cannot fail proves
nothing — arm C is what makes a clean result in B mean something. Per the
negative-arm lesson, arm A is what stops a spurious hit in B being read as a leak.

### Holding everything else still

- One cast, one shot prompt, one seed policy, one engine, one aspect ratio.
- The four plates differ **only** in the text layer. Same underlying pixels
  beneath it — composite the text on, do not re-render the plate.
- **N ≥ 12 per arm.** This measures a *rate*, not an anecdote. ZEPHYR's own data
  says a single generation is a coin flip: median 5 attempts before a keeper, and
  rerolls are identical re-submits, so one render per arm would be sampling noise
  wearing a verdict's clothes.

### Pre-registered bar — write it down before running

Fix these before any frame exists, so the bar cannot move to meet the result:

- **Leak** = any legible glyph in the delivered frame that traces to the plate's
  text layer (same string, or a corruption of it).
- **The finding is "text leaks"** if arm B's leak rate exceeds arm A's by a
  margin that survives the arm sizes. State the margin now, not after.
- **The test is void** if arm C does not leak — the instrument could not see the
  thing it was built to see.

### Who judges

**The founder's eyes, on the frames** — law 9, and not negotiable here. A vision
reader may point at candidate frames to look at; it does not return the verdict.
Frames go in front of him and the report quotes what was seen.

---

## What to do with each outcome

| Result | Consequence |
|---|---|
| B ≈ A, C leaks | The premise is **narrower than the rule**. This does not change anything by itself — it is material to put in front of the founder, since the extension to the export was his. |
| B > A, C leaks | **The ruling is right and now proven.** Record the measurement in the docblock so the next seat does not re-litigate it from first principles. This is a good outcome: a ruling that gains evidence. |
| C does not leak | **Void.** The instrument is blind; redesign before believing anything from A, B or D. |
| D leaks visibly (a rendered person looking "calm, measured") | Separate finding, arguably the most interesting: the plate's words are acting as a **prompt**, not merely as pixels. That would change what belongs on a sheet regardless of the lettering answer — and it would be the reference-image sibling of the M3 mug incident. |

**In no outcome does this test change the sheet on its own.** It produces
evidence; the ruling is the founder's.

---

## Specimen raising arm D's stakes (founder, 2026-08-24)

A REINA sheet from the studio's projects carries, baked into its text block
beside the facts and the voice line, a **render directive**:

> *"Photorealistic, soft studio lighting, minimal style, unusual and quirky
> appearance."*

So the baked text is three kinds of writing — facts ("Height: 183 cm"),
performance ("Voice: low, arrogant, aristocratic, slightly velvety, sensual"),
and **style instructions**. These sheets are imported as Elements whole, so if
the engine reads baked text, every `@Reina` attach ships a stowaway prompt
inside the pixels — the sheet would be a **dual-channel asset** (picture +
prompt), and their consistency may partly ride on it. Arm D is the arm that
decides this, and this specimen is why its answer matters beyond lettering
leakage.

## Maker verdict, logged 2026-08-24 (evidence, not a measurement)

The Episode 1 project brief, in the studio's own words: *"those little
descriptions under the detail are **almost useless for the video generation**,
because you still have to describe the whole weapon operation process in the
prompt."* The makers themselves say baked annotations do not function as
prompts for the video engine — while still shipping sheets with text on them.
Practitioner testimony for the D-adjacent question; the controlled pairs above
remain the test.

## Related open question, same sitting

ZEPHYR's plates carry `Voice:` and `Character:` lines — information an image
model cannot draw. Two readings, and arm D distinguishes them:

1. The text is **for the humans** writing prompts, and the engine ignores it
   harmlessly.
2. The text is **doing work** — conditioning the render toward a demeanour.

If (2), the sheet is not merely a picture; it is a picture carrying a prompt, and
that is a different artifact from the one Drape currently builds.

---

## Filing note — and the risk that this rots

Filed here because the research produced it. **The place it needs to be found is
the docblock at `server/routes/characterSheet.ts:39`**, which states the
untested premise, and secondarily `server/castingV2/characterSheet.ts:221`.
Whoever next touches the no-text rule should meet a pointer to this file there.

**That pointer is not yet added.** A second agent was working the codebase when
this was written, so no production file was edited. It is a one-line comment and
it is the difference between a filed test and a lost one — a finding parked where
nobody re-opens it is a finding lost.

Correcting the record while filing: an earlier draft of this document said the
rule was *"an argument, not a measurement"* and that *"no test in the repo drives
it"*. Both were wrong in the direction that matters — it is a **founder ruling**,
it **is** tested for compliance, and there **is** adjacent evidence for its
premise in the M3 mug incident. What is genuinely untested is narrower and
stated above.
