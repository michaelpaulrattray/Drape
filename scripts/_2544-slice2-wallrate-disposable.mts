/**
 * #2544 SLICE 2 — THE §6 WALL-RATE MEASUREMENT AND THE OUTFIT-ASK PASS RATE.
 *
 * The design (`docs/specs/OUTFIT_REFINE_DESIGN_2026-10-16.md` §6, clause 3):
 * *"Before the flag widens past `users:1`, the wall rate on UNRELATED asks is
 * measured on both prompts over the existing corpus fixtures, and the
 * before/after numbers go on the card. A raised wall rate on non-outfit asks is
 * a stop, not a footnote."* Plus the binding addition's outfit-ask pass-rate arm.
 *
 * # Why both arms run in ONE process, interleaved
 *
 * `refineService.ts:1861` is the ONE production reader of the flag
 * (`(dependencies.outfitEditEnabled ?? captureCastingOutfitEditEnabled)`), and
 * it is injectable. So the two arms differ by that single boolean and by
 * nothing else — same fixture, same cast, same flag profile, same process, same
 * minute. Two sequential blocks would let model drift over the run masquerade
 * as a flag effect; the rows are therefore driven OFF-then-ON back to back.
 *
 * # The instrument is controlled before its verdicts count (working law 2)
 *
 * - POSITIVE: the two wardrobe corpus rows must STOP walling on the ON arm. If
 *   they do not, the injection never reached the road and every "no change on
 *   unrelated asks" reading below is vacuous.
 * - NEGATIVE: the OFF arm is compared row by row against the COMMITTED atlas
 *   observations (the flag-off reading of record). Rows that disagree are named,
 *   because a bench that cannot reproduce the record cannot be read against it.
 * - SCENERY: `guard.stage` and the garment-with-backdrop ask must refuse on BOTH
 *   arms — the design's "one arm that matters most".
 * - LEDGER: `point_transactions` for the fixture, before and after. `admit` is
 *   `() => false`, so a single new row means this bench spent a credit.
 *
 * # Noise
 *
 * The interpreter is the unstable participant. A row whose two arms DISAGREE is
 * re-driven twice more PER ARM and the majority of three is the verdict, which
 * is the census's own discipline — so every difference reported here is a
 * majority verdict and not a coin flip.
 *
 * Spend: text calls only, cents, no credits. Under THE SPEND THRESHOLD.
 *
 *   npx tsx scripts/_2544-slice2-wallrate-disposable.mts
 */

import "dotenv/config";
import fs from "node:fs";
import { assertOneWorld } from "./lib/worldGuard.mts";
import { CORPUS, type CorpusRow } from "./capability-atlas-corpus.mts";
import { declaredFlags, driveRow, readCommittedAtlas } from "./lib/capabilityAtlas.mts";

assertOneWorld(["DATABASE_URL"]);

if (process.env.MYSQL_PUBLIC_URL || process.env.RAILWAY_ENVIRONMENT_NAME) {
  throw new Error("this bench drives DEV only — it writes a fixture account and free-refusal audit rows");
}

const { ensureOutsider } = await import("./lib/outsider.mts");
const { ensureCensusFixture } = await import("./lib/censusFixture.mts");
const { openDatabase } = await import("./lib/dbConnection.mts");

const account = await ensureOutsider();
const fixtureCast = (await ensureCensusFixture({ userId: account.id })).candidatePublicId;

/*
  THE CENSUS'S OWN PROFILE, byte for byte (`generate-capability-atlas.mts`),
  so the OFF arm is comparable to the committed table. The outfit flag is left
  at whatever the profile gives it and is then OVERRIDDEN per request by the
  injected port, which is the only thing that decides the road.
*/
const flags: Record<string, string> = {};
for (const flag of declaredFlags()) {
  /* ⚠ The reference library was named here too and is retired (#1577 slice D5). */
  if (flag === "CASTING_V2_SCOPE") flags[flag] = "all";
  else if (["CASTING_SCAN_TABLE_SCOPE", "CASTING_REFINE_DISPATCH_SCOPE"].includes(flag)) flags[flag] = "off";
  else flags[flag] = `users:${account.id}`;
}
for (const [key, value] of Object.entries(flags)) process.env[key] = value;

const { refineCandidate } = await import("../server/castingV2/refineService");
const { interpretRefinement } = await import("../server/castingV2/refineInterpreter");

