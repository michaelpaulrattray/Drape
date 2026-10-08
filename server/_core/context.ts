import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { isSessionRejected, sdk } from "./sdk";
import { spokenError } from "./spokenError";
import { createModuleLogger } from "../logging/logger";
import { getCorrelationId } from "../security/correlationId";
import { setRequestUserId } from "../logging/requestContextMiddleware";

const log = createModuleLogger("auth/context");

/**
 * What a customer reads when their session could not be CHECKED (#1990).
 * It is not the sign-in message, so the client's redirect — which keys on
 * `UNAUTHED_ERR_MSG` and nothing else — does not fire, and they stay where
 * they are with their work in front of them.
 */
export const SESSION_CHECK_UNAVAILABLE_MESSAGE =
  "We couldn't confirm your sign-in just now. You're still signed in — please try again in a moment.";

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
    /*
      A REFUSED session is anonymous — authentication is optional for public
      procedures, and `requireUser` turns it into "Please login" for the rest.

      A session that could not be CHECKED is not (#1990). Reading a failed
      database lookup as "no user" sent a customer with a valid cookie to the
      sign-in page mid-session, with nothing in the logs to say the database
      had blinked. It is a server error now, logged as one, and the request
      does not proceed as a stranger.
    */
    if (!isSessionRejected(error)) {
      log.error(
        { err: error, correlationId: getCorrelationId(opts.req) },
        "[Auth] Session lookup failed — answering SERVICE_UNAVAILABLE rather than signing the visitor out",
      );
      throw spokenError({
        code: "SERVICE_UNAVAILABLE",
        message: SESSION_CHECK_UNAVAILABLE_MESSAGE,
        cause: error,
      });
    }
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
