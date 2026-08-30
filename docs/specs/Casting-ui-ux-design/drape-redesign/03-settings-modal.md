# The Settings modal

**One PR.** Four modals become one. Depends on section 01 — this is the first real consumer of the modal shell promoted out of casting.

Live reference: `docs/specs/Casting-ui-ux-design/design_handoff_studio/Klieg Studio.dc.html` — account chip → any of Settings / Members & invites / Billing & credits. Where this doc and the prototype disagree, the prototype wins.

**`design_handoff_studio/09-settings-account.md` is superseded by this file.** It is 878 bytes, predates the current design, and is wrong in three places: it says the account menu shows an email (it shows `Owner · Klieg Studio`), that the menu has a theme row (removed in 00b — the toggle exists), and that the footer is Cancel / Done (it is Close / Done with "Changes save as you edit").

## What this is, and why it is a consolidation

`AppLobby.tsx` mounts four modals today:

| Today | Becomes |
|---|---|
| `ProfileSettingsModal` | Settings → **Profile** |
| `BillingModal` — the *state* half | Settings → **Billing** |
| `BillingModal` — the *plan picker* half | **stays a separate modal** — see §2b |
| `CreditTopupModal` | folds into that same plan modal |
| `ReferralModal` | a row inside **Billing** |

**Four modals become two, not one.** The split is by job, not by tidiness:

- **Settings** answers *what is my account*. Six sections, reached from the account menu and the rail gear.
- **Plan & credits** answers *change what I am paying for*. It is a purchase flow, it opens from at least four places Settings is not — the credits chip, a low-credit warning, running out mid-generation, and Billing's own Upgrade button — and a three-column pricing table does not fit inside an 880px modal that has already spent 186px on a nav column.

Folding a purchase flow into a settings pane would have been the wrong consolidation. Two modals with clean jobs beat one modal doing two.

Plus two sections with no home today — **Usage** and **Security** — and **Members**, which exists in the account menu as a link to nothing.

**The consolidation is the work.** A restyle of four separate dialogs would be the wrong outcome: they share a header, a footer, a save model and a dismiss behaviour, and keeping them apart means four places to get those wrong. One modal, six sections, one shell.

**Excluded:** any change to what the mutations do. Same profile update, same billing calls, same referral logic. Only where they live and how they look.

## Files

**Read first**
- `client/src/foundation/` — the modal shell promoted in section 01
- `client/src/pages/AppLobby.tsx` — the four modals and their state
- `client/src/components/ProfileSettingsModal.tsx`, `features/billing/`, `features/referral/`

**Change**
- New: `client/src/features/settings/SettingsModal.tsx` and one file per section
- `AppLobby.tsx` — replace four modal mounts with one
- `UserCard.tsx` — the three menu items open sections rather than modals

**Leave alone**
- Every mutation and query. Profile update, billing portal, top-up, referral — the calls are correct.
- Role gating.

---

## 1. The shell

```css
/* scrim */
position: fixed; inset: 0; z-index: 40;
display: flex; align-items: center; justify-content: center;
padding: 28px;
background: rgba(17,17,18,.32);   /* → --scrim family; do not add a new value */
```

```css
/* card */
position: relative;
width: 100%; max-width: 880px;
height: 100%; max-height: 620px;
display: flex; flex-direction: column;
background: var(--surface);
border: 1px solid var(--borderCard);
border-radius: var(--r-2xl);
box-shadow: var(--shadowCard);
overflow: hidden;
```

Click the scrim to dismiss; Escape to dismiss.

⚠️ **Containing-block warning.** A `position: fixed` child resolves against the nearest ancestor with `transform`, `filter`, `backdrop-filter`, `perspective` or `will-change` — not the viewport. The topbar has `backdrop-filter`. Mount this at the app root, never inside chrome. Verify: the scrim's `getBoundingClientRect()` must equal `{0, 0, innerWidth, innerHeight}`.

### Header
`display: flex; align-items: center; gap: 12px; padding: 15px 18px; border-bottom: 1px solid var(--rule); flex: none`

