import { protectedProcedure, router } from "../../_core/trpc";
import {
  getModelById, createModelAsset, getModelAssets,
  createGeneration, updateGeneration, updateModel,
} from "../../db";
import {
  generateMasterPrompt, iterateModel, enhanceUserPrompt, upscaleImage,
  POINT_COSTS, ImageResolution,
} from "../../casting/aiService";
import { withAtomicCredits } from "../../casting/atomicCredits";
import { z } from "zod";
import { TRPCError } from "@trpc/server";

export const castingRefinementRouter = router({
  // Iterate/refine a model image
  iterate: protectedProcedure
    .input(z.object({
      modelId: z.number(),
      feedback: z.string().min(1),
      assetId: z.number(),
      maskBase64: z.string().optional(), // Base64 encoded mask image for surgical edit/eraser
    }))
    .mutation(async ({ ctx, input }) => {
      // Validate model ownership first (cheap operation)
      const model = await getModelById(input.modelId);
      if (!model) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Model not found" });
      }
      if (model.userId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }

      // Validate asset exists (cheap operation)
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
        // ATOMIC CREDITS: Deduct before generation, refund on failure
        const result = await withAtomicCredits(
          {
            userId: ctx.user.id,
            amount: POINT_COSTS.iterate,
            description: "Model iteration",
            referenceId: `gen-${genResult.generationId}`,
          },
          async () => {
            // Regenerate master prompt with iteration feedback
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

        // Update model with new master prompt
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
      const upscaleCost = POINT_COSTS.iterate;
      const referenceId = `upscale-${Date.now()}`;

      try {
        // ATOMIC CREDITS: Deduct before upscale, refund on failure
        const result = await withAtomicCredits(
          {
            userId: ctx.user.id,
            amount: upscaleCost,
            description: `Upscale to ${input.resolution}`,
            referenceId,
          },
          async () => {
            // Map resolution string to ImageResolution enum
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
        console.error("[Upscale] Error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to upscale image",
        });
      }
    }),

  // Proxy endpoint to fetch S3 images and return as base64 (bypasses CORS)
  proxyImage: protectedProcedure
    .input(z.object({
      imageUrl: z.string().url(),
    }))
    .mutation(async ({ input }) => {
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
        console.error('[ProxyImage] Error:', error);
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
    .mutation(async ({ input }) => {
      try {
        const enhanced = await enhanceUserPrompt(input.prompt);
        return {
          success: true,
          enhancedPrompt: enhanced,
        };
      } catch (error) {
        console.error("[Enhance] Error:", error);
        // Return original prompt on error
        return {
          success: true,
          enhancedPrompt: input.prompt,
        };
      }
    }),
});
