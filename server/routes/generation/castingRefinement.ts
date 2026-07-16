import { protectedProcedure, router } from "../../_core/trpc";
import {
  getModelById, createModelAsset, getModelAssets, markModelAssetsStale,
  createGeneration, updateGeneration, updateModel,
} from "../../db";
import {
  generateMasterPrompt, iterateModel, enhanceUserPrompt, upscaleImage,
  generateCastingSuggestions, analyzeReferenceForTransfer, FALLBACK_SUGGESTIONS,
  reconcileSchemaWithImage, compactMasterPrompt, clearCastingSession,
  updateSchemaForIteration,
  POINT_COSTS, ImageResolution,
} from "../../casting/aiService";
import { withAtomicCredits } from "../../casting/atomicCredits";
import { enforceDailyQuota } from "../../db/dailyQuota";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { validateProxyUrl } from "../../security/urlValidator";
import { checkRateLimit, RATE_LIMITS, rateLimitError } from "../../security/rateLimit";
import { buildEthnicityHint, buildReinforcedPrompt } from "../../casting/promptReinforcement";
import { classifyEditIdentityImpact, shouldRefuseIteration, selectStaleSiblingHeads } from "../../casting/editClassifier";
import { iterationFramingForView } from "../../casting/iterationFraming";
import { assertNotArchived } from "../../casting/modelGuards";
import { createModuleLogger } from "../../logging/logger";
const log = createModuleLogger("routes/generation");

