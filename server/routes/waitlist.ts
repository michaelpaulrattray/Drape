import { publicProcedure, router } from "../_core/trpc";
import { addToWaitlist, getWaitlistCount } from "../db";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { checkRateLimit, getClientIp, RATE_LIMITS, rateLimitError } from "../security/rateLimit";
import { newsletterSignup } from "../klaviyo";
import { createModuleLogger } from "../logging/logger";

const log = createModuleLogger("waitlist");

export const waitlistRouter = router({
  // Join the waitlist
  join: publicProcedure
    .input(z.object({
      email: z.string().email("Please enter a valid email address"),
      name: z.string().min(1).optional(),
      company: z.string().optional(),
      role: z.string().optional(),
      source: z.string().optional(),
      referralCode: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Rate limit by IP to prevent spam
      const clientIp = getClientIp(ctx.req);
      const rateCheck = checkRateLimit(clientIp, RATE_LIMITS.waitlist);
      
      if (!rateCheck.allowed) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: rateLimitError(rateCheck.resetIn),
        });
      }
      
      const result = await addToWaitlist({
        email: input.email.toLowerCase().trim(),
        name: input.name || null,
        company: input.company || null,
        role: input.role || null,
        source: input.source || "landing_page",
        referralCode: input.referralCode || null,
      });

      if (!result.success && result.error !== "already_registered") {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: result.error || "Failed to join waitlist",
        });
      }

      // Sync to Klaviyo (fire-and-forget — don't block the response)
      newsletterSignup(input.email.toLowerCase().trim(), "waitlist_hero").catch((err) => {
        log.warn({ err: err?.message }, "[Waitlist] Klaviyo sync failed (non-blocking)");
      });

      return {
        success: true,
        position: result.position,
        alreadyRegistered: result.error === "already_registered",
      };
    }),

  // Get waitlist stats (public for social proof)
  getStats: publicProcedure.query(async () => {
    const count = await getWaitlistCount();
    return {
      totalSignups: count,
      // Add some base numbers for social proof
      displayCount: count + 847, // Base number for early traction appearance
    };
  }),
});
