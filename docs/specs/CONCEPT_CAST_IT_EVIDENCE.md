# CAST IT FROM THE CONCEPT MODAL, AND TWO WAYS IN — evidence pack and copy audit

**#196's two amendments. Built by foreman-77, 2026-08-28 (AEST), PR #199.**
Frames: `output/_shift196b/`. Driven at the running app on dev, both entrances,
both themes, with real describer reads. Readings: `output/_shift196b/drive.txt`.

His two amendments, verbatim, both filed as comments on #196 **before** PR #197
merged without them:

> *"the button should be cast it and it automatically casts the prompt the same
> flow the original prompt and casting takes just through the modal"*

> *"i want to be able to drag and drop the image into the upload concept card and
> it will auto open up the modal with the reference image in it alternatively i
> can click the card and it opens up the modal and then i can upload or drag and
> drop the reference image in - it gets analyzed - i read the brief decide
> whether to edit it and cast"*

PR #197 built the review modal to the ORIGINAL spec: click → OS picker → modal →
*Use this brief* → the brief box. This is the two amendments.

---

## 1. What a customer does now

**Drop** a picture on the *Upload a concept* card → the dialog opens **with her
picture already in it** and the read running → the description arrives beside the
photograph, editable → **Cast it** goes straight to the sheet. **Tap** the card
instead → the dialog opens **empty** on a drop zone with a picker in it, and the
same road continues from there.

---

## 2. The drive — 30 checks, 0 failing

Every check records what it SAW (D-235). `scripts/_drive196b-disposable.mts`.

### Entrance 1 — the drop IS the upload

| reading | value |
|---|---|
| card at rest | *"A picture in, a description of the person out — yours to read and edit before you cast…"* |
| card with a file over it | `.dpc-entry--drop` + *"Drop it here — we'll read it straight away."* |
| drop → dialog on screen **with the picture in it** | **346 ms**, portrait `src` is a `blob:` handle |
| the way out, during the read | **"Cancel"** (it is "Discard" once there are words) |
| focus on mount | `activeElement` = **Cancel** — inside the card |
| words beside the photograph | **280 characters in 11.3 s** |
| the primary | **"Cast it"** |
| the cost row | **`280 characters` … `~ 160 credits`** |
| price inside the button | **no digit in it** (D-109) |
| the action row | `["Discard", "Use this brief", "Cast it"]` |

### Entrance 2 — the tap, and the empty state

| reading | value |
|---|---|
| heading | **"Start from a picture"** (never "This is what we'll cast" — there is nothing to cast) |
| the portrait slot | the drop zone, *"Drop a picture here"* |
| the primary | **"Choose a picture"** |
| description field | **absent** |
| cost row | **empty** — no price on a dialog that cannot yet spend |
| the action row | **`["Cancel", "Choose a picture"]`** — *Cancel*, never *Discard*: nothing has been chosen yet to discard |
| focus on mount | **Cancel** |
| a drop INSIDE the empty dialog | reads identically, **273 characters** |

The empty state was re-driven in both themes after its way-out was corrected
(`scripts/_drive196b-empty-disposable.mts`, 4 checks, 0 failing). It is **free** —
a tap makes no describer call at all.

### The refusals

| case | what she sees |
|---|---|
| a file that is not a picture, dropped on the **card** | dialog opens **and says why**: *"That isn't a picture we can read. Try a PNG, JPEG or WebP."* |
| the same, dropped **inside** the dialog | the same sentence, same place |
| the door refuses the read | heading **"We couldn't read that one"**, no explainer, **her picture kept**, the door's own words — *"I couldn't find a person in that picture — try one with someone in it."* — and `["Discard", "Choose another picture", "Try again"]` |
| merged brief under 3 characters | **"That brief is too short to cast from. Describe the person in a sentence."** — still on the lobby, box holds her words |

### The two hazards

| reading | value |
|---|---|
| a **file** dropped where the page does not claim it | `defaultPrevented = true` — no navigation, no dialog, brief intact |
| a **text** drag into the brief box | `defaultPrevented = false` — still reaches the box |
| Tab, with all three actions live | `TEXTAREA → ghost → secondary → primary → TEXTAREA` (**4 distinct**) |
| an emptied description | disables `["Use this brief", "Cast it"]` |
| Esc | abandons, brief `""`, card released (`disabled = false`) |
| the scrim | `{x: 0, y: 0, w: 1440, h: 980}` = viewport |

