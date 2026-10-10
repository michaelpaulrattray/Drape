/**
 * WHICH CREDITS EXPIRE, AND WHEN — his ruling on #2185, 2026-10-10 (terminal),
 * verbatim: "Referral credits (proposed) Never expire, same as top-ups. /
 * Promo and sign-up bonuses (proposed) /// thoughts?", then "promo and signup
 * bonuses after 90 days? Expire after 90 days.", and on the Free account's
 * starting credits: "the free plan credits can last forever sure".
 *
 *   top-ups            never expire                           (unchanged)
 *   referral credits   never expire
 *   starting credits   never on Free; 90 days after an upgrade
 *   promo bonuses      90 days after the grant
 *   staff goodwill     never expires
 *   plan credits       unchanged: rollover, downgrade trim, 30 days after a cancel
 *
 * Every arm drives the REAL functions — `addCredits`, `deductCredits`,
 * `adjustUserCredits`, `updateUserSubscription`, `refreshMonthlyCredits`,
 * `expirePlanCredits` and `expireTimedCredits` — against ONE stateful account
 * row. The double does not know the rule: raw statements are rendered through
 * Drizzle's own MySQL dialect and applied by what their SQL says, and a `set`
 * is applied as written (the one SQL-valued `set`, the starting credits'
 * clock, is rendered and its CASE evaluated against the row).
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

/** A `set` value that is SQL — only the starting credits' clock is one. */
async function applySetValue(key: string, value: unknown): Promise<unknown> {
  if (!value || typeof value !== "object" || !("queryChunks" in (value as object))) return value;
  const rendered = await render(value);
  const text = rendered.sql.replace(/`points`\./g, "");
  // The admin add's lifetime analytics counter.
  if (key === "creditsPurchased" && text === "`creditsPurchased` + ?") {
    return num("creditsPurchased") + Number(rendered.params[0]);
  }
  if (
    key === "signupCreditsExpireAt"
    && /^CASE WHEN `signupCreditsExpireAt` IS NULL AND `signupBalance` > 0 THEN \? ELSE `signupCreditsExpireAt` END$/.test(text)
  ) {
    if (account.signupCreditsExpireAt == null && num("signupBalance") > 0) {
      // Drizzle's timestamp encoder hands the driver a UTC string.
      return new Date(`${String(rendered.params[0]).replace(" ", "T")}Z`);
    }
    return account.signupCreditsExpireAt ?? null;
  }
  throw new Error(`the double does not know this set value for ${key}: ${text}`);
}

