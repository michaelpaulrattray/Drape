/**
 * Bounded repair for the R7-7E feature-only identity-revision defect.
 *
 * Default mode is read-only. Apply requires the full write/production
 * confirmation ceremony. This script has no package.json entry and no
 * application caller.
 */
import {
  applyEvidenceIdentityRevisionRepair,
  parseEvidenceIdentityRevisionRepairArgs,
  planEvidenceIdentityRevisionRepair,
} from "../server/casting/evidence/evidenceIdentityRevisionRepair";
import { assertOneWorld } from "./lib/worldGuard.mts";

/*
  One world per process (scripts/lib/worldGuard.mts). Inert outside a Railway
  run; inside one it refuses when dotenv has filled a gap the service does not
  define, which is how a "production" read gets taken from dev.
*/
assertOneWorld(["DATABASE_URL"]);

async function closeSharedDatabase(): Promise<void> {
  const db = await (await import("../server/db/connection")).getDb();
  const client = (db as { $client?: { end?: () => Promise<void> } } | null)
    ?.$client;
  if (typeof client?.end === "function") await client.end();
}

async function main(): Promise<number> {
  const args = parseEvidenceIdentityRevisionRepairArgs(process.argv.slice(2));
  const target = new URL(args.databaseUrl);
  process.env.DATABASE_URL = args.databaseUrl;
  console.log(
    `[evidence-identity-revision-repair] mode=${args.apply ? "APPLY" : "READ ONLY"} app=${args.appId} host=${target.host} database=${target.pathname.slice(1)} expectedModels=${args.expectedModelCount} expectedRows=${args.expectedRepairCount} expectedRestoredViews=${args.expectedRestoredViewCount}`,
  );
  try {
    if (!args.apply) {
      const plan = await planEvidenceIdentityRevisionRepair(args);
      console.log(JSON.stringify({ mode: "read_only", ...plan }, null, 2));
      return plan.ready ? 0 : 2;
    }
    const result = await applyEvidenceIdentityRevisionRepair(args);
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
      || message.startsWith("Evidence identity-revision repair ")
    )
      ? message
      : "evidence_identity_revision_repair_failed";
    console.error("[evidence-identity-revision-repair] failed:", safeMessage);
    process.exit(1);
  },
);
