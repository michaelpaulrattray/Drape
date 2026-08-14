/**
 * IS THE SHEET BUSY *ABOUT THIS FACE* — one derivation, two defects.
 *
 * `busy` closes the ask box, drives the button to "Refining…" and takes the
 * picture's region boxes off the screen entirely (`FaceRegions` returns null).
 * That is the right behaviour over a face with a paid render out on it, and it
 * was being computed for the whole sheet.
 *
 * # Defect one — another cast's render muted this one (fable-465)
 *
 * The founder: *"i was not rendering her image i was rendering another cast
 * image"* — and this face's boxes were gone and its button said "Refining…".
 * The second half of the old expression, the server's pending list, was always
 * per-candidate and honest. The first half, `refine.isPending`, is ONE mutation
 * hook shared by every face in the sheet: fire an edit on face A, walk the
 * viewer to face B with ←/→, and B is disabled because A has a request out.
 *
 * The fix is not a second piece of state tracking which face was asked — the
 * mutation already carries it. `refine.variables.candidateId` is the request's
 * own subject, and reading it is a derivation rather than a mirror (law 4).
 *
 * # Defect two — the lock outlived the render (fable-466/467)
 *
 * A worker died a minute into a refine. Its row stayed `dispatched`, so the
 * server went on reporting it in flight, so the sheet stayed shut for the
 * whole ~6-minute lease-and-sweep window with no way out but a manual refresh.
 * The server now says `settling` over a row whose lease has passed
 * (`server/castingV2/pendingStage.ts`): nobody is rendering it and the sweep is
 * refunding it. A row in that state must not hold the customer's hands down —
 * it will never produce a picture to protect them from double-buying.
 *
 * The picture goes on narrating a settling row; only the CONTROLS come back.
 */

/** The stages the server reports for a row that has not landed. */
export type PendingStage = "queued" | "dispatched" | "settling";

/**
 * Rows from `castingV2.variants` — the query is keyed on the candidate being
 * viewed, so this list is already about the face on screen and nothing else.
 */
export type PendingRow = { stage?: PendingStage | null };

export function refineBusy(input: {
  /** The face the viewer is open on. */
  viewerCandidateId: string | null;
  /**
   * The face the sheet's one refine request is out for, or null when nothing
   * is out. Never a face other than the one it was fired on.
   */
  inFlightCandidateId: string | null;
  /** The server's in-flight rows FOR THAT FACE (D-161). */
  pending: readonly PendingRow[];
}): boolean {
  const ours = Boolean(input.viewerCandidateId)
    && input.inFlightCandidateId === input.viewerCandidateId;
  /*
    A row with no stage is a row from a server that has not shipped the third
    state yet, and the honest reading of "I cannot tell" is the one that claims
    less about the customer's money: still running.
  */
  const rendering = input.pending.some((row) => (row.stage ?? "queued") !== "settling");
  return ours || rendering;
}

/**
 * The face a request is out for — `null` when nothing is.
 *
 * Split out so the sheet reads the mutation once and every consumer of "is
 * something out" agrees by construction. `variables` survives the mutation
 * settling, which is why it is only trusted while `isPending`.
 */
export function inFlightCandidate(mutation: {
  isPending: boolean;
  variables?: { candidateId?: string } | undefined;
}): string | null {
  if (!mutation.isPending) return null;
  return mutation.variables?.candidateId ?? null;
}
