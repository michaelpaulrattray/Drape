/**
 * A REFUND COMES BACK TO THE BUCKET IT WAS SPENT FROM (#2185).
 *
 * The defect, found in the relay's review of #2157: `addCreditsIn` settled the
 * purchased bound against the balance before EVERY grant, a refund included.
 * A charge never writes the bound, so right after a charge that used top-up
 * credits the bound still remembered them — and the refund's settle clamped it
 * to the post-charge balance first, forgetting them. The refund then came back
 * as plan credits, and a cancelled plan's expiry took the customer's top-up
 * with it, against the promise "Top-ups stay on your balance."
 *
 * These arms drive the REAL functions — `deductCredits`, `addCredits` and
 * `expirePlanCredits` — against one stateful account row. The double does not
 * know the rule: it renders each statement through Drizzle's own MySQL dialect
 * and applies what the SQL says (a settle, a grant, a charge, the expiry's
 * `set`), so the arithmetic asserted is the arithmetic the statements perform.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

type Account = {
  userId: number;
  balance: number;
  purchasedBalance: number;
  creditsUsed: number;
  creditsPurchased: number;
  rolloverCredits: number;
  planTier: string;
  planCreditsExpireAt: Date | null;
};

let account: Account;
const ledger: Array<Record<string, unknown>> = [];
const statements: string[] = [];

async function render(query: unknown): Promise<{ sql: string; params: unknown[] }> {
  const { MySqlDialect } = await import("drizzle-orm/mysql-core");
  return new MySqlDialect().sqlToQuery(query as never);
}

/** Apply one raw statement from `credits.ts` to the row, by what its SQL says. */
async function applyRaw(query: unknown): Promise<number> {
  const rendered = await render(query);
  const params = rendered.params;
  // Drizzle qualifies each column with its table; the rules below read the column.
  const text = rendered.sql.replace(/`points`\./g, "").replace(/\s+/g, " ");
  statements.push(text);
  const amount = Number(params[0]);
  if (/set `purchasedBalance` = LEAST\(`purchasedBalance`, `balance`\)/i.test(text)) {
    account.purchasedBalance = Math.min(account.purchasedBalance, account.balance);
    return 1;
  }
  if (/set `balance` = `balance` - \?/i.test(text)) {
    if (account.balance < amount) return 0;
    account.balance -= amount;
    account.creditsUsed += amount;
    return 1;
  }
  if (/set `balance` = `balance` \+ \?/i.test(text)) {
    account.balance += amount;
    if (/`creditsPurchased` = COALESCE/i.test(text)) account.creditsPurchased += amount;
    // Whichever bucket's bound the grant names rises with it (#2185).
    for (const [, bound] of text.matchAll(/`(\w+Balance)` = `\w+Balance` \+ \?/gi)) {
      const row = account as unknown as Record<string, number>;
      row[bound] = (row[bound] ?? 0) + amount;
    }
    return 1;
  }
  throw new Error(`the double does not know this statement: ${text}`);
}

const txDouble = {
  execute: async (query: unknown) => [{ affectedRows: await applyRaw(query) }],
  select: () => ({
    from: () => ({
      where: () => ({
        // The grant's settle reads the row `FOR UPDATE` (#2185); a plain read
        // awaits the same answer.
        limit: () =>
          Object.assign(Promise.resolve([{ ...account }]), { for: async () => [{ ...account }] }),
      }),
    }),
  }),
  update: () => ({
    set: (values: Record<string, unknown>) => ({
      where: async () => {
        Object.assign(account, values);
        return [{ affectedRows: 1 }];
      },
    }),
  }),
  insert: () => ({
    values: async (row: Record<string, unknown>) => {
      ledger.push(row);
    },
  }),
};

vi.mock("./db/connection", () => ({
  getDb: vi.fn().mockImplementation(async () => txDouble),
  withTransaction: vi.fn().mockImplementation(async (fn: (tx: unknown) => unknown) => fn(txDouble)),
}));

import { addCredits, creditBuckets, deductCredits, type CreditBucketRow } from "./db/credits";

/** The purchased bucket — `creditBuckets` is the one reader since #2185. */
const purchasedCreditsRemaining = (row: CreditBucketRow) => creditBuckets(row).purchased;
import { expirePlanCredits } from "./db/billing";

const DUE = new Date("2026-11-19T00:00:00Z");
const NOW = new Date("2026-11-20T12:00:00Z");

/** 10,000 credits left from the plan and a 5,000 top-up — the card's account. */
function cardAccount(): Account {
  return {
    userId: 7,
    balance: 15_000,
    purchasedBalance: 5_000,
    creditsUsed: 0,
    creditsPurchased: 0,
    rolloverCredits: 0,
    planTier: "free",
    planCreditsExpireAt: DUE,
  };
}

const roll = (amount: number, ref: string) =>
  deductCredits(7, amount, "generation", "a roll", ref, { toolKind: "image" });

beforeEach(() => {
  account = cardAccount();
  ledger.length = 0;
  statements.length = 0;
});

