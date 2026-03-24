/**
 * Gemini Service - Barrel re-export
 * 
 * All implementation has been split into focused modules:
 *   - geminiTypes.ts     → Types & enums
 *   - geminiClient.ts    → API client factory & utilities
 *   - geminiPrompts.ts   → Prompt constants & brand/skin helpers
 *   - geminiGeneration.ts → Master prompt, enhance prompt, casting image generation
 *   - geminiViews.ts     → Full body, multi-view, single view, upscale
 * 
 * This barrel preserves backward compatibility for aiService.ts
 * which does `import * as gemini from "./geminiService"`.
 */

// Types & enums
export type { ModelPreferences, ModelViews, GeminiPart } from "./geminiTypes";
export { ImageResolution, AspectRatio, GenerationMode } from "./geminiTypes";

// Client & utilities
export {
  getAiClient,
  SAFETY_SETTINGS,
  extractMimeType,
  extractBase64Data,
  formatGeminiError,
  safeResponseText,
  extractImageFromResponse,
  diagnoseResponse,
  withTimeout,
  withSingleRetry503,
  buildIdentityAnchor,
  checkIdentityConsistency,
} from "./geminiClient";

// Prompts & helpers
export {
  BRAND_NAME,
  MASTER_PROMPT_SYSTEM_INSTRUCTION,
  UPSCALE_PROMPT,
  BRAND_PROFILES,
  DEFAULT_BRAND_DESCRIPTOR,
  getSkinDescription,
  getBrandExpression,
  irisDescriptions,
  getStudioSettings,
  hasBodyArt,
} from "./geminiPrompts";

// Generation functions
export { generateMasterPrompt, enhanceUserPrompt, generateCastingImage, clearCastingSession, stopSessionEviction, getSessionCount } from "./geminiGeneration";

// Schema reconciliation
export { updateSchemaForIteration, reconcileSchemaWithImage } from "./geminiSchemaUpdater";

// Suggestions & reference analysis
export { generateCastingSuggestions, analyzeReferenceForTransfer, FALLBACK_SUGGESTIONS } from "./geminiSuggestions";

// Prompt compaction
export { compactMasterPrompt } from "./geminiPromptCompactor";

// View & upscale functions
export { generateFullBody, generateRemainingViews, generateSingleView, upscaleExistingImage } from "./geminiViews";
