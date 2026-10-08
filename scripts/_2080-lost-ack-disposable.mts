/**
 * A PAID TRY AGAIN WHOSE COMMIT COMMITTED AND LOST ITS ACKNOWLEDGEMENT — driven
 * through the real service against a real database (#2080).
 *
 * # The fault, for a reader who meets this file cold
 *
 * `commitRetriedViewAsset`'s transaction can commit and its acknowledgement be
 * lost on the wire, so the helper throws while the row exists. On the Try again
 * road a throw after the frame was bought is terminal (#1994), so before #2080
 * the loop dropped the bytes the row points at and the failed exit refunded the
 * 50 credits — a refund AND a broken tile. From the database's side a lost
 * acknowledgement is exactly "the commit happened, then the call threw", so the
 * faithful drive is the REAL commit followed by a throw.
 *
 * # What is real and what is not
 *
 * REAL: `retryCastView`, `renderViewAttempts`, `commitRetriedViewAsset`,
 * `retriedViewLanded`, the operation receipt, `assertNotFrozen`. INJECTED: the
 * claim (a row this script writes), the deduct and refund (recorded, never
 * written — NO MONEY MOVES), the engine and judge (fixed bytes — NO PAID CALL;
 * the provider keys are also deleted from this process so a stray call fails),
 * storage (a fake key; the bucket is never touched).
 *
 * # The arms
 *
 *   1 · THE CARD — the commit lands and the call throws: delivered, ONE asset
 *       naming the operation, pointing at the bytes this attempt stored, those
 *       bytes never deleted, no refund, one render
 *   2 · CONTROL — the commit truly fails (nothing written): no asset, the bytes
 *       deleted, the 50 credits refunded, one render
 *   3 · the landed question cannot be answered — no refund, no delete, the
 *       operation left `running` for the sweep, and the sweep's own question
 *       (`retriedViewLanded`, real) answers that it landed
 *
 * It cleans up every operation and asset row it wrote, in a `finally`, and
 * reports what it left behind. It borrows the dev fixture account
 * `verify-bot-local` and refuses to run without it.
 */
import "dotenv/config";
import { and, eq, inArray, like, or } from "drizzle-orm";

delete process.env.FAL_KEY;
delete process.env.OPENROUTER_API_KEY;
delete process.env.GEMINI_API_KEY;

const { generationOperations, modelAssets, models, users } = await import("../drizzle/schema");
const { commitRetriedViewAsset, retriedViewLanded } = await import("../server/db/castingV2ViewRetry");
const { getDb } = await import("../server/db/connection");
const { retryCastView } = await import("../server/castingV2/viewRetryService");
const { assertOneWorld } = await import("./lib/worldGuard.mts");

assertOneWorld(["DATABASE_URL"]);

const db = await getDb();
if (!db) throw new Error("no database");

const [bot] = await db
  .select({ id: users.id, frozenAt: users.frozenAt })
  .from(users)
  .where(or(like(users.openId, "verify-bot%"), like(users.email, "verify-bot%")))
  .limit(1);
if (!bot) throw new Error("no verify-bot fixture account in this world — refusing to borrow a person's");
if (bot.frozenAt) throw new Error("verify-bot is frozen in this world — not clearing a shared row; stopping");
const [cast] = await db
  .select({ id: models.id, userId: models.userId })
  .from(models)
  .where(and(eq(models.userId, bot.id), eq(models.status, "active")))
  .limit(1);
if (!cast) throw new Error("the verify-bot account has no active Cast to land a view on");
console.log(`borrowing Cast ${cast.id} (user ${cast.userId}, verify-bot) — read only`);

