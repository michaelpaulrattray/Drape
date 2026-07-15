import { publicProcedure, protectedProcedure, router } from "../../_core/trpc";
import {
  getModelById, getUserGenerations, getUserById,
} from "../../db";
import { POINT_COSTS } from "../../casting/aiService";
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
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createModuleLogger } from "../../logging/logger";
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

  // Generate premium identity PDF document
  generatePdf: protectedProcedure
    .input(z.object({
      modelId: z.number(),
      modelName: z.string(),
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
      // Get the model
      const model = await getModelById(input.modelId);
      if (!model) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Model not found" });
      }
      if (model.userId !== ctx.user.id) {
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
        agencyId: exportId,
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
        filename: `IDENTITY_${exportId}.pdf`,
      };
    }),

  /** D-39 tiered mint (R3b): per-tier costs over MISSING slots — upgrade
   *  anytime at the same price. Costs derive from CREDIT_COSTS (D-15). */
  mintPackagePlan: protectedProcedure
    .input(z.object({ modelId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      return planMintPackage({ userId: ctx.user.id, modelId: input.modelId });
    }),

  /** D-39 tiered mint execute: generates the tier's missing views (back
   *  views pass the identity gate, retry-then-refund), names + mints. */
  mintPackage: protectedProcedure
    .input(z.object({
      modelId: z.number().int().positive(),
      tier: z.enum(["draft", "core", "production"]),
      // Optional when staying a draft (trap ruling (a)) — the name belongs
      // to the deliberate mint moment, not to adding views
      characterName: z.string().trim().min(1).max(128).optional(),
      mint: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (input.mint !== false && !input.characterName) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "A name is required to mint" });
      }
      const rate = checkRateLimit(`user:${ctx.user.id}`, RATE_LIMITS.generation);
      if (!rate.allowed) {
        throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: rateLimitError(rate.resetIn) });
      }
      await enforceDailyQuota(ctx.user.id);
      return executeMintPackage({
        userId: ctx.user.id,
        modelId: input.modelId,
        tier: input.tier,
        characterName: input.characterName ?? "",
        mint: input.mint,
      });
    }),

  /** Package completeness (D-39c) — R5's comp card + future picker read this. */
  packageState: protectedProcedure
    .input(z.object({ modelId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      return getPackageState({ userId: ctx.user.id, modelId: input.modelId });
    }),

  /** R5 per-slot pin (D-21 on the package ledger): pinned = accepted-final,
   *  exempt from staleness pressure and bulk refresh. Free — no rate gate. */
  setSlotPinned: protectedProcedure
    .input(z.object({
      modelId: z.number().int().positive(),
      angle: z.enum(CANONICAL_VIEW_ANGLES),
      pinned: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      return executeSetSlotPinned({ userId: ctx.user.id, ...input });
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
      modelId: z.number().int().positive(),
      angle: z.enum(CANONICAL_VIEW_ANGLES),
      assetId: z.number().int().positive(),
    }))
    .mutation(async ({ ctx, input }) => {
      return executeRestoreSlotVersion({ userId: ctx.user.id, ...input });
    }),

  /** R5 per-tile refresh plan: slot costs + structural refusals (D-15/D-43).
   *  The headshot always reads refusal:'identity_anchor' — never refreshable. */
  refreshSlotsPlan: protectedProcedure
    .input(z.object({
      modelId: z.number().int().positive(),
      angles: z.array(z.enum(CANONICAL_VIEW_ANGLES)).min(1).max(6).optional(),
    }))
    .query(async ({ ctx, input }) => {
      return planRefreshSlots({ userId: ctx.user.id, modelId: input.modelId, angles: input.angles });
    }),

  /** R5 refresh execute: regenerates the slots against the CURRENT headshot,
   *  new asset rows (newest-wins), per-slot named-and-refunded failures.
   *  Refuses the headshot, pinned, and never-attempted slots structurally. */
  refreshSlots: protectedProcedure
    .input(z.object({
      modelId: z.number().int().positive(),
      angles: z.array(z.enum(CANONICAL_VIEW_ANGLES)).min(1).max(6),
    }))
    .mutation(async ({ ctx, input }) => {
      const rate = checkRateLimit(`user:${ctx.user.id}`, RATE_LIMITS.generation);
      if (!rate.allowed) {
        throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: rateLimitError(rate.resetIn) });
      }
      await enforceDailyQuota(ctx.user.id);
      return executeRefreshSlots({ userId: ctx.user.id, modelId: input.modelId, angles: input.angles });
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
