# Settings, plans, credits and referrals

**One brief, three surfaces, replacing five modals.** Supersedes `03-settings-modal.md` and `design_handoff_studio/09-settings-account.md` — delete both; two specs that disagree is worse than one that is thin.

Live reference: `design_handoff_studio/Klieg Studio.dc.html`. Open it and use it — account chip → Settings / Members & invites / Billing & credits, the topbar credits chip, and Settings → Billing → Change plan. **Where this brief and the prototype disagree, the prototype wins.** Do not work from screenshots; they go stale and this is a moving surface.

---

## 1. What replaces what

`AppChrome.tsx` mounts five modals today. They become three:

| Today | Becomes |
|---|---|
| `ProfileSettingsModal` | **Settings** → Profile |
| `BillingModal` — the state half | **Settings** → Billing |
| `BillingModal` — the plan-picker half | **Change plan** (its own modal) |
| `CreditTopupModal` | **Add credits** (its own modal) |
| `ReferralModal` | a block inside **Settings** → Billing |
| `DowngradeConfirmModal` | the promoted confirm dialog, from section 01 |

**Three surfaces because there are three jobs, not because three is tidy:**

- **Settings** answers *what is my account*. Six sections. Opened from the account menu and the rail.
- **Change plan** answers *which plan should I be on*. A comparison surface.
- **Add credits** answers *I need more credits now*. A purchase surface, one decision deep.

The last two are the same underlying mutation — adding credits **is** a tier change, and both call `changePlan` / `createSubscriptionCheckout`. They stay separate because the questions are different: one is deliberative, one is urgent. Someone who has just hit a wall mid-shoot should not be handed a five-column comparison.

**Do not fold Change plan into a Settings section.** A pricing comparison does not fit in an 880px modal that has already spent 186px on a nav column, and it opens from four places Settings does not.

**Excluded from this brief:** what the mutations do. Same profile update, same billing calls, same top-up, same referral logic. Only where they live and how they look.

---

## 2. Entry points

| Control | Opens |
|---|---|
| Account chip → Settings | Settings, Profile |
| Account chip → Members & invites | Settings, Members |
| Account chip → Billing & credits | Settings, Billing |
| Rail foot → gear | Settings, Profile |
| Rail foot → Invite | Settings, Members — **stub, see §8** |
| Topbar credits chip | **Add credits** |
| Settings → Billing → Change plan | Change plan |
| Settings → Billing → Add credits | Add credits |
| Billing credits card → "more credits" | Add credits |
| Change plan → "Just need more credits" | Add credits |
| Low-credit warning, out-of-credits mid-run | Add credits |

**One state pair for Settings — `open` and `section`.** Not six booleans, not one flag per retired modal. That is what makes the consolidation real rather than four modals in a trench coat.

The credits chip opening **Add credits** rather than Change plan is deliberate: someone clicking their balance has a credits question, not a plan question. The plan change is the answer, and the modal says so.

---

## 3. The shared shell

Both Settings and the two purchase modals use the modal shell promoted out of casting in section 01. This brief is its first real consumer — if that promotion was wrong, it shows up here.

```css
/* scrim */
position: fixed; inset: 0; z-index: 40;      /* 44 Change plan, 46 Add credits */
display: flex; align-items: center; justify-content: center;
padding: 28px;
background: var(--scrim);
```

```css
/* card */
position: relative;
width: 100%; max-width: 880px;               /* Settings and Change plan */
max-height: 100%;
display: flex; flex-direction: column;
background: var(--surface);
border: 1px solid var(--borderCard);
border-radius: var(--r-2xl);
box-shadow: var(--shadowCard);
overflow: hidden;
```

Settings additionally pins `height: 100%; max-height: 620px`. Add credits is `max-width: 436px`.

Scrim click and Escape dismiss. Stop click propagation on the card.

