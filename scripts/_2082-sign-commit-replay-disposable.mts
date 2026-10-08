/**
 * ONE SIGN, ONE PICTURE PER ANGLE — a replayed Sign view commit, driven against
 * a real database (#2082). The Sign's twin of `_2065-commit-replay-disposable.mts`.
 *
 * # The fault, for a reader who meets this file cold
 *
 * `commitPackageSlotAsset` runs its insert inside a transaction. If the
 * transaction COMMITS and the acknowledgement is lost on the wire, the helper
 * throws while the row exists. A Sign renders on the sheet road, where that
 * throw is re-attempted on purpose, so the next attempt reached the commit
 * again and inserted a SECOND asset for one slot. From the database's side a
 * lost acknowledgement is exactly "the first commit happened", so the faithful
 * drive is: commit, then commit the same operation and angle again.
 *
 * # Why this is not a vitest suite
 *
 * The question is what MySQL does with the row locks and a locking read, and
 * `vitest.setup.ts` strips `DATABASE_URL` — rightly.
 *
 * # The arms
 *
 *   1 · CONTROL — a first commit lands one row, stamped with the Sign's
 *       operation even though the caller's bag omitted it
 *   2 · THE CARD — the same operation and angle committed again with the next
 *       attempt's bytes: the SAME id, still ONE row, now on the replay's bytes
 *   3 · a replay with identical bytes: same id, one row, nothing moved
 *   4 · CONTROL — a different ANGLE of the same Sign lands its own row
 *   5 · CONTROL THE CARD ASKED FOR — two DIFFERENT Signs (two Casts, two
 *       operations) each land their own row on the same angle
 *   6 · THE RACE — three commits of one Sign's slot fired together: one id,
 *       one row, every time
 *   7 · THE FENCE STILL COMES FIRST — a replay after the operation has left
 *       `running` is refused (`null`) and the one row stays one row
 *
 * # NO MONEY CAN MOVE HERE
 *
 * Nothing in this file reads or writes a balance or a ledger row, and the
 * commit under test writes neither. Storage keys are fake and nothing touches
 * the bucket.
 *
 * # It cleans up after itself, and says so
 *
 * It needs a Cast in `provisioning`, which only a live Sign holds, so it
 * creates scratch `models` rows for the dev fixture account `verify-bot-local`
 * (refusing to run without it) and deletes them, their assets and its
 * operation rows in a `finally`. No existing row is written.
 */
import "dotenv/config";
import { eq, inArray, like, or } from "drizzle-orm";

import { generationOperations, modelAssets, models, users } from "../drizzle/schema";
import { commitPackageSlotAsset } from "../server/db/castingV2Sign";
import { getDb } from "../server/db/connection";
import type { CastViewAngle } from "../shared/boardTypes";
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
console.log(`fixture user ${bot.id} (verify-bot)`);

const MARK = "_2082-sign-commit-replay";
const createdOperations: string[] = [];
const createdModels: number[] = [];
let failures = 0;
const check = (name: string, actual: unknown, expected: unknown): void => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) console.log(`        expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
};

const FUTURE = new Date(Date.now() + 10 * 60_000);

const newCast = async (): Promise<number> => {
  const [row] = await db
    .insert(models)
    .values({
      userId: bot.id,
      masterPrompt: MARK,
      technicalSchema: { _disposable: MARK },
      preferences: { _disposable: MARK },
      status: "provisioning",
    })
    .$returningId();
  createdModels.push(row!.id);
  return row!.id;
};

const newSign = async (modelId: number): Promise<string> => {
  const id = crypto.randomUUID();
  createdOperations.push(id);
  await db.insert(generationOperations).values({
    id,
    userId: bot.id,
    clientRequestId: id,
    kind: "castingV2.sign",
    modelId,
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
  modelId: number,
  operationId: string,
  options: { storageKey?: string; angle?: CastViewAngle } = {},
): Promise<number | null> => {
  const storageKey = options.storageKey ?? freshKey();
  return commitPackageSlotAsset({
    userId: bot.id,
    operationId,
    modelId,
    angle: options.angle ?? "backFull",
    storageKey,
    storageUrl: `https://example.invalid/${storageKey}`,
    identityRevisionId: "sign-replay-revision",
    identityText: "sign-replay",
    pointsCost: 0,
    // The caller's bag carries no key at all — the commit stamps it.
    provenance: { source: "castingV2.sign", _disposable: MARK },
  });
};

const rowsOn = async (modelId: number, angle: CastViewAngle = "backFull") =>
  (await db
    .select({
      id: modelAssets.id,
      viewType: modelAssets.viewType,
      storageKey: modelAssets.storageKey,
      provenance: modelAssets.provenance,
    })
    .from(modelAssets)
    .where(eq(modelAssets.modelId, modelId)))
    .filter((row) => row.viewType === angle);

