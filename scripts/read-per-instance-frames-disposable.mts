/**
 * THE BENCH'S FRAMES, READ STRICTLY — and the reason this is a second script.
 *
 * The first run of `bench-per-instance-vacancy-disposable.mts` exposed a fault
 * in its own judging, not in the phrase: one half-frame read came back as a
 * transport error ("The photo …" where JSON was expected), `verifyRender`
 * delivered a verdict with no checks, and `askedObjectOnEachEar` reports
 * `wearing = absent !== true` — so a reading that never happened counted as an
 * ear WEARING a hoop. On the ear the arm wants bare that is conservative; on
 * the ear it wants kept it is a **false pass**, which is the one outcome this
 * campaign does not allow (D-235).
 *
 * So every frame is re-read here, from disk, with three rules:
 *
 *   1. a half that does not READ is retried, up to three times;
 *   2. a half that still does not read is a SILENCE — never a pass, never a
 *      miss, and it voids its arm rather than scoring it;
 *   3. her left is HER left — image-right — mapped once, as in the bench.
 *
 * And the ear crops are written out at 4× so the verdicts are looked at rather
 * than believed. No credits: vision reads over frames already on disk.
 *
 *   npx tsx scripts/read-per-instance-frames-disposable.mts
 */
import "dotenv/config";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

import { askedObjectOnEachEar, type EarReading } from "./lib/askedObject.mts";

const OUT = "output/shift64-per-instance-vacancy";
const ASKED = "a small gold hoop earring";
const ATTEMPTS = 3;

/** The two controls are frames shift 63 already bought, in the same framing. */
const CONTROLS = [
  {
    label: "control-NEGATIVE-hoops-removed",
    file: "output/shift63-removal-synthesis/4c98c7fc-earring-01-removed.png",
    want: "neither ear wearing",
    ok: (ears: Ears) => !ears.left.wearing && !ears.right.wearing,
  },
  {
    label: "control-POSITIVE-the-specimen",
    file: "output/shift63-removal-synthesis/4c98c7fc-earring-00-specimen.png",
    want: "both ears wearing",
    ok: (ears: Ears) => ears.left.wearing && ears.right.wearing,
  },
];

const WANT: Record<string, { want: string; ok: (ears: Ears) => boolean }> = {
  "control-no-vacancy": { want: "both hoops stay on", ok: (e) => e.left.wearing && e.right.wearing },
  "plain-her-left": { want: "her LEFT bare, her right wearing", ok: (e) => !e.left.wearing && e.right.wearing },
  "sided-her-left": { want: "her LEFT bare, her right wearing", ok: (e) => !e.left.wearing && e.right.wearing },
  "plain-her-right": { want: "her RIGHT bare, her left wearing", ok: (e) => e.left.wearing && !e.right.wearing },
  "sided-her-right": { want: "her RIGHT bare, her left wearing", ok: (e) => e.left.wearing && !e.right.wearing },
  "plain-both-ears": { want: "both earlobes bare", ok: (e) => !e.left.wearing && !e.right.wearing },
  "sided-both-ears": { want: "both earlobes bare", ok: (e) => !e.left.wearing && !e.right.wearing },
};

type Ears = { left: EarReading & { attempts: number }; right: EarReading & { attempts: number } };

const readEars = async (bytes: Buffer): Promise<Ears> => {
  const width = (await sharp(bytes).metadata()).width ?? 1024;
  let last: EarReading[] = [];
  const attemptsBySide = new Map<string, number>();
  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    last = await askedObjectOnEachEar(bytes, ASKED, Math.round(width / 2));
    for (const reading of last) attemptsBySide.set(reading.side, attempt);
    if (last.every((reading) => reading.read)) break;
  }
  /* Image order in, HER order out — `regionSides` in the product: left IS her
     left, which is the RIGHT half of a frame she is facing the camera in. */
  const atImageLeft = last.find((reading) => reading.side === "left")!;
  const atImageRight = last.find((reading) => reading.side === "right")!;
  return {
    left: { ...atImageRight, attempts: attemptsBySide.get("right") ?? ATTEMPTS },
    right: { ...atImageLeft, attempts: attemptsBySide.get("left") ?? ATTEMPTS },
  };
};

