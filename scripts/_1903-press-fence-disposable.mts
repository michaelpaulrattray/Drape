/**
 * THE PRESS FENCE, DRIVEN AGAINST A REAL DATABASE — #1903's review finding 1.
 *
 * # Why this is not a vitest suite
 *
 * The repair IS a `WHERE` clause. `commitRetriedViewAsset` now re-proves, in
 * the same transaction that inserts the asset, that the PRESS row holding the
 * money is still `running` and belongs to the same user — invariant 1's shape,
 * because a `SELECT` before the insert is the check-then-write race the fence
 * exists to close.
 *
 * `vitest.setup.ts` strips `DATABASE_URL` so no suite may reach a database,
 * which is correct — and it means the three things this clause is FOR are not
 * provable against a fake handle. A mocked `tx` would return whatever the mock
 * was told to; the question here is what MySQL does with the statement.
 *
 * So the suite holds the shape (`viewRetryBusy.test.ts`, a text read it calls
 * a floor in its own docblock) and this holds the behaviour.
 *
 * # What it drives, and every arm reads the ASSET ROWS afterwards
 *
 *   1 · press `running`            → an id comes back, and a row exists
 *   2 · press `failed` (swept)     → `null`, and NO row exists
 *   3 · press `running`, OTHER user → `null`, and NO row exists
 *   4 · no press id at all          → an id comes back (the Try again road is
 *                                     untouched — the control that stops arm 2
 *                                     passing because the commit refuses
 *                                     everything)
 *
 * Arm 4 is the one that matters most: a fence that refused every commit would
 * pass arms 2 and 3 while breaking the feature, which is the shape this
 * repository has paid for before.
 *
 * # It cleans up after itself, and says so
 *
 * The dev database is shared between seats. Every row this writes is created
 * here and deleted here — two operations and up to three assets per run,
 * removed in a `finally` so a throw still clears them. It touches no existing
 * row: the Cast it borrows is read, never written.
 */
import "dotenv/config";
import { and, eq, inArray } from "drizzle-orm";

import { generationOperations, modelAssets, models } from "../drizzle/schema";
import { commitRetriedViewAsset } from "../server/db/castingV2ViewRetry";
import { getDb } from "../server/db/connection";
import { assertOneWorld } from "./lib/worldGuard.mts";

assertOneWorld(["DATABASE_URL"]);

const db = await getDb();
if (!db) throw new Error("no database");

/* varchar(36): a bare uuid EXACTLY fills it, so no prefix. The rows are
   identified by the two ids held below, not by a readable name. */
const PRESS_ID = crypto.randomUUID();
const SLOT_ID = crypto.randomUUID();
const CREATED_OPERATIONS = [PRESS_ID, SLOT_ID];
const createdAssets: number[] = [];

let failures = 0;
const check = (name: string, actual: unknown, expected: unknown): void => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) console.log(`        expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
};

/* An ACTIVE Cast to land on, READ and never written. The fence's model clause
   is not what is under test, so this must be a Cast the commit would accept. */
const [cast] = await db
  .select({ id: models.id, userId: models.userId })
  .from(models)
  .where(and(eq(models.status, "active")))
  .limit(1);
if (!cast) throw new Error("no active Cast in this world to land a view on");
console.log(`borrowing Cast ${cast.id} (user ${cast.userId}) — read only`);

const operationRow = (id: string, userId: number, status: string) => ({
  id,
  userId,
  clientRequestId: id,
  kind: id === PRESS_ID ? "castingV2.packageRedoPress" : "castingV2.packageRedo",
  modelId: cast.id,
  payloadHash: "0".repeat(64),
  status,
  plannedCredits: 0,
});

const assetsUnder = async (): Promise<number> => {
  const rows = await db
    .select({ id: modelAssets.id })
    .from(modelAssets)
    .where(eq(modelAssets.modelId, cast.id));
  const mine = rows.filter((row) => createdAssets.includes(row.id));
  return mine.length;
};

const landOnce = async (pressOperationId?: string): Promise<number | null> => {
  const id = await commitRetriedViewAsset({
    userId: cast.userId,
    operationId: SLOT_ID,
    modelId: cast.id,
    angle: "frontFull",
    storageKey: `scratch/_1903-fence/${crypto.randomUUID()}.png`,
    storageUrl: `https://example.invalid/_1903-fence/${crypto.randomUUID()}.png`,
    identityRevisionId: "fence-revision",
    identityText: "fence",
    pointsCost: 0,
    provenance: { source: "castingV2.packageRedo", _disposable: "_1903-press-fence" },
    ...(pressOperationId === undefined ? {} : { pressOperationId }),
  });
  if (id !== null) createdAssets.push(id);
  return id;
};

const setStatus = async (id: string, status: string, userId: number): Promise<void> => {
  await db.update(generationOperations)
    .set({ status, userId })
    .where(eq(generationOperations.id, id));
};

try {
  await db.insert(generationOperations).values([
    operationRow(PRESS_ID, cast.userId, "running"),
    operationRow(SLOT_ID, cast.userId, "running"),
  ]);

  console.log("\n1 · press running — the picture lands");
  const a1 = await landOnce(PRESS_ID);
  check("an asset id came back", a1 !== null, true);
  check("one asset row of mine exists", await assetsUnder(), 1);

  console.log("\n2 · press FAILED (the sweep has settled it) — the picture is refused");
  await setStatus(PRESS_ID, "failed", cast.userId);
  await setStatus(SLOT_ID, "running", cast.userId);
  const a2 = await landOnce(PRESS_ID);
  check("null came back — a fence, not a throw", a2, null);
  check("still only the first asset row — nothing landed", await assetsUnder(), 1);

  console.log("\n3 · press running but owned by ANOTHER user — refused");
  await setStatus(PRESS_ID, "running", cast.userId + 100_000);
  const a3 = await landOnce(PRESS_ID);
  check("null came back — the owner is in the WHERE", a3, null);
  check("still only the first asset row", await assetsUnder(), 1);

  console.log("\n4 · THE CONTROL — no press id at all (the Try again road)");
  await setStatus(PRESS_ID, "running", cast.userId);
  const a4 = await landOnce();
  check("an asset id came back — the fence refuses only a dead press", a4 !== null, true);
  check("a second asset row of mine exists", await assetsUnder(), 2);
} finally {
  if (createdAssets.length > 0) {
    await db.delete(modelAssets).where(inArray(modelAssets.id, createdAssets));
  }
  await db.delete(generationOperations)
    .where(inArray(generationOperations.id, CREATED_OPERATIONS));
  const leftAssets = await db
    .select({ id: modelAssets.id })
    .from(modelAssets)
    .where(createdAssets.length > 0
      ? inArray(modelAssets.id, createdAssets)
      : eq(modelAssets.id, -1));
  const leftOps = await db
    .select({ id: generationOperations.id })
    .from(generationOperations)
    .where(inArray(generationOperations.id, CREATED_OPERATIONS));
  console.log(`\ncleanup: ${createdAssets.length} asset(s) and ${CREATED_OPERATIONS.length} operation(s) written;`
    + ` left behind — assets ${leftAssets.length}, operations ${leftOps.length}`);
  if (leftAssets.length > 0 || leftOps.length > 0) failures += 1;
}

console.log(failures === 0 ? "\nALL ARMS PASS" : `\n${failures} ARM(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
