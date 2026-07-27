import { isProductionAppId } from "../deletionAudit";
import { parseEvidenceIngestScope } from "./evidenceIngestScope";

export type FounderEvidenceCeremonyMode = "stage" | "discard";

export interface FounderEvidenceCeremonyArgs {
  mode: FounderEvidenceCeremonyMode;
  databaseUrl: string;
  appId: string;
  host: string;
  database: string;
  evidenceBucket: string;
  userId: number;
  userEmail: string;
  modelId: number;
  modelName: string;
  plateId?: string;
  ingestClientRequestId?: string;
  expectedContentHash?: string;
  expectedByteSize?: number;
}

export interface FounderEvidenceCounts {
  objects: number;
  receipts: number;
  plates: number;
  crops: number;
  evidenceOperations: number;
  evidenceOperationLocks: number;
  cleanupBatches: number;
  cleanupItems: number;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const CONTENT_HASH_PATTERN = /^[0-9a-f]{64}$/;
const AUTHORITY_FLAG = "--allow-production-founder-evidence-ceremony";
const COMMON_VALUE_FLAGS = new Set([
  "--database-url",
  "--app-id",
  "--confirm-app-id",
  "--confirm-host",
  "--confirm-database",
  "--confirm-evidence-bucket",
  "--user-id",
  "--confirm-user-id",
  "--confirm-user-email",
  "--model-id",
  "--confirm-model-id",
  "--confirm-model-name",
]);
const DISCARD_VALUE_FLAG_LIST = [
  "--plate-id",
  "--ingest-client-request-id",
  "--expected-content-hash",
  "--expected-byte-size",
] as const;
const DISCARD_VALUE_FLAGS = new Set<string>(DISCARD_VALUE_FLAG_LIST);

function strictPositiveInteger(value: string, flag: string): number {
  if (!/^[1-9]\d*$/.test(value)) {
    throw new Error(`${flag} must be a strict positive decimal integer`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`${flag} exceeds the safe integer range`);
  }
  return parsed;
}

function required(
  values: ReadonlyMap<string, string | true>,
  flag: string,
): string {
  const value = values.get(flag);
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Pass ${flag} explicitly`);
  }
  return value.trim();
}

function parseFlags(
  argv: readonly string[],
): {
  mode: FounderEvidenceCeremonyMode;
  values: ReadonlyMap<string, string | true>;
} {
  const values = new Map<string, string | true>();
  let mode: FounderEvidenceCeremonyMode | null = null;
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (values.has(flag)) throw new Error(`Duplicate ceremony flag: ${flag}`);
    if (flag === "--stage" || flag === "--discard") {
      if (mode !== null) throw new Error("Choose exactly one ceremony phase");
      mode = flag === "--stage" ? "stage" : "discard";
      values.set(flag, true);
      continue;
    }
    if (flag === AUTHORITY_FLAG) {
      values.set(flag, true);
      continue;
    }
    if (!COMMON_VALUE_FLAGS.has(flag) && !DISCARD_VALUE_FLAGS.has(flag)) {
      throw new Error(`Unknown ceremony argument: ${flag}`);
    }
    const value = argv[index + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new Error(`Missing value for ${flag}`);
    }
    values.set(flag, value);
    index += 1;
  }
  if (mode === null) throw new Error("Choose --stage or --discard");
  if (values.get(AUTHORITY_FLAG) !== true) {
    throw new Error(`Production ceremony refused without ${AUTHORITY_FLAG}`);
  }
  for (const flag of DISCARD_VALUE_FLAG_LIST) {
    if (mode === "stage" && values.has(flag)) {
      throw new Error(`${flag} is valid only with --discard`);
    }
  }
  return { mode, values };
}

/**
 * Strict target ceremony for the one-account R7-7C production proof.
 * Nothing falls back to ambient database, user, model, or bucket authority.
 */
export function parseFounderEvidenceCeremonyArgs(
  argv: readonly string[],
): FounderEvidenceCeremonyArgs {
  const { mode, values } = parseFlags(argv);
  const databaseUrl = required(values, "--database-url");
  const appId = required(values, "--app-id");
  if (!isProductionAppId(appId)) {
    throw new Error("Founder evidence ceremony requires a production app id");
  }
  if (required(values, "--confirm-app-id") !== appId) {
    throw new Error("Founder evidence app-id confirmation mismatch");
  }
  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch {
    throw new Error("Founder evidence ceremony requires a valid MySQL URL");
  }
  const database = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
  if (
    url.protocol !== "mysql:"
    || !url.username
    || !url.password
    || !url.hostname
    || !url.port
    || !database
  ) {
    throw new Error(
      "Founder evidence ceremony requires an explicit mysql:// user, password, host, port, and database",
    );
  }
  if (
    required(values, "--confirm-host") !== url.host
    || required(values, "--confirm-database") !== database
  ) {
    throw new Error("Founder evidence database confirmation mismatch");
  }
  const userId = strictPositiveInteger(required(values, "--user-id"), "--user-id");
  if (
    strictPositiveInteger(
      required(values, "--confirm-user-id"),
      "--confirm-user-id",
    ) !== userId
  ) {
    throw new Error("Founder evidence user confirmation mismatch");
  }
  const modelId = strictPositiveInteger(required(values, "--model-id"), "--model-id");
  if (
    strictPositiveInteger(
      required(values, "--confirm-model-id"),
      "--confirm-model-id",
    ) !== modelId
  ) {
    throw new Error("Founder evidence model confirmation mismatch");
  }
  const result: FounderEvidenceCeremonyArgs = {
    mode,
    databaseUrl,
    appId,
    host: url.host,
    database,
    evidenceBucket: required(values, "--confirm-evidence-bucket"),
    userId,
    userEmail: required(values, "--confirm-user-email").toLowerCase(),
    modelId,
    modelName: required(values, "--confirm-model-name"),
  };
  if (mode === "discard") {
    const plateId = required(values, "--plate-id");
    const ingestClientRequestId = required(values, "--ingest-client-request-id");
    const expectedContentHash = required(values, "--expected-content-hash");
    if (!UUID_PATTERN.test(plateId) || !UUID_PATTERN.test(ingestClientRequestId)) {
      throw new Error("Founder evidence discard requires canonical UUIDs");
    }
    if (!CONTENT_HASH_PATTERN.test(expectedContentHash)) {
      throw new Error("Founder evidence discard requires a SHA-256 content hash");
    }
    result.plateId = plateId;
    result.ingestClientRequestId = ingestClientRequestId;
    result.expectedContentHash = expectedContentHash;
    result.expectedByteSize = strictPositiveInteger(
      required(values, "--expected-byte-size"),
      "--expected-byte-size",
    );
  }
  return result;
}

export function assertFounderEvidenceScope(
  raw: string | undefined,
  userId: number,
): void {
  const scope = parseEvidenceIngestScope(raw);
  if (
    scope.kind !== "users"
    || scope.userIds.length !== 1
    || scope.userIds[0] !== userId
  ) {
    throw new Error("Founder evidence ceremony requires an exact one-user scope");
  }
}

function assertCounts(
  actual: FounderEvidenceCounts,
  expected: FounderEvidenceCounts,
  phase: string,
): void {
  for (const key of Object.keys(expected) as Array<keyof FounderEvidenceCounts>) {
    if (actual[key] !== expected[key]) {
      const token = key.replace(
        /[A-Z]/g,
        (letter) => `_${letter.toLowerCase()}`,
      );
      throw new Error(`${phase}_${token}_count_mismatch`);
    }
  }
}

export function assertFounderEvidenceStageBaseline(
  counts: FounderEvidenceCounts,
): void {
  assertCounts(counts, {
    objects: 0,
    receipts: 0,
    plates: 0,
    crops: 0,
    evidenceOperations: 0,
    evidenceOperationLocks: 0,
    cleanupBatches: 0,
    cleanupItems: 0,
  }, "founder_evidence_stage_baseline");
}

export function assertFounderEvidenceStagedState(
  counts: FounderEvidenceCounts,
): void {
  assertCounts(counts, {
    objects: 1,
    receipts: 1,
    plates: 1,
    crops: 0,
    evidenceOperations: 1,
    evidenceOperationLocks: 0,
    cleanupBatches: 0,
    cleanupItems: 0,
  }, "founder_evidence_staged");
}

export function assertFounderEvidenceSettledState(
  counts: FounderEvidenceCounts,
): void {
  assertCounts(counts, {
    objects: 0,
    receipts: 1,
    plates: 0,
    crops: 0,
    evidenceOperations: 2,
    evidenceOperationLocks: 0,
    cleanupBatches: 1,
    cleanupItems: 0,
  }, "founder_evidence_settled");
}

/** Only closed ceremony tokens may cross the failure-output boundary. */
export function founderEvidenceSafeError(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  return /^founder_evidence_[a-z_]+$/.test(message)
    ? message
    : "founder_evidence_ceremony_failed";
}
