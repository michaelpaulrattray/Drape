/**
 * Public Announcements Router — serves active banners to all users.
 */

import { router, publicProcedure } from "../_core/trpc";
import { getActiveBanners } from "../db/announcementQueries";

export const publicAnnouncementsRouter = router({
  getActive: publicProcedure.query(async () => {
    return getActiveBanners();
  }),
});
