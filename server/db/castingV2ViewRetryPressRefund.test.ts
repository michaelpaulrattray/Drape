import { beforeEach, describe, expect, it, vi } from "vitest";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";

/**
 * A REGENERATE'S PRESS REFUND, AND THE SLOT ROWS IT IS DECIDED FROM (#2133).
 *
 * Two halves of one repair, driven at the real functions:
 *
 * 1. `recordPackageRedoPressRefund` pays under the PRESS's own fence — the
 *    press row `FOR UPDATE` on `running`, the reference read in the same
 *    transaction, and the credit written with `addCreditsIn` on THAT handle —
 *    the shape #2127 settled for the Sign. A press the sweep has sealed pays
 *    nothing here.
 * 2. `readPressRefusedSheetRefund` finds the press's slots by the ids the
 *    press DERIVED for them, and `refusedSheetRefundFromSlotRows` counts only a
 *    sealed receipt that records a refusal. The WHERE is read at the wire:
 *    rendered by drizzle's MySQL dialect (no connection is ever opened).
 *
 * CI has no database (`vitest.setup.ts` strips `DATABASE_URL`), so a fake
 * transaction stands in, and the one thing varied between arms is what the
 * fence and the ledger hold.
 */

const { state, tx } = vi.hoisted(() => ({
  state: {
    pressRunning: true,
    ledgerRow: null as null | { amount: number; type: string },
    credits: [] as Array<{ handle: unknown; amount: number; reference: string | undefined }>,
    creditSucceeds: true,
    pressWhere: null as unknown,
    slotWhere: null as unknown,
    slotRows: [] as Array<{ status: string; result: unknown }>,
  },
  tx: { tag: "the-fenced-transaction" } as Record<string, unknown>,
}));

vi.mock("./connection", async () => {
  const schema = await import("../../drizzle/schema");
  tx.select = () => ({
    from: (table: unknown) => ({
      where: (condition: unknown) => ({
        limit: () => {
          let rows: unknown[];
          if (table === schema.generationOperations) {
            state.pressWhere = condition;
            rows = state.pressRunning ? [{ id: "press" }] : [];
          } else if (table === schema.creditTransactions) {
            rows = state.ledgerRow ? [state.ledgerRow] : [];
          } else {
            throw new Error("the fake transaction was asked for a table this test does not know");
          }
          return Object.assign(Promise.resolve(rows), { for: async () => rows });
        },
      }),
    }),
  });
  return {
    getDb: async () => ({
      select: () => ({
        from: () => ({
          where: async (condition: unknown) => {
            state.slotWhere = condition;
            return state.slotRows;
          },
        }),
      }),
    }),
    withTransaction: async (run: (handle: unknown) => Promise<unknown>) => run(tx),
  };
});

vi.mock("./credits", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./credits")>()),
  addCreditsIn: vi.fn(async (handle: unknown, _userId: number, amount: number, _type: string, _d: string, reference?: string) => {
    state.credits.push({ handle, amount, reference });
    return state.creditSucceeds ? { success: true, newBalance: 1 } : { success: false, error: "User credits not found" };
  }),
}));

import * as schema from "../../drizzle/schema";
import { CAST_VIEW_ANGLES } from "../../shared/boardTypes";
import { refundReferenceFor } from "../casting/atomicCredits";
import { derivedClientRequestId } from "../casting/operationContract";
import {
  packageRedoSlotFailedReceipt,
  readPressRefusedSheetRefund,
  recordPackageRedoPressRefund,
  refusedSheetRefundFromSlotRows,
} from "./castingV2ViewRetry";

const PRESS = "22222222-3333-4444-8555-666666666666";
const CHARGE_REFERENCE = `op:${PRESS}:charge`;
const SHARES = 1950;

/** Render a captured WHERE with the real MySQL dialect and hand back its SQL and params. */
function render(condition: unknown): { sql: string; params: unknown[] } {
  const pool = mysql.createPool({ host: "127.0.0.1", user: "never-connects", database: "x" });
  try {
    return drizzle(pool)
      .select({ id: schema.generationOperations.id })
      .from(schema.generationOperations)
      .where(condition as never)
      .toSQL();
  } finally {
    void pool.end();
  }
}

