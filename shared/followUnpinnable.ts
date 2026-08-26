/**
 * THE AXES A CHIP CAN UNPIN ON A FOLLOW — `withUnlocksApplied`'s own three
 * (`briefCompiler.ts`): the only axes a follow's anchor supplies that a chip
 * can therefore strip. On the author road (#154) these are the only removable
 * chips a follow sheet draws, and the only facts the echo offers to let vary
 * there. ONE declaration, read by the server (`buildChips` → each chip's
 * `removable`) and the client (`varyOffered`), so a fourth unlockable axis
 * cannot reach one end and not the other (working law 4; review of PR #156).
 */
export const FOLLOW_UNPINNABLE_FIELDS = ["sex", "ageBand", "heritage"] as const;
export type FollowUnpinnableField = (typeof FOLLOW_UNPINNABLE_FIELDS)[number];

export function isFollowUnpinnable(field: string): field is FollowUnpinnableField {
  return (FOLLOW_UNPINNABLE_FIELDS as readonly string[]).includes(field);
}
