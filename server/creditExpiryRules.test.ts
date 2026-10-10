/**
 * WHICH CREDITS EXPIRE, AND WHEN — his rulings on #2185, 2026-10-10, verbatim:
 * "Referral credits (proposed) Never expire, same as top-ups.", "promo and
 * signup bonuses after 90 days? Expire after 90 days.", and then, superseding
 * that for the starting credits: "starting credits are just a default every
 * account starts with lets make them never expire to simplify things."
 *
 *   top-ups            never expire                           (unchanged)
 *   starting credits   never expire
 *   referral credits   never expire
 *   staff goodwill     never expires
 *   promo bonuses      90 days after the grant
 *   plan credits       unchanged: rollover, downgrade trim, 30 days after a cancel
 *
 * Every arm drives the REAL functions — `initializeUserCredits`, `addCredits`,
 * `deductCredits`, `adjustUserCredits`, `updateUserSubscription`,
 * `refreshMonthlyCredits`, `expirePlanCredits` and `expirePromoCredits` —
 * against ONE stateful account row. The double does not know the rule: raw
 * statements are rendered through Drizzle's own MySQL dialect and applied by
 * what their SQL says, and every `set` write's WHERE is rendered and EVALUATED
 * against the row, so a compare-and-set that should miss does miss.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

type Account = Record<string, unknown> & {
  userId: number;
  balance: number;
  planTier: string;
};

let account: Account;
const ledger: Array<Record<string, unknown>> = [];
/** Each `set` write's WHERE, rendered — the conditions a compare-and-set rests on. */
const wheres: string[] = [];
/** Each `set` write's keys, in order — what a write is allowed to touch. */
const setKeys: string[][] = [];
/** Runs once, between the next plain read and its answer — an interleave. */
let betweenReadAndWrite: (() => Promise<void>) | null = null;

async function render(query: unknown): Promise<{ sql: string; params: unknown[] }> {
  const { MySqlDialect } = await import("drizzle-orm/mysql-core");
  return new MySqlDialect().sqlToQuery(query as never);
}

const num = (key: string) => Number(account[key] ?? 0);

/** Apply one raw statement from `credits.ts` to the row, by what its SQL says. */
async function applyRaw(query: unknown): Promise<number> {
  const rendered = await render(query);
  const text = rendered.sql.replace(/`points`\./g, "").replace(/\s+/g, " ");
  const amount = Number(rendered.params[0]);
  if (/set `balance` = `balance` - \?/i.test(text)) {
    if (num("balance") < amount) return 0;
    account.balance = num("balance") - amount;
    return 1;
  }
  if (/set `balance` = `balance` \+ \?/i.test(text)) {
    account.balance = num("balance") + amount;
    for (const [, bound] of text.matchAll(/`(\w+Balance)` = `\w+Balance` \+ \?/gi)) {
      account[bound] = num(bound) + amount;
    }
    return 1;
  }
  throw new Error(`the double does not know this statement: ${text}`);
}

/** A `set` value that is SQL — only the admin add's analytics counter is one. */
async function applySetValue(key: string, value: unknown): Promise<unknown> {
  if (!value || typeof value !== "object" || !("queryChunks" in (value as object))) return value;
  const rendered = await render(value);
  const text = rendered.sql.replace(/`points`\./g, "");
  if (key === "creditsPurchased" && text === "`creditsPurchased` + ?") {
    return num("creditsPurchased") + Number(rendered.params[0]);
  }
  throw new Error(`the double does not know this set value for ${key}: ${text}`);
}

/** Evaluate a rendered WHERE against the row: a conjunction of simple comparisons. */
function whereHolds(sqlText: string, params: unknown[]): boolean {
  const stripped = sqlText.replace(/[()]/g, " ");
  const parts = stripped.split(/\band\b/i).map((part) => part.trim()).filter(Boolean);
  let p = 0;
  for (const part of parts) {
    const m = /^`(\w+)` (=|<>) \?$/.exec(part);
    if (!m) throw new Error(`the double cannot evaluate this condition: ${part}`);
    const [, column, op] = m;
    const param = params[p++];
    const held = account[column];
    let equal: boolean;
    if (held instanceof Date) {
      equal = held.getTime() === new Date(`${String(param).replace(" ", "T")}Z`).getTime();
    } else if (typeof param === "number" || typeof held === "number") {
      equal = Number(held ?? 0) === Number(param);
    } else {
      equal = held === param;
    }
    if (op === "=" ? !equal : equal) return false;
  }
  return true;
}

