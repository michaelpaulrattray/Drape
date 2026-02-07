import { protectedProcedure, router } from "../../_core/trpc";
import {
  getModelById, createModelAsset, getModelAssets,
  createGeneration, updateGeneration, updateModel,
} from "../../db";
import { deductPoints, addCredits } from "../../db";
import {
  generateCastingImage, generateFullBody, generateRemainingViews,
  POINT_COSTS,
} from "../../aiService";
import { withAtomicCredits } from "../../atomicCredits";
import { checkRateLimit, RATE_LIMITS, rateLimitError } from "../../rateLimit";
import { z } from "zod";
import { TRPCError } from "@trpc/server";

export const castingImagingRouter = router({
  // Generate casting image (headshot)
  castingImage: protectedProcedure
    .input(z.object({
      modelId: z.number(),
      referenceImage: z.string().optional(),
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

      // ATOMIC credit deduction BEFORE generation to prevent race conditions
      // Credits are deducted first, then refunded if generation fails
      const deductResult = await deductPoints(
        ctx.user.id,
        POINT_COSTS.castingImage,
        "generation",
        "Casting image generation (pending)",
        `pending-${Date.now()}`
      );

      if (!deductResult.success) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: deductResult.error || `Insufficient credits. Need ${POINT_COSTS.castingImage} credits.`,
        });
      }

      // Get model
      const model = await getModelById(input.modelId);
      if (!model) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Model not found" });
      }
      if (model.userId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }

      // Create generation record
      const genResult = await createGeneration({
        userId: ctx.user.id,
        modelId: input.modelId,
        type: "castingImage",
        status: "processing",
        pointsCost: POINT_COSTS.castingImage,
      });

      try {
        // Generate image
        const castingBrand = (model.technicalSchema as any)?.context?.casting_for || 'Generic';
        console.log('[castingImage] Generating with brand:', castingBrand, 'for model:', input.modelId);

        const result = await generateCastingImage(
          model.masterPrompt,
          {
            castingBrand,
            frame: 'HEADSHOT',
            referenceImage: input.referenceImage,
          }
        );

        console.log('[castingImage] Generation result:', { hasImageUrl: !!result.imageUrl, engineUsed: result.engineUsed });

        if (!result.imageUrl) {
          console.error('[castingImage] No image URL returned from generation');
          await updateGeneration(genResult.generationId!, {
            status: "failed",
            errorMessage: "No image generated",
            completedAt: new Date(),
          });
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "No image generated",
          });
        }

        // Credits already deducted before generation - no need to deduct again

        // Save asset
        const assetResult = await createModelAsset({
          modelId: input.modelId,
          viewType: "frontClose",
          resolution: "1K",
          storageUrl: result.imageUrl,
          pointsCost: POINT_COSTS.castingImage,
        });

        // Update generation record
        await updateGeneration(genResult.generationId!, {
          status: "completed",
          resultUrl: result.imageUrl,
          completedAt: new Date(),
        });

        // Update model status to active
        await updateModel(input.modelId, { status: "active" });

        return {
          success: true,
          imageUrl: result.imageUrl,
          pointsCost: POINT_COSTS.castingImage,
          assetId: assetResult.assetId,
        };
      } catch (error) {
        // Refund credits on failure
        await addCredits(
          ctx.user.id,
          POINT_COSTS.castingImage,
          "refund",
          "Refund for failed casting image generation",
          `refund-${genResult.generationId}`
        );

        await updateGeneration(genResult.generationId!, {
          status: "failed",
          errorMessage: error instanceof Error ? error.message : "Unknown error",
          completedAt: new Date(),
        });
        throw error;
      }
    }),

  // Generate full body image
  fullBody: protectedProcedure
    .input(z.object({ modelId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      // Validate model ownership first (cheap operation)
      const model = await getModelById(input.modelId);
      if (!model) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Model not found" });
      }
      if (model.userId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }

      // Get existing headshot for reference (cheap operation)
      const assets = await getModelAssets(input.modelId);
      const headshot = assets.find(a => a.viewType === "frontClose");
      if (!headshot?.storageUrl) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No headshot found for full body generation",
        });
      }

      const genResult = await createGeneration({
        userId: ctx.user.id,
        modelId: input.modelId,
        type: "fullBody",
        status: "processing",
        pointsCost: POINT_COSTS.fullBody,
      });

      try {
        // ATOMIC CREDITS: Deduct before generation, refund on failure
        const result = await withAtomicCredits(
          {
            userId: ctx.user.id,
            amount: POINT_COSTS.fullBody,
            description: "Full body image generation",
            referenceId: `gen-${genResult.generationId}`,
          },
          async () => {
            const gender = (model.preferences as any)?.gender || 'female';
            const genResult = await generateFullBody(
              model.masterPrompt,
              headshot.storageUrl,
              gender
            );

            if (!genResult.imageUrl) {
              throw new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to generate full body image",
              });
            }

            return genResult;
          }
        );

        const assetResult = await createModelAsset({
          modelId: input.modelId,
          viewType: "frontFull",
          resolution: "1K",
          storageUrl: result.imageUrl,
          pointsCost: POINT_COSTS.fullBody,
        });

        await updateGeneration(genResult.generationId!, {
          status: "completed",
          resultUrl: result.imageUrl,
          completedAt: new Date(),
        });

        return {
          success: true,
          imageUrl: result.imageUrl,
          pointsCost: POINT_COSTS.fullBody,
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

  // Generate side, back, or walk view
  multiView: protectedProcedure
    .input(z.object({
      modelId: z.number(),
      viewType: z.enum(["side", "back", "walk"]),
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

      // Get reference image (cheap operation)
      const assets = await getModelAssets(input.modelId);
      const reference = assets.find(a => a.viewType === "frontClose" || a.viewType === "frontFull");
      if (!reference?.storageUrl) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No reference image found for multi-view generation",
        });
      }

      const genResult = await createGeneration({
        userId: ctx.user.id,
        modelId: input.modelId,
        type: "multiView",
        status: "processing",
        pointsCost: POINT_COSTS.multiView,
        metadata: { viewType: input.viewType },
      });

      try {
        // ATOMIC CREDITS: Deduct before generation, refund on failure
        const result = await withAtomicCredits(
          {
            userId: ctx.user.id,
            amount: POINT_COSTS.multiView,
            description: `${input.viewType} view generation`,
            referenceId: `gen-${genResult.generationId}`,
          },
          async () => {
            const gender = (model.technicalSchema as any)?.subject?.sex || 'female';
            const genResult = await generateRemainingViews(
              model.masterPrompt,
              reference.storageUrl,
              gender,
              input.viewType
            );

            if (!genResult.imageUrl) {
              throw new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to generate view",
              });
            }

            return genResult;
          }
        );

        const assetViewType = input.viewType === "side" ? "sideClose" : input.viewType === "walk" ? "sideFull" : "backFull";
        const assetResult = await createModelAsset({
          modelId: input.modelId,
          viewType: assetViewType,
          resolution: "1K",
          storageUrl: result.imageUrl,
          pointsCost: POINT_COSTS.multiView,
        });

        await updateGeneration(genResult.generationId!, {
          status: "completed",
          resultUrl: result.imageUrl,
          completedAt: new Date(),
        });

        return {
          success: true,
          imageUrl: result.imageUrl,
          pointsCost: POINT_COSTS.multiView,
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

  // Generate all remaining views (side, walk, back) at once - matches original app behavior
  generateAllViews: protectedProcedure
    .input(z.object({
      modelId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const totalCost = POINT_COSTS.multiView * 3; // 3 views

      // Validate model ownership first (cheap operation)
      const model = await getModelById(input.modelId);
      if (!model) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Model not found" });
      }
      if (model.userId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }

      // Get reference image (cheap operation)
      const assets = await getModelAssets(input.modelId);
      const reference = assets.find(a => a.viewType === "frontFull" || a.viewType === "frontClose");
      if (!reference?.storageUrl) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No reference image found for multi-view generation",
        });
      }

      const genResult = await createGeneration({
        userId: ctx.user.id,
        modelId: input.modelId,
        type: "multiView",
        status: "processing",
        pointsCost: totalCost,
        metadata: { viewType: "all" },
      });

      try {
        // ATOMIC CREDITS: Deduct before generation, refund on failure
        const results = await withAtomicCredits(
          {
            userId: ctx.user.id,
            amount: totalCost,
            description: "All views generation (side, walk, back)",
            referenceId: `gen-${genResult.generationId}`,
          },
          async () => {
            const gender = (model.technicalSchema as any)?.subject?.sex || 'female';

            // Generate all 3 views in parallel
            const [sideResult, walkResult, backResult] = await Promise.all([
              generateRemainingViews(model.masterPrompt, reference.storageUrl, gender, 'side'),
              generateRemainingViews(model.masterPrompt, reference.storageUrl, gender, 'walk'),
              generateRemainingViews(model.masterPrompt, reference.storageUrl, gender, 'back'),
            ]);

            return { sideResult, walkResult, backResult };
          }
        );

        // Create assets for all 3 views
        const [sideAsset, walkAsset, backAsset] = await Promise.all([
          createModelAsset({
            modelId: input.modelId,
            viewType: "sideClose",
            resolution: "1K",
            storageUrl: results.sideResult.imageUrl,
            pointsCost: POINT_COSTS.multiView,
          }),
          createModelAsset({
            modelId: input.modelId,
            viewType: "sideFull",
            resolution: "1K",
            storageUrl: results.walkResult.imageUrl,
            pointsCost: POINT_COSTS.multiView,
          }),
          createModelAsset({
            modelId: input.modelId,
            viewType: "backFull",
            resolution: "1K",
            storageUrl: results.backResult.imageUrl,
            pointsCost: POINT_COSTS.multiView,
          }),
        ]);

        await updateGeneration(genResult.generationId!, {
          status: "completed",
          completedAt: new Date(),
        });

        return {
          success: true,
          views: {
            sideClose: { imageUrl: results.sideResult.imageUrl, assetId: sideAsset.assetId },
            sideFull: { imageUrl: results.walkResult.imageUrl, assetId: walkAsset.assetId },
            backFull: { imageUrl: results.backResult.imageUrl, assetId: backAsset.assetId },
          },
          pointsCost: totalCost,
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
});
