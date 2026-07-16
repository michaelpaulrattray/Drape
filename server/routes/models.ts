import { protectedProcedure, router } from "../_core/trpc";
import { 
  createModel, getModelById, getUserModels, updateModel, deleteModel,
  getModelAssets,
} from "../db";
import { generateMasterPrompt, ModelPreferences } from "../casting/aiService";
import { validateCreationIntent } from "../casting/identity/creationIntake";
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
        userPrompt: z.string().optional(),
        // Batch C (§10.3, M22): `referenceImage` is GONE and the object is
        // STRICT — a creation reference is schema-REJECTED, never silently
        // ignored. References join after the first headshot, through the
        // guarded iteration path. (`previousMasterPrompt` was an unused
        // creation channel and is likewise rejected.)
      }).strict(),
      name: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Debug: Log received preferences
      log.info({ preferences: input.preferences }, '[models.create] Received preferences');

      // Batch C (§10.2, M22): validate the complete creation intent BEFORE
      // the model save — presentation and cosmetic-lash language refuses
      // honestly with routing; nothing is silently stripped.
      const intake = validateCreationIntent(input.preferences as Record<string, unknown>);
      if (!intake.ok) {
        log.warn({ userId: ctx.user.id, code: intake.code, channel: intake.channel }, '[models.create] refused at intake');
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: intake.message });
      }

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
      // Batch 0 (FR-4): archived reads as deleted everywhere
      if (model.status === "archived") {
        throw new TRPCError({ code: "NOT_FOUND", message: "Model not found" });
      }
      const assets = await getModelAssets(input.modelId);
      return { ...model, assets };
    }),

  // Update model display name. STATUS IS NOT ACCEPTED HERE (Batch 0, R6
  // execution plan): status transitions are server-owned — draft→active
  // happens only through the mint ceremony (executeMintPackage), and no
  // generic mutation may unseal, fake-mint, or archive a model. Renaming is
  // display metadata per FR-3(B): it never alters visual identity, and
  // agencyId remains the stable identity key — so minted models may be
  // renamed. The mint ceremony still REQUIRES a name (D-55, as amended).
  update: protectedProcedure
    .input(z.object({
      modelId: z.number(),
      name: z.string().trim().min(1).max(128),
    }).strict()) // E6: unknown fields (e.g. the removed `status`) are REJECTED, never silently stripped
    .mutation(async ({ ctx, input }) => {
      const model = await getModelById(input.modelId);
      if (!model) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Model not found" });
      }
      if (model.userId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }
      // FR-4: archived is deleted — no edits of any kind
      if (model.status === "archived") {
        log.warn({ modelId: input.modelId, userId: ctx.user.id }, "[models.update] refused — model is archived");
        throw new TRPCError({ code: "NOT_FOUND", message: "Model not found" });
      }

      const renamed = await updateModel(input.modelId, { name: input.name });
      if (!renamed.success) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to save the name" });
      }
      return { success: true };
    }),

  // Delete a model — DRAFTS ONLY (founder ruling, Batch 0 review item 9).
  // This is a HARD delete with no cascade design: board placements, D-12
  // snapshots, and generations keep dangling references and R2 objects
  // orphan. A minted identity must not be hard-deletable until the R7
  // deletion/cascade design lands (archive, placement handling, R2 cleanup).
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
      // FR-4: archived reads as deleted already
      if (model.status === "archived") {
        throw new TRPCError({ code: "NOT_FOUND", message: "Model not found" });
      }
      if (model.status !== "draft") {
        log.warn({ modelId: input.modelId, status: model.status }, "[models.delete] refused — minted identities cannot be hard-deleted");
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `${model.name || "This model"} is a minted identity — deletion for minted models arrives with archiving.`,
        });
      }

      const deleted = await deleteModel(input.modelId);
      if (!deleted.success) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: deleted.error || "Failed to delete model" });
      }

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
