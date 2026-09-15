/**
 * The TARGET'S STATE an approval needs before it may be marked as being acted
 * on (#991) — the sibling of `shared/changeRequestApproval.ts`, which asks the
 * same question of the request's own fields (#921, #923).
 *
 * `reviewChangeRequest` compare-and-swaps a sensitive request from `pending`
 * to `pending_execution` and only then runs its executor. An executor that
 * refuses at that point, having written nothing, leaves the request at
 * *"Outcome unconfirmed"*, where neither Approve nor Decline works again. The
 * field check closed that for a request missing its own data. This closes it
 * for a request whose TARGET has changed since a moderator raised it:
 *
 * | type | state | the executor's refusal |
 * |---|---|---|
 * | every user-targeted type | the account cannot be found | `User not found` |
 * | `suspend_user` | the target is an admin now | `Cannot suspend admin accounts` |
 * | `unsuspend_user` | the suspension was already lifted — **reachable today** from the Users page | `User is not suspended` |
 * | `add_credits` / `refund_credits` | the account has no credit balance row | `addCredits` → `User credits not found` |
 *
 * The last row is not a `throw` in the executor file: it is the write helper
 * returning before its ledger insert, which the executor then throws on. #991's
 * table counted nine from the executor file alone; the re-read at the helpers
 * made it ten.
 *
 * ⚠ **THIS IS A FIRST LINE, NOT THE ONLY ONE, AND IT CAN GO STALE.** The state
 * is read before the CAS, so something can still change between this read and
 * the executor's. The executors keep their own refusals for that race, and a
 * request that loses it wedges exactly as before. What this buys is the common
 * case: an admin opening a request whose person was already unsuspended is told
 * so while the request is still `pending` and still deniable.
 *
 * ⚠ **THE OTHER SHAPE WAS DECLINED ON PURPOSE.** Handing a refused request
 * back to `pending` from the executor's `catch` would reach the race too, but
 * that catch is the deliberate no-retry wedge: *an executor that failed midway
 * may already have moved money, and a retry road there is how a refund gets
 * issued twice.* Nothing here touches it.
 *
 * ## What is deliberately NOT here
 *
 * - **The Stripe executor's two state refusals** — the charge Stripe could not
 *   read, and a proportional refund that comes to nothing because the balance
 *   was spent. Checking either here would put a live Stripe call in front of
 *   the CAS, and the second is the refusal that stops a zero proportional refund
 *   becoming a FULL refund (PR #704 finding 1). They stay in the executor, and
 *   `server/changeRequestApprovalBlocker.test.ts` names them as the only
 *   state refusals this function may let through.
 * - **`block_ip`.** Its target is an address, and `blockIp` answers success
 *   when the address is already blocked, so no state of it can refuse.
 *
 * A read that fails (no database) answers `null` from the helpers, which reads
 * here as "cannot be found" and REFUSES. That is the safe direction: the
 * request stays `pending` rather than being moved on a reading nobody got.
 */
import { getUserById, getUserCredits } from "../../db";

export type ChangeRequestStateBlocker = { state: string; sentence: string };

type TargetUser = NonNullable<Awaited<ReturnType<typeof getUserById>>>;

type StateCheck = {
  state: string;
  /** `true` when the executor can act on this target. */
  holds: (user: TargetUser) => boolean | Promise<boolean>;
  sentence: string;
};

const NOT_ADMIN: StateCheck = {
  state: "target-is-admin",
  holds: (user) => user.role !== "admin",
  sentence:
    "This person is an admin now, and admin accounts cannot be suspended: approving is refused " +
    "and the request stays as it is. Decline it to close it.",
};

const IS_SUSPENDED: StateCheck = {
  state: "target-not-suspended",
  holds: (user) => Boolean(user.suspendedAt),
  sentence:
    "This person is not suspended any more, so there is nothing to lift: approving is refused " +
    "and the request stays as it is. Decline it to close it.",
};

const HAS_BALANCE: StateCheck = {
  state: "target-has-no-balance",
  holds: async (user) => (await getUserCredits(user.id)) != null,
  sentence:
    "This account has no credit balance to add to, so no credits can be given: approving is " +
    "refused, no credits move and the request stays as it is. Decline it to close it.",
};

const USER_MISSING_SENTENCE =
  "The account this request is about cannot be found, so there is nothing to act on: approving " +
  "is refused and the request stays as it is. Decline it to close it.";

/**
 * Keyed by change-request type, beyond the account existing — which every type
 * listed here needs. A type absent from this map is not read at all.
 */
export const CHANGE_REQUEST_STATE_REQUIREMENTS: Readonly<Record<string, readonly StateCheck[]>> = {
  suspend_user: [NOT_ADMIN],
  unsuspend_user: [IS_SUSPENDED],
  add_credits: [HAS_BALANCE],
  refund_credits: [HAS_BALANCE],
  stripe_refund: [],
};

/**
 * The first state of this request's target that its executor would refuse on,
 * or `null` when approving can go ahead. Asked only for an approval of a type
 * that executes; the review procedure calls it after the field check.
 */
export async function changeRequestStateBlocker(
  request: { type: string; targetUserId: number },
): Promise<ChangeRequestStateBlocker | null> {
  const checks = CHANGE_REQUEST_STATE_REQUIREMENTS[request.type];
  if (!checks) return null;

  const user = await getUserById(request.targetUserId);
  if (!user) return { state: "target-missing", sentence: USER_MISSING_SENTENCE };

  for (const check of checks) {
    if (!(await check.holds(user))) return { state: check.state, sentence: check.sentence };
  }
  return null;
}
