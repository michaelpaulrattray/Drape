/**
 * DO BESPECTACLED EYE READS MISS, AND DO THEY SKEW TO ONE SIDE? — the rate
 * fable-744 §3a authorized (~$0.20 of house money, declared).
 *
 * # Why a number had to be bought at all
 *
 * The founder's specimen: a panel row with ONE eye box on a frame where his own
 * eye sees both plainly behind the lenses. opus-541 §4 then found the reason no
 * figure existed — **the scan's own `empty` tally could never have counted it.**
 * A bilateral region is recorded as `filed` when EITHER side lands
 * (`faceScan.ts:453`), so one-eye-found is a SUCCESS to the instrument, is never
 * re-asked, and appears in no tally of empties. The count folds the exact
 * failure it was built to see.
 *
 * The rate also cannot be read backwards from his existing frames: the scan
 * mints nothing, so there is no stored reading to count. It has to be re-read.
 *
 * # THE INSTRUMENT IS THE PRODUCT'S OWN, PART FOR PART
 *
 * Nothing here is reconstructed, because a reconstructed input is a claim
 * (`reconstruction needs an independent record`) and a question spelled
 * slightly differently would measure a different instrument:
 *
 * ```
 * question   taken from `scanPlan()` — the same list `scanFace` walks
 * reader     `createFalRegionReader` — the same reader, one per frame, because
 *            it verifies the frame's URL against the bytes once per reader
 * sides      `reader.regionSides(...)` — the same call, same `absentIsAnswer`
 * floor      `detectionFloorFor(question, "side")` — the same floor, and the
 *            side one, not the frame one
 * verdict    `binaryCoverage(mask) > floor` — the same arithmetic
 * ```
 *
 * # THE ARMS, AND WHY THERE ARE TWO
 *
 * ```
 * GLASSES   every framed candidate whose roll asked for glasses
 * CONTROL   every framed candidate whose roll did not mention them
 * ```
 *
 * Chosen by BRIEF rather than by roll id, because the ids differ between dev
 * and production and a hardcoded number that happens to exist in the other
 * world would silently read the wrong sheet.
 *
 * The dev run of this reading found the GLASSES arm EMPTY — every bespectacled
 * sheet in dev has had its candidates swept — and declared itself invalid
 * rather than printing a `0/0` row that skims as clean. The founder's own
 * bespectacled sheet is in PRODUCTION, which is why the world guard below
 * exists and why fable-748 §3 made its conditions binding.
 *
 * A single column of misses cannot say whether the cause is the LENSES or the
 * reader's ordinary error rate on eyes. Both arms run in the same sitting, on
 * the same reader, in the same weather — because claim rates in this program
 * move tens of percent between windows with nothing changed (`context is not
 * additive`), and a control measured on a different night is not a control.
 *
 * # WHAT IS REPORTED
 *
 * Every cell carries its own n (`null result needs a fixture`), and the
 * per-side split is reported rather than pooled, because "does it skew to one
 * side" is the second half of the question and pooling answers only the first.
 *
 *   npx tsx scripts/read-eye-side-rate-disposable.mts
 */
import "dotenv/config";
import { mkdirSync } from "node:fs";

import sharp from "sharp";

import { openDatabase, resolveDatabaseUrl, worldOf } from "./lib/dbConnection.mts";
import { teeTo, openLedgerWatch } from "./lib/benchKit.mts";
import { scanPlan } from "../server/castingV2/faceScan.ts";
import { detectionFloorFor } from "../server/castingV2/bornWornDetector.ts";
import { binaryCoverage } from "../server/castingV2/maskGeometry.ts";
import { createFalRegionReader } from "../server/castingV2/falRegionReader.ts";
import { storageReadBytes, storagePublicUrl } from "../server/storage.ts";

const OUT = "output/eye-rate";
mkdirSync(OUT, { recursive: true });
const say = teeTo(`${OUT}/rate.txt`);

const FAL_KEY = process.env.FAL_KEY;
if (!FAL_KEY) throw new Error("FAL_KEY is required");

const USD_PER_READ = 0.005;
let reads = 0;

