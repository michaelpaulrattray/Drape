/**
 * ONE declaration of what a change-request type is CALLED (#679).
 *
 * A moderator asks an admin for something — a refund, a suspension, a note on
 * an account — and every surface that shows that request has to name its kind
 * in words a person reads. Until this file existed, that naming was typed out
 * by hand SEVEN times: twice on the client, twice more inside two client
 * components, twice on the server, and once inside a test that asserted
 * against its own copy.
 *
 * ⚠ **TWO OF THE SEVEN HAD ALREADY DRIFTED, AND ONE OF THEM SHOWED.** The
 * moderator's own *My requests* tab held eight of the nine types — `stripe_refund`
 * was never added — and its lookup falls back to the raw key, so a Stripe
 * refund request appeared in that list as the literal text `stripe_refund`.
 * Nobody had to make a mistake for that to happen: a type was added in one
 * place and the other six were not visited. That is working law 4 exactly, and
 * it is why this map is imported rather than copied.
 *
 * The seventh copy was `server/changeRequests.test.ts`, which declared its own
 * map and then asserted things about that declaration — green forever, whatever
 * the product said. It now reads this file.
 *
 * ## The values
 *
 * Sentence case, which is the house voice (brief 05, #421/#428) and was already
 * what the two client surfaces said. The two server copies were Title Case
 * ("Refund Credits"); they composed Slack notification copy — an integration
 * retired outright by #800 — and nothing else read them, so the client's
 * wording settled the case question everywhere at once.
 *
 * `IP` keeps its capitals. It is an initialism, not a word.
 *
 * ## What is deliberately NOT here
 *
 * - **Icons and colours** stay in `client/src/features/admin/ChangeRequestConstants.tsx`.
 *   `shared/` is imported by the server and may not depend on `lucide-react`.
 * - The `ACTION_LABELS` sibling this list used to name lived in the Slack
 *   approval module and was deleted with it (#800).
 * - **The order types are OFFERED in** is per-surface and stays with the
 *   caller: the admin filter leads with the money types (`ALL_TYPES`), the
 *   moderator's create form follows the order below. Declaration order here is
 *   the create form's, so that form renders exactly as it did.
 *
 * Guarded by `server/changeRequestLabels.test.ts`, which fails if a second
 * declaration of these pairs appears anywhere in the tree.
 */

export const CHANGE_REQUEST_TYPE_LABELS = {
  refund_credits: "Refund credits",
  add_credits: "Add credits",
  flag_account: "Flag account",
  note_incident: "Note incident",
  suspend_user: "Suspend user",
  unsuspend_user: "Unsuspend user",
  block_ip: "Block IP",
  stripe_refund: "Stripe refund",
  other: "Other",
} as const;

export type ChangeRequestType = keyof typeof CHANGE_REQUEST_TYPE_LABELS;

/** Every type, in the order the moderator's create form offers them. */
export const CHANGE_REQUEST_TYPES = Object.keys(
  CHANGE_REQUEST_TYPE_LABELS,
) as ChangeRequestType[];

/**
 * The executor action each SENSITIVE change-request type becomes — THE one
 * declaration, and also the definition of "sensitive": a type is sensitive
 * exactly when it has an executor action, and since #800 approving a
 * sensitive request EXECUTES it inside the same mutation.
 *
 * ⚠ It lives in `shared/` because both sides read it: the server routes the
 * approved action with it (`server/lib/adminActions`), and the admin panel
 * derives which types get the "runs the moment you approve it" warning.
 * Before #800 the client carried a hand-typed `SENSITIVE_TYPES` of THREE
 * names against the server's six — refund_credits, add_credits and block_ip
 * executed without ever wearing the warning. Working law 4: derive, never
 * mirror. (The table itself was already the survivor of three hand-typed
 * copies, reconciled 2026-08-25, 3g's D.)
 */
export const CHANGE_REQUEST_ACTION_BY_TYPE = {
  suspend_user: "cr_suspendUser",
  unsuspend_user: "cr_unsuspendUser",
  refund_credits: "cr_refundCredits",
  add_credits: "cr_addCredits",
  block_ip: "cr_blockIP",
  stripe_refund: "cr_stripeRefund",
} as const;

/** The types whose approval executes immediately, for the panel's warning. */
export const SENSITIVE_CHANGE_REQUEST_TYPES = Object.keys(
  CHANGE_REQUEST_ACTION_BY_TYPE,
) as (keyof typeof CHANGE_REQUEST_ACTION_BY_TYPE)[];

/**
 * The label for a type, falling back to the raw key.
 *
 * The fallback is what every one of the seven call sites already did (`|| type`),
 * kept deliberately: a row whose type this build does not know about is better
 * shown by its key than swallowed. It should now be unreachable — the point of
 * the guard is that a new type cannot be added to one place only.
 */
