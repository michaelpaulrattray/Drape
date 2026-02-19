/**
 * Queue Status Router — Exposes queue position and daily quota info
 * for the frontend to display during generation.
 */
import { protectedProcedure, router } from "../../_core/trpc";
import { getQueueStats } from "../../casting/geminiQueue";
import { checkDailyQuota } from "../../db/dailyQuota";

export const queueStatusRouter = router({
  /** Get current queue stats + user's daily quota */
  getStatus: protectedProcedure.query(async ({ ctx }) => {
    const [queueStats, dailyQuota] = await Promise.all([
      Promise.resolve(getQueueStats()),
      checkDailyQuota(ctx.user.id),
    ]);

    return {
      queue: {
        imageActive: queueStats.image.active,
        imagePending: queueStats.image.pending,
        imageCapacity: queueStats.image.concurrency,
        textActive: queueStats.text.active,
        textPending: queueStats.text.pending,
        textCapacity: queueStats.text.concurrency,
      },
      dailyQuota: {
        used: dailyQuota.used,
        limit: dailyQuota.limit,
        remaining: dailyQuota.remaining,
      },
    };
  }),
});
