/*
 * ⚠ FIVE OF THIS FILE'S SEVENTEEN ARMS CALLED A MOCK THIS FILE HAD JUST
 * CONFIGURED AND ASSERTED WHAT IT GOT BACK. Repaired 2026-09-10 (#697, the
 * law-7 class of #681), one file after `moderator.test.ts` and
 * `adminSecurity.test.ts`.
 *
 *   it("should call sendReferralInviteEmail with correct params", async () => {
 *     mockSendReferralInviteEmail.mockResolvedValue({ success: true });
 *     const result = await sendReferralInviteEmail({ inviteeEmail: "friend@…", … });
 *     expect(result.success).toBe(true);
 *     expect(mockSendReferralInviteEmail).toHaveBeenCalledWith({ inviteeEmail: "friend@…", … });
 *   });
 *
 * The test told the mock what to return, called the mock, and asserted the
 * return it had chosen and the argument it had just passed. No line of
 * `referralRouter` runs in it. Delete `sendInvite` from the product and it
 * stays green. Three more of the same shape stood under "Referral Expiration
 * Job", against a mocked `expireStalePendingReferrals`.
 *
 * ⚠ THIS FILE HAD ALREADY BEEN REPAIRED ONCE AND THESE SURVIVED IT. PR #698's
 * reviewer found the `getFlaggedReferrals` describe here as a 13th file the
 * card's table missed, and it was removed — but the reviewer was reading the
 * one describe it had been pointed at, and the two below it were the same
 * shape against different modules. **A file is not clean because its named
 * instance was fixed**; the whole file gets the per-arm read, which is what
 * #697 asks for and is why this second pass exists.
 *
 * WHAT REPLACED THEM, and the rule applied to each:
 *
 * - **The invite email → DRIVEN through `referralRouter.sendInvite`.** The
 *   mocked Klaviyo sender stays, but it is now the FAR END of the product
 *   rather than the subject: every arm calls the real procedure and then reads
 *   the argument the ROUTER passed on (law 5, assert at the wire). The count
 *   control in `soleCallTo` is what keeps the two apart — a procedure that
 *   never reached its sender has ZERO calls, which `toHaveBeenCalledWith`
 *   alone would report as agreement.
 *
 * - **The disposable-address block → DRIVEN, and it was a real gap.** The
 *   twelve arms in the first describe exercise `isDisposableEmail` itself and
 *   are honest, but nothing anywhere proved the PROCEDURE consults it. Removing
 *   the check from `routes/referral.ts` left all twelve green. That arm is the
 *   one below that reddens.
 *
 * - **The expiration job → DELETED, not rewritten.** Its subject is
 *   `expireStalePendingReferrals`, and its only caller is an inline closure
 *   inside `server.listen` in `server/_core/index.ts` — not exported, not
 *   reachable without booting the server, and the function itself needs a
 *   database (`vitest.setup.ts` strips `DATABASE_URL` on purpose). So there is
 *   no honest unit arm for it, and three arms pretending otherwise were worse
 *   than none. The gap is stated here rather than papered over: **the daily
 *   referral-expiry job has no test on any road.**
 *
 * - **Approval, suspension and anonymous callers are NOT re-driven here.**
 *   `server/approvalGate.test.ts` drives them on `protectedProcedure` itself
 *   and pins the exempt list, which is the altitude that cannot drift per
 *   router. Re-stating them on this one procedure is the mirror
 *   `moderator.test.ts` was repaired for.
 *
 * THE BAR: every arm below was proven by SABOTAGING THE PRODUCT and watching
 * exactly it redden — the receipts are in the PR, not in this comment.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Feature 1: Disposable Email Blocking ──

import { isDisposableEmail } from "./security/disposableEmails";

describe("Disposable Email Blocking on Signup", () => {
  it("should block guerrillamail.com", () => {
    expect(isDisposableEmail("user@guerrillamail.com")).toBe(true);
  });

  it("should block tempmail.com", () => {
    expect(isDisposableEmail("user@tempmail.com")).toBe(true);
  });

  it("should block mailinator.com", () => {
    expect(isDisposableEmail("user@mailinator.com")).toBe(true);
  });

  it("should block yopmail.com", () => {
    expect(isDisposableEmail("user@yopmail.com")).toBe(true);
  });

  it("should block throwaway.email", () => {
    expect(isDisposableEmail("user@throwaway.email")).toBe(true);
  });

  it("should block sharklasers.com (guerrillamail alias)", () => {
    expect(isDisposableEmail("user@sharklasers.com")).toBe(true);
  });

  it("should allow gmail.com", () => {
    expect(isDisposableEmail("user@gmail.com")).toBe(false);
  });

  it("should allow outlook.com", () => {
    expect(isDisposableEmail("user@outlook.com")).toBe(false);
  });

  it("should allow custom business domains", () => {
    expect(isDisposableEmail("ceo@mycompany.com")).toBe(false);
  });

  it("should be case-insensitive", () => {
    expect(isDisposableEmail("user@GUERRILLAMAIL.COM")).toBe(true);
    expect(isDisposableEmail("user@GmAiL.cOm")).toBe(false);
  });

  it("should handle empty string", () => {
    expect(isDisposableEmail("")).toBe(false);
  });

  it("should handle email without @ symbol", () => {
    expect(isDisposableEmail("notanemail")).toBe(false);
  });
});

// ── Features 3 and 4: the invite a customer actually sends ──

vi.mock("./klaviyo", () => ({
  sendReferralInviteEmail: vi.fn(),
  createOrUpdateProfile: vi.fn(),
  trackEvent: vi.fn(),
}));

/*
 * `routes/referral.ts` imports these from the `../db` barrel, and the barrel
 * re-exports them with `export { … } from "./referrals"` — so mocking the
 * declaring module is what intercepts them. The list mirrors the barrel's own
 * re-export block: a name missing here is a barrel that fails to load, not a
 * silently real function.
 */
