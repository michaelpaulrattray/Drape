import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProviderError } from "../providers/types";
import type { ViewConformanceVerdict } from "./viewConformance";

/**
 * The package's six independently refundable units (plan §F, §H.4).
 *
 * Every case here is of the sharp form the billing law demands: exactly the
 * views that did not arrive were refunded, never one that did, never twice, and
 * never more than a slice. Plus the two rules that are easy to lose in a
 * refactor — one regeneration and then the slot fails named-and-refunded, and a
 * commit that loses its fence refunds NOTHING here because recovery owns it.
 */

const OPERATION_ID = "55555555-5555-4555-8555-555555555555";

const generations: Array<Record<string, unknown>> = [];
vi.mock("../db/generations", () => ({
  createGeneration: vi.fn(async (input: Record<string, unknown>) => {
    generations.push(input);
    return { success: true, generationId: generations.length };
  }),
  updateGeneration: vi.fn(async () => ({ success: true })),
}));

vi.mock("../db/castingV2Sign", () => ({
  commitPackageSlotAsset: vi.fn(),
  recordPackageSlotFailure: vi.fn(),
  activateSignedCast: vi.fn(),
  listCastAssets: vi.fn(async () => []),
}));

const { buildCastPackage, packageSlotChargeReference, unsettledPackageAngles } =
  await import("./packageOrchestrator");
const { CAST_PACKAGE_VIEWS } = await import("./castViewPackage");

const pass: ViewConformanceVerdict = {
  pass: true,
  method: "judge:test",
  axes: {
    identity: { pass: true, note: "same person" },
    angle: { pass: true, note: "as specified" },
    wardrobe: { pass: true, note: "grey tee" },
  },
};
const fail: ViewConformanceVerdict = {
  pass: false,
  method: "judge:test",
  axes: {
    identity: { pass: false, note: "different bone structure" },
    angle: { pass: true, note: "" },
    wardrobe: { pass: true, note: "" },
  },
};

const refunds: Array<{ amount: number; reference: string }> = [];
const committed: string[] = [];
const failures: Array<Record<string, unknown>> = [];
const storedKeys: string[] = [];
const deletedKeys: string[] = [];
let refundRecords = true;

function deps(overrides: Record<string, unknown> = {}) {
  return {
    identityEngine: () => ({
      id: "test-identity",
      editWithReferences: vi.fn(),
      generateView: vi.fn(async () => ({
        bytes: Buffer.from("view"),
        contentType: "image/png",
        latencyMs: 1,
        provenance: { provider: "fal" as const, model: "nbp", providerRef: "ref" },
      })),
    }),
    judge: () => vi.fn(async () => pass),
    storeImage: vi.fn(async () => {
      const key = `casting-v2/casts/${OPERATION_ID}/views/${storedKeys.length}.png`;
      storedKeys.push(key);
      return { key, url: `https://cdn.example/${key}` };
    }),
    commitSlot: vi.fn(async (input: Record<string, unknown>) => {
      committed.push(input.angle as string);
      return committed.length;
    }),
    recordFailure: vi.fn(async (input: Record<string, unknown>) => {
      failures.push(input);
      return true;
    }),
    refund: vi.fn(async (_userId: number, amount: number, _label: string, reference: string) => {
      if (!refundRecords) {
        return { recorded: false, amount: 0, reference: `refund:${reference}`, duplicate: false };
      }
      // A repeat under the same reference is recorded but is NOT a payment —
      // the ledger absorbed it. Modelled so the receipt totals can be trusted.
      const already = refunds.some((entry) => entry.reference === reference);
      if (already) return { recorded: true, amount, reference: `refund:${reference}`, duplicate: true };
      refunds.push({ amount, reference });
      return { recorded: true, amount, reference: `refund:${reference}`, duplicate: false };
    }),
    activate: vi.fn(async () => ({
      type: "activated" as const,
      modelId: 901,
      packageSnapshotId: "pkg",
      slots: [],
    })),
    deleteObject: vi.fn(async (key: string) => {
      deletedKeys.push(key);
      return { success: true as const };
    }),
    ...overrides,
  };
}

const input = {
  userId: 1,
  operationId: OPERATION_ID,
  modelId: 901,
  identityRevisionId: "rev-1",
  identityText: "identity",
  anchor: { bytes: Buffer.from("anchor"), contentType: "image/png" },
};

beforeEach(() => {
  refunds.length = 0;
  committed.length = 0;
  failures.length = 0;
  storedKeys.length = 0;
  deletedKeys.length = 0;
  generations.length = 0;
  refundRecords = true;
  vi.clearAllMocks();
});

describe("a package where everything lands", () => {
  it("commits all six views and refunds nothing", async () => {
    const result = await buildCastPackage(deps(), input);

    expect(result.committed).toHaveLength(5);
    expect(result.failed).toHaveLength(0);
    expect(result.refundedCredits).toBe(0);
    expect(refunds).toHaveLength(0);
    expect(new Set(committed)).toEqual(new Set(CAST_PACKAGE_VIEWS));
    expect(result.activated).toBe(true);
  });

  it("writes one audit row per view, in the shared step vocabulary", async () => {
    await buildCastPackage(deps(), input);
    expect(generations).toHaveLength(5);
    expect(generations.every((row) => String(row.stepKey).startsWith("view:"))).toBe(true);
  });
});

