# Reconciling a brief against the codebase

**Run at the START of every section, before a line is written. Twenty minutes.
It is the front half of what `PROMOTION-PASS.md` does at the back.**

## What a brief is, and what it is not

**Founder, 2026-08-30, verbatim:**

> "one of the biggest things i need you to understand is that the mockup agent
> doesnt actually know how our codebase works. it just designed the mockup …
> just take every breif i give you and understand that it was designed on a
> canvas with no functions so it doesnt understand what our codebase functions
> are that are already built."

Every brief in this pack is **one section of a mockup drawn on a blank canvas**.
It was authored without the codebase in view. That makes it:

- **AUTHORITATIVE on look** — layout, spacing, type, colour, order, copy,
  behaviour-as-experienced. Where this pack and the prototype disagree, the
  prototype wins. Where the prototype and the code disagree on *appearance*, the
  prototype wins.
- **NOT authoritative on what exists.** It cannot know a component is already
  built, already named something else, or already wired to something.
- **NOT authoritative on mechanism.** It cannot know which of its elements has a
  server behind it and which has nothing at all.

A brief is therefore **a description of the destination, not a route to it.**
Following it literally is the mistake; building what it describes, out of what
we already have, is the job.

## The five questions

For every element the brief names, before building it:

**1. Does this already exist?** Grep the foundation and the feature folders for
the behaviour, not the name — the brief's word for a thing is rarely ours. If it
exists, **use it**; the brief's instruction to "add" it is an artefact of the
blank canvas.

**2. Does it exist under a different name?** Same behaviour, different vocabulary
is the commonest form of this. Reconcile the names in the direction the
`PROMOTION-PASS` sets: rename on the way in, never leave two.

**3. Is there a server behind it?** If the brief shows data — a count, a queue, a
status, a member list — find the reader that produces it. **If there is no
reader, the element ships inert or does not ship.** A number in a mockup is a
drawing; the same number on a page is a claim.

**4. Does it name a capability we do not have?** A field that takes typing, a
shortcut, a button that goes somewhere unbuilt. **A stub names a place, never a
capability** — inert, unfocusable, honest about why.

**5. Does it hard-code something we own?** Colours, widths, radii, durations.
The mockup has no token file, so it writes literals. **Every literal is a token
lookup**, and `token-guard` enforces it for colour.

## Output

Answer the five in the section's card **before building**, listing each element
the brief names against what was found. It is usually short. Where the answer
changes what gets built, **say so and build the reconciled version** — the brief
is not amended by silence, and the next reader must not have to re-derive it.

Where the brief and the code genuinely conflict on something the founder ruled,
**ask him**. That is rare; most conflicts are the blank canvas, not a decision.

## Why this exists — four real instances, all in one day (2026-08-30)

Each was caught late or by luck. All five questions above are one of these.

| What happened | Which question |
|---|---|
| Brief 00 ordered popover discipline "in code" without knowing `Popover.tsx` existed. Section 00 built a third implementation; **three lived at once, 558 lines.** | 1 |
| Brief 00 §3 listed keyframe additions §6 already had. The follow-up instruction — *"delete the duplicate in `foundation.css`"* — **resolved to `.dp-progress`, the progress bar's own styling.** No duplicate existed. | 1, 2 |
| 00b's count pills and queue pill show live numbers **no server produces.** Shipped inert, deliberately, with the spaces left empty. | 3 |
| Brief 02's centred search is drawn as a search field. **It ships as a `<span>`** — founder ruling: a field that takes keystrokes and does nothing claims a capability. | 4 |
| The prototype hard-codes `#E2685A` on the queue pill. **That value IS `--accentSolid`**, in both themes. | 5 |

The founder called two of these his own briefing errors and asked for them on
the record. They are not errors of care — **they are what a blank canvas
produces, every time, structurally.** This pass is the answer to that, and it is
cheaper than any of the repairs above.
