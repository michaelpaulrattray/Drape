import { publicProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { checkRateLimit, getClientIp, RATE_LIMITS, rateLimitError } from "../security/rateLimit";
import { newsletterSignup } from "../klaviyo";

export const newsletterRouter = router({
  // Subscribe to newsletter (public - no auth required)
  subscribe: publicProcedure
    // .strict() — invariant 4 on a public surface (ruled fable-1435 §2). Safe at
    // the wire, checked rather than assumed: this endpoint has no client caller
    // at all, so no shipped bundle can be sending a field it does not declare.
    .input(z.object({
      email: z.string().email("Please enter a valid email address"),
      source: z.string().optional().default("website_footer"),
    }).strict())
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

  /* `testConnection` lived here until #2372, commented "admin/debug only" and
     declared `protectedProcedure` — so any approved customer could make the
     server call the email provider with the company's private key, as often as
     they liked. It had no caller anywhere in the product, the admin panel
     included, so it is DELETED rather than moved behind `adminProcedure`: a
     staff control nobody uses is surface with no purpose. If a staff health
     check for the email provider is ever wanted, it is a new admin procedure,
     rate-limited, answering only "working / not working".
     `server/routes/newsletter.test.ts` drives the refusal. */
});
