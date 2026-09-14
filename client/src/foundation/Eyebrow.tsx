import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/**
 * THE RULED EYEBROW — a short mono label, a gap, then a hairline that finishes
 * the row (#928, promoted by section 10's promotion pass; the measurement is
 * `docs/specs/PROMOTION_PASS_SECTION_10.md` §3).
 *
 * It was written out three times and existed as a component nowhere: the lobby
 * menu wrapped it in a local `MenuGroup`, `UserCard` inlined the same three
 * elements by hand, and the casting hero invented its own spelling
 * (`.dpc-deck__eyebrow` + `.dpc-deck__rule`) for a drawing that was already
 * byte-identical to the foundation's — same `500 8.5px` mono, same `.13em`,
 * same `--faint`, same 8px gap, same hairline. Three real consumers against the
 * pass's bar of two.
 *
 * ⚠ IT IS NAMED FOR THE DEVICE, NOT FOR EITHER CALLER. The foundation's copy
 * lived under the menu's vocabulary (`.dp-menugroup`), and pointing the casting
 * hero at that name would have carried the menu onto it — the pass's naming
 * rule read in the direction nobody reads it. So the rename happened on the way
 * in, which is the only moment it is cheap.
 *
 * TWO THINGS THE DEVICE DELIBERATELY DOES NOT CARRY:
 *
 * - **Padding.** `.dp-menugroup` baked the menu's own spacing into the shared
 *   drawing, and the deck — spaced by `.dpc-deck__brief` — wanted none of it.
 *   That is exactly how the next context ends up writing its own copy, which is
 *   how this card came to exist. Position now lives at the call site
 *   (`.dp-menu__group`), and the device is only the drawing.
 * - **Its own capitals.** The deck set `text-transform: uppercase` on the
 *   container while the two menus typed their caps into the markup. The
 *   component carries the transform, which is a no-op for text that is already
 *   capitals — so all three surfaces are unchanged, and a future call site
 *   passing sentence case gets the same look rather than a different one.
 */
export function Eyebrow({
  label,
  className,
}: {
  label: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("dp-eyebrow", className)}>
      <span className="dp-eyebrow__label">{label}</span>
      <span className="dp-eyebrow__rule" aria-hidden="true" />
    </div>
  );
}
