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
 * keys, rather than at four hundred call sites each remembering.
 *
 * Every error-like value under the three keys goes through pino's own `err`
 * serializer after the reduction, so its message, stack, causes and
 * `aggregateErrors` survive. Under `err` that is exactly what pino did before;
 * under `error` and `cause` it is a change — pino had no serializer there, and
 * `JSON.stringify` drops an Error's non-enumerable message and stack, so an
 * ordinary `TypeError` under `cause` used to log as `{}`.
 *
 * Its limit: a value nested deeper than a top-level key (`{ ctx: { err } }`)
 * is not reached. The message STRING is covered separately by `logMethod`.
 */
function serializeErrorish(value: unknown): unknown {
  if (typeof value === "string") return redactQueryValuesInText(value);
  const safe = withoutQueryValues(value);
  if (safe instanceof Error) return pino.stdSerializers.err(safe);
  return safe;
}

export const loggerSerializers = {
  err: serializeErrorish,
  error: serializeErrorish,
  cause: serializeErrorish,
};

/** The message pino would take from the error itself when the caller gave none. */
function implicitMessage(args: unknown[]): string | undefined {
  if (args.length !== 1) return undefined;
  const first = args[0];
  if (first instanceof Error) return typeof first.message === "string" ? first.message : undefined;
  if (first === null || typeof first !== "object") return undefined;
  const fields = first as Record<string, unknown>;
  if (fields.msg !== undefined) return undefined;
  const err = fields.err;
  if (err === null || typeof err !== "object") return undefined;
  const message = (err as { message?: unknown }).message;
  return typeof message === "string" ? message : undefined;
}

/**
 * THE MESSAGE STRING — for callers who interpolate an error into it
 * (`log.warn(\`… ${err.message}\`)`), and for the two shapes where the caller
 * gives NO message: `log.error(err)` and `log.error({ err })`. pino fills `msg`
 * from the RAW `err.message` for those (pino `lib/proto.js` `write()`), after
 * this hook and outside every serializer — so the reduced message is passed
 * explicitly instead. Only the `err` key, because that is pino's `errorKey`
 * and the only key it takes a message from. A string with no failed-query
 * shape is untouched, and the hook never throws: a log call that fails is a
 * second failure on top of the one being logged.
 */
export const loggerHooks: NonNullable<pino.LoggerOptions["hooks"]> = {
  logMethod(args, method) {
    let next: unknown[];
    try {
      const implicit = implicitMessage(args);
      next =
        implicit !== undefined
          ? [...args, redactQueryValuesInText(implicit)]
          : args.map((arg) => (typeof arg === "string" ? redactQueryValuesInText(arg) : arg));
    } catch {
      next = args;
    }
    method.apply(this, next as Parameters<pino.LogFn>);
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
