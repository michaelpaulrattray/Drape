import { adminProcedure, router } from "../../_core/trpc";
import { logAuditEvent, AUDIT_ACTIONS } from "../../auditLog";
import { logAdminAction, writeImmutableLog } from "../../security/adminSecurity";
import { getClientIp } from "../../security/rateLimit";
import { z } from "zod";
import { TRPCError } from "@trpc/server";

export const ipBlockingRouter = router({
  // Block an IP address
  blockIP: adminProcedure
    .input(z.object({
      ipAddress: z.string().min(1),
      reason: z.string().min(1).max(500),
      expiresInHours: z.number().min(1).max(8760).optional(), // Max 1 year, null = permanent
    }))
    .mutation(async ({ ctx, input }) => {
      const { blockIp } = await import("../../db");
      
      const expiresAt = input.expiresInHours 
        ? new Date(Date.now() + input.expiresInHours * 60 * 60 * 1000)
        : null;

      const result = await blockIp(
        input.ipAddress,
        input.reason,
        ctx.user.id,
        expiresAt
      );

      if (!result.success) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to block IP address",
        });
      }

      // Log the action
      await logAuditEvent({
        userId: ctx.user.id,
        action: AUDIT_ACTIONS.IP_BLOCKED,
        resourceType: "ip",
        resourceId: input.ipAddress,
        metadata: {
          reason: input.reason,
          expiresAt: expiresAt?.toISOString() || "permanent",
        },
        severity: "warning",
        req: ctx.req,
      });

      // Log admin action with Slack notification
      await logAdminAction({
        adminId: ctx.user.id,
        adminName: ctx.user.name || ctx.user.email || `Admin ${ctx.user.id}`,
        action: "blockIP",
        targetType: "ip",
        targetId: input.ipAddress,
        details: `Blocked IP ${input.ipAddress} - Reason: ${input.reason} - Expires: ${expiresAt?.toISOString() || "permanent"}`,
        ipAddress: getClientIp(ctx.req),
        userAgent: ctx.req.headers["user-agent"] || undefined,
      });

      // Write to immutable log for critical action
      await writeImmutableLog("ip_blocked", {
        adminId: ctx.user.id,
        adminName: ctx.user.name,
        ipAddress: input.ipAddress,
        reason: input.reason,
        expiresAt: expiresAt?.toISOString() || "permanent",
      });

      return { success: true };
    }),

  // Unblock an IP address
  unblockIP: adminProcedure
    .input(z.object({
      ipAddress: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const { unblockIp } = await import("../../db");
      
      const success = await unblockIp(input.ipAddress);

      if (!success) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to unblock IP address",
        });
      }

      // Log the action
      await logAuditEvent({
        userId: ctx.user.id,
        action: AUDIT_ACTIONS.IP_UNBLOCKED,
        resourceType: "ip",
        resourceId: input.ipAddress,
        metadata: {},
        severity: "info",
        req: ctx.req,
      });

      // Log admin action with Slack notification
      await logAdminAction({
        adminId: ctx.user.id,
        adminName: ctx.user.name || ctx.user.email || `Admin ${ctx.user.id}`,
        action: "unblockIP",
        targetType: "ip",
        targetId: input.ipAddress,
        details: `Unblocked IP ${input.ipAddress}`,
        ipAddress: getClientIp(ctx.req),
        userAgent: ctx.req.headers["user-agent"] || undefined,
      });

      // Write to immutable log for critical action
      await writeImmutableLog("ip_unblocked", {
        adminId: ctx.user.id,
        adminName: ctx.user.name,
        ipAddress: input.ipAddress,
      });

      return { success: true };
    }),

  // Get list of blocked IPs
  listBlockedIPs: adminProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).optional().default(50),
      offset: z.number().min(0).optional().default(0),
    }).optional())
    .query(async ({ input }) => {
      const { getBlockedIps } = await import("../../db");
      
      const result = await getBlockedIps(
        input?.limit || 50,
        input?.offset || 0
      );

      return {
        ips: result.ips.map(ip => ({
          id: ip.id,
          ipAddress: ip.ipAddress,
          reason: ip.reason,
          blockedBy: ip.blockedBy,
          expiresAt: ip.expiresAt?.toISOString() || null,
          createdAt: ip.createdAt.toISOString(),
        })),
        total: result.total,
      };
    }),
});
