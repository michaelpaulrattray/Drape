/**
 * WHAT A REFERRAL CODE LOOKS LIKE — the one declaration, where the generator,
 * the validator, the refusals and the box a customer types into can all see it.
 *
 * # The defect this closes, and it was live for six months
 *
 * The redeem refusal said, to every customer who mistyped a code:
 *
 *     "Invalid referral code format. Expected: FORMA-XXXXXX"
 *
 * **No code this product has ever minted begins with `FORMA-`.** The generator
 * mints `DRAPE-`, the regex demands `DRAPE-`, the placeholder in the box says
 * `DRAPE-XXXXXX`, and the one sentence shown when the shape is wrong named a
 * dead brand. It is the same defect the refine cap carried one feature over —
 * *a refusal whose advice cannot be followed* — and it is the reason this file
 * exists rather than a corrected spelling.
 *
 * # How it happened, read at the bytes rather than guessed at
 *
 * `06585f07` — *"Full rebrand from FormaStudio to Drape … invite code prefix
 * FORMA→DRAPE … All 952 tests passing"* — renamed all four occurrences in
 * `server/db/referrals.ts`, the file that DECLARES the format, and edited three
 * separate lines of `server/routes/referral.ts`, the file that QUOTES it,
 * without touching the quotation. One commit, both files open, green suite.
 *
 * **So a hand-typed second place does not merely risk drifting. It drifts, at
 * the next rename, and the suite stays green about it** — which is why the
 * repair is a declaration every consumer derives from, not a spelling fix.
 *
 * # Why `shared/` and not `server/db/referrals.ts`
 *
 * Because one of the consumers is a browser: `RedeemCodeModal`'s placeholder is
 * the customer's only advance notice of the shape. A declaration the client
 * cannot import leaves that place hand-typed, which is the defect with one
 * fewer consumer. `server/db/referrals.ts` imports from here.
 */

import { PRODUCT_NAME } from "./brand";

/**
 * The brand segment every code this product ISSUES starts with — referral
 * codes minted by the server and invite codes minted on the admin page alike.
 * **It is derived from `PRODUCT_NAME`, not spelled** (#2007).
 *
 * It has moved twice (`FORMA` → `DRAPE` → `KLIEG`), and the second move was
 * owed for months: after the product became Klieg, every new code was still
 * minted `DRAPE-…` and a mistyping customer was told *"Expected:
 * DRAPE-XXXXXX"*. Spelled here, the prefix waited for someone to remember it
 * at the rename; derived, it moves WITH the name.
 */
export const ISSUED_CODE_PREFIX = PRODUCT_NAME.toUpperCase();

/**
 * Prefixes this product used to issue, still honoured on the way IN and never
 * minted again.
 *
 * ⚠ **A code is persisted and shared — it sits in `users.referralCode` and in
 * links customers have already posted** — so renaming the prefix must not
 * break a single one of them. This list is the whole of that promise: the
 * validator accepts `ISSUED_CODE_PREFIX` and every entry here, and nothing
 * else reads it. `FORMA` is deliberately absent: no code ever minted begins
 * with it (see the docblock above), so readmitting it would be leniency with
 * nothing to protect.
 *
 * Invite codes need no such list: `validateInviteCode` is a database lookup
 * with no shape check, so an old `DRAPE-` invite keeps working by construction.
 */
export const RETIRED_CODE_PREFIXES: readonly string[] = ["DRAPE"];

/** Every prefix the validator accepts — the current one first. */
export const REFERRAL_CODE_ACCEPTED_PREFIXES: readonly string[] = [
  ISSUED_CODE_PREFIX,
  ...RETIRED_CODE_PREFIXES,
];

/** How many characters follow the separator. */
export const REFERRAL_CODE_BODY_LENGTH = 6;

/** What separates the prefix from the body. */
export const REFERRAL_CODE_SEPARATOR = "-";

/**
 * The alphabet the generator MINTS from — no I, O, 0 or 1, so a code read off a
 * screen and typed into a box cannot be lost to a confusable glyph.
 */
export const REFERRAL_CODE_MINT_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/**
 * The character class the validator ACCEPTS, and it is deliberately WIDER than
 * the mint alphabet above.
 *
 * `A-Z` admits `I` and `O`, which are never minted. That gap is on purpose and
 * is not a drift: format validation is a cheap shape check, and the database
 * lookup immediately after it is the real authority. A code containing `I` does
 * not exist, so it is refused either way — the only thing tightening this would
 * change is WHICH of the two refusals a customer meets. Narrowing it here would
 * be a behaviour change wearing a tidy-up's clothes.
 */
