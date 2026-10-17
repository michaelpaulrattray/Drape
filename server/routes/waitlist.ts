import { publicProcedure, router } from "../_core/trpc";
import { addToWaitlist, getWaitlistCount } from "../db";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { checkRateLimit, getClientIp, RATE_LIMITS, rateLimitError } from "../security/rateLimit";
import { newsletterSignup } from "../klaviyo";
import { createModuleLogger } from "../logging/logger";

const log = createModuleLogger("waitlist");

/** A count read per address: plenty for any page, useless for hammering the database (#2375). */
export const WAITLIST_STATS_RATE = {
  windowMs: 60 * 1000,
  maxRequests: 30,
  keyPrefix: "waitlist_stats",
} as const;

/**
 * The one answer `waitlist.join` gives, whoever is asking (#2450). It used to
 * carry `alreadyRegistered` — and `position`, the row id, which is an old
 * number for an address already on the list and the newest one for a fresh
 * address — so anyone could test an email against the list one call at a time.
 * The same class is closed on sign-in (#2376), sign-up (#2443),
 * resend-verification and the newsletter (#2446). No client read `position`.
 */
const WAITLIST_JOINED_ANSWER = { success: true } as const;

export const waitlistRouter = router({
  // Join the waitlist
  join: publicProcedure
    // .strict() — invariant 4 on a public surface (ruled fable-1435 §2). Safe at
    // the wire, checked rather than assumed: all four client call sites were
    // read (HeroContent, WaitlistModal x2, Login) and every one sends a subset
    // of the fields below — nothing undeclared.
    .input(z.object({
      email: z.string().email("Please enter a valid email address"),
      name: z.string().trim().min(1).optional(), // `.trim()` before `.min(1)` (#816)
      company: z.string().optional(),
      role: z.string().optional(),
      source: z.string().optional(),
      referralCode: z.string().optional(),
    }).strict())
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
      newsletterSignup(input.email.toLowerCase().trim(), input.source || "landing_page", input.name || undefined).catch((err) => {
        log.warn({ err: err?.message }, "[Waitlist] Klaviyo sync failed (non-blocking)");
      });

      // ONE ANSWER FOR EVERY ADDRESS — a new address and one already on the
      // list get the same body, field for field (#2450). Joining twice is
      // harmless: the second call adds nothing.
      return WAITLIST_JOINED_ANSWER;
    }),

  // The real number of signups, nothing added (#2375, on his word 2026-10-12:
  // a padded `displayCount: count + 847` stood here "for early traction
  // appearance" and is gone). Public, so rate-limited per address like every
  // other public endpoint (invariant 5) — it is a database count on every call.
  getStats: publicProcedure.query(async ({ ctx }) => {
    const rateCheck = checkRateLimit(getClientIp(ctx.req), WAITLIST_STATS_RATE);
    if (!rateCheck.allowed) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: rateLimitError(rateCheck.resetIn),
      });
    }
    const count = await getWaitlistCount();
    return { totalSignups: count };
  }),
});
