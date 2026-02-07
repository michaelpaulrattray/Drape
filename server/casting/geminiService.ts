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
export { getAiClient, SAFETY_SETTINGS, extractMimeType, formatGeminiError } from "./geminiClient";

// Prompts & helpers
export {
  MASTER_PROMPT_SYSTEM_INSTRUCTION,
  UPSCALE_PROMPT,
  getSkinDescription,
  getBrandDescriptors,
  getBrandDirectives,
  getNegativeConstraints,
  getStudioSettings,
  hasBodyArt,
} from "./geminiPrompts";

// Generation functions
export { generateMasterPrompt, enhanceUserPrompt, generateCastingImage } from "./geminiGeneration";

// View & upscale functions
export { generateFullBody, generateRemainingViews, generateSingleView, upscaleExistingImage } from "./geminiViews";
