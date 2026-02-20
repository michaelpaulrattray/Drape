/**
 * Request Context Middleware — binds correlationId and userId to
 * AsyncLocalStorage so all downstream pino logs include them automatically.
 *
 * Must be registered AFTER correlationId middleware and auth middleware.
 * In practice, we register it right after correlationId middleware and
 * update the userId later when auth resolves.
 */
import type { Request, Response, NextFunction } from "express";
import { requestContext } from "./logger";
import { getCorrelationId } from "../security/correlationId";

export function requestContextMiddleware(req: Request, res: Response, next: NextFunction) {
  const correlationId = getCorrelationId(req);
  const store = { correlationId };

  requestContext.run(store, () => {
    next();
  });
}

/**
 * Inject userId into the current request context.
 * Call this after authentication resolves (e.g., in tRPC context creation).
 */
export function setRequestUserId(userId: number | string) {
  const store = requestContext.getStore();
  if (store) {
    store.userId = userId;
  }
}
