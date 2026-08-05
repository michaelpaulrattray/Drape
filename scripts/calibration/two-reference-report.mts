/**
 * The two-reference trial's deliverable: a calibration table and a wall of
 * faces, side by side at every chain position.
 *
 * Reads what the trial wrote; renders nothing itself, so it can be re-run on a
 * partial result set while the trial is still going.
 *
 *   npx tsx scripts/calibration/two-reference-report.mts
 */
import sharp from "sharp";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const OUT = "output/two-reference-trial";
type Cell = {
  chain: number;
  position: number;
  instruction: string;
  facts: Array<{ facet: string; asked: string }>;
  a: { verified: number; total: number; sharpness: number; identity: boolean | null };
  b: { verified: number; total: number; sharpness: number; identity: boolean | null };
  aSteady?: { same: number; total: number };
  bSteady?: { same: number; total: number };
};

const cells: Cell[] = JSON.parse(readFileSync(`${OUT}/results.json`, "utf8"));
if (cells.length === 0) throw new Error("no results yet");

/* ---------------------------------------------------------------- the table */
const pct = (value: number) => `${Math.round(value * 100)}%`;
const rows: string[] = [
  "| chain | # | instruction | facts | (a) base-only | (a) steady | (b) two-reference | (b) steady |",
  "|---|---|---|---|---|---|---|---|",
];
for (const cell of cells) {
  const a = `${cell.a.verified}/${cell.a.total} · sharp ${pct(cell.a.sharpness)}`
    + (cell.a.identity === null ? "" : ` · same person ${cell.a.identity ? "yes" : "NO"}`);
  const b = `${cell.b.verified}/${cell.b.total} · sharp ${pct(cell.b.sharpness)}`
    + (cell.b.identity === null ? "" : ` · same person ${cell.b.identity ? "yes" : "NO"}`);
  const steady = (arm: "aSteady" | "bSteady") =>
    cell[arm] ? `${cell[arm]!.same}/${cell[arm]!.total}` : "—";
  rows.push(
    `| ${cell.chain} | ${cell.position} | ${cell.instruction} | ${cell.facts.length} | ${a} | `
    + `${steady("aSteady")} | ${b} | ${steady("bSteady")} |`,
  );
}

const sum = (list: number[]) => list.reduce((total, value) => total + value, 0);
const retention = (arm: "a" | "b") =>
  sum(cells.map((cell) => cell[arm].verified)) / Math.max(1, sum(cells.map((cell) => cell[arm].total)));
const meanSharp = (arm: "a" | "b") => sum(cells.map((cell) => cell[arm].sharpness)) / cells.length;
const deepSharp = (arm: "a" | "b") => {
  const deep = cells.filter((cell) => cell.position >= 5);
  return deep.length ? sum(deep.map((cell) => cell[arm].sharpness)) / deep.length : NaN;
};
const identityFails = (arm: "a" | "b") =>
  cells.filter((cell) => cell[arm].identity === false).length;

/* PROBE A — the removal that contradicts the state image. */
const probeA = cells.filter((cell) => cell.instruction.startsWith("remove"));
const probeALine = probeA.map((cell) =>
  `chain ${cell.chain}: (a) ${cell.a.verified}/${cell.a.total} · (b) ${cell.b.verified}/${cell.b.total}`);

/* THE COLUMN THE RULING RIDES ON. Presence cannot see "different earrings every
   render"; this can. */
const steadiness = (arm: "aSteady" | "bSteady") => {
  const scored = cells.filter((cell) => cell[arm]);
  const same = sum(scored.map((cell) => cell[arm]!.same));
  const total = sum(scored.map((cell) => cell[arm]!.total));
  return total > 0 ? same / total : NaN;
};

