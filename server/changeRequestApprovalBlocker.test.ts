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
 * ⚠ **THE TARGET'S STATE IS THE SECOND SWEEP, BELOW (#991).** The first one
 * varies the request's own columns over a healthy target. The second varies the
 * TARGET — a missing account, an admin, nobody suspended, no credit balance, an
 * unreadable charge, a spent balance — and holds `changeRequestStateBlocker`
 * (`lib/adminActions/approvalStateBlocker.ts`) to refusing exactly what the
 * executors refuse before writing, in both directions. The Stripe executor's
 * two state refusals are the only ones it may let through, and they are named.
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
  healthyTarget();
});

/** Every double answering as a target every executor accepts. `vi.clearAllMocks`
 *  clears calls, not implementations, so a sweep that varies a double must put
 *  this back before its next reading. */
function healthyTarget() {
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
}

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

/**
 * A target that has changed since the request was raised, expressed as the
 * doubles the executors actually read. `answeredWithoutWriting` names a write
 * double that, in that state, returns having written nothing — `addCredits`
 * finds no balance row to update and returns before its ledger insert — so
 * reaching it does not count as a write.
 */
type TargetState = { name: string; apply: () => void; answeredWithoutWriting?: ReturnType<typeof vi.fn>[] };

const TARGET_STATES: TargetState[] = [
  { name: "account missing", apply: () => db.getUserById.mockResolvedValue(null) },
  {
    name: "target is an admin",
    apply: () => db.getUserById.mockResolvedValue({ id: 42, role: "admin", email: "a@example.com", name: "Admin", suspendedAt: new Date() }),
  },
  {
    name: "target not suspended",
    apply: () => db.getUserById.mockResolvedValue({ id: 42, role: "user", email: "u@example.com", name: "User", suspendedAt: null }),
  },
  {
    name: "no credit balance row",
    apply: () => {
      db.getUserCredits.mockResolvedValue(null);
      db.addCredits.mockResolvedValue({ success: false, error: "User credits not found" });
      db.adjustUserCredits.mockResolvedValue({ success: false, error: "User credits record not found" });
    },
    answeredWithoutWriting: [db.addCredits],
  },
  { name: "charge unreadable", apply: () => stripe.getSessionChargedAmountCents.mockResolvedValue(null) },
  { name: "balance spent", apply: () => stripe.calculateProportionalRefund.mockReturnValue({ refundAmountCents: 0, creditsToDeduct: 0 }) },
];

/**
 * The state refusals the review procedure is DECLARED to leave to the executor:
 * both need a live Stripe read before the CAS, and the second is the refusal
 * that stops a zero proportional refund becoming a full one (PR #704).
 */
const LEFT_TO_THE_EXECUTOR = ["stripe_refund × charge unreadable", "stripe_refund × balance spent"];

async function refusesInState(type: string, state: TargetState): Promise<string | null> {
  vi.clearAllMocks();
  healthyTarget();
  state.apply();
  const { executeChangeRequestAction } = await import("./lib/adminActions/changeRequestActions");
  const request = complete(type);
  const { targetId, params } = approvalExecution(request as never);
  try {
    await executeChangeRequestAction(
      {
        action: CHANGE_REQUEST_ACTION_BY_TYPE[type as keyof typeof CHANGE_REQUEST_ACTION_BY_TYPE],
        targetId,
        params,
        resolvedBy: "Admin",
      },
      CTX,
    );
    return null;
  } catch (error) {
    const exempt = state.answeredWithoutWriting ?? [];
    const wrote = WRITES.some((w) => !exempt.includes(w) && w.mock.calls.length > 0);
    return wrote ? null : String((error as Error).message);
  }
}

async function stateBlockerAnswers(type: string, state: TargetState) {
  vi.clearAllMocks();
  healthyTarget();
  state.apply();
  const { changeRequestStateBlocker } = await import("./lib/adminActions/approvalStateBlocker");
  return changeRequestStateBlocker(complete(type));
}

describe("every TARGET STATE an executor refuses on is refused BEFORE the compare-and-swap (#991)", () => {
  const types = Object.keys(CHANGE_REQUEST_ACTION_BY_TYPE);

  it("CONTROL — over a healthy target the state check refuses nothing", async () => {
    /* Without this, a check that refused every approval would pass the sweep
       below on its refusal arm alone. */
    for (const type of types) {
      const { changeRequestStateBlocker } = await import("./lib/adminActions/approvalStateBlocker");
      expect(await changeRequestStateBlocker(complete(type)), `a healthy ${type} was refused`).toBeNull();
    }
  });

  it("the check refuses EXACTLY what the executor refuses before writing — no wedge, no over-refusal, and only the declared Stripe pair left behind", async () => {
    const wedges: string[] = [];
    const overRefusals: string[] = [];
    const leftBehind: string[] = [];
    let refusals = 0;
    for (const type of types) {
      for (const state of TARGET_STATES) {
        const label = `${type} × ${state.name}`;
        const refused = await refusesInState(type, state);
        const blocked = await stateBlockerAnswers(type, state);
        if (refused) refusals += 1;
        if (refused && !blocked) {
          if (LEFT_TO_THE_EXECUTOR.includes(label)) leftBehind.push(label);
          else wedges.push(`${label} → executor: "${refused}"`);
        }
        if (!refused && blocked) overRefusals.push(`${label} → refused as ${blocked.state}, but the executor would have acted`);
      }
    }
    expect(
      wedges,
      "these approvals would pass the review procedure, move to pending_execution, and then be refused by the executor — stuck at 'Outcome unconfirmed'",
    ).toEqual([]);
    expect(overRefusals, "the check refuses an approval the executor would have carried out").toEqual([]);
    expect(leftBehind.sort(), "the declared executor-only refusals no longer refuse — re-read the Stripe executor").toEqual(
      [...LEFT_TO_THE_EXECUTOR].sort(),
    );
    /* Five user-targeted types × account missing, plus admin, not suspended,
       two credit types × no balance, plus the Stripe pair = 11. */
    expect(refusals, "the sweep met fewer executor state refusals than the card measured").toBeGreaterThanOrEqual(11);
  });

  it("NEGATIVE CONTROL — with the unsuspend state forgotten, the same comparison names the wedge", async () => {
    /* Drives the sweep's own comparison with a check that has forgotten
       `target-not-suspended`, which is exactly the pre-#991 product on the one
       road reachable today. */
    const forgetful = async (type: string, state: TargetState) =>
      type === "unsuspend_user" && state.name === "target not suspended" ? null : stateBlockerAnswers(type, state);
    const wedges: string[] = [];
    for (const state of TARGET_STATES) {
      const refused = await refusesInState("unsuspend_user", state);
      if (refused && !(await forgetful("unsuspend_user", state))) wedges.push(state.name);
    }
    expect(wedges).toEqual(["target not suspended"]);
  });
});
