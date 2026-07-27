import { describe, expect, it } from "vitest";
import { isModelAvailableStatus } from "../../shared/modelLifecycle";
import { AVAILABLE_MODEL_STATUSES } from "./modelAvailability";

describe("R7-7D positive Cast availability", () => {
  it("keeps provisioning and unknown future states unavailable", () => {
    expect(AVAILABLE_MODEL_STATUSES).toEqual(["draft", "active", "locked"]);
    expect(isModelAvailableStatus("draft")).toBe(true);
    expect(isModelAvailableStatus("active")).toBe(true);
    expect(isModelAvailableStatus("locked")).toBe(true);
    expect(isModelAvailableStatus("archived")).toBe(false);
    expect(isModelAvailableStatus("provisioning")).toBe(false);
    expect(isModelAvailableStatus("future_state")).toBe(false);
  });
});
