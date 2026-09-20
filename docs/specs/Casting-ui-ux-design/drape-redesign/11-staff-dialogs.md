# Staff dialogs — house grammar

**One PR. Five files. No behaviour changes, one defect fix.**

Live reference: `design_handoff_studio/Klieg Studio.dc.html` — the sign, delete, rename, Cast settings, Change plan and Add credits modals are the house grammar. Open one beside each file you touch.

---

## 1. Read this first: the colour work is done, do not redo it

`#421` already fixed these files and fixed them correctly. Its reasoning is right and its header comments should survive this PR intact:

- The hard-coded `bg-white`, `#F8F8F8`, `#E5E5E5`, `#999` were **painting over already-themed primitives** — `index.css` remaps every shadcn slot onto a foundation token, so the repair was taking paint off, not restating values in `var()` form.
- `text-foreground` on `DialogContent` is a real addition, not decoration — the content portals outside `.dp-root`, so it inherits the body's ink.
- ReviewModal's green/red pair became ink/destructive. Correct: green is not in the palette, and the one red is reserved.
- `RolePill` over `RoleBadge`, because a role is what someone *is*, not something needing attention.
- `severityLook("warning")` over an approximation of it.
- Sentence case, and `Block IP` keeping its capitals because an initialism is not Title Case.

**None of that is in scope here.** If this PR reintroduces a hex literal or a colour pair, it has gone backwards.

**What is in scope:** these are shadcn dialogs wearing foundation tokens. They are not yet house modals. Five specific gaps, below.

### Files

`features/admin/UserActionModals.tsx` (suspend, credits, role) · `features/admin/AuditActionModals.tsx` (suspend, block IP) · `features/admin/ReviewModal.tsx` (approve/deny) · `features/moderator/ChangeRequestModal.tsx` (file a request).

Every mutation, validation rule, disabled condition and toast stays exactly as it is.

---

## 2. The defect: the request form's footer scrolls away

`ChangeRequestModal`'s content is `max-h-[90vh] overflow-y-auto` — **the whole card scrolls, footer included.** With the Stripe refund type selected the form is fifteen fields, and `Submit request` sits below the fold. The most reachable control on a long form is then whatever happens to be in view.

This is the structural rule from brief 03 §3, and it is the third surface to break it:

> **A modal's primary action never lives inside its scrolling region.** Header and footer are `flex: none`; only the body scrolls.

```
DialogContent   → display: flex; flex-direction: column; max-height: 90vh; overflow: hidden
DialogHeader    → flex: none
the form        → flex: 1; min-height: 0; overflow-y: auto
DialogFooter    → flex: none
```

Do the same to `ReviewModal` and both `UserActionModals` dialogs that can grow — a textarea plus a validation message plus a `severityLook` slab is enough to exceed a short window at 540px height. **Check every one of these at 540px viewport height**; every modal defect in this product's history was viewport-height dependent and looked correct in a tall window.

**Also widen the request form: `max-w-lg` → `max-w-2xl` (512 → 672px).** It uses `grid-cols-2`, so at 512px each column is ~240px, and `Original amount (cents)` does not fit its own label. Fifteen fields in two 240px columns is the narrowest form in the product.

---

## 3. No icon in a modal title

Eight titles carry a Lucide glyph: `ShieldOff`, `Coins`, `Shield`, `UserCog`, `Ban`, `Globe`, `FileText`, `CheckCircle`/`XCircle`.

**No house modal has an icon in its title.** Not sign, not delete, not rename, not Cast settings, not Change plan, not Add credits. The title says what the modal does; a glyph beside it restates the same fact in a second medium, and in a destructive dialog it competes with the one signal that matters.

Remove all eight. The same applies to the icons inside confirm buttons — `<Ban className="mr-2" />`, `<CheckCircle className="mr-2" />`, `<FileText className="mr-2" />`.

Keep the two icons that are not decoration: `Upload` in the attachment drop zone (it labels an affordance, not a heading) and `Trash2` on an attachment row (it *is* the control).

---

## 4. The header becomes eyebrow + title

Every house modal opens the same way:

```
CREDITS                          ← mono eyebrow
Add more credits                 ← title
```

| Element | Spec |
|---|---|
| Eyebrow | `500 9.5px var(--font-mono)`, `.13em`, `--meta`, uppercase |
| Title | `500 17px Archivo`, `-.022em`, `--ink` — sentence case, no icon |
| Description | `400 12px/1.6`, `--metaStrong` |

Eyebrows: `ACCOUNT` (suspend, credits, role) · `AUDIT` (audit suspend, block IP) · `CHANGE REQUEST` (review, file a request).

The eyebrow is the most recognisable device in the language and it is doing a job here the icons were failing at — it says *which part of the product this dialog belongs to*, which a shield glyph does not.

**Destructive titles keep `text-destructive`.** That is `#421`'s call and it is right: suspension and IP blocks lock people out.

---

## 5. One field-label treatment, not three

Three treatments across five files for the same element:

| File | Today |
|---|---|
| `UserActionModals` | `text-sm text-muted-foreground font-medium` + `mt-1` |
| `AuditActionModals` | `text-xs text-muted-foreground uppercase mb-2` |
| `ChangeRequestModal` | `text-[10px] text-muted-foreground uppercase tracking-wider mb-1` |

The house label is the third one, corrected:

