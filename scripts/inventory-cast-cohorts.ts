/**
 * READ-ONLY R7-7B7 inventory of live Cast cohorts, bounded by a required
 * maximum user count. Output contains numeric identifiers and counts only.
 *
 * Usage:
 *   pnpm exec tsx scripts/inventory-cast-cohorts.ts \
 *     --database-url mysql://... --app-id drape-local --max-users 25
 *
 * Standalone strict typecheck:
 *   pnpm exec tsc -p scripts/tsconfig.snapshot-inventory.json
 */
import {
  inventorySnapshotCohorts,
  parseSnapshotCohortInventoryArgs,
  publicSnapshotCohortInventory,
} from "../server/casting/snapshotCohortInventory";

async function closeSharedDatabase(): Promise<void> {
  const db = await (await import("../server/db/connection")).getDb();
  const client = (db as { $client?: { end?: () => Promise<void> } } | null)?.$client;
  if (typeof client?.end === "function") await client.end();
}

async function main(): Promise<number> {
  const args = parseSnapshotCohortInventoryArgs(process.argv.slice(2));
  const target = new URL(args.databaseUrl);
  process.env.DATABASE_URL = args.databaseUrl;
  console.log(
    `[snapshot-cohort-inventory] READ ONLY app=${args.appId} host=${target.host} database=${target.pathname.slice(1)}`,
  );
  if (args.allowProductionReadOnly) {
    console.warn(
      "[snapshot-cohort-inventory] explicit production read-only authorization flag is present",
    );
  }
  try {
    const result = await inventorySnapshotCohorts({ maxUsers: args.maxUsers });
    console.log(JSON.stringify(publicSnapshotCohortInventory(result), null, 2));
    return result.capped ? 3 : 0;
  } finally {
    delete process.env.DATABASE_URL;
    await closeSharedDatabase();
  }
}

main().then(
  (exitCode) => process.exit(exitCode),
  () => {
    console.error("[snapshot-cohort-inventory] failed: cohort_inventory_failed");
    process.exit(1);
  },
);
