# UPLOAD A CONCEPT — the review modal's evidence pack and copy audit

**#196, founder direction 2026-08-28. Built by foreman-76, 2026-08-28 (AEST).**
Frames: `output/_shift196/`. Driven at the running app on dev, both themes,
with real describer reads (house money, cents).

His direction, verbatim:

> *"when you go to upload a concept image to be casted it opens in a popout
> modal instead of putting it into the small prompt box? thoughts?"*

Adopted with the shape confirmed on the issue: the photo on the left, the
editable description on the right, a character count, one **Use this brief**
confirm, Esc/close abandoning cleanly, and nothing charged either way.

It landed the same night he flipped the road on (`CASTING_CONCEPT_UPLOAD_SCOPE
= users:1`, his Crew reply #22: *"Flip it."*), so the first surface he uses is
the one he asked for.

---

## 1. What a customer does now

Tap the card → pick a picture → **the modal opens immediately with her picture
in it** and says it is reading → about nine seconds later the description is
beside the photograph, in a real text box, hers to change → **Use this brief**
puts it in the prompt box and closes → she casts it like any other brief.

**Driven end to end, not asserted.** One of our own delivered frames (the
cyber-goth pass from the #190 court — a deliberately distinctive subject, so a
description of the wrong picture would be unmistakable) through the shipped
card at `http://localhost:3000/casting`:

| reading | value |
|---|---|
| pick → modal on screen | **192 ms** — it opens on the PICK, so the wait has a subject |
| pick → words in the box | **8.8 s** |
| description length | **266 / 256 / 285 characters** across four reads — every one inside his 150–250-ish target, none an inventory |
| brief box **while the modal is open** | **empty** — the words do not land early |
| after **Use this brief** | brief box holds the description, **0 dialogs** on screen |
| after **Discard** | brief box **unchanged** |
| **Esc mid-read** | **0 dialogs**, brief box unchanged |
| the append rule at the surface | typed `a skincare founder`, then confirmed a read → `"a skincare founder\n\n<description>"` |
| focus walk from the textarea | `secondary → primary → TEXTAREA → secondary → primary` — **never leaves the dialog** |
| empty edit | primary **disabled**, count reads `0 characters` |

## 2. The frames

| file | surface | theme | state |
|---|---|---|---|
| `01-reading-dark.png` | modal | dark | the picture is up, the field says *Reading the picture…* |
| `02-filled-dark.png` | modal | dark | the description beside the photograph |
| `03-landed-dark.png` | start page | dark | after the confirm — words in the brief box, modal gone |
| `04-resting-light.png` | start page | light | the card at rest |
| `05-reading-light.png` | modal | light | reading |
| `06-filled-light.png` | modal | light | the description beside the photograph |
| `07-empty-edit-light.png` | modal | light | every character deleted — the confirm is disabled, not a control that does nothing |

Every frame was **opened and looked at**, and two changes came out of looking
rather than out of reading the source (§4).

## 3. Copy audit — every user-visible string this PR adds or changes

The founder's UI contract classifies each as **prototype-verified / adapted /
invented**. The prototype has no such modal, so all are **invented** except the
one carried over.

| string | class | why it says what it says |
|---|---|---|
| **"UPLOAD A CONCEPT"** (eyebrow) | adapted — the card's own title, in the house mono eyebrow | Every titled surface in the app opens with one; it names where she came from. |
| **"This is what we'll cast"** | invented — **his words**, from the shape he confirmed | It states the one thing that is easy to get wrong: what casts is this text, not the file. |
| **"Edit anything. We cast from these words, not from your picture — so you get someone of this type, not this person. The picture isn't kept."** | invented | *Edit anything* is his. The middle clause is the road's whole honesty: words go to the engine, so this makes a TYPE. *Isn't kept* is true by construction — no row, no table, no storage write. |
| **"THE DESCRIPTION"** | invented | The house mono field label. |
| **"Use this brief"** | invented — his words | One primary action, named for what it does next rather than "OK". |
| **"Discard"** | invented | The way out. It says nothing about cost because there is no cost either way. |
| **"266 characters"** | invented | A bare count. See §5 — there is deliberately no denominator. |
| **"Reading the picture…"** | carried, unchanged | Slice two's label, reused as the field's placeholder — now said **once**, not twice (§4b). |
| card line: *"…yours to read and edit before you cast…"* | **adapted** — was *"straight into your brief to edit"* | The old line described the behaviour this PR replaces. Left alone it would have been a card promising something the product had stopped doing. |

The negative that matters is unchanged and now covers the new strings too: no
string on this road may say *likeness*, *same face*, or *their face*, with the
positive control beside it (the card must still say *similar*).

## 4. Two changes his order did not ask for, both found by looking at the frames

**(a) The picture was being cropped.** `CastingModal`'s portrait is a 4:5 slot
and the two dialogs that use it show OUR renders, which are already that shape.
A customer's upload is any shape — and this dialog's entire job is letting her
check a description against the photograph, so a crop can remove the very thing
the words are about. The first dark frame showed a 2:3 upload with its lower
half gone. The shell now takes `portraitWhole`, and this consumer is its only
caller.

⚠ **And the fix's first form was inert, which is the finding worth keeping.**
Written as `.dpc-signm__portrait--whole > img` — matching the rule above it — it
computed `object-fit: fill` at the running app and *looked exactly as though it
had worked*. `CastingModal` wraps the image in a `<span>`, so **`.dpc-signm__portrait
> img` has never matched anything**: the sign and delete portraits are sized by
the browser and clipped by `overflow: hidden`. The new rule is a descendant
selector and an arm pins it that way, because a later tidy-up "restoring
consistency" would silently switch it back off.

**The dead rule itself is filed, not fixed here.** Making it live would change
how two dialogs he has already accepted look, which is his eye and outside this
issue.

**(b) The wait said itself twice.** *"Reading the picture…"* was in the field
placeholder AND in the count line, six lines apart in a small dialog — which
reads as a rendering fault. The count line is empty while reading now; the span
stays so the buttons do not jump when the words arrive.

## 5. The count has no denominator, and that is a decision

His direction asks for a character count. It is a bare number, because
`184 / 300` would be **false**: `CONCEPT_DESCRIPTION_MAX` (300) bounds what the
DESCRIBER may return and had already done its work before these words appeared —
after she edits them, nothing refuses at 301. The only bound that governs the
edited text is the roll entrance's `BRIEF_TEXT_MAX_AUTHOR_ROAD`, and the
entrance speaks that refusal itself, before the claim.

A denominator here would therefore be a second copy of a server cap **that does
not even apply** — working law 4, and issue #27's class exactly. If a ceiling is
ever wanted on this surface, the number rides the wire from the door that owns
it.

## 6. The instrument was proved before its silence was believed

Seven sabotages, each restoring in `finally` (`_sabotage_196.py`, disposable).
Each reddens, and the arms are independent:

| sabotage | suite |
|---|---|
| the stale-read guard removed | **1 failed** / 53 passed |
| words land on arrival again (the pre-#196 behaviour) | **1 failed** / 53 |
| the object URL is revoked nowhere | **1 failed** / 53 |
| the count grows a denominator | **2 failed** / 52 |
| the empty edit no longer disables the confirm | **1 failed** / 53 |
| the portrait rule put back to a child selector (inert) | **1 failed** / 53 |
| the focus trap loses `textarea` | **1 failed** / 53 |
| **restored** | **54 passed** |

⚠ **The stale-read arm PASSED its own sabotage the first time** and was
rewritten. It asserted the guard's text appeared *somewhere*; the guard appears
on the success path and the failure path, so deleting the one that matters left
the other behind. It is pinned to its position now — immediately before the
words are shown — and both occurrences are counted.

## 7. What this does NOT change

- **No flag moves.** It rides `CASTING_CONCEPT_UPLOAD_SCOPE`, flipped to
  `users:1` earlier the same shift on his own word. Every other account still
  sees the coming-state card, and the modal is rendered **inside the live
  branch**, so an account outside the scope cannot mount it at all.
- **No server change.** The door, the describer call, the 300 bound, the
  forbidden-word sweeps and the never-kept promise are untouched — this is
  where the words land, and nothing else.
- **Nothing is stored, still literally.** The preview is an object URL: a handle
  to bytes already in this browser, created and revoked by one effect keyed on
  the file, so confirm, Discard, Esc, scrim-click and unmount all revoke through
  the same line. No byte is uploaded or written anywhere to draw it.
- **Nothing is charged on either exit**, and no credits are involved at any
  point on this road.
- **The append rule is untouched** — the description still lands BESIDE her
  words, never on top of them (founder record, #185). A review step that quietly
  started replacing her typing would be the review step doing the thing it
  exists to prevent; it has its own arm.
