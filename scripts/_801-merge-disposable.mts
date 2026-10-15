/**
 * #801 — rebuild the court's manifest from the LOGS and the FRAMES.
 *
 * Why this exists, and it is an instrument finding rather than a convenience:
 * the control run and the incremental run were given the same manifest file
 * and each wrote its whole in-memory copy on every save, so the later writer
 * clobbered the earlier one's rows. The FRAMES are untouched — they are the
 * artifact — and both runs wrote a line per step to their own log, so nothing
 * is lost, but the file that was supposed to be the record is not one.
 *
 * Reads: output/801/control.log, output/801/incremental.log, and the frames.
 * Writes: output/801/manifest.json.
 *
 *   npx tsx scripts/_801-merge-disposable.mts
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const OUT = "output/801";
const FRAMES = `${OUT}/frames`;

type Record_ = {
  fixture: string;
  cell: string;
  step: number;
  ask: string;
  file: string | null;
  ms: number;
  outcome: string;
  why?: string;
};

const records: Record_[] = [];
const seen = new Set<string>();
const add = (r: Record_) => {
  const key = `${r.fixture}/${r.cell}/${r.step}`;
  if (seen.has(key)) {
    const held = records.find((x) => `${x.fixture}/${x.cell}/${x.step}` === key)!;
    /*
      A FAILED step that later DELIVERED is a retry, not a second opinion: the
      first attempt produced no frame at all, so nothing is being overwritten
      and the chain below it never moved. `lizard C4` is the case — one
      `fetch failed` on the transport, re-run from C3's own frame.
      A step that delivered TWICE is the other thing entirely, and that arm is
      contaminated.
    */
    if (held.outcome !== "delivered" && r.outcome === "delivered") {
      held.outcome = r.outcome;
      held.file = r.file;
      held.ms = r.ms;
      held.why = `retried after: ${held.why ?? "a failure"}`;
      return;
    }
    held.why = `${held.why ?? ""} | RE-RUN: ${r.why ?? r.outcome}`;
    return;
  }
  seen.add(key);
  records.push(r);
};

const readLog = (name: string): string[] => (existsSync(`${OUT}/${name}`)
  ? readFileSync(`${OUT}/${name}`, "utf8").split(/\r?\n/)
  : []);

/*
  ⚠ `control.log`'s LIZARD SECTION IS THE VOID ARM AND IS DROPPED BY NAME.
  That run was killed at its background time limit mid-chain; the resumed
  process could not see the rows the other writer had clobbered out of the
  manifest and replayed step 1 onto a LIVE chain, so the variant rows read
  "deeper emerald … horns … deeper emerald …". An arm whose road is not the
  road it claims is VOID, not failed, so the creature was cast again on a
  sibling candidate and `control-lizard.log` is its record.
*/
const VOID_CONTROL = new Set(["lizard"]);

/* ── the control log: "  N. outcome   Ms  "ask"" then an indented reason ──── */
const control = [...readLog("control.log"), ...readLog("control-lizard.log")];
const fromRerun = readLog("control.log").length;
let fixture = "";
for (const [index, line] of control.entries()) {
  const header = /^== A control · (\S+) ·/.exec(line);
  if (header) { fixture = header[1]; continue; }
  if (index < fromRerun && VOID_CONTROL.has(fixture)) continue;
  const step = /^ {2}(\d)\. (delivered|refused|failed)\s+(\d+)s {2}"(.*)"$/.exec(line);
  if (!step || !fixture) continue;
  const next = control[index + 1] ?? "";
  const why = next.startsWith("       ") ? next.trim() : undefined;
  const file = `${FRAMES}/${fixture}/A-${step[1]}.png`;
  add({
    fixture,
    cell: "A",
    step: Number(step[1]),
    ask: step[4],
    file: existsSync(file) ? file : null,
    ms: Number(step[3]) * 1000,
    outcome: step[2],
    why,
  });
}

/* ── the incremental log: "  fixture C3 outcome 52s" ─────────────────────── */
const incremental = [
  /* The first incremental pass ran the creature on cand 735, whose control arm
     is VOID — those frames live under `frames/lizard-void-735` and their rows
     are dropped here so the clean rerun is the only creature on the record. */
  ...readLog("incremental.log").filter((line) => !/^ {2}lizard /.test(line)),
  ...readLog("incremental-lizard.log"),
  ...readLog("incremental-lizard-c.log"),
  ...readLog("incremental-floor.log"),
];
for (const line of incremental) {
  const match = /^ {2}(\S+) ([BCDEFG])(\d) (delivered|refused|failed) (\d+)s(?: — (.*))?$/.exec(line);
  if (!match) continue;
  const file = `${FRAMES}/${match[1]}/${match[2]}-${match[3]}.png`;
  add({
    fixture: match[1],
    cell: match[2],
    step: Number(match[3]),
    ask: "",
    file: existsSync(file) ? file : null,
    ms: Number(match[5]) * 1000,
    outcome: match[4],
    why: match[6],
  });
}

/* The asks come from the court's own table, so a row cannot drift from it. */
const courtSource = readFileSync("scripts/_801-court-disposable.mts", "utf8");
const askTable = new Map<string, string[]>();
for (const block of courtSource.split("    id: \"").slice(1)) {
  const id = block.slice(0, block.indexOf("\""));
  const asks = [...block.matchAll(/\{ ask: "([^"]+)"/g)].map((m) => m[1]);
  if (asks.length) askTable.set(id, asks);
}
for (const record of records) {
  const asks = askTable.get(record.fixture);
  if (asks && asks[record.step - 1]) record.ask = asks[record.step - 1];
}

records.sort((a, b) => a.fixture.localeCompare(b.fixture)
  || a.cell.localeCompare(b.cell) || a.step - b.step);
writeFileSync(`${OUT}/manifest.json`, JSON.stringify({ records, notes: [] }, null, 1));

const byCell: Record<string, number> = {};
for (const r of records) byCell[r.cell] = (byCell[r.cell] ?? 0) + 1;
console.log(`${records.length} records rebuilt`, byCell);
const missingAsk = records.filter((r) => !r.ask);
if (missingAsk.length) console.log(`⚠ ${missingAsk.length} rows have no ask`);
const reruns = records.filter((r) => (r.why ?? "").includes("RE-RUN"));
if (reruns.length) {
  console.log(`⚠ ${reruns.length} steps were run more than once — those arms are CONTAMINATED:`);
  for (const r of reruns) console.log(`   ${r.fixture} ${r.cell}${r.step}`);
}
process.exit(0);
