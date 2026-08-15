/**
 * IS THE TAKE-SOMETHING-BACK PROMISE TRUE FOR A USER OFF THE REPAINT ROAD?
 * (Ordered in fable-558 §3 — a reading is not a measurement at this price.)
 *
 * The refine box says, to everybody, unconditionally:
 *
 *   "Or take something back — 'undo', 'remove the earrings' · free when you
 *    already have it"
 *
 * while `stepBackEnabled` is repaint-scoped. That is the shape that has burned
 * this program twice: **the gate's predicate is not the claim's predicate**
 * (fable-544 §1, and the chip gate before it). Reading the code says the
 * promise survives — the repaint gate refuses only `REPAINT_ONLY_SUBJECTS`, and
 * the free step-back is D-163, older than the repaint road. Reading is not
 * measuring.
 *
 * # The sequence, and why it costs ONE paid render rather than three
 *
 * ```
 * 1  "give her gold hoop earrings"     PAID   25 dev credits — this builds the
 *                                             chain the promise talks about
 * 2  "undo"                            FREE?  the promise's first example
 * 3  "give her gold hoop earrings"     PAID   predicted free (she already has
 *                                             that version) and measured PAID —
 *                                             which is the shipped design:
 *                                             "refining again buys a second
 *                                             version of it"
 * 4  "remove the earrings"             FREE?  the promise's second example
 * ```
 *
 * Everything after step 1 is a claim about money, so **money is where it is
 * measured**: the balance is read out of the ledger before and after every step
 * and the deltas are the verdict. The result's own words are recorded beside
 * them, because a free answer that moves her silently is its own defect
 * (the run-7 lesson).
 *
 * The account is the standing outsider on the dev server, which defines no
 * `CASTING_REPAINT_SCOPE` — so this IS the old road, for everybody on it.
 *
 * Dev credits only. No production row is touched.
 *
 *   npx tsx scripts/probe-takeback-promise-disposable.mts
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";

import { openDatabase } from "./lib/dbConnection.mts";
import { ensureOutsider } from "./lib/outsider.mts";

const outsider = await ensureOutsider();
if (!outsider.candidatePublicId) throw new Error("the outsider has no cast");

const conn = await openDatabase(process.env.DATABASE_URL);
const balance = async () => {
  const [rows] = await conn.execute(`SELECT balance FROM points WHERE userId = ?`, [outsider.id]);
  return (rows as Array<{ balance: number }>)[0]!.balance;
};

const { refineCandidate } = await import("../server/castingV2/refineService.js");

const steps = [
  { ask: "give her gold hoop earrings", expect: "paid" as const },
  { ask: "undo", expect: "free" as const },
  /*
    THIS EXPECTATION WAS WRONG WHEN THE PROBE RAN, AND THE PRODUCT WAS RIGHT.
    I predicted a free re-selection: she already HAS that version, so asking for
    it again ought to cost nothing. It rendered and charged 25 — and that is the
    shipped design, said in the refine box's own words: *"You already have this
    one running. Refining again buys a second version of it."* Wanting a second
    take of the same ask is a legitimate thing to buy. The promise under test
    says nothing about re-asking; it is about taking something BACK. Corrected
    here rather than in the verdict, and the mis-prediction cost 25 dev credits.
  */
  { ask: "give her gold hoop earrings", expect: "paid" as const },
  { ask: "remove the earrings", expect: "free" as const },
];

const rows: any[] = [];
let failed = 0;
console.log(`outsider ${outsider.id} · cast ${outsider.candidatePublicId} · repaint scope: ${process.env.CASTING_REPAINT_SCOPE ?? "(undefined — the old road)"}\n`);

for (const step of steps) {
  const before = await balance();
  const started = Date.now();
  let result: any;
  let error: string | null = null;
  try {
    result = await refineCandidate({}, {
      userId: outsider.id,
      clientRequestId: randomUUID(),
      candidatePublicId: outsider.candidatePublicId,
      instruction: step.ask,
    });
  } catch (thrown) {
    error = thrown instanceof Error ? thrown.message : String(thrown);
  }
  const after = await balance();
  const spent = before - after;
  const took = Math.round((Date.now() - started) / 1000);
  const ok = error === null && (step.expect === "paid" ? spent > 0 : spent === 0);
  if (!ok) failed += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  "${step.ask}" — expected ${step.expect}, spent ${spent} credit(s) in ${took}s`);
  console.log(`        ${error ? `THREW: ${error}` : `${result?.kind ?? "?"} · ${result?.note ?? result?.message ?? ""}`}`);
  rows.push({ ask: step.ask, expect: step.expect, before, after, spent, took, kind: result?.kind ?? null, note: result?.note ?? null, error });
}

console.log(`\n${steps.length - failed}/${steps.length}`);
console.log(failed === 0
  ? "the promise is true off the repaint road — the line is honest for everybody"
  : "the promise does NOT hold for this account — a filed finding, not a fix");
console.log(JSON.stringify(rows, null, 1));
await conn.end();
process.exit(failed === 0 ? 0 : 1);
