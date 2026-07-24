import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./effectiveCastState", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./effectiveCastState")>();
  return {
    ...actual,
    resolveOwnedEffectiveCastState: vi.fn(),
  };
});

import {
  EffectiveCastStateError,
  resolveOwnedEffectiveCastState,
} from "./effectiveCastState";
import { resolveEffectiveCastStateForRead } from "./effectiveCastRead";

describe("R7-7B2 effective Cast read adapter", () => {
  beforeEach(() => {
    vi.mocked(resolveOwnedEffectiveCastState).mockReset();
  });

  it("keeps missing and foreign subjects non-leaking", async () => {
    vi.mocked(resolveOwnedEffectiveCastState)
      .mockRejectedValueOnce(new EffectiveCastStateError("model_not_found"));
    await expect(resolveEffectiveCastStateForRead({ userId: 1, modelId: 7 }))
      .rejects.toMatchObject({ code: "NOT_FOUND", message: "Model not found" });
  });

  it("turns malformed snapshot state into a free typed refusal", async () => {
    vi.mocked(resolveOwnedEffectiveCastState)
      .mockRejectedValueOnce(new EffectiveCastStateError("identity_hash_invalid"));
    await expect(resolveEffectiveCastStateForRead({ userId: 1, modelId: 7 }))
      .rejects.toMatchObject({
        code: "PRECONDITION_FAILED",
        message: expect.stringContaining("No credits were used"),
      });
  });

  it("does not mask unexpected infrastructure failures", async () => {
    const failure = new Error("database unavailable");
    vi.mocked(resolveOwnedEffectiveCastState).mockRejectedValueOnce(failure);
    await expect(resolveEffectiveCastStateForRead({ userId: 1, modelId: 7 }))
      .rejects.toBe(failure);
  });
});
