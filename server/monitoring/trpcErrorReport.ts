/**
 * THE tRPC ERROR REPORT — the `onError` the API mounts, lifted out of
 * `_core/index.ts` byte-for-byte in behaviour so it can be driven without
 * booting the server (#2218).
 *
 * What changed in the lift is one thing: the cause, and the message tRPC copies
 * from it, pass through `withoutQueryValues` before they reach the log line or
 * the tracker. A failed write's bound values — a persona line, a brief, the
 * customer's own words — used to travel in `DrizzleQueryError`'s message and
 * `params`, and in mysql2's formatted `sql`, into Railway's logs and Sentry.
 *
 * The sinks are arguments because the log line belongs to the `server` module
 * (its module name is what the logs are filtered on) and the capture is the
 * tracker's; neither is this file's to own.
 */
import type { TRPCError } from "@trpc/server";

import type { ErrorContext } from "./errorTracker";
import { redactQueryValuesInText, withoutQueryValues } from "./queryErrorRedaction";

export interface TrpcErrorSinks {
  log: { error: (fields: Record<string, unknown>, message: string) => void };
  capture: (error: unknown, context: ErrorContext) => unknown;
}

export interface TrpcErrorReportInput {
  error: TRPCError;
  path: string | undefined;
  type: string;
  ctx: unknown;
}

export function createTrpcErrorReporter(sinks: TrpcErrorSinks) {
  return function onError({ error, path, type, ctx }: TrpcErrorReportInput): void {
    // Log all server-side tRPC errors with correlation ID for traceability
    const severity = error.code === "INTERNAL_SERVER_ERROR" ? "ERROR" : "WARN";
    const cid = (ctx as { correlationId?: string } | undefined)?.correlationId ?? "unknown";
    /* tRPC gives an unknown throw the CAUSE's message, so the message is
       reduced as well as the cause — reducing one alone leaves the other. */
    const cause = withoutQueryValues(error.cause);
    sinks.log.error(
      {
        correlationId: cid,
        trpcType: type,
        path: path ?? "unknown",
        code: error.code,
        ...(error.code === "INTERNAL_SERVER_ERROR" ? { cause } : {}),
      },
      `tRPC ${severity}: ${redactQueryValuesInText(error.message)}`,
    );
    /*
      ONLY `INTERNAL_SERVER_ERROR` IS REPORTED, AND THAT IS THE WHOLE RULE
      (#509). Every other code is the API working: a `FORBIDDEN` is the
      approval gate, a `TOO_MANY_REQUESTS` is a rate limit doing its job, a
      `BAD_REQUEST` is `.strict()` refusing an unknown field. Sending those
      would fill the tracker with correct behaviour and make the one row that
      matters unfindable — the same reason this log line has always split
      ERROR from WARN on exactly this code.
    */
    if (error.code === "INTERNAL_SERVER_ERROR") {
      void sinks.capture(cause ?? withoutQueryValues(error), {
        kind: "trpc",
        route: path ?? "unknown",
        trpcType: type,
        trpcCode: error.code,
      });
    }
  };
}
