import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A REFUSED SHEET'S SHARE IS PAID UNDER THE SIGN'S FENCE, OR NOT AT ALL —
 * the relay's merge-blocking finding on PR #2132 (#2127).
 *
 * The first shape refunded a view's share and THEN wrote its marker, ignoring
 * the marker's fenced `false`. A Sign the recovery sweep had already taken
 * over was paid its whole charge by the sweep AND each share by the live
 * process, under different references. `recordRefusedSheetSlotFailure` puts
 * the share and the marker in the transaction that holds the operation row
 * `FOR UPDATE` on `running`.
 *
 * CI has no database (`vitest.setup.ts` strips `DATABASE_URL`), so this drives
 * the REAL function through a fake transaction, and the one thing varied
 * between arms is what the fence and the ledger hold. What it pins is the
 * contract the serialization rests on: the credit write receives THE SAME
 * transaction handle the fence was taken on, and nothing is written at all
 * when the fence refuses.
 */

const { state, tx } = vi.hoisted(() => ({
  state: {
    operationRunning: true,
    modelProvisioning: true,
    ledgerRow: null as null | { amount: number; type: string },
    inserts: [] as Array<Record<string, unknown>>,
    credits: [] as Array<{ handle: unknown; amount: number; reference: string | undefined }>,
    creditSucceeds: true,
  },
  tx: { tag: "the-fenced-transaction" } as Record<string, unknown>,
}));

vi.mock("./connection", async () => {
  const schema = await import("../../drizzle/schema");
  const rowsFor = (table: unknown): unknown[] => {
    if (table === schema.generationOperations) return state.operationRunning ? [{ id: "op" }] : [];
    if (table === schema.models) return state.modelProvisioning ? [{ id: 7 }] : [];
    if (table === schema.creditTransactions) return state.ledgerRow ? [state.ledgerRow] : [];
    throw new Error("the fake transaction was asked for a table this test does not know");
  };
  tx.select = () => ({
    from: (table: unknown) => ({
      where: () => ({
        limit: () => {
          const rows = rowsFor(table);
          return Object.assign(Promise.resolve(rows), { for: async () => rows });
        },
      }),
    }),
  });
  tx.insert = () => ({
    values: async (values: Record<string, unknown>) => {
      state.inserts.push(values);
    },
  });
  return {
    getDb: async () => null,
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

import { recordRefusedSheetSlotFailure } from "./castingV2Sign";
import { refundReferenceFor } from "../casting/atomicCredits";

const OPERATION = "11111111-2222-3333-4444-555555555555";
const SHARE = 650;

const settle = () => recordRefusedSheetSlotFailure({
  userId: 1,
  operationId: OPERATION,
  modelId: 7,
  angle: "closeUp",
  failure: { reason: "This view didn't arrive" },
  refund: { amount: SHARE, description: "Cast package: Close-up didn't arrive", chargeReferenceId: `op:${OPERATION}:charge:slot:closeUp` },
});

beforeEach(() => {
  state.operationRunning = true;
  state.modelProvisioning = true;
  state.ledgerRow = null;
  state.inserts = [];
  state.credits = [];
  state.creditSucceeds = true;
});

describe("a refused sheet's share, under the Sign's fence (#2127)", () => {
  it("CONTROL — a running Sign pays the share on the fenced transaction, and the marker records it", async () => {
    const result = await settle();

    expect(result).toMatchObject({ fenced: false, refund: { recorded: true, duplicate: false, amount: SHARE } });
    expect(state.credits).toHaveLength(1);
    expect(state.credits[0]!.handle, "the SAME transaction that holds the fence").toBe(tx);
    expect(state.credits[0]!.reference).toBe(refundReferenceFor(`op:${OPERATION}:charge:slot:closeUp`));
    expect(state.inserts).toHaveLength(1);
    expect((state.inserts[0]!.status as { refunded: number }).refunded).toBe(SHARE);
  });

  it("A FENCED SIGN — the sweep owns it: no share, no marker, and the answer says fenced", async () => {
    state.operationRunning = false;
    const result = await settle();

    expect(result).toEqual({ fenced: true });
    expect(state.credits, "no refund lands from a fenced writer").toEqual([]);
    expect(state.inserts).toEqual([]);
  });

  it("a Cast no longer provisioning is fenced the same way", async () => {
    state.modelProvisioning = false;
    expect(await settle()).toEqual({ fenced: true });
    expect(state.credits).toEqual([]);
  });

  it("A REPEAT — the share already in the ledger is read, not paid again, and the marker still says it came back", async () => {
    state.ledgerRow = { amount: SHARE, type: "refund" };
    const result = await settle();

    expect(result).toMatchObject({ fenced: false, refund: { recorded: true, duplicate: true } });
    expect(state.credits).toEqual([]);
    expect((state.inserts[0]!.status as { refunded: number }).refunded).toBe(SHARE);
  });

  it("a share that would not record leaves the marker at zero — the room never claims it", async () => {
    state.creditSucceeds = false;
    const result = await settle();

    expect(result).toMatchObject({ fenced: false, refund: { recorded: false } });
    expect((state.inserts[0]!.status as { refunded: number }).refunded).toBe(0);
  });
});
