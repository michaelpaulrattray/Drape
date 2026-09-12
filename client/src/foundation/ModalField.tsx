/**
 * One field inside a form modal: mono label, the control, and the rule
 * beneath it.
 *
 * # Provenance — promoted from `features/staff/` by the section 11 pass (#481)
 *
 * Born as `StaffField` in brief 11 (#436), where four staff dialogs each drew
 * their own field label — three treatments for one element — and the brief's
 * §5 collapsed them to one. It arrived here on the pass's own count rule: four
 * real consumer files (`UserActionModals`, `AuditActionModals`, `ReviewModal`,
 * `ChangeRequestModal`), 65 mounts between them, and no rewrite needed to make
 * it general. Renamed on the way in, per `PROMOTION-PASS.md`: a page that has
 * never heard of the staff lane gets a word that means something to it.
 *
 * ⚠ **IT DECLARES NO LABEL OF ITS OWN, AND THAT IS THE POINT.** The label is
 * `.dpc-modal__label` — already in `modals.css`, already exactly brief 11 §5's
 * spec, and already worn bare by the confirm shell (`DestructiveConfirm`,
 * `SignConfirm`, `ConceptReviewModal`). This composes it; it does not restate
 * it. The row (`.dp-sfield`, also in `modals.css`) is layout only: it zeroes the
 * label's confirm-shell `margin-top` so the label sits on the field rather than
 * adding to the gap above it. A font declared here would be a fourth label.
 *
 * ⚠ **`required` puts no asterisk in the label** — brief 11 §5's second half.
 * The marker is the attribute on the control (a screen reader gets it, which an
 * asterisk never gave anyone) and any rule (`min 5 characters`) is `helper`,
 * read at the moment it fails rather than once at the top. It changes no
 * validation: the disabled conditions on every confirm button are untouched.
 *
 * # Two collisions the pass found and did NOT fold — logged, not hidden
 *
 * The pass's rule is *"if a promotion needs the component rewritten to be
 * general it is not ready — leave it and log it."* Both of these do, and each
 * is a decision about what a labelled field IS across the product rather than
 * a parameter. They are one design card: **#841**, filed by the shift that
 * moved this.
 *
 * 1. **The three bare `.dpc-modal__label` users are not this shape.**
 *    `DestructiveConfirm` puts label and field on ONE ROW (`.dpc-modal__typerow`);
 *    `ConceptReviewModal` hangs the Re-imagine glyph on the label's right
 *    (`.dpc-modal__labelrow`); `SignConfirm` relies on the label's 16px top
 *    margin as the spacing after its explainer. A row variant, an action slot
 *    and a spacing modifier — three new settings, in a no-behaviour-change PR.
 * 2. **`features/settings/parts.tsx`'s `SettingsField` is the same device with
 *    a different label** — stacked label, control, note — but its label is sans
 *    11.5px in `--ink`, where this one is mono 9.5px uppercase in `--faint`.
 *    Folding either onto the other repaints a shipped surface. It has one
 *    consumer file, so it stays where it is by the pass's own rule 4.
 *
 * So the tree carries three ways of labelling a field for one cycle, and this
 * docblock says so rather than letting the foundation's copy imply it is the
 * only one. The next brief that touches any of them converges instead of
 * rediscovering.
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function ModalField({
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
