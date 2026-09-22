/**
 * What an unsigned sheet's card shows — the faces, and now the states.
 *
 * Extracted from the route so the rule can be PINNED. It has now been wrong
 * three times in ways review did not catch, and every time the card looked
 * plausible while lying about the sheet behind it:
 *
 *  - it filtered on `thumbKey`, a column nothing populates, so every real card
 *    was empty and only a hand-built fixture rendered;
 *  - it fell back to the latest roll only when the kept list was *empty*, so a
 *    sheet with one keep showed one face in a strip built for four and read as
 *    abandoned — the card punishing the owner for shortlisting;
 *  - it projected `ready` and NOTHING else, so a sheet whose latest roll was
 *    still casting, or had been refused, showed a bare card saying "4 rolls"
 *    over an empty strip. The founder hit both halves in one evening (#1086):
 *    *"when you start a roll off a sheet and exit out before anything generates
 *    the card on unsigned sheets needs to appear instantly and show some sort
 *    of loading state, additionally rolls that fail ... should still show
 *    preview cards just cards relevant to the state"*.
 *
 * The rule, stated once: **faces lead — the kept ones first, then the latest
 * roll's — and the latest roll's unfinished slices fill whatever is left.**
 * Kept first because that is what the owner chose; faces before states because
 * a sheet that HAS faces should show them, so nothing that shows today stops
 * showing; states after them because a strip with holes says "nothing here"
 * and a full one says "a sheet in progress".
 */

import { candidateFailureKind } from "../../shared/candidateFailure";

/** The columns this projection needs. Deliberately narrow (invariant 8). */
export type SheetPreviewCandidate = {
  id: number;
  status: string;
  /* The FACE's keys — the selected refinement's where there is one (M8). A
     card strip showing pre-refinement faces would misdescribe the sheet it is
     a preview OF. */
  faceImageKey: string | null;
  faceThumbKey: string | null;
  /** Why a `failed` slice failed, so the tile can say which (#122's vocabulary). */
  failureClass?: string | null;
};

/**
 * One frame in the card's strip, in the customer's terms and no others.
 *
 * `face` is a picture; `pending` is "we are making this one right now";
 * `refused` is the engine's content filter saying no; `failed` is everything
 * else that did not arrive. Nothing here names an engine, a provider, a status
 * column or a pipeline stage — the tile says what happened to the PICTURE, the
 * way the honest loader's stage names do (#55).
 */
export type SheetPreviewTile =
  | { kind: "face"; key: string }
  | { kind: "pending" }
  | { kind: "refused" }
  | { kind: "failed" };

/** How many faces the card's strip holds. */
const SHEET_PREVIEW_LIMIT = 4;

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
  return candidate.faceThumbKey ?? candidate.faceImageKey ?? null;
}

/**
 * The state a NON-face slice of the latest roll shows, or null for no tile.
 *
 * The three silent statuses are silent on purpose and each for its own reason:
 * a `discarded` candidate is one the owner threw away and putting it back on
 * their card would argue with them; a `signed` one has left the sheet for the
 * roster (§F) and a grey frame would mourn it; a `cancelled` one is the
 * owner's own decision, already answered on the sheet, and blaming the
 * product for it on the lobby is the "Didn't arrive" mistake #122 names.
 *
 * `expired` is the fourth and the interesting one: those pictures DID arrive
 * and were swept by retention afterwards, so "didn't arrive" would be false
 * and "refused" worse. An aged-out sheet keeps today's quiet empty strip until
 * there is something true to say on it.
 */
export function previewStateOf(candidate: SheetPreviewCandidate): SheetPreviewTile | null {
  switch (candidate.status) {
    case "queued":
    case "dispatched":
      return { kind: "pending" };
    case "failed":
      /*
        The row's own reason, through the ONE place a failure class becomes a
        customer-facing kind (`shared/candidateFailure.ts`). The card cannot
        hold a private opinion about what `content_policy` means — that is
        working law 4, and the sheet's own tile already reads from here.
      */
      return candidateFailureKind(candidate.failureClass) === "content_filter"
        ? { kind: "refused" }
        : { kind: "failed" };
    default:
      return null;
  }
}

/**
 * Kept faces first, then the latest roll's faces, then the latest roll's
 * unfinished slices — deduplicated and capped at the strip.
 *
 * Deduplication is not tidiness: a kept candidate is usually ALSO in the latest
 * roll, so concatenating without it would show the same person twice and make
 * the sheet look emptier than it is — the exact failure the blend was meant to
 * fix, reintroduced by the fix.
 *
 * The two passes over `rollCandidates` are the whole rule: faces cannot lose a
 * slot to a grey frame that happens to sit at an earlier position. A roll of
 * eight with two refusals shows its six faces exactly as it does today.
 */
export function sheetPreviewTiles(
  kept: readonly SheetPreviewCandidate[],
  rollCandidates: readonly SheetPreviewCandidate[],
  limit: number = SHEET_PREVIEW_LIMIT,
): SheetPreviewTile[] {
  const seen = new Set<number>();
  const tiles: SheetPreviewTile[] = [];
  for (const candidate of [...kept, ...rollCandidates]) {
    if (tiles.length >= limit) break;
    if (seen.has(candidate.id)) continue;
    const key = previewKeyOf(candidate);
    if (!key) continue;
    seen.add(candidate.id);
    tiles.push({ kind: "face", key });
  }
  for (const candidate of rollCandidates) {
    if (tiles.length >= limit) break;
    if (seen.has(candidate.id)) continue;
    const state = previewStateOf(candidate);
    if (!state) continue;
    seen.add(candidate.id);
    tiles.push(state);
  }
  return tiles;
}

/**
 * The faces alone, derived from the tiles above.
 *
 * Kept for one deploy because it is what the shipped bundle reads: a browser
 * holding yesterday's `CastingV2.tsx` against today's server would find
 * `previewUrls` undefined and take the lobby down on `.length`. Only one
 * direction of deploy skew exists (an old bundle against a new server), and it
 * bites exactly when a field is REMOVED — so this goes in the deploy AFTER the
 * one that stops reading it (#1088), never in the same one.
 *
 * DERIVED, not parallel: it reads the tiles rather than re-walking the rows,
 * so the two can never come to disagree about which faces a card shows.
 */
export function sheetPreviewKeys(
  kept: readonly SheetPreviewCandidate[],
  rollCandidates: readonly SheetPreviewCandidate[],
  limit: number = SHEET_PREVIEW_LIMIT,
): string[] {
  return sheetPreviewTiles(kept, rollCandidates, limit)
    .filter((tile): tile is { kind: "face"; key: string } => tile.kind === "face")
    .map((tile) => tile.key);
}