**Settings** in `500 14px Archivo`, then the workspace name in `400 12px Archivo` at `--metaStrong` — `Klieg Studio · Studio plan`. Then a 28px close button pushed right with `margin-left: auto`, `border-radius: var(--r-sm)`, hover `background: var(--fillStrong)`.

### Body
`flex: 1; min-height: 0; display: flex`.

**Nav column** — `width: 186px; flex: none; border-right: 1px solid var(--rule); padding: 12px 10px; gap: 1px; overflow-y: auto`.

Rows are icon + label, `padding: 8px 11px`, `border-radius: var(--r-sm)`:

| | Selected | Unselected |
|---|---|---|
| background | `--fillStrong` | none, hover `--wellSoft` |
| label | `500 12.5px` | `400 12.5px`, `--secondary`, hover `--ink` |
| icon | `--ink` | `--meta` |

**Sign out** sits at the bottom of this column on `margin-top: auto` — `400 11.5px Archivo`, `--accentInk`, underline on hover. **Not in the footer.** It is destructive-adjacent and it must not sit beside Done, where a mis-click ends the session.

**Content pane** — `flex: 1; min-width: 0; overflow-y: auto; padding: 22px 24px 26px`.

### Footer
`Changes save as you edit` on the left in `--faint`; **Close** and **Done** on the right. Both dismiss. **There is no Save button** — every field commits on change, and the line says so rather than leaving people hunting for one.

---

## 2. The six sections

All rows use the leader / hairline list grammar — label and note on the left, control on the right, `--rule` between rows. **No cards inside cards.**

### Profile
Avatar with **Upload** / **Remove**, and the constraint line beneath: `JPG, PNG or WebP · up to 5 MB · square works best`.

Then three fields:

| Field | Note |
|---|---|
| **Display name** | "Shown on shared canvases and comments." |
| **Email** | **Read-only.** "Contact support to change the address on the account." |
| **Workspace name** | "Appears in the top bar and on client shares." |

The email field is **shown and disabled**, not hidden. Hiding it makes people think the account has no email; disabling it with a reason answers the question they actually have.

### Usage
Three stat rows — `Credits used 4,760 · of 6,000 this month`, `Frames made 512 · 84 kept`, `Cast members 9 · 3 signed this month`. Value in mono; it is a measured number.

Then per-model bars, greyscale by rank, widest first:

| Model | Value | Bar | Fill |
|---|---|---|---|
| Video | 2,140 | 72% | `--ink` |
| Image | 1,380 | 46% | `--secondary` |
| Try-on | 780 | 26% | `--metaStrong` |
| UGC | 340 | 12% | `--meta` |
| Upscale | 120 | 5% | `--muted` |

**Greyscale, not colour-coded.** Model is a category, and colour never encodes a category. Rank is carried by bar length and by the ramp.

### Billing
**State only.** What you are on, what you have paid, how to change it — never the pricing table itself.

- Plan row: current plan, price, renewal date, and a **Change plan** button that opens the plan modal (§2b).
- Credits row: balance and monthly allowance, with **Add credits** opening the same modal.
- Payment method.
- Invoice rows — `12 Jul 2026 · $149.00`.
- **Refer a friend** — a row here, not in the account menu. It sits there today as a peer of Settings, which it is not, and it still carries the old product name.

## 2b. The plan & credits modal — kept separate

Not part of this PR's six sections, but named here so nobody folds it in. Today it is `BillingModal`'s pricing half plus `CreditTopupModal`; they merge into one surface, which the current build already half-does — its "Expand credit limit · Add credits" row sits under the plan columns.

It needs its own brief before it is rebuilt. Five things are wrong with it today, recorded now so they are not carried forward:

1. **It never says which plan you are on.** A plan picker that makes you remember what you already pay for is the central failure, and every other issue is cosmetic beside it. The current plan gets a marked column and its button reads *Current plan*, disabled.
2. **Three identical black Upgrade buttons — three primaries.** One primary per view. The recommended plan keeps the ink button; the others become secondary.
3. **`Save 17%` in green.** There is no green in the system, and colour never encodes a promotion. Greyscale, or accent if it is genuinely a state.
4. **The credits line is printed twice per column** — once under the price and again as the first check row.
5. **Sparkle icons.** Decoration.

