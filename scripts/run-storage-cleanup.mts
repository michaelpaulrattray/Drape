/**
 * Internal R7-5D cleanup runner. Read-only health is the default.
 * Mutating modes require --execute and explicit target arguments.
 *
 *   npx tsx scripts/run-storage-cleanup.mts --database-url mysql://… --app-id <id>
 *     [--execute --requeue-batch <uuid>]
 *     [--allow-production-execute] [--allow-production-read-only]
 *
 * ⚠ Since #345 the line above is the WHOLE vocabulary and anything outside it
 * is refused. This script already failed safe on a swallowed word — every
 * mutating mode needs `--execute` AND a named target, so a typo left it
 * read-only — but "the typo happened to point the safe way" is not a control,
 * and the operator was never told the word had been dropped.
 */
import "dotenv/config";
import { isProductionAppId } from "../server/casting/deletionAudit";
import { parseStrictArgsOrRefuse } from "./lib/strictArgs.mts";

const args = parseStrictArgsOrRefuse(process.argv.slice(2), {
  value: ["database-url", "app-id", "requeue-batch"],
  boolean: ["execute", "allow-production-execute", "allow-production-read-only"],
});

const databaseUrl = args.value("database-url")?.trim();
const appId = args.value("app-id")?.trim();
if (!databaseUrl || !appId) {
  throw new Error("Pass --database-url mysql://... and --app-id <app-id> explicitly");
}
const parsed = new URL(databaseUrl);
if (parsed.protocol !== "mysql:" || !parsed.hostname || parsed.pathname === "/") {
  throw new Error("--database-url must identify an explicit MySQL database");
}
const execute = args.flag("execute");
if (execute && isProductionAppId(appId) && !args.flag("allow-production-execute")) {
  throw new Error("Production mutation refused without --allow-production-execute");
}
if (!execute && isProductionAppId(appId) && !args.flag("allow-production-read-only")) {
  throw new Error("Production inspection refused without --allow-production-read-only");
}
process.env.DATABASE_URL = databaseUrl;

const db = await import("../server/db/storageCleanup");
if (!execute) {
  const [health, reconciliation] = await Promise.all([
    db.getStorageCleanupHealth(),
    db.inspectStorageCleanupReconciliation(),
  ]);
  process.stdout.write(`${JSON.stringify({ mode: "dry-run", health, reconciliation })}\n`);
} else {
  const batchId = args.value("requeue-batch");
  if (!batchId || !/^[0-9a-f-]{36}$/i.test(batchId)) {
    throw new Error("Mutating repair requires --requeue-batch <uuid>");
  }
  const requeued = await db.requeueFailedStorageCleanupBatch({ batchId });
  process.stdout.write(`${JSON.stringify({ mode: "requeue", batchId, requeued })}\n`);
}

/* A script exits when its work is done — an app service leaves the loop alive (fable-127/246). */
process.exit(0);
