# M5 evidence pack — round 5 (founder items 16–19)

Per the UI milestone completion contract: evidence before dogfood. Sheets and
crops are in `.calibration/follow-run/`.

---

## 16 — Follow follows the candidate

**Two causes, stacked.** The reported symptom (followed a blonde woman, got four
men) was the second one showing through the first.

**Cause A — the parent was thrown away.** `readResolvedIdentity` required a
string `build`. `build` is deliberately `null` on any brief that names a casting
category, because the category owns physique (gate B5) — so on most briefs the
whole parent identity failed validation and inheritance received nothing. The
next roll re-read the brief with no sex lock, and `varySex` alternates: four
women, four men. Nothing refused, nothing logged.

Same defect shape as item 13 the day before, where a bare `.optional()` rejected
an explicit `null` and discarded a correct interpreter reply. A validator
treating a legitimate absence as garbage.

**Cause B — inheritance was the wrong shape.** Even when it worked, it copied the
parent's heritage into the *intent*, which makes it a lock: eight identical
heritages, clones rather than cousins. Inheritance no longer touches the intent
at all except sex, because a non-null intent field means *the brief said it* —
and that convention feeds the validator and the brief echo's sentence. An
anchored trait there would be a lock the user never wrote and a sentence claiming
they pinned something they never mentioned.

### The graded run

Brief: `an ethereal, otherworldly person in their 30s` — sex deliberately left
open, so the base roll shows the failure condition. Spend **$1.58** of the
~$1.60 authorized (16 images).

| | base roll | follow of 01 |
|---|---|---|
| Sheet | `base-sheet.png` | `follow-sheet.png` |
| Sex | female, male, female, male, female, male, female, male | **female ×8** |
| Heritage | varied across the ten | **Nordic primary on all eight**, secondary varying: +South Asian, +East Asian, +West African, +Afro-Caribbean, +Middle Eastern, then three unblended |
| Hair | red, red, brown, dark brown, dark brown, black, black, grey | **red mid-length ×8** (carried) |
| Age | 30s (brief-locked) | 30s, phases spread early/mid/late |
| Lock contract | `{ageBand: "30s"}` | `{ageBand: "30s", sex: "female"}` — sex is the only inherited lock |

Read the two sheets side by side: the follow is visibly a family. Same
colouring, same age, related bone structure, eight different people.

**One judgment call for your eye.** The follow carries `look` flat, so all eight
inherit "angular and unslept" from the parent — they read gaunt and tired as a
group, more uniform in mood than the base sheet. That is the ruling working as
written (look/read is in the carried trait list), but it is the dial most worth
your opinion: carrying look is what makes a follow feel coherent, and also what
makes it feel same-y. Say the word and it becomes a bias rather than a copy.

### Hair had to become real to be followable

The parent's blondeness existed only in pixels. No field held it — hair reached
the image through free text shared by all eight — so nothing could inherit it.
Hair is now realized per candidate (family + colour), which also gives ordinary
sheets a diversity axis they did not have.

Colour is conditioned on heritage, because an unconditioned pick hands a West
African candidate blonde hair a third of the time and fights the heritage lock
restored in the craft audit. Grey arrives with age. Pinned by tests.

### The bug the graded run found that no test would have

Grading the first follow-run showed hair family coming back **1–2 distinct values
across eight candidates**. Every axis derived its value from one hash shifted by
a different amount, and the shifts collide with the weight totals: FNV-1a
advances by its prime per position, so `(seed >>> 5) % 100` returns the *same
bucket* for consecutive candidates.

`ageBand` had been doing this since before hair existed — 2 distinct bands out of
7 across a sheet. A surface whose entire job is eight different people was taking
its difference from a generator that repeated, and every sheet you have graded
was quietly narrower than intended.

| axis | before | after |
|---|---|---|
| ageBand | 2, 2, 2, 4, 3 | 6, 6, 4, 6, 5 |
| build | 3, 4, 3, 3, 4 | 5, 4, 5, 5, 5 |
| hair family | 2, 2, 1, 1, 1 | 5, 6, 5, 5, 5 |

*(distinct values across an 8-candidate sheet, five different roll seeds)*

Now asserted, not assumed.

### Lineage

Sentence and pill reference the candidate — `following 08`, `FROM 08` — not the
roll.

---

## 17 — The echo's adjust flow

All three symptoms were one CSS declaration. `-webkit-line-clamp` with
`overflow: hidden` clips absolutely-positioned descendants, so:

- the popover was cut to a sliver — **one option visible instead of eight**;
- a fragment of the panel painted over the skeleton grid (the stray "teens");
- any fact past the second line was hidden, which is why **only one word looked
  clickable**.

The two-line cap now lives in the grammar: when the sentence would run long it
drops the latitude clause rather than clipping. A shorter true sentence beats a
longer one with its end cut off, and no fact is ever hidden.

**My assertion passed through all of this because it read the DOM.** The options
were in the tree; they were not on the screen. It now opens a popover for real
and intersects its rectangle with every clipping ancestor — and I verified it is
not vacuous by putting the old clip back in the browser:

```
as shipped        : 7/7 options visible, clippedBy=none
with the old clip : 0/7 options visible, clippedBy=dpc-echo
```

**Still open, and honest about it:** the founder also asked for the adjusted span
to update immediately with a pending treatment ("early 20s → teens · next roll")
rather than only a toast. That is not built. It needs the echo to render the
pending override alongside the roll's actual facts, which is a small piece of
work but a real one, and I would rather name it than let it look shipped.

---

## 18 — Candidate viewer

Click the media, get the face large on `--viewerScrim`; Escape closes and returns
focus to the tile. Verified in both themes:

| | dark | light |
|---|---|---|
| scrim | `rgba(0,0,0,.74)` | `rgba(17,17,18,.62)` |
| role / modal | `dialog` / `true` | same |
| accessible name | "Candidate 01 — Dry and flat" | same |
| portalled to body | yes | yes |
| page scroll locked | yes | yes |
| focus on open | Close button | same |
| image fits without cropping | yes | yes |
| controls inside | **Close only** | **Close only** |

View-only per D-52 — the ruling the canvas viewer earned by exposing editing
outside the edit ceremony. Keep, Discard and Follow stay on the tile. Portalled
to `document.body` so no ancestor's overflow can clip it, which is precisely the
mistake item 17 was.

---

## 19 — Pupils

`follow-run/eyes/contact.png` — the eye band of all eight follow candidates,
cropped and enlarged 4×, for your eye.

Screen result: **7 of 8 clean, 1 flagged** — candidate 04, "catchlights are faint
and inconsistent between the two eyes". Pupils and gaze pass on all eight. The
screen flags; it does not certify, so the contact sheet is the artefact that
matters.

---

## Design laws

All eight hold across three surfaces in both themes, including the two new ones:

- **Law 7** — over-media chips are dark glass, named and keyboard-reachable.
- **Law 8** — the echo's facts are underlined words not chips, the two layers
  stay two, the sentence stays within two lines, every fact is keyboard-
  reachable, the pill row is gone, and **the popover is not clipped and every
  option is on screen**.

## Suite

265 files, 3380 tests passing. New this round: `followAnchor.test.ts` (17 cases —
the founder's repro, the anchor-is-not-a-lock trap, hair conditioning, and the
variation spread).