export const castingRefinementRouter = router({
  // Iterate/refine a model image
  iterate: protectedProcedure
    .input(z.object({
      modelId: z.number(),
      feedback: z.string().min(1),
      assetId: z.number(),
      maskBase64: z.string().max(10_000_000).optional(),
      referenceImage: z.string().max(10_000_000).optional(),
    }))
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

      // A1 SEAL (VC-R5 follow-up, D-43): a minted identity is immutable —
      // an identity-level edit typed against one view would rewrite who this
      // person is outside the D-11 ceremony AND become the canonical view by
      // newest-wins. Refused BEFORE any money moves; cosmetic refinements
      // stay allowed (D-43.2). Drafts stay freely editable — but the SAME
      // classifier verdict doubles as the stales-siblings line (F6): a
      // divergent addition on one draft view marks the other filled slots
      // out of sync, so the package can never silently diverge again.
      const classification = await classifyEditIdentityImpact(input.feedback);
      if (model.status !== "draft") {
        if (shouldRefuseIteration(model.status, classification)) {
          // F4 copy (founder): the refusal teaches the doors — marks ARE
          // possible at casting time (brief free text → minted identity, all
          // views inherit) or on a draft; the client renders the fork door
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: `This changes who ${model.name || "this model"} is — their identity is minted. Fork to explore it, or include it at casting time.`,
          });
        }
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
        const result = await withAtomicCredits(
          {
            userId: ctx.user.id,
            amount: POINT_COSTS.iterate,
            description: "Model iteration",
            referenceId: `gen-${genResult.generationId}`,
          },
          async () => {
            // ── FREEZE-AND-APPEND (matches SOT) ──
            // Append user amendment to existing prompt instead of regenerating.
            // This preserves the original prompt's nuances.
            let rawPrompt = (model.masterPrompt || '') + `\n\nAPPLIED MODIFICATION: ${input.feedback}`;

            // Count amendments — compact every 5 to prevent contradictory bloat
            const amendmentCount = (rawPrompt.match(/APPLIED MODIFICATION:/g) || []).length;
            let updatedMasterPrompt: string;
            if (amendmentCount >= 5) {
              updatedMasterPrompt = await compactMasterPrompt(rawPrompt, model.technicalSchema || {});
            } else {
              updatedMasterPrompt = rawPrompt;
            }

            // Surgically update only affected schema fields (for PDF stats)
            const updatedSchema = await updateSchemaForIteration(
              model.technicalSchema || {},
              input.feedback
            );

            // Build ethnicityHint and CASTING OVERRIDES for image model
            const prefs = (model.preferences || {}) as any;
            const ethnicityHint = buildEthnicityHint(prefs);
            const reinforcedPrompt = buildReinforcedPrompt(updatedMasterPrompt, prefs);

            const iterResult = await iterateModel(
              reinforcedPrompt,
              targetAsset.storageUrl,
              input.feedback,
              {
                castingBrand: (model.technicalSchema as any)?.context?.casting_for,
                frame: framing.crop,
                viewAngle: framing.viewAngle,
                maskBase64: input.maskBase64,
                additionalReference: input.referenceImage,
                ethnicityHint,
                userId: String(ctx.user.id),
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

        // F6 stale-writer (the D-53 rider's motivating case): an identity-
        // classified edit on a DRAFT view diverges the package — mark each
        // OTHER angle's head row stale so the read side (tile dimming, the
        // {N} stale segment, bulk refresh) lights up. Cosmetic edits mark
        // nothing (D-43.2 — staleness spam is the failure mode). Pinned rows
        // are exempt: accepted-final work feels no staleness pressure.
        if (model.status === "draft" && classification.identityLevel) {
          const staleIds = selectStaleSiblingHeads(assets, targetAsset.viewType);
          if (staleIds.length > 0) {
            const marked = await markModelAssetsStale(staleIds);
            if (!marked.success) {
              log.error(
                { modelId: input.modelId, staleIds },
                "[iterate] stale-writer failed — draft package may silently diverge",
              );
            }
          }
        }

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

  // Upscale existing image
  upscale: protectedProcedure
    .input(z.object({
      imageUrl: z.string(),
      resolution: z.enum(['1K', '2K', '4K']),
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

      const upscaleCost = POINT_COSTS.iterate;
      const referenceId = `upscale-${Date.now()}`;

      try {
        const result = await withAtomicCredits(
          {
            userId: ctx.user.id,
            amount: upscaleCost,
            description: `Upscale to ${input.resolution}`,
            referenceId,
          },
          async () => {
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
        log.error({ err: error }, "[Upscale] Error:");
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to upscale image",
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
        log.error({ err: error }, '[ProxyImage] Error:');
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to fetch image',
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

  // Visual reconciliation — correct schema/description to match actual image
  // No credits charged — this is data correction, not generation.
  // Batch 0 (B0.3/B0.4, R6 execution plan + review fix 4): this procedure
  // was an unguarded identity-document writer AND an SSRF hole — it fetched
  // a CLIENT-SUPPLIED URL server-side and rewrote masterPrompt/
  // technicalSchema with no status guard (a raw caller could rewrite a
  // MINTED identity). It now takes an OWNED ASSET ID — the asset the caller
  // just generated/iterated — and derives the stored URL server-side, so
  // reconciliation still targets the image that actually changed (a body
  // iterate reconciles against the body result, not the headshot) while no
  // client URL ever crosses the boundary. Strict input: the legacy imageUrl
  // shape is REJECTED, not ignored. Drafts only (D-43).
  reconcile: protectedProcedure
    .input(z.object({
      modelId: z.number(),
      assetId: z.number().int().positive(),
    }).strict())
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
      // D-43: a minted identity document changes only through the ceremony
      if (model.status !== "draft") {
        log.warn({ modelId: input.modelId }, "[Reconcile] refused — model is not a draft");
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Reconcile applies to drafts — a minted identity document is sealed.",
        });
      }

      // Server-derived image: the identified asset must belong to THIS
      // caller-owned model and carry a stored URL
      const modelAssets = await getModelAssets(input.modelId);
      const targetAsset = modelAssets.find((a) => a.id === input.assetId && a.storageUrl);
      if (!targetAsset) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Asset not found" });
      }
      // Defense in depth: the stored URL should always be our own public
      // bucket, but it still passes the SSRF allowlist before any fetch
      const urlCheck = validateProxyUrl(targetAsset.storageUrl);
      if (!urlCheck.valid) {
        log.warn({ modelId: input.modelId, assetId: input.assetId, reason: urlCheck.reason }, "[Reconcile] stored asset URL failed validation");
        throw new TRPCError({ code: "BAD_REQUEST", message: "Stored image URL failed validation" });
      }

      const imgResp = await fetch(targetAsset.storageUrl);
      if (!imgResp.ok) throw new TRPCError({ code: "BAD_REQUEST", message: "Failed to fetch image" });
      const imgBuf = Buffer.from(await imgResp.arrayBuffer());
      const contentType = imgResp.headers.get('content-type') || 'image/png';
      const imageBase64 = `data:${contentType};base64,${imgBuf.toString('base64')}`;

      const currentSchema = model.technicalSchema || {};
      const currentPrompt = model.masterPrompt || "";

      try {
        const { schema, description } = await reconcileSchemaWithImage(
          currentSchema,
          imageBase64,
          currentPrompt
        );

        const written = await updateModel(input.modelId, {
          masterPrompt: description,
          technicalSchema: schema,
        });
        if (!written.success) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to save reconciled schema" });
        }

        return {
          success: true,
          schema,
          description,
        };
      } catch (error) {
        log.error({ err: error }, "[Reconcile] Error:");
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to reconcile schema",
        });
      }
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
