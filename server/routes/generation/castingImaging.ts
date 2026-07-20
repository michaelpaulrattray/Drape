import { protectedProcedure, router } from "../../_core/trpc";
import {
  getModelById, getModelAssets, createModelAsset,
  createGeneration, updateGeneration, markGenerationOperationRunning,
} from "../../db";
import { deductPoints } from "../../db";
import {
  generateCastingImage,
  POINT_COSTS,
} from "../../casting/aiService";
import { enforceDailyQuota } from "../../db/dailyQuota";
import { recordRefund, refundTruth } from "../../casting/atomicCredits";
import { publicErrorMessage } from "../../lib/publicError";
import { assertNotArchived } from "../../casting/modelGuards";
import { checkRateLimit, RATE_LIMITS, rateLimitError } from "../../security/rateLimit";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { buildEthnicityHint, buildReinforcedPrompt } from "../../casting/promptReinforcement";
import { buildIdentityAnchor } from "../../casting/geminiClient";
import { currentRevisionId, identityStampFor } from "../../casting/identity/anchorSelector";
import { commitAnchorReRoll } from "../../casting/identity/identityCommit";
import { createModuleLogger } from "../../logging/logger";
import { modelOperationLockKey } from "../../casting/operationContract";
import {
  beginDirectOperation,
  completeDirectOperationFailure,
  completeDirectOperationSuccess,
  failClaimedDirectOperation,
} from "../../casting/directOperation";
const log = createModuleLogger("routes/generation");

