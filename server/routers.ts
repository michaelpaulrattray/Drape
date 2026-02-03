import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { 
  getUserPoints, getPointTransactions, deductPoints, addPoints, addToWaitlist, getWaitlistCount,
  createModel, getModelById, getUserModels, updateModel, deleteModel,
  createModelAsset, getModelAssets,
  createGeneration, updateGeneration, getUserGenerations,
  updateUserProfile, getUserById, getUserStorageInfo, updateUserStorageUsed,
  deleteModelWithAssetKeys
} from "./db";
import { storagePut, storageDelete } from "./storage";
import {
  generateMasterPrompt, generateCastingImage, generateFullBody, generateRemainingViews,
  iterateModel, enhanceUserPrompt, upscaleImage, POINT_COSTS, ModelPreferences, ImageResolution
} from "./aiService";
import { z } from "zod";
import { TRPCError } from "@trpc/server";

export const appRouter = router({
  system: systemRouter,
  
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  points: router({
    getBalance: protectedProcedure.query(async ({ ctx }) => {
      const userPoints = await getUserPoints(ctx.user.id);
      if (!userPoints) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Points record not found",
        });
      }
      return {
        balance: userPoints.balance,
        planTier: userPoints.planTier,
        planExpiresAt: userPoints.planExpiresAt,
      };
    }),

    getTransactions: protectedProcedure
      .input(z.object({ limit: z.number().min(1).max(100).default(20) }).optional())
      .query(async ({ ctx, input }) => {
        const transactions = await getPointTransactions(ctx.user.id, input?.limit ?? 20);
        return transactions;
      }),

    deduct: protectedProcedure
      .input(z.object({
        amount: z.number().positive(),
        type: z.enum(["generation", "purchase", "bonus", "refund", "signup"]),
        description: z.string(),
        referenceId: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const result = await deductPoints(
          ctx.user.id,
          input.amount,
          input.type,
          input.description,
          input.referenceId
        );
        
        if (!result.success) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: result.error || "Failed to deduct points",
          });
        }
        
        return { success: true, newBalance: result.newBalance };
      }),

    add: protectedProcedure
      .input(z.object({
        amount: z.number().positive(),
        type: z.enum(["generation", "purchase", "bonus", "refund", "signup"]),
        description: z.string(),
        referenceId: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const result = await addPoints(
          ctx.user.id,
          input.amount,
          input.type,
          input.description,
          input.referenceId
        );
        
        if (!result.success) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: result.error || "Failed to add points",
          });
        }
        
        return { success: true, newBalance: result.newBalance };
      }),

    checkBalance: protectedProcedure
      .input(z.object({ required: z.number().positive() }))
      .query(async ({ ctx, input }) => {
        const userPoints = await getUserPoints(ctx.user.id);
        if (!userPoints) {
          return { hasEnough: false, balance: 0, required: input.required };
        }
        return {
          hasEnough: userPoints.balance >= input.required,
          balance: userPoints.balance,
          required: input.required,
        };
      }),
  }),

  waitlist: router({
    // Join the waitlist
    join: publicProcedure
      .input(z.object({
        email: z.string().email("Please enter a valid email address"),
        name: z.string().min(1).optional(),
        company: z.string().optional(),
        role: z.string().optional(),
        source: z.string().optional(),
        referralCode: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const result = await addToWaitlist({
          email: input.email.toLowerCase().trim(),
          name: input.name || null,
          company: input.company || null,
          role: input.role || null,
          source: input.source || "landing_page",
          referralCode: input.referralCode || null,
        });

        if (!result.success && result.error !== "already_registered") {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: result.error || "Failed to join waitlist",
          });
        }

        return {
          success: true,
          position: result.position,
          alreadyRegistered: result.error === "already_registered",
        };
      }),

    // Get waitlist stats (public for social proof)
    getStats: publicProcedure.query(async () => {
      const count = await getWaitlistCount();
      return {
        totalSignups: count,
        // Add some base numbers for social proof
        displayCount: count + 847, // Base number for early traction appearance
      };
    }),
  }),

  // ============ AI Model Generation ============
  models: router({
    // Create a new AI model from preferences
    // Schema matches geminiService.ts ModelPreferences interface exactly
    create: protectedProcedure
      .input(z.object({
        preferences: z.object({
          // Demographics
          gender: z.string().optional(),
          age: z.union([z.number(), z.string()]).optional(),
          ethnicity: z.string().optional(),
          bodyType: z.string().optional(),
          
          // Face structure
          faceShape: z.string().optional(),
          jawline: z.string().optional(),
          cheekbones: z.string().optional(),
          cheeks: z.string().optional(),
          eyeShape: z.string().optional(),
          noseShape: z.string().optional(),
          lipShape: z.string().optional(),
          eyebrowStyle: z.string().optional(),
          
          // Skin
          skinTone: z.string().optional(),
          skinTexture: z.string().optional(),
          skinFinish: z.string().optional(),
          
          // Eyes
          eyeColor: z.string().optional(),
          
          // Hair - complete builder
          hairStyle: z.string().optional(),
          hairColor: z.string().optional(),
          hairLength: z.string().optional(),
          hairTexture: z.string().optional(),
          hairFringe: z.string().optional(),
          hairParting: z.string().optional(),
          hairVolume: z.string().optional(),
          hairFlyaways: z.string().optional(),
          hairHairline: z.string().optional(),
          hairTuck: z.string().optional(),
          hairFade: z.string().optional(),
          facialHair: z.string().optional(),
          
          // Brand & Vibe
          castingBrand: z.string().optional(),
          castingVibe: z.object({
            editorial: z.number(),
            commercial: z.number(),
            runway: z.number(),
          }).optional(),
          
          // Additional
          features: z.string().optional(),
          referenceImage: z.string().optional(),
          previousMasterPrompt: z.string().optional(),
          userPrompt: z.string().optional(),
        }),
        name: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Debug: Log received preferences
        console.log('[models.create] Received preferences:', JSON.stringify(input.preferences, null, 2));
        
        // Generate master prompt (no point cost for this step)
        const masterPrompt = await generateMasterPrompt(input.preferences as ModelPreferences);
        
        // Debug: Log generated master prompt
        console.log('[models.create] Generated master prompt:', masterPrompt.naturalDescription?.substring(0, 500) + '...');

        // Generate a unique agency ID
        const agencyId = `AG-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

        // Save model to database (no point cost for master prompt generation)
        const result = await createModel({
          userId: ctx.user.id,
          agencyId,
          name: input.name || `Model ${agencyId}`,
          masterPrompt: masterPrompt.naturalDescription,
          technicalSchema: masterPrompt.technicalSchema,
          preferences: input.preferences,
          status: "draft",
        });

        if (!result.success) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: result.error || "Failed to create model",
          });
        }

        return {
          success: true,
          modelId: result.modelId,
          agencyId,
          masterPrompt: masterPrompt.naturalDescription,
          technicalSchema: masterPrompt.technicalSchema,
        };
      }),

    // Get user's models
    list: protectedProcedure
      .input(z.object({ limit: z.number().min(1).max(100).default(50) }).optional())
      .query(async ({ ctx, input }) => {
        const models = await getUserModels(ctx.user.id, input?.limit ?? 50);
        return models;
      }),

    // Get a specific model by ID
    get: protectedProcedure
      .input(z.object({ modelId: z.number() }))
      .query(async ({ ctx, input }) => {
        const model = await getModelById(input.modelId);
        if (!model) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Model not found" });
        }
        if (model.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
        }
        const assets = await getModelAssets(input.modelId);
        return { ...model, assets };
      }),

    // Update model name or status
    update: protectedProcedure
      .input(z.object({
        modelId: z.number(),
        name: z.string().optional(),
        status: z.enum(["draft", "active", "archived"]).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const model = await getModelById(input.modelId);
        if (!model) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Model not found" });
        }
        if (model.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
        }

        const updateData: { name?: string; status?: "draft" | "active" | "archived" } = {};
        if (input.name) updateData.name = input.name;
        if (input.status) updateData.status = input.status;

        await updateModel(input.modelId, updateData);
        return { success: true };
      }),

    // Delete a model
    delete: protectedProcedure
      .input(z.object({ modelId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const model = await getModelById(input.modelId);
        if (!model) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Model not found" });
        }
        if (model.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
        }

        await deleteModel(input.modelId);
        return { success: true };
      }),
  }),

  // ============ AI Image Generation ============
  generation: router({
    // Generate casting image (headshot)
    castingImage: protectedProcedure
      .input(z.object({ 
        modelId: z.number(),
        referenceImage: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Check points
        const userPoints = await getUserPoints(ctx.user.id);
        if (!userPoints || userPoints.balance < POINT_COSTS.castingImage) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Insufficient points. Need ${POINT_COSTS.castingImage} points.`,
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
          const result = await generateCastingImage(
            model.masterPrompt,
            {
              castingBrand,
              frame: 'HEADSHOT',
              referenceImage: input.referenceImage,
            }
          );

          if (!result.imageUrl) {
            await updateGeneration(genResult.generationId!, {
              status: "failed",
              errorMessage: "No image generated",
              completedAt: new Date(),
            });
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to generate image",
            });
          }

          // Deduct points
          await deductPoints(
            ctx.user.id,
            POINT_COSTS.castingImage,
            "generation",
            "Casting image generation",
            `gen-${genResult.generationId}`
          );

          // Save asset
          await createModelAsset({
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

    // Generate full body image
    fullBody: protectedProcedure
      .input(z.object({ modelId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const userPoints = await getUserPoints(ctx.user.id);
        if (!userPoints || userPoints.balance < POINT_COSTS.fullBody) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Insufficient points. Need ${POINT_COSTS.fullBody} points.`,
          });
        }

        const model = await getModelById(input.modelId);
        if (!model) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Model not found" });
        }
        if (model.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
        }

        const genResult = await createGeneration({
          userId: ctx.user.id,
          modelId: input.modelId,
          type: "fullBody",
          status: "processing",
          pointsCost: POINT_COSTS.fullBody,
        });

        try {
          // Get existing headshot for reference
          const assets = await getModelAssets(input.modelId);
          const headshot = assets.find(a => a.viewType === "frontClose");

          if (!headshot?.storageUrl) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "No headshot found for full body generation",
            });
          }

          const gender = (model.preferences as any)?.gender || 'female';
          const result = await generateFullBody(
            model.masterPrompt,
            headshot.storageUrl,
            gender
          );

          if (!result.imageUrl) {
            await updateGeneration(genResult.generationId!, {
              status: "failed",
              errorMessage: "No image generated",
              completedAt: new Date(),
            });
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to generate full body image",
            });
          }

          await deductPoints(
            ctx.user.id,
            POINT_COSTS.fullBody,
            "generation",
            "Full body image generation",
            `gen-${genResult.generationId}`
          );

          await createModelAsset({
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

    // Generate side or back view
    multiView: protectedProcedure
      .input(z.object({
        modelId: z.number(),
        viewType: z.enum(["side", "back"]),
      }))
      .mutation(async ({ ctx, input }) => {
        const userPoints = await getUserPoints(ctx.user.id);
        if (!userPoints || userPoints.balance < POINT_COSTS.multiView) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Insufficient points. Need ${POINT_COSTS.multiView} points.`,
          });
        }

        const model = await getModelById(input.modelId);
        if (!model) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Model not found" });
        }
        if (model.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
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
          const assets = await getModelAssets(input.modelId);
          const reference = assets.find(a => a.viewType === "frontClose" || a.viewType === "frontFull");

          if (!reference?.storageUrl) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "No reference image found for multi-view generation",
            });
          }

          const gender = (model.technicalSchema as any)?.subject?.sex || 'female';
          const result = await generateRemainingViews(
            model.masterPrompt,
            reference.storageUrl,
            gender,
            input.viewType
          );

          if (!result.imageUrl) {
            await updateGeneration(genResult.generationId!, {
              status: "failed",
              errorMessage: "No image generated",
              completedAt: new Date(),
            });
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to generate view",
            });
          }

          await deductPoints(
            ctx.user.id,
            POINT_COSTS.multiView,
            "generation",
            `${input.viewType} view generation`,
            `gen-${genResult.generationId}`
          );

          const assetViewType = input.viewType === "side" ? "sideFull" : "backFull";
          await createModelAsset({
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
        const userPoints = await getUserPoints(ctx.user.id);
        if (!userPoints || userPoints.balance < POINT_COSTS.iterate) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Insufficient points. Need ${POINT_COSTS.iterate} points.`,
          });
        }

        const model = await getModelById(input.modelId);
        if (!model) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Model not found" });
        }
        if (model.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
        }

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

          const result = await iterateModel(
            updatedMasterPrompt,
            targetAsset.storageUrl,
            input.feedback,
            {
              castingBrand: (model.technicalSchema as any)?.context?.casting_for,
              frame: targetAsset.viewType === 'frontClose' ? 'HEADSHOT' : 'FULL_BODY',
              maskBase64: input.maskBase64, // Pass mask for surgical edit/eraser
            }
          );

          if (!result.imageUrl) {
            await updateGeneration(genResult.generationId!, {
              status: "failed",
              errorMessage: "No image generated",
              completedAt: new Date(),
            });
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to iterate model",
            });
          }

          await deductPoints(
            ctx.user.id,
            POINT_COSTS.iterate,
            "generation",
            "Model iteration",
            `gen-${genResult.generationId}`
          );

          await createModelAsset({
            modelId: input.modelId,
            viewType: targetAsset.viewType,
            resolution: "1K",
            storageUrl: result.imageUrl,
            pointsCost: POINT_COSTS.iterate,
          });

          // Update model with new master prompt
          await updateModel(input.modelId, {
            masterPrompt: updatedMasterPrompt,
            technicalSchema: updatedSchema,
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
            masterPrompt: updatedMasterPrompt,
            technicalSchema: updatedSchema,
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
        // Check points for upscaling (use iterate cost)
        const userPoints = await getUserPoints(ctx.user.id);
        const upscaleCost = POINT_COSTS.iterate;
        if (!userPoints || userPoints.balance < upscaleCost) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Insufficient points. Need ${upscaleCost} points.`,
          });
        }

        try {
          // Map resolution string to ImageResolution enum
          const resolutionMap: Record<string, ImageResolution> = {
            '1K': ImageResolution.STANDARD,
            '2K': ImageResolution.HIGH,
            '4K': ImageResolution.ULTRA,
          };
          const targetRes = resolutionMap[input.resolution] || ImageResolution.STANDARD;

          const result = await upscaleImage(input.imageUrl, targetRes);

          // Deduct points
          await deductPoints(
            ctx.user.id,
            upscaleCost,
            "generation",
            `Upscale to ${input.resolution}`,
            `upscale-${Date.now()}`
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
  }),

  // ============ User Profile ============
  profile: router({
    // Get current user's full profile
    get: protectedProcedure.query(async ({ ctx }) => {
      const user = await getUserById(ctx.user.id);
      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }
      return {
        id: user.id,
        openId: user.openId,
        name: user.name,
        displayName: user.displayName,
        email: user.email,
        bio: user.bio,
        avatarUrl: user.avatarUrl,
        bannerUrl: user.bannerUrl,
        role: user.role,
        storageUsed: user.storageUsed,
        storageLimit: user.storageLimit,
        createdAt: user.createdAt,
      };
    }),

    // Update profile fields (displayName, bio)
    update: protectedProcedure
      .input(z.object({
        displayName: z.string().max(100).optional(),
        bio: z.string().max(500).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const result = await updateUserProfile(ctx.user.id, {
          displayName: input.displayName,
          bio: input.bio,
        });
        
        if (!result.success) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: result.error || "Failed to update profile",
          });
        }
        
        return { success: true };
      }),

    // Upload avatar image
    uploadAvatar: protectedProcedure
      .input(z.object({
        base64Data: z.string(),
        mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
        fileSize: z.number().max(5 * 1024 * 1024, "File size must be under 5MB"),
      }))
      .mutation(async ({ ctx, input }) => {
        // Check storage limit
        const storageInfo = await getUserStorageInfo(ctx.user.id);
        if (storageInfo && storageInfo.used + input.fileSize > storageInfo.limit) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Storage limit exceeded. Please delete some files or upgrade your plan.",
          });
        }

        // Get current user to check for existing avatar
        const user = await getUserById(ctx.user.id);
        const oldAvatarKey = user?.avatarKey;

        // Generate unique key
        const ext = input.mimeType.split("/")[1];
        const key = `avatars/${ctx.user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        
        // Convert base64 to buffer
        const buffer = Buffer.from(input.base64Data, "base64");
        
        // Upload to S3
        const { url } = await storagePut(key, buffer, input.mimeType);
        
        // Update user profile with new avatar
        await updateUserProfile(ctx.user.id, {
          avatarUrl: url,
          avatarKey: key,
        });

        // Update storage used
        await updateUserStorageUsed(ctx.user.id, input.fileSize);

        // Delete old avatar from S3 if exists
        if (oldAvatarKey) {
          try {
            await storageDelete(oldAvatarKey);
            // Subtract old file size (estimate ~100KB for avatars)
            await updateUserStorageUsed(ctx.user.id, -100 * 1024);
          } catch (e) {
            console.warn("Failed to delete old avatar:", e);
          }
        }

        return { success: true, avatarUrl: url };
      }),

    // Upload banner image
    uploadBanner: protectedProcedure
      .input(z.object({
        base64Data: z.string(),
        mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
        fileSize: z.number().max(10 * 1024 * 1024, "File size must be under 10MB"),
      }))
      .mutation(async ({ ctx, input }) => {
        // Check storage limit
        const storageInfo = await getUserStorageInfo(ctx.user.id);
        if (storageInfo && storageInfo.used + input.fileSize > storageInfo.limit) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Storage limit exceeded. Please delete some files or upgrade your plan.",
          });
        }

        // Get current user to check for existing banner
        const user = await getUserById(ctx.user.id);
        const oldBannerKey = user?.bannerKey;

        // Generate unique key
        const ext = input.mimeType.split("/")[1];
        const key = `banners/${ctx.user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        
        // Convert base64 to buffer
        const buffer = Buffer.from(input.base64Data, "base64");
        
        // Upload to S3
        const { url } = await storagePut(key, buffer, input.mimeType);
        
        // Update user profile with new banner
        await updateUserProfile(ctx.user.id, {
          bannerUrl: url,
          bannerKey: key,
        });

        // Update storage used
        await updateUserStorageUsed(ctx.user.id, input.fileSize);

        // Delete old banner from S3 if exists
        if (oldBannerKey) {
          try {
            await storageDelete(oldBannerKey);
            // Subtract old file size (estimate ~500KB for banners)
            await updateUserStorageUsed(ctx.user.id, -500 * 1024);
          } catch (e) {
            console.warn("Failed to delete old banner:", e);
          }
        }

        return { success: true, bannerUrl: url };
      }),

    // Get storage usage info
    storageInfo: protectedProcedure.query(async ({ ctx }) => {
      const info = await getUserStorageInfo(ctx.user.id);
      if (!info) {
        return { used: 0, limit: 500 * 1024 * 1024, percentage: 0 };
      }
      return {
        used: info.used,
        limit: info.limit,
        percentage: Math.round((info.used / info.limit) * 100),
      };
    }),
  }),
});

export type AppRouter = typeof appRouter;
