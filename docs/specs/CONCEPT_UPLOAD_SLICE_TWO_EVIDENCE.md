# UPLOAD A CONCEPT — slice two's evidence pack and copy audit

**#185, founder-ordered 2026-08-28. Built by foreman-71, 2026-08-28 (AEST).**
Frames: `output/_shift185-slice2/`. Driven at the running app on dev, both
themes, with the flag ON and — through a response-level control — OFF.

His order, verbatim:

> *"the upload a person should be upload a concept or somthing like that
> probably a more relevant name anyway how i want it to work is if you have a
> model already or concept or image you can upload it the image analyzer will
> analyze and describe it to the authour and cast it with the description . it
> should only describe the person in the image not the lighting or background
> or framing nothing that contradicts our house locks. that way its easy for
> someone to upload an image and get a prompt to create someone similar without
> having to type it all out."*

Slice one (`076a8669`) built the door and left it with no surface. This is the
surface.

---

## 1. What a customer does now

Tap the card on the casting start page → pick a picture → about five seconds →
**a description of the person in it is in the brief box, focused, hers to
edit** → she casts it like any other brief. Nothing is charged, nothing is
rendered, and the picture is dropped the moment the describer answers.

**Driven end to end, not asserted.** One of our own delivered frames, through
the shipped card, at `http://localhost:3000/casting`:

| reading | value |
|---|---|
| wall clock, tap → words in the box | **5.4 s** (measured from the upload; the read had already started) |
| description length | **1,082 characters** |
| box height at rest | **19 px** — one line, unchanged from the `<input>` it replaces |
| box height holding the description | **75 px** — the four-line cap, then it scrolls |
| box focused afterwards | **yes** |
| the words | *"A man in his mid-to-late forties with a European heritage, presenting a rugged, athletic, ex-military or law-enforcement type… very short, cropped close to the scalp in a buzz cut, dark brown with light graying at the temples… light hazel-green eyes… no visible jewelry, makeup, or tattoos."* |

Not one word about the light, the set, the frame or the camera — that is slice
one's `NOT_ABOUT_THE_PERSON` sweep, and this drive is its first reading through
the real surface rather than through a script.

## 2. The frames

| file | surface | theme | state |
|---|---|---|---|
| `01-resting-light.png` | start page, whole | light | flag ON, box empty — **the resting state, and the reason the field swap is invisible** |
| `06-resting-dark.png` | hero | dark | flag ON, box empty |
| `02-filled-light.png` | start page, whole | light | flag ON, the description landed |
| `03-filled-dark.png` | start page, whole | dark | flag ON, the description landed |
| `07-live-dark.png` | entry cards | dark | flag ON — the live card beside its inert neighbour |
| `04-inert-dark.png` | entry cards | dark | **flag OFF** — what every account sees today |
| `05-inert-light.png` | entry cards | light | **flag OFF** |

**The OFF frames are a real control, not a re-render of the same thing.** The
config response was rewritten at the network layer (`conceptUploadEnabled:
true → false`) and the page re-read:

```
tag:          DIV            (not BUTTON)
class:        dpc-entry dpc-entry--inert
live buttons: 0
line:         "Reading a person out of a picture you already have is coming.
               For now, describe the person and cast them."
```

So the absent-or-live rule is measured at the DOM rather than argued from the
source: outside the scope there is no control to tap.

## 3. Copy audit — every user-visible string

The founder's UI contract (2026-08-01) classifies each as
**prototype-verified / adapted / invented**, and every one of these is
**invented**, because the prototype's card promised a different feature:

