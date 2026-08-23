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
 *
 * # ⚠ TWO MORE, APPENDED — and APPENDED is the load-bearing word
 *
 * The Two Paths ruling gives this table a second population (design
 * `CASTING_V2_TWO_PATHS_DESIGN.md` §9, countersigned fable-1334 question 2,
 * migration 0052): a cast born on the Wardrobe path is refused a tattoo because
 * *its own outfit covers the surface she named*, and that refusal is the same
 * question this table already answers — **what did we have to refuse, and how
 * many people wanted it.** A second table would be a second thing to read,
 * which in practice is a second thing nobody reads.
 *
 * **MySQL stores an enum as an INDEX and not as the word.** So the order of
 * this list IS the meaning of every row already written: append and nothing
 * moves; reorder or rename and every stored `torsoUnstated` silently becomes
 * something else, with no error anywhere. The two new members go on the END,
 * and `inkFormDemandMigration.test.ts` holds them there against the DDL.
 *
 * And they SPLIT for this table's own precedent — the same reason
 * `torsoNonbinary` and `torsoUnstated` are two values for one refusal:
 *
 *   `surfaceCovered`        her outfit genuinely covers the surface. The demand
 *                           is for a WARDROBE EDIT or a Basics recast — a
 *                           product road, and the number says how many wanted it
 *   `surfaceCoverageUnread` nobody has read this outfit's coverage, so the gate
 *                           failed closed on a surface that might be perfectly
 *                           bare. The demand is for 7a-bis, the reader that
 *                           answers an arbitrary line — a DIFFERENT road, and
 *                           counting it as the first would inflate the case for
 *                           the wrong build
 *
 * # ⚠ AND A CORRECTION TO MIGRATION 0052'S OWN PROSE, WHICH IS WHY IT IS HERE
 *
 * That migration says *"BOTH VALUES ARE REACHABLE"* of `pathAtRefusal`, and
 * `basics` is NOT — measured by driving the classifier rather than read off the
 * tables (`inkCoverageDemandReach.test.ts`, which carries the whole reading and
 * the argument). The coverage branch is only entered for a placement the words
 * road SERVES; `upperChest` is served at no setting, so a chest ask never asks
 * about her outfit at all, and a Basics line leaves the neck and the upper arm
 * bare so those render. No Basics cast can produce a coverage refusal today.
 *
 * The narrower sentence that is true, and it names a live road: **`basics`
 * becomes reachable the day `upperChest` joins the served set** — the court in
 * fable-1296 §3 that `WORDS_ROAD_PLACEMENTS_OPEN` is waiting on.
 *
 * The migration file is deliberately NOT edited: it has been applied in both
 * worlds and the file is the record of what was run. The correction lives where
 * somebody changing this vocabulary is standing, which is here.
 */
export const INK_FORM_DEMAND_KINDS = [
  "torsoNonbinary",
  "torsoUnstated",
  "surfaceCovered",
  "surfaceCoverageUnread",
] as const;
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
