/**
 * Ceremony — the promoted segment set (`casting_cast_segments`, migration 0027).
 *
 * ONE migration, and it is a new table nothing reads yet. It lands AHEAD of the
 * Sign promotion that writes it, which is the ordering this program now runs
 * under: **the migration lands before the code that names it.** A new table is
 * inert on its own; the code that INSERTs into an absent table is not, and Sign
 * is a paid path.
 *
 * Run ONLY via:
 *   railway.cmd run --service MySQL -- npx tsx scripts/ceremony-cast-segments.mts
 *
 * World discipline: no dotenv import — every variable comes from the Railway
 * service environment or the script refuses. A production ceremony that picked
 * up a dev URL from a file would migrate the wrong database and report success.
 *
 * Idempotent: it checks first and says ALREADY APPLIED rather than failing, so a
 * re-run after a partial ceremony is safe and the re-run is the independent
 * confirmation.
 */
import { readFile } from "node:fs/promises";
import mysql from "mysql2/promise";
import { openDatabase } from "./lib/dbConnection.mts";

const url = process.env.MYSQL_PUBLIC_URL;
if (!url) {
  console.error(
    "REFUSING: MYSQL_PUBLIC_URL is not set. Run via "
    + "`railway.cmd run --service MySQL -- npx tsx scripts/ceremony-cast-segments.mts`",
  );
  process.exit(1);
}
if (!/railway|rlwy\.net|proxy/i.test(url)) {
  console.error("REFUSING: MYSQL_PUBLIC_URL does not look like the Railway database.");
  process.exit(1);
}

const conn = await openDatabase(url);
let failed = false;
try {
  /* ------------------------------------------ 1. the promoted segment set */

  const [tables] = await conn.query<any[]>("SHOW TABLES LIKE 'casting_cast_segments'");
  if (tables.length > 0) {
    const [count] = await conn.query<any[]>("SELECT COUNT(*) AS n FROM `casting_cast_segments`");
    console.log(`1. casting_cast_segments  ALREADY APPLIED — ${count[0].n} row(s)`);
  } else {
    /*
      The migration file itself, replayed rather than retyped — a ceremony that
      re-types its own DDL is a second copy of the schema, and it drifts from
      the one every test ran against.
    */
    const sql = await readFile("drizzle/0027_casting_v2_cast_segments.sql", "utf8");
    for (const statement of sql.split("--> statement-breakpoint")) {
      const trimmed = statement.trim();
      if (trimmed) await conn.query(trimmed);
    }
    const [after] = await conn.query<any[]>("SHOW TABLES LIKE 'casting_cast_segments'");
    if (after.length !== 1) throw new Error("the migration ran and the table is not there — stop and investigate");
    console.log("1. casting_cast_segments  APPLIED");
  }

  /* --------------------------------------------------- 2. read it back */

  const [columns] = await conn.query<any[]>("SHOW COLUMNS FROM `casting_cast_segments`");
  const names = columns.map((column) => column.Field);
  for (const required of [
    "userId", "castId", "sourceSegmentId", "provenance", "facet", "region", "version",
    "maskKey", "contentKey", "frameWidth", "frameHeight", "verifiedAt", "verdict", "detector",
  ]) {
    if (!names.includes(required)) throw new Error(`casting_cast_segments is missing ${required} — stop and investigate`);
  }
  /*
    THE KEY IS THE POINT OF THIS TABLE, so the read-back proves the key rather
    than counting columns. Promotion's idempotency is this index and nothing
    else: without it, a Sign adjudicator re-running a lapsed promotion writes a
    second copy of her face.
  */
  const [identity] = await conn.query<any[]>(
    "SHOW INDEX FROM `casting_cast_segments` WHERE Key_name = 'uq_casting_cast_segments_identity'",
  );
  const identityColumns = identity
    .sort((a: any, b: any) => a.Seq_in_index - b.Seq_in_index)
    .map((row: any) => row.Column_name);
  const expected = ["castId", "facet", "region", "version"];
  if (identityColumns.join(",") !== expected.join(",")) {
    throw new Error(
      `the identity key is ${identityColumns.join(",") || "ABSENT"}, expected ${expected.join(",")} — stop and investigate`,
    );
  }
  if (identity.some((row: any) => row.Non_unique !== 0)) {
    throw new Error("the identity key is not unique — stop and investigate");
  }
  console.log(
    `2. read back              ${names.length} columns; identity key UNIQUE on (${identityColumns.join(", ")})`,
  );

  console.log("\nCEREMONY COMPLETE. Next, IN THIS ORDER:");
  console.log("  a. merge the Sign-promotion branch into main and let it deploy and SETTLE");
  console.log("     (uptime backwards, SUCCESS on the deployment row with the SHA read off it)");
  console.log("  b. the promotion is live for whoever the segment store is already live for —");
  console.log("     it writes only at Sign, and only what the candidate's set already holds");
  console.log("  c. check /api/health after the deploy");
} catch (error) {
  failed = true;
  console.error("\nCEREMONY FAILED —", error instanceof Error ? error.message : String(error));
  console.error("Nothing below this point ran. The database is in whatever state the lines above report.");
} finally {
  await conn.end();
}
process.exit(failed ? 1 : 0);
