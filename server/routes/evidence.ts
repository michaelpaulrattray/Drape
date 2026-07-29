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
  stageOwnedInkIntentReference,
  stageOwnedReferencePlate,
} from "../casting/evidence/evidenceOperations";
import {
  beginInkAnywhereIntent,
  readInkAddCapability,
} from "../casting/evidence/inkAddIntent";
import {
  captureEvidenceComposerEnabled,
} from "../casting/evidence/evidenceComposerScope";
import {
  INK_ADD_MAX_DESCRIPTOR_LENGTH,
  INK_ADD_MIN_DESCRIPTOR_LENGTH,
} from "../casting/evidence/composer/inkAddRecipe";
import { MAX_EVIDENCE_DATA_URL_LENGTH } from "../casting/evidence/imageValidation";
import { checkUserRateLimit } from "../security/rateLimit";
import {
  generateInkAddCandidate,
  generateInkProjectionCandidate,
  readActiveInkProjectionCandidate,
  retryInkAddCandidate,
  retryInkProjectionCandidate,
} from "../casting/evidence/inkCandidateGeneration";
import { acceptInkAddCandidate } from "../casting/evidence/inkCandidateAcceptance";
import {
  cancelInkAddIntent,
  cancelInkProjectionCandidate,
} from "../casting/evidence/inkIntentCancellation";
import { CANONICAL_VIEW_ANGLES } from "../../shared/boardTypes";

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

function requireInkCapability(userId: number): void {
  if (!captureEvidenceComposerEnabled(userId)) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Tattoo previews are not available for this account.",
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

  inkCapability: protectedProcedure
    .input(z.object({
      modelId: z.number().int().positive(),
    }).strict())
    .query(({ ctx, input }) => readInkAddCapability({
      userId: ctx.user.id,
      modelId: input.modelId,
    })),

  beginInkAddIntent: protectedProcedure
    .input(z.object({
      modelId: z.number().int().positive(),
      instruction: z.string()
        .min(INK_ADD_MIN_DESCRIPTOR_LENGTH)
        .max(INK_ADD_MAX_DESCRIPTOR_LENGTH),
      clientRequestId: z.string().uuid(),
    }).strict())
    .mutation(async ({ ctx, input }) => {
      requireInkCapability(ctx.user.id);
      enforceRateLimit(ctx.user.id);
      return beginInkAnywhereIntent({
        userId: ctx.user.id,
        ...input,
      });
    }),

  attachInkIntentReference: protectedProcedure
    .input(z.object({
      intentId: z.string().uuid(),
      clientRequestId: z.string().uuid(),
      imageDataUrl: z.string().min(1).max(MAX_EVIDENCE_DATA_URL_LENGTH),
    }).strict())
    .mutation(async ({ ctx, input }) => {
      requireInkCapability(ctx.user.id);
      enforceRateLimit(ctx.user.id);
      const delivery = getEvidenceDeliveryAdapter();
      if (!delivery) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Tattoo previews are not available for this account.",
        });
      }
      return stageOwnedInkIntentReference({ delivery }, {
        userId: ctx.user.id,
        ...input,
      });
    }),

  generateInkAddCandidate: protectedProcedure
    .input(z.object({
      intentId: z.string().uuid(),
      clientRequestId: z.string().uuid(),
    }).strict())
    .mutation(async ({ ctx, input }) => {
      requireInkCapability(ctx.user.id);
      enforceRateLimit(ctx.user.id);
      const delivery = getEvidenceDeliveryAdapter();
      if (!delivery) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Tattoo previews are not available for this account.",
        });
      }
      return generateInkAddCandidate({ delivery }, {
        userId: ctx.user.id,
        ...input,
      });
    }),

  retryInkAddCandidate: protectedProcedure
    .input(z.object({
      intentId: z.string().uuid(),
      clientRequestId: z.string().uuid(),
    }).strict())
    .mutation(async ({ ctx, input }) => {
      requireInkCapability(ctx.user.id);
      enforceRateLimit(ctx.user.id);
      const delivery = getEvidenceDeliveryAdapter();
      if (!delivery) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Tattoo previews are not available for this account.",
        });
      }
      return retryInkAddCandidate({ delivery }, {
        userId: ctx.user.id,
        ...input,
      });
    }),

  inkProjectionCandidate: protectedProcedure
    .input(z.object({
      modelId: z.number().int().positive(),
    }).strict())
    .query(({ ctx, input }) => readActiveInkProjectionCandidate({
      userId: ctx.user.id,
      modelId: input.modelId,
    })),

  generateInkProjectionCandidate: protectedProcedure
    .input(z.object({
      modelId: z.number().int().positive(),
      targetViewAngle: z.enum(CANONICAL_VIEW_ANGLES),
      clientRequestId: z.string().uuid(),
    }).strict())
    .mutation(async ({ ctx, input }) => {
      requireInkCapability(ctx.user.id);
      enforceRateLimit(ctx.user.id);
      const delivery = getEvidenceDeliveryAdapter();
      if (!delivery) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Tattoo previews are not available for this account.",
        });
      }
      return generateInkProjectionCandidate({ delivery }, {
        userId: ctx.user.id,
        ...input,
      });
    }),

  retryInkProjectionCandidate: protectedProcedure
    .input(z.object({
      modelId: z.number().int().positive(),
      targetViewAngle: z.enum(CANONICAL_VIEW_ANGLES),
      clientRequestId: z.string().uuid(),
    }).strict())
    .mutation(async ({ ctx, input }) => {
      requireInkCapability(ctx.user.id);
      enforceRateLimit(ctx.user.id);
      const delivery = getEvidenceDeliveryAdapter();
      if (!delivery) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Tattoo previews are not available for this account.",
        });
      }
      return retryInkProjectionCandidate({ delivery }, {
        userId: ctx.user.id,
        ...input,
      });
    }),

  acceptInkAddCandidate: protectedProcedure
    .input(z.object({
      candidateId: z.string().uuid(),
      clientRequestId: z.string().uuid(),
    }).strict())
    .mutation(async ({ ctx, input }) => {
      requireInkCapability(ctx.user.id);
      enforceRateLimit(ctx.user.id);
      const delivery = getEvidenceDeliveryAdapter();
      if (!delivery) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Tattoo previews are not available for this account.",
        });
      }
      return acceptInkAddCandidate({ delivery }, {
        userId: ctx.user.id,
        ...input,
      });
    }),

  cancelInkAddIntent: protectedProcedure
    .input(z.object({
      intentId: z.string().uuid(),
      clientRequestId: z.string().uuid(),
    }).strict())
    .mutation(async ({ ctx, input }) => {
      requireInkCapability(ctx.user.id);
      enforceRateLimit(ctx.user.id);
      return cancelInkAddIntent({}, {
        userId: ctx.user.id,
        ...input,
      });
    }),

  cancelInkProjectionCandidate: protectedProcedure
    .input(z.object({
      candidateId: z.string().uuid(),
      clientRequestId: z.string().uuid(),
    }).strict())
    .mutation(async ({ ctx, input }) => {
      requireInkCapability(ctx.user.id);
      enforceRateLimit(ctx.user.id);
      return cancelInkProjectionCandidate({}, {
        userId: ctx.user.id,
        ...input,
      });
    }),

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