/** Her ears, cut out at 4× and laid side by side, so a verdict can be looked at. */
const earSheet = async (bytes: Buffer, into: string): Promise<void> => {
  const boxes = [
    { left: 610, top: 395, width: 160, height: 180 },   // image-right = HER LEFT
    { left: 305, top: 395, width: 160, height: 180 },   // image-left  = her right
  ];
  const cuts = await Promise.all(boxes.map(async (box) => (
    await sharp(bytes).extract(box).resize({ width: box.width * 4, kernel: "nearest" }).png().toBuffer()
  )));
  await sharp({ create: { width: 160 * 4 * 2, height: 180 * 4, channels: 3, background: "#111" } })
    .composite(cuts.map((cut, at) => ({ input: cut, left: at * 160 * 4, top: 0 })))
    .png()
    .toFile(into);
};

const bench = JSON.parse(await readFile(path.join(OUT, "bench.json"), "utf8"));
const rows: any[] = [];

const judge = async (label: string, file: string, want: string, ok: (ears: Ears) => boolean) => {
  const bytes = await readFile(file);
  const ears = await readEars(bytes);
  /* A half that would not read and a half whose lobe is behind her hair are the
     same thing here: a site nobody could see. Neither scores. */
  const silent = !ears.left.read || !ears.right.read || ears.left.occluded || ears.right.occluded;
  const passed = silent ? null : ok(ears);
  const sheet = path.join(OUT, `ears-${label}.png`);
  await earSheet(bytes, sheet);
  rows.push({ label, file, want, silent, passed, sheet,
    hers: {
      left: { wearing: ears.left.wearing, absent: ears.left.absent, read: ears.left.read, occluded: ears.left.occluded, attempts: ears.left.attempts, saw: ears.left.saw },
      right: { wearing: ears.right.wearing, absent: ears.right.absent, read: ears.right.read, occluded: ears.right.occluded, attempts: ears.right.attempts, saw: ears.right.saw },
    } });
  const verdict = silent ? "SILENT (a site nobody could see — voided)" : passed ? "AS WANTED" : "NOT WHAT WAS WANTED";
  const show = (reading: EarReading & { attempts: number }) =>
    `${reading.occluded ? "hidden " : reading.wearing ? "WEARING" : "bare   "} (read ${reading.read}, occluded ${reading.occluded}, try ${reading.attempts})`;
  console.log(`\n${label}  — want ${want}`);
  console.log(`  her left  ${show(ears.left)}  "${ears.left.saw}"`);
  console.log(`  her right ${show(ears.right)}  "${ears.right.saw}"`);
  console.log(`  → ${verdict}   → ${sheet}`);
};

for (const control of CONTROLS) await judge(control.label, control.file, control.want, control.ok);
for (const result of bench.results) {
  const want = WANT[result.arm];
  if (!want) throw new Error(`no wanted outcome written for arm ${result.arm}`);
  await judge(result.arm, result.file, want.want, want.ok);
}

const of = (label: string) => rows.find((row) => row.label === label);
const negative = of("control-NEGATIVE-hoops-removed");
const positive = of("control-POSITIVE-the-specimen");
const control = of("control-no-vacancy");

console.log(`\n${"=".repeat(96)}`);
if (negative?.passed !== true || positive?.passed !== true) {
  console.log("THE INSTRUMENT IS NOT PROVEN ON THIS FACE — the reader must call the removed frame bare and the\n"
    + "specimen worn before any arm's asymmetry means anything. Nothing below counts.");
} else if (control?.passed !== true) {
  console.log("THE BENCH IS VOID — with no vacancy at all the hoops did not survive the later ask, so an ear\n"
    + "that comes back bare says nothing about the phrase.");
} else {
  for (const wording of ["plain", "sided"]) {
    const arms = ["her-left", "her-right"].map((side) => of(`${wording}-${side}`));
    const won = arms.filter((row) => row?.passed === true).length;
    const silent = arms.filter((row) => row?.silent).length;
    console.log(`${wording.toUpperCase().padEnd(6)} ${won}/${arms.length} asymmetric arms said "this ear" and not "her ears"`
      + `${silent > 0 ? `  (${silent} voided by silence)` : ""}`
      + `   [${arms.map((row) => `${row?.label}: ${row?.silent ? "silent" : row?.passed ? "ok" : "no"}`).join(" · ")}]`);
  }
  for (const wording of ["plain", "sided"]) {
    const both = of(`${wording}-both-ears`);
    console.log(`${wording}-both-ears`.padEnd(17) + `the shipping case: ${both?.silent ? "SILENT" : both?.passed ? "both earlobes bare" : "NOT both bare"} (reported apart)`);
  }
}
console.log("=".repeat(96));
await writeFile(path.join(OUT, "verdict.json"), JSON.stringify(rows, null, 2));
process.exit(0);
