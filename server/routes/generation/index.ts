/**
 * Generation Router — combines casting sub-routers into a flat namespace.
 *
 * Sub-modules:
 *   castingImaging   — headshot, full body, multi-view generation
 *   castingRefinement — iterate, upscale, proxy, enhance, suggestions, analyzeReference, reconcile, compactPrompt, clearSession
 *   castingExport    — PDF generation, minting, history, costs
 *
 * Future apps (e.g., product photography) will add their own sub-modules here:
 *   productImaging.ts, productRefinement.ts, etc.
 */
import { router } from "../../_core/trpc";
import { castingImagingRouter } from "./castingImaging";
import { castingRefinementRouter } from "./castingRefinement";
import { castingExportRouter } from "./castingExport";
import { castingParseRouter } from "./castingParse";
import { queueStatusRouter } from "./queueStatus";

export const generationRouter = router({
  ...castingImagingRouter._def.procedures,
  ...castingRefinementRouter._def.procedures,
  ...castingExportRouter._def.procedures,
  ...castingParseRouter._def.procedures,
  ...queueStatusRouter._def.procedures,
});
