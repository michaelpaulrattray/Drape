import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { 
  getUserCredits, getCreditTransactions, deductCredits, addCredits,
  // Legacy aliases
  getUserPoints, getPointTransactions, deductPoints, addPoints,
  addToWaitlist, getWaitlistCount,
  createModel, getModelById, getUserModels, updateModel, deleteModel, mintModel,
  createModelAsset, getModelAssets,
  createGeneration, updateGeneration, getUserGenerations,
  updateUserProfile, getUserById, getUserStorageInfo, updateUserStorageUsed,
  deleteModelWithAssetKeys, getModelByAgencyId,
  // Billing functions
  updateUserSubscription, getSubscriptionByUserId, refreshMonthlyCredits, addTopupCredits
} from "./db";
import {
  getOrCreateStripeCustomer,
  createSubscriptionCheckoutSession,
  createTopupCheckoutSession,
  createCustomerPortalSession,
  getSubscriptionDetails,
  cancelSubscription,
  reactivateSubscription,
  calculateRolloverCredits,
  getMonthlyCredits,
  calculateProration,
  updateSubscriptionPlan,
  calculateCreditAdjustment,
} from "./stripeService";
import { SUBSCRIPTION_PRODUCTS, CREDIT_TOPUP_PRODUCTS, SubscriptionPlan, CreditTopupPackage } from "./stripeProducts";
import { PLAN_TIERS } from "../drizzle/schema";
import { storagePut, storageDelete } from "./storage";
import {
  generateMasterPrompt, generateCastingImage, generateFullBody, generateRemainingViews,
  iterateModel, enhanceUserPrompt, upscaleImage, CREDIT_COSTS, POINT_COSTS, calculateCreditCost, ModelPreferences, ImageResolution
} from "./aiService";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { generatePremiumIdentityPdf, PdfModelData } from "./pdfService";

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

  // Credits system (aliased as 'points' for backward compatibility)
  credits: router({
    getBalance: protectedProcedure.query(async ({ ctx }) => {
      const userCredits = await getUserCredits(ctx.user.id);
      if (!userCredits) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Credits record not found",
        });
      }
      return {
        balance: userCredits.balance,
        planTier: userCredits.planTier,
        planExpiresAt: userCredits.planExpiresAt,
        creditsPurchased: userCredits.creditsPurchased,
        creditsUsed: userCredits.creditsUsed,
        rolloverCredits: userCredits.rolloverCredits,
      };
    }),

    getTransactions: protectedProcedure
      .input(z.object({ limit: z.number().min(1).max(100).default(20) }).optional())
      .query(async ({ ctx, input }) => {
        const transactions = await getCreditTransactions(ctx.user.id, input?.limit ?? 20);
        return transactions;
      }),

    deduct: protectedProcedure
      .input(z.object({
        amount: z.number().positive(),
        type: z.enum(["generation", "purchase", "bonus", "refund", "signup", "topup", "subscription"]),
        description: z.string(),
        referenceId: z.string().optional(),
        engineUsed: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const result = await deductCredits(
          ctx.user.id,
          input.amount,
          input.type,
          input.description,
          input.referenceId,
          input.engineUsed
        );
        
        if (!result.success) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: result.error || "Failed to deduct credits",
          });
        }
        
        return { success: true, newBalance: result.newBalance };
      }),

    add: protectedProcedure
      .input(z.object({
        amount: z.number().positive(),
        type: z.enum(["generation", "purchase", "bonus", "refund", "signup", "topup", "subscription"]),
        description: z.string(),
        referenceId: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const result = await addCredits(
          ctx.user.id,
          input.amount,
          input.type,
          input.description,
          input.referenceId
        );
        
        if (!result.success) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: result.error || "Failed to add credits",
          });
        }
        
        return { success: true, newBalance: result.newBalance };
      }),

    checkBalance: protectedProcedure
      .input(z.object({ required: z.number().positive() }))
      .query(async ({ ctx, input }) => {
        const userCredits = await getUserCredits(ctx.user.id);
        if (!userCredits) {
          return { hasEnough: false, balance: 0, required: input.required };
        }
        return {
          hasEnough: userCredits.balance >= input.required,
          balance: userCredits.balance,
          required: input.required,
        };
      }),
      
    // Get credit costs for UI display
    getCosts: publicProcedure.query(() => {
      return CREDIT_COSTS;
    }),
  }),
  
  // Legacy alias for backward compatibility
  points: router({
    getBalance: protectedProcedure.query(async ({ ctx }) => {
      const userCredits = await getUserCredits(ctx.user.id);
      if (!userCredits) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Credits record not found",
        });
      }
      return {
        balance: userCredits.balance,
        planTier: userCredits.planTier,
        planExpiresAt: userCredits.planExpiresAt,
      };
    }),
    getTransactions: protectedProcedure
      .input(z.object({ limit: z.number().min(1).max(100).default(20) }).optional())
      .query(async ({ ctx, input }) => {
        return await getCreditTransactions(ctx.user.id, input?.limit ?? 20);
      }),
    checkBalance: protectedProcedure
      .input(z.object({ required: z.number().positive() }))
      .query(async ({ ctx, input }) => {
        const userCredits = await getUserCredits(ctx.user.id);
        if (!userCredits) {
          return { hasEnough: false, balance: 0, required: input.required };
        }
        return {
          hasEnough: userCredits.balance >= input.required,
          balance: userCredits.balance,
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

        // Save model to database as draft (no agencyId until export/minting)
        // agencyId will be assigned when user exports the model (minting)
        const result = await createModel({
          userId: ctx.user.id,
          // agencyId is null for drafts - will be minted on export
          name: input.name || `Draft Model`,
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
          agencyId: null, // Not minted yet - will be assigned on export
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

          // Deduct points
          await deductPoints(
            ctx.user.id,
            POINT_COSTS.castingImage,
            "generation",
            "Casting image generation",
            `gen-${genResult.generationId}`
          );

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
        const userPoints = await getUserPoints(ctx.user.id);
        if (!userPoints || userPoints.balance < totalCost) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Insufficient points. Need ${totalCost} points for all views.`,
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
          pointsCost: totalCost,
          metadata: { viewType: "all" },
        });

        try {
          const assets = await getModelAssets(input.modelId);
          const reference = assets.find(a => a.viewType === "frontFull" || a.viewType === "frontClose");

          if (!reference?.storageUrl) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "No reference image found for multi-view generation",
            });
          }

          const gender = (model.technicalSchema as any)?.subject?.sex || 'female';
          
          // Generate all 3 views in parallel
          const [sideResult, walkResult, backResult] = await Promise.all([
            generateRemainingViews(model.masterPrompt, reference.storageUrl, gender, 'side'),
            generateRemainingViews(model.masterPrompt, reference.storageUrl, gender, 'walk'),
            generateRemainingViews(model.masterPrompt, reference.storageUrl, gender, 'back'),
          ]);

          // Deduct points for all 3 views
          await deductPoints(
            ctx.user.id,
            totalCost,
            "generation",
            "All views generation (side, walk, back)",
            `gen-${genResult.generationId}`
          );

          // Create assets for all 3 views
          const [sideAsset, walkAsset, backAsset] = await Promise.all([
            createModelAsset({
              modelId: input.modelId,
              viewType: "sideClose",
              resolution: "1K",
              storageUrl: sideResult.imageUrl,
              pointsCost: POINT_COSTS.multiView,
            }),
            createModelAsset({
              modelId: input.modelId,
              viewType: "sideFull",
              resolution: "1K",
              storageUrl: walkResult.imageUrl,
              pointsCost: POINT_COSTS.multiView,
            }),
            createModelAsset({
              modelId: input.modelId,
              viewType: "backFull",
              resolution: "1K",
              storageUrl: backResult.imageUrl,
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
              sideClose: { imageUrl: sideResult.imageUrl, assetId: sideAsset.assetId },
              sideFull: { imageUrl: walkResult.imageUrl, assetId: walkAsset.assetId },
              backFull: { imageUrl: backResult.imageUrl, assetId: backAsset.assetId },
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

          const assetResult = await createModelAsset({
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

  // ============ Model Identity Registry (Cross-App) ============
  // This router provides public endpoints for looking up minted model identities
  // Only models that have been exported (minted) are accessible via these endpoints
  registry: router({
    // Public lookup by agencyId - for cross-app model retrieval
    // Only returns minted (active) models with agencyId assigned
    lookup: publicProcedure
      .input(z.object({
        agencyId: z.string().regex(/^MOD-\d{2}-[A-F0-9]{6}$/, "Invalid Model ID format"),
      }))
      .query(async ({ input }) => {
        const model = await getModelByAgencyId(input.agencyId);
        
        if (!model) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Model not found" });
        }

        // Only return minted models (status = 'active')
        if (model.status !== 'active') {
          throw new TRPCError({ 
            code: "NOT_FOUND", 
            message: "Model not found or not yet minted" 
          });
        }

        // Get associated assets
        const assets = await getModelAssets(model.id);

        // Return public identity bundle (no internal IDs or user info)
        return {
          agencyId: model.agencyId,
          name: model.name,
          masterPrompt: model.masterPrompt,
          technicalSchema: model.technicalSchema,
          preferences: model.preferences,
          mintedAt: model.mintedAt,
          assets: assets.map(a => ({
            viewType: a.viewType,
            resolution: a.resolution,
            storageUrl: a.storageUrl,
          })),
        };
      }),

    // Verify if a model ID exists and is minted
    verify: publicProcedure
      .input(z.object({
        agencyId: z.string(),
      }))
      .query(async ({ input }) => {
        // Validate format first
        const formatValid = /^MOD-\d{2}-[A-F0-9]{6}$/.test(input.agencyId);
        if (!formatValid) {
          return { valid: false, exists: false, minted: false };
        }

        const model = await getModelByAgencyId(input.agencyId);
        
        if (!model) {
          return { valid: true, exists: false, minted: false };
        }

        return {
          valid: true,
          exists: true,
          minted: model.status === 'active',
          mintedAt: model.status === 'active' ? model.mintedAt : null,
        };
      }),
  }),

  // ============ Billing & Subscription ============
  billing: router({
    // Get available pricing plans
    getPlans: publicProcedure.query(() => {
      return {
        subscriptions: Object.entries(SUBSCRIPTION_PRODUCTS).map(([key, plan]) => ({
          id: key as SubscriptionPlan,
          name: plan.name,
          description: plan.description,
          priceInCents: plan.priceInCents,
          credits: plan.credits,
          features: plan.features,
          interval: plan.interval,
        })),
        topups: Object.entries(CREDIT_TOPUP_PRODUCTS).map(([key, pkg]) => ({
          id: key as CreditTopupPackage,
          name: pkg.name,
          description: pkg.description,
          priceInCents: pkg.priceInCents,
          credits: pkg.credits,
        })),
        tiers: PLAN_TIERS,
      };
    }),

    // Get current user's subscription status
    getStatus: protectedProcedure.query(async ({ ctx }) => {
      const subscription = await getSubscriptionByUserId(ctx.user.id);
      if (!subscription) {
        return {
          planTier: "free" as const,
          balance: 0,
          subscriptionStatus: null,
          currentPeriodEnd: null,
          canUpgrade: true,
          canManage: false,
          hasSubscription: false,
        };
      }

      return {
        planTier: subscription.planTier,
        balance: subscription.balance,
        creditsPurchased: subscription.creditsPurchased,
        creditsUsed: subscription.creditsUsed,
        rolloverCredits: subscription.rolloverCredits,
        subscriptionStatus: subscription.subscriptionStatus,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        lastRefreshAt: subscription.lastRefreshAt,
        canUpgrade: subscription.planTier !== "studio" && subscription.planTier !== "enterprise",
        canManage: !!subscription.stripeSubscriptionId,
        stripeCustomerId: subscription.stripeCustomerId,
        hasSubscription: !!subscription.stripeSubscriptionId && subscription.subscriptionStatus === "active",
      };
    }),

    // Create checkout session for subscription
    createSubscriptionCheckout: protectedProcedure
      .input(z.object({
        plan: z.enum(["starter", "pro", "studio"]),
      }))
      .mutation(async ({ ctx, input }) => {
        // Get user info
        const user = await getUserById(ctx.user.id);
        if (!user) {
          throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
        }

        // Get or create Stripe customer
        const subscription = await getSubscriptionByUserId(ctx.user.id);
        const customerId = await getOrCreateStripeCustomer(
          ctx.user.id,
          user.email || `user-${ctx.user.id}@formastudio.app`,
          user.displayName || user.name || undefined,
          subscription?.stripeCustomerId
        );

        // Save customer ID if new
        if (!subscription?.stripeCustomerId) {
          await updateUserSubscription(ctx.user.id, { stripeCustomerId: customerId });
        }

        // Create checkout session
        const baseUrl = process.env.NODE_ENV === "production" 
          ? "https://formastudio.app" 
          : "http://localhost:3000";
        
        const checkoutUrl = await createSubscriptionCheckoutSession(
          customerId,
          input.plan,
          `${baseUrl}/dashboard?billing=success`,
          `${baseUrl}/dashboard?billing=canceled`,
          ctx.user.id
        );

        return { checkoutUrl };
      }),

    // Create checkout session for credit top-up
    createTopupCheckout: protectedProcedure
      .input(z.object({
        packageId: z.enum(["small", "medium", "large", "xl"]),
      }))
      .mutation(async ({ ctx, input }) => {
        // Get user info
        const user = await getUserById(ctx.user.id);
        if (!user) {
          throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
        }

        // Get or create Stripe customer
        const subscription = await getSubscriptionByUserId(ctx.user.id);
        const customerId = await getOrCreateStripeCustomer(
          ctx.user.id,
          user.email || `user-${ctx.user.id}@formastudio.app`,
          user.displayName || user.name || undefined,
          subscription?.stripeCustomerId
        );

        // Save customer ID if new
        if (!subscription?.stripeCustomerId) {
          await updateUserSubscription(ctx.user.id, { stripeCustomerId: customerId });
        }

        // Create checkout session
        const baseUrl = process.env.NODE_ENV === "production" 
          ? "https://formastudio.app" 
          : "http://localhost:3000";
        
        const checkoutUrl = await createTopupCheckoutSession(
          customerId,
          input.packageId,
          `${baseUrl}/dashboard?topup=success`,
          `${baseUrl}/dashboard?topup=canceled`,
          ctx.user.id
        );

        return { checkoutUrl };
      }),

    // Create customer portal session for subscription management
    createPortalSession: protectedProcedure.mutation(async ({ ctx }) => {
      const subscription = await getSubscriptionByUserId(ctx.user.id);
      
      if (!subscription?.stripeCustomerId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No billing account found. Please subscribe to a plan first.",
        });
      }

      const baseUrl = process.env.NODE_ENV === "production" 
        ? "https://formastudio.app" 
        : "http://localhost:3000";

      const portalUrl = await createCustomerPortalSession(
        subscription.stripeCustomerId,
        `${baseUrl}/dashboard`
      );

      return { portalUrl };
    }),

    // Cancel subscription (at period end)
    cancelSubscription: protectedProcedure.mutation(async ({ ctx }) => {
      const subscription = await getSubscriptionByUserId(ctx.user.id);
      
      if (!subscription?.stripeSubscriptionId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No active subscription found.",
        });
      }

      const success = await cancelSubscription(subscription.stripeSubscriptionId);
      
      if (!success) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to cancel subscription.",
        });
      }

      return { success: true, message: "Subscription will be canceled at the end of the billing period." };
    }),

    // Reactivate canceled subscription
    reactivateSubscription: protectedProcedure.mutation(async ({ ctx }) => {
      const subscription = await getSubscriptionByUserId(ctx.user.id);
      
      if (!subscription?.stripeSubscriptionId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No subscription found.",
        });
      }

      const success = await reactivateSubscription(subscription.stripeSubscriptionId);
      
      if (!success) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to reactivate subscription.",
        });
      }

      return { success: true, message: "Subscription reactivated." };
    }),

    // Preview proration for plan change
    previewPlanChange: protectedProcedure
      .input(z.object({
        newPlan: z.enum(["starter", "pro", "studio"]),
      }))
      .query(async ({ ctx, input }) => {
        const subscription = await getSubscriptionByUserId(ctx.user.id);
        
        if (!subscription?.stripeSubscriptionId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "No active subscription found. Please subscribe first.",
          });
        }

        const proration = await calculateProration(
          subscription.stripeSubscriptionId,
          input.newPlan
        );

        if (!proration) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to calculate proration.",
          });
        }

        // Calculate credit adjustment
        const currentPlan = subscription.planTier || "free";
        const creditAdjustment = calculateCreditAdjustment(
          currentPlan,
          input.newPlan,
          proration.daysRemaining,
          proration.totalDays
        );

        return {
          currentPlan,
          newPlan: input.newPlan,
          isUpgrade: proration.isUpgrade,
          proratedAmount: proration.proratedAmount,
          immediateCharge: proration.immediateCharge,
          creditBalance: proration.creditBalance,
          currentPlanPrice: proration.currentPlanPrice,
          newPlanPrice: proration.newPlanPrice,
          daysRemaining: proration.daysRemaining,
          totalDays: proration.totalDays,
          creditAdjustment,
        };
      }),

    // Change subscription plan with proration
    changePlan: protectedProcedure
      .input(z.object({
        newPlan: z.enum(["starter", "pro", "studio"]),
      }))
      .mutation(async ({ ctx, input }) => {
        const subscription = await getSubscriptionByUserId(ctx.user.id);
        
        if (!subscription?.stripeSubscriptionId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "No active subscription found. Please subscribe first.",
          });
        }

        // Calculate proration first to get credit adjustment
        const proration = await calculateProration(
          subscription.stripeSubscriptionId,
          input.newPlan
        );

        if (!proration) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to calculate proration.",
          });
        }

        // Update the subscription in Stripe
        const result = await updateSubscriptionPlan(
          subscription.stripeSubscriptionId,
          input.newPlan,
          ctx.user.id
        );

        if (!result.success) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: result.error || "Failed to change plan.",
          });
        }

        // Calculate and apply credit adjustment for upgrades
        const currentPlan = subscription.planTier || "free";
        const creditAdjustment = calculateCreditAdjustment(
          currentPlan,
          input.newPlan,
          proration.daysRemaining,
          proration.totalDays
        );

        if (creditAdjustment > 0) {
          // Add prorated credits for upgrade
          await addCredits(
            ctx.user.id,
            creditAdjustment,
            "bonus",
            `Prorated credits for upgrade to ${input.newPlan}`
          );
        }

        // Update local subscription record
        await updateUserSubscription(ctx.user.id, {
          planTier: input.newPlan,
        });

        return {
          success: true,
          message: proration.isUpgrade
            ? `Upgraded to ${input.newPlan}! ${creditAdjustment} bonus credits added.`
            : `Downgraded to ${input.newPlan}. Changes take effect at next billing cycle.`,
          proratedAmount: result.proratedAmount,
          creditAdjustment,
        };
      }),
  }),
});

export type AppRouter = typeof appRouter;
