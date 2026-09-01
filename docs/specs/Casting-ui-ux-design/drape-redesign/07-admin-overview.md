# Admin Overview — the dashboard

**One PR. Prerequisites: the staff shell, and ideally the staff tables (for the promoted parts).**

Live reference: `design_handoff_studio/Klieg Studio.dc.html` — account menu → Admin → Overview.

---

## 1. What this is

`AdminOverview` plus the seven cards in `overview/`: `HealthMetrics`, `UserGrowthCard`, `CreditEconomyCard`, `GovernanceCard`, `SystemStatusCard`, `BannerManagement`, `AlertsFeed`.

Every query, every number and every chart series stays. What changes is what leads, and what colour means.

**Excluded:** the tables (own brief), Crew, the moderator's investigative tools. The `admin.getOverview` and `admin.getTimeSeries` queries are untouched.

---

## 2. The dashboard leads with what needs a decision

Today it opens on four KPI cards — success rate, active users, generations, failures — then charts, then alerts in a right column.

In the design the first section is **NEEDS A HUMAN**: the things waiting on a person, stated once, at the top. Pending change requests, unanswered Crew cards, flagged discrepancies, critical alerts. Metrics come second.

The reason: an admin opens this page to find out *whether anything needs them*. A success rate of 97% does not need them. Four pending change requests do. Leading with metrics means the answer to the only urgent question is below three cards of reassurance.

`GovernanceCard` and `AlertsFeed` already hold most of this data — this is a promotion of what they contain, not a new query.

---

## 3. Colour inverts: fine is colourless, wrong is accent

This is the largest change and it touches every card.

Today: healthy is `text-emerald-600`, warning `text-amber-600`, critical `text-red-600`; the alerts feed maps thirteen action types to blue, emerald, amber and red backgrounds; the charts use `#10b981` and `#f87171` with gradient fills. That is **seven Tailwind tints** — `section00-guard.test.ts` already counts them.

The rule: **accent means state, and there is no green.** So:

| | Today | Becomes |
|---|---|---|
| Healthy / normal / passing | emerald | greyscale — `--ink` value, `--faint` label |
| Needs attention | amber | `--accentWash` / `--accentLine` / `--accentInk` |
| Genuinely urgent | red | `--error` family |
| Action *type* (frozen, suspended, refund…) | blue / emerald / amber / red | greyscale — the label says which |

**A dashboard where everything is fine should be colourless.** That is what makes one coral card mean something at a glance. Right now a healthy platform is as colourful as a broken one, so colour carries no information and the eye has nothing to land on.

**`ACTION_CONFIG`'s colour and background fields go entirely.** Thirteen action types tinted four ways is colour encoding a category, which the system forbids for a concrete reason: it leaves nothing left to say *urgent*. Keep the icons and the labels; those do the identifying. Severity — critical vs warning — is the only thing that may carry colour, and only critical gets `--error`.

**No `animate-pulse` on a healthy dot.** A pulse means *in progress* in this product (a generating node, a running job). A steady green dot that pulses forever trains people to ignore motion. Pulse only when critical.

**No `font-bold`.** `text-3xl font-bold` appears on every KPI. The foundation states 600 is never used; 700 is further out. Values are `500 26px JetBrains Mono`, `tabular-nums`.

---

## 4. Layout

The shell provides the frame. Inside the scrolling pane:

```css
max-width: 1240px; margin: 0 auto;
padding: 26px 32px 48px;
display: flex; flex-direction: column; gap: 26px;
```

Sections in order: **Needs a human · Last 24 hours · Charts · System and banners · Recent alerts**.

**One column, sections stacked.** Drop the `lg:grid-cols-5` with `col-span-3` / `col-span-2`. That split puts alerts in a narrow right rail where each row truncates at `max-w-[280px]`, and it means the page has two reading orders depending on width. Every section is full width and self-sizing.

**Every grid is `repeat(auto-fit, minmax(N, 1fr))`**, never a fixed column count:

| Section | minmax |
|---|---|
| Needs a human | `232px` |
| Last 24 hours | `198px` |
| System / banners | `292px` |

### Section heads

Every section opens with the same three-part head:

```css
display: flex; align-items: center; gap: 11px;
```
Mono eyebrow `500 9.5px JetBrains Mono`, `.13em`, `--metaStrong`, `flex: none` · a `flex: 1` `--rule` hairline · optional right-aligned meta in `400 11px Archivo` `--faint`.

