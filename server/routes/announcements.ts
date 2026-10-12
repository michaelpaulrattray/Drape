/**
 * Public Announcements Router — serves active banners to all users.
 */

import { TRPCError } from "@trpc/server";
import { router, publicProcedure } from "../_core/trpc";
import { getActiveBanners } from "../db/announcementQueries";
import { checkRateLimit, getClientIp, rateLimitError } from "../security/rateLimit";

/**
 * Per address, and generous on purpose (#2375): the banner polls once a minute
 * per open tab (`AnnouncementBanner.tsx`, `refetchInterval: 60_000`), and an
 * office or a household shares one address. 120 a minute is a hundred-odd
 * tabs behind one router; it exists so a loop cannot hammer the database.
 */
export const ANNOUNCEMENTS_READ_RATE = {
  windowMs: 60 * 1000,
  maxRequests: 120,
  keyPrefix: "announcements_read",
} as const;

export const publicAnnouncementsRouter = router({
  getActive: publicProcedure.query(async ({ ctx }) => {
    const rateCheck = checkRateLimit(getClientIp(ctx.req), ANNOUNCEMENTS_READ_RATE);
    if (!rateCheck.allowed) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: rateLimitError(rateCheck.resetIn),
      });
    }
    return getActiveBanners();
  }),
});
