/**
 * Structured Logger — pino-based logging with request context propagation.
 *
 * Uses AsyncLocalStorage to automatically inject correlationId and userId
 * into every log line within a request lifecycle. No manual threading needed.
 *
 * Usage:
 *   import { logger, createModuleLogger } from "../logging/logger";
 *
 *   // Root logger (module = "app")
 *   logger.info("Server started");
 *
 *   // Module-scoped logger
 *   const log = createModuleLogger("stripe");
 *   log.error({ err }, "Webhook processing failed");
 */
import pino from "pino";
import { AsyncLocalStorage } from "async_hooks";

/** Request-scoped context injected by the middleware */
export interface RequestContext {
  correlationId: string;
  userId?: number | string;
}

/** AsyncLocalStorage instance for request-scoped context */
export const requestContext = new AsyncLocalStorage<RequestContext>();

/** Root pino instance with mixin that auto-injects request context */
export const rootLogger = pino({
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

/** Default logger with module="app" */
export const logger = rootLogger.child({ module: "app" });

/**
 * Create a child logger scoped to a specific module.
 * The module name appears in every log line for filtering.
 */
export function createModuleLogger(module: string) {
  return rootLogger.child({ module });
}
