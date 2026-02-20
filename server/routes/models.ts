import { protectedProcedure, router } from "../_core/trpc";
import { 
  createModel, getModelById, getUserModels, updateModel, deleteModel,
  getModelAssets,
} from "../db";
import { generateMasterPrompt, ModelPreferences } from "../casting/aiService";
import { logAuditEvent, AUDIT_ACTIONS } from "../auditLog";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createModuleLogger } from "../logging/logger";
const log = createModuleLogger("routes/models");

export const modelsRouter = router({
  // Create a new AI model from preferences
  // Schema matches geminiService.ts ModelPreferences interface exactly
  create: protectedProcedure
    .input(z.object({
      preferences: z.object({
        // Demographics
        gender: z.string().optional(),
        age: z.union([z.number(), z.string()]).optional(),
        ethnicity: z.string().optional(),
        ethnicityBlend: z.array(z.object({
          name: z.string(),
          pct: z.number(),
        })).optional(),
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
      log.info({ preferences: input.preferences }, '[models.create] Received preferences');
      
      // Generate master prompt (no point cost for this step)
      const masterPrompt = await generateMasterPrompt(input.preferences as ModelPreferences);
      
      // Debug: Log generated master prompt
      log.info({ data: masterPrompt.naturalDescription?.substring(0, 500) + '...' }, '[models.create] Generated master prompt:');

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
});
