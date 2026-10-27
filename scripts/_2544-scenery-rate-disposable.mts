/**
 * #2544 SLICE 2 — THE SCENERY ARM AS A RATE, BECAUSE ONE READ IS A COIN FLIP.
 *
 * Two runs of the same sentence disagreed. *"put him in a red jacket against a
 * studio backdrop"* on the served arm read `would-render` on 3 of 3 in
 * `_2544-slice2-wallrate-disposable.mts` and `refused:wall_stage` on 1 of 1 in
 * `_2544-scenery-arm-disposable.mts`. The interpreter is the unstable
 * participant (memory: a model's read is the unstable thing), so **neither
 * number is reportable** and the honest shape is N reads per ask.
 *
 * Two questions, and they are not the same question:
 *
 * 1. **THE SAFETY ONE — can a scenery word ever reach the filed delta?** That
 *    is what the design's §4 negative arm is actually about: *"the only thing
 *    standing between an outfit edit and a paid edit that repaints the room."*
 *    A refusal and a dropped clause BOTH answer no; only a delta carrying the
 *    scenery answers yes.
 * 2. **THE QUALITY ONE — how often is half the customer's sentence silently
 *    dropped?** With the flag off these asks refuse and the customer is TOLD
 *    the set cannot change. Served, some of them render the garment and say
 *    nothing about the backdrop they also asked for.
 *
 * `admit: () => false` — no credit, text calls only, cents.
 *
 *   npx tsx scripts/_2544-scenery-rate-disposable.mts
 */

import "dotenv/config";
import fs from "node:fs";
import { assertOneWorld } from "./lib/worldGuard.mts";
import { type CorpusRow } from "./capability-atlas-corpus.mts";
import { declaredFlags, driveRow } from "./lib/capabilityAtlas.mts";

assertOneWorld(["DATABASE_URL"]);

if (process.env.MYSQL_PUBLIC_URL || process.env.RAILWAY_ENVIRONMENT_NAME) {
  throw new Error("this probe drives DEV only");
}

const READS = 5;

const { ensureOutsider } = await import("./lib/outsider.mts");
const { ensureCensusFixture } = await import("./lib/censusFixture.mts");
const { openDatabase } = await import("./lib/dbConnection.mts");

const account = await ensureOutsider();
const fixtureCast = (await ensureCensusFixture({ userId: account.id })).candidatePublicId;

const flags: Record<string, string> = {};
for (const flag of declaredFlags()) {
  if (["CASTING_V2_SCOPE", "CASTING_REFERENCE_LIBRARY_SCOPE"].includes(flag)) flags[flag] = "all";
  else if (["CASTING_SCAN_TABLE_SCOPE", "CASTING_REFINE_DISPATCH_SCOPE"].includes(flag)) flags[flag] = "off";
  else flags[flag] = `users:${account.id}`;
}
for (const [key, value] of Object.entries(flags)) process.env[key] = value;

const { refineCandidate } = await import("../server/castingV2/refineService");
const { interpretRefinement } = await import("../server/castingV2/refineInterpreter");

const connection = await openDatabase(process.env.DATABASE_URL!);
const [frozenRows] = await connection.query<Array<{ frozenAt: Date | null }>>(
  "SELECT frozenAt FROM users WHERE id = ?", [account.id],
);
if (frozenRows[0]?.frozenAt) {
  await connection.execute("UPDATE users SET frozenAt = NULL WHERE id = ?", [account.id]);
  console.log(`[fixture] account ${account.id} was FROZEN — cleared, dev only, scoped to that id`);
}
const ledger = async (): Promise<number> => {
  const [rows] = await connection.query<Array<{ rowCount: number }>>(
    "SELECT COUNT(*) AS rowCount FROM point_transactions WHERE userId = ?", [account.id],
  );
  return Number(rows[0]!.rowCount);
};
const ledgerBefore = await ledger();

const ASKS: CorpusRow[] = [
  { id: "sc.backdrop", ask: "put him in a red jacket against a studio backdrop", subject: "guard", verb: "guard", state: "master", expect: "refused:wall_stage", why: "backdrop — the row the two runs disagreed on" },
  { id: "sc.background", ask: "give her a white coat and make the background black", subject: "guard", verb: "guard", state: "master", expect: "refused:wall_stage", why: "background, and it ASKS for the change explicitly" },
  { id: "sc.wall", ask: "put him in a denim jacket standing against a brick wall", subject: "guard", verb: "guard", state: "master", expect: "refused:wall_stage", why: "wall" },
  { id: "sc.studio", ask: "put her in a grey suit in a studio", subject: "guard", verb: "guard", state: "master", expect: "refused:wall_stage", why: "studio" },
  { id: "sc.set", ask: "put him in a leather jacket on a film set", subject: "guard", verb: "guard", state: "master", expect: "refused:wall_stage", why: "set" },
  { id: "sc.scene", ask: "put her in a red dress in a night scene", subject: "guard", verb: "guard", state: "master", expect: "refused:wall_stage", why: "scene" },
  { id: "sc.location", ask: "put him in a parka on location in the snow", subject: "guard", verb: "guard", state: "master", expect: "refused:wall_stage", why: "location" },
  { id: "sc.prop", ask: "put her in a trench coat holding a prop umbrella", subject: "guard", verb: "guard", state: "master", expect: "refused:wall_stage", why: "prop + holding" },
  { id: "sc.chair", ask: "put him in a blue shirt sitting on a wooden chair", subject: "guard", verb: "guard", state: "master", expect: "refused:wall_stage", why: "chair" },
  { id: "sc.table", ask: "put her in a black dress at a dinner table", subject: "guard", verb: "guard", state: "master", expect: "refused:wall_stage", why: "table" },
  { id: "sc.holding", ask: "put him in a wool coat holding a coffee cup", subject: "guard", verb: "guard", state: "master", expect: "refused:wall_stage", why: "holding" },
  { id: "ctl.scenery.only", ask: "make the background pure white", subject: "guard", verb: "guard", state: "master", expect: "refused:wall_stage", why: "CONTROL — pure scenery must refuse every read" },
  { id: "ctl.garment.only", ask: "put him in a long black wool coat", subject: "wardrobe", verb: "change", state: "master", expect: "would-render", why: "CONTROL — pure garment must render every read" },
];

