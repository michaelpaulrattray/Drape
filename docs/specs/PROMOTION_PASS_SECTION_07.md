# Promotion pass — section 07, the admin dashboard (#397)

Per `docs/specs/Casting-ui-ux-design/drape-redesign/PROMOTION-PASS.md`, run
after the section was built and before it is called done. Founder's reason,
2026-09-01: *"we will be making a bunch of ui changes soon and its better to
have these as reusable components rather than keep re-designing them."*

**Outcome: nothing moves.** One part is measured over the promotion bar and is
still recommended to stay, with the departure stated rather than hidden; one
foundation gap is found and recorded; one collision candidate is left to the
seat that already owns it. No behaviour changes in this document's name.

---

## 1 · What the section added

| part | kind | real consumers TODAY | verdict |
|---|---|---|---|
| `chartTokens.ts` — `useChartTokens`, `tooltipStyle`, `axisTick` | hook + helpers | **4** — `HealthMetrics`, `UserGrowthCard`, `GovernanceCard`, `CreditEconomyCard` | **stays** (see §3) |
| `actionLabel.ts` | pure function | **2** — `AlertsFeed`, `NeedsHuman` | **stays** (see §3) |
| `NeedsHuman.tsx` | component | 1 — `AdminOverview` | stays |
| `GenerationChart` (in `HealthMetrics.tsx`) | component | 1 — `AdminOverview` | stays |
| `.dp-kpi*` — the KPI/stat card | CSS block | 1 — `HealthMetrics` | stays (see §4) |
| `.dp-attn*` — the attention card | CSS block | 1 — `NeedsHuman` | stays; the brief itself says *"the attention card has one consumer today. Leave it; Crew may claim it as the second"* |
| `.dp-ov*` — the section's own sheet | CSS block | 1 section | stays |

Counted by grepping for imports across `client/src`, excluding tests and
barrels — **files that import it today, never planned surfaces**. That method
is his own correction on #262: *"I broke my own rule in the same document,
counting surfaces in the design instead of consumers in the code. Your
measurement is the correct one. From here: two real consumers in the codebase,
or it waits."*

---

## 2 · ⚠ The brief's two promotion candidates: one was already promoted, the other has no second consumer

§12 offers two parts as arriving here with real second consumers. Read at the
code, **neither is what the brief thought**.

### (a) The section head is `TableHead`, and it landed one brief ago

