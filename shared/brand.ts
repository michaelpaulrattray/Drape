/**
 * THE PRODUCT'S NAME, IN ONE PLACE FOR BOTH HALVES OF IT.
 *
 * Founder ruling (plan §O-2, 2026-07-30): V2 ships as Klieg. The public
 * rebrand — domain, Google OAuth redirect URI, Resend sending domain,
 * Stripe-facing copy — is a founder-executed workstream (M5b) that gates
 * widening scope beyond the founder, not this constant.
 *
 * ⚠ **IT MOVED HERE FROM `client/src/foundation/brand.ts` WHEN THE SERVER
 * NEEDED IT — #1955, and the move is the point rather than tidiness.** That
 * file still owns `WORKSPACE_NAME` and `WORKSPACE_ROLE_LABEL`, which are chrome
 * and have no server reader, and it re-exports this one so no import site
 * changed. What changed is that the server can now say the product's name
 * without spelling it.
 *
 * **The spelling was the defect.** The identity PDF a customer downloads said
 * "Drape" in EIGHT separate string literals, and `server/db/referrals.ts`
 * records in its own docblock what that costs: *"the FormaStudio→Drape rename
 * fixed this file and missed that quotation, so every mistyping customer was
 * told to type `FORMA-XXXXXX` for six months."* A brand word written out in
 * several places drifts from itself at the next rename — working law 4 — and
 * this product has already paid for that once with a customer-facing refusal.
 *
 * ⚠ **A BRAND WORD THAT IS AN IDENTIFIER IS NOT THIS CONSTANT'S BUSINESS, and
 * the difference is whether changing it changes behaviour.** The `drape_device`
 * cookie name, the Stripe refund metadata keys and the R2 object keys all
 * contain the old name and are all PERSISTED — a rename there logs out a fraud
 * guard or 404s an asset. Those are data decisions, not copy. This constant is
 * for words a person READS. **The referral and invite code prefix is the one
 * that is both** — a customer reads it and types it, and it is persisted — so
 * #2007 derives the prefix NEW codes are minted with from this constant, while
 * `shared/referralCodeFormat.ts`'s `RETIRED_CODE_PREFIXES` keeps every code
 * already issued under the old name redeemable.
 *
 * ⚠ **IT IS `PRODUCT_NAME` AND NOT `BRAND_NAME`, AND AN INSTRUMENT CHOSE THE
 * NAME RATHER THAN TASTE.** Declaring `BRAND_NAME` here reddened
 * `server/unwiringDiffer.test.ts`'s *"no name is declared under both `server/`
 * and `shared/`"* arm, which exists because that differ judges on the
 * NAME-LEVEL union of importers: a name declared on both sides of that
 * boundary lets one twin's live importers hold the other twin's death above
 * zero, and the differ then goes silent on a control that died. The twin is
 * `server/casting/geminiPrompts.ts`'s dead `BRAND_NAME = 'DRAPE'`, and
 * deleting it is **explicitly not authorised** — `docs/specs/
 * CLEANUP_MILESTONE_TRIAGE.md` row 34 holds it for #29, the legacy-studio
 * retirement: *"Picking one constant out of that module ahead of the module is
 * not a cleanup, it is a head start on a decision that has not been made."*
 * So the new declaration took a new name instead. `PRODUCT_NAME` is also the
 * more honest of the two: #381's whole finding was that the PRODUCT and the
 * WORKSPACE are different nouns, and `BRAND_NAME` was standing in for both.
 */
export const PRODUCT_NAME = "Klieg";
