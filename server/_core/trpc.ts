import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";
import type { TrpcContext } from "./context";
import { validateAdminAccess, logUnauthorizedAdminAccess } from "../security/adminSecurity";
import { APP_UPDATE_REQUIRED_MESSAGE } from "@shared/clientRequestId";
import { waitPhrase } from "@shared/waitPhrase";
import { SpokenError, withSpokenFlag } from "./spokenError";
import { redactQueryValuesInText } from "../monitoring/queryErrorRedaction";
import { invalidInputMessage } from "./invalidInputMessage";
import { judgeRequestOrigin } from "../security/crossSiteGuard";

/** The lockout refusal's sentence. It said "minute(s)" until #1993; the wait
 *  clause is `waitPhrase`'s, shared with every other refusal that names one. */
export function accountLockedMessage(remainingMs: number): string {
  return `Your account is temporarily locked. Please try again ${waitPhrase(remainingMs)}.`;
}

export function appUpdateRequiredMessage(cause: unknown): string | null {
  if (!(cause instanceof ZodError)) return null;
  return cause.issues.some((issue) => issue.message === APP_UPDATE_REQUIRED_MESSAGE)
    ? APP_UPDATE_REQUIRED_MESSAGE
    : null;
}

/**
 * WHAT THE BROWSER READS WHEN THE SERVER FAILED IN A WAY NOBODY WROTE A
 * SENTENCE FOR (#2222).
 *
 * An unknown throw reaches tRPC as a plain error and is wrapped as
 * `INTERNAL_SERVER_ERROR` whose message IS the cause's message
 * (`getTRPCErrorFromUnknown` → `new TRPCError({ cause })`). For a failed
 * database write that message is drizzle's `Failed query: <SQL>\nparams: <every
 * value>` — so the response carried table and column names and the customer's
 * own words, and every `toast.error(err.message)` surface would have put it on
 * screen. #2218 kept those values out of the logs and Sentry; this is the
 * response half.
 *
 * Two shapes are machine text, and both become one plain sentence:
 * - an `INTERNAL_SERVER_ERROR` that is tRPC's wrap of an unknown throw — its
 *   message is its cause's, word for word, and its cause is not a `TRPCError`;
 * - ANY message carrying a failed query — the `Failed query:` prefix, or a
 *   MySQL phrasing that quotes a value back (`redactQueryValuesInText` is the
 *   one reader of those, from #2218; never a second copy here). That catches a
 *   route that copied a helper's `result.error` into an authored throw.
 *
 * ⚠ WHAT IS DELIBERATELY KEPT: a `SpokenError` is never touched, and neither is
 * an `INTERNAL_SERVER_ERROR` a route wrote its own sentence for without the
 * marker. There are dozens of those (`"Couldn't start the edit — you weren't
 * charged. Try again."`, the billing sentences that say nothing was charged),
 * and several surfaces show `err.message` directly, so rewriting every unmarked
 * INTERNAL would have replaced money language with a generic line. The broader
 * rule was the simpler one and was declined for that reason.
 *
 * The stack goes with a rewritten message: tRPC adds it to `data` outside
 * production, and its first line repeats the message.
 */
export const INTERNAL_FAILURE_SENTENCE = "Something went wrong on our side. Please try again in a moment.";

function isUnauthoredInternal(error: TRPCError): boolean {
  if (error.code !== "INTERNAL_SERVER_ERROR") return false;
  const cause = error.cause as unknown;
  if (cause === undefined || cause === null || cause instanceof TRPCError) return false;
  const causeMessage = (cause as { message?: unknown }).message;
  return typeof causeMessage === "string" && causeMessage === error.message;
}

function carriesFailedQuery(message: string): boolean {
  return /Failed query:/.test(message) || redactQueryValuesInText(message) !== message;
}

