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
 *   `features/staff`'s `RolePill`, a component that already existed, is already
 *   greyscale, and whose own docblock rules on this exact case: *"a role is
 *   what someone IS, never something needing attention … a shared component
 *   with an `attention` prop is how the purple `admin` crown comes back."*
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

export const formatDate = (dateStr: string | Date) => {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};
