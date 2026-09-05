/**
 * WHAT THE DOCK'S KEPT STRIP SHOWS, AND WHEN (#554).
 *
 * The founder, with a frame of his own sheet: *"if i click keep on a cast tile
 * it can take around 2 seconds to show up in the prompt box."*
 *
 * Two views of one fact, one of them optimistic and one of them not. The TILE
 * paints its ring from `optimisticKept` on the click (D-38, and the comment on
 * `onKeep` says so in as many words). The DOCK's strip read
 * `session.data.shortlist` — the server's list — so the thumbnail could not
 * appear until the mutation had been to Railway and back and a refetch had
 * landed. That round trip is the two seconds he felt.
 *
 * That is working law 4 at the width of one screen: a second view of a fact,
 * derived a different way, drifting from the first for as long as the network
 * takes. So there is one derivation now and both surfaces ask it — the server's
 * shortlist overlaid with what the user has just done, exactly as the tile's
 * ring already resolves.
 *
 * It is a module rather than an inline expression because the STRIP, the KEPT
 * COUNT and the SIGN TARGET all have to agree about who is in the tray. Three
 * copies of an overlay is how the ring and the target came to point at
 * different women once already (fable-729 §5, and `signTarget.ts` exists
 * because of it).
 */

/** A tray row, as the server projects it (`projectShortlist`). */
export type StripEntry = {
  candidateId: string;
  thumbUrl: string | null;
  imageUrl: string | null;
  personaLine: string | null;
  sourceRollIndex: number;
  indexLabel: string;
};

/** The fields of a viewed roll's candidate that a tray row is built from. */
export type StripCandidate = {
  candidateId: string;
  indexLabel: string;
  imageUrl: string | null;
  thumbUrl: string | null;
  personaLine: string | null;
  status: "casting" | "ready" | "failed-refunded" | "signed";
};

export type VisibleShortlistInput = {
  /** The server's shortlist, oldest keep first — the whole sheet, every roll. */
  shortlist: readonly StripEntry[];
  /**
   * The VIEWED roll's candidates. The only faces a click can have just kept
   * are the ones on screen, so this is the whole population of the overlay's
   * additions — a keep on another roll has long since been confirmed.
   */
  candidates: readonly StripCandidate[];
  /** The viewed roll's index, for the tray's "ROLL 02" label. Null = unknown. */
  rollIndex: number | null;
  optimisticKept: Record<string, boolean>;
  optimisticDiscarded: Record<string, true>;
};

/**
 * The tray's faces as the user believes them to be, oldest keep first.
 *
 * Order matters and is inherited rather than invented: the server sends oldest
 * keep first, and a face just kept is the newest, so it goes on the END.
 * `signTargets` reverses this list to aim the dock, so appending is what makes
 * the face you just kept the one the Sign button offers — which is the rule
 * that module already states ("the last thing you kept is almost always the one
 * you mean").
 */
export function visibleShortlist(input: VisibleShortlistInput): StripEntry[] {
  const { shortlist, candidates, rollIndex, optimisticKept, optimisticDiscarded } = input;

  /*
    Un-keeping and discarding both remove her NOW, for the same reason keeping
    adds her now: the tile has already stopped showing its ring, and a strip
    still carrying her thumbnail is the same two-views defect pointing the other
    way. `!== false` rather than a truthiness test — an absent entry means "the
    user has not touched this one", which is not the same as "unkept".
  */
  const base = shortlist.filter(
    (entry) =>
      optimisticKept[entry.candidateId] !== false && !optimisticDiscarded[entry.candidateId],
  );

  // Nothing to add against a roll whose index we cannot label.
  if (rollIndex === null) return base;

  const present = new Set(base.map((entry) => entry.candidateId));
  const added = candidates
    .filter(
      (candidate) =>
        optimisticKept[candidate.candidateId] === true &&
        !present.has(candidate.candidateId) &&
        !optimisticDiscarded[candidate.candidateId] &&
        /*
          ⚠ READY ONLY, AND THIS ONE IS LOAD-BEARING — it is not defensive
          tidiness, and removing it puts a signed face back in the tray.

          `optimisticKept` is not cleared when a keep SUCCEEDS; it is dropped
          only on failure and on undo. So the flag stays `true` for as long as
          the sheet is open. When that face is then SIGNED, the server's loader
          drops her from the shortlist (`listKeptCandidates` filters
          `status = 'ready'` — fable-744 §3b ruled the loader the product and
          deleted the projection's `signed` field on the strength of it). She
          therefore leaves `base`, `present` no longer holds her, and without
          this line the overlay would cheerfully ADD HER BACK from a stale
          optimistic flag — a 450-credit purchase re-appearing in the tray she
          graduated out of, and re-enterable as a Sign target.

          Keep is only drawn on a ready tile, so this can never fire on the
          keeping path. It fires on the signing one.
        */
        candidate.status === "ready",
    )
    .map((candidate) => ({
      candidateId: candidate.candidateId,
      thumbUrl: candidate.thumbUrl,
      imageUrl: candidate.imageUrl,
      personaLine: candidate.personaLine,
      sourceRollIndex: rollIndex,
      indexLabel: candidate.indexLabel,
    }));

  return [...base, ...added];
}
