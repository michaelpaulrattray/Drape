/**
 * THE PICTURE ANSWERS THE CLICK, NOT THE ROUND TRIP (fable-501).
 *
 * The founder: switching between versions takes a while to swap the photo, and
 * his guess was that the panel's features load first. Measured before anything
 * was changed (`drive-version-switch-latency-disposable`, dev, no throttle),
 * from the click:
 *
 * ```
 *      15 →  2,745 ms   selectVariant        (the mutation)
 *   2,759 →  4,612 ms   variants             (awaited AFTER it)
 *   4,626 → 27,078 ms   getRoll+getSession+segmentsOnFace+facePanel+faceScan
 *  swap at 27,114 ms    the <img> src finally changed
 * ```
 *
 * **Not one millisecond of that was image bytes.** The rail's thumbnails are
 * the full pictures at the same URLs, so the frame being switched to is already
 * in the browser's cache — the swap and the sharp reading are the same
 * millisecond. The entire wait was the viewer's URL coming from `getRoll`,
 * which tRPC batches into one HTTP request with `facePanel` and `faceScan`. One
 * slow member of a batch holds every other member's answer, so the photograph
 * was waiting on a face scan it does not need and cannot use.
 *
 * # What this holds
 *
 * The version they just clicked, and the picture it replaces. The viewer draws
 * it immediately — the URL was already in hand, in the rail they clicked — and
 * the server catches up in its own time.
 *
 * # Why it carries what it REPLACED
 *
 * So it expires by itself. An override that simply won until someone cleared it
 * would pin a stale photograph the moment anything else changed the candidate's
 * picture — a refine landing mid-switch would deliver the new render and the
 * viewer would keep drawing the old pick. Holding `insteadOf` makes the claim
 * narrow and self-limiting: *while the server still says THAT, draw THIS*. The
 * instant the server says anything else — the chosen frame, or a newer one —
 * the override stops applying, with no effect, no timer and no cleanup.
 *
 * And it is scoped to its own candidate, because one viewer walks a whole
 * sheet: an override keyed on nothing would follow the arrows onto another
 * woman's face, which is the class fable-465 already cost us once.
 */
export type ChosenFrame = {
  /** The face this pick was made on. */
  candidateId: string;
  /** The picture they chose — a URL the rail already holds. */
  url: string;
  /**
   * Its small copy, if that version has one (fable-503).
   *
   * The rail drew this chip, so it is already in the browser: the viewer shows
   * it in the same frame as the click and sharpens when the full picture
   * decodes. Null for a version delivered before thumbnails existed, and then
   * the viewer holds the previous frame exactly as it did.
   */
  previewUrl?: string | null;
  /**
   * EVERY PICTURE THIS BURST HAS LEFT BEHIND — not merely the one on screen at
   * the click (founder bug, granted in fable-701 §4).
   *
   * It was a single URL, and a burst of clicks broke it in a way that looked
   * like the product losing her work. Five clicks put five writes in a queue
   * that runs one at a time; the sheet's own poll lands somewhere in the middle
   * of that queue and the server honestly answers with an INTERMEDIATE version —
   * one she passed through two clicks ago. That URL was not the single frame
   * this override was watching for, so the override stood down and the
   * abandoned version came back onto the plate for about sixteen seconds,
   * before the last write finally landed and it changed again by itself.
   * Reproduced twice.
   *
   * So the claim widens to exactly the thing it was always trying to say:
   * *while the server is still showing ANY picture this burst has superseded,
   * draw the last one she clicked.* Each click in a burst carries the previous
   * claim's list forward, plus the frame that claim was drawing — so the set is
   * the burst's own history and nothing else.
   *
   * **It stays self-limiting, which is the whole reason `insteadOf` exists.**
   * A refine landing mid-switch delivers a picture NOBODY clicked, so it is in
   * no burst's history, so the override dies on the instant with no timer and
   * no cleanup — exactly as it did when this was one URL.
   */
  insteadOf: readonly string[];
  /**
   * WHICH VERSION THIS PICK IS — so the rail's highlight and the photograph are
   * ONE claim rather than two (founder bug, fable-546).
   *
   * The viewer rode this override and the rail's highlight rode the
   * server-confirmed selection, so for the round trip they disagreed: the
   * picture switched instantly and the chip stayed lit on the version she had
   * left. Two readers of "which version is she on" is the mirror law on a
   * surface, and the answer is the same one the picture already uses — with the
   * same expiry, the same scope and the same self-limiting rule, all of which
   * come free by putting it here rather than in a second piece of state.
   *
   * `null` is the ORIGINAL, which is a real selection and not an absence.
   */
  variantId: string | null;
};

/**
 * WHICH VERSION THE RAIL SHOULD LIGHT — the same claim as the picture above.
 *
 * While the override applies (this candidate, and the server still showing the
 * frame it replaces), the chip she clicked is the lit one. The moment the
 * server catches up — or anything else changes the picture, a refine landing
 * mid-switch included — this falls back to the confirmed selection with no
 * timer and no cleanup, exactly as the frame does.
 */