`NEEDS A HUMAN` · `LAST 24 HOURS` · `SYSTEM` · `RECENT ALERTS`. Sentence case everywhere else in the product; these eyebrows are the one uppercase device.

---

## 5. Needs a human

```css
display: flex; flex-direction: column; gap: 9px;
padding: 14px 15px;
border: 1px <style> <colour>;
border-radius: var(--r-xl);
cursor: pointer;
/* hover */ border-color: var(--ink);
```

**Dashed border while unresolved, solid once handled.** Load-bearing across the whole product — dashed means *not yet*.

Contents:
1. A row: 6px dot · kind in `500 8.5px` mono `.1em` · `when` in `400 10px` mono `--faint`, `flex: none`
2. The line — `400 13px/1.5 Archivo`, `--ink`, `text-wrap: pretty`
3. The next step — `400 11px Archivo`, `--metaStrong`

The dot animates `dp-pulse` **only** when the item is urgent.

Each card is a link to where the decision gets made — the Requests tab, the Crew tab, the audit table filtered to that entry. The head's right-hand meta reads the total: `4 waiting`.

**When nothing needs a human, the section disappears** — no empty card, no "all clear" reassurance. Its absence is the message, and it is the strongest signal the page can send.

---

## 6. Last 24 hours

The four KPIs, restyled. `minmax(198px, 1fr)`.

```css
display: flex; flex-direction: column; gap: 11px;
padding: 15px 16px;
border: 1px solid var(--borderCard);
border-radius: var(--r-xl);
background: var(--surface);
```

| Element | Spec |
|---|---|
| Label | `500 8.5px JetBrains Mono`, `.11em`, `--faint` — `SUCCESS RATE`, `ACTIVE USERS`, `GENERATIONS`, `FAILURES` |
| Value | `500 26px JetBrains Mono`, `-.02em`, `tabular-nums`, `--ink` |
| Delta | `400 11px JetBrains Mono` beside it, baseline-aligned |
| Sparkline | `height: 26px`, 14 bars, `flex: 1`, `gap: 2px`, `border-radius: 1px` — `--dotsStrong`, with the last bar `--ink` |
| Foot | `400 10.5px Archivo`, `--faint` |

**The last bar is `--ink`** — that is today, and it is the only bar that needs distinguishing.

The delta is `--accentInk` only when it is moving the wrong way. `+4%` on success rate is greyscale; `+18` on failures is accent.

The Failures card takes `--accentLine` border and `--accentWash` background when failures are non-zero, `--error` when critical. Its foot sentence stays as it is — *"Investigate immediately"* / *"No failures in 24h"* — it is well judged.

**Drop the icon in each card's top-right.** `Users`, `Activity`, `AlertTriangle` at `text-[#bbb]` — the label already says what the number is, and four decorative glyphs across a KPI row is the pattern that makes dashboards look generic.

---

## 7. Charts

Keep recharts and keep every series. Restyle:

- **`LineChart`, not `AreaChart` with gradient fills.** The two `linearGradient` defs go. There are no decorative gradients in this system — the exceptions are the brand orb and the generating halo, and both mean something.
- **Two series, distinguished by role not category:** completed is `--ink` at `strokeWidth: 1.7`; failed is `--accentSolid`. Failure is an attention state, so accent is legitimate here — this is the one chart where a second colour is earned.
- `CartesianGrid` stroke `--rule`, keep `strokeDasharray="3 3"`.
- Axis ticks `10px JetBrains Mono` at `--faint`; axis lines `--border`; no tick lines.
- Tooltip: `background: var(--surface)`, `border: 1px solid var(--borderCard)`, `border-radius: var(--r-sm)`, `box-shadow: var(--shadowPop)`, `12px Archivo`.
- Legend dots become 8px squares at the series colour, label `400 11px` `--metaStrong`.
- Titles sentence case: `Generation activity`, and the sub-line stays.

Read the token values through `getComputedStyle` on `:root` rather than hard-coding, so the charts follow the theme. Charts are the one place a token cannot be a CSS variable, and hard-coded light hex in a chart is why staff surfaces break in dark.

`UserGrowthCard`, `CreditEconomyCard` and `GovernanceCard` follow the same treatment — same axis styling, same one-series-plus-accent rule, same sentence-case titles.

---

## 8. System, banners, alerts

**System and banners** — `minmax(292px, 1fr)`, same card shell as the KPIs, mono `.11em` `--faint` label heads (`SYSTEM`, `BANNERS`). Leader/hairline rows inside: label left, value right in mono. Uptime and server start are measured numbers, so mono.

