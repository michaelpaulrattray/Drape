/**
 * Canvas board types shared client/server — CANVAS_FOUNDATIONS.md Decisions 1–2.
 *
 * Provenance is the structured "what is this node actually" record stored in
 * board_items.metadata.provenance. `kind` governs rendering; provenance tells
 * renderers, agents, and the snapshot API what the image is.
 */

export type CanonicalViewAngle =
  | "frontClose"
  | "frontFull"
  | "sideClose"
  | "sideFull"
  | "backFull";

export const CANONICAL_VIEW_ANGLES: readonly CanonicalViewAngle[] = [
  "frontClose",
  "frontFull",
  "sideClose",
  "sideFull",
  "backFull",
];

/** A snapshot of an input actually consumed by a generation, captured at generation time (D-12). */
export interface InputSnapshot {
  itemId: number;
  versionId?: number;
  /** The EXACT image URL consumed — survives later edits to the source. */
  imageUrl: string;
}

/** Casting attributes = the ModelPreferences shape (client/src/features/casting/constants.ts). */
export type CastAttributes = Record<string, unknown>;

export type Provenance =
  // pass 1
  | { type: "cast_root"; modelId: number; viewAngle: "frontClose"; attributes: CastAttributes; engine: string; forkedFromItemId?: number }
  | { type: "cast_view"; modelId: number; rootItemId: number; viewAngle: CanonicalViewAngle; attributes: CastAttributes; engine: string; inputs: InputSnapshot[] }
  | { type: "library_cast"; modelId: number; viewAngle: CanonicalViewAngle; attributes?: CastAttributes }
  | { type: "upload"; originalFilename?: string }
  | { type: "reference"; sourceItemId?: number }
  // pass 2+
  | { type: "vto_output"; inputs: InputSnapshot[]; engine: string }
  | { type: "library_garment"; garmentId: number }
  | { type: "text2img"; prompt: string; engine: string; inputs: InputSnapshot[] }
  // pass 4 (shape reserved — PASS_4_VIDEO_NOTES.md)
  | { type: "img2video"; engine: string; inputs: InputSnapshot[]; prompt: string; durationSec: number };

export type NodeStatus =
  | { type: "stale"; message: string; context?: { causedByItemId?: number; oldValues?: Record<string, unknown>; newValues?: Record<string, unknown> } }
  | { type: "quality_flagged"; message: string; context?: { flaggedBy?: string; issues?: string[] } }
  | { type: "needs_review"; message: string; context?: { requestedBy?: string } }
  | { type: "error"; message: string; context?: { errorCode?: string } }
  | { type: "moderation"; message: string; context?: { caseId?: number } };

/** The typed slice of board_items.metadata that canvas code reads/writes. */
export interface BoardItemCanvasMetadata {
  provenance?: Provenance;
  status?: NodeStatus | null;
  pinned?: boolean;
  /** Casting attributes for cast_config/cast_root nodes (parser + user merged). */
  attributes?: CastAttributes;
  /** The submitted natural-language prompt (verbatim). */
  userPrompt?: string;
  // Legacy keys still written by BoardCastingPanel until M4 deletes it:
  viewType?: string;
  isGenerating?: boolean;
  generatingStep?: string;
}
