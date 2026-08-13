/**
 * WHERE A REMOVAL PHRASING ACTUALLY LANDS — end to end, and free.
 *
 * # Why this bench exists, and why my first reading was not one
 *
 * The free interpreter probe found `"remove her hair"` leaving
 * `interpretRefinement` as `intent=remove` (2/3) or `wall_content` (1/3), and I
 * reported that as "it never reaches the cut". **That was a claim about a
 * pipeline made from a reading of its first step.** `refineService` already
 * re-reads a removal whose subject cannot LEAVE as an ordinary edit, with the
 * removal vocabulary withheld — the founder's fringe is the argument written
 * into `DEPARTABLE_SUBJECTS` itself: *"anything else keeps the road below,
 * where a cut with no fringe is a haircut rather than a hole."*
 *
 * So the routing question can only be answered by the service, and it is
 * answered here before fable-441 §2's ruling is built on top of it.
 *
 * # How it is free
 *
 * `refineCandidate` takes an `admit` hook that runs AFTER every interpretation,
 * removal match and re-read, and BEFORE the claim and the charge. With
 * `admit: () => false` the whole routing decision happens and then the call
 * refuses with `TOO_MANY_REQUESTS`, having reserved nothing. An `interpret` spy
 * wraps the real interpreter, so what is recorded is what the service actually
 * asked and actually got — the wire, not a constant beside it.
 *
 * # THE BARS, WRITTEN BEFORE THE FIRST CALL (fable-441 §2)
 *
 * ```
 * n ≥ 3 per phrasing.
 *
 * THE ASK        "remove her hair" / "make her bald" / "shave her head"
 *                → the CUT: a delta naming hairStyle, or a refusal that is
 *                  honest about why. Anything that reaches the paint with a
 *                  hair-shaped hole in it is the failure this ruling exists
 *                  to prevent.
 * THE CONTROL    "remove her glasses" → the REMOVAL road, 3/3. Mandatory: a
 *                  routing change that also swallowed departable subjects
 *                  would be the misaimed-guard class again, where the positive
 *                  arm looked perfect and the negative arm was never run.
 * SECOND CONTROL "take her earrings off" → the removal road too, since it is
 *                  the phrasing the earring work has been living on.
 * ```
 *
 * FREE: text calls only. No renders, no credits, no writes — `admit` refuses
 * before the claim, and every run is asserted to have moved the ledger by zero.
 *
 *   npx tsx scripts/bench-removal-routing-disposable.mts
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

import { openDatabase } from "./lib/dbConnection.mts";
import { assertOneWorld } from "./lib/worldGuard.mts";
import { refineCandidate } from "../server/castingV2/refineService";
import { interpretRefinement } from "../server/castingV2/refineInterpreter";
import { DEPARTABLE_SUBJECTS } from "../server/castingV2/refineSubjects";

const SAMPLES = Number(process.env.SAMPLES ?? 3);
const OUT = "output/removal-routing";
mkdirSync(OUT, { recursive: true });

/* A face with hair, glasses and earrings on it, so every phrasing below has
   something real to be about. #352 wears all three. */
const FACE = process.env.FACE ?? "43ac4560-c59c-46ea-95cb-0bcd814062d3";
const USER = Number(process.env.USER_ID ?? 1);

if (process.env.MYSQL_PUBLIC_URL) throw new Error("dev only");
assertOneWorld(["DATABASE_URL"]);
const where = new URL((process.env.DATABASE_URL ?? "").replace(/^mysql:/, "http:"));

const ASKS: { text: string; arm: "cut" | "removal-control" }[] = [
  { text: "remove her hair", arm: "cut" },
  { text: "make her bald", arm: "cut" },
  { text: "shave her head", arm: "cut" },
  { text: "remove her glasses", arm: "removal-control" },
  { text: "take her earrings off", arm: "removal-control" },
];

const lines: string[] = [];
const say = (line = "") => { console.log(line); lines.push(line); };

say(`WORLD: DATABASE_URL → ${where.hostname}:${where.port}`);
say(`REMOVAL ROUTING BENCH — n=${SAMPLES} per phrasing, real service, admit() = false.`);
say(`DEPARTABLE_SUBJECTS (the discriminator, derived): ${DEPARTABLE_SUBJECTS.join(", ")}`);
say("");

const connection = await openDatabase(process.env.DATABASE_URL!);
const query = async (sql: string, params: unknown[] = []): Promise<any[]> => {
  const [rows] = await connection.query<any[]>(sql, params);
  return rows;
};

const ledgerBefore = (await query(
  "SELECT COUNT(*) AS rowCount, COALESCE(SUM(amount), 0) AS net FROM point_transactions WHERE userId = ?",
  [USER],
))[0];