export const REFERRAL_CODE_ACCEPTED_CLASS = "A-Z2-9";

/**
 * `KLIEG-A3K9X2` — **12.** The real length of every code that has ever existed.
 *
 * ⚠ IT WAS WRITTEN IN `0efe3f9f` AND DELETED THE SAME HOUR, because the
 * disposition door refused the build over it — `unread 1` — its only wanting
 * consumer being `RedeemCodeModal`'s `maxLength={16}`, which belonged to §10
 * row 3f's sweep rather than to that commit. The door was right and it is back
 * now with its reader, in the same commit, which is the only order the door
 * permits.
 *
 * It is the LONGEST accepted shape, not the minted one, so the box can never
 * refuse a customer typing an older code if a future prefix is shorter.
 *
 * **The box used to say 16.** Nobody was ever locked out — no code is longer
 * than 12 — but the number came from nowhere, and 12 comes from the format.
 */
export const REFERRAL_CODE_LENGTH =
  Math.max(...REFERRAL_CODE_ACCEPTED_PREFIXES.map((prefix) => prefix.length)) +
  REFERRAL_CODE_SEPARATOR.length +
  REFERRAL_CODE_BODY_LENGTH;

/**
 * `KLIEG-XXXXXX` — the shape, spelled for a human. Always the CURRENT prefix:
 * an older code is still accepted, but nobody is told to type one.
 *
 * This is what the placeholder shows and what the refusal names, so those two
 * can never disagree with each other or with the generator.
 */
export const REFERRAL_CODE_EXAMPLE =
  `${ISSUED_CODE_PREFIX}${REFERRAL_CODE_SEPARATOR}${"X".repeat(REFERRAL_CODE_BODY_LENGTH)}`;

/**
 * The shape test itself, built from the parts above.
 *
 * A function rather than a module-level `RegExp` because a shared `RegExp`
 * object is mutable state at import scope; the cost of constructing one per
 * call is nothing beside a database round trip, and there is no `g` flag to
 * carry a `lastIndex` between callers.
 */
export function referralCodePattern(): RegExp {
  return new RegExp(
    `^(?:${REFERRAL_CODE_ACCEPTED_PREFIXES.join("|")})${REFERRAL_CODE_SEPARATOR}[${REFERRAL_CODE_ACCEPTED_CLASS}]{${REFERRAL_CODE_BODY_LENGTH}}$`,
  );
}

/**
 * The sentence a customer is shown when the shape is wrong — **composed once,
 * so both refusal sites say the same thing and neither can name a dead brand.**
 *
 * There are two such sites and both are reachable: the router's `redeem` (the
 * code she typed) and `claimReferral`'s (the code that rode in on a `?ref=`
 * link). Only the first carried a format hint, which is exactly why the fossil
 * in it went unseen — the other one had nothing to go stale.
 */
export const REFERRAL_CODE_FORMAT_MESSAGE =
  `Invalid referral code format. Expected: ${REFERRAL_CODE_EXAMPLE}`;

/**
 * INVITE CODES — staff mint them on the admin page, customers type them at
 * sign-up. `KLIEG-XXXX-XXXX`: the issued prefix and two four-character groups
 * from the same confusable-free alphabet. Declared here so the admin page's
 * generator and its placeholder cannot drift from the referral prefix.
 */
export const INVITE_CODE_GROUP_LENGTH = 4;

export const INVITE_CODE_EXAMPLE =
  `${ISSUED_CODE_PREFIX}${REFERRAL_CODE_SEPARATOR}${"X".repeat(INVITE_CODE_GROUP_LENGTH)}` +
  `${REFERRAL_CODE_SEPARATOR}${"X".repeat(INVITE_CODE_GROUP_LENGTH)}`;

/** A fresh invite code. `random` is injectable so a test can drive it. */
export function mintInviteCode(random: () => number = Math.random): string {
  const group = () =>
    Array.from(
      { length: INVITE_CODE_GROUP_LENGTH },
      () => REFERRAL_CODE_MINT_ALPHABET[Math.floor(random() * REFERRAL_CODE_MINT_ALPHABET.length)],
    ).join("");
  return `${ISSUED_CODE_PREFIX}${REFERRAL_CODE_SEPARATOR}${group()}${REFERRAL_CODE_SEPARATOR}${group()}`;
}
