/**
 * DID THE NO-OP DOOR REFUSE A REAL COLOUR CHANGE — and why (fable-460).
 *
 * # The founder's specimen, and what the record says
 *
 * He typed *"her eyes meadow green"* and got back, on production:
 *
 *   "She already has left eye icey blue — this would have changed nothing,
 *    so nothing was charged."
 *
 * The production rows say where that phrase came from: v#185 *"her left eye —
 * icey blue"* filed `free.eyeColourFree = "left eye icey blue"`, and v#186
 * carried it forward. So the prior handed to the parse held that exact string,
 * and the refusal quoted it back.
 *
 * `saysNothingNew` can only fire when EVERY item the parse filed is an echo of
 * the prior — a single new item returns `absorbed: false` at once. So the
 * refusal means the interpretation contained the restatement and NOT the ask:
 * the door caught the model losing her, which is precisely what it was built
 * for. What the door then SAID was wrong, and the edit was lost.
 *
 * This bench measures how often that happens, on the state that produced it,
 * before anything is changed. A fix aimed at a failure nobody has counted is
 * aimed at an anecdote.
 *
 * # The bars, written before the first call
 *
 * ```
 * n = 3 per arm (SAMPLES to raise it).
 *
 * ASK        "her eyes meadow green" over a prior of "left eye icey blue"
 *            → the delta must name meadow green. Every reading that comes
 *              back holding ONLY the prior is the defect, counted.
 * CONTROL    "her left eye icey blue" — the same words as the prior, over
 *            the same prior → the door must still refuse, free. Without this
 *            arm a fix that simply deletes the door would pass the first one.
 * ```
 *
 * Free: `admit: () => false` stops the call before the claim and the charge,
 * so this is text calls only. The ledger is read at both ends to prove it.
 *
 *   npx tsx scripts/bench-noop-door-disposable.mts            (bench)
 *   npx tsx scripts/bench-noop-door-disposable.mts --clear    (put the fixture back)
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

import { openDatabase } from "./lib/dbConnection.mts";
import { assertOneWorld } from "./lib/worldGuard.mts";
import { refineCandidate } from "../server/castingV2/refineService";
import { interpretRefinement } from "../server/castingV2/refineInterpreter";

const SAMPLES = Number(process.env.SAMPLES ?? 3);
const OUT = "output/noop-door";
mkdirSync(OUT, { recursive: true });

/* The diverged-eyes dev fixture — his own cast's shape, in words. */
const FACE = process.env.FACE ?? "d508cd29-9ba7-455f-89a3-40d77ec1ab97";
const USER = Number(process.env.USER_ID ?? 1);
const clear = process.argv.includes("--clear");
/** The prior the founder's refusal quoted, verbatim from production v#185. */
const PRIOR = "left eye icey blue";
const MARK = "noop-door-fixture";

if (process.env.MYSQL_PUBLIC_URL) throw new Error("dev only — this WRITES a fixture");
assertOneWorld(["DATABASE_URL"]);
const where = new URL((process.env.DATABASE_URL ?? "").replace(/^mysql:/, "http:"));

const lines: string[] = [];
const say = (line = "") => { console.log(line); lines.push(line); };

const connection = await openDatabase(process.env.DATABASE_URL!);
const query = async (sql: string, params: unknown[] = []): Promise<any[]> => {
  const [rows] = await connection.query<any[]>(sql, params);
  return rows;
};

say(`WORLD: DATABASE_URL → ${where.hostname}:${where.port}`);

/* ── the fixture: his state, rebuilt where it can be driven ──────────────── */
const [candidate] = await query(
  "SELECT id, sessionId, userId, imageKey, selectedVariantId FROM casting_candidates WHERE publicId = ?",
  [FACE]);
if (!candidate) throw new Error("the fixture candidate is not in this world");
if (candidate.userId !== USER) throw new Error("that face belongs to someone else — refusing");

const [existing] = await query(
  "SELECT id, publicId FROM casting_candidate_variants WHERE candidateId = ? AND requestText LIKE ?",
  [candidate.id, `%${MARK}%`]);

/** The variant the candidate pointed at before this bench touched it. */
const [saved] = await query(
  "SELECT id FROM casting_candidate_variants WHERE candidateId = ? AND status = 'ready' AND (requestText IS NULL OR requestText NOT LIKE ?) ORDER BY id LIMIT 1",
  [candidate.id, `%${MARK}%`]);

if (existing) {
  await query("UPDATE casting_candidates SET selectedVariantId = ? WHERE id = ?", [saved?.id ?? null, candidate.id]);
  await query("DELETE FROM casting_candidate_variants WHERE id = ?", [existing.id]);
  say(`fixture removed (candidate points back at variant ${saved?.id ?? "null"})`);
}
if (clear) {
  await connection.end();
  process.exit(0);
}

