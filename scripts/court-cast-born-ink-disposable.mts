/**
 * DISPOSABLE — §10 item 2: CAN THE READERS SEE INK ON A MASTER, AND IS THERE
 * ANY INK ON A MASTER TO SEE? (opus-956 §7, ordered fable-1307 §A item 2.)
 *
 * Item 5 (cast-born ink discovery) proposes to mint a crop of the ink a cast
 * was ROLLED WITH. Two things have to be true for that to be worth building,
 * and neither has ever been read:
 *
 *   1  the segmenter finds ink on a master when there IS ink
 *   2  production masters actually carry ink
 *
 * # THE CONTROLS ARE PAIRED, AND THAT IS THE WHOLE DESIGN
 *
 * A clean null over plain masters is evidence of nothing
 * (`null-result-needs-a-fixture`): a reader that answers zero to everything
 * scores identically to an empty population. So the positive controls are
 * DELIVERED FRAMES — variants this product painted ink onto, from
 * `casting_ink_delivery_crops`, where the ink is known present because we put
 * it there and kept a crop of it.
 *
 * And their negatives are THE SAME PEOPLE: each of those variants descends from
 * a master, and that master is the same face and the same framing WITHOUT the
 * ink. Same subject, ink present vs absent, one variable. That pair is what
 * separates *the reader cannot see ink* from *there is no ink here*.
 *
 * # IT RUNS STRICTLY SEQUENTIALLY, AND THAT IS NOT TIDINESS
 *
 * The founder is signing a Cast while this runs. A Sign spends
 * `SIGN_VIEW_CONCURRENCY` from the same 20-request account ceiling this reader
 * spends `FAL_CONCURRENCY` from, and eight concurrent panel scans once returned
 * no rows at all on five of them with the provider answering
 * `429 concurrent_requests_limit`. One call at a time cannot take his money's
 * slot.
 *
 * Reads production frames from the PRODUCTION bucket — dev's `R2_PUBLIC_URL` is
 * a DIFFERENT bucket and would 404 or, worse, answer about other pixels. It
 * writes nothing to any database and spends house money only.
 */
import "dotenv/config";

import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";

import { openDatabase } from "./lib/dbConnection.mts";
import { createFalRegionReader } from "../server/castingV2/falRegionReader";
import { extentOf, INK_REGION } from "../server/castingV2/inkReferenceCrop";

const railway = (...args: string[]): string => {
  const result = spawnSync("railway.cmd", args, { encoding: "utf8", shell: true });
  if (result.status !== 0) throw new Error(`railway ${args[0]} failed`);
  return result.stdout ?? "";
};

const variable = (service: string, key: string): string | undefined =>
  railway("variables", "--service", service, "--kv").split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.startsWith(`${key}=`))
    ?.slice(key.length + 1);

const dbUrl = variable("MySQL", "MYSQL_PUBLIC_URL");
const bucket = variable("Drape", "R2_PUBLIC_URL");
const apiKey = process.env.FAL_KEY;

if (!dbUrl || !bucket || !apiKey) {
  console.log(`UNREAD — db ${Boolean(dbUrl)} bucket ${Boolean(bucket)} falKey ${Boolean(apiKey)}`);
  process.exit(1);
}
console.log(`[bucket] ${bucket}`);

/* THROUGH THE ONE DOOR — a raw `mysql.createConnection` parses every DATETIME
   as LOCAL time, ten hours early on this machine. */
const connection = await openDatabase(dbUrl);

type Cell = { id: string; arm: "positive" | "pairedNegative" | "master"; key: string; note: string };

const [deliveries] = await connection.execute(
  `SELECT crop.slot, v.id AS variantId, v.imageKey AS variantKey,
          cand.id AS candidateId, cand.imageKey AS masterKey
     FROM casting_ink_delivery_crops crop
     JOIN casting_candidate_variants v ON v.id = crop.variantId
     JOIN casting_candidates cand ON cand.id = crop.candidateId`,
) as unknown as [Array<Record<string, string | number>>];

const [masters] = await connection.execute(
  `SELECT id, imageKey FROM casting_candidates WHERE imageKey IS NOT NULL ORDER BY id`,
) as unknown as [Array<Record<string, string | number>>];
await connection.end();

const pairedMasterIds = new Set(deliveries.map((row) => String(row.candidateId)));

