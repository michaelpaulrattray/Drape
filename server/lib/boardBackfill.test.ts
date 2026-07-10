import { describe, it, expect } from "vitest";
import { mapLegacyRow, type LegacyBoardItemRow } from "./boardBackfill";

const row = (overrides: Partial<LegacyBoardItemRow>): LegacyBoardItemRow => ({
  id: 1,
  type: "model",
  metadata: null,
  parentItemId: null,
  sourceModelId: null,
  sourceGarmentId: null,
  sourceSessionId: null,
  ...overrides,
});

describe("mapLegacyRow (foundations §6 / D-26 provenance-aware backfill)", () => {
  it("maps note and frame to their own kinds with no provenance", () => {
    expect(mapLegacyRow(row({ type: "note" }))).toEqual({ kind: "note", provenance: null, iteratedFromEdge: false });
    expect(mapLegacyRow(row({ type: "frame" }))).toEqual({ kind: "frame", provenance: null, iteratedFromEdge: false });
  });

  it("maps model+sourceModelId to library_cast with the metadata viewType", () => {
    const mapped = mapLegacyRow(row({ type: "model", sourceModelId: 42, metadata: { viewType: "frontFull" } }));
    expect(mapped.kind).toBe("image");
    expect(mapped.provenance).toEqual({ type: "library_cast", modelId: 42, viewAngle: "frontFull" });
  });

  it("defaults viewAngle to frontClose for missing or invalid viewType", () => {
    const noMeta = mapLegacyRow(row({ type: "model", sourceModelId: 7 }));
    expect(noMeta.provenance).toMatchObject({ viewAngle: "frontClose" });
    const badMeta = mapLegacyRow(row({ type: "model", sourceModelId: 7, metadata: { viewType: "weird" } }));
    expect(badMeta.provenance).toMatchObject({ viewAngle: "frontClose" });
  });

  it("maps model WITHOUT sourceModelId to a plain upload", () => {
    expect(mapLegacyRow(row({ type: "model" })).provenance).toEqual({ type: "upload" });
  });

  it("maps garment by FK presence", () => {
    expect(mapLegacyRow(row({ type: "garment", sourceGarmentId: 9 })).provenance)
      .toEqual({ type: "library_garment", garmentId: 9 });
    expect(mapLegacyRow(row({ type: "garment" })).provenance).toEqual({ type: "upload" });
  });

  it("maps vto_result with empty inputs and unknown engine (honest about the past)", () => {
    expect(mapLegacyRow(row({ type: "vto_result" })).provenance)
      .toEqual({ type: "vto_output", inputs: [], engine: "unknown" });
  });

  it("flags iterated_from edge creation only when parentItemId exists", () => {
    expect(mapLegacyRow(row({ type: "iteration", parentItemId: 5 })).iteratedFromEdge).toBe(true);
    expect(mapLegacyRow(row({ type: "iteration" })).iteratedFromEdge).toBe(false);
  });

  it("falls back to a bare image for unknown legacy types", () => {
    const mapped = mapLegacyRow(row({ type: "mystery" }));
    expect(mapped.kind).toBe("image");
    expect(mapped.provenance).toEqual({ type: "upload" });
  });
});