⚠️ **Containing-block warning.** A `position: fixed` child resolves against the nearest ancestor with `transform`, `filter`, `backdrop-filter`, `perspective` or `will-change` — not the viewport. The topbar has `backdrop-filter`. **Mount at the app root, never inside chrome.** Verify: the scrim's `getBoundingClientRect()` equals `{0, 0, innerWidth, innerHeight}`.

### Three structural rules, learned the hard way in the prototype

These caused four separate defects. They are not style preferences.

**1. A modal's primary action never lives inside its scrolling region.** Header and footer are `flex: none`; only the body scrolls. When content exceeds the pane, an action inside the pane goes below the fold — and in both cases where this happened, the most reachable remaining control was a subscription cancellation.

**2. Never `margin-*: auto` inside a `flex-wrap: wrap` row.** Any computed-style read resolves it to a hard pixel value, which then overflows the row, wraps the group to a second line, and gets clipped by the card's `overflow: hidden`. Live layout looks fine; every screenshot, PDF and PPTX export breaks. Use a `<span style="flex:1">` spacer.

**3. A label is never a flexible track.** Do not give a text label `flex: 1; min-width: 0` to push a sibling right — it can then be sized below its own content and will break mid-word. Put a `flex: 1` spacer between them instead.

Related, and already handled globally in the prototype's helmet: pill contents and mono labels carry `white-space: nowrap`, because `letter-spacing` puts every mono micro-label a fraction over its own box. Reproduce as two rules rather than per-element patches:

```css
[style*="border-radius: 999px"], [style*="border-radius: 999px"] span { white-space: nowrap }
[style*="JetBrains Mono"] { white-space: nowrap }
```

In React those become class-based equivalents on your pill and mono-label primitives. Inline `white-space` still wins the cascade, so a genuinely wrapping mono block (an assembled prompt) is unaffected.

---

## 4. Settings

### Header
`display: flex; align-items: center; gap: 12px; padding: 15px 18px; border-bottom: 1px solid var(--rule); flex: none`

**Settings** in `500 14px Archivo`, then the workspace in `400 12px` `--metaStrong` — `Klieg Studio · Studio plan`. A 28px close button on `margin-left: auto`, `border-radius: var(--r-sm)`, hover `background: var(--fillStrong)`.

### Body
`flex: 1; min-height: 0; display: flex`.

**Nav column** — `width: 186px; flex: none; border-right: 1px solid var(--rule); padding: 12px 10px; gap: 1px; overflow-y: auto`.

Rows are icon + label, `padding: 8px 11px`, `border-radius: var(--r-sm)`:

| | Selected | Unselected |
|---|---|---|
| background | `--fillStrong` | none, hover `--wellSoft` |
| label | `500 12.5px` | `400 12.5px`, `--secondary`, hover `--ink` |
| icon | `--ink` | `--meta` |

Icons from `icons.tsx`: `P.avatar` Profile · `P.grid` Usage · `P.card` Billing · `P.people` Members · `P.bell` Notifications · `P.shield` Security. Not Lucide.

**Sign out** sits at the bottom of the nav column on `margin-top: auto` — `400 11.5px`, `--accentInk`, underline on hover. **Not in the footer**: it is destructive-adjacent and must not sit beside Done, where a mis-click ends the session.

**Content pane** — `flex: 1; min-width: 0; overflow-y: auto; padding: 22px 24px 26px`.

### Footer
`Changes save as you edit` on the left in `--faint`; **Close** and **Done** on the right, both dismissing. **No Save button** — every field commits on change, and the line says so rather than leaving people hunting.

---

## 5. The six sections

All rows use the leader / hairline grammar — label and note left, control right, `--rule` between. **No cards inside cards.**

### Profile
Avatar with **Upload** / **Remove** and the constraint line: `JPG, PNG or WebP · up to 5 MB · square works best`.

| Field | Note |
|---|---|
| **Display name** | Shown on shared canvases and comments. |
| **Email** | **Read-only.** Contact support to change the address on the account. |
| **Workspace name** | Appears in the top bar and on client shares. |

