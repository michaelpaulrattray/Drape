/**
 * THE VERIFICATION ORDER (fable-1216 §3) — does any stored object on this
 * world's ink roads carry person-bytes under its alpha?
 *
 *   npx tsx scripts/audit-cut-person-bytes-disposable.mts
 *   railway.cmd run --service MySQL -- npx tsx scripts/audit-cut-person-bytes-disposable.mts
 *
 * `cutOutPixels` wrote the alpha byte alone until 2026-08-21, so every object
 * either ink road produced before that carries whatever the source picture held
 * outside the mask. For a DESIGN cut that source is a stranger's photograph; for
 * a DELIVERY crop it is our own rendered Cast, which is a different exposure
 * class and is reported separately rather than lumped in.
 *
 * It READS. It deletes nothing — a purge is a separate, declared act, and this
 * is the reading that decides whether one is needed.
 */
import "dotenv/config";

import sharp from "sharp";

import { openDatabase } from "./lib/dbConnection.mts";
import { assertOneWorld } from "./lib/worldGuard.mts";

const databaseKey = process.env.MYSQL_PUBLIC_URL ? "MYSQL_PUBLIC_URL" : "DATABASE_URL";
assertOneWorld([databaseKey]);
const databaseUrl = process.env[databaseKey];
if (!databaseUrl) throw new Error("no database URL");
const base = process.env.R2_PUBLIC_URL;
if (!base) throw new Error("R2_PUBLIC_URL is not set");

console.log(`world:  ${databaseKey}`);
console.log(`bucket: ${base}\n`);

const connection = await openDatabase(databaseUrl);

async function tableExists(name: string): Promise<boolean> {
  const [rows] = await connection.query<any[]>(
    "SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?",
    [name],
  );
  return Number(rows[0]?.n ?? 0) > 0;
}

/** Non-black pixels hiding under a zero alpha — the whole question. */
async function personBytes(bytes: Buffer): Promise<{ hidden: number; clear: number; total: number } | null> {
  try {
    const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let hidden = 0;
    let clear = 0;
    for (let at = 0; at < info.width * info.height; at += 1) {
      if (data[at * 4 + 3] !== 0) continue;
      clear += 1;
      if (data[at * 4] !== 0 || data[at * 4 + 1] !== 0 || data[at * 4 + 2] !== 0) hidden += 1;
    }
    return { hidden, clear, total: info.width * info.height };
  } catch {
    return null;
  }
}

const ROADS: Array<{ table: string; keyColumn: string; what: string }> = [
  { table: "casting_ink_designs", keyColumn: "storageKey", what: "A CUSTOMER'S OWN PHOTOGRAPH" },
  { table: "casting_ink_delivery_crops", keyColumn: "storageKey", what: "our own rendered Cast" },
];

let anyCarrying = 0;
for (const road of ROADS) {
  if (!await tableExists(road.table)) {
    console.log(`${road.table}: TABLE ABSENT on this world — nothing to read\n`);
    continue;
  }
  const [rows] = await connection.query<any[]>(
    `SELECT publicId, userId, ${road.keyColumn} AS storageKey FROM ${road.table} ORDER BY id`,
  );
  console.log(`${road.table}: ${rows.length} row(s)   [under the alpha: ${road.what}]`);
  for (const row of rows) {
    const url = `${base.replace(/\/$/, "")}/${row.storageKey}`;
    const response = await fetch(url).catch(() => null);
    if (!response?.ok) {
      console.log(`  ${row.publicId}  OBJECT UNREACHABLE (${response?.status ?? "no response"})  ${row.storageKey}`);
      continue;
    }
    const read = await personBytes(Buffer.from(await response.arrayBuffer()));
    if (read === null) { console.log(`  ${row.publicId}  did not decode`); continue; }
    const verdict = read.hidden > 0 ? "⚠ CARRIES HIDDEN PIXELS" : "clean";
    if (read.hidden > 0) anyCarrying += 1;
    console.log(`  ${row.publicId}  user ${row.userId}  ${verdict}`
      + `  hidden ${read.hidden} of ${read.clear} cleared (${read.total} px)`);
  }
  console.log("");
}

console.log(anyCarrying === 0
  ? "NOTHING on this world carries hidden pixels."
  : `${anyCarrying} object(s) carry hidden pixels — a purge is object-before-row, declared as housekeeping.`);
await connection.end();
process.exit(0);
