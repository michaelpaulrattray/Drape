/**
 * #801 — the court's readings and its strips.
 *
 * Reads only what is on disk: the manifest the court runner wrote and the
 * frames beside it. No network, no database, no spend — so it can be re-run
 * over and over while the chains are still being painted.
 *
 *   npx tsx scripts/_801-report-disposable.mts
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { compare, type Reading } from "./_801-measure-disposable.mts";
import { buildContactSheet } from "./lib/benchKit.mts";

const OUT = "output/801";
const FRAMES = `${OUT}/frames`;
const MANIFEST = `${OUT}/manifest.json`;

type Record_ = {
  fixture: string;
  cell: string;
  step: number;
  ask: string;
  file: string | null;
  ms: number;
  outcome: string;
  why?: string;
  model?: string;
  prompt?: string;
};

const manifest: { records: Record_[]; notes: string[] } = JSON.parse(readFileSync(MANIFEST, "utf8"));

const CELL_LABEL: Record<string, string> = {
  A: "A · today (master anchor, full replay, crops)",
  B: "B · previous frame only, new ask",
  C: "C · previous + master, new ask",
  D: "D · previous + master, new ask + state note",
  E: "E · previous + master, whole list replayed",
  F: "F · the floor — identical to C",
  G: "G · the floor — identical to C",
};

const fixtures = [...new Set(manifest.records.map((r) => r.fixture))];
const cells = ["A", "B", "C", "D", "E", "F", "G"].filter((c) => manifest.records.some((r) => r.cell === c));

type Row = {
  fixture: string;
  cell: string;
  step: number;
  ask: string;
  outcome: string;
  seconds: number;
  vsMaster: Reading | null;
  vsPrevious: Reading | null;
};

const rows: Row[] = [];

for (const fixture of fixtures) {
  const masterPath = `${FRAMES}/${fixture}/master.png`;
  if (!existsSync(masterPath)) continue;
  const master = readFileSync(masterPath);
  for (const cell of cells) {
    const steps = manifest.records
      .filter((r) => r.fixture === fixture && r.cell === cell)
      .sort((a, b) => a.step - b.step);
    let previous: Buffer | null = null;
    for (const record of steps) {
      let vsMaster: Reading | null = null;
      let vsPrevious: Reading | null = null;
      if (record.file && existsSync(record.file)) {
        const bytes = readFileSync(record.file);
        vsMaster = await compare(master, bytes);
        if (previous) vsPrevious = await compare(previous, bytes);
        previous = bytes;
      }
      rows.push({
        fixture, cell, step: record.step, ask: record.ask, outcome: record.outcome,
        seconds: +(record.ms / 1000).toFixed(0), vsMaster, vsPrevious,
      });
    }
  }
}

writeFileSync(`${OUT}/readings.json`, JSON.stringify(rows, null, 1));

/* ── the table ────────────────────────────────────────────────────────────── */

const lines: string[] = [];
const say = (line = "") => { console.log(line); lines.push(line); };

say("# #801 — the refine engine court: readings");
say();
say("Every number is against the PRISTINE MASTER unless the column says otherwise.");
say("`dE` is CIEDE2000 inside the two silhouettes' intersection, `IoU` is how much");
say("of the subject the two frames even share, `sharp` is the subject's");
say("high-frequency energy as a percentage of the master's — the mush reading.");
say();

for (const fixture of fixtures) {
  say(`## ${fixture}`);
  say();
  say("| cell | step | ask | outcome | s | dE vs master | IoU | framing dx,dy | sharp % | dE vs prev |");
  say("|---|---|---|---|---|---|---|---|---|---|");
  for (const cell of cells) {
    for (const row of rows.filter((r) => r.fixture === fixture && r.cell === cell)) {
      const m = row.vsMaster;
      const p = row.vsPrevious;
      say(`| ${row.cell} | ${row.step} | ${row.ask} | ${row.outcome} | ${row.seconds} `
        + `| ${m?.dE ?? "—"} | ${m?.iou ?? "—"} `
        + `| ${m?.framing ? `${m.framing.dcx},${m.framing.dcy}` : "—"} `
        + `| ${m?.sharpPct ?? "—"} | ${p?.dE ?? "—"} |`);
    }
  }
  say();
}

say("## The chain, end to end");
say();
say("| fixture | cell | delivered | dE at step 6 | sharp at step 6 | IoU at step 6 |");
say("|---|---|---|---|---|---|");
for (const fixture of fixtures) {
  for (const cell of cells) {
    const mine = rows.filter((r) => r.fixture === fixture && r.cell === cell);
    const delivered = mine.filter((r) => r.outcome === "delivered").length;
    const last = mine.filter((r) => r.vsMaster).at(-1);
    say(`| ${fixture} | ${cell} | ${delivered}/${mine.length} | ${last?.vsMaster?.dE ?? "—"} `
      + `| ${last?.vsMaster?.sharpPct ?? "—"} | ${last?.vsMaster?.iou ?? "—"} |`);
  }
}
say();
say("Cells: " + cells.map((c) => CELL_LABEL[c]).join(" · "));

writeFileSync(`${OUT}/readings.md`, lines.join("\n"));

/* ── the strips, one per fixture: master then six steps, a row per cell ───── */

mkdirSync(`${OUT}/strips`, { recursive: true });
for (const fixture of fixtures) {
  const masterPath = `${FRAMES}/${fixture}/master.png`;
  if (!existsSync(masterPath)) continue;
  const sheet = await buildContactSheet({
    columns: ["master", "1", "2", "3", "4", "5", "6"],
    rows: cells.map((cell) => ({
      label: `${cell} — ${CELL_LABEL[cell]}`,
      cells: [
        { bytes: readFileSync(masterPath) },
        ...[1, 2, 3, 4, 5, 6].map((step) => {
          const record = manifest.records.find(
            (r) => r.fixture === fixture && r.cell === cell && r.step === step,
          );
          return {
            bytes: record?.file && existsSync(record.file) ? readFileSync(record.file) : null,
          };
        }),
      ],
    })),
    tile: { width: 300, height: 450 },
  });
  writeFileSync(`${OUT}/strips/${fixture}.png`, sheet.bytes);
  console.log(`strip ${fixture}: ${sheet.width}x${sheet.height}`
    + (sheet.missing.length ? ` · missing ${sheet.missing.length}` : ""));
}

process.exit(0);
