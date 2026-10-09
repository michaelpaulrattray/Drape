import { beforeEach, describe, expect, it, vi } from "vitest";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";

/**
 * THE REDO PRESS STAYS OUT OF `VIEW_REPLACING_OPERATION_KINDS` (#2074).
 *
 * The sweep settles a whole-package redo's press (the row that holds the
 * customer's 3,250) only once nothing view-replacing is still open on the Cast:
 * `recoverCastingV2PackageRedoPressOperation` asks `viewReplacementInFlight`
 * first, and that reader is scoped by `VIEW_REPLACING_OPERATION_KINDS`
 * through `runningViewRetryFilter`.
 *
 * ⚠ **THE PRESS IS ITSELF `running` WHENEVER THE SWEEP JUDGES IT.** So if its
 * own kind were ever added to that list — for instance so the busy read could
 * "see" a redo — the press would find ITSELF in flight on every pass, defer
 * forever, and keep the customer's credits with no refund and no receipt.
 * Until this file only a comment in `operationContract.ts` said so.
 *
 * Two arms, the card's two:
 *
 * 1. the press kind is absent from the declared list (and is a real kind, so
 *    the absence cannot be satisfied by a misspelling);
 * 2. the sweep is DRIVEN through the production `viewReplacementInFlight`
 *    reader, against a fake table whose rows are filtered by the ACTUAL
 *    WHERE clause the reader sends — rendered by drizzle's MySQL dialect and
 *    evaluated conjunct by conjunct. A press with no other view-replacing row
 *    must not defer; the positive control (a sibling slot still running)
 *    proves the same harness can and does defer.
 *
 * ⚠ **Why the WHERE is evaluated rather than ignored.** The sibling suite
 * `castingV2/viewRetryRecovery.test.ts` feeds `openOperations` straight back
 * whatever the filter says, so it cannot notice the filter admitting the press
 * itself — which is exactly this card's failure. Here the table always holds
 * the press's own `running` row, and only the filter decides whether it counts.
 */

const PRESS_ID = "66666666-6666-4666-8666-666666666666";
const CHARGE_REFERENCE = `op:${PRESS_ID}:charge`;
const PRESS_PRICE = 3250;
const USER_ID = 1;
const MODEL_ID = 7;

type OperationRow = {
  id: string;
  userId: number;
  modelId: number;
  kind: string;
  status: string;
  subjectDeletedAt: Date | null;
};

let operationRows: OperationRow[] = [];
let ledger: Array<{ referenceId: string; type: string; amount: number }> = [];
/** Conjunct shapes the evaluator met — so an arm can prove it read the kind predicate. */
const evaluatedColumns = new Set<string>();

/**
 * Render a drizzle condition with the real MySQL dialect (no connection is
 * ever opened) and evaluate it against `operationRows`.
 *
 * It understands exactly the three conjunct shapes `runningViewRetryFilter`
 * emits — `col = ?`, `col in (?, …)`, `col is null` — joined by `and`, and it
 * THROWS on anything else, so a filter that grows a shape this harness does
 * not model reddens here instead of being silently mis-evaluated.
 */
function evaluateWhere(condition: unknown): OperationRow[] {
  const pool = mysql.createPool({ host: "127.0.0.1", user: "never-connects", database: "x" });
  try {
    const { sql, params } = drizzle(pool)
      .select({ id: schema.generationOperations.id })
      .from(schema.generationOperations)
      .where(condition as never)
      .toSQL();
    const whereAt = sql.indexOf(" where ");
    if (whereAt < 0) throw new Error(`no WHERE in rendered SQL: ${sql}`);
    let body = sql.slice(whereAt + " where ".length).trim();
    if (body.startsWith("(") && body.endsWith(")")) body = body.slice(1, -1);
    const conjuncts = body.split(" and ");
    let cursor = 0;
    const tests: Array<(row: OperationRow) => boolean> = conjuncts.map((conjunct) => {
      const column = /^`generation_operations`\.`(\w+)`/.exec(conjunct)?.[1];
      if (!column) throw new Error(`unmodelled conjunct: ${conjunct}`);
      evaluatedColumns.add(column);
      const read = (row: OperationRow) => (row as Record<string, unknown>)[column];
      if (/ = \?$/.test(conjunct)) {
        const value = params[cursor++];
        return (row) => read(row) === value;
      }
      const inList = / in \((\?(?:, \?)*)\)$/.exec(conjunct);
      if (inList) {
        const count = inList[1].split(",").length;
        const values = params.slice(cursor, cursor + count);
        cursor += count;
        return (row) => values.includes(read(row) as never);
      }
      if (/ is null$/.test(conjunct)) return (row) => read(row) === null;
      throw new Error(`unmodelled conjunct: ${conjunct}`);
    });
    if (cursor !== params.length) {
      throw new Error(`consumed ${cursor} of ${params.length} params — the filter has a shape this harness does not read`);
    }
    return operationRows.filter((row) => tests.every((test) => test(row)));
  } finally {
    void pool.end().catch(() => undefined);
  }
}

vi.mock("../db/connection", () => ({
  getDb: async () => ({
    select: () => ({
      from: () => ({
        /*
          Awaited it is the LEDGER read (`select().from().where()`);
          `.limit()`-ed it is `viewReplacementInFlight`, and THAT one is
          evaluated against the operation rows through its real WHERE.
        */
        where: (condition: unknown) => {
          const builder = Promise.resolve(ledger) as Promise<unknown> & {
            limit: (count: number) => Promise<unknown>;
          };
          builder.limit = async (count: number) =>
            evaluateWhere(condition).slice(0, count).map((row) => ({ id: row.id }));
          return builder;
        },
        /* `pressViewLanded`: nothing has landed in these arms. */
        innerJoin: () => ({ where: async () => [] }),
      }),
    }),
  }),
}));