/** Exported and pure so the suite drives the function wired into `initTRPC`. */
export function withoutMachineMessage<Shape extends { message: string; data?: Record<string, unknown> }>(
  shape: Shape,
  error: TRPCError,
): Shape {
  if (error instanceof SpokenError) return shape;
  if (!isUnauthoredInternal(error) && !carriesFailedQuery(shape.message)) return shape;
  const data = { ...(shape.data ?? {}) };
  delete data.stack;
  return { ...shape, message: INTERNAL_FAILURE_SENTENCE, data };
}

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    /*
      MACHINE TEXT NEVER LEAVES THE SERVER (see `./invalidInputMessage`).

      tRPC fills an input-validation error's message with zod's serialized
      issue array, and `BAD_REQUEST` is on every client's "this sentence is
      ours" list — so a 2,001-character brief put a JSON array on the
      customer's screen under the action "Edit the brief". Rewritten here
      rather than at the dozens of `toast.error(err.message)` call sites,
      because this is the one place that covers every procedure and every
      consumer that has not been written yet.

      The update-required sentinel is checked FIRST: it is a specific zod
      issue carrying its own authored sentence, and the general rewrite would
      otherwise speak over it.
    */
    const updateMessage = appUpdateRequiredMessage(error.cause) ?? invalidInputMessage(error.cause);
    /*
      THE MARKER RIDES THE OUTGOING PAYLOAD (see `shared/spokenError`).

      A sentence the server wrote for a person to read is flagged here, once,
      for every procedure — so the client can tell it from a gateway's or a
      parser's sentence without keeping a list of codes that drifts. Applied
      last so it survives the update-required rewrite above.

      A rewritten input message is deliberately NOT marked spoken. The marker
      means a human authored THIS refusal for THIS situation; these sentences
      are a generic safety net, and the client's existing code-list rule
      already shows them. Marking them would spend the marker's meaning on the
      one case it was not built for.
    */
    const spoken = withSpokenFlag(updateMessage ? { ...shape, message: updateMessage } : shape, error);
    return withoutMachineMessage(spoken, error);
  },
});

export const router = t.router;

/**
 * REFUSE A STATE-CHANGING CALL THAT CAME FROM ANOTHER SITE — #1653.
 *
 * `server/security/crossSiteGuard.ts` carries the whole reading: what the attack
 * is, why it exists beside the `SameSite=lax` cookie fix rather than instead of
 * it, why neither signal is configured, and why a query is not judged.
 *
 * ⚠ **IT SITS AHEAD OF `requireUser`, WHICH IS THE ORDER THIS WANTS.** A forged
 * request is refused before the product does any work on its behalf — before a
 * session is trusted, before a row is read, before a Stripe call. A cross-site
 * mutation with no cookie therefore answers `FORBIDDEN` rather than
 * `UNAUTHORIZED`, which is the truer answer: the problem is not who is asking.
 */
const refuseCrossSiteMutation = t.middleware(async opts => {
  if (opts.type !== "mutation") return opts.next();

  /*
    ⚠ A CONTEXT WITH NO `req` IS A CALLER THAT IS NOT AN HTTP REQUEST, AND IT
    IS ALLOWED ON PURPOSE — not by a `?.` somebody added to stop a crash.

    `ctx.req` is non-optional in `TrpcContext`'s type and always present on the
    express adapter's road, so the only way here is `appRouter.createCaller`
    with a hand-built context: a ceremony script
    (`scripts/ceremony-r7-founder-evidence.mts`) or a suite. Neither has a
    browser, so neither has somebody else's cookie to borrow, which is the same
    reason `judgeRequestOrigin` allows a request carrying no headers at all.

    The first draft of this middleware read `opts.ctx.req.headers` outright and
    `pnpm preflight` went red across four directories of mutation suites —
    worth recording, because the tempting read of that red is "the fixtures are
    wrong". They are not: a context without a request is a legitimate shape
    this product ships, and a control that throws a TypeError on it is a
    control that decides nothing.
  */
  const headers = opts.ctx.req?.headers;
  if (headers === undefined) return opts.next();

  const verdict = judgeRequestOrigin(headers);
  if (verdict.allowed) return opts.next();

  throw new TRPCError({
    code: "FORBIDDEN",
    /* A refusal says what was refused and what to do — the DT law's wording
       clause. No engine, no header name, no pipeline term: the customer-facing
       half is one sentence about where the request came from. The REASON goes
       to the log through `onError`, never onto her screen. */
    message: "This request did not come from Klieg, so it was not carried out. Open Klieg in your own tab and try again there.",
    cause: new Error(`cross-site mutation refused: ${verdict.reason}`),
  });
});

/**
 * THE BASE EVERY PROCEDURE IN THE PRODUCT IS BUILT ON.
 *
 * ⚠ **`t.procedure` IS SPELLED EXACTLY ONCE IN THIS FILE, HERE, AND
 * `server/crossSiteMutationGuard.test.ts` HOLDS IT TO ONE.** The five exported
 * bases below are the only roads to a procedure in this tree, so deriving all
 * five from this one is what makes #1653's refusal structural rather than
 * remembered — a sixth base reaching past it for `t.procedure` would be a
 * namespace of unguarded mutations that nothing else could see, which is
 * invariant 7 in the shape this repository keeps paying for.
 */
