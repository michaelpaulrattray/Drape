/**
 * Backfill `kind` + metadata.provenance on legacy board_items rows.
 *
 * CANVAS_FOUNDATIONS.md §6 mapping table (D-26: provenance-aware — legacy rows
 * get both the new kind column AND a stamped provenance so they are visible to
 * the snapshot/agent layer, not just re-rendered).
 *
 * Idempotent: only touches rows where kind IS NULL. Run against dev anytime;
 * against production at pass-1 cutover with DATABASE_URL temporarily set to
 * MYSQL_PUBLIC_URL (never put the prod URL in .env — see CLAUDE.md).
 *
 *   npx tsx scripts/backfill-board-kinds.ts          # dry run (default)
 *   npx tsx scripts/backfill-board-kinds.ts --apply  # write
 */
import "dotenv/config";
import mysql from "mysql2/promise";
import { mapLegacyRow, type LegacyBoardItemRow } from "../server/lib/boardBackfill";

const APPLY = process.argv.includes("--apply");

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");
  const conn = await mysql.createConnection(url);

  const [rows] = await conn.execute(
    `SELECT id, type, metadata, parentItemId, sourceModelId, sourceGarmentId, sourceSessionId
     FROM board_items WHERE kind IS NULL`,
  );
  const items = rows as LegacyBoardItemRow[];
  console.log(`${items.length} rows need backfill (${APPLY ? "APPLY" : "dry run"})`);

  let edges = 0;
  for (const row of items) {
    const mapped = mapLegacyRow(row);
    if (!APPLY) {
      console.log(
        `#${row.id} ${row.type} -> kind=${mapped.kind}` +
          (mapped.provenance ? ` provenance=${mapped.provenance.type}` : "") +
          (mapped.iteratedFromEdge ? ` +edge(iterated_from ${row.parentItemId})` : ""),
      );
      continue;
    }

    const metadata = { ...(parseMeta(row.metadata) ?? {}), ...(mapped.provenance ? { provenance: mapped.provenance } : {}) };
    await conn.execute(`UPDATE board_items SET kind = ?, metadata = ? WHERE id = ?`, [
      mapped.kind,
      JSON.stringify(metadata),
      row.id,
    ]);

    if (mapped.iteratedFromEdge && row.parentItemId) {
      // boardId of the child row scopes the edge
      const [boardRows] = await conn.execute(`SELECT boardId FROM board_items WHERE id = ?`, [row.id]);
      const boardId = (boardRows as Array<{ boardId: number }>)[0]?.boardId;
      if (boardId) {
        await conn.execute(
          `INSERT INTO board_edges (boardId, sourceItemId, targetItemId, relation) VALUES (?, ?, ?, 'iterated_from')`,
          [boardId, row.parentItemId, row.id],
        );
        edges++;
      }
    }
  }

  if (APPLY) console.log(`Backfilled ${items.length} rows, created ${edges} iterated_from edges`);
  await conn.end();
}

function parseMeta(m: unknown): Record<string, unknown> | null {
  if (m == null) return null;
  if (typeof m === "object") return m as Record<string, unknown>;
  try {
    return JSON.parse(String(m));
  } catch {
    return null;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
