/**
 * Wardrobe Studio — Client-side type definitions
 *
 * Maps to the server-side DB schema and AI service interfaces.
 * Garment slots follow the SOT's 5-category inventory system.
 */

/** Garment slot types — the 5 inventory categories */
export type GarmentSlotType =
  | "full_look"
  | "tops"
  | "bottoms"
  | "shoes"
  | "accessories";

/** Processing status of a garment */
export type GarmentStatus = "processing" | "ready" | "failed";

/** Quality issues detected during garment analysis */
export interface QualityIssue {
  severity: "low" | "medium" | "high";
  message: string;
}

/** A garment in the user's wardrobe inventory */
export interface WardrobeGarment {
  id: number;
  slotType: GarmentSlotType;
  originalImageUrl: string;
  isolatedImageUrl: string | null;
  shortName: string | null;
  description: string | null;
  tags: string[];
  suggestedActions: string[];
  qualityIssues: QualityIssue[];
  styleNote: string;
  status: GarmentStatus;
  isSelected: boolean;
  createdAt: string;
}

/** Slot tab metadata for the rack panel */
export interface SlotTab {
  id: GarmentSlotType;
  label: string;
  shortLabel: string;
  /** Lucide icon component for the slot tab */
  icon: React.ComponentType<{ className?: string; size?: number; strokeWidth?: number }>;
}

/** Saved outfit — a combination of garments with style notes */
export interface WardrobeOutfit {
  id: number;
  name: string;
  garmentIds: number[];
  styleNotes: Record<string, string>;
  resultThumbUrl: string | null;
  createdAt: string;
}

/** Wardrobe session — tracks undo/redo history for a VTO session */
export interface WardrobeSession {
  id: number;
  modelId: number | null;
  modelImageUrl: string;
  history: string[];
  historyIndex: number;
  activeGarmentIds: number[];
  createdAt: string;
}

/** Tattoo map for VTO identity preservation.
 *  Must stay in sync with server/wardrobe/tattooAnalysis.ts TattooMap */
export interface TattooMap {
  hasTattoos: boolean;
  tattooAreas: string[];
  cleanAreas: string[];
  promptFragment: string;
}

/** Result from a VTO generation */
export interface VTOResult {
  resultUrl: string;
}

/** Detected garment from decomposition */
export interface DecomposedGarment {
  label: string;
  category: GarmentSlotType;
  boundingBox: { x: number; y: number; w: number; h: number };
  confidence: number;
}

/** Detected item from VTO result scanning (bounding box overlay).
 *  Must stay in sync with server/wardrobe/garmentDetection.ts DetectedItem */
export interface DetectedItem {
  id: string;
  label: string;
  category: GarmentSlotType;
  box_2d: [number, number, number, number];
  confidence: number;
}

/** Per-garment overlay style note (from clicking garment on result image) */
export interface OverlayStyleNote {
  garmentId: number;
  note: string;
  dirty: boolean;
}
