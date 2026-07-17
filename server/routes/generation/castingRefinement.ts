import { protectedProcedure, router } from "../../_core/trpc";
import {
  getModelById, createModelAsset, getModelAssets,
  createGeneration, updateGeneration, updateModel,
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
import { buildEthnicityHint, buildReinforcedPrompt } from "../../casting/promptReinforcement";
import { authorizeEditRequest } from "../../casting/identity/editAuthority";
import { commitIdentityEdit } from "../../casting/identity/identityCommit";
import {
  currentRevisionId,
  identityStampFor,
  selectIdentityAnchor,
} from "../../casting/identity/anchorSelector";
import { protectedMarkLanguageIntact } from "../../casting/identity/marksVocabulary";
import { REFUSAL_COPY } from "../../casting/identity/refusalCopy";
import { buildIdentityAnchor } from "../../casting/geminiClient";
import { iterationFramingForView } from "../../casting/iterationFraming";
import { assertNotArchived } from "../../casting/modelGuards";
import { createModuleLogger } from "../../logging/logger";
import { executePaidUpscale, normalizeUpscaleError } from "../../casting/upscaleService";
import { staledAnglesForAssetIds } from "../../casting/identity/staleResponse";
import { runGatedIdentityGeneration } from "../../casting/identity/editGateFlow";
import type { IdentityGateVerdict } from "../../casting/identity/editGate";
import { storageDelete } from "../../storage";
import { dependentFieldsForPatch } from "../../casting/identity/identityDependencies";
import { requireIdentityPatch } from "../../casting/identity/identityAuthorizationGuard";
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
      if (input.maskBase64) {
        log.warn({ userId: ctx.user.id, modelId: input.modelId }, "[iterate] masked submission refused (Batch 0 closure)");
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Masked edits are temporarily unavailable — describe the change in words instead.",
        });
      }

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

      // Validate model ownership first (cheap operation)
      const model = await getModelById(input.modelId);
      if (!model) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Model not found" });
      }
      if (model.userId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }

      assertNotArchived(model); // FR-4 (Batch 0): archived reads as deleted

      // Get the asset being iterated
      const assets = await getModelAssets(input.modelId);
      const targetAsset = assets.find(a => a.id === input.assetId);
      if (!targetAsset) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Asset not found" });
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
      const framing = iterationFramingForView(targetAsset.viewType);

      // THE SHARED IDENTITY-AUTHORITY BOUNDARY (Batch C, policy §6/§13.1):
      // one server-owned decision for every free-text and reference-assisted
      // instruction — this supersedes the A1 seal's boolean fail-open
      // classifier. Classification, leaf normalization, and every refusal
      // complete HERE, before the generation record, the deduction, and the
      // image-model call, so every refusal class is free (R2, fail-closed).
      // The F4 minted-identity fork copy still flows from the same boundary.
      const anchor = selectIdentityAnchor(assets);
      const decision = await authorizeEditRequest({
        model,
        targetAsset: { id: targetAsset.id, viewType: targetAsset.viewType },
        anchorAssetId: anchor?.id ?? null,
        feedback: input.feedback,
        referenceAttached: !!input.referenceImage,
        referenceImageBase64: input.referenceImage,
      });
      if (decision.refused) {
        log.warn(
          { userId: ctx.user.id, modelId: input.modelId, code: decision.code, retryable: decision.retryable },
          "[iterate] refused by the shared identity authority (free, before money)",
        );
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: decision.message });
      }
      const authorization = decision.authorization;
      const identityPatch = requireIdentityPatch(authorization);
      const releasedIdentityDependents = identityPatch
        ? dependentFieldsForPatch(identityPatch)
        : [];

      const generationMetadata = {
        feedback: input.feedback,
        assetId: input.assetId,
        authorizationClass: authorization.class,
        releasedIdentityDependents,
      };
      const genResult = await createGeneration({
        userId: ctx.user.id,
        modelId: input.modelId,
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
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Couldn't start the edit — you weren't charged. Try again." });
      }
      const chargeReferenceId = `gen-${genResult.generationId}`;
      const identityGateAudit: Array<{ attempt: 1 | 2; verdict: IdentityGateVerdict }> = [];

      try {
        const result = await withAtomicCredits(
          {
            userId: ctx.user.id,
            amount: POINT_COSTS.iterate,
            description: "Model iteration",
            referenceId: chargeReferenceId,
          },
          async () => {
            // The generation prompt reads the CURRENT document. Freeze-and-
            // append is dead (Batch C): identity changes land in the document
            // only through the §8.6 atomic commit below, built from the
            // handler-normalized patch — never by appending the raw sentence,
            // and never by an LLM schema rewrite on the paid path.
            const prefs = (model.preferences || {}) as any;
            const ethnicityHint = buildEthnicityHint(prefs);
            const reinforcedPrompt = buildReinforcedPrompt(model.masterPrompt || "", prefs);

            const commonOptions = {
              castingBrand: (model.technicalSchema as any)?.context?.casting_for,
              frame: framing.crop,
              viewAngle: framing.viewAngle,
              additionalReference: input.referenceImage,
              policyDirectives: authorization.promptDirectives,
              ethnicityHint,
              userId: String(ctx.user.id),
              modelId: input.modelId,
              technicalSchema: model.technicalSchema ?? undefined,
            } as const;

            const iterResult = authorization.class === "identity"
              ? await runGatedIdentityGeneration({
                  sourceImage: targetAsset.storageUrl,
                  patch: identityPatch!,
                  frame: framing.crop,
                  modelName: model.name,
                  generate: (attempt) => iterateModelRaw(
                    reinforcedPrompt,
                    targetAsset.storageUrl,
                    input.feedback,
                    { ...commonOptions, forceFreshSession: attempt === 2 },
                  ),
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
            commit = await commitIdentityEdit({
              model,
              patch: identityPatch!,
              newAnchor: {
                storageUrl: result.imageUrl,
                pointsCost: POINT_COSTS.iterate,
                engine: result.engineUsed,
                inputs: [{ viewAngle: targetAsset.viewType, imageUrl: targetAsset.storageUrl }],
              },
              assets,
            });
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

          return {
            success: true,
            imageUrl: result.imageUrl,
            pointsCost: POINT_COSTS.iterate,
            masterPrompt: commit.masterPrompt,
            technicalSchema: commit.technicalSchema,
            assetId: commit.assetId,
            staledAngles: staledAnglesForAssetIds(assets, commit.staledAssetIds),
            staleMessage: REFUSAL_COPY.siblingsNeedRefresh,
          };
        }

        // IMAGE-ONLY (§5.3): a new asset version of the selected view — and
        // nothing else. Identity documents stay byte-unchanged; no
        // compaction, no reconcile, no stale flags. On `frontClose` the
        // result is DISPLAY-ONLY (role `display` + current revision), so the
        // §7 anchor selector ignores it and a refined photo can never
        // silently become the identity reference.
        const assetResult = await createModelAsset({
          modelId: input.modelId,
          viewType: targetAsset.viewType,
          resolution: "1K",
          storageUrl: result.imageUrl,
          pointsCost: POINT_COSTS.iterate,
          provenance: {
            inputs: [{ viewAngle: targetAsset.viewType, imageUrl: targetAsset.storageUrl }],
            engine: result.engineUsed,
            imageOnlyCategories: authorization.imageOnlyCategories ?? [],
            ...identityStampFor({
              role: "display",
              revisionId: currentRevisionId(model),
              identityText: buildIdentityAnchor(model.masterPrompt || "", model.technicalSchema ?? undefined),
            }),
          },
        });
        // Review finding 2: the asset ROW is the durable paid result of an
        // image-only edit — if it didn't write, the user paid for nothing
        // usable: refund once (checked) and fail honestly, never return
        // success with a null asset id.
        if (!assetResult.success || !assetResult.assetId) {
          const outcome = await recordRefund(
            ctx.user.id,
            POINT_COSTS.iterate,
            "Model iteration failed to save (refund)",
            chargeReferenceId,
          );
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `The edit generated but couldn't be saved. ${refundTruth(outcome)} Try again.`,
          });
        }

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

        return {
          success: true,
          imageUrl: result.imageUrl,
          pointsCost: POINT_COSTS.iterate,
          assetId: assetResult.assetId,
          staledAngles: [],
          staleMessage: null,
        };
      } catch (error) {
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
        throw error;
      }
    }),

  // Upscale existing image
  upscale: protectedProcedure
    .input(z.object({
      imageUrl: z.string(),
      // Original-resolution export is free and never calls this paid route.
      resolution: z.enum(['2K', '4K']),
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

      try {
        const result = await executePaidUpscale({ userId: ctx.user.id, ...input });

        return {
          success: true,
          imageUrl: result.imageUrl,
        };
      } catch (error) {
        log.error({ err: error }, "[Upscale] Error:");
        throw normalizeUpscaleError(error);
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
      modelId: z.number(),
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
      const model = await getModelById(input.modelId);
      if (!model) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Model not found" });
      }
      if (model.userId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }
      assertNotArchived(model); // FR-4 (Batch 0): archived reads as deleted
      // Batch 0 (B0.3): compaction is an LLM rewrite of the identity
      // document — sealed after mint (D-43), same boundary as reconcile
      if (model.status !== "draft") {
        log.warn({ modelId: input.modelId }, "[CompactPrompt] refused — model is not a draft");
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Prompt compaction applies to drafts — a minted identity document is sealed.",
        });
      }

      const currentPrompt = model.masterPrompt || "";
      const currentSchema = model.technicalSchema || {};

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
          return {
            success: true,
            masterPrompt: currentPrompt,
            protectedLanguageKept: true,
          };
        }

        const written = await updateModel(input.modelId, {
          masterPrompt: compacted,
        });
        if (!written.success) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to save compacted prompt" });
        }

        return {
          success: true,
          masterPrompt: compacted,
        };
      } catch (error) {
        log.error({ err: error }, "[CompactPrompt] Error:");
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to compact prompt",
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
