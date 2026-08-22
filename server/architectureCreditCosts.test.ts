/**
 * THE ATLAS HELD TEN PRICES WHERE THE PRODUCT DECLARES THIRTY-TWO NUMBERS ABOUT
 * MONEY — AND ONE OF THE TEN WAS NOT A PRICE.
 *
 * `collectCreditCosts` was `/(\w+)\s*:\s*(\d+)\s*,/g` over ONE file. It is the
 * fourth collector in this generator found reading at a SHAPE where the code
 * already holds a DECLARATION, and it fails the way all four failed: it returns
 * a list that reads exactly as complete as a correct one.
 *
 * Measured against the committed Atlas on 2026-08-23, before the fix:
 *
 *   absent   `CASTING_V2_REFINE_PRICE_CREDITS = 25` — a top-level const rather
 *            than an object property, and the most-charged operation there is
 *   absent   `CASTING_V2_ROLL_PRICE_CREDITS` (160) and
 *            `CASTING_V2_SIGN_PRICE_CREDITS` (450) — the two most-quoted numbers
 *            in the whole Casting V2 program, because both are ARITHMETIC
 *   absent   all eight wardrobe prices and `INK_ADD_PRICE_CREDITS`, because the
 *            collector only ever opened one file
 *   absent   `flashMultiplier: 0.5` — `\d+` followed by `,` does not match `0.5,`
 *   present  `rollCandidateCount: 8`, carried as if 8 were a price. It is a
 *            count of candidates per sheet.
 *   present  `cost:view` and `cost:promotion` — bare member names that said 50
 *            and 200 without saying 50 and 200 of WHAT.
 *
 * # THE TAXONOMY QUESTION IS DISSOLVED, NOT ANSWERED
 *
 * Which of those numbers "is a price" is a judgement — `rollCandidateCount` is
 * excluded by meaning, never by grammar — and the generator, which never runs
 * app code, has no business inventing one. So every number is emitted KEYED BY
 * ITS DECLARING CONSTANT, with its file and, when computed, its expression. The
 * reader sees the provenance and judges; nothing is dropped for failing a
 * definition nobody wrote down.
 *
 * # TWO INSTRUMENTS THAT DO NOT SHARE A RESOLVER (working law 4)
 *
 *   the generator   PARSES the declarations at the AST and folds the arithmetic
 *                   itself, because the type checker widens `20 * 8` to `number`
 *                   and would have gone quiet on exactly the two headline prices
 *   this arm        IMPORTS the cost modules and compares the values TypeScript
 *                   actually EVALUATES against the artifact on disk
 *
 * One reads text, one runs the module. A fold that silently computed the wrong
 * number disagrees here rather than passing.
 *
 * ⚠ LIKE ITS SIBLINGS, THE REPOSITORY ARMS BELOW READ THE COMMITTED ATLAS. A
 * generator edit alone cannot redden them — that is `architectureAtlas.test.ts`'s
 * freshness diff. Change the extractor and the freshness arm fails; change it
 * AND regenerate, and these fail. Neither is sufficient and neither is redundant.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { creditCostsFromSources } from "../scripts/generate-architecture.mts";
import {
  CASTING_V2_COSTS,
  CASTING_V2_REFINE_PRICE_CREDITS,
  CASTING_V2_ROLL_PRICE_CREDITS,
  CASTING_V2_SIGN_COSTS,
  CREDIT_COSTS,
} from "./casting/castingCreditCosts";
import { INK_ADD_PRICE_CREDITS } from "./casting/evidence/evidenceCandidateContract";
import {
  CASTING_V2_SIGN_PRICE_CREDITS,
  CAST_PACKAGE_VIEW_PRICE,
} from "./castingV2/castViewPackage";
import { WARDROBE_CREDIT_COSTS } from "./wardrobe/creditCosts";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

type PriceRow = {
  id: string;
  name: string;
  constant: string;
  member?: string;
  credits: number | null;
  derivedFrom?: string;
  expression?: string;
  aliasOf?: string;
  file: string;
};

const ATLAS: { creditCosts: PriceRow[] } = JSON.parse(
  readFileSync(path.join(repoRoot, "docs/architecture/drape-architecture.json"), "utf8"),
);

/** What the Atlas says one named constant's member costs. */
function atlasCredits(file: string, name: string): number | null | undefined {
  return ATLAS.creditCosts.find((row) => row.file === file && row.name === name)?.credits;
}

