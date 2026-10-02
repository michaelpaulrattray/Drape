/**
 * EVERY PRICE A CUSTOMER CAN BE QUOTED DIVIDES BY 5 EXACTLY — #1601 item 1's
 * first done-when, 2026-10-01.
 *
 * # Why it is a rule and not a coincidence
 *
 * What a customer reads is `ledger ÷ 5` (#1600, `shared/creditDisplay.ts`), and
 * `displayPrice` rounds UP. So a ledger price of 1,749 is shown as **350** and
 * charged as 1,749 — the customer is quoted 350 display credits and billed
 * 349.8 of them. Nothing in the product would go red; the ledger would
 * reconcile against itself perfectly; and the only artifact of the defect is a
 * number on a screen that is not the number taken from the balance. The spec
 * chose every figure in the adopted pricing to divide by 5 for exactly this
 * reason (*"Refunds divide cleanly: Roll 30 per candidate, Follow 40, and Sign
 * 700 + 5 × 200"* — his approved proposal, 2026-09-30), and this suite is what
 * keeps that property true of the tree rather than true of the proposal.
 *
 * It bites hardest on REFUNDS, which is why the card asked for it: a refund
 * slice that does not divide is a refund a customer cannot be told about in
 * their own units.
 *
 * # The population is DERIVED, and that is the whole value of this suite
 *
 * The prices come from the **Atlas's own price list** — every number the
 * generator finds declared anywhere under its scanned roots, keyed by its
 * declaring constant and module (`cost:<file>:<CONSTANT>.<member>`). A hand
 * list would have to be kept current by the same person who adds a price, which
 * is working law 4 on the one subject this repository has been bitten by most.
 * Two consequences, and both are deliberate:
 *
 * 1. **A new price constant is enrolled the moment it is declared.** Nobody has
 *    to remember this file exists.
 * 2. **A number in a price module that is NOT a price must be named here, with
 *    its reason.** The Atlas deliberately refuses to classify — its own
 *    docblock records that inventing a taxonomy of what counts as a price is
 *    not a mechanical act, so it emits provenance and leaves the judging to the
 *    reader. This suite is a reader, so it judges, and it judges in public: the
 *    exemptions are four, each one checked at its declaration.
 *
 * `PLAN_TIERS` and the free grant are NOT in the Atlas's price list (its
 * collector does not scan `drizzle/schema.ts` for costs, and the grant is a
 * module-private `const`), and the card named them — so they are read
 * separately and the reading says which road it took.
 *
 * # What it does NOT see, named rather than left to be discovered
 *
 * - A price computed at runtime from something that is not a declared constant.
 *   Nothing here evaluates the product.
 * - A price declared in a module the Atlas's cost collector does not scan. The
 *   floor arm below refuses a silently-short list, which is the failure that
 *   would hide this: a reader that stopped parsing reports an empty population,
 *   which is byte-identical to a perfectly scaled product.
 * - **Top-up prices, which do not exist yet** (#1606). An arm asserts their
 *   absence so that the commit which adds them reddens this file and enrols
 *   them, rather than shipping an unswept price table.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { FREE_SIGNUP_GRANT_CREDITS, PLAN_TIERS } from "../drizzle/schema";
import { LEDGER_PER_DISPLAY_CREDIT } from "../shared/creditDisplay";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

type PriceRow = {
  id: string;
  name: string;
  constant: string;
  credits: number | null;
  file: string;
};

const ATLAS = JSON.parse(
  readFileSync(path.join(repoRoot, "docs/architecture/drape-architecture.json"), "utf8"),
) as { creditCosts: PriceRow[] };

/**
 * THE RULE, as a function, so it can be driven directly rather than only
 * through the population (working law 3: a backstop needs a test the subject
 * cannot rescue).
 */
export function displaysExactly(credits: number): boolean {
  return Number.isSafeInteger(credits) && credits % LEDGER_PER_DISPLAY_CREDIT === 0;
}

/**
 * NUMBERS IN THE PRICE LIST THAT ARE NOT PRICES — each read at its own
 * declaration before it was written here, with what it actually is.
 *
 * ⚠ Two of the four would FAIL the rule and two would pass it. They are all
 * here anyway, because the list answers *"is this a price?"* and not *"would
 * excluding it change today's result?"* — an exemption that exists only while
 * its value happens to divide by 5 is an exemption that silently stops being
 * checked.
 */
