/**
 * Pure legacy→kind/provenance mapping for board_items — CANVAS_FOUNDATIONS.md
 * §6 (D-26). Separated from the runner script so it is unit-testable and so
 * new-row writers can share the same mapping where needed.
 */
import type { Provenance, BoardItemCanvasMetadata } from "../../shared/boardTypes";
import type { BoardItemKind } from "../../drizzle/schema";

export interface LegacyBoardItemRow {
  id: number;
  type: string;
  metadata: unknown;
  parentItemId: number | null;
  sourceModelId: number | null;
  sourceGarmentId: number | null;
  sourceSessionId: number | null;
}

export interface MappedLegacyRow {
  kind: BoardItemKind;
  provenance: Provenance | null;
  /** True when a legacy parentItemId should become an iterated_from edge. */
  iteratedFromEdge: boolean;
}

function metaViewAngle(metadata: unknown): Provenance extends never ? never : any {
  if (metadata && typeof metadata === "object") {
    const vt = (metadata as BoardItemCanvasMetadata).viewType;
    if (
      vt === "frontClose" || vt === "frontFull" || vt === "sideClose" ||
      vt === "sideFull" || vt === "backFull"
    ) {
      return vt;
    }
  }
  return "frontClose";
}

export function mapLegacyRow(row: LegacyBoardItemRow): MappedLegacyRow {
  switch (row.type) {
    case "note":
      return { kind: "note", provenance: null, iteratedFromEdge: false };
    case "frame":
      return { kind: "frame", provenance: null, iteratedFromEdge: false };
    case "model":
      return {
        kind: "image",
        provenance: row.sourceModelId
          ? { type: "library_cast", modelId: row.sourceModelId, viewAngle: metaViewAngle(row.metadata) }
          : { type: "upload" },
        iteratedFromEdge: false,
      };
    case "garment":
      return {
        kind: "image",
        provenance: row.sourceGarmentId
          ? { type: "library_garment", garmentId: row.sourceGarmentId }
          : { type: "upload" },
        iteratedFromEdge: false,
      };
    case "vto_result":
      return {
        kind: "image",
        provenance: { type: "vto_output", inputs: [], engine: "unknown" },
        iteratedFromEdge: false,
      };
    case "reference":
      return { kind: "image", provenance: { type: "reference" }, iteratedFromEdge: false };
    case "iteration":
      return {
        kind: "image",
        provenance: { type: "upload" },
        iteratedFromEdge: row.parentItemId != null,
      };
    default:
      // Unknown legacy type — safest render path is a bare image with no claims
      return { kind: "image", provenance: { type: "upload" }, iteratedFromEdge: false };
  }
}
