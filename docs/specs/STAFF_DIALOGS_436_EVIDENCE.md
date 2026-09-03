# Staff dialogs — brief 11 (#436): what was driven, and what the driving caught

**Shift** `foreman-194` · **branch** `team/staff-dialogs-436` · **2026-09-03**

His brief: `docs/specs/Casting-ui-ux-design/drape-redesign/11-staff-dialogs.md`.
The reconciliation against the codebase (five questions, BRIEF-RECONCILIATION.md)
is on the card, posted before a line was written.

⚠ **THIS DOCUMENT EXISTS BECAUSE THE SOURCE GUARD CANNOT SEE A WINDOW.**
`client/src/features/staff/section11-guard.test.ts` holds the rules that can be
read out of source. **Three real defects in this change were invisible to it,
to the typechecker and to the whole 1,214-test client suite, and were caught by
looking at the running app** — which is working law 6, and is the entire reason
that law exists.

---

## 1 · The bar, and how each line was met

His §9 is the definition of done. Every row was DRIVEN at **1280×540**, the
viewport height he named, on `localhost:3011` against the dev database, signed
in as `verify-bot-admin`. Numbers are measured off the live DOM, not inferred.

| his line | how it was read | result |
|---|---|---|
| **`Submit request` visible without scrolling on every request type, at 540px** | `Stripe refund` selected — the fifteen-field worst case — then `boundingBox()` of the button against `viewportSize()` | ✅ button at **y 452→488** in a **540** window; body scrolls **602 / 301**, card does not |
| Every dialog: header/footer `flex: none`, only the form scrolls | computed `display`/`overflow-y` on the card + `body.contains(footer)` on all seven | ✅ `flex` / `hidden` / footer **outside** the scroller, 7 of 7 |
| Request form is `max-w-2xl`; every two-column label fits one line | card `boundingBox().width`; `Original amount (cents)` `scrollWidth` vs `clientWidth` and its height | ✅ **672px**; label **289 = 289**, height **11px** — one line |
| No `space-y-*` between form fields | source guard + a live overlap check on every body child | ✅ zero overlaps on all seven |
| Mono eyebrow above every title (`ACCOUNT`/`AUDIT`/`CHANGE REQUEST`) | `.dpc-modal__eyebrow` read off each open dialog | ✅ 7 of 7 |
| Zero icons in titles and confirm buttons; `Upload`/`Trash2` retained | `querySelectorAll('[data-slot="dialog-title"] svg').length` and the same on the footer | ✅ **0** and **0** on all seven; both keepers present |
| One field-label treatment, mono uppercase 9.5px | computed style on a real label | ✅ `9.5px`, JetBrains Mono, letter-spacing `1.045px` (≈.11em), `--faint`; **zero** raw `<label>` left |
| No `*` in a label; rules are helper text | source guard over every `label=` string | ✅ none; `At least 5 characters.` sits under the field |
| Priority is segmented; type and duration stay selects | `role="group"` box + the select options | ✅ segmented **302px** inside its ~320px column; 9-option type and 5-option duration untouched |
| Slack note is a plain line, not a slab | computed style on the paragraph | ✅ `11px`, `--faint`, **no border, transparent background**, no `AlertTriangle` |
| Pending states swap the label, no `Loader2` | source guard | ✅ `Suspending…`, `Blocking…`, `Submitting…`, `Adding credits…`, `Promoting…`, `Approving…` — ellipsis character |
| No hex literals; `token-guard` passes over all five | `pnpm vitest run client/src` | ✅ **1,214 passed** |
| Every mutation, validation rule and disabled condition identical | diff read; no handler, schema or `disabled=` expression touched | ✅ |
| Destructive titles still `--error` | computed colour | ✅ `rgb(192,71,58)` = `--error` on both suspends and Block IP; role change is ink `rgb(17,17,18)` |
| **Both themes, specifically `SelectContent`, which portals separately** | opened the portal in each theme and read its computed background/ink | ✅ light `rgb(255,255,255)`-family surface with dark ink; dark `rgb(26,26,29)` with `rgb(237,237,239)` ink |

---

## 2 · ⚠ THE THREE DEFECTS ONLY THE RUNNING APP COULD SHOW

**All three passed the typechecker, the guard and the client suite.** Each is
recorded in the code beside the line that fixes it.

### (a) `max-w-2xl` never applied — the card stayed the width it was meant to leave

