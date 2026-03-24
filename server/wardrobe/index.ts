/**
 * Wardrobe Server Module — Barrel Export
 *
 * All wardrobe AI services and utilities exported from a single entry point.
 */

// Service 0: Garment Detection
export {
  detectGarmentsInImage,
  type DetectedItem,
  type SlotType,
} from "./garmentDetection";

// Service 1A: Garment Digitization
export {
  digitizeGarment,
  type DigitizationResult,
} from "./garmentDigitization";

// Service 1B: Garment Analysis
export {
  analyzeGarmentMetadata,
  type GarmentMetadata,
} from "./garmentAnalysis";

// Service 2: VTO Generation
export {
  generateVirtualTryOn,
  incrementalComposite,
  type VTOParams,
  type VTOResult,
  type IncrementalParams,
} from "./vtoGeneration";

// Service 3: Garment Refinement
export {
  refineGarment,
  type RefinementParams,
  type RefinementResult,
} from "./garmentRefinement";

// Service 4: Outfit Decomposition
export {
  decomposeOutfit,
  type DecomposedGarment,
  type DecompositionResult,
} from "./outfitDecomposition";

// Service 5: Tattoo Analysis
export {
  analyzeTattoos,
  type TattooMap,
} from "./tattooAnalysis";

// Service 6: Quality Check
export {
  checkImageQuality,
  type ImageQualityResult,
} from "./qualityCheck";

// Shared Utilities
export {
  type GarmentForVTO,
  sanitizeDescription,
  sortByLayerPriority,
  uploadBase64ToS3,
} from "./utils";
