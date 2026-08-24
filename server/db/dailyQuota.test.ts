/**
 * THE DAILY GENERATION QUOTA, DRIVEN — the only spend control in the product
 * that had no arm at all.
 *
 * ⚠ IT WAS MOCKED IN EVERY ONE OF ITS SIX TEST APPEARANCES AND DRIVEN IN NONE.
 * `batch0-authority`, `batchC-doors`, `batchC-failureInjection`,
 * `batchC-structured`, `casting/typedIterationDoors` and
 * `r7-wardrobe-image-authority` each replace `enforceDailyQuota` with a
 * `vi.fn()` that resolves — correctly, since none of them is about the quota —
 * and the one file that imports the real thing
 * (`phase-a-quota.test.ts`) asserts `typeof enforceDailyQuota === "function"`.
 * So if it stopped refusing, every account could generate without limit and
 * the whole suite would be green. Found by the label sweep 2026-08-25 (its
 * docblock said "daily quota tracking"), ruled fable-1635 §1.
 *
 * It is genuinely wired — six live call sites, `boardOps.ts:371/:1069/:1396`,
 * `castingExport.ts:383` and `inkCandidateGeneration.ts` twice — so this is a
 * reachable control and not a helper waiting for a caller.
 *
 * What it spends is the HOUSE's money: the limit exists because the image
 * transport's requests-per-day is the bottleneck, not the customer's credits.
 *
 * The limit is read at MODULE LOAD, so every arm sets the variable and then
 * imports through `vi.resetModules()`. An arm that imported first would be
 * measuring whatever the previous arm left behind.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/** Rows the faked count query returns. Set per arm. */
let countRows: Array<{ total: number }> = [];
/** When true, `getDb` answers null — the fail-open path. */
let noDatabase = false;

vi.mock("./connection", () => ({
  getDb: vi.fn().mockImplementation(async () =>
    noDatabase
      ? null
      : {
          select: () => ({
            from: () => ({
              leftJoin: () => ({
                where: async () => countRows,
              }),
            }),
          }),
        },
  ),
}));

const savedLimit = process.env.DAILY_GENERATION_LIMIT;

/** Load the module fresh under a given limit — the constant is module-scoped. */
async function quotaWithLimit(limit: string | undefined) {
  if (limit === undefined) delete process.env.DAILY_GENERATION_LIMIT;
  else process.env.DAILY_GENERATION_LIMIT = limit;
  vi.resetModules();
  return import("./dailyQuota");
}

beforeEach(() => {
  countRows = [];
  noDatabase = false;
});

afterEach(() => {
  if (savedLimit === undefined) delete process.env.DAILY_GENERATION_LIMIT;
  else process.env.DAILY_GENERATION_LIMIT = savedLimit;
});

describe("enforceDailyQuota — the refusal, driven", () => {
  it("UNDER the limit it does not refuse", async () => {
    countRows = [{ total: 9 }];
    const { enforceDailyQuota } = await quotaWithLimit("10");

    await expect(enforceDailyQuota(1)).resolves.toBeUndefined();
  });

  it("AT the limit it refuses with TOO_MANY_REQUESTS", async () => {
    // The boundary is `used < limit`, so the limit-th generation is the one
    // that is refused — not the one after it. Pinned at the edge because an
    // off-by-one here is a day's spend.
    countRows = [{ total: 10 }];
    const { enforceDailyQuota } = await quotaWithLimit("10");

    await expect(enforceDailyQuota(1)).rejects.toMatchObject({
      code: "TOO_MANY_REQUESTS",
    });
  });

  it("OVER the limit it refuses, and the message tells the customer the number and the reset", async () => {
    countRows = [{ total: 57 }];
    const { enforceDailyQuota } = await quotaWithLimit("50");

    await expect(enforceDailyQuota(1)).rejects.toThrow(/Daily generation limit reached \(50 per day\)/);
    await expect(enforceDailyQuota(1)).rejects.toThrow(/resets at midnight UTC/);
    await expect(enforceDailyQuota(1)).rejects.toThrow(/used 57 generations today/);
  });

  it("the DEFAULT is 50 when the variable is unset", async () => {
    countRows = [{ total: 49 }];
    const under = await quotaWithLimit(undefined);
    await expect(under.enforceDailyQuota(1)).resolves.toBeUndefined();

    countRows = [{ total: 50 }];
    const at = await quotaWithLimit(undefined);
    await expect(at.enforceDailyQuota(1)).rejects.toThrow(/50 per day/);
  });

  it("CONTROL — checkDailyQuota reports the arithmetic it refuses on", async () => {
    // Without this the arms above would pass against an `enforceDailyQuota`
    // that threw on a coin flip: this is the number the refusal is computed
    // from, read directly.
    countRows = [{ total: 12 }];
    const { checkDailyQuota } = await quotaWithLimit("20");

    expect(await checkDailyQuota(1)).toEqual({
      allowed: true,
      used: 12,
      limit: 20,
      remaining: 8,
    });
  });

  it("remaining never goes negative", async () => {
    countRows = [{ total: 31 }];
    const { checkDailyQuota } = await quotaWithLimit("20");

    expect(await checkDailyQuota(1)).toMatchObject({ allowed: false, remaining: 0 });
  });

  /*
   * ⚠ FAIL-OPEN, PINNED — AN ARM THAT PINS IS NOT AN ENDORSEMENT.
   *
   * `getUserDailyGenerationCount` opens `if (!db) return 0`, so a database
   * outage makes the count zero and the quota allows everything. The direction
   * question — should the spend control refuse when it cannot read the number?
   * — is filed as its own read (fable-1635) rather than answered here. This
   * arm exists so the behaviour is a decision when someone takes it, and so
   * that changing it cannot happen silently.
   *
   * It is the same family as the Stripe webhook gate's fail-open, found the
   * same day: both are "the control could not read its own state, so it stood
   * aside", and both were undocumented.
   */
  it("⚠ with NO DATABASE the count is zero and the quota ALLOWS — fail-open, pinned", async () => {
    noDatabase = true;
    const { checkDailyQuota, enforceDailyQuota } = await quotaWithLimit("1");

    expect(await checkDailyQuota(1)).toEqual({
      allowed: true,
      used: 0,
      limit: 1,
      remaining: 1,
    });
    await expect(enforceDailyQuota(1)).resolves.toBeUndefined();
  });

  it("an empty result set counts as zero rather than throwing", async () => {
    countRows = [];
    const { checkDailyQuota } = await quotaWithLimit("10");

    expect(await checkDailyQuota(1)).toMatchObject({ used: 0, allowed: true });
  });
});
