/**
 * THE REFERRAL CODE'S SHAPE IS DECLARED ONCE, AND THE SENTENCE A CUSTOMER SEES
 * IS BUILT FROM IT.
 *
 * # What went wrong, and why this file is not `referral.test.ts`
 *
 * `server/routes/referral.ts` told every customer who mistyped a code:
 *
 *     "Invalid referral code format. Expected: FORMA-XXXXXX"
 *
 * No code this product has ever minted begins with `FORMA-`. `06585f07` — the
 * FormaStudio→Drape rebrand, *"invite code prefix FORMA→DRAPE … All 952 tests
 * passing"* — renamed all four occurrences in the file that DECLARES the format
 * and edited three separate lines of the file that QUOTES it, without touching
 * the quotation. Six months live.
 *
 * **`referral.test.ts` had a `describe("Referral Code Format Validation")`
 * block the whole time, and it could not have caught this**, because that file
 * `vi.mock`s `./db/referrals` wholesale: its format tests set
 * `mockIsValidReferralCodeFormat.mockReturnValue(true)` and then assert that it
 * returned true. A scripted reader agrees with you. So this arm lives in its
 * own file with NO mocks at all — it drives the real generator, the real
 * validator and the real composed sentence, and it reads the two refusal sites
 * off disk.
 */
import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";

import {
  REFERRAL_CODE_ACCEPTED_CLASS,
  REFERRAL_CODE_BODY_LENGTH,
  REFERRAL_CODE_EXAMPLE,
  REFERRAL_CODE_FORMAT_MESSAGE,
  REFERRAL_CODE_MINT_ALPHABET,
  REFERRAL_CODE_PREFIX,
  REFERRAL_CODE_SEPARATOR,
  referralCodePattern,
} from "../shared/referralCodeFormat";
import { isValidReferralCodeFormat } from "./db/referrals";

const DECLARATION = new URL("../shared/referralCodeFormat.ts", import.meta.url);
const ROUTER = new URL("./routes/referral.ts", import.meta.url);
const DB = new URL("./db/referrals.ts", import.meta.url);
const MODAL = new URL(
  "../client/src/features/referral/RedeemCodeModal.tsx",
  import.meta.url,
);

/**
 * The code with its prose removed — a doc comment explaining a rule must not be
 * mistaken for a breach of it.
 *
 * This is load-bearing here rather than merely tidy: **three of the four files
 * this arm reads quote `FORMA-XXXXXX` on purpose**, in the docblocks that
 * record what went wrong. Without stripping, the fix reddens its own arm.
 */
const withoutProse = (source: string): string => source
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/^\s*\/\/.*$/gm, " ");

