/**
 * READ-ONLY R7 operation-lock audit. Expired locks are evidence, not cleanup
 * candidates: R7-1 never releases or steals them automatically.
 */
import "dotenv/config";
import mysql, { type RowDataPacket } from "mysql2/promise";

interface StaleLock extends RowDataPacket {
  lockKey: string;
  operationId: string;
  lockKind: string;
  expiresAt: Date;
  operationStatus: string | null;
  userId: number | null;
  updatedAt: Date | null;
}

function argValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const url = argValue("--database-url") ?? process.env.DATABASE_URL;
  if (!url) throw new Error("No database URL. Pass --database-url or set DATABASE_URL.");
  const parsed = new URL(url);
  console.log(`[generation-lock-audit] READ ONLY against ${parsed.host}`);
  const connection = await mysql.createConnection(url);
  try {
    const [rows] = await connection.query<StaleLock[]>(`
      SELECT
        l.lockKey,
        l.operationId,
        l.kind AS lockKind,
        l.expiresAt,
        o.status AS operationStatus,
        o.userId,
        o.updatedAt
      FROM generation_operation_locks l
      LEFT JOIN generation_operations o ON o.id = l.operationId
      WHERE l.expiresAt <= CURRENT_TIMESTAMP OR o.id IS NULL
      ORDER BY l.expiresAt, l.lockKey
    `);
    if (rows.length === 0) {
      console.log("PASS: no expired or orphaned generation-operation locks.");
      return;
    }
    console.error(`ATTENTION: found ${rows.length} expired or orphaned lock(s). No rows were changed.`);
    console.table(rows);
    console.error("R7-1 requires support review; do not delete or steal these locks automatically.");
    process.exitCode = 1;
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error("[generation-lock-audit] failed:", error);
  process.exitCode = 1;
});
