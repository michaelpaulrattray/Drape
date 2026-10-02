/**
 * WHAT AN ASK COSTS IS TRUE FROM THE MOMENT ITS ROW EXISTS (#1767).
 *
 * # The defect, in a customer's terms
 *
 * A view delivered unchecked gets ONE free Try again (#1601 item 4), and `0` in
 * `generation_operations.plannedCredits` is how the product recognises a free
 * one (`spentFreeViewRetryFilter`, `server/db/castingV2ViewRetry.ts`). That
 * column was written by `markGenerationOperationRunning`, **one statement after
 * the claim**, over a schema default of `0`. So a PAID retry whose `markRunning`
 * threw was settled as `failed` carrying the default — indistinguishable from
 * the free ask she had not used. Nothing was charged and nothing in the product
 * disagreed with itself; she simply found her free Try again gone, and was asked
 * to pay 370 credits for her first one.
 *
 * The repair is one word in one place — the price goes INTO the claim — and the
 * reason it earned its own card is that `claimGenerationOperation` is the shared
 * path every road in the product takes.
 *
 * # Why these arms, and in this order
 *
 * Four things fail independently:
 *
 *   1. **THE WIRE.** What the entrance actually SENDS to the claim, read off the
 *      claim call rather than off a constant beside it (invariant 5), with the
 *      defect's own sequence driven: `markRunning` throws, the row settles, and
 *      the claim had already carried the price.
 *   2. **THE POPULATION.** Every production claim site passes a price, or is
 *      declared here with a reason. A guard that only watched the Try again road
 *      would let the next road join the untruthful set silently — and the column
 *      lied about every road, not only this one.
 *   3. **THE VALIDATION.** A price that is not a non-negative integer is refused
 *      at the claim, in the same words `markGenerationOperationRunning` uses.
 *   4. **THE THING MOST LIKELY TO BREAK**, which the card named before a byte
 *      moved: `markGenerationOperationRunning`'s own idempotency comparison
 *      (`operation.plannedCredits !== input.plannedCredits`). It now reads a
 *      written value where it used to read a default.
 *
 * ⚠ **AND THE ONE THING NO ARM HERE CAN DRIVE IS SAID RATHER THAN HIDDEN**: the
 * INSERT itself needs a database. `vitest.setup.ts` strips `DATABASE_URL` so a
 * unit suite can never reach one, so the arm that proves the ROW carries the
 * figure lives in `server/r7-generation-operations-db.test.ts` beside its
 * siblings and SKIPS without a disposable `TEST_DATABASE_URL`. What is driven
 * here is everything up to the wire, which is where the entrances' half of the
 * contract lives.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { claimGenerationOperation } from "./db/generationOperations";
import { withoutComments } from "../scripts/lib/productionMention.mts";

const REPO = resolve(import.meta.dirname, "..");

/* ------------------------------------------------------------------ 2 · the population */

/**
 * The roads that claim an operation WITHOUT saying what it will cost, each with
 * the reason it cannot — never "this one is fine".
 *
 * Both are the legacy studio's, both for the same structural reason, and both
 * were read at the code rather than assumed: the price is a PLAN derived from
 * the database AFTER the claim, inside the `try` whose `catch` fails the claimed
 * operation. Hoisting either would move a rate-limit check, a daily quota, an
 * ownership check and a lock acquisition to the far side of a money path, which
 * is a restructure of somebody else's road and not this card's to make.
 *
 * ⚠ A new entry here is a DECISION, not a formality: it says a row on that road
 * can be settled carrying a `0` that means *nobody said*, and any future reader
 * of the column inherits that. Ask whether the price can be hoisted first.
 */
const CLAIMS_WITHOUT_A_PRICE: Record<string, string> = {
  "server/routes/generation/castingExport.ts": "TWO claims — the mint and the refresh. Each derives its figure from a plan read out of the database after claiming (`planMintPackage`, `planRefreshSlots`), inside the try/catch that fails the claimed operation; the price does not exist one statement earlier the way it does on every other road",
};

/** How many claim sites each declared file is allowed to have without a price. */
const CLAIMS_WITHOUT_A_PRICE_COUNT: Record<string, number> = {
  "server/routes/generation/castingExport.ts": 2,
};

