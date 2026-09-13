/**
 * Two derivations the accounts table needs — and, until #421, four tinted
 * badges nothing needed.
 *
 * ⚠ **`StatusBadge` and `RoleBadge` ARE DELETED HERE AND THE COUNT IS WHY.**
 * Between them they drew seven tints — emerald, red, cyan, amber, purple, blue
 * and a `#666` — which is the palette brief 07 §3 removed from the staff
 * surfaces. Read at the consumers before either was touched:
 *
 * - `StatusBadge` had **ZERO**. It is re-exported from `features/admin/index.ts`
 *   as `UserStatusBadge` and no file in the product imports that name. Brief 06
 *   moved the accounts table to `StatePill` and left this behind.
 * - `RoleBadge` had **ONE** — the role-change dialog — which now renders
 *   `features/staff`'s `RolePill`, a component that already existed and holds
 *   the colour rule for every staff surface in one place.
 *
 * ⚠ **This docblock used to quote `RolePill` saying every role is greyscale
 *   INCLUDING `admin`. That sentence has a founder-named exception since #422
 *   (2026-09-02) and the quote is removed rather than left to rot** — a
 *   superseded rule quoted in a second file is how the rule gets re-argued by
 *   someone reading the copy instead of the source. **`RolePill` is the source;
 *   read it there.** What survives untouched is the reason these two badges
 *   went: seven tints on a monochrome surface, and `admin` wearing one accent
 *   by his ruling is not a return to that.
 *
 * `UserTable.tsx` imports `formatDate` and `getUserStatus` from this module and
 * nothing else, so the table is untouched by the deletion.
 */
export const getUserStatus = (user: {
  suspendedAt: string | Date | null;
  frozenAt?: string | Date | null;
  lockedUntil: string | Date | null;
}): "active" | "suspended" | "frozen" | "locked" => {
  if (user.suspendedAt) return "suspended";
  if (user.frozenAt) return "frozen";
  if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) return "locked";
  return "active";
};

/**
 * ⚠ **24-HOUR, FORCED — instance 5 of his clock ruling (#912).**
 *
 * This drew `Sep 14, 2026, 09:08 AM` on every row of the admin Users page:
 * the JOINED and LAST ACTIVE columns, and the `Suspended …` / `Frozen …` /
 * `Locked out until …` sentences. The moderator console one click away had
 * already been brought to the house notation by #900 and #903, so the
 * `Frozen` fact was rendered two ways on two staff pages — which is the
 * ruling's own comparative reasoning:
 *
 * > *"every other time in his world is 24-hour … so the one clock he would be
 * > comparing against was the one written differently."*
 *
 * ⚠ **`toLocaleDateString` DOES print a clock when you ask it for `hour`** —
 * the method name is what made this invisible, both to a reader and to
 * `foundation/staffClock.test.ts`, whose matcher opened by asserting the
 * opposite. It is `toLocaleString` here because that is the honest method for
 * a string containing a clock; **the output is byte-identical either way**,
 * measured both ways before the change. Only `hour12` moved — the locale, the
 * field list, the order and the year are untouched.
 */
export const formatDate = (dateStr: string | Date) => {
  return new Date(dateStr).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
};
