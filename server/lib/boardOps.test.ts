import { describe, it, expect } from "vitest";
import { planCreateNode, planRunGeneration, buildVariationsPlan, MAX_VARIATIONS } from "./boardOps";
import { CREDIT_COSTS } from "../casting/aiService";
import { EDGE_CLASS, isLineageEdge } from "../../shared/boardTypes";
import { BOARD_EDGE_RELATIONS } from "../../drizzle/schema";

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

  it("buildVariationsPlan: N creates in a row below the source, N variant_of edges, N× cost", () => {
    const item = { positionX: 100, positionY: 200, width: 280, height: 420 };
    const plan = buildVariationsPlan(7, item, 3);
    expect(plan.creates).toHaveLength(3);
    expect(plan.addEdges).toHaveLength(3);
    expect(plan.addEdges.every((e) => e.relation === "variant_of" && e.source === 7)).toBe(true);
    expect(plan.estimatedCreditCost).toBe(3 * CREDIT_COSTS.castingImage);
    // Row below the source, stepping right — the client's optimistic temps
    // read these positions, so the formula is contract, not decoration
    expect(plan.creates[0].position).toEqual({ x: 100, y: 200 + 420 + 80 });
    expect(plan.creates[1].position).toEqual({ x: 100 + 340, y: 200 + 420 + 80 });
    expect(plan.deletes).toHaveLength(0);
  });

  it("buildVariationsPlan clamps count to [1, MAX_VARIATIONS]", () => {
    const item = { positionX: 0, positionY: 0, width: 280, height: 420 };
    expect(buildVariationsPlan(1, item, 0).creates).toHaveLength(1);
    expect(buildVariationsPlan(1, item, 99).creates).toHaveLength(MAX_VARIATIONS);
    expect(buildVariationsPlan(1, item, 99).estimatedCreditCost).toBe(MAX_VARIATIONS * CREDIT_COSTS.castingImage);
  });
});

describe("edge classes (D-50.5)", () => {
  it("EDGE_CLASS covers exactly the schema's relations — the lists never drift", () => {
    expect(Object.keys(EDGE_CLASS).sort()).toEqual([...BOARD_EDGE_RELATIONS].sort());
  });

  it("lineage = history (never disconnectable); input = dataflow (run-all/composer/agent)", () => {
    expect(EDGE_CLASS.generated_from_cast).toBe("lineage");
    expect(EDGE_CLASS.forked_from).toBe("lineage");
    expect(EDGE_CLASS.variant_of).toBe("lineage");
    expect(EDGE_CLASS.iterated_from).toBe("lineage");
    expect(EDGE_CLASS.vto_input_model).toBe("input");
    expect(EDGE_CLASS.vto_input_garment).toBe("input");
    expect(EDGE_CLASS.reference_for).toBe("input");
  });

  it("isLineageEdge tolerates unknown relations (false, not a crash)", () => {
    expect(isLineageEdge("generated_from_cast")).toBe(true);
    expect(isLineageEdge("reference_for")).toBe(false);
    expect(isLineageEdge("someday_new_relation")).toBe(false);
  });
});
