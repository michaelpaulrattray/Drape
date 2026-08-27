# Instance nesting on the face panel — design note

> **Status: built.** Design-time record — the feature shipped (the panel's instance rows — FaceRegions); the code and CLAUDE.md govern current behaviour (#69 stamping sweep, 2026-08-28).


*Founder ruling, 2026-08-14, via fable-452, with a Grok screenshot as the
reference and the verdict "theirs is a little over complicated too". Written
before the build, as the ruling asks.*

## What this is, in one line

A paired row becomes expandable — **Eyes ▾ → Left eye · Right eye** — so the one
place a pair is spoken about is also the place either side can be reached.

**What it is NOT:** version history. Explicitly rejected in the same breath —
*"you can just click between thumbnails to get to the version you want"*. There
is no per-child delete or download, no duplicate segments, no second list of
anything. The children ARE the per-instance records that already exist.

## Why it fits what is already built

The scoped ask landed on 2026-08-14 (`45822878`): clicking one eye's rectangle
on the photograph sends `scope: "eye@left"`, the render paints that eye, the
library files that eye and the checker asks about that eye. That is a whole
mechanism with a single entrance. Nesting is **the second entrance to the same
mechanism** — a child row sends the identical wire — and no new state, no new
verb, and nothing new to verify.

It also settles a shape that has always been slightly dishonest. Today a
diverged pair (one green eye, one brown) **stops being a pair**: it renders as
two top-level rows, so the panel's list changes structure to report a fact about
her face. Under nesting the structure is constant and the WORDS carry the fact,
which is what fable-444 condition 1 asked for in the first place — *the panel
may never claim what the rows do not agree on*.

## The shape

```
FACE
  ▸ Eyes            green                       ← parent: the pair
  ▸ Brows           softly arched
    Nose            —                           ← unpaired: no chevron, no change
  ▸ Ears            a little more tucked

  ▾ Eyes            left green · right brown    ← expanded, and diverged
      Left eye      green
      Right eye     brown
```

- **One level, pairs only.** A row nests when it holds two slots — derived from
  `slots.length`, never a list of feature names, because a list of which
  features come in twos is a second copy of the catalogue.
- **Collapsed by default.** The panel is a description of her face; the sides
  are a detail you go looking for.
- **The parent means the pair.** Tapping it is exactly today's row: both slots,
  one ask, no scope. **The child means that instance**: the same ask, scoped to
  its slot.
- **The chevron is its own target.** The row body asks and the chevron expands,
  because the ruling keeps the parent's tap meaning what it means today.

## What each side of the pair carries

Each child carries its own cutout, its own words, and its own rectangle on the
photograph — all three exist already, per instance, in the library and the scan.

The parent's words are the honest summary:

| the two children | the parent says |
|---|---|
| agree | the shared words, exactly as today ("green") |
| diverge | the derived pair sentence, in her own words ("left green · right brown") |
| one is unknown | only what is known, attributed ("left green") |

The parent never says a thing both sides do not carry. That is fable-444
condition 1 unchanged; what changes is that it is now said in one row's words
instead of by splitting the list in two.

## Interactions

```
hover parent       lights BOTH rectangles on the photograph, and the parent row
hover child        lights ONLY that instance's rectangle, and the child row
tap parent         opens the ask about the pair — unscoped, both slots
tap child          opens the ask about that instance — scoped, the SAME wire the
                   rectangle click sends (`scope: "eye@left"`)
click a rectangle  unchanged: opens the box AT the feature, scoped to that
                   instance, and its parent expands so the list and the picture
                   are not saying different things
chevron            expands/collapses; nothing else changes, nothing is fetched
```

The lit-rectangle rule already shipped: a scoped selection lights only the
rectangle it is about. A child selection therefore lights one eye, and a parent
selection lights both, with no new code — the picture cannot claim what the ask
does not say.

**Keyboard and screen readers.** The chevron is a `button` with
`aria-expanded`; the children live in the group it controls. Labels are bare
(`Left eye`) per fable-450/451, and the row's accessible label keeps saying what
it is and what tapping it does. Nothing is reachable by hover alone.

## Both states, both themes

- **Collapsed** is today's row plus a chevron. No layout change, no height
  change, so the dock still fits without scrolling — the check that already
  guards that stays green or the change is wrong.
- **Expanded** indents the two children under the parent, each with a smaller
  cutout of its own instance and its own words on one line. Nothing else is
  added: no per-child furniture, no counts, no badges.
- The reference screenshot was called *"a little over complicated"*; the
  restraint is the point. One chevron, two children, no chrome.
- Evidence per the UI contract: shots of collapsed and expanded, in dark and
  light, with the copy audit line for every new string. There is one new string
  family — the children's labels — and it is not new copy at all: it is the
  instance names the rectangles already say.

## What has to change to build it

1. **`facePanel.ts`** — a paired row emits `instances: [{ slot, name, spoken,
   prefill, words, cutout, box }]`, both sides, whether or not they agree. The
   diverged branch stops emitting two top-level rows; the parent's `words`
   become the derived summary above. One projection, one place, still a pure
   function of rows in / rows out.
2. **`FacePanel.tsx`** — the disclosure, the children, and the child's
   `selection.select({ …, scope })`. The scope-carrying selection already
   exists.
3. **The evidence driver** — a check for each state, re-anchored one at a time
   with its reason where it names today's two-row divergence.

## The one thing to watch

A diverged pair is the only case where this changes what the panel SAYS rather
than how it is arranged, and it is the case with the fewest live specimens —
per-side edits only became reachable this morning. So the diverged parent's
sentence gets its own unit test with both children present, and the driver gets
a fixture with two different words, or the shape ships proven only in the case
where both sides are identical and it cannot be wrong.
