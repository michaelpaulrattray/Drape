/**
 * Whether a menu row shows its count pill (brief 00b §2, brief 01 §3).
 *
 * The rule is one sentence — *"Omit at zero; never render `(0)`"* — and it is
 * here as a function rather than inline in the row because the two ways of
 * getting it wrong are both a single character away from the right one:
 * `count != null` renders `0`, and `count !== undefined` renders `0` as well.
 * Inline, either would be a green suite and a menu quietly telling staff there
 * are zero things waiting, which is the opposite of the pill's whole purpose —
 * it exists to turn the group into a reason to look.
 *
 * A guard that only reads the source for the right spelling is a guard on a
 * spelling. This one is driven (`section00b-guard.test.ts`).
 */
export function showsMenuCount(count: number | undefined): boolean {
  return typeof count === "number" && count > 0;
}