§12: *"the **section head** (eyebrow + hairline + meta), which now appears on
Overview, the tables and Settings."* It appeared in **#396**. `.dp-tablehead`
is §4's spec clause for clause — `display: flex; align-items: center;
gap: 11px`, eyebrow `flex: none`, a `flex: 1` `--rule` hairline, an optional
right cluster. **There was nothing to promote and no third head was built.**

Its consumers went **8 → 13** with this card (`AlertsFeed`, `HealthMetrics`,
`NeedsHuman`, `AdminOverview` ×2).

⚠ **The finding worth carrying forward is its NAME.** It now heads
`NEEDS A HUMAN`, `LAST 24 HOURS` and `SYSTEM AND BANNERS`, none of which is a
table. The pass says *rename on the way in, never after*, and this is "after":
13 consumers, a CSS block and two guards. **Recommended as its own small PR**,
not smuggled into a section build — `TableHead` → `SectionRule` would be
mechanical and reviewable on its own.

⚠ **And `SectionHead` — the name the brief's words point at — is a different
component and must not be folded into it.** Baseline row,
`justify-content: space-between`, `border-bottom`; **15 consumers, two of them
`CastingV2.tsx`**. Casting is the frozen reference surface, so reshaping it to
match §4 would repaint the one page in the product that has had real design
put into it. `TableHead`'s own docblock anticipated exactly this: *"Two
different shapes, and folding them would give one component a mode switch."*

### (b) The stat card has no second consumer — Settings' is a different shape

§12: *"the **stat card** (mono label, mono value, sparkline, foot), which
Settings → Usage also needs — and got wrong, per its own review."*

Read at `client/src/features/settings/parts.tsx:173`: Settings' `StatCard`
takes `stats: { label, value, note }[]` and renders **N cells inside one
card**, with a derived column count and **no sparkline**. This section's KPI
card is **one card per stat, with a 14-bar sparkline**. Same words, two
different components; merging them would give one component a mode switch,
which is the thing §2(a) above just declined to do.

**So the stat card stays at one consumer.** If Settings' usage cells are meant
to become four sparkline cards, that is a Settings brief, and this block is
the second consumer it promotes with.

---

## 3 · The two new parts that clear the numeric bar and still stay — stated, not hidden

`useChartTokens` has **four** real consumers and `actionLabel` has **two**, so
both clear "two real consumers in the codebase". They are recommended to stay
in `features/admin/overview/` anyway, and the reasoning is one sentence:
**every consumer is inside this one section, and the foundation is a
cross-surface library.**

- **`chartTokens`** is recharts-specific. Measured: the only other file in
  `client/src` that imports recharts is `components/ui/chart.tsx`, and it has
  **zero consumers** (see §5). So there is no second *surface* with a chart to
  serve, and promoting would put a charting helper into a foundation that has
  no charting primitive. **The moment a second surface draws a chart, this is
  the first thing to promote** — it is the module that stops a hard-coded light
  hex reaching an SVG, which is the defect §7 of the brief exists to kill.
- **`actionLabel`** is about audit-action strings. Only staff surfaces show
  those, and brief 09's moderator investigation tools are the plausible second
  consumer. **Recommended for promotion in #399** if that brief displays audit
  actions, which it likely will.

This is a departure from the pass's default and is written down for the same
reason #396 wrote down its two: a departure that is stated can be argued with,
and one that is silent cannot.

---

## 4 · ⚠ A real foundation gap, found by grepping rather than by the drive

**`Chip` has no selected state.** `.dp-chip` carries `:hover`, `--derived` and
`--static`, and nothing that says *this one is chosen*.

This was found the honest way and the finding matters more than the fix: the
first shape of `BannerManagement` reached for `dp-chip--on` — **a class that
exists nowhere** — so the chosen banner type rendered identically to the three
unchosen ones. A control that cannot show its own setting. **The 62-arm drive
passed over it**, because the banner form is behind a click and the pass had
never opened it. It was caught by grepping the foundation for the class before
writing this document.

- **Fixed section-locally** as `.dp-ov__typechip--on`, because adding a
  selected state to a shared primitive is a foundation decision with eight
  other consumers and this brief does not own it.
- **The drive now opens the form**, asserts four chips with exactly one
  selected and **two distinct computed looks**, and photographs it. That arm
  fails if the selected style ever goes inert again.
- **Recommended**: `Chip` gains a real `--on` state when a second surface needs
  one. Two would then exist and the collision resolves toward the foundation.

---

## 5 · Collisions checked

| candidate | collision? |
|---|---|
| `.dp-kpi*`, `.dp-attn*`, `.dp-ov*` | **none** — zero occurrences of any of the three prefixes in `foundation.css` or `modals.css` |
| `useChartTokens` / `tooltipStyle` / `axisTick` | none by name |
| `actionLabel` | none by name |
| **charting generally** | ⚠ `client/src/components/ui/chart.tsx` — shadcn's recharts wrapper, **zero consumers, ever** |

That last row is the same shape #396 found with `components/ui/table.tsx` and
deleted. **It is deliberately NOT deleted here.** It does not collide with
anything this card built — `chartTokens` is a token reader, not a chart
wrapper — and unused shadcn primitives are already an open Janitor card
(**#105**, *"40 unused shadcn/ui primitives carrying 21 unused @radix-ui deps"*).
Deleting it under this brief would be tidying the original, which the pass
forbids. **Filed against #105 rather than done.**

---

## 6 · The remaining hex debt in staff, counted rather than forgotten

`token-guard` now covers this whole directory — the eight components, the
token reader, the stylesheet and the page — and it reads **zero** hex
literals across all eleven, proven able to fail by a planted `#BADA55`
reddening exactly one arm.

The rest of `features/admin` + `features/moderator` still holds **630** hex
literals. Enrolled file-by-file as each brief rewrites its own surfaces, which
is how `features/staff` and then this directory arrived. The largest remaining,
measured:

| file | hex literals | owner |
|---|---|---|
| `moderator/ChangeRequestModal.tsx` | 89 | brief 09 |
| `moderator/ReconciliationSubTab.tsx` | 69 | brief 09 |
| `admin/components/crew/CrewBackgroundWork.tsx` | 59 | brief 08 |
| `moderator/UserInvestigationWidgets.tsx` | 58 | brief 09 |
| `admin/UserActionModals.tsx` | 45 | **no brief** |
| `admin/components/crew/CrewProgramBanner.tsx` | 41 | brief 08 |
| `moderator/CreditsSubTab.tsx` | 33 | brief 09 |
| `admin/components/crew/CrewWorkingNow.tsx` | 33 | brief 08 |
| `admin/AuditActionModals.tsx` | 29 | **no brief** |
| `moderator/FlaggedDiscrepanciesCard.tsx` | 27 | brief 09 |

⚠ **The five FORM modals remain the honest gap and this card does not close
it** — they are light-only, so a staff page in dark mode still opens a white
dialog. #396 named this and no brief owns it; `UserActionModals.tsx` and
`AuditActionModals.tsx` above are two of them. It is now the second card in a
row to report the same thing, which is the point at which it wants a card of
its own rather than a paragraph.

---

## 7 · One thing left undone on purpose

The banner delete still uses `window.confirm`. `DestructiveConfirm` is in the
foundation and this is a surface that should eventually use it, but swapping it
changes an action's *mechanism* inside a PR whose own bar is *"every number,
series and action identical to before"* (§11). Recorded here rather than
smuggled into a restyle.
