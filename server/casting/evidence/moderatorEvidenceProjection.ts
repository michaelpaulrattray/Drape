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
 * URLs, storage keys, descriptors, provider prose, and probe internals never
 * cross this projection.
 */
export function projectEvidenceCandidateForModerator<Row extends {
  type: string;
  status: string;
  resultUrl: string | null;
  errorMessage: string | null;
  metadata: unknown;
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
    resultUrl: null,
    errorMessage: row.status === "failed"
      ? EVIDENCE_CANDIDATE_PUBLIC_FAILURE
      : null,
    metadata: Object.fromEntries(
      Object.entries(metadata).filter(([, value]) => value !== undefined),
    ),
  };
}
