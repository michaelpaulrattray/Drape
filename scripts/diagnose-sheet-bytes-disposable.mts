/**
 * WHERE DID THE PAID SHEET'S PICTURES GO? (fable-062 order 2.)
 *
 * Roll `641c71d0` charged 160 credits on the founder's account and its eight
 * candidates are `ready` with image keys — but every key fetched from the
 * PRODUCTION public base returns the app's own HTML index instead of a PNG,
 * while an older candidate's key on the same base returns a real picture. So
 * the base is fine and these keys specifically are not there.
 *
 * # The hypothesis this exists to settle, and why it is the obvious one
 *
 * `bespectacled-roll-production.mts` runs `createRoll` IN PROCESS. That is the
 * app's own pipeline, so the bytes are written by `server/storage.ts`, which
 * reads `R2_ENDPOINT`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`
 * and `R2_PUBLIC_URL` through `ENV`. It was run under
 * `railway run --service MySQL` — and the MySQL service defines NONE of those,
 * so `dotenv` filled all five from the developer's local `.env`.
 *
 *   rows  → production (DATABASE_URL was pointed there deliberately)
 *   bytes → the DEV bucket (nobody pointed R2 anywhere)
 *
 * That is the SAME under-declaration a third time, one dependency layer deeper
 * again: the guard was told `DATABASE_URL, MYSQL_PUBLIC_URL`, and the write
 * path's reliance runs `createRoll → storagePut → ENV.r2*`.
 *
 * # How it is settled without guessing
 *
 * Ask both buckets for the same key by their PUBLIC bases and report what each
 * answers, as a medium rather than a status code — a 200 carrying HTML is the
 * specimen that started all of this. Two labelled bases, neither inherited
 * silently: production comes from `--production-base`, dev is read out of the
 * `.env` FILE and labelled as such.
 *
 * Read-only. Touches no object and no row.
 *
 *   railway.cmd run --service MySQL -- npx tsx scripts/diagnose-sheet-bytes-disposable.mts \
 *     --roll 641c71d0-df30-4db3-ad65-1a94936a983c \
 *     --production-base https://pub-990e39d8d995468eb61aced83162123a.r2.dev
 */
import "dotenv/config";

import { openDatabase, utc } from "./lib/dbConnection.mts";
import { fetchImageBytes } from "./lib/imageBytes.mts";
import { assertOneWorld, readLocalEnvFile } from "./lib/worldGuard.mts";

const arg = (name: string): string | undefined => {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
};

const roll = arg("roll");
const productionBase = arg("production-base")?.replace(/\/$/, "");
if (!roll) throw new Error("--roll <publicId> is required");
if (!productionBase) {
  throw new Error(
    "--production-base is required and must be passed EXPLICITLY. Inheriting it from the "
    + "environment is the mistake being diagnosed; a base nobody named is a base nobody chose.",
  );
}

/* This script opens its own connection and reads only rows, so `MYSQL_PUBLIC_URL`
   is the whole of its reliance — and it is declared rather than assumed. */
assertOneWorld(["MYSQL_PUBLIC_URL"]);
const databaseUrl = process.env.MYSQL_PUBLIC_URL;
if (!databaseUrl) throw new Error("no MYSQL_PUBLIC_URL — run under `railway run --service MySQL`");

/* Deliberately from the FILE, not from `process.env`: inside a Railway run the
   two are the same value for exactly the reason under investigation, and the
   point here is to name which world each base belongs to. */
const devBase = readLocalEnvFile().get("R2_PUBLIC_URL")?.replace(/\/$/, "");
const devBucket = readLocalEnvFile().get("R2_BUCKET");

const connection = await openDatabase(databaseUrl);
const [rows] = await connection.query<any[]>(
  `SELECT c.id, c.publicId, c.position, c.status, c.imageKey, c.createdAt,
          r.publicId AS roll, r.userId
     FROM casting_candidates c
     JOIN casting_rolls r ON r.id = c.rollId
    WHERE r.publicId = ?
    ORDER BY c.position`,
  [roll],
);

/* A control from the same world: an OLDER candidate whose picture is known to
   serve. Without it, "production says HTML" could just as easily be a fact
   about the base as a fact about these keys. */
const [controls] = await connection.query<any[]>(
  `SELECT c.publicId, c.imageKey, c.createdAt
     FROM casting_candidates c
     JOIN casting_rolls r ON r.id = c.rollId
    WHERE r.userId = 1 AND c.status = 'ready' AND c.imageKey IS NOT NULL
      AND r.publicId <> ?
    ORDER BY c.createdAt DESC
    LIMIT 1`,
  [roll],
);
await connection.end();

console.log(`roll ${roll} — ${rows.length} candidates, user ${rows[0]?.userId ?? "?"}`);
console.log(`production base: ${productionBase}`);
console.log(`dev base (.env): ${devBase ?? "absent"}  bucket ${devBucket ?? "?"}\n`);

async function look(base: string | undefined, key: string): Promise<string> {
  if (!base) return "no base";
  try {
    const image = await fetchImageBytes(`${base}/${key}`);
    return `${image.mime} ${(image.bytes.length / 1024).toFixed(0)}KB`;
  } catch (error) {
    /* The message already names the medium; trimmed so the table stays a table. */
    return String((error as Error).message).replace(/^.*?: these are not image bytes — /, "NOT AN IMAGE: ")
      .replace(`${base}/${key}`, "…").slice(0, 78);
  }
}

const verdicts: { candidate: string; production: string; dev: string }[] = [];
for (const row of [...rows, ...controls.map((c: any) => ({ ...c, position: "CONTROL", status: "ready" }))]) {
  if (!row.imageKey) {
    console.log(`  pos ${String(row.position).padEnd(7)} ${row.publicId.slice(0, 8)}  ${row.status}  — no imageKey`);
    continue;
  }
  const production = await look(productionBase, row.imageKey);
  const dev = await look(devBase, row.imageKey);
  verdicts.push({ candidate: row.publicId, production, dev });
  console.log(`  pos ${String(row.position).padEnd(7)} ${row.publicId.slice(0, 8)}  ${String(row.status).padEnd(7)}`
    + ` ${utc(row.createdAt)}\n      production: ${production}\n      dev:        ${dev}`);
}

const sheet = verdicts.slice(0, rows.length);
const inDev = sheet.filter((v) => v.dev.startsWith("image/")).length;
const inProduction = sheet.filter((v) => v.production.startsWith("image/")).length;
console.log(`\nOf ${sheet.length} paid candidates: ${inProduction} served by production, ${inDev} served by DEV.`);
console.log(inDev > 0 && inProduction === 0
  ? "VERDICT: the rows are in production and the BYTES ARE IN THE DEV BUCKET. Mixed worlds, third bite —\n"
    + "the write path's reliance is createRoll → storagePut → ENV.r2*, and the guard was never told."
  : inProduction === sheet.length
    ? "VERDICT: production serves them all. The earlier reading was the one at fault."
    : "VERDICT: neither bucket serves them — the objects may genuinely not exist. Product finding.");
