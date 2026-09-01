# Promotion pass — section 08, the Crew tab (#398)

Run per `docs/specs/Casting-ui-ux-design/drape-redesign/PROMOTION-PASS.md`, at
the end of the section, before the card closes.

> **The short answer: nothing moves, and for once that is the interesting
> result rather than the empty one.** This section built **no new component at
> all** — it is a restyle, and the parts it would have promoted already exist.
> What the pass turned up instead is the opposite problem: **three foundation
> primitives with zero consumers, all three written FOR Crew, and none of the
> three fits it.**

---

## 1 · What this section built

| what | kind | consumers today |
|---|---|---|
| `crew.css` | section stylesheet, prefix `dp-crew` | 1 — `AdminCrew.tsx` |
| `section08-guard.test.ts` | 46-arm source guard | n/a |
| **components** | **none** | — |
| **hooks** | **none** | — |

**Zero new components.** Brief 08 §1 is a warning not to build: *"Crew is
already built, and its content architecture is better than my prototype's."*
Every part the brief describes was either already a component (`TableHead`) or
already the shell's (`.dp-staff__col--read`). A section that promotes nothing
because it built nothing is the pass working, not the pass being skipped.

**The stylesheet stays.** One consumer, and a section sheet is not a promotable
part — the same disposition `overview.css` has.

---

## 2 · What the section CONSUMED that was already shared

Counted at the code rather than claimed. This is where the section's value to
the foundation actually is.

Measured at the tree, not carried from #397's report:
`grep -rl "<TableHead" client/src --include=*.tsx` excluding the specimen page,
and `Field` counted at its import from `@/foundation`.

| part | render sites after | this section's share | note |
|---|---|---|---|
| `TableHead` | **22 files** | **12 heads across 10 files** | ten sections, plus a second head inside two of them |
| `Field` | **6 files** | 1 | the reply box, replacing shadcn's `Textarea` |
| `Button` (`@/foundation`) | many | 1 | the reply box's send, replacing shadcn's |

⚠ **`TableHead` now heads twenty-two files and most of them are not
tables.** #397's pass already filed this as a NAMING finding and recommended
its own small PR; this section triples the evidence for it. **It must never be
folded into `SectionHead`** — that one is a baseline-aligned title row with a
bottom rule, this is a wrapping cluster whose rule runs THROUGH it, and
`SectionHead`'s consumer is frozen casting.

---

## 3 · ⚠ The finding: three zero-consumer primitives, all three named for Crew

`MilestoneRail`, `Transcript` and `CostedOption` have **no consumer anywhere in
`client/src`** — only their own definition, the barrel, and the specimen page.
All three carry *"Crew"* in their docblocks. Brief 08 §9 names one of them and
says *"this is it, or it should be deleted."*

**It is not it, and neither are the other two.** Read against the data each
would have to take:

### `MilestoneRail` — read off COUNTS, and Crew has none

§9 calls it *"the progress bar read off states"*. It is not:

```ts
export type Milestone = { id; name; weight; done: number; total: number };
```

…and its own docblock forbids the alternative **by name**: *"The three states
are DERIVED from the counts rather than passed in beside them — a `status` field
next to `done`/`total` is a second list shadowing a source of truth."*

Crew has two bars and it fits neither:

- **The ladder** is `{ key, title, state: "done"|"current"|"queued"|"parked" }`
  (`server/crew/crewBriefing.ts:95`). No counts exist to derive from, and
  `MilestoneRail` has no per-segment parked at all — its `held` is a
  whole-component flag.
- **The milestone bar** is ONE fraction (`milestoneProgress(steps)`), not N
  proportional segments.

Taking either needs a new API. `PROMOTION-PASS.md`: *"if a promotion needs a
rewrite to be general it is not ready — leave it and log it."*

### `Transcript` — two speakers, and Crew has one

A two-speaker conversation record with a fixed 80px speaker column and a `ref`
slot. Crew's reply thread has exactly one speaker: **him**. The crew never
replies on this page — acknowledgement is a deployed edition naming a reply id,
which is a marker and not an utterance.

### `CostedOption` — a button, and Crew's options are not pressable

```ts
export function CostedOption({ optionKey, label, costs, onClick })
```

`costs: {sign, text}[]` is required. Crew's options are `{label, consequence}`
read-only text, and he answers by **typing in the reply box** — a card's options
are things to read before writing a sentence, not things to click. Rendering
them as buttons would ship a row of dead controls on the page whose §O ruling
forbids exactly that.

### Recommendation

**One small PR deleting all three**, or a card if he would rather keep them as
the shape of a future plan display. It is three dead exports and a specimen-page
row each, not a bug. ⚠ **Deliberately NOT done inside this PR**: deleting a
foundation primitive from a surface-only diff is the *"chance to tidy the
original"* the pass forbids, and the same argument would take the other two with
it in a change nobody reviewed for that.

---

## 4 · Collisions checked before anything was added

Grepped the foundation first, per §5 — the step that would have caught the three
live popovers.

| what I was about to write | already exists? | outcome |
|---|---|---|
| a Crew section head | **yes** — `TableHead` | used it; did not build a third head |
| a 790px reading column | **yes** — `.dp-staff__col--read` (#395) | used it; `crew.css` declares no page width, and an arm pins that |
| a themed textarea | **partly** — `.dp-field` + `.dp-input` | used them; one modifier (`align-items: flex-start`) rather than a foundation change for one consumer |
| a chip with a selected state | `Chip` has **none** (#397's finding) | not needed — every chip on Crew is a non-interactive `<span>`. The finding does not land here |
| a progress track | `Progress` (6 consumers) and `MilestoneRail` (0) | neither: `Progress` is a percentage widget with its own label grammar; Crew's is a 5px bare track read off steps. **Logged, not forced** |

---

## 5 · What the section deliberately left alone

- **`crewTypes.ts` / `crewTypes.test.ts`** — untouched, per §8. The derivation
  functions are where this page's real logic lives and none of it is surface.
- **`useCrewState.ts` and the visibility flag** — untouched, per §7. *"The query
  succeeding is the flag; that is right."* An arm pins it.
- **The five staff FORM modals** — still light-only, still owned by no brief.
  Reported by #396's pass, #397's pass, and now this one. **Three passes is
  enough: it wants a card of its own rather than a fourth paragraph.**

---

## 6 · Colour debt, after

`token-guard` now enrols `features/admin/components/crew` **as a directory**
plus `pages/AdminCrew.tsx`. **208 hex literals → 0**, proven able to fail by a
planted `#BADA55` reddening exactly one arm that names the file.

⚠ **One carve-out was added and it is the guard's own documented trap**:
`crewTypes.test.ts` holds six issue numbers in `describe`/`it` **titles**, and a
title is a string rather than a comment, so every digit is a hex digit. The
guard's prescription is to move them into comments; §8's bar is that this file
passes **untouched**. The file is exempted instead — a pure-derivation test that
renders nothing — and the exemption is **self-cleaning**: the honesty arm
reddens the day the file stops containing one, and tells the reader to delete
the row.

**The class question this raises, filed rather than decided here:** should the
colour guard read `*.test.ts` at all, in any enrolled directory? Every guarded
directory has one, none of them renders, and this is the second carve-out of
exactly this shape (`section05-guard.test.ts` is the first). Deciding it is a
change to the guard's collection rule across every enrolled path — too big for a
surface-only brief, and worth a card.
