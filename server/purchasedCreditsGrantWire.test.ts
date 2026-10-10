/**
 * THE STATEMENTS A GRANT ACTUALLY SENDS (#1604, P1-5) — invariant 5, asserted
 * on the outgoing query rather than on a constant near it.
 *
 * ⚠ AND IT IS READ OFF THE REAL `tx.execute` ARGUMENT, NOT OFF A RETYPED
 * TEMPLATE. `server/creditsSQL.test.ts` — the suite that already checks this
 * table's raw SQL for snake_case — composes its own `sql` templates and
 * inspects those, so it would pass unchanged if `addCredits` were deleted.
 * That shape is the one this repository has been bitten by (a suite that
 * cannot fail when its subject is deleted). These arms drive the real
 * function and capture what it hands the driver.
 *
 * Two facts here are load-bearing and invisible in the SQL itself:
 *
 *  1 · THE SETTLE IS ITS OWN WRITE AND IT RUNS FIRST. Since #2185 it is a
 *      locked read (`FOR UPDATE`) of the row and one write of all four bounds,
 *      each settled to its bucket's reading, BEFORE this grant lands. Run
 *      second it would settle against the POST-grant balance, which protects
 *      credits nobody was given.
 *  2 · EACH GRANT RAISES ITS OWN BUCKET'S BOUND AND NO OTHER (#2185).
 *      `topup` / `purchase` raise `purchasedBalance`; a referral or goodwill
 *      `bonus`, `admin_add` and `signup` (the starting credits) raise
 *      `keptBalance`; a promo `bonus` raises `promoBalance`. `subscription`
 *      is a purchase for the lifetime analytics counter and raises NO bound:
 *      a plan's monthly allowance is exactly what its rollover percentage
 *      governs. A `bonus` that states no source is a plan change's proration
 *      and is the plan's too.
 *
 * The negative control is the deduct: the hot path must name this column
 * never. An arm reddens if a clause appears there.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

const executed: unknown[] = [];
let executeAnswers: number[] = [];
const inserted: Array<Record<string, unknown>> = [];
const updateSets: Array<Record<string, unknown>> = [];
/** Every write and locked read, in the order the function sent them. */
const events: string[] = [];
let selectAnswer: Array<Record<string, unknown>> = [{ balance: 0 }];

const txDouble = {
  execute: async (query: unknown) => {
    executed.push(query);
    events.push("execute");
    return [{ affectedRows: executeAnswers.shift() ?? 1 }];
  },
  select: () => ({
    from: () => ({
      where: () => ({
        limit: () => {
          const rows = selectAnswer;
          return Object.assign(Promise.resolve(rows), {
            for: async (mode: string) => {
              events.push(`for:${mode}`);
              return rows;
            },
          });
        },
      }),
    }),
  }),
  update: () => ({
    set: (values: Record<string, unknown>) => ({
      where: async () => {
        updateSets.push(values);
        events.push("set");
        return [{ affectedRows: 1 }];
      },
    }),
  }),
  insert: () => ({
    values: async (row: Record<string, unknown>) => {
      inserted.push(row);
    },
  }),
};

vi.mock("./db/connection", () => ({
  getDb: vi.fn().mockResolvedValue({}),
  withTransaction: vi.fn().mockImplementation(async (fn: (tx: unknown) => unknown) => fn(txDouble)),
}));

import { addCredits, deductCredits } from "./db/credits";
import { adjustUserCredits } from "./db/admin";
import { staffLedgerProse } from "../shared/creditDisplay";

/**
 * Flatten a drizzle `SQL` into an ordered token list: `col:<name>` for a
 * column reference and the literal text between them. Order is the whole
 * point — fact 1 above is a statement about position.
 */
function tokens(query: unknown): string[] {
  const chunks = (query as { queryChunks?: unknown[] }).queryChunks;
  if (!Array.isArray(chunks)) throw new Error("not a drizzle SQL object — the double captured the wrong thing");
  const out: string[] = [];
  for (const chunk of chunks) {
    if (chunk && typeof chunk === "object") {
      // A clause composed as its own `sql` fragment (#2185's grant) is walked in place.
      if (Array.isArray((chunk as { queryChunks?: unknown }).queryChunks)) {
        out.push(...tokens(chunk));
        continue;
      }
      const named = chunk as { name?: unknown; value?: unknown };
      if (typeof named.name === "string") {
        out.push(`col:${named.name}`);
        continue;
      }
      if (Array.isArray(named.value)) {
        for (const piece of named.value) if (typeof piece === "string") out.push(piece);
        continue;
      }
    }
  }
  return out;
}

