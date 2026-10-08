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
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { withAtomicCredits } from "../casting/atomicCredits";
import { enforceDailyQuota } from "../db/dailyQuota";
import { checkRateLimit, RATE_LIMITS, rateLimitError } from "../security/rateLimit";
import { createModuleLogger } from "../logging/logger";
import { WARDROBE_CREDIT_COSTS } from "../wardrobe/creditCosts";
import { buildOutfitContext, selectDescribableGarments } from "../wardrobe/garmentDescription";
import {
  createGarment, getGarmentById, getOwnedGarmentsByIds, getUserGarments, getUserGarmentsBySlot,
  updateGarment, deleteGarment,
  createOutfit, getUserOutfits, getOutfitById, deleteOutfit,
  createSession, getSessionById, getUserSessions, updateSession, deleteSession, appendSessionResult,
  getLatestUserSession, getRecentUserSessions, capUserSessions,
  createGeneration,
  saveLook, getUserLooksByModel, getUserLooks, renameLook, deleteLook,
} from "../db";
import {
  getUserDraftModelsWithThumbnailForRead,
  getUserMintedModelsWithThumbnailForRead,
} from "../casting/modelReadProjections";
import { captureSnapshotReadMode } from "../casting/snapshotReadScope";
import { putWardrobeScratchUpload } from "../wardrobe/scratchUpload";
import {
  adoptGarmentPictures,
  garmentRowPictures,
  importPictureChoice,
} from "../wardrobe/garmentAdoption";
import { detectGarmentsInImage } from "../wardrobe/garmentDetection";
import { digitizeGarment } from "../wardrobe/garmentDigitization";
import { assertWardrobeTryOnOpen } from "../wardrobe/tryOnDoor";
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
import { OUTFIT_NAME_MAX_LENGTH } from "../../shared/inputLimits";
import {
  wardrobeClassifyEditInput,
  wardrobeImportInput,
  wardrobeOutfitSaveInput,
  wardrobeQuickDetectInput,
  wardrobeRefineInput,
  wardrobeSessionCreateInput,
  wardrobeUploadInput,
  wardrobeVtoGenerateInput,
} from "./wardrobeInput";
import {
  resolveWardrobeSessionCreateImage,
  resolveWardrobeSessionUseImage,
} from "../wardrobe/modelImageAuthority";

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
    imageUrl: g.isolatedImageUrl || g.originalImageUrl,
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
    .input(wardrobeUploadInput)
    .mutation(async ({ ctx, input }) => {
      /* THE DOOR (#1537, his word *"SWITCH IT OFF"*, 2026-09-30) — first
         statement, so the refusal costs the customer nothing: no rate-limit
         slot, no quota, no generation row, no credit hold. The pipeline
         functions carry the same throw as the structural backstop. */
      assertWardrobeTryOnOpen();
      throwIfRateLimited(ctx.user.id);
      await enforceDailyQuota(ctx.user.id);

      /* THE PHOTOGRAPH IS REGISTERED BEFORE IT IS WRITTEN (#2021). It used to
         be a bare `storagePut` one statement ahead of the insert, so a request
         that died in between — a database hiccup, a deploy — left her
         photograph on a permanently public key that no row and no manifest
         named. Now a held manifest names the key first, and `createGarment`
         discharges it IN THE SAME TRANSACTION as the insert: either the row
         owns the key, or the worker collects it. */
      const suffix = randomUUID();
      const fileKey = `${ctx.user.id}-wardrobe/original-${Date.now()}-${suffix}.png`;
      const imageBuffer = Buffer.from(
        input.imageBase64.replace(/^data:image\/\w+;base64,/, ""),
        "base64",
      );
      const { url: originalUrl, cleanupBatchId: originalReceipt } = await putWardrobeScratchUpload({
        userId: ctx.user.id,
        key: fileKey,
        bytes: imageBuffer,
        contentType: "image/png",
      });

      // Create garment record (status: processing) — the row adopts the photograph.
      const garmentId = await createGarment({
        userId: ctx.user.id,
        slotType: input.slotType,
        originalImageUrl: originalUrl,
        originalImageKey: fileKey,
        status: "processing",
      }, [originalReceipt]);

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
            toolKind: "image",
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
    .input(wardrobeQuickDetectInput)
    .mutation(async ({ ctx, input }) => {
      throwIfRateLimited(ctx.user.id);

      // Upload to S3
      const suffix = randomUUID();
      const fileKey = `${ctx.user.id}-wardrobe/scan-${Date.now()}-${suffix}.png`;
      const imageBuffer = Buffer.from(
        input.imageBase64.replace(/^data:image\/\w+;base64,/, ""),
        "base64",
      );
      /* REGISTERED BEFORE IT EXISTS (#1961). Nothing read this key, so no
         cleanup could ever reach the object and it stayed at a permanently
         public URL for good. The detector inlines the bytes it is handed, so
         the upload exists only to give the client a URL `import` can persist —
         which is why it is registered-and-swept rather than removed. */
      const { url: sourceImageUrl } = await putWardrobeScratchUpload({
        userId: ctx.user.id,
        key: fileKey,
        bytes: imageBuffer,
        contentType: "image/png",
      });

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
    .input(wardrobeVtoGenerateInput)
    .mutation(async ({ ctx, input }) => {
      /* THE DOOR (#1537, his word *"SWITCH IT OFF"*, 2026-09-30) — first
         statement, so the refusal costs the customer nothing: no rate-limit
         slot, no quota, no generation row, no credit hold. The pipeline
         functions carry the same throw as the structural backstop. */
      assertWardrobeTryOnOpen();
      const readMode = captureSnapshotReadMode(ctx.user.id);
      throwIfRateLimited(ctx.user.id);
      await enforceDailyQuota(ctx.user.id);
      const modelImageUrl = await resolveWardrobeSessionUseImage({
        userId: ctx.user.id,
        sessionId: input.sessionId,
        requestedImageUrl: input.modelImageUrl,
        readMode,
      });

      /* ONE OWNER-SCOPED READ OF EVERY GARMENT NAMED, never one query per id
         fired at once (#2000). The input array carries no `.max()`, so the old
         `Promise.all` held one slot of the shared pool (20 + 50) per garment
         and a request naming more than about seventy of them was refused with
         `Queue limit reached.`. The owner is now in the statement rather than
         checked after it (invariant 1), and the ids are walked in the
         CUSTOMER'S order, so the id named in a refusal is the first missing
         one rather than whichever lookup lost the race. */
      const ownedGarments = await getOwnedGarmentsByIds(ctx.user.id, input.garmentIds);
      const garments = input.garmentIds.map((id) => {
        const g = ownedGarments.get(id);
        if (!g) {
          throw new TRPCError({ code: "NOT_FOUND", message: `Garment ${id} not found` });
        }
        if (g.status !== "ready") {
          throw new TRPCError({ code: "BAD_REQUEST", message: `Garment ${id} is still processing` });
        }
        return g;
      });

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
          toolKind: "image",
        },
        async () => {
          const aspectRatio = await getImageAspectBucket(modelImageUrl);
          return generateVirtualTryOn({
            modelImageUrl,
            garments: garments.map((g) => toGarmentForVTO(g, input.styleNotes?.[String(g.id)])),
            tattooMap: input.tattooMap,
            userId: String(ctx.user.id),
            sessionId: input.sessionId ? String(input.sessionId) : "default",
            aspectRatio,
          });
        },
      );

      /* THE SESSION ADOPTS THE RESULT, OR THE WORKER COLLECTS IT (#1980). The
         result was registered in a cleanup manifest before its bytes were
         written; `appendSessionResult` writes it onto the history and
         discharges that manifest in one transaction. With no session, or one
         that is not this account's, nothing discharges it — the picture stays
         reachable for the scratch hold and is then swept, where it used to sit
         at a public URL that nothing named, for ever. */
      if (input.sessionId) {
        await appendSessionResult({
          sessionId: input.sessionId,
          userId: ctx.user.id,
          resultUrl: result.resultUrl,
          cleanupBatchId: result.cleanupBatchId,
          patch: {
            activeGarmentIds: input.garmentIds,
            ...(input.tattooMap ? { tattooMapData: input.tattooMap } : {}),
            ...(input.styleNotes ? { styleNotes: input.styleNotes } : {}),
          },
        });
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
    }).strict())
    .mutation(async ({ ctx, input }) => {
      /* THE DOOR (#1537, his word *"SWITCH IT OFF"*, 2026-09-30) — first
         statement, so the refusal costs the customer nothing: no rate-limit
         slot, no quota, no generation row, no credit hold. The pipeline
         functions carry the same throw as the structural backstop. */
      assertWardrobeTryOnOpen();
      const readMode = captureSnapshotReadMode(ctx.user.id);
      throwIfRateLimited(ctx.user.id);
      await enforceDailyQuota(ctx.user.id);
      const modelImageUrl = await resolveWardrobeSessionUseImage({
        userId: ctx.user.id,
        sessionId: input.sessionId,
        requestedImageUrl: input.modelImageUrl,
        readMode,
      });

      /* BOTH LISTS IN ONE OWNER-SCOPED READ (#2000 — see `compose` above for
         the whole reasoning). The two arrays overlap by design, so they are
         read together and answered separately; `getOwnedGarmentsByIds`
         de-duplicates, which the two fan-outs did not. */
      const ownedGarments = await getOwnedGarmentsByIds(ctx.user.id, [
        ...input.allGarmentIds,
        ...input.changedGarmentIds,
      ]);
      const requireGarment = (id: number) => {
        const g = ownedGarments.get(id);
        if (!g) {
          throw new TRPCError({ code: "NOT_FOUND", message: `Garment ${id} not found` });
        }
        return g;
      };
      const allGarments = input.allGarmentIds.map(requireGarment);
      const changedGarments = input.changedGarmentIds.map(requireGarment);

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
          toolKind: "image",
        },
        async () => {
          const aspectRatio = await getImageAspectBucket(modelImageUrl);
          return incrementalComposite({
            previousResultUrl: input.previousResultUrl,
            modelImageUrl,
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

      // The session adopts the result, or the worker collects it (#1980 — see `generate`).
      if (input.sessionId) {
        await appendSessionResult({
          sessionId: input.sessionId,
          userId: ctx.user.id,
          resultUrl: result.resultUrl,
          cleanupBatchId: result.cleanupBatchId,
          patch: {
            activeGarmentIds: input.allGarmentIds,
            ...(input.tattooMap ? { tattooMapData: input.tattooMap } : {}),
            ...(input.styleNotes ? { styleNotes: input.styleNotes } : {}),
          },
        });
      }

      return { resultUrl: result.resultUrl };
    }),

  refine: protectedProcedure
    .input(wardrobeRefineInput)
    .mutation(async ({ ctx, input }) => {
      /* THE DOOR (#1537, his word *"SWITCH IT OFF"*, 2026-09-30) — first
         statement, so the refusal costs the customer nothing: no rate-limit
         slot, no quota, no generation row, no credit hold. The pipeline
         functions carry the same throw as the structural backstop. */
      assertWardrobeTryOnOpen();
      const readMode = captureSnapshotReadMode(ctx.user.id);
      throwIfRateLimited(ctx.user.id);
      await enforceDailyQuota(ctx.user.id);
      const modelImageUrl = await resolveWardrobeSessionUseImage({
        userId: ctx.user.id,
        sessionId: input.sessionId,
        requestedImageUrl: input.modelImageUrl,
        readMode,
      });

      const garment = await getGarmentById(input.garmentId);
      if (!garment || garment.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Garment not found" });
      }

      // Build outfit context and garment references from all active garments
      let outfitContext: string | undefined;
      let garmentReferenceUrls: { label: string; url: string }[] | undefined;

      if (input.allGarmentIds && input.allGarmentIds.length > 0) {
        /* One owner-scoped read (#2000). An id that is not this account's
           still reads as `null` here, exactly as the per-row check did — this
           road describes what it can and skips what it cannot. */
        const owned = await getOwnedGarmentsByIds(ctx.user.id, input.allGarmentIds);
        const allGarments = input.allGarmentIds.map((id) => owned.get(id) ?? null);
        const validGarments = selectDescribableGarments(allGarments);

        if (validGarments.length > 0) {
          outfitContext = buildOutfitContext(validGarments);
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
          toolKind: "image",
        },
        async () => {
          const aspectRatio = await getImageAspectBucket(modelImageUrl);
          return refineGarment({
            resultImageUrl: input.currentResultUrl,
            modelImageUrl,
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

      // The session adopts the result, or the worker collects it (#1980 — see `generate`).
      if (input.sessionId) {
        await appendSessionResult({
          sessionId: input.sessionId,
          userId: ctx.user.id,
          resultUrl: result.resultUrl,
          cleanupBatchId: result.cleanupBatchId,
        });
      }

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
    .input(wardrobeClassifyEditInput)
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
      sessionId: z.number().optional(),
    }).strict())
    .mutation(async ({ ctx, input }) => {
      const readMode = captureSnapshotReadMode(ctx.user.id);
      throwIfRateLimited(ctx.user.id);
      const modelImageUrl = await resolveWardrobeSessionUseImage({
        userId: ctx.user.id,
        sessionId: input.sessionId,
        requestedImageUrl: input.modelImageUrl,
        readMode,
      });
      const match = await checkIdentityMatch(modelImageUrl, input.resultImageUrl);
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
      const suffix = randomUUID();
      const fileKey = `${ctx.user.id}-wardrobe/decompose-${Date.now()}-${suffix}.png`;
      const imageBuffer = Buffer.from(
        input.imageBase64.replace(/^data:image\/\w+;base64,/, ""),
        "base64",
      );
      /* REGISTERED BEFORE IT EXISTS (#1961) — the same orphan as quickDetect's,
         and the crops `decomposeOutfit` cuts from it are registered the same
         way, which the card did not name and the class sweep found. */
      const { url } = await putWardrobeScratchUpload({
        userId: ctx.user.id,
        key: fileKey,
        bytes: imageBuffer,
        contentType: "image/png",
      });

      const result = await withAtomicCredits(
        {
          userId: ctx.user.id,
          amount: WARDROBE_CREDIT_COSTS.outfitDecomposition,
          description: "Outfit decomposition analysis",
          // The deliverable is the garment crop images cut from the outfit
          // photo and stored per garment — image output, not a bare reading.
          toolKind: "image",
        },
        async () => {
          return decomposeOutfit(url, ctx.user.id);
        },
      );

      return result;
    }),

  import: protectedProcedure
    .input(wardrobeImportInput)
    .mutation(async ({ ctx, input }) => {
      /* THE DOOR (#1537, his word *"SWITCH IT OFF"*, 2026-09-30) — first
         statement, so the refusal costs the customer nothing: no rate-limit
         slot, no quota, no generation row, no credit hold. The pipeline
         functions carry the same throw as the structural backstop. */
      assertWardrobeTryOnOpen();
      throwIfRateLimited(ctx.user.id);
      await enforceDailyQuota(ctx.user.id);

      /*
        THE GARMENT TAKES ITS OWN COPIES (#1961, the relay's finding on PR
        #1979). Both URLs name SCRATCH objects, registered for the cleanup
        worker by `quickDetect` and `decompose.analyze` — so writing them onto
        the row left a garment pointing at objects the worker was promised it
        could delete, about five minutes later. Copying first makes the row's
        pictures the row's own and puts their KEYS on it, which is what
        `accountDeletion.ts` reads.

        It runs BEFORE the credit hold on purpose: a refusal here costs the
        customer nothing, and a copy that fails must not leave a charged import.

        ⚠ Every step is a named function with arms, including the two that look
        like one line of route code. The crop-or-photograph choice and the row's
        picture fields are where the defect lived, and nothing in `pnpm test`
        can drive a decision written inside a tRPC handler.
      */
      const chosen = importPictureChoice(input);
      const adopted = await adoptGarmentPictures({
        userId: ctx.user.id,
        imageUrl: chosen.imageUrl,
        sourceUrl: chosen.sourceUrl,
        currentPublicUrl: process.env.R2_PUBLIC_URL ?? "",
      });
      /* The digitize reads the garment's OWN object from here on, never the
         scratch key it was cut from — one source of truth for what this row is
         made of. */
      const garmentImageUrl = adopted.image.url;

      // Create garment record — originalImageUrl is the crop, sourceImageUrl is the full outfit
      const garmentId = await createGarment({
        userId: ctx.user.id,
        slotType: input.slotType,
        ...garmentRowPictures(adopted),
        shortName: input.label,
        status: "processing",
      }, adopted.receipts);

      try {
        const result = await withAtomicCredits(
          {
            userId: ctx.user.id,
            amount: WARDROBE_CREDIT_COSTS.garmentDigitize + WARDROBE_CREDIT_COSTS.garmentAnalyze,
            description: "Import garment from decomposition",
            toolKind: "image",
          },
          async () => {
            // Digitize from the CROP, not the full outfit
            const digitized = await digitizeGarment(
              garmentImageUrl,
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
    .input(wardrobeSessionCreateInput)
    .mutation(async ({ ctx, input }) => {
      const readMode = captureSnapshotReadMode(ctx.user.id);
      const modelImageUrl = await resolveWardrobeSessionCreateImage({
        userId: ctx.user.id,
        modelId: input.modelId ?? null,
        requestedImageUrl: input.modelImageUrl,
        readMode,
      });
      const sessionId = await createSession({
        userId: ctx.user.id,
        modelId: input.modelId ?? null,
        modelImageUrl,
        history: [],
        historyIndex: 0,
        activeGarmentIds: [],
      });
      // Enforce session cap — delete oldest beyond limit
      await capUserSessions(ctx.user.id);
      return { sessionId };
    }),

  get: protectedProcedure
    .input(z.object({ sessionId: z.number() }).strict())
    .query(async ({ ctx, input }) => {
      const session = await getSessionById(input.sessionId, ctx.user.id);
      if (!session) {
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

  /** Get up to 4 recent sessions for the lobby multi-session cards */
  getRecent: protectedProcedure
    .query(async ({ ctx }) => {
      return getRecentUserSessions(ctx.user.id);
    }),

  update: protectedProcedure
    .input(z.object({
      sessionId: z.number(),
      history: z.array(z.string()).optional(),
      historyIndex: z.number().optional(),
      activeGarmentIds: z.array(z.number()).optional(),
      tattooMapData: z.any().optional(),
      styleNotes: z.record(z.string(), z.string()).optional(),
    }).strict())
    .mutation(async ({ ctx, input }) => {
      const session = await getSessionById(input.sessionId, ctx.user.id);
      if (!session) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Session not found" });
      }
      const { sessionId, ...updateData } = input;
      await updateSession(sessionId, ctx.user.id, updateData);
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ sessionId: z.number() }).strict())
    .mutation(async ({ ctx, input }) => {
      const session = await getSessionById(input.sessionId, ctx.user.id);
      if (!session) {
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
    }).strict())
    .mutation(async ({ ctx, input }) => {
      /* THE DOOR (#1537, his word *"SWITCH IT OFF"*, 2026-09-30) — first
         statement, so the refusal costs the customer nothing: no rate-limit
         slot, no quota, no generation row, no credit hold. The pipeline
         functions carry the same throw as the structural backstop. */
      assertWardrobeTryOnOpen();
      const readMode = captureSnapshotReadMode(ctx.user.id);
      const modelImageUrl = await resolveWardrobeSessionUseImage({
        userId: ctx.user.id,
        sessionId: input.sessionId,
        requestedImageUrl: input.modelImageUrl,
        readMode,
      });
      await seedSession(
        ctx.user.id,
        input.sessionId,
        modelImageUrl,
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
    .input(wardrobeOutfitSaveInput)
    .mutation(async ({ ctx, input }) => {
      /* A FIFTH SITE THE CARD DID NOT NAME, and it is the same shape at
         different odds (#2000's sweep). This one is a SEQUENTIAL loop, so it
         never held more than one pool slot and could not trip the ceiling —
         but it is still one round trip per garment, and it is one owner-scoped
         read now like its four neighbours. Nothing about the refusal moves:
         an id that is not this account's is still "not found", in the order
         the customer sent. */
      const owned = await getOwnedGarmentsByIds(ctx.user.id, input.garmentIds);
      for (const id of input.garmentIds) {
        if (!owned.has(id)) {
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
    .input(z.object({ limit: z.number().min(1).max(50).default(20) }).strict().optional())
    .query(async ({ ctx, input }) => {
      const readMode = captureSnapshotReadMode(ctx.user.id);
      return await getUserMintedModelsWithThumbnailForRead({
        userId: ctx.user.id,
        limit: input?.limit ?? 20,
        readMode,
      });
    }),

  /** List user's draft (unfinished) models with thumbnails for the lobby "Draft Casts" row */
  listDrafts: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(10).default(4) }).strict().optional())
    .query(async ({ ctx, input }) => {
      const readMode = captureSnapshotReadMode(ctx.user.id);
      return await getUserDraftModelsWithThumbnailForRead({
        userId: ctx.user.id,
        limit: input?.limit ?? 4,
        readMode,
      });
    }),

  upload: protectedProcedure
    .input(z.object({
      imageBase64: z.string().max(10_000_000),
      fileName: z.string().max(256).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      throwIfRateLimited(ctx.user.id);

      const suffix = randomUUID();
      const fileKey = `${ctx.user.id}-models/upload-${Date.now()}-${suffix}.png`;
      const imageBuffer = Buffer.from(
        input.imageBase64.replace(/^data:image\/\w+;base64,/, ""),
        "base64",
      );
      /* REGISTERED BEFORE IT EXISTS (#1961). The quietest of the four: the
         studio keeps this URL in a Zustand store and no row anywhere has ever
         held the key. */
      const { url } = await putWardrobeScratchUpload({
        userId: ctx.user.id,
        key: fileKey,
        bytes: imageBuffer,
        contentType: "image/png",
      });

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

// ── Looks Router (curated VTO results) ────────────────────────────────────────

const looksRouter = router({
  /** Save the current VTO result as a curated look */
  save: protectedProcedure
    .input(z.object({
      sessionId: z.number().optional(),
      modelId: z.number(),
      imageUrl: z.string().url(),
      name: z.string().max(100).optional(),
      garmentIds: z.array(z.number()),
    }))
    .mutation(async ({ ctx, input }) => {
      const lookId = await saveLook({
        userId: ctx.user.id,
        sessionId: input.sessionId ?? null,
        modelId: input.modelId,
        imageUrl: input.imageUrl,
        name: input.name ?? null,
        garmentIds: input.garmentIds,
      });
      log.info(`Look saved: id=${lookId} model=${input.modelId} user=${ctx.user.id}`);
      return { lookId };
    }),

  /** List saved looks for a specific model */
  list: protectedProcedure
    .input(z.object({ modelId: z.number() }))
    .query(async ({ ctx, input }) => {
      return getUserLooksByModel(ctx.user.id, input.modelId);
    }),

  /** List all of the user's saved looks across models (lobby library) */
  listAll: protectedProcedure
    .query(async ({ ctx }) => {
      return getUserLooks(ctx.user.id);
    }),

  /** Rename a saved look */
  rename: protectedProcedure
    .input(z.object({
      lookId: z.number(),
      name: z.string().max(100),
    }))
    .mutation(async ({ ctx, input }) => {
      await renameLook(input.lookId, ctx.user.id, input.name);
      log.info(`Look renamed: id=${input.lookId} user=${ctx.user.id}`);
      return { success: true };
    }),

  /** Delete a saved look */
  delete: protectedProcedure
    .input(z.object({ lookId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await deleteLook(input.lookId, ctx.user.id);
      log.info(`Look deleted: id=${input.lookId} user=${ctx.user.id}`);
      return { success: true };
    }),
});

// ── Combined Wardrobe Router ───────────────────────────────────────────────────────────────

export const wardrobeRouter = router({
  garments: garmentRouter,
  vto: vtoRouter,
  decompose: decomposeRouter,
  sessions: sessionRouter,
  outfits: outfitRouter,
  model: modelRouter,
  looks: looksRouter,
});
