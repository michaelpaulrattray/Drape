/**
 * THE SWEEP-SIDE FENCE, DRIVEN AGAINST A REAL DATABASE — #1903's review
 * finding at head `6fe19c191` ("the sweep side of B1 is still read-then-write").
 *
 * # Why this is not a vitest suite
 *
 * The repair is a reading of `generation_operations.status` taken against rows
 * that other transactions are moving. `vitest.setup.ts` strips `DATABASE_URL`
 * so no suite may reach a database — correct, and it means the thing this is
 * FOR cannot be proven against a fake handle: a mocked builder returns what the
 * mock was told, and the question here is what MySQL answers.
 *
 * So the unit suite (`viewRetryRecovery.test.ts`, arms h–k) owns the money
 * arithmetic over a fake ledger, and this owns what the statuses do.
 *
 * # The fault, for a reader who meets this file cold
 *
 * A flat-priced press keeps its charge on ONE row and spends it on five slot
 * rows. The press's heartbeat latches on its first failure and never renews, so
 * its lease can lapse while its slots are alive. The sweep then read
 * `pressViewLanded` = false — true, because nothing had committed YET — recorded
 * a 3,250 refund, and only afterwards sealed the press failed. Every slot was
 * admitted by its fence throughout, because that fence requires the press to be
 * `running` and it still was. The slots committed after the refund: **she keeps
 * the new views AND the credits.**
 *
 * The repair asks, BEFORE the landed read, whether any view-replacing operation
 * on this Cast is still open. If one is, nothing is settled and the row is left
 * exactly as found for the next sweep pass.
 *
 * # The arms
 *
 *   1 · a slot `running`            → in flight  (nothing may be settled)
 *   2 · a slot `claimed`            → in flight  (it can still become running)
 *   3 · a slot `failed`             → NOT in flight
 *   4 · a slot `recovery_required`  → NOT in flight (parked: it can never commit)
 *   5 · the whole adjudication with a slot open → `deferred`, and the press row
 *       is still `running` afterwards, with no receipt written
 *   6 · THE INTERLEAVE the relay asked for — with every slot terminal, a slot
 *       commit attempted BETWEEN the gate and the verdict is REFUSED by the
 *       slot's own fence, and no asset row appears
 *   7 · THE CONTROL — with no operations open at all the adjudication proceeds
 *       and reaches its verdict, so arms 5 and 6 are not passing because the
 *       gate refuses everything
 *
 * Arm 7 is the one that matters most: a gate that deferred every press would
 * pass arms 5 and 6 while breaking the feature, which is the shape this
 * repository has paid for before.
 *
 * # NO MONEY CAN MOVE HERE, on two independent grounds
 *
 * `refund` and all three finalizers are INJECTED recorders, so `recordRefund`
 * and the real finalizers are unreachable from this file; and **no
 * `credit_transactions` row is written at all**, so the ledger read finds a zero
 * charge and his rule owes nothing even if an injection were dropped. The
 * accept arm is inert by construction, twice.
 *
 * # It cleans up after itself, and says so
 *
 * The dev database is shared between seats. Two operation rows per run, created
 * here and deleted here in a `finally` so a throw still clears them. The Cast it
 * borrows is READ, never written.
 */
import "dotenv/config";
import { and, eq, inArray } from "drizzle-orm";

import { generationOperations, modelAssets, models } from "../drizzle/schema";
import { recoverCastingV2PackageRedoPressOperation } from "../server/castingV2/viewRetryRecovery";
import { commitRetriedViewAsset, viewReplacementInFlight } from "../server/db/castingV2ViewRetry";
import { getDb } from "../server/db/connection";
import { assertOneWorld } from "./lib/worldGuard.mts";

assertOneWorld(["DATABASE_URL"]);

const db = await getDb();
if (!db) throw new Error("no database");

/* varchar(36): a bare uuid EXACTLY fills it, so no prefix. */
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

/* An ACTIVE Cast, READ and never written — the commit's model clause is not
   what is under test, so it must be a Cast the commit would accept. */
const [cast] = await db
  .select({ id: models.id, userId: models.userId })
  .from(models)
  .where(and(eq(models.status, "active")))
  .limit(1);
if (!cast) throw new Error("no active Cast in this world to land a view on");
console.log(`borrowing Cast ${cast.id} (user ${cast.userId}) — read only`);

const operationRow = (id: string, status: string) => ({
  id,
  userId: cast.userId,
  clientRequestId: id,
  kind: id === PRESS_ID ? "castingV2.packageRedoPress" : "castingV2.packageRedo",
  modelId: cast.id,
  payloadHash: "0".repeat(64),
  status,
  plannedCredits: 0,
});

const setStatus = async (id: string, status: string): Promise<void> => {
  await db.update(generationOperations)
    .set({ status })
    .where(eq(generationOperations.id, id));
};

const pressStatus = async (): Promise<string | undefined> => {
  const [row] = await db
    .select({ status: generationOperations.status })
    .from(generationOperations)
    .where(eq(generationOperations.id, PRESS_ID))
    .limit(1);
  return row?.status;
};

const inFlight = async (): Promise<boolean> =>
  viewReplacementInFlight({ userId: cast.userId, modelId: cast.id });

