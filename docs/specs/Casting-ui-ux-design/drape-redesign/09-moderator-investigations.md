# Moderator investigations — the last staff brief

**One PR. Prerequisites: the staff shell, and the staff tables (for the promoted parts).**

Live reference: `design_handoff_studio/Klieg Studio.dc.html` → Moderation → Reconciliation, for the surface grammar.

This is the fifth and last staff brief. After it, the staff lane is done and the customer surfaces begin.

---

## 1. What this is

The three moderator surfaces that are not tables:

| Surface | Size | What it answers |
|---|---|---|
| `ReconciliationSubTab` | 16.8KB | Do this account's credits and generations agree? |
| `UserInvestigationTab` + `UserInvestigationWidgets` | 26KB | What has this account actually been doing? |
| `CreditsSubTab` | 11.4KB | Where did this account's credits come from and go? |
| `FlaggedDiscrepanciesCard` | 7.6KB | Which accounts need looking at? |

**If `CreditsSubTab` turns out to be a plain filtered list, it belongs in brief 06's pattern instead.** Check before starting; do not build a bespoke ledger for something the table already handles.

`ActivitySubTab` and `GenerationsSubTab` are table-shaped and were covered by brief 06.

Every query, mutation, CSV export and date filter stays exactly as it is.

---

## 2. The shape: an investigation is subject → verdict → evidence → action

Brief 06 named the pattern for lists. This is the pattern for the other kind of staff surface, and naming it once is most of the work:

1. **Subject** — who or what is being looked at, and its current state.
2. **Verdict** — the answer, stated plainly, as the most prominent thing on screen.
3. **Evidence** — the workings, in whatever detail is needed, below the verdict.
4. **Action** — what a moderator can do about it, at the end.

Today Reconciliation runs the other way: a banner, then two dense columns, then a six-row table whose **last** line is the discrepancy — the answer to the entire view, in 12px, at the bottom.

**Lead with the verdict.** Same argument as the Overview brief: a moderator opens this to find out whether something is wrong, and the number that answers that should be the largest thing in the pane.

---

## 3. Colour: the numbers are the content, so almost none of them get colour

This is the sharpest version of the rule in the whole product, because here the numbers *are* the page.

Reconciliation currently uses **five colours**: emerald for earned and refunds and completed and "all clear", red for spent and discrepancy, amber for pending and frozen and failures, blue for the credits column, purple for the generations column.

Two things are wrong with that, and the second is worse:

**Green for earned and red for spent is the accounting convention, not this product's.** Spending credits is what the product is *for*. Colouring it red says a normal, healthy, revenue-generating action is a problem.

**When everything is coloured, the discrepancy is not.** It sits in `text-red-700` at 12px among a dozen other coloured figures. The one number that means "something is wrong here" has no way to stand out.

So:

| | Today | Becomes |
|---|---|---|
| Earned, spent, refunds, completed, gross, net | emerald / red | **mono, `--ink`** |
| Pending | amber | mono, `--metaStrong` |
| Column labels | blue / purple dots | greyscale, no dots |
| "All clear" | emerald banner | **greyscale, quiet** |
| Failed generations, high failure rate | amber | `--accentInk` |
| Discrepancy, non-zero | red | `--errorInk`, and large |
| Discrepancy, zero | emerald | `--ink`, and large |
| Frozen account | amber | `--accentWash` / `--accentLine` / `--accentInk` |

**The blue and purple dots go.** Two columns headed *Credit transactions* and *Generation records* do not need colour-coding — the headings identify them, and colour encoding a category is banned precisely so it stays available for the discrepancy.

**Signs carry the direction, not colour.** `+2,400` and `−1,860` in `--ink` mono are unambiguous; the sign is the information.

---

## 4. Reconciliation, restructured

The 790px reading column does not apply here — investigations are working surfaces, so **1240px**, as with the tables.

### 4a. Subject band, only when there is something to say

The frozen-account banner keeps its content and takes the accent treatment:

