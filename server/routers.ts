import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, adminProcedure, moderatorProcedure, router } from "./_core/trpc";
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
  updateUserSubscription, getSubscriptionByUserId, refreshMonthlyCredits, addTopupCredits,
  // Usage functions
  getCreditHistory, getUsageStats, getDailyUsage
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
  getCustomerInvoices,
  getAllCustomerInvoices,
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
import { newsletterSignup, testConnection as testKlaviyoConnection } from "./klaviyo";
import { checkRateLimit, getClientIp, RATE_LIMITS, rateLimitError } from "./rateLimit";
import { withAtomicCredits } from "./atomicCredits";
import { logAuditEvent, AUDIT_ACTIONS } from "./auditLog";
import { logAdminAction, isSensitiveAction, writeImmutableLog } from "./adminSecurity";
import { 
  requestApproval as requestSlackApproval, 
  getApprovalStatus as getSlackApprovalStatus,
  markExecuted as markSlackActionExecuted,
  markFailed as markSlackActionFailed,
  type PendingAction,
} from "./slackApproval";

/**
 * Execute an approved admin action from the Slack approval flow.
 * This function dispatches to the appropriate action handler based on the pending action type.
 */
async function executeApprovedAdminAction(
  pendingAction: PendingAction,
  ctx: { user: { id: number; name: string | null; email: string | null; role: string }; req: any; res: any }
): Promise<{ message: string }> {
  const params = pendingAction.params;
  const adminName = ctx.user.name || ctx.user.email || `Admin ${ctx.user.id}`;
  
  switch (pendingAction.action) {
    case "suspendUser": {
      const { suspendUser, getUserById } = await import("./db");
      const userId = Number(pendingAction.targetId);
      const reason = (params.reason as string) || "Approved via Slack";
      
      const targetUser = await getUserById(userId);
      if (!targetUser) throw new Error("User not found");
      if (targetUser.role === "admin") throw new Error("Cannot suspend admin accounts");
      
      const result = await suspendUser(userId, reason, ctx.user.id);
      if (!result.success) throw new Error(result.error || "Failed to suspend user");
      
      await logAuditEvent({
        userId: ctx.user.id,
        action: AUDIT_ACTIONS.ACCOUNT_SUSPENDED,
        resourceType: "user",
        resourceId: userId.toString(),
        metadata: {
          targetUserId: userId,
          targetUserEmail: targetUser.email,
          reason,
          suspendedBy: ctx.user.id,
          approvedViaSlack: true,
          approvedBy: pendingAction.resolvedBy,
        },
        severity: "critical",
        ipAddress: getClientIp(ctx.req),
        userAgent: ctx.req.headers["user-agent"] || null,
      });
      
      await logAdminAction({
        adminId: ctx.user.id,
        adminName,
        action: "suspendUser",
        targetType: "user",
        targetId: userId.toString(),
        details: `Suspended user ${targetUser.email || targetUser.name} (Slack-approved by ${pendingAction.resolvedBy}) - Reason: ${reason}`,
        ipAddress: getClientIp(ctx.req),
        userAgent: ctx.req.headers["user-agent"] || undefined,
      });
      
      await writeImmutableLog("user_suspended", {
        adminId: ctx.user.id,
        adminName,
        targetUserId: userId,
        targetUserEmail: targetUser.email,
        reason,
        slackApprovedBy: pendingAction.resolvedBy,
      });
      
      return { message: `User ${targetUser.email || targetUser.name} suspended successfully` };
    }
    
    case "unsuspendUser": {
      const { unsuspendUser, getUserById } = await import("./db");
      const userId = Number(pendingAction.targetId);
      
      const targetUser = await getUserById(userId);
      if (!targetUser) throw new Error("User not found");
      if (!targetUser.suspendedAt) throw new Error("User is not suspended");
      
      const result = await unsuspendUser(userId);
      if (!result.success) throw new Error(result.error || "Failed to unsuspend user");
      
      await logAuditEvent({
        userId: ctx.user.id,
        action: AUDIT_ACTIONS.ACCOUNT_UNSUSPENDED,
        resourceType: "user",
        resourceId: userId.toString(),
        metadata: {
          targetUserId: userId,
          targetUserEmail: targetUser.email,
          previousReason: targetUser.suspendedReason,
          unsuspendedBy: ctx.user.id,
          approvedViaSlack: true,
          approvedBy: pendingAction.resolvedBy,
        },
        severity: "info",
        ipAddress: getClientIp(ctx.req),
        userAgent: ctx.req.headers["user-agent"] || null,
      });
      
      await logAdminAction({
        adminId: ctx.user.id,
        adminName,
        action: "unsuspendUser",
        targetType: "user",
        targetId: userId.toString(),
        details: `Unsuspended user ${targetUser.email || targetUser.name} (Slack-approved by ${pendingAction.resolvedBy})`,
        ipAddress: getClientIp(ctx.req),
        userAgent: ctx.req.headers["user-agent"] || undefined,
      });
      
      await writeImmutableLog("user_unsuspended", {
        adminId: ctx.user.id,
        adminName,
        targetUserId: userId,
        targetUserEmail: targetUser.email,
        slackApprovedBy: pendingAction.resolvedBy,
      });
      
      return { message: `User ${targetUser.email || targetUser.name} unsuspended successfully` };
    }
    
    case "blockIP": {
      const { blockIp } = await import("./db");
      const ipAddress = pendingAction.targetId;
      const reason = (params.reason as string) || "Approved via Slack";
      const expiresInHours = params.expiresInHours as number | undefined;
      
      const expiresAt = expiresInHours
        ? new Date(Date.now() + expiresInHours * 60 * 60 * 1000)
        : null;
      
      const result = await blockIp(ipAddress, reason, ctx.user.id, expiresAt);
      if (!result.success) throw new Error("Failed to block IP address");
      
      await logAuditEvent({
        userId: ctx.user.id,
        action: AUDIT_ACTIONS.IP_BLOCKED,
        resourceType: "ip",
        resourceId: ipAddress,
        metadata: {
          reason,
          expiresAt: expiresAt?.toISOString() || "permanent",
          approvedViaSlack: true,
          approvedBy: pendingAction.resolvedBy,
        },
        severity: "warning",
        ipAddress: getClientIp(ctx.req),
        userAgent: ctx.req.headers["user-agent"] || null,
      });
      
      await logAdminAction({
        adminId: ctx.user.id,
        adminName,
        action: "blockIP",
        targetType: "ip",
        targetId: ipAddress,
        details: `Blocked IP ${ipAddress} (Slack-approved by ${pendingAction.resolvedBy}) - Reason: ${reason}`,
        ipAddress: getClientIp(ctx.req),
        userAgent: ctx.req.headers["user-agent"] || undefined,
      });
      
      await writeImmutableLog("ip_blocked", {
        adminId: ctx.user.id,
        adminName,
        ipAddress,
        reason,
        expiresAt: expiresAt?.toISOString() || "permanent",
        slackApprovedBy: pendingAction.resolvedBy,
      });
      
      return { message: `IP ${ipAddress} blocked successfully` };
    }
    
    case "unblockIP": {
      const { unblockIp } = await import("./db");
      const ipAddress = pendingAction.targetId;
      
      const success = await unblockIp(ipAddress);
      if (!success) throw new Error("Failed to unblock IP address");
      
      await logAuditEvent({
        userId: ctx.user.id,
        action: AUDIT_ACTIONS.IP_UNBLOCKED,
        resourceType: "ip",
        resourceId: ipAddress,
        metadata: {
          approvedViaSlack: true,
          approvedBy: pendingAction.resolvedBy,
        },
        severity: "info",
        ipAddress: getClientIp(ctx.req),
        userAgent: ctx.req.headers["user-agent"] || null,
      });
      
      await logAdminAction({
        adminId: ctx.user.id,
        adminName,
        action: "unblockIP",
        targetType: "ip",
        targetId: ipAddress,
        details: `Unblocked IP ${ipAddress} (Slack-approved by ${pendingAction.resolvedBy})`,
        ipAddress: getClientIp(ctx.req),
        userAgent: ctx.req.headers["user-agent"] || undefined,
      });
      
      await writeImmutableLog("ip_unblocked", {
        adminId: ctx.user.id,
        adminName,
        ipAddress,
        slackApprovedBy: pendingAction.resolvedBy,
      });
      
      return { message: `IP ${ipAddress} unblocked successfully` };
    }
    
    case "adjustCredits": {
      const { adjustUserCredits, getUserById } = await import("./db");
      const userId = Number(pendingAction.targetId);
      const amount = params.amount as number;
      const reason = (params.reason as string) || "Approved via Slack";
      
      if (typeof amount !== "number") throw new Error("Invalid credit amount");
      
      const targetUser = await getUserById(userId);
      if (!targetUser) throw new Error("User not found");
      
      const result = await adjustUserCredits(userId, amount, reason, ctx.user.id);
      if (!result.success) throw new Error(result.error || "Failed to adjust credits");
      
      await logAuditEvent({
        userId: ctx.user.id,
        action: amount > 0 ? AUDIT_ACTIONS.CREDITS_ADDED : AUDIT_ACTIONS.CREDITS_DEDUCTED,
        resourceType: "credits",
        resourceId: userId.toString(),
        metadata: {
          targetUserId: userId,
          targetUserEmail: targetUser.email,
          amount,
          reason,
          newBalance: result.newBalance,
          adjustedBy: ctx.user.id,
          approvedViaSlack: true,
          approvedBy: pendingAction.resolvedBy,
        },
        severity: "warning",
        ipAddress: getClientIp(ctx.req),
        userAgent: ctx.req.headers["user-agent"] || null,
      });
      
      await logAdminAction({
        adminId: ctx.user.id,
        adminName,
        action: "adjustCredits",
        targetType: "user",
        targetId: userId.toString(),
        details: `${amount > 0 ? "Added" : "Deducted"} ${Math.abs(amount)} credits for ${targetUser.email || targetUser.name} (Slack-approved by ${pendingAction.resolvedBy}) - Reason: ${reason} - New balance: ${result.newBalance}`,
        ipAddress: getClientIp(ctx.req),
        userAgent: ctx.req.headers["user-agent"] || undefined,
      });
      
      await writeImmutableLog("credits_adjusted", {
        adminId: ctx.user.id,
        adminName,
        targetUserId: userId,
        targetUserEmail: targetUser.email,
        amount,
        reason,
        newBalance: result.newBalance,
        slackApprovedBy: pendingAction.resolvedBy,
      });
      
      return { message: `${amount > 0 ? "Added" : "Deducted"} ${Math.abs(amount)} credits. New balance: ${result.newBalance}` };
    }
    
    default:
      throw new Error(`Unknown action type: ${pendingAction.action}`);
  }
}

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
      .mutation(async ({ input, ctx }) => {
        // Rate limit by IP to prevent spam
        const clientIp = getClientIp(ctx.req);
        const rateCheck = checkRateLimit(clientIp, RATE_LIMITS.waitlist);
        
        if (!rateCheck.allowed) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: rateLimitError(rateCheck.resetIn),
          });
        }
        
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
        
        // Audit log: model deletion
        await logAuditEvent({
          userId: ctx.user.id,
          action: AUDIT_ACTIONS.MODEL_DELETED,
          resourceType: "model",
          resourceId: input.modelId.toString(),
          metadata: {
            modelName: model.name,
            agencyId: model.agencyId,
            status: model.status,
          },
          req: ctx.req,
        });
        
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
        interval: z.enum(["monthly", "annual"]).optional().default("monthly"),
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
          ctx.user.id,
          input.interval
        );

        // Audit log: subscription checkout initiated
        await logAuditEvent({
          userId: ctx.user.id,
          action: AUDIT_ACTIONS.SUBSCRIPTION_CREATED,
          resourceType: "subscription",
          resourceId: customerId,
          metadata: {
            plan: input.plan,
            interval: input.interval,
            stage: "checkout_initiated",
          },
          req: ctx.req,
        });

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

        // Audit log: credit top-up checkout initiated
        await logAuditEvent({
          userId: ctx.user.id,
          action: AUDIT_ACTIONS.CREDITS_PURCHASED,
          resourceType: "credits",
          resourceId: customerId,
          metadata: {
            packageId: input.packageId,
            stage: "checkout_initiated",
          },
          req: ctx.req,
        });

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

      // Audit log: subscription canceled
      await logAuditEvent({
        userId: ctx.user.id,
        action: AUDIT_ACTIONS.SUBSCRIPTION_CANCELED,
        resourceType: "subscription",
        resourceId: subscription.stripeSubscriptionId,
        metadata: {
          planTier: subscription.planTier,
          cancelAtPeriodEnd: true,
        },
        severity: "warning",
        req: ctx.req,
      });

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

    // Get recent invoices
    getInvoices: protectedProcedure
      .input(z.object({
        limit: z.number().min(1).max(50).optional().default(5),
      }).optional())
      .query(async ({ ctx, input }) => {
        const subscription = await getSubscriptionByUserId(ctx.user.id);
        
        if (!subscription?.stripeCustomerId) {
          return {
            invoices: [],
            hasMore: false,
          };
        }

        const result = await getCustomerInvoices(
          subscription.stripeCustomerId,
          input?.limit || 5
        );

        return result;
      }),

    // Get all invoices with pagination
    getAllInvoices: protectedProcedure
      .input(z.object({
        cursor: z.string().optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        const subscription = await getSubscriptionByUserId(ctx.user.id);
        
        if (!subscription?.stripeCustomerId) {
          return {
            invoices: [],
            hasMore: false,
            nextCursor: null,
          };
        }

        const result = await getAllCustomerInvoices(
          subscription.stripeCustomerId,
          input?.cursor
        );

        return result;
      }),

    // Get subscription details with renewal date
    getSubscriptionDetails: protectedProcedure.query(async ({ ctx }) => {
      const subscription = await getSubscriptionByUserId(ctx.user.id);
      
      if (!subscription?.stripeSubscriptionId) {
        return null;
      }

      const details = await getSubscriptionDetails(subscription.stripeSubscriptionId);
      
      if (!details) {
        return null;
      }

      return {
        planTier: subscription.planTier,
        renewalDate: details.currentPeriodEnd,
        status: details.status,
        cancelAtPeriodEnd: details.cancelAtPeriodEnd,
        currentPeriodStart: details.currentPeriodStart,
        currentPeriodEnd: details.currentPeriodEnd,
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

        // Audit log: subscription plan changed
        await logAuditEvent({
          userId: ctx.user.id,
          action: AUDIT_ACTIONS.SUBSCRIPTION_UPDATED,
          resourceType: "subscription",
          resourceId: subscription.stripeSubscriptionId,
          metadata: {
            previousPlan: currentPlan,
            newPlan: input.newPlan,
            isUpgrade: proration.isUpgrade,
            creditAdjustment,
            proratedAmount: result.proratedAmount,
          },
          req: ctx.req,
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

  // ============ Usage Analytics ============
  usage: router({
    // Get credit transaction history with pagination
    getHistory: protectedProcedure
      .input(z.object({
        limit: z.number().min(1).max(100).optional().default(20),
        offset: z.number().min(0).optional().default(0),
      }).optional())
      .query(async ({ ctx, input }) => {
        const result = await getCreditHistory(
          ctx.user.id,
          input?.limit || 20,
          input?.offset || 0
        );
        return result;
      }),

    // Get usage statistics summary
    getStats: protectedProcedure
      .input(z.object({
        days: z.number().min(1).max(365).optional().default(30),
      }).optional())
      .query(async ({ ctx, input }) => {
        const stats = await getUsageStats(ctx.user.id, input?.days || 30);
        return stats;
      }),

    // Get daily usage data for charts
    getDailyUsage: protectedProcedure
      .input(z.object({
        days: z.number().min(1).max(90).optional().default(30),
      }).optional())
      .query(async ({ ctx, input }) => {
        const dailyData = await getDailyUsage(ctx.user.id, input?.days || 30);
        return dailyData;
      }),
  }),

  // ============ Newsletter / Klaviyo ============
  newsletter: router({
    // Subscribe to newsletter (public - no auth required)
    subscribe: publicProcedure
      .input(z.object({
        email: z.string().email("Please enter a valid email address"),
        source: z.string().optional().default("website_footer"),
      }))
      .mutation(async ({ input, ctx }) => {
        // Rate limit by IP to prevent spam
        const clientIp = getClientIp(ctx.req);
        const rateCheck = checkRateLimit(clientIp, RATE_LIMITS.newsletter);
        
        if (!rateCheck.allowed) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: rateLimitError(rateCheck.resetIn),
          });
        }
        
        const result = await newsletterSignup(input.email, input.source);
        
        if (!result.success) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to subscribe. Please try again later.",
          });
        }
        
        return {
          success: true,
          message: result.isNew 
            ? "Welcome! You've been subscribed to our newsletter."
            : "This email is already on the list.",
          isNew: result.isNew,
        };
      }),

    // Test Klaviyo connection (admin/debug only)
    testConnection: protectedProcedure
      .query(async () => {
        const result = await testKlaviyoConnection();
        return result;
      }),
  }),

  // ============ Admin: Audit Logs ============
  admin: router({
    // ============ Slack Approval Flow ============
    
    // Request Slack approval for a sensitive admin action
    requestApproval: adminProcedure
      .input(z.object({
        action: z.enum(["suspendUser", "unsuspendUser", "adjustCredits", "blockIP", "unblockIP"]),
        targetId: z.string(),
        description: z.string().min(1).max(1000),
        params: z.record(z.string(), z.unknown()).optional().default({}),
      }))
      .mutation(async ({ ctx, input }) => {
        const result = await requestSlackApproval({
          action: input.action,
          requestedBy: {
            id: ctx.user.id,
            name: ctx.user.name || ctx.user.email || `Admin ${ctx.user.id}`,
            email: ctx.user.email || undefined,
          },
          targetId: input.targetId,
          description: input.description,
          params: input.params,
          ipAddress: getClientIp(ctx.req),
        });
        
        return {
          actionId: result.actionId,
          slackSent: result.sent,
          expiresIn: 300, // 5 minutes
        };
      }),

    // Check the status of a pending approval
    checkApprovalStatus: adminProcedure
      .input(z.object({
        actionId: z.string(),
      }))
      .query(async ({ ctx, input }) => {
        const status = getSlackApprovalStatus(input.actionId);
        
        if (!status) {
          return {
            status: "not_found" as const,
            message: "Approval request not found or has been cleaned up",
          };
        }
        
        // Only the requesting admin can check status
        if (status.requestedBy.id !== ctx.user.id) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You can only check status of your own approval requests",
          });
        }
        
        return {
          status: status.status,
          action: status.action,
          targetId: status.targetId,
          resolvedBy: status.resolvedBy,
          resolvedAt: status.resolvedAt,
          resultMessage: status.resultMessage,
          expiresAt: status.expiresAt,
        };
      }),

    // Execute an approved action
    executeApproved: adminProcedure
      .input(z.object({
        actionId: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const status = getSlackApprovalStatus(input.actionId);
        
        if (!status) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Approval request not found",
          });
        }
        
        if (status.requestedBy.id !== ctx.user.id) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You can only execute your own approved actions",
          });
        }
        
        if (status.status !== "approved") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Cannot execute action with status: ${status.status}`,
          });
        }
        
        // Execute the approved action based on its type
        try {
          const result = await executeApprovedAdminAction(status, ctx);
          markSlackActionExecuted(input.actionId, result.message);
          return { success: true, message: result.message };
        } catch (error: any) {
          markSlackActionFailed(input.actionId, error.message || "Execution failed");
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error.message || "Failed to execute approved action",
          });
        }
      }),

    // ============ Audit Logs ============
    
    // Get paginated audit logs with filters
    getAuditLogs: adminProcedure
      .input(z.object({
        limit: z.number().min(1).max(100).optional().default(20),
        offset: z.number().min(0).optional().default(0),
        severity: z.enum(["info", "warning", "critical", "all"]).optional().default("all"),
        actionCategory: z.enum(["billing", "model", "security", "abuse", "all"]).optional().default("all"),
        userId: z.number().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        const { getFilteredAuditLogs } = await import("./auditLog");
        return await getFilteredAuditLogs({
          limit: input?.limit || 20,
          offset: input?.offset || 0,
          severity: input?.severity === "all" ? undefined : input?.severity,
          actionCategory: input?.actionCategory === "all" ? undefined : input?.actionCategory,
          userId: input?.userId,
          startDate: input?.startDate ? new Date(input.startDate) : undefined,
          endDate: input?.endDate ? new Date(input.endDate) : undefined,
        });
      }),

    // Get abuse alerts summary
    getAbuseAlerts: adminProcedure
      .input(z.object({
        limit: z.number().min(1).max(50).optional().default(10),
      }).optional())
      .query(async ({ input }) => {
        const { getAbuseAlertsSummary } = await import("./auditLog");
        return await getAbuseAlertsSummary(input?.limit || 10);
      }),

    // Get audit log statistics
    getAuditStats: adminProcedure
      .query(async () => {
        const { getAuditStatistics } = await import("./auditLog");
        return await getAuditStatistics();
      }),

    // Get single audit log details
    getAuditLogById: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const { getAuditLogById } = await import("./auditLog");
        return await getAuditLogById(input.id);
      }),

    // Suspend a user account
    suspendUser: adminProcedure
      .input(z.object({
        userId: z.number(),
        reason: z.string().min(1).max(500),
      }))
      .mutation(async ({ ctx, input }) => {
        const { suspendUser, getUserById } = await import("./db");
        
        // Get target user info for audit log
        const targetUser = await getUserById(input.userId);
        if (!targetUser) {
          throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
        }

        // Prevent self-suspension
        if (input.userId === ctx.user.id) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot suspend your own account" });
        }

        // Prevent suspending other admins
        if (targetUser.role === "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Cannot suspend admin accounts" });
        }

        const result = await suspendUser(input.userId, input.reason, ctx.user.id);
        if (!result.success) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: result.error });
        }

        // Log the suspension
        await logAuditEvent({
          userId: ctx.user.id,
          action: AUDIT_ACTIONS.ACCOUNT_SUSPENDED,
          resourceType: "user",
          resourceId: input.userId.toString(),
          metadata: {
            targetUserId: input.userId,
            targetUserEmail: targetUser.email,
            reason: input.reason,
            suspendedBy: ctx.user.id,
            suspendedByName: ctx.user.name,
          },
          severity: "critical",
          ipAddress: getClientIp(ctx.req),
          userAgent: ctx.req.headers["user-agent"] || null,
        });

        // Log admin action with Slack notification
        await logAdminAction({
          adminId: ctx.user.id,
          adminName: ctx.user.name || ctx.user.email || `Admin ${ctx.user.id}`,
          action: "suspendUser",
          targetType: "user",
          targetId: input.userId.toString(),
          details: `Suspended user ${targetUser.email || targetUser.name} - Reason: ${input.reason}`,
          ipAddress: getClientIp(ctx.req),
          userAgent: ctx.req.headers["user-agent"] || undefined,
        });

        // Write to immutable log for critical action
        await writeImmutableLog("user_suspended", {
          adminId: ctx.user.id,
          adminName: ctx.user.name,
          targetUserId: input.userId,
          targetUserEmail: targetUser.email,
          reason: input.reason,
        });

        return { success: true };
      }),

    // Unsuspend a user account
    unsuspendUser: adminProcedure
      .input(z.object({
        userId: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { unsuspendUser, getUserById } = await import("./db");
        
        const targetUser = await getUserById(input.userId);
        if (!targetUser) {
          throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
        }

        if (!targetUser.suspendedAt) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "User is not suspended" });
        }

        const result = await unsuspendUser(input.userId);
        if (!result.success) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: result.error });
        }

        // Log the unsuspension
        await logAuditEvent({
          userId: ctx.user.id,
          action: AUDIT_ACTIONS.ACCOUNT_UNSUSPENDED,
          resourceType: "user",
          resourceId: input.userId.toString(),
          metadata: {
            targetUserId: input.userId,
            targetUserEmail: targetUser.email,
            previousReason: targetUser.suspendedReason,
            unsuspendedBy: ctx.user.id,
            unsuspendedByName: ctx.user.name,
          },
          severity: "info",
          ipAddress: getClientIp(ctx.req),
          userAgent: ctx.req.headers["user-agent"] || null,
        });

        // Log admin action with Slack notification
        await logAdminAction({
          adminId: ctx.user.id,
          adminName: ctx.user.name || ctx.user.email || `Admin ${ctx.user.id}`,
          action: "unsuspendUser",
          targetType: "user",
          targetId: input.userId.toString(),
          details: `Unsuspended user ${targetUser.email || targetUser.name} - Previous reason: ${targetUser.suspendedReason}`,
          ipAddress: getClientIp(ctx.req),
          userAgent: ctx.req.headers["user-agent"] || undefined,
        });

        // Write to immutable log for critical action
        await writeImmutableLog("user_unsuspended", {
          adminId: ctx.user.id,
          adminName: ctx.user.name,
          targetUserId: input.userId,
          targetUserEmail: targetUser.email,
          previousReason: targetUser.suspendedReason,
        });

        return { success: true };
      }),

    // Get user details for admin view
    getUserDetails: adminProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ input }) => {
        const { getUserById } = await import("./db");
        const user = await getUserById(input.userId);
        if (!user) return null;
        
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          suspendedAt: user.suspendedAt,
          suspendedReason: user.suspendedReason,
          lockedUntil: user.lockedUntil,
          failedLoginAttempts: user.failedLoginAttempts,
          createdAt: user.createdAt,
          lastSignedIn: user.lastSignedIn,
        };
      }),

    // Export audit logs as CSV
    exportAuditLogs: adminProcedure
      .input(z.object({
        severity: z.enum(["info", "warning", "critical", "all"]).optional().default("all"),
        actionCategory: z.enum(["billing", "model", "security", "abuse", "all"]).optional().default("all"),
        userId: z.number().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        maxRecords: z.number().min(1).max(10000).optional().default(1000),
      }).optional())
      .mutation(async ({ input }) => {
        const { getFilteredAuditLogs } = await import("./auditLog");
        
        const result = await getFilteredAuditLogs({
          limit: input?.maxRecords || 1000,
          offset: 0,
          severity: input?.severity === "all" ? undefined : input?.severity,
          actionCategory: input?.actionCategory === "all" ? undefined : input?.actionCategory,
          userId: input?.userId,
          startDate: input?.startDate ? new Date(input.startDate) : undefined,
          endDate: input?.endDate ? new Date(input.endDate) : undefined,
        });

        // Generate CSV content
        const headers = ["ID", "Timestamp", "User ID", "Action", "Severity", "Resource Type", "Resource ID", "IP Address", "User Agent"];
        const rows = result.logs.map(log => [
          log.id,
          new Date(log.createdAt).toISOString(),
          log.userId || "",
          log.action,
          log.severity,
          log.resourceType || "",
          log.resourceId || "",
          log.ipAddress || "",
          (log.userAgent || "").replace(/,/g, ";"), // Escape commas in user agent
        ]);

        const csvContent = [
          headers.join(","),
          ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")),
        ].join("\n");

        return {
          csv: csvContent,
          filename: `audit-logs-${new Date().toISOString().split("T")[0]}.csv`,
          recordCount: result.logs.length,
        };
      }),

    // ============ Role Management ============

    // Change a user's role (promote to moderator or demote to user)
    changeUserRole: adminProcedure
      .input(z.object({
        userId: z.number(),
        newRole: z.enum(["user", "moderator"]),
        reason: z.string().min(1).max(500),
      }))
      .mutation(async ({ ctx, input }) => {
        const { updateUserRole, getUserById } = await import("./db");

        // Get target user info
        const targetUser = await getUserById(input.userId);
        if (!targetUser) {
          throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
        }

        // Prevent self-role-change
        if (input.userId === ctx.user.id) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot change your own role" });
        }

        // Prevent changing admin roles
        if (targetUser.role === "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Cannot change the role of an admin user" });
        }

        const result = await updateUserRole(input.userId, input.newRole, ctx.user.id);
        if (!result.success) {
          throw new TRPCError({ code: "BAD_REQUEST", message: result.error || "Failed to change role" });
        }

        const actionLabel = input.newRole === "moderator" ? "Promoted to Moderator" : "Demoted to User";

        // Log to audit
        await logAuditEvent({
          userId: ctx.user.id,
          action: AUDIT_ACTIONS.ROLE_CHANGED,
          resourceType: "user",
          resourceId: input.userId.toString(),
          metadata: {
            targetUserId: input.userId,
            targetUserEmail: targetUser.email,
            targetUserName: targetUser.name,
            previousRole: result.previousRole,
            newRole: input.newRole,
            reason: input.reason,
            changedBy: ctx.user.id,
            changedByName: ctx.user.name,
          },
          severity: "warning",
          ipAddress: getClientIp(ctx.req),
          userAgent: ctx.req.headers["user-agent"] || null,
        });

        // Log admin action with Slack notification
        await logAdminAction({
          adminId: ctx.user.id,
          adminName: ctx.user.name || ctx.user.email || `Admin ${ctx.user.id}`,
          action: "changeUserRole",
          targetType: "user",
          targetId: input.userId.toString(),
          details: `${actionLabel}: ${targetUser.email || targetUser.name} (${result.previousRole} → ${input.newRole}). Reason: ${input.reason}`,
          ipAddress: getClientIp(ctx.req),
          userAgent: ctx.req.headers["user-agent"] || undefined,
        });

        // Write to immutable log
        await writeImmutableLog("role_changed", {
          adminId: ctx.user.id,
          adminName: ctx.user.name,
          targetUserId: input.userId,
          targetUserEmail: targetUser.email,
          previousRole: result.previousRole,
          newRole: input.newRole,
          reason: input.reason,
        });

        return {
          success: true,
          previousRole: result.previousRole,
          newRole: input.newRole,
        };
      }),

    // ============ IP Blocking ============

    // Block an IP address
    blockIP: adminProcedure
      .input(z.object({
        ipAddress: z.string().min(1),
        reason: z.string().min(1).max(500),
        expiresInHours: z.number().min(1).max(8760).optional(), // Max 1 year, null = permanent
      }))
      .mutation(async ({ ctx, input }) => {
        const { blockIp } = await import("./db");
        
        const expiresAt = input.expiresInHours 
          ? new Date(Date.now() + input.expiresInHours * 60 * 60 * 1000)
          : null;

        const result = await blockIp(
          input.ipAddress,
          input.reason,
          ctx.user.id,
          expiresAt
        );

        if (!result.success) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to block IP address",
          });
        }

        // Log the action
        await logAuditEvent({
          userId: ctx.user.id,
          action: AUDIT_ACTIONS.IP_BLOCKED,
          resourceType: "ip",
          resourceId: input.ipAddress,
          metadata: {
            reason: input.reason,
            expiresAt: expiresAt?.toISOString() || "permanent",
          },
          severity: "warning",
          req: ctx.req,
        });

        // Log admin action with Slack notification
        await logAdminAction({
          adminId: ctx.user.id,
          adminName: ctx.user.name || ctx.user.email || `Admin ${ctx.user.id}`,
          action: "blockIP",
          targetType: "ip",
          targetId: input.ipAddress,
          details: `Blocked IP ${input.ipAddress} - Reason: ${input.reason} - Expires: ${expiresAt?.toISOString() || "permanent"}`,
          ipAddress: getClientIp(ctx.req),
          userAgent: ctx.req.headers["user-agent"] || undefined,
        });

        // Write to immutable log for critical action
        await writeImmutableLog("ip_blocked", {
          adminId: ctx.user.id,
          adminName: ctx.user.name,
          ipAddress: input.ipAddress,
          reason: input.reason,
          expiresAt: expiresAt?.toISOString() || "permanent",
        });

        return { success: true };
      }),

    // Unblock an IP address
    unblockIP: adminProcedure
      .input(z.object({
        ipAddress: z.string().min(1),
      }))
      .mutation(async ({ ctx, input }) => {
        const { unblockIp } = await import("./db");
        
        const success = await unblockIp(input.ipAddress);

        if (!success) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to unblock IP address",
          });
        }

        // Log the action
        await logAuditEvent({
          userId: ctx.user.id,
          action: AUDIT_ACTIONS.IP_UNBLOCKED,
          resourceType: "ip",
          resourceId: input.ipAddress,
          metadata: {},
          severity: "info",
          req: ctx.req,
        });

        // Log admin action with Slack notification
        await logAdminAction({
          adminId: ctx.user.id,
          adminName: ctx.user.name || ctx.user.email || `Admin ${ctx.user.id}`,
          action: "unblockIP",
          targetType: "ip",
          targetId: input.ipAddress,
          details: `Unblocked IP ${input.ipAddress}`,
          ipAddress: getClientIp(ctx.req),
          userAgent: ctx.req.headers["user-agent"] || undefined,
        });

        // Write to immutable log for critical action
        await writeImmutableLog("ip_unblocked", {
          adminId: ctx.user.id,
          adminName: ctx.user.name,
          ipAddress: input.ipAddress,
        });

        return { success: true };
      }),

    // Get list of blocked IPs
    listBlockedIPs: adminProcedure
      .input(z.object({
        limit: z.number().min(1).max(100).optional().default(50),
        offset: z.number().min(0).optional().default(0),
      }).optional())
      .query(async ({ input }) => {
        const { getBlockedIps } = await import("./db");
        
        const result = await getBlockedIps(
          input?.limit || 50,
          input?.offset || 0
        );

        return {
          ips: result.ips.map(ip => ({
            id: ip.id,
            ipAddress: ip.ipAddress,
            reason: ip.reason,
            blockedBy: ip.blockedBy,
            expiresAt: ip.expiresAt?.toISOString() || null,
            createdAt: ip.createdAt.toISOString(),
          })),
          total: result.total,
        };
      }),

    // ============ User Management ============

    // Get paginated list of users with search and filters
    listUsers: adminProcedure
      .input(z.object({
        limit: z.number().min(1).max(100).optional().default(20),
        offset: z.number().min(0).optional().default(0),
        search: z.string().optional(),
        status: z.enum(["active", "suspended", "locked", "all"]).optional().default("all"),
        role: z.enum(["user", "admin", "moderator", "all"]).optional().default("all"),
        sortBy: z.enum(["createdAt", "lastSignedIn", "name"]).optional().default("createdAt"),
        sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
      }).optional())
      .query(async ({ input }) => {
        const { listAllUsers } = await import("./db");
        
        const result = await listAllUsers({
          limit: input?.limit || 20,
          offset: input?.offset || 0,
          search: input?.search,
          status: input?.status || "all",
          role: input?.role || "all",
          sortBy: input?.sortBy || "createdAt",
          sortOrder: input?.sortOrder || "desc",
        });

        return {
          users: result.users.map(user => ({
            ...user,
            suspendedAt: user.suspendedAt?.toISOString() || null,
            lockedUntil: user.lockedUntil?.toISOString() || null,
            createdAt: user.createdAt.toISOString(),
            lastSignedIn: user.lastSignedIn.toISOString(),
          })),
          total: result.total,
        };
      }),

    // Get user statistics for dashboard
    getUserStats: adminProcedure
      .query(async () => {
        const { getUserStatistics } = await import("./db");
        return await getUserStatistics();
      }),

    // Get full user details including credits and stats
    getUserFullDetails: adminProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ input }) => {
        const { getUserFullDetails } = await import("./db");
        const result = await getUserFullDetails(input.userId);
        
        if (!result) return null;

        return {
          user: {
            ...result.user,
            suspendedAt: result.user.suspendedAt?.toISOString() || null,
            lockedUntil: result.user.lockedUntil?.toISOString() || null,
            createdAt: result.user.createdAt.toISOString(),
            lastSignedIn: result.user.lastSignedIn.toISOString(),
          },
          credits: result.credits,
          stats: result.stats,
        };
      }),

    // Adjust user credits
    adjustCredits: adminProcedure
      .input(z.object({
        userId: z.number(),
        amount: z.number().min(-100000).max(100000),
        reason: z.string().min(1).max(500),
      }))
      .mutation(async ({ ctx, input }) => {
        const { adjustUserCredits, getUserById } = await import("./db");
        
        // Get target user info
        const targetUser = await getUserById(input.userId);
        if (!targetUser) {
          throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
        }

        const result = await adjustUserCredits(
          input.userId,
          input.amount,
          input.reason,
          ctx.user.id
        );

        if (!result.success) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: result.error || "Failed to adjust credits",
          });
        }

        // Log the action
        await logAuditEvent({
          userId: ctx.user.id,
          action: input.amount > 0 ? AUDIT_ACTIONS.CREDITS_ADDED : AUDIT_ACTIONS.CREDITS_DEDUCTED,
          resourceType: "credits",
          resourceId: input.userId.toString(),
          metadata: {
            targetUserId: input.userId,
            targetUserEmail: targetUser.email,
            amount: input.amount,
            reason: input.reason,
            newBalance: result.newBalance,
            adjustedBy: ctx.user.id,
            adjustedByName: ctx.user.name,
          },
          severity: "warning",
          req: ctx.req,
        });

        // Log admin action with Slack notification
        await logAdminAction({
          adminId: ctx.user.id,
          adminName: ctx.user.name || ctx.user.email || `Admin ${ctx.user.id}`,
          action: "adjustCredits",
          targetType: "user",
          targetId: input.userId.toString(),
          details: `${input.amount > 0 ? "Added" : "Deducted"} ${Math.abs(input.amount)} credits for ${targetUser.email || targetUser.name} - Reason: ${input.reason} - New balance: ${result.newBalance}`,
          ipAddress: getClientIp(ctx.req),
          userAgent: ctx.req.headers["user-agent"] || undefined,
        });

        // Write to immutable log for credit adjustments
        await writeImmutableLog("credits_adjusted", {
          adminId: ctx.user.id,
          adminName: ctx.user.name,
          targetUserId: input.userId,
          targetUserEmail: targetUser.email,
          amount: input.amount,
          reason: input.reason,
          newBalance: result.newBalance,
        });

        return { success: true, newBalance: result.newBalance };
      }),

    // Get user activity (audit logs for specific user)
    getUserActivity: adminProcedure
      .input(z.object({
        userId: z.number(),
        limit: z.number().min(1).max(100).optional().default(50),
        offset: z.number().min(0).optional().default(0),
      }))
      .query(async ({ input }) => {
        const { getFilteredAuditLogs } = await import("./auditLog");
        
        return await getFilteredAuditLogs({
          userId: input.userId,
          limit: input.limit,
          offset: input.offset,
        });
      }),

    // ============ Change Request Review (Admin Only) ============

    // List change requests with optional filters
    listChangeRequests: adminProcedure
      .input(z.object({
        status: z.enum(["pending", "approved", "denied", "cancelled", "expired", "all"]).optional().default("pending"),
        type: z.string().optional(),
        priority: z.string().optional(),
        limit: z.number().min(1).max(100).optional().default(50),
        offset: z.number().min(0).optional().default(0),
      }).optional())
      .query(async ({ input }) => {
        const { listChangeRequests } = await import("./db");
        return await listChangeRequests({
          status: input?.status === "all" ? undefined : input?.status,
          type: input?.type,
          priority: input?.priority,
          limit: input?.limit || 50,
          offset: input?.offset || 0,
        });
      }),

    // Get a single change request by ID
    getChangeRequest: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const { getChangeRequestById } = await import("./db");
        const request = await getChangeRequestById(input.id);
        if (!request) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Change request not found" });
        }
        return request;
      }),

    // Approve or deny a change request
    reviewChangeRequest: adminProcedure
      .input(z.object({
        id: z.number(),
        action: z.enum(["approved", "denied"]),
        reviewNotes: z.string().max(2000).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { getChangeRequestById, updateChangeRequestStatus } = await import("./db");
        const { sendAdminActionNotification, sendAuditLogEntry } = await import("./slackNotification");
        const { logAuditEvent } = await import("./auditLog");
        const { AUDIT_ACTIONS } = await import("../drizzle/schema");
        const { writeImmutableLog } = await import("./adminSecurity");

        const adminName = ctx.user.name || ctx.user.email || `Admin ${ctx.user.id}`;

        // Fetch the request first
        const request = await getChangeRequestById(input.id);
        if (!request) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Change request not found" });
        }
        if (request.status !== "pending") {
          throw new TRPCError({ code: "BAD_REQUEST", message: `Change request is already ${request.status}` });
        }

        // Update the status
        const result = await updateChangeRequestStatus(input.id, {
          status: input.action,
          reviewedById: ctx.user.id,
          reviewedByName: adminName,
          reviewNotes: input.reviewNotes,
        });

        if (!result.success) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: result.error || "Failed to update change request" });
        }

        const typeLabels: Record<string, string> = {
          refund_credits: "Refund Credits",
          add_credits: "Add Credits",
          flag_account: "Flag Account",
          note_incident: "Note Incident",
          suspend_user: "Suspend User",
          unsuspend_user: "Unsuspend User",
          block_ip: "Block IP",
          other: "Other",
        };

        const actionVerb = input.action === "approved" ? "Approved" : "Denied";
        const actionEmoji = input.action === "approved" ? "\u2705" : "\u274c";

        // Notify #admin-actions
        await sendAdminActionNotification({
          title: `${actionEmoji} Change Request #${input.id} ${actionVerb}`,
          description: `*${adminName}* ${actionVerb.toLowerCase()} change request #${input.id} (${typeLabels[request.type] || request.type}).\n\n*Original Title:* ${request.title}${input.reviewNotes ? `\n*Review Notes:* ${input.reviewNotes}` : ""}`,
          severity: input.action === "approved" ? "info" : "warning",
          fields: [
            { title: "Request ID", value: `#${input.id}`, short: true },
            { title: "Type", value: typeLabels[request.type] || request.type, short: true },
            { title: "Reviewed By", value: adminName, short: true },
            { title: "Decision", value: `${actionEmoji} ${actionVerb}`, short: true },
            { title: "Submitted By", value: request.submittedByName || `User ${request.submittedById}`, short: true },
            { title: "Target User", value: request.targetUserName ? `${request.targetUserName} (ID: ${request.targetUserId})` : `User ID: ${request.targetUserId}`, short: true },
          ],
        });

        // Log to #audit-log
        await sendAuditLogEntry({
          title: `Change Request ${actionVerb}`,
          description: `${adminName} ${actionVerb.toLowerCase()} change request #${input.id}: ${typeLabels[request.type] || request.type}`,
          fields: [
            { title: "Request ID", value: `#${input.id}`, short: true },
            { title: "Decision", value: actionVerb, short: true },
            { title: "Admin", value: adminName, short: true },
            { title: "Type", value: typeLabels[request.type] || request.type, short: true },
          ],
          severity: input.action === "approved" ? "info" : "warning",
        });

        // Database audit log
        const auditAction = input.action === "approved"
          ? AUDIT_ACTIONS.CHANGE_REQUEST_APPROVED
          : AUDIT_ACTIONS.CHANGE_REQUEST_DENIED;

        await logAuditEvent({
          userId: ctx.user.id,
          action: auditAction,
          resourceType: "change_request",
          resourceId: String(input.id),
          metadata: {
            requestId: input.id,
            type: request.type,
            decision: input.action,
            reviewNotes: input.reviewNotes,
            submittedById: request.submittedById,
            targetUserId: request.targetUserId,
            creditAmount: request.creditAmount,
          },
          severity: "info",
          req: ctx.req,
        });

        // Write to immutable log for compliance
        await writeImmutableLog(
          `change_request_${input.action}`,
          {
            adminId: ctx.user.id,
            adminName,
            targetId: String(request.targetUserId),
            action: `${actionVerb} change request #${input.id} (${request.type})`,
            requestId: input.id,
            type: request.type,
            title: request.title,
            creditAmount: request.creditAmount,
            reviewNotes: input.reviewNotes,
          },
        );

        return {
          success: true,
          action: input.action,
          message: `Change request #${input.id} has been ${actionVerb.toLowerCase()}`,
        };
      }),
  }),

  // ============ Moderator: Read-Only Access + Escalation ============
  moderator: router({
    // View audit logs (read-only, same data as admin)
    getAuditLogs: moderatorProcedure
      .input(z.object({
        limit: z.number().min(1).max(100).optional().default(20),
        offset: z.number().min(0).optional().default(0),
        severity: z.enum(["info", "warning", "critical", "all"]).optional().default("all"),
        actionCategory: z.enum(["billing", "model", "security", "abuse", "all"]).optional().default("all"),
        userId: z.number().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        const { getFilteredAuditLogs } = await import("./auditLog");
        return await getFilteredAuditLogs({
          limit: input?.limit || 20,
          offset: input?.offset || 0,
          severity: input?.severity === "all" ? undefined : input?.severity,
          actionCategory: input?.actionCategory === "all" ? undefined : input?.actionCategory,
          userId: input?.userId,
          startDate: input?.startDate ? new Date(input.startDate) : undefined,
          endDate: input?.endDate ? new Date(input.endDate) : undefined,
        });
      }),

    // View abuse alerts (read-only)
    getAbuseAlerts: moderatorProcedure
      .input(z.object({
        limit: z.number().min(1).max(50).optional().default(10),
      }).optional())
      .query(async ({ input }) => {
        const { getAbuseAlertsSummary } = await import("./auditLog");
        return await getAbuseAlertsSummary(input?.limit || 10);
      }),

    // View audit statistics (read-only)
    getAuditStats: moderatorProcedure
      .query(async () => {
        const { getAuditStatistics } = await import("./auditLog");
        return await getAuditStatistics();
      }),

    // View single audit log entry (read-only)
    getAuditLogById: moderatorProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const { getAuditLogById } = await import("./auditLog");
        return await getAuditLogById(input.id);
      }),

    // View user details (read-only, no mutations)
    getUserDetails: moderatorProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ input }) => {
        const { getUserById } = await import("./db");
        const user = await getUserById(input.userId);
        if (!user) return null;
        
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          suspendedAt: user.suspendedAt,
          suspendedReason: user.suspendedReason,
          lockedUntil: user.lockedUntil,
          failedLoginAttempts: user.failedLoginAttempts,
          createdAt: user.createdAt,
          lastSignedIn: user.lastSignedIn,
        };
      }),

    // View user activity (read-only)
    getUserActivity: moderatorProcedure
      .input(z.object({
        userId: z.number(),
        limit: z.number().min(1).max(100).optional().default(50),
        offset: z.number().min(0).optional().default(0),
      }))
      .query(async ({ input }) => {
        const { getFilteredAuditLogs } = await import("./auditLog");
        return await getFilteredAuditLogs({
          userId: input.userId,
          limit: input.limit,
          offset: input.offset,
        });
      }),

    // View blocked IPs (read-only)
    listBlockedIPs: moderatorProcedure
      .input(z.object({
        limit: z.number().min(1).max(100).optional().default(50),
        offset: z.number().min(0).optional().default(0),
      }).optional())
      .query(async ({ input }) => {
        const { getBlockedIps } = await import("./db");
        const result = await getBlockedIps(
          input?.limit || 50,
          input?.offset || 0
        );
        return {
          ips: result.ips.map(ip => ({
            id: ip.id,
            ipAddress: ip.ipAddress,
            reason: ip.reason,
            blockedBy: ip.blockedBy,
            expiresAt: ip.expiresAt?.toISOString() || null,
            createdAt: ip.createdAt.toISOString(),
          })),
          total: result.total,
        };
      }),

    // View user list (read-only, for investigation)
    listUsers: moderatorProcedure
      .input(z.object({
        limit: z.number().min(1).max(100).optional().default(20),
        offset: z.number().min(0).optional().default(0),
        search: z.string().optional(),
        status: z.enum(["active", "suspended", "locked", "all"]).optional().default("all"),
        role: z.enum(["user", "admin", "moderator", "all"]).optional().default("all"),
        sortBy: z.enum(["createdAt", "lastSignedIn", "name"]).optional().default("createdAt"),
        sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
      }).optional())
      .query(async ({ input }) => {
        const { listAllUsers } = await import("./db");
        const result = await listAllUsers({
          limit: input?.limit || 20,
          offset: input?.offset || 0,
          search: input?.search,
          status: input?.status || "all",
          role: input?.role || "all",
          sortBy: input?.sortBy || "createdAt",
          sortOrder: input?.sortOrder || "desc",
        });
        return {
          users: result.users.map(user => ({
            ...user,
            suspendedAt: user.suspendedAt?.toISOString() || null,
            lockedUntil: user.lockedUntil?.toISOString() || null,
            createdAt: user.createdAt.toISOString(),
            lastSignedIn: user.lastSignedIn.toISOString(),
          })),
          total: result.total,
        };
      }),

    // View user full details (read-only, for investigation)
    getUserFullDetails: moderatorProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ input }) => {
        const { getUserFullDetails } = await import("./db");
        const result = await getUserFullDetails(input.userId);
        if (!result) return null;
        return {
          user: {
            ...result.user,
            suspendedAt: result.user.suspendedAt?.toISOString() || null,
            lockedUntil: result.user.lockedUntil?.toISOString() || null,
            createdAt: result.user.createdAt.toISOString(),
            lastSignedIn: result.user.lastSignedIn.toISOString(),
          },
          credits: result.credits,
          stats: result.stats,
        };
      }),

    // View user statistics (read-only)
    getUserStats: moderatorProcedure
      .query(async () => {
        const { getUserStatistics } = await import("./db");
        return await getUserStatistics();
      }),

    // View user credit transaction history (read-only, for complaint investigation)
    getUserCreditHistory: moderatorProcedure
      .input(z.object({
        userId: z.number(),
        limit: z.number().min(1).max(100).optional().default(50),
        offset: z.number().min(0).optional().default(0),
        type: z.enum(["generation", "purchase", "bonus", "refund", "signup", "topup", "subscription", "admin_add", "admin_deduct", "all"]).optional().default("all"),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }))
      .query(async ({ input }) => {
        const { getDetailedCreditHistory } = await import("./db");
        return await getDetailedCreditHistory(input.userId, {
          limit: input.limit,
          offset: input.offset,
          type: input.type === "all" ? undefined : input.type,
          startDate: input.startDate ? new Date(input.startDate) : undefined,
          endDate: input.endDate ? new Date(input.endDate) : undefined,
        });
      }),

    // View user generation history (read-only, for complaint investigation)
    getUserGenerationHistory: moderatorProcedure
      .input(z.object({
        userId: z.number(),
        limit: z.number().min(1).max(100).optional().default(50),
        offset: z.number().min(0).optional().default(0),
        status: z.enum(["pending", "processing", "completed", "failed", "all"]).optional().default("all"),
        type: z.enum(["masterPrompt", "castingImage", "fullBody", "multiView", "iteration", "upscale", "all"]).optional().default("all"),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }))
      .query(async ({ input }) => {
        const { getDetailedGenerationHistory } = await import("./db");
        return await getDetailedGenerationHistory(input.userId, {
          limit: input.limit,
          offset: input.offset,
          status: input.status === "all" ? undefined : input.status,
          type: input.type === "all" ? undefined : input.type,
          startDate: input.startDate ? new Date(input.startDate) : undefined,
          endDate: input.endDate ? new Date(input.endDate) : undefined,
        });
      }),

    // ============ Change Requests (structured write operations for moderators) ============

    // Submit a structured change request for admin review
    createChangeRequest: moderatorProcedure
      .input(z.object({
        type: z.enum(["refund_credits", "add_credits", "flag_account", "note_incident", "suspend_user", "unsuspend_user", "block_ip", "other"]),
        priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
        targetUserId: z.number(),
        targetUserName: z.string().optional(),
        title: z.string().min(5).max(512),
        description: z.string().min(10).max(5000),
        evidenceSummary: z.string().max(5000).optional(),
        relatedAuditLogId: z.number().optional(),
        creditAmount: z.number().min(1).optional(),
        creditReason: z.string().max(512).optional(),
        ipAddress: z.string().max(45).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { createChangeRequest } = await import("./db");
        const { sendAdminActionNotification, sendAuditLogEntry } = await import("./slackNotification");
        const { logAuditEvent } = await import("./auditLog");
        const { AUDIT_ACTIONS } = await import("../drizzle/schema");

        const moderatorName = ctx.user.name || ctx.user.email || `Moderator ${ctx.user.id}`;

        // Validate credit-related fields
        if ((input.type === "refund_credits" || input.type === "add_credits") && !input.creditAmount) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Credit amount is required for credit-related requests" });
        }
        if (input.type === "block_ip" && !input.ipAddress) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "IP address is required for block IP requests" });
        }

        // Create the change request in the database
        const result = await createChangeRequest({
          type: input.type,
          priority: input.priority,
          submittedById: ctx.user.id,
          submittedByName: moderatorName,
          targetUserId: input.targetUserId,
          targetUserName: input.targetUserName || null,
          title: input.title,
          description: input.description,
          evidenceSummary: input.evidenceSummary || null,
          relatedAuditLogId: input.relatedAuditLogId || null,
          creditAmount: input.creditAmount || null,
          creditReason: input.creditReason || null,
          ipAddress: input.ipAddress || null,
        });

        if (!result.success) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: result.error || "Failed to create change request" });
        }

        // Type labels for Slack messages
        const typeLabels: Record<string, string> = {
          refund_credits: "Refund Credits",
          add_credits: "Add Credits",
          flag_account: "Flag Account",
          note_incident: "Note Incident",
          suspend_user: "Suspend User",
          unsuspend_user: "Unsuspend User",
          block_ip: "Block IP",
          other: "Other",
        };

        const priorityEmoji: Record<string, string> = {
          low: "⬜",
          normal: "🟦",
          high: "🟧",
          urgent: "🟥",
        };

        // Send notification to #admin-actions
        const fields: Array<{ title: string; value: string; short?: boolean }> = [
          { title: "Request ID", value: `#${result.requestId}`, short: true },
          { title: "Type", value: typeLabels[input.type] || input.type, short: true },
          { title: "Priority", value: `${priorityEmoji[input.priority] || ""} ${input.priority.charAt(0).toUpperCase() + input.priority.slice(1)}`, short: true },
          { title: "Submitted By", value: `${moderatorName} (Moderator)`, short: true },
          { title: "Target User", value: input.targetUserName ? `${input.targetUserName} (ID: ${input.targetUserId})` : `User ID: ${input.targetUserId}`, short: true },
          { title: "Title", value: input.title },
          { title: "Description", value: input.description.length > 200 ? input.description.substring(0, 200) + "..." : input.description },
        ];

        if (input.creditAmount) {
          fields.push({ title: "Credit Amount", value: `${input.creditAmount} credits`, short: true });
        }
        if (input.ipAddress) {
          fields.push({ title: "IP Address", value: input.ipAddress, short: true });
        }
        if (input.evidenceSummary) {
          fields.push({ title: "Evidence", value: input.evidenceSummary.length > 200 ? input.evidenceSummary.substring(0, 200) + "..." : input.evidenceSummary });
        }

        const slackSeverity = input.priority === "urgent" ? "critical" as const : input.priority === "high" ? "warning" as const : "info" as const;

        const slackSent = await sendAdminActionNotification({
          title: `📋 New Change Request #${result.requestId}: ${typeLabels[input.type]}`,
          description: `*${moderatorName}* submitted a change request requiring admin review.\n\n*${input.title}*`,
          severity: slackSeverity,
          fields,
        });

        // Log to #audit-log
        await sendAuditLogEntry({
          title: "Change Request Created",
          description: `${moderatorName} created change request #${result.requestId}: ${typeLabels[input.type]} for user ${input.targetUserId}`,
          fields: [
            { title: "Request ID", value: `#${result.requestId}`, short: true },
            { title: "Type", value: typeLabels[input.type], short: true },
            { title: "Moderator", value: moderatorName, short: true },
            { title: "Target User", value: String(input.targetUserId), short: true },
          ],
          severity: "info",
        });

        // Log to database audit log
        await logAuditEvent({
          userId: ctx.user.id,
          action: AUDIT_ACTIONS.CHANGE_REQUEST_CREATED,
          resourceType: "change_request",
          resourceId: String(result.requestId),
          metadata: {
            requestId: result.requestId,
            type: input.type,
            priority: input.priority,
            targetUserId: input.targetUserId,
            targetUserName: input.targetUserName,
            title: input.title,
            creditAmount: input.creditAmount,
            ipAddress: input.ipAddress,
            slackSent,
          },
          severity: slackSeverity === "critical" ? "critical" : slackSeverity === "warning" ? "warning" : "info",
          req: ctx.req,
        });

        return {
          success: true,
          requestId: result.requestId,
          slackSent,
          message: slackSent
            ? "Change request submitted and admin team notified via Slack"
            : "Change request submitted but Slack notification could not be sent",
        };
      }),

    // Get change requests submitted by the current moderator
    getMyChangeRequests: moderatorProcedure
      .input(z.object({
        status: z.enum(["pending", "approved", "denied", "cancelled", "expired", "all"]).optional().default("all"),
        limit: z.number().min(1).max(100).optional().default(50),
        offset: z.number().min(0).optional().default(0),
      }).optional())
      .query(async ({ ctx, input }) => {
        const { getChangeRequestsByModerator } = await import("./db");
        return await getChangeRequestsByModerator(ctx.user.id, {
          status: input?.status === "all" ? undefined : input?.status,
          limit: input?.limit || 50,
          offset: input?.offset || 0,
        });
      }),
  }),
});

export type AppRouter = typeof appRouter;

