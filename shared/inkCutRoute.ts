/**
 * WHAT WAS DONE TO AN UPLOADED DESIGN BEFORE IT WAS STORED — the two things
 * the cutter can decide, and the third thing that is the absence of a decision.
 *
 * `cut`        the design was cut out of her picture; what is stored is the
 *              artwork on transparency
 * `rideWhole`  the cutter looked and ruled the frame rides unchanged
 * *(absent)*   NOBODY LOOKED — `CASTING_INK_CUT_SCOPE` was off for this account
 *              when the design was stored
 *
 * # Why the vocabulary lives in `shared/` rather than beside the cutter
 *
 * Because migration 0047 made it a database column, and `drizzle/schema.ts`
 * cannot import from `server/`. Two spellings of a closed vocabulary — one in
 * the module that decides it, one in the column that keeps it — is working law
 * 4's copy, and it would drift the first time a third route was measured.
 *
 * So there is one list. The cutter's `InkCutRoute` is this type, the column's
 * `mysqlEnum` is this array, and `inkCutRouteCoupling.test.ts` is the arm that
 * reddens if either ever stops being so.
 *
 * # THE ABSENCE IS NOT A MEMBER, AND MUST NEVER BECOME ONE
 *
 * It is tempting to add `notLookedAt` and make the column NOT NULL. Do not:
 * every row that exists today predates the cutter, and a value spelled into
 * those rows would be a claim written by a migration rather than a fact
 * recorded by the code that looked. NULL is the honest shape of *"no reading
 * was taken"*, and fable-1137 §4's containment condition — a design whose
 * disposition is NULL never rides to a render — is stated over exactly that.
 */

export const INK_CUT_ROUTES = ["cut", "rideWhole"] as const;

export type InkCutRoute = (typeof INK_CUT_ROUTES)[number];

export function isInkCutRoute(value: unknown): value is InkCutRoute {
  return typeof value === "string" && (INK_CUT_ROUTES as readonly string[]).includes(value);
}