| string | class | why it says what it says |
|---|---|---|
| **"Upload a concept"** | invented — **his own rename**, verbatim from the order | The prototype's *"Upload a real person"* is a likeness promise. This road manufactures a TYPE. |
| **"A picture in, a description of the person out — straight into your brief to edit, so you can cast someone similar. We never keep the picture."** | invented | Two facts, both load-bearing. *Someone similar* is his own success test and the honest limit of the road. *We never keep the picture* is true by construction (no row, no table, no storage write) and a customer who learns it from the result has already been surprised once. |
| **"Reading a person out of a picture you already have is coming. For now, describe the person and cast them."** | invented, second clause **adapted** from the F5 placeholder | The retired line said *"Casting from your own photos is coming"* — a promise about likeness upload, which is still not built and is not what this is. The coming-state now names the capability that genuinely exists behind the flag. |
| **"Reading the picture…"** | invented | Present participle, on the card itself, in the slot the line occupies — no spinner chrome, no second surface. |
| **"That picture couldn't be read just now. Try again in a moment."** | invented | The fallback only. The door's own refusals ("I couldn't find a person in that picture — try one with someone in it.") are written for a reader and pass through untouched (`readableFailure`). |
| **"That file couldn't be read. Try another picture."** | invented | The BROWSER's read failing is a different problem from the door refusing, and it asks her to do a different thing. |

**The one claim the card must never make** — that it casts the person in the
picture — is asserted negatively in the suite over all three card strings
(`likeness`, `real person`, `your own photos`, `same face`), with the positive
control beside it (`similar` must appear).

## 4. The brief box became the brief box

The hero's field was still a single-line `<input>` — the exact defect
`BriefField` was written for, left behind on the start page when the sheet's
box was fixed:

> *"past about sixty characters the beginning of your own sentence scrolls out
> of the box, so the thing you are about to spend credits on cannot be checked
> before you spend them"* — `BriefField.tsx`

This is the box a **first** roll is typed into, and now the box a 1,082-character
description lands in. Same component, same four-line cap, and **the resting
state is identical** (19 px, one line — frames 01/06). Working law 7: the class,
not the instance.

Three things came with it, each driven:

- **Enter still casts; Shift+Enter is the new line.** Driven: typing
  `line one` ⇧⏎ `line two` leaves `"line one\nline two"` in the box, the height
  goes 19 → 38 px, and the page does not navigate.
- **The New-cast-member tile still focuses the box.** It used to find it with
  `querySelector('input[aria-label="Casting brief"]')` — a question about the
  element's TAG wearing the clothes of a question about the box, which would
  have gone silently dead on the line above. Driven with a before/after:
  `BODY → TEXTAREA[Casting brief]`.
- **A forwarded `ref` is MERGED, not passed through.** `{...rest}` is spread
  last, so a `ref` arriving in it would replace the internal one and the
  auto-grow would stop — silently, and only on the long briefs the component
  exists for.

## 5. The instrument was proved before its silence was believed

Four sabotages against `conceptUpload.test.ts`, each restoring in `finally`
(`scripts/_concept-slice2-sabotage-disposable.py`). Each reddens, and the arms
are independent — a different count fails each time:

| sabotage | suite |
|---|---|
| `briefWithDescription` replaces instead of appending | **3 failed** / 16 passed |
| the card ignores its door and is always live | **1 failed** / 18 passed |
| `BriefField` drops its internal ref | **1 failed** / 18 passed |
| the hero goes back to `<Input>` | **1 failed** / 18 passed |

## 6. What this does NOT change

- **No flag moves.** `CASTING_CONCEPT_UPLOAD_SCOPE` is `off` on production and
  stays `off`; the record in `productionFlagPositions.mts` is updated only to
  say the surface now exists. Every account still sees the coming-state card.
- **No new spend path.** House money, cents, one text call. No credits, no
  render, no segmenter read, no `assertFalBudget` arithmetic.
- **No new door.** Slice one's procedure is unchanged.
- **The likeness wall is untouched.** What reaches the engine is words, so
  `briefCompiler.ts` stands in front of a description exactly as in front of a
  brief she typed.

## 7. Still open — and it is HIS, not this slice's

Briefing edition 72's eye item asks whether **1,082 characters is the right
level of detail, or whether he wants a type rather than an inventory**. He has
not answered. That answer changes one instruction inside
`conceptDescribe.ts` and **nothing on this surface**: the card, the merge rule,
the field and the focus are the same at any description length, which is why
building the surface did not wait on it.

The flag flip does wait on it, and on his eye at these frames.
