import { isProductionAppId } from "../deletionAudit";

export interface EvidenceComposerMigrationArgs {
  databaseUrl: string;
  appId: string;
  host: string;
  database: string;
}

const VALUE_FLAGS = new Set([
  "--database-url",
  "--app-id",
  "--confirm-app-id",
  "--confirm-host",
  "--confirm-database",
]);
const AUTHORITY_FLAG = "--allow-production-evidence-composer-migration";

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

export function parseEvidenceComposerMigrationArgs(
  argv: readonly string[],
): EvidenceComposerMigrationArgs {
  const parsed = new Map<string, string | true>();
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (parsed.has(flag)) throw new Error(`Duplicate ceremony flag: ${flag}`);
    if (flag === AUTHORITY_FLAG) {
      parsed.set(flag, true);
      continue;
    }
    if (!VALUE_FLAGS.has(flag)) {
      throw new Error(`Unknown ceremony argument: ${flag}`);
    }
    const value = argv[index + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new Error(`Missing value for ${flag}`);
    }
    parsed.set(flag, value);
    index += 1;
  }
  if (parsed.get(AUTHORITY_FLAG) !== true) {
    throw new Error(
      "Production evidence-composer migration refused without explicit authority",
    );
  }

  const databaseUrl = required(parsed, "--database-url");
  const appId = required(parsed, "--app-id");
  if (!isProductionAppId(appId)) {
    throw new Error(
      "Evidence-composer migration requires a production app id",
    );
  }
  if (required(parsed, "--confirm-app-id") !== appId) {
    throw new Error("Evidence-composer app-id confirmation mismatch");
  }

  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch {
    throw new Error("Evidence-composer migration requires a valid MySQL URL");
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
      "Evidence-composer migration requires an explicit mysql:// user, password, host, port, and database",
    );
  }
  if (
    required(parsed, "--confirm-host") !== url.host
    || required(parsed, "--confirm-database") !== database
  ) {
    throw new Error("Evidence-composer database confirmation mismatch");
  }
  return {
    databaseUrl,
    appId,
    host: url.host,
    database,
  };
}

function assertOff(
  value: string | undefined,
  variable: string,
  acceptedAbsentValue: string,
): void {
  if (
    value !== undefined
    && value !== ""
    && value !== acceptedAbsentValue
  ) {
    throw new Error(`${variable} must remain ${acceptedAbsentValue}`);
  }
}

/** The disabled deployment gate may never infer an enabled local authority. */
export function assertEvidenceComposerMigrationScopesOff(input: {
  composerScope: string | undefined;
  composerRecipe: string | undefined;
  candidateWorker: string | undefined;
  ingestScope: string | undefined;
}): void {
  assertOff(input.composerScope, "R7_EVIDENCE_COMPOSER_SCOPE", "off");
  assertOff(input.composerRecipe, "R7_EVIDENCE_COMPOSER_RECIPE", "off");
  assertOff(
    input.candidateWorker,
    "ENABLE_EVIDENCE_CANDIDATE_WORKER",
    "false",
  );
  assertOff(input.ingestScope, "R7_EVIDENCE_INGEST_SCOPE", "off");
}
