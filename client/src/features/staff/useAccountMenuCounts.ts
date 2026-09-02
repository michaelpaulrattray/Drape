import { useStaffCounts } from "./useStaffCounts";
import { useModeratorFlagCounts } from "./useModeratorFlagCounts";

/**
 * THE TWO NUMBERS IN THE ACCOUNT MENU (#416).
 *
 * `UserCard` has declared `adminCount` and `moderationCount` since section 04,
 * renders a pill for each, and omits at zero. **Its one call site passed
 * neither**, so both arrived `undefined` and the badges have never once shown a
 * number — invariant 7 in its gentlest form: written, styled, rendered, wired
 * never. Nothing was broken on screen and no test was red. This hook is the
 * wire.
 *
 * # ⚠ WHY THIS FILE EXISTS AT ALL, RATHER THAN TWO CALLS IN `AppChrome`
 *
 * It composes hooks and issues no query, and that is the whole point.
 * `counts415-guard.test.ts` derives from the client tree that **exactly one
 * module both names `pendingChangeRequests` and calls tRPC** — the arm #415 was
 * asked for in those words, so that a second reader of the admin count cannot
 * appear without reddening the suite. `AppChrome` calls `trpc.` for credits and
 * profile, so destructuring the field there would have tripped that arm and
 * invited the next shift to "fix" the guard.
 *
 * ⚠ **A guard arm moving to admit a new consumer is how a derived guard becomes
 * a list.** #414's card names the same trap. Nothing here moved: the field is
 * named in a module with no `trpc.` in it, and the tree-derived arm passes
 * untouched.
 *
 * # One number, three surfaces
 *
 * `adminCount` is `useStaffCounts`'s value and nothing else — the same value
 * behind the `Change requests` tab pill (#415) and Overview's `NeedsHuman`
 * card, all descending from the single `getGovernanceMetrics` statement. A menu
 * saying `4` over a bar saying `3` is worse than a menu saying nothing.
 *
 * # Roles
 *
 * Neither hook is gated here; each gates its own query on the role that may ask
 * (`useStaffCounts` admits admins, `useModeratorFlagCounts` admits moderators
 * and admins). `UserCard` renders the `Admin` row for admins only and the
 * `Moderation` row for both, so a moderator receives `adminCount: 0` and never
 * sees a row it could sit on.
 */
export interface AccountMenuCounts {
  /** Pending change requests. Omitted at zero by `showsMenuCount`. */
  adminCount: number;
  /** Flagged referrals + flagged credit discrepancies. Omitted at zero. */
  moderationCount: number;
}

export function useAccountMenuCounts(): AccountMenuCounts {
  const { pendingChangeRequests } = useStaffCounts();
  const flags = useModeratorFlagCounts();

  return {
    adminCount: pendingChangeRequests,
    moderationCount: flags.total,
  };
}
