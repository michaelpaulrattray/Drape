/**
 * ONE declaration of what an approval needs to be ABLE to run (#921, #923).
 *
 * A moderator's change request carries per-type fields — an amount on a credit
 * request, an address on an IP block, a session and a purchase figure on a
 * Stripe refund — and every one of them is a nullable column on
 * `change_requests`. The executor that runs on Approve needs its field, and
 * what it did when the field was missing is the whole reason this file exists:
 *
 * | type | field | what approving did with the field absent |
 * |---|---|---|
 * | `block_ip` | `ipAddress` | blocked the target's ACCOUNT NUMBER as if it were an address (#921) |
 * | `add_credits` / `refund_credits` | `creditAmount` | threw — AFTER the request had been moved to `pending_execution` |
 * | `stripe_refund` | `stripeSessionId`, `originalCredits` | threw — the same, after the move |
 *
 * The last two failed loudly and moved no money, but they left the request at
 * `pending_execution`, which the panel draws as *"Outcome unconfirmed"* and
 * which nothing can clear: the review procedure refuses anything not `pending`,
 * deliberately, because an executor that failed MIDWAY may already have moved
 * money and a retry road there is how a refund gets issued twice.
 *
 * That reasoning is about an executor that STARTED. A request missing the field
 * its executor needs was never going to start, and that is knowable before
 * anything is written — so the review procedure asks this function first and
 * refuses while the request is still `pending` and still deniable.
 *
 * ⚠ **READ BY BOTH SIDES, SO THE BUTTON'S SENTENCE CANNOT DRIFT FROM WHAT THE
 * BUTTON DOES.** The server refuses with `sentence`; the admin panel shows the
 * same `sentence` under Approve before anyone presses it. Twice before this
 * file existed a sentence on that panel had to be moved by hand because its
 * behaviour moved (#913, #921) — working law 4.
 *
 * ⚠ **THE EXECUTORS KEEP THEIR OWN REFUSALS.** This is the first line of
 * defence, not the only one. `server/changeRequestApprovalBlocker.test.ts`
 * drives the REAL executors over every nullable column of the table and
 * reddens if any of them refuses, before writing anything, a request this
 * function lets through — which is the wedge coming back.
 *
 * ## What is deliberately NOT here
 *
 * - **The target row's STATE** — a deleted account, an admin target, an
 *   unsuspend on somebody no longer suspended. Those executors also refuse
 *   before writing, but a state read here would go stale between this check
 *   and the executor, so it is a different fix and its own card.
 * - **`refundType`.** The Stripe executor defaults it to `proportional` rather
 *   than refusing, so its absence cannot wedge anything.
 */

/** A count the executor will act on: a number above zero. */
const usableCount = (value: unknown) => typeof value === "number" && value > 0;
/** An identifier the executor will act on: a non-empty string. */
const usableText = (value: unknown) => typeof value === "string" && value.length > 0;

type Requirement = {
  field: string;
  usable: (value: unknown) => boolean;
  sentence: string;
};

const CREDIT_AMOUNT: Requirement = {
  field: "creditAmount",
  usable: usableCount,
  sentence:
    "No credit amount was recorded on this request, so there is nothing to approve: approving " +
    "is refused and the request stays as it is. Decline it and ask for a new request with the " +
    "amount on it.",
};

/**
 * Keyed by change-request type. A type absent from this map needs nothing
 * beyond `targetUserId`, which the table declares `.notNull()`.
 */
export const CHANGE_REQUEST_APPROVAL_REQUIREMENTS: Readonly<Record<string, readonly Requirement[]>> = {
  add_credits: [CREDIT_AMOUNT],
  refund_credits: [CREDIT_AMOUNT],
  block_ip: [
    {
      field: "ipAddress",
      usable: usableText,
      sentence:
        "No IP address was recorded on this request, so there is nothing to block: approving " +
        "is refused and the request stays as it is. Decline it and ask for a new request with " +
        "the address on it.",
    },
  ],
  stripe_refund: [
    {
      field: "stripeSessionId",
      usable: usableText,
      sentence:
        "No Stripe session was recorded on this request, so there is no charge to refund: " +
        "approving is refused, no money moves and the request stays as it is. Decline it and ask " +
        "for a new request with the session on it.",
    },
    {
      field: "originalCredits",
      usable: usableCount,
      sentence:
        "This request has no record of the credits the original purchase gave, so the refund " +
        "cannot be worked out: approving is refused, no money moves and the request stays as " +
        "it is. Decline it and ask for a new request.",
    },
  ],
};

export type ChangeRequestApprovalBlocker = { field: string; sentence: string };

/**
 * The first field this request's type needs and does not have, or `null` when
 * approving can run. The first, not all: one missing field already means deny
 * and re-file, and a sentence listing three is harder to act on than one.
 */
export function changeRequestApprovalBlocker(
  request: { type: string } & Record<string, unknown>,
): ChangeRequestApprovalBlocker | null {
  for (const requirement of CHANGE_REQUEST_APPROVAL_REQUIREMENTS[request.type] ?? []) {
    if (!requirement.usable(request[requirement.field])) {
      return { field: requirement.field, sentence: requirement.sentence };
    }
  }
  return null;
}
