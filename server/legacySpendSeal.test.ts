/**
 * THE LEGACY LANE'S PAID PROCEDURES REFUSE A CUSTOMER *BEFORE* ANY DEDUCTION
 * (#1654 — his word, 2026-10-01: *"i agree with your reccs."*).
 *
 * The legacy studio PAGE has been admin-only since #364; its API was not. Three
 * procedures deduct credits and render through `aiService` → `geminiGeneration`
 * / `geminiViews`, which point at `gemini-3-pro-image-preview` — shut down by
 * Google on 2026-06-25 (`shared/vendorModelStatus.ts`). Any approved account
 * could spend on a call that cannot succeed.
 *
 * ⚠ THESE ARMS DRIVE THE REAL ROUTERS, NOT A REBUILT MIDDLEWARE CHAIN.
 * `server/approvalGate.test.ts` reconstructs the chain and says so, pinning the
 * composition with source reads — a fair design for a rule about the chain
 * itself. This card's claim is about three NAMED procedures, so the thing to
 * drive is those procedures: a caller is built on the real `castingImagingRouter`,
 * `castingRefinementRouter` and `castingExportRouter`, and the refusal comes out
 * of the real `adminProcedure` in `server/_core/trpc.ts`.
 *
 * ⚠ AND "BEFORE ANY DEDUCTION" IS PROVEN BY SPYING ON THE MONEY, NOT INFERRED
 * FROM THE ORDER OF THE SOURCE. `deductCredits` and `withAtomicCredits` are
 * mocked and must be called ZERO times on every refusal. A refusal that arrived
 * after a charge would pass an arm that only read the thrown code.
 *
 * THE POSITIVE CONTROL IS THE HALF THAT MATTERS (law 2): an admin caller must
 * get PAST the gate. With no database, `getModelById` answers undefined and the
 * handler throws NOT_FOUND — a different code from the gate's FORBIDDEN, which
 * is exactly the observable that says the middleware let it through. An arm that
 * only proved refusal would also pass if the procedure were broken for everyone.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

/* `vi.hoisted` because `vi.mock`'s factory is hoisted above every `const`. */
const { deductCredits, withAtomicCredits, getModelById } = vi.hoisted(() => ({
  deductCredits: vi.fn(),
  withAtomicCredits: vi.fn(),
  getModelById: vi.fn(),
}));

vi.mock("./db", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  deductCredits,
  getModelById,
  getGenerationOperationKindByRequest: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./casting/atomicCredits", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  withAtomicCredits,
}));

import { castingImagingRouter } from "./routes/generation/castingImaging";
import { castingRefinementRouter } from "./routes/generation/castingRefinement";
import { castingExportRouter } from "./routes/generation/castingExport";

type Role = "user" | "moderator" | "admin";

/** The shape `adminProcedure` reads: a user, its role, and no suspension. */
const ctxFor = (role: Role | null) => ({
  user:
    role === null
      ? null
      : {
          id: 42,
          role,
          email: `${role}@example.com`,
          openId: `open-${role}`,
          name: role,
          approved: true,
          suspendedAt: null,
          lockedUntil: null,
        },
  req: undefined,
  res: undefined,
}) as never;

/* A real v4 UUID: zod checks the version and variant nibbles, and an
   invalid one makes every positive control a BAD_REQUEST that never reaches
   the handler — which is how a weak positive control gets written. */
const REQUEST = "c0ffee00-dead-4bee-8cab-000000000001";

/** The three paid procedures, with an input each schema accepts. */
const SEALED = [
  {
    id: "generation.castingImage",
    call: (role: Role | null) =>
      castingImagingRouter.createCaller(ctxFor(role)).castingImage({
        clientRequestId: REQUEST,
        modelId: 1,
      }),
  },
  {
    id: "generation.iterate",
    call: (role: Role | null) =>
      castingRefinementRouter.createCaller(ctxFor(role)).iterate({
        clientRequestId: REQUEST,
        modelId: 1,
        feedback: "make the hair shorter",
        assetId: 1,
      } as never),
  },
  {
    id: "generation.mintPackage",
    call: (role: Role | null) =>
      castingExportRouter.createCaller(ctxFor(role)).mintPackage({
        clientRequestId: REQUEST,
        modelId: 1,
        tier: "draft",
      } as never),
  },
] as const;

beforeEach(() => {
  deductCredits.mockClear();
  withAtomicCredits.mockClear();
  /* No row anywhere, so a caller past the gate meets the handler's NOT_FOUND. */
  getModelById.mockReset();
  getModelById.mockResolvedValue(undefined);
});

describe("the legacy lane's paid procedures", () => {
  for (const { id, call } of SEALED) {
    it(`⚠ ${id} answers FORBIDDEN to an ordinary approved account, and spends nothing`, async () => {
      await expect(call("user")).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(deductCredits).not.toHaveBeenCalled();
      expect(withAtomicCredits).not.toHaveBeenCalled();
    });

    it(`${id} answers FORBIDDEN to a moderator too — staff is not admin here`, async () => {
      await expect(call("moderator")).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(deductCredits).not.toHaveBeenCalled();
      expect(withAtomicCredits).not.toHaveBeenCalled();
    });

    it(`${id} answers UNAUTHORIZED to an anonymous caller, not FORBIDDEN`, async () => {
      /* The distinction is the client's: UNAUTHORIZED sends you to sign in. */
      await expect(call(null)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
      expect(deductCredits).not.toHaveBeenCalled();
    });

    it(`⚠ POSITIVE CONTROL — ${id} lets an ADMIN past the gate`, async () => {
      /*
        Past the gate it meets `getModelById`, mocked to find nothing, so the
        handler's own NOT_FOUND is the proof of passage. FORBIDDEN here would
        mean the seal refuses everybody, which an arm reading only the refusal
        could never tell apart.
      */
      await expect(call("admin")).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
  }
});

describe("what is deliberately NOT sealed", () => {
  it("⚠ generation.refreshSlots still admits an ordinary account — the canvas reaches it", async () => {
    /*
      It is the fourth paid procedure and the only one a customer can reach
      (`features/boards/canvas/nodes/useSheetController.ts:137`). Sealing it
      removes a live feature, which is a product decision; #1654 carries the
      options. This arm is here so the omission is a DECISION on the record
      rather than something a later reader finds and assumes was missed — and
      so that whoever answers the question has to come through this file.
    */
    await expect(
      castingExportRouter.createCaller(ctxFor("user")).refreshSlots({
        clientRequestId: REQUEST,
        modelId: 1,
        angles: ["frontFull"],
      } as never),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("mintPackagePlan stays open — a price read that four live surfaces query and that spends nothing", async () => {
    await expect(
      castingExportRouter.createCaller(ctxFor("user")).mintPackagePlan({ modelId: 1 } as never),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(deductCredits).not.toHaveBeenCalled();
  });
});
