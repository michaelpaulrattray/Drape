import { publicProcedure, protectedProcedure, router } from "../../_core/trpc";
import {
  getModelById, getUserGenerations, getUserById, getModelAssets,
  markGenerationOperationRunning, assertGenerationOperationSnapshotHead,
} from "../../db";
import { CREDIT_COSTS, POINT_COSTS } from "../../casting/aiService";
import {
  planMintPackage,
  executeMintPackage,
  getPackageState,
  executeSetSlotPinned,
  getSlotVersions,
  executeRestoreSlotVersion,
} from "../../casting/mintPackage";
import { planRefreshSlots, executeRefreshSlots } from "../../casting/refreshSlots";
import { assertNotArchived } from "../../casting/modelGuards";
import { CANONICAL_VIEW_ANGLES } from "../../../shared/boardTypes";
import { resolveExportEligibility, MISSING_AGENCY_ID_COPY } from "../../../shared/exportEligibility";
import { enforceDailyQuota } from "../../db/dailyQuota";
import { checkRateLimit, RATE_LIMITS, rateLimitError } from "../../security/rateLimit";
import { generatePremiumIdentityPdf, PdfModelData } from "../../casting/pdfService";
import { resolvePdfPreferences } from "../../casting/pdfPreferences";
import { buildExportPlan } from "../../../shared/exportPlan";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createModuleLogger } from "../../logging/logger";
import { currentRevisionId } from "../../casting/identity/anchorSelector";
import { modelOperationLockKey } from "../../casting/operationContract";
import {
  beginDirectOperation,
  completeDirectOperationFailure,
  completeDirectOperationSuccess,
  failClaimedDirectOperation,
} from "../../casting/directOperation";
import { bootstrapModelSnapshot } from "../../casting/snapshotBootstrap";
import { captureSnapshotReadMode } from "../../casting/snapshotReadScope";
import { resolveEffectiveCastStateForRead } from "../../casting/effectiveCastRead";
import { prepareRestoreSlotTransition } from "../../casting/restoreSlotTransition";
import {
  resolveSnapshotPdfImages,
  SnapshotPdfImageError,
} from "../../casting/snapshotPdfImages";
const log = createModuleLogger("routes/generation");