const NOT_A_PRICE: Readonly<Record<string, string>> = {
  "cost:server/casting/castingCreditCosts.ts:CREDIT_COSTS.flashMultiplier":
    "0.5 — a RATIO that halves a price, not a price. Read at its declaration: "
    + "`shared/creditDisplay.ts` already records that a non-integer is "
    + "deliberately not refused because of this member.",
  "cost:server/casting/castingCreditCosts.ts:CASTING_V2_COSTS.rollCandidateCount":
    "8 — the number of candidates on a sheet. A shape, not a price; the Atlas's "
    + "own notes name it as the specimen of a non-price in this list.",
  "cost:server/castingV2/carriedGeometry.ts:CARRIED_GEOMETRY_COST_NOTE_ABOVE":
    "10 — how many carried features a face may have before the per-render cost "
    + "is said out loud in the log (`carriedGeometry.ts:391` compares it to "
    + "`slots.length`). A COUNT threshold whose name contains the word cost.",
  "cost:shared/creditDisplay.ts:LEDGER_PER_DISPLAY_CREDIT":
    "5 — the scale itself, which is what this suite divides BY. Exempt because "
    + "it is the rule rather than a subject of it.",
};

/** Every row the Atlas carries a number for, after the four exemptions. */
function pricedRows(): PriceRow[] {
  return ATLAS.creditCosts.filter(
    (row) => typeof row.credits === "number" && !(row.id in NOT_A_PRICE),
  );
}

describe("the rule itself, driven directly", () => {
  it("accepts a ledger price that divides by 5", () => {
    for (const ok of [0, 5, 150, 200, 1000, 1750, 1850, 3500, 8500, 13_500]) {
      expect(displaysExactly(ok), `${ok} divides`).toBe(true);
    }
  });

  it("⚠ REFUSES the near miss, which is the only failure worth guarding", () => {
    /*
      THE POSITIVE CONTROL. 1,749 and 1,751 are the two numbers a careless
      repricing actually produces, and both would be SHOWN as 350: `displayPrice`
      ceils 349.8 to 350 and 350.2 to 351. A guard that only rejected something
      absurd like 1,749.5 would never fire on the mistake that happens.
    */
    for (const bad of [1, 149, 1749, 1751, 8_499, 13_499]) {
      expect(displaysExactly(bad), `${bad} does not divide`).toBe(false);
    }
  });

  it("refuses a non-integer and a non-finite value rather than silently passing one", () => {
    for (const bad of [0.5, 1750.5, Number.NaN, Number.POSITIVE_INFINITY, 2 ** 53]) {
      expect(displaysExactly(bad), `${bad}`).toBe(false);
    }
  });
});

describe("every declared price in the product", () => {
  it("⚠ has a population at all — the floor, before any verdict counts", () => {
    /*
      A reader that stopped parsing reports zero rows, which looks exactly like
      a perfectly scaled product. Two-sided rather than a bare count: the list
      must carry the modules the card names, so a collector that quietly lost
      a whole file is a failure here and not a silence.
    */
    const rows = pricedRows();
    expect(rows.length, "the Atlas price list is empty or unreadable").toBeGreaterThan(25);
    const files = new Set(rows.map((row) => row.file));
    expect(files, "the casting price table is missing from the price list").toContain(
      "server/casting/castingCreditCosts.ts",
    );
    expect(files, "the wardrobe price table is missing from the price list").toContain(
      "server/wardrobe/creditCosts.ts",
    );
    expect(files, "the Sign package's derived prices are missing").toContain(
      "server/castingV2/castViewPackage.ts",
    );
    /* The client's own copy of the legacy prices is in the list ON PURPOSE
       (working law 4, made visible), so it is swept like any other. */
    expect(files, "the client's price copy is missing").toContain(
      "client/src/features/casting/constants.ts",
    );
  });

  it("divides by 5 exactly, every one of them", () => {
    const offenders = pricedRows()
      .filter((row) => !displaysExactly(row.credits as number))
      .map((row) => `${row.id} = ${row.credits}`);
    expect(
      offenders,
      "a ledger price that does not divide by 5 cannot be displayed exactly: "
      + "`displayPrice` rounds UP, so the customer is quoted one number and charged another. "
      + "Either move the price to a multiple of 5, or — if this number is not a price — "
      + "name it in NOT_A_PRICE with what it actually is, read at its declaration.",
    ).toEqual([]);
  });

  it("carries no stale exemption — every exempted id is still in the list", () => {
    /* An exemption whose row has gone is an exemption nobody is reading, and
       the next row to take that name inherits a pass it was never granted. */
    const ids = new Set(ATLAS.creditCosts.map((row) => row.id));
    for (const id of Object.keys(NOT_A_PRICE)) {
      expect(ids, `${id} is exempted here but is no longer in the price list`).toContain(id);
    }
  });

  it("holds this card's own six numbers at the adopted figures", () => {
    /*
      The sweep above would pass if every price in the product were 5. These are
      his approved prices, by name, so the suite says WHICH ledger numbers it is
      asserting divide — and each is shown beside what a customer reads.
    */
    const credits = (id: string) => ATLAS.creditCosts.find((row) => row.id === id)?.credits;
    const CASTING = "cost:server/casting/castingCreditCosts.ts:";
    expect({
      rollSlice: credits(`${CASTING}CASTING_V2_COSTS.rollCandidate`),
      followSlice: credits(`${CASTING}CASTING_V2_COSTS.followCandidate`),
      signPromotion: credits(`${CASTING}CASTING_V2_SIGN_COSTS.promotion`),
      signView: credits(`${CASTING}CASTING_V2_SIGN_COSTS.view`),
      refine: credits(`${CASTING}CASTING_V2_REFINE_PRICE_CREDITS`),
      paidTryAgain: credits(`${CASTING}CASTING_V2_VIEW_RETRY_PRICE_CREDITS`),
    }).toEqual({
      // ⚠ ONE PRICE FOR BOTH since #1753 (his ruling, 2026-10-02). The roll
      // slice came up to the follow's; it was 150 for the one day before that,
      // and 20 before #1601 item 1. The two are still two declared prices.
      rollSlice: 200,      // 40 display × 8 = a Roll at 320
      followSlice: 200,    // 40 display × 8 = a Follow at 320, unmoved
      signPromotion: 3500, // 700 display, kept once the Cast exists
      signView: 1000,      // 200 display, the refundable slice × 5 views
      refine: 1750,        // 350 display
      paidTryAgain: 1850,  // 370 display — his change of 2026-10-01
    });
  });
});