const cells: Cell[] = [
  ...deliveries.map((row): Cell => ({
    id: `v${row.variantId}/${row.slot}`,
    arm: "positive",
    key: String(row.variantKey),
    note: `we painted ${row.slot} onto this frame and kept a crop of it`,
  })),
  ...masters.map((row): Cell => ({
    id: `master/${row.id}`,
    arm: pairedMasterIds.has(String(row.id)) ? "pairedNegative" : "master",
    key: String(row.imageKey),
    note: pairedMasterIds.has(String(row.id))
      ? "the SAME person as a positive above, before the ink"
      : "a production master nobody has read for ink",
  })),
];

console.log(`\n${cells.length} cells — ${cells.filter((c) => c.arm === "positive").length} positive,`
  + ` ${cells.filter((c) => c.arm === "pairedNegative").length} paired negative,`
  + ` ${cells.filter((c) => c.arm === "master").length} unread masters.`
  + ` One fal call each, sequential.\n`);

const reader = createFalRegionReader({ apiKey });
const results: Array<Cell & { pixels: number; width: number; height: number; failed?: string }> = [];

for (const [index, cell] of cells.entries()) {
  let line = `${String(index + 1).padStart(3)}/${cells.length}  ${cell.id.padEnd(22)} ${cell.arm.padEnd(15)}`;
  try {
    const response = await fetch(`${bucket}/${cell.key}`);
    if (!response.ok) throw new Error(`fetch ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    const sharp = (await import("sharp")).default;
    const meta = await sharp(bytes).metadata();
    /*
      ABSENCE IS THE ANSWER HERE, AND SAYING SO IS THE WHOLE INSTRUMENT.

      Without this flag the reader THROWS when it finds nothing — correctly, for
      its usual caller: asked of a master about a region the record says is
      there, "nothing found" is a question the model could not answer, and
      composing on it would deliver "nothing changed" at full price.

      This caller is the opposite case. "No ink on this master" is precisely the
      finding being bought, so a throw would file the ANSWER as a FAILURE and
      the summary would print n=0 over an arm that answered every cell. That is
      the one-sentinel-two-meanings defect (`negative-arm-cannot-find-yes-defects`),
      and it cost this court one printing before it was caught.
    */
    const mask = await reader.region({ image: bytes, name: INK_REGION, absentIsAnswer: true });
    const { pixels } = extentOf(mask);
    results.push({ ...cell, pixels, width: meta.width ?? 0, height: meta.height ?? 0 });
    const share = ((pixels / ((meta.width ?? 1) * (meta.height ?? 1))) * 100).toFixed(2);
    line += ` ${String(pixels).padStart(8)} px  ${share.padStart(6)}%  @ ${meta.width}x${meta.height}`;
  } catch (error) {
    /* A GENUINE no-read — a 404, a network fault, a 429 — and it is kept
       DISTINCT from "the reader looked and found nothing", which now comes back
       as a zero-pixel mask above. A no-read is evidence, not absence. */
    results.push({ ...cell, pixels: -1, width: 0, height: 0, failed: String(error).slice(0, 70) });
    line += `  NO-READ — ${String(error).slice(0, 60)}`;
  }
  console.log(line);
}

/* THE READING, and every arm carries its own n. */
const arm = (name: Cell["arm"]) => results.filter((one) => one.arm === name && one.pixels >= 0);
const summarise = (name: Cell["arm"]) => {
  const rows = arm(name);
  const found = rows.filter((one) => one.pixels > 0);
  return `${name.padEnd(15)} n=${String(rows.length).padStart(3)}   found ink on ${found.length}`
    + `   pixels ${rows.length === 0 ? "-" : `${Math.min(...rows.map((r) => r.pixels))}..${Math.max(...rows.map((r) => r.pixels))}`}`;
};

console.log("\n──────── THE READING ────────");
console.log(summarise("positive"));
console.log(summarise("pairedNegative"));
console.log(summarise("master"));

const hits = arm("master").filter((one) => one.pixels > 0);
if (hits.length > 0) {
  await mkdir("output/cast-born-ink", { recursive: true });
  console.log(`\nMASTERS THE READER FOUND INK ON — saved for HIS EYES (law 9: the reader is a`);
  console.log(`pointer to look, never a fact to file):`);
  for (const hit of hits) {
    const response = await fetch(`${bucket}/${hit.key}`);
    const file = `output/cast-born-ink/${hit.id.replace("/", "-")}-${hit.pixels}px.png`;
    await writeFile(file, Buffer.from(await response.arrayBuffer()));
    console.log(`  C:\Users\Admin\Drape\${file.replace(/\//g, "\\")}`);
  }
}

const unread = results.filter((one) => one.pixels < 0);
if (unread.length > 0) console.log(`\n⚠ ${unread.length} cells UNREAD — ${unread[0]!.failed}`);

/* A SCRIPT ENDS BY ENDING THE PROCESS. */
process.exit(0);
