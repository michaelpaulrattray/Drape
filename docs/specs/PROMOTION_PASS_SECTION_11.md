# Promotion pass — section 11, the staff dialogs

Per `docs/specs/Casting-ui-ux-design/drape-redesign/PROMOTION-PASS.md`, the back
half of brief 11 (#436). **Written as the card first (#481, 2026-09-03), sized
at the code twice (2026-09-07, 2026-09-12), and landed as one PR with no
behaviour change** — *"the thing you should see afterwards is nothing at all."*

---

## 1 · What the section added, and who really imports it

Counted at the merged tree, not at the design (his own correction from #262:
*"two real consumers in the codebase, or it waits"*).

| thing section 11 added | real consumers today | verdict |
|---|---|---|
| `StaffField` (mono label + control + helper) | **4 files** — `UserActionModals`, `AuditActionModals`, `ReviewModal`, `ChangeRequestModal`; 65 mounts | **PROMOTED** → `foundation/ModalField.tsx`, renamed on the way in |
| `StaffDialogHeader` (eyebrow + title + description) | 4 files | **stays** in `features/staff/` — collides with the confirm shell's header (§2a) |
| `STAFF_DIALOG_CONTENT` / `STAFF_DIALOG_BODY` (the shell strings) | 4 files | **stays** — they are the shadcn `Dialog` shell's override, and brief 11 §8 kept the form dialogs off the promoted confirm shell on purpose; promoting the strings without the shell would put half a shell in the foundation |
| `.dp-sfield`, `.dp-sfield__help` (CSS) | via `StaffField` | already in `foundation/modals.css` since #436 — **nothing to move** |

## 2 · Collisions — grepped before adding anything, and both logged rather than folded

**(a) The header.** `.dpc-modal__eyebrow` has five consumers through the
promoted confirm shell (`CastSettingsModal`, `ConceptReviewModal`, `SignConfirm`,
`DestructiveConfirm`, `RenameDialog`); `StaffDialogHeader` is a shadcn
`DialogHeader` wearing the same classes. Two shells, one grammar. Whether a form
dialog takes the confirm shell's chrome is the design question brief 11 §8
answered *no* to for its own round — not a no-behaviour-change pass's to reopen.

**(b) The field row — two collisions, and the second was found this pass.**

- The three bare `.dpc-modal__label` users are **not the same row**, measured at
  the code on 2026-09-12: `DestructiveConfirm` sets label and field on one row
  (`.dpc-modal__typerow`); `ConceptReviewModal` hangs the Re-imagine glyph on the
  label's right (`.dpc-modal__labelrow`, #535); `SignConfirm` relies on the
  label's own 16 px top margin as its spacing after an explainer. A `row`
  variant, an `action` slot and a spacing modifier — and a specificity tie
  between `.dpc-modal__labelrow .dpc-modal__label` and `.dp-sfield >
  .dpc-modal__label` that flips on source order if one is nested in the other.
- **`features/settings/parts.tsx`'s `SettingsField`** is the same device — label
  above, control, note beneath — with a different label: sans 11.5 px `--ink`
  against the modal's mono 9.5 px uppercase `--faint`. One consumer file
  (`ProfileSection`, three mounts), so it **stays** by rule 4. Folding either
  onto the other repaints a shipped surface.

`PROMOTION-PASS.md`: *"if a promotion needs the component rewritten to be
general it is not ready — leave it and log it."* **Logged as #841** — a design
decision (is a field in a modal and a field on a page one component? does the
modal row grow variants for the confirm shell?), `awaiting-fable` under #541
rule 3's first limb. **The honest cost is stated: the tree draws a labelled
field three ways for one cycle**, and `ModalField`'s docblock says so, so the
foundation's copy cannot read as the only one.

## 3 · What moved, exactly

- `client/src/foundation/ModalField.tsx` — the function body is **byte-identical**
  to `StaffField`'s after the rename (diffed against `origin/main`; 23 lines, no
  hunk). The docblock is new and carries §2.
- `client/src/foundation/index.ts` exports it; `features/staff/index.ts` no
  longer does; `staffDialog.tsx` keeps the header and the two shell strings and
  says at the top where the row went.
- The four consumers import `ModalField` from `@/foundation` and mount it under
  the new name — 4 + 1 + 4 + 14 = 23 JSX sites (the 65 in #481's count includes
  closing tags and props).
- `section11-guard.test.ts`: the `GRAMMAR` read is split — header and shell
  strings still from `staffDialog.tsx`, the row from `foundation/ModalField.tsx`
  — and **one new arm holds the promotion**: the row is exported from the
  barrel, every staff dialog takes it FROM the barrel, and `staffDialog.tsx`
  declares no field again. Sabotaged both ways (a `StaffField` born back in the
  grammar module; one consumer importing from `@/foundation/ModalField` instead
  of the barrel): the arm reddens alone each time, restored, 26/26.
- `pages/AdminFoundation.tsx` §02 Inputs gains one specimen — the mono label, a
  shadcn `Textarea` (the dialogs are shadcn `Dialog`s, so the control inside is
  shadcn too), the rule as helper text. **A promoted part he cannot look at is a
  part that drifts** (#261).
- **CSS: zero lines changed** (`git diff foundation/modals.css` is empty).

## 4 · The proof that nothing changed (law 6)

Driven 2026-09-12, both themes, `verify-bot-admin`, the change-request form at
1440×900 (the largest consumer, 8 rows on screen).

| arm | server | dialog | mono label | JetBrains Mono 500 |
|---|---|---|---|---|
| before | main tree `pnpm dev` (:3181) | 638×720 | 9.5 px upper, mt 0 / mb 5, `rgb(160,160,166)` light / `rgb(138,138,146)` dark | loaded |
| after | worktree **`pnpm build` served in production mode** (:3183) | 638×720 | identical | loaded |

**Pixel diff of the dialog clip, before vs after: 0 differing pixels of 460,080,
in both themes.** Frames: `output/_481/form-{before,after}-{light,dark}.png`,
`output/_481/specimen-{light,dark}.png` (the specimen row, seen in both themes).

⚠ **The first after arm read 708 px and then 745 px against 720, and it was
the environment, not the change**: a worktree DEV server serves no webfonts —
Vite's `fs.strict` refuses the `node_modules` junction's real path under the
main tree, every `@fontsource` face 403s, and the labels render in a fallback
mono 1.4 px shorter. The console named it; the production build of the same
tree (fonts copied into `dist`) measured 720 to the pixel. **Filed as #842** —
every frame a shift has photographed from a worktree dev server is in the wrong
typeface, and a before/after taken across two servers reads as a regression
that does not exist.

## 5 · Findings that are not promotions, carried from the card

- `AuditActionModals`' `max-w-md` has never applied above 640 px (the
  `sm:max-w-lg` tailwind-merge shadow, `STAFF_DIALOGS_436_EVIDENCE.md` §2a).
  Narrowing two dialogs is a visible change no brief asked for — **his word or a
  brief**, still one bullet on #481, not touched here.
- The §5 label reader stops a template-literal capture at the first `${…}`
  (PR #480's reviewer). Every current label is literal where the rule bites.
  Not closed here: the file was opened for the promotion arm only.
