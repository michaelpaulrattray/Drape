/**
 * Product-facing adapter for the private snapshot resolver.
 *
 * The resolver keeps a closed internal error vocabulary. Routes/services use
 * this adapter so corrupt snapshot state becomes a free, typed refusal while
 * foreign/missing subjects remain non-leaking NOT_FOUND responses.
 */
import { TRPCError } from "@trpc/server";
import {
  EffectiveCastStateError,
  resolveOwnedEffectiveCastState,
  type EffectiveCastState,
} from "./effectiveCastState";

export async function resolveEffectiveCastStateForRead(input: {
  userId: number;
  modelId: number;
}): Promise<EffectiveCastState> {
  try {
    return await resolveOwnedEffectiveCastState(input);
  } catch (error) {
    if (!(error instanceof EffectiveCastStateError)) throw error;
    throw new TRPCError({
      code: error.code === "model_not_found" ? "NOT_FOUND" : "PRECONDITION_FAILED",
      message: error.message,
      cause: error,
    });
  }
}