const pay = () => recordPackageRedoPressRefund({
  userId: 1,
  pressOperationId: PRESS,
  amount: SHARES,
  description: "Some views didn't arrive when you asked for all of them again",
  chargeReferenceId: CHARGE_REFERENCE,
});

beforeEach(() => {
  state.pressRunning = true;
  state.ledgerRow = null;
  state.credits = [];
  state.creditSucceeds = true;
  state.pressWhere = null;
  state.slotWhere = null;
  state.slotRows = [];
});

describe("the press's refund, under the press's fence (#2133)", () => {
  it("CONTROL — a running press pays on the fenced transaction, under the press's refund reference", async () => {
    const result = await pay();

    expect(result).toMatchObject({ fenced: false, refund: { recorded: true, duplicate: false, amount: SHARES } });
    expect(state.credits).toHaveLength(1);
    expect(state.credits[0]!.handle, "the SAME transaction that holds the fence").toBe(tx);
    expect(state.credits[0]!.reference).toBe(refundReferenceFor(CHARGE_REFERENCE));
  });

  it("the fence is the press itself, running, and nothing else", () => {
    return pay().then(() => {
      const { sql, params } = render(state.pressWhere);
      expect(sql).toContain("`status` = ?");
      expect(params).toEqual(expect.arrayContaining([PRESS, 1, "castingV2.packageRedoPress", "running"]));
    });
  });

  it("A FENCED PRESS — the sweep owns it: no refund, and the answer says fenced", async () => {
    state.pressRunning = false;
    expect(await pay()).toEqual({ fenced: true });
    expect(state.credits, "no refund lands from a fenced writer").toEqual([]);
  });

  it("A REPEAT — the sweep's equal payment is read as a duplicate, not paid again", async () => {
    state.ledgerRow = { amount: SHARES, type: "refund" };
    const result = await pay();

    expect(result).toMatchObject({ fenced: false, refund: { recorded: true, duplicate: true } });
    expect(state.credits).toEqual([]);
  });

  it("a different amount already under the reference is refused, never paid on top", async () => {
    state.ledgerRow = { amount: 3250, type: "refund" };
    const result = await pay();

    expect(result).toMatchObject({ fenced: false, refund: { recorded: false, duplicate: true } });
    expect(state.credits).toEqual([]);
  });
});

describe("the shares, read off the press's slot rows (#2133)", () => {
  const refused = (angle: (typeof CAST_VIEW_ANGLES)[number]) => ({
    status: "succeeded",
    result: packageRedoSlotFailedReceipt({ castId: "KI-X", angle, refusedByProvider: true }),
  });

  it("counts one share of the charge per sealed refusal, of every slot the press claimed", () => {
    const rows = [
      refused("closeUp"),
      refused("sideClose"),
      refused("threeQuarter"),
      { status: "succeeded", result: { outcome: "ready" } },
      { status: "succeeded", result: { outcome: "ready" } },
    ];
    expect(refusedSheetRefundFromSlotRows(rows, 3250)).toEqual({ promisedViews: 5, refusedViews: 3, owed: 1950 });
  });

  it("NEGATIVE CONTROL — a plain failure, an unsealed slot and a swept slot are not refusals", () => {
    const rows = [
      { status: "succeeded", result: packageRedoSlotFailedReceipt({ castId: "KI-X", angle: "closeUp", refusedByProvider: false }) },
      { status: "running", result: null },
      { status: "failed", result: { refusedByProvider: true } },
      { status: "succeeded", result: null },
    ];
    expect(refusedSheetRefundFromSlotRows(rows, 3250).owed).toBe(0);
  });

  it("asks for exactly this press's slots — the derived ids, the slot kind, the owner and the Cast", async () => {
    state.slotRows = [refused("closeUp")];
    const read = await readPressRefusedSheetRefund({
      userId: 1,
      modelId: 7,
      pressClientRequestId: PRESS,
      chargedCredits: 3250,
    });
    expect(read).toEqual({ promisedViews: 1, refusedViews: 1, owed: 3250 });

    const { params } = render(state.slotWhere);
    expect(params).toEqual(expect.arrayContaining([
      1,
      7,
      "castingV2.packageRedo",
      ...CAST_VIEW_ANGLES.map((angle) => derivedClientRequestId(PRESS, angle)),
    ]));
    expect(params).not.toContain("castingV2.packageRedoPress");
  });
});