vi.mock("./db/referrals", () => ({
  expireStalePendingReferrals: vi.fn(),
  getOrCreateReferralCode: vi.fn(),
  getUserByReferralCode: vi.fn(),
  claimReferral: vi.fn(),
  redeemReferralCode: vi.fn(),
  completeReferral: vi.fn(),
  creditReferrerOnPaidAction: vi.fn(),
  getReferralCreditsEarned: vi.fn(),
  getReferralStats: vi.fn(),
  getReferralHistory: vi.fn(),
  recordEmailInvite: vi.fn(),
  isValidReferralCodeFormat: vi.fn(),
}));

import { referralRouter } from "./routes/referral";
import { sendReferralInviteEmail } from "./klaviyo";
import { getOrCreateReferralCode, recordEmailInvite } from "./db/referrals";
/* The reward the product declares, not a number typed on the line above it —
   the arm this replaces asserted `12500` against the `12500` it had just
   handed the mock, so the two could never disagree. */
import { REFERRAL_REWARD_CREDITS } from "../drizzle/schema";

const klaviyo = vi.mocked(sendReferralInviteEmail);
const codeReader = vi.mocked(getOrCreateReferralCode);
const inviteWriter = vi.mocked(recordEmailInvite);

const CALLER_IP = "203.0.113.7";
const ORIGIN = "https://klieglabs.com";

/*
 * A FRESH USER ID PER CALLER, and it is not tidiness.
 *
 * `sendInvite`'s rate limit is keyed on `${ctx.user.id}` in a module-level map
 * that no export can clear, so a shared id would let one arm's invites count
 * against the next one's — and the limit arm below would pass or fail
 * depending on the order vitest happened to run them in.
 */
let nextUserId = 9000;

function callerFor(overrides: Record<string, unknown> = {}) {
  const user = {
    id: nextUserId++,
    email: "referrer@example.com",
    name: "John Doe",
    approved: true,
    suspendedAt: null,
    lockedUntil: null,
    ...overrides,
  };
  const caller = referralRouter.createCaller({
    user,
    req: { ip: CALLER_IP, headers: { origin: ORIGIN } },
  } as never);
  return { user, caller };
}

/*
 * What the mocked sender was HANDED, with a population control on the way past.
 *
 * The difference between this and the shape this file was repaired for is WHO
 * CALLED IT: every use below drives the real procedure first. `calls.length`
 * is the control — a refusal that never reaches Klaviyo has zero calls, and an
 * argument matcher on zero calls is vacuously satisfiable.
 */
function soleCallTo(fn: unknown): Record<string, unknown> {
  const { calls } = (fn as { mock: { calls: unknown[][] } }).mock;
  if (calls.length !== 1) {
    throw new Error(`expected the procedure to reach its collaborator exactly once, saw ${calls.length}`);
  }
  return calls[0][0] as Record<string, unknown>;
}

/*
 * A `createCaller` throws the RAW `TRPCError`, so the code is on `.code`.
 * `.data.code` is filled by the error formatter on the way onto the wire, and
 * reading only that gives every refusal an empty string — which compares equal
 * to nothing and would have made all four refusal arms look like the product
 * failing to refuse. Both are read, in that order.
 */
async function refusalFrom(run: () => Promise<unknown>): Promise<{ code: string; message: string }> {
  try {
    await run();
  } catch (error) {
    const raw = error as { code?: string; data?: { code?: string } };
    return { code: raw.code ?? raw.data?.code ?? "", message: (error as Error).message };
  }
  throw new Error("expected the procedure to refuse, and it returned");
}