export function changeRequestTypeLabel(type: string): string {
  return CHANGE_REQUEST_TYPE_LABELS[type as ChangeRequestType] ?? type;
}

/**
 * ONE declaration of what a change-request STATUS is called (#907).
 *
 * # What a moderator was reading
 *
 * The admin panel has said `Outcome unconfirmed` for `pending_execution` since
 * #800. The moderator's own *My requests* tab passed `request.status` straight
 * into its pill, so the same row on the same request read **`PENDING_EXECUTI`**
 * — a raw database enum, in machine case, hard-clipped mid-word by a 104px
 * column. Its neighbours read `PENDING` and `DENIED`, so the broken one was the
 * only one that looked like a leak.
 *
 * ⚠ **The clipping was the symptom; the enum was the defect.** Widening the
 * column to fit `PENDING_EXECUTION` would have made a machine word legible,
 * which is working law 8 exactly — *this is a visual studio, not a maths
 * class*: the user's ontology governs, and a person should not have to
 * interpret `pending_execution`.
 *
 * # Why all six, and not just the broken one
 *
 * Mapping one status and leaving five raw would have left the column in two
 * vocabularies — which is the mistake #900 was filed about, one shape over.
 * The five that read acceptably in caps read acceptably as words too, so the
 * whole column is settled here rather than half of it.
 *
 * # Why it lives in `shared/`
 *
 * The type labels above are here for exactly this reason and the status labels
 * had drifted the same way: one surface knew the words, the other did not.
 * **Icons and colours stay in `client/src/features/admin/ChangeRequestConstants.tsx`**
 * — `shared/` is imported by the server and may not depend on `lucide-react`
 * — and that file now derives its labels from this map, the way `TYPE_CONFIG`
 * already derives its own.
 *
 * Sentence case, matching the type labels and the house voice (brief 05).
 *
 * Guarded by `server/changeRequestLabels.test.ts`, which fails if a second
 * declaration of these pairs appears anywhere in the tree, and which reads the
 * accepted statuses off the `change_requests` table's own enum — so a status
 * added to the column without a word here reddens in the file that owns the
 * words.
 */
export const CHANGE_REQUEST_STATUS_LABELS = {
  pending: "Pending",
  approved: "Approved",
  denied: "Denied",
  cancelled: "Cancelled",
  expired: "Expired",
  /**
   * ⚠ **Not "Failed", and the wording is load-bearing.** A sensitive request
   * executes inside the approve mutation (#800); this state survives when the
   * execution threw — OR when the action RAN and only the settle write or the
   * process died (a deploy landing mid-request). So the label must not claim
   * the action did not happen: the outcome is UNKNOWN and a person checks the
   * record before acting again. The sentence was written for the admin panel
   * and is carried here verbatim rather than re-decided.
   */
  pending_execution: "Outcome unconfirmed",
} as const;

export type ChangeRequestStatus = keyof typeof CHANGE_REQUEST_STATUS_LABELS;

/** Every status, in the order the request moves through them. */
export const CHANGE_REQUEST_STATUSES = Object.keys(
  CHANGE_REQUEST_STATUS_LABELS,
) as ChangeRequestStatus[];

/**
 * The label for a status, falling back to the raw key.
 *
 * The fallback matches `changeRequestTypeLabel` above and exists for the same
 * reason: a row whose status this build does not know about is better shown by
 * its key than swallowed. It should be unreachable — the guard's wire arm is
 * what keeps it so.
 */
export function changeRequestStatusLabel(status: string): string {
  return CHANGE_REQUEST_STATUS_LABELS[status as ChangeRequestStatus] ?? status;
}

/**
 * WHAT A REQUEST'S OWN SUBJECT READS AS WHEN NOBODY RECORDED IT (#913).
 *
 * Two staff surfaces draw a change request's type-specific facts — the admin's
 * Change requests table and the moderator's own *My requests* tab — and until
 * this constant existed both of them drew NOTHING when the value was absent:
 * the CREDITS row on a credit request, the IP ADDRESS row on a block request.
 * On the admin side that silence sat directly above a sentence reading
 * *"Approving adds null credits to this account"*, on the button that moves a
 * paying customer's balance.
 *
 * **An absent value is a fact about the request, not a reason to draw
 * nothing.** It lives here for the same reason the type and status words do:
 * the moment two surfaces write the same words they drift (working law 4), and
 * this file is where the change-request vocabulary is declared once.
 *
 * ⚠ **Not `"—"`.** A dash is tidier and says nothing — an admin reading it
 * cannot tell "no amount was recorded" from "the panel did not fetch it", and
 * the whole value of a fact block is that it is readable as a sentence.
 */
export const CHANGE_REQUEST_NOT_RECORDED = "not recorded";