const MARK = "_2080-lost-ack";
/* The real Try again price, in the ledger's units (it DISPLAYS as 50). */
const { CASTING_V2_VIEW_RETRY_PRICE_CREDITS: PRICE } = await import("../server/casting/castingCreditCosts");
const createdOperations: string[] = [];
let failures = 0;
const check = (name: string, actual: unknown, expected: unknown): void => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) console.log(`        expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
};

const newOperation = async (): Promise<string> => {
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
    plannedCredits: PRICE,
    heartbeatAt: new Date(),
    leaseExpiresAt: new Date(Date.now() + 10 * 60_000),
  });
  return id;
};

const rowsFor = async (operationId: string) => {
  const rows = await db
    .select({ id: modelAssets.id, storageKey: modelAssets.storageKey, provenance: modelAssets.provenance })
    .from(modelAssets)
    .where(eq(modelAssets.modelId, cast.id));
  return rows.filter((row) => (row.provenance as { retryOperationId?: unknown } | null)?.retryOperationId === operationId);
};

const statusOf = async (operationId: string) => (await db
  .select({ status: generationOperations.status })
  .from(generationOperations)
  .where(eq(generationOperations.id, operationId)))[0]?.status;

async function drive(operationId: string, mode: "lost-ack" | "failed" | "undecided") {
  const key = `scratch/${MARK}/${crypto.randomUUID()}.png`;
  const dropped: string[] = [];
  const refunds: number[] = [];
  let renders = 0;
  const deps = {
    readSlots: async () => ({
      modelId: cast.id,
      status: "ready" as const,
      slots: [{
        angle: "closeUp",
        label: "Close-up",
        state: "failed-refunded",
        url: null,
        note: "This view didn't arrive — refunded",
        refundedCredits: 0,
        retry: { priceCredits: PRICE, reason: "refunded" },
      }],
      deliveredOutfitKeys: {},
      freeRetrySpentAngles: [],
    }),
    readSource: async () => ({
      modelId: cast.id,
      anchorStorageKey: `scratch/${MARK}/anchor.png`,
      identityRevisionId: "lost-ack-revision",
      identityText: "lost-ack",
      technicalSchema: { subject: { sex: "female" } },
      briefText: null,
      candidateId: null,
      candidatePublicId: null,
      selectedVariantId: null,
      anchorDeltas: null,
    }),
    readAnchorBytes: async () => ({ bytes: Buffer.from("anchor"), contentType: "image/png" }),
    begin: async () => ({ type: "execute" as const, operationId }),
    markRunning: async () => ({ operationId, chargeReferenceId: `op:${operationId}:charge` }),
    deduct: async () => ({ success: true }),
    refund: async (_u: number, amount: number, _d: string, reference: string) => {
      refunds.push(amount);
      return { recorded: true, amount, reference, duplicate: false };
    },
    commitRetried: async (request: Parameters<typeof commitRetriedViewAsset>[0]) => {
      if (mode !== "failed") {
        await commitRetriedViewAsset({ ...request, provenance: { ...request.provenance, _disposable: MARK } });
      }
      throw new Error("Connection lost: The server closed the connection.");
    },
    ...(mode === "undecided"
      ? { retriedLanded: async () => { throw new Error("Connection lost again"); } }
      : {}),
    identityEngine: () => ({
      generateView: async () => {
        renders += 1;
        return { bytes: Buffer.from("view"), contentType: "image/png", provenance: { model: "test", provider: "test" } };
      },
    }),
    judge: () => async () => ({
      pass: true,
      method: "model",
      axes: { identity: { pass: true, note: "" }, intact: { pass: true, note: "" }, people: { pass: true, note: "" } },
    }),
    storeImage: async () => ({ key, url: `https://example.invalid/${key}` }),
    deleteObject: async (dropKey: string) => {
      dropped.push(dropKey);
      return { success: true as const };
    },
    wait: async () => undefined,
  } as never;

  let result: Awaited<ReturnType<typeof retryCastView>> | null = null;
  let thrown: string | null = null;
  try {
    result = await retryCastView(deps, {
      userId: cast.userId,
      clientRequestId: crypto.randomUUID(),
      castId: "KI-LOST-ACKS-2080-0000",
      angle: "closeUp",
    });
  } catch (error) {
    thrown = (error as Error).message;
  }
  return { key, dropped, refunds, renders, result, thrown };
}

try {
  console.log("\n1 · THE CARD — the commit lands, then the call throws");
  const op1 = await newOperation();
  const r1 = await drive(op1, "lost-ack");
  const rows1 = await rowsFor(op1);
  if (r1.thrown) console.log("  threw:", r1.thrown);
  check("delivered", r1.result?.outcome, "ready");
  check("nothing refunded", r1.refunds, []);
  check("exactly one asset names the operation", rows1.length, 1);
  check("it points at the bytes this attempt stored", rows1[0]?.storageKey, r1.key);
  check("those bytes were never deleted", r1.dropped.includes(r1.key), false);
  check("one render — never another frame", r1.renders, 1);
  check("the receipt was sealed (its status is succeeded for either outcome; the outcome is checked above)", await statusOf(op1), "succeeded");

  console.log("\n2 · CONTROL — the commit truly fails");
  const op2 = await newOperation();
  const r2 = await drive(op2, "failed");
  check("not delivered", r2.result?.outcome, "failed");
  check("the Try again price goes back", r2.refunds, [PRICE]);
  check("no asset names the operation", (await rowsFor(op2)).length, 0);
  check("the bytes were deleted", r2.dropped, [r2.key]);
  check("one render — never another frame", r2.renders, 1);

  console.log("\n3 · the landed question cannot be answered");
  const op3 = await newOperation();
  const r3 = await drive(op3, "undecided");
  check("the call throws to the caller", r3.thrown?.includes("could not be read") ?? false, true);
  check("nothing refunded", r3.refunds, []);
  check("nothing deleted", r3.dropped, []);
  check("the operation is left running for the sweep", await statusOf(op3), "running");
  check("the sweep's own question answers it landed", await retriedViewLanded({
    userId: cast.userId, modelId: cast.id, operationId: op3,
  }), true);
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
