/**
 * Generation Router — combines casting sub-routers into a flat namespace.
 *
 * Sub-modules:
 *   castingImaging   — headshot, full body, multi-view generation
 *   castingRefinement — iterate, enhance, suggestions, analyzeReference, reconcile, compactPrompt, clearSession
 *   imageDataUrl     — proxyImage: one allowlisted picture as a data URL, for
 *                      the canvas zip, the export pack and the clipboard. It
 *                      moved out of castingRefinement because that file is
 *                      being retired (#2315) and this procedure is not.
 *   castingExport    — PDF generation, minting, history, costs
 *
 * Future apps (e.g., product photography) will add their own sub-modules here:
 *   productImaging.ts, productRefinement.ts, etc.
 */
import { router } from "../../_core/trpc";
import { castingImagingRouter } from "./castingImaging";
import { castingRefinementRouter } from "./castingRefinement";
import { imageDataUrlRouter } from "./imageDataUrl";
import { castingExportRouter } from "./castingExport";
import { castingParseRouter } from "./castingParse";
import { queueStatusRouter } from "./queueStatus";
import { generationOperationsRouter } from "./generationOperations";

export const generationRouter = router({
  ...castingImagingRouter._def.procedures,
  ...castingRefinementRouter._def.procedures,
  ...imageDataUrlRouter._def.procedures,
  ...castingExportRouter._def.procedures,
  ...castingParseRouter._def.procedures,
  ...queueStatusRouter._def.procedures,
  ...generationOperationsRouter._def.procedures,
});