/*
  THE OUTFIT ASKS. The corpus holds TWO wardrobe rows, which is too thin a
  denominator for a pass rate, so the court's four arms (§5) plus the headwear
  the design adds to the subject (§4) and one garment-with-scenery ask are
  driven beside them. They are NOT corpus rows and nothing here writes the
  committed atlas: adding rows to the census is slice 1's act, already done.
*/
const OUTFIT_ASKS: CorpusRow[] = [
  { id: "fit.change.coat", ask: "put him in a long black wool coat", subject: "wardrobe", verb: "change", state: "master",
    expect: "would-render", why: "the court's CHANGE arm" },
  { id: "fit.add.layer", ask: "add a denim jacket over what he is wearing", subject: "wardrobe", verb: "add", state: "master",
    expect: "would-render", why: "the court's ADD-A-LAYER arm" },
  { id: "fit.remove.layer", ask: "take the jacket off him", subject: "wardrobe", verb: "remove", state: "master",
    expect: "would-render", why: "the court's REMOVE-A-LAYER arm — #2599's known remainder lives here" },
  { id: "fit.colour.fabric", ask: "make his shirt dark green linen", subject: "wardrobe", verb: "change", state: "master",
    expect: "would-render", why: "the court's COLOUR-SPECIFIC-FABRIC arm" },
  { id: "fit.hat", ask: "give him a grey beanie", subject: "wardrobe", verb: "add", state: "master",
    expect: "would-render", why: "§4's headwear — hat joined the subject's nouns in slice 1" },
  { id: "fit.scarf", ask: "give her a red scarf", subject: "wardrobe", verb: "add", state: "master",
    expect: "would-render", why: "§4's headwear pair — scarf joined with hat" },
  { id: "fit.suit", ask: "put her in a tailored navy suit", subject: "wardrobe", verb: "change", state: "master",
    expect: "would-render", why: "a plain change on a second garment noun" },
  { id: "fit.scenery.guard", ask: "put him in a red jacket against a studio backdrop", subject: "guard", verb: "guard", state: "master",
    expect: "refused:wall_stage", why: "THE SCENERY ARM — a garment ask carrying a scenery word must still refuse, served or not" },
];

type Read = { observed: string; ms: number; said: string | null };

const driveOnce = async (row: CorpusRow, served: boolean): Promise<Read> => {
  const refine: typeof refineCandidate = (dependencies, request) =>
    refineCandidate({ ...dependencies, outfitEditEnabled: () => served }, request);
  const observation = await driveRow({
    row, userId: account.id, candidatePublicId: fixtureCast,
    refine, interpret: interpretRefinement,
  });
  return { observed: observation.observed, ms: observation.ms, said: observation.said };
};

const connection = await openDatabase(process.env.DATABASE_URL!);
const ledger = async (): Promise<number> => {
  const [rows] = await connection.query<Array<{ rowCount: number }>>(
    "SELECT COUNT(*) AS rowCount FROM point_transactions WHERE userId = ?", [account.id],
  );
  return Number(rows[0]!.rowCount);
};
const ledgerBefore = await ledger();

/*
  THE FIXTURE MUST BE ABLE TO CAST, AND ON THIS BENCH IT WAS NOT.

  The first run of this script returned `error:Your account is currently under
  review…` on 13 of 13 rows, BOTH ARMS — `spendGuards.ts:21` refuses on
  `users.frozenAt`, and the moderator dashboard's discrepancy scan freezes dev
  bots by itself (the same thing that froze the founder's own account on
  2026-08-25, #119). Every row would have read "same" and the measurement would
  have reported a flawless no-change result having never reached the
  interpreter once. So the precondition is CHECKED and SAID rather than
  assumed, and it is scoped to the one id this script resolved.
*/
const [frozenRows] = await connection.query<Array<{ frozenAt: Date | null }>>(
  "SELECT frozenAt FROM users WHERE id = ?", [account.id],
);
if (frozenRows[0]?.frozenAt) {
  await connection.execute("UPDATE users SET frozenAt = NULL WHERE id = ?", [account.id]);
  console.log(`[fixture] account ${account.id} was FROZEN (${frozenRows[0].frozenAt.toISOString()}) — cleared, dev only, scoped to that id`);
}

const committed = readCommittedAtlas();
const committedById = new Map(
  (committed?.driven?.observations ?? []).map((o) => [o.id, o.observed] as const),
);

/* Master rows only: the branch and reference states need fixtures this bench
   does not pin, and a half-pinned branch would be measured against the wrong
   face. Named rather than silently dropped. */
const ROWS: CorpusRow[] = [...CORPUS.filter((r) => r.state === "master"), ...OUTFIT_ASKS];
const skipped = CORPUS.filter((r) => r.state !== "master").map((r) => `${r.id} (${r.state})`);

