/**
 * Founder ceremony — segment permanence, slice 1 (production).
 *
 * TWO migrations, ONE ceremony (fable-093). Both are additive and neither
 * changes the meaning of a column that exists today:
 *
 *   1. `casting_candidate_variants.parentVariantId` + its index — migration
 *      `0026`. **Sequenced FIRST**, because the code that names it cannot run
 *      without it and every later step is safer once it exists.
 *   2. `casting_segments` — migration `0025`. A new table nothing reads until
 *      `CASTING_SEGMENTS_SCOPE` is set.
 *
 * Run ONLY via:
 *   railway.cmd run --service MySQL -- npx tsx scripts/ceremony-segment-store.mts
 *
 * World discipline: no dotenv import — every variable here comes from the
 * Railway service environment or the script refuses (the mixed-worlds lesson;
 * a production key resolved against a dev world is how a 404 became a bare
 * face, and how this ceremony would become a migration of the wrong database).
 *
 * # Why the ORDER of the whole operation matters, in one line
 *
 * **The migration lands before the code that names its column.** A new TABLE
 * nobody reads is inert — the segment store has been deployed for a while with
 * no table and does nothing but log one warning per sweep. A new COLUMN on the
 * table every refinement WRITES is named in the INSERT whether or not anything
 * reads it, so the deploy that landed before this ceremony turned every
 * refinement into `Unknown column 'parentVariantId'` for about a minute. Run
 * this, verify it, THEN merge `segment-lineage` to main, THEN set the flag.
 *
 * Idempotent: every step checks first and says ALREADY APPLIED rather than
 * failing, so a re-run after a partial ceremony is safe.
 */
import { readFile } from "node:fs/promises";
import mysql from "mysql2/promise";

const url = process.env.MYSQL_PUBLIC_URL;
if (!url) {
  console.error(
    "REFUSING: MYSQL_PUBLIC_URL is not set. Run via "
    + "`railway.cmd run --service MySQL -- npx tsx scripts/ceremony-segment-store.mts`",
  );
  process.exit(1);
}
if (!/railway|rlwy\.net|proxy/i.test(url)) {
  console.error("REFUSING: MYSQL_PUBLIC_URL does not look like the Railway database.");
  process.exit(1);
}

const conn = await mysql.createConnection(url);
let failed = false;
try {
  /* ---------------------------------------------- 1. the lineage column */

  const [columns] = await conn.query<any[]>(
    "SHOW COLUMNS FROM `casting_candidate_variants` LIKE 'parentVariantId'",
  );
  if (columns.length > 0) {
    console.log("1. parentVariantId  ALREADY APPLIED —", columns[0].Type);
  } else {
    await conn.query("ALTER TABLE `casting_candidate_variants` ADD `parentVariantId` int");
    const [after] = await conn.query<any[]>(
      "SHOW COLUMNS FROM `casting_candidate_variants` LIKE 'parentVariantId'",
    );
    if (after.length !== 1) throw new Error("the ALTER ran and the column is not there — stop and investigate");
    console.log("1. parentVariantId  APPLIED —", after[0].Type);
  }

  const [indexes] = await conn.query<any[]>(
    "SHOW INDEX FROM `casting_candidate_variants` WHERE Key_name = 'idx_casting_variants_parent'",
  );
  if (indexes.length > 0) {
    console.log("   idx_casting_variants_parent  ALREADY APPLIED");
  } else {
    await conn.query(
      "CREATE INDEX `idx_casting_variants_parent` ON `casting_candidate_variants` (`parentVariantId`)",
    );
    console.log("   idx_casting_variants_parent  APPLIED");
  }

  /* ------------------------------------------------ 2. the segment store */

  const [tables] = await conn.query<any[]>("SHOW TABLES LIKE 'casting_segments'");
  if (tables.length > 0) {
    const [count] = await conn.query<any[]>("SELECT COUNT(*) AS n FROM `casting_segments`");
    console.log(`2. casting_segments  ALREADY APPLIED — ${count[0].n} row(s)`);
  } else {
    /*
      The migration file itself, replayed rather than retyped. A ceremony that
      re-types its own DDL is a second copy of the schema that drifts from the
      one every test ran against.
    */
    const sql = await readFile("drizzle/0025_casting_v2_segment_store.sql", "utf8");
    for (const statement of sql.split("--> statement-breakpoint")) {
      const trimmed = statement.trim();
      if (trimmed) await conn.query(trimmed);
    }
    const [after] = await conn.query<any[]>("SHOW TABLES LIKE 'casting_segments'");
    if (after.length !== 1) throw new Error("the migration ran and the table is not there — stop and investigate");
    console.log("2. casting_segments  APPLIED");
  }

  /* ------------------------------------------------------- 3. read it back */

  const [segmentColumns] = await conn.query<any[]>("SHOW COLUMNS FROM `casting_segments`");
  const names = segmentColumns.map((column) => column.Field);
  for (const required of ["provenance", "facet", "region", "version", "maskKey", "contentKey", "detector", "retiredAt"]) {
    if (!names.includes(required)) throw new Error(`casting_segments is missing ${required} — stop and investigate`);
  }
  console.log(`3. read back        casting_segments has ${names.length} columns, all the load-bearing ones present`);

  console.log("\nCEREMONY COMPLETE. Next, IN THIS ORDER:");
  console.log("  a. merge `segment-lineage` into main and let it deploy and SETTLE");
  console.log("     (uptime backwards, SUCCESS on the deployment row with the SHA read off it)");
  console.log("  b. only then set CASTING_SEGMENTS_SCOPE=users:1 on the Drape service");
  console.log("  c. check /api/health after each");
} catch (error) {
  failed = true;
  console.error("\nCEREMONY FAILED —", error instanceof Error ? error.message : String(error));
  console.error("Nothing below this point ran. The database is in whatever state the lines above report.");
} finally {
  await conn.end();
}
process.exit(failed ? 1 : 0);
