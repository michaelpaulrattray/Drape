import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { checkRateLimit, getClientIp, RATE_LIMITS, rateLimitError } from "../rateLimit";
import { newsletterSignup, testConnection as testKlaviyoConnection } from "../klaviyo";

export const newsletterRouter = router({
  // Subscribe to newsletter (public - no auth required)
  subscribe: publicProcedure
    .input(z.object({
      email: z.string().email("Please enter a valid email address"),
      source: z.string().optional().default("website_footer"),
    }))
    .mutation(async ({ input, ctx }) => {
      // Rate limit by IP to prevent spam
      const clientIp = getClientIp(ctx.req);
      const rateCheck = checkRateLimit(clientIp, RATE_LIMITS.newsletter);
      
      if (!rateCheck.allowed) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: rateLimitError(rateCheck.resetIn),
        });
      }
      
      const result = await newsletterSignup(input.email, input.source);
      
      if (!result.success) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to subscribe. Please try again later.",
        });
      }
      
      return {
        success: true,
        message: result.isNew 
          ? "Welcome! You've been subscribed to our newsletter."
          : "This email is already on the list.",
        isNew: result.isNew,
      };
    }),

  // Test Klaviyo connection (admin/debug only)
  testConnection: protectedProcedure
    .query(async () => {
      const result = await testKlaviyoConnection();
      return result;
    }),
});