const summary = [
  "# Two-reference calibration trial",
  "",
  `${cells.length} chain positions measured, both arms, same facts and the same reader.`,
  "",
  "## Headline",
  "",
  "| | fact retention | **realization steady** | mean sharpness | sharpness at depth (5–6) | identity failures |",
  "|---|---|---|---|---|---|",
  `| (a) base-only | ${pct(retention("a"))} | **${pct(steadiness("aSteady"))}** | ${pct(meanSharp("a"))} | ${pct(deepSharp("a"))} | ${identityFails("a")} |`,
  `| (b) two-reference | ${pct(retention("b"))} | **${pct(steadiness("bSteady"))}** | ${pct(meanSharp("b"))} | ${pct(deepSharp("b"))} | ${identityFails("b")} |`,
  "",
  "**Realization steady** is the column the ruling rides on. Fact retention asks",
  "whether the earrings are *present*; steadiness asks whether they are the *same*",
  "earrings as the position before — same object, same shade — which is what",
  "\"different ones every render\" actually meant. Only facts that persisted",
  "unchanged are scored; a fact the instruction just rewrote is supposed to differ.",
  "",
  "Sharpness is a ratio to the original candidate at the same chain position, so",
  "**compounding shows up as a falling number with depth** — the failure that killed",
  "the old chain-anchored scheme and the thing arm (b) has to prove it does not",
  "reintroduce. The 0.75 line is the gauntlet's existing softening flag.",
  "",
  "## Probe A — a removal that contradicts the state image",
  "",
  "The state image handed to arm (b) is wearing the earrings the instruction removes.",
  "The instruction must win.",
  "",
  ...probeALine.map((line) => `- ${line}`),
  "",
  "## Probe B — identity under heavy styling",
  "",
  "From position 4 on, the state image carries a bob, seafoam eyes, hoops and a smile.",
  "Scored by asking the reader whether it is the same person, with styling excluded",
  "from the question.",
  "",
  `- (a) ${identityFails("a")} failures · (b) ${identityFails("b")} failures`,
  "",
  "## Every position",
  "",
  ...rows,
  "",
  "## Faces",
  "",
  "`chainN-P-a.png` is base-only, `chainN-P-b.png` is two-reference, `chainN-00-original.png`",
  "is the candidate they both edit. `chainN-sheet.png` puts the two arms side by side down",
  "the chain.",
].join("\n");

writeFileSync(`${OUT}/REPORT.md`, summary);
console.log(summary);

/* ------------------------------------------------------------ the face wall */
const W = 300;
for (const chain of [...new Set(cells.map((cell) => cell.chain))]) {
  const positions = cells.filter((cell) => cell.chain === chain).map((cell) => cell.position);
  const files = [
    `${OUT}/chain${chain}-00-original.png`,
    ...positions.flatMap((position) => [
      `${OUT}/chain${chain}-${position}-a.png`,
      `${OUT}/chain${chain}-${position}-b.png`,
    ]),
  ].filter((file) => existsSync(file));
  if (files.length < 2) continue;

  const tiles = await Promise.all(files.map((file) => sharp(file).resize(W).toBuffer()));
  const meta = await sharp(tiles[0]).metadata();
  const H = meta.height ?? W;
  /* Original on the left, then a column per position: (a) above, (b) below. */
  const columns = 1 + positions.length;
  const composite: sharp.OverlayOptions[] = [];
  composite.push({ input: tiles[0], left: 0, top: 0 });
  for (const [index] of positions.entries()) {
    const a = tiles[1 + index * 2];
    const b = tiles[2 + index * 2];
    if (a) composite.push({ input: a, left: W * (index + 1), top: 0 });
    if (b) composite.push({ input: b, left: W * (index + 1), top: H });
  }
  await sharp({
    create: {
      width: W * columns, height: H * 2, channels: 3,
      background: { r: 11, g: 11, b: 12 },
    },
  }).composite(composite).png().toFile(`${OUT}/chain${chain}-sheet.png`);
  console.log(`sheet: chain${chain}-sheet.png`);
}
