/**
 * Ceremony — the reference library (`casting_reference_library`, migration 0028).
 *
 * ONE migration, and it is a new table nothing reads yet. It lands AHEAD of the
 * code that writes it, which is the ordering this program runs under: **the
 * migration lands before the code that names it.** A new table is inert on its
 * own; an INSERT into an absent table is not, and the render that would do it
 * is a paid one.
 *
 * Run ONLY via:
 *   railway.cmd run --service MySQL -- npx tsx scripts/ceremony-reference-library.mts
 *
 * World discipline: no dotenv import — every variable comes from the Railway
 * service environment or the script refuses. A production ceremony that picked
 * up a dev URL from a file would migrate the wrong database and report success.
 *
 * Idempotent: it checks first and says ALREADY APPLIED rather than failing, so
 * a re-run after a partial ceremony is safe and the re-run is the independent
 * confirmation.
 */
import { readFile } from "node:fs/promises";
import mysql from "mysql2/promise";

const url = process.env.MYSQL_PUBLIC_URL;
if (!url) {
  console.error(
    "REFUSING: MYSQL_PUBLIC_URL is not set. Run via "
    + "`railway.cmd run --service MySQL -- npx tsx scripts/ceremony-reference-library.mts`",
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
  /* ------------------------------------------------ 1. the library table */

  const [tables] = await conn.query<any[]>("SHOW TABLES LIKE 'casting_reference_library'");
  if (tables.length > 0) {
    const [count] = await conn.query<any[]>("SELECT COUNT(*) AS n FROM `casting_reference_library`");
    console.log(`1. casting_reference_library  ALREADY APPLIED — ${count[0].n} row(s)`);
  } else {
    /*
      The migration file itself, replayed rather than retyped — a ceremony that
      re-types its own DDL is a second copy of the schema, and it drifts from
      the one every test ran against.
    */
    const sql = await readFile("drizzle/0028_casting_v2_reference_library.sql", "utf8");
    for (const statement of sql.split("--> statement-breakpoint")) {
      const trimmed = statement.trim();
      if (trimmed) await conn.query(trimmed);
    }
    const [after] = await conn.query<any[]>("SHOW TABLES LIKE 'casting_reference_library'");
    if (after.length !== 1) {
      throw new Error("the migration ran and the table is not there — stop and investigate");
    }
    console.log("1. casting_reference_library  APPLIED");
  }

  /* --------------------------------------------------- 2. read it back */

  const [columns] = await conn.query<any[]>("SHOW COLUMNS FROM `casting_reference_library`");
  const names = columns.map((column) => column.Field);
  for (const required of [
    "userId", "candidateId", "variantId", "role", "slot", "tier", "noun", "words",
    "storageKey", "maskKey", "digest", "bboxX", "bboxY", "bboxW", "bboxH", "frameWidth", "frameHeight",
    "guardKind", "guardCoverage", "guardSpill", "guardThreshold", "version", "retiredAt",
  ]) {
    if (!names.includes(required)) {
      throw new Error(`casting_reference_library is missing ${required} — stop and investigate`);
    }
  }

  /*
    THE NULLABILITY IS THE DESIGN, so the read-back proves it rather than
    counting columns. `variantId` NULL means *minted from the master, belongs to
    every branch*; `storageKey` NULL is the tier boundary — a surface is carried
    by words and never by a crop. A NOT NULL on either would make a legal row
    impossible to write, and the failure would arrive on a paid render.
  */
  const nullable = new Map(columns.map((column) => [column.Field, column.Null === "YES"]));
  for (const column of ["variantId", "storageKey", "maskKey", "digest", "retiredAt"]) {
    if (nullable.get(column) !== true) {
      throw new Error(`${column} must be NULLable and is not — stop and investigate`);
    }
  }
  for (const column of ["userId", "candidateId", "role", "slot", "tier", "noun", "words"]) {
    if (nullable.get(column) !== false) {
      throw new Error(`${column} must be NOT NULL and is not — stop and investigate`);
    }
  }

  /*
    And the identity key, which is what makes a re-filed slot take the next
    version rather than collide. `variantId` is deliberately NOT in it: MySQL
    lets NULLs repeat inside a unique index, so a key that master-minted rows
    sit outside of is not a key.
  */
  const [identity] = await conn.query<any[]>(
    "SHOW INDEX FROM `casting_reference_library` WHERE Key_name = 'uq_casting_reference_library_identity'",
  );
  const identityColumns = identity
    .sort((a: any, b: any) => a.Seq_in_index - b.Seq_in_index)
    .map((row: any) => row.Column_name);
  const expected = ["candidateId", "slot", "role", "version"];
  if (identityColumns.join(",") !== expected.join(",")) {
    throw new Error(
      `the identity key is ${identityColumns.join(",") || "ABSENT"}, expected ${expected.join(",")} — stop and investigate`,
    );
  }
  if (identity.some((row: any) => row.Non_unique !== 0)) {
    throw new Error("the identity key is not unique — stop and investigate");
  }
  console.log(
    `2. read back                  ${names.length} columns; identity key UNIQUE on (${identityColumns.join(", ")})`,
  );

  console.log("\nCEREMONY COMPLETE. Next, IN THIS ORDER:");
  console.log("  a. the code that writes this table is already deployed and DARK —");
  console.log("     CASTING_REFERENCE_LIBRARY_SCOPE is unset, so no row is ever written");
  console.log("  b. set CASTING_REFERENCE_LIBRARY_SCOPE=users:1 on the app service when the");
  console.log("     minting path is ready to be dogfooded (boot refuses it unless the cleanup");
  console.log("     worker is on and the user is inside CASTING_V2_SCOPE)");
  console.log("  c. check /api/health after that deploy, and read the SHA off the row");
} catch (error) {
  failed = true;
  console.error("\nCEREMONY FAILED —", error instanceof Error ? error.message : String(error));
  console.error("Nothing below this point ran. The database is in whatever state the lines above report.");
} finally {
  await conn.end();
}
process.exit(failed ? 1 : 0);
