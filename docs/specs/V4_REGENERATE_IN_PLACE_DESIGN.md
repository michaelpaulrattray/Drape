# Asking for the same edit again — regenerate in place

> **Status: ✅ BUILT (verified at the code 2026-08-28, #69).** The rail derives one chip per distinct edit, newest wins, in `server/castingV2/railTakes.ts` (pinned by `railTakes.test.ts`), and `refineService.ts` carries the founder ruling verbatim at its re-roll site. One recorded divergence: the build deliberately does NOT use `namesSameThing` for edit identity — `railTakes.ts`'s own docblock says so and why, and it governs over this note's proposal.


*Design note, written before any code, because this touches the paid path and
the version tree (fable-567 §5). Founder ruling 2026-08-15, confirmed the same
day.*

---

## The ruling

> *"Just allow a refresh or regeneration of the same edit which essentially
> produces no extra version and just regenerates the same thumbnail."*

and, on the trade it makes:

> *"Yes the trade is intended — if you don't like how the generation landed you
> can regenerate it without causing extra clutter."*

So: **a repeat of the same ask re-rolls that version in place.** The chip stays,
its label stays, the picture and the thumbnail are replaced, and the previous
take is gone from the rail. It is still a paid render.

This dissolves the identical-chips question entirely (four chips reading *"give
her gold hoop earrings"* was the shape that raised it) — there is no ordinal to
design, because there are no repeats to number.

## What "the same edit" means, and what it must not mean

**Not string equality.** *"give her gold hoop earrings"* and *"gold hoop
earrings please"* are the same edit; *"give her silver hoops"* is not, and no
amount of shared text decides that. The product already owns this judgement in
two places and the design uses them rather than inventing a third:

```
THE DELTA        the parsed edit — slot, facet, value — is what a render is
                 actually made from. Two asks are the same edit when they
                 resolve to the same delta ON THE SAME PARENT.
namesSameThing   where the comparison is between two DESCRIPTIONS (D-238), the
                 kind table answers first and containment second. Already the
                 predicate for "did this ask replace that thing".
```

A same-edit test that compared `requestText` would call two different edits
identical the first time somebody rephrased one, and would call one edit two the
first time somebody added a word.

## The shape: no new column, because the relation is already stored

Rows are immutable and the live view is derived — the library's own rule, and
the reason forks survive their parents. A regeneration therefore **mints a new
variant row** exactly as any render does, and the rail derives:

```
one chip per DISTINCT EDIT, showing the NEWEST row for it
   grouped by (parentVariantId, edit identity), newest wins
```

`stepDeltas` already persists the parsed edit per row, so the grouping key is a
fact the row carries rather than a new one to write. **No migration, no
supersession column, no second list to drift** (law 4) — and the older take is
not deleted, only unreachable from the rail, which is what makes the next point
free.

## What must keep working, and why it does

- **A fork made from the old take keeps its ancestry.** `parentVariantId` points
  at the exact row it was made from, and that row still exists. This is
  fable-091's class and it must not reopen: a superseded take is invisible, not
  absent.
- **Everything current follows the newest take** — the selected pointer, the
  thumbnail, the library re-mints and the segment rows — under the always-current
  rule (fable-559 §1). A carrier cut from a take the user can no longer see is
  the stale-reference disease.
- **Money is unchanged.** Same price, same operation, same idempotency key
  discipline: `clientRequestId` still guards a double submit, and a regeneration
  is a new operation because it is a new render. Only the version COUNT stops
  growing. D-121's free-when-you-land-on-a-version-you-already-have logic is
  about step-backs and is untouched.

## What the user is told

The copy has to say what a regeneration does in the founder's own terms — **a
fresh take of this edit; the current picture is replaced** — because the door is
one-way by design and a user who expects both takes to survive will lose one
they wanted. It is said before the money moves, in the sentence that offers it,
never as a toast afterwards (D-110).

## The proof, before it ships

A court or driver, whichever the build shape makes honest, with these arms — and
the third is the one that catches the dangerous mistake:

```
1  a re-ask REPLACES in place      one chip before, one chip after, a new picture
2  a DIFFERENT ask still appends   the rail grows; nothing is swallowed
3  a fork from a SUPERSEDED take   still resolves its own chain, unchanged
4  the money moves exactly once    read at the ledger, per render
```

Plus the UI evidence contract: both themes, shots, and the sampler proving the
chip does not blink or duplicate across the swap.

## Two things this note deliberately leaves open

1. **The superseded take's stored objects.** It becomes unreachable from the
   rail while its image and thumbnail stay in storage, referenced by a row
   nobody reads. That is safe (nothing dangles) and it is not free. Whether the
   cleanup worker should treat a superseded take as purgeable — and whether
   purging it would break the fork-ancestry promise above — is a decision for
   the build, not an assumption for this note.
2. **What "the same parent" means across a step-back.** Re-asking an edit after
   stepping back lands on the same parent and is therefore the same edit; that
   is the intent. If a user steps back, makes a different edit, then re-asks the
   first one, the parent differs and it is correctly a new chip.
