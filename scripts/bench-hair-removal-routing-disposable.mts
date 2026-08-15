/**
 * DOES "REMOVE HER HAIR" ROUTE THE SAME WAY TWICE? (fable-608 §1.)
 *
 * The founder typed it and was refused with *"That one can't be rendered.
 * Nothing was charged."* — a CONTENT objection about an ask the product serves
 * perfectly under other words. He typed the identical sentence again and it
 * rendered her bald. Same words, two doors.
 *
 * So the diagnosis is a RATE rather than a replay: drive the real service, the
 * real interpreter, the same sentence, six times, and count the doors. If
 * identical input files a haircut on some attempts and hits the wall on others,
 * it is parse variance and his panel-timing theory is exonerated by the numbers
 * rather than by an argument.
 *
 * # Free, and proven free
 *
 * `admit: () => false` runs after every interpretation and re-read and BEFORE
 * the claim, so the whole routing decision happens and the call then refuses
 * with `TOO_MANY_REQUESTS`, having reserved nothing. Text calls only: no render,
 * no credits, and the ledger is read at both ends to prove it rather than to
 * hope it.
 *
 * # The set, from his own report and the ruling
 *
 * ```
 * THE CLASS      "remove her hair" · "take her hair off" · "get rid of her
 *                hair" · "her hair — remove it" (the panel's prefill shape)
 * THE CONTROL    "no glasses" — a genuine removal, which must STAY a removal;
 *                and "make her bald", which already works and must not move.
 * ```
 *
 *   npx tsx scripts/bench-hair-removal-routing-disposable.mts
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";

import { openDatabase } from "./lib/dbConnection.mts";
import { assertOneWorld } from "./lib/worldGuard.mts";
import { refineCandidate } from "../server/castingV2/refineService";
import { interpretRefinement } from "../server/castingV2/refineInterpreter";

const SAMPLES = Number(process.env.SAMPLES ?? 6);
const OUT = "output/hair-removal-routing";
mkdirSync(OUT, { recursive: true });

const FACE = process.env.FACE ?? "43ac4560-c59c-46ea-95cb-0bcd814062d3";
const USER = Number(process.env.USER_ID ?? 1);

if (process.env.MYSQL_PUBLIC_URL) throw new Error("dev only");
assertOneWorld(["DATABASE_URL"]);

const ASKS: Array<{ text: string; arm: "class" | "control" }> = [
  { text: "remove her hair", arm: "class" },
  { text: "take her hair off", arm: "class" },
  { text: "get rid of her hair", arm: "class" },
  { text: "her hair — remove it", arm: "class" },
  { text: "make her bald", arm: "control" },
  { text: "no glasses", arm: "control" },
];

const lines: string[] = [];
const say = (line = "") => { console.log(line); lines.push(line); };

const connection = await openDatabase(process.env.DATABASE_URL!);
const ledger = async () => {
  const [rows] = await connection.query<Array<{ rowCount: number; net: number }>>(
    "SELECT COUNT(*) AS rowCount, COALESCE(SUM(amount), 0) AS net FROM point_transactions WHERE userId = ?",
    [USER],
  );
  return rows[0]!;
};
const before = await ledger();

say(`HAIR-REMOVAL ROUTING — n=${SAMPLES} per phrasing, real service, admit() = false.`);
say("");

const results: Array<Record<string, unknown>> = [];
for (const ask of ASKS) {
  say("=".repeat(74));
  say(`[${ask.arm}] "${ask.text}"`);
  const doors: string[] = [];
  for (let n = 1; n <= SAMPLES; n += 1) {
    const seen: Array<Record<string, unknown>> = [];
    const interpret = (async (request: Parameters<typeof interpretRefinement>[0]) => {
      const answer = await interpretRefinement(request);
      seen.push({
        mode: (request as { mode?: string }).mode ?? "(default)",
        ok: (answer as { ok: boolean }).ok,
        intent: (answer as { intent?: string }).intent,
        delta: (answer as { delta?: unknown }).delta,
        refusal: (answer as { refusal?: unknown }).refusal,
      });
      return answer;
    }) as typeof interpretRefinement;

    let door = "";
    try {
      await refineCandidate({ interpret, admit: () => false }, {
        userId: USER, clientRequestId: randomUUID(), candidatePublicId: FACE, instruction: ask.text,
      });
      door = "REACHED THE CLAIM WITHOUT ADMIT (the bench's own guard failed)";
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      /* The admit refusal is the bench's own door and means the ask got all the
         way to the paint; anything else is the product's own answer. */
      door = message.includes("Casting is busy right now")
        ? "THE PAINT"
        : message.slice(0, 78);
    }
    doors.push(door);
    const first = seen[0] ?? null;
    say(`  #${n}  ${door}`);
    say(`      delta ${first ? JSON.stringify(first.delta ?? null).slice(0, 150) : "(none)"}`);
    results.push({ ask: ask.text, arm: ask.arm, attempt: n, door, seen });
  }
  const distinct = Array.from(new Set(doors));
  say(`  → ${distinct.length === 1 ? "STABLE" : `UNSTABLE: ${distinct.length} different doors`}`);
  say("");
}

const after = await ledger();
say(`ledger: ${before.rowCount} rows / net ${before.net} → ${after.rowCount} rows / net ${after.net}`);
say(before.rowCount === after.rowCount ? "nothing was charged, and that is read rather than assumed." : "SPENT — investigate.");
writeFileSync(`${OUT}/routing.json`, `${JSON.stringify(results, null, 2)}\n`);
writeFileSync(`${OUT}/routing.txt`, `${lines.join("\n")}\n`);
await connection.end();
process.exit(0);
