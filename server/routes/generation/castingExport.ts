import { publicProcedure, protectedProcedure, router } from "../../_core/trpc";
import {
  getModelById, getUserGenerations, getUserById, mintModel,
} from "../../db";
import { POINT_COSTS } from "../../aiService";
import { generatePremiumIdentityPdf, PdfModelData } from "../../pdfService";
import { z } from "zod";
import { TRPCError } from "@trpc/server";

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
});