const results: any[] = [];
for (const ask of ASKS) {
  say("=".repeat(78));
  say(`[${ask.arm}] "${ask.text}"`);
  say("-".repeat(78));
  for (let n = 1; n <= SAMPLES; n += 1) {
    /* THE SPY: the real interpreter, with every call and answer recorded. A
       second call carrying `mode: "edit"` IS the re-read — that is the branch
       the whole question turns on, and it is observed rather than assumed. */
    const calls: { mode: string; ok: boolean; intent?: string; delta?: unknown; refusal?: unknown }[] = [];
    const interpret = (async (request: Parameters<typeof interpretRefinement>[0]) => {
      const answer = await interpretRefinement(request);
      calls.push({
        mode: (request as { mode?: string }).mode ?? "(default)",
        ok: (answer as { ok: boolean }).ok,
        intent: (answer as { intent?: string }).intent,
        delta: (answer as { delta?: unknown }).delta,
        refusal: (answer as { refusal?: unknown }).refusal,
      });
      return answer;
    }) as typeof interpretRefinement;

    let threw: string | null = null;
    try {
      await refineCandidate({ interpret, admit: () => false }, {
        userId: USER,
        clientRequestId: randomUUID(),
        candidatePublicId: FACE,
        instruction: ask.text,
      });
      threw = "(no throw — it reached the claim, which admit was supposed to stop)";
    } catch (error) {
      threw = error instanceof Error ? error.message : String(error);
    }

    /* REACHED THE PAINT means: every routing decision was made and the only
       thing that stopped it was the admit gate this bench closed. */
    const reachedThePaint = threw.includes("Casting is busy right now");
    const reread = calls.find((call) => call.mode === "edit") ?? null;
    const first = calls[0] ?? null;

    say(`  #${n}  ${reachedThePaint ? "REACHED THE PAINT" : "STOPPED"}`);
    say(`      first read : ${first ? `${first.ok ? "ok" : "refused"}`
      + `${first.intent ? ` intent=${first.intent}` : ""}`
      + `${first.delta ? ` delta=${JSON.stringify(first.delta)}` : ""}`
      + `${first.refusal ? ` refusal=${JSON.stringify(first.refusal)}` : ""}` : "(none)"}`);
    say(`      re-read    : ${reread
      ? `${reread.ok ? "ok" : "refused"} delta=${JSON.stringify(reread.delta ?? null)}`
      : "none"}`);
    if (!reachedThePaint) say(`      it said    : ${threw}`);

    results.push({ ask: ask.text, arm: ask.arm, n, reachedThePaint, calls, threw });
  }
  say("");
}

/* THE LEDGER, BOTH ENDS — "free" is an assertion, not a hope. */
const ledgerAfter = (await query(
  "SELECT COUNT(*) AS rowCount, COALESCE(SUM(amount), 0) AS net FROM point_transactions WHERE userId = ?",
  [USER],
))[0];
say("=".repeat(78));
say(`LEDGER: ${ledgerBefore.rowCount} rows → ${ledgerAfter.rowCount} rows · net ${ledgerBefore.net} → ${ledgerAfter.net}`);
if (Number(ledgerBefore.rowCount) !== Number(ledgerAfter.rowCount)) {
  say("  *** THIS BENCH SPENT MONEY — that is a defect in the bench, report it ***");
}

/* ── the reading ────────────────────────────────────────────────────────── */

const hairish = (delta: unknown): boolean => JSON.stringify(delta ?? {}).includes("hairStyle");
const departed = (delta: unknown): boolean => JSON.stringify(delta ?? {}).includes("absent");

say("");
say("── WHAT EACH PHRASING DOES");
for (const ask of ASKS) {
  const mine = results.filter((result) => result.ask === ask.text);
  const toCut = mine.filter((result) => result.calls.some((call: any) => hairish(call.delta))).length;
  const toRemoval = mine.filter((result) => result.calls.some((call: any) => call.intent === "remove")).length;
  const departure = mine.filter((result) => result.calls.some((call: any) => departed(call.delta))).length;
  const paint = mine.filter((result) => result.reachedThePaint).length;
  say(`  [${ask.arm}] "${ask.text}"`.padEnd(46)
    + ` cut ${toCut}/${mine.length} · removal-intent ${toRemoval}/${mine.length}`
    + ` · departure-delta ${departure}/${mine.length} · reached paint ${paint}/${mine.length}`);
}

writeFileSync(`${OUT}/bench.txt`, lines.join("\n"), "utf8");
writeFileSync(`${OUT}/bench.json`, JSON.stringify(results, null, 2), "utf8");
say("");
say(`written to ${OUT}/`);

await connection.end();
process.exit(0);