Email is **shown and disabled**, not hidden. Hiding it makes people think the account has no email; disabling it with a reason answers the question they actually have.

### Usage
Three stat rows — `Credits used 4,760 · of 6,000 this month`, `Frames made 512 · 84 kept`, `Cast members 9 · 3 signed this month`. Values in mono; they are measured numbers.

Then per-tool bars, greyscale by rank, widest first: Video 2,140 (72%, `--ink`) · Image 1,380 (46%, `--secondary`) · Try-on 780 (26%, `--metaStrong`) · UGC 340 (12%, `--meta`) · Upscale 120 (5%, `--muted`). Then a Storage row with its own bar and the note *"Unkept frames clear after 30 days, which is most of what you free up."*

**Greyscale, not colour-coded.** Tool is a category, and colour never encodes a category. Rank is carried by bar length and the ramp.

### Billing
**State only** — what you are on, what you have paid, how to change it. Never the pricing table.

1. **Plan row** — `Studio`, `$149/mo · 4 seats · 6,000 credits/mo · renews 12 Aug`, then **Change plan** (secondary) and **Add credits** (primary ink).
2. **Two cards** — *Credits remaining* `1,240` with a bar and `21% of this month's allowance left · more credits` (that last a link to Add credits); *Payment method* `Visa ···· 4417` with `Update card`.
3. **Refer a friend** — §7.
4. **Invoice rows** — `12 Jul 2026 · $149.00 · PDF`.

The credits bar fill is `--ink`, not accent. A quantity is not a state; the sentence beside it carries the warning.

### Members
See §8 — this section ships as a **designed stub**.

### Notifications
Toggle rows, label plus note:

| Row | Note | Default |
|---|---|---|
| Render finished | When a generation completes or fails | on |
| Comments and approvals | When someone reacts to a frame you made | on |
| Someone joins a project | New members added to projects you're in | off |
| Credits running low | At 20% and again at 5% remaining | on |
| Product news | New models and features, roughly monthly | off |

Track `--ink` on, `--borderCard` off. **Product news defaults off.** Opting people into marketing by default is the kind of small dishonesty that costs more trust than the emails are worth.

### Security
Three action rows — label, note, button: **Password** / Last changed 4 months ago / `Change` · **Two-factor authentication** / Not enabled — recommended for owners / `Enable` · **Active sessions** / 3 devices signed in / `Review`.

Anything without a backend ships **inert** with the stub treatment. A security section that omits 2FA reads as "we don't have it"; a greyed row reads as "not yet", which is the truth.

---

## 6. Change plan

`max-width: 880px`. Header **Change plan** + workspace. Two modes in one modal — **not tabs.** Cards decide; the table compares. A tab would imply both are useful at once.

### 6a. The reason to act — above everything

A `--raised` band, `padding: 14px 15px`, `border: 1px solid var(--borderCard)`, `border-radius: var(--r-lg)`:

> **At this rate you run out on 27 Jul.**
> 4,760 of 6,000 spent with 19 days still to go, which leaves you 2 weeks short of 12 Aug. Agency covers the way you are actually working, and today's charge is only the difference for the days left.
>
> Right-aligned: `THIS MONTH` / `4,760 / 6,000`

**Every number here is derived, never written.** Four constants are the source — days left in cycle, cycle length, credits spent, credits remaining — and the burn rate, empty date and dry period are computed from them. This copy exists to make the charge believable; if a customer checks the dates and the charge disagrees, it has done the opposite of its job. That happened once in the prototype: hand-written dates put "the 21st" against a proration of 19/31 days, which implies the 24th.

Do not add a retrospective claim ("you ran out early last month") unless you can derive it. The forward-looking version is both true and stronger.

### 6b. Interval control

Centred segmented control, `Monthly | Annual`, in a `--fillStrong` track. The selected segment gets `--surface` + a 1px shadow.

