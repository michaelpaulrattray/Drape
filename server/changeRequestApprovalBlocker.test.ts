/**
 * The review procedure's pre-CAS refusal must cover EVERY field an executor
 * refuses on before it writes anything — or the wedge comes back (#921, #923).
 *
 * `shared/changeRequestApproval.ts` declares which fields each change-request
 * type needs, and `reviewChangeRequest` refuses an approval missing one while
 * the request is still `pending`. That declaration is a second list beside the
 * executors' own `throw`s, and a second list drifts (working law 4). So this
 * file does not trust it: it derives the population from the TABLE and asks
 * the REAL executors.
 *
 * For every type the router executes, and every column `change_requests`
 * declares without `.notNull()`, it takes a complete request, empties that one
 * column (null, 0, empty string), builds the executor's input through the
 * router's own `approvalExecution`, and runs the real `executeChangeRequestAction`
 * with the database and Stripe doubled. If the executor THROWS having written
 * NOTHING — the shape that, behind the compare-and-swap, strands a request at
 * "Outcome unconfirmed" — then the blocker must have refused that request.
 *
 * ⚠ **What it does not see, stated rather than implied:** refusals that depend
 * on the target row's STATE (a deleted account, an admin target, an unsuspend
 * on somebody no longer suspended, an unreadable Stripe charge). The doubles
 * here always answer with a healthy row, so those executors never refuse in
 * this sweep. They wedge the same way and are their own card.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, it, expect, vi, beforeEach } from "vitest";

const db = {
  getUserById: vi.fn(),
  getUserCredits: vi.fn(),
  suspendUser: vi.fn(),
  unsuspendUser: vi.fn(),
  addCredits: vi.fn(),
  adjustUserCredits: vi.fn(),
  blockIp: vi.fn(),
  unblockIp: vi.fn(),
  updateChangeRequestStatus: vi.fn(),
};

const stripe = {
  issueStripeRefund: vi.fn(),
  calculateProportionalRefund: vi.fn(),
  getSessionChargedAmountCents: vi.fn(),
};

vi.mock("./db", () => db);
vi.mock("./stripe/stripeService", () => stripe);
vi.mock("./auditLog", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./auditLog")>();
  return { ...actual, logAuditEvent: vi.fn().mockResolvedValue(undefined) };
});
vi.mock("./security/adminSecurity", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./security/adminSecurity")>();
  return { ...actual, writeImmutableLog: vi.fn().mockResolvedValue(undefined) };
});

import { CHANGE_REQUEST_ACTION_BY_TYPE } from "@shared/changeRequestLabels";
import { changeRequestApprovalBlocker } from "@shared/changeRequestApproval";
import { approvalExecution } from "./lib/adminActions/approvalExecution";

const CTX = {
  user: { id: 2, name: "Admin", email: "admin@example.com", role: "admin" },
  req: { headers: { "user-agent": "test" }, socket: {} },
  res: {},
} as never;

/** Every double that WRITES — a refusal that reached none of these moved nothing. */
const WRITES = [
  db.suspendUser,
  db.unsuspendUser,
  db.addCredits,
  db.adjustUserCredits,
  db.blockIp,
  db.unblockIp,
  db.updateChangeRequestStatus,
  stripe.issueStripeRefund,
];

beforeEach(() => {
  vi.clearAllMocks();
  db.getUserById.mockResolvedValue({ id: 42, role: "user", email: "u@example.com", name: "User", suspendedAt: new Date() });
  db.getUserCredits.mockResolvedValue({ balance: 500 });
  db.suspendUser.mockResolvedValue({ success: true });
  db.unsuspendUser.mockResolvedValue({ success: true });
  db.addCredits.mockResolvedValue({ success: true, newBalance: 600 });
  db.adjustUserCredits.mockResolvedValue({ success: true, newBalance: 400 });
  db.blockIp.mockResolvedValue({ success: true });
  db.unblockIp.mockResolvedValue(true);
  db.updateChangeRequestStatus.mockResolvedValue({ success: true });
  stripe.issueStripeRefund.mockResolvedValue({ success: true, refundId: "re_1" });
  stripe.getSessionChargedAmountCents.mockResolvedValue(1000);
  stripe.calculateProportionalRefund.mockReturnValue({ refundAmountCents: 500, creditsToDeduct: 50 });
});