const finalizers = {
  success: vi.fn(async (_input: unknown) => undefined),
  failure: vi.fn(async (_input: unknown) => undefined),
  claimedFailure: vi.fn(async (_input: unknown) => undefined),
};
vi.mock("../db/generationOperations", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../db/generationOperations")>()),
  finalizeGenerationOperationSuccess: vi.fn(async (input: unknown) => finalizers.success(input)),
  finalizeGenerationOperationFailure: vi.fn(async (input: unknown) => finalizers.failure(input)),
  finalizeClaimedGenerationOperationFailure: vi.fn(async (input: unknown) =>
    finalizers.claimedFailure(input)),
}));

import * as schema from "../../drizzle/schema";
import {
  GENERATION_OPERATION_KINDS,
  VIEW_REPLACING_OPERATION_KINDS,
} from "./operationContract";
import { recoverCastingV2PackageRedoPressOperation } from "../castingV2/viewRetryRecovery";

const PRESS_KIND = "castingV2.packageRedoPress";

const press = {
  id: PRESS_ID,
  clientRequestId: PRESS_ID,
  userId: USER_ID,
  modelId: MODEL_ID,
  status: "running" as const,
  chargedCredits: PRESS_PRICE,
  refundedCredits: 0,
};

/** The press's own row — present in the table on every arm, because it is always `running` when swept. */
const pressRow: OperationRow = {
  id: PRESS_ID,
  userId: USER_ID,
  modelId: MODEL_ID,
  kind: PRESS_KIND,
  status: "running",
  subjectDeletedAt: null,
};

const refunds: Array<{ amount: number; reference: string }> = [];
/*
  Only the money WRITER is injected. `stillArriving` and `landed` are left to
  their production defaults — injecting `stillArriving` would bypass the very
  reader this file exists to drive.
*/
const sweep = () => recoverCastingV2PackageRedoPressOperation(press, {
  refund: (async (_userId: number, amount: number, _d: string, reference: string) => {
    refunds.push({ amount, reference });
    return { recorded: true, amount, reference, duplicate: false };
  }) as never,
});

beforeEach(() => {
  operationRows = [pressRow];
  ledger = [{ referenceId: CHARGE_REFERENCE, type: "generation", amount: -PRESS_PRICE }];
  refunds.length = 0;
  evaluatedColumns.clear();
  finalizers.success.mockClear();
  finalizers.failure.mockClear();
  finalizers.claimedFailure.mockClear();
});

describe("the redo press is not a view-replacing kind", () => {
  it("is absent from VIEW_REPLACING_OPERATION_KINDS — it commits no picture, and listing it would make every swept press defer on itself", () => {
    /* Negative control on the spelling: the kind is real, so absence is not a typo passing. */
    expect(GENERATION_OPERATION_KINDS).toContain(PRESS_KIND);
    expect(
      VIEW_REPLACING_OPERATION_KINDS as readonly string[],
      "the redo press was added to VIEW_REPLACING_OPERATION_KINDS: the press is `running` whenever the sweep judges it, "
        + "so viewReplacementInFlight would find the press itself and every swept press would defer forever, "
        + "keeping the customer's 3,250 with no refund and no receipt",
    ).not.toContain(PRESS_KIND);
    /* Positive control: the list does hold the two roads that really replace a view. */
    expect(VIEW_REPLACING_OPERATION_KINDS).toEqual(
      expect.arrayContaining(["castingV2.viewRetry", "castingV2.packageRedo"]),
    );
  });
});

describe("a swept press with no other view-replacing row, through the real in-flight reader", () => {
  it("does NOT defer on its own running row — nothing landed, so the whole price goes back once", async () => {
    const outcome = await sweep();

    /* The harness really evaluated the kind predicate, not just the owner. */
    expect(evaluatedColumns).toContain("kind");
    expect(outcome.type, "the press deferred on itself — it would never settle").not.toBe("deferred");
    expect(outcome).toEqual({
      type: "paid_failure",
      chargedCredits: PRESS_PRICE,
      refundedCredits: PRESS_PRICE,
    });
    expect(refunds).toEqual([{ amount: PRESS_PRICE, reference: CHARGE_REFERENCE }]);
  });

  it("does not defer on a sibling slot that has already finished", async () => {
    operationRows = [pressRow, { ...pressRow, id: "slot-done", kind: "castingV2.packageRedo", status: "succeeded" }];

    const outcome = await sweep();

    expect(outcome.type).toBe("paid_failure");
  });

  it("positive control: DOES defer while a sibling slot of the redo is still running", async () => {
    /*
      Proves the harness can say "in flight" at all — without this, arm one
      could pass on an evaluator that never matches anything.
    */
    operationRows = [pressRow, { ...pressRow, id: "slot-running", kind: "castingV2.packageRedo" }];

    const outcome = await sweep();

    expect(outcome.type).toBe("deferred");
    expect(refunds).toEqual([]);
    expect(finalizers.failure).not.toHaveBeenCalled();
    expect(finalizers.success).not.toHaveBeenCalled();
  });

  it("negative control on the scope: a running redo on ANOTHER Cast does not hold this press", async () => {
    operationRows = [pressRow, { ...pressRow, id: "other-cast", kind: "castingV2.packageRedo", modelId: MODEL_ID + 1 }];

    const outcome = await sweep();

    expect(outcome.type).toBe("paid_failure");
  });
});