The Annual segment carries a badge: `2 MONTHS FREE` — `padding: 2px 6px`, `border-radius: var(--r-xs)`, `background: var(--accentSolid)`, `color: var(--onWash)`, `500 8.5px JetBrains Mono`, `.06em`.

**Filled accent, not grey, and not green.** Grey mono at label weight reads as disabled, which fights the thing it exists to sell. Green would be a fourth meaning for colour in a system where colour means state — and the psychological work green does is done by *filled vs grey*, not by hue. Coral is the only saturated hue in the palette, so it already owns "look here".

`2 MONTHS FREE` rather than `−17%`: identical arithmetic, far more vivid. Use one framing everywhere; the prototype briefly had the badge on one modal and the percentage on the other.

Opposite the control: **Compare all 5** / **Back to the nearest three**.

### 6c. Card mode (default)

`display: grid; grid-template-columns: repeat(auto-fill, minmax(212px, 1fr)); gap: 12px`.

**`auto-fill`, not `auto-fit`**, and not a wrapping flex row. A flex row gives a two-card last line 52% more width than a three-card first line, which destroys the like-for-like read a comparison grid exists for.

**Three cards: current, the recommendation, and the tier above it.** Not the nearest three. The tier above the recommendation is an anchor — a higher number in view makes the target read as moderate. Downgrades stay one click away under Compare all, which is visible, not buried.

Each card, `padding: 17px 17px 18px`, `border: 1px solid var(--borderCard)`, `border-radius: var(--r-lg)`:

| Element | Spec |
|---|---|
| Recommendation tab | `FITS YOUR USE`, absolutely positioned `left: 15px; top: -8px`, solid `--ink` pill, `--surface` text, `500 8.5px` mono `.09em`. Card also gets `--shadowPop` |
| Name | `500 15px Archivo`, `-.02em`, left; unit price right |
| Unit price | `.48¢ A CREDIT` — `400 10px` mono `.04em` `--faint` |
| Price | `500 28px/1 Archivo`, `-.038em`, tabular-nums, with `/ month` beside it in `400 11.5px` `--metaStrong` |
| Blurb | one line, `400 11px/1.55`, `--metaStrong` |
| Action | full-width, `padding: 10px 0`, `border-radius: var(--r-btn)` |
| Credits block | credits in `500 12.5px` mono + `A MONTH` in `400 10px` mono `.06em` `--faint`; then what it makes; then what expires |
| Perks | check + `400 11.5px/1.45` `--secondary`, 7px gap |

Current plan: `--accentLine` border, `--accentWash` background, and its action slot replaced by an `ON THIS ONE` pill in `--accentWash` + `--accentLine` ring + `--accentInk`.

**Cost per credit is on every card, and it must descend monotonically up the ladder.** This is the real value argument and it was invisible. It also forced a data fix: Starter at 1,500 credits was better value per credit than Pro, and a ladder that argues against itself cannot be sold. Present figures: 2.79¢ / 2.63¢ / 2.48¢ / 2.33¢ / 1.87¢.

**Credits translated into work**, because a credit count means nothing: *"about 240 stills, or five clips"*.

**Rollover said as loss, not percentage**: *"Half of anything unspent expires"* in `--accentInk` on the lower tiers, against *"Nothing you pay for expires"* in `--metaStrong` above. Same fact; only one of them lands.

**Exactly one ink button per view** — the next tier up. Anything beyond it is a further move, not the offer being made, so it is secondary. Downgrades are secondary. Three identical primaries is the single biggest failing of the current `BillingModal`.

**Action labels: `Upgrade` / `Downgrade`.** The credits are stated directly above the button, so the button is just the verb. Upgrade is a category word with decades of positive affect and instant recognition — better than a clever alternative. Downgrade stays plain: honest, clear, and deliberately unpersuasive rather than hidden.

### 6d. Compare mode

Replaces the cards. `display: grid; grid-template-columns: 132px repeat(5, 1fr)`, hairline `box-shadow` separators, one bordered container.

