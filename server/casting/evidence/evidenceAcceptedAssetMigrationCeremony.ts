import { isProductionAppId } from "../deletionAudit";

export interface EvidenceAcceptedAssetMigrationArgs {
  databaseUrl: string;
  appId: string;
  host: string;
  database: string;
  expectedVersionCount: number;
}

const VALUE_FLAGS = new Set([
  "--database-url",
  "--app-id",
  "--confirm-app-id",
  "--confirm-host",
  "--confirm-database",
  "--expected-version-count",
]);
const AUTHORITY_FLAG =
  "--allow-production-evidence-accepted-asset-migration";

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

export function parseEvidenceAcceptedAssetMigrationArgs(
  argv: readonly string[],
): EvidenceAcceptedAssetMigrationArgs {
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
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for ${flag}`);
    }
    parsed.set(flag, value);
    index += 1;
  }
  if (parsed.get(AUTHORITY_FLAG) !== true) {
    throw new Error(
      "Production accepted-asset migration refused without explicit authority",
    );
  }
  const databaseUrl = required(parsed, "--database-url");
  const appId = required(parsed, "--app-id");
  if (!isProductionAppId(appId)) {
    throw new Error("Accepted-asset migration requires a production app id");
  }
  if (required(parsed, "--confirm-app-id") !== appId) {
    throw new Error("Accepted-asset migration app-id confirmation mismatch");
  }
  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch {
    throw new Error("Accepted-asset migration requires a valid MySQL URL");
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
      "Accepted-asset migration requires an explicit mysql:// user, password, host, port, and database",
    );
  }
  if (
    required(parsed, "--confirm-host") !== url.host
    || required(parsed, "--confirm-database") !== database
  ) {
    throw new Error("Accepted-asset migration database confirmation mismatch");
  }
  const expectedVersionText = required(parsed, "--expected-version-count");
  if (!/^(?:0|[1-9]\d*)$/.test(expectedVersionText)) {
    throw new Error(
      "--expected-version-count must be a non-negative integer",
    );
  }
  const expectedVersionCount = Number(expectedVersionText);
  if (!Number.isSafeInteger(expectedVersionCount)) {
    throw new Error("--expected-version-count must be a safe integer");
  }
  return {
    databaseUrl,
    appId,
    host: url.host,
    database,
    expectedVersionCount,
  };
}

export function assertEvidencePackageScopeOff(value: string | undefined): void {
  if (value !== undefined && value !== "" && value !== "off") {
    throw new Error("R7_EVIDENCE_PACKAGE_SCOPE must remain off");
  }
}