describe("the extractor's own population, proven able to fail", () => {
  it("reads an ordinary price table — the shape that always worked", () => {
    /* POSITIVE CONTROL. If this goes red the fixture harness is broken and
       every verdict below is about the harness rather than about the code. */
    const rows = creditCostsFromSources({
      "server/prices.ts": `export const THING_COSTS = { alpha: 350, beta: 300 } as const;`,
    });

    expect(rows.map((row) => [row.name, row.credits])).toEqual([
      ["THING_COSTS.alpha", 350],
      ["THING_COSTS.beta", 300],
    ]);
    expect(rows[0].constant).toBe("THING_COSTS");
    expect(rows[0].member).toBe("alpha");
  });

  it("reads a top-level scalar price, which the old reader could not see at all", () => {
    /* `CASTING_V2_REFINE_PRICE_CREDITS = 25` — a const, not an object property,
       and the most-charged operation in the product. */
    const rows = creditCostsFromSources({
      "server/prices.ts": `export const REFINE_PRICE_CREDITS = 25;`,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ name: "REFINE_PRICE_CREDITS", credits: 25 });
    expect(rows[0].derivedFrom, "a bare literal is not derived from anything").toBeUndefined();
  });

  it("folds arithmetic, and says what it folded", () => {
    /* The 160-credit roll: `rollCandidate * rollCandidateCount`. The TYPE
       CHECKER widens this to `number`, which is why the fold is hand-written. */
    const rows = creditCostsFromSources({
      "server/prices.ts": `export const ROLL_COSTS = { unit: 20, count: 8 } as const;
export const ROLL_PRICE_CREDITS = ROLL_COSTS.unit * ROLL_COSTS.count;`,
    });

    const roll = rows.find((row) => row.name === "ROLL_PRICE_CREDITS");
    expect(roll?.credits).toBe(160);
    expect(roll?.derivedFrom).toBe("ROLL_COSTS.unit * ROLL_COSTS.count");
  });

  it("folds an array's length across a module boundary — the 450-credit Sign", () => {
    /* `promotion + view * CAST_PACKAGE_VIEWS.length`, where the view list lives
       in another file and is not itself a price. */
    const rows = creditCostsFromSources({
      "server/prices.ts": `export const SIGN_COSTS = { promotion: 200, view: 50 } as const;`,
      "server/package.ts": `import { SIGN_COSTS } from "./prices";
export const VIEWS = ["a", "b", "c", "d", "e"] as const;
export const SIGN_PRICE_CREDITS = SIGN_COSTS.promotion + SIGN_COSTS.view * VIEWS.length;`,
    });

    expect(rows.find((row) => row.name === "SIGN_PRICE_CREDITS")?.credits).toBe(450);
  });

  it("reads a decimal, which `\\d+` followed by a comma never matched", () => {
    const rows = creditCostsFromSources({
      "server/prices.ts": `export const THING_COSTS = { flashMultiplier: 0.5, full: 350 } as const;`,
    });

    expect(rows.find((row) => row.member === "flashMultiplier")?.credits).toBe(0.5);
  });

  it("keeps TWO modules' identically-named tables apart — the client/server mirror", () => {
    /* THE DEFECT THIS ARM EXISTS FOR, and it was in the FIRST version of the
       fix rather than in the old code: keyed on `cost:CONST.member`, the second
       file's row was dropped as a duplicate and `CREDIT_COSTS.castingImage`
       came back attributed to `client/`, because `client/` sorts first. The
       server's own price was simply gone from the price list. */
    const rows = creditCostsFromSources({
      "server/prices.ts": `export const CREDIT_COSTS = { castingImage: 350 } as const;`,
      "client/src/prices.ts": `export const CREDIT_COSTS = { castingImage: 350 };`,
    });

    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((row) => row.id)).size, "two rows must not share one id").toBe(2);
    expect(rows.map((row) => row.file).sort()).toEqual([
      "client/src/prices.ts",
      "server/prices.ts",
    ]);
  });

  it("refuses rather than skips when two rows would claim one id", () => {
    /* The anti-silence half stated on its own: a collision STOPS the generator,
       so a future keying mistake cannot quietly drop a module's prices again. */
    expect(() =>
      creditCostsFromSources({
        "server/prices.ts": `export const A_PRICE = { x: 1 };
export const A_PRICE = { x: 2 };`,
      }),
    ).toThrow(/claim the id/);
  });

  it("does not emit a router because its name contains `credits`", () => {
    /* NEGATIVE CONTROL, and a real specimen: `/(COST|PRICE|CREDIT)/i` alone
       matched `creditsRouter` in `server/routes/credits.ts` and emitted the
       whole router body as a price of `null`. Caught by reading the output. */
    const rows = creditCostsFromSources({
      "server/routes/credits.ts": `export const creditsRouter = router({ getBalance: 1 });
export const REAL_PRICE_CREDITS = 25;`,
    });

    expect(rows.map((row) => row.name)).toEqual(["REAL_PRICE_CREDITS"]);
  });

  it("does not emit a constant whose name says nothing about money", () => {
    const rows = creditCostsFromSources({
      "server/prices.ts": `export const RETRY_LIMITS = { attempts: 3 };
export const THING_PRICE = 12;`,
    });

    expect(rows.map((row) => row.name)).toEqual(["THING_PRICE"]);
  });

  it("keeps an unfoldable price VISIBLE, with the expression it could not fold", () => {
    /* Absence and unfoldability are different answers. A price the reader cannot
       compute must show up as an uncomputed price, never as no price. */
    const rows = creditCostsFromSources({
      "server/prices.ts": `export const THING_COSTS = { odd: someFunction(2) };`,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].credits).toBeNull();
    expect(rows[0].expression).toBe("someFunction(2)");
  });

  it("names an alias rather than printing one table twice", () => {
    /* `POINT_COSTS = CREDIT_COSTS` — the legacy alias. */
    const rows = creditCostsFromSources({
      "server/prices.ts": `export const CREDIT_COSTS = { a: 1 } as const;
export const POINT_COSTS = CREDIT_COSTS;`,
    });

    const alias = rows.find((row) => row.name === "POINT_COSTS");
    expect(alias).toMatchObject({ credits: null, aliasOf: "CREDIT_COSTS" });
    expect(rows.filter((row) => row.member === "a"), "the aliased table is not copied out again")
      .toHaveLength(1);
  });

  it("refuses to emit an empty price list", () => {
    /* A partial enumeration reads exactly like a complete one — the whole class.
       The population is non-empty, so this is a refusal about the CONTENT. */
    expect(() =>
      creditCostsFromSources({ "server/thing.ts": `export const RETRY_LIMIT = 3;` }),
    ).toThrow(/names a cost, price or credit/);
  });

  it("refuses when handed no files in scope at all", () => {
    expect(() => creditCostsFromSources({ "drizzle/schema.ts": `export const X_PRICE = 1;` })).toThrow(
      /would emit an empty list/,
    );
  });
});

