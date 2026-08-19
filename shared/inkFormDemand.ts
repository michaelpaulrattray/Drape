/**
 * WHO WANTED A FORM THAT DOES NOT EXIST — the vocabulary, apart from the table.
 *
 * `SEXES` has three members and the ink template set has two torso forms, so a
 * nonbinary Cast asking for a neck or upper-chest design is refused rather than
 * routed to a blank drawn for somebody else's build (ruled fable-1025 §1). That
 * refusal is COUNTED, because *"a third form when you want one"* should reach
 * the founder's desk with a number beside it rather than as an anecdote — and
 * **a refusal nobody counts is a demand signal thrown away.**
 *
 * # A shared file, for `drizzle/schema.ts`' sake
 *
 * The table's two enums are DERIVED from these constants rather than retyped
 * (working law 4), the same way `INK_PLACEMENTS` and `INK_TEMPLATE_KINDS` are.
 * A second list beside the schema is the parallel copy that drifts, and here
 * the drift would be a value MySQL silently truncates to the empty string.
 */

/**
 * WHICH form was missing — and there are two reasons, which is why there are
 * two values rather than one.
 *
 * `torsoNonbinary` is the demand signal proper: a build the set has never been
 * drawn for. `torsoUnstated` is a Cast whose sex was never resolved at all —
 * an older row, or a brief that never said. They refuse identically and they
 * mean completely different things: the first is *draw a third form*, the
 * second is *this record is missing a field*. One value for both would put a
 * data gap into the count that decides whether to commission artwork.
 *
 * Neither is a placement and neither is an account. The arm is one bare limb
 * and serves every cast, so it can never appear here.
 */
export const INK_FORM_DEMAND_KINDS = ["torsoNonbinary", "torsoUnstated"] as const;
export type InkFormDemandKind = (typeof INK_FORM_DEMAND_KINDS)[number];

/**
 * How it went.
 *
 * Only `refused` is reachable today — the form does not exist, so nothing else
 * can happen. `delivered` is here so the table SURVIVES the day the third form
 * ships: on that day the same rows answer *did commissioning it work*, and a
 * table that could only record the absence would have to be migrated to answer
 * the question it was built for.
 */
export const INK_FORM_DEMAND_OUTCOMES = ["refused", "delivered"] as const;
export type InkFormDemandOutcome = (typeof INK_FORM_DEMAND_OUTCOMES)[number];