describe("referral.sendInvite — driven through the real procedure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    codeReader.mockResolvedValue("DRAPE-ABC123");
    inviteWriter.mockResolvedValue({ success: true });
    klaviyo.mockResolvedValue({ success: true });
  });

  it("hands Klaviyo the invitee, the referrer, the share link and the declared reward", async () => {
    const { caller } = callerFor();

    await expect(caller.sendInvite({ email: "friend@example.com" })).resolves.toEqual({ sent: true });

    expect(soleCallTo(klaviyo)).toEqual({
      inviteeEmail: "friend@example.com",
      referrerName: "John Doe",
      referralLink: `${ORIGIN}?ref=DRAPE-ABC123`,
      rewardCredits: REFERRAL_REWARD_CREDITS,
    });
  });

  /* Invariant 3: the owner comes from the session, never from the input. */
  it("records the invite against the caller's own id and ip, before any email", async () => {
    const { user, caller } = callerFor();

    await caller.sendInvite({ email: "friend@example.com" });

    expect(inviteWriter).toHaveBeenCalledWith(user.id, "friend@example.com", CALLER_IP);
    expect(codeReader).toHaveBeenCalledWith(user.id, CALLER_IP);
  });

  /*
   * THE ARM THE TWELVE PURE-FUNCTION ARMS ABOVE DO NOT GIVE YOU. They prove
   * `isDisposableEmail` knows guerrillamail; this proves the procedure ASKS.
   */
  it("refuses a disposable address at the procedure, and sends nothing", async () => {
    const { caller } = callerFor();

    const refusal = await refusalFrom(() => caller.sendInvite({ email: "spammer@guerrillamail.com" }));

    expect(refusal.code).toBe("BAD_REQUEST");
    expect(refusal.message).toBe("Please use a permanent email address");
    expect(inviteWriter).not.toHaveBeenCalled();
    expect(klaviyo).not.toHaveBeenCalled();
  });

  it("refuses a self-invite whatever the casing, and sends nothing", async () => {
    const { caller } = callerFor({ email: "Referrer@Example.com" });

    const refusal = await refusalFrom(() => caller.sendInvite({ email: "REFERRER@example.com" }));

    expect(refusal.code).toBe("BAD_REQUEST");
    expect(refusal.message).toBe("You cannot invite yourself");
    expect(klaviyo).not.toHaveBeenCalled();
  });

  /*
   * A duplicate invite must not become a second email — the writer is the thing
   * that knows an address was already invited, so its refusal has to stop the
   * send rather than be logged past.
   */
  it("refuses when the invite could not be recorded, and sends nothing", async () => {
    inviteWriter.mockResolvedValue({ success: false, error: "Already invited this email" });
    const { caller } = callerFor();

    const refusal = await refusalFrom(() => caller.sendInvite({ email: "friend@example.com" }));

    expect(refusal.code).toBe("BAD_REQUEST");
    expect(refusal.message).toBe("Already invited this email");
    expect(klaviyo).not.toHaveBeenCalled();
  });

  /*
   * Delivery is deliberately non-blocking (`routes/referral.ts`: "invite is
   * recorded regardless"). The arm this replaces claimed to cover "Klaviyo API
   * failure gracefully" and only proved that a rejected promise it had created
   * itself rejected.
   */
  it("still reports the invite sent when Klaviyo rejects it", async () => {
    klaviyo.mockRejectedValue(new Error("Klaviyo API error: 500"));
    const { caller } = callerFor();

    await expect(caller.sendInvite({ email: "friend@example.com" })).resolves.toEqual({ sent: true });
    expect(inviteWriter).toHaveBeenCalledTimes(1);
    /* Self-contained on the reviewer's note (PR #739): without this the arm
       would stay green if the send were deleted outright. Coverage held
       collectively either way — the first arm's `soleCallTo` reddens a deleted
       send — but an arm that needs its neighbours to mean anything is one
       refactor away from meaning nothing. */
    expect(klaviyo).toHaveBeenCalledTimes(1);
  });

  /* Invariant 6: a rate limit is a real TOO_MANY_REQUESTS, not a 200 carrying
     an error field the client cannot tell from a validation failure. */
  it("returns a real TOO_MANY_REQUESTS on the eleventh invite of the day", async () => {
    const { caller } = callerFor();

    for (let i = 0; i < 10; i++) {
      await caller.sendInvite({ email: `friend-${i}@example.com` });
    }

    const refusal = await refusalFrom(() => caller.sendInvite({ email: "eleventh@example.com" }));

    expect(refusal.code).toBe("TOO_MANY_REQUESTS");
    expect(klaviyo).toHaveBeenCalledTimes(10);
  });
});
