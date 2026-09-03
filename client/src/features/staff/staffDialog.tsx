/**
 * The staff dialogs' shared grammar — header and field row (brief 11, #436).
 *
 * # Why this exists, and why it is HERE and not in `foundation/`
 *
 * Brief 11 §4 and §5 name two devices that the four staff dialogs each drew
 * their own way: a header (mono eyebrow, title, description) and a field row
 * (mono label, control, helper text). **Three label treatments across five
 * dialogs for one element** — `text-sm … font-medium`, `text-xs uppercase
 * mb-2`, and `text-[10px] uppercase tracking-wider` — is what the brief is
 * fixing, and the fix is one treatment, not a fourth one written five times.
 *
 * ⚠ **NEITHER DEVICE IS NEW, AND THAT IS THE POINT.** The eyebrow is
 * `.dpc-modal__eyebrow` and the label is `.dpc-modal__label`, both already in
 * `foundation/modals.css` with real consumers (Cast settings, Concept review,
 * Sign, Rename, Destructive confirm). `.dpc-modal__label` is *already exactly*
 * the spec brief 11 §5 writes out. This module composes them; it does not
 * restate them, and it introduces no colour, no second eyebrow value and no
 * second label.
 *
 * **It sits in `features/staff/` rather than `foundation/` deliberately.** The
 * promotion pass (`PROMOTION-PASS.md`) is the road to `foundation/`, it runs
 * AFTER a section rather than inside it, and its output is a written card
 * first and one no-behaviour-change PR second. Promoting into `foundation/`
 * here would also mean reconciling against `.dpc-modal__*`'s five existing
 * consumers — i.e. repainting casting's modals inside a PR whose brief says
 * every other surface stays put. So: shared by the five dialogs that have it
 * today, and the promotion card names the reconciliation for its own round.
 *
 * # What is deliberately NOT here
 *
 * Not the modal SHELL. Brief 11 §8: *"Do not rebuild these onto
 * `foundation/modals.css`'s promoted shell … that shell is for confirms, these
 * carry multi-field forms."* These dialogs stay shadcn `Dialog`s; what changes
 * is the grammar inside them.
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * A staff dialog's header: mono eyebrow, then the title, then the description.
 *
 * The eyebrow says which part of the product the dialog belongs to —
 * `ACCOUNT`, `AUDIT`, `CHANGE REQUEST`. Brief 11 §4: *"it is doing a job here
 * the icons were failing at … which a shield glyph does not."*
 *
 * ⚠ **No icon, ever.** `DialogTitle` takes children as text only. Eight Lucide
 * glyphs came out of these four files and the type refuses their return: a
 * `ReactNode` title would have let the next shift put one back without
 * noticing. No house modal has one — not sign, delete, rename, Cast settings,
 * Change plan or Add credits.
 *
 * `destructive` keeps #421's call, which brief 11 §4 explicitly upholds:
 * suspension and IP blocks lock people out, so those two titles keep `--error`
 * through the `text-destructive` slot.
 */
export function StaffDialogHeader({
  eyebrow,
  title,
  description,
  destructive = false,
}: {
  eyebrow: string;
  /** Text, never a node — see the docblock. */
  title: string;
  description?: ReactNode;
  destructive?: boolean;
}) {
  return (
    <DialogHeader className="shrink-0 gap-0 text-left sm:text-left">
      <span className="dpc-modal__eyebrow">{eyebrow}</span>
      <DialogTitle
        className={cn(
          /* 500/17px/-.022em is brief 11 §4's title; shadcn's default is
             600/18px/leading-none, which is the only reason this override
             exists. */
          "mt-1.5 text-[17px] font-medium leading-snug tracking-[-0.022em]",
          destructive && "text-destructive",
        )}
      >
        {title}
      </DialogTitle>
      {description ? (
        <DialogDescription className="mt-1.5 text-xs leading-relaxed">
          {description}
        </DialogDescription>
      ) : null}
    </DialogHeader>
  );
}

/**
 * One field: mono label, the control, and the rule beneath it.
 *
 * ⚠ **`required` puts no asterisk in the label, and that is the whole of brief
 * 11 §5's second half.** `Target user ID *` and `Title * (min 5 characters)`
 * were doing two jobs in one string; the marker becomes the attribute on the
 * control (so a screen reader gets it, which an asterisk never gave anyone)
 * and the rule becomes `helper`, which is read at the moment it fails rather
 * than once at the top.
 *
 * ⚠ **It changes no validation.** The disabled conditions on every confirm
 * button are untouched, and these inputs are not inside a `<form>` that
 * submits, so `required` here is an accessibility annotation and nothing else.
 */
export function StaffField({
  label,
  htmlFor,
  helper,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  helper?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("dp-sfield", className)}>
      <label className="dpc-modal__label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {helper ? <p className="dp-sfield__help">{helper}</p> : null}
    </div>
  );
}

/**
 * The three-part shell every dialog in brief 11 §2 now uses.
 *
 * ⚠ **THIS IS THE DEFECT FIX AND IT IS ONE STRING, SO IT IS WRITTEN DOWN ONCE
 * WHERE IT CANNOT DRIFT.** `DialogContent` is `grid … gap-4`, not flex, so the
 * brief's shell is an override rather than an addition — and `cn()` is
 * `extendTailwindMerge`, so `flex` and `grid` are one class group and this
 * wins without the shared primitive moving a byte.
 *
 * The rule, from brief 03 §3: **a modal's primary action never lives inside
 * its scrolling region.** Header and footer are `flex: none`; only the body
 * scrolls. `overflow-hidden` on the card is what makes `min-h-0` on the body
 * mean anything — without it a flex child refuses to shrink below its content
 * and the card grows past the window instead.
 */
export const STAFF_DIALOG_CONTENT =
  "text-foreground flex max-h-[90vh] flex-col overflow-hidden";

/**
 * The scrolling middle. `min-h-0` is load-bearing; see above.
 *
 * ⚠ **`[&>*]:shrink-0` IS NOT TIDINESS — IT IS THE SECOND HALF OF SWAPPING
 * `space-y-*` FOR `gap`, AND LEAVING IT OUT LOOKS LIKE A RENDERING BUG.**
 * `space-y-4` lives on a BLOCK container, where children take their content
 * height and nothing shrinks. A flex column's children shrink by default, and
 * a scrolling one has more content than height by definition — so every child
 * gets squeezed and the tall ones **draw on top of the fields beneath them**.
 *
 * Measured, not reasoned about: the first build of this change rendered the
 * request form with the Stripe refund slab overlapping `Title` and
 * `Description`, at 540px, in the running app. Every number was green — the
 * footer was out of the scroller, the body scrolled, `Submit request` was in
 * the viewport — and the picture was wrong. **Working law 6 caught it and
 * nothing else could have.**
 */
export const STAFF_DIALOG_BODY =
  "flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto [&>*]:shrink-0";