describe("the two populations the Atlas price list cannot see", () => {
  it("every plan's monthly grant divides by 5", () => {
    /*
      Read by IMPORT rather than from the Atlas: its cost collector does not
      scan `drizzle/schema.ts`. Derived over the whole table, so #1602 slice 2's
      new ladder is swept by this arm without it being edited.
    */
    const offenders = Object.entries(PLAN_TIERS)
      .filter(([, tier]) => !displaysExactly(tier.monthlyCredits))
      .map(([rung, tier]) => `${rung} = ${tier.monthlyCredits}`);
    expect(offenders, "a plan grant that cannot be displayed exactly").toEqual([]);
    /* The floor again: an empty table would pass the filter above. */
    expect(Object.keys(PLAN_TIERS).length).toBeGreaterThan(5);
  });

  it("the free signup grant divides by 5", () => {
    /*
      ⚠ **READ AT THE SOURCE, AND THE LIMIT IS STATED RATHER THAN HIDDEN.**
      `INITIAL_CREDITS` is a module-private `const` in `server/db/credits.ts`,
      so there is nothing to import from THAT module. #1602 slice 1 (PR #1682)
      moved the grant to ONE place — `FREE_SIGNUP_GRANT_CREDITS` in
      `drizzle/schema.ts` — and `credits.ts` now declares
      `const INITIAL_CREDITS = FREE_SIGNUP_GRANT_CREDITS;`. This arm therefore
      asserts two things: that the declaration still reads the one place (a
      second literal creeping back in is the law-4 drift this arm exists to
      catch, and a rename is a red rather than a silent pass), and that the one
      place divides by 5. Re-pinned on `release/p1-scale` (2026-10-02), where the
      two branches met; the earlier regex matched a literal that no longer exists.
    */
    const source = readFileSync(path.join(repoRoot, "server/db/credits.ts"), "utf8");
    const declaration = /^const INITIAL_CREDITS = FREE_SIGNUP_GRANT_CREDITS;/m.exec(source);
    expect(declaration, "`INITIAL_CREDITS` in server/db/credits.ts no longer reads FREE_SIGNUP_GRANT_CREDITS — a second copy of the free grant, or a rename")
      .not.toBeNull();
    expect(displaysExactly(FREE_SIGNUP_GRANT_CREDITS)).toBe(true);
    expect(FREE_SIGNUP_GRANT_CREDITS).toBe(13_500);
  });

  it("⚠ names the top-up prices as ABSENT, so the commit that adds them enrols them here", () => {
    /*
      #1606 sells 5,000 / 10,000 / 25,000 display credits for $12 / $24 / $60,
      and it is explicitly after #1604. There is no top-up price table in the
      tree today, so there is nothing to sweep — and an arm that quietly swept
      an empty set is how the card's own done-when ("a sweep over … top-ups")
      gets reported as satisfied by a sweep that could not fail.

      This arm is the coupling instead: the day a top-up constant is declared,
      the Atlas emits it, this arm reddens, and whoever added it decides whether
      it joins `pricedRows()` or `NOT_A_PRICE`.
    */
    const topups = ATLAS.creditCosts.filter((row) => /topup|top_up/i.test(row.id));
    expect(
      topups.map((row) => row.id),
      "a top-up price now exists — enrol it: its ledger amounts are fixed grants and must divide by 5",
    ).toEqual([]);
  });
});
