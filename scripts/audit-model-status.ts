/**
 * READ-ONLY model-status consistency audit — Batch 0 deliverable (R6
 * execution plan §Batch 0.8). Informs the FR-4 backfill decision; the
 * backfill itself is a separate, founder-gated step.
 *
 * Runs SELECT statements ONLY. It never writes, and it contains no write
 * statement to mis-fire.
 *
 * Reports:
 *  - row counts by status (draft / active / locked / archived)
 *  - active or locked rows MISSING name, agencyId, or mintedAt (broken mint
 *    invariant — e.g. legacy nameless-mint rows)
 *  - draft rows CARRYING agencyId or mintedAt (unsealed-mint hazard, the
 *    B0.1 class)
 *  - minted rows still named with the "Draft Model" sentinel (legacy export
 *    mint fired before naming)
 *  - archived rows (now excluded from all reads — volume check)
 *
 * Usage (per CLAUDE.md convention, never put the prod URL in .env):
 *   npx tsx scripts/audit-model-status.ts [--database-url mysql://...]
 *   --database-url defaults to DATABASE_URL from the environment (dev DB).
 */
import "dotenv/config";
import mysql from "mysql2/promise";

const DRAFT_AUTO_NAME = "Draft Model";

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const url = argValue("--database-url") ?? process.env.DATABASE_URL;
  if (!url) {
    console.error("No database URL. Pass --database-url or set DATABASE_URL.");
    process.exit(1);
  }
  const host = new URL(url).host;
  console.log(`[audit] READ-ONLY model-status audit against ${host}\n`);

  const conn = await mysql.createConnection(url);
  try {
    const [byStatus] = await conn.query(
      "SELECT status, COUNT(*) AS n FROM models GROUP BY status ORDER BY status"
    );
    console.log("Rows by status:");
    console.table(byStatus);

    const [brokenMinted] = await conn.query(
      `SELECT id, userId, status, name, agencyId, mintedAt, createdAt
         FROM models
        WHERE status IN ('active','locked')
          AND (name IS NULL OR name = '' OR agencyId IS NULL OR agencyId = '' OR mintedAt IS NULL)
        ORDER BY id`
    );
    console.log(`\nMinted-status rows missing name/agencyId/mintedAt (${(brokenMinted as unknown[]).length}):`);
    console.table(brokenMinted);

    const [unsealedDrafts] = await conn.query(
      `SELECT id, userId, status, name, agencyId, mintedAt, createdAt
         FROM models
        WHERE status = 'draft'
          AND (agencyId IS NOT NULL AND agencyId <> '' OR mintedAt IS NOT NULL)
        ORDER BY id`
    );
    console.log(`\nDraft rows carrying agencyId/mintedAt (${(unsealedDrafts as unknown[]).length}):`);
    console.table(unsealedDrafts);

    const [sentinelMinted] = await conn.query(
      `SELECT id, userId, status, name, agencyId, mintedAt, createdAt
         FROM models
        WHERE status IN ('active','locked') AND name = ?
        ORDER BY id`,
      [DRAFT_AUTO_NAME]
    );
    console.log(`\nMinted rows still named with the draft sentinel (${(sentinelMinted as unknown[]).length}):`);
    console.table(sentinelMinted);

    const [archived] = await conn.query(
      `SELECT id, userId, name, agencyId, createdAt FROM models WHERE status = 'archived' ORDER BY id`
    );
    console.log(`\nArchived rows — now read as deleted everywhere (${(archived as unknown[]).length}):`);
    console.table(archived);

    console.log("\n[audit] done — no writes performed.");
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error("[audit] failed:", err);
  process.exit(1);
});