type RowResult = {
  id: string; subject: string; ask: string;
  off: string; on: string; offMs: number; onMs: number;
  rounds: number; offReads: string[]; onReads: string[];
  committed: string | null;
};

const results: RowResult[] = [];
const started = Date.now();

for (const row of ROWS) {
  const offReads: string[] = [];
  const onReads: string[] = [];
  const first = { off: await driveOnce(row, false), on: await driveOnce(row, true) };
  offReads.push(first.off.observed);
  onReads.push(first.on.observed);
  let rounds = 1;
  /* A DISAGREEMENT IS RE-DRIVEN, the census's majority-of-three. */
  if (first.off.observed !== first.on.observed) {
    for (let n = 0; n < 2; n += 1) {
      offReads.push((await driveOnce(row, false)).observed);
      onReads.push((await driveOnce(row, true)).observed);
    }
    rounds = 3;
  }
  const majority = (reads: string[]): string => {
    const tally = new Map<string, number>();
    for (const read of reads) tally.set(read, (tally.get(read) ?? 0) + 1);
    const sorted = [...tally.entries()].sort((a, b) => b[1] - a[1]);
    return sorted[0]![1] >= 2 || reads.length === 1 ? sorted[0]![0] : `split:${reads.join("/")}`;
  };
  const result: RowResult = {
    id: row.id, subject: row.subject, ask: row.ask,
    off: majority(offReads), on: majority(onReads),
    offMs: first.off.ms, onMs: first.on.ms,
    rounds, offReads, onReads,
    committed: committedById.get(row.id) ?? null,
  };
  /*
    AN ERRORING BENCH IS NOT A CLEAN RESULT, AND IT LOOKS EXACTLY LIKE ONE.
    An `error:` observation on both arms reads as "same" and would be counted
    as a row that did not move. Stop on the FIRST one rather than spending ten
    minutes producing a table of them (run 1 produced 13).
  */
  if (result.off.startsWith("error:") || result.on.startsWith("error:")) {
    throw new Error(
      `the bench never reached the interpreter on ${result.id} — off=${result.off} on=${result.on}. `
      + "Fix the fixture before reading any number from this script.",
    );
  }
  results.push(result);
  const moved = result.off === result.on ? "  same" : "  MOVED";
  console.log(
    `${result.id.padEnd(28)} off=${result.off.padEnd(30)} on=${result.on.padEnd(30)}${moved}`
    + (rounds > 1 ? "  [3 reads/arm]" : ""),
  );
}

const ledgerAfter = await ledger();
await connection.end();

const isWall = (observed: string): boolean => observed.startsWith("refused:wall_");
const isWardrobe = (r: RowResult): boolean => r.subject === "wardrobe";
const unrelated = results.filter((r) => !isWardrobe(r) && r.id !== "fit.scenery.guard");
const wardrobe = results.filter(isWardrobe);
const scenery = results.filter((r) => r.id === "fit.scenery.guard" || r.id === "guard.stage");

const wallRate = (rows: RowResult[], arm: "off" | "on"): { walls: number; n: number; pct: string } => {
  const walls = rows.filter((r) => isWall(r[arm])).length;
  return { walls, n: rows.length, pct: rows.length ? ((walls / rows.length) * 100).toFixed(1) : "0.0" };
};

const movedUnrelated = unrelated.filter((r) => r.off !== r.on);
const reproduced = results.filter((r) => r.committed !== null);
const offVsCommitted = reproduced.filter((r) => r.off !== r.committed);

