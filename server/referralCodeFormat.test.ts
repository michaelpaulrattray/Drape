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
  INVITE_CODE_EXAMPLE,
  INVITE_CODE_GROUP_LENGTH,
  ISSUED_CODE_PREFIX,
  REFERRAL_CODE_ACCEPTED_CLASS,
  REFERRAL_CODE_ACCEPTED_PREFIXES,
  REFERRAL_CODE_BODY_LENGTH,
  REFERRAL_CODE_EXAMPLE,
  REFERRAL_CODE_FORMAT_MESSAGE,
  REFERRAL_CODE_LENGTH,
  REFERRAL_CODE_MINT_ALPHABET,
  REFERRAL_CODE_SEPARATOR,
  RETIRED_CODE_PREFIXES,
  mintInviteCode,
  referralCodePattern,
} from "../shared/referralCodeFormat";
import { PRODUCT_NAME } from "../shared/brand";
import { INVITE_CODE_MAX_LENGTH } from "../shared/inputLimits";
import { isValidReferralCodeFormat } from "./db/referrals";

const DECLARATION = new URL("../shared/referralCodeFormat.ts", import.meta.url);
const ROUTER = new URL("./routes/referral.ts", import.meta.url);
const DB = new URL("./db/referrals.ts", import.meta.url);
const MODAL = new URL(
  "../client/src/features/referral/RedeemCodeModal.tsx",
  import.meta.url,
);
const ADMIN_INVITES = new URL("../client/src/pages/AdminInviteCodes.tsx", import.meta.url);
const INVITE_ROUTER = new URL("./routes/admin/inviteCodes.ts", import.meta.url);

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
      const minted = `${ISSUED_CODE_PREFIX}${REFERRAL_CODE_SEPARATOR}${body}`;
      expect(isValidReferralCodeFormat(minted), `${minted} was refused`).toBe(true);
      expect(minted).toHaveLength(
        ISSUED_CODE_PREFIX.length + REFERRAL_CODE_SEPARATOR.length + REFERRAL_CODE_BODY_LENGTH,
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
    expect(isValidReferralCodeFormat(`${ISSUED_CODE_PREFIX}-A3K9X`)).toBe(false);
    expect(isValidReferralCodeFormat(`${ISSUED_CODE_PREFIX}-A3K9X2Z`)).toBe(false);
    expect(isValidReferralCodeFormat("")).toBe(false);
    expect(isValidReferralCodeFormat("INVALID")).toBe(false);
  });

  it("the pattern is BUILT from the declared parts, not written beside them", async () => {
    expect(referralCodePattern().source).toBe(
      `^(?:${REFERRAL_CODE_ACCEPTED_PREFIXES.join("|")})${REFERRAL_CODE_SEPARATOR}[${REFERRAL_CODE_ACCEPTED_CLASS}]{${REFERRAL_CODE_BODY_LENGTH}}$`,
    );

    /*
      ⚠ THE LINE ABOVE PASSED ITS OWN SABOTAGE. Replacing the built pattern with
      a hardcoded `/^DRAPE-[A-Z2-9]{6}$/` leaves `.source` IDENTICAL, so a
      value comparison cannot tell derived from written-beside — it only catches
      the divergence, which is to say it catches the fossil one rename too late.
      That is precisely how `FORMA-` survived.

      **The invariant that actually holds is a COUNT.** Since #2007 the issued
      prefix is not written down at all — it is `PRODUCT_NAME.toUpperCase()` —
      so its literal text appears NOWHERE in the declaration or any consumer,
      and the one retired prefix appears exactly once, in the declaration's
      `RETIRED_CODE_PREFIXES`.
    */
    const files = await Promise.all(
      [DECLARATION, ROUTER, DB, MODAL, ADMIN_INVITES].map(async (source) => ({
        source,
        code: withoutProse(await readFile(source, "utf8")),
      })),
    );
    const count = (word: string) =>
      files.flatMap(({ source, code }) =>
        [...code.matchAll(new RegExp(word, "g"))].map(() => source.pathname),
      );
    expect(count(ISSUED_CODE_PREFIX), "the issued prefix is spelled out").toHaveLength(0);
    for (const retired of RETIRED_CODE_PREFIXES) {
      expect(count(retired), `${retired} is written more than once`)
        .toEqual([DECLARATION.pathname]);
    }

    /* The declared gap, asserted so it stays deliberate: the accepted class
       admits I and O, which are never minted. See the module's docblock. */
    expect(REFERRAL_CODE_MINT_ALPHABET).not.toContain("I");
    expect(REFERRAL_CODE_MINT_ALPHABET).not.toContain("O");
    expect(isValidReferralCodeFormat(`${ISSUED_CODE_PREFIX}-IOAAAA`)).toBe(true);
  });

  it("THE DEFECT ITSELF: the customer's sentence names the prefix that is minted", () => {
    /*
      This is the arm the six months bought. It is an assertion about the
      COMPOSED sentence, not about a spelling: change `ISSUED_CODE_PREFIX` and
      this still passes, because the message is built from it. Re-type a prefix
      into the message and it goes red.
    */
    expect(REFERRAL_CODE_EXAMPLE).toBe(
      `${ISSUED_CODE_PREFIX}${REFERRAL_CODE_SEPARATOR}${"X".repeat(REFERRAL_CODE_BODY_LENGTH)}`,
    );
    expect(REFERRAL_CODE_FORMAT_MESSAGE).toContain(REFERRAL_CODE_EXAMPLE);
    expect(REFERRAL_CODE_FORMAT_MESSAGE).not.toContain("FORMA");
    /* #2007: the sentence names the CURRENT product, never a retired prefix. */
    expect(REFERRAL_CODE_FORMAT_MESSAGE).toBe(
      `Invalid referral code format. Expected: ${PRODUCT_NAME.toUpperCase()}-XXXXXX`,
    );
    for (const retired of RETIRED_CODE_PREFIXES) {
      expect(REFERRAL_CODE_FORMAT_MESSAGE).not.toContain(`${retired}-`);
    }
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
    for (const source of [DECLARATION, ROUTER, DB, MODAL, ADMIN_INVITES]) {
      const code = withoutProse(await readFile(source, "utf8"));
      expect(
        code,
        `${source.pathname} hand-types a referral code prefix`,
      ).not.toMatch(/[A-Z]{4,}-X{3,}/);
      /*
        #2007: the wider ban. A string literal that OPENS with a capitalised
        word and a hyphen is a hand-typed code prefix whatever follows it —
        `DRAPE-${seg()}` minted every invite under the old name and matched
        nothing above, because no `X` followed it.
      */
      expect(
        code,
        `${source.pathname} hand-types a code prefix in a string literal`,
      ).not.toMatch(/["'`][A-Z]{4,}-/);
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

describe("#2007 — codes are issued under the product's name, and old ones still work", () => {
  it("the issued prefix IS the product name — derived, not spelled", async () => {
    expect(ISSUED_CODE_PREFIX).toBe(PRODUCT_NAME.toUpperCase());
    const declaration = withoutProse(await readFile(DECLARATION, "utf8"));
    expect(declaration).toMatch(/ISSUED_CODE_PREFIX\s*=\s*PRODUCT_NAME\.toUpperCase\(\)/);
    expect(REFERRAL_CODE_ACCEPTED_PREFIXES[0]).toBe(ISSUED_CODE_PREFIX);
    expect(RETIRED_CODE_PREFIXES).not.toContain(ISSUED_CODE_PREFIX);
  });

  it("a code minted under the retired DRAPE- prefix still passes — the positive control", () => {
    expect(RETIRED_CODE_PREFIXES).toContain("DRAPE");
    expect(isValidReferralCodeFormat("DRAPE-A3K9X2")).toBe(true);
    expect(isValidReferralCodeFormat("drape-a3k9x2")).toBe(true);
    expect(isValidReferralCodeFormat(`${ISSUED_CODE_PREFIX}-A3K9X2`)).toBe(true);
    expect(isValidReferralCodeFormat(`${ISSUED_CODE_PREFIX.toLowerCase()}-a3k9x2`)).toBe(true);
    /* The box admits the longest accepted shape. */
    for (const prefix of REFERRAL_CODE_ACCEPTED_PREFIXES) {
      expect(`${prefix}-A3K9X2`.length).toBeLessThanOrEqual(REFERRAL_CODE_LENGTH);
    }
  });

  it("the prefix alternation is anchored — the negative control", () => {
    /* A pattern written without the group, `^KLIEG|DRAPE-…$`, would admit these. */
    expect(isValidReferralCodeFormat("XDRAPE-A3K9X2")).toBe(false);
    expect(isValidReferralCodeFormat(`${ISSUED_CODE_PREFIX}DRAPE-A3K9X2`)).toBe(false);
    expect(isValidReferralCodeFormat(`${ISSUED_CODE_PREFIX}-A3K9X2-EXTRA`)).toBe(false);
    expect(isValidReferralCodeFormat(`${ISSUED_CODE_PREFIX}`)).toBe(false);
    expect(isValidReferralCodeFormat("FORMA-A3K9X2")).toBe(false);
  });

  it("an invite code is minted under the issued prefix, in a shape the admin route accepts", async () => {
    let seed = 0;
    const draws = [() => 0, () => 0.9999, Math.random, () => ((seed += 0.137) % 1)];
    for (const random of draws) {
      for (let i = 0; i < 50; i += 1) {
        const code = mintInviteCode(random);
        expect(code).toMatch(
          new RegExp(
            `^${ISSUED_CODE_PREFIX}-[${REFERRAL_CODE_MINT_ALPHABET}]{${INVITE_CODE_GROUP_LENGTH}}-[${REFERRAL_CODE_MINT_ALPHABET}]{${INVITE_CODE_GROUP_LENGTH}}$`,
          ),
        );
        expect(code.length).toBeLessThanOrEqual(INVITE_CODE_MAX_LENGTH);
        expect(code).toHaveLength(INVITE_CODE_EXAMPLE.length);
      }
    }
    /* The admin route's own character rule, read off the route rather than retyped. */
    const route = await readFile(INVITE_ROUTER, "utf8");
    const rule = route.match(/\.regex\((\/.+?\/)[a-z]*,/);
    expect(rule, "the invite route's character rule moved").not.toBeNull();
    const accepted = new Function(`return ${rule![1]}`)() as RegExp;
    expect(accepted.test(mintInviteCode())).toBe(true);
    expect(accepted.test("DRAPE-AB12-CD34")).toBe(true);
    expect(INVITE_CODE_EXAMPLE).toBe(`${ISSUED_CODE_PREFIX}-XXXX-XXXX`);
  });

  it("the admin page mints with the shared generator and shows the shared placeholder", async () => {
    const page = withoutProse(await readFile(ADMIN_INVITES, "utf8"));
    expect(page).toMatch(/placeholder=\{INVITE_CODE_EXAMPLE\}/);
    expect(page).toMatch(/mintInviteCode\(\)/);
    expect(page).not.toMatch(/placeholder="[A-Z]{4,}-/);
  });
});
