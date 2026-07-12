/**
 * Canvas board types shared client/server — CANVAS_FOUNDATIONS.md Decisions 1–2.
 *
 * Provenance is the structured "what is this node actually" record stored in
 * board_items.metadata.provenance. `kind` governs rendering; provenance tells
 * renderers, agents, and the snapshot API what the image is.
 */

export type CanonicalViewAngle =
  | "frontClose"
  | "threeQuarter"
  | "frontFull"
  | "sideClose"
  | "sideFull"
  | "backFull";

// Const tuple (not a widened array) so zod route inputs can z.enum() it —
// one list, client/server/validation can never disagree.
export const CANONICAL_VIEW_ANGLES = [
  "frontClose",
  "threeQuarter",
  "frontFull",
  "sideClose",
  "sideFull",
  "backFull",
] as const satisfies readonly CanonicalViewAngle[];

/** The canonical identity package (D-39, ratified): face cluster locks
 *  facial identity, body cluster locks silhouette/build. */
export const PACKAGE_SLOTS: readonly CanonicalViewAngle[] = CANONICAL_VIEW_ANGLES;

export const VIEW_ANGLE_LABELS: Record<CanonicalViewAngle, string> = {
  frontClose: "Headshot",
  threeQuarter: "Three-quarter",
  sideClose: "Side profile",
  frontFull: "Full front",
  // D-44: the sixth slot is a deliberate WALKING pose (comp-card walk),
  // generated as viewType 'walk'; identity gate becomes mandatory with the
  // stage-lock unification (STAGE_LOCK_UNIFICATION_ASSESSMENT.md)
  sideFull: "Walk",
  backFull: "Full back",
};

/** D-39 mint tiers: each names what it is FOR; costs are always plan-derived. */
export type MintTier = "draft" | "core" | "production";

export const MINT_TIER_SLOTS: Record<MintTier, readonly CanonicalViewAngle[]> = {
  // Draft: headshot only — exploring candidates; always allowed
  draft: [],
  // Core identity: ready for downstream work (VTO, boards)
  core: ["sideClose", "threeQuarter", "frontFull"],
  // Production sheet: the full comp card for scenes/video
  production: ["sideClose", "threeQuarter", "frontFull", "sideFull", "backFull"],
};

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
  | { type: "library_cast"; modelId: number; viewAngle: CanonicalViewAngle; attributes?: CastAttributes; /** D-42: placed drafts carry their status honestly; cleared on promotion (mint via Edit) */ draft?: boolean }
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
  /** Latest version number — stamped by landing ops alongside the version
   *  row so the node strip never lies (was hardcoded v1 pre-R3-fixes). */
  version?: number;
  /** Casting attributes for cast_config/cast_root nodes (parser + user merged). */
  attributes?: CastAttributes;
  /** The submitted natural-language prompt (verbatim). */
  userPrompt?: string;
  // Legacy keys still written by BoardCastingPanel until M4 deletes it:
  viewType?: string;
  isGenerating?: boolean;
  generatingStep?: string;
}
