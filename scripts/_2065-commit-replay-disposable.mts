/**
 * ONE OPERATION, ONE PICTURE — a replayed retried-view commit, driven against a
 * real database (#2065).
 *
 * # The fault, for a reader who meets this file cold
 *
 * `commitRetriedViewAsset` runs its insert inside a transaction. If the
 * transaction COMMITS and the acknowledgement is lost on the wire, the helper
 * throws while the row exists. On a redo's sheet road a throw is re-attempted
 * on purpose, so the next attempt reached the commit again and inserted a
 * SECOND asset for one operation. From the database's side a lost
 * acknowledgement is exactly "the first commit happened", so the faithful
 * drive is: commit, then commit the same operation again.
 *
 * # Why this is not a vitest suite
 *
 * The question is what MySQL does with a row lock and a locking read, and
 * `vitest.setup.ts` strips `DATABASE_URL` — rightly. The shape is copied from
 * `_2073-claim-fence-disposable.mts`, which drives the same function.
 *
 * # The arms
 *
 *   1 · CONTROL — a first commit lands one row, and the row carries the
 *       replay key even though the caller's bag omitted it
 *   2 · THE CARD — the same operation committed again with the next
 *       attempt's bytes: the SAME id comes back, still ONE row, and the row
 *       now points at the replay's bytes (the first attempt's were dropped by
 *       the loop's catch)
 *   3 · a replay with identical bytes: same id, one row, nothing moved
 *   4 · CONTROL THE CARD ASKED FOR — two DIFFERENT operations on one angle
 *       both land, two rows (a newer Try again still supersedes)
 *   5 · THE RACE — three commits of one fresh operation fired together: one
 *       id, one row, every time
 *   6 · THE REDO ROAD — a `castingV2.packageRedo` slot under a running press:
 *       first lands, replay answers the same id, one row
 *   7 · THE FENCE STILL COMES FIRST — a replay after the sweep has claimed the
 *       operation is refused (`null`) and the one row stays one row
 *
 * # NO MONEY CAN MOVE HERE
 *
 * Nothing in this file reads or writes a balance or a ledger row, and the
 * commit under test writes neither. Storage keys are fake and nothing touches
 * the bucket.
 *
 * # It cleans up after itself, and says so
 *
 * Operation rows and asset rows created here are deleted in a `finally`; the
 * Cast it borrows is READ, never written. It borrows the dev fixture account
 * `verify-bot-local` and refuses to run without it.
 */
import "dotenv/config";
import { and, eq, inArray, like, or } from "drizzle-orm";

import { generationOperations, modelAssets, models, users } from "../drizzle/schema";
import type { GenerationOperation } from "../drizzle/schema";
import { claimRecoveryAttempt } from "../server/casting/operationRecovery";
import { commitRetriedViewAsset } from "../server/db/castingV2ViewRetry";
import { getDb } from "../server/db/connection";
import { assertOneWorld } from "./lib/worldGuard.mts";

assertOneWorld(["DATABASE_URL"]);

const db = await getDb();
if (!db) throw new Error("no database");

const [bot] = await db
  .select({ id: users.id })
  .from(users)
  .where(or(like(users.openId, "verify-bot%"), like(users.email, "verify-bot%")))
  .limit(1);
if (!bot) throw new Error("no verify-bot fixture account in this world — refusing to borrow a person's");
const [cast] = await db
  .select({ id: models.id, userId: models.userId })
  .from(models)
  .where(and(eq(models.userId, bot.id), eq(models.status, "active")))
  .limit(1);
if (!cast) throw new Error("the verify-bot account has no active Cast to land a view on");
console.log(`borrowing Cast ${cast.id} (user ${cast.userId}, verify-bot) — read only`);

const MARK = "_2065-commit-replay";
const createdOperations: string[] = [];
let failures = 0;
const check = (name: string, actual: unknown, expected: unknown): void => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) console.log(`        expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
};

const FUTURE = new Date(Date.now() + 10 * 60_000);

const newOperation = async (
  kind: "castingV2.viewRetry" | "castingV2.packageRedo" | "castingV2.packageRedoPress" = "castingV2.viewRetry",
): Promise<string> => {
  const id = crypto.randomUUID();
  createdOperations.push(id);
  await db.insert(generationOperations).values({
    id,
    userId: cast.userId,
    clientRequestId: id,
    kind,
    modelId: cast.id,
    payloadHash: "0".repeat(64),
    status: "running",
    plannedCredits: 0,
    heartbeatAt: new Date(),
    leaseExpiresAt: FUTURE,
  });
  return id;
};

const freshKey = () => `scratch/${MARK}/${crypto.randomUUID()}.png`;

const commit = (
  operationId: string,
  options: { storageKey?: string; pressOperationId?: string; omitKey?: boolean } = {},
): Promise<number | null> => {
  const storageKey = options.storageKey ?? freshKey();
  return commitRetriedViewAsset({
    userId: cast.userId,
    operationId,
    modelId: cast.id,
    angle: "backFull",
    storageKey,
    storageUrl: `https://example.invalid/${storageKey}`,
    identityRevisionId: "commit-replay-revision",
    identityText: "commit-replay",
    pointsCost: 0,
    ...(options.pressOperationId ? { pressOperationId: options.pressOperationId } : {}),
    provenance: {
      source: "castingV2.viewRetry",
      ...(options.omitKey ? {} : { retryOperationId: operationId }),
      _disposable: MARK,
    },
  });
};

