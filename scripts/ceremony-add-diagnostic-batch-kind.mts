/**
 * Founder ceremony: bring `storage_cleanup_batches.kind` in production up to
 * whatever the ORM enum declares (2026-08-08, for `casting_diagnostic_cleanup`;
 * generic since fable-486 §g, so the next kind needs no new script).
 *
 * Run ONLY via:
 *   railway.cmd run --service MySQL -- npx tsx scripts/ceremony-add-diagnostic-batch-kind.mts
 *
 * World discipline: no dotenv import — every variable here comes from
 * the Railway service environment or the script refuses (the mixed-
 * worlds lesson, opus-039/worldGuard).
 */
import { STORAGE_CLEANUP_BATCH_KINDS } from "../drizzle/schema";
import { openDatabase } from "./lib/dbConnection.mts";

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

/*
  THE ENUM IS DERIVED, NEVER SPELLED HERE (fable-486 §g).

  `storage_cleanup_batches.kind` was pinned in four places besides its own
  definition, and this script was the one OUTSIDE the coupled-contract registry
  that names the other three — a copy nobody would find when adding a value.
  Deriving it from the ORM enum makes this ceremony generic: it applies whatever
  the code declares and the database lacks, so the NEXT kind needs no new script
  and no edit here.

  The list is the code's, and the database's own answer decides whether there is
  anything to do — which is also what makes running it twice a no-op.
*/
const TARGET_ENUM = `enum(${STORAGE_CLEANUP_BATCH_KINDS.map((kind) => `'${kind}'`).join(",")})`;

const conn = await openDatabase(url);
try {
  const [rows] = await conn.query("SHOW COLUMNS FROM `storage_cleanup_batches` LIKE 'kind'");
  const col = (rows as Array<{ Type: string }>)[0];
  if (!col) throw new Error("storage_cleanup_batches.kind not found — wrong database?");
  console.log("current :", col.Type);

  /* What the code declares and this database does not have. */
  const missing = STORAGE_CLEANUP_BATCH_KINDS.filter((kind) => !col.Type.includes(`'${kind}'`));
  console.log("declared:", STORAGE_CLEANUP_BATCH_KINDS.join(", "));
  console.log("missing :", missing.length === 0 ? "(none)" : missing.join(", "));

  if (missing.length === 0) {
    console.log("ALREADY APPLIED — nothing to do.");
  } else {
    await conn.query(
      `ALTER TABLE \`storage_cleanup_batches\` MODIFY COLUMN \`kind\` ${TARGET_ENUM} NOT NULL`,
    );
    const [after] = await conn.query("SHOW COLUMNS FROM `storage_cleanup_batches` LIKE 'kind'");
    const now = (after as Array<{ Type: string }>)[0]!;
    console.log("now     :", now.Type);
    /* The READBACK decides, not the ALTER's silence — and it is checked for
       every value, not just the one this script was written for. */
    const still = STORAGE_CLEANUP_BATCH_KINDS.filter((kind) => !now.Type.includes(`'${kind}'`));
    if (still.length > 0) {
      throw new Error(`ALTER ran but ${still.join(", ")} is still absent — investigate before proceeding.`);
    }
    console.log("APPLIED OK.");
  }
} finally {
  await conn.end();
}

/* A script exits when its work is done — an app service leaves the loop alive (fable-127/246). */
process.exit(0);
