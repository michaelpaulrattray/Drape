/**
 * Wardrobe Studio — Constants
 */
import { Shirt, Layers, Footprints, Watch, Sparkles } from "lucide-react";
import type { SlotTab, GarmentSlotType } from "./types";

/** Ordered slot tabs for the rack panel */
export const SLOT_TABS: SlotTab[] = [
  { id: "full_look", label: "Full Looks", shortLabel: "Looks", icon: Sparkles },
  { id: "tops", label: "Tops", shortLabel: "Tops", icon: Shirt },
  { id: "bottoms", label: "Bottoms", shortLabel: "Btms", icon: Layers },
  { id: "shoes", label: "Shoes", shortLabel: "Shoes", icon: Footprints },
  { id: "accessories", label: "Accessories", shortLabel: "Acc", icon: Watch },
];

/** Maximum garments per slot */
export const MAX_GARMENTS_PER_SLOT = 10;

/** Maximum total garments in inventory */
export const MAX_TOTAL_GARMENTS = 50;

/** Accepted image MIME types for garment upload */
export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Maximum file size for garment upload (8MB) */
export const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024;

/** Slot type display names */
export const SLOT_DISPLAY_NAMES: Record<GarmentSlotType, string> = {
  full_look: "Full Look",
  tops: "Top",
  bottoms: "Bottom",
  shoes: "Shoes",
  accessories: "Accessory",
};
