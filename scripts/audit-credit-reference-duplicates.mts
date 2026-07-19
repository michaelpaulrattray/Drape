/**
 * READ-ONLY R7-1B credit-ledger reference audit.
 *
 * Reports every duplicate non-null (userId, referenceId) group before the
 * unique migration is applied. It never deletes, updates, or reconciles rows:
 * duplicate ledger rows have already changed balances and require a separately
 * reviewed accounting repair.
 *
 * Usage:
 *   pnpm exec tsx scripts/audit-credit-reference-duplicates.mts
 *   pnpm exec tsx scripts/audit-credit-reference-duplicates.mts --database-url mysql://...
 */
import "dotenv/config";
import mysql, { type RowDataPacket } from "mysql2/promise";

interface DuplicateGroup extends RowDataPacket {
  userId: number;
  referenceId: string;
  rowCount: number;
  netBalanceEffect: number;
  distinctTypes: number;
  distinctAmounts: number;
}

interface DuplicateRow extends RowDataPacket {
  id: number;
  userId: number;
  referenceId: string;
  type: string;
  amount: number;
  description: string | null;
  balanceAfter: number;
  createdAt: Date;
}

function argValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const url = argValue("--database-url") ?? process.env.DATABASE_URL;
  if (!url) {
    console.error("No database URL. Pass --database-url or set DATABASE_URL.");
    process.exitCode = 1;
    return;
  }

  const parsed = new URL(url);
  console.log(`[credit-reference-audit] READ ONLY against ${parsed.host}`);
  const connection = await mysql.createConnection(url);
  try {
    const [groups] = await connection.query<DuplicateGroup[]>(`
      SELECT
        userId,
        referenceId,
        COUNT(*) AS rowCount,
        SUM(amount) AS netBalanceEffect,
        COUNT(DISTINCT type) AS distinctTypes,
        COUNT(DISTINCT amount) AS distinctAmounts
      FROM point_transactions
      WHERE referenceId IS NOT NULL
      GROUP BY userId, referenceId
      HAVING COUNT(*) > 1
      ORDER BY userId, referenceId
    `);

    if (groups.length === 0) {
      console.log("PASS: no duplicate non-null (userId, referenceId) groups.");
      return;
    }

    console.error(`FAIL: found ${groups.length} duplicate credit-reference group(s).`);
    for (const group of groups) {
      const conflicting = group.distinctTypes > 1 || group.distinctAmounts > 1;
      console.error(
        `\nuser=${group.userId} reference=${group.referenceId} rows=${group.rowCount} ` +
        `net=${group.netBalanceEffect} semanticConflict=${conflicting ? "YES" : "no"}`,
      );
      const [rows] = await connection.query<DuplicateRow[]>(`
        SELECT id, userId, referenceId, type, amount, description, balanceAfter, createdAt
        FROM point_transactions
        WHERE userId = ? AND referenceId = ?
        ORDER BY id
      `, [group.userId, group.referenceId]);
      console.table(rows);
    }

    console.error(
      "\nNo rows were changed. Stop the migration and reconcile these immutable ledger effects separately.",
    );
    process.exitCode = 1;
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error("[credit-reference-audit] failed:", error);
  process.exitCode = 1;
});
