import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../../_core/trpc";
import {
  acknowledgeGenerationOperation,
  getPublicGenerationOperation,
  getRecentPublicGenerationOperation,
  landGenerationOperationResult,
  listActivePublicGenerationOperations,
} from "../../db";

const operationIdInput = z.object({ operationId: z.string().uuid() }).strict();

function notFound(): never {
  throw new TRPCError({ code: "NOT_FOUND", message: "Operation not found" });
}

/** Authenticated, public-safe receipt reads and free settlement actions. Raw
 * payload hashes, ledger references, internal errors and provider inputs never
 * cross this router. */
export const generationOperationsRouter = router({
  operationState: protectedProcedure
    .input(operationIdInput)
    .query(async ({ ctx, input }) => {
      const operation = await getPublicGenerationOperation(ctx.user.id, input.operationId);
      return operation ?? notFound();
    }),

  activeOperations: protectedProcedure
    .input(z.object({
      boardId: z.number().int().positive().optional(),
      modelId: z.number().int().positive().optional(),
    }).strict().optional())
    .query(({ ctx, input }) => listActivePublicGenerationOperations({
      userId: ctx.user.id,
      boardId: input?.boardId,
      modelId: input?.modelId,
    })),

  recentOperation: protectedProcedure
    .input(z.object({ clientRequestId: z.string().uuid() }).strict())
    .query(async ({ ctx, input }) => {
      const operation = await getRecentPublicGenerationOperation({
        userId: ctx.user.id,
        clientRequestId: input.clientRequestId,
      });
      return operation ?? notFound();
    }),

  acknowledgeOperation: protectedProcedure
    .input(operationIdInput)
    .mutation(async ({ ctx, input }) => {
      const result = await acknowledgeGenerationOperation({
        userId: ctx.user.id,
        operationId: input.operationId,
      });
      if (result.type === "not_found") return notFound();
      if (result.type === "not_terminal") {
        throw new TRPCError({ code: "CONFLICT", message: "This operation is still in progress." });
      }
      if (result.type === "landing_required") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Place or dismiss the saved result before acknowledging this operation.",
        });
      }
      return result.operation;
    }),

  landOperationResult: protectedProcedure
    .input(z.object({
      operationId: z.string().uuid(),
      boardId: z.number().int().positive(),
      itemId: z.number().int().positive(),
    }).strict())
    .mutation(async ({ ctx, input }) => {
      const result = await landGenerationOperationResult({
        userId: ctx.user.id,
        operationId: input.operationId,
        boardId: input.boardId,
        itemId: input.itemId,
      });
      if (result.type === "not_found") return notFound();
      if (result.type === "not_terminal") {
        throw new TRPCError({ code: "CONFLICT", message: "This operation is still in progress." });
      }
      if (result.type === "landing_not_required") {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "This operation has no result to place." });
      }
      if (result.type === "invalid_result") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `The saved result needs support review before it can be placed. Operation ${input.operationId}.`,
        });
      }
      return result.operation;
    }),
});