/** Every row on this Cast that names this operation — the card's own count. */
const rowsFor = async (operationId: string) => {
  const rows = await db
    .select({ id: modelAssets.id, storageKey: modelAssets.storageKey, provenance: modelAssets.provenance })
    .from(modelAssets)
    .where(eq(modelAssets.modelId, cast.id));
  return rows.filter((row) => (row.provenance as { retryOperationId?: unknown } | null)?.retryOperationId === operationId);
};

try {
  console.log("\n1 · a first commit lands one row, keyed even when the caller's bag omits the key");
  const op1 = await newOperation();
  const firstKey = freshKey();
  const first = await commit(op1, { storageKey: firstKey, omitKey: true });
  check("the first commit returned an id", typeof first, "number");
  const after1 = await rowsFor(op1);
  check("exactly one row names the operation", after1.length, 1);
  check("and it is the row returned", after1[0]?.id, first);

  console.log("\n2 · THE CARD — the same operation committed again after a lost acknowledgement");
  const replayKey = freshKey();
  const replay = await commit(op1, { storageKey: replayKey });
  check("the replay answers the SAME id", replay, first);
  const after2 = await rowsFor(op1);
  check("still exactly one row", after2.length, 1);
  check("the row now points at the replay's live bytes", after2[0]?.storageKey, replayKey);

  console.log("\n3 · a replay with identical bytes moves nothing");
  const again = await commit(op1, { storageKey: replayKey });
  check("same id", again, first);
  const after3 = await rowsFor(op1);
  check("still one row", after3.length, 1);
  check("bytes unchanged", after3[0]?.storageKey, replayKey);

  console.log("\n4 · CONTROL — two DIFFERENT operations on one angle both land");
  const op4 = await newOperation();
  const second = await commit(op4);
  check("the second operation lands its own row", typeof second === "number" && second !== first, true);
  check("one row for each operation", [(await rowsFor(op1)).length, (await rowsFor(op4)).length], [1, 1]);

  console.log("\n5 · THE RACE — three commits of one operation at once");
  const RUNS = 8;
  let clean = 0;
  for (let run = 0; run < RUNS; run += 1) {
    const op = await newOperation();
    const ids = await Promise.all([commit(op), commit(op), commit(op)]);
    const rows = await rowsFor(op);
    if (new Set(ids).size === 1 && ids[0] !== null && rows.length === 1 && rows[0]!.id === ids[0]) clean += 1;
  }
  check(`${RUNS} races, each one id and one row`, clean, RUNS);

  console.log("\n6 · THE REDO ROAD — a packageRedo slot under a running press");
  const press = await newOperation("castingV2.packageRedoPress");
  const slot = await newOperation("castingV2.packageRedo");
  const slotFirst = await commit(slot, { pressOperationId: press });
  const slotReplay = await commit(slot, { pressOperationId: press });
  check("the slot's first commit landed", typeof slotFirst, "number");
  check("its replay answers the same id", slotReplay, slotFirst);
  check("one row for the slot", (await rowsFor(slot)).length, 1);

  console.log("\n7 · the fence still comes first — a replay after the sweep's claim");
  const op7 = await newOperation();
  const landed7 = await commit(op7);
  const claimed = await claimRecoveryAttempt({ id: op7, status: "running" } as GenerationOperation, new Date());
  check("the sweep's claim took the row", claimed, true);
  const fenced = await commit(op7);
  check("the replay is refused as a fence", fenced, null);
  const after7 = await rowsFor(op7);
  check("and the landed row is still the one row", [after7.length, after7[0]?.id], [1, landed7]);
} finally {
  const mine = (await db
    .select({ id: modelAssets.id, provenance: modelAssets.provenance })
    .from(modelAssets)
    .where(eq(modelAssets.modelId, cast.id)))
    .filter((row) => (row.provenance as { _disposable?: unknown } | null)?._disposable === MARK)
    .map((row) => row.id);
  if (mine.length > 0) await db.delete(modelAssets).where(inArray(modelAssets.id, mine));
  await db.delete(generationOperations).where(inArray(generationOperations.id, createdOperations));
  const leftAssets = mine.length === 0 ? [] : await db
    .select({ id: modelAssets.id }).from(modelAssets).where(inArray(modelAssets.id, mine));
  const leftOps = await db
    .select({ id: generationOperations.id }).from(generationOperations)
    .where(inArray(generationOperations.id, createdOperations));
  console.log(`\ncleanup: ${mine.length} asset(s), ${createdOperations.length} operation(s) written; `
    + `left behind — assets ${leftAssets.length}, operations ${leftOps.length}`);
  if (leftAssets.length + leftOps.length > 0) failures += 1;
}

console.log(failures === 0 ? "\nALL ARMS PASS" : `\n${failures} ARM(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