```css
font: 500 9.5px var(--font-mono);
letter-spacing: .12em;
text-transform: uppercase;
color: var(--faint);
margin-bottom: 5px;
```

**Mono, because a field label names a slot** — same face as the eyebrow and the same reason. And **9.5px is the floor for uppercase mono only**; `text-[10px]` in a sans face is below the product's 10.5px minimum, which is why that one reads as fine print rather than a label.

Two related fixes:

- **Required markers.** `Target user ID *`, `Title * (min 5 characters)` — the asterisk and the rule are doing two different jobs in one string. Label is `TARGET USER ID`, with `required` on the field, and the rule as helper text beneath: `at least 5 characters`. A parenthesised rule in a label is read once and never again; helper text under the field is read when it fails.
- **Replace `space-y-*` with `gap`.** Margin-based spacing between siblings does not survive a field being conditionally hidden — and this form hides fields by type, so a `space-y-4` list with three hidden members has three collapsed margins in it.

---

## 6. Priority is a segmented control

`Low / Normal / High / Urgent` is four short mutually-exclusive options in a select. That is what the segmented control is for, and `.dp-segmented` already exists with real consumers.

A select hides three of four options behind a click and gives no sense of scale; a segmented control shows the whole ladder, which is what someone setting a priority is judging.

Leave **Request type** (nine options) and **Duration** (five, with a `Permanent` outlier) as selects. Nine is a list.

---

## 7. Two copy notes

**"This action will be logged and reported to Slack" is not a warning.** It currently wears `severityLook("warning")` — a bordered well with warning weight. Every staff action is logged; that is the point of an audit log. Warning weight on a routine fact is crying wolf, and it devalues the treatment where it is earned (the Stripe refund block, which genuinely is).

Make it a plain helper line above the footer: `400 11px Archivo`, `--faint`. Same words, no slab.

**Pick one pending pattern.** `UserActionModals` swaps the label (`"Suspending..."`); `AuditActionModals` and `ChangeRequestModal` show a `Loader2` and keep the label. Use the label swap everywhere — it says what is happening, and it does not put a spinning icon inside a button that has just had its icon removed.

`Processing...` → name the act: `Adding credits…`, `Promoting…`, `Blocking…`, `Submitting…`. Ellipsis character, not three dots.

---

## 8. What NOT to do

- **Do not reintroduce a hex literal, a colour pair, or a hue for a category.** `#421` removed them with reasons; the reasons stand.
- **Do not delete `#421`'s header comments.** They record findings, not decorations — including that this file held 89 hex literals and was on none of the lists.
- **Do not rebuild these onto `foundation/modals.css`'s promoted shell.** `#421` ruled on this and the ruling holds: that shell is for confirms, these carry multi-field forms. Folding them in is its own decision, and this PR is not it.
- **Do not add type-the-name arming to suspend or block IP.** Both are reversible — `unsuspend_user` exists and IP blocks carry a duration — and both already require a reason, which is the right gate. Arming is for the irreversible; over-applying it makes it noise.
- **Do not change a validation rule, a disabled condition, a mutation or a toast.**
- **Do not lowercase `ChangeRequestConstants`' labels** in this PR. `#421` flagged the Title Case there and filed it rather than smuggling it in; nineteen strings feeding a shipped surface is a copy change, not a modal change.
- **Do not put an icon back in a title.**
- **Do not use `overflow-y: auto` on a card.** On the body only.

---

## 9. Definition of done

**Structure**
- [ ] Every dialog: content is a flex column with `overflow: hidden`; header and footer `flex: none`; only the form scrolls.
- [ ] `Submit request` is visible without scrolling on every request type, at 540px viewport height.
- [ ] Request form is `max-w-2xl`; every two-column label fits on one line.
- [ ] No `space-y-*` between form fields.

**Grammar**
- [ ] Mono eyebrow above every title; `ACCOUNT` / `AUDIT` / `CHANGE REQUEST`.
- [ ] Zero icons in titles and zero in confirm buttons; `Upload` and `Trash2` retained.
- [ ] One field-label treatment across all five files, mono uppercase at 9.5px.
- [ ] No `*` in a label; rules are helper text under the field.
- [ ] Priority is a segmented control; type and duration stay selects.
- [ ] Slack note is a plain helper line, not a `severityLook` slab.
- [ ] Pending states swap the label and name the act; no `Loader2` in a button.

**Unchanged**
- [ ] No hex literals; `token-guard` passes over all five.
- [ ] `#421`'s header comments intact.
- [ ] Every mutation, validation rule and disabled condition identical.
- [ ] Destructive titles and buttons still `--error`; nothing else coloured.
- [ ] Both themes, and specifically both themes on `SelectContent`, which portals separately.

---

## 10. Then the promotion pass

Per `PROMOTION-PASS.md`. Two candidates arrive with real consumers here:

- **The field row** — mono label, field, helper text — is now on five staff dialogs plus Settings' six sections. This is the most-repeated row in the product after the leader row; it should be a component by the end of this PR.
- **The modal header** — eyebrow, title, description — is on these five plus every casting and billing modal. If the promoted shell does not already own it, this is the round.

And one to check rather than build: `AuditActionModals`' suspend dialog and `UserActionModals`' suspend dialog are **two implementations of the same act**, differing only in whether the reason is an `Input` or a `Textarea`. Report whether they can be one component before writing a third.
