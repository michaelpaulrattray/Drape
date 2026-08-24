/**
 * When a garment's own description may be used, and the outfit sentence built
 * from the ones that may.
 *
 * A garment is digitized asynchronously; until that finishes its description
 * is the placeholder `"Analyzing..."`. Three production sites tested for that
 * placeholder with their own hand-written `!description.startsWith("Analyzing")`
 * — `routes/wardrobe.ts`'s outfit-context build and `vtoGeneration.ts` twice —
 * and `server/wardrobe.test.ts` carried a FOURTH copy inside an arm commented
 * *"Simulates the server-side logic that builds outfitContext"*.
 *
 * Four hand-typed copies of one product rule is the cap-places class wearing
 * a predicate's clothes: the placeholder string can be changed in one of them
 * and the other three keep their own opinion. It is declared once here, and
 * the arms in `wardrobe.test.ts` drive this rather than a fifth copy.
 * (2026-08-25, 3g. Working law 4: derive, never mirror.)
 */

/** The placeholder a garment carries while its digitization is still running. */
export const ANALYZING_DESCRIPTION_PREFIX = "Analyzing";

/** True when the garment's description is real rather than the placeholder. */
export function hasUsableDescription(
  garment: { description?: string | null },
): boolean {
  return (
    !!garment.description &&
    !garment.description.startsWith(ANALYZING_DESCRIPTION_PREFIX)
  );
}

/**
 * The garments whose description may be shown to the engine: digitized, and
 * past the placeholder.
 *
 * ⚠ OWNERSHIP IS NOT THIS FUNCTION'S JOB and deliberately so. `routes/
 * wardrobe.ts` drops another user's garments at the fetch, against
 * `ctx.user.id`, before anything reaches here — invariant 3, and it stays at
 * the call site where the request's identity is. A test arm that filtered
 * here would be describing a boundary that lives somewhere else.
 */
export function selectDescribableGarments<
  T extends { status?: string | null; description?: string | null },
>(garments: readonly (T | null)[]): T[] {
  return garments.filter(
    (g): g is T => g !== null && g.status === "ready" && hasUsableDescription(g),
  );
}

/** The outfit sentence the refinement prompt carries, or undefined for none. */
export function buildOutfitContext(
  garments: readonly { description?: string | null }[],
): string | undefined {
  if (garments.length === 0) return undefined;
  return garments.map((g) => g.description).join(", ");
}