**Banner management** keeps every action. Its create form uses the foundation's field and button primitives.

**Recent alerts** — full width now, so nothing truncates at 280px.

- Keep the timeline: a 24px icon tile, then a `1px` `--border` connector down to the next.
- **Icon tile is greyscale** — `background: var(--fill)`, icon `--metaStrong`. Critical entries get `--accentWash` + `--accentInk`.
- Row: label `500 11.5px Archivo` · `#id` in mono `--faint` · a `flex: 1` **spacer** · time in `400 10px` mono `--faint`. **Not `ml-auto`** — auto margins resolve to hard pixels under any computed-style read, overflow the row, and clip.
- Metadata preview `400 11px Archivo` `--metaStrong`, one line, ellipsis, no `max-w`.
- **Remove `max-h-[460px] overflow-y-auto`.** The staff pane already scrolls; a scrolling region inside a scrolling page traps the wheel and hides rows behind an inner edge. Cap the list at 12 and link to the audit table for the rest.
- Severity summary pills: critical in `--error` family, warning in accent, both omitted at zero.
- `View all →` becomes `All audit entries` with a 11px chevron, `400 11.5px` `--metaStrong` → `--ink` on hover.
- Empty state uses the `EmptyState` primitive — one line of what is absent, no 40px 20%-opacity icon.

---

## 9. Loading, empty, error

**Loading** — `Skeleton` at each section's real height. The current four-then-one-then-two skeleton is close; keep the shape, use the primitive.

**Error** — the `--error` family, not `bg-red-50 border-red-200`. One line of what failed, the raw message below it in mono, and Retry. Staff surfaces keep raw error text on purpose — `rawErrorToast.test.ts` already argues this and it is right.

**Delete the `Data as of …` footer.** It is 10px centred `#bbb` — below the type floor — and it duplicates the staff bar's stamp, which is the correct home for it.

---

## 10. What NOT to do

- **Do not lead with metrics.** Needs a human is first.
- **Do not use green.** Not for healthy, not for success, not for a chart series.
- **Do not tint by action type.** Icons and labels identify; colour is for severity only.
- **Do not pulse a healthy dot.**
- **Do not use `font-bold` or `font-semibold`.**
- **Do not keep the gradient fills.**
- **Do not hard-code chart colours.** Read them from the tokens.
- **Do not nest a scrolling region** inside the scrolling pane.
- **Do not use `ml-auto`.** Spacers.
- **Do not keep the 5-column split.** One column, stacked sections.
- **Do not show an "all clear" card** when nothing needs attention. Omit the section.
- **Do not add a query or change a mutation.**
- **Do not add decorative icons** to KPI cards.

---

## 11. Definition of done

- [ ] `NEEDS A HUMAN` is the first section, and it disappears entirely when empty.
- [ ] Zero greens, zero blues, zero ambers. `token-guard` extended over `overview/` and passing.
- [ ] Healthy state is greyscale; accent appears only where something needs attention; `--error` only for critical.
- [ ] `ACTION_CONFIG` has no colour or background fields.
- [ ] No `animate-pulse` except on urgent items.
- [ ] No `font-bold` / `font-semibold` anywhere in the section.
- [ ] All KPI values `500 26px JetBrains Mono` with `tabular-nums`; no decorative card icons.
- [ ] Charts are `LineChart`, no gradient defs, colours read from tokens, sentence-case titles.
- [ ] One column; every grid `auto-fit` with a `minmax`; nothing in a fixed-span rail.
- [ ] Alerts feed is full width with no inner scroll and no `max-w` truncation; capped at 12 with a link out.
- [ ] `Skeleton` and `EmptyState` primitives used; no bespoke spinners or 40px icons.
- [ ] `Data as of` footer removed.
- [ ] Every number, series and action identical to before.
- [ ] Both themes — including the charts, which is the part most likely to be missed.

---

## 12. Then the promotion pass

Per `PROMOTION-PASS.md`.

Two candidates arrive with real second consumers here: the **section head** (eyebrow + hairline + meta), which now appears on Overview, the tables and Settings; and the **stat card** (mono label, mono value, sparkline, foot), which Settings → Usage also needs — and got wrong, per its own review.

The **attention card** has one consumer today. Leave it; Crew may claim it as the second.

Check for a chart-token helper too. If `UserGrowthCard`, `CreditEconomyCard` and `GovernanceCard` each read `:root` separately, that is three copies of the same six lines.
