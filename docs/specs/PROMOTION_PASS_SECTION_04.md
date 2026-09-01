# Promotion pass — section 04, the account menu (#374)

**Run 2026-09-01, foreman-169, per `PROMOTION-PASS.md` and standing order §2c.**
Method copied from #262: read the code, count real consumers, promote at two or
more. Twenty minutes. Nothing moved; the reasoning is below and one collision is
filed as its own card.

---

## 1 · What the section built

| added | kind | where |
|---|---|---|
| `WORKSPACE_ROLE_LABEL` | constant | `foundation/brand.ts` |
| `P.exit` | glyph | `foundation/icons.tsx` |
| `.dp-menu__balance` | stylesheet block | `foundation/foundation.css` |
| `.dp-account-menu .dp-menuitem` / `.dp-menugroup` / `.dp-menuitem--accent` | scoped overrides | `foundation/foundation.css` |
| `accountMenuPopulation.test.ts` | guard | `components/` |

⚠ **The section built no components at all**, which is the honest headline and
is a consequence of the reconciliation: the brief read as *"collapse two
implementations into one"*, and the founder's answer turned it into *"refine the
one that survives"*. A refinement adds no vocabulary.

## 2 · Consumers counted, today, in the codebase

| thing | real consumers | verdict |
|---|---|---|
| `WORKSPACE_ROLE_LABEL` | **2** — `UserCard.tsx`, `MembersSection.tsx` | **already in `foundation/`.** It was born shared, on purpose: the label appears on two surfaces and the `Klieg` / `Klieg Studio` split (#381) is what two independent spellings of one noun costs. |
| `P.exit` | 1 — `UserCard.tsx` | already in `foundation/icons.tsx`; a glyph set is shared by construction, not by consumer count. |
| `.dp-menu__balance` | 1 | **stays.** A balance set in mono beside sans words is, so far, one line in one menu. |
| the `.dp-account-menu` scoped overrides | 1 by construction | **stay, and must.** They exist precisely so the row grammar shared with `LobbyUtilityMenu` is NOT bent to one surface's needs — promoting them would undo their point. |

**Nothing reaches two that is not already shared. Nothing moves.**

## 3 · Collision check — and there is one, pre-existing and real

`PROMOTION-PASS.md` step 5: grep the foundation before adding. §6 of the brief
asks the question directly — *"Check whether the popover shell (the 216px card,
its border, radius, shadow and separator rules) should be promoted too, since
three surfaces draw it."*

**Measured. It is three, and they are three different mechanisms:**

| surface | how the shell is drawn | width | padding | radius | shadow | overflow |
|---|---|---|---|---|---|---|
| account menu | `.dp-account-menu` — a CSS class, `foundation.css:426` | 216 | 0 | `--r-md` | `--shadowCard` | hidden |
| help menu | an inline `style` object in `LobbyUtilityMenu.tsx:129` | 264 | `--s-2` / `--s-6` | `--r-md` | `--shadowPop` | visible |
| bug panel | `FEEDBACK_PANEL_STYLE`, a TS const in `FeedbackForm.tsx:134` | 264 | `--s-6` | `--r-md` | `--shadowPop` | visible |

**What all three agree on:** `border: 1px solid var(--borderCard)`,
`border-radius: var(--r-md)`, `background: var(--surface)`. Three declarations,
written out three times, in three different notations.

**What they do not agree on** — and this is why it is a card rather than a line
in this PR: width, padding, overflow and, since this section, the **shadow**.
The account menu moved to `--shadowCard` because the prototype's literal
`0 12px 34px rgba(17,17,18,.14)` **is** `--shadowCard` exactly, while the other
two use `--shadowPop`. That divergence is one night old and it is the drift the
pass exists to catch: **the three panels agreed by coincidence, and they have
just stopped.**

**Not folded into this PR**, for the pass's own reasons: *"one PR, no behaviour
change"*, and *"if a promotion needs a rewrite to be general it is not ready"*.
Reconciling three notations into one class touches two files this section is not
about, and the founder's #262 answer shows he wants to rule on which
implementation wins when two collide.

➜ **Filed as its own card: [#388](https://github.com/michaelpaulrattray/Drape/issues/388).** Recommendation on it: a
`.dp-panel` class in `foundation.css` carrying only the three declarations all
three already share, with width, padding, shadow and overflow left to the
caller — the smallest promotion that removes the duplication without inventing
a general component nobody asked for.

## 4 · Naming

Nothing renamed. `UserCard` is the one name that could be argued — it is a menu,
not a card, and it has been `UserCard` since the rail owned it. **Left alone
deliberately:** the pass says rename *on the way in*, and nothing came in. A
rename now is churn across a file the founder is actively reading against his
own brief.

## 5 · Discharge

**Section 04's promotion pass is run and its finding is filed.** Nothing was
promotable; one pre-existing collision was measured and carded. *"Nothing was
promotable" is a discharge; silence is not.*
