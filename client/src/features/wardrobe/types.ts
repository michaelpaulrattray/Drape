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
type GarmentStatus = "processing" | "ready" | "failed";

/** Quality issues detected during garment analysis */
export interface QualityIssue {
  severity: "low" | "medium" | "high";
  message: string;
}

/** Slot tab metadata for the rack panel */
export interface SlotTab {
  id: GarmentSlotType;
  label: string;
  shortLabel: string;
  /** Lucide icon component for the slot tab */
  icon: React.ComponentType<{ className?: string; size?: number; strokeWidth?: number }>;
}

/** Tattoo map for VTO identity preservation.
 *  Must stay in sync with server/wardrobe/tattooAnalysis.ts TattooMap */
export interface TattooMap {
  hasTattoos: boolean;
  tattooAreas: string[];
  cleanAreas: string[];
  promptFragment: string;
}

/** Detected item from VTO result scanning (bounding box overlay).
 *  Must stay in sync with server/wardrobe/garmentDetection.ts DetectedItem */
export interface DetectedItem {
  id: string;
  label: string;
  category: GarmentSlotType;
  box_2d: [number, number, number, number];
  confidence: number;
  cropUrl?: string;
  visibility: number; // 0-100: how much of the garment is visible
  visibilityNote?: string; // e.g. "mostly hidden under blazer"
}

