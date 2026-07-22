import { protectedProcedure, router } from "../../_core/trpc";
import {
  getModelById, getModelAssets,
  createGeneration, updateGeneration, markGenerationOperationRunning,
} from "../../db";
import {
  iterateModel, iterateModelRaw, uploadRawCandidate, enhanceUserPrompt,
  generateCastingSuggestions, analyzeReferenceForTransfer, FALLBACK_SUGGESTIONS,
  compactMasterPrompt, clearCastingSession,
  POINT_COSTS,
} from "../../casting/aiService";
import { withAtomicCredits, recordRefund, refundTruth } from "../../casting/atomicCredits";
import { enforceDailyQuota } from "../../db/dailyQuota";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { iterateInputSchema } from "./iterateInput";
import { validateProxyUrl } from "../../security/urlValidator";
import { checkRateLimit, RATE_LIMITS, rateLimitError } from "../../security/rateLimit";
import {
  buildEthnicityHint,
  buildIdentityEditReinforcedPrompt,
  buildReinforcedPrompt,
} from "../../casting/promptReinforcement";
import { authorizeEditRequest } from "../../casting/identity/editAuthority";
import {
  assetRevisionMembership,
  currentRevisionId,
  isRestoreCompatible,
  selectDisplayedHeadshot,
  selectIdentityAnchor,
} from "../../casting/identity/anchorSelector";
import { protectedMarkLanguageIntact } from "../../casting/identity/marksVocabulary";
import { REFUSAL_COPY } from "../../casting/identity/refusalCopy";
import { buildIdentityAnchor } from "../../casting/geminiClient";
import { iterationFramingForView } from "../../casting/iterationFraming";
import { assertNotArchived } from "../../casting/modelGuards";
import { createModuleLogger } from "../../logging/logger";
import { staledAnglesForAssetIds } from "../../casting/identity/staleResponse";
import { identityRetryDirective, runGatedIdentityGeneration } from "../../casting/identity/editGateFlow";
import type { IdentityGateVerdict } from "../../casting/identity/editGate";
import { storageDelete } from "../../storage";
import { dependentFieldsForPatch } from "../../casting/identity/identityDependencies";
import { requireIdentityPatch } from "../../casting/identity/identityAuthorizationGuard";
import { modelOperationLockKey } from "../../casting/operationContract";
import {
  clarificationForCastingRefusal,
  parseCastingClarification,
} from "../../../shared/castingClarification";
import {
  beginDirectOperation,
  completeClaimedDirectOperationSuccess,
  completeDirectOperationFailure,
  completeDirectOperationSuccess,
  failClaimedDirectOperation,
} from "../../casting/directOperation";
import { bootstrapModelSnapshot } from "../../casting/snapshotBootstrap";
import {
  commitDocumentCompactionSnapshot,
  commitImageRefineSnapshot,
  commitIteratedIdentitySnapshot,
} from "../../casting/snapshotTransitions";
const log = createModuleLogger("routes/generation");

