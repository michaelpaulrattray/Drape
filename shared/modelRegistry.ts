/**
 * Centralized Model Registry — FormaStudio
 *
 * Single source of truth for all Gemini model IDs used across
 * Casting Studio and Wardrobe Studio pipelines.
 *
 * UPGRADE WORKFLOW:
 *   1. Change the model ID in the relevant slot below
 *   2. Run `pnpm test` to verify nothing breaks
 *   3. Document the change in MODEL_CHANGELOG.md
 *
 * See MODEL_CHANGELOG.md for decision framework and history.
 */

// ─── Semantic Model Slots ────────────────────────────────────────────

/** Premium image generation — VTO, casting, refinement, views */
export const IMAGE_PRO = "gemini-3-pro-image-preview" as const;

/** Fast/cheap image generation — digitization, fallback chains */
export const IMAGE_FLASH = "gemini-3.1-flash-image-preview" as const;

/** Premium text reasoning — detection, master prompt generation */
export const TEXT_PRO = "gemini-3.1-pro-preview" as const;

/** Mid-tier text reasoning — suggestions, schema updates, enhancement */
export const TEXT_MID = "gemini-3-flash-preview" as const;

/** Economy text reasoning — analysis, QC, classification, identity */
export const TEXT_ECONOMY = "gemini-2.5-flash" as const;

// ─── Pre-built Fallback Chains ───────────────────────────────────────

/** Image generation: try Pro first, fall back to Flash */
export const IMAGE_FALLBACK = [IMAGE_PRO, IMAGE_FLASH] as const;

/** Heavy text tasks: Pro → Mid → Economy */
export const TEXT_HEAVY_FALLBACK = [TEXT_PRO, TEXT_MID, TEXT_ECONOMY] as const;

/** Light text tasks: Mid → Economy */
export const TEXT_LIGHT_FALLBACK = [TEXT_MID, TEXT_ECONOMY] as const;

/** Cheapest text path: Economy only */
export const TEXT_ECONOMY_FALLBACK = [TEXT_ECONOMY] as const;

// ─── Convenience re-export ───────────────────────────────────────────

export const MODELS = {
  IMAGE_PRO,
  IMAGE_FLASH,
  TEXT_PRO,
  TEXT_MID,
  TEXT_ECONOMY,
} as const;

export const FALLBACK = {
  IMAGE: IMAGE_FALLBACK,
  TEXT_HEAVY: TEXT_HEAVY_FALLBACK,
  TEXT_LIGHT: TEXT_LIGHT_FALLBACK,
  TEXT_ECONOMY: TEXT_ECONOMY_FALLBACK,
} as const;
