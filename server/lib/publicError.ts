/**
 * publicError — the public/internal error boundary (Batch C final review
 * correction: error sanitization).
 *
 * Raw `Error.message` text from providers, the database, SDKs, or fetch can
 * carry request details, URLs, credentials, or internal state. None of that
 * may reach a client-facing surface: tRPC error messages, failed-slot
 * records, board-node status messages, or toasts.
 *
 * The rule every catch site follows:
 *   - `TRPCError` messages are DELIBERATELY WRITTEN for users — preserved.
 *   - `PublicError` marks a message a lower layer sanitized on purpose
 *     (e.g. `formatGeminiError` results) — preserved; the raw cause was
 *     logged where it was wrapped.
 *   - Anything else is internal: log the complete error server-side and show
 *     the caller-supplied safe fallback instead.
 *
 * Refund truth is appended by the caller AFTER this sanitization — the
 * truthful refund outcome always reaches the user (final correction 1).
 */
import { TRPCError } from "@trpc/server";

/** An error whose message was deliberately authored for end users. Construct
 *  one ONLY with fixed or sanitized wording — never with raw provider text.
 *  Pass the original error as `cause` so server logs keep the full detail. */
export class PublicError extends Error {
  readonly isPublic = true as const;
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "PublicError";
  }
}

export function isPublicError(error: unknown): error is PublicError {
  return error instanceof PublicError || (error instanceof Error && (error as { isPublic?: unknown }).isPublic === true);
}

/** The message a client-facing surface may carry for this error: explicitly
 *  authored messages pass through; unknown internal errors get the safe
 *  fallback. Callers log the complete error server-side themselves. */
export function publicErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof TRPCError) return error.message;
  if (isPublicError(error) && error.message) return error.message;
  return fallback;
}
