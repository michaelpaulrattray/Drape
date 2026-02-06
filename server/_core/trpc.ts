import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import { validateAdminAccess, logUnauthorizedAdminAccess } from "../adminSecurity";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

/**
 * Middleware that requires authenticated user and checks for suspension/lockout.
 * This provides REAL-TIME enforcement - even if a user is suspended mid-session,
 * their next API call will be blocked immediately.
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

export const protectedProcedure = t.procedure.use(requireUser);

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