describe("1 · the card's example: a failed roll's refund keeps its top-up credits", () => {
  it("⚠ spend 15,000, refund 15,000: at day 30 the 10,000 plan credits expire and the 5,000 top-up stays", async () => {
    expect((await roll(15_000, "roll:a")).success).toBe(true);
    expect(account.balance).toBe(0);

    expect((await addCredits(7, 15_000, "refund", "Refund: the roll failed", "refund:roll:a")).success).toBe(true);
    expect(account.balance).toBe(15_000);
    expect(purchasedCreditsRemaining(account)).toBe(5_000);

    const result = await expirePlanCredits(7, DUE, NOW);
    expect(result).toEqual({ outcome: "expired", creditsRemoved: 10_000, newBalance: 5_000 });
    expect(account.balance).toBe(5_000);
  });

  it("a refund sends ONE statement — the grant — and no settle", async () => {
    await roll(15_000, "roll:b");
    statements.length = 0;
    await addCredits(7, 15_000, "refund", "Refund", "refund:roll:b");
    expect(statements).toHaveLength(1);
    expect(statements[0]).not.toMatch(/LEAST/);
  });
});

describe("2 · two rolls, one refunded: plan credits still pay for what remains", () => {
  it("the LATER roll (the one that used the top-up) is refunded: the top-up is whole again", async () => {
    await roll(10_000, "roll:c1"); // all plan credits
    await roll(5_000, "roll:c2"); // all top-up
    await addCredits(7, 5_000, "refund", "Refund", "refund:roll:c2");
    expect(account.balance).toBe(5_000);
    expect(purchasedCreditsRemaining(account)).toBe(5_000);
  });

  it("the EARLIER roll is refunded: the roll that stands is billed to the plan first", async () => {
    await roll(10_000, "roll:d1");
    await roll(5_000, "roll:d2");
    await addCredits(7, 10_000, "refund", "Refund", "refund:roll:d1");
    // One 5,000 charge stands. Plan credits spend first, so it is the plan's:
    // 5,000 of plan credits and the whole 5,000 top-up remain.
    expect(account.balance).toBe(10_000);
    expect(purchasedCreditsRemaining(account)).toBe(5_000);
    expect(await expirePlanCredits(7, DUE, NOW)).toEqual({
      outcome: "expired",
      creditsRemoved: 5_000,
      newBalance: 5_000,
    });
  });

  it("a refund never protects more than the customer bought", async () => {
    await roll(15_000, "roll:e");
    await addCredits(7, 15_000, "refund", "Refund", "refund:roll:e");
    await addCredits(7, 15_000, "refund", "A second, unrelated refund", "refund:other");
    expect(account.balance).toBe(30_000);
    expect(purchasedCreditsRemaining(account)).toBe(5_000);
  });
});

describe("3 · negative controls: every grant that is NOT a refund still settles", () => {
  it("⚠ a BONUS that states no source (a plan change's proration) after the same spend is not a top-up — it lands as plan credits", async () => {
    await roll(15_000, "roll:f");
    await addCredits(7, 15_000, "bonus", "A bonus", "bonus:f");
    expect(account.balance).toBe(15_000);
    expect(purchasedCreditsRemaining(account)).toBe(0);
    expect(await expirePlanCredits(7, DUE, NOW)).toEqual({
      outcome: "expired",
      creditsRemoved: 15_000,
      newBalance: 0,
    });
  });

  it("spent top-ups are not resurrected by a signup grant or a plan's monthly credits", async () => {
    for (const kind of ["signup", "subscription"] as const) {
      account = cardAccount();
      await roll(15_000, `roll:g:${kind}`);
      await addCredits(7, 1_000, kind, `a ${kind}`, `${kind}:g`);
      expect(purchasedCreditsRemaining(account)).toBe(0);
    }
  });
});

describe("4 · the stated limit, both ways: a grant BETWEEN a charge and its refund", () => {
  it("the grant settles the bound, so that refund comes back as plan credits (needs the charge's share on its ledger row)", async () => {
    await roll(15_000, "roll:h");
    await addCredits(7, 1_000, "subscription", "Monthly credit refresh", "sub:h");
    await addCredits(7, 15_000, "refund", "Refund", "refund:roll:h");
    expect(account.balance).toBe(16_000);
    expect(purchasedCreditsRemaining(account)).toBe(0);
  });

  it("⚠ the OTHER direction: a refund of a PRE-renewal plan charge, after the top-up is spent, reads as purchased (capped by the bound)", async () => {
    /*
      The relay's counter-example on PR #2193, pinned as the documented
      behaviour so a change to it is a decision rather than an accident. A
      renewal settles the bound to 5,000 on 15,000; a 15,000 charge spends
      the plan credits and then the top-up; a 2,000 refund of a charge made
      BEFORE the renewal (plan credits) lands, and all 2,000 read as purchased.
    */
    account = { ...cardAccount(), balance: 14_000, purchasedBalance: 5_000 };
    await addCredits(7, 1_000, "subscription", "Monthly credit refresh", "sub:i");
    expect(account.balance).toBe(15_000);
    expect(account.purchasedBalance).toBe(5_000);

    await roll(15_000, "roll:i");
    expect(account.balance).toBe(0);
    expect(account.purchasedBalance).toBe(5_000);

    await addCredits(7, 2_000, "refund", "Refund of a pre-renewal charge", "refund:roll:before-renewal");
    expect(account.balance).toBe(2_000);
    expect(purchasedCreditsRemaining(account)).toBe(2_000);
    // Capped by the bound: it can never exceed what was bought at the last grant.
    expect(purchasedCreditsRemaining(account)).toBeLessThanOrEqual(account.purchasedBalance);
  });
});
