import { describe, it, expect } from "vitest";
import {
  planCreateNode,
  planRunGeneration,
  buildVariationsPlan,
  MAX_VARIATIONS,
  popOutPlacement,
  planCollapseEdgeMoves,
  libraryCastViewAngle,
} from "./boardOps";
import { CREDIT_COSTS } from "../casting/aiService";
import { EDGE_CLASS, isLineageEdge, CANONICAL_VIEW_ANGLES } from "../../shared/boardTypes";
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

describe("popOutPlacement (R5, close-out bug 0 — nearest free slot, 2 rows then wrap)", () => {
  const root = { positionX: 100, positionY: 200, width: 280 };
  const VIEW = { width: 200, height: 360 };
  const place = (positions: Array<{ x: number; y: number }>) =>
    popOutPlacement(root, positions.map((p) => ({ ...p, ...VIEW })));

  it("first pop-out lands right of the root, level with it", () => {
    const p = place([]);
    expect(p.x).toBeGreaterThan(root.positionX + 280);
    expect(p.y).toBe(root.positionY);
  });

  it("skips occupied slots — second lands below the first", () => {
    const first = place([]);
    const second = place([first]);
    expect(second.x).toBe(first.x);
    expect(second.y - first.y).toBeGreaterThanOrEqual(360);
  });

  it("wraps to a new column after two rows — NEVER an unbounded downward run", () => {
    const first = place([]);
    const second = place([first]);
    const third = place([first, second]);
    expect(third.y).toBe(root.positionY); // back to the top row
    expect(third.x).toBeGreaterThan(first.x); // one column right
  });

  it("five pop-outs all stay within 1.5 view-heights of their predecessor and near the root", () => {
    const placed: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < 5; i++) placed.push(place(placed));
    for (let i = 1; i < 5; i++) {
      const dist = Math.hypot(placed[i].x - placed[i - 1].x, placed[i].y - placed[i - 1].y);
      expect(dist).toBeLessThanOrEqual(1.5 * VIEW.height);
    }
    for (const p of placed) {
      expect(Math.abs(p.y - root.positionY)).toBeLessThanOrEqual(2 * VIEW.height);
      expect(p.x - root.positionX).toBeLessThanOrEqual(1200);
    }
  });

  it("avoids OTHER nodes, not just siblings — a stranger blocking column one wraps the pop-out right", () => {
    const first = place([]);
    const stranger = { x: first.x - 20, y: first.y + 40 }; // spans both rows of column one
    const p = place([stranger]);
    expect(p).not.toEqual(first); // slot one refused
    expect(p.x).toBeGreaterThan(first.x); // wrapped to the next column
  });

  it("falls back to canonical width when the row has none", () => {
    const p = popOutPlacement({ positionX: 0, positionY: 0, width: null }, []);
    expect(p.x).toBeGreaterThan(280);
  });
});

describe("planCollapseEdgeMoves (R5 — D-30 re-anchoring contract)", () => {
  const ROOT = 10;
  const POPPED = 20;
  const edge = (id: number, source: number, target: number, relation: string, metadata: unknown = null) =>
    ({ id, sourceItemId: source, targetItemId: target, relation: relation as never, metadata });

  it("removes the lineage edge and re-anchors outgoing edges to the root with viewAngle", () => {
    const moves = planCollapseEdgeMoves(
      [
        edge(1, ROOT, POPPED, "generated_from_cast", { viewAngle: "sideClose" }),
        edge(2, POPPED, 99, "reference_for", { weight: 0.5 }),
      ],
      ROOT,
      POPPED,
      "sideClose",
    );
    expect(moves.removeEdgeIds.sort()).toEqual([1, 2]);
    expect(moves.addEdges).toEqual([
      {
        sourceItemId: ROOT,
        targetItemId: 99,
        relation: "reference_for",
        // Existing metadata survives; the view intent is preserved (D-30)
        metadata: { weight: 0.5, viewAngle: "sideClose" },
      },
    ]);
  });

  it("leaves incoming third-party edges alone (orphaned by the soft delete, like deleteNodes)", () => {
    const moves = planCollapseEdgeMoves(
      [
        edge(1, ROOT, POPPED, "generated_from_cast"),
        edge(3, 77, POPPED, "reference_for"),
      ],
      ROOT,
      POPPED,
      "backFull",
    );
    expect(moves.removeEdgeIds).toEqual([1]);
    expect(moves.addEdges).toEqual([]);
  });

  it("never creates a root→root self-loop", () => {
    const moves = planCollapseEdgeMoves(
      [
        edge(1, ROOT, POPPED, "generated_from_cast"),
        edge(4, POPPED, ROOT, "reference_for"),
      ],
      ROOT,
      POPPED,
      "frontFull",
    );
    expect(moves.addEdges).toEqual([]);
    // The would-be self-loop edge is simply not re-anchored (it stays put,
    // orphaned by the soft delete)
    expect(moves.removeEdgeIds).toEqual([1]);
  });

  it("collapse with no outgoing edges removes only the lineage edge", () => {
    const moves = planCollapseEdgeMoves([edge(1, ROOT, POPPED, "generated_from_cast")], ROOT, POPPED, "sideFull");
    expect(moves.removeEdgeIds).toEqual([1]);
    expect(moves.addEdges).toEqual([]);
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

describe("libraryCastViewAngle — the canonical list is the shared six (audit N1)", () => {
  it("passes through every canonical angle, including threeQuarter", () => {
    // The old hardcoded five-view copy demoted a threeQuarter asset to
    // "frontClose" — the canonical list must be CANONICAL_VIEW_ANGLES itself
    for (const angle of CANONICAL_VIEW_ANGLES) {
      expect(libraryCastViewAngle(angle)).toBe(angle);
    }
  });

  it("falls back to the headshot slot for non-canonical view types", () => {
    for (const junk of ["side", "walk", "back", "vto_output", ""]) {
      expect(libraryCastViewAngle(junk)).toBe("frontClose");
    }
  });
});
