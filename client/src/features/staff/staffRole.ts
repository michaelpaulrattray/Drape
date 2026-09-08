/**
 * WHO COUNTS AS STAFF, IN ONE PLACE — #699.
 *
 * The moderator panel's entire client-side gate was one inline expression
 * (`ModeratorDashboard.tsx`), and `useModeratorFlagCounts` stated the same
 * rule again in the opposite polarity. Two statements of one rule is working
 * law 4, and neither could be driven: nothing in the repository rendered
 * either file, so `client/src/features/moderator/section09-guard.test.ts` —
 * the file whose name suggests it — never mentioned the gate at all.
 *
 * ⚠ THIS IS THE CLIENT'S HONESTY, NOT THE ENFORCEMENT BOUNDARY. The server is
 * the boundary and it holds: `moderatorProcedure` refuses a plain user with
 * FORBIDDEN, driven in `server/changeRequests.test.ts` and (the admin half)
 * `server/moderator.test.ts`. What lives here is whether a person who reaches
 * `/moderator` without the role sees an honest redirect or a broken-looking
 * dashboard full of failing queries.
 *
 * Driven in `staffRole.test.ts`; that the component actually USES these rather
 * than re-deriving the rule inline is guarded there too.
 */

/** The two roles the moderator surface admits. Admins inherit the whole
 *  moderator surface server-side (the capability grid's footnote 1), so the
 *  client must not be narrower than the server. */
export const STAFF_ROLES = ["moderator", "admin"] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];

export function isStaffRole(role: string | null | undefined): boolean {
  return STAFF_ROLES.includes(role as StaffRole);
}

/**
 * The moderator panel's gate.
 *
 * ⚠ `loading` and `isAuthenticated` are both terms of the answer, not
 * preconditions a caller may skip. The panel's guard ladder runs
 * loading → unauthenticated → unauthorised, so this must be FALSE for the
 * first two: a session still loading has no role yet, and a signed-out
 * visitor belongs at `/login`, not at `/app`. Answering `true` for either
 * would redirect the wrong person to the wrong place.
 */
export function isModeratorPanelUnauthorized(view: {
  loading: boolean;
  isAuthenticated: boolean;
  role: string | null | undefined;
}): boolean {
  return !view.loading && view.isAuthenticated && !isStaffRole(view.role);
}