describe("the committed Atlas against the values TypeScript evaluates", () => {
  const CASTING = "server/casting/castingCreditCosts.ts";
  const PACKAGE = "server/castingV2/castViewPackage.ts";
  const WARDROBE = "server/wardrobe/creditCosts.ts";

  it("agrees with every member of every price table, evaluated", () => {
    /* The second reader: these values come from RUNNING the modules, not from
       parsing them, so a parse that lost or mis-read a member disagrees here. */
    const evaluated: Array<[string, string, number]> = [
      ...Object.entries(CREDIT_COSTS).map(
        ([member, value]) => [CASTING, `CREDIT_COSTS.${member}`, value] as [string, string, number],
      ),
      ...Object.entries(CASTING_V2_COSTS).map(
        ([member, value]) =>
          [CASTING, `CASTING_V2_COSTS.${member}`, value] as [string, string, number],
      ),
      ...Object.entries(CASTING_V2_SIGN_COSTS).map(
        ([member, value]) =>
          [CASTING, `CASTING_V2_SIGN_COSTS.${member}`, value] as [string, string, number],
      ),
      ...Object.entries(WARDROBE_CREDIT_COSTS).map(
        ([member, value]) =>
          [WARDROBE, `WARDROBE_CREDIT_COSTS.${member}`, value] as [string, string, number],
      ),
    ];

    /* ⚠ NOT A SIZE FLOOR. The first version of this arm asserted
       `evaluated.length > 20` to prove its population non-empty, which is a
       magic number pinning a fixture — and it was WRONG on its first run,
       because the wardrobe table has eight prices and the report this arm was
       written from said nine. A two-sided set equality proves the population is
       non-empty AND catches an invented row, with no number to keep current. */
    const declared = evaluated.map(([file, name]) => `${file}|${name}`).sort();
    const inAtlas = ATLAS.creditCosts
      .filter((row) =>
        ["CREDIT_COSTS", "CASTING_V2_COSTS", "CASTING_V2_SIGN_COSTS", "WARDROBE_CREDIT_COSTS"].includes(
          row.constant,
        ),
      )
      .filter((row) => row.file !== "client/src/features/casting/constants.ts")
      .map((row) => `${row.file}|${row.name}`)
      .sort();

    expect(inAtlas, "the parsed table and the evaluated one name the same members").toEqual(
      declared,
    );
    for (const [file, name, value] of evaluated) {
      expect(atlasCredits(file, name), `${name} in the Atlas`).toBe(value);
    }
  });

  it("holds the four DERIVED prices at the numbers the modules compute", () => {
    /* The fold, checked against TypeScript's own arithmetic. `160` and `450` are
       the two numbers this program quotes most and neither was in the Atlas. */
    expect(atlasCredits(CASTING, "CASTING_V2_ROLL_PRICE_CREDITS")).toBe(
      CASTING_V2_ROLL_PRICE_CREDITS,
    );
    expect(atlasCredits(PACKAGE, "CASTING_V2_SIGN_PRICE_CREDITS")).toBe(
      CASTING_V2_SIGN_PRICE_CREDITS,
    );
    expect(atlasCredits(PACKAGE, "CAST_PACKAGE_VIEW_PRICE")).toBe(CAST_PACKAGE_VIEW_PRICE);
    expect(atlasCredits(CASTING, "CASTING_V2_REFINE_PRICE_CREDITS")).toBe(
      CASTING_V2_REFINE_PRICE_CREDITS,
    );
    /* Pinned by literal as well, because a fold that returned the operands'
       product for BOTH would satisfy the identities above. */
    expect([CASTING_V2_ROLL_PRICE_CREDITS, CASTING_V2_SIGN_PRICE_CREDITS]).toEqual([160, 450]);
  });

  it("holds the price that lives outside both cost modules", () => {
    expect(
      atlasCredits("server/casting/evidence/evidenceCandidateContract.ts", "INK_ADD_PRICE_CREDITS"),
      "the collector used to open exactly one file",
    ).toBe(INK_ADD_PRICE_CREDITS);
  });

  it("shows BOTH copies of CREDIT_COSTS, each attributed to its own module", () => {
    /* Working law 4, made visible rather than argued: the client declares its
       own `CREDIT_COSTS` and the two do not agree in shape. This arm asserts the
       Atlas SHOWS the copy; whether the copy should exist is a product question
       and is not decided here. */
    const client = ATLAS.creditCosts.filter(
      (row) => row.file === "client/src/features/casting/constants.ts",
    );
    const server = ATLAS.creditCosts.filter(
      (row) => row.file === CASTING && row.constant === "CREDIT_COSTS",
    );

    expect(client.length, "the client price copy must be visible in the price list").toBeGreaterThan(
      0,
    );
    expect(server.length).toBeGreaterThan(0);
    expect(
      client.map((row) => row.name),
      "the two copies differ in shape, which is the reason to show both",
    ).not.toEqual(server.map((row) => row.name));
  });

  it("no longer holds a bare member name with no constant to own it", () => {
    /* `cost:view` said 50 and never said 50 of what. Every row names its
       declaring constant and its file now, and the schema requires both. */
    for (const row of ATLAS.creditCosts) {
      expect(row.constant, `${row.id} must name its declaring constant`).toBeTruthy();
      expect(row.file, `${row.id} must name its file`).toBeTruthy();
      expect(row.name.startsWith(row.constant), `${row.id} is keyed by its constant`).toBe(true);
    }
  });
});
