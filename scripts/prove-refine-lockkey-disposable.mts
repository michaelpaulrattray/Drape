/**
 * THE lockKey AMENDMENT, PRICED AT THE ARTIFACT RATHER THAN AT THE SIGNATURE.
 *
 * `CASTING_V2_REFINE_DISPATCH_DESIGN.md` §4's amendment (filed fable-841 §3d,
 * ruled (a) by fable-973 §2) prices the double-tap guard as:
 *
 *   > One argument at `refineService.ts:2954` … **Half a shift.**
 *
 * That price was read off `beginDirectOperation`'s SIGNATURE — it takes a
 * `lockKey?: string` and answers `resource_busy` → CONFLICT. This script asks
 * the lock itself, because a signature is a claim and a run is a fact.
 *
 * There are TWO gates between that argument and a working guard, and a refine
 * satisfies neither:
 *
 *   GATE 1  `assertOperationLockKey` (operationContract.ts:333) accepts
 *           `^(model|board-item):[1-9][0-9]*$` and nothing else. A castingV2
 *           candidate is named by a uuid `publicId`, so a candidate-shaped key
 *           is refused on FORMAT before any row is read.
 *   GATE 2  `acquireGenerationOperationLock` builds `allowedLockKeys` from the
 *           operation ROW's `modelId` and `originItemId`
 *           (generationOperations.ts:825) and refuses any key outside it. A
 *           `castingV2.refine` claim passes neither column, so that list is
 *           EMPTY and *every* key is refused — including a well-formed one.
 *
 * Why it matters more than a price correction: both refusals are plain
 * `Error`/`TypeError`, not the `resource_busy` outcome `beginDirectOperation`
 * translates — and they fire AFTER the claim. Shipping the one-argument version
 * would make every refine claim an operation and then answer 500.
 *
 * # Controls (working law 2)
 *
 *   POSITIVE  the same lock, same kind, same helper, on an operation that DOES
 *             declare a modelId → `acquired`. Without it, three refusals below
 *             could be an instrument that cannot acquire anything.
 *   NEGATIVE  a well-formed `model:<id>` key naming a REAL model, against the
 *             refine operation that declared none → still refused. This is what
 *             separates "the key's shape is wrong" from "the row declares no
 *             resource", which are different repairs.
 *
 * Free: no provider call, no credit, no render. It writes operation rows and
 * lock rows and deletes exactly the ones it created, printing the leftovers.
 *
 *   npx tsx scripts/prove-refine-lockkey-disposable.mts
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";

import { openDatabase } from "./lib/dbConnection.mts";
import { assertOneWorld } from "./lib/worldGuard.mts";
import { claimGenerationOperation, acquireGenerationOperationLock } from "../server/db";
import { assertOperationLockKey, modelOperationLockKey } from "../server/casting/operationContract";

if (process.env.MYSQL_PUBLIC_URL) throw new Error("dev only — this WRITES operation rows");
assertOneWorld(["DATABASE_URL"]);

const USER = Number(process.env.USER_ID ?? 1);
const where = new URL((process.env.DATABASE_URL ?? "").replace(/^mysql:/, "http:"));
const db = await openDatabase(process.env.DATABASE_URL!);
const query = async (sql: string, params: unknown[] = []): Promise<any[]> => {
  const [rows] = await db.query<any[]>(sql, params);
  return rows;
};
const say = (line = "") => console.log(line);

const [model] = await query("SELECT id FROM models WHERE userId = ? ORDER BY id DESC LIMIT 1", [USER]);
if (!model) throw new Error("no model row for this user in this world — the positive control needs one");
const [candidate] = await query(
  "SELECT publicId FROM casting_candidates WHERE userId = ? ORDER BY id DESC LIMIT 1", [USER],
);
if (!candidate) throw new Error("no candidate row for this user in this world");

say(`WORLD     DATABASE_URL → ${where.hostname}:${where.port}`);
say(`FIXTURE   model ${model.id}, candidate ${candidate.publicId}, user ${USER}`);
say();

const minted = new Set<string>();
const claim = async (modelId: number | null): Promise<string> => {
  const outcome = await claimGenerationOperation({
    userId: USER,
    clientRequestId: randomUUID(),
    kind: "castingV2.refine",
    ...(modelId === null ? {} : { modelId }),
    payload: { candidatePublicId: candidate.publicId, instruction: "lockkey probe" },
  });
  if (outcome.type !== "claimed") throw new Error(`expected a fresh claim, saw ${outcome.type}`);
  minted.add(outcome.operationId);
  return outcome.operationId;
};

/** What a refusal SAID, so the two gates are told apart by their own words. */
const refusalOf = async (fn: () => Promise<unknown>): Promise<string | null> => {
  try {
    await fn();
    return null;
  } catch (error) {
    return error instanceof Error ? `${error.constructor.name}: ${error.message}` : String(error);
  }
};

let failures = 0;
const verdict = (label: string, pass: boolean, saw: string) => {
  if (!pass) failures += 1;
  say(`${pass ? "pass" : "FAIL"}  ${label}`);
  say(`      saw ${saw}`);
};

/* ── CONTROL POSITIVE ─────────────────────────────────────────────────────── */
const declared = await claim(Number(model.id));
const acquired = await acquireGenerationOperationLock({
  userId: USER,
  operationId: declared,
  kind: "castingV2.refine",
  lockKey: modelOperationLockKey(Number(model.id)),
});
verdict(
  "POSITIVE CONTROL — a castingV2.refine operation that DECLARES a modelId takes the lock",
  acquired.type === "acquired",
  `${acquired.type}`,
);

/* ── GATE 1 — the key's own format ────────────────────────────────────────── */
const candidateKey = `casting-candidate:${candidate.publicId}`;
const gate1 = await refusalOf(async () => assertOperationLockKey(candidateKey));
verdict(
  `GATE 1 — a candidate-shaped key (${candidateKey.slice(0, 28)}…) is refused on FORMAT`,
  gate1 !== null && gate1.startsWith("TypeError"),
  gate1 ?? "no refusal — the format validator accepted it",
);

/* ── GATE 2 — the operation row declares no resource ──────────────────────── */
const undeclared = await claim(null);
const gate2 = await refusalOf(() => acquireGenerationOperationLock({
  userId: USER,
  operationId: undeclared,
  kind: "castingV2.refine",
  lockKey: modelOperationLockKey(Number(model.id)),
}));
verdict(
  "GATE 2 / NEGATIVE CONTROL — a WELL-FORMED key against a refine claim that declares nothing",
  gate2 !== null && gate2.includes("does not match a resource in the trusted claim"),
  gate2 ?? "no refusal — the allowlist admitted a key the row never declared",
);

/* ── cleanup: exactly what this run created ───────────────────────────────── */
for (const id of minted) {
  await query("DELETE FROM generation_operation_locks WHERE operationId = ?", [id]);
  await query("DELETE FROM generation_operations WHERE id = ? AND userId = ?", [id, USER]);
}
const [{ leftover }] = await query(
  `SELECT COUNT(*) AS leftover FROM generation_operations WHERE id IN (${[...minted].map(() => "?").join(",")})`,
  [...minted],
);
say();
say(`CLEANUP   ${minted.size} operation rows deleted · leftover ${leftover}`);
say(failures === 0
  ? "VERDICT   the one-argument amendment CANNOT work as priced — both gates refuse a refine"
  : `VERDICT   ${failures} arm(s) did not behave as read — the finding is NOT proven`);
await db.end();
process.exit(failures === 0 && Number(leftover) === 0 ? 0 : 1);
