/**
 * THE TRY AGAIN'S CLAIM FENCE, DRIVEN AGAINST A REAL DATABASE — #2073.
 *
 * # The fault, for a reader who meets this file cold
 *
 * A paid Try again's lease lapses while its render is still alive (the
 * heartbeat latches on its first failure and never renews). The sweep CLAIMS
 * the row — `claimRecoveryAttempt` stamps `recoveryAttemptedAt` and leaves it
 * `running` — reads *did a picture land* (no, not YET), records the 50-credit
 * refund, and only then seals the row out of `running`. A commit inside that
 * window was admitted, because the commit's fence only asked for `running`.
 * **She kept the view AND the credits.**
 *
 * The repair makes the claim the fence: `commitRetriedViewAsset` refuses an
 * operation that carries the stamp, under the same `FOR UPDATE`.
 *
 * # Why this is not a vitest suite
 *
 * The question is what MySQL does with a row lock and a stamp, and
 * `vitest.setup.ts` strips `DATABASE_URL` — rightly. The shape is copied from
 * `_1924-press-defer-disposable.mts`.
 *
 * # The arms
 *
 *   1 · CONTROL — an unclaimed `running` Try again: the commit LANDS (so the
 *       fence does not refuse everything)
 *   2 · the REAL claim, then a commit → REFUSED (`null`), and no asset row
 *   3 · THE INTERLEAVE the card asked for — charged 50, claimed, and a real
 *       commit attempted from INSIDE the adjudicator's landed read: refused;
 *       the verdict is a refund, and there is no picture it is a refund for
 *   4 · THE OTHER ORDER — the commit lands first, then the claim: the
 *       adjudicator sees the picture and refunds NOTHING
 *   5 · THE RACE — the commit and (claim → landed read) fired together, many
 *       times: never a landed picture that the post-claim read cannot see
 *
 * # NO MONEY CAN MOVE HERE, on two independent grounds
 *
 * `refund` and all three finalizers are INJECTED recorders, so `recordRefund`
 * and the real finalizers are unreachable from this file; and the "charge" in
 * arms 3–4 is a fixture ROW in the ledger table only — no balance column is
 * read or written — deleted in the `finally`.
 *
 * # It cleans up after itself, and says so
 *
 * Operation rows, ledger fixture rows and asset rows created here are deleted in
 * a `finally`; the Cast it borrows is READ, never written. It borrows the dev
 * fixture account `verify-bot-local` and refuses to run without it.
 */
import "dotenv/config";
import { and, eq, inArray, like, or } from "drizzle-orm";

import { creditTransactions, generationOperations, modelAssets, models, users } from "../drizzle/schema";
import { operationChargeReference } from "../server/casting/operationContract";
import { claimRecoveryAttempt } from "../server/casting/operationRecovery";
import { recoverCastingV2ViewRetryOperation } from "../server/castingV2/viewRetryRecovery";
import { commitRetriedViewAsset, retriedViewLanded } from "../server/db/castingV2ViewRetry";
import { getDb } from "../server/db/connection";
import type { GenerationOperation } from "../drizzle/schema";
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

const createdOperations: string[] = [];
const createdAssets: number[] = [];
const createdCharges: string[] = [];

let failures = 0;
const check = (name: string, actual: unknown, expected: unknown): void => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) console.log(`        expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
};

const PAST = new Date(Date.now() - 10 * 60_000);

/** A paid Try again whose lease has lapsed, exactly what the sweep selects. */
const newOperation = async (charged: boolean): Promise<string> => {
  const id = crypto.randomUUID();
  createdOperations.push(id);
  await db.insert(generationOperations).values({
    id,
    userId: cast.userId,
    clientRequestId: id,
    kind: "castingV2.viewRetry",
    modelId: cast.id,
    payloadHash: "0".repeat(64),
    status: "running",
    plannedCredits: 50,
    heartbeatAt: PAST,
    leaseExpiresAt: PAST,
  });
  if (charged) {
    const reference = operationChargeReference(id);
    createdCharges.push(reference);
    await db.insert(creditTransactions).values({
      userId: cast.userId,
      amount: -50,
      type: "generation",
      description: "_2073 disposable fixture — no balance moved",
      referenceId: reference,
      balanceAfter: 0,
    });
  }
  return id;
};

const commit = async (operationId: string): Promise<number | null> => {
  const id = await commitRetriedViewAsset({
    userId: cast.userId,
    operationId,
    modelId: cast.id,
    angle: "backFull",
    storageKey: `scratch/_2073-claim-fence/${crypto.randomUUID()}.png`,
    storageUrl: `https://example.invalid/_2073-claim-fence/${crypto.randomUUID()}.png`,
    identityRevisionId: "claim-fence-revision",
    identityText: "claim-fence",
    pointsCost: 50,
    provenance: { source: "castingV2.viewRetry", retryOperationId: operationId, _disposable: "_2073-claim-fence" },
  });
  if (id !== null) createdAssets.push(id);
  return id;
};

const claim = (operationId: string): Promise<boolean> =>
  claimRecoveryAttempt({ id: operationId, status: "running" } as GenerationOperation, new Date());

const landed = (operationId: string): Promise<boolean> =>
  retriedViewLanded({ userId: cast.userId, modelId: cast.id, operationId });

/* THE INERT ACCEPT ARM — every money and receipt write is a recorder. */
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
const recoverable = (id: string) => ({
  id, userId: cast.userId, modelId: cast.id, status: "running" as const, chargedCredits: 0, refundedCredits: 0,
});

