import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import {
  getModelById, updateModel, mintModel,
  createModelAsset, getModelAssets,
  createGeneration, updateGeneration, getUserGenerations,
  getUserById,
} from "../db";
import {
  // Legacy aliases
  deductPoints, addCredits,
} from "../db";
import {
  generateMasterPrompt, generateCastingImage, generateFullBody, generateRemainingViews,
  iterateModel, enhanceUserPrompt, upscaleImage, POINT_COSTS, ModelPreferences, ImageResolution,
} from "../aiService";
import { withAtomicCredits } from "../atomicCredits";
import { generatePremiumIdentityPdf, PdfModelData } from "../pdfService";
import { checkRateLimit, RATE_LIMITS, rateLimitError } from "../rateLimit";
import { z } from "zod";
import { TRPCError } from "@trpc/server";

export const generationRouter = router({
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

  // Get generation history
  history: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(50) }).optional())
    .query(async ({ ctx, input }) => {
      const generations = await getUserGenerations(ctx.user.id, input?.limit ?? 50);
      return generations;
    }),

  // Get point costs for all generation types
  costs: publicProcedure.query(() => POINT_COSTS),

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

  // Generate premium identity PDF document
  generatePdf: protectedProcedure
    .input(z.object({
      modelId: z.number(),
      modelName: z.string(),
      images: z.object({
        headshot: z.string().optional(),
        fullBody: z.string().optional(),
        profile: z.string().optional(),
        walk: z.string().optional(),
        back: z.string().optional(),
      }),
    }))
    .mutation(async ({ ctx, input }) => {
      // Get the model
      const model = await getModelById(input.modelId);
      if (!model) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Model not found" });
      }
      if (model.userId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }

      // Get user info for owner details
      const user = await getUserById(ctx.user.id);
      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      // Extract preferences from technical schema
      const techSchema = model.technicalSchema as any || {};
      const prefs = {
        gender: techSchema.subject?.gender,
        age: techSchema.subject?.age,
        ethnicity: techSchema.subject?.ethnicity,
        bodyType: techSchema.subject?.body_type,
        skinTone: techSchema.subject?.skin_tone || techSchema.skin?.tone,
        skinTexture: techSchema.skin?.texture,
        skinFinish: techSchema.skin?.finish,
        eyeColor: techSchema.subject?.eye_color,
        hairColor: techSchema.subject?.hair_color,
        hairStyle: techSchema.subject?.hair_style || techSchema.hair?.style,
        hairLength: techSchema.subject?.hair_length,
        hairTexture: techSchema.hair?.texture,
        hairVolume: techSchema.hair?.volume,
        hairFringe: techSchema.hair?.fringe,
        hairParting: techSchema.hair?.parting,
        hairFlyaways: techSchema.hair?.flyaways,
        faceShape: techSchema.face?.shape,
        jawline: techSchema.face?.jawline,
        cheekbones: techSchema.face?.cheekbones,
        cheeks: techSchema.face?.cheeks,
        eyeShape: techSchema.face?.eye_shape,
        noseShape: techSchema.face?.nose_shape,
        lipShape: techSchema.face?.lip_shape,
        eyebrowStyle: techSchema.face?.eyebrow_style,
        castingBrand: techSchema.context?.casting_for,
        castingVibe: techSchema.context?.vibe_blend,
      };

      // Prepare PDF data
      const pdfData: PdfModelData = {
        modelName: input.modelName || model.name || 'Unnamed Model',
        agencyId: model.agencyId || `MOD-${new Date().getFullYear().toString().slice(-2)}-DRAFT`,
        sessionId: `SES-${model.id}`,
        createdAt: model.createdAt?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
        mintedAt: model.mintedAt?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
        ownerName: user.displayName || user.name || 'Unknown',
        ownerId: user.openId,
        masterPrompt: model.masterPrompt || 'No master prompt available',
        preferences: prefs,
        images: input.images,
      };

      // Generate PDF
      const pdfBuffer = await generatePremiumIdentityPdf(pdfData);
      
      // Convert to base64 for transfer
      const base64Pdf = Buffer.from(pdfBuffer).toString('base64');
      
      return {
        success: true,
        pdfBase64: base64Pdf,
        filename: `IDENTITY_${model.agencyId || 'DRAFT'}.pdf`,
      };
    }),

  // Mint model on export - assigns agencyId and locks identity
  mint: protectedProcedure
    .input(z.object({
      modelId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Get the model
      const model = await getModelById(input.modelId);
      if (!model) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Model not found" });
      }
      if (model.userId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }

      // Check if already minted
      if (model.agencyId) {
        return {
          success: true,
          agencyId: model.agencyId,
          alreadyMinted: true,
        };
      }

      // Generate unique agency ID (MOD-YY-XXXXXX format)
      const chars = '0123456789ABCDEF';
      let hash = '';
      for (let i = 0; i < 6; i++) {
        hash += chars[Math.floor(Math.random() * 16)];
      }
      const agencyId = `MOD-${new Date().getFullYear().toString().slice(-2)}-${hash}`;

      // Mint the model
      const result = await mintModel(input.modelId, agencyId);
      if (!result.success) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: result.error || "Failed to mint model",
        });
      }

      console.log(`[Mint] Model ${input.modelId} minted with agencyId: ${agencyId}`);

      return {
        success: true,
        agencyId,
        alreadyMinted: false,
      };
    }),
});
