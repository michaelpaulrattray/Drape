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
  resolveOwnedEffectiveCastStates,
  type EffectiveCastState,
} from "./effectiveCastState";

function mapEffectiveCastStateError(error: unknown): never {
  if (!(error instanceof EffectiveCastStateError)) throw error;
  throw new TRPCError({
    code: error.code === "model_not_found" ? "NOT_FOUND" : "PRECONDITION_FAILED",
    message: error.message,
    cause: error,
  });
}

/*
  Re-exported so a ROUTE can narrow to the comp-card six without importing the
  B1 resolver directly — that import list is pinned deliberately
  (`r7-snapshot-selection-contract.test.ts`). Reads reach the effective state
  through this module, and the comp-card narrowing is part of reading it.
*/
export { compCardViews } from "./effectiveCastState";

export async function resolveEffectiveCastStateForRead(input: {
  userId: number;
  modelId: number;
}): Promise<EffectiveCastState> {
  try {
    return await resolveOwnedEffectiveCastState(input);
  } catch (error) {
    return mapEffectiveCastStateError(error);
  }
}

export async function resolveEffectiveCastStatesForRead(input: {
  userId: number;
  modelIds: readonly number[];
}): Promise<Map<number, EffectiveCastState>> {
  try {
    return await resolveOwnedEffectiveCastStates(input);
  } catch (error) {
    return mapEffectiveCastStateError(error);
  }
}
