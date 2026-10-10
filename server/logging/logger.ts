/**
 * Structured Logger — pino-based logging with request context propagation.
 *
 * Uses AsyncLocalStorage to automatically inject correlationId and userId
 * into every log line within a request lifecycle. No manual threading needed.
 *
 * Usage:
 *   import { createModuleLogger } from "../logging/logger";
 *
 *   // Module-scoped logger (every caller names its module; there is no
 *   // shared "app" logger — the one that existed had no caller, #108)
 *   const log = createModuleLogger("stripe");
 *   log.error({ err }, "Webhook processing failed");
 */
import pino from "pino";
import { AsyncLocalStorage } from "async_hooks";
import { redactQueryValuesInText, withoutQueryValues } from "../monitoring/queryErrorRedaction";

/** Request-scoped context injected by the middleware */
interface RequestContext {
  correlationId: string;
  userId?: number | string;
}

/** AsyncLocalStorage instance for request-scoped context */
export const requestContext = new AsyncLocalStorage<RequestContext>();

/**
 * A FAILED QUERY'S VALUES NEVER REACH A LOG LINE (#2218).
 *
 * drizzle's `DrizzleQueryError` carries every bound value in its message and
 * its `params`, and mysql2's error under it carries the statement with the
 * values formatted in. The server logs errors under three keys — `err` (229
 * call sites), `error` (174) and `cause` — so the reduction sits HERE, on the
 * keys, rather than at four hundred call sites each remembering. An error with
 * no such values is serialized exactly as before.
 *
 * Its limit: a value nested deeper than a top-level key (`{ ctx: { err } }`)
 * is not reached. The message STRING is covered separately by `logMethod`.
 */
function serializeErrorish(value: unknown): unknown {
  if (typeof value === "string") return redactQueryValuesInText(value);
  const safe = withoutQueryValues(value);
  return safe === value ? value : pino.stdSerializers.err(safe as Error);
}

export const loggerSerializers = {
  /* `err` keeps pino's own serializer — the default for that key — on the
     reduced error. */
  err: (value: unknown) => {
    if (typeof value === "string") return redactQueryValuesInText(value);
    return pino.stdSerializers.err(withoutQueryValues(value) as Error);
  },
  error: serializeErrorish,
  cause: serializeErrorish,
};

/**
 * The message string, for the callers who interpolate an error into it
 * (`log.warn(\`… ${err.message}\`)`). A string with no failed-query shape is
 * untouched.
 */
export const loggerHooks: NonNullable<pino.LoggerOptions["hooks"]> = {
  logMethod(args, method) {
    method.apply(
      this,
      args.map((arg) => (typeof arg === "string" ? redactQueryValuesInText(arg) : arg)) as Parameters<pino.LogFn>,
    );
  },
};

/** Root pino instance with mixin that auto-injects request context */
export const rootLogger = pino({
  serializers: loggerSerializers,
  hooks: loggerHooks,
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === "production" ? "info" : "debug"),
  formatters: {
    level(label) {
      return { level: label };
    },
  },
  mixin() {
    const ctx = requestContext.getStore();
    if (ctx) {
      return {
        correlationId: ctx.correlationId,
        ...(ctx.userId ? { userId: ctx.userId } : {}),
      };
    }
    return {};
  },
  // In development, use pino-pretty-compatible output; in production, raw JSON
  ...(process.env.NODE_ENV !== "production"
    ? {
        transport: {
          target: "pino/file",
          options: { destination: 1 }, // stdout
        },
      }
    : {}),
});

/**
 * Create a child logger scoped to a specific module.
 * The module name appears in every log line for filtering.
 */
export function createModuleLogger(module: string) {
  return rootLogger.child({ module });
}
