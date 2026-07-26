import { isProductionAppId } from "../deletionAudit";

export type PrivateEvidenceCeremonyMode = "migration" | "probe" | "audit";

export interface PrivateEvidenceCeremonyArgs {
  databaseUrl: string;
  appId: string;
  host: string;
  database: string;
  evidenceBucket?: string;
  expectedObjectCount?: number;
  expectedReceiptCount?: number;
  expectedPlateCount?: number;
  expectedCropCount?: number;
}

const AUTHORITY_FLAGS: Record<PrivateEvidenceCeremonyMode, string> = {
  migration: "--allow-production-private-evidence-migration",
  probe: "--allow-production-private-evidence-probe",
  audit: "--allow-production-private-evidence-audit",
};

const COMMON_VALUE_FLAGS = [
  "--database-url",
  "--app-id",
  "--confirm-app-id",
  "--confirm-host",
  "--confirm-database",
] as const;

const MODE_VALUE_FLAGS: Record<
  PrivateEvidenceCeremonyMode,
  readonly string[]
> = {
  migration: [],
  probe: ["--confirm-evidence-bucket", "--expected-object-count"],
  audit: [
    "--confirm-evidence-bucket",
    "--expected-object-count",
    "--expected-receipt-count",
    "--expected-plate-count",
    "--expected-crop-count",
  ],
};

function strictCount(value: string | undefined, flag: string): number {
  if (!value || !/^(0|[1-9]\d*)$/.test(value)) {
    throw new Error(`${flag} must be a strict non-negative decimal integer`);
  }
  const count = Number(value);
  if (!Number.isSafeInteger(count) || count > 99_999) {
    throw new Error(`${flag} exceeds the bounded ceremony limit`);
  }
  return count;
}

function parseFlags(
  argv: readonly string[],
  mode: PrivateEvidenceCeremonyMode,
): Map<string, string | true> {
  const authority = AUTHORITY_FLAGS[mode];
  const valueFlags = new Set([
    ...COMMON_VALUE_FLAGS,
    ...MODE_VALUE_FLAGS[mode],
  ]);
  const booleanFlags = new Set([authority]);
  const parsed = new Map<string, string | true>();
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (parsed.has(flag)) throw new Error(`Duplicate ceremony flag: ${flag}`);
    if (booleanFlags.has(flag)) {
      parsed.set(flag, true);
      continue;
    }
    if (!valueFlags.has(flag)) {
      throw new Error(`Unknown ceremony argument: ${flag}`);
    }
    const value = argv[index + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new Error(`Missing value for ${flag}`);
    }
    parsed.set(flag, value);
    index += 1;
  }
  if (parsed.get(authority) !== true) {
    throw new Error(`Production ceremony refused without ${authority}`);
  }
  return parsed;
}

function required(
  parsed: ReadonlyMap<string, string | true>,
  flag: string,
): string {
  const value = parsed.get(flag);
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Pass ${flag} explicitly`);
  }
  return value.trim();
}

/**
 * Strict shared target ceremony for migration, probe, and audit. Nothing
 * falls back to an ambient DATABASE_URL, and every authority-bearing value is
 * confirmed against the URL that will actually be contacted.
 */
export function parsePrivateEvidenceCeremonyArgs(
  argv: readonly string[],
  mode: PrivateEvidenceCeremonyMode,
): PrivateEvidenceCeremonyArgs {
  const parsed = parseFlags(argv, mode);
  const databaseUrl = required(parsed, "--database-url");
  const appId = required(parsed, "--app-id");
  const confirmAppId = required(parsed, "--confirm-app-id");
  const confirmHost = required(parsed, "--confirm-host");
  const confirmDatabase = required(parsed, "--confirm-database");
  if (!isProductionAppId(appId)) {
    throw new Error("Private-evidence production ceremony requires a production app id");
  }
  if (confirmAppId !== appId) {
    throw new Error("Private-evidence app-id confirmation mismatch");
  }

  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch {
    throw new Error("Private-evidence ceremony requires a valid MySQL URL");
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
      "Private-evidence ceremony requires an explicit mysql:// user, password, host, port, and database",
    );
  }
  if (confirmHost !== url.host || confirmDatabase !== database) {
    throw new Error("Private-evidence database confirmation mismatch");
  }

  const result: PrivateEvidenceCeremonyArgs = {
    databaseUrl,
    appId,
    host: url.host,
    database,
  };
  if (mode === "probe" || mode === "audit") {
    result.evidenceBucket = required(parsed, "--confirm-evidence-bucket");
    result.expectedObjectCount = strictCount(
      required(parsed, "--expected-object-count"),
      "--expected-object-count",
    );
  }
  if (mode === "audit") {
    result.expectedReceiptCount = strictCount(
      required(parsed, "--expected-receipt-count"),
      "--expected-receipt-count",
    );
    result.expectedPlateCount = strictCount(
      required(parsed, "--expected-plate-count"),
      "--expected-plate-count",
    );
    result.expectedCropCount = strictCount(
      required(parsed, "--expected-crop-count"),
      "--expected-crop-count",
    );
  }
  return result;
}

/** The C5D ceremony may never infer that an absent scope is enabled. */
export function assertPrivateEvidenceScopeOff(raw: string | undefined): void {
  if (raw !== undefined && raw !== "" && raw !== "off") {
    throw new Error("Private-evidence ceremony requires R7_EVIDENCE_INGEST_SCOPE=off");
  }
}

export interface PrivateEvidenceBucketAudit {
  objects: number;
  referencedObjects: number;
  queuedObjects: number;
  orphanCandidates: number;
  missingReferencedObjects: number;
}

/** Counts only: no storage key can cross this reporting boundary. */
export function summarizePrivateEvidenceBucket(input: {
  objects: readonly string[];
  referenced: readonly string[];
  queued: readonly string[];
}): PrivateEvidenceBucketAudit {
  const objects = new Set(input.objects);
  const referenced = new Set(input.referenced);
  const queued = new Set(input.queued);
  const objectKeys = Array.from(objects);
  const referencedKeys = Array.from(referenced);
  return {
    objects: objects.size,
    referencedObjects: objectKeys.filter((key) => referenced.has(key)).length,
    queuedObjects: objectKeys.filter((key) => queued.has(key)).length,
    orphanCandidates: objectKeys.filter(
      (key) => !referenced.has(key) && !queued.has(key),
    ).length,
    missingReferencedObjects: referencedKeys.filter(
      (key) => !objects.has(key) && !queued.has(key),
    ).length,
  };
}