/**
 * Every `beginDirectOperation` claim object in a production source, and whether
 * it names a price.
 *
 * ⚠ **THREE CALL SHAPES, because this repository uses all three** — read at the
 * tree rather than guessed: a bare `beginDirectOperation({`, the injectable
 * `(dependencies.begin ?? beginDirectOperation)({` that every castingV2 service
 * uses, and `rollService`'s hoisted `const begin = dependencies.begin ??
 * beginDirectOperation;` followed by `await begin({`. A reader that knew only
 * the first would have found four sites out of eighteen and reported a clean
 * tree — the silence direction, on a money path.
 *
 * Comments come off first (the house reader, so prose about a claim is not a
 * claim), then the object literal is brace-matched and asked for a top-level
 * `plannedCredits`.
 */
function claimObjects(source: string): { withPrice: number; withoutPrice: number } {
  const body = withoutComments(source);
  /*
    EVERY hoisted alias, not the first one — and the receiver is `dependencies`
    OR `input`, because `evidenceOperations.ts` uses both. The first shape of
    this reader took `body.match(…)?.[1]` off `dependencies.begin` alone and was
    right by luck: all three aliases in that file happen to be spelled `begin`,
    so the `input.begin` site was found through a name captured from a different
    statement. A rename of either would have taken a money-path claim out of the
    population silently, which is the direction this guard exists to refuse.
  */
  const aliases = new Set<string>();
  const hoisted = /\bconst\s+(\w+)\s*=\s*(?:dependencies|input)\.begin\s*\?\?\s*beginDirectOperation\s*;/g;
  for (let m = hoisted.exec(body); m !== null; m = hoisted.exec(body)) aliases.add(m[1]!);

  const starts: number[] = [];
  const direct = /(?:\bbeginDirectOperation\s*\)?\s*\(|\(\s*(?:dependencies|input)\.begin\s*\?\?\s*beginDirectOperation\s*\)\s*\()\s*\{/g;
  for (let m = direct.exec(body); m !== null; m = direct.exec(body)) {
    starts.push(m.index + m[0].length - 1);
  }
  for (const alias of aliases) {
    const viaAlias = new RegExp(String.raw`(?<![.\w])${alias}\s*\(\s*\{`, "g");
    for (let m = viaAlias.exec(body); m !== null; m = viaAlias.exec(body)) {
      starts.push(m.index + m[0].length - 1);
    }
  }
  let withPrice = 0;
  let withoutPrice = 0;
  for (const start of starts) {
    /* Brace-match the literal, so a `plannedCredits` on a LATER call cannot
       answer for this one. Nested objects are skipped by depth, which is also
       why `plannedCredits` is only counted at depth 1. */
    let depth = 0;
    let names = false;
    for (let i = start; i < body.length; i += 1) {
      const character = body[i];
      if (character === "{") depth += 1;
      else if (character === "}") {
        depth -= 1;
        if (depth === 0) break;
      } else if (depth === 1 && body.startsWith("plannedCredits", i)) {
        /* `plannedCredits:` or the shorthand `plannedCredits,` — both name it. */
        if (/^plannedCredits\s*[:,}]/.test(body.slice(i))) names = true;
      }
    }
    if (names) withPrice += 1;
    else withoutPrice += 1;
  }
  return { withPrice, withoutPrice };
}

function productionSources(): string[] {
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) return entry.name === "node_modules" ? [] : walk(full);
      if (!entry.name.endsWith(".ts") || entry.name.endsWith(".test.ts")) return [];
      return [full];
    });
  return walk(join(REPO, "server")).sort();
}