const text = (query: unknown) => tokens(query).join("");
/** The columns a statement names, in the order they appear. */
const columns = (query: unknown) =>
  tokens(query)
    .filter((t) => t.startsWith("col:"))
    .map((t) => t.slice(4));

beforeEach(() => {
  executed.length = 0;
  executeAnswers = [];
  inserted.length = 0;
  updateSets.length = 0;
  events.length = 0;
  selectAnswer = [{ balance: 0 }];
});

const BOUND_KEYS = ["purchasedBalance", "keptBalance", "promoBalance"];

describe("the settle", () => {
  it("⚠ runs FIRST — a locked read, then one write of the four bounds, then the grant", async () => {
    selectAnswer = [{ balance: 1_000, purchasedBalance: 25_000 }];
    await addCredits(7, 5_000, "topup", "Credit top-up: 5000 credits", "topup:t1");
    expect(events.slice(0, 3)).toEqual(["for:update", "set", "execute"]);
    expect(executed).toHaveLength(1);
  });

  it("writes the bounds and nothing else, each settled to its bucket's reading", async () => {
    // 1,000 on the balance; the bounds remember far more than is left.
    selectAnswer = [{ balance: 1_000, purchasedBalance: 600, keptBalance: 900, promoBalance: 50 }];
    await addCredits(7, 5_000, "bonus", "A bonus", "bonus:b1");
    expect(Object.keys(updateSets[0]).sort()).toEqual([...BOUND_KEYS].sort());
    // Spent plan → promo → kept → purchased, so read in reverse:
    expect(updateSets[0]).toEqual({ purchasedBalance: 600, keptBalance: 400, promoBalance: 0 });
  });

  it("runs for every grant kind that adds NEW credits, because any of them can resurrect a spent bound", async () => {
    for (const kind of ["topup", "purchase", "subscription", "bonus", "signup"] as const) {
      events.length = 0;
      updateSets.length = 0;
      selectAnswer = [{ balance: 0, purchasedBalance: 25_000 }];
      await addCredits(7, 1_000, kind, `a ${kind}`, `${kind}:k1`);
      expect(events.slice(0, 3)).toEqual(["for:update", "set", "execute"]);
      expect(updateSets[0].purchasedBalance).toBe(0);
    }
  });

  it("⚠ a REFUND sends no settle (#2185) — it gives back a spend, and the settle would forget the buckets that spend used", async () => {
    executeAnswers = [1];
    selectAnswer = [{ balance: 1_000 }];
    const result = await addCredits(7, 1_000, "refund", "a refund", "refund:k1");
    expect(result.success).toBe(true);
    expect(events).toEqual(["execute"]);
    expect(updateSets).toHaveLength(0);
    for (const key of BOUND_KEYS) expect(columns(executed[0])).not.toContain(key);
  });

  it("⚠ a missing account is refused at the locked read, before anything is written", async () => {
    selectAnswer = [];
    const result = await addCredits(7, 1_000, "bonus", "A bonus", "bonus:b2");
    expect(result).toEqual({ success: false, error: "User credits not found" });
    expect(executed).toHaveLength(0);
    expect(updateSets).toHaveLength(0);
    expect(inserted).toHaveLength(0);
  });
});

describe("the grant statement — each grant raises its own bucket's bound and no other", () => {
  const boundsIn = (query: unknown) => columns(query).filter((c) => BOUND_KEYS.includes(c));

  it.each([
    ["topup", undefined, "purchasedBalance"],
    ["purchase", undefined, "purchasedBalance"],
    ["signup", undefined, "keptBalance"],
    ["bonus", "referral", "keptBalance"],
    ["bonus", "goodwill", "keptBalance"],
    ["bonus", "promo", "promoBalance"],
  ] as const)("⚠ a %s (%s) raises %s", async (kind, bonusSource, bound) => {
    selectAnswer = [{ balance: 0 }];
    await addCredits(7, 1_000, kind, `a ${kind}`, `${kind}:g`, { bonusSource });
    expect(boundsIn(executed[0])).toEqual([bound, bound]);
  });

  it("⚠ a SUBSCRIPTION grant raises no bound — a plan's allowance is what rollover governs", async () => {
    selectAnswer = [{ balance: 0 }];
    await addCredits(7, 75_000, "subscription", "Monthly credit refresh", "sub:s1");
    expect(boundsIn(executed[0])).toEqual([]);
    /* …and it still feeds the lifetime analytics counter, unchanged. */
    expect(columns(executed[0])).toContain("creditsPurchased");
  });

  it("a bonus with no stated source (a plan change's proration) and a refund move the balance alone", async () => {
    for (const kind of ["bonus", "refund"] as const) {
      executed.length = 0;
      selectAnswer = [{ balance: 0 }];
      await addCredits(7, 1_000, kind, `a ${kind}`, `${kind}:k2`);
      expect(boundsIn(executed[0])).toEqual([]);
      expect(columns(executed[0])).not.toContain("creditsPurchased");
      expect(columns(executed[0])).toContain("balance");
    }
  });

  it("⚠ a promo is stamped 90 days from its grant, in the settle's write", async () => {
    selectAnswer = [{ balance: 0 }];
    const now = new Date("2026-10-10T00:00:00Z");
    await addCredits(7, 1_000, "bonus", "A promo", "promo:p1", { bonusSource: "promo", now });
    expect(updateSets[0].promoCreditsExpireAt).toEqual(new Date("2027-01-08T00:00:00Z"));
  });

  it("the grant's affectedRows still refuses an account that vanished between the read and the grant", async () => {
    executeAnswers = [0];
    selectAnswer = [{ balance: 0 }];
    const result = await addCredits(7, 1_000, "bonus", "A bonus", "bonus:b3");
    expect(result).toEqual({ success: false, error: "User credits not found" });
    expect(inserted).toHaveLength(0);
  });
});

