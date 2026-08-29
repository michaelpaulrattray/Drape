/**
 * DISPOSABLE (foreman-112) — is there an in-app bug report nobody has read?
 *
 * MAINTENANCE MODE admits "bugs filed by ... in-app reports" (PROGRAM.md), and
 * no shift record names a reader for `bug_reports`. READ ONLY: three SELECTs,
 * no writes, no network beyond the database.
 *
 *   railway.cmd run --service MySQL -- npx tsx scripts/_shift112-inapp-reports-disposable.mts
 */
import "dotenv/config";
import { openDatabase, resolveDatabaseUrl, worldOf } from "./lib/dbConnection.mts";

async function main() {
  const url = resolveDatabaseUrl();
  const db = await openDatabase(url);
  console.log(`world: ${worldOf(url)}`);

  const [total] = (await db.query("SELECT COUNT(*) AS n FROM bug_reports")) as any;
  console.log(`bug_reports total: ${total[0].n}`);

  const [byStatus] = (await db.query(
    "SELECT status, COUNT(*) AS n FROM bug_reports GROUP BY status ORDER BY n DESC",
  )) as any;
  for (const r of byStatus) console.log(`  ${r.status.padEnd(10)} ${r.n}`);

  const [rows] = (await db.query(
    `SELECT id, userId, category, status, page, viewport, createdAt, description
       FROM bug_reports ORDER BY id DESC LIMIT 25`,
  )) as any;
  console.log(`\n--- newest ${rows.length} ---`);
  for (const r of rows) {
    console.log(
      `#${r.id} u${r.userId} [${r.status}] ${r.category} ${new Date(r.createdAt).toISOString()} page=${r.page ?? "-"}`,
    );
    console.log(`    ${String(r.description).replace(/\s+/g, " ").slice(0, 400)}`);
  }
  await db.end();
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
