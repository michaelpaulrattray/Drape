import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { checkRateLimit, getClientIp, rateLimitError } from "../security/rateLimit";
import { createBugReport } from "../db";
import { createModuleLogger } from "../logging/logger";
import { captureProductEvent } from "../monitoring/productEvents";

const log = createModuleLogger("routes/bugReports");

const BUG_RATE_LIMIT = { maxRequests: 5, windowMs: 60_000 * 10, prefix: "bug_report" };

export const bugReportsRouter = router({
  submit: protectedProcedure
    .input(z.object({
      // `.trim()` before the floor (#816): ten spaces used to reach the admin inbox as a report.
      description: z.string().trim().min(10, "Please describe the issue in at least 10 characters").max(2000),
      category: z.enum(["casting", "export", "billing", "ui", "other", "feedback"]).default("other"),
      page: z.string().max(256).optional(),
      modelId: z.number().int().positive().optional(),
      viewport: z.string().max(32).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const clientIp = getClientIp(ctx.req);
      const rateCheck = checkRateLimit(clientIp, BUG_RATE_LIMIT);

      if (!rateCheck.allowed) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: rateLimitError(rateCheck.resetIn),
        });
      }

      const userAgent = ctx.req.headers["user-agent"] || undefined;

      const bugReportId = await createBugReport({
        userId: ctx.user.id,
        description: input.description,
        category: input.category,
        page: input.page,
        modelId: input.modelId,
        userAgent,
        viewport: input.viewport,
      });

      // The admin bug-report inbox (#255) is the read path — the row above
      // IS the notification. The Slack dispatch that used to sit here pointed
      // at a webhook production never had (#800).

      log.info({ bugReportId, userId: ctx.user.id, category: input.category }, "Bug report submitted");

      /*
        THE PRODUCT EDGE (#509 part 2) — after the row exists, never before: an
        event for a report that failed to store would be a count of nothing.

        ⚠ `input.description` is NOT here and cannot be put here. It is the whole
        content of the report and it is a customer's own prose, which the
        metadata-only boundary keeps out of a third party exactly as it keeps it
        away from staff. The catalogue declares `category` alone for this event
        and has no property shape that would accept free text, so this is closed
        by construction rather than by remembering (invariant 8).

        The read path for what she actually SAID is unchanged and is the admin
        inbox (#255) — this only says that a report arrived, and which kind.
      */
      captureProductEvent("bug report sent", ctx.user.id, { category: input.category });

      return { success: true, id: bugReportId };
    }),
});