/** The nullable columns of `change_requests`, read from the table declaration. */
function nullableColumns(): string[] {
  const schema = fs.readFileSync(path.resolve(__dirname, "..", "drizzle", "schema.ts"), "utf8");
  const table = schema.slice(schema.indexOf('export const changeRequests = mysqlTable("change_requests"'));
  const body = table.slice(0, table.indexOf("\n});"));
  const out: string[] = [];
  for (const line of body.split("\n")) {
    const declared = line.match(/^\s{2}(\w+):\s*\w+\(/);
    if (declared && !line.includes(".notNull()")) out.push(declared[1]);
  }
  return out;
}

/** A request that every executor accepts: all per-type fields present. */
function complete(type: string) {
  return {
    id: 7,
    type,
    title: "A complete request",
    targetUserId: 42,
    targetUserName: "User",
    submittedByName: "Mod",
    evidenceSummary: "evidence",
    relatedAuditLogId: 3,
    creditAmount: 100,
    creditReason: "Goodwill",
    ipAddress: "203.0.113.77",
    stripeSessionId: "cs_test_1",
    refundType: "proportional",
    refundAmountCents: 500,
    originalCredits: 100,
    creditsToDeduct: 50,
    reviewedById: 1,
    reviewedByName: "Admin",
    reviewedAt: new Date(),
    reviewNotes: "ok",
    slackApprovalId: "x",
  } as Record<string, unknown> & { type: string; id: number; title: string; targetUserId: number };
}

/** Did the real executor refuse this request before writing anything? */
async function refusesBeforeWriting(request: ReturnType<typeof complete>): Promise<string | null> {
  vi.clearAllMocks();
  // Imported here, not at the top: the executor module reaches `./db`, and a
  // static import would load it before the doubles above exist.
  const { executeChangeRequestAction } = await import("./lib/adminActions/changeRequestActions");
  const { targetId, params } = approvalExecution(request as never);
  try {
    await executeChangeRequestAction(
      {
        action: CHANGE_REQUEST_ACTION_BY_TYPE[request.type as keyof typeof CHANGE_REQUEST_ACTION_BY_TYPE],
        targetId,
        params,
        resolvedBy: "Admin",
      },
      CTX,
    );
    return null;
  } catch (error) {
    return WRITES.some((w) => w.mock.calls.length > 0) ? null : String((error as Error).message);
  }
}

const EMPTY_VALUES: unknown[] = [null, 0, ""];

describe("every field an executor refuses on is refused BEFORE the compare-and-swap", () => {
  const types = Object.keys(CHANGE_REQUEST_ACTION_BY_TYPE);
  const columns = nullableColumns();

  it("the population readings are not empty", () => {
    expect(types.length, "no executed types read").toBeGreaterThanOrEqual(6);
    expect(columns.length, "the nullable-column reading found nothing").toBeGreaterThanOrEqual(8);
    expect(columns).toContain("creditAmount");
    expect(columns).toContain("originalCredits");
    expect(columns, "a notNull column read as nullable").not.toContain("targetUserId");
  });

  it("CONTROL — a complete request of every type is executed, not refused", async () => {
    /* Without this, a double that made every executor throw early would make
       every column look like a refusal, and the sweep below would pass only
       if the blocker refused everything. */
    for (const type of types) {
      expect(await refusesBeforeWriting(complete(type)), `${type} refused a complete request`).toBeNull();
      expect(changeRequestApprovalBlocker(complete(type)), `the blocker refused a complete ${type}`).toBeNull();
    }
  });

  it("no type × nullable column × empty value is refused by the executor while the blocker lets it through", async () => {
    const wedges: string[] = [];
    let refusals = 0;
    for (const type of types) {
      for (const column of columns) {
        for (const empty of EMPTY_VALUES) {
          const request = { ...complete(type), [column]: empty };
          const refused = await refusesBeforeWriting(request);
          if (!refused) continue;
          refusals += 1;
          if (!changeRequestApprovalBlocker(request)) {
            wedges.push(`${type}.${column} = ${JSON.stringify(empty)} → executor: "${refused}"`);
          }
        }
      }
    }
    expect(
      wedges,
      "these approvals would pass the review procedure, move the request to pending_execution, and then be refused by the executor — stuck at 'Outcome unconfirmed'",
    ).toEqual([]);
    /* The sweep must actually have met the executors' field refusals: two
       credit types × creditAmount × three empties, plus the Stripe pair. */
    expect(refusals, "the sweep met no executor refusals at all").toBeGreaterThanOrEqual(10);
  });

  it("NEGATIVE CONTROL — with the blocker's credit-amount requirement removed, the sweep names the wedge", async () => {
    /* Drives the same comparison with a blocker that has forgotten
       `creditAmount`, which is exactly the pre-#923 product. */
    const forgetful = (request: Record<string, unknown> & { type: string }) =>
      request.type === "add_credits" || request.type === "refund_credits"
        ? null
        : changeRequestApprovalBlocker(request);
    const wedges: string[] = [];
    for (const type of ["add_credits", "refund_credits"]) {
      const request = { ...complete(type), creditAmount: null };
      if ((await refusesBeforeWriting(request)) && !forgetful(request)) wedges.push(type);
    }
    expect(wedges).toEqual(["add_credits", "refund_credits"]);
  });
});
