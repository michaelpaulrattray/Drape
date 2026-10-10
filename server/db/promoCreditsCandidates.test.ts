/**
 * WHICH ACCOUNTS THE PROMO SWEEP VISITS (#2185, the relay's finding 4b on PR
 * #2208) — `getPromoCreditsExpiryCandidates` driven, its WHERE rendered by
 * Drizzle's own MySQL dialect and read.
 *
 * A promo runs out 90 days after it was given, on any plan, Free included.
 * So the query asks for exactly two things — a stamp, and a stamp in the past
 * — and NOT the account's tier: a tier filter would let a Free account keep an
 * expired promo forever. (The tier filter the relay named belonged to the
 * starting credits' clock, which his ruling of 2026-10-10 removed: "starting
 * credits are just a default every account starts with lets make them never
 * expire to simplify things.")
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

let answer: Array<{ userId: number; expireAt: Date | null }> = [];
let where = "";
let params: unknown[] = [];

vi.mock("./connection", () => ({
  getDb: async () => ({
    select: () => ({
      from: () => ({
        where: async (condition: unknown) => {
          const { MySqlDialect } = await import("drizzle-orm/mysql-core");
          const rendered = new MySqlDialect().sqlToQuery(condition as never);
          where = rendered.sql.replace(/`points`\./g, "");
          params = rendered.params;
          return answer;
        },
      }),
    }),
  }),
}));

import { getPromoCreditsExpiryCandidates } from "./billing";

const NOW = new Date("2027-01-09T00:00:00Z");

beforeEach(() => {
  answer = [];
  where = "";
  params = [];
});

describe("the promo sweep's candidates", () => {
  it("⚠ asks for a stamp that has passed, and nothing else", async () => {
    await getPromoCreditsExpiryCandidates(NOW);
    expect(where).toMatch(/`promoCreditsExpireAt` is not null/i);
    expect(where).toMatch(/`promoCreditsExpireAt` < \?/);
    expect(params).toEqual(["2027-01-09 00:00:00.000"]);
  });

  it("⚠ does not filter on the plan — a promo runs out on Free as on any plan", async () => {
    await getPromoCreditsExpiryCandidates(NOW);
    expect(where).not.toMatch(/planTier/);
  });

  it("hands back each due account with its own deadline, and drops a row with no stamp", async () => {
    const due = new Date("2027-01-08T00:00:00Z");
    answer = [
      { userId: 7, expireAt: due },
      { userId: 8, expireAt: null },
    ];
    expect(await getPromoCreditsExpiryCandidates(NOW)).toEqual([{ userId: 7, expireAt: due }]);
  });
});
