/**
 * IS THE PAID SHEET ACTUALLY BESPECTACLED? (fable-062 order 3.)
 *
 * 160 credits are already committed to roll `641c71d0` on the founder's own
 * account, and the brief's 8/8 history is history — whether it still delivers
 * glasses is unproven and must not be assumed. This asks the pixels.
 *
 * # It reads from where the bytes actually are
 *
 * The rows are in production and the objects are in the DEV bucket (opus-053
 * §2). Which bucket they sit in is irrelevant to what is IN them, so the sheet
 * can be judged now, before anything is decided about moving it — and if it
 * turns out not to be bespectacled, moving it would have been pointless and the
 * refund is the answer instead. Cheaper to look first.
 *
 * # It is also the positive control the tray sweep never had
 *
 * The sweep reported "0 bespectacled of 23 actually read". A counter that has
 * only ever said zero is indistinguishable from a counter that cannot say
 * anything else — the false-pass law, one instrument over. If these eight come
 * back wearing glasses through the SAME reader, threshold and arithmetic, then
 * the zero is a finding rather than a silence. If they come back at 0.000% too,
 * the instrument is the suspect and not the tray.
 *
 * Every hit is written out so a human looks before a credit is spent.
 *
 *   railway.cmd run --service MySQL -- npx tsx scripts/verify-sheet-bespectacled-disposable.mts \
 *     --roll 641c71d0-df30-4db3-ad65-1a94936a983c --base <the base holding the bytes>
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";

import { createFalRegionReader } from "../server/castingV2/falRegionReader";
import { openDatabase } from "./lib/dbConnection.mts";
import { fetchImageBytes } from "./lib/imageBytes.mts";
import { assertOneWorld } from "./lib/worldGuard.mts";

const arg = (name: string): string | undefined => {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
};

const roll = arg("roll");
const base = arg("base")?.replace(/\/$/, "");
if (!roll) throw new Error("--roll <publicId> is required");
if (!base) throw new Error("--base <bucket public base> is required, EXPLICITLY — a base nobody named is a base nobody chose");

const falKey = process.env.FAL_KEY;
if (!falKey) throw new Error("FAL_KEY required — glasses are found by segmentation, never by the brief");
const reader = createFalRegionReader({ apiKey: falKey });

/* Own connection, rows only: `MYSQL_PUBLIC_URL` is the whole reliance, and the
   bucket base is an argument rather than an inheritance. */
assertOneWorld(["MYSQL_PUBLIC_URL"]);
const databaseUrl = process.env.MYSQL_PUBLIC_URL;
if (!databaseUrl) throw new Error("no MYSQL_PUBLIC_URL — run under `railway run --service MySQL`");

const OUT = "output/sheet-verify";
mkdirSync(OUT, { recursive: true });

const connection = await openDatabase(databaseUrl);
const [rows] = await connection.query<any[]>(
  `SELECT c.publicId, c.position, c.status, c.imageKey, r.briefText
     FROM casting_candidates c
     JOIN casting_rolls r ON r.id = c.rollId
    WHERE r.publicId = ?
    ORDER BY c.position`,
  [roll],
);
await connection.end();

console.log(`roll ${roll} — ${rows.length} candidates`);
console.log(`brief: "${rows[0]?.briefText ?? "?"}"`);
console.log(`base:  ${base}\n`);

let wearing = 0;
let read = 0;
const verdicts: { candidate: string; position: number; covered: number; wearing: boolean }[] = [];

for (const row of rows) {
  if (!row.imageKey) { console.log(`  pos ${row.position} — no imageKey (${row.status})`); continue; }
  let image;
  try {
    image = await fetchImageBytes(`${base}/${row.imageKey}`);
  } catch (error) {
    console.log(`  pos ${row.position} ${row.publicId.slice(0, 8)} NO-READ — ${String((error as Error).message).slice(0, 90)}`);
    continue;
  }
  let region;
  try {
    region = await reader.region({ image: image.bytes, name: "glasses", absentIsAnswer: true });
  } catch (error) {
    console.log(`  pos ${row.position} ${row.publicId.slice(0, 8)} NO-READ — segmenter: ${String((error as Error).message).slice(0, 80)}`);
    continue;
  }
  read += 1;
  /* Same threshold and same arithmetic as the tray sweep, deliberately — the
     control is worthless if it is measured a different way. */
  const covered = region.data.reduce((sum, value) => sum + (value > 0 ? 1 : 0), 0)
    / (region.width * region.height);
  const isWearing = covered > 0.001;
  if (isWearing) wearing += 1;
  verdicts.push({ candidate: row.publicId, position: row.position, covered, wearing: isWearing });
  writeFileSync(`${OUT}/${String(row.position).padStart(2, "0")}-${row.publicId.slice(0, 8)}.png`, image.bytes);
  console.log(`  pos ${row.position} ${row.publicId.slice(0, 8)}  glasses ${(covered * 100).toFixed(3)}%`
    + `${isWearing ? "  <-- BESPECTACLED" : "  bare"}`);
}

writeFileSync(`${OUT}/verdicts.json`, `${JSON.stringify({ roll, base, verdicts }, null, 2)}\n`);
console.log(`\n${wearing} bespectacled of ${read} actually read. Images in ${OUT} — LOOK AT THEM.`);
console.log(wearing > 0
  ? "The instrument CAN say bespectacled, so the tray's zero is a finding and not a silence."
  : "The instrument said zero here too. Before believing the tray, suspect the reader: "
    + "a counter that has only ever answered zero has not been shown to answer anything else.");
