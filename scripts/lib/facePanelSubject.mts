/**
 * WHICH CAST THE FACE-PANEL DRIVER LOOKS AT — found, never remembered (#1151).
 *
 * `scripts/drive-face-panel-evidence.mts` addressed one hard-coded session
 * (`2df4aeab-…`) on `userId 1`. Read at the dev rows on 2026-09-26 that session
 * is `expired` and **holds zero candidates**, and `userId 1` has no `ready`
 * candidate anywhere in the dev database — so the driver timed out waiting for a
 * tile, which is the failure shape its own header warns about: *a missing
 * fixture and a broken panel look identical from the browser.* Working law 6 had
 * no road on the surface the founder uses most.
 *
 * # ⚠ THE CARD'S OWN TEST IS NOT SUFFICIENT, AND THAT IS THE FINDING
 *
 * #1151 asked for *"any account with a ready candidate"*. A ready candidate is
 * not enough: `FacePanel.tsx` ends its render gate with
 * `if (drawn.length === 0 && !working) return null`, and the panel's rows come
 * from the reference library, which — in the `facePanel` procedure's own words —
 * *"holds only what an EDIT minted"*. **So a ready candidate nobody has ever
 * edited has NO panel, correctly, and a driver pointed at one would report the
 * panel missing on a healthy product.** That is exactly what #1151 recorded
 * when it widened `CASTING_REFERENCE_LIBRARY_SCOPE` to the dev bot and found
 * the sheet rendering while the viewer *"still will not open"*.
 *
 * The subject therefore has to be a candidate that is `ready` **and carries
 * library rows**, and the query that finds it says so. Measured in dev the same
 * hour: three such candidates exist (53 rows, 11 rows, 2 rows), so the panel
 * has been openable in dev all along and nothing needed seeding or spending —
 * only asking.
 *
 * # WHY THE CHOICE IS A FUNCTION AND NOT A `LIMIT 1`
 *
 * Because the ORDER is a judgement and it should be readable and drivable: an
 * `open` session beats one that is `abandoned` or `expired` (the product refuses
 * work on the latter, and a driver that grades a refusal is grading the wrong
 * thing), then the richest panel, then the newest. A `LIMIT 1` buries all three
 * in SQL where no arm can reach them.
 *
 * `server/facePanelSubject.test.ts` drives every tie-break and the refusal.
 */

export type SubjectCandidateRow = {
  readonly sessionPublicId: string;
  readonly sessionStatus: string;
  readonly candidatePublicId: string;
  readonly userId: number;
  /** Zero-based, as the column stores it. */
  readonly position: number;
  readonly libraryRows: number;
  /** The newest library row's timestamp, as the tie-break of last resort. */
  readonly newestRowAt: Date;
};

export type FacePanelSubject = SubjectCandidateRow & {
  /** The tile's own label, as the viewer's aria-label spells it. */
  readonly tile: string;
};

/**
 * The tile label, DERIVED from the product's own spelling rather than restated.
 *
 * `rollProjection.ts` and `castProjection.ts` both build it as
 * `String(candidate.position + 1).padStart(2, "0")`, and `CandidateTile.tsx`
 * puts it in `aria-label="View candidate <label> larger"`. A driver that wrote
 * `"01"` as a constant was addressing position 0 by luck — the subject found
 * below sits at position 1, whose label is `02`.
 */
export function tileLabelFor(position: number): string {
  return String(position + 1).padStart(2, "0");
}

/** Sessions the product will not do refine work in, so a driver must not grade them. */
const DEPRIORITISED_SESSION_STATUS = new Set(["abandoned", "expired", "closed"]);

/**
 * Pick the subject, or refuse.
 *
 * ⚠ THROWS on an empty list rather than returning null. An empty result here
 * means the dev database holds no face with an edited feature, and a driver that
 * treated that as "nothing to do" would exit 0 having proven nothing — the
 * reading that made #1151 necessary in the first place, one level up.
 */
export function chooseSubject(rows: readonly SubjectCandidateRow[]): FacePanelSubject {
  if (rows.length === 0) {
    throw new Error(
      "face-panel subject: no candidate in this database is BOTH ready and carrying reference-library rows, "
        + "so no face panel can render (FacePanel.tsx returns null for an empty panel with nothing in flight). "
        + "Refusing rather than reporting a missing panel on a healthy product.",
    );
  }
  const ranked = [...rows].sort((a, b) => {
    const liveness = Number(DEPRIORITISED_SESSION_STATUS.has(a.sessionStatus))
      - Number(DEPRIORITISED_SESSION_STATUS.has(b.sessionStatus));
    if (liveness !== 0) return liveness;
    if (a.libraryRows !== b.libraryRows) return b.libraryRows - a.libraryRows;
    if (a.newestRowAt.getTime() !== b.newestRowAt.getTime()) {
      return b.newestRowAt.getTime() - a.newestRowAt.getTime();
    }
    /* Last resort, so two identical fixtures do not make the run non-deterministic. */
    return a.candidatePublicId.localeCompare(b.candidatePublicId);
  });
  const chosen = ranked[0]!;
  return { ...chosen, tile: tileLabelFor(chosen.position) };
}

/** The line a run prints so the reading names its own subject (D-235). */
export function describeSubject(subject: FacePanelSubject): string {
  return `subject: user ${subject.userId} · session ${subject.sessionPublicId} (${subject.sessionStatus})`
    + ` · candidate ${subject.candidatePublicId} at tile ${subject.tile}`
    + ` · ${subject.libraryRows} library rows`;
}
