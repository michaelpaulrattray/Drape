/**
 * `claimReferral` UNDER THE ONE-CLAIM-PER-USER INDEX (#1010's review, finding 1).
 *
 * The helper read "has this user ever been referred?" with a SELECT and then
 * INSERTed, and nothing in the database stood behind the read — invariant 1's
 * exact class. #1010 made the race ordinary: the claim hook is mounted at the
 * app root, fires on login in every open tab, and `completeReferral` pays the
 * welcome bonus once PER ROW. Migration 0064 puts `uq_referrals_referred_user`
 * on the column so the second INSERT fails; this file proves the helper turns
 * that failure into the same answer the read gives, with the same audit row.
 *
 * Driven at the helper, with the database mocked: a suite that only ran
 * through the read would pass whether or not the index existed, and the
 * duplicate-key road is the one a race actually takes. `server/referral.test.ts`
 * mocks this whole module and cannot see either road.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetDb = vi.fn();
vi.mock("./connection", () => ({ getDb: () => mockGetDb() }));

const mockLogAuditEvent = vi.fn(async () => undefined);
vi.mock("../auditLog", () => ({ logAuditEvent: (...args: unknown[]) => mockLogAuditEvent(...(args as [])) }));

import { AUDIT_ACTIONS } from "../../shared/auditActions";
import { claimReferral } from "./referrals";

const REFERRER = { id: 7, name: "Referrer", email: "r@example.com" };
const REFERRED_USER_ID = 99;
const CODE = "DRAPE-ABC234";

/**
 * A database whose SELECTs answer in order and whose INSERT does what the arm
 * says. `claimReferral` makes exactly two `.limit(1)` reads before the insert
 * when no IP is passed: the referrer lookup, then the existing-claim check.
 */
function fakeDb(insertOutcome: { reject?: unknown }) {
  const limit = vi.fn()
    .mockResolvedValueOnce([REFERRER]) // getUserByReferralCode
    .mockResolvedValueOnce([]);        // existing-claim read: nothing yet
  const selectChain = { from: vi.fn(), where: vi.fn(), limit };
  selectChain.from.mockReturnValue(selectChain);
  selectChain.where.mockReturnValue(selectChain);

  const values = insertOutcome.reject
    ? vi.fn().mockRejectedValue(insertOutcome.reject)
    : vi.fn().mockResolvedValue(undefined);
  const insert = vi.fn(() => ({ values }));

  const updateChain = { set: vi.fn(), where: vi.fn().mockResolvedValue(undefined) };
  updateChain.set.mockReturnValue(updateChain);
  const update = vi.fn(() => updateChain);

  return { select: vi.fn(() => selectChain), insert, update, _values: values, _update: update };
}

/** The shape mysql2 raises when a UNIQUE key refuses a row. */
const DUPLICATE_KEY = Object.assign(new Error("Duplicate entry '99' for key 'uq_referrals_referred_user'"), {
  code: "ER_DUP_ENTRY",
  errno: 1062,
});

describe("claimReferral under uq_referrals_referred_user (#1010 review)", () => {
  beforeEach(() => {
    mockGetDb.mockReset();
    mockLogAuditEvent.mockClear();
  });

  it("CONTROL — a first claim inserts and succeeds", async () => {
    const db = fakeDb({});
    mockGetDb.mockResolvedValue(db);

    const result = await claimReferral(REFERRED_USER_ID, CODE);

    expect(result).toEqual({ success: true });
    expect(db._values).toHaveBeenCalledWith(expect.objectContaining({
      referrerUserId: REFERRER.id,
      referredUserId: REFERRED_USER_ID,
      status: "signed_up",
    }));
    expect(db._update).toHaveBeenCalledTimes(1);
    expect(mockLogAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
      action: AUDIT_ACTIONS.REFERRAL_CLAIMED,
    }));
  });

  it("the tab that loses the race — the read said none, the index says one — gets 'already used' and the same audit row", async () => {
    const db = fakeDb({ reject: DUPLICATE_KEY });
    mockGetDb.mockResolvedValue(db);

    const result = await claimReferral(REFERRED_USER_ID, CODE);

    expect(result).toEqual({ success: false, error: "You have already used a referral code" });
    /* Nothing after the refused insert runs: the user row is not re-pointed
       at a referrer whose referral row does not exist. */
    expect(db._update).not.toHaveBeenCalled();
    expect(mockLogAuditEvent).toHaveBeenCalledTimes(1);
    expect(mockLogAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
      userId: REFERRED_USER_ID,
      action: AUDIT_ACTIONS.REFERRAL_MULTI_CLAIM_BLOCKED,
      resourceId: CODE,
      severity: "warning",
      metadata: { attemptedCode: CODE, existingReferralId: null },
    }));
  });

  it("the duplicate-key read walks the cause chain drizzle wraps the driver error in", async () => {
    const wrapped = Object.assign(new Error("Failed query: insert into referrals …"), { cause: DUPLICATE_KEY });
    const db = fakeDb({ reject: wrapped });
    mockGetDb.mockResolvedValue(db);

    await expect(claimReferral(REFERRED_USER_ID, CODE)).resolves.toEqual({
      success: false,
      error: "You have already used a referral code",
    });
  });

  it("NEGATIVE CONTROL — any other insert failure is NOT read as 'already used'; it surfaces", async () => {
    const db = fakeDb({ reject: Object.assign(new Error("Lock wait timeout exceeded"), { code: "ER_LOCK_WAIT_TIMEOUT", errno: 1205 }) });
    mockGetDb.mockResolvedValue(db);

    await expect(claimReferral(REFERRED_USER_ID, CODE)).rejects.toThrow("Lock wait timeout exceeded");
    expect(mockLogAuditEvent).not.toHaveBeenCalledWith(expect.objectContaining({
      action: AUDIT_ACTIONS.REFERRAL_MULTI_CLAIM_BLOCKED,
    }));
  });
});