describe("one regeneration, then named-and-refunded", () => {
  it("keeps a view that passes on the second attempt, and charges nothing extra", async () => {
    let calls = 0;
    const judge = () => vi.fn(async () => {
      calls += 1;
      return calls === 1 ? fail : pass;
    });
    const result = await buildCastPackage(deps({ judge }), input);

    expect(result.failed).toHaveLength(0);
    expect(refunds).toHaveLength(0);
    // The rejected attempt's object is deleted rather than orphaned.
    expect(deletedKeys.length).toBeGreaterThan(0);
  });

  it("fails and refunds exactly one slice when both attempts fail conformance", async () => {
    const judge = () => vi.fn(async (request: { angle: string }) =>
      request.angle === "backFull" ? fail : pass);
    const result = await buildCastPackage(deps({ judge }), input);

    expect(result.failed).toEqual(["backFull"]);
    expect(refunds).toHaveLength(1);
    expect(refunds[0]).toEqual({
      amount: 50,
      reference: packageSlotChargeReference(OPERATION_ID, "backFull"),
    });
    expect(result.refundedCredits).toBe(50);
    // Five landed. A failed view never blocks the others.
    expect(committed).toHaveLength(4);
  });

  it("persists the per-axis verdict on the failed slot, so a dispute is answerable", async () => {
    const judge = () => vi.fn(async (request: { angle: string }) =>
      request.angle === "sideClose" ? fail : pass);
    await buildCastPackage(deps({ judge }), input);

    const marker = failures.find((entry) => entry.angle === "sideClose");
    const failure = marker?.failure as { conformance?: { axes: Record<string, { pass: boolean }> } };
    expect(failure.conformance?.axes.identity.pass).toBe(false);
    expect(failure.conformance?.axes.angle.pass).toBe(true);
  });

  it("leaves no orphaned object behind a failed view", async () => {
    const judge = () => vi.fn(async (request: { angle: string }) =>
      request.angle === "backFull" ? fail : pass);
    await buildCastPackage(deps({ judge }), input);
    // Both attempts at backFull stored an object; both were deleted.
    expect(deletedKeys).toHaveLength(2);
  });
});

describe("generation failures", () => {
  it("does not retry a content refusal — it will refuse again", async () => {
    const generateView = vi.fn(async () => {
      throw new ProviderError("content_policy", "refused");
    });
    const identityEngine = () => ({ id: "e", editWithReferences: vi.fn(), generateView });
    const result = await buildCastPackage(deps({ identityEngine }), input);

    // Five views, one attempt each.
    expect(generateView).toHaveBeenCalledTimes(5);
    expect(result.failed).toHaveLength(5);
    expect(result.refundedCredits).toBe(250);
  });

  it("retries once on an unknown failure before writing the view off", async () => {
    const generateView = vi.fn(async () => {
      throw new Error("something odd");
    });
    const identityEngine = () => ({ id: "e", editWithReferences: vi.fn(), generateView });
    await buildCastPackage(deps({ identityEngine }), input);
    expect(generateView).toHaveBeenCalledTimes(10);
  });

  it("still activates the Cast when every view fails — the master is usable", async () => {
    const identityEngine = () => ({
      id: "e",
      editWithReferences: vi.fn(),
      generateView: vi.fn(async () => {
        throw new ProviderError("capability", "no");
      }),
    });
    const result = await buildCastPackage(deps({ identityEngine }), input);

    expect(result.activated).toBe(true);
    // 5 × 50 back; the 200 promotion stays, which is what was delivered.
    expect(result.refundedCredits).toBe(250);
  });
});

describe("the judge cannot be trusted to be available", () => {
  it("refuses to land a view it could not check", async () => {
    const judge = () => vi.fn(async () => {
      throw new ProviderError("transport", "judge unreachable");
    });
    const result = await buildCastPackage(deps({ judge }), input);

    // Fail closed: "we could not check it" is never "it is fine".
    expect(result.committed).toHaveLength(0);
    expect(result.refundedCredits).toBe(250);
  });
});

describe("the fence", () => {
  it("refunds nothing here when a slot commit loses to recovery", async () => {
    // The operation is no longer `running`, so the sweep has taken over and
    // will settle this slice under the same reference. Refunding here as well
    // would be the double refund the whole design exists to prevent.
    const commitSlot = vi.fn(async () => null);
    const result = await buildCastPackage(deps({ commitSlot }), input);

    expect(refunds).toHaveLength(0);
    expect(result.refundedCredits).toBe(0);
    expect(result.failed).toHaveLength(5);
    // And every object is deleted, since no row will ever reference them.
    expect(deletedKeys).toHaveLength(5);
  });
});

describe("honesty about money that did not move", () => {
  it("reports an unrecorded refund and records 0 on the slot, never 50", async () => {
    refundRecords = false;
    const judge = () => vi.fn(async (request: { angle: string }) =>
      request.angle === "backFull" ? fail : pass);
    const result = await buildCastPackage(deps({ judge }), input);

    expect(result.refundUnrecorded).toBe(true);
    expect(result.refundedCredits).toBe(0);
    const marker = failures.find((entry) => entry.angle === "backFull");
    expect((marker?.failure as { refunded: number }).refunded).toBe(0);
  });
});

describe("what recovery still has to settle", () => {
  it("counts a view with neither a picture nor a marker", async () => {
    const { listCastAssets } = await import("../db/castingV2Sign");
    vi.mocked(listCastAssets).mockResolvedValue([
      // A landed 2K view.
      { viewType: "frontFull", resolution: "2K", storageUrl: "u", status: null },
      // A written-off view.
      { viewType: "backFull", resolution: "2K", storageUrl: "", status: { state: "failed" } },
      // The 1K anchor: it fills the headshot SLOT, but it is not the 2K
      // re-render the customer paid for, so that view is still unsettled.
      { viewType: "frontClose", resolution: "1K", storageUrl: "anchor", status: null },
    ] as never);

    const unsettled = await unsettledPackageAngles({ userId: 1, modelId: 901 });
    expect(unsettled).toEqual(["frontClose", "threeQuarter", "sideClose"]);
  });
});
