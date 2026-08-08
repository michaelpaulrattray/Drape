/**
 * The server half of `shared/spokenError` — see that file for the incident.
 *
 * A subclass rather than a field on `cause`, because tRPC hands the thrown
 * error itself to the formatter and a subclass survives every hop the message
 * does. `completeDirectOperationFailure` re-throws the same instance, so a
 * refusal that travels through a receipt keeps its marker.
 */
import { TRPCError } from "@trpc/server";

import { SPOKEN_ERROR_FLAG } from "@shared/spokenError";

/** An error whose message was written for a customer to read. */
export class SpokenError extends TRPCError {}

export function spokenError(input: {
  code: ConstructorParameters<typeof TRPCError>[0]["code"];
  message: string;
  cause?: unknown;
}): SpokenError {
  return new SpokenError({ code: input.code, message: input.message, cause: input.cause });
}

export function isSpokenError(error: unknown): error is SpokenError {
  return error instanceof SpokenError;
}

/**
 * Put the marker on the outgoing shape.
 *
 * Exported and pure so the suite drives the function that is actually wired
 * into `initTRPC`, rather than a re-implementation of it beside the real one.
 */
export function withSpokenFlag<Shape extends { data?: Record<string, unknown> }>(
  shape: Shape,
  error: unknown,
): Shape {
  if (!isSpokenError(error)) return shape;
  return { ...shape, data: { ...(shape.data ?? {}), [SPOKEN_ERROR_FLAG]: true } };
}
