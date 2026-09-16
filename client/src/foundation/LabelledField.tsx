/**
 * One labelled field: the name of the slot, the control, and the rule beneath
 * it. Wherever somebody types something in — a staff dialog or the Profile
 * page — this is the shape.
 *
 * # Provenance — `StaffField` → `ModalField` → here (#436 → #481 → #841)
 *
 * Born as `StaffField` in brief 11 (#436), where four staff dialogs each drew
 * their own field label — three treatments for one element — and the brief's
 * §5 collapsed them to one. The section 11 promotion pass (#481) moved it to
 * the foundation as `ModalField` and **logged, rather than folded, the two
 * collisions it could not decide on its own** (#841).
 *
 * ⚠ **#841 DECIDED BOTH, AND THIS IS THE FOLD.**
 *
 * 1. **A field in a MODAL and a field on a PAGE are the same component**, so
 *    there is one label treatment and it is this one. `features/settings`'s
 *    `SettingsField` — the same three rows with a sans 11.5px `--ink` label —
 *    is DELETED and Profile's three fields are these. That repaints a customer
 *    page (Profile's labels are the mono eyebrow now), which is the visible
 *    half of the decision and was rendered for his eye before it shipped.
 * 2. **It grows NO `row` variant and NO `action` slot.** The confirm shell's
 *    three bare `.dpc-modal__label` users are three different ROWS —
 *    `DestructiveConfirm` puts label and field on one line
 *    (`.dpc-modal__typerow`); `ConceptReviewModal` hangs the Re-imagine glyph
 *    on the label's right (`.dpc-modal__labelrow`); `SignConfirm` leans on the
 *    label's own 16px top margin as the gap after its explainer. Variants for
 *    one consumer each are the fourth treatment arriving through the front
 *    door. They keep their rows and **already read the same label class**, so
 *    the label matches everywhere even where the row does not.
 *
 * ⚠ **THE NAME IS `LabelledField` BECAUSE `Field` IS THE BOX.** #841's ruling
 * asked for the bare word; `primitives.tsx` has owned it since long before,
 * for the bordered input wrapper, with six consumer files — and Profile mounts
 * both, one inside the other. The promotion pass's own collision rule settles
 * it: neither takes the word, so the labelled one says what it is.
 *
 * ⚠ **IT DECLARES NO LABEL OF ITS OWN, AND THAT IS THE POINT.** The label is
 * `.dpc-modal__label` in `modals.css` — already exactly brief 11 §5's spec, and
 * already worn bare by the three confirm shells. This composes it; it does not
 * restate it. The row (`.dp-sfield`) is layout only: it zeroes the label's
 * confirm-shell `margin-top` so the label sits on the field rather than adding
 * to the gap above it. **A font declared here, or anywhere else for a field
 * label, is a second treatment** — `section11-guard.test.ts` counts the
 * declarations and refuses a second one.
 *
 * ⚠ **`required` puts no asterisk in the label** — brief 11 §5's second half.
 * The marker is the attribute on the control (a screen reader gets it, which an
 * asterisk never gave anyone) and any rule (`min 5 characters`) is `helper`,
 * read at the moment it fails rather than once at the top. It changes no
 * validation: the disabled conditions on every confirm button are untouched.
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function LabelledField({
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
