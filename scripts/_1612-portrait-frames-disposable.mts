/**
 * DISPOSABLE — #1612, the `frontClose` bound court: fetch the frames.
 *
 * READ-ONLY against PRODUCTION; writes nothing but PNG bytes under
 * `output/_1612-frames/`. The URLs are printed to this terminal only and never
 * onto a card.
 *
 *   railway.cmd run --service MySQL -- npx tsx scripts/_1612-portrait-frames-disposable.mts
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { openDatabase } from "./lib/dbConnection.mts";

const DIR = path.resolve("output/_1612-frames");
mkdirSync(DIR, { recursive: true });

const conn = await openDatabase();
const [rows] = await conn.query<any[]>(`
  SELECT a.id, a.modelId AS castId, m.name, a.viewType AS view,
         JSON_UNQUOTE(JSON_EXTRACT(a.status, '$.state')) AS state,
         a.storageUrl
  FROM model_assets a JOIN models m ON m.id = a.modelId
  WHERE m.mintedAt IS NOT NULL AND m.userId = 1
    AND a.viewType IN ('frontClose','frontFull','backFull','closeUp')
    AND a.storageUrl IS NOT NULL AND a.storageUrl <> ''
  ORDER BY a.viewType, a.modelId, a.id
`);
await conn.end();

console.log(`\n${rows.length} frames with bytes (his account, all time):`);
const manifest: Array<{ asset: number; cast: number; who: string; view: string }> = [];
let fetched = 0;
let held = 0;
for (const row of rows) {
  const file = path.join(DIR, `${row.id}.png`);
  manifest.push({ asset: row.id, cast: row.castId, who: String(row.name ?? "-"), view: String(row.view) });
  if (existsSync(file)) {
    held += 1;
    console.log(`  asset ${String(row.id).padStart(4)}  ${String(row.view).padEnd(11)} cast ${String(row.castId).padStart(3)} ${String(row.name ?? "-").padEnd(12).slice(0, 12)}  on disk`);
    continue;
  }
  const reply = await fetch(String(row.storageUrl));
  if (!reply.ok) throw new Error(`asset ${row.id}: ${reply.status} ${reply.statusText}`);
  const bytes = Buffer.from(await reply.arrayBuffer());
  writeFileSync(file, bytes);
  fetched += 1;
  console.log(`  asset ${String(row.id).padStart(4)}  ${String(row.view).padEnd(11)} cast ${String(row.castId).padStart(3)} ${String(row.name ?? "-").padEnd(12).slice(0, 12)}  fetched ${Math.round(bytes.length / 1024)} KB`);
}

writeFileSync(path.join(DIR, "portrait-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`\n${held} already on disk, ${fetched} fetched. Manifest written.`);

process.exit(0);
