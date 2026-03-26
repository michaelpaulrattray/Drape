/**
 * Wardrobe Router — tRPC procedures for the Wardrobe Studio.
 *
 * Procedures:
 *   garments.list / get / upload / delete
 *   vto.generate / incremental / refine / detectResultGarments / classifyEdit / checkIdentity
 *   decompose.analyze / import
 *   sessions.create / get / list / update / delete / seedChat / clearChat
 *   outfits.list / save / delete
 *   model.listMinted / upload / analyzeTattoos / checkQuality
 */
import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { withAtomicCredits } from "../casting/atomicCredits";
import { enforceDailyQuota } from "../db/dailyQuota";
import { checkRateLimit, RATE_LIMITS, rateLimitError } from "../security/rateLimit";
import { createModuleLogger } from "../logging/logger";
import { WARDROBE_CREDIT_COSTS } from "../wardrobe/creditCosts";
import {
  createGarment, getGarmentById, getUserGarments, getUserGarmentsBySlot,
  updateGarment, deleteGarment,
  createOutfit, getUserOutfits, getOutfitById, deleteOutfit,
  createSession, getSessionById, getUserSessions, updateSession, deleteSession,
  getLatestUserSession,
  createGeneration,
} from "../db";
import { getUserMintedModelsWithThumbnail } from "../db/models";
import { storagePut } from "../storage";
import { detectGarmentsInImage } from "../wardrobe/garmentDetection";
import { digitizeGarment } from "../wardrobe/garmentDigitization";
import { analyzeGarmentMetadata } from "../wardrobe/garmentAnalysis";
import { generateVirtualTryOn, incrementalComposite } from "../wardrobe/vtoGeneration";
import { refineGarment } from "../wardrobe/garmentRefinement";
import { decomposeOutfit } from "../wardrobe/outfitDecomposition";
import { analyzeTattoos } from "../wardrobe/tattooAnalysis";
import { checkImageQuality } from "../wardrobe/qualityCheck";
import { classifyEditSize } from "../wardrobe/editClassifier";
import { checkIdentityMatch } from "../wardrobe/identityCheck";
import { seedSession, clearSession } from "../wardrobe/vtoSession";
import { getImageAspectBucket, type GarmentForVTO } from "../wardrobe/utils";

const log = createModuleLogger("routes/wardrobe");

// ── Helper: throw rate limit TRPCError ─────────────────────────────────────

function throwIfRateLimited(userId: number) {
  const rateCheck = checkRateLimit(`user:${userId}`, RATE_LIMITS.generation);
  if (!rateCheck.allowed) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: rateLimitError(rateCheck.resetIn),
    });
  }
}

// ── Helper: map DB garment to GarmentForVTO ────────────────────────────────

function toGarmentForVTO(
  g: { id: number; slotType: string; shortName: string | null; description: string | null; tags: unknown; isolatedImageUrl: string | null; originalImageUrl: string; sourceImageUrl: string | null },
  styleNote?: string,
): GarmentForVTO {
  return {
    id: String(g.id),
    type: g.slotType,
    shortName: g.shortName ?? undefined,
    description: g.description ?? undefined,
    tags: Array.isArray(g.tags) ? g.tags as string[] : undefined,
    imageUrl: g.originalImageUrl,
    isolatedPreviewUrl: g.isolatedImageUrl ?? undefined,
    sourceImageUrl: g.sourceImageUrl ?? undefined,
    styleNote,
  };
}

// ── Garment Procedures ─────────────────────────────────────────────────────