export const castingImagingRouter = router({
  // Generate casting image (headshot).
  // Batch C (§10.3/M10): the creation `referenceImage` parameter is GONE —
  // strict input, so a raw caller supplying one is REJECTED before any
  // charge, never silently ignored. A new cast is established from the
  // structured attributes and brief alone; references join after the first
  // headshot, through the guarded iteration path.
  castingImage: protectedProcedure
    .input(z.object({
      clientRequestId: z.string().uuid(),
      modelId: z.number(),
      originBoardId: z.number().int().positive().optional(),
      originItemId: z.number().int().positive().optional(),
    }).strict().superRefine((input, ctx) => {
      if ((input.originBoardId === undefined) !== (input.originItemId === undefined)) {
        ctx.addIssue({
          code: "custom",
          message: "Canvas origin requires both board and item ids",
          path: [input.originBoardId === undefined ? "originBoardId" : "originItemId"],
        });
      }
    }))
    .mutation(async ({ ctx, input }) => {
      // Batch 0 (R6 execution plan, review fix 1): authorization BEFORE money.
      // The old order deducted credits first and threw NOT_FOUND/FORBIDDEN
      // outside the refund path — a rejected request silently kept the
      // deduction. It also never checked status: a raw caller could write a
      // new frontClose onto a MINTED identity (newest-wins headshot swap —
      // the D-43 bypass class) or an archived model. No forbidden request
      // may deduct credits, reach Gemini, or create an asset.
      const model = await getModelById(input.modelId);
      if (!model) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Model not found" });
      }
      if (model.userId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }
      assertNotArchived(model); // FR-4: archived reads as deleted
      const lockKey = modelOperationLockKey(input.modelId);
      const gate = await beginDirectOperation({
        userId: ctx.user.id,
        clientRequestId: input.clientRequestId,
        kind: "casting.headshot",
        modelId: input.modelId,
        originBoardId: input.originBoardId,
        originItemId: input.originItemId,
        payload: { modelId: input.modelId },
        lockKey,
      });
      if (gate.type === "replay") {
        const assetId = (gate.result as { assetId?: unknown } | null)?.assetId;
        const assets = await getModelAssets(input.modelId);
        const asset = assets.find((candidate) => candidate.id === assetId);
        if (!asset) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: `The saved headshot result is no longer available. Operation ${gate.operationId}.`,
          });
        }
        return {
          success: true,
          imageUrl: asset.storageUrl,
          pointsCost: POINT_COSTS.castingImage,
          assetId: asset.id,
        };
      }

      let lockedModel;
      let priorAssets;
      try {
        // Replays bypass admission controls: the work was already admitted
        // and must return its receipt without consuming another rate slot.
        const rateCheck = checkRateLimit(`user:${ctx.user.id}`, RATE_LIMITS.generation);
        if (!rateCheck.allowed) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: rateLimitError(rateCheck.resetIn),
          });
        }
        lockedModel = await getModelById(input.modelId);
        if (!lockedModel) throw new TRPCError({ code: "NOT_FOUND", message: "Model not found" });
        if (lockedModel.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
        assertNotArchived(lockedModel);
        if (lockedModel.status !== "draft") {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: `${lockedModel.name || "This model"} is minted — their headshot is their identity. Fork to explore a new face.`,
          });
        }
        // Daily quota enforcement — prevent one user from exhausting Gemini RPD
        await enforceDailyQuota(ctx.user.id);
        priorAssets = await getModelAssets(input.modelId);
      } catch (error) {
        return failClaimedDirectOperation({ userId: ctx.user.id, operationId: gate.operationId, error });
      }

      // R4 (ratified): a headshot RE-ROLL is an identity-changing anchor
      // operation — resolved BEFORE money so the post-generation writes are
      // deterministic. An empty draft (initial cast) flags nothing.
      const isReRoll = priorAssets.some((a) => a.viewType === "frontClose" && a.storageUrl);

      const started = await markGenerationOperationRunning({
        userId: ctx.user.id,
        operationId: gate.operationId,
        modelId: input.modelId,
        expectedIdentityRevisionId: currentRevisionId(lockedModel),
        plannedCredits: POINT_COSTS.castingImage,
        requiredLockKey: lockKey,
        phase: "generating",
        heartbeat: true,
      });

      // ATOMIC credit deduction BEFORE generation to prevent race conditions
      // Credits are deducted first, then refunded if generation fails. The
      // charge id is captured so every refund derives its own idempotent id
      // from it (review finding 1 — a refund must never reuse the charge id,
      // which the ledger would dedupe against the deduction row and skip).
      // Collision-resistant (correction 7): Date.now() can collide in parallel.
      const chargeReferenceId = started.chargeReferenceId;
      let chargedCredits = 0;
      let refundedCredits = 0;
      const deductResult = await deductPoints(
        ctx.user.id,
        POINT_COSTS.castingImage,
        "generation",
        "Casting image generation (pending)",
        chargeReferenceId
      );

      if (!deductResult.success) {
        return completeDirectOperationFailure({
          userId: ctx.user.id,
          operationId: gate.operationId,
          chargedCredits,
          refundedCredits,
          error: new TRPCError({
            code: "BAD_REQUEST",
            message: deductResult.error || `Insufficient credits. Need ${POINT_COSTS.castingImage} credits.`,
          }),
        });
      }
      chargedCredits = POINT_COSTS.castingImage;

      // Create generation record — a failed audit-row insert is detected and
      // refunded, never dereferenced as an undefined id (review finding 2).
      // Every refund carries its TRUTH to the user (final correction 1).
      const genResult = await createGeneration({
        userId: ctx.user.id,
        modelId: input.modelId,
        operationId: gate.operationId,
        stepKey: "headshot",
        viewAngle: "frontClose",
        type: "castingImage",
        status: "processing",
        pointsCost: POINT_COSTS.castingImage,
      });
      if (!genResult.success || !genResult.generationId) {
        log.error({ modelId: input.modelId }, "[castingImage] createGeneration failed — refunding before generation");
        const outcome = await recordRefund(ctx.user.id, POINT_COSTS.castingImage, "Refund: casting image couldn't start", chargeReferenceId);
        if (outcome.recorded) refundedCredits = POINT_COSTS.castingImage;
        return completeDirectOperationFailure({
          userId: ctx.user.id,
          operationId: gate.operationId,
          chargedCredits,
          refundedCredits,
          error: new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Couldn't start the cast. ${refundTruth(outcome)} Try again.` }),
        });
      }
      const generationId = genResult.generationId;
      let durableSaved = false;

      try {
        // Generate image
        const castingBrand = (lockedModel.technicalSchema as any)?.context?.casting_for || 'Generic';
        const prefs = (lockedModel.preferences || {}) as any;
        const ethnicityHint = buildEthnicityHint(prefs);
        const reinforcedPrompt = buildReinforcedPrompt(lockedModel.masterPrompt, prefs);
        log.info({ castingBrand, modelId: input.modelId, ethnicityHint, hasOverrides: reinforcedPrompt !== lockedModel.masterPrompt }, '[castingImage] Generating with brand');

        const result = await generateCastingImage(
          reinforcedPrompt,
          {
            castingBrand,
            frame: 'HEADSHOT',
            ethnicityHint,
            userId: String(ctx.user.id),
            modelId: input.modelId,
            technicalSchema: lockedModel.technicalSchema ?? undefined,
          }
        );

        log.info({ hasImageUrl: !!result.imageUrl, engineUsed: result.engineUsed }, '[castingImage] Generation result');

        if (!result.imageUrl) {
          log.error('[castingImage] No image URL returned from generation');
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "No image generated",
          });
        }

        // Credits already deducted before generation - no need to deduct again

        // §7 identity stamping (Batch C):
        //  - INITIAL cast headshot ⇒ role `anchor` under the model's current
        //    (genesis) revision — the anchor authority every consumer reads.
        //  - RE-ROLL (R4 ratified) ⇒ an identity-changing anchor operation:
        //    role `anchor`, a NEW identityRevisionId on the model row, and
        //    stale flags on every filled sibling view, PINNED INCLUDED.
        const identityText = buildIdentityAnchor(lockedModel.masterPrompt || "", lockedModel.technicalSchema ?? undefined);
        const anchorValues = {
          modelId: input.modelId,
          viewType: "frontClose" as const,
          resolution: "1K" as const,
          storageUrl: result.imageUrl,
          pointsCost: POINT_COSTS.castingImage,
          provenance: {
            engine: result.engineUsed,
            // Initial cast: anchor under the model's current (genesis) revision
            ...identityStampFor({ role: "anchor", revisionId: currentRevisionId(lockedModel), identityText }),
          },
        };

        let assetResult: { success: boolean; assetId?: number };
        if (isReRoll) {
          // Atomic anchor change (shared R4 commit): new anchor row + new
          // revision + stale flags land together or not at all (§8.6/9).
          const reRoll = await commitAnchorReRoll({
            modelId: input.modelId,
            storageUrl: result.imageUrl,
            pointsCost: POINT_COSTS.castingImage,
            engine: result.engineUsed,
            identityText,
            assets: priorAssets,
          });
          assetResult = { success: true, assetId: reRoll.assetId };
        } else {
          assetResult = await createModelAsset(anchorValues);
          // Review finding 2: the asset row IS the durable paid result — a
          // failed write must never return success/assetId:undefined. Throw
          // into the refund path below (which appends the refund TRUTH).
          if (!assetResult.success || !assetResult.assetId) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "The headshot generated but couldn't be saved.",
            });
          }
        }
        durableSaved = true;

        // The durable result is saved. An audit-row failure past this point
        // is an audit gap, never a refund (review finding 3, invariant 2).
        const auditDone = await updateGeneration(generationId, {
          status: "completed",
          resultUrl: result.imageUrl,
          completedAt: new Date(),
        });
        if (!auditDone.success) {
          log.error(
            { modelId: input.modelId, generationId },
            "[castingImage] audit-row completion write failed AFTER a saved headshot — audit gap, result stands",
          );
        }

        await completeDirectOperationSuccess({
          userId: ctx.user.id,
          operationId: gate.operationId,
          result: {
            modelId: input.modelId,
            assetId: assetResult.assetId!,
            imageUrl: result.imageUrl,
          },
          chargedCredits,
          refundedCredits,
          ...(!isReRoll && input.originBoardId && input.originItemId
            ? { landing: { status: "pending" as const } }
            : {}),
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
        // The asset row is the durable paid result. Receipt finalization owns
        // recovery after this boundary; never refund a result that was saved.
        if (durableSaved) throw error;
        // Refund credits on failure — everything inside the try precedes or
        // IS the durable-result write, so a refund here is always correct.
        // The outgoing message carries the refund TRUTH (final correction 1).
        log.error({ err: error, modelId: input.modelId, generationId }, "[castingImage] failed before the durable boundary");
        const outcome = await recordRefund(ctx.user.id, POINT_COSTS.castingImage, "Refund: failed casting image generation", chargeReferenceId);
        if (outcome.recorded) refundedCredits = POINT_COSTS.castingImage;

        // Raw internal text stays in the audit row + logs (staff surfaces);
        // the client message is sanitized (final corrections).
        const auditFailed = await updateGeneration(generationId, {
          status: "failed",
          errorMessage: error instanceof Error ? error.message : "Unknown error",
          completedAt: new Date(),
        });
        if (!auditFailed.success) {
          log.error({ modelId: input.modelId, generationId }, "[castingImage] audit-row failure write failed — audit gap");
        }
        const baseMessage = publicErrorMessage(error, "Casting failed.");
        return completeDirectOperationFailure({
          userId: ctx.user.id,
          operationId: gate.operationId,
          chargedCredits,
          refundedCredits,
          error: new TRPCError({
            code: error instanceof TRPCError ? error.code : "INTERNAL_SERVER_ERROR",
            message: `${baseMessage} ${refundTruth(outcome)}`,
          }),
        });
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
