import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { classifyStaleOperation, type StaleOperationEvidence } from "./casting/operationRecovery";

const base: StaleOperationEvidence = {
  status: "running",
  plannedCredits: 300,
  chargedCredits: 300,
  childCount: 1,
  processingChildren: 0,
  completedChildren: 0,
  failedChildren: 1,
  durableResultCount: 0,
  possiblePartialWrite: false,
  ledgerDisagrees: false,
};

describe("R7-2B conservative operation recovery", () => {
  it("classifies all evidence-backed recovery outcomes without guessing", () => {
    expect(classifyStaleOperation({
      ...base, status: "claimed", chargedCredits: 0, childCount: 0,
      failedChildren: 0, plannedCredits: 0,
    })).toBe("free_failure");
    expect(classifyStaleOperation(base)).toBe("paid_failure");
    expect(classifyStaleOperation({
      ...base, completedChildren: 1, failedChildren: 0, durableResultCount: 1,
    })).toBe("durable_success");
    expect(classifyStaleOperation({ ...base, processingChildren: 1, failedChildren: 0 }))
      .toBe("recovery_required");
    expect(classifyStaleOperation({ ...base, ledgerDisagrees: true }))
      .toBe("recovery_required");
    expect(classifyStaleOperation({
      ...base, chargedCredits: 0, childCount: 0, failedChildren: 0,
      plannedCredits: 0, possiblePartialWrite: false,
    })).toBe("free_failure");
    expect(classifyStaleOperation({
      ...base, chargedCredits: 0, childCount: 0, failedChildren: 0,
      plannedCredits: 0, possiblePartialWrite: true,
    })).toBe("recovery_required");
  });

  it("links every paid Casting and Canvas child-attempt seam", () => {
    const imaging = readFileSync("server/routes/generation/castingImaging.ts", "utf8");
    const refinement = readFileSync("server/routes/generation/castingRefinement.ts", "utf8");
    const packageSource = readFileSync("server/casting/mintPackage.ts", "utf8");
    const canvas = readFileSync("server/lib/boardOps.ts", "utf8");
    expect(imaging).toContain('operationId: gate.operationId');
    expect(imaging).toContain('stepKey: "headshot"');
    expect(refinement).toContain('stepKey: "iterate"');
    expect(packageSource).toContain('stepKey: ctx.operationId ? `view:${angle}`');
    expect(canvas).toContain('stepKey: "recast"');
    expect(canvas).toContain('stepKey: "fork"');
    expect(canvas).toContain('stepKey: `variation:${index}`');
  });
});
