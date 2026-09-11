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

export type ChangeRequestAction =
  (typeof CHANGE_REQUEST_ACTION_BY_TYPE)[keyof typeof CHANGE_REQUEST_ACTION_BY_TYPE];

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
