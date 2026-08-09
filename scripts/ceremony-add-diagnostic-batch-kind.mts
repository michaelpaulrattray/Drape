/**
 * Founder ceremony, 2026-08-08: add the `casting_diagnostic_cleanup`
 * batch kind to `storage_cleanup_batches.kind` (production).
 *
 * Run ONLY via:
 *   railway.cmd run --service MySQL -- npx tsx scripts/ceremony-add-diagnostic-batch-kind.mts
 *
 * World discipline: no dotenv import — every variable here comes from
 * the Railway service environment or the script refuses (the mixed-
 * worlds lesson, opus-039/worldGuard).
 */
import mysql from "mysql2/promise";

const url = process.env.MYSQL_PUBLIC_URL;
if (!url) {
  console.error(
    "REFUSING: MYSQL_PUBLIC_URL is not set. Run via " +
      "`railway.cmd run --service MySQL -- npx tsx scripts/ceremony-add-diagnostic-batch-kind.mts`",
  );
  process.exit(1);
}
if (!/railway|rlwy\.net|proxy/i.test(url)) {
  console.error("REFUSING: MYSQL_PUBLIC_URL does not look like the Railway database.");
  process.exit(1);
}

const WANT = "casting_diagnostic_cleanup";
const TARGET_ENUM =
  "enum('model_delete','account_delete','evidence_cleanup','candidate_cleanup','casting_candidate_cleanup','casting_diagnostic_cleanup')";

const conn = await mysql.createConnection(url);
try {
  const [rows] = await conn.query("SHOW COLUMNS FROM `storage_cleanup_batches` LIKE 'kind'");
  const col = (rows as Array<{ Type: string }>)[0];
  if (!col) throw new Error("storage_cleanup_batches.kind not found — wrong database?");
  console.log("current :", col.Type);

  if (col.Type.includes(WANT)) {
    console.log("ALREADY APPLIED — nothing to do.");
  } else {
    await conn.query(
      `ALTER TABLE \`storage_cleanup_batches\` MODIFY COLUMN \`kind\` ${TARGET_ENUM} NOT NULL`,
    );
    const [after] = await conn.query("SHOW COLUMNS FROM `storage_cleanup_batches` LIKE 'kind'");
    const now = (after as Array<{ Type: string }>)[0];
    console.log("now     :", now.Type);
    if (!now.Type.includes(WANT)) throw new Error("ALTER ran but the value is not present — investigate before proceeding.");
    console.log("APPLIED OK.");
  }
} finally {
  await conn.end();
}