`DialogContent`'s own base carries **`sm:max-w-lg`**. `cn()` is
`extendTailwindMerge`, and a **responsive variant and a base variant are
different class groups to it** — so a bare `max-w-2xl` does not replace
`sm:max-w-lg`, it loses to it at every width from 640px up.

**Measured: the card rendered at 512px**, exactly the width the brief filed the
change to escape. `sm:max-w-2xl` fixes it — **672px**, confirmed.

⚠ **The same shadow is on `AuditActionModals`' two `max-w-md` dialogs**: they
have never been 448px above 640px, since long before this brief. **Left alone
and filed**, not fixed here — narrowing two dialogs is a visible change brief 11
does not ask for.

### (b) The Stripe block drew ON TOP of the fields beneath it

Swapping `space-y-4` for a flex `gap` is half a change. `space-y-*` lives on a
**block** container where children take their content height; **a flex column's
children shrink by default**, and a scrolling one has more content than height
by definition. So every child was squeezed and the tall ones overlapped the
rows under them.

`436-request-form-dark-540.png` is the frame — `TITLE` printed over
`STRIPE SESSION ID`, `Brief summary of the request` over the session input.
**Every number was green at that moment**: footer outside the scroller, body
scrolling, `Submit request` in the viewport. `[&>*]:shrink-0` on the body fixes
it; `436-request-dark-540-fixed.png` is the same frame after.

### (c) A 0.9px overflow drew a full-width horizontal scrollbar

`436-role-dark-540.png` shows an empty grey bar under the Slack line. It is a
**horizontal scrollbar**: an `overflow-y: auto` box computes `overflow-x` as
`auto` too, so **any** sub-pixel overflow produces one.

The cause was the role-pill cluster overflowing its row by **0.9px** — the name
column had no `min-w-0`, so a long email refused to shrink. Pre-existing markup;
it only became visible once the body became a scroll container. Fixed at the
cause (`min-w-0` on the text column, `shrink-0` on the pill cluster) rather than
clipped, because clipping `overflow-x` would clip the focus ring.
`436-role-dark-540-fixed.png` is the after: `scrollWidth 462 = clientWidth 462`.

---

## 3 · One thing I thought was a defect and was not — recorded so nobody re-fixes it

The credits dialog's Amount field draws a **coral ring** on an untouched empty
field (`436-credits-light-540.png`), and `required` + `:invalid` is the obvious
suspect. **It is not that.** Read at the computed style with the attribute
removed and restored: the border is `rgb(226,104,90)` **both ways**, `--error`
is a different colour (`#C0473A`), and `aria-invalid` is `null`. It is the
app's ordinary focus ring on the field Radix autofocuses. `required` is
innocent and stays.

---

## 4 · The frames

All at 1280×540. Under `docs/specs/evidence/436/`.

| file | what it shows |
|---|---|
| `436-request-form-dark-540.png` | ⚠ **the overlap defect**, dark, before the fix |
| `436-request-dark-540-fixed.png` | the request form, dark, after — 672px, Stripe slab intact, footer pinned |
| `436-request-light-540-select-open.png` | light theme **with `SelectContent` open** — the portal that gets missed |
| `436-credits-light-540.png` | Add credits, light — `ACCOUNT` eyebrow, mono labels, no glyph |
| `436-role-dark-540.png` | ⚠ **the stray scrollbar**, dark, before the fix |
| `436-role-dark-540-fixed.png` | role change, dark, after — plain Slack line, `USER → MODERATOR` |
| `436-blockip-dark-540-select.png` | Block IP, dark, duration portal open — red title, `Block IP` capitals kept |

**Not photographed:** `ReviewModal` and the audit suspend dialog were measured
on every row of §1 but no frame was kept. Said plainly rather than implied.

---

## 5 · The instrument was verified before its verdicts were believed

`scripts/_436-sabotage-disposable.mts` (disposable) drives five sabotages
against the guard and restores the tree in `finally`. Result: **five RED, each
naming its own rule, and a clean restored tree.**

⚠ **Its first shape reported five clean GREENS having never run a test** — it
passed `--reporter=basic`, which vitest 4 does not have, so every run died at
startup with empty stdout and "no `N failed` in the output" read as "nothing
failed". The summary line is required now, and a run that did not happen says
`UNRUN` instead of being scored. That is the same class the driver was written
to check for, reproduced by the driver.
