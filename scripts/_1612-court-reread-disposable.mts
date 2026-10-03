/**
 * DISPOSABLE — re-read #1612 part 3's court frames for the CONTINUOUS quantity
 * its first pass lost.
 *
 * ⚠ **THE COURT'S `roomBelow` COLUMN PRINTED `—` ON ALL TWENTY ROWS, AND THE
 * BUG WAS MINE RATHER THAN THE MEASUREMENT'S.** It read
 * `(reading as { value?: number }).value`, and `FramingRuleReading` has no
 * `value` field — the quantity lives inside `note`, as prose. So the court
 * recorded twenty nulls and would have read, to anyone skimming it, as *"the
 * measurement could not answer"* rather than *"my reader asked for the wrong
 * field"*. Those are opposite facts and only one is about the pictures.
 *
 * The in-band verdicts in that run are unaffected — they came from
 * `measureViewFraming` itself, not from this column.
 *
 * # Why the quantity matters more than the verdict here
 *
 * The verdict is a threshold at 0.3 of a face-height. Over five renders an arm
 * can move a long way and cross nothing, or cross once on noise. The numbers
 * below say which: if the template pulls the median crop from 0.5 toward 0.3 it
 * is doing its job and the bound is simply tight, and if it does not move the
 * median at all it is not being read by the engine.
 *
 * Re-measures the saved frames — no renders, no customer credits, no writes to
 * anything but `output/`. ~20 segmenter reads at ~1c.
 *
 *   npx tsx scripts/_1612-court-reread-disposable.mts
 */
import "dotenv/config";
import { readFileSync, writeFileSync } from "node:fs";

import { createFalRegionReader } from "../server/castingV2/falRegionReader";
import { roomBelow } from "../server/castingV2/viewFramingGeometry";

const FAL = process.env.FAL_KEY;
if (!FAL) throw new Error("no FAL_KEY in .env");

const DIR = "output/1612-part3/court";
const reader = createFalRegionReader({ apiKey: FAL });

const rows = (JSON.parse(readFileSync(`${DIR}/court-rows.json`, "utf8")) as {
  rows: Array<{ cast: number; arm: string; render: number; framing: string; identity: string; file: string }>;
}).rows;

const read: Array<{ cast: number; arm: string; render: number; framing: string; identity: string; roomBelow: number | null }> = [];

for (const row of rows) {
  const bytes = readFileSync(`${DIR}/${row.file}`);
  let value: number | null = null;
  try {
    const face = await reader.region({ image: bytes, name: "face", absentIsAnswer: false });
    value = roomBelow(face);
  } catch (error) {
    console.log(`  ${row.file}: the face could not be read — ${error instanceof Error ? error.message : String(error)}`);
  }
  read.push({ ...row, roomBelow: value });
  console.log(
    `${String(row.cast).padEnd(4)} ${row.arm.padEnd(15)} ${row.render}  framing=${row.framing.padEnd(11)}`
    + ` identity=${row.identity.padEnd(8)} roomBelow=${value === null ? "   —" : value.toFixed(3)}`,
  );
}

writeFileSync(`${DIR}/court-roombelow.json`, JSON.stringify(read, null, 1), "utf8");

console.log("\n=== the quantity, per arm (the bound is 0.3)");
console.log("cast  arm              n  in band  median  min    max");
for (const cast of [56, 63]) {
  for (const arm of ["A-no-template", "B-template"]) {
    const mine = read.filter((row) => row.cast === cast && row.arm === arm);
    const values = mine.map((row) => row.roomBelow).filter((v): v is number => v !== null).sort((a, b) => a - b);
    const inBand = mine.filter((row) => row.framing === "inBand").length;
    const median = values.length === 0 ? null : values[Math.floor(values.length / 2)]!;
    console.log(
      `${String(cast).padEnd(5)} ${arm.padEnd(16)} ${String(values.length).padEnd(2)} ${String(`${inBand}/${mine.length}`).padEnd(8)}`
      + ` ${median === null ? "  —  " : median.toFixed(3)}   ${values.length ? values[0]!.toFixed(3) : "  —  "}  ${values.length ? values.at(-1)!.toFixed(3) : "  —  "}`,
    );
  }
}

process.exit(0);