### Both themes

Light re-drives the whole read state: **"Cast it"** over **`262 characters … ~ 160 credits`**, 9.5 s.
Frames 10–15 are the light set.

---

## 3. Copy audit

Every user-visible string this PR adds or changes, classified per the founder's
2026-08-01 contract (**prototype content is quotation, not requirement**).

| string | class | why it is honest |
|---|---|---|
| **"Cast it"** | **founder-verbatim** | *"the button should be cast it"*. Also the hero's own button, so one word for one act. |
| **"Drop it here — we'll read it straight away."** | invented | the card's drag-over line. It promises exactly what happens next: the read starts on the drop, with no second gesture. |
| **"Start from a picture"** | invented | the empty state's heading. Not *"This is what we'll cast"* — at that point there is nothing to cast, and a heading that says otherwise is furniture pretending to be a promise. |
| **"Drop a picture in, or choose one. We read the person out of it and write you a brief, so you can cast someone similar — not this person. We never keep the picture."** | adapted | carries the same two load-bearing facts the card's line does (**similar**, **not kept**), because a customer can arrive here without having read the card. |
| **"Drop a picture here"** / **"Choose a picture"** | invented | the zone and the picker. |
| **"That isn't a picture we can read. Try a PNG, JPEG or WebP."** | invented | names the formats rather than the refusal — *"unsupported file type"* says what happened and not what to do. |
| **"We couldn't read that one"** | invented | the refused heading. Says *that one* rather than *your picture*, because the picture is still on screen and the next act may be a different one. |
| **"Try again"** / **"Choose another picture"** | founder-derived | his build note: *"a failed read gets a plain retry inside the modal"*. Two, because a gateway blip is worth the same picture and *"I couldn't find a person"* is not. |
| **"Cancel"** (during the read, AND in the empty state) | founder-derived | his *"honest progress line … with cancel"*. Same button, same handler; only the label tracks what the tap does. It says **Discard** only where there is something to throw away — a picture, or a picture and its words. |
| **"That brief is too short to cast from. Describe the person in a sentence."** | **pre-existing, server's own** | not written here. `briefCompiler.ts` has thrown it all along; the client now says the same words instead of returning silently. |

**Nothing added claims a likeness.** The suite proves it on every string
(`conceptUpload.test.ts`): no *likeness*, no *same face*, no *their face*.

---

## 3b. Three states caught claiming something untrue about themselves

All three were found by LOOKING at a frame or at what a walk printed, not by
reading source, and they are one class: a state inheriting a sentence written for
a different state.

| state | said | why it was false |
|---|---|---|
| refused | *"This is what we'll cast"* + *"Edit anything. We cast from these words…"* | there were no words — nothing had been read |
| empty | *"Discard"* | nothing had been chosen to discard |
| reading (pre-existing, kept) | — | already said *"Cancel"*, which is what made the other two visible as wrong |

Each has its own arm and its own negative control.

## 4. What is NOT in the frames, and is a judgement call

**The price is above the button, not on it.** The card's text glosses his
amendment as *"with the price on it, per the paid-button law"*; his own sentence
says only *"the button should be cast it"*. **D-109 names "Cast it" by name** as
an immediate-fire action, rules that *cost is metadata, never button text*, and
records that a price inside a confirm's button was tried and **reversed the same
day**. So the number sits in the cost line directly above.

It is on his Crew page (edition 79) in his own terms, with an offer to move it on
one word.

---

## 5. Cost

**0 customer credits. No render, no segmenter read, no row, no migration, no
flag, no rate-limit change.** ~30 describer reads of house money (cents) across
the drives — which exhausted the 12/hour per-user limit twice, and that is how
the refused state got photographed the first time. `assertFalBudget` untouched.

## 6. Frames

`output/_shift196b/` — 19 frames. In his eye gallery (edition 79), off the FINAL
build: `crew-eye/dfe5f592…` (the cast, dark) · `crew-eye/e04f4d2f…` (the cast,
light) · `crew-eye/56d9b2a4…` (tap → empty, dark — the corrected one) ·
`crew-eye/e392b31e…` (the real no-person refusal, light).
