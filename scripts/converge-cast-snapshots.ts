/**
 * Bounded R7-7A snapshot convergence tool.
 *
 * Default mode is a read-only preflight. `--apply` is an explicit write
 * ceremony and additionally requires a generic write authorization plus exact
 * app-id/host/database confirmations. Production requires a separately
 * reviewed convergence authorization flag.
 * No full-database mode exists.
 *
 * Example (read-only):
 *   pnpm exec tsx scripts/converge-cast-snapshots.ts \
 *     --database-url mysql://... --app-id drape-local \
 *     --user-id 123 --expected-model-count 4
 *
 * Standalone strict typecheck:
 *   pnpm exec tsc -p scripts/tsconfig.snapshot-convergence.json
 */
import {
  convergeSnapshotCohort,
  parseSnapshotConvergenceArgs,
  planSnapshotConvergence,
} from "../server/casting/snapshotConvergence";

async function closeSharedDatabase(): Promise<void> {
  const db = await (await import("../server/db/connection")).getDb();
  const client = (db as { $client?: { end?: () => Promise<void> } } | null)?.$client;
  if (typeof client?.end === "function") await client.end();
}

async function main(): Promise<number> {
  const args = parseSnapshotConvergenceArgs(process.argv.slice(2));
  const target = new URL(args.databaseUrl);
  process.env.DATABASE_URL = args.databaseUrl;
  console.log(
    `[snapshot-convergence] mode=${args.apply ? "APPLY" : "READ ONLY"} app=${args.appId} host=${target.host} database=${target.pathname.slice(1)} expected=${args.expectedModelCount}`,
  );
  try {
    if (!args.apply) {
      const plan = await planSnapshotConvergence(args);
      console.log(JSON.stringify({
        mode: "read_only",
        expectedModelCount: args.expectedModelCount,
        subjects: plan.subjects.map((subject) => subject.modelId),
        summary: plan.summary,
      }, null, 2));
      return plan.summary.mismatchedModels > 0 ? 2 : 0;
    }
    const result = await convergeSnapshotCohort(args);
    console.log(JSON.stringify({ mode: "apply", ...result }, null, 2));
    return result.success ? 0 : 2;
  } finally {
    await closeSharedDatabase();
    delete process.env.DATABASE_URL;
  }
}

main().then(
  (exitCode) => process.exit(exitCode),
  (error) => {
    console.error(
      "[snapshot-convergence] failed:",
      error instanceof Error ? error.message : "unknown error",
    );
    process.exit(1);
  },
);