console.log("");
console.log("=".repeat(78));
console.log("#2544 SLICE 2 — THE §6 MEASUREMENT");
console.log("=".repeat(78));
console.log(`fixture        ${account.openId} / ${fixtureCast} (dev)`);
console.log(`rows driven    ${results.length} (${CORPUS.filter((r) => r.state === "master").length} corpus master + ${OUTFIT_ASKS.length} outfit asks), both arms`);
console.log(`not driven     ${skipped.length} corpus rows needing a branch/reference fixture: ${skipped.join(", ") || "(none)"}`);
console.log(`wall clock     ${Math.round((Date.now() - started) / 1000)}s`);
console.log("");
console.log("--- CONTROLS (these decide whether the numbers below mean anything) ---");
const positive = wardrobe.filter((r) => isWall(r.off) && !isWall(r.on));
console.log(`POSITIVE  the ON arm unwalls a wardrobe ask: ${positive.length}/${wardrobe.length} wardrobe rows walled OFF and not ON`);
for (const r of wardrobe) console.log(`            ${r.id.padEnd(24)} off=${r.off.padEnd(30)} on=${r.on}`);
console.log(`NEGATIVE  OFF arm reproduces the committed atlas: ${reproduced.length - offVsCommitted.length}/${reproduced.length} rows match`);
for (const r of offVsCommitted) console.log(`            DIFFERS ${r.id.padEnd(22)} committed=${r.committed} off=${r.off}`);
console.log("SCENERY   a scenery word still refuses on both arms:");
for (const r of scenery) console.log(`            ${r.id.padEnd(24)} off=${r.off.padEnd(30)} on=${r.on}`);
console.log(`LEDGER    point_transactions for the fixture: ${ledgerBefore} before, ${ledgerAfter} after ${ledgerBefore === ledgerAfter ? "(no credit spent)" : "*** A CREDIT WAS SPENT ***"}`);
console.log("");
console.log("--- 1 · THE WALL RATE ON UNRELATED ASKS (§6 clause 3) ---");
const offRate = wallRate(unrelated, "off");
const onRate = wallRate(unrelated, "on");
console.log(`flag OFF   ${offRate.walls}/${offRate.n} walled  (${offRate.pct}%)`);
console.log(`flag ON    ${onRate.walls}/${onRate.n} walled  (${onRate.pct}%)`);
console.log(`delta      ${onRate.walls - offRate.walls >= 0 ? "+" : ""}${onRate.walls - offRate.walls} rows`);
console.log(`VERDICT    ${onRate.walls > offRate.walls ? "*** RAISED — this is a STOP, not a footnote ***" : "not raised"}`);
console.log("");
console.log(`--- 2 · EVERY UNRELATED ROW WHOSE ROUTE MOVED (${movedUnrelated.length}) ---`);
if (!movedUnrelated.length) console.log("(none — every non-wardrobe ask took the same road on both arms)");
for (const r of movedUnrelated) {
  console.log(`  ${r.id.padEnd(26)} "${r.ask.slice(0, 44)}"`);
  console.log(`      off=${r.off}  on=${r.on}  [${r.rounds} read(s)/arm: off ${r.offReads.join(",")} | on ${r.onReads.join(",")}]`);
}
console.log("");
console.log("--- 3 · THE OUTFIT-ASK PASS RATE (the binding addition's arm) ---");
const outfit = results.filter((r) => r.id.startsWith("fit.") && r.id !== "fit.scenery.guard");
const passes = outfit.filter((r) => r.on === "would-render");
const walled = outfit.filter((r) => isWall(r.on));
console.log(`flag ON    ${passes.length}/${outfit.length} reach a render  (${((passes.length / outfit.length) * 100).toFixed(1)}%)`);
console.log(`           ${walled.length} walled, ${outfit.length - passes.length - walled.length} took another road`);
for (const r of outfit) console.log(`  ${r.on === "would-render" ? "PASS" : "    "} ${r.id.padEnd(22)} on=${r.on.padEnd(30)} (off=${r.off})`);
console.log(`flag OFF   ${outfit.filter((r) => r.off === "would-render").length}/${outfit.length} reach a render with the flag off`);
for (const r of outfit) console.log(`       ${r.id.padEnd(22)} off=${r.off}`);

const out = {
  card: 2544, slice: 2, measuredAt: new Date().toISOString(),
  fixture: `${account.openId} / ${fixtureCast}`,
  flags, ledger: { before: ledgerBefore, after: ledgerAfter },
  controls: {
    positive: { unwalled: positive.length, of: wardrobe.length },
    negative: { matched: reproduced.length - offVsCommitted.length, of: reproduced.length, differs: offVsCommitted.map((r) => ({ id: r.id, committed: r.committed, off: r.off })) },
    scenery: scenery.map((r) => ({ id: r.id, off: r.off, on: r.on })),
  },
  wallRateUnrelated: { off: offRate, on: onRate },
  movedUnrelated: movedUnrelated.map((r) => ({ id: r.id, ask: r.ask, off: r.off, on: r.on, offReads: r.offReads, onReads: r.onReads })),
  outfitPassRate: { on: passes.length, of: outfit.length, rows: outfit.map((r) => ({ id: r.id, ask: r.ask, off: r.off, on: r.on })) },
  notDriven: skipped,
  rows: results,
};
fs.mkdirSync("output/2544-slice2", { recursive: true });
const written = `output/2544-slice2/wallrate-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
fs.writeFileSync(written, JSON.stringify(out, null, 2));
console.log("");
console.log(`written  ${written}`);

process.exit(0);
