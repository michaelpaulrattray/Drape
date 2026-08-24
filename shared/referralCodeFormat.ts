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

/**
 * The brand segment. **This is the only place it is written down.**
 *
 * It has moved once already (`FORMA` → `DRAPE`) and the record holds a further
 * rebrand decided but not executed in code, so treat the next move as a
 * question of changing this line and nothing else.
 */
export const REFERRAL_CODE_PREFIX = "DRAPE";

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

/*
  ⚠ THERE IS NO `REFERRAL_CODE_LENGTH` HERE, AND ITS ABSENCE IS DELIBERATE.

  It was written (prefix + separator + body = 12) and the disposition door
  refused the build over it: `unread 1 REFERRAL_CODE_LENGTH`. The door was
  right. The one place that wants it is `RedeemCodeModal`'s `maxLength={16}` —
  a cap, and caps are §10 row 3f's sweep, which is its own countersigned
  sitting. Declaring a constant ahead of the consumer that justifies it is the
  thing the door exists to catch, and this file is not the place to argue with
  it. **3f adds the constant and its reader in one commit.**

  Nothing is lost meanwhile: 16 cannot lock anyone out of a 12-character code.
*/

/**
 * `DRAPE-XXXXXX` — the shape, spelled for a human.
 *
 * This is what the placeholder shows and what the refusal names, so those two
 * can never disagree with each other or with the generator.
 */
export const REFERRAL_CODE_EXAMPLE =
  `${REFERRAL_CODE_PREFIX}${REFERRAL_CODE_SEPARATOR}${"X".repeat(REFERRAL_CODE_BODY_LENGTH)}`;

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
    `^${REFERRAL_CODE_PREFIX}${REFERRAL_CODE_SEPARATOR}[${REFERRAL_CODE_ACCEPTED_CLASS}]{${REFERRAL_CODE_BODY_LENGTH}}$`,
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