Header row: plan names, with `YOU ARE HERE` in `--accentInk` on the current column and a solid `--ink` `FITS YOUR USE` chip on the recommendation. **The recommendation must outrank the plan already owned** — it fell into a `--faint` fallback branch in the prototype, making the plan being sold the dimmest thing in the view built for comparing.

Six rows, **value first and price last**, so the gain is established before the number:

1. Credits a month — mono
2. What that makes — Archivo
3. Cost per credit — mono
4. Seats — mono
5. Unspent credits — Archivo
6. Price a month — mono, `--ink`

Then an action row per column, and one footnote:

> Every plan carries every model and every tool, and reviewers are free on all of them — the rows above are the only things that change.

**Every row must differ across plans.** A row where all plans agree carries no decision value; it belongs in the footnote. This is the whole failure of the comparison tables this pattern is usually copied from — ten rows where six are identical across every column.

Current column is `--accentWash` throughout, including its cells.

### 6e. Footer

`Having a problem? Go to the help centre.` left · spacer · `Drop to Free` · `Close` · and **in compare mode only**, the primary `Upgrade to Agency · $122.58`.

The compare table is ~595px of content in a ~367px pane, so every column button sits below the fold. Without a footer primary, the most reachable control in a comparison view is a subscription cancellation.

### 6f. Cross-link

A `--raised` row at the foot of the scrolling pane: **Just need more credits** / *"Pick an amount and the plan moves with it — same thing, fewer decisions."* → Add credits.

This is the honest version of the current `BillingModal`'s "Expand credit limit" row.

---

## 7. Add credits

`max-width: 436px`. One decision deep. Mono eyebrow `CREDITS`, title **Add more credits** in `500 17px`, `-.022em`.

1. **The reason** — `400 12px/1.6` `--metaStrong`: *"4,760 of 6,000 spent with 19 days left in this cycle — at this rate the balance runs out on 27 Jul, 2 weeks before it resets."* Derived from the same four constants as §6a.

2. **The adjustment card** — `--raised`, `border: 1px solid var(--borderCard)`, `border-radius: var(--r-lg)`, `padding: 15px 16px`:
   - Row: `Billing adjustment` left; right `Annual` + the `2 MONTHS FREE` accent badge + a 30×17px toggle (track `--ink` on / `--borderCard` off, 13px knob, `left` 2px → 15px, `.16s`).
   - Price row: struck-through full year price when annual, then the due-today figure in `500 30px/1 Archivo`, `-.036em`, tabular; `due today`; then right-aligned the unit price *"2.33¢ a credit, down from 2.48¢"*.
   - **A full-width ink dropdown** reading `+ 9,000 credits a month`, chevron rotating 180° when open. Options list the delta per tier with its monthly price. Closes on outside click via the shared popover discipline.

3. **Three check bullets** — what lands now, what it makes, how to reverse it:
   - *"9,000 credits land on your balance the moment this goes through — nothing to wait for."*
   - *"That is about 600 stills, or twelve clips a month, up from about 240 stills, or five clips."*
   - *"Move back down any time. Downgrades take effect at renewal, so you are never locked in."*

4. **Renewal line** — `400 10.5px` `--faint`, branching on interval, and carrying the annual nudge when monthly: *"Prorated for the 19 days left in this cycle, then 12 Aug. Pay yearly instead and two of the twelve months are free."*

5. **Footer** — `Cancel` (quiet) and `Add credits · $122.58` (ink).

**The dropdown default is the next tier up.** Someone opening this needs more credits; the smallest step that solves it is the right default.

**Name the delta, not the tier.** *"+ 9,000 credits a month"* is what they are buying; the tier change is the mechanism, and bullet two states it plainly. This framing is not a euphemism — the current app's version says it too, in its second bullet. Keeping it is right; hiding it would not be.

---

## 8. Members and Invite — the designed stub

Adding and inviting members is not built. It still gets designed, in full, and shipped inert — so the feature has a target rather than being invented later under pressure.

### The rail foot

