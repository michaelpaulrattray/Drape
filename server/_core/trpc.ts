import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";
import type { TrpcContext } from "./context";
import { validateAdminAccess, logUnauthorizedAdminAccess } from "../security/adminSecurity";
import { APP_UPDATE_REQUIRED_MESSAGE } from "@shared/clientRequestId";
import { withSpokenFlag } from "./spokenError";

export function appUpdateRequiredMessage(cause: unknown): string | null {
  if (!(cause instanceof ZodError)) return null;
  return cause.issues.some((issue) => issue.message === APP_UPDATE_REQUIRED_MESSAGE)
    ? APP_UPDATE_REQUIRED_MESSAGE
    : null;
}

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    const updateMessage = appUpdateRequiredMessage(error.cause);
    /*
      THE MARKER RIDES THE OUTGOING PAYLOAD (see `shared/spokenError`).

      A sentence the server wrote for a person to read is flagged here, once,
      for every procedure — so the client can tell it from a gateway's or a
      parser's sentence without keeping a list of codes that drifts. Applied
      last so it survives the update-required rewrite above.
    */
    return withSpokenFlag(updateMessage ? { ...shape, message: updateMessage } : shape, error);
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

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
    const remainingMinutes = Math.ceil(
      (new Date(ctx.user.lockedUntil).getTime() - Date.now()) / 60000
    );
    throw new TRPCError({ 
      code: "FORBIDDEN", 
      message: `Your account is temporarily locked. Please try again in ${remainingMinutes} minute(s).`,
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

export const protectedProcedure = t.procedure.use(requireUser).use(requireApproved);

/**
 * Signed in, not yet approved.
 *
 * The narrow surface an unapproved account legitimately needs: redeeming an
 * access code, and reading whether that worked. Everything else belongs on
 * `protectedProcedure`. Adding a procedure here is an enumerated decision, in
 * the same spirit as adding a public endpoint — it widens what an unapproved
 * account can reach, and `server/approvalGate.test.ts` pins the list.
 */
export const onboardingProcedure = t.procedure.use(requireUser);

/**
 * Admin procedure with enhanced security:
 * 1. Checks user has admin role
 * 2. Validates against admin allowlist
 * 3. Logs unauthorized access attempts
 * 4. Checks for suspension
 */
export const adminProcedure = t.procedure.use(
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
      name: ctx.user.name || undefined,
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
export const moderatorProcedure = t.procedure.use(
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
