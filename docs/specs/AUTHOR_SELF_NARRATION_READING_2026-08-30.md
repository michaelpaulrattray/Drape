# THE MAX AUTHOR TALKS ABOUT ITSELF — the rate, and what it is actually doing

**foreman-110, 2026-08-30. Answers #242. Text-only, $0.264 indicated (estimate
$0.35, recorded on the card before it fired). No render, no segmenter read, no
credit, no row written, no `fal` spend.**

#242 was filed on **one draft of four** from foreman-101's #237 drive, and it
named its own next step:

> *"A rate is cheap to get: the drafts are already recorded on every author row
> (`register.content`), so a census over production rows is a read, not a
> drive."*

That step was taken first. **It does not work**, and the reason is worth more
than the sentence it replaces.

---

## 1. The census the card asked for — five drafts exist

Read-only, one `SELECT` per world, controls before the rows
(`scripts/_shift110-selfnarration-census-disposable.mts`):

| | production `:23768` | dev `:52008` |
|---|---|---|
| rolls with a compiled brief | 236 | 66 |
| author-road rows | 16 | 14 |
| … `mode: authored` | 4 | 1 |
| … `mode: seed` (LOW — no author call) | 10 | 10 |
| … `mode` absent (pre-#230) | 2 | 3 |
| **rows carrying author TEXT** | **4** | **1** |
| drafts with ≥1 candidate clause | **0** | **0** |

**The entire recorded author-text population of this product is five drafts.**
LOW is the default and LOW makes no author call, so the rows are mostly `seed`;
MAX is a settings choice on one account. Five is not a rate, and the card's own
specimen was never a roll — it came from a drive and lives at
`output/_shift101-lane/author-3.txt`.

⚠ **One thing the census did settle.** Production roll 235 — the draft
foreman-101 quotes as *"the failing draft"* — is **clear of every
self-narration cue**. Its failure was the named kit (#237), a different defect.
The two findings do not share a row.

⚠ **And a second, on the rows rather than the drafts: production holds NO
`static` row at all** — 0 of 4 MAX rolls. Set that against §3 below, where 5 of
24 drive calls went static. At n = 4 the two are not in conflict — **Fisher
exact, two tailed, p = 1.00**: every possible outcome of a 4-row group is at
least as probable as this one, so those four rows carry no information about
the rate either way. It is recorded so nobody reads production's silence as a
contradiction, and so the next MAX rolls have a prior to be compared against.

## 2. What was bought instead

**24 MAX author calls, three seeds × 8**, driven at `authorPrompt` — the real
entrance the roll road uses — with no render behind them
(`scripts/_shift110-author-drive-disposable.mts`). Every seed is on the record
rather than invented:

| cell | seed | lane | why this cell |
|---|---|---|---|
| **A** sphinx | production roll 235/232's own brief, byte for byte | creature | the cell that produced the specimen — the one known positive |
| **B** finished | the founder's finished cyber-goth specimen (#171) | human | the *hypothesised* worst case: the finished-seed rule tells the author to keep the facts and add no new nouns, which is the instruction that invites it to narrate what it did not add |
| **C** thin | `goth woman mid 30s` (#171) | human | the ordinary case, and the control for "does this happen when the author has room to invent" |

Drafts, manifest and the run log are under `output/_shift110-author-drive/`;
every confirmed and rejected sentence is quoted below, because that directory
is swept and this document is not.

## 3. ⚠ THE HYPOTHESIS WAS WRONG, AND BEING WRONG IS THE FINDING

**B — the highest-prior cell — produced ZERO instances in five drafts.** The
worst cell is **C, the thin seed** (2 of 6). The defect is not the author
narrating its **compliance** with the no-new-nouns rule, which is the story
#230 and #242 both tell. It is the author narrating **what it is leaving
OPEN** — and it does that most when the brief leaves most open, which is
exactly backwards from where the card was looking.

Read at the sentences (`✓` confirmed, `✗` rejected on reading):

| | draft | clause |
|---|---|---|
| ✓ | `C-thin-4` | *"Jewellery, where it appears, reads as dark metal and old stones rather than sparkle — **left to the engine** rather than fixed."* |
| ✓ | `C-thin-0` | *"Her build and features are **left to the room**…"* and *"…**nothing named or fixed** beyond that dark, romantic severity."* |
| ✓ | `A-sphinx-0` | *"Skin texture stays true to **what is stated** — no gloss, no doll-smoothness…"* |
| ✓ | `author-3` (#242's specimen) | *"…**no invented jewelry, no new garments beyond the armour already described**, no softening of the predatory stillness…"* |
| ✗ | `A-sphinx-0`, `B-finished-0` | *"no warmth **added**"* — picture content |
| ✗ | `author-3` | *"contrast doing the work rather than **added** ornament"* — picture content |
| ✗ | `C-thin-0` | *"pale skin **left to** its own natural texture and tone"* — picture content, in the same four-word frame as a confirmed hit |
| ✗ | `author-0`, `author-2` | *"commands **the room**"*, *"reading every shift in **the room**"* — picture content |
| ✗ | five drafts | *"**no softening**"*, *"no youthful rounding"*, *"no polish"* — picture direction, and the founder's own register |

**RATE: 4 of 23 drafts = 17%** (drive alone, 3 of 19 authored drafts = 16%; per
call, 3 of 24 = 13%). Per cell: **A 1/8, B 0/5, C 2/6.** Every one of those is
n ≤ 8 on a reply that is a coin, so read them as a band and not a number.

⚠ **`C-thin-4` NAMES OUR ENGINE IN THE IMAGE PROMPT.** That raises the class
above cosmetic. #242 says the specimen *"cost no picture"* — true of the
specimen. But this is §5b defect 3, and defect 3's own measurement is **dev
roll 95, where set/openness narration made the engine paint 7 of 8 tiles as
contact-sheet grids.** `NEVER_WRITTEN` already bans *"left open"*, *"left
unset"*, *"unspecified"*, *"pick one"*. The author is saying the same thing in
words one noun outside the list.

## 4. IS IT SEPARABLE BY CODE — measured, not reasoned

The card's own question, and the answer is **yes, but not by the words the card
proposed**:

| cue | occurrences | offending | verdict |
|---|---|---|---|
| `added` | 3 | **0** | **proven false-positive generator** |
| `no softening` | 5 | 1 | **proven false-positive generator** — 4 legitimate uses, including the founder's own register |
| `left to` | 3 | 2 | not a discriminator alone — the OBJECT is what decides |
| `left to the engine` / `left to the room` | 2 | 2 | discriminates on this population |
| `nothing named or fixed` | 1 | 1 | discriminates |
| `what is stated` | 1 | 1 | discriminates |
| `invented` / `no new` / `already described` | 1 draft | 1 | discriminates — #242's specimen |

So the card's fear was right about the mechanism and wrong about which words
carry it. **A ban on `no invented` / `no new` / `not add` would take the
specimen and miss `left to the engine` entirely** — and a ban on `softening` or
`added`, which is where the eye goes first, is the `cropped` / bare `framing`
class a fifth time, now proven at real text rather than predicted.

⚠ **THE OVER-BROAD CUE LIST STILL MISSED A HIT.** `C-thin-4` reached the
confirmed set only because a WIDER sweep was run afterwards; the census's own
cue list caught that draft on `no softening` — a clause that is legitimate —
and never saw *"left to the engine"* at all. **A cue list is a mirror
(working law 4), and this one is now measured to be an incomplete one.** That
is the strongest single argument in this document against shipping a phrase ban
as the fix.

## 5. ⚠ WHAT THE DRIVE FOUND THAT NOBODY WAS LOOKING FOR

The run's own manifest, which is about the author's guardrails rather than
about #242:

| | A sphinx | B finished | C thin | **all** |
|---|---|---|---|---|
| calls | 8 | 8 | 8 | **24** |
| **re-asked once** (`attempts ≥ 2`) | 3 | 4 | 6 | **13 — 54%** |
| **fell to `static`** (refused twice; the customer's own words stand) | 0 | 3 | 2 | **5 — 21%** |
| median words | 222 | 191 | 196 | — |

**More than half of MAX author calls are refused by our own guards once, and
one in five loses its author entirely.** The re-ask reasons, read off the run
log, are not #242's class at all:

- **skin contradictions — 7**: *waxy* ×2, *airbrushed* ×3, *doll-like* ×2. The
  author writes the skin words the locked block's own realism negatives ban.
- **stated-age paraphrase — 5**: *youthful*, every one on cell C, whose seed
  says *mid 30s*. `ageContradictionIn` refuses it.
- **`NEVER_WRITTEN` — 3**: *left open* ×2, *across the set* ×1.
- **piece noun — 1**: *collared*.

⚠ **THAT LIST IS 16 OF 18 REFUSAL EVENTS, NOT 18 — READ AT WHAT WAS ACTUALLY
SEEN.** 13 first-draft refusals plus 5 second-draft refusals is 18 messages; the
run's log was read from its TAIL and **the first four `A-sphinx` calls scrolled
past unread**, so up to two reasons in that cell are unaccounted for (cell A
recorded 3 re-asks and one of them, *waxy*, was read). The counts above are
**floors**. The reasons are not recoverable — the drive records `attempts` on
its manifest and not the reason, which is an instrument fault to fix before the
next drive rather than a number to fill in now.

All five statics were read in full and **every one involved a skin or age
trigger**. So the dominant cost is **the house's own realism negatives and the
age rule fighting the author**, not the pipeline-note list.

⚠ **AND A STATIC SHEET DOES NOT SAY SO.** Read at the projection
(`rollProjection.ts`): a `static` row shows the customer's brief as
`authoredPrompt` — which is honest, it IS the prompt — and `readAuthoredFrom`
returns null, so no *your words → authored brief* pairing is drawn. The sheet's
settings record still says **"Photoreal · Max imagination"**. There is a
precedent for saying otherwise (`authorSatOutRecord`, written for the
`anchored` / `edited` rows), and `mode: "static"` is not one of its reasons. So
a customer who chose MAX and got LOW's prompt one time in five is told she
chose MAX and shown a prompt nobody authored, with nothing distinguishing it.
That is a product question and it is filed, not answered here.

## 6. What was NOT done, and why

**No product code was changed.** The obvious fix — add
`"left to the engine"`, `"left to the room"`, `"nothing named or fixed"` to
`NEVER_WRITTEN` — is buildable tonight and is **not** recommended without his
word, for three measured reasons:

1. **Every ban is a re-ask, and a second failure costs the whole authored
   draft.** The static rate is already 21%. Trading a prose defect that has
   never been shown to cost a picture against a fallback rate that demonstrably
   does is the wrong direction to move without a decision.
2. **The cue list is measured incomplete (§4).** A ban built from four
   specimens would catch four specimens.
3. **The instruction already forbids it.** `NO_NOTES_RULE` says *"never say
   what you did or did not add"* in as many words; the measured compliance is
   83%. Strengthening an instruction is a prompt change, and this campaign's own
   finding is that **context is not additive** — that needs a swap court, not an
   edit.

**Recommended instead, in order:** (a) rule on §5 first — the 21% static rate is
the bigger number and the customer can see its effect; (b) if #242 is to be
fixed by code, fix it as the **class** the sweep found (pipeline OBJECTS in a
leaving-open frame) rather than as the specimen's words, with the swap court
that any prompt change needs; (c) either way, the suite should assert the
non-catch out loud, the shape `PIECE_NOUNS` already uses, so a green run is
never read as a reader that catches this.

## 7. Artifacts

- `scripts/_shift110-selfnarration-census-disposable.mts` — the census and the
  detector (one cue list, both worlds and disk corpora through it). Controls
  first; a missed positive prints `CONTROLS FAILED` and exits nonzero.
- `scripts/_shift110-author-drive-disposable.mts` — the drive. Estimate in its
  header, balance read before and after, and the delta reported as an
  *indication* rather than a meter (INSTRUMENT DOCTRINE #25).
- `output/_shift110-author-drive/` — 19 drafts, 5 empty statics, `manifest.json`.
- `output/_shift101-lane/author-{0..3}.txt` — foreman-101's four, re-read here.