Member stack · `+` Invite · gear. All three render on every page; the rail never changes shape page to page.

**Invite ships as a stub:** no hover state, `aria-disabled`, out of the tab order, `--muted`, `title="Invite — not built yet"`. The `+` keeps its dashed circle but gains no `border-color` change on hover.

> I previously told you to make this live. That was wrong — I assumed the destination existed. With no invite backend, a live control that opens a Members section which cannot invite anyone is worse than an honest stub.

The **gear is live** and always rendered — Settings exists, and gating it on a prop means the rail's foot changes shape between pages.

The gear is deliberately **not** an avatar. The prototype had the same face at the rail's foot and in the topbar doing two different things — one opening a dropdown, one opening Settings. Same picture, same size, two outcomes. Two symbols, two meanings: the face is you, the gear is settings.

The member stack renders real members where the data exists — up to three overlapping avatars, `margin-right: -6px`, flat per-member colours (the gradient belongs to the account avatar). With no members data, the stack ships inert too. The `Invite` label is `400 9.5px Archivo` `--metaStrong` — one step below the destination labels, because it is a secondary action, not a peer of Home and Casting. A `34px × 1px` `--borderSoft` rule separates the block from the gear.

### The Members section

Fully designed, every control inert:

- Header: **Members** + `3 of 4 seats used. Reviewers are free and cannot spend credits.` + an `Invite` button (inert).
- An invite row — dashed border, mail glyph, `name@company.com` placeholder, inert.
- Member rows: gradient avatar tile, name and email, a role select (Owner / Admin / Creator / Reviewer) and project scope. Selects are inert.
- The role notes, **verbatim** — this copy is doing real work:
  - **Owner** — Everything, plus billing and deleting the workspace.
  - **Admin** — Invite people, create projects, generate — no billing access.
  - **Creator** — Generate and edit in the projects they're added to. Spends credits.
  - **Reviewer** — Open, comment, approve and download. Cannot generate, so never spends your credits — free, and the safe way to bring a client in.
- Footnote: *"Project access is set per project — open a project's settings to choose who can reach it."*

The Reviewer line is the one that sells the feature: it tells an agency they can bring a client in without risk. Keep it whole.

**Stub rules, from `Rail.tsx`, which argues them well:**

- A stub names a place, never a capability. An inert *Members* nav row is fine; an inert *Invite sent* confirmation is a lie.
- Never an unread dot on a stub — a dot promises content.
- Never stub something that already exists. A greyed row beside a working control reads as "this isn't built" when it plainly is.
- Watch the ratio. Four dead rows out of six reads as a broken menu rather than a menu with things coming.

---

## 9. Referrals — a block in Billing, not a modal and not a section

`padding: 16px 17px`, `border: 1px solid var(--borderCard)`, `border-radius: var(--r-lg)`, `gap: 14px`.

1. **Refer a friend** in `500 12.5px`, then *"They get 500 credits on their first signed cast, and so do you — up to 250,000 a year."*
2. Two fields side by side, `flex: 1 1 240px; min-width: 210px`, each with a mono `.12em` `--faint` label:
   - `SHARE LINK` — the link in `400 11px` mono, ellipsised, + a `Copy` chip
   - `INVITE BY EMAIL` — a real input + an ink `Send` chip
3. A `--rule`-topped row: earnings left, then `Redeem a code` and `Who has joined ›`.

**Referral credits are billing, so this is not a seventh nav section.** A section visited twice a year should not own a permanent nav row.

**Never show a zero as an achievement.** The current `ReferralModal` renders `0 / 250,000` and `0 / 0` in large type, in the position reserved for progress — showing someone their nothing. State the reward in the description; show progress only once there is some: *"3 friends joined · 1,500 credits earned so far."*

The cap belongs in the promise ("up to 250,000 a year"), not as a denominator you are measured against.

No gift icon. A gift in a rounded square is decoration, and it is the most-used icon in referral UI.

`Who has joined` rather than `Invitation history` — plain, and it is the thing people want to know.

