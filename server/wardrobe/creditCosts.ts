/**
 * Wardrobe Credit Costs — aligned with casting studio pricing.
 *
 * Costs are calibrated to the Gemini model used:
 * - Flash operations (detection, analysis): lower cost
 * - Pro Image operations (digitization, VTO, refinement): higher cost
 *
 * 50x display multiplier is already applied (same as casting).
 */
export const WARDROBE_CREDIT_COSTS = {
  // Upload pipeline (detection + digitization + analysis = 3 calls)
  garmentUpload: 350,       // Full pipeline: Flash + Image Pro + Flash

  // Individual pipeline steps (for retry/partial)
  garmentDetect: 50,        // Flash text only
  garmentDigitize: 250,     // Image Pro generation
  garmentAnalyze: 50,       // Flash text only

  // VTO generation (Pro Image — heavy multi-image prompt)
  vtoGeneration: 350,       // Single VTO composite
  vtoIncremental: 300,      // Add/swap one garment on existing result

  // Refinement (Flash classify + Pro Image refine)
  garmentRefinement: 350,   // Classify + regenerate

  // Decomposition (Flash detection — no image gen)
  outfitDecomposition: 100, // Detect + crop bounding boxes
} as const;
