# Account menu — one implementation, correctly set

**Small PR. Structural, not cosmetic.**

Live reference: `design_handoff_studio/Klieg Studio.dc.html` — click the avatar at the right end of the topbar. Open it beside your build; do not work from my prose or from screenshots.

---

## 1. The actual defect: there are two account menus

> ⚠ **CORRECTED AT THE CODE, 2026-09-01 (#374). THE DIAGNOSIS IS RIGHT AND THE
> TABLE'S RIGHT-HAND COLUMN WAS MISLABELLED — it is not a file, it is THIS
> PACK'S OWN PROTOTYPE.** The original heading read *"The topbar's inline
> menu"*; the topbar renders `UserCard` (`AppChrome.tsx:207`) and has no inline
> menu. Every row of the column is `design_handoff_studio/Klieg Studio.dc.html`
> lines 179–202 and 6324–6326: `Owner · Klieg Studio` verbatim, a shield path
> for Admin, a list path for Moderation. **Two of the five rows are impossible
> for any code file**, because the only other account menu in the tree —
> `features/studio/components/StudioSlimHeader.tsx` — has no staff group at all.
>
> **The defect the section reports is real regardless**: there ARE two account
> menus and they have drifted. The second is `StudioSlimHeader.tsx`, whose one
> host is `pages/DrapeStudio.tsx` — the legacy studio, admin-sealed (#364).
> **Founder's answer, before a line was written: *"legacy casting studio is
> getting retired thats the answer it doesnt need a new menu"*** — so it is
> FROZEN rather than merged or deleted, and it dies with its host at N8.

`UserCard.tsx`'s own header says it:

> *"Rendered inside the lobby rail's profile popover (its only live consumer — the studio slim header grew its own inline menu)."*

That header was itself half-stale: section 02 moved the account out of the rail's foot, so `UserCard`'s one consumer is the **topbar**. The rest of the sentence is true — the studio slim header did grow its own inline menu, and that is why the two disagree.

Evidence of the drift — **this table compares this file against the prototype**, not against a second implementation:

| | `UserCard.tsx` (before §04) | **The prototype** (`Klieg Studio.dc.html`) |
|---|---|---|
| Identity line | `{credits} credits` | `Owner · Klieg Studio` |
| Avatar in menu | yes, `ProfileAvatar` | none |
| Icons on the 3 items | yes, Lucide 13px | none |
| Admin icon | `LayoutDashboard` | a shield |
| Moderation icon | `Eye` | a list |

**Neither is simply right.** The prototype has the structure closer to the design — no avatar, the right glyphs for staff. `UserCard` is closer on two counts: it shows credits, and it puts icons on the three account rows (§2a, §2b). So this is not "port one to the other": **there is one component to refine**, and §2 onward is what it becomes. Its structure comes from the prototype; the credit balance, the icon on every row and the role gating stay.

**Find it first.** `client/src/components/UserCard.tsx` is the menu; `client/src/foundation/Topbar.tsx` draws the popover shell around it (`.dp-account-menu`); `client/src/features/studio/components/StudioSlimHeader.tsx` is the frozen second one. Do not start until you have the prototype open beside them.

---

## 2. What the one menu is

216px wide. `position: absolute; right: 0; top: 38px; z-index: 30`.

```css
display: flex; flex-direction: column;
width: 216px;
border: 1px solid var(--borderCard);
border-radius: var(--r-lg);          /* 11px */
background: var(--surface);
box-shadow: var(--shadowCard);
overflow: hidden;
```

Five blocks, top to bottom. **Every separator is `1px solid var(--fillStrong)`** — not `--rule`, not `--border`. `--fillStrong` is heavier than a hairline on purpose: these divide *groups*, and the group structure is what makes the menu readable at a glance.

### 2a. Identity — no avatar

```
Michael Rattray          500 12px Archivo, --ink
1,240 credits · Owner    400 10.5px, --metaStrong
```

`padding: 11px 13px; gap: 1px; border-bottom: 1px solid var(--fillStrong)`.

The second line is a baseline-aligned flex row, `gap: 4px`: the balance in **JetBrains Mono** because it is a measured number, then `credits · Owner` in Archivo.

**No avatar in the menu.** You just clicked the avatar to open this; repeating it 30px below tells you nothing and costs the width that makes the two lines fit.

**Credits, then role. No workspace name.** `UserCard` has the credits right and the framing wrong — a bare `1,240 credits` duplicates the chip in the same bar. Pairing it with the role makes the line answer both *what can I spend* and *what am I allowed to do*, which is the pair the avatar cannot say. The workspace name is already in the topbar's project chip and the Settings header, so it is the one of the three that can go.

### 2b. The three items — icon, then label

```css
display: flex; align-items: center; gap: 9px;
padding: 8px 13px;
/* hover */ background: var(--well);
```

Icon `flex: none` at `--metaStrong`, 13px. Label `400 12px Archivo` `--secondary`, `flex: 1; min-width: 0`.

**Settings** (`P.settings`) · **Members & invites** (`P.people`) · **Billing & credits** (`P.card`). From `icons.tsx`, at stroke 1.7.

⚠️ **Take a fresh `icons.tsx`** — `P.settings` changed after the first copy went out. It is now a proper cog: one closed outline with the teeth in the silhouette, six teeth, plus a bore. The two earlier drafts are both wrong and both may be in your tree.

The two-slider mark that was briefly `P.settings` is now **`P.filters`**, and it must not be used here. Two horizontal sliders is the universal icon for *list filters* — Library, Assets and Casting all need those — so using it for account settings creates a real collision. That is why this one is a gear despite a gear being the most over-used icon there is: on a menu row you scan, recognition beats novelty.

No chevrons, no counts — counts mark staff work queues.

**All six rows carry an icon, and Sign out too.** I first specified icons on the staff rows only, arguing the absence marked the account rows as a different class. That was wrong twice over: nobody infers a category from an absence, and the `STAFF` heading already does that job explicitly and better. Half-and-half reads as an oversight rather than a decision.

The concrete reason to give all six icons: the staff rows carry **count pills on the right**, which already makes them visually heavier. Add icons to those rows alone and staff gets two extra marks; give every row an icon and the pill becomes the *only* difference — which is exactly right, because the pill means *there is work waiting*.

### 2c. STAFF group heading

```css
padding: 9px 13px 5px;
border-top: 1px solid var(--fillStrong);
display: flex; align-items: center; gap: 8px;
```

`STAFF` in `500 8.5px JetBrains Mono`, `letter-spacing: .13em`, `--faint`, then a `flex: 1` `--rule` hairline filling the row.

Asymmetric padding — 9px above, 5px below — so the label sits with the rows it introduces rather than floating between groups.

### 2d. Staff rows — icons, and counts

```css
display: flex; align-items: center; gap: 9px;
padding: 8px 13px;
/* hover */ background: var(--well);
```

Icon at `--metaStrong`, `flex: none`. Label `400 12px Archivo` `--secondary`, `flex: 1; min-width: 0`. Count pill `flex: none`:

```css
padding: 1px 6px;
border-radius: var(--r-pill);
background: var(--fillStrong);
font: 500 9px JetBrains Mono;
color: var(--metaStrong);
```

Icons from `icons.tsx`, **not Lucide**: `P.grid` for Admin (an overview of panels), `P.shield` for Moderation (moderation protects the platform). `LayoutDashboard` and `Eye` both go, and so does the hand-set `strokeWidth={1.8}` — `Icon` fixes stroke at 1.7, which is the point of having it.

Keep `showsMenuCount` and its omit-at-zero behaviour. It is right, and the guard test that proves it should stay.

### 2e. Sign out

Same row shape as the rest — icon `P.exit` at `--accentInk`, label `400 12px` `--accentInk`:

```css
display: flex; align-items: center; gap: 9px;
padding: 8px 13px;
border-top: 1px solid var(--fillStrong);
/* hover */ background: var(--accentWash);
```

The rule above it and the accent colour already mark it as the row that leaves; it does not also need to be the one row missing an icon.

Drop `LogOut` from Lucide — `P.exit` is in `icons.tsx`.

---

## 3. Measured drift in what is on screen now

From the screenshot, against the prototype:

| | Should be | Looks like |
|---|---|---|
| Menu width | 216px | ~240px |
| Name | `500 12px` | ~14px |
| Item labels | `400 12px` | ~13px |
| Row padding | `8px 13px` | ~11px vertical |

Individually small; together they make the menu about 15% larger than designed, which is why it reads as loose rather than dense. **Set every value from the prototype rather than adjusting toward it** — a menu is a place where 1px per row compounds visibly.

---

## 4. What NOT to do

- **Do not leave two menus.** If both exist at the end, this failed. One component, one consumer per surface.
- **Do not put the avatar in the identity block, and do not show the workspace name there.**
- **Do not use `--rule` for the group separators.** `--fillStrong` throughout.
- **Do not wire the three items to individual modals.** All three open the one sectioned Settings modal at a section. Every separate modal added is one more to unpick.
- **Do not add a `Share Drape` row.** Referrals are a block inside Billing. Removing it was the consolidation, not a loss — and the old label carried the retired product name.
- **Do not add counts to the three account items.** Counts mark staff work queues.
- **Do not add a query to this component** for the staff numbers. They arrive as props.
- **Do not `margin-left: auto`** on the count pill. `flex: 1` on the label, `flex: none` on the pill.

---

## 5. Definition of done

> ⚠ **FOUR OF THESE WERE RECONCILED AT THE CODE BEFORE BUILDING (#374), AND THE
> REASONS ARE ON THE CARD.** Each is the blank-canvas class `BRIEF-RECONCILIATION.md`
> exists for, not a decision being overridden:
>
> 1. **"the inline duplicate is deleted" — NO.** Superseded by his own answer on
>    #374: *"legacy casting studio is getting retired thats the answer it doesnt
>    need a new menu"*. `StudioSlimHeader.tsx` is **frozen with a dated comment**
>    and dies with `DrapeStudio` at N8. Deleting a working menu from a page he
>    can still open is a behaviour change he did not order.
> 2. **"The rail's popover and the topbar both render it" — the rail has no
>    account popover.** Section 02 moved the account to the topbar and the rail's
>    foot draws a gear (#373). **One consumer, the topbar.**
> 3. **`P.settings` is NOT a cog in this tree and `P.filters` does not exist.**
>    The fresh drop §2b describes has not arrived — both copies of the icon file
>    still have `settings` as the two-slider mark. The cog is **`P.cog`**, put
>    there by his own #382 (*"it should be a cog like in the top bar profile drop
>    down menu"* — this menu), and the Settings row draws that. `P.settings` is
>    NOT renamed: his standing word is *"don't use both"*, not *"rename it"*, and
>    `icons-guard.test.ts` pins it as the kept fallback. **Rename it in the next
>    drop.**
> 4. **`P.exit` does not exist either.** Added as lucide's `log-out` path (ISC),
>    copied rather than redrawn — #382's own precedent, *"a hand-drawn near-miss
>    is a third gear"* — and drawn through `Icon` at the house stroke. **His to
>    overwrite** the moment his set gains one.
>
> And one measurement: **§2's `var(--r-lg)` is 12px here, not the 11px it is
> annotated with.** The 11px token is `--r-md`, which is also the prototype's own
> literal, so that is what shipped.

- [ ] ~~One account-menu component. The rail's popover and the topbar both render it; the inline duplicate is deleted.~~ → **One account menu that is REFINED (`UserCard`), rendered by the topbar; the legacy studio's is frozen and named with its expiry.**
- [ ] 216px wide; every separator `1px solid var(--fillStrong)`.
- [ ] Identity block: name `500 12px` + `1,240 credits · Owner`, balance in mono. No avatar, no workspace name.
- [ ] All six rows plus Sign out carry an icon from `icons.tsx` at stroke 1.7; counts are the only thing distinguishing staff rows.
- [ ] Three items: `P.settings` / `P.people` / `P.card`, label `400 12px --secondary`, hover `--well`.
- [ ] Staff rows: `P.grid` / `P.shield`; counts omitted at zero.
- [ ] Sign out: `P.exit` and label both `--accentInk`, hover `--accentWash`.
- [ ] STAFF heading in mono `.13em --faint` with its hairline; `9px 13px 5px`.
- [ ] `Settings`, `Users`, `CreditCard`, `LogOut`, `LayoutDashboard` and `Eye` all gone from the Lucide import.
- [ ] Role gating unchanged: Admin needs `role === 'admin'`; Moderation shows for admin and moderator.
- [ ] Escape and outside click dismiss; both themes; `token-guard` passes.
- [ ] `section00b-guard.test.ts` still passes, updated where it asserted the old icon set.

---

## 6. Then the promotion pass

Per `PROMOTION-PASS.md`. This menu and `LobbyUtilityMenu` are now two consumers of the same row grammar — `.dp-menuitem`, `.dp-menugroup`, `.dp-menucount` are already shared, which is right. Check whether the popover *shell* (the 216px card, its border, radius, shadow and separator rules) should be promoted too, since three surfaces draw it.
