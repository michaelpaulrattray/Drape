import { describe, it, expect } from "vitest";
import { planCreateNode, planRunGeneration } from "./boardOps";
import { CREDIT_COSTS } from "../casting/aiService";

describe("boardOps plans (foundations §4 / Decision 6)", () => {
  it("planCreateNode is free and describes exactly one creation", () => {
    const plan = planCreateNode({
      boardId: 1,
      kind: "cast_config",
      provenance: null,
      position: { x: 100, y: 200 },
    });
    expect(plan.operation).toBe("createNode");
    expect(plan.estimatedCreditCost).toBe(0);
    expect(plan.creates).toHaveLength(1);
    expect(plan.creates[0]).toMatchObject({ kind: "cast_config", position: { x: 100, y: 200 } });
    expect(plan.deletes).toHaveLength(0);
  });

  it("planRunGeneration derives its cost from CREDIT_COSTS, never a literal", () => {
    const plan = planRunGeneration();
    expect(plan.estimatedCreditCost).toBe(CREDIT_COSTS.castingImage);
    expect(plan.estimatedCreditCost).toBeGreaterThan(0);
    expect(plan.estimatedDurationMs).toBeGreaterThan(0);
  });
});
