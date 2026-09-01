/**
 * Product name shown in V2 chrome.
 *
 * Founder ruling (plan §O-2, 2026-07-30): V2 ships as Klieg. The public
 * rebrand — domain, Google OAuth redirect URI, Resend sending domain,
 * Stripe-facing copy — is a founder-executed workstream (M5b) that gates
 * widening scope beyond the founder, not this constant.
 */
export const BRAND_NAME = "Klieg";

/**
 * THE WORKSPACE NAME — a different noun from the product name, and the reason
 * two of our own surfaces could disagree about it (#381).
 *
 * He read the Settings header as `Klieg` and named it against a pane reading
 * `Klieg Studio`. Read at the running app before it was changed: nothing in the
 * product rendered `Klieg Studio` at all — `BRAND_NAME` was standing in for the
 * workspace in both places, so the header said `Klieg · Free plan` and the
 * Profile pane's note said *"Every workspace is Klieg"*. **The disagreement is
 * with his own two specifications, and both of them say the same thing**:
 * brief §4 gives the header as `Klieg Studio · Studio plan`, and the prototype's
 * header binds `{{ workspace }}` to `Klieg Studio`.
 *
 * So the workspace gets its own constant rather than borrowing the product's.
 * `BRAND_NAME` is untouched — it carries a founder ruling of its own — and the
 * header and the Profile note now read from ONE source, which is the class of
 * his complaint rather than the instance: two surfaces naming a thing
 * separately will disagree eventually, whatever they say today.
 *
 * There is still no workspace ROW anywhere in `drizzle/schema.ts`. When there
 * is, this constant becomes its default, and the Profile field that is inert
 * today is what edits it.
 */
export const WORKSPACE_NAME = "Klieg Studio";

/**
 * THE ROLE SHOWN BESIDE THE BALANCE — and it is a stub with a straight face
 * (#374, brief 04 §2a: `1,240 credits · Owner`).
 *
 * ⚠ **THERE IS NO WORKSPACE ROLE IN THIS PRODUCT.** `drizzle/schema.ts` has
 * `users.role` as `user | admin | moderator` — a STAFF role, which the menu's
 * own `STAFF` group already expresses — and no members, teams or workspace
 * table of any kind. So `Owner` is not read off a row and cannot be.
 *
 * It ships for two reasons, and the second is the load-bearing one:
 *
 *  1. **It is not false at today's single tenancy.** With no membership, the
 *     account holder owns everything they can see. `MembersSection.tsx` already
 *     says `OWNER` on the signed-in row, shipped in section 03, drawn as a stub
 *     reasoned *"Roles are not built yet"*.
 *  2. **Because it already appears twice, it must be declared once.** Working
 *     law 4 — a second list shadowing a source of truth always drifts from it.
 *     The `Klieg` / `Klieg Studio` disagreement `WORKSPACE_NAME` exists to fix
 *     (#381) was two surfaces naming one thing separately; this would be the
 *     same defect written a day later, in the same file, by the same hand.
 *
 * When roles land, this becomes a read off the row and there is one edit.
 */
export const WORKSPACE_ROLE_LABEL = "Owner";