try {
  console.log("\n1 · a first commit lands one row, stamped from the typed operation id");
  const castA = await newCast();
  const signA = await newSign(castA);
  const firstKey = freshKey();
  const first = await commit(castA, signA, { storageKey: firstKey });
  check("the first commit returned an id", typeof first, "number");
  const after1 = await rowsOn(castA);
  check("exactly one row on the angle", after1.length, 1);
  check("it is the row returned", after1[0]?.id, first);
  check("it carries the Sign's operation", (after1[0]?.provenance as { signOperationId?: unknown })?.signOperationId, signA);

  console.log("\n2 · THE CARD — the same Sign and angle committed again after a lost acknowledgement");
  const replayKey = freshKey();
  const replay = await commit(castA, signA, { storageKey: replayKey });
  check("the replay answers the SAME id", replay, first);
  const after2 = await rowsOn(castA);
  check("still exactly one row", after2.length, 1);
  check("the row now points at the replay's live bytes", after2[0]?.storageKey, replayKey);

  console.log("\n3 · a replay with identical bytes moves nothing");
  const again = await commit(castA, signA, { storageKey: replayKey });
  check("same id", again, first);
  const after3 = await rowsOn(castA);
  check("still one row, bytes unchanged", [after3.length, after3[0]?.storageKey], [1, replayKey]);

  console.log("\n4 · CONTROL — another angle of the same Sign lands its own row");
  const front = await commit(castA, signA, { angle: "frontFull" });
  check("the second angle lands a different id", typeof front === "number" && front !== first, true);
  check("one row on each angle", [(await rowsOn(castA)).length, (await rowsOn(castA, "frontFull")).length], [1, 1]);

  console.log("\n5 · CONTROL — two different Signs each land on the same angle");
  const castB = await newCast();
  const signB = await newSign(castB);
  const second = await commit(castB, signB);
  check("the second Sign lands its own row", typeof second === "number" && second !== first, true);
  check("one row on each Cast", [(await rowsOn(castA)).length, (await rowsOn(castB)).length], [1, 1]);
  /* And a second operation on the SAME Cast and angle is not this operation's
     replay: the key is the operation, never the angle alone. */
  const signA2 = await newSign(castA);
  const otherOnA = await commit(castA, signA2);
  check("another operation on the same Cast and angle lands too", typeof otherOnA === "number" && otherOnA !== first, true);
  check("two rows on that angle now, one per operation", (await rowsOn(castA)).length, 2);

  console.log("\n6 · THE RACE — three commits of one Sign's slot at once");
  const RUNS = 8;
  let clean = 0;
  for (let run = 0; run < RUNS; run += 1) {
    const cast = await newCast();
    const sign = await newSign(cast);
    const ids = await Promise.all([commit(cast, sign), commit(cast, sign), commit(cast, sign)]);
    const rows = await rowsOn(cast);
    if (new Set(ids).size === 1 && ids[0] !== null && rows.length === 1 && rows[0]!.id === ids[0]) clean += 1;
  }
  check(`${RUNS} races, each one id and one row`, clean, RUNS);

  console.log("\n7 · the fence still comes first — a replay after the operation left `running`");
  const castC = await newCast();
  const signC = await newSign(castC);
  const landedC = await commit(castC, signC);
  await db.update(generationOperations).set({ status: "failed" }).where(eq(generationOperations.id, signC));
  const fenced = await commit(castC, signC);
  check("the replay is refused as a fence", fenced, null);
  const afterC = await rowsOn(castC);
  check("and the landed row is still the one row", [afterC.length, afterC[0]?.id], [1, landedC]);
} finally {
  if (createdModels.length > 0) {
    await db.delete(modelAssets).where(inArray(modelAssets.modelId, createdModels));
    await db.delete(models).where(inArray(models.id, createdModels));
  }
  if (createdOperations.length > 0) {
    await db.delete(generationOperations).where(inArray(generationOperations.id, createdOperations));
  }
  const leftModels = createdModels.length === 0 ? [] : await db
    .select({ id: models.id }).from(models).where(inArray(models.id, createdModels));
  const leftAssets = createdModels.length === 0 ? [] : await db
    .select({ id: modelAssets.id }).from(modelAssets).where(inArray(modelAssets.modelId, createdModels));
  const leftOps = createdOperations.length === 0 ? [] : await db
    .select({ id: generationOperations.id }).from(generationOperations)
    .where(inArray(generationOperations.id, createdOperations));
  console.log(`\ncleanup: ${createdModels.length} scratch Cast(s), ${createdOperations.length} operation(s) written; `
    + `left behind — casts ${leftModels.length}, assets ${leftAssets.length}, operations ${leftOps.length}`);
  if (leftModels.length + leftAssets.length + leftOps.length > 0) failures += 1;
}

console.log(failures === 0 ? "\nALL ARMS PASS" : `\n${failures} ARM(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
