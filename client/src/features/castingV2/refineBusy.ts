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

/**
 * WHAT THE PICTURE IS WAITING FOR — the same click the button already knows
 * about (fable-582).
 *
 * The founder: *"it does go into a loading state eventually but it takes
 * awhile."* Two surfaces, two sources. The button flips to "Refining…" on the
 * click, because `refineBusy` reads the mutation's own subject; the viewer's
 * wait was drawn only from the SERVER's pending list, so it could not appear
 * until the request had been answered and the variants query refetched. Between
 * those two moments the button says one thing and the photograph says nothing.
 *
 * # The server keeps the durable half, and that is deliberate
 *
 * A wait that lived only in the mutation would vanish the moment the sheet was
 * closed and reopened — the defect that got one edit bought twice (D-161). So
 * a LIVE server row still wins: it narrates across unmount, across a reload,
 * and across the founder walking to another face and back. The local reading is
 * only the head of that same wait, filling the seconds before the row exists,
 * and it hands over the moment it does.
 *
 * No new state is minted for it: the instruction is the one the request was
 * sent with, read off the mutation exactly as its subject already is.
 */
export type RefineWait = {
  /** The sentence this face is waiting on. */
  instruction: string;
  stage: PendingStage;
  /** Other rows out for this face — "and 2 more". */
  extra: number;
};

export function refineWait(input: {
  viewerCandidateId: string | null;
  /** The sheet's one refine request, subject and sentence both. */
  mutation: {
    isPending: boolean;
    variables?: { candidateId?: string; instruction?: string } | undefined;
  };
  /** The server's rows for the face on screen. */
  pending: readonly (PendingRow & { instruction: string })[];
}): RefineWait | null {
  /*
    A LIVE ROW NARRATES BEFORE A DEAD ONE, and before the local reading: it is
    the same wait, further along, and it is the one that survives a remount.
  */
  const live = input.pending.filter((row) => (row.stage ?? "queued") !== "settling").at(-1);
  if (live) {
    return {
      instruction: live.instruction,
      stage: live.stage ?? "queued",
      extra: input.pending.length - 1,
    };
  }
  const ours = input.viewerCandidateId !== null
    && inFlightCandidate(input.mutation) === input.viewerCandidateId;
  const instruction = input.mutation.variables?.instruction;
  if (ours && instruction) {
    /* Not in the list yet, so every row there is one of the others. */
    return { instruction, stage: "queued", extra: input.pending.length };
  }
  /* Nothing live and nothing out: a settling row still narrates, because the
     picture goes on describing a row the sweep is refunding even though the
     controls have come back. */
  const settling = input.pending.at(-1);
  return settling
    ? { instruction: settling.instruction, stage: settling.stage ?? "queued", extra: input.pending.length - 1 }
    : null;
}
