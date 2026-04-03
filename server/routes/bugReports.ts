import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { checkRateLimit, getClientIp, rateLimitError } from "../security/rateLimit";
import { createBugReport } from "../db";
import { dispatch } from "../slack/slackCore";
import { createModuleLogger } from "../logging/logger";

const log = createModuleLogger("routes/bugReports");

const BUG_RATE_LIMIT = { maxRequests: 5, windowMs: 60_000 * 10, prefix: "bug_report" };

export const bugReportsRouter = router({
  submit: protectedProcedure
    .input(z.object({
      description: z.string().min(10, "Please describe the issue in at least 10 characters").max(2000),
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

      // Send Slack notification (non-blocking)
      const isFeedback = input.category === "feedback";

      dispatch({
        type: "bug_report",
        title: isFeedback ? "User Feedback Received" : "Bug Report Submitted",
        description: input.description,
        severity: "info",
        channels: ["system-alerts"],
        fields: [
          { title: "Report ID", value: `#${bugReportId}`, short: true },
          { title: "User", value: `${ctx.user.name || "Unknown"} (ID: ${ctx.user.id})`, short: true },
          { title: "Category", value: input.category, short: true },
          { title: "Page", value: input.page || "N/A", short: true },
          ...(input.modelId ? [{ title: "Model ID", value: String(input.modelId), short: true }] : []),
        ],
        skipDedup: true,
      }).catch((err) => {
        log.error({ err }, "Failed to send bug report Slack notification");
      });

      log.info({ bugReportId, userId: ctx.user.id, category: input.category }, "Bug report submitted");

      return { success: true, id: bugReportId };
    }),
});