try {
  console.log("\n1 · CONTROL — an unclaimed running Try again lands its picture");
  {
    const op = await newOperation(false);
    const id = await commit(op);
    check("the commit landed (an asset id)", typeof id, "number");
    check("the landed read sees it", await landed(op), true);
  }

  console.log("\n2 · the REAL claim, then a commit — refused");
  {
    const op = await newOperation(false);
    check("the sweep's claim took the row", await claim(op), true);
    check("the commit is REFUSED — null, a fence and not a throw", await commit(op), null);
    check("no picture landed under it", await landed(op), false);
  }

  console.log("\n3 · THE INTERLEAVE — a commit inside the adjudicator's landed read, after the claim");
  {
    const op = await newOperation(true);
    check("claimed", await claim(op), true);
    calls.length = 0;
    let interleaved: number | null | "not attempted" = "not attempted";
    const outcome = await recoverCastingV2ViewRetryOperation(recoverable(op), {
      ...injected(),
      landed: (async (input: { userId: number; modelId: number; operationId: string }) => {
        interleaved = await commit(input.operationId);
        return retriedViewLanded(input);
      }) as never,
    });
    check("the commit was attempted", interleaved !== "not attempted", true);
    check("it was REFUSED", interleaved, null);
    check("the verdict is a refund of the 50", calls.filter((c) => c.startsWith("refund:")), ["refund:50"]);
    check("…and there is NO picture it would be paying back beside", await landed(op), false);
    check("outcome", outcome.type, "paid_failure");
  }

  console.log("\n3b · THE CARD'S WINDOW EXACTLY — the landed read answers, THEN a commit, THEN the refund");
  {
    /* The read is taken first and its answer returned, so the commit lands (or
       not) between the fork read and the refund — the precise window #2073
       names. Without the claim fence the picture lands and the refund is still
       written: the defect, reproduced. */
    const op = await newOperation(true);
    check("claimed", await claim(op), true);
    calls.length = 0;
    let interleaved: number | null | "not attempted" = "not attempted";
    await recoverCastingV2ViewRetryOperation(recoverable(op), {
      ...injected(),
      landed: (async (input: { userId: number; modelId: number; operationId: string }) => {
        const answer = await retriedViewLanded(input);
        interleaved = await commit(input.operationId);
        return answer;
      }) as never,
    });
    check("the commit after the read was REFUSED", interleaved, null);
    const refunded = calls.some((c) => c.startsWith("refund:"));
    const delivered = await landed(op);
    check("no refund was written for a view that was delivered", refunded && delivered, false);
    check("(the refund stands, for a view that did NOT arrive)", [refunded, delivered], [true, false]);
  }

  console.log("\n4 · THE OTHER ORDER — the picture lands first, then the claim: nothing is refunded");
  {
    const op = await newOperation(true);
    check("the commit landed before any claim", typeof (await commit(op)), "number");
    check("claimed", await claim(op), true);
    calls.length = 0;
    const outcome = await recoverCastingV2ViewRetryOperation(recoverable(op), injected());
    check("outcome is a success", outcome.type, "durable_success");
    check("NO refund was written for a delivered view", calls.filter((c) => c.startsWith("refund:")), []);
  }

  console.log("\n5 · THE RACE — commit and (claim → landed read) fired together");
  {
    const RUNS = 16;
    let landedFirst = 0;
    let refused = 0;
    let unseen = 0;
    for (let run = 0; run < RUNS; run += 1) {
      const op = await newOperation(false);
      const [committed, seen] = await Promise.all([
        commit(op),
        (async () => {
          await claim(op);
          return landed(op);
        })(),
      ]);
      if (committed === null) refused += 1;
      else if (seen) landedFirst += 1;
      else unseen += 1;
    }
    console.log(`        ${RUNS} runs: ${landedFirst} landed-then-seen, ${refused} refused after the claim, ${unseen} landed-and-UNSEEN`);
    check("never a picture the sweep's post-claim read cannot see", unseen, 0);
    check("every run is one of the two honest orders", landedFirst + refused, RUNS);
  }
} finally {
  if (createdAssets.length > 0) {
    await db.delete(modelAssets).where(inArray(modelAssets.id, createdAssets));
  }
  if (createdCharges.length > 0) {
    await db.delete(creditTransactions).where(and(
      eq(creditTransactions.userId, cast.userId),
      inArray(creditTransactions.referenceId, createdCharges),
    ));
  }
  await db.delete(generationOperations).where(inArray(generationOperations.id, createdOperations));
  const leftAssets = createdAssets.length === 0 ? [] : await db
    .select({ id: modelAssets.id }).from(modelAssets).where(inArray(modelAssets.id, createdAssets));
  const leftCharges = createdCharges.length === 0 ? [] : await db
    .select({ id: creditTransactions.id }).from(creditTransactions)
    .where(inArray(creditTransactions.referenceId, createdCharges));
  const leftOps = await db
    .select({ id: generationOperations.id }).from(generationOperations)
    .where(inArray(generationOperations.id, createdOperations));
  console.log(`\ncleanup: ${createdAssets.length} asset(s), ${createdCharges.length} ledger fixture(s), `
    + `${createdOperations.length} operation(s) written; left behind — assets ${leftAssets.length}, `
    + `ledger ${leftCharges.length}, operations ${leftOps.length}`);
  if (leftAssets.length + leftCharges.length + leftOps.length > 0) failures += 1;
}

console.log(failures === 0 ? "\nALL ARMS PASS" : `\n${failures} ARM(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
