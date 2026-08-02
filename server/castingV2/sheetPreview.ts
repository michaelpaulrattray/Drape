/**
 * The faces on an unsigned sheet's card.
 *
 * Extracted from the route so the rule can be PINNED. It has now been wrong
 * twice in ways review did not catch, and both times the card looked plausible
 * while lying about the sheet behind it:
 *
 *  - it filtered on `thumbKey`, a column nothing populates, so every real card
 *    was empty and only a hand-built fixture rendered;
 *  - it fell back to the latest roll only when the kept list was *empty*, so a
 *    sheet with one keep showed one face in a strip built for four and read as
 *    abandoned — the card punishing the owner for shortlisting.
 *
 * The rule, stated once: **kept faces lead, the latest roll backfills.** Kept
 * first because that is what the owner chose; the roll after it because a strip
 * with holes says "nothing here" and a full one says "a sheet in progress".
 */

/** The columns this projection needs. Deliberately narrow (invariant 8). */
export type SheetPreviewCandidate = {
  id: number;
  status: string;
  imageKey: string | null;
  thumbKey: string | null;
};

/** How many faces the card's strip holds. */
export const SHEET_PREVIEW_LIMIT = 4;

/**
 * A candidate can be previewed when it landed and has a picture.
 *
 * `thumbKey ?? imageKey` and the fallback is the point: the thumbnail worker is
 * deferred scope (§G.6), so `thumbKey` is null on every candidate in production
 * and always has been. Full images at 90px cost more than they should until
 * that worker exists, and an empty strip costs more than that.
 */
export function previewKeyOf(candidate: SheetPreviewCandidate): string | null {
  if (candidate.status !== "ready") return null;
  return candidate.thumbKey ?? candidate.imageKey ?? null;
}

/**
 * Kept faces first, then the latest roll, deduplicated, capped at the strip.
 *
 * Deduplication is not tidiness: a kept candidate is usually ALSO in the latest
 * roll, so concatenating without it would show the same person twice and make
 * the sheet look emptier than it is — the exact failure the blend was meant to
 * fix, reintroduced by the fix.
 */
export function sheetPreviewKeys(
  kept: readonly SheetPreviewCandidate[],
  rollCandidates: readonly SheetPreviewCandidate[],
  limit: number = SHEET_PREVIEW_LIMIT,
): string[] {
  const seen = new Set<number>();
  const keys: string[] = [];
  for (const candidate of [...kept, ...rollCandidates]) {
    if (keys.length >= limit) break;
    if (seen.has(candidate.id)) continue;
    seen.add(candidate.id);
    const key = previewKeyOf(candidate);
    if (key) keys.push(key);
  }
  return keys;
}