const baseProcedure = t.procedure.use(refuseCrossSiteMutation);

export const publicProcedure = baseProcedure;

/**
 * Requires an authenticated user and checks suspension/lockout.
 *
 * REAL-TIME enforcement — even if a user is suspended mid-session, their next
 * API call is blocked immediately.
 *
 * This deliberately does NOT check `approved`. It is the gate for the handful
 * of things a signed-in-but-unapproved account is *meant* to do; approval is a
 * second middleware layered on top for everything else. See
 * `onboardingProcedure` below.
 */
const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  // Real-time suspension check - blocks suspended users immediately
  if (ctx.user.suspendedAt) {
    throw new TRPCError({ 
      code: "FORBIDDEN", 
      message: "Your account has been suspended. Please contact support for assistance.",
    });
  }

  // Real-time lockout check - blocks temporarily locked accounts
  if (ctx.user.lockedUntil && new Date(ctx.user.lockedUntil) > new Date()) {
    throw new TRPCError({ 
      code: "FORBIDDEN", 
      message: accountLockedMessage(
        new Date(ctx.user.lockedUntil).getTime() - Date.now(),
      ),
    });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

/**
 * The beta approval gate.
 *
 * CLAUDE.md: "Unapproved accounts are intended to be able to sign in and
 * redeem an access code, and nothing else." Until now that was enforced only
 * on the two login screens and in the UI — the API let any signed-in account
 * call every protected procedure, and `/api/auth/verify-email` issues a session
 * without an approval check. So the beta gate was decoration.
 *
 * It is now enforced where it counts, on the request path (invariant 7: a
 * control that is not invoked does not exist). Real-time, like suspension: an
 * account un-approved mid-session is blocked on its next call.
 */
const requireApproved = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user?.approved) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message:
        "Your account is awaiting approval. You'll get an email as soon as it's ready.",
    });
  }

  return next({ ctx: { ...ctx, user: ctx.user } });
});

export const protectedProcedure = baseProcedure.use(requireUser).use(requireApproved);

/**
 * Signed in, not yet approved.
 *
 * The narrow surface an unapproved account legitimately needs: redeeming an
 * access code, and reading whether that worked. Everything else belongs on
 * `protectedProcedure`. Adding a procedure here is an enumerated decision, in
 * the same spirit as adding a public endpoint — it widens what an unapproved
 * account can reach, and `server/approvalGate.test.ts` pins the list.
 */
export const onboardingProcedure = baseProcedure.use(requireUser);

/**
 * Admin procedure with enhanced security:
 * 1. Checks user has admin role
 * 2. Validates against admin allowlist
 * 3. Logs unauthorized access attempts
 * 4. Checks for suspension
 */
export const adminProcedure = baseProcedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    // Must be authenticated
    if (!ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
    }

    // Validate admin access (checks both role AND allowlist)
    const validation = validateAdminAccess({
      id: ctx.user.id,
      role: ctx.user.role,
      email: ctx.user.email || undefined,
      openId: ctx.user.openId || undefined,
    });

    if (!validation.allowed) {
      // Log unauthorized access attempt
      await logUnauthorizedAdminAccess({
        userId: ctx.user.id,
        userName: ctx.user.name || ctx.user.email || `User ${ctx.user.id}`,
        attemptedAction: "admin_access",
        ipAddress: ctx.req?.ip || ctx.req?.headers?.["x-forwarded-for"] as string,
        userAgent: ctx.req?.headers?.["user-agent"] as string,
      });

      throw new TRPCError({ 
        code: "FORBIDDEN", 
        message: validation.reason || NOT_ADMIN_ERR_MSG 
      });
    }

    // Admins should never be suspended, but check anyway for security
    if (ctx.user.suspendedAt) {
      throw new TRPCError({ 
        code: "FORBIDDEN", 
        message: "Admin account suspended. Contact system administrator.",
      });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);

/**
 * Moderator procedure - allows access for moderator OR admin roles.
 * Moderators have read-only access to audit logs, user activity, and can escalate to admins.
 * Admins automatically pass this check as well.
 */
export const moderatorProcedure = baseProcedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
    }

    // Allow moderators and admins
    if (ctx.user.role !== "moderator" && ctx.user.role !== "admin") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Moderator or admin privileges required.",
      });
    }

    // Check for suspension
    if (ctx.user.suspendedAt) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Your account has been suspended. Contact an administrator.",
      });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);
