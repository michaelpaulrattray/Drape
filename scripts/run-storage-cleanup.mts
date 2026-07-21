/**
 * Internal R7-5D cleanup runner. Read-only health is the default.
 * Mutating modes require --execute and explicit target arguments.
 */
import "dotenv/config";
import { isProductionAppId } from "../server/casting/deletionAudit";

function value(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const databaseUrl = value("--database-url")?.trim();
const appId = value("--app-id")?.trim();
if (!databaseUrl || !appId) {
  throw new Error("Pass --database-url mysql://... and --app-id <app-id> explicitly");
}
const parsed = new URL(databaseUrl);
if (parsed.protocol !== "mysql:" || !parsed.hostname || parsed.pathname === "/") {
  throw new Error("--database-url must identify an explicit MySQL database");
}
const execute = process.argv.includes("--execute");
if (execute && isProductionAppId(appId) && !process.argv.includes("--allow-production-execute")) {
  throw new Error("Production mutation refused without --allow-production-execute");
}
if (!execute && isProductionAppId(appId) && !process.argv.includes("--allow-production-read-only")) {
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
  const batchId = value("--requeue-batch");
  if (!batchId || !/^[0-9a-f-]{36}$/i.test(batchId)) {
    throw new Error("Mutating repair requires --requeue-batch <uuid>");
  }
  const requeued = await db.requeueFailedStorageCleanupBatch({ batchId });
  process.stdout.write(`${JSON.stringify({ mode: "requeue", batchId, requeued })}\n`);
}
