# Promotion pass — section 09, moderator investigations

Per `docs/specs/Casting-ui-ux-design/drape-redesign/PROMOTION-PASS.md`, run
after the section, before it is called done. **And it carries the closing note
his §9 asks for, because this is the last staff brief and the lane closes with
it.**

---

## 1 · What the section added

| thing | where | real consumers today |
|---|---|---|
| `LeaderRow` + `.dp-leader*` | **promoted** to `foundation/primitives.tsx` | 1 file (`ReconciliationSubTab`), 12 mounts |
| `ConfirmDialog`'s `notes` + `cancelLabel` | **extended** in the foundation | 2 files (`ReconciliationSubTab`, `UserInvestigationWidgets`) |
| `investigations.css` (`dp-inv__*`) | stays in `features/moderator/` | 5 files in the section |
| `section09-guard.test.ts` | stays | — |

## 2 · What was promoted, and what deliberately was not

### `LeaderRow` — promoted, on his §9's instruction

> *"The leader row (label · spacer · mono value, hairline before subtotals) —
> now on Settings, Overview and here. This is the most-used row in the product
> and it should be a component by the end of this PR."*

Promoted to `primitives.tsx` on his §4c specification: `align-items: baseline`,
`gap: 10px`, `padding: 6px 0`, the value at 12px mono, and one variant — a
hairline above a subtotal with `500` on the **label**, never the value.

⚠ **Two of the three consumers he names are not consumers, and that changes what
shipped.**

- **Settings is not one.** `.dp-set__row` takes an interactive **control** on
  the right — a toggle, a field, a button — not a measured value. Same
  silhouette, different job. Checked at the file before believing the brief.
- **Overview IS one**, with three real consumer files (`GovernanceCard`,
  `SystemStatusCard`, `UserGrowthCard`) — **and it is not converted here.**
  `.dp-ov__leader` differs in four measured properties (`align-items` center vs
  baseline, gap 8 vs 10, padding 7 vs 6, value 11.5px vs 12px) and in its
  divider grammar: a `border-bottom` between **every** row, rather than a
  hairline before a **subtotal**.

  Converging it would change the rendered pixels of a section that shipped
  **yesterday** behind 66 guard arms, inside a PR about a different section.
  `PROMOTION-PASS.md` settles that directly — *"NOT a refactor … NOT a chance to
  tidy the original"*, and *"if a promotion needs a rewrite to be general it is
  not ready — leave it and log it."*

  ⚠ **So it is logged, and the honest cost is stated: the tree carries two leader
  rows for one cycle.** That is the thing this pass exists to prevent, and it is
  accepted here only because the alternative is repainting a signed-off surface
  from an unrelated brief. **Filed as a card**, with both specs quoted, so the
  next section that touches Overview converges rather than rediscovers.

### `ConfirmDialog`'s notes block — extended, two consumers on day one

His §4a asked for *"the promoted confirm dialog, with the notes field inside
it"* and said *"the dialog already handles required-input-before-arming, from
the delete-cast spec."* Half right: `DestructiveConfirm` does hold that
behaviour, but its input is **typing a cast's first name** beside a desaturated
portrait — the delete-cast ceremony, not a general dialog. `ConfirmDialog` had
no input at all and a hard-lettered `Keep it` cancel.

So the behaviour moved to `ConfirmDialog` as an **optional** block, and two real
consumers landed with it: unfreeze in `ReconciliationSubTab`, and freeze/unfreeze
in `UserInvestigationWidgets` — the latter a **fifth hand-rolled dialog** with
its own `bg-emerald-600` / `bg-red-600` confirms.

### The date-range filter — NOT promoted