describe("the referral code's shape is declared once", () => {
  it("mints codes the validator accepts — the real generator, not a mock", async () => {
    /*
      The positive control for everything below: if the generator and the
      validator ever disagree, every code the product hands out is refused on
      redemption. Driven through the real module, 200 codes, because the body
      is random and one draw proves little.

      `createReferralCode` is module-private, so the mint is reproduced from the
      SAME declared parts rather than imported — which is the point: the
      declaration is what both sides are being held to.
    */
    for (let draw = 0; draw < 200; draw += 1) {
      let body = "";
      for (let i = 0; i < REFERRAL_CODE_BODY_LENGTH; i += 1) {
        body += REFERRAL_CODE_MINT_ALPHABET[
          Math.floor(Math.random() * REFERRAL_CODE_MINT_ALPHABET.length)
        ];
      }
      const minted = `${REFERRAL_CODE_PREFIX}${REFERRAL_CODE_SEPARATOR}${body}`;
      expect(isValidReferralCodeFormat(minted), `${minted} was refused`).toBe(true);
      expect(minted).toHaveLength(
        REFERRAL_CODE_PREFIX.length + REFERRAL_CODE_SEPARATOR.length + REFERRAL_CODE_BODY_LENGTH,
      );
    }
  });

  it("refuses the shapes it should — the negative control", () => {
    /*
      A validator that accepts everything would pass the arm above. These are
      the refusals that matter: the dead prefix (which must NOT be readmitted by
      some future leniency), a wrong body length, and an empty string.
    */
    expect(isValidReferralCodeFormat("FORMA-A3K9X2")).toBe(false);
    expect(isValidReferralCodeFormat(`${REFERRAL_CODE_PREFIX}-A3K9X`)).toBe(false);
    expect(isValidReferralCodeFormat(`${REFERRAL_CODE_PREFIX}-A3K9X2Z`)).toBe(false);
    expect(isValidReferralCodeFormat("")).toBe(false);
    expect(isValidReferralCodeFormat("INVALID")).toBe(false);
  });

  it("the pattern is BUILT from the declared parts, not written beside them", async () => {
    expect(referralCodePattern().source).toBe(
      `^${REFERRAL_CODE_PREFIX}${REFERRAL_CODE_SEPARATOR}[${REFERRAL_CODE_ACCEPTED_CLASS}]{${REFERRAL_CODE_BODY_LENGTH}}$`,
    );

    /*
      ⚠ THE LINE ABOVE PASSED ITS OWN SABOTAGE. Replacing the built pattern with
      a hardcoded `/^DRAPE-[A-Z2-9]{6}$/` leaves `.source` IDENTICAL, so a
      value comparison cannot tell derived from written-beside — it only catches
      the divergence, which is to say it catches the fossil one rename too late.
      That is precisely how `FORMA-` survived.

      **The invariant that actually holds is a COUNT: the prefix is written down
      once.** Prose-stripped, its literal text appears exactly once across the
      declaration and all three consumers, and that once is the declaration.
    */
    const files = await Promise.all(
      [DECLARATION, ROUTER, DB, MODAL].map(async (source) => ({
        source,
        code: withoutProse(await readFile(source, "utf8")),
      })),
    );
    const occurrences = files.flatMap(({ source, code }) =>
      [...code.matchAll(new RegExp(REFERRAL_CODE_PREFIX, "g"))].map(() => source.pathname),
    );
    expect(occurrences, `the prefix is written in ${occurrences.length} places`)
      .toHaveLength(1);
    expect(occurrences[0]).toBe(DECLARATION.pathname);

    /* The declared gap, asserted so it stays deliberate: the accepted class
       admits I and O, which are never minted. See the module's docblock. */
    expect(REFERRAL_CODE_MINT_ALPHABET).not.toContain("I");
    expect(REFERRAL_CODE_MINT_ALPHABET).not.toContain("O");
    expect(isValidReferralCodeFormat(`${REFERRAL_CODE_PREFIX}-IOAAAA`)).toBe(true);
  });

  it("THE DEFECT ITSELF: the customer's sentence names the prefix that is minted", () => {
    /*
      This is the arm the six months bought. It is an assertion about the
      COMPOSED sentence, not about a spelling: change `REFERRAL_CODE_PREFIX` and
      this still passes, because the message is built from it. Re-type a prefix
      into the message and it goes red.
    */
    expect(REFERRAL_CODE_EXAMPLE).toBe(
      `${REFERRAL_CODE_PREFIX}${REFERRAL_CODE_SEPARATOR}${"X".repeat(REFERRAL_CODE_BODY_LENGTH)}`,
    );
    expect(REFERRAL_CODE_FORMAT_MESSAGE).toContain(REFERRAL_CODE_EXAMPLE);
    expect(REFERRAL_CODE_FORMAT_MESSAGE).not.toContain("FORMA");
  });

  it("NO consumer hand-types the prefix — the mirror, banned by spelling", async () => {
    /*
      The sabotage this arm exists for is the one that actually happened: a
      rename fixes the declaration and misses a quotation. Prose is stripped
      first, so the docblocks in these very files — which quote the dead prefix
      on purpose, to record the incident — cannot pass for the breach they
      describe.

      The ban is on ANY `WORD-` prefix literal, not on `FORMA-` alone: a rule
      spelled as the last mistake only catches the last mistake.
    */
    for (const source of [ROUTER, DB, MODAL]) {
      const code = withoutProse(await readFile(source, "utf8"));
      expect(
        code,
        `${source.pathname} hand-types a referral code prefix`,
      ).not.toMatch(/[A-Z]{4,}-X{3,}/);
      /*
        ⚠ THIS LINE WAS BORN HOLDING THE DEFECT IT BANS. It read
        `.not.toContain("FORMA")` and went red on the fix itself, because
        `REFERRAL_CODE_FORMAT_MESSAGE` — the constant this whole change exists
        to introduce — contains the four letters FORMA inside the word FORMAT.
        A ban spelled at the wrong boundary refuses its own repair. The prefix
        is only ever a prefix when the separator follows it.
      */
      expect(code, `${source.pathname} re-typed the dead prefix`).not.toMatch(/FORMA-/);
    }
  });

  it("both refusal sites use the composed sentence, and there are exactly two", async () => {
    /*
      Two sites, both reachable: the router's `redeem` (the code she typed) and
      `claimReferral`'s (the code that rode in on a `?ref=` link). Only the
      first ever carried a format hint, which is precisely why the fossil in it
      went unseen — the other had nothing to go stale.
    */
    const [router, db] = await Promise.all([
      readFile(ROUTER, "utf8").then(withoutProse),
      readFile(DB, "utf8").then(withoutProse),
    ]);

    /*
      ⚠ THIS ARM PASSED ITS OWN SABOTAGE AND HAD TO BE REWRITTEN. It asserted
      `toContain("REFERRAL_CODE_FORMAT_MESSAGE")`, which the IMPORT LINE alone
      satisfies — so replacing the use site with a hand-typed (and correct!)
      sentence left the import standing and the arm green. *An import is not a
      call site*, on the very arm written to stop a second copy.

      Both halves are asserted now: the constant is used AT THE REFUSAL, and the
      sentence itself exists nowhere in either consumer.
    */
    expect(router, "the router does not use the constant AT its refusal")
      .toMatch(/message:\s*REFERRAL_CODE_FORMAT_MESSAGE/);
    expect(db, "the db layer does not use the constant AT its refusal")
      .toMatch(/error:\s*REFERRAL_CODE_FORMAT_MESSAGE/);

    /* No consumer may re-compose this sentence, correctly or otherwise. */
    for (const code of [router, db]) {
      expect(code).not.toContain("Invalid referral code format");
    }
  });

  it("the box shows the same shape the refusal names", async () => {
    const modal = withoutProse(await readFile(MODAL, "utf8"));
    expect(modal).toContain("REFERRAL_CODE_EXAMPLE");
    expect(modal).not.toMatch(/placeholder="[A-Z]/);
  });
});
