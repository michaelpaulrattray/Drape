/**
 * Where a customer's reply goes. The same address the login page already
 * gives a suspended account and the plan ladder gives an Enterprise enquiry —
 * it is the one human door this product has.
 *
 * It lives in `shared/` (moved from `server/mail.ts` for #2456) so that a
 * client surface can name it too. `server/mail.ts` re-exports it, so there is
 * still exactly one literal.
 */
export const SUPPORT_EMAIL = "support@klieglabs.com";
