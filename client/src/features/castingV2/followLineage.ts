/**
 * WHICH FACE THE SHEET SAYS IT IS FOLLOWING (#2587).
 *
 * His report, verbatim, 2026-10-16: *"when following a follow of a follow e.g
 * itl say following 07 on the first follow then if i follow someone on that
 * sheet for example 04 the next sheet will still say following 07 until
 * generations begin while it's pre-loading"*.
 *
 * Every lineage sentence on the sheet — the FOLLOWING chip, the echo's "The
 * eight follow 04 on roll 03", the brief box's placeholder — was read off
 * `roll.data.lineage`, the roll the sheet has LOADED. Between the press and the
 * new roll's row landing, that is still the previous roll, whose lineage is the
 * earlier follow. So for those seconds the studio named the wrong face.
 *
 * The press already knows the answer: the face that was clicked (or, for Roll
 * again under a standing chip, the face the chip already names). So the click
 * records the lineage it bought, and while this tab's own dispatch is the roll
 * on screen, the sheet reads THAT; the moment the new row lands the provisional
 * window closes and the server's own lineage takes over again. Nothing is
 * stored past the window, and nothing here decides what is charged — the anchor
 * a Roll again sends is still `standingFollowId`, read off server truth.
 *
 * ⚠ The window is THIS TAB's dispatch (`awaitingNewRoll`), not the server's
 * `castingNow`. On a load that did not make the click there is no record of
 * which face was pressed, and the chip there still says what Roll again would
 * anchor to — which is the loaded roll's parent — so it is not stale in the
 * sense this card is about.
 */

export type SheetLineage = {
  fromCandidateId?: string;
  fromCandidateLabel?: string;
  fromRollId?: string;
};

/**
 * Is the roll a press bought the one on screen, with its own lineage not yet
 * loaded?
 *
 * Open from the click while the latch is held, AND past it until the loaded
 * roll is the active one — the latch settles when the new row exists, which is
 * a poll before that row's `getRoll` answers, and in that gap the chip would
 * otherwise vanish and reappear. Closed the moment the customer picks another
 * roll to look at, and closed when there is no recorded press.
 */
export function dispatchOnScreen(input: {
  pressed: boolean;
  awaitingNewRoll: boolean;
  viewedRollId: string | null;
  loadedRollId: string | null | undefined;
  activeRollId: string | null;
}): boolean {
  if (!input.pressed || input.viewedRollId !== null) return false;
  if (input.awaitingNewRoll) return true;
  return Boolean(input.activeRollId) && input.loadedRollId !== input.activeRollId;
}

/**
 * The lineage a press is buying, recorded at the click.
 *
 * - Follow on a tile: the face pressed, on the roll it sits on.
 * - Roll again under a standing chip: the same parent the chip names (the
 *   anchor is that parent, so the family is unchanged).
 * - Roll again with no chip: an open roll, so no lineage at all.
 */
export function lineageForDispatch(input: {
  mode: "roll" | "follow";
  pressed?: { candidateId: string; indexLabel: string; rollId: string | null } | null;
  standing?: SheetLineage | null;
  standingFollowId: string | null;
}): SheetLineage {
  if (input.mode === "follow" && input.pressed) {
    return {
      fromCandidateId: input.pressed.candidateId,
      fromCandidateLabel: input.pressed.indexLabel,
      ...(input.pressed.rollId ? { fromRollId: input.pressed.rollId } : {}),
    };
  }
  if (input.standingFollowId && input.standing) return { ...input.standing };
  return {};
}

/**
 * The lineage the sheet's words describe right now.
 *
 * While this tab's own dispatch is the roll on screen, it is the one the press
 * recorded; otherwise it is the loaded roll's.
 */
export function lineageOnScreen(input: {
  dispatchOnScreen: boolean;
  dispatched: SheetLineage | null;
  loaded: SheetLineage | null | undefined;
}): SheetLineage | null {
  if (input.dispatchOnScreen && input.dispatched) return input.dispatched;
  return input.loaded ?? null;
}

/**
 * The FOLLOWING chip's face, or null for no chip.
 *
 * Outside the window the chip stands on `standingFollowId` exactly as before
 * (server truth, hidden while reading history or once dismissed). Inside it,
 * the chip names the face just pressed, and an open Roll again shows none.
 *
 * ⚠ THE CHIP SHOWS THE FACE, NEVER ITS NUMBER (#2622). His report, verbatim,
 * 2026-10-17: *"casts say from 05 meaning from sheet 05 and the following
 * sdays following 06 its kind of confusing dont you think is there a better
 * design for this and the UX?"* — and on the proposal, *"sounds good"*. The
 * chip read "FOLLOWING 06" (a face index) above eight tiles reading "FROM 05"
 * (a sheet index): two numbers, two different things, side by side. So this
 * answers WHICH face — its id and the roll it sits on — and the sheet draws
 * that face's own picture beside the word "Following". The per-tile pill is
 * gone: every tile on a follow sheet shares one parent, and the chip says it
 * once.
 */
export type FollowedFace = { candidateId: string | null; rollId: string | null };

export function followingChipFace(input: {
  dispatchOnScreen: boolean;
  dispatched: SheetLineage | null;
  standingFollowId: string | null;
  loaded: SheetLineage | null | undefined;
}): FollowedFace | null {
  if (input.dispatchOnScreen && input.dispatched) {
    if (!input.dispatched.fromCandidateId) return null;
    return {
      candidateId: input.dispatched.fromCandidateId,
      rollId: input.dispatched.fromRollId ?? null,
    };
  }
  if (!input.standingFollowId) return null;
  return { candidateId: input.standingFollowId, rollId: input.loaded?.fromRollId ?? null };
}

/**
 * The followed face's picture, read off the roll it sits on.
 *
 * Null while that roll has not answered, or when the face is no longer there
 * (a discarded parent can be purged while its roll survives): the chip then
 * holds an empty frame of the same size rather than inventing a stand-in.
 */
export function followedFaceThumb(input: {
  face: FollowedFace | null;
  candidates:
    | ReadonlyArray<{ candidateId: string; thumbUrl: string | null; imageUrl: string | null }>
    | null
    | undefined;
}): string | null {
  if (!input.face?.candidateId || !input.candidates) return null;
  const entry = input.candidates.find((candidate) => candidate.candidateId === input.face?.candidateId);
  return entry ? (entry.thumbUrl ?? entry.imageUrl ?? null) : null;
}
