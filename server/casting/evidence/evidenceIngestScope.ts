/**
 * Server-owned R7-7C evidence-ingestion rollout scope.
 *
 * The client can observe only the resulting boolean capability. It never
 * supplies or influences this value.
 */
export const EVIDENCE_INGEST_SCOPE_ENV = "R7_EVIDENCE_INGEST_SCOPE";

export type EvidenceIngestScope =
  | { kind: "off" }
  | { kind: "users"; userIds: readonly number[] }
  | { kind: "all" };

export class EvidenceIngestScopeConfigurationError extends Error {
  constructor() {
    super(
      `${EVIDENCE_INGEST_SCOPE_ENV} must be "off", "all", or "users:" followed by unique positive integer user ids`,
    );
    this.name = "EvidenceIngestScopeConfigurationError";
  }
}

export class EvidenceIngestWorkerConfigurationError extends Error {
  constructor() {
    super(
      `${EVIDENCE_INGEST_SCOPE_ENV} cannot be enabled unless ENABLE_STORAGE_CLEANUP_WORKER is exactly "true"`,
    );
    this.name = "EvidenceIngestWorkerConfigurationError";
  }
}

export function parseEvidenceIngestScope(raw: string | undefined): EvidenceIngestScope {
  if (raw === undefined || raw === "" || raw === "off") return { kind: "off" };
  if (raw === "all") return { kind: "all" };
  if (!raw.startsWith("users:") || /\s/.test(raw)) {
    throw new EvidenceIngestScopeConfigurationError();
  }
  const members = raw.slice("users:".length).split(",");
  if (
    members.length === 0
    || members.some((member) => !/^[1-9]\d*$/.test(member))
  ) {
    throw new EvidenceIngestScopeConfigurationError();
  }
  const userIds = members.map(Number);
  if (
    userIds.some((userId) => !Number.isSafeInteger(userId) || userId <= 0)
    || new Set(userIds).size !== userIds.length
  ) {
    throw new EvidenceIngestScopeConfigurationError();
  }
  return { kind: "users", userIds: [...userIds].sort((a, b) => a - b) };
}

export function evidenceIngestEnabledForUser(
  scope: EvidenceIngestScope,
  userId: number,
): boolean {
  if (!Number.isSafeInteger(userId) || userId <= 0) {
    throw new TypeError("Evidence ingest scope requires a positive integer user id");
  }
  return scope.kind === "all"
    || (scope.kind === "users" && scope.userIds.includes(userId));
}

export function captureEvidenceIngestEnabled(userId: number): boolean {
  return evidenceIngestEnabledForUser(
    parseEvidenceIngestScope(process.env[EVIDENCE_INGEST_SCOPE_ENV]),
    userId,
  );
}

export function validateEvidenceIngestEnvironment(input: {
  scope: string | undefined;
  cleanupWorker: string | undefined;
}): EvidenceIngestScope {
  const parsed = parseEvidenceIngestScope(input.scope);
  if (parsed.kind !== "off" && input.cleanupWorker !== "true") {
    throw new EvidenceIngestWorkerConfigurationError();
  }
  return parsed;
}