```css
display: flex; align-items: flex-start; gap: 12px;
padding: 14px 15px;
border: 1px solid var(--accentLine);
border-radius: var(--r-xl);
background: var(--accentWash);
```
Title `500 12.5px Archivo` `--accentInk`; the reason line `400 11.5px/1.55` `--metaStrong`; the frozen date in mono.

**Unfreeze routes through the promoted confirm dialog**, with the notes field inside it. Today it expands an inline form whose confirm button is `bg-emerald-600` — a green primary on a security action, and the only place in the product that would be green. The dialog already handles required-input-before-arming, from the delete-cast spec.

When the account is not frozen, no band. Do not add an "account in good standing" card.

### 4b. The verdict

Directly below the subject, above everything else:

```css
display: flex; align-items: flex-start; gap: 16px; flex-wrap: wrap;
padding: 16px 17px;
border: 1px solid <line>;
border-radius: var(--r-xl);
background: <bg>;
```

Left, a `flex: 1; min-width: 220px` column:
- Mono eyebrow `500 9px` `.12em` `--faint` — `RECONCILIATION`
- The headline in `400 15px/1.4 Archivo` `--ink` — `The ledgers agree.` / `1,240 credits unaccounted for.` / `Failures were refunded.`
- The existing `reconciliation.summary` beneath it in `400 12px/1.6` `--metaStrong`

Right, `flex: none`, right-aligned:
- Mono eyebrow `DISCREPANCY`
- The figure in **`500 30px JetBrains Mono`**, `-.02em`, `tabular-nums` — `--errorInk` when non-zero, `--ink` when zero, with its sign.

Clean: `--borderCard` on `--surface`. Failures refunded: `--accentLine` on `--accentWash`. Discrepancy: the `--error` family.

Keep the three-way headline logic that exists — it is well judged. Only the tone changes, and `All Clear` becomes `The ledgers agree.`

### 4c. Evidence — the two columns

`repeat(auto-fit, minmax(292px, 1fr))`, `gap: 12px`. **Not `grid-cols-2`** — two columns of dense figures at 500px each is unreadable, and this pane can be that narrow when the rail is open on a laptop.

Each side is the standard card shell with a mono eyebrow head — `CREDIT TRANSACTIONS`, `GENERATION RECORDS` — and leader rows inside:

```css
display: flex; align-items: baseline; gap: 10px;
padding: 6px 0;
```
Label `400 11.5px Archivo` `--metaStrong`, then a `flex: 1` spacer, then the value in `400 12px JetBrains Mono` `--ink`. A `--rule` hairline above any subtotal row; subtotal labels `500`.

The `By type` sub-blocks keep their structure: a mono `.1em` `--faint` eyebrow `BY TYPE`, then the same leader rows at `11px`. Sentence-case the type labels — the existing `replace(/_/g, " ")` and camel-split are right, just lower the case.

**The `(info as any)` casts should go** while you are in there. Not a design note, but the types exist.

### 4d. Evidence — the workings

The six-row reconciliation table becomes leader rows in one card, `RECONCILIATION` eyebrow, hairlines before the two subtotals.

**The discrepancy row is deleted from this card.** It is the verdict, it is at the top at 30px, and repeating it at the bottom in 12px is the same double-count the Crew work removed. The workings end at *Recorded charges*.

### 4e. Filters and export

One row, wrapping: mono `DATE RANGE` eyebrow, two date inputs, then a **`flex: 1` spacer** — not `ml-auto` — then the CSV button.

Date inputs take the standard field shell: `padding: 6px 10px; border: 1px solid var(--borderInput); border-radius: var(--r-sm); background: var(--surface)`, value in `400 11.5px` mono. Keep the clear affordance; make it a 12px close glyph at `--meta`.

CSV keeps its download icon and becomes a secondary button. **The CSV export itself is untouched** — `reconciliation-csv.ts` does not change.

---

## 5. User Investigation and Credits

Same four-part shape, same rules. Without reading all 37KB I will not pretend to specify them row by row — apply the pattern:

**Subject first.** Who this account is, its state, when it joined, what it is on. One band, not repeated in three widgets.