/* The eye entry of the product's own plan — never a retyped string. */
const eye = scanPlan().find((entry) => entry.feature === "eye");
if (!eye) throw new Error("the catalogue has no eye region — the plan changed under this reading");
const FLOOR = detectionFloorFor(eye.question, "side").floor;

/*
  THE WORLD IS PRINTED AND ASSERTED BEFORE THE FIRST READ (fable-748 §3, binding).

  Dev and production share a hostname and a database NAME and differ only by
  PORT — and, separately, by R2 BUCKET. Overriding `DATABASE_URL` alone points
  the rows at production while leaving the reader pulling bytes from the DEV
  bucket, which is the `railway run --service MySQL = DB vars only` lesson
  already on file. The three move together or this refuses to read.

  Asserted rather than trusted: a mismatched pair would otherwise produce a
  confident reading of a world nobody chose.
*/
const url = resolveDatabaseUrl();
if (!url) throw new Error("no database url — pass one, or run under the service that injects it");
const bucket = process.env.R2_BUCKET ?? "";
const publicUrl = process.env.R2_PUBLIC_URL ?? "";
const rows_are_prod = url.includes(":23768");
const bytes_are_prod = bucket === "drape-production";
say(`world     rows   ${worldOf(url)}`);
say(`          bytes  ${bucket}  ${publicUrl}`);
if (rows_are_prod !== bytes_are_prod) {
  say();
  say("*** REFUSING TO READ — the rows and the bytes are in different worlds. ***");
  say(`    rows say ${rows_are_prod ? "PRODUCTION" : "dev"}, bytes say ${bytes_are_prod ? "PRODUCTION" : "dev"}.`);
  say("    DATABASE_URL, R2_BUCKET and R2_PUBLIC_URL move together or not at all.");
  process.exit(2);
}
say(`          → ${rows_are_prod ? "PRODUCTION" : "DEV"}, both halves agreeing`);
say(`question  ${JSON.stringify(eye.question)}   (from scanPlan(), not retyped)`);
say(`floor     ${FLOOR}   (detectionFloorFor(question, "side"))`);
say();

const db = await openDatabase(url);
const query = async (sql: string, params?: unknown[]) => {
  const [rows] = await db.query<any[]>(sql, params);
  return rows;
};
/* House money only: this reads frames, it never renders. */
const ledger = await openLedgerWatch({ query, userId: 1 });

type Row = { publicId: string; imageKey: string; rollId: number };

/*
  ARMS CHOSEN BY BRIEF, NOT BY ROLL ID — the ids differ between worlds, and a
  hardcoded number that happens to exist in the other world would silently read
  the wrong sheet. The GLASSES arm is every framed candidate whose roll asked
  for glasses; the CONTROL is every framed candidate whose roll did not mention
  them, capped so the two arms stay comparable in size.
*/
const GLASSES_WHERE = "(r.briefText LIKE '%glass%' OR r.briefText LIKE '%spectacle%')";
const arms: Array<{ name: string; brief: string; rows: Row[] }> = [];
for (const [name, where, cap] of [
  ["GLASSES", GLASSES_WHERE, 12],
  ["CONTROL", `NOT ${GLASSES_WHERE}`, 12],
] as const) {
  const rows = await query(
    `SELECT c.publicId, c.imageKey, c.rollId FROM casting_candidates c
     JOIN casting_rolls r ON r.id = c.rollId
     WHERE c.imageKey IS NOT NULL AND ${where}
     ORDER BY c.id DESC LIMIT ?`,
    [cap],
  ) as Row[];
  const brief = rows.length > 0
    ? ((await query("SELECT LEFT(briefText, 60) AS b FROM casting_rolls WHERE id = ?", [rows[0]!.rollId]))[0]?.b ?? "")
    : "(no framed candidate matched)";
  arms.push({ name, brief, rows });
}

type Cell = { both: number; leftOnly: number; rightOnly: number; neither: number; failed: number };
const tally: Record<string, Cell> = {};

