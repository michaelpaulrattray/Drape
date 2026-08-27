# V1 — one registration per kind: the close-out pack

> **Status: dated record.** A measurement/evidence/court document from the date it states — it records what was true then; individual verdicts may since have been superseded. Current law: CLAUDE.md, the capability atlas, `DECISION_LOG.md` (#69 stamping sweep, 2026-08-28).


*Assembled 2026-08-14 by the executor, against the shipped tree at `6e5ebf99`.
Every number here was read from the code or from a driven test, not from a
plan. The milestone is `docs/specs/VOCABULARY_OVERHAUL_REVIEW.md` Part 2, V1.*

---

> *"so when do we execute it instead of this nine different files surgical edit
> rubbish."* — the founder, ordering this program.

**That was the question, and this is the answer in his terms.** The day he asked
it, adding one thing to the vocabulary meant editing **~27 files** for a face
slot (16 source, 11 scripts), and for an accessory kind ~4 mandatory tables plus
a pair noun, two measurement courts, a completeness specimen, a noun list and
**4–5 prose sites no test closed**. Today a face slot is **three registrations**
— one per key space — and an accessory kind is **two**, with the pin, the Atlas
regeneration and its courts behind them. Both numbers were measured the same
way: add a scaffold kind, run the whole suite, and let it name every site that
still has to be edited by hand. The nine-different-files surgery is gone; what
is left is three cards that the compiler will not let you leave half-written.

---

## 1. What V1 said it would do, and what it did

> **V1 — ONE REGISTRATION PER KIND.** A single catalogue entry per kind feeds
> every table: the compile-closed eight stay closed but derive from the entry;
> the four silent lists become REQUIRED fields of it; the prose sites are
> derived or deleted; the stray literals join the tables. Acceptance: adding a
> scaffold test kind touches ONE file plus its courts, and the Atlas can count
> the vocabulary.

| Promise | Shipped | Where |
|---|---|---|
| the compile-closed eight derive from one entry | **done** — 5 subject-keyed + 4 facet-keyed tables are `Object.fromEntries` over the cards | `subjectCards.ts`, `facetCards.ts` |
| the silent lists become required fields | **done** — `plural`, `departable`, `presentationNoun` on every subject card; `region: null` is a written answer on every facet card | `subjectCards.ts`, `facetCards.ts` |
| the prose sites derived or deleted | **done** — the preservation phrase and the panel naming are card fields | `refinePreservation.ts`, `segmentsOnFace.ts` |
| the stray literals join the tables | **done** — the one bare segmenter word (`"glasses"`) reads off the accessory table | `accessoryKinds.ts`, `refineService.ts` |
| the Atlas can count the vocabulary | **done** — 28 subjects + 29 facets, positive-controlled 28→29→28 | `scripts/generate-architecture.mts` |
| adding a kind = one file + its courts | **restated and met** — see §2 | `newKindCost.test.ts` |

---

## 2. What a new kind costs now, measured

The method: add a scaffold kind, run the whole suite, and let it name every
site that still has to be edited by hand. Twice, on two different kinds.

```
a face slot        subject card + facet card + catalogue entry     3 registrations
an accessory kind  accessory entry + region card                   2 registrations
both               + the pin ceremony, the Atlas regen, its courts
```

F5 measured the old cost as **~27 files** for a face slot (16 source + 11
scripts) and, for an accessory kind, ~4 mandatory tables + a pair noun + two
measurement courts + a completeness specimen + a noun list + **4–5 prose sites
no test closed**. The prose sites are gone: each is a card field whose absence
fails the build or a test.

The two hand-sites the first scaffold found — a facet with no preservation
phrase (the tail would leave it unprotected) and none with no panel name (a
segment of it would be dropped) — were the last of them.

### Why three registrations rather than one (fable-514 §3, measured)

Counted over the shipped vocabulary:

```
CLEAN 1:1:1 features   10   brow · cheekbone · chin · ear · facial-hair ·
                            jaw · lashes · lips · nose · teeth
EXCEPTIONS              4   hair (5 subjects) · build (5) · skin (3) · eye (2)
subjects in clean features       10
subjects in exception features   15
subjects with no feature at all   3   statedAccessories · ink · expression
```

**18 of 28 subjects would need an exception to a one-card-emits-three rule; 10
would be users of it.** The rule would carry more exceptions than users, so
three honest registrations stand and the question closes. The three key spaces
are genuinely different — what a person can ask for, what supersedes, what the
panel and library file — and inventing a fourth thing to hold them in sync is
the mirror this milestone exists to remove.

---

## 3. The proof that nothing changed

`vocabularyPin.json` holds every table's contents, captured **before** the
refactor that moved it, and the pin is never regenerated during the work — a
golden refreshed when it fails is a golden that agrees with whatever it is
shown.

```
FREE_SUBJECTS 28 · FREE_SUBJECT_KIND 28 · SUBJECT_NOUNS 28 · SUBJECT_QUALIFIER 28
CHANGE_AMPLITUDE 28 · ZONE_SCOPE 29 · FACET_SLOTS 29 · REGION_OF_FACET 29
MOVES_ITS_EDGE 29 · PRESENTATION_SUBJECTS 1 · PLURAL_SUBJECTS 3 · DEPARTABLE_SUBJECTS 4
FRINGE_AT_EDGE 11 · CONFUSABLE_NEIGHBOURS 11
```

Two of these were captured from `git show HEAD:maskedRefine.ts` — the literal as
it stood before the derivation — because they moved after the pin file was
written. A golden taken from the thing it is meant to check is not one.

The pin caught three real things during V1:

1. **An enrolment ORDER change.** `["marks", "ink", "statedAccessories"]` became
   registration order. Every consumer was read before the assertion was softened
   to membership; `PRESENTATION_SUBJECTS` kept exact order because its key order
   decides which noun a lookup finds first.
2. **A paraphrased prompt sentence.** The accessories preservation phrase
   carries two rulings (D-166 amended, D-183) and a rewrite of it is a
   behaviour change in a paid prompt wearing a refactor's clothes.
3. **Its own thinness.** A sabotage flipping `eyes.fringe` to false passed
   everything, because the suites proved every region HAS an answer and never
   what it is. That is a paid harvest ceasing to reach past a lash line — run-6's
   own tear — and both region tables are pinned now.

---

## 4. What V1 did NOT do, stated

- **The `.strict()` sweep is M4's**, not this milestone's, and 169 non-public
  procedures remain without it (the Atlas reports the figure).
- **A slot still costs three registrations**, not one — argued and measured
  above rather than quietly redefined.
- **The FACET-keyed silences are decisions, not absences.** `region: null` on
  eight facets means *no masked path* (D-213: a segmenter is never asked an open
  question), and `naming: null` on `expression` means *this can never be a row*.
  They are written answers now; they are not the same as "unowned".
- **The accessory table's own words** (`words`, `site`, `worn`,
  `vacantPhrase`) were not moved. They were already one entry per kind and
  already total; moving them would have been motion.
- **No behaviour was intended to change**, and none is known to have changed.
  What proves it is the pin plus 6,270 passing tests, not a claim.

---

## 5. The acceptance, as a test rather than a claim

`server/castingV2/newKindCost.test.ts` drives the whole thing:

- a scaffold subject card runs through the same derivations the shipped tables
  use, and every view answers for a kind nothing else has heard of;
- flipping one field enrols it in one list and moves nothing else;
- a scaffold facet answers both word tables (preservation and panel naming);
- a scaffold region answers both region tables, with the phrasing optional;
- and the control: the same derivations over the **shipped** cards know nothing
  about any scaffold, so the assertions above are about something.

Sabotage record for the milestone: every derived table has at least one arm that
reddens when a card's answer is changed, and each sabotage was verified to
redden **exactly one** test.