**Verdict second.** Each widget answers a question; state the answer before the workings. If a widget has no verdict — it is purely a list — it belongs in brief 06's table pattern instead, and moving it there is the right outcome.

**Evidence in leader rows and the shared table.** No bespoke `<table>` markup; no second pager; no per-widget spinner.

**Actions last**, through the promoted confirm dialog for anything irreversible, each with a specific consequence note beside it.

**`FlaggedDiscrepanciesCard`** is a list of accounts needing attention. It is the moderator's equivalent of Overview's *needs a human*: dashed cards while unresolved, solid once handled, each linking to that account's reconciliation. Check whether Overview's attention card serves it before writing a second one.

---

## 6. Type and tokens

- Every measured value in **JetBrains Mono** via `var(--font-mono)`, not Tailwind's `font-mono`. The instinct to use mono here was already right.
- **Nothing below 10.5px.** `text-[10px]` and `text-[9px]` appear throughout; the floor is 10.5px for mono meta and 8.5px for uppercase mono eyebrows only.
- **No `font-medium` doing the work of a subtotal.** A hairline above and `500` on the label; the value stays `400`.
- **Sentence case everywhere.** `Total earned`, `Net generation cost`, `By type`, `Date range`, `Unfreeze account`, `Reconciliation details`.
- Every hex literal to a token, per the map in brief 08. `token-guard` extended over `features/moderator/`.
- `Skeleton` and `EmptyState` primitives; the current `Skeleton className="bg-[#E5E5E5]"` and the bare `No data available` both go.

---

## 7. What NOT to do

- **Do not use green.** Not for earned, not for refunds, not for "all clear", not for a confirm button.
- **Do not colour normal operation.** Spending credits is the product working.
- **Do not colour-code the two columns.**
- **Do not leave the discrepancy at the bottom**, and do not show it twice.
- **Do not keep `grid-cols-2`.**
- **Do not use `ml-auto`.**
- **Do not build a second confirm dialog**, a second pager, or a second table.
- **Do not add an "account in good standing" card.**
- **Do not change the CSV export, any query, or any mutation.**
- **Do not build a bespoke surface for anything that is really a list.** Route it to brief 06.

---

## 8. Definition of done

**Reconciliation**
- [ ] Order is subject → verdict → evidence → filters; the discrepancy is the largest figure in the pane and appears once.
- [ ] `The ledgers agree.` when clean, and that state is colourless.
- [ ] Earned, spent, refunds, gross and net are all mono `--ink`; signs carry direction.
- [ ] No blue or purple column dots.
- [ ] Frozen band uses accent; unfreeze goes through the promoted confirm dialog with its notes field; no green button anywhere.
- [ ] Evidence columns are `auto-fit minmax(292px, 1fr)`.
- [ ] Workings are leader rows, ending at *Recorded charges*.
- [ ] Date filters and CSV in one wrapping row with a spacer, not `ml-auto`.

**Across all three**
- [ ] Every widget states its verdict before its workings, or has moved to the table pattern.
- [ ] `FlaggedDiscrepanciesCard` uses dashed-while-unresolved and links through to reconciliation.
- [ ] Every measured value mono; nothing below 10.5px; sentence case throughout.
- [ ] Zero hex literals under `features/moderator/`; `token-guard` extended and passing.
- [ ] `Skeleton` and `EmptyState` primitives everywhere.
- [ ] Every number, filter, export and action identical to before.
- [ ] Both themes.

---

## 9. Then the promotion pass — and the lane closes

Per `PROMOTION-PASS.md`. Candidates arriving with real second consumers:

- **The leader row** (label · spacer · mono value, hairline before subtotals) — now on Settings, Overview and here. This is the most-used row in the product and it should be a component by the end of this PR.
- **The verdict band** (eyebrow, headline, summary, one large mono figure) — Reconciliation and, if it fits, Overview's failure card.
- **The date-range filter** — Reconciliation and at least two moderator tables.

**Write a closing note when this lands**: which of section 00's nine components ended up with real consumers, and which never did. Anything still at zero after five staff briefs and Settings should be deleted rather than carried — that was the standing agreement when the lane restarted, and this is the moment to honour it.
