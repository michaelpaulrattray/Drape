/**
 * Admin Announcements Router — CRUD for platform-wide banners.
 */

import { z } from "zod";
import { router, adminProcedure } from "../../_core/trpc";
import { logAuditEvent } from "../../auditLog";
import { AUDIT_ACTIONS } from "../../../drizzle/schema";
import {
  listAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  toggleAnnouncement,
  deleteAnnouncement,
} from "../../db/announcementQueries";

const announcementTypeEnum = z.enum(["info", "warning", "maintenance", "feature"]);

export const announcementsRouter = router({
  listBanners: adminProcedure
    .input(z.object({ limit: z.number().min(1).max(50).default(20), offset: z.number().min(0).default(0) }))
    .query(async ({ input }) => {
      return listAnnouncements(input.limit, input.offset);
    }),

  createBanner: adminProcedure
    .input(
      z.object({
        title: z.string().min(1).max(200),
        message: z.string().min(1).max(2000),
        type: announcementTypeEnum,
        isActive: z.boolean().default(false),
        startsAt: z.date().nullable().default(null),
        endsAt: z.date().nullable().default(null),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const result = await createAnnouncement({
        ...input,
        createdBy: ctx.user.id,
      });

      await logAuditEvent({
        userId: ctx.user.id,
        action: AUDIT_ACTIONS.BANNER_CREATED,
        resourceType: "announcement",
        resourceId: String(result.id),
        metadata: { title: input.title, type: input.type, isActive: input.isActive },
        severity: "info",
      });

      return result;
    }),

  updateBanner: adminProcedure
    .input(
      z.object({
        id: z.number(),
        title: z.string().min(1).max(200).optional(),
        message: z.string().min(1).max(2000).optional(),
        type: announcementTypeEnum.optional(),
        isActive: z.boolean().optional(),
        startsAt: z.date().nullable().optional(),
        endsAt: z.date().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await updateAnnouncement(input);

      await logAuditEvent({
        userId: ctx.user.id,
        action: AUDIT_ACTIONS.BANNER_UPDATED,
        resourceType: "announcement",
        resourceId: String(input.id),
        metadata: { changes: Object.keys(input).filter(k => k !== "id") },
        severity: "info",
      });
    }),

  toggleBanner: adminProcedure
    .input(z.object({ id: z.number(), isActive: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await toggleAnnouncement(input.id, input.isActive);

      await logAuditEvent({
        userId: ctx.user.id,
        action: input.isActive ? AUDIT_ACTIONS.BANNER_ACTIVATED : AUDIT_ACTIONS.BANNER_DEACTIVATED,
        resourceType: "announcement",
        resourceId: String(input.id),
        severity: "info",
      });
    }),

  deleteBanner: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await deleteAnnouncement(input.id);

      await logAuditEvent({
        userId: ctx.user.id,
        action: AUDIT_ACTIONS.BANNER_DELETED,
        resourceType: "announcement",
        resourceId: String(input.id),
        severity: "warning",
      });
    }),
});
