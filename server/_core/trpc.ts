import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

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

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
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
