/**
 * READ-ONLY R7-7A4 snapshot parity audit for an explicit founder/test cohort.
 *
 * No full-database mode exists. Supply --user-id, one or more --model-id
 * values, or their intersection. Production additionally requires the
 * separately reviewed --allow-production-read-only flag.
 *
 * Usage:
 *   pnpm exec tsx scripts/audit-cast-snapshot-parity.ts \
 *     --database-url mysql://... --app-id drape-local --user-id 123
 *
 * Standalone strict typecheck (scripts/ is outside the app tsconfig include):
 *   pnpm exec tsc -p scripts/tsconfig.snapshot-audit.json
 */
import {
  parseSnapshotShadowAuditArgs,
  summarizeSnapshotShadowReports,
} from "../server/casting/snapshotShadowAudit";
import { compareSnapshotShadowCohort } from "../server/casting/snapshotShadow";

async function closeSharedDatabase(): Promise<void> {
  const db = await (await import("../server/db/connection")).getDb();
  const client = (db as { $client?: { end?: () => Promise<void> } } | null)?.$client;
  if (typeof client?.end === "function") await client.end();
}

async function main(): Promise<number> {
  const args = parseSnapshotShadowAuditArgs(process.argv.slice(2));
  const target = new URL(args.databaseUrl);
  process.env.DATABASE_URL = args.databaseUrl;
  console.log(
    `[snapshot-shadow-audit] READ ONLY app=${args.appId} host=${target.host} database=${target.pathname.slice(1)}`,
  );
  if (args.allowProductionReadOnly) {
    console.warn("[snapshot-shadow-audit] explicit production read-only authorization flag is present");
  }
  try {
    const reports = await compareSnapshotShadowCohort({
      ...(args.userId !== undefined ? { userId: args.userId } : {}),
      modelIds: args.modelIds,
    });
    const result = summarizeSnapshotShadowReports(reports);
    console.log(JSON.stringify(result, null, 2));
    return result.summary.mismatchedModels > 0 ? 2 : 0;
  } finally {
    await closeSharedDatabase();
    delete process.env.DATABASE_URL;
  }
}

main().then(
  (exitCode) => process.exit(exitCode),
  (error) => {
    console.error(
      "[snapshot-shadow-audit] failed:",
      error instanceof Error ? error.message : "unknown error",
    );
    process.exit(1);
  },
);