const db = {
  execute: async (query: unknown) => [{ affectedRows: await applyRaw(query) }],
  select: () => ({
    from: () => ({
      where: () => ({
        limit: () => {
          const rows = [{ ...account }];
          const hook = betweenReadAndWrite;
          betweenReadAndWrite = null;
          const answer = (async () => {
            if (hook) await hook();
            return rows;
          })();
          return Object.assign(answer, { for: async () => [{ ...account }] });
        },
      }),
    }),
  }),
  update: () => ({
    set: (values: Record<string, unknown>) => ({
      where: async (condition: unknown) => {
        const rendered = await render(condition);
        const text = rendered.sql.replace(/`points`\./g, "");
        wheres.push(text);
        setKeys.push(Object.keys(values));
        if (!whereHolds(text, rendered.params)) return [{ affectedRows: 0 }];
        for (const [key, value] of Object.entries(values)) account[key] = await applySetValue(key, value);
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
  getDb: vi.fn().mockImplementation(async () => db),
  withTransaction: vi.fn().mockImplementation(async (fn: (tx: unknown) => unknown) => fn(db)),
}));

import { addCredits, creditBuckets, deductCredits, initializeUserCredits } from "./db/credits";
import {
  expirePlanCredits,
  expirePromoCredits,
  refreshMonthlyCredits,
  updateUserSubscription,
} from "./db/billing";
import { adjustUserCredits } from "./db/admin";
import { FREE_SIGNUP_GRANT_CREDITS } from "../drizzle/schema";

const DAY = 86_400_000;
const T0 = new Date("2026-10-10T00:00:00Z");
const at = (days: number) => new Date(T0.getTime() + days * DAY);
const buckets = () => creditBuckets(account as never);

/** A fresh Free account, born through the real `initializeUserCredits`. */
async function newFreeAccount(): Promise<void> {
  account = { userId: 7, balance: 0, planTier: "free" };
  // `initializeUserCredits` INSERTs the row; the double's insert captures it.
  ledger.length = 0;
  await initializeUserCredits(7);
  const row = ledger.shift() as Record<string, unknown>;
  ledger.length = 0;
  account = {
    ...(row as Account),
    keptBalance: Number(row.keptBalance ?? 0),
    promoBalance: 0,
    planCreditsExpireAt: null,
    promoCreditsExpireAt: null,
  };
}

/** Cancel to Free with a plan-credit expiry due at `due`, as the webhook does. */
async function cancelToFree(due: Date) {
  await updateUserSubscription(7, { planTier: "free", planCreditsExpireAt: due });
}

const spend = (amount: number, ref: string) =>
  deductCredits(7, amount, "generation", "a roll", ref, { toolKind: "image" });

beforeEach(async () => {
  betweenReadAndWrite = null;
  await newFreeAccount();
  wheres.length = 0;
});

describe("1 · starting credits never expire, on any plan", () => {
  it("⚠ they are born in the bucket that never expires, not the plan's", () => {
    expect(account.balance).toBe(FREE_SIGNUP_GRANT_CREDITS);
    expect(buckets()).toMatchObject({ kept: FREE_SIGNUP_GRANT_CREDITS, plan: 0 });
  });

  it("⚠ upgrade, cancel, let the 30 days run: the plan's credits go and the starting credits stay", async () => {
    await updateUserSubscription(7, { planTier: "pro" });
    await addCredits(7, 10_000, "subscription", "Monthly credit refresh", "sub:1");
    await cancelToFree(at(30));
    expect(await expirePlanCredits(7, at(30), at(31))).toEqual({
      outcome: "expired",
      creditsRemoved: 10_000,
      newBalance: FREE_SIGNUP_GRANT_CREDITS,
    });
  });

  it("they survive a renewal with no rollover, however long the account stays paid", async () => {
    await updateUserSubscription(7, { planTier: "starter" });
    for (let month = 1; month <= 6; month++) {
      await refreshMonthlyCredits(7, 10_000, () => 0, `renewal:1:${month}`);
    }
    expect(account.balance).toBe(FREE_SIGNUP_GRANT_CREDITS + 10_000);
    expect(buckets()).toMatchObject({ kept: FREE_SIGNUP_GRANT_CREDITS, plan: 10_000 });
  });
});

describe("2 · referral credits never expire, same as top-ups", () => {
  it("⚠ a cancelled plan's expiry takes the plan's credits and leaves a referral reward whole", async () => {
    await spend(FREE_SIGNUP_GRANT_CREDITS, "roll:2");
    await updateUserSubscription(7, { planTier: "pro" });
    await addCredits(7, 10_000, "subscription", "Monthly credit refresh", "sub:2");
    await addCredits(7, 2_000, "bonus", "Referral bonus", "referral-referrer-1", { bonusSource: "referral" });
    await cancelToFree(at(30));
    expect(await expirePlanCredits(7, at(30), at(31))).toEqual({
      outcome: "expired",
      creditsRemoved: 10_000,
      newBalance: 2_000,
    });
  });

  it("negative control: the same 2,000 as a bonus with no source (a plan change's proration) expires with the plan", async () => {
    await spend(FREE_SIGNUP_GRANT_CREDITS, "roll:2n");
    await updateUserSubscription(7, { planTier: "pro" });
    await addCredits(7, 10_000, "subscription", "Monthly credit refresh", "sub:2n");
    await addCredits(7, 2_000, "bonus", "Prorated credits for upgrade", "plan-change:2n");
    await cancelToFree(at(30));
    expect(await expirePlanCredits(7, at(30), at(31))).toEqual({
      outcome: "expired",
      creditsRemoved: 12_000,
      newBalance: 0,
    });
  });
});

describe("3 · staff goodwill never expires", () => {
  it("⚠ an admin's add (admin_add) survives a cancelled plan's expiry", async () => {
    await spend(FREE_SIGNUP_GRANT_CREDITS, "roll:3");
    await updateUserSubscription(7, { planTier: "pro" });
    await addCredits(7, 10_000, "subscription", "Monthly credit refresh", "sub:3");
    expect((await adjustUserCredits(7, 3_000, "sorry about the outage", 1, "adj:3")).success).toBe(true);
    await cancelToFree(at(30));
    expect(await expirePlanCredits(7, at(30), at(31))).toEqual({
      outcome: "expired",
      creditsRemoved: 10_000,
      newBalance: 3_000,
    });
  });

  it("a change request's goodwill bonus lands in the same bucket", async () => {
    await addCredits(7, 3_000, "bonus", "Credits added via change request #9", "cr-9", { bonusSource: "goodwill" });
    expect(buckets().kept).toBe(FREE_SIGNUP_GRANT_CREDITS + 3_000);
  });
});

describe("4 · promo bonuses expire 90 days after the grant (no promo exists yet — the model carries it)", () => {
  it("⚠ a promo is stamped at its grant and expires alone at day 90 — on Free too", async () => {
    await addCredits(7, 4_000, "bonus", "A promo", "promo:4", { bonusSource: "promo", now: T0 });
    expect(account.promoCreditsExpireAt).toEqual(at(90));
    expect(await expirePromoCredits(7, at(90), at(89))).toEqual({ outcome: "not-due" });
    expect(await expirePromoCredits(7, at(90), at(91))).toEqual({
      outcome: "expired",
      creditsRemoved: 4_000,
      newBalance: FREE_SIGNUP_GRANT_CREDITS,
    });
    expect(account.promoCreditsExpireAt).toBeNull();
    expect(ledger.at(-1)).toMatchObject({ type: "bonus", amount: -4_000 });
  });

  it("a promo spends before the credits that never expire", async () => {
    await addCredits(7, 4_000, "bonus", "A promo", "promo:4s", { bonusSource: "promo", now: T0 });
    await spend(3_000, "roll:4s");
    expect(buckets()).toMatchObject({ promo: 1_000, kept: FREE_SIGNUP_GRANT_CREDITS });
  });
});

describe("5 · plan credits are unchanged", () => {
  it("negative control: with only plan credits on the row, the expiry takes all of them, exactly as #2152 shipped", async () => {
    await spend(FREE_SIGNUP_GRANT_CREDITS, "roll:5");
    await updateUserSubscription(7, { planTier: "pro" });
    await addCredits(7, 10_000, "subscription", "Monthly credit refresh", "sub:5");
    await cancelToFree(at(30));
    expect(await expirePlanCredits(7, at(30), at(31))).toEqual({
      outcome: "expired",
      creditsRemoved: 10_000,
      newBalance: 0,
    });
  });
});

describe("6 · the relay's finding 1 on PR #2208: a sweep between a charge and its refund settles nothing", () => {
  /** 2,000 of top-ups and a 500 promo now due; no starting credits on this row. */
  function promoAndTopUp() {
    account = {
      userId: 7,
      balance: 2_500,
      planTier: "free",
      purchasedBalance: 2_000,
      keptBalance: 0,
      promoBalance: 500,
      promoCreditsExpireAt: at(90),
      planCreditsExpireAt: null,
    };
  }

  it("⚠ a 1,000 roll in flight across the promo's deadline: when it is refunded the top-up is whole again", async () => {
    promoAndTopUp();
    await spend(1_000, "roll:6"); // the 500 promo, then 500 of the top-up
    expect(buckets()).toMatchObject({ promo: 0, purchased: 1_500 });

    expect(await expirePromoCredits(7, at(90), at(91))).toEqual({ outcome: "nothing-to-expire" });
    // Nothing to remove, so the stamp alone is cleared — no bound is settled.
    expect(account.purchasedBalance).toBe(2_000);
    expect(account.promoCreditsExpireAt).toBeNull();

    await addCredits(7, 1_000, "refund", "Refund: the roll failed", "refund:roll:6");
    expect(buckets().purchased).toBe(2_000);
  });

  it("with a promo still held, only its bound and stamp are written — the other bounds stay as they were", async () => {
    promoAndTopUp();
    await spend(200, "roll:6b"); // 200 of the promo
    await expirePromoCredits(7, at(90), at(91));
    expect(account).toMatchObject({ balance: 2_000, purchasedBalance: 2_000, promoBalance: 0, promoCreditsExpireAt: null });
  });

  it("⚠ with a promo to take, the write names the balance, the promo bound and its stamp — and no other column", async () => {
    /*
      The relay's second finding on PR #2208. With credits to take, every
      bound already equals its reading, so restoring a settle here changes no
      number today — which is exactly why it must be pinned by what the write
      NAMES: a settle on a timer is the defect #2193's refunds cannot survive,
      and the keys are the only place it shows.
    */
    promoAndTopUp();
    await spend(200, "roll:6k");
    setKeys.length = 0;
    expect(await expirePromoCredits(7, at(90), at(91))).toMatchObject({ outcome: "expired", creditsRemoved: 300 });
    expect(setKeys).toEqual([["balance", "promoBalance", "promoCreditsExpireAt"]]);
  });

  it("with nothing to take, the write names the stamp alone", async () => {
    promoAndTopUp();
    await spend(1_000, "roll:6z");
    setKeys.length = 0;
    expect(await expirePromoCredits(7, at(90), at(91))).toEqual({ outcome: "nothing-to-expire" });
    expect(setKeys).toEqual([["promoCreditsExpireAt"]]);
  });

  it("the plan-credit expiry with nothing to take settles no bound either", async () => {
    account = {
      userId: 7,
      balance: 1_500,
      planTier: "free",
      purchasedBalance: 2_000, // 500 of the top-up is out on a roll that may be refunded
      keptBalance: 0,
      promoBalance: 0,
      planCreditsExpireAt: at(30),
      promoCreditsExpireAt: null,
    };
    expect(await expirePlanCredits(7, at(30), at(31))).toEqual({ outcome: "nothing-to-expire" });
    expect(account.purchasedBalance).toBe(2_000);
    await addCredits(7, 500, "refund", "Refund", "refund:roll:6c");
    expect(buckets().purchased).toBe(2_000);
  });
});

describe("7 · the relay's finding 2 on PR #2208: a grant and an equal spend between the read and the write", () => {
  /** A 2,000 referral lands and 2,000 are spent: the balance ends where it was read. */
  const referralThenEqualSpend = async () => {
    await addCredits(7, 2_000, "bonus", "Referral bonus", "referral-referrer-7", { bonusSource: "referral" });
    await spend(2_000, "roll:7");
  };

  it("⚠ a renewal does not write the referral's bound back from its stale read", async () => {
    await spend(FREE_SIGNUP_GRANT_CREDITS, "roll:7a");
    await updateUserSubscription(7, { planTier: "starter" });
    await addCredits(7, 5_000, "subscription", "Monthly credit refresh", "sub:7");
    betweenReadAndWrite = referralThenEqualSpend;
    const renewed = await refreshMonthlyCredits(7, 10_000, () => 0, "renewal:7");
    expect(renewed.success).toBe(true);
    // The first write missed on the moved bound and the loop re-read: the
    // referral is still the customer's, beside the new month.
    expect(buckets()).toMatchObject({ kept: 2_000, plan: 10_000 });
    expect(wheres.filter((w) => /`keptBalance` = \?/.test(w)).length).toBeGreaterThanOrEqual(2);
  });

  it("⚠ the plan-credit expiry does not take the referral that landed mid-expiry", async () => {
    await spend(FREE_SIGNUP_GRANT_CREDITS, "roll:7b");
    await updateUserSubscription(7, { planTier: "pro" });
    await addCredits(7, 5_000, "subscription", "Monthly credit refresh", "sub:7b");
    await cancelToFree(at(30));
    betweenReadAndWrite = referralThenEqualSpend;
    const result = await expirePlanCredits(7, at(30), at(31));
    expect(result).toEqual({ outcome: "expired", creditsRemoved: 3_000, newBalance: 2_000 });
    expect(buckets().kept).toBe(2_000);
  });

  it("the promo expiry's write is conditioned on every bound as read, and on the stamp and the balance", async () => {
    await addCredits(7, 4_000, "bonus", "A promo", "promo:7", { bonusSource: "promo", now: T0 });
    wheres.length = 0;
    await expirePromoCredits(7, at(90), at(91));
    expect(wheres).toHaveLength(1);
    for (const column of ["balance", "purchasedBalance", "keptBalance", "promoBalance", "promoCreditsExpireAt"]) {
      expect(wheres[0]).toMatch(new RegExp(`\`${column}\` = \\?`));
    }
    // A promo runs out on any plan — no tier in the condition.
    expect(wheres[0]).not.toMatch(/`planTier`/);
  });
});
