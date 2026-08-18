/**
 * REHEARSE THE REFERENCE CROP CEREMONY before the founder runs it (0040).
 *
 * Creates a throwaway database on the dev server, replays the journal up to BUT
 * NOT INCLUDING 0040 — so the rehearsal database is in exactly the shape the
 * founder's world will be in — then runs the real ceremony against it, twice.
 *
 * Twice, because the second run is the half that matters: a ceremony that
 * cannot be re-run after a partial failure is a ceremony nobody can recover
 * from at 3am, and "ALREADY APPLIED" has to be a real branch rather than a
 * hopeful comment.
 *
 * # THE ARM ASSERTS ITS OWN REASON
 *
 * The pre-state is CHECKED rather than assumed. A rehearsal that started from a
 * database which already had the column would pass without the ceremony ever
 * applying anything — the shape of failure this program has already paid for,
 * where five arms all refused for a reason nobody read and the summary said
 * REHEARSED.
 *
 * It never touches the database named in DATABASE_URL, and refuses if that URL
 * did not come from `.env` or looks like production.
 *
 * # AND IT ASSERTS THE ABSENCE THE CEREMONY ASSERTS
 *
 * The ceremony refuses if the live table carries geometry columns, because a
 * bbox would locate a cut inside a photograph of a real person we do not keep.
 * That refusal is a control, so the rehearsal reads the same absence back after
 * both runs rather than trusting the ceremony's own verdict about itself.
 *
 *   npx tsx scripts/rehearse-reference-crop-ceremony-disposable.mts
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { openServer } from "./lib/serverConnection.mts";

const PREFIX = "drape_crop_rehearsal_";
const HELD_BACK = "0040_casting_reference_crops";
const TABLE = "casting_reference_crops";

function databaseUrlFromDotEnv(): string | null {
  try {
    const line = readFileSync(".env", "utf8")
      .split(/\r?\n/)
      .find((entry) => entry.startsWith("DATABASE_URL="));
    return line ? line.slice("DATABASE_URL=".length).trim().replace(/^["']|["']$/g, "") : null;
  } catch {
    return null;
  }
}

const active = process.env.DATABASE_URL!;
if (databaseUrlFromDotEnv() !== active) {
  throw new Error("Refusing: DATABASE_URL was overridden rather than read from .env. This script creates and drops a database.");
}
const url = new URL(active);
if (["prod", "production"].some((marker) => url.pathname.toLowerCase().includes(marker))) {
  throw new Error(`Refusing: database "${url.pathname}" looks like production`);
}

const databaseName = `${PREFIX}${Math.random().toString(36).slice(2, 10)}`;
if (!new RegExp(`^${PREFIX}[a-z0-9]+$`).test(databaseName)) throw new Error("generated an unsafe database name");

const server = await openServer(url, { multipleStatements: false });
const rehearsalUrl = new URL(active);
rehearsalUrl.pathname = `/${databaseName}`;

let exitCode = 1;
try {
  await server.query(`CREATE DATABASE \`${databaseName}\``);
  await server.changeUser({ database: databaseName });

  const files = (await readdir("drizzle"))
    .filter((file) => /^\d{4}_.+\.sql$/.test(file))
    .filter((file) => !file.startsWith(HELD_BACK))
    .sort();
  for (const file of files) {
    const sql = await readFile(`drizzle/${file}`, "utf8");
    for (const statement of sql.split("--> statement-breakpoint")) {
      const trimmed = statement.trim();
      if (trimmed) await server.query(trimmed);
    }
  }
  console.log(`[rehearsal] ${databaseName}: ${files.length} migration(s), ${HELD_BACK} HELD BACK\n`);

  /* THE PRE-STATE, ASSERTED — the half that failed elsewhere in this program.
     A rehearsal against a database that already held the table would pass
     without the ceremony applying anything, and would say REHEARSED. */
  const [before] = await server.query<any[]>(`SHOW TABLES LIKE '${TABLE}'`);
  if (before.length !== 0) {
    throw new Error(`the rehearsal database already has \`${TABLE}\` — the hold-back did not hold, and this rehearsal would pass without applying anything`);
  }
  console.log(`[rehearsal] confirmed: \`${TABLE}\` is ABSENT — the founder's shape\n`);

  const run = (label: string) => new Promise<number>((resolve) => {
    console.log(`── ${label}`);
    /* `--production` deliberately: that is the arm the founder will run, and it
       is the one carrying the extra guards (no dotenv, MYSQL_PUBLIC_URL only, a
       refusal when the two URLs are the same string). Rehearsing `--dev` would
       leave all three untested on the night. */
    const child = spawn("npx", ["tsx", "scripts/ceremony-reference-crops.mts", "--production"], {
      stdio: "inherit",
      shell: process.platform === "win32",
      /* The ceremony reads MYSQL_PUBLIC_URL and nothing else — the same
         variable name the founder's run will carry, pointed here. */
      env: { ...process.env, MYSQL_PUBLIC_URL: rehearsalUrl.toString() },
    });
    child.on("exit", (code) => resolve(code ?? 1));
  });

  const first = await run("FIRST RUN — applies 0040");
  if (first !== 0) throw new Error("the ceremony failed on its first run");
  const second = await run("\nSECOND RUN — must say ALREADY APPLIED and change nothing");
  if (second !== 0) throw new Error("the ceremony failed on its second run — it is not re-runnable");

  const [after] = await server.query<any[]>(`SHOW TABLES LIKE '${TABLE}'`);
  if (after.length !== 1) throw new Error(`after two runs \`${TABLE}\` is present ${after.length} time(s), not exactly once`);

  /* THE ABSENCE, READ BACK INDEPENDENTLY of the ceremony's own verdict. The
     fence on this road is that nothing locates the cut inside somebody's
     photograph, and a fence checked only by the thing it constrains is the
     checker that cannot fail. */
  const [columns] = await server.query<any[]>(`SHOW COLUMNS FROM \`${TABLE}\``);
  const names = columns.map((column: any) => String(column.Field));
  const forbidden = ["bboxX", "bboxY", "bboxW", "bboxH", "frameWidth", "frameHeight"];
  const present = forbidden.filter((column) => names.includes(column));
  if (present.length > 0) throw new Error(`\`${TABLE}\` carries [${present.join(", ")}] — geometry into a frame we do not keep`);

  /* And the enum the ceremony compared: read here too, because "the ceremony
     said so" and "the database says so" are different facts. */
  const intent = columns.find((column: any) => String(column.Field) === "intent");
  if (!intent) throw new Error("`intent` is missing");
  if (!/^enum\('hair','eyeColour'\)$/i.test(String(intent.Type))) {
    throw new Error(`\`intent\` is ${intent.Type}, not the crop-form members of the ingestion map`);
  }

  console.log(`\n[rehearsal] REHEARSED CLEAN — \`${TABLE}\` present exactly once after two runs, ${names.length} columns, intent ${intent.Type}, and no geometry into a stranger's frame.`);
  exitCode = 0;
} finally {
  await server.changeUser({ database: undefined as never }).catch(() => undefined);
  await server.query(`DROP DATABASE IF EXISTS \`${databaseName}\``);
  console.log(`[rehearsal] dropped ${databaseName}`);
  await server.end();
}

process.exit(exitCode);