---

## 10. What NOT to do

- **Do not keep the five modals and style them alike.** If a separate `ProfileSettingsModal` exists at the end, this failed.
- **Do not fold Change plan or Add credits into a Settings section.**
- **Do not make Change plan's two modes into tabs.**
- **Do not add a Save button.** Fields commit on change; the footer says so.
- **Do not move Sign out into the footer** beside Done.
- **Do not hide the email field.**
- **Do not colour the usage bars by tool**, or the credits bar by level.
- **Do not default Product news to on.**
- **Do not use green** — for savings, for success, for anything. There is no green in the system.
- **Do not put more than one ink button in a view.**
- **Do not show a row in the compare table that is identical across all plans.**
- **Do not write a date or a usage figure by hand.** Derive every one from the four constants.
- **Do not add a seventh Settings section.** Six is the set.
- **Do not mount inside the topbar** or any transformed ancestor.
- **Do not invent social proof**, countdowns, scarcity, pre-checked upsells, or guilt-worded decline buttons. They convert once and cost the account.

---

## 11. Definition of done

**Consolidation**
- [ ] `ProfileSettingsModal` and `ReferralModal` gone; `SettingsModal` replaces them.
- [ ] `BillingModal`'s state half in Settings → Billing; its picker half is the Change plan modal.
- [ ] `CreditTopupModal` is the Add credits modal.
- [ ] `DowngradeConfirmModal` uses the promoted confirm dialog.
- [ ] One `open` + `section` state pair for Settings; every entry point in §2 deep-links correctly.

**Settings**
- [ ] Six sections, nav column 186px, Sign out at the nav's foot.
- [ ] Footer reads "Changes save as you edit", Close and Done, no Save.
- [ ] Email visible and disabled with its reason.
- [ ] Usage bars greyscale, values mono.
- [ ] Role notes verbatim, Reviewer line whole.
- [ ] Product news and "Someone joins a project" default off.
- [ ] Section icons from `icons.tsx`, not Lucide.

**Change plan**
- [ ] Derived usage band above the cards; every figure agrees with the prorated charge.
- [ ] `2 MONTHS FREE` accent badge on the Annual segment, in both modals, no `−17%` anywhere.
- [ ] Three cards: current, recommendation, anchor. `auto-fill` grid; all cards equal width in every row.
- [ ] Cost per credit on every card, descending monotonically up the ladder.
- [ ] Output translation and rollover-as-loss on every card.
- [ ] Exactly one ink button per view, in both modes.
- [ ] Compare mode: six rows, all differing, value first and price last; shared facts in the footnote.
- [ ] Compare mode has a footer primary; no action sits below the fold.
- [ ] `FITS YOUR USE` outranks `YOU ARE HERE` in both modes.

**Add credits**
- [ ] Reason line, unit-price comparison, three bullets, branching renewal line.
- [ ] Dropdown defaults to the next tier up and closes on outside click.
- [ ] Bullet two states the tier change plainly.

**Stubs**
- [ ] Rail Invite inert with no hover, `aria-disabled`, out of tab order, `title="… not built yet"`.
- [ ] Rail gear live and always rendered; not an avatar.
- [ ] Members section fully designed, every control inert, nothing omitted.
- [ ] No unread dot on any stub.

**Structure**
- [ ] No `margin-*: auto` in any wrapping flex row.
- [ ] No text label carries `flex: 1; min-width: 0`.
- [ ] Every pill and mono label is `nowrap`; verify each returns one client rect.
- [ ] Scrim `getBoundingClientRect()` equals `{0, 0, innerWidth, innerHeight}` for all three modals.
- [ ] Escape and scrim-click dismiss; both themes; `token-guard` passes; no raw hex.

---

## 12. Then the promotion pass

Per `PROMOTION-PASS.md`. Likely candidates: the toggle row, the leader/hairline list row, the segmented control, the section-nav column, and the accent badge. The modal shell itself is already shared — this brief is its proof.
