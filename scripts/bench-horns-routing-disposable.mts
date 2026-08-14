/**
 * DOES "GIVE HER HORNS" ARRIVE AS HORNS — end to end, and free.
 *
 * # Why this bench exists
 *
 * Horns was promoted today off four courts, and every one of those courts
 * HANDED the engine a horns clause. The promotion added the half no court
 * touched: whether the interpreter — a model, handed a subject list that now
 * contains `horns` — actually files an ask about horns under it. A claim about
 * the pipeline made from a reading of one step is the mistake this program has
 * paid for twice, so this drives the REAL service and records what it asked and
 * what came back.
 *
 * # How it is free
 *
 * `admit: () => false` runs after every interpretation and BEFORE the claim and
 * the charge. Text calls only: no render, no credits, and the ledger is read at
 * both ends to prove it rather than to hope it.
 *
 * # THE BARS, WRITTEN BEFORE THE FIRST CALL
 *
 * ```
 * n = 3 per phrasing, dev database, the founder's own face.
 *
 * THE ASK      "give her curved ram horns" · "she should have small goat
 *              horns" · "add horns to her head"
 *              → a delta whose free lane names `horns`. Anything arriving as
 *                hairCut, statedAccessories or a refusal is the promotion not
 *                having reached the door people actually type at.
 * THE CONTROL  "colour her hair copper" → NO horns in the delta, 3/3.
 *              Mandatory: a bench with only the positive arm cannot tell
 *              "the interpreter routes horns" from "the interpreter says
 *              horns about everything now that the word exists".
 * ```
 *
 *   npx tsx scripts/bench-horns-routing-disposable.mts
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

import { openDatabase } from "./lib/dbConnection.mts";
import { assertOneWorld } from "./lib/worldGuard.mts";
import { refineCandidate } from "../server/castingV2/refineService";
import { interpretRefinement } from "../server/castingV2/refineInterpreter";
import { REPAINT_ONLY_SUBJECTS } from "../server/castingV2/refineSubjects";

const SAMPLES = Number(process.env.SAMPLES ?? 3);
const OUT = "output/horns-routing";
mkdirSync(OUT, { recursive: true });

const FACE = process.env.FACE ?? "43ac4560-c59c-46ea-95cb-0bcd814062d3";
const USER = Number(process.env.USER_ID ?? 1);

if (process.env.MYSQL_PUBLIC_URL) throw new Error("dev only");
assertOneWorld(["DATABASE_URL"]);
const where = new URL((process.env.DATABASE_URL ?? "").replace(/^mysql:/, "http:"));

const ASKS: { text: string; arm: "horns" | "control" }[] = [
  { text: "give her curved ram horns", arm: "horns" },
  { text: "she should have small goat horns", arm: "horns" },
  { text: "add horns to her head", arm: "horns" },
  { text: "colour her hair copper", arm: "control" },
  { text: "make her lips fuller", arm: "control" },
];

const lines: string[] = [];
const say = (line = "") => { console.log(line); lines.push(line); };

say(`WORLD: DATABASE_URL → ${where.hostname}:${where.port}`);
say(`HORNS ROUTING BENCH — n=${SAMPLES} per phrasing, real service, admit() = false.`);
say(`REPAINT_ONLY_SUBJECTS (derived, never typed here): ${REPAINT_ONLY_SUBJECTS.join(", ")}`);
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

/** Whether a delta names horns — read off the derived list, never typed here. */
const saysHorns = (delta: unknown): boolean => {
  const free = (delta as { free?: Record<string, unknown> } | null)?.free ?? {};
  return REPAINT_ONLY_SUBJECTS.some((subject) => {
    const value = free[subject];
    return typeof value === "string" ? value.trim() !== "" : Array.isArray(value) && value.length > 0;
  });
};

const results: any[] = [];
for (const ask of ASKS) {
  say("=".repeat(78));
  say(`[${ask.arm}] "${ask.text}"`);
  say("-".repeat(78));
  for (let n = 1; n <= SAMPLES; n += 1) {
    const calls: { ok: boolean; intent?: string; delta?: unknown; refusal?: unknown }[] = [];
    const interpret = (async (request: Parameters<typeof interpretRefinement>[0]) => {
      const answer = await interpretRefinement(request);
      calls.push({
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

    const reachedThePaint = threw.includes("Casting is busy right now");
    const first = calls[0] ?? null;
    const horns = calls.some((call) => saysHorns(call.delta));

    say(`  #${n}  ${reachedThePaint ? "REACHED THE PAINT" : "STOPPED"} · horns ${horns ? "YES" : "no"}`);
    say(`      delta      : ${first ? JSON.stringify(first.delta ?? null) : "(none)"}`);
    if (first && !first.ok) say(`      refusal    : ${JSON.stringify(first.refusal ?? null)}`);
    if (!reachedThePaint) say(`      it said    : ${threw}`);

    results.push({ ask: ask.text, arm: ask.arm, n, reachedThePaint, horns, calls, threw });
  }
  say("");
}

const ledgerAfter = (await query(
  "SELECT COUNT(*) AS rowCount, COALESCE(SUM(amount), 0) AS net FROM point_transactions WHERE userId = ?",
  [USER],
))[0];

const arm = (name: "horns" | "control") => results.filter((row) => row.arm === name);
const hit = (name: "horns" | "control") => arm(name).filter((row) => row.horns).length;

say("=".repeat(78));
say(`HORNS ARM     ${hit("horns")} of ${arm("horns").length} filed horns`);
say(`CONTROL ARM   ${hit("control")} of ${arm("control").length} filed horns (the bar is ZERO)`);
say(`LEDGER        rows ${ledgerBefore.rowCount} → ${ledgerAfter.rowCount} · net ${ledgerBefore.net} → ${ledgerAfter.net}`);
say("=".repeat(78));

writeFileSync(`${OUT}/report.txt`, `${lines.join("\n")}\n`, "utf8");
writeFileSync(`${OUT}/results.json`, `${JSON.stringify(results, null, 2)}\n`, "utf8");
await connection.end();
process.exit(0);