export const castingRefinementRouter = router({
  // Iterate/refine a model image
  // Wire schema lives in iterateInput.ts (dependency-light so the contract
  // tests import the REAL schema, not a copy)
  iterate: protectedProcedure
    .input(iterateInputSchema)
    .mutation(async ({ ctx, input }) => {
      // MASKED EDITS CLOSED (Batch 0, R6 execution plan): the edit classifier
      // reads only the feedback text, and masked submissions carry fixed or
      // arbitrary text that names no mark — so a mask could change a minted
      // identity (e.g. erase a tattoo) while classifying cosmetic, the exact
      // ungated-write class D-43 sealed. Refused before any money moves, on
      // every view and every status. Re-enablement is gated on the unified
      // classifier/identity-writer boundary (IDENTITY_EDIT_INTERIM_POLICY).
      // Validate model ownership first (cheap operation)
      const model = await getModelById(input.modelId);
      if (!model) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Model not found" });
      }
      if (model.userId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }

      assertNotArchived(model); // FR-4 (Batch 0): archived reads as deleted

      const lockKey = modelOperationLockKey(input.modelId);
      const gate = await beginDirectOperation({
        userId: ctx.user.id,
        clientRequestId: input.clientRequestId,
        kind: "casting.iterate",
        modelId: input.modelId,
        payload: {
          modelId: input.modelId,
          feedback: input.feedback,
          assetId: input.assetId,
          maskBase64: input.maskBase64 ?? null,
          referenceImage: input.referenceImage ?? null,
        },
        lockKey,
      });
      if (gate.type === "replay") {
        const saved = gate.result as {
          assetId?: unknown;
          identityChanged?: unknown;
          staledAngles?: unknown;
          clarification?: unknown;
        } | null;
        const clarification = parseCastingClarification(saved?.clarification);
        if (clarification) {
          return {
            success: false as const,
            clarification,
            pointsCost: 0,
            staledAngles: [],
            staleMessage: null,
          };
        }
        const replayAssets = await getModelAssets(input.modelId);
        const asset = replayAssets.find((candidate) => candidate.id === saved?.assetId);
        if (!asset) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: `The saved edit result is no longer available. Operation ${gate.operationId}.`,
          });
        }
        const identityChanged = saved?.identityChanged === true;
        const staledAngles = Array.isArray(saved?.staledAngles)
          ? saved.staledAngles.filter((angle): angle is string => typeof angle === "string")
          : [];
        const replayModel = identityChanged ? await getModelById(input.modelId) : null;
        return {
          success: true,
          imageUrl: asset.storageUrl,
          pointsCost: POINT_COSTS.iterate,
          ...(identityChanged && replayModel ? {
            masterPrompt: replayModel.masterPrompt,
            technicalSchema: replayModel.technicalSchema,
            preferences: replayModel.preferences,
          } : {}),
          assetId: asset.id,
          staledAngles,
          staleMessage: identityChanged ? REFUSAL_COPY.siblingsNeedRefresh : null,
        };
      }

      // Re-read authority after winning the model lock. Structural or policy
      // refusals below remain free and seal the claimed receipt.
      if (input.maskBase64) {
        log.warn({ userId: ctx.user.id, modelId: input.modelId }, "[iterate] masked submission refused (Batch 0 closure)");
        return failClaimedDirectOperation({
          userId: ctx.user.id,
          operationId: gate.operationId,
          error: new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Masked edits are temporarily unavailable — describe the change in words instead.",
          }),
        });
      }
      const lockedModel = await getModelById(input.modelId).catch((error) =>
        failClaimedDirectOperation({ userId: ctx.user.id, operationId: gate.operationId, error }));
      if (!lockedModel || lockedModel.userId !== ctx.user.id || lockedModel.status === "archived") {
        const error = !lockedModel
          ? new TRPCError({ code: "NOT_FOUND", message: "Model not found" })
          : lockedModel.userId !== ctx.user.id
            ? new TRPCError({ code: "FORBIDDEN", message: "Access denied" })
            : new TRPCError({ code: "NOT_FOUND", message: "Model not found" });
        return failClaimedDirectOperation({ userId: ctx.user.id, operationId: gate.operationId, error });
      }
      try {
        const rateCheck = checkRateLimit(`user:${ctx.user.id}`, RATE_LIMITS.generation);
        if (!rateCheck.allowed) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: rateLimitError(rateCheck.resetIn),
          });
        }
        await enforceDailyQuota(ctx.user.id);
      } catch (error) {
        return failClaimedDirectOperation({ userId: ctx.user.id, operationId: gate.operationId, error });
      }

      // Get the asset being iterated
      const assets = await getModelAssets(input.modelId);
      const targetAsset = assets.find(a => a.id === input.assetId);
      if (!targetAsset) {
        return failClaimedDirectOperation({
          userId: ctx.user.id,
          operationId: gate.operationId,
          error: new TRPCError({ code: "NOT_FOUND", message: "Asset not found" }),
        });
      }

      // V1+V14 (Batch A-coupled): per-view framing from the exhaustive
      // canonical maps — the close trio (frontClose/sideClose/threeQuarter)
      // crops HEADSHOT, the body trio FULL_BODY, and the canonical angle
      // travels with the crop so the prompt preserves THIS view's
      // orientation (a sideClose edit must never be told "straight-on").
      // Resolved HERE, before the generation record and deduction, so a
      // non-canonical legacy viewType refuses instead of silently
      // inheriting a wrong frame. Typed iteration is still an individual
      // selected-image generation against this view's own image
      // (un-composed until canon — no anchor references, no sibling
      // propagation).
      let framing;
      try {
        framing = iterationFramingForView(targetAsset.viewType);
      } catch (error) {
        return failClaimedDirectOperation({ userId: ctx.user.id, operationId: gate.operationId, error });
      }

      // THE SHARED IDENTITY-AUTHORITY BOUNDARY (Batch C, policy §6/§13.1):
      // one server-owned decision for every free-text and reference-assisted
      // instruction — this supersedes the A1 seal's boolean fail-open
      // classifier. Classification, leaf normalization, and every refusal
      // complete HERE, before the generation record, the deduction, and the
      // image-model call, so every refusal class is free (R2, fail-closed).
      // The F4 minted-identity fork copy still flows from the same boundary.
      const anchor = selectIdentityAnchor(assets);
      const displayedHeadshot = selectDisplayedHeadshot(assets);
      const currentIdentityText = buildIdentityAnchor(
        lockedModel.masterPrompt || "",
        lockedModel.technicalSchema ?? undefined,
      );
      const decision = await authorizeEditRequest({
        model: lockedModel,
        targetAsset: { id: targetAsset.id, viewType: targetAsset.viewType },
        anchorAssetId: anchor?.id ?? null,
        displayedHeadshotAssetId: displayedHeadshot?.id ?? null,
        targetBelongsToCurrentIdentity: isRestoreCompatible(
          assetRevisionMembership(targetAsset, lockedModel, currentIdentityText),
        ),
        feedback: input.feedback,
        referenceAttached: !!input.referenceImage,
        referenceImageBase64: input.referenceImage,
      }).catch((error) => failClaimedDirectOperation({
        userId: ctx.user.id,
        operationId: gate.operationId,
        error,
      }));
      if (decision.refused) {
        log.warn(
          { userId: ctx.user.id, modelId: input.modelId, code: decision.code, retryable: decision.retryable },
          "[iterate] refused by the shared identity authority (free, before money)",
        );
        const clarification = clarificationForCastingRefusal(decision.code);
        if (clarification) {
          await completeClaimedDirectOperationSuccess({
            userId: ctx.user.id,
            operationId: gate.operationId,
            result: { clarification },
          });
          return {
            success: false as const,
            clarification,
            pointsCost: 0,
            staledAngles: [],
            staleMessage: null,
          };
        }
        return failClaimedDirectOperation({
          userId: ctx.user.id,
          operationId: gate.operationId,
          error: new TRPCError({ code: "PRECONDITION_FAILED", message: decision.message }),
        });
      }
      const authorization = decision.authorization;
      const identityPatch = requireIdentityPatch(authorization);
      const releasedIdentityDependents = identityPatch
        ? dependentFieldsForPatch(identityPatch)
        : [];

      // R7-7A3 dual-write ordering: converge the current R6 package while
      // this operation owns model:<id>, then capture that exact head on the
      // running receipt. The paid provider call starts only afterwards.
      let snapshotHead: Awaited<ReturnType<typeof bootstrapModelSnapshot>>;
      try {
        snapshotHead = await bootstrapModelSnapshot({ userId: ctx.user.id, modelId: input.modelId });
      } catch (error) {
        return failClaimedDirectOperation({ userId: ctx.user.id, operationId: gate.operationId, error });
      }
      if (snapshotHead.status === "headless") {
        return failClaimedDirectOperation({
          userId: ctx.user.id,
          operationId: gate.operationId,
          error: new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "This Cast has no headshot package to refine.",
          }),
        });
      }

      const generationMetadata = {
        feedback: input.feedback,
        assetId: input.assetId,
        authorizationClass: authorization.class,
        releasedIdentityDependents,
      };
      const genResult = await createGeneration({
        userId: ctx.user.id,
        modelId: input.modelId,
        operationId: gate.operationId,
        stepKey: "iterate",
        viewAngle: targetAsset.viewType,
        type: "iteration",
        status: "processing",
        pointsCost: POINT_COSTS.iterate,
        metadata: generationMetadata,
      });
      // Review finding 2: a failed audit-row insert is detected BEFORE any
      // money moves — never charge while pretending an audit row exists, and
      // never dereference an undefined generation id.
      if (!genResult.success || !genResult.generationId) {
        log.error({ modelId: input.modelId }, "[iterate] createGeneration failed — refused before deduction");
        return failClaimedDirectOperation({
          userId: ctx.user.id,
          operationId: gate.operationId,
          error: new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Couldn't start the edit — you weren't charged. Try again." }),
        });
      }
      const started = await markGenerationOperationRunning({
        userId: ctx.user.id,
        operationId: gate.operationId,
        modelId: input.modelId,
        expectedIdentityRevisionId: currentRevisionId(lockedModel),
        plannedCredits: POINT_COSTS.iterate,
        requiredLockKey: lockKey,
        phase: "generating",
        heartbeat: true,
      });
      const chargeReferenceId = started.chargeReferenceId;
      let chargedCredits = 0;
      let refundedCredits = 0;
      let durableSaved = false;
      const identityGateAudit: Array<{ attempt: 1 | 2; verdict: IdentityGateVerdict }> = [];

      try {
        const result = await withAtomicCredits(
          {
            userId: ctx.user.id,
            amount: POINT_COSTS.iterate,
            description: "Model iteration",
            referenceId: chargeReferenceId,
            onCharged: (amount) => { chargedCredits = amount; },
            onRefunded: (outcome) => {
              if (outcome.recorded) refundedCredits = outcome.amount;
            },
          },
          async () => {
            // The generation prompt reads the CURRENT document. Freeze-and-
            // append is dead (Batch C): identity changes land in the document
            // only through the §8.6 atomic commit below, built from the
            // handler-normalized patch — never by appending the raw sentence,
            // and never by an LLM schema rewrite on the paid path.
            const prefs = (lockedModel.preferences || {}) as any;
            const ethnicityHint = buildEthnicityHint(prefs);
            const reinforcedPrompt = identityPatch
              ? buildIdentityEditReinforcedPrompt(
                  lockedModel.masterPrompt || "",
                  prefs,
                  identityPatch,
                )
              : buildReinforcedPrompt(lockedModel.masterPrompt || "", prefs);

            const commonOptions = {
              castingBrand: (lockedModel.technicalSchema as any)?.context?.casting_for,
              frame: framing.crop,
              viewAngle: framing.viewAngle,
              additionalReference: input.referenceImage,
              policyDirectives: authorization.promptDirectives,
              ethnicityHint,
              userId: String(ctx.user.id),
              modelId: input.modelId,
              technicalSchema: lockedModel.technicalSchema ?? undefined,
            } as const;

            const iterResult = authorization.class === "identity"
              ? await runGatedIdentityGeneration({
                  sourceImage: targetAsset.storageUrl,
                  patch: identityPatch!,
                  frame: framing.crop,
                  modelName: lockedModel.name,
                  generate: (attempt) => {
                    const firstVerdict = identityGateAudit[0]?.verdict;
                    const retryDirectives = attempt === 2 && firstVerdict
                      ? [identityRetryDirective(firstVerdict)]
                      : [];
                    return iterateModelRaw(
                      reinforcedPrompt,
                      targetAsset.storageUrl,
                      input.feedback,
                      {
                        ...commonOptions,
                        policyDirectives: [
                          ...authorization.promptDirectives,
                          ...retryDirectives,
                        ],
                        forceFreshSession: attempt === 2,
                      },
                    );
                  },
                  resetRejectedSession: () => clearCastingSession(String(ctx.user.id), input.modelId),
                  upload: (candidate) => uploadRawCandidate(candidate.imageBase64, "iterate"),
                  onVerdict: (attempt, verdict) => identityGateAudit.push({ attempt, verdict }),
                })
              : await iterateModel(
                  reinforcedPrompt,
                  targetAsset.storageUrl,
                  input.feedback,
                  commonOptions,
                );

            if (!iterResult.imageUrl) {
              throw new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to iterate model",
              });
            }

            return {
              imageUrl: iterResult.imageUrl,
              engineUsed: iterResult.engineUsed,
              storageKey: "storageKey" in iterResult ? iterResult.storageKey : undefined,
            };
          }
        );

        if (authorization.class === "identity") {
          // §8.6 ATOMIC IDENTITY COMMIT: preference patch + schema write +
          // master-description fragments + new anchor asset (role `anchor`)
          // + new identityRevisionId + stale flags on every filled sibling,
          // PINNED INCLUDED (§14 — pinning prevents automatic replacement,
          // not staleness). All-or-nothing: a commit failure rolls back,
          // refunds exactly once (M20 step-9), and leaves no partial
          // identity state.
          let commit;
          try {
            commit = (await commitIteratedIdentitySnapshot({
              userId: ctx.user.id,
              modelId: input.modelId,
              operationId: gate.operationId,
              patch: identityPatch!,
              candidate: {
                targetAssetId: targetAsset.id,
                storageUrl: result.imageUrl,
                storageKey: typeof result.storageKey === "string" ? result.storageKey : undefined,
                pointsCost: POINT_COSTS.iterate,
                engine: result.engineUsed,
              },
            })).result;
          } catch (commitError) {
            // The commit rolled back — no partial identity state survives.
            const uploadedKey = typeof result.storageKey === "string" ? result.storageKey : undefined;
            if (uploadedKey) {
              try {
                const deleted = await storageDelete(uploadedKey);
                if (!deleted.success) {
                  log.error({ modelId: input.modelId, uploadedKey }, "[iterate] passing candidate cleanup failed after commit rollback");
                }
              } catch (cleanupError) {
                log.error({ err: cleanupError, modelId: input.modelId, uploadedKey }, "[iterate] passing candidate cleanup threw after commit rollback");
              }
              clearCastingSession(String(ctx.user.id), input.modelId);
            }
            // Refund under the charge's DERIVED refund id (finding 1), and
            // the outgoing message carries the refund TRUTH (correction 1).
            const outcome = await recordRefund(
              ctx.user.id,
              POINT_COSTS.iterate,
              "Identity edit failed to commit (refund)",
              chargeReferenceId,
            );
            if (outcome.recorded) refundedCredits = outcome.amount;
            log.error(
              { modelId: input.modelId, err: commitError instanceof Error ? commitError.message : String(commitError) },
              "[iterate] identity commit failed — rolled back",
            );
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: `The identity edit couldn't be saved — nothing changed. ${refundTruth(outcome)}`,
            });
          }

          // The identity is durably committed. An audit-row update failure
          // after this point is an audit gap, never a reason to refund or to
          // report the committed result as failed (finding 3, invariant 2).
          const auditDone = await updateGeneration(genResult.generationId, {
            status: "completed",
            resultUrl: result.imageUrl,
            completedAt: new Date(),
            metadata: {
              ...generationMetadata,
              identityGate: {
                attemptCount: identityGateAudit.length,
                verdicts: identityGateAudit,
                releasedIdentityDependents: commit.releasedDependents,
              },
            },
          });
          if (!auditDone.success) {
            log.error(
              { modelId: input.modelId, generationId: genResult.generationId },
              "[iterate] audit-row completion write failed AFTER a committed identity edit — audit gap, result stands",
            );
          }

          const staledAngles = staledAnglesForAssetIds(assets, commit.staledAssetIds);
          durableSaved = true;
          await completeDirectOperationSuccess({
            userId: ctx.user.id,
            operationId: gate.operationId,
            result: { assetId: commit.assetId, identityChanged: true, staledAngles },
            chargedCredits,
            refundedCredits,
          });

          return {
            success: true,
            imageUrl: result.imageUrl,
            pointsCost: POINT_COSTS.iterate,
            masterPrompt: commit.masterPrompt,
            technicalSchema: commit.technicalSchema,
            preferences: commit.preferences,
            assetId: commit.assetId,
            staledAngles,
            staleMessage: REFUSAL_COPY.siblingsNeedRefresh,
          };
        }

        // IMAGE-ONLY (§5.3): a new asset version of the selected view — and
        // nothing else. Identity documents stay byte-unchanged; no
        // compaction, no reconcile, no stale flags. On `frontClose` the
        // result is DISPLAY-ONLY (role `display` + current revision), so the
        // §7 anchor selector ignores it and a refined photo can never
        // silently become the identity reference.
        let assetResult: { assetId: number };
        try {
          assetResult = (await commitImageRefineSnapshot({
            userId: ctx.user.id,
            modelId: input.modelId,
            operationId: gate.operationId,
            candidate: {
              targetAssetId: targetAsset.id,
              storageUrl: result.imageUrl,
              storageKey: typeof result.storageKey === "string" ? result.storageKey : undefined,
              pointsCost: POINT_COSTS.iterate,
              engine: result.engineUsed,
            },
            imageOnlyCategories: authorization.imageOnlyCategories ?? [],
          })).result;
        } catch (commitError) {
          const uploadedKey = typeof result.storageKey === "string" ? result.storageKey : undefined;
          if (uploadedKey) {
            try {
              const deleted = await storageDelete(uploadedKey);
              if (!deleted.success) {
                log.error({ modelId: input.modelId }, "[iterate] image-only candidate cleanup failed after commit rollback");
              }
            } catch (cleanupError) {
              log.error({ err: cleanupError, modelId: input.modelId }, "[iterate] image-only candidate cleanup threw after commit rollback");
            }
          }
          const outcome = await recordRefund(
            ctx.user.id,
            POINT_COSTS.iterate,
            "Model iteration failed to save (refund)",
            chargeReferenceId,
          );
          if (outcome.recorded) refundedCredits = outcome.amount;
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `The edit generated but couldn't be saved. ${refundTruth(outcome)} Try again.`,
            cause: commitError,
          });
        }
        // Review finding 2: the asset ROW is the durable paid result of an
        // image-only edit — if it didn't write, the user paid for nothing
        // usable: refund once (checked) and fail honestly, never return
        // success with a null asset id.
        const auditDone = await updateGeneration(genResult.generationId, {
          status: "completed",
          resultUrl: result.imageUrl,
          completedAt: new Date(),
        });
        if (!auditDone.success) {
          log.error(
            { modelId: input.modelId, generationId: genResult.generationId },
            "[iterate] audit-row completion write failed AFTER a saved image-only edit — audit gap, result stands",
          );
        }

        durableSaved = true;
        await completeDirectOperationSuccess({
          userId: ctx.user.id,
          operationId: gate.operationId,
          result: { assetId: assetResult.assetId, identityChanged: false, staledAngles: [] },
          chargedCredits,
          refundedCredits,
        });

        return {
          success: true,
          imageUrl: result.imageUrl,
          pointsCost: POINT_COSTS.iterate,
          assetId: assetResult.assetId,
          staledAngles: [],
          staleMessage: null,
        };
      } catch (error) {
        if (durableSaved) throw error;
        const auditFailed = await updateGeneration(genResult.generationId, {
          status: "failed",
          errorMessage: error instanceof Error ? error.message : "Unknown error",
          completedAt: new Date(),
          ...(identityGateAudit.length > 0 ? {
            metadata: {
              ...generationMetadata,
              identityGate: {
                attemptCount: identityGateAudit.length,
                verdicts: identityGateAudit,
                releasedIdentityDependents,
              },
            },
          } : {}),
        });
        if (!auditFailed.success) {
          log.error(
            { modelId: input.modelId, generationId: genResult.generationId },
            "[iterate] audit-row failure write failed — audit gap",
          );
        }
        return completeDirectOperationFailure({
          userId: ctx.user.id,
          operationId: gate.operationId,
          error,
          chargedCredits,
          refundedCredits,
        });
      }
    }),

  // Proxy endpoint to fetch S3 images and return as base64 (bypasses CORS)
  // SECURITY: Restricted to trusted S3/CDN domains to prevent SSRF
  proxyImage: protectedProcedure
    .input(z.object({
      imageUrl: z.string().url(),
    }))
    .mutation(async ({ input }) => {
      // Validate URL against allowlist before fetching
      const validation = validateProxyUrl(input.imageUrl);
      if (!validation.valid) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `URL not allowed: ${validation.reason}`,
        });
      }

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
        // Fetch errors can carry the target URL/host detail — logged in
        // full, never sent to the client (final corrections).
        log.error({ err: error }, '[ProxyImage] Error:');
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch image',
        });
      }
    }),

  // Enhance user prompt with AI
  // NOTE: If TypeScript shows errors about this endpoint not existing on the router,
  // restart the TS server / dev server first — it's a known stale-cache issue.
  enhance: protectedProcedure
    .input(z.object({
      prompt: z.string().min(1).max(2000),
    }))
    .mutation(async ({ ctx, input }) => {
      // Rate limit free Gemini calls to protect API quota
      const rateCheck = checkRateLimit(`user:${ctx.user.id}`, RATE_LIMITS.geminiAssist);
      if (!rateCheck.allowed) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: rateLimitError(rateCheck.resetIn),
        });
      }
      try {
        const enhanced = await enhanceUserPrompt(input.prompt);
        return {
          success: true,
          enhancedPrompt: enhanced,
        };
      } catch (error) {
        log.error({ err: error }, "[Enhance] Error:");
        return {
          success: true,
          enhancedPrompt: input.prompt,
        };
      }
    }),

  // ============================================================================
  // Phase 2 Migration: New procedures
  // ============================================================================

  // Generate quick variation suggestions for the current model
  // No credits charged — suggestions are a non-critical UX enhancement
  suggestions: protectedProcedure
    .input(z.object({
      masterPrompt: z.string().min(1),
      imageBase64: z.string().max(10_000_000).optional(),
      activeView: z.string().optional(),
      profileSummary: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Rate limit free Gemini calls to protect API quota
      const rateCheck = checkRateLimit(`user:${ctx.user.id}`, RATE_LIMITS.geminiAssist);
      if (!rateCheck.allowed) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: rateLimitError(rateCheck.resetIn),
        });
      }
      try {
        const suggestions = await generateCastingSuggestions(
          input.masterPrompt,
          input.imageBase64,
          input.activeView,
          input.profileSummary
        );
        return { success: true, suggestions };
      } catch (error) {
        log.error({ err: error }, "[Suggestions] Error:");
        return {
          success: true,
          suggestions: [...FALLBACK_SUGGESTIONS],
        };
      }
    }),

  // Analyze a reference image for transferable attributes
  // No credits charged — analysis is a UX feature
  analyzeReference: protectedProcedure
    .input(z.object({
      referenceImageBase64: z.string().min(1).max(10_000_000),
      currentModelImageBase64: z.string().max(10_000_000).optional(),
      masterPrompt: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Rate limit free Gemini calls to protect API quota
      const rateCheck = checkRateLimit(`user:${ctx.user.id}`, RATE_LIMITS.geminiAssist);
      if (!rateCheck.allowed) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: rateLimitError(rateCheck.resetIn),
        });
      }
      try {
        const attributes = await analyzeReferenceForTransfer(
          input.referenceImageBase64,
          input.currentModelImageBase64,
          input.masterPrompt
        );
        return { success: true, attributes };
      } catch (error) {
        log.error({ err: error }, "[AnalyzeReference] Error:");
        return { success: true, attributes: [] };
      }
    }),

  // Visual reconciliation — DISABLED (Batch C; R7 ratified: KEEP OFF).
  // Reconcile rewrote masterPrompt/technicalSchema from a generated image
  // with no classification — the newest image silently rewrote the identity
  // document. Identity-document updates now happen only inside the §8.6
  // atomic commit behind the shared authority. The procedure refuses (never
  // silently vanishes) so any raw caller learns the truth; the client's
  // auto-fire after every iterate is removed (M4).
  reconcile: protectedProcedure
    .input(z.object({
      modelId: z.number(),
      assetId: z.number().int().positive(),
    }).strict())
    .mutation(async ({ ctx, input }) => {
      log.warn(
        { userId: ctx.user.id, modelId: input.modelId },
        "[Reconcile] refused — automatic reconcile is disabled (R7, Batch C)",
      );
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: REFUSAL_COPY.reconcileDisabled,
      });
    }),

  // Compact a bloated master prompt into a clean single paragraph
  // No credits charged — this is prompt maintenance
  compactPrompt: protectedProcedure
    .input(z.object({
      clientRequestId: z.string().uuid(),
      modelId: z.number(),
    }).strict())
    .mutation(async ({ ctx, input }) => {
      const model = await getModelById(input.modelId);
      if (!model) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Model not found" });
      }
      if (model.userId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }
      assertNotArchived(model); // FR-4 (Batch 0): archived reads as deleted
      const lockKey = modelOperationLockKey(input.modelId);
      const gate = await beginDirectOperation({
        userId: ctx.user.id,
        clientRequestId: input.clientRequestId,
        kind: "casting.compact",
        modelId: input.modelId,
        payload: { modelId: input.modelId },
        lockKey,
      });
      if (gate.type === "replay") {
        const replayModel = await getModelById(input.modelId);
        if (!replayModel || replayModel.userId !== ctx.user.id || replayModel.status === "archived") {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: `The saved compaction result is unavailable. Operation ${gate.operationId}.` });
        }
        return { success: true, masterPrompt: replayModel.masterPrompt };
      }
      const lockedModel = await getModelById(input.modelId);
      if (!lockedModel || lockedModel.userId !== ctx.user.id || lockedModel.status !== "draft") {
        const error = !lockedModel || lockedModel.status === "archived"
          ? new TRPCError({ code: "NOT_FOUND", message: "Model not found" })
          : lockedModel.userId !== ctx.user.id
            ? new TRPCError({ code: "FORBIDDEN", message: "Access denied" })
            : new TRPCError({ code: "PRECONDITION_FAILED", message: "Prompt compaction applies to drafts — a minted identity document is sealed." });
        return failClaimedDirectOperation({ userId: ctx.user.id, operationId: gate.operationId, error });
      }
      const rateCheck = checkRateLimit(`user:${ctx.user.id}`, RATE_LIMITS.geminiAssist);
      if (!rateCheck.allowed) {
        return failClaimedDirectOperation({
          userId: ctx.user.id,
          operationId: gate.operationId,
          error: new TRPCError({ code: "TOO_MANY_REQUESTS", message: rateLimitError(rateCheck.resetIn) }),
        });
      }
      // R7-7A3 lazy bootstrap happens after the free draft/rate gates and
      // while this operation owns model:<id>, but before the running receipt
      // captures its expected snapshot head. It changes no R6 read behavior.
      let snapshotHead: Awaited<ReturnType<typeof bootstrapModelSnapshot>>;
      try {
        snapshotHead = await bootstrapModelSnapshot({ userId: ctx.user.id, modelId: input.modelId });
      } catch (error) {
        return failClaimedDirectOperation({ userId: ctx.user.id, operationId: gate.operationId, error });
      }
      if (snapshotHead.status === "headless") {
        return failClaimedDirectOperation({
          userId: ctx.user.id,
          operationId: gate.operationId,
          error: new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Generate a headshot before compacting this Cast's identity document.",
          }),
        });
      }
      await markGenerationOperationRunning({
        userId: ctx.user.id,
        operationId: gate.operationId,
        modelId: input.modelId,
        expectedIdentityRevisionId: currentRevisionId(lockedModel),
        plannedCredits: 0,
        requiredLockKey: lockKey,
        phase: "reconciling",
        heartbeat: true,
      });

      const currentPrompt = lockedModel.masterPrompt || "";
      const currentSchema = lockedModel.technicalSchema || {};
      let durableResult = false;

      try {
        const compacted = await compactMasterPrompt(currentPrompt, currentSchema);

        // PROTECTED-LANGUAGE GUARD (Batch C, §13.4/M5): compaction is an LLM
        // rewrite — if it removes or paraphrases away any mark family the
        // document carries (tattoos, scars, freckles, piercings…), the
        // rewrite is REJECTED and the raw text kept. A marked document must
        // never lose its marks to maintenance.
        if (!protectedMarkLanguageIntact(currentPrompt, compacted)) {
          log.warn(
            { modelId: input.modelId },
            "[CompactPrompt] rejected — compaction dropped protected mark language; raw text kept",
          );
          const result = {
            success: true,
            masterPrompt: currentPrompt,
            protectedLanguageKept: true,
          };
          durableResult = true;
          await completeDirectOperationSuccess({ userId: ctx.user.id, operationId: gate.operationId, result: { unchanged: true }, chargedCredits: 0, refundedCredits: 0 });
          return result;
        }

        if (compacted === currentPrompt) {
          const result = { success: true, masterPrompt: currentPrompt };
          durableResult = true;
          await completeDirectOperationSuccess({
            userId: ctx.user.id,
            operationId: gate.operationId,
            result: { unchanged: true },
            chargedCredits: 0,
            refundedCredits: 0,
          });
          return result;
        }

        const committed = await commitDocumentCompactionSnapshot({
          userId: ctx.user.id,
          modelId: input.modelId,
          operationId: gate.operationId,
          compactedMasterPrompt: compacted,
        });

        const result = {
          success: true,
          masterPrompt: committed.result.masterPrompt,
        };
        durableResult = true;
        await completeDirectOperationSuccess({ userId: ctx.user.id, operationId: gate.operationId, result: { unchanged: false }, chargedCredits: 0, refundedCredits: 0 });
        return result;
      } catch (error) {
        if (durableResult) throw error;
        log.error({ err: error }, "[CompactPrompt] Error:");
        return completeDirectOperationFailure({
          userId: ctx.user.id,
          operationId: gate.operationId,
          chargedCredits: 0,
          refundedCredits: 0,
          error: error instanceof TRPCError
            ? error
            : new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to compact prompt",
              }),
        });
      }
    }),

  // Clear the in-memory chat session — resets Gemini conversation state
  // No credits charged — session management
  clearSession: protectedProcedure
    .mutation(async ({ ctx }) => {
      try {
        clearCastingSession(String(ctx.user.id));
        return { success: true };
      } catch (error) {
        log.error({ err: error }, "[ClearSession] Error:");
        return { success: true };
      }
    }),
});