Until that brief exists, the existing modal keeps working and Billing's buttons open it as-is.

### Members
Member rows: gradient avatar tile, name and email, a role select (Owner / Admin / Creator / Reviewer), project scope. Then an invite row.

Beneath, the role notes verbatim — this copy is doing real work and should not be paraphrased:

- **Owner** — Everything, plus billing and deleting the workspace.
- **Admin** — Invite people, create projects, generate — no billing access.
- **Creator** — Generate and edit in the projects they're added to. Spends credits.
- **Reviewer** — Open, comment, approve and download. Cannot generate, so never spends your credits — free, and the safe way to bring a client in.

The Reviewer line is the one that sells the feature: it tells an agency they can bring a client in without risk. Keep it whole.

Header line: `3 of 4 seats used. Reviewers are free and cannot spend credits.`

### Notifications
Toggle rows, label plus note:

| Row | Note | Default |
|---|---|---|
| Render finished | When a generation completes or fails | on |
| Comments and approvals | When someone reacts to a frame you made | on |
| Someone joins a project | New members added to projects you're in | off |
| Credits running low | At 20% and again at 5% remaining | on |
| Product news | New models and features, roughly monthly | off |

Track `--ink` when on, `--borderCard` when off. **Product news defaults off.** Opting people into marketing by default is the kind of small dishonesty that costs more trust than the emails are worth.

### Security
Three action rows — label, note, button:

- **Password** — Last changed 4 months ago — `Change`
- **Two-factor authentication** — Not enabled — recommended for owners — `Enable`
- **Active sessions** — 3 devices signed in — `Review`

If any of these has no backend, ship the row **inert** with the stub treatment. A security section that omits 2FA reads as "we don't have it"; a greyed row reads as "not yet", which is the truth.

---

## 3. Deep links

The account menu items open the modal at a section:

| Menu item | Opens |
|---|---|
| Settings | Profile |
| Members & invites | Members |
| Billing & credits | Billing |

The rail's gear opens Profile.

**One state pair — `open` and `section`.** Not six booleans, and not one flag per old modal. This is what makes the consolidation real rather than four modals in a trench coat.

---

## 4. What NOT to do

- **Do not keep the four modals and style them alike.** If a separate `ProfileSettingsModal` still exists at the end, the section failed.
- **Do not fold the plan picker into Billing.** It is a purchase flow with its own entry points and its own width needs. Billing links to it.
- **Do not add a Save button.** Fields commit on change; the footer says so.
- **Do not move Sign out into the footer** beside Done.
- **Do not hide the email field.**
- **Do not colour the usage bars by model.**
- **Do not default Product news to on.**
- **Do not mount inside the topbar or any transformed ancestor.**
- **Do not add a seventh section.** Six is the set.

## 5. Definition of done

- [ ] `ProfileSettingsModal` and `ReferralModal` are gone from `AppLobby`; `SettingsModal` replaces them.
- [ ] `BillingModal`'s state half moved into Settings → Billing; its plan-picker half survives as the plan modal, now also carrying top-up.
- [ ] Billing's **Change plan** and **Add credits** both open that one modal.
- [ ] Six sections, nav column at 186px, Sign out at the bottom of the nav.
- [ ] Footer reads "Changes save as you edit" with Close and Done, no Save.
- [ ] Email visible and disabled with its reason.
- [ ] Usage bars greyscale; values in mono.
- [ ] Role notes verbatim, Reviewer line whole.
- [ ] Product news and "Someone joins a project" default off.
- [ ] Any section without a backend ships inert, not omitted.
- [ ] Account-menu items and the rail gear deep-link to sections.
- [ ] Scrim `getBoundingClientRect()` equals `{0, 0, innerWidth, innerHeight}`.
- [ ] Escape and scrim-click dismiss; both themes; `token-guard` passes.

## 6. Then the promotion pass

Per `PROMOTION-PASS.md`. Likely candidates: the toggle row, the leader/hairline list row, and the section-nav column if a second surface has one. The modal shell itself is already shared — this section is its proof.