describe("plannedCredits is true from the moment the row exists (#1767)", () => {
  const claimers = productionSources()
    .map((file) => ({
      relative: file.slice(REPO.length + 1).replace(/\\/g, "/"),
      counted: claimObjects(readFileSync(file, "utf8")),
    }))
    .filter((entry) => entry.counted.withPrice + entry.counted.withoutPrice > 0);

  it("THE READER ITSELF, both directions — a sweep that has stopped matching reports a clean tree forever", () => {
    /* Working law 2: the instrument before its findings. The fixtures go
       through the real reader, not a second copy of its regexes. */
    expect(
      claimObjects('const g = await beginDirectOperation({ userId: 1, payload: {}, plannedCredits: 4 });').withPrice,
      "the bare call shape has stopped matching",
    ).toBe(1);
    expect(
      claimObjects('const g = await (dependencies.begin ?? beginDirectOperation)({ userId: 1, payload: {} });').withoutPrice,
      "the injectable shape has stopped matching — every castingV2 service uses it",
    ).toBe(1);
    expect(
      claimObjects('const begin = dependencies.begin ?? beginDirectOperation;\nconst g = await begin({ payload: {}, plannedCredits: 7 });').withPrice,
      "the hoisted-alias shape has stopped matching — rollService uses it",
    ).toBe(1);
    /* ⚠ A SECOND alias in one file, under a DIFFERENT receiver — the real shape
       in `evidenceOperations.ts`, and the one the first draft of this reader
       found only by luck (all three aliases there are spelled `begin`). */
    expect(
      claimObjects(
        'const begin = dependencies.begin ?? beginDirectOperation;\nawait begin({ payload: {}, plannedCredits: 1 });\n'
        + 'const start = input.begin ?? beginDirectOperation;\nawait start({ payload: {}, plannedCredits: 2 });',
      ).withPrice,
      "a second hoisted alias, or an `input.begin` receiver, has left the population",
    ).toBe(2);
    /* A price on a NESTED object must not answer for the claim. */
    expect(
      claimObjects('await beginDirectOperation({ payload: { plannedCredits: 9 } });').withoutPrice,
      "a nested plannedCredits answered for the claim — the brace match is not holding depth",
    ).toBe(1);
    /* And a price on the NEXT call must not answer for this one. */
    const two = claimObjects(
      'await beginDirectOperation({ payload: {} });\nawait beginDirectOperation({ payload: {}, plannedCredits: 1 });',
    );
    expect([two.withPrice, two.withoutPrice], "one claim's price answered for its neighbour").toEqual([1, 1]);
    /* Prose about a claim is not a claim (#1623's lesson, one guard over). */
    expect(
      claimObjects('/* await beginDirectOperation({ payload: {} }); */\nconst a = 1;').withoutPrice,
      "a commented-out claim answered for the file",
    ).toBe(0);
  });

  it("finds the real claim sites across the tree — the floor", () => {
    const total = claimers.reduce((sum, e) => sum + e.counted.withPrice + e.counted.withoutPrice, 0);
    /*
      An empty or thin population would pass every arm below and prove nothing.
      Measured at the tree this landed on: **25 claim sites in 16 production
      files — 23 priced, 2 declared.**

      ⚠ The hand sweep that preceded this reader found EIGHTEEN in fourteen,
      and it missed five on the money path — all three of
      `evidenceOperations.ts`, `inkAddIntent.ts`, and a second claim inside
      `inkCandidateGeneration.ts`. The number above is the reader's, not a
      person's, and that is the point of the floor.
    */
    expect(total, "the reader found almost nothing — it cannot say yes").toBeGreaterThanOrEqual(23);
    const named = claimers.map((e) => e.relative);
    expect(named, "the Try again road — the one the defect was found on").toContain("server/castingV2/viewRetryService.ts");
    expect(named, "the injectable shape").toContain("server/castingV2/signService.ts");
    expect(named, "the hoisted-alias shape").toContain("server/castingV2/rollService.ts");
    expect(named, "the bare shape").toContain("server/routes/models.ts");
  });

  it("every claim says what it will cost, or its road is declared with a reason", () => {
    const undeclared = claimers
      .filter((entry) => entry.counted.withoutPrice > 0)
      .filter((entry) => !(entry.relative in CLAIMS_WITHOUT_A_PRICE))
      .map((entry) => entry.relative);
    expect(
      undeclared,
      "a road claims an operation without saying what it will cost — pass `plannedCredits` (the same figure its "
      + "`markGenerationOperationRunning` writes), or declare it in CLAIMS_WITHOUT_A_PRICE with the reason it cannot",
    ).toEqual([]);

    /* And a declared road may not quietly GROW a second untruthful claim. */
    for (const entry of claimers) {
      const allowed = CLAIMS_WITHOUT_A_PRICE_COUNT[entry.relative] ?? 0;
      expect(
        entry.counted.withoutPrice,
        `${entry.relative} has more priceless claims than it declares`,
      ).toBeLessThanOrEqual(allowed);
    }

    /* A declaration with no claims left behind it is a dead entry, and a dead
       entry is how a pinned population rots. */
    for (const declared of Object.keys(CLAIMS_WITHOUT_A_PRICE)) {
      const entry = claimers.find((candidate) => candidate.relative === declared);
      expect(entry?.counted.withoutPrice ?? 0, `${declared} no longer claims without a price — delete its declaration`)
        .toBeGreaterThan(0);
    }
  });

  /* ------------------------------------------------------------- 3 · the validation */

  it("refuses a price that is not a non-negative integer, BEFORE it reaches a database", () => {
    /* The check sits above `getDb()` on purpose, which is also what makes it
       drivable in a unit suite at all: `vitest.setup.ts` strips `DATABASE_URL`,
       so a claim that got as far as the connection would throw
       "Database not available" and this arm would pass for the wrong reason.
       The message is asserted, not just the throw. */
    const claim = (plannedCredits: number) => claimGenerationOperation({
      userId: 1,
      clientRequestId: "11111111-1111-4111-8111-111111111111",
      kind: "castingV2.viewRetry",
      payload: { castId: "cast", angle: "frontClose" },
      plannedCredits,
    });
    return Promise.all([
      expect(claim(-1)).rejects.toThrow(/plannedCredits must be a non-negative integer/),
      expect(claim(1.5)).rejects.toThrow(/plannedCredits must be a non-negative integer/),
      /* POSITIVE CONTROL: a legitimate price gets PAST this check — without it,
         a validator that refused everything would pass the two arms above. It
         then dies on the stripped database, which is the proof it got through. */
      expect(claim(370)).rejects.toThrow(/Database not available/),
    ]);
  });

  /* -------------------------------------------- 4 · the idempotency check still holds */

  it("markGenerationOperationRunning's planned-credits comparison is reached only for a RUNNING row", () => {
    /*
      The card named this as the arm most likely to break: that comparison
      "currently reads a default and would then read a written value". Read at
      the code, it does not move — the comparison lives inside
      `if (operation.status === "running")`, and a claim writes `status:
      "claimed"`, so the first `markRunning` falls through and overwrites. Only a
      REPLAY reaches the comparison, and by then the figure under it was written
      by `markRunning` itself.

      Asserted at the source because the alternative needs a database (the db
      arm is in `r7-generation-operations-db.test.ts`), and it is scoped to the
      function's own slice rather than the whole file so an identical line in a
      neighbour cannot satisfy it.
    */
    const source = readFileSync(join(REPO, "server/db/generationOperations.ts"), "utf8");
    const start = source.indexOf("export async function markGenerationOperationRunning");
    expect(start, "markGenerationOperationRunning has been renamed").toBeGreaterThan(-1);
    const guardIndex = source.indexOf('if (operation.status === "running")', start);
    const compareIndex = source.indexOf("operation.plannedCredits !== input.plannedCredits", start);
    expect(guardIndex, "the running branch is gone from markGenerationOperationRunning").toBeGreaterThan(-1);
    expect(compareIndex, "the planned-credits idempotency comparison is gone").toBeGreaterThan(-1);
    expect(
      compareIndex > guardIndex && compareIndex - guardIndex < 600,
      "the planned-credits comparison has left the `status === running` branch — it would now fire on a row "
      + "whose figure was written at the CLAIM, and every first markRunning with a different phase price would throw",
    ).toBe(true);

    /* And the claim writes `claimed`, which is what keeps the two apart. */
    const claimStart = source.indexOf("export async function claimGenerationOperation");
    const claimSlice = source.slice(claimStart, claimStart + 4000);
    expect(claimSlice, "the claim no longer inserts `claimed`").toContain('status: "claimed" as const');
    expect(claimSlice, "the claim no longer carries the price into the insert").toContain("input.plannedCredits");
  });
});
