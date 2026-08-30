import type { CSSProperties } from "react";

/**
 * Severity, in greyscale plus the one red (brief 00 §4).
 *
 * `features/admin/adminConstants.ts` and `features/moderator/moderatorConstants.ts`
 * each carry `SEVERITY_COLORS` and `CATEGORY_COLORS` as Tailwind tint classes —
 * seven tints between them: blue, amber, red, emerald, purple, orange, red
 * again. The foundation allows exactly one colour beside the accent, `--error`,
 * and only for genuinely urgent state. Seven tints collapse to three looks.
 *
 * **Category is deliberately not here.** It is carried by the mono action
 * string (`stripe.refund.manual`), which says more than a colour can and reads
 * the same in both themes. `CATEGORY_COLORS` is deleted rather than ported —
 * see the brief.
 *
 * ⚠ **This ships BESIDE the two constants files rather than replacing them
 * today, and that is a declared deviation from brief 00's checklist.** The
 * brief's §4 asks for the deletion in this section; the brief's own acceptance
 * test — and the founder's own words for segment 1 — is that **no existing page
 * changes appearance**. Nine call sites across `features/admin/` and
 * `features/moderator/` render those tints, so deleting the constants here
 * would repaint the audit log, the activity tab and five modals. That repaint
 * is real work and it belongs to section 02, which owns those directories. The
 * helper landing now is what unblocks it.
 */

export type Severity = "info" | "warning" | "critical";

/**
 * The inline style for a severity mark. Returned as a style object rather than
 * a class name because the three looks are three token triples and nothing
 * else — a class per severity would be three CSS rules that only ever set the
 * same three properties.
 */
export function severityLook(sev: Severity): CSSProperties {
  switch (sev) {
    case "critical":
      /* The one red. Border AND text, on the ordinary surface — a filled red
         block for a log row that is merely noteworthy is how "critical" stops
         meaning critical. */
      return {
        border: "1px solid var(--error)",
        background: "var(--surface)",
        color: "var(--errorInk)",
      };
    case "warning":
      return {
        border: "1px solid var(--borderInput)",
        background: "var(--fill)",
        color: "var(--metaStrong)",
      };
    case "info":
      return {
        border: "1px solid var(--rule)",
        background: "transparent",
        color: "var(--faint)",
      };
  }
}