const garmentRouter = router({
  list: protectedProcedure
    .input(z.object({
      slotType: z.enum(["full_look", "tops", "bottoms", "shoes", "accessories"]).optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      if (input?.slotType) {
        return getUserGarmentsBySlot(ctx.user.id, input.slotType);
      }
      return getUserGarments(ctx.user.id);
    }),

  get: protectedProcedure
    .input(z.object({ garmentId: z.number() }))
    .query(async ({ ctx, input }) => {
      const garment = await getGarmentById(input.garmentId);
      if (!garment || garment.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Garment not found" });
      }
      return garment;
    }),

  upload: protectedProcedure
    .input(z.object({
      imageBase64: z.string().max(10_000_000),
      slotType: z.enum(["full_look", "tops", "bottoms", "shoes", "accessories"]),
      fileName: z.string().max(256).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      throwIfRateLimited(ctx.user.id);
      await enforceDailyQuota(ctx.user.id);

      // Upload original image to S3
      const suffix = Math.random().toString(36).slice(2, 8);
      const fileKey = `${ctx.user.id}-wardrobe/original-${Date.now()}-${suffix}.png`;
      const imageBuffer = Buffer.from(
        input.imageBase64.replace(/^data:image\/\w+;base64,/, ""),
        "base64",
      );
      const { url: originalUrl } = await storagePut(fileKey, imageBuffer, "image/png");

      // Create garment record (status: processing)
      const garmentId = await createGarment({
        userId: ctx.user.id,
        slotType: input.slotType,
        originalImageUrl: originalUrl,
        originalImageKey: fileKey,
        status: "processing",
      });

      // Create generation record
      const genResult = await createGeneration({
        userId: ctx.user.id,
        type: "wardrobeDigitize",
        status: "processing",
        pointsCost: WARDROBE_CREDIT_COSTS.garmentUpload,
      });

      try {
        // Run pipeline with atomic credits
        const result = await withAtomicCredits(
          {
            userId: ctx.user.id,
            amount: WARDROBE_CREDIT_COSTS.garmentUpload,
            description: "Wardrobe garment upload pipeline",
          },
          async () => {
            // Detect garment type + quality check in parallel
            const [detected, quality] = await Promise.all([
              detectGarmentsInImage(originalUrl),
              checkImageQuality(originalUrl),
            ]);
            const primaryItem = detected[0];
            const label = primaryItem?.label || input.slotType;

            // Digitize (create flat-lay studio version)
            const digitized = await digitizeGarment(
              originalUrl,
              input.slotType,
              label,
              String(ctx.user.id),
            );

            // Analyze metadata
            const metadata = await analyzeGarmentMetadata(
              digitized.flatLayUrl,
              label,
            );

            return { detected, digitized, metadata, quality };
          },
        );

        // Update garment record with results
        const qualityIssues = result.quality.issues.length > 0 ? result.quality.issues : null;
        await updateGarment(garmentId, {
          shortName: result.metadata.shortName,
          description: result.metadata.description,
          tags: result.metadata.tags,
          suggestedActions: result.metadata.suggestedActions,
          isolatedImageUrl: result.digitized.flatLayUrl,
          qualityIssues,
          status: "ready",
        });

        log.info(`Garment ${garmentId} processed for user ${ctx.user.id}: ${result.metadata.shortName}`);

        return {
          garmentId,
          shortName: result.metadata.shortName,
          isolatedImageUrl: result.digitized.flatLayUrl,
          qualityIssues,
          status: "ready" as const,
        };
      } catch (err) {
        await updateGarment(garmentId, { status: "failed" });
        throw err;
      }
    }),

  /** Lightweight scan: upload to S3 + detect garments without digitize/analyze pipeline */
  quickDetect: protectedProcedure
    .input(z.object({
      imageBase64: z.string().max(10_000_000),
      targetSlot: z.enum(["tops", "bottoms", "shoes", "accessories"]),
    }))
    .mutation(async ({ ctx, input }) => {
      throwIfRateLimited(ctx.user.id);

      // Upload to S3
      const suffix = Math.random().toString(36).slice(2, 8);
      const fileKey = `${ctx.user.id}-wardrobe/scan-${Date.now()}-${suffix}.png`;
      const imageBuffer = Buffer.from(
        input.imageBase64.replace(/^data:image\/\w+;base64,/, ""),
        "base64",
      );
      const { url: sourceImageUrl } = await storagePut(fileKey, imageBuffer, "image/png");

      // Run lightweight detection (no credits — UX guard only)
      const detected = await detectGarmentsInImage(sourceImageUrl);
      const matchingCount = detected.filter((d) => d.category === input.targetSlot).length;

      log.info(`quickDetect for user ${ctx.user.id}: ${detected.length} total, ${matchingCount} matching '${input.targetSlot}'`);

      return {
        sourceImageUrl,
        garments: detected,
        matchingCount,
        totalCount: detected.length,
      };
    }),

  delete: protectedProcedure
    .input(z.object({ garmentId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const garment = await getGarmentById(input.garmentId);
      if (!garment || garment.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Garment not found" });
      }
      await deleteGarment(input.garmentId, ctx.user.id);
      return { success: true };
    }),
});

// ── VTO Procedures ─────────────────────────────────────────────────────────

const vtoRouter = router({
  generate: protectedProcedure
    .input(z.object({
      modelImageUrl: z.string().url(),
      garmentIds: z.array(z.number()).min(1).max(5),
      styleNotes: z.record(z.string(), z.string()).optional(),
      tattooMap: z.object({
        hasTattoos: z.boolean(),
        tattooAreas: z.array(z.string()),
        cleanAreas: z.array(z.string()),
        promptFragment: z.string(),
      }).optional(),
      sessionId: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      throwIfRateLimited(ctx.user.id);
      await enforceDailyQuota(ctx.user.id);

      // Fetch garments and validate ownership
      const garments = await Promise.all(
        input.garmentIds.map(async (id) => {
          const g = await getGarmentById(id);
          if (!g || g.userId !== ctx.user.id) {
            throw new TRPCError({ code: "NOT_FOUND", message: `Garment ${id} not found` });
          }
          if (g.status !== "ready") {
            throw new TRPCError({ code: "BAD_REQUEST", message: `Garment ${id} is still processing` });
          }
          return g;
        }),
      );

      const genResult = await createGeneration({
        userId: ctx.user.id,
        type: "wardrobeVTO",
        status: "processing",
        pointsCost: WARDROBE_CREDIT_COSTS.vtoGeneration,
      });

      const result = await withAtomicCredits(
        {
          userId: ctx.user.id,
          amount: WARDROBE_CREDIT_COSTS.vtoGeneration,
          description: "Wardrobe VTO generation",
          referenceId: `gen-${genResult.generationId}`,
        },
        async () => {
          const aspectRatio = await getImageAspectBucket(input.modelImageUrl);
          return generateVirtualTryOn({
            modelImageUrl: input.modelImageUrl,
            garments: garments.map((g) => toGarmentForVTO(g, input.styleNotes?.[String(g.id)])),
            tattooMap: input.tattooMap,
            userId: String(ctx.user.id),
            sessionId: input.sessionId ? String(input.sessionId) : "default",
            aspectRatio,
          });
        },
      );

      // Update session history if provided
      if (input.sessionId) {
        const session = await getSessionById(input.sessionId);
        if (session && session.userId === ctx.user.id) {
          const history = (session.history as string[] || []);
          history.push(result.resultUrl);
          await updateSession(input.sessionId, {
            history,
            historyIndex: history.length - 1,
            activeGarmentIds: input.garmentIds,
            ...(input.tattooMap ? { tattooMapData: input.tattooMap } : {}),
            ...(input.styleNotes ? { styleNotes: input.styleNotes } : {}),
          });
        }
      }

      log.info(`VTO generated for user ${ctx.user.id} with ${garments.length} garments`);
      return { resultUrl: result.resultUrl };
    }),

  incremental: protectedProcedure
    .input(z.object({
      previousResultUrl: z.string().url(),
      modelImageUrl: z.string().url(),
      changedGarmentIds: z.array(z.number()).min(1),
      changedSlots: z.array(z.string()),
      allGarmentIds: z.array(z.number()),
      styleNotes: z.record(z.string(), z.string()).optional(),
      tattooMap: z.object({
        hasTattoos: z.boolean(),
        tattooAreas: z.array(z.string()),
        cleanAreas: z.array(z.string()),
        promptFragment: z.string(),
      }).optional(),
      isStyleRefresh: z.boolean().optional(),
      sessionId: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      throwIfRateLimited(ctx.user.id);
      await enforceDailyQuota(ctx.user.id);

      // Fetch all garments
      const allGarments = await Promise.all(
        input.allGarmentIds.map(async (id) => {
          const g = await getGarmentById(id);
          if (!g || g.userId !== ctx.user.id) {
            throw new TRPCError({ code: "NOT_FOUND", message: `Garment ${id} not found` });
          }
          return g;
        }),
      );

      const changedGarments = await Promise.all(
        input.changedGarmentIds.map(async (id) => {
          const g = await getGarmentById(id);
          if (!g || g.userId !== ctx.user.id) {
            throw new TRPCError({ code: "NOT_FOUND", message: `Garment ${id} not found` });
          }
          return g;
        }),
      );

      const genResult = await createGeneration({
        userId: ctx.user.id,
        type: "wardrobeComposite",
        status: "processing",
        pointsCost: WARDROBE_CREDIT_COSTS.vtoIncremental,
      });

      const result = await withAtomicCredits(
        {
          userId: ctx.user.id,
          amount: WARDROBE_CREDIT_COSTS.vtoIncremental,
          description: "Wardrobe incremental VTO",
          referenceId: `gen-${genResult.generationId}`,
        },
        async () => {
          const aspectRatio = await getImageAspectBucket(input.modelImageUrl);
          return incrementalComposite({
            previousResultUrl: input.previousResultUrl,
            modelImageUrl: input.modelImageUrl,
            changedGarments: changedGarments.map((g) => toGarmentForVTO(g, input.styleNotes?.[String(g.id)])),
            changedSlots: input.changedSlots,
            allGarments: allGarments.map((g) => toGarmentForVTO(g, input.styleNotes?.[String(g.id)])),
            tattooMap: input.tattooMap,
            isStyleRefresh: input.isStyleRefresh,
            userId: String(ctx.user.id),
            sessionId: input.sessionId ? String(input.sessionId) : "default",
            aspectRatio,
          });
        },
      );

      return { resultUrl: result.resultUrl };
    }),

  refine: protectedProcedure
    .input(z.object({
      currentResultUrl: z.string().url(),
      modelImageUrl: z.string().url(),
      garmentId: z.number(),
      instruction: z.string().max(500),
      allGarmentIds: z.array(z.number()).optional(),
      tattooMap: z.object({
        hasTattoos: z.boolean(),
        tattooAreas: z.array(z.string()),
        cleanAreas: z.array(z.string()),
        promptFragment: z.string(),
      }).optional(),
      sessionId: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      throwIfRateLimited(ctx.user.id);
      await enforceDailyQuota(ctx.user.id);

      const garment = await getGarmentById(input.garmentId);
      if (!garment || garment.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Garment not found" });
      }

      // Build outfit context and garment references from all active garments
      let outfitContext: string | undefined;
      let garmentReferenceUrls: { label: string; url: string }[] | undefined;

      if (input.allGarmentIds && input.allGarmentIds.length > 0) {
        const allGarments = await Promise.all(
          input.allGarmentIds.map(async (id) => {
            const g = await getGarmentById(id);
            if (!g || g.userId !== ctx.user.id) return null;
            return g;
          }),
        );
        const validGarments = allGarments.filter(
          (g): g is NonNullable<typeof g> =>
            g !== null && g.status === "ready" && !!g.description && !g.description.startsWith("Analyzing"),
        );

        if (validGarments.length > 0) {
          outfitContext = validGarments.map((g) => g.description).join(", ");
          garmentReferenceUrls = validGarments
            .filter((g) => g.isolatedImageUrl || g.originalImageUrl)
            .map((g) => ({
              label: g.description || g.shortName || g.slotType,
              url: g.isolatedImageUrl || g.originalImageUrl,
            }));
        }
      }

      const tattooPromptFragment = input.tattooMap?.promptFragment;

      const genResult = await createGeneration({
        userId: ctx.user.id,
        type: "wardrobeRefinement",
        status: "processing",
        pointsCost: WARDROBE_CREDIT_COSTS.garmentRefinement,
      });

      const result = await withAtomicCredits(
        {
          userId: ctx.user.id,
          amount: WARDROBE_CREDIT_COSTS.garmentRefinement,
          description: "Wardrobe garment refinement",
          referenceId: `gen-${genResult.generationId}`,
        },
        async () => {
          const aspectRatio = await getImageAspectBucket(input.modelImageUrl);
          return refineGarment({
            resultImageUrl: input.currentResultUrl,
            modelImageUrl: input.modelImageUrl,
            garmentLabel: garment.shortName || "garment",
            category: garment.slotType,
            instruction: input.instruction,
            outfitContext,
            garmentReferenceUrls,
            tattooPromptFragment,
            userId: String(ctx.user.id),
            sessionId: input.sessionId ? String(input.sessionId) : "default",
            aspectRatio,
          });
        },
      );

      return { resultUrl: result.resultUrl };
    }),

  /** Detect garments in a VTO result image for clickable bounding box overlays */
  detectResultGarments: protectedProcedure
    .input(z.object({ resultUrl: z.string().url() }))
    .mutation(async ({ ctx, input }) => {
      throwIfRateLimited(ctx.user.id);
      log.info(`Detecting garments in VTO result for user ${ctx.user.id}`);
      return detectGarmentsInImage(input.resultUrl);
    }),

  /** Classify a refinement instruction as small (localized) or large (structural). */
  classifyEdit: protectedProcedure
    .input(z.object({ instruction: z.string().min(1).max(500) }))
    .mutation(async ({ ctx, input }) => {
      throwIfRateLimited(ctx.user.id);
      const editSize = await classifyEditSize(input.instruction);
      return { editSize };
    }),

  /** Verify identity consistency between model photo and VTO result. */
  checkIdentity: protectedProcedure
    .input(z.object({
      modelImageUrl: z.string().url(),
      resultImageUrl: z.string().url(),
    }))
    .mutation(async ({ ctx, input }) => {
      throwIfRateLimited(ctx.user.id);
      const match = await checkIdentityMatch(input.modelImageUrl, input.resultImageUrl);
      return { match };
    }),
});

// ── Decomposition Procedures ───────────────────────────────────────────────

const decomposeRouter = router({
  analyze: protectedProcedure
    .input(z.object({
      imageBase64: z.string().max(10_000_000),
    }))
    .mutation(async ({ ctx, input }) => {
      throwIfRateLimited(ctx.user.id);

      // Upload to S3 first
      const suffix = Math.random().toString(36).slice(2, 8);
      const fileKey = `${ctx.user.id}-wardrobe/decompose-${Date.now()}-${suffix}.png`;
      const imageBuffer = Buffer.from(
        input.imageBase64.replace(/^data:image\/\w+;base64,/, ""),
        "base64",
      );
      const { url } = await storagePut(fileKey, imageBuffer, "image/png");

      const result = await withAtomicCredits(
        {
          userId: ctx.user.id,
          amount: WARDROBE_CREDIT_COSTS.outfitDecomposition,
          description: "Outfit decomposition analysis",
        },
        async () => {
          return decomposeOutfit(url, String(ctx.user.id));
        },
      );

      return result;
    }),

  import: protectedProcedure
    .input(z.object({
      sourceImageUrl: z.string().url(),
      label: z.string(),
      slotType: z.enum(["full_look", "tops", "bottoms", "shoes", "accessories"]),
    }))
    .mutation(async ({ ctx, input }) => {
      throwIfRateLimited(ctx.user.id);
      await enforceDailyQuota(ctx.user.id);

      // Create garment record
      const garmentId = await createGarment({
        userId: ctx.user.id,
        slotType: input.slotType,
        originalImageUrl: input.sourceImageUrl,
        shortName: input.label,
        status: "processing",
      });

      try {
        const result = await withAtomicCredits(
          {
            userId: ctx.user.id,
            amount: WARDROBE_CREDIT_COSTS.garmentDigitize + WARDROBE_CREDIT_COSTS.garmentAnalyze,
            description: "Import garment from decomposition",
          },
          async () => {
            const digitized = await digitizeGarment(
              input.sourceImageUrl,
              input.slotType,
              input.label,
              String(ctx.user.id),
            );
            const metadata = await analyzeGarmentMetadata(
              digitized.flatLayUrl,
              input.label,
            );
            return { digitized, metadata };
          },
        );

        await updateGarment(garmentId, {
          shortName: result.metadata.shortName,
          description: result.metadata.description,
          tags: result.metadata.tags,
          suggestedActions: result.metadata.suggestedActions,
          isolatedImageUrl: result.digitized.flatLayUrl,
          status: "ready",
        });

        return { garmentId, shortName: result.metadata.shortName };
      } catch (err) {
        await updateGarment(garmentId, { status: "failed" });
        throw err;
      }
    }),
});

// ── Session Procedures ─────────────────────────────────────────────────────

const sessionRouter = router({
  create: protectedProcedure
    .input(z.object({
      modelId: z.number().optional(),
      modelImageUrl: z.string().url(),
    }))
    .mutation(async ({ ctx, input }) => {
      const sessionId = await createSession({
        userId: ctx.user.id,
        modelId: input.modelId ?? null,
        modelImageUrl: input.modelImageUrl,
        history: [],
        historyIndex: 0,
        activeGarmentIds: [],
      });
      return { sessionId };
    }),

  get: protectedProcedure
    .input(z.object({ sessionId: z.number() }))
    .query(async ({ ctx, input }) => {
      const session = await getSessionById(input.sessionId);
      if (!session || session.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Session not found" });
      }
      return session;
    }),

  list: protectedProcedure
    .query(async ({ ctx }) => {
      return getUserSessions(ctx.user.id);
    }),

  /** Get the user's most recent session with VTO history (for "Continue Session" lobby card) */
  getLatest: protectedProcedure
    .query(async ({ ctx }) => {
      return getLatestUserSession(ctx.user.id);
    }),

  update: protectedProcedure
    .input(z.object({
      sessionId: z.number(),
      history: z.array(z.string()).optional(),
      historyIndex: z.number().optional(),
      activeGarmentIds: z.array(z.number()).optional(),
      tattooMapData: z.any().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const session = await getSessionById(input.sessionId);
      if (!session || session.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Session not found" });
      }
      const { sessionId, ...updateData } = input;
      await updateSession(sessionId, updateData);
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ sessionId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const session = await getSessionById(input.sessionId);
      if (!session || session.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Session not found" });
      }
      await deleteSession(input.sessionId, ctx.user.id);
      return { success: true };
    }),

  seedChat: protectedProcedure
    .input(z.object({
      sessionId: z.string(),
      modelImageUrl: z.string().url(),
      resultUrl: z.string().url(),
      outfitDescription: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await seedSession(
        ctx.user.id,
        input.sessionId,
        input.modelImageUrl,
        input.resultUrl,
        input.outfitDescription,
      );
      return { success: true };
    }),

  clearChat: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      clearSession(ctx.user.id, input.sessionId);
      return { success: true };
    }),
});

// ── Outfit Procedures ──────────────────────────────────────────────────────

const outfitRouter = router({
  list: protectedProcedure
    .query(async ({ ctx }) => {
      return getUserOutfits(ctx.user.id);
    }),

  save: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(128),
      garmentIds: z.array(z.number()).min(1),
      styleNotes: z.record(z.string(), z.string()).optional(),
      resultThumbUrl: z.string().url().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      for (const id of input.garmentIds) {
        const g = await getGarmentById(id);
        if (!g || g.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: `Garment ${id} not found` });
        }
      }
      const outfitId = await createOutfit({
        userId: ctx.user.id,
        name: input.name,
        garmentIds: input.garmentIds,
        styleNotes: input.styleNotes,
        resultThumbUrl: input.resultThumbUrl,
      });
      return { outfitId };
    }),

  delete: protectedProcedure
    .input(z.object({ outfitId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const outfit = await getOutfitById(input.outfitId);
      if (!outfit || outfit.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Outfit not found" });
      }
      await deleteOutfit(input.outfitId, ctx.user.id);
      return { success: true };
    }),
});

// ── Model Upload Procedure ────────────────────────────────────────────────

const modelRouter = router({
  /** List user's exported/minted models with thumbnails for the lobby gallery */
  listMinted: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(50).default(20) }).optional())
    .query(async ({ ctx, input }) => {
      return await getUserMintedModelsWithThumbnail(ctx.user.id, input?.limit ?? 20);
    }),

  upload: protectedProcedure
    .input(z.object({
      imageBase64: z.string().max(10_000_000),
      fileName: z.string().max(256).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      throwIfRateLimited(ctx.user.id);

      const suffix = Math.random().toString(36).slice(2, 10);
      const fileKey = `${ctx.user.id}-models/upload-${Date.now()}-${suffix}.png`;
      const imageBuffer = Buffer.from(
        input.imageBase64.replace(/^data:image\/\w+;base64,/, ""),
        "base64",
      );
      const { url } = await storagePut(fileKey, imageBuffer, "image/png");

      log.info(`Model photo uploaded for user ${ctx.user.id}: ${fileKey}`);
      return { url, fileKey };
    }),

  /** Analyze a model photo for tattoos — returns a TattooMap for VTO/refinement */
  analyzeTattoos: protectedProcedure
    .input(z.object({ imageUrl: z.string().url() }))
    .mutation(async ({ ctx, input }) => {
      throwIfRateLimited(ctx.user.id);
      log.info(`Tattoo analysis requested for user ${ctx.user.id}`);
      return analyzeTattoos(input.imageUrl);
    }),

  /** Check model photo quality before VTO — returns quality rating + issues */
  checkQuality: protectedProcedure
    .input(z.object({ imageUrl: z.string().url() }))
    .mutation(async ({ ctx, input }) => {
      throwIfRateLimited(ctx.user.id);
      log.info(`Quality check requested for user ${ctx.user.id}`);
      return checkImageQuality(input.imageUrl);
    }),
});

// ── Combined Wardrobe Router ───────────────────────────────────────────────

export const wardrobeRouter = router({
  garments: garmentRouter,
  vto: vtoRouter,
  decompose: decomposeRouter,
  sessions: sessionRouter,
  outfits: outfitRouter,
  model: modelRouter,
});
