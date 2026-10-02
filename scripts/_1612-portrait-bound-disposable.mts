/**
 * DISPOSABLE — #1612, THE `frontClose` BOUND COURT.
 *
 * The last precondition the hand-over is held on. `castViewPackage.ts`'s
 * `frontClose` band declares the debt and says what it waits for: *"the
 * delivered `frontClose` frames on production through the real segmenter, the
 * bound chosen in an empty band between the two populations, and his eye on the
 * two frames either side of it."*
 *
 * TWO POPULATIONS, both of them real production frames rather than fixtures:
 *
 *   IN BAND      the 11 `frontClose` rows — every one of them the 1K ANCHOR the
 *                product itself seals into the Portrait slot. They are what the
 *                slot delivers today, so they are the definition of the band.
 *   OUT OF BAND  the 22 `frontFull` / `backFull` rows — a whole-body frame in
 *                the Portrait slot is precisely the failure the debt names
 *                (`clearOf subject top` is satisfied by a full-length body with
 *                room over its hair, so today nothing would catch it).
 *   A READING    the 10 `closeUp` rows, reported and NOT a control: they are too
 *                TIGHT for a portrait and the existing top rule already refuses
 *                them. Printed so the court says what moves.
 *
 * Spends fal money (~1¢ a call), no customer credits, no writes anywhere.
 *   npx tsx scripts/_1612-portrait-bound-disposable.mts [--determinism]
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import path from "node:path";

import { createFalRegionReader } from "../server/castingV2/falRegionReader";
import { isPresent, reachesEdge, roomBelow } from "../server/castingV2/viewFramingGeometry";

const KEY = process.env.FAL_KEY;
if (!KEY) throw new Error("no FAL_KEY in .env");

const DIR = path.resolve("output/_1612-frames");
type Row = { asset: number; cast: number; who: string; view: string };
const MANIFEST: Row[] = JSON.parse(readFileSync(path.join(DIR, "portrait-manifest.json"), "utf8"));

const POPULATION = (view: string): "portrait" | "fullLength" | "closeUp" =>
  view === "frontClose" ? "portrait" : view === "closeUp" ? "closeUp" : "fullLength";

const reader = createFalRegionReader({ apiKey: KEY });

type Reading = Row & {
  population: ReturnType<typeof POPULATION>;
  /** `roomBelowAtMost face` — how much picture hangs below the face, in face heights. */
  room: number | null;
  /** `clearOf subject top` — the rule the band already has. */
  clearOfTop: boolean | null;
  seconds: number;
};

/*
  A LANDMARK THAT CANNOT BE READ IS NOT A VERDICT, and this script has to be as
  tolerant as `measureViewFraming` is: the reader THROWS on an absent region
  when `absentIsAnswer` is false, and on a BACK view there is genuinely no face
  to find. The production measurement records `held: null` for exactly this and
  folds to `cannotMeasure`; anything less here would turn a back view into a
  crash instead of a reading.
*/
async function tolerant<T>(ask: Promise<T>): Promise<T | null> {
  try {
    return await ask;
  } catch {
    return null;
  }
}

async function read(row: Row): Promise<Reading> {
  const image = readFileSync(path.join(DIR, `${row.asset}.png`));
  const started = Date.now();
  const [face, subject] = await Promise.all([
    tolerant(reader.region({ image, name: "face", absentIsAnswer: false })),
    tolerant(reader.subject({ image })),
  ]);
  return {
    ...row,
    population: POPULATION(row.view),
    room: face && isPresent(face) ? roomBelow(face) : null,
    clearOfTop: subject && isPresent(subject) ? !reachesEdge(subject, "top") : null,
    seconds: Math.round((Date.now() - started) / 100) / 10,
  };
}

/** The account's ceiling is shared; the reader gates itself, and this keeps the queue short. */
async function inWaves<T, R>(items: T[], width: number, run: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let at = 0; at < items.length; at += width) {
    out.push(...(await Promise.all(items.slice(at, at + width).map(run))));
  }
  return out;
}

if (process.argv.includes("--determinism")) {
  /* A measurement, not a draw: the same frame read ten times must answer the
     same number, or the band is a coin wearing arithmetic. */
  const subject = MANIFEST.find((row) => row.view === "frontClose")!;
  console.log(`\nDETERMINISM — asset ${subject.asset} (${subject.who}, frontClose) read 10 times`);
  const seen = new Set<string>();
  for (let pass = 0; pass < 10; pass += 1) {
    const reading = await read(subject);
    const key = `${reading.room?.toFixed(4) ?? "null"}/${String(reading.clearOfTop)}`;
    seen.add(key);
    console.log(`  pass ${pass + 1}  room ${reading.room?.toFixed(4) ?? "null"}  clearOfTop ${String(reading.clearOfTop)}  ${reading.seconds}s`);
  }
  console.log(`\n  distinct answers: ${seen.size} ${seen.size === 1 ? "— IDENTICAL" : "*** NOT A MEASUREMENT ***"}`);
  process.exit(0);
}

const readings = await inWaves(MANIFEST, 4, read);

for (const population of ["portrait", "fullLength", "closeUp"] as const) {
  const group = readings.filter((reading) => reading.population === population)
    .sort((a, b) => (a.room ?? -1) - (b.room ?? -1));
  console.log(`\n${population.toUpperCase()}  (${group.length} frames, sorted by room below the face)`);
  for (const reading of group) {
    console.log(
      `  room ${String(reading.room === null ? "unread" : reading.room.toFixed(2)).padStart(6)}  `
      + `clearOfTop ${String(reading.clearOfTop).padEnd(5)}  asset ${String(reading.asset).padStart(4)}  `
      + `${reading.view.padEnd(11)} cast ${String(reading.cast).padStart(3)} ${reading.who}`,
    );
  }
}

const roomsOf = (keep: (reading: Reading) => boolean): number[] =>
  readings.filter((r) => keep(r) && r.room !== null).map((r) => r.room!).sort((a, b) => a - b);

const portrait = roomsOf((r) => r.population === "portrait");
/* `frontFull` only: a BACK view has no face, so the face rule has no answer
   there at all — reported below rather than folded into a range. */
const full = roomsOf((r) => r.view === "frontFull");
console.log("\nTHE GAP");
console.log(`  portrait   n=${portrait.length}  ${portrait.length ? `${portrait[0]!.toFixed(2)} … ${portrait.at(-1)!.toFixed(2)}` : "-"}`);
console.log(`  frontFull  n=${full.length}  ${full.length ? `${full[0]!.toFixed(2)} … ${full.at(-1)!.toFixed(2)}` : "-"}`);
if (portrait.length && full.length) {
  const top = portrait.at(-1)!;
  const bottom = full[0]!;
  console.log(
    top < bottom
      ? `  SEPARABLE — an empty band from ${top.toFixed(2)} to ${bottom.toFixed(2)} (a factor of ${(bottom / top).toFixed(2)})`
      : `  OVERLAPPING — the loosest portrait (${top.toFixed(2)}) is wider than the tightest full length (${bottom.toFixed(2)})`,
  );
}
const unread = readings.filter((reading) => reading.room === null || reading.clearOfTop === null);
console.log(`\n  frames with an unread landmark: ${unread.length}${unread.length ? ` — ${unread.map((r) => r.asset).join(", ")}` : ""}`);
console.log(`  calls: ${readings.length * 2} (a face and a subject per frame)`);

process.exit(0);
