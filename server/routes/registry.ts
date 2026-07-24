import { publicProcedure, router } from "../_core/trpc";
import { getModelByAgencyId, getModelAssets } from "../db";
import { isModelMintedStatus } from "../../shared/modelLifecycle";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { captureSnapshotReadMode } from "../casting/snapshotReadScope";
import { resolveEffectiveCastStateForRead } from "../casting/effectiveCastRead";
import { projectEffectiveRegistryBundle } from "../casting/modelReadProjections";

export const registryRouter = router({
  // Public lookup by agencyId - for cross-app model retrieval
  // Only returns MINTED models (Batch B: status truth — active or the legacy
  // locked alias; archived reads deleted). The agencyId itself is this
  // operation's integrity requirement — it is the lookup key by construction.
  lookup: publicProcedure
    .input(z.object({
      agencyId: z.string().regex(/^MOD-\d{2}-[A-F0-9]{6}$/, "Invalid Model ID format"),
    }).strict())
    .query(async ({ input }) => {
      const model = await getModelByAgencyId(input.agencyId);

      if (!model) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Model not found" });
      }

      // Minted by status — a legacy locked identity is retrievable; a draft
      // carrying a stray agencyId and an archived row both read NOT_FOUND
      if (!isModelMintedStatus(model.status)) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Model not found or not yet minted"
        });
      }

      // Public registry scope belongs to the Cast owner. The caller supplies
      // only the agency id; it cannot select the read authority.
      const readMode = captureSnapshotReadMode(model.userId);
      if (readMode === "snapshot") {
        const state = await resolveEffectiveCastStateForRead({
          userId: model.userId,
          modelId: model.id,
        });
        const bundle = projectEffectiveRegistryBundle(state);
        if (!bundle) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "This Cast is temporarily unavailable.",
          });
        }
        return bundle;
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

      // Batch B (review correction 2): verify and lookup must agree, and
      // "archived = deleted everywhere" (FR-4) applies to EXISTENCE on this
      // public endpoint. Any row that is not minted by the shared read model
      // — draft (stray ID), archived, unknown — is publicly ABSENT: the same
      // shape as no row at all, leaking neither existence nor timestamps.
      if (!model || !isModelMintedStatus(model.status)) {
        return { valid: true, exists: false, minted: false };
      }

      return {
        valid: true,
        exists: true,
        minted: true,
        mintedAt: model.mintedAt,
      };
    }),
});
