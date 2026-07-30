const EVIDENCE_CANDIDATE_PUBLIC_FAILURE =
  "The tattoo preview could not be created. Any charged credits were refunded.";

function integerOrUndefined(value: unknown): number | undefined {
  return Number.isSafeInteger(value) && Number(value) > 0
    ? Number(value)
    : undefined;
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === "string" && value.trim()
    ? value
    : undefined;
}

/**
 * Candidate generations are private evidence children. Moderator/admin
 * surfaces receive only the closed operational facts needed for support;
 * storage keys, descriptors, provider prose, and probe internals never cross
 * this projection.
 *
 * Nulling the result URL here protected evidence candidates and nothing else —
 * every other generation type still handed staff a permanent public URL to a
 * customer's image. That hole is closed at the query: the moderator history no
 * longer selects the URL for any row, and carries `hasResult` instead.
 *
 * The nulling stays anyway, as defence in depth for any future caller that
 * does select it. `resultUrl` is optional on the input so callers that never
 * fetched it need not pretend to have it.
 */
export function projectEvidenceCandidateForModerator<Row extends {
  type: string;
  status: string;
  errorMessage: string | null;
  metadata: unknown;
  resultUrl?: string | null;
}>(row: Row): Row {
  if (row.type !== "evidenceCandidate") return row;
  const source = row.metadata && typeof row.metadata === "object"
    && !Array.isArray(row.metadata)
    ? row.metadata as Record<string, unknown>
    : {};
  const metadata = {
    candidateId: stringOrUndefined(source.candidateId),
    attemptNumber: integerOrUndefined(source.attemptNumber),
    billingRole: source.billingRole === "charged_attempt"
      || source.billingRole === "included_retry"
      ? source.billingRole
      : undefined,
    engine: stringOrUndefined(source.engine),
    recipeVersion: stringOrUndefined(source.recipeVersion),
  };
  return {
    ...row,
    ...("resultUrl" in row ? { resultUrl: null } : {}),
    errorMessage: row.status === "failed"
      ? EVIDENCE_CANDIDATE_PUBLIC_FAILURE
      : null,
    metadata: Object.fromEntries(
      Object.entries(metadata).filter(([, value]) => value !== undefined),
    ),
  };
}
