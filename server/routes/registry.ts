import { publicProcedure, router } from "../_core/trpc";
import { getModelByAgencyId, getModelAssets } from "../db";
import { z } from "zod";
import { TRPCError } from "@trpc/server";

export const registryRouter = router({
  // Public lookup by agencyId - for cross-app model retrieval
  // Only returns minted (active) models with agencyId assigned
  lookup: publicProcedure
    .input(z.object({
      agencyId: z.string().regex(/^MOD-\d{2}-[A-F0-9]{6}$/, "Invalid Model ID format"),
    }))
    .query(async ({ input }) => {
      const model = await getModelByAgencyId(input.agencyId);
      
      if (!model) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Model not found" });
      }

      // Only return minted models (status = 'active')
      if (model.status !== 'active') {
        throw new TRPCError({ 
          code: "NOT_FOUND", 
          message: "Model not found or not yet minted" 
        });
      }

      // Get associated assets
      const assets = await getModelAssets(model.id);

      // Return public identity bundle (no internal IDs or user info)
      return {
        agencyId: model.agencyId,
        name: model.name,
        masterPrompt: model.masterPrompt,
        technicalSchema: model.technicalSchema,
        preferences: model.preferences,
        mintedAt: model.mintedAt,
        assets: assets.map(a => ({
          viewType: a.viewType,
          resolution: a.resolution,
          storageUrl: a.storageUrl,
        })),
      };
    }),

  // Verify if a model ID exists and is minted
  verify: publicProcedure
    .input(z.object({
      agencyId: z.string(),
    }))
    .query(async ({ input }) => {
      // Validate format first
      const formatValid = /^MOD-\d{2}-[A-F0-9]{6}$/.test(input.agencyId);
      if (!formatValid) {
        return { valid: false, exists: false, minted: false };
      }

      const model = await getModelByAgencyId(input.agencyId);
      
      if (!model) {
        return { valid: true, exists: false, minted: false };
      }

      return {
        valid: true,
        exists: true,
        minted: model.status === 'active',
        mintedAt: model.status === 'active' ? model.mintedAt : null,
      };
    }),
});
