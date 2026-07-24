/**
 * Bounded R7-7B6 Cast-slot pin convergence tool.
 *
 * Default mode is read-only. Applying requires an explicit write flag, exact
 * app/host/database confirmations, and a separate production authorization.
 * There is no full-database mode and no application route or worker caller.
 *
 * Standalone strict typecheck:
 *   pnpm exec tsc -p scripts/tsconfig.pin-convergence.json
 */
import {
  convergeSnapshotPins,
  parseSnapshotPinConvergenceArgs,
  planSnapshotPinConvergence,
} from "../server/casting/snapshotPinConvergence";

async function closeSharedDatabase(): Promise<void> {
  const db = await (await import("../server/db/connection")).getDb();
  const client = (db as { $client?: { end?: () => Promise<void> } } | null)?.$client;
  if (typeof client?.end === "function") await client.end();
}

async function main(): Promise<number> {
  const args = parseSnapshotPinConvergenceArgs(process.argv.slice(2));
  const target = new URL(args.databaseUrl);
  process.env.DATABASE_URL = args.databaseUrl;
  console.log(
    `[snapshot-pin-convergence] mode=${args.apply ? "APPLY" : "READ ONLY"} app=${args.appId} host=${target.host} database=${target.pathname.slice(1)} expectedModels=${args.expectedModelCount} expectedPinnedRows=${args.expectedPinnedRowCount}`,
  );
  try {
    if (!args.apply) {
      const plan = await planSnapshotPinConvergence(args);
      console.log(JSON.stringify({
        mode: "read_only",
        ready: plan.ready,
        expectedModelCount: plan.expectedModelCount,
        expectedPinnedRowCount: plan.expectedPinnedRowCount,
        models: plan.models,
      }, null, 2));
      return plan.ready ? 0 : 2;
    }
    const result = await convergeSnapshotPins(args);
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
    const message = error instanceof Error ? error.message : "";
    const safeMessage = (
      message.startsWith("--")
      || message.startsWith("Provide ")
      || message.startsWith("Production ")
      || message.startsWith("Applying ")
      || message.startsWith("Pin-convergence ")
      || message.startsWith("Snapshot pin convergence ")
    )
      ? message
      : "pin_convergence_failed";
    console.error(
      "[snapshot-pin-convergence] failed:",
      safeMessage,
    );
    process.exit(1);
  },
);