export const castingExportRouter = router({
  // Get generation history
  history: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(50) }).optional())
    .query(async ({ ctx, input }) => {
      const generations = await getUserGenerations(ctx.user.id, input?.limit ?? 50);
      return generations;
    }),

  // Get point costs for all generation types
  costs: publicProcedure.query(() => POINT_COSTS),

  /** D-15 export price authority. The server counts the current filled
   *  canonical package slots and derives the paid tier from CREDIT_COSTS. */
  exportPlan: protectedProcedure
    .input(z.object({ modelId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const readMode = captureSnapshotReadMode(ctx.user.id);
      const state = await getPackageState({
        userId: ctx.user.id,
        modelId: input.modelId,
        readMode,
      });
      const viewCount = state.slots.filter((slot) => slot.filled && slot.url).length;
      return buildExportPlan(viewCount, CREDIT_COSTS.upscale);
    }),

  // Generate premium identity PDF document
  generatePdf: protectedProcedure
    .input(z.object({
      modelId: z.number(),
      images: z.object({
        headshot: z.string().optional(),
        threeQuarter: z.string().optional(), // audit V3: the D-39 slot the era-0 map dropped
        fullBody: z.string().optional(),
        profile: z.string().optional(),
        walk: z.string().optional(),
        back: z.string().optional(),
      }),
    }))
    .mutation(async ({ ctx, input }) => {
      const readMode = captureSnapshotReadMode(ctx.user.id);
      const effective = readMode === "snapshot"
        ? await resolveEffectiveCastStateForRead({
            userId: ctx.user.id,
            modelId: input.modelId,
          })
        : null;
      // R6 keeps the existing owner/row path. Snapshot mode obtains the same
      // row only through the non-leaking, fail-closed effective-state resolver.
      const model = effective?.model ?? await getModelById(input.modelId);
      if (!model) throw new TRPCError({ code: "NOT_FOUND", message: "Model not found" });
      if (readMode === "r6" && model.userId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }
      // FR-4 first: archived reads as deleted (NOT_FOUND, never a mint hint)
      assertNotArchived(model);
      // Batch 0 (FR-2A, review fix 6) / Batch B final round: the identity
      // document is a minted-identity artifact, gated by the ONE shared
      // export contract (shared/exportEligibility — the same resolver the
      // client hooks run). Minted state is STATUS truth ('active' or the
      // legacy 'locked' alias); the agencyId is this export's SEPARATE
      // integrity requirement (the dossier prints it), and whitespace-only
      // IDs count as missing. The two refusals are DISTINCT: unminted routes
      // to the mint door; a minted row missing its ID gets the repair copy —
      // re-minting is not the fix and no fake ID is ever printed.
      const eligibility = resolveExportEligibility(model);
      if (!eligibility.ok) {
        log.warn(
          { modelId: input.modelId, status: model.status, hasAgencyId: !!model.agencyId?.trim(), reason: eligibility.reason },
          "[generatePdf] refused — export ineligible",
        );
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            eligibility.reason === "not_minted"
              ? "Name & mint this model to export the identity pack."
              : MISSING_AGENCY_ID_COPY,
        });
      }
      // The resolver's verified, trimmed ID is the only ID the PDF carries
      const exportId = eligibility.agencyId;

      // Get user info for owner details
      const user = await getUserById(ctx.user.id);
      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      const identity = effective?.status === "current" ? effective.identity : null;
      const prefs = resolvePdfPreferences(
        identity?.technicalSchema ?? model.technicalSchema,
        identity?.preferences ?? model.preferences,
      );
      let images = input.images;
      if (readMode === "snapshot") {
        if (!effective || effective.status !== "current") {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "This Cast has no saved identity package to export.",
          });
        }
        try {
          images = await resolveSnapshotPdfImages(effective.selectedViews);
        } catch (error) {
          if (!(error instanceof SnapshotPdfImageError)) throw error;
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: `${error.message} No credits were used.`,
            cause: error,
          });
        }
      }

      // Prepare PDF data
      const pdfData: PdfModelData = {
        modelName: model.name?.trim() || 'Unnamed Model',
        agencyId: exportId,
        sessionId: `SES-${model.id}`,
        createdAt: model.createdAt?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
        mintedAt: model.mintedAt?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
        ownerName: user.displayName || user.name || 'Unknown',
        ownerId: user.openId,
        masterPrompt: identity?.masterPrompt ?? (model.masterPrompt || 'No master prompt available'),
        preferences: prefs,
        images,
      };

      // Generate PDF
      const pdfBuffer = await generatePremiumIdentityPdf(pdfData);

      // Convert to base64 for transfer
      const base64Pdf = Buffer.from(pdfBuffer).toString('base64');

      return {
        success: true,
        pdfBase64: base64Pdf,
        filename: `LEGAL_IDENTITY_${exportId}.pdf`,
      };
    }),

  /** D-39 tiered mint (R3b): per-tier costs over MISSING slots — upgrade
   *  anytime at the same price. Costs derive from CREDIT_COSTS (D-15). */
  mintPackagePlan: protectedProcedure
    .input(z.object({ modelId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const readMode = captureSnapshotReadMode(ctx.user.id);
      return planMintPackage({ userId: ctx.user.id, modelId: input.modelId, readMode });
    }),

  /** D-39 tiered mint execute: generates the tier's missing views (back
   *  views pass the identity gate, retry-then-refund), names + mints. */
  mintPackage: protectedProcedure
    .input(z.object({
      clientRequestId: z.string().uuid(),
      modelId: z.number().int().positive(),
      tier: z.enum(["draft", "core", "production"]),
      // Optional when staying a draft (trap ruling (a)) — the name belongs
      // to the deliberate mint moment, not to adding views
      characterName: z.string().trim().min(1).max(128).optional(),
      mint: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const readMode = captureSnapshotReadMode(ctx.user.id);
      const initialModel = await getModelById(input.modelId);
      if (!initialModel) throw new TRPCError({ code: "NOT_FOUND", message: "Model not found" });
      if (initialModel.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      assertNotArchived(initialModel);

      const kind = input.mint === false ? "casting.add_views" : "casting.mint";
      const lockKey = modelOperationLockKey(input.modelId);
      const gate = await beginDirectOperation({
        userId: ctx.user.id,
        clientRequestId: input.clientRequestId,
        kind,
        modelId: input.modelId,
        payload: {
          modelId: input.modelId,
          tier: input.tier,
          characterName: input.characterName?.trim() || null,
          mint: input.mint !== false,
        },
        lockKey,
      });
      if (gate.type === "replay") {
        const saved = gate.result as {
          agencyId?: unknown;
          minted?: unknown;
          tier?: unknown;
          generated?: unknown;
          failedAngles?: unknown;
          mintAborted?: unknown;
        } | null;
        const assets = await getModelAssets(input.modelId);
        const generatedRows = Array.isArray(saved?.generated) ? saved.generated : [];
        const generated = generatedRows.flatMap((row) => {
          const item = row as { angle?: unknown; assetId?: unknown };
          const asset = assets.find((candidate) => candidate.id === item.assetId);
          return asset && typeof item.angle === "string"
            ? [{ angle: item.angle as (typeof CANONICAL_VIEW_ANGLES)[number], imageUrl: asset.storageUrl, assetId: asset.id }]
            : [];
        });
        const state = await getPackageState({
          userId: ctx.user.id,
          modelId: input.modelId,
          readMode,
        });
        const failedAngles = Array.isArray(saved?.failedAngles) ? saved.failedAngles : [];
        const failed = state.slots.flatMap((slot) =>
          failedAngles.includes(slot.angle) && slot.failed
            ? [{ angle: slot.angle, label: slot.label, ...slot.failed, markerPersisted: true }]
            : []);
        return {
          agencyId: typeof saved?.agencyId === "string" ? saved.agencyId : null,
          minted: saved?.minted === true,
          tier: input.tier,
          generated,
          failed,
          ...(saved?.mintAborted === true ? { mintAborted: true as const, message: "Minting paused — retry the failed view first." } : {}),
        };
      }

      let lockedModel;
      let plan;
      try {
        if (input.mint !== false && !input.characterName) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "A name is required to mint" });
        }
        const rate = checkRateLimit(`user:${ctx.user.id}`, RATE_LIMITS.generation);
        if (!rate.allowed) {
          throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: rateLimitError(rate.resetIn) });
        }
        await enforceDailyQuota(ctx.user.id);
        lockedModel = await getModelById(input.modelId);
        if (!lockedModel) throw new TRPCError({ code: "NOT_FOUND", message: "Model not found" });
        if (lockedModel.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
        assertNotArchived(lockedModel);
        plan = await planMintPackage({
          userId: ctx.user.id,
          modelId: input.modelId,
          readMode,
        });
        const snapshotHead = readMode === "snapshot"
          ? await resolveEffectiveCastStateForRead({ userId: ctx.user.id, modelId: input.modelId })
          : await bootstrapModelSnapshot({ userId: ctx.user.id, modelId: input.modelId });
        if (snapshotHead.status === "headless") {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "This Cast needs a headshot before views can be added or it can be minted.",
          });
        }
      } catch (error) {
        return failClaimedDirectOperation({ userId: ctx.user.id, operationId: gate.operationId, error });
      }
      const plannedCredits = plan.tiers[input.tier].cost;
      const started = await markGenerationOperationRunning({
        userId: ctx.user.id,
        operationId: gate.operationId,
        modelId: input.modelId,
        expectedIdentityRevisionId: currentRevisionId(lockedModel),
        plannedCredits,
        requiredLockKey: lockKey,
        phase: "minting",
        heartbeat: true,
      });
      try {
        await assertGenerationOperationSnapshotHead({
          userId: ctx.user.id,
          operationId: gate.operationId,
          modelId: input.modelId,
        });
      } catch (error) {
        return completeDirectOperationFailure({
          userId: ctx.user.id,
          operationId: gate.operationId,
          error,
          chargedCredits: 0,
          refundedCredits: 0,
        });
      }
      let chargedCredits = 0;
      let refundedCredits = 0;
      let durableResult = false;
      try {
        const result = await executeMintPackage({
          userId: ctx.user.id,
          modelId: input.modelId,
          tier: input.tier,
          characterName: input.characterName ?? "",
          mint: input.mint,
          readMode,
          chargeReferenceId: started.chargeReferenceId,
          onCharged: (amount) => { chargedCredits = amount; },
          onRefunded: (amount) => { refundedCredits += amount; },
          operationId: gate.operationId,
        });
        durableResult = true;
        await completeDirectOperationSuccess({
          userId: ctx.user.id,
          operationId: gate.operationId,
          result: {
            agencyId: result.agencyId,
            minted: result.minted,
            tier: result.tier,
            generated: result.generated.map(({ angle, assetId }) => ({ angle, assetId })),
            failedAngles: result.failed.map(({ angle }) => angle),
            ...("mintAborted" in result && result.mintAborted ? { mintAborted: true } : {}),
          },
          chargedCredits,
          refundedCredits,
        });
        return result;
      } catch (error) {
        if (durableResult) throw error;
        return completeDirectOperationFailure({
          userId: ctx.user.id,
          operationId: gate.operationId,
          error,
          chargedCredits,
          refundedCredits,
        });
      }
    }),

  /** Package completeness (D-39c) — R5's comp card + future picker read this. */
  packageState: protectedProcedure
    .input(z.object({ modelId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const readMode = captureSnapshotReadMode(ctx.user.id);
      return getPackageState({ userId: ctx.user.id, modelId: input.modelId, readMode });
    }),

  /** R5 per-slot pin (D-21 on the package ledger): pinned = accepted-final,
   *  exempt from staleness pressure and bulk refresh. Free — no rate gate. */
  setSlotPinned: protectedProcedure
    .input(z.object({
      clientRequestId: z.string().uuid(),
      modelId: z.number().int().positive(),
      angle: z.enum(CANONICAL_VIEW_ANGLES),
      pinned: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      const model = await getModelById(input.modelId);
      if (!model) throw new TRPCError({ code: "NOT_FOUND", message: "Model not found" });
      if (model.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      assertNotArchived(model);
      const lockKey = modelOperationLockKey(input.modelId);
      const gate = await beginDirectOperation({
        userId: ctx.user.id,
        clientRequestId: input.clientRequestId,
        kind: "casting.pin",
        modelId: input.modelId,
        payload: { modelId: input.modelId, angle: input.angle, pinned: input.pinned },
        lockKey,
      });
      if (gate.type === "replay") return { modelId: input.modelId, angle: input.angle, pinned: input.pinned };
      await markGenerationOperationRunning({
        userId: ctx.user.id,
        operationId: gate.operationId,
        modelId: input.modelId,
        expectedIdentityRevisionId: currentRevisionId(model),
        plannedCredits: 0,
        requiredLockKey: lockKey,
        phase: "finalizing",
        heartbeat: true,
      });
      let durableResult = false;
      try {
        const result = await executeSetSlotPinned({ userId: ctx.user.id, modelId: input.modelId, angle: input.angle, pinned: input.pinned });
        durableResult = true;
        await completeDirectOperationSuccess({
          userId: ctx.user.id,
          operationId: gate.operationId,
          result: { modelId: result.modelId, angle: result.angle, pinned: result.pinned },
          chargedCredits: 0,
          refundedCredits: 0,
        });
        return result;
      } catch (error) {
        if (durableResult) throw error;
        return completeDirectOperationFailure({ userId: ctx.user.id, operationId: gate.operationId, error, chargedCredits: 0, refundedCredits: 0 });
      }
    }),

  /** D-53: filled rows for one angle, newest first — the tile thumb-strip. */
  slotVersions: protectedProcedure
    .input(z.object({
      modelId: z.number().int().positive(),
      angle: z.enum(CANONICAL_VIEW_ANGLES),
    }))
    .query(async ({ ctx, input }) => {
      return getSlotVersions({ userId: ctx.user.id, ...input });
    }),

  /** D-53 "Use this version": copy-forward append on the ledger — zero
   *  generation cost, arrives unpinned, `restoredFromAssetId` provenance.
   *  Never "revert" (the board's revertItemVersion mutates backward and
   *  keeps its own name + 3f routing). Free — no rate gate. */
  restoreSlotVersion: protectedProcedure
    .input(z.object({
      clientRequestId: z.string().uuid(),
      modelId: z.number().int().positive(),
      angle: z.enum(CANONICAL_VIEW_ANGLES),
      assetId: z.number().int().positive(),
    }))
    .mutation(async ({ ctx, input }) => {
      const readMode = captureSnapshotReadMode(ctx.user.id);
      const model = await getModelById(input.modelId);
      if (!model) throw new TRPCError({ code: "NOT_FOUND", message: "Model not found" });
      if (model.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      assertNotArchived(model);
      const lockKey = modelOperationLockKey(input.modelId);
      const gate = await beginDirectOperation({
        userId: ctx.user.id,
        clientRequestId: input.clientRequestId,
        kind: "casting.restore",
        modelId: input.modelId,
        payload: { modelId: input.modelId, angle: input.angle, assetId: input.assetId },
        lockKey,
      });
      if (gate.type === "replay") {
        const assetId = (gate.result as { assetId?: unknown } | null)?.assetId;
        const assets = await getModelAssets(input.modelId);
        const asset = assets.find((candidate) => candidate.id === assetId);
        if (!asset) throw new TRPCError({ code: "PRECONDITION_FAILED", message: `The saved restore result is unavailable. Operation ${gate.operationId}.` });
        return {
          modelId: input.modelId,
          angle: input.angle,
          assetId: asset.id,
          url: asset.storageUrl,
          version: assets.filter((candidate) => candidate.viewType === input.angle && candidate.storageUrl).length,
        };
      }
      let expectedRevisionModel = model;
      try {
        if (readMode === "snapshot") {
          const effective = await resolveEffectiveCastStateForRead({
            userId: ctx.user.id,
            modelId: input.modelId,
          });
          if (effective.status === "headless") {
            throw new TRPCError({
              code: "PRECONDITION_FAILED",
              message: "This Cast has no headshot package to restore.",
            });
          }
          prepareRestoreSlotTransition({
            userId: ctx.user.id,
            model: effective.model,
            assets: [...effective.ledger.assets],
            angle: input.angle,
            assetId: input.assetId,
            snapshotTruth: {
              identityText: effective.identity.identityText,
              selectedAsset:
                effective.selectedViews.find((view) => view.angle === input.angle)?.asset
                ?? null,
            },
          });
          expectedRevisionModel = effective.model;
        } else {
          const snapshotHead = await bootstrapModelSnapshot({
            userId: ctx.user.id,
            modelId: input.modelId,
          });
          if (snapshotHead.status === "headless") {
            throw new TRPCError({
              code: "PRECONDITION_FAILED",
              message: "This Cast has no headshot package to restore.",
            });
          }
        }
      } catch (error) {
        return failClaimedDirectOperation({ userId: ctx.user.id, operationId: gate.operationId, error });
      }
      await markGenerationOperationRunning({
        userId: ctx.user.id,
        operationId: gate.operationId,
        modelId: input.modelId,
        expectedIdentityRevisionId: currentRevisionId(expectedRevisionModel),
        plannedCredits: 0,
        requiredLockKey: lockKey,
        phase: "finalizing",
        heartbeat: true,
      });
      let durableResult = false;
      try {
        const result = await executeRestoreSlotVersion({
          userId: ctx.user.id,
          modelId: input.modelId,
          operationId: gate.operationId,
          angle: input.angle,
          assetId: input.assetId,
          readMode,
        });
        durableResult = true;
        await completeDirectOperationSuccess({
          userId: ctx.user.id,
          operationId: gate.operationId,
          result: { assetId: result.assetId },
          chargedCredits: 0,
          refundedCredits: 0,
        });
        return result;
      } catch (error) {
        if (durableResult) throw error;
        return completeDirectOperationFailure({ userId: ctx.user.id, operationId: gate.operationId, error, chargedCredits: 0, refundedCredits: 0 });
      }
    }),

  /** R5 per-tile refresh plan: slot costs + structural refusals (D-15/D-43).
   *  The headshot always reads refusal:'identity_anchor' — never refreshable. */
  refreshSlotsPlan: protectedProcedure
    .input(z.object({
      modelId: z.number().int().positive(),
      angles: z.array(z.enum(CANONICAL_VIEW_ANGLES)).min(1).max(6)
        .refine((angles) => new Set(angles).size === angles.length, {
          message: "Each view can only be refreshed once per request",
        })
        .optional(),
    }))
    .query(async ({ ctx, input }) => {
      const readMode = captureSnapshotReadMode(ctx.user.id);
      return planRefreshSlots({
        userId: ctx.user.id,
        modelId: input.modelId,
        angles: input.angles,
        readMode,
      });
    }),

  /** R5 refresh execute: regenerates the slots against the CURRENT headshot,
   *  new asset rows (newest-wins), per-slot named-and-refunded failures.
   *  Refuses the headshot, pinned, and never-attempted slots structurally. */
  refreshSlots: protectedProcedure
    .input(z.object({
      clientRequestId: z.string().uuid(),
      modelId: z.number().int().positive(),
      angles: z.array(z.enum(CANONICAL_VIEW_ANGLES)).min(1).max(6)
        .refine((angles) => new Set(angles).size === angles.length, {
          message: "Each view can only be refreshed once per request",
        }),
    }))
    .mutation(async ({ ctx, input }) => {
      const readMode = captureSnapshotReadMode(ctx.user.id);
      const initialModel = await getModelById(input.modelId);
      if (!initialModel) throw new TRPCError({ code: "NOT_FOUND", message: "Model not found" });
      if (initialModel.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      assertNotArchived(initialModel);

      const lockKey = modelOperationLockKey(input.modelId);
      const gate = await beginDirectOperation({
        userId: ctx.user.id,
        clientRequestId: input.clientRequestId,
        kind: "casting.refresh",
        modelId: input.modelId,
        payload: { modelId: input.modelId, angles: [...input.angles].sort() },
        lockKey,
      });
      if (gate.type === "replay") {
        const saved = gate.result as { refreshed?: unknown; failedAngles?: unknown } | null;
        const assets = await getModelAssets(input.modelId);
        const refreshedRows = Array.isArray(saved?.refreshed) ? saved.refreshed : [];
        const refreshed = refreshedRows.flatMap((row) => {
          const item = row as { angle?: unknown; assetId?: unknown };
          const asset = assets.find((candidate) => candidate.id === item.assetId);
          return asset && typeof item.angle === "string"
            ? [{ angle: item.angle as (typeof CANONICAL_VIEW_ANGLES)[number], imageUrl: asset.storageUrl, assetId: asset.id }]
            : [];
        });
        const state = await getPackageState({
          userId: ctx.user.id,
          modelId: input.modelId,
          readMode,
        });
        const failedAngles = Array.isArray(saved?.failedAngles) ? saved.failedAngles : [];
        const failed = state.slots.flatMap((slot) =>
          failedAngles.includes(slot.angle) && slot.failed
            ? [{ angle: slot.angle, label: slot.label, ...slot.failed, markerPersisted: true }]
            : []);
        return { refreshed, failed };
      }

      let lockedModel;
      let plan;
      try {
        const rate = checkRateLimit(`user:${ctx.user.id}`, RATE_LIMITS.generation);
        if (!rate.allowed) {
          throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: rateLimitError(rate.resetIn) });
        }
        await enforceDailyQuota(ctx.user.id);
        lockedModel = await getModelById(input.modelId);
        if (!lockedModel) throw new TRPCError({ code: "NOT_FOUND", message: "Model not found" });
        if (lockedModel.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
        assertNotArchived(lockedModel);
        plan = await planRefreshSlots({
          userId: ctx.user.id,
          modelId: input.modelId,
          angles: input.angles,
          readMode,
        });
        const snapshotHead = readMode === "snapshot"
          ? await resolveEffectiveCastStateForRead({ userId: ctx.user.id, modelId: input.modelId })
          : await bootstrapModelSnapshot({ userId: ctx.user.id, modelId: input.modelId });
        if (snapshotHead.status === "headless") {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "This Cast needs a headshot before its views can be refreshed.",
          });
        }
      } catch (error) {
        return failClaimedDirectOperation({ userId: ctx.user.id, operationId: gate.operationId, error });
      }
      const started = await markGenerationOperationRunning({
        userId: ctx.user.id,
        operationId: gate.operationId,
        modelId: input.modelId,
        expectedIdentityRevisionId: currentRevisionId(lockedModel),
        plannedCredits: plan.totalCost,
        requiredLockKey: lockKey,
        phase: "refreshing",
        heartbeat: true,
      });
      try {
        await assertGenerationOperationSnapshotHead({
          userId: ctx.user.id,
          operationId: gate.operationId,
          modelId: input.modelId,
        });
      } catch (error) {
        return completeDirectOperationFailure({
          userId: ctx.user.id,
          operationId: gate.operationId,
          error,
          chargedCredits: 0,
          refundedCredits: 0,
        });
      }
      let chargedCredits = 0;
      let refundedCredits = 0;
      let durableResult = false;
      try {
        const result = await executeRefreshSlots({
          userId: ctx.user.id,
          modelId: input.modelId,
          angles: input.angles,
          readMode,
          chargeReferenceId: started.chargeReferenceId,
          onCharged: (amount) => { chargedCredits = amount; },
          onRefunded: (amount) => { refundedCredits += amount; },
          operationId: gate.operationId,
        });
        durableResult = true;
        await completeDirectOperationSuccess({
          userId: ctx.user.id,
          operationId: gate.operationId,
          result: {
            refreshed: result.refreshed.map(({ angle, assetId }) => ({ angle, assetId })),
            failedAngles: result.failed.map(({ angle }) => angle),
          },
          chargedCredits,
          refundedCredits,
        });
        return result;
      } catch (error) {
        if (durableResult) throw error;
        return completeDirectOperationFailure({
          userId: ctx.user.id,
          operationId: gate.operationId,
          error,
          chargedCredits,
          refundedCredits,
        });
      }
    }),

  // NOTE (Batch 0, R6 execution plan / FR-2): the legacy `mint` procedure
  // was REMOVED here. It minted namelessly (no name guard, random agencyId)
  // and was fired implicitly by the export flows — a live bypass of the
  // D-55 ceremony (nameless mint refused) and the B0.2 blocker. Minting now
  // happens ONLY through `mintPackage` (mint: true), which requires a name
  // at the router AND inside executeMintPackage. Export refuses unminted
  // models and routes to the mint door; it never mints implicitly.
  // Do not reintroduce a mint path outside the ceremony.
});
