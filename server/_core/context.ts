import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";
import { getCorrelationId } from "../security/correlationId";
import { setRequestUserId } from "../logging/requestContextMiddleware";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  /** Unique request correlation ID for tracing across logs */
  correlationId: string;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  // Inject userId into AsyncLocalStorage so pino logs include it automatically
  if (user?.id) {
    setRequestUserId(user.id);
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
    correlationId: getCorrelationId(opts.req),
  };
}
