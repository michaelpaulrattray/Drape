import { protectedProcedure, router } from "../../_core/trpc";
import {
  getModelById, createModelAsset, getModelAssets,
  createGeneration, updateGeneration, updateModel,
} from "../../db";
import {
  generateMasterPrompt, iterateModel, enhanceUserPrompt, upscaleImage,
  generateCastingSuggestions, analyzeReferenceForTransfer,
  reconcileSchemaWithImage, compactMasterPrompt, clearCastingSession,
  POINT_COSTS, ImageResolution,
} from "../../casting/aiService";
import { withAtomicCredits } from "../../casting/atomicCredits";
import { enforceDailyQuota } from "../../db/dailyQuota";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { validateProxyUrl } from "../../security/urlValidator";
import { checkRateLimit, RATE_LIMITS, rateLimitError } from "../../security/rateLimit";
import { createModuleLogger } from "../../logging/logger";
const log = createModuleLogger("routes/generation");

export const castingRefinementRouter = router({
  // Iterate/refine a model image
  iterate: protectedProcedure
    .input(z.object({
      modelId: z.number(),
      feedback: z.string().min(1),
      assetId: z.number(),
      maskBase64: z.string().max(10_000_000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Rate limit by user to prevent API abuse
      const rateCheck = checkRateLimit(`user:${ctx.user.id}`, RATE_LIMITS.generation);
      if (!rateCheck.allowed) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: rateLimitError(rateCheck.resetIn),
        });
      }

      // Daily quota enforcement — prevent one user from exhausting Gemini RPD
      await enforceDailyQuota(ctx.user.id);

      // Validate model ownership first (cheap operation)
      const model = await getModelById(input.modelId);
      if (!model) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Model not found" });
      }
      if (model.userId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }

      // Get the asset being iterated
      const assets = await getModelAssets(input.modelId);
      const targetAsset = assets.find(a => a.id === input.assetId);
      if (!targetAsset) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Asset not found" });
      }

      const genResult = await createGeneration({
        userId: ctx.user.id,
        modelId: input.modelId,
        type: "iteration",
        status: "processing",
        pointsCost: POINT_COSTS.iterate,
        metadata: { feedback: input.feedback, assetId: input.assetId },
      });

      try {
        const result = await withAtomicCredits(
          {
            userId: ctx.user.id,
            amount: POINT_COSTS.iterate,
            description: "Model iteration",
            referenceId: `gen-${genResult.generationId}`,
          },
          async () => {
            const updatedPromptResult = await generateMasterPrompt(
              {
                ...model.preferences as any,
                userPrompt: input.feedback,
                previousMasterPrompt: model.masterPrompt,
              },
              'ITERATE'
            );
            const updatedMasterPrompt = updatedPromptResult.naturalDescription;
            const updatedSchema = updatedPromptResult.technicalSchema;

            const iterResult = await iterateModel(
              updatedMasterPrompt,
              targetAsset.storageUrl,
              input.feedback,
              {
                castingBrand: (model.technicalSchema as any)?.context?.casting_for,
                frame: targetAsset.viewType === 'frontClose' ? 'HEADSHOT' : 'FULL_BODY',
                maskBase64: input.maskBase64,
                userId: String(ctx.user.id),
              }
            );

            if (!iterResult.imageUrl) {
              throw new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to iterate model",
              });
            }

            return { imageUrl: iterResult.imageUrl, updatedMasterPrompt, updatedSchema };
          }
        );

        const assetResult = await createModelAsset({
          modelId: input.modelId,
          viewType: targetAsset.viewType,
          resolution: "1K",
          storageUrl: result.imageUrl,
          pointsCost: POINT_COSTS.iterate,
        });

        await updateModel(input.modelId, {
          masterPrompt: result.updatedMasterPrompt,
          technicalSchema: result.updatedSchema,
        });

        await updateGeneration(genResult.generationId!, {
          status: "completed",
          resultUrl: result.imageUrl,
          completedAt: new Date(),
        });

        return {
          success: true,
          imageUrl: result.imageUrl,
          pointsCost: POINT_COSTS.iterate,
          masterPrompt: result.updatedMasterPrompt,
          technicalSchema: result.updatedSchema,
          assetId: assetResult.assetId,
        };
      } catch (error) {
        await updateGeneration(genResult.generationId!, {
          status: "failed",
          errorMessage: error instanceof Error ? error.message : "Unknown error",
          completedAt: new Date(),
        });
        throw error;
      }
    }),

  // Upscale existing image
  upscale: protectedProcedure
    .input(z.object({
      imageUrl: z.string(),
      resolution: z.enum(['1K', '2K', '4K']),
    }))
    .mutation(async ({ ctx, input }) => {
      // Rate limit by user to prevent API abuse
      const rateCheck = checkRateLimit(`user:${ctx.user.id}`, RATE_LIMITS.generation);
      if (!rateCheck.allowed) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: rateLimitError(rateCheck.resetIn),
        });
      }

      // Daily quota enforcement — prevent one user from exhausting Gemini RPD
      await enforceDailyQuota(ctx.user.id);

      const upscaleCost = POINT_COSTS.iterate;
      const referenceId = `upscale-${Date.now()}`;

      try {
        const result = await withAtomicCredits(
          {
            userId: ctx.user.id,
            amount: upscaleCost,
            description: `Upscale to ${input.resolution}`,
            referenceId,
          },
          async () => {
            const resolutionMap: Record<string, ImageResolution> = {
              '1K': ImageResolution.STANDARD,
              '2K': ImageResolution.HIGH,
              '4K': ImageResolution.ULTRA,
            };
            const targetRes = resolutionMap[input.resolution] || ImageResolution.STANDARD;
            return await upscaleImage(input.imageUrl, targetRes);
          }
        );

        return {
          success: true,
          imageUrl: result.imageUrl,
        };
      } catch (error) {
        log.error({ err: error }, "[Upscale] Error:");
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to upscale image",
        });
      }
    }),

  // Proxy endpoint to fetch S3 images and return as base64 (bypasses CORS)
  // SECURITY: Restricted to trusted S3/CDN domains to prevent SSRF
  proxyImage: protectedProcedure
    .input(z.object({
      imageUrl: z.string().url(),
    }))
    .mutation(async ({ input }) => {
      // Validate URL against allowlist before fetching
      const validation = validateProxyUrl(input.imageUrl);
      if (!validation.valid) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `URL not allowed: ${validation.reason}`,
        });
      }

      try {
        const response = await fetch(input.imageUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch image: ${response.status}`);
        }
        const buffer = await response.arrayBuffer();
        const base64 = Buffer.from(buffer).toString('base64');
        const contentType = response.headers.get('content-type') || 'image/png';
        return {
          success: true,
          base64: `data:${contentType};base64,${base64}`,
        };
      } catch (error) {
        log.error({ err: error }, '[ProxyImage] Error:');
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to fetch image',
        });
      }
    }),

  // Enhance user prompt with AI
  // NOTE: If TypeScript shows errors about this endpoint not existing on the router,
  // restart the TS server / dev server first — it's a known stale-cache issue.
  enhance: protectedProcedure
    .input(z.object({
      prompt: z.string().min(1).max(2000),
    }))
    .mutation(async ({ ctx, input }) => {
      // Rate limit free Gemini calls to protect API quota
      const rateCheck = checkRateLimit(`user:${ctx.user.id}`, RATE_LIMITS.geminiAssist);
      if (!rateCheck.allowed) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: rateLimitError(rateCheck.resetIn),
        });
      }
      try {
        const enhanced = await enhanceUserPrompt(input.prompt);
        return {
          success: true,
          enhancedPrompt: enhanced,
        };
      } catch (error) {
        log.error({ err: error }, "[Enhance] Error:");
        return {
          success: true,
          enhancedPrompt: input.prompt,
        };
      }
    }),

  // ============================================================================
  // Phase 2 Migration: New procedures
  // ============================================================================

  // Generate quick variation suggestions for the current model
  // No credits charged — suggestions are a non-critical UX enhancement
  suggestions: protectedProcedure
    .input(z.object({
      masterPrompt: z.string().min(1),
      imageBase64: z.string().max(10_000_000).optional(),
      activeView: z.string().optional(),
      profileSummary: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Rate limit free Gemini calls to protect API quota
      const rateCheck = checkRateLimit(`user:${ctx.user.id}`, RATE_LIMITS.geminiAssist);
      if (!rateCheck.allowed) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: rateLimitError(rateCheck.resetIn),
        });
      }
      try {
        const suggestions = await generateCastingSuggestions(
          input.masterPrompt,
          input.imageBase64,
          input.activeView,
          input.profileSummary
        );
        return { success: true, suggestions };
      } catch (error) {
        log.error({ err: error }, "[Suggestions] Error:");
        return {
          success: true,
          suggestions: [
            "Slightly narrower jawline",
            "Add subtle under-eye shadows",
            "Warmer skin undertone",
            "More prominent cheekbones",
            "Thicker, bushier eyebrows",
            "Add a beauty mark on cheek",
          ],
        };
      }
    }),

  // Analyze a reference image for transferable attributes
  // No credits charged — analysis is a UX feature
  analyzeReference: protectedProcedure
    .input(z.object({
      referenceImageBase64: z.string().min(1).max(10_000_000),
      currentModelImageBase64: z.string().max(10_000_000).optional(),
      masterPrompt: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Rate limit free Gemini calls to protect API quota
      const rateCheck = checkRateLimit(`user:${ctx.user.id}`, RATE_LIMITS.geminiAssist);
      if (!rateCheck.allowed) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: rateLimitError(rateCheck.resetIn),
        });
      }
      try {
        const attributes = await analyzeReferenceForTransfer(
          input.referenceImageBase64,
          input.currentModelImageBase64,
          input.masterPrompt
        );
        return { success: true, attributes };
      } catch (error) {
        log.error({ err: error }, "[AnalyzeReference] Error:");
        return { success: true, attributes: [] };
      }
    }),

  // Visual reconciliation — correct schema/description to match actual image
  // No credits charged — this is data correction, not generation
  reconcile: protectedProcedure
    .input(z.object({
      modelId: z.number(),
      imageBase64: z.string().min(1).max(10_000_000),
    }))
    .mutation(async ({ ctx, input }) => {
      // Rate limit free Gemini calls to protect API quota
      const rateCheck = checkRateLimit(`user:${ctx.user.id}`, RATE_LIMITS.geminiAssist);
      if (!rateCheck.allowed) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: rateLimitError(rateCheck.resetIn),
        });
      }
      const model = await getModelById(input.modelId);
      if (!model) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Model not found" });
      }
      if (model.userId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }

      const currentSchema = model.technicalSchema || {};
      const currentPrompt = model.masterPrompt || "";

      try {
        const { schema, description } = await reconcileSchemaWithImage(
          currentSchema,
          input.imageBase64,
          currentPrompt
        );

        await updateModel(input.modelId, {
          masterPrompt: description,
          technicalSchema: schema,
        });

        return {
          success: true,
          schema,
          description,
        };
      } catch (error) {
        log.error({ err: error }, "[Reconcile] Error:");
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to reconcile schema",
        });
      }
    }),

  // Compact a bloated master prompt into a clean single paragraph
  // No credits charged — this is prompt maintenance
  compactPrompt: protectedProcedure
    .input(z.object({
      modelId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Rate limit free Gemini calls to protect API quota
      const rateCheck = checkRateLimit(`user:${ctx.user.id}`, RATE_LIMITS.geminiAssist);
      if (!rateCheck.allowed) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: rateLimitError(rateCheck.resetIn),
        });
      }
      const model = await getModelById(input.modelId);
      if (!model) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Model not found" });
      }
      if (model.userId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }

      const currentPrompt = model.masterPrompt || "";
      const currentSchema = model.technicalSchema || {};

      try {
        const compacted = await compactMasterPrompt(currentPrompt, currentSchema);

        await updateModel(input.modelId, {
          masterPrompt: compacted,
        });

        return {
          success: true,
          masterPrompt: compacted,
        };
      } catch (error) {
        log.error({ err: error }, "[CompactPrompt] Error:");
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to compact prompt",
        });
      }
    }),

  // Clear the in-memory chat session — resets Gemini conversation state
  // No credits charged — session management
  clearSession: protectedProcedure
    .mutation(async ({ ctx }) => {
      try {
        clearCastingSession(String(ctx.user.id));
        return { success: true };
      } catch (error) {
        log.error({ err: error }, "[ClearSession] Error:");
        return { success: true };
      }
    }),
});
