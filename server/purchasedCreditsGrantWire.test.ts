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
 *  1 · THE SETTLE IS ITS OWN STATEMENT AND IT RUNS FIRST. It clamps
 *      `purchasedBalance` to the balance BEFORE this grant lands. Folded into
 *      the grant as a clause it would be correct only while it sat above the
 *      `balance` assignment, because MySQL evaluates `SET` assignments left to
 *      right — an order-dependent correctness nobody reading the SQL would
 *      suspect. Run second it would clamp to the POST-grant balance, which
 *      protects credits the customer did not buy.
 *  2 · ONLY `topup` AND `purchase` RAISE THE PROTECTED AMOUNT. `subscription`
 *      is a purchase for the lifetime analytics counter and is NOT one here:
 *      a plan's monthly allowance is exactly what its rollover percentage
 *      governs, so protecting it would mean no renewal ever forfeits anything.
 *
 * The negative control is the deduct: the hot path must name this column
 * never. An arm reddens if a clause appears there.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

const executed: unknown[] = [];
let executeAnswers: number[] = [];
const inserted: Array<Record<string, unknown>> = [];
const updateSets: Array<Record<string, unknown>> = [];
let selectAnswer: Array<Record<string, unknown>> = [{ balance: 0 }];

const txDouble = {
  execute: async (query: unknown) => {
    executed.push(query);
    return [{ affectedRows: executeAnswers.shift() ?? 1 }];
  },
  select: () => ({
    from: () => ({
      where: () => ({
        limit: async () => selectAnswer,
      }),
    }),
  }),
  update: () => ({
    set: (values: Record<string, unknown>) => ({
      where: async () => {
        updateSets.push(values);
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
  selectAnswer = [{ balance: 0 }];
});

describe("the settle statement", () => {
  it("⚠ runs FIRST, and clamps the protected amount to the balance with LEAST", async () => {
    executeAnswers = [1, 1];
    await addCredits(7, 5_000, "topup", "Credit top-up: 5000 credits", "topup:t1");

    expect(executed).toHaveLength(2);
    const settle = executed[0];
    expect(columns(settle)).toEqual(["purchasedBalance", "purchasedBalance", "balance", "userId"]);
    expect(text(settle)).toContain("LEAST(");
    expect(text(settle)).toContain("UPDATE");
  });

  it("names no other column — it can move nothing but the bound", async () => {
    executeAnswers = [1, 1];
    await addCredits(7, 5_000, "bonus", "A bonus", "bonus:b1");
    const named = new Set(columns(executed[0]));
    expect(named).toEqual(new Set(["purchasedBalance", "balance", "userId"]));
    expect(text(executed[0])).not.toContain("+");
  });

  it("runs for EVERY grant kind, because any grant can resurrect a spent bound", async () => {
    for (const kind of ["topup", "purchase", "subscription", "bonus", "refund", "signup"] as const) {
      executed.length = 0;
      executeAnswers = [1, 1];
      await addCredits(7, 1_000, kind, `a ${kind}`, `${kind}:k1`);
      expect(columns(executed[0])).toContain("purchasedBalance");
      expect(text(executed[0])).toContain("LEAST(");
    }
  });
});

describe("the grant statement", () => {
  it("⚠ a TOP-UP raises the protected amount", async () => {
    executeAnswers = [1, 1];
    await addCredits(7, 5_000, "topup", "Credit top-up: 5000 credits", "topup:t2");
    const grant = columns(executed[1]);
    expect(grant).toContain("purchasedBalance");
    expect(grant).toContain("creditsPurchased");
    expect(grant).toContain("balance");
  });

  it("a `purchase` raises it too", async () => {
    executeAnswers = [1, 1];
    await addCredits(7, 5_000, "purchase", "A purchase", "purchase:p1");
    expect(columns(executed[1])).toContain("purchasedBalance");
  });

  it("⚠ a SUBSCRIPTION grant does NOT — a plan's allowance is what rollover governs", async () => {
    executeAnswers = [1, 1];
    await addCredits(7, 75_000, "subscription", "Monthly credit refresh", "sub:s1");
    const grant = columns(executed[1]);
    expect(grant).not.toContain("purchasedBalance");
    /* …and it still feeds the lifetime analytics counter, unchanged. */
    expect(grant).toContain("creditsPurchased");
  });

  it("a bonus, a refund and a signup move the balance alone", async () => {
    for (const kind of ["bonus", "refund", "signup"] as const) {
      executed.length = 0;
      executeAnswers = [1, 1];
      await addCredits(7, 1_000, kind, `a ${kind}`, `${kind}:k2`);
      const grant = new Set(columns(executed[1]));
      expect(grant).not.toContain("purchasedBalance");
      expect(grant).not.toContain("creditsPurchased");
      expect(grant).toContain("balance");
    }
  });

  it("⚠ it is still the statement whose affectedRows decides the account exists", async () => {
    /*
      The settle runs first and matches nothing on a missing account. The
      not-found verdict must come from the GRANT, exactly as before this card,
      or a new statement has silently become the gate.
    */
    executeAnswers = [0, 0];
    const result = await addCredits(7, 1_000, "bonus", "A bonus", "bonus:b2");
    expect(result.success).toBe(false);
    expect(result.error).toBe("User credits not found");
    expect(executed).toHaveLength(2);
    expect(inserted).toHaveLength(0);
  });

  it("a settle that matches nothing does not stop a grant that does", async () => {
    executeAnswers = [0, 1];
    selectAnswer = [{ balance: 1_000 }];
    const result = await addCredits(7, 1_000, "bonus", "A bonus", "bonus:b3");
    expect(result.success).toBe(true);
    expect(result.newBalance).toBe(1_000);
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
  it("⚠ an admin ADD settles the bound against the balance it read", async () => {
    selectAnswer = [{ balance: 0, purchasedBalance: 25_000 }];
    const result = await adjustUserCredits(7, 10_000, "a goodwill top-up", 1, "adj:a1");

    expect(result.success).toBe(true);
    expect(updateSets).toHaveLength(1);
    expect(updateSets[0].balance).toBe(10_000);
    expect(updateSets[0].purchasedBalance).toBe(0);
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