for (const arm of arms) {
  say(`── ${arm.name}  n=${arm.rows.length} · e.g. "${arm.brief}"`);
  const cell: Cell = { both: 0, leftOnly: 0, rightOnly: 0, neither: 0, failed: 0 };
  tally[arm.name] = cell;
  for (const row of arm.rows) {
    try {
      const frame = await storageReadBytes(row.imageKey);
      const meta = await sharp(frame.bytes).metadata();
      if (!meta.width || !meta.height) throw new Error("frame has no readable size");
      /* One reader per frame — it verifies the frame's URL against these bytes
         once, and a shared reader would carry one frame's proof into another's. */
      const reader = createFalRegionReader({ apiKey: FAL_KEY });
      if (!reader.regionSides) throw new Error("this reader has no per-side call");
      const sides = await reader.regionSides({
        image: frame.bytes,
        name: eye.question,
        absentIsAnswer: true,
        imageUrl: storagePublicUrl(row.imageKey),
      });
      reads += 2;
      if (sides === null) {
        /* A capability answer, not a reading — the reader saying this name has
           no sides. Counted apart, never as a miss. */
        cell.failed += 1;
        say(`  ${row.publicId.slice(0, 8)}  CAPABILITY — the reader gave no sides`);
        continue;
      }
      const left = binaryCoverage(sides.left);
      const right = binaryCoverage(sides.right);
      const hasLeft = left > FLOOR;
      const hasRight = right > FLOOR;
      if (hasLeft && hasRight) cell.both += 1;
      else if (hasLeft) cell.leftOnly += 1;
      else if (hasRight) cell.rightOnly += 1;
      else cell.neither += 1;
      const verdict = hasLeft && hasRight ? "both"
        : hasLeft ? "LEFT ONLY" : hasRight ? "RIGHT ONLY" : "NEITHER";
      say(`  ${row.publicId.slice(0, 8)}  left ${(left * 100).toFixed(3)}%  right ${(right * 100).toFixed(3)}%  → ${verdict}`);
    } catch (error) {
      cell.failed += 1;
      say(`  ${row.publicId.slice(0, 8)}  FAILED — ${String(error).slice(0, 90)}`);
    }
  }
  say();
}

say("═══ THE RATE, every cell with its own n ═══");
say();
say("arm       n   both  left-only  right-only  neither   HALF-ANSWERED");
for (const arm of arms) {
  const c = tally[arm.name]!;
  const n = c.both + c.leftOnly + c.rightOnly + c.neither;
  const half = c.leftOnly + c.rightOnly;
  const pct = n > 0 ? `${((half / n) * 100).toFixed(1)}%` : "n/a";
  say(
    `${arm.name.padEnd(9)} ${String(n).padStart(2)}   ${String(c.both).padStart(4)}  `
    + `${String(c.leftOnly).padStart(9)}  ${String(c.rightOnly).padStart(10)}  `
    + `${String(c.neither).padStart(7)}   ${half}/${n} = ${pct}`
    + (c.failed > 0 ? `   (+${c.failed} not read)` : ""),
  );
}
say();
/*
  AN ARM WITH NO FIXTURE IS NOT A RATE OF ZERO (`null result needs a fixture`).

  The first run of this reading found roll 61 empty — every bespectacled sheet
  in dev has had its candidates swept — and printed `0/0 = n/a` in a table that
  otherwise looked complete. A reader skimming the row could take the whole
  reading as done. So the run declares itself INVALID rather than leaving that
  to be noticed, and names the arm that never happened.
*/
const starved = arms.filter((arm) => {
  const c = tally[arm.name]!;
  return c.both + c.leftOnly + c.rightOnly + c.neither === 0;
});
if (starved.length > 0) {
  say(`*** RUN INVALID — no fixture for: ${starved.map((a) => a.name).join(", ")} ***`);
  say("    An arm with n=0 could not have produced a non-null result, so it rules");
  say("    nothing. The arms that DID read are reported above and stand on their own n.");
  say();
}
say("HALF-ANSWERED is the number that matters: it is the case the scan records as");
say("a SUCCESS (either side lands → `filed`), never re-asks, and never counts as");
say("an empty. His specimen is in that column.");
say();
say(`house money: ${reads} segmenter reads × $${USD_PER_READ} = $${(reads * USD_PER_READ).toFixed(3)}`);
say((await ledger.close()).line);

await db.end();
process.exit(0);
