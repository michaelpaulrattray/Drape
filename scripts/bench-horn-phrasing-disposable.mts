/**
 * "HORN" OR "HORNS", WHOLE FRAME OR HALF? — the read that decides how a pair is
 * asked about. (The per-side declaration landed and the scan came back
 * `horns:--`, which is a phrasing question or a half-frame question and those
 * are different findings.)
 *
 * The bilateral reader crops each half and asks the SINGULAR (`singularOf`), so
 * "horns" reaches the segmenter as "horn" — a word the detection court never
 * measured. It measured "horns", whole-frame, at 0.39–0.87%.
 *
 * Four cells, on a frame that plainly has a pair:
 *
 *   whole × "horns"   the court's own cell, the control
 *   whole × "horn"    does the singular answer at all?
 *   half  × "horns"   does a half-frame answer the plural?
 *   half  × "horn"    what the shipped path actually asks
 *
 * ~6 segmenter calls, about three cents. No generations.
 *
 *   npx tsx scripts/bench-horn-phrasing-disposable.mts
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import sharp from "sharp";
import { createFalRegionReader } from "../server/castingV2/falRegionReader";
import { binaryCoverage } from "../server/castingV2/maskGeometry";

const reader = createFalRegionReader({ apiKey: process.env.FAL_KEY! });
const file = "output/horns-court/words-2.png";
const whole = readFileSync(file);
const meta = await sharp(whole).metadata();
const halfWidth = Math.round(meta.width! / 2);
const left = await sharp(whole).extract({ left: 0, top: 0, width: halfWidth, height: meta.height! }).png().toBuffer();

const ask = async (bytes: Buffer, name: string, where: string) => {
  try {
    const mask = await reader.region({ image: bytes, name, absentIsAnswer: true }) as any;
    const coverage = binaryCoverage(mask) * 100;
    console.log(`${where.padEnd(6)} "${name}"`.padEnd(20) + ` ${coverage.toFixed(4)}%`);
  } catch (error) {
    console.log(`${where.padEnd(6)} "${name}"`.padEnd(20) + ` THREW ${(error as Error).message.slice(0, 60)}`);
  }
};

await ask(whole, "horns", "whole");
await ask(whole, "horn", "whole");
await ask(left, "horns", "half");
await ask(left, "horn", "half");
process.exit(0);