describe("the admin adjustment — the law-7 sibling, found by sweeping every writer of the column", () => {
  /*
    `adjustUserCredits` does not go through `addCredits`: it reads the balance
    and writes it itself. So the settle that `addCredits` performs for every
    grant had no effect on this road, and an admin's top-up of an account that
    had already spent its bought credits would leave a stale bound standing —
    protecting the admin's gift at the next renewal as if the customer had paid
    for it. It fails the customer's way, which is why nothing would complain.
  */
  it("⚠ an admin ADD settles the bound against the balance it read, and lands as goodwill that never expires (#2185)", async () => {
    selectAnswer = [{ balance: 0, purchasedBalance: 25_000 }];
    const result = await adjustUserCredits(7, 10_000, "a goodwill top-up", 1, "adj:a1");

    expect(result.success).toBe(true);
    expect(updateSets).toHaveLength(1);
    expect(updateSets[0].balance).toBe(10_000);
    expect(updateSets[0].purchasedBalance).toBe(0);
    expect(updateSets[0].keptBalance).toBe(10_000);
  });

  it("⚠ the admin add reads the row it overwrites FOR UPDATE (the relay's finding 3 on PR #2208)", async () => {
    selectAnswer = [{ balance: 0, purchasedBalance: 0 }];
    await adjustUserCredits(7, 1_000, "a goodwill top-up", 1, "adj:lock");
    expect(events.slice(0, 2)).toEqual(["for:update", "set"]);
  });

  it("it settles rather than erasing — a live bound survives the adjustment", async () => {
    selectAnswer = [{ balance: 30_000, purchasedBalance: 25_000 }];
    await adjustUserCredits(7, 1_000, "a goodwill top-up", 1, "adj:a2");
    expect(updateSets[0].purchasedBalance).toBe(25_000);
  });

  it("an admin DEDUCT writes the column never — the read-time clamp owns that direction", async () => {
    selectAnswer = [{ balance: 30_000, purchasedBalance: 25_000 }];
    const result = await adjustUserCredits(7, -5_000, "a correction", 1, "adj:a3");

    expect(result.success).toBe(true);
    expect(updateSets).toHaveLength(1);
    expect(Object.keys(updateSets[0])).toEqual(["balance"]);
  });
});

describe("the deduct — the hot path, deliberately untouched", () => {
  it("⚠ names the protected column NEVER, and sends exactly one statement", async () => {
    /*
      The negative control of this whole design: purchased credits spend last
      BY ARITHMETIC (`min(column, balance)`), so the deduct needs no clause and
      the product's most-run statement is not widened. A clause appearing here
      reddens this arm.
    */
    executeAnswers = [1];
    selectAnswer = [{ balance: 400 }];
    const result = await deductCredits(7, 100, "generation", "a roll", "roll:r1", {
      toolKind: "image",
    });

    expect(result.success).toBe(true);
    expect(executed).toHaveLength(1);
    expect(columns(executed[0])).not.toContain("purchasedBalance");
    expect(text(executed[0])).not.toContain("LEAST(");
  });
});

describe("#2027 — an admin adjustment's stored description keeps the reason as typed", () => {
  it("\"100 credits\" in the reason survives the moderator's reading untouched", async () => {
    selectAnswer = [{ balance: 0, purchasedBalance: 0 }];
    await adjustUserCredits(7, 500, "as promised, 100 credits", 1, "adj:2027");
    const row = inserted.find((candidate) => typeof candidate.description === "string");
    const description = row?.description as string;
    expect(description).toContain("as promised, 100 credits");
    expect(staffLedgerProse(description)).toBe(description);
  });
});
