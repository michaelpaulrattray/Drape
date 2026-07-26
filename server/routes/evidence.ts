import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import {
  captureEvidenceIngestEnabled,
} from "../casting/evidence/evidenceIngestScope";
import {
  evidenceDeliveryConfigured,
  getEvidenceDeliveryAdapter,
} from "../casting/evidence/evidenceDeliveryRuntime";
import {
  discardOwnedReferencePlate,
  stageOwnedReferencePlate,
} from "../casting/evidence/evidenceOperations";
import { MAX_EVIDENCE_DATA_URL_LENGTH } from "../casting/evidence/imageValidation";
import { checkUserRateLimit } from "../security/rateLimit";

const EVIDENCE_INGEST_LIMIT = {
  maxRequests: 10,
  windowMs: 60 * 60 * 1000,
  keyPrefix: "evidence_ingest",
};

function captureCapability(userId: number): boolean {
  return captureEvidenceIngestEnabled(userId) && evidenceDeliveryConfigured();
}

function requireCapability(userId: number): void {
  if (!captureCapability(userId)) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Reference-image ingestion is not available for this account.",
    });
  }
}

function enforceRateLimit(userId: number): void {
  const result = checkUserRateLimit(userId, EVIDENCE_INGEST_LIMIT);
  if (!result.allowed) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Too many reference-image requests. Try again later.",
    });
  }
}

export const evidenceRouter = router({
  capability: protectedProcedure.query(({ ctx }) => ({
    referencePlateIngestion: captureCapability(ctx.user.id),
  })),

  stageReferencePlate: protectedProcedure
    .input(z.object({
      modelId: z.number().int().positive(),
      clientRequestId: z.string().uuid(),
      imageDataUrl: z.string().min(1).max(MAX_EVIDENCE_DATA_URL_LENGTH),
    }).strict())
    .mutation(async ({ ctx, input }) => {
      requireCapability(ctx.user.id);
      enforceRateLimit(ctx.user.id);
      const delivery = getEvidenceDeliveryAdapter();
      if (!delivery) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Reference-image ingestion is not available for this account.",
        });
      }
      return stageOwnedReferencePlate({ delivery }, {
        userId: ctx.user.id,
        ...input,
      });
    }),

  discardReferencePlate: protectedProcedure
    .input(z.object({
      plateId: z.string().uuid(),
      clientRequestId: z.string().uuid(),
    }).strict())
    .mutation(async ({ ctx, input }) => {
      requireCapability(ctx.user.id);
      enforceRateLimit(ctx.user.id);
      return discardOwnedReferencePlate({
        userId: ctx.user.id,
        ...input,
      });
    }),
});