const fixturePublicId = randomUUID();
await query(
  `INSERT INTO casting_candidate_variants
     (publicId, candidateId, sessionId, userId, status, instructions, requestText,
      deltas, imageKey, operationId, pointsCost, createdAt)
   VALUES (?, ?, ?, ?, 'ready', ?, ?, ?, ?, ?, 0, NOW())`,
  [fixturePublicId, candidate.id, candidate.sessionId, USER,
    JSON.stringify([`her left eye — icey blue (${MARK})`]),
    `her left eye — icey blue (${MARK})`,
    JSON.stringify({ free: { eyeColourFree: PRIOR } }),
    candidate.imageKey, randomUUID()]);
const [fixture] = await query("SELECT id FROM casting_candidate_variants WHERE publicId = ?", [fixturePublicId]);
await query("UPDATE casting_candidates SET selectedVariantId = ? WHERE id = ?", [fixture.id, candidate.id]);
say(`fixture variant ${fixture.id} selected — prior free.eyeColourFree = ${JSON.stringify(PRIOR)}`);
say("");

const ledgerBefore = (await query(
  "SELECT COUNT(*) AS rowCount, COALESCE(SUM(amount), 0) AS net FROM point_transactions WHERE userId = ?",
  [USER]))[0];

const ASKS: { text: string; arm: "ask" | "control" }[] = [
  { text: "her eyes meadow green", arm: "ask" },
  { text: `her left eye ${PRIOR.replace("left eye ", "")}`, arm: "control" },
];

const results: any[] = [];
for (const ask of ASKS) {
  say("=".repeat(78));
  say(`[${ask.arm}] "${ask.text}"`);
  say("-".repeat(78));
  for (let n = 1; n <= SAMPLES; n += 1) {
    const calls: { ok: boolean; delta?: unknown; refusal?: unknown }[] = [];
    const interpret = (async (request: Parameters<typeof interpretRefinement>[0]) => {
      const answer = await interpretRefinement(request);
      calls.push({
        ok: (answer as { ok: boolean }).ok,
        delta: (answer as { delta?: unknown }).delta,
        refusal: (answer as { refusal?: unknown }).refusal,
      });
      return answer;
    }) as typeof interpretRefinement;

    let threw = "";
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
    const absorbed = threw.includes("already has");
    const first = calls[0] ?? null;
    const said = JSON.stringify(first?.delta ?? null);
    /* Did the ask's own colour survive the reading at all? */
    const keptTheAsk = ask.arm === "ask" ? said.toLowerCase().includes("meadow") : true;

    say(`  #${n}  ${reachedThePaint ? "REACHED THE PAINT" : absorbed ? "ABSORBED (refused)" : "STOPPED"}`
      + ` · the ask survived: ${keptTheAsk ? "YES" : "NO"}`);
    say(`      delta   : ${said}`);
    say(`      it said : ${threw}`);
    results.push({ ask: ask.text, arm: ask.arm, n, reachedThePaint, absorbed, keptTheAsk, calls, threw });
  }
  say("");
}

const ledgerAfter = (await query(
  "SELECT COUNT(*) AS rowCount, COALESCE(SUM(amount), 0) AS net FROM point_transactions WHERE userId = ?",
  [USER]))[0];
say("=".repeat(78));
say(`LEDGER: ${ledgerBefore.rowCount} rows → ${ledgerAfter.rowCount} rows · net ${ledgerBefore.net} → ${ledgerAfter.net}`);
if (Number(ledgerBefore.rowCount) !== Number(ledgerAfter.rowCount)) {
  say("  *** THIS BENCH SPENT MONEY — that is a defect in the bench, report it ***");
}
say("");
for (const ask of ASKS) {
  const mine = results.filter((result) => result.ask === ask.text);
  say(`  [${ask.arm}] "${ask.text}"`.padEnd(44)
    + ` absorbed ${mine.filter((r) => r.absorbed).length}/${mine.length}`
    + ` · ask survived ${mine.filter((r) => r.keptTheAsk).length}/${mine.length}`
    + ` · reached paint ${mine.filter((r) => r.reachedThePaint).length}/${mine.length}`);
}

writeFileSync(`${OUT}/bench.txt`, lines.join("\n"), "utf8");
writeFileSync(`${OUT}/bench.json`, JSON.stringify(results, null, 2), "utf8");
say("");
say(`written to ${OUT}/ — run with --clear to put the fixture back`);

await connection.end();
process.exit(0);
