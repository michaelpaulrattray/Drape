import { adminProcedure, router } from "../../_core/trpc";
import { logAuditEvent, AUDIT_ACTIONS } from "../../auditLog";
import { logAdminAction, writeImmutableLog } from "../../security/adminSecurity";
import { getClientIp } from "../../security/rateLimit";
import { z } from "zod";
import { TRPCError } from "@trpc/server";

export const usersRouter = router({
  // Suspend a user account
  suspendUser: adminProcedure
    .input(z.object({
      userId: z.number(),
      reason: z.string().min(1).max(500),
    }))
    .mutation(async ({ ctx, input }) => {
      const { suspendUser, getUserById } = await import("../../db");
      
      // Get target user info for audit log
      const targetUser = await getUserById(input.userId);
      if (!targetUser) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      // Prevent self-suspension
      if (input.userId === ctx.user.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot suspend your own account" });
      }

      // Prevent suspending other admins
      if (targetUser.role === "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Cannot suspend admin accounts" });
      }

      const result = await suspendUser(input.userId, input.reason, ctx.user.id);
      if (!result.success) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: result.error });
      }

      // Log the suspension
      await logAuditEvent({
        userId: ctx.user.id,
        action: AUDIT_ACTIONS.ACCOUNT_SUSPENDED,
        resourceType: "user",
        resourceId: input.userId.toString(),
        metadata: {
          targetUserId: input.userId,
          targetUserEmail: targetUser.email,
          reason: input.reason,
          suspendedBy: ctx.user.id,
          suspendedByName: ctx.user.name,
        },
        severity: "critical",
        ipAddress: getClientIp(ctx.req),
        userAgent: ctx.req.headers["user-agent"] || null,
      });

      // Log admin action with Slack notification
      await logAdminAction({
        adminId: ctx.user.id,
        adminName: ctx.user.name || ctx.user.email || `Admin ${ctx.user.id}`,
        action: "suspendUser",
        targetType: "user",
        targetId: input.userId.toString(),
        details: `Suspended user ${targetUser.email || targetUser.name} - Reason: ${input.reason}`,
        ipAddress: getClientIp(ctx.req),
        userAgent: ctx.req.headers["user-agent"] || undefined,
      });

      // Write to immutable log for critical action
      await writeImmutableLog("user_suspended", {
        adminId: ctx.user.id,
        adminName: ctx.user.name,
        targetUserId: input.userId,
        targetUserEmail: targetUser.email,
        reason: input.reason,
      });

      return { success: true };
    }),

  // Unsuspend a user account
  unsuspendUser: adminProcedure
    .input(z.object({
      userId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { unsuspendUser, getUserById } = await import("../../db");
      
      const targetUser = await getUserById(input.userId);
      if (!targetUser) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      if (!targetUser.suspendedAt) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "User is not suspended" });
      }

      const result = await unsuspendUser(input.userId);
      if (!result.success) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: result.error });
      }

      // Log the unsuspension
      await logAuditEvent({
        userId: ctx.user.id,
        action: AUDIT_ACTIONS.ACCOUNT_UNSUSPENDED,
        resourceType: "user",
        resourceId: input.userId.toString(),
        metadata: {
          targetUserId: input.userId,
          targetUserEmail: targetUser.email,
          previousReason: targetUser.suspendedReason,
          unsuspendedBy: ctx.user.id,
          unsuspendedByName: ctx.user.name,
        },
        severity: "info",
        ipAddress: getClientIp(ctx.req),
        userAgent: ctx.req.headers["user-agent"] || null,
      });

      // Log admin action with Slack notification
      await logAdminAction({
        adminId: ctx.user.id,
        adminName: ctx.user.name || ctx.user.email || `Admin ${ctx.user.id}`,
        action: "unsuspendUser",
        targetType: "user",
        targetId: input.userId.toString(),
        details: `Unsuspended user ${targetUser.email || targetUser.name} - Previous reason: ${targetUser.suspendedReason}`,
        ipAddress: getClientIp(ctx.req),
        userAgent: ctx.req.headers["user-agent"] || undefined,
      });

      // Write to immutable log for critical action
      await writeImmutableLog("user_unsuspended", {
        adminId: ctx.user.id,
        adminName: ctx.user.name,
        targetUserId: input.userId,
        targetUserEmail: targetUser.email,
        previousReason: targetUser.suspendedReason,
      });

      return { success: true };
    }),

  // Get user details for admin view
  getUserDetails: adminProcedure
    .input(z.object({ userId: z.number() }))
    .query(async ({ input }) => {
      const { getUserById } = await import("../../db");
      const user = await getUserById(input.userId);
      if (!user) return null;
      
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        suspendedAt: user.suspendedAt,
        suspendedReason: user.suspendedReason,
        frozenAt: user.frozenAt,
        frozenReason: user.frozenReason,
        frozenBy: user.frozenBy,
        lockedUntil: user.lockedUntil,
        failedLoginAttempts: user.failedLoginAttempts,
        createdAt: user.createdAt,
        lastSignedIn: user.lastSignedIn,
      };
    }),

  // Freeze a user account (lighter than suspension)
  freezeUser: adminProcedure
    .input(z.object({
      userId: z.number(),
      reason: z.string().min(1).max(500),
    }))
    .mutation(async ({ ctx, input }) => {
      const { freezeUser, getUserById } = await import("../../db");

      const targetUser = await getUserById(input.userId);
      if (!targetUser) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      if (targetUser.frozenAt) throw new TRPCError({ code: "BAD_REQUEST", message: "User is already frozen" });
      if (targetUser.role === "admin" && input.userId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Cannot freeze other admin accounts" });
      }

      const reason = `Admin freeze: ${input.reason}`;
      await freezeUser(input.userId, reason, String(ctx.user.id));

      await logAuditEvent({
        userId: ctx.user.id,
        action: AUDIT_ACTIONS.ACCOUNT_AUTO_FROZEN,
        resourceType: "user",
        resourceId: input.userId.toString(),
        metadata: {
          targetUserId: input.userId,
          targetUserEmail: targetUser.email,
          reason: input.reason,
          frozenBy: ctx.user.id,
          frozenByName: ctx.user.name,
          trigger: "admin_manual",
        },
        severity: "warning",
        ipAddress: getClientIp(ctx.req),
        userAgent: ctx.req.headers["user-agent"] || null,
      });

      await logAdminAction({
        adminId: ctx.user.id,
        adminName: ctx.user.name || ctx.user.email || `Admin ${ctx.user.id}`,
        action: "freezeUser",
        targetType: "user",
        targetId: input.userId.toString(),
        details: `Froze user ${targetUser.email || targetUser.name} - Reason: ${input.reason}`,
        ipAddress: getClientIp(ctx.req),
        userAgent: ctx.req.headers["user-agent"] || undefined,
      });

      return { success: true };
    }),

  // Unfreeze a user account
  unfreezeUser: adminProcedure
    .input(z.object({
      userId: z.number(),
      notes: z.string().min(1).max(500),
    }))
    .mutation(async ({ ctx, input }) => {
      const { unfreezeUser, getUserById } = await import("../../db");

      const targetUser = await getUserById(input.userId);
      if (!targetUser) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      if (!targetUser.frozenAt) throw new TRPCError({ code: "BAD_REQUEST", message: "User is not frozen" });

      const result = await unfreezeUser(input.userId);
      if (!result.success) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: result.error || "Failed to unfreeze" });

      await logAuditEvent({
        userId: ctx.user.id,
        action: AUDIT_ACTIONS.ACCOUNT_UNFROZEN,
        resourceType: "user",
        resourceId: input.userId.toString(),
        metadata: {
          targetUserId: input.userId,
          targetUserEmail: targetUser.email,
          reviewNotes: input.notes,
          unfrozenBy: ctx.user.id,
          unfrozenByName: ctx.user.name,
          previousReason: targetUser.frozenReason,
        },
        severity: "info",
        ipAddress: getClientIp(ctx.req),
        userAgent: ctx.req.headers["user-agent"] || null,
      });

      await logAdminAction({
        adminId: ctx.user.id,
        adminName: ctx.user.name || ctx.user.email || `Admin ${ctx.user.id}`,
        action: "unfreezeUser",
        targetType: "user",
        targetId: input.userId.toString(),
        details: `Unfroze user ${targetUser.email || targetUser.name} - Notes: ${input.notes}`,
        ipAddress: getClientIp(ctx.req),
        userAgent: ctx.req.headers["user-agent"] || undefined,
      });

      return { success: true };
    }),

  // Get paginated list of users with search and filters
  listUsers: adminProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).optional().default(20),
      offset: z.number().min(0).optional().default(0),
      search: z.string().optional(),
      status: z.enum(["active", "suspended", "locked", "all"]).optional().default("all"),
      role: z.enum(["user", "admin", "moderator", "all"]).optional().default("all"),
      sortBy: z.enum(["createdAt", "lastSignedIn", "name"]).optional().default("createdAt"),
      sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
    }).optional())
    .query(async ({ input }) => {
      const { listAllUsers } = await import("../../db");
      
      const result = await listAllUsers({
        limit: input?.limit || 20,
        offset: input?.offset || 0,
        search: input?.search,
        status: input?.status || "all",
        role: input?.role || "all",
        sortBy: input?.sortBy || "createdAt",
        sortOrder: input?.sortOrder || "desc",
      });

      return {
        users: result.users.map(user => ({
          ...user,
          suspendedAt: user.suspendedAt?.toISOString() || null,
          lockedUntil: user.lockedUntil?.toISOString() || null,
          createdAt: user.createdAt.toISOString(),
          lastSignedIn: user.lastSignedIn.toISOString(),
        })),
        total: result.total,
      };
    }),

  // Get user statistics for dashboard
  getUserStats: adminProcedure
    .query(async () => {
      const { getUserStatistics } = await import("../../db");
      return await getUserStatistics();
    }),

  // Get full user details including credits and stats
  getUserFullDetails: adminProcedure
    .input(z.object({ userId: z.number() }))
    .query(async ({ input }) => {
      const { getUserFullDetails } = await import("../../db");
      const result = await getUserFullDetails(input.userId);
      
      if (!result) return null;

      return {
        user: {
          ...result.user,
          suspendedAt: result.user.suspendedAt?.toISOString() || null,
          frozenAt: result.user.frozenAt?.toISOString() || null,
          lockedUntil: result.user.lockedUntil?.toISOString() || null,
          createdAt: result.user.createdAt.toISOString(),
          lastSignedIn: result.user.lastSignedIn.toISOString(),
        },
        credits: result.credits,
        stats: result.stats,
      };
    }),

  // Adjust user credits
  adjustCredits: adminProcedure
    .input(z.object({
      userId: z.number(),
      amount: z.number().min(-100000).max(100000),
      reason: z.string().min(1).max(500),
    }))
    .mutation(async ({ ctx, input }) => {
      const { adjustUserCredits, getUserById } = await import("../../db");
      
      // Get target user info
      const targetUser = await getUserById(input.userId);
      if (!targetUser) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      const result = await adjustUserCredits(
        input.userId,
        input.amount,
        input.reason,
        ctx.user.id
      );

      if (!result.success) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: result.error || "Failed to adjust credits",
        });
      }

      // Log the action
      await logAuditEvent({
        userId: ctx.user.id,
        action: input.amount > 0 ? AUDIT_ACTIONS.CREDITS_ADDED : AUDIT_ACTIONS.CREDITS_DEDUCTED,
        resourceType: "credits",
        resourceId: input.userId.toString(),
        metadata: {
          targetUserId: input.userId,
          targetUserEmail: targetUser.email,
          amount: input.amount,
          reason: input.reason,
          newBalance: result.newBalance,
          adjustedBy: ctx.user.id,
          adjustedByName: ctx.user.name,
        },
        severity: "warning",
        req: ctx.req,
      });

      // Log admin action with Slack notification
      await logAdminAction({
        adminId: ctx.user.id,
        adminName: ctx.user.name || ctx.user.email || `Admin ${ctx.user.id}`,
        action: "adjustCredits",
        targetType: "user",
        targetId: input.userId.toString(),
        details: `${input.amount > 0 ? "Added" : "Deducted"} ${Math.abs(input.amount)} credits for ${targetUser.email || targetUser.name} - Reason: ${input.reason} - New balance: ${result.newBalance}`,
        ipAddress: getClientIp(ctx.req),
        userAgent: ctx.req.headers["user-agent"] || undefined,
      });

      // Write to immutable log for credit adjustments
      await writeImmutableLog("credits_adjusted", {
        adminId: ctx.user.id,
        adminName: ctx.user.name,
        targetUserId: input.userId,
        targetUserEmail: targetUser.email,
        amount: input.amount,
        reason: input.reason,
        newBalance: result.newBalance,
      });

      return { success: true, newBalance: result.newBalance };
    }),

  // Get user activity (audit logs for specific user)
  getUserActivity: adminProcedure
    .input(z.object({
      userId: z.number(),
      limit: z.number().min(1).max(100).optional().default(50),
      offset: z.number().min(0).optional().default(0),
    }))
    .query(async ({ input }) => {
      const { getFilteredAuditLogs } = await import("../../auditLog");
      
      return await getFilteredAuditLogs({
        userId: input.userId,
        limit: input.limit,
        offset: input.offset,
      });
    }),
});
