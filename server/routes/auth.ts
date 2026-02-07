import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "../_core/cookies";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { checkRateLimit, getClientIp } from "../security/rateLimit";

export const authRouter = router({
  me: publicProcedure.query(opts => opts.ctx.user),
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
