# The launch surface — what every user who is not the founder sees

*Driven 2026-08-15 as the standing outsider (`scripts/lib/outsider.mts`), both
themes, on the dev server. **No spend of any kind**: no generation, no segmenter
call, no credit — watched at the wire on every page. Ordered by fable-557 §4 as
a READING; its product is evidence, and no fix is taken from it without a filed
finding. Shots: `output/outsider-walk/`, `output/outsider-panel/`.*

---

## Why this had never been looked at

Every scope flag in this program names the founder in production. Every driver
we have signs in as the account inside all of them. So the surface that actually
ships — no auto-scan, no reference library, one version, an empty roster — is
the one state no instrument had ever been pointed at.

## What is honest, and photographed

**The panel degrades correctly.** For an account outside the library scope the
server answers `enabled: false, groups: []` and the client renders **no panel at
all** rather than an empty column. The viewer keeps the width (526×789), the ask
box is there, and no "Reading their features…" line survives its own wait. 16 of
16, both themes.

And the gate is doing that work rather than the flag being off everywhere: on
one dev server started with `CASTING_REFERENCE_LIBRARY_SCOPE` naming exactly one
account, the named user gets `enabled: true` and the outsider `enabled: false`
in the same minute.

**The refine promise reads clean.** *"Or take something back — 'undo', 'remove
the earrings' · free when you already have it"* is rendered unconditionally
while `stepBackEnabled` is repaint-scoped, which looks like the wrong-predicate
class — but the repaint gate refuses only `REPAINT_ONLY_SUBJECTS`, and both
promises in that line (the free step-back, D-163; an earring vacancy) are served
on the old road too. **Read, not measured**; measuring it costs one dev refine.

## Two findings, filed rather than fixed

### 1. The sheet shows an empty stage for ~4 seconds, with nothing to say why

```
                        dark          light
the page settles        4ms           5ms      chrome, brief box, "Roll again"
her tile appears        3,878ms       3,766ms
her face decodes        4,089ms       3,967ms
```

The page is "finished" by every definition an instrument has — no skeleton, no
spinner, no loading word, 164 characters of real copy — while the thing she came
for is not on it. For four seconds a user who opens their own sheet sees an
empty stage above a brief box.

The evidence is both states photographed: `*-sheet.png` (empty) and
`*-sheet-after.png` (her face).

### 2. The lobby is blank for an account with nothing in it

`/app` settles in 45–470ms to **62 characters of body text** — the nav rail and
the word "Home" — one image (the avatar), no buttons, no empty state, no
welcome, nothing to do. A new account's first screen after signing in says
nothing at all.

This is not a bug in the sense of something failing; it is the empty state
nobody has written. It belongs in front of the founder before the doors open.

## Three instrument corrections, each of which had produced a green

This driver was wrong three times before it was right, and every version looked
like a pass:

1. **Read at mount.** A 2.4MB master had not decoded and the panel's query was
   in flight, so the loading state was graded as the finished one — four
   failures that were one mistake. Wait on the bytes, then on the read.
2. **"An input with a placeholder"** matched the sheet's brief box behind the
   viewer — an assertion that would have passed with the ask box entirely
   missing. Read the field's own class, out of the component.
3. **"More than 40 characters of body text"** is satisfied by the nav rail
   alone (Home, Create, Canvas, Templates, Casting, Assets, Library = fifty
   characters), so the first walk photographed three "Loading…" screens; and
   the second, which waited for that word to leave, photographed the lobby as
   four grey skeletons — because a skeleton contributes no text. **The driver
   was already collecting the skeleton count and never asserting on it**, which
   is the same as not collecting it.

The general shape, worth the phrasebook: **a page-level wait is satisfied by the
frame around the page.** Wait for the route's own content — and if the surface
paints placeholders, the absence of placeholders is part of "arrived".

## The limits

- **Dev, one account, one cloned sheet, one candidate with no versions.** The
  rail with several versions, a roster with many casts and the signed flow are
  not in this reading.
- **Nothing was clicked that costs money**, so the refine, roll and sign paths
  are unwalked from the outside.
- **The dev server defines neither scope flag**, so "outside" is trivially true
  there; the gate itself is proved separately at the wire (above), not by this
  walk.
