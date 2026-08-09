/**
 * THE PAIR COUNTER NEEDS TWO SPECIMENS, and neither may be chosen by hand-wave.
 *
 * The finding-replay walk asserts that "gold hoop earrings" delivers a hoop on
 * BOTH ears. Before that assertion is worth anything the counter has to be
 * shown able to fail — on the founder's own one-hoop frame (v#156) — and able
 * to pass, on a frame that genuinely carries two. This pulls every earring
 * render on his account with its stored `saw`, downloads the frames, and
 * crops each ear so the specimens can be CHOSEN BY LOOKING rather than by
 * trusting the reader that already got it wrong once.
 *
 * Read-only: no row is written, no model is asked, nothing is charged.
 *
 * # The two worlds, and why the bucket is an ARGUMENT
 *
 * The rows are production's and so are the bytes, and no single Railway
 * service supplies both reachably: `--service Drape` hands out
 * `mysql.railway.internal`, which does not resolve from this laptop, and
 * `--service MySQL` supplies the public database URL and no bucket at all —
 * the exact gap dotenv fills with a DEV value, silently, which is the mistake
 * `worldGuard` exists to make impossible. So the bucket is passed by hand and
 * checked against the local `.env` rather than inherited from it.
 *
 *   railway.cmd run --service MySQL -- \
 *     npx tsx scripts/pull-earring-specimens-disposable.mts \
 *       --bucket https://pub-990e39d8d995468eb61aced83162123a.r2.dev
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import mysql from "mysql2/promise";
import sharp from "sharp";

import { assertOneWorld, readLocalEnvFile } from "./lib/worldGuard.mts";

function arg(name: string, fallback = ""): string {
  const index = process.argv.indexOf(`--${name}`);
  return index > -1 ? (process.argv[index + 1] ?? fallback) : fallback;
}

const databaseKey = process.env.MYSQL_PUBLIC_URL ? "MYSQL_PUBLIC_URL" : "DATABASE_URL";
assertOneWorld([databaseKey]);

const OUT = path.resolve("output/earring-specimens");
const base = arg("bucket").replace(/\/$/, "");
if (!base) {
  throw new Error(
    "--bucket <public url> is required: these are production frames and this process "
    + "must not be allowed to inherit a dev bucket from .env",
  );
}
if (base === (readLocalEnvFile().get("R2_PUBLIC_URL") ?? "").replace(/\/$/, "")) {
  throw new Error("--bucket is the local .env's bucket — that is the dev world, and these rows are production's");
}
process.env.DATABASE_URL = process.env[databaseKey];
/* The founder by his own identifier rather than by `id = 1` — a row number is
   not a fact (the sibling lesson worldGuard was written from). */
const OPEN_ID = "google_109438922864282769159";

const connection = await mysql.createConnection({
  uri: process.env.DATABASE_URL!, timezone: "Z",
} as mysql.ConnectionOptions);

const query = async (sql: string, params: unknown[] = []): Promise<any[]> => {
  const [rows] = await connection.query<any[]>(sql, params);
  return rows;
};

const [owner] = await query("SELECT id FROM users WHERE openId = ? LIMIT 1", [OPEN_ID]);
if (!owner) throw new Error(`no account for ${OPEN_ID} — wrong world`);

const rows = await query(
  `SELECT id, publicId, candidateId, requestText, imageKey, internalPrompt, createdAt
     FROM casting_candidate_variants
    WHERE userId = ? AND status = 'ready' AND imageKey IS NOT NULL
      AND (requestText LIKE '%earring%' OR requestText LIKE '%hoop%')
    ORDER BY id ASC`,
  [owner.id],
);

await mkdir(OUT, { recursive: true });
console.log(`${rows.length} earring renders on the founder's account\n`);

for (const row of rows) {
  const prompt = typeof row.internalPrompt === "string" ? JSON.parse(row.internalPrompt) : row.internalPrompt;
  const checks: any[] = prompt?.verification?.checks ?? [];
  const accessory = checks.find((check) => check?.facet === "statedAccessories");
  console.log(`v#${row.id}  ${row.publicId}  "${row.requestText}"`);
  console.log(`    verdict: ${accessory ? `${accessory.verified ? "verified" : "NOT verified"} · read=${accessory.read}` : "no statedAccessories check"}`);
  if (accessory?.saw) console.log(`    saw: ${String(accessory.saw).slice(0, 150)}`);

  const response = await fetch(`${base}/${row.imageKey}`);
  if (!response.ok) { console.log(`    frame: HTTP ${response.status}\n`); continue; }
  const bytes = Buffer.from(await response.arrayBuffer());
  const meta = await sharp(bytes).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;

  /*
    BOTH EARS, SIDE BY SIDE, AT SIZE — the crop is the whole point. A full
    frame at 848×1264 shrinks an earring to a few pixels on any screen that
    will show it, which is exactly how a single hoop survived three readers.
    The band is the upper-middle third, where an earlobe is on a portrait.
  */
  const band = {
    left: Math.round(width * 0.18),
    top: Math.round(height * 0.20),
    width: Math.round(width * 0.64),
    height: Math.round(height * 0.28),
  };
  await writeFile(
    path.join(OUT, `v${row.id}-ears.png`),
    await sharp(bytes).extract(band).resize({ width: 900 }).png().toBuffer(),
  );
  console.log(`    frame ${width}×${height} → v${row.id}-ears.png\n`);
}

await connection.end();
console.log(`crops in ${OUT} — CHOOSE the specimens by looking at them.`);