His §9 lists it as a candidate with *"Reconciliation and at least two moderator
tables"*. The two moderator tables use **`.dp-tableselect` inside `TableHead`**
(brief 06's pattern); Reconciliation's sits in a wrapping filter row with a
clear affordance. One shape has a table head to live in and the other does not,
so a shared component would need a wrapper prop on its first day. **Left, and
logged** — the pass's own instruction for a promotion that needs a rewrite.

## 3 · Collisions checked before adding anything

`grep` of `foundation/` for the behaviour, not the name, before each addition:

- **leader row** → `.dp-ov__leader` found (§2 above). `.dp-set__row` found and
  ruled a different thing.
- **verdict band** → nothing in the foundation states a headline beside one
  large figure. `.dp-kpi*` (brief 07) is a stat card with a sparkline, keyed on
  counts. **Not promoted**: one consumer, and his §9 hedges it himself
  (*"and, if it fits, Overview's failure card"* — it does not).
- **required-note dialog** → `DestructiveConfirm` found and ruled the wrong
  shape (§2 above).
- **count tiles** → `.dp-countrow` / `.dp-counttile` already existed from brief
  06 and were **used rather than re-drawn** (`StatsCards`).
- **section head** → `TableHead` already existed with 22 consumers; used.

## 4 · Nothing was renamed on the way out

`dp-inv__*` collides with nothing. `.dp-leader*` is new.

---

# ⚠ 5 · THE CLOSING NOTE — the staff lane, five briefs on

> **His §9, verbatim:** *"Write a closing note when this lands: which of section
> 00's nine components ended up with real consumers, and which never did.
> Anything still at zero after five staff briefs and Settings should be deleted
> rather than carried — that was the standing agreement when the lane restarted,
> and this is the moment to honour it."*

**Derived, not typed** (`scripts/_399-consumers-disposable.mts`): the population
is read out of `primitives.tsx`, the consumers counted across every `.tsx` in
the client.

⚠ **`pages/AdminFoundation.tsx` is excluded and counted separately.** It is the
foundation's own showcase — it mounts everything by design, so counting it makes
every component look adopted and the question unanswerable. A gallery of a thing
is not a use of it.

## Section 00's nine, at the close

| component | real consumers | verdict |
|---|---|---|
| `DataTable` | **15** | adopted — the lane's biggest win |
| `ExpandableRow` | 0 outside the foundation, **rendered by `DataTable`** | adopted as a **part**, not a surface. Kept |
| `SurfaceBar` | 1 (`features/staff/StaffBar.tsx`) | adopted |
| `MediaCard` | 0 | **kept — see below** |
| `HoverActions` | 0 | **kept — see below** |
| `Marquee` | 0 | **kept — see below** |
| `CostedOption` | 0 | ✂ **DELETED** |
| `MilestoneRail` | 0 | ✂ **DELETED** |
| `Transcript` | 0 | ✂ **DELETED** |

## The three that went, and why those three

All three name **Crew** in their own docblocks — *"Crew decisions, run scopes,
model picks"*, *"Crew today"*, *"Crew today"*. Crew shipped in **#398** without
any of them, and **#410** measured why none fits:

- `MilestoneRail` reads off **counts**; Crew's rungs carry a four-value `state`
  and no counts, and the component's own docblock forbids a state prop by name.
- `Transcript` is **two-speaker**; Crew has one.
- `CostedOption` is a `<button>`; Crew's options are read-only text he answers
  by typing.

They were written for a surface that then chose otherwise. That is the exact
population his standing agreement is about, and #410 was already open on it.

**What the deletion touched:** the three components and their four types in
`primitives.tsx`, seven barrel rows, two showcase sections, and 2,690 bytes of
CSS across `.dp-costed*`, `.dp-milestones*` and `.dp-transcript*`.

⚠ **`section00-guard.test.ts`'s four transcript arms went with it — and the way
they died is the finding worth keeping.** `block()` **REFUSED** —
*"selector .dp-transcript__who is gone — the guard below guards nothing"* —
rather than matching an empty string and passing. A guard that reports its own
subject's disappearance is the difference between a deletion being noticed and a
suite going quietly green over four fewer rules. Its measurement is preserved
here so a future transcript need not rediscover it: **"night shift" needs 69.3px
at the 10.5px mono floor and clips at 64px, so the column is 80px and does not
shrink.**

## ⚠ The three that stayed, and why "zero" is not evidence about them

`MediaCard`, `HoverActions` and `Marquee` also read zero — **and deleting them on
that reading would be the wrong lesson learned from the right rule.**

They were written for the **media and marketing surfaces**: a candidate card
with a hover-revealed action row, and an auto-scrolling template row on the
Canvas tab header. **No staff brief was ever going to mount them.** *"Zero after
five STAFF briefs"* says something about a component the staff lane could have
used and did not; it says nothing about one aimed at the customer work that
begins next.

**Their test is the first customer section, not this one.** If they are still at
zero when that lane closes, they go on the same rule.

## The rest of the foundation, for completeness

Six more read zero outside the showcase — `RequiredMarker`, `DerivedChip`,
`MediaFrame`, `GradientTile`, `Progress`, and `ExpandableRow` (a part). None is
one of the nine, and all but `ExpandableRow` belong to the same
customer-surface population as the three above.

**Adopted, most-used first:** `Button` 40 · `TableHead` 27 · `DataTable` 15 ·
`Input` 12 · `Skeleton` 10 · `Field` 8 · `EmptyState` 8 · `TableFilter` 8 ·
`Card` 4 · `ScopePill` 4 · `TableSearch` 4 · `Chip` 2, then eleven at one each
including `LeaderRow`, new today.

⚠ `Button`'s 40 and `Input`'s 12 are **inflated** and the number is left honest
rather than quietly corrected: the matcher is `<Name`, and `components/ui/` and
`components/design-system/` each declare their own `Button` and `Input`. Every
count for a *distinctively named* component — which is all nine of section 00's —
is exact.
