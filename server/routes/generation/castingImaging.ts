import { protectedProcedure, router } from "../../_core/trpc";
import {
  getModelById, createModelAsset,
  createGeneration, updateGeneration,
} from "../../db";
import { deductPoints, addCredits } from "../../db";
import {
  generateCastingImage,
  POINT_COSTS,
} from "../../casting/aiService";
import { enforceDailyQuota } from "../../db/dailyQuota";
import { checkRateLimit, RATE_LIMITS, rateLimitError } from "../../security/rateLimit";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { buildEthnicityHint, buildReinforcedPrompt } from "../../casting/promptReinforcement";
import { createModuleLogger } from "../../logging/logger";
const log = createModuleLogger("routes/generation");

export const castingImagingRouter = router({
  // Generate casting image (headshot)
  castingImage: protectedProcedure
    .input(z.object({
      modelId: z.number(),
      referenceImage: z.string().max(10_000_000).optional(),
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
        const prefs = (model.preferences || {}) as any;
        const ethnicityHint = buildEthnicityHint(prefs);
        const reinforcedPrompt = buildReinforcedPrompt(model.masterPrompt, prefs);
        log.info({ castingBrand, modelId: input.modelId, ethnicityHint, hasOverrides: reinforcedPrompt !== model.masterPrompt }, '[castingImage] Generating with brand');

        const result = await generateCastingImage(
          reinforcedPrompt,
          {
            castingBrand,
            frame: 'HEADSHOT',
            referenceImage: input.referenceImage,
            ethnicityHint,
            userId: String(ctx.user.id),
          }
        );

        log.info({ hasImageUrl: !!result.imageUrl, engineUsed: result.engineUsed }, '[castingImage] Generation result');

        if (!result.imageUrl) {
          log.error('[castingImage] No image URL returned from generation');
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

        // Model stays as 'draft' until explicit export/mint
        // (previously auto-set to 'active' here, causing drafts to appear in MY MODELS)

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

  // NOTE (stage-lock unification, D-46): the `fullBody` and `multiView`
  // procedures were REMOVED here. They generated body/side/walk/back views
  // with NO identity gate — an ungated write path of the exact class D-43
  // closed (a raw tRPC caller could add an unverified back or walk view to a
  // minted identity). All view generation now flows through `mintPackage`
  // (server/casting/mintPackage.ts), which gates back/walk and prices per
  // slot. There is no ungated view endpoint. Do not reintroduce one.

});
