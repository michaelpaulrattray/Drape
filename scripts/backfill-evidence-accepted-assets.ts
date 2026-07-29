/**
 * Bounded R7-7E accepted-asset link repair.
 *
 * Default mode is read-only. Apply requires the full write/production
 * confirmation ceremony. This script has no package.json entry and no
 * application caller.
 */
import {
  applyEvidenceAcceptedAssetBackfill,
  parseEvidenceAcceptedAssetBackfillArgs,
  planEvidenceAcceptedAssetBackfill,
} from "../server/casting/evidence/evidenceAcceptedAssetBackfill";

async function closeSharedDatabase(): Promise<void> {
  const db = await (await import("../server/db/connection")).getDb();
  const client = (db as { $client?: { end?: () => Promise<void> } } | null)
    ?.$client;
  if (typeof client?.end === "function") await client.end();
}

async function main(): Promise<number> {
  const args = parseEvidenceAcceptedAssetBackfillArgs(process.argv.slice(2));
  const target = new URL(args.databaseUrl);
  process.env.DATABASE_URL = args.databaseUrl;
  console.log(
    `[evidence-accepted-asset-backfill] mode=${args.apply ? "APPLY" : "READ ONLY"} app=${args.appId} host=${target.host} database=${target.pathname.slice(1)} expectedModels=${args.expectedModelCount} expectedVersions=${args.expectedVersionCount} expectedRows=${args.expectedBackfillCount}`,
  );
  try {
    if (!args.apply) {
      const plan = await planEvidenceAcceptedAssetBackfill(args);
      console.log(JSON.stringify({ mode: "read_only", ...plan }, null, 2));
      return plan.ready ? 0 : 2;
    }
    const result = await applyEvidenceAcceptedAssetBackfill(args);
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
      || message.startsWith("Evidence accepted-asset backfill ")
      || message.startsWith("Evidence-link ")
    )
      ? message
      : "evidence_accepted_asset_backfill_failed";
    console.error("[evidence-accepted-asset-backfill] failed:", safeMessage);
    process.exit(1);
  },
);
