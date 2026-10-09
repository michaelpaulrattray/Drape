/**
 * WHICH OF THE TWO LINES AN EDIT IS ABOUT — N2b (#1242).
 *
 * Its own tiny module because three places need the type and none of them may
 * import the others: the predicate builder (`castPersonaScope.ts`), the write
 * itself (`castingV2Sign.ts`, which imports the builder) and the router's
 * `.strict()` input. A type re-declared at each would be three spellings of one
 * vocabulary — working law 4 on the smallest possible subject, and still the
 * shape that drifts.
 *
 * The frozen tuple is what the router's enum is DERIVED from, so a third line
 * cannot be added to one without the other.
 */
export const CAST_PERSONA_LINE_KINDS = Object.freeze(["personality", "voice"] as const);

export type CastPersonaLineKind = (typeof CAST_PERSONA_LINE_KINDS)[number];