/**
 * DOES THE CLICK STILL SPEAK FOR THIS FACE? — the one rule, in one place.
 *
 * Three surfaces ask it: the photograph, the rail's lit chip, and the small
 * copy the viewer shows while the full frame decodes. They were three copies of
 * `serverUrl === chosen.insteadOf`, which is the mirror law waiting to happen —
 * and the moment `insteadOf` became a set, a copy left behind would have been a
 * surface still obeying the old rule while the other two obeyed the new one.
 */
export function overrideApplies(input: {
  candidateId: string;
  /** What the server currently says this candidate's picture is. */
  serverUrl: string;
  chosen: ChosenFrame | null;
}): boolean {
  const { chosen, candidateId, serverUrl } = input;
  if (!chosen || chosen.candidateId !== candidateId) return false;
  return chosen.insteadOf.includes(serverUrl);
}

/**
 * THE BURST'S HISTORY, ONE CLICK LONGER — what the next claim supersedes.
 *
 * Everything the live claim was already watching for, plus the frame it was
 * drawing, which the new click has just left behind. The picked frame is kept
 * OUT of its own history: an override that superseded itself would never be
 * spent by the server catching up, and being spent is how it ends.
 *
 * Handed the previous claim rather than reading state, so the rule is testable
 * without a browser and the caller cannot accumulate it a second way.
 */
export function supersededBy(input: {
  candidateId: string;
  /** The picture the SERVER says this face has at this click. Null when nothing
   *  has answered for this face yet, and then it contributes nothing. */
  showing: string | null;
  /** The frame being picked now. */
  picked: string;
  /** The claim this one replaces, if a burst is already running on this face. */
  previous: ChosenFrame | null;
}): string[] {
  const { candidateId, showing, picked, previous } = input;
  const carried = previous && previous.candidateId === candidateId
    ? [...previous.insteadOf, previous.url]
    : [];
  return Array.from(new Set([...(showing === null ? [] : [showing]), ...carried]))
    .filter((url) => url !== picked);
}

/**
 * WHAT A CLICK CLAIMS — and it claims something EVERY time (founder bug,
 * fable-726; the fix ruled in §4).
 *
 * His report: *"sometimes it works fine, sometimes i have to click a few
 * times… say im on the original thumbnail and theres 3 total, if the middle
 * one isnt working for me to click onto it, the third one will"* — and after
 * the third works, the middle works.
 *
 * That is this defect's exact fingerprint, and the guard that caused it was one
 * clause: the claim was only written when the picked frame differed from the
 * server's. So when the server's frame was already the version she clicked, no
 * new claim was written — and the claim ALREADY STANDING went on painting the
 * version she had left. The click did everything else it does (the write went,
 * the selection moved on the server) and the picture did not move, which is a
 * dead click to the only judge who matters.
 *
 * Intermittent for a reason that reads as randomness from the outside: it
 * needs the shown override and the server's own frame to be pointing at
 * different versions, which is true only while a write is in flight or a poll
 * is behind — and that alignment shifts every time an edit lands or a panel
 * refreshes. Clicking the third chip is a real switch, so it works; the
 * alignment then changes and the middle one takes.
 *
 * **A click on ANY tile paints that tile.** There is no case where skipping the
 * claim is the right answer, because the claim is what the three surfaces read:
 * writing it when the server already agrees costs one inert object (its history
 * cannot contain the frame it draws, so `overrideApplies` is false and the
 * server's own answer — the same picture — is what paints), and skipping it
 * leaves a stale claim speaking for a click that never made it.
 */
export function claimFor(input: {
  candidateId: string;
  /** What the server currently says this candidate's picture is. */
  showing: string | null;
  /** The picture the clicked chip draws — null when the rail has no URL for
   *  that version yet, which is the one case nothing can be claimed. */
  picked: string | null;
  variantId: string | null;
  /** Its small copy, if that version has one. */
  previewUrl: string | null;
  /** The claim on screen at this click, whoever it belongs to. */
  previous: ChosenFrame | null;
}): ChosenFrame | null {
  const { candidateId, showing, picked, variantId, previewUrl, previous } = input;
  if (picked === null) {
    /*
      NOTHING TO PAINT — so nothing is claimed, and the stale claim for THIS
      face is withdrawn rather than left standing. We cannot draw a picture we
      do not have a URL for; what we can do is stop drawing the wrong one, and
      let the server's own frame answer when the write lands. A claim on
      another face is untouched — it speaks for a tile this click is not about
      (the fable-465 scope).
    */
    return previous && previous.candidateId !== candidateId ? previous : null;
  }
  return {
    candidateId,
    variantId,
    url: picked,
    previewUrl,
    insteadOf: supersededBy({ candidateId, showing, picked, previous }),
  };
}

export function selectedVariantFor(input: {
  candidateId: string;
  /** What the server currently says this candidate's picture is. */
  serverUrl: string;
  /** What the server currently says is selected. */
  serverSelected: string | null;
  chosen: ChosenFrame | null;
}): string | null {
  const { chosen, serverSelected } = input;
  return overrideApplies(input) ? chosen!.variantId : serverSelected;
}

export function frameUrlFor(input: {
  candidateId: string;
  /** What the server currently says this candidate's picture is. */
  serverUrl: string;
  chosen: ChosenFrame | null;
}): string {
  const { chosen, serverUrl } = input;
  return overrideApplies(input) ? chosen!.url : serverUrl;
}