const db = {
  execute: async (query: unknown) => [{ affectedRows: await applyRaw(query) }],
  select: () => ({
    from: () => ({
      where: () => ({
        limit: () =>
          Object.assign(Promise.resolve([{ ...account }]), { for: async () => [{ ...account }] }),
      }),
    }),
  }),
  update: () => ({
    set: (values: Record<string, unknown>) => ({
      where: async (condition: unknown) => {
        wheres.push((await render(condition)).sql.replace(/`points`\./g, ""));
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
  expireTimedCredits,
  refreshMonthlyCredits,
  updateUserSubscription,
} from "./db/billing";
import { adjustUserCredits } from "./db/admin";
import { FREE_SIGNUP_GRANT_CREDITS } from "../drizzle/schema";

const DAY = 86_400_000;
const T0 = new Date("2026-10-10T00:00:00Z");
const at = (days: number) => new Date(T0.getTime() + days * DAY);

/** A fresh Free account, born through the real `initializeUserCredits`. */
async function newFreeAccount(): Promise<void> {
  account = { userId: 7, balance: 0, planTier: "free" };
  // `initializeUserCredits` INSERTs the row; the double's insert captures it.
  ledger.length = 0;
  await initializeUserCredits(7);
  const row = ledger.shift() as Record<string, unknown>;
  ledger.length = 0;
  account = { ...(row as Account), planCreditsExpireAt: null, signupCreditsExpireAt: null, promoCreditsExpireAt: null };
}

/** Cancel to Free with a plan-credit expiry due at `due`, as the webhook does. */
async function cancelToFree(due: Date) {
  await updateUserSubscription(7, { planTier: "free", planCreditsExpireAt: due });
}

const spend = (amount: number, ref: string) =>
  deductCredits(7, amount, "generation", "a roll", ref, { toolKind: "image" });

beforeEach(async () => {
  await newFreeAccount();
  wheres.length = 0;
});

describe("the account a new customer is born with", () => {
  it("⚠ the starting credits land in their own bucket, not the plan's", () => {
    expect(account.balance).toBe(FREE_SIGNUP_GRANT_CREDITS);
    expect(creditBuckets(account as never)).toMatchObject({ signup: FREE_SIGNUP_GRANT_CREDITS, plan: 0 });
  });
});

describe("1 · referral credits never expire, same as top-ups", () => {
  it("⚠ a cancelled plan's expiry takes the plan's credits and leaves a referral reward whole", async () => {
    await spend(FREE_SIGNUP_GRANT_CREDITS, "roll:1"); // starting credits gone
    await updateUserSubscription(7, { planTier: "pro" }, T0);
    await addCredits(7, 10_000, "subscription", "Monthly credit refresh", "sub:1");
    await addCredits(7, 2_000, "bonus", "Referral bonus", "referral-referrer-1", { bonusSource: "referral" });
    await cancelToFree(at(30));

    const result = await expirePlanCredits(7, at(30), at(31));
    expect(result).toEqual({ outcome: "expired", creditsRemoved: 10_000, newBalance: 2_000 });
    expect(creditBuckets(account as never).kept).toBe(2_000);
  });

  it("negative control: the same 2,000 as a bonus with no source (a plan change's proration) expires with the plan", async () => {
    await spend(FREE_SIGNUP_GRANT_CREDITS, "roll:1n");
    await updateUserSubscription(7, { planTier: "pro" }, T0);
    await addCredits(7, 10_000, "subscription", "Monthly credit refresh", "sub:1n");
    await addCredits(7, 2_000, "bonus", "Prorated credits for upgrade", "plan-change:1n");
    await cancelToFree(at(30));
    expect(await expirePlanCredits(7, at(30), at(31))).toEqual({
      outcome: "expired",
      creditsRemoved: 12_000,
      newBalance: 0,
    });
  });

  it("a renewal with no rollover keeps a referral reward whole", async () => {
    await spend(FREE_SIGNUP_GRANT_CREDITS, "roll:1r");
    await updateUserSubscription(7, { planTier: "starter" }, T0);
    await addCredits(7, 10_000, "subscription", "Monthly credit refresh", "sub:1r");
    await addCredits(7, 2_000, "bonus", "Welcome bonus: referred by a friend", "referral-referred-1", { bonusSource: "referral" });
    const renewed = await refreshMonthlyCredits(7, 10_000, () => 0, "renewal:1r");
    expect(renewed).toMatchObject({ success: true, newBalance: 12_000 });
    expect(creditBuckets(account as never)).toMatchObject({ kept: 2_000, plan: 10_000 });
  });
});

describe("2 · staff goodwill never expires", () => {
  it("⚠ an admin's add (admin_add) survives a cancelled plan's expiry", async () => {
    await spend(FREE_SIGNUP_GRANT_CREDITS, "roll:2");
    await updateUserSubscription(7, { planTier: "pro" }, T0);
    await addCredits(7, 10_000, "subscription", "Monthly credit refresh", "sub:2");
    expect((await adjustUserCredits(7, 3_000, "sorry about the outage", 1, "adj:2")).success).toBe(true);
    await cancelToFree(at(30));
    expect(await expirePlanCredits(7, at(30), at(31))).toEqual({
      outcome: "expired",
      creditsRemoved: 10_000,
      newBalance: 3_000,
    });
  });

  it("a change request's goodwill bonus lands in the same bucket", async () => {
    await addCredits(7, 3_000, "bonus", "Credits added via change request #9", "cr-9", { bonusSource: "goodwill" });
    expect(creditBuckets(account as never).kept).toBe(3_000);
  });
});

describe("3 · starting credits never expire while the account is on Free", () => {
  it("⚠ no clock is started on Free, and the timed expiry refuses a Free account", async () => {
    expect(account.signupCreditsExpireAt).toBeNull();
    await updateUserSubscription(7, { planTier: "free" }, T0);
    expect(account.signupCreditsExpireAt).toBeNull();
    // Even a row carrying a stamp is refused while it is on Free.
    account.signupCreditsExpireAt = at(1);
    expect(await expireTimedCredits(7, "signup", at(1), at(400))).toEqual({ outcome: "not-due" });
    expect(account.balance).toBe(FREE_SIGNUP_GRANT_CREDITS);
  });

  it("⚠ the compare table's line holds: a Free account's starting credits survive a cancelled plan's expiry", async () => {
    // Upgrade, cancel back to Free before the 90 days, let the 30-day expiry run.
    await updateUserSubscription(7, { planTier: "pro" }, T0);
    await addCredits(7, 10_000, "subscription", "Monthly credit refresh", "sub:3");
    await cancelToFree(at(30));
    expect(account.signupCreditsExpireAt).toBeNull(); // the return to Free stopped the clock
    expect(await expirePlanCredits(7, at(30), at(31))).toEqual({
      outcome: "expired",
      creditsRemoved: 10_000,
      newBalance: FREE_SIGNUP_GRANT_CREDITS,
    });
  });
});

describe("4 · starting credits expire 90 days after an upgrade", () => {
  it("⚠ the upgrade stamps 90 days; a later paid write does not restart the clock", async () => {
    await updateUserSubscription(7, { planTier: "starter" }, T0);
    expect(account.signupCreditsExpireAt).toEqual(at(90));
    await updateUserSubscription(7, { planTier: "pro" }, at(40));
    expect(account.signupCreditsExpireAt).toEqual(at(90));
  });

  it("⚠ at day 90 whatever is left of them expires, and nothing else does", async () => {
    await updateUserSubscription(7, { planTier: "pro" }, T0);
    await addCredits(7, 10_000, "subscription", "Monthly credit refresh", "sub:4");
    await addCredits(7, 2_000, "topup", "Credit top-up", "topup:4");
    await spend(12_000, "roll:4"); // 10,000 plan, then 2,000 of the starting credits
    expect(creditBuckets(account as never)).toMatchObject({
      plan: 0,
      signup: FREE_SIGNUP_GRANT_CREDITS - 2_000,
      purchased: 2_000,
    });

    expect(await expireTimedCredits(7, "signup", at(90), at(89))).toEqual({ outcome: "not-due" });
    const result = await expireTimedCredits(7, "signup", at(90), at(91));
    expect(result).toEqual({
      outcome: "expired",
      creditsRemoved: FREE_SIGNUP_GRANT_CREDITS - 2_000,
      newBalance: 2_000,
    });
    expect(account.signupCreditsExpireAt).toBeNull();
    expect(ledger.at(-1)).toMatchObject({ type: "signup", amount: -(FREE_SIGNUP_GRANT_CREDITS - 2_000) });
    expect(creditBuckets(account as never)).toMatchObject({ purchased: 2_000, signup: 0 });
  });

  it("until then a renewal does not eat them — they cross whole beside the plan's rollover", async () => {
    await updateUserSubscription(7, { planTier: "starter" }, T0);
    const renewed = await refreshMonthlyCredits(7, 10_000, () => 0, "renewal:4");
    expect(renewed).toMatchObject({ newBalance: FREE_SIGNUP_GRANT_CREDITS + 10_000 });
  });
});

describe("5 · promo bonuses expire 90 days after the grant (no promo exists yet — the model carries it)", () => {
  it("⚠ a promo is stamped at its grant and expires alone at day 90", async () => {
    await addCredits(7, 4_000, "bonus", "A promo", "promo:5", { bonusSource: "promo", now: T0 });
    expect(account.promoCreditsExpireAt).toEqual(at(90));
    expect(await expireTimedCredits(7, "promo", at(90), at(91))).toEqual({
      outcome: "expired",
      creditsRemoved: 4_000,
      newBalance: FREE_SIGNUP_GRANT_CREDITS,
    });
    expect(ledger.at(-1)).toMatchObject({ type: "bonus", amount: -4_000 });
  });

  it("a promo spends before the credits that never expire", async () => {
    await addCredits(7, 4_000, "bonus", "A promo", "promo:5s", { bonusSource: "promo", now: T0 });
    await spend(3_000, "roll:5s");
    expect(creditBuckets(account as never)).toMatchObject({ promo: 1_000, signup: FREE_SIGNUP_GRANT_CREDITS });
  });
});

describe("6 · plan credits are unchanged", () => {
  it("negative control: with only plan credits on the row, the expiry takes all of them, exactly as #2152 shipped", async () => {
    await spend(FREE_SIGNUP_GRANT_CREDITS, "roll:6");
    await updateUserSubscription(7, { planTier: "pro" }, T0);
    await addCredits(7, 10_000, "subscription", "Monthly credit refresh", "sub:6");
    await cancelToFree(at(30));
    expect(await expirePlanCredits(7, at(30), at(31))).toEqual({
      outcome: "expired",
      creditsRemoved: 10_000,
      newBalance: 0,
    });
  });
});

describe("7 · the write and the sweep", () => {
  it("⚠ the starting credits' expiry is conditioned on the account still being paid, in the write itself", async () => {
    await updateUserSubscription(7, { planTier: "pro" }, T0);
    wheres.length = 0;
    await expireTimedCredits(7, "signup", at(90), at(91));
    expect(wheres).toHaveLength(1);
    expect(wheres[0]).toMatch(/`planTier` <> \?/);
    expect(wheres[0]).toMatch(/`signupCreditsExpireAt` = \?/);
    expect(wheres[0]).toMatch(/`balance` = \?/);
  });

  it("a promo's expiry is not — a promo runs out on Free as on any plan", async () => {
    await addCredits(7, 4_000, "bonus", "A promo", "promo:7", { bonusSource: "promo", now: T0 });
    wheres.length = 0;
    await expireTimedCredits(7, "promo", at(90), at(91));
    expect(wheres[0]).not.toMatch(/`planTier`/);
  });

  it("the sweep hands every due candidate to the expiry and tallies what came back", async () => {
    const { runTimedCreditsExpirySweep } = await import("./billing/planCreditsExpiry");
    const asked: string[] = [];
    const result = await runTimedCreditsExpirySweep({
      now: () => at(91),
      candidates: async () => [
        { userId: 7, kind: "signup", expireAt: at(90) },
        { userId: 8, kind: "promo", expireAt: at(90) },
      ],
      expire: async (userId, kind) => {
        asked.push(`${kind}:${userId}`);
        return kind === "signup"
          ? { outcome: "expired", creditsRemoved: 500, newBalance: 0 }
          : { outcome: "nothing-to-expire" };
      },
    });
    expect(asked).toEqual(["signup:7", "promo:8"]);
    expect(result).toEqual({ considered: 2, outcomes: { expired: 1, "nothing-to-expire": 1 }, creditsRemoved: 500 });
  });
});