const landOnce = async (): Promise<number | null> => {
  const id = await commitRetriedViewAsset({
    userId: cast.userId,
    operationId: SLOT_ID,
    modelId: cast.id,
    angle: "frontFull",
    storageKey: `scratch/_1924-defer/${crypto.randomUUID()}.png`,
    storageUrl: `https://example.invalid/_1924-defer/${crypto.randomUUID()}.png`,
    identityRevisionId: "defer-revision",
    identityText: "defer",
    pointsCost: 0,
    provenance: { source: "castingV2.packageRedo", _disposable: "_1924-press-defer" },
    pressOperationId: PRESS_ID,
  });
  if (id !== null) createdAssets.push(id);
  return id;
};

const myAssets = async (): Promise<number> => {
  const rows = await db
    .select({ id: modelAssets.id })
    .from(modelAssets)
    .where(eq(modelAssets.modelId, cast.id));
  return rows.filter((row) => createdAssets.includes(row.id)).length;
};

/* THE INERT ACCEPT ARM. Nothing here can reach `recordRefund` or a real
   finalizer; a call is recorded and reported as a FAILING arm instead. */
const calls: string[] = [];
const injected = () => ({
  refund: (async (_userId: number, amount: number) => {
    calls.push(`refund:${amount}`);
    return { recorded: true, amount, reference: "injected", duplicate: false };
  }) as never,
  finalizeSuccess: (async () => { calls.push("finalizeSuccess"); }) as never,
  finalizeFailure: (async () => { calls.push("finalizeFailure"); }) as never,
  finalizeClaimedFailure: (async () => { calls.push("finalizeClaimedFailure"); }) as never,
});

try {
  await db.insert(generationOperations).values([
    operationRow(PRESS_ID, "running"),
    operationRow(SLOT_ID, "running"),
  ]);

  console.log("\n1 · a slot RUNNING — a picture can still arrive");
  check("in flight", await inFlight(), true);

  console.log("\n2 · a slot CLAIMED — it can still become running and commit");
  await setStatus(SLOT_ID, "claimed");
  check("in flight", await inFlight(), true);

  console.log("\n3 · a slot FAILED — nothing more can arrive");
  await setStatus(SLOT_ID, "failed");
  check("not in flight", await inFlight(), false);

  console.log("\n4 · a slot RECOVERY_REQUIRED — parked, so it can never commit");
  await setStatus(SLOT_ID, "recovery_required");
  check("not in flight", await inFlight(), false);

  console.log("\n5 · the adjudication with a slot still RUNNING — deferred, row untouched");
  await setStatus(SLOT_ID, "running");
  calls.length = 0;
  const deferred = await recoverCastingV2PackageRedoPressOperation(
    { id: PRESS_ID, clientRequestId: PRESS_ID, userId: cast.userId, modelId: cast.id, status: "running", chargedCredits: 0, refundedCredits: 0 },
    injected(),
  );
  check("the outcome is deferred", deferred.type, "deferred");
  check("nothing was refunded and nothing was sealed", calls, []);
  check("the press row is STILL running", await pressStatus(), "running");

  console.log("\n6 · THE INTERLEAVE — a slot commit between the gate and the verdict is refused");
  /*
    Every slot is terminal, so the gate lets the adjudication through. The
    injected `landed` reader runs AT the moment the verdict is being formed —
    which is precisely the window the finding named — and attempts a real
    commit from inside it. The slot's own fence must refuse it.
  */
  await setStatus(SLOT_ID, "failed");
  calls.length = 0;
  let interleaved: number | null | "not attempted" = "not attempted";
  const settled = await recoverCastingV2PackageRedoPressOperation(
    { id: PRESS_ID, clientRequestId: PRESS_ID, userId: cast.userId, modelId: cast.id, status: "running", chargedCredits: 0, refundedCredits: 0 },
    {
      ...injected(),
      landed: (async () => {
        interleaved = await landOnce();
        return false;
      }) as never,
    },
  );
  check("the commit was attempted", interleaved !== "not attempted", true);
  check("it was REFUSED — null, a fence and not a throw", interleaved, null);
  check("no asset row of mine exists", await myAssets(), 0);
  check("the adjudication reached a verdict rather than deferring", settled.type !== "deferred", true);

  console.log("\n7 · THE CONTROL — no operations open, so the gate admits the adjudication");
  await setStatus(PRESS_ID, "failed");
  await setStatus(SLOT_ID, "failed");
  check("not in flight", await inFlight(), false);
  calls.length = 0;
  const reached = await recoverCastingV2PackageRedoPressOperation(
    { id: PRESS_ID, clientRequestId: PRESS_ID, userId: cast.userId, modelId: cast.id, status: "running", chargedCredits: 0, refundedCredits: 0 },
    injected(),
  );
  check("it is NOT deferred — the gate does not refuse everything", reached.type !== "deferred", true);
  check("and it sealed, which is what a reached verdict does", calls.length > 0, true);
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
  if (calls.some((call) => call.startsWith("refund:"))) {
    console.log(`⚠ a refund was requested during this run: ${calls.filter((c) => c.startsWith("refund:")).join(", ")}`
      + " — injected, so no credits moved");
  }
}

console.log(failures === 0 ? "\nALL ARMS PASS" : `\n${failures} ARM(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
