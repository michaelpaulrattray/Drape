/**
 * #2544 SLICE 2 — IS THE DROPPED SCENERY CLAUSE NEW, OR A CLASS THAT ALREADY
 * EXISTS FOR EVERY OTHER SUBJECT?
 *
 * The rate probe measured that a GARMENT ask carrying a scenery word renders on
 * the served arm 43 of 55 reads, filing the garment and dropping the scenery
 * with nothing said to the customer. Before that is written up as something the
 * outfit flag introduced, the obvious control has to run: **does the same thing
 * already happen today, with the flag off, for a subject that has always been
 * served?**
 *
 * *"make her hair copper red in a studio"* needs no flag. If that renders with
 * `studio` dropped, the class pre-dates #2544 entirely and the flag only adds
 * garments to a road already built this way — which is a completely different
 * card from a slice-1 regression.
 *
 * Both arms are driven for every ask, so the flag's own contribution is visible
 * rather than assumed. `admit: () => false` — no credit, text calls, cents.
 *
 *   npx tsx scripts/_2544-mixed-ask-class-disposable.mts
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

const READS = 3;

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

/* Subjects that are served to EVERY account today, each carrying a scenery
   word. No flag is involved in any of these. */
const ASKS: CorpusRow[] = [
  { id: "mix.hair.studio", ask: "make her hair copper red in a studio", subject: "hairColour", verb: "change", state: "master", expect: "?", why: "hairColour is served to everyone — scenery word `studio`" },
  { id: "mix.eyes.backdrop", ask: "make her eyes green against a white backdrop", subject: "eyeColour", verb: "change", state: "master", expect: "?", why: "eyeColour, `backdrop`" },
  { id: "mix.beard.set", ask: "give him a full beard on a film set", subject: "facialHair", verb: "add", state: "master", expect: "?", why: "facialHair, `set`" },
  { id: "mix.freckles.chair", ask: "give her freckles sitting on a wooden chair", subject: "marks", verb: "add", state: "master", expect: "?", why: "marks, `chair`" },
  { id: "mix.earrings.table", ask: "give her gold hoop earrings at a dinner table", subject: "statedAccessories", verb: "add", state: "master", expect: "?", why: "statedAccessories, `table`" },
  { id: "mix.tan.location", ask: "give her a deep tan on location in the snow", subject: "skinTone", verb: "change", state: "master", expect: "?", why: "skinTone, `location`" },
  { id: "mix.smile.holding", ask: "make him smile holding a coffee cup", subject: "expression", verb: "change", state: "master", expect: "?", why: "expression, `holding`" },
];

const SCENERY = ["backdrop", "background", "wall", "studio", "set", "scene", "location", "prop", "chair", "table", "holding"];

type Row = { id: string; ask: string; arm: "off" | "on"; reads: Array<{ observed: string; filed: string; scenery: string | null }> };
const rows: Row[] = [];

for (const ask of ASKS) {
  for (const served of [false, true]) {
    const reads: Row["reads"] = [];
    for (let n = 0; n < READS; n += 1) {
      const deltas: string[] = [];
      const interpret = (async (request: Parameters<typeof interpretRefinement>[0]) => {
        const answer = await interpretRefinement(request);
        if (answer.ok && "delta" in answer) deltas.push(JSON.stringify((answer as { delta: unknown }).delta));
        return answer;
      }) as typeof interpretRefinement;
      const refine: typeof refineCandidate = (dependencies, request) =>
        refineCandidate({ ...dependencies, outfitEditEnabled: () => served }, request);
      const observation = await driveRow({ row: ask, userId: account.id, candidatePublicId: fixtureCast, refine, interpret });
      const filed = deltas.join("  ->  ");
      const lowered = filed.toLowerCase();
      reads.push({ observed: observation.observed, filed: filed || "(nothing filed)", scenery: SCENERY.find((w) => new RegExp(`\\b${w}\\b`).test(lowered)) ?? null });
    }
    rows.push({ id: ask.id, ask: ask.ask, arm: served ? "on" : "off", reads });
  }
  const off = rows.find((r) => r.id === ask.id && r.arm === "off")!;
  const on = rows.find((r) => r.id === ask.id && r.arm === "on")!;
  console.log(
    `${ask.id.padEnd(22)} off ${off.reads.filter((r) => r.observed === "would-render").length}/${READS} render`
    + `   on ${on.reads.filter((r) => r.observed === "would-render").length}/${READS} render`
    + `   "${ask.ask.slice(0, 44)}"`,
  );
}

const ledgerAfter = await ledger();
await connection.end();

const offRows = rows.filter((r) => r.arm === "off");
const offRendered = offRows.reduce((n, r) => n + r.reads.filter((x) => x.observed === "would-render").length, 0);
const offTotal = offRows.length * READS;
const anyScenery = rows.filter((r) => r.reads.some((x) => x.scenery !== null));

console.log("");
console.log("=".repeat(78));
console.log("#2544 SLICE 2 — IS THE DROPPED CLAUSE A PRE-EXISTING CLASS?");
console.log("=".repeat(78));
console.log(`fixture  ${account.openId} / ${fixtureCast} (dev), ${READS} reads per ask per arm`);
console.log(`LEDGER   point_transactions ${ledgerBefore} before, ${ledgerAfter} after ${ledgerBefore === ledgerAfter ? "(no credit spent)" : "*** A CREDIT WAS SPENT ***"}`);
console.log("");
console.log("THE ANSWER — subjects served to every account today, with the outfit flag OFF:");
console.log(`  ${offRendered}/${offTotal} reads reach a render with the scenery clause in the sentence (${((offRendered / offTotal) * 100).toFixed(0)}%)`);
console.log(`  ${offRendered > 0 ? "So the class PRE-DATES #2544 — the flag adds garments to a road already built this way." : "So this is NEW with the outfit flag."}`);
console.log(`  scenery word reaching a filed delta, either arm: ${anyScenery.length === 0 ? "0 reads" : `*** ${anyScenery.length} ***`}`);
console.log("");
for (const ask of ASKS) {
  const off = rows.find((r) => r.id === ask.id && r.arm === "off")!;
  const on = rows.find((r) => r.id === ask.id && r.arm === "on")!;
  console.log(`${ask.id}  "${ask.ask}"`);
  console.log(`   OFF  ${off.reads.map((r) => r.observed).join(", ")}`);
  console.log(`        ${off.reads.map((r) => r.filed).join("\n        ").slice(0, 400)}`);
  console.log(`   ON   ${on.reads.map((r) => r.observed).join(", ")}`);
  console.log("");
}

fs.mkdirSync("output/2544-slice2", { recursive: true });
const written = `output/2544-slice2/mixed-ask-class-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
fs.writeFileSync(written, JSON.stringify({ card: 2544, measuredAt: new Date().toISOString(), readsPerArm: READS, fixture: `${account.openId} / ${fixtureCast}`, ledger: { before: ledgerBefore, after: ledgerAfter }, offRendered, offTotal, rows }, null, 2));
console.log(`written  ${written}`);

process.exit(0);
