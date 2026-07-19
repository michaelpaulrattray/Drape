import { protectedProcedure, router } from "../_core/trpc";
import {
  createModel, getModelById, getUserModels, updateModel, deleteModel,
  getModelAssets, bindGenerationOperationModel, markGenerationOperationRunning,
} from "../db";
import { generateMasterPrompt, ModelPreferences } from "../casting/aiService";
import { modelCreateInputSchema } from "./modelCreateInput";
import { validateCreationIntent } from "../casting/identity/creationIntake";
import { logAuditEvent, AUDIT_ACTIONS } from "../auditLog";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createModuleLogger } from "../logging/logger";
import { stripEngineChoiceMetadata } from "../casting/engineChoiceMetadata";
import {
  beginDirectOperation,
  completeDirectOperationFailure,
  completeDirectOperationSuccess,
  failClaimedDirectOperation,
  requireDirectOperationRecovery,
} from "../casting/directOperation";
import { modelOperationLockKey } from "../casting/operationContract";
const log = createModuleLogger("routes/models");

export const modelsRouter = router({
  // Create a new AI model from preferences
  // Strict wire schema lives in modelCreateInput.ts (dependency-light so the
  // client/server contract tests import the REAL schema, not a copy)
  create: protectedProcedure
    .input(modelCreateInputSchema)
    .mutation(async ({ ctx, input }) => {
      // Never log raw creation preferences/user prose. The operation stores
      // only their canonical hash and logs only structural field names.
      log.info({ preferenceFields: Object.keys(input.preferences).sort() }, '[models.create] Received preferences');

      // W4/R8: engineChoice is durable UI authority, not prompt content or
      // identity prose. Keep it in the stored preferences but remove it from
      // both the content scanner and Gemini prompt construction.
      const promptPreferences = stripEngineChoiceMetadata(input.preferences);

      const gate = await beginDirectOperation({
        userId: ctx.user.id,
        clientRequestId: input.clientRequestId,
        kind: "model.create",
        payload: {
          preferences: input.preferences,
          name: input.name?.trim() || null,
        },
      });
      if (gate.type === "replay") {
        const modelId = (gate.result as { modelId?: unknown } | null)?.modelId;
        if (!Number.isSafeInteger(modelId) || Number(modelId) <= 0) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: `The saved result needs support review. Operation ${gate.operationId}.`,
          });
        }
        const model = await getModelById(Number(modelId));
        if (!model || model.userId !== ctx.user.id || model.status === "archived") {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: `The saved result is no longer available. Operation ${gate.operationId}.`,
          });
        }
        return {
          success: true,
          modelId: model.id,
          agencyId: null,
          masterPrompt: model.masterPrompt,
          technicalSchema: model.technicalSchema,
        };
      }

      // Batch C (§10.2, M22): validate the complete creation intent before
      // Gemini or model writes, but after the receipt claim so the refusal is
      // replayable under the same client request id.
      const intake = validateCreationIntent(promptPreferences as Record<string, unknown>);
      if (!intake.ok) {
        log.warn({ userId: ctx.user.id, code: intake.code, channel: intake.channel }, '[models.create] refused at intake');
        return failClaimedDirectOperation({
          userId: ctx.user.id,
          operationId: gate.operationId,
          error: new TRPCError({ code: "PRECONDITION_FAILED", message: intake.message }),
        });
      }

      await markGenerationOperationRunning({
        userId: ctx.user.id,
        operationId: gate.operationId,
        plannedCredits: 0,
        phase: "planning",
        heartbeat: true,
      });

      let durableResult = false;
      try {
        // Generate master prompt (no point cost for this step)
        const masterPrompt = await generateMasterPrompt(promptPreferences as ModelPreferences);

        log.info({ modelPromptGenerated: true }, '[models.create] Generated master prompt');

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

        if (!result.success || !result.modelId) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: result.error || "Failed to create model",
          });
        }
        durableResult = true;

        try {
          await bindGenerationOperationModel({
            userId: ctx.user.id,
            operationId: gate.operationId,
            modelId: result.modelId,
          });
        } catch (error) {
          await requireDirectOperationRecovery({
            userId: ctx.user.id,
            operationId: gate.operationId,
            chargedCredits: 0,
            refundedCredits: 0,
            cause: error,
          });
        }

        await completeDirectOperationSuccess({
          userId: ctx.user.id,
          operationId: gate.operationId,
          result: { modelId: result.modelId },
          chargedCredits: 0,
          refundedCredits: 0,
        });

        return {
          success: true,
          modelId: result.modelId,
          agencyId: null, // Not minted yet - will be assigned on export
          masterPrompt: masterPrompt.naturalDescription,
          technicalSchema: masterPrompt.technicalSchema,
        };
      } catch (error) {
        if (durableResult) throw error;
        return completeDirectOperationFailure({
          userId: ctx.user.id,
          operationId: gate.operationId,
          error,
          chargedCredits: 0,
          refundedCredits: 0,
        });
      }
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
    .input(z.object({ clientRequestId: z.string().uuid(), modelId: z.number() }).strict())
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
      const lockKey = modelOperationLockKey(input.modelId);
      const gate = await beginDirectOperation({
        userId: ctx.user.id,
        clientRequestId: input.clientRequestId,
        kind: "model.delete",
        modelId: input.modelId,
        payload: { modelId: input.modelId },
        lockKey,
      });
      if (gate.type === "replay") return { success: true };
      const lockedModel = await getModelById(input.modelId);
      if (!lockedModel || lockedModel.userId !== ctx.user.id || lockedModel.status !== "draft") {
        const error = !lockedModel || lockedModel.status === "archived"
          ? new TRPCError({ code: "NOT_FOUND", message: "Model not found" })
          : lockedModel.userId !== ctx.user.id
            ? new TRPCError({ code: "FORBIDDEN", message: "Access denied" })
            : new TRPCError({ code: "PRECONDITION_FAILED", message: "Only draft Casts can be deleted right now." });
        return failClaimedDirectOperation({ userId: ctx.user.id, operationId: gate.operationId, error });
      }
      await markGenerationOperationRunning({
        userId: ctx.user.id,
        operationId: gate.operationId,
        modelId: input.modelId,
        expectedIdentityRevisionId: lockedModel.identityRevisionId,
        plannedCredits: 0,
        requiredLockKey: lockKey,
        phase: "finalizing",
        heartbeat: true,
      });

      let durableResult = false;
      try {
        const deleted = await deleteModel(input.modelId);
        if (!deleted.success) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: deleted.error || "Failed to delete model" });
        }
        durableResult = true;

        // Audit failure is secondary after the deletion's durable boundary.
        await logAuditEvent({
          userId: ctx.user.id,
          action: AUDIT_ACTIONS.MODEL_DELETED,
          resourceType: "model",
          resourceId: input.modelId.toString(),
          metadata: {
            modelName: lockedModel.name,
            agencyId: lockedModel.agencyId,
            status: lockedModel.status,
          },
          req: ctx.req,
        }).catch((error) => log.error({ err: error, modelId: input.modelId }, "[models.delete] audit write failed after deletion"));

        await completeDirectOperationSuccess({ userId: ctx.user.id, operationId: gate.operationId, result: { deleted: true }, chargedCredits: 0, refundedCredits: 0 });
        return { success: true };
      } catch (error) {
        if (durableResult) throw error;
        return completeDirectOperationFailure({ userId: ctx.user.id, operationId: gate.operationId, error, chargedCredits: 0, refundedCredits: 0 });
      }
    }),
});
