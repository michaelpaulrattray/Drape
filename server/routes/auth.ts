import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "../_core/cookies";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { checkRateLimit, getClientIp } from "../security/rateLimit";

export const authRouter = router({
  me: publicProcedure.query(({ ctx }) => {
    if (!ctx.user) return null;
    // Invariant 8: expose only fields the authenticated client actually uses.
    // This must remain a positive projection so future users-table columns stay
    // server-only unless they are deliberately reviewed into this boundary.
    return {
      name: ctx.user.name,
      email: ctx.user.email,
      avatarUrl: ctx.user.avatarUrl,
      authProvider: ctx.user.authProvider,
      role: ctx.user.role,
      approved: ctx.user.approved,
      canvasIntroSeen: ctx.user.canvasIntroSeen,
    };
  }),
  logout: publicProcedure.mutation(({ ctx }) => {
    const cookieOptions = getSessionCookieOptions(ctx.req);
    ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    return { success: true } as const;
  }),
  deleteAccount: protectedProcedure
    .input(z.object({ confirmation: z.literal("DELETE") }))
    .mutation(async ({ ctx, input }) => {
      // Rate limit: 1 attempt per minute
      const ip = getClientIp(ctx.req);
      const rl = checkRateLimit(`deleteAccount:${ctx.user.id}`, { maxRequests: 1, windowMs: 60_000, keyPrefix: 'del_acct' });
      if (!rl.allowed) {
        throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Please wait before trying again." });
      }

      const { deleteUserData } = await import("../security/deleteUserData");
      const result = await deleteUserData(ctx.user.id, ip, ctx.req.headers["user-agent"] as string | undefined);

      if (!result.success) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: result.error || "Account deletion failed" });
      }

      // Clear session cookie
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });

      return { success: true, summary: result.summary } as const;
    }),
});
