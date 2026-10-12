/**
 * #2387 — a customer short of credits is told so, with the price, and is never
 * told "That brief can't be cast".
 *
 * Three readings, none of them a constant compared to itself:
 *
 * 1. The REAL `deductCredits`, driven through its transaction with the
 *    conditional UPDATE touching no row, states `insufficient: true` when the
 *    account's credits row exists, and does NOT when it is missing.
 * 2. `chargeRefusal` turns those two real results into the two refusals, and
 *    the tRPC formatter's own `withSpokenFlag` marks both on the wire.
 * 3. The CLASS: no charge site anywhere under `server/` may pick its sentence
 *    with `.error ||` again — the shape that made the written sentence dead at
 *    every paid road at once.
 */
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ creditsRow: [] as Array<{ balance: number }> }));

vi.mock("../db/connection", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../db/connection")>();
  const tx = {
    /* The conditional `UPDATE … WHERE balance >= amount` matched nothing. */
    execute: async () => [{ affectedRows: 0 }],
    select: () => ({
      from: () => ({
        where: () => ({ limit: async () => state.creditsRow }),
      }),
    }),
  };
  return {
    ...actual,
    getDb: async () => ({}) as never,
    withTransaction: async (fn: (handle: typeof tx) => unknown) => fn(tx),
  };
});

import { deductCredits } from "../db/credits";
import { withSpokenFlag } from "../_core/spokenError";
import { CHARGE_UNAVAILABLE_SENTENCE, chargeRefusal } from "./chargeRefusal";

const SENTENCE = "Not enough credits. A roll costs 160 credits.";

async function refusedDeduct() {
  return deductCredits(7, 1_000_000, "generation", "Casting roll (pending)", undefined, {
    toolKind: "image",
    engineUsed: "castingV2",
  });
}

beforeEach(() => {
  state.creditsRow = [];
});

describe("the ledger states WHY a charge was refused", () => {
  it("a short balance is `insufficient` — the customer's balance, not the system", async () => {
    state.creditsRow = [{ balance: 40 }];
    const result = await refusedDeduct();
    expect(result).toMatchObject({ success: false, insufficient: true });
  });

  it("negative control: a missing credits row is NOT `insufficient` — that is the system", async () => {
    state.creditsRow = [];
    const result = await refusedDeduct();
    expect(result.success).toBe(false);
    expect(result.error).toBe("User credits not found");
    expect(result.insufficient).toBeUndefined();
  });
});

describe("the refusal a customer receives", () => {
  it("short of credits: the written sentence with its price, on the ACCOUNT code, spoken", async () => {
    state.creditsRow = [{ balance: 40 }];
    const error = chargeRefusal(await refusedDeduct(), SENTENCE);
    expect(error).toMatchObject({ code: "PRECONDITION_FAILED", message: SENTENCE });
    /* Never the brief compiler's code — that is what drew "That brief can't be cast". */
    expect(error.code).not.toBe("BAD_REQUEST");
    expect(withSpokenFlag({ data: { code: error.code } }, error).data).toMatchObject({ spoken: true });
  });

  it("the system: never says the customer is short of credits, and makes no money claim", async () => {
    state.creditsRow = [];
    const error = chargeRefusal(await refusedDeduct(), SENTENCE);
    expect(error).toMatchObject({ code: "INTERNAL_SERVER_ERROR", message: CHARGE_UNAVAILABLE_SENTENCE });
    expect(error.message).not.toMatch(/not enough|insufficient/i);
    /* A duplicate reference means an earlier attempt WAS charged. */
    expect(error.message).not.toMatch(/nothing was charged|not charged|refund/i);
    expect(withSpokenFlag({ data: { code: error.code } }, error).data).toMatchObject({ spoken: true });
  });

  it("never passes the ledger's own wording through, on either branch", () => {
    for (const result of [
      { insufficient: true as const },
      {},
    ]) {
      const error = chargeRefusal({ ...result, ...({ error: "Insufficient credits" } as object) }, SENTENCE);
      expect(error.message).not.toBe("Insufficient credits");
    }
  });
});

/* ---- the class: `.error ||` in front of a credits sentence ---- */

const DEAD_FALLBACK = /\.error\s*\|\|\s*`(?:Not enough|Insufficient) credits/;

async function productionSources(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules") continue;
      out.push(...(await productionSources(full)));
    } else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) {
      out.push(full);
    }
  }
  return out;
}

describe("no charge site picks its sentence with `.error ||` (the class, #2387)", () => {
  it("positive control: the pattern catches the shape that shipped", () => {
    const shipped =
      "message: chargeResult.error || `Not enough credits. A roll costs ${formatCredits(displayPrice(price))} credits.`,";
    const legacy = "message: deduct.error || `Insufficient credits. Need ${formatCredits(displayPrice(cost))} credits.` });";
    const multiline = "message:\n        charged.error\n        || `Insufficient credits. Need ${x} credits.`,";
    expect(shipped).toMatch(DEAD_FALLBACK);
    expect(legacy).toMatch(DEAD_FALLBACK);
    expect(multiline).toMatch(DEAD_FALLBACK);
  });

  it("negative control: the repaired shape does not match", () => {
    expect("throw chargeRefusal(deduct, `Insufficient credits. Need ${x} credits.`);").not.toMatch(DEAD_FALLBACK);
  });

  it("no production file under server/ carries it", async () => {
    const files = await productionSources("server");
    expect(files.length).toBeGreaterThan(100);
    const offenders: string[] = [];
    for (const file of files) {
      if (DEAD_FALLBACK.test(await readFile(file, "utf8"))) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });
});