/* The scenery lexicon, from `STAGE_WORDS` (`refineDelta.ts:1157`). A filed
   delta containing any of these is the failure the §4 arm is about. */
const SCENERY = ["backdrop", "background", "wall", "studio", "set", "scene", "location", "prop", "chair", "table", "holding"];

type Row = { id: string; ask: string; reads: Array<{ observed: string; filed: string; sceneryInDelta: string | null }> };
const rows: Row[] = [];

for (const ask of ASKS) {
  const reads: Row["reads"] = [];
  for (let n = 0; n < READS; n += 1) {
    const deltas: string[] = [];
    const interpret = (async (request: Parameters<typeof interpretRefinement>[0]) => {
      const answer = await interpretRefinement(request);
      if (answer.ok && "delta" in answer) deltas.push(JSON.stringify((answer as { delta: unknown }).delta));
      return answer;
    }) as typeof interpretRefinement;
    const refine: typeof refineCandidate = (dependencies, request) =>
      refineCandidate({ ...dependencies, outfitEditEnabled: () => true }, request);
    const observation = await driveRow({ row: ask, userId: account.id, candidatePublicId: fixtureCast, refine, interpret });
    const filed = deltas.join("  ->  ");
    const lowered = filed.toLowerCase();
    reads.push({
      observed: observation.observed,
      filed: filed || "(nothing filed)",
      sceneryInDelta: SCENERY.find((w) => new RegExp(`\\b${w}\\b`).test(lowered)) ?? null,
    });
  }
  rows.push({ id: ask.id, ask: ask.ask, reads });
  const renders = reads.filter((r) => r.observed === "would-render").length;
  const leaks = reads.filter((r) => r.sceneryInDelta !== null).length;
  console.log(`${ask.id.padEnd(18)} renders ${renders}/${READS}  scenery-in-delta ${leaks}/${READS}  "${ask.ask.slice(0, 48)}"`);
}

const ledgerAfter = await ledger();
await connection.end();

const leaked = rows.filter((r) => r.reads.some((x) => x.sceneryInDelta !== null));
const sceneryAsks = rows.filter((r) => r.id.startsWith("sc."));
const totalReads = sceneryAsks.length * READS;
const rendered = sceneryAsks.reduce((n, r) => n + r.reads.filter((x) => x.observed === "would-render").length, 0);

console.log("");
console.log("=".repeat(78));
console.log(`#2544 SLICE 2 — THE SCENERY ARM OVER ${READS} READS PER ASK`);
console.log("=".repeat(78));
console.log(`fixture  ${account.openId} / ${fixtureCast} (dev), served arm only`);
console.log(`LEDGER   point_transactions ${ledgerBefore} before, ${ledgerAfter} after ${ledgerBefore === ledgerAfter ? "(no credit spent)" : "*** A CREDIT WAS SPENT ***"}`);
console.log("");
console.log("CONTROLS");
for (const id of ["ctl.scenery.only", "ctl.garment.only"]) {
  const r = rows.find((x) => x.id === id)!;
  console.log(`  ${id.padEnd(18)} ${r.reads.map((x) => x.observed).join(", ")}`);
}
console.log("");
console.log("--- Q1 · THE SAFETY QUESTION: does a scenery word ever reach the filed delta? ---");
console.log(`  ${leaked.length === 0 ? "NO — 0 of " + totalReads + " served reads filed a scenery word" : "*** YES — " + leaked.length + " ask(s) filed one ***"}`);
for (const r of leaked) {
  for (const read of r.reads.filter((x) => x.sceneryInDelta !== null)) {
    console.log(`     ${r.id}  word="${read.sceneryInDelta}"  filed=${read.filed.slice(0, 220)}`);
  }
}
console.log("");
console.log("--- Q2 · THE QUALITY QUESTION: how often is the scenery clause silently dropped? ---");
console.log(`  ${rendered}/${totalReads} served reads of a garment-plus-scenery ask reach a render (${((rendered / totalReads) * 100).toFixed(0)}%)`);
console.log(`  the other ${totalReads - rendered} refuse and tell the customer the set cannot change`);
console.log("  per ask:");
for (const r of sceneryAsks) {
  const renders = r.reads.filter((x) => x.observed === "would-render").length;
  console.log(`    ${r.id.padEnd(18)} ${String(renders).padStart(2)}/${READS} render   ${[...new Set(r.reads.map((x) => x.observed))].join(" | ")}`);
}

fs.mkdirSync("output/2544-slice2", { recursive: true });
const written = `output/2544-slice2/scenery-rate-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
fs.writeFileSync(written, JSON.stringify({
  card: 2544, measuredAt: new Date().toISOString(), readsPerAsk: READS,
  fixture: `${account.openId} / ${fixtureCast}`, ledger: { before: ledgerBefore, after: ledgerAfter },
  sceneryInDeltaReads: leaked.length, renderedOf: { rendered, of: totalReads }, rows,
}, null, 2));
console.log("");
console.log(`written  ${written}`);

process.exit(0);
