import { adminProcedure, router } from "../../_core/trpc";
import { logAuditEvent, AUDIT_ACTIONS } from "../../auditLog";
import { logAdminAction, writeImmutableLog } from "../../security/adminSecurity";
import { getClientIp } from "../../security/rateLimit";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { ROLE_CHANGE_REASON_MAX_LENGTH } from "../../../shared/inputLimits";

export const rolesRouter = router({
  // Change a user's role (promote to moderator or demote to user)
  changeUserRole: adminProcedure
    .input(z.object({
      userId: z.number(),
      newRole: z.enum(["user", "moderator"]),
      // `.trim()` before `.min(1)` (#816) — whitespace-only is refused, not recorded blank.
      reason: z.string().trim().min(1).max(ROLE_CHANGE_REASON_MAX_LENGTH),
    }))
    .mutation(async ({ ctx, input }) => {
      const { updateUserRole, getUserById } = await import("../../db");

      // Get target user info
      const targetUser = await getUserById(input.userId);
      if (!targetUser) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      // Prevent self-role-change
      if (input.userId === ctx.user.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot change your own role" });
      }

      // Prevent changing admin roles
      if (targetUser.role === "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Cannot change the role of an admin user" });
      }

      const result = await updateUserRole(input.userId, input.newRole, ctx.user.id);
      if (!result.success) {
        throw new TRPCError({ code: "BAD_REQUEST", message: result.error || "Failed to change role" });
      }

      const actionLabel = input.newRole === "moderator" ? "Promoted to Moderator" : "Demoted to User";

      // Log to audit
      await logAuditEvent({
        userId: ctx.user.id,
        action: AUDIT_ACTIONS.ROLE_CHANGED,
        resourceType: "user",
        resourceId: input.userId.toString(),
        metadata: {
          targetUserId: input.userId,
          targetUserEmail: targetUser.email,
          targetUserName: targetUser.name,
          previousRole: result.previousRole,
          newRole: input.newRole,
          reason: input.reason,
          changedBy: ctx.user.id,
          changedByName: ctx.user.name,
        },
        severity: "warning",
        ipAddress: getClientIp(ctx.req),
        userAgent: ctx.req.headers["user-agent"] || null,
      });

      // Log admin action to the audit system (staff panels read it)
      await logAdminAction({
        adminId: ctx.user.id,
        adminName: ctx.user.name || ctx.user.email || `Admin ${ctx.user.id}`,
        action: "changeUserRole",
        targetType: "user",
        targetId: input.userId.toString(),
        details: `${actionLabel}: ${targetUser.email || targetUser.name} (${result.previousRole} → ${input.newRole}). Reason: ${input.reason}`,
        ipAddress: getClientIp(ctx.req),
        userAgent: ctx.req.headers["user-agent"] || undefined,
      });

      // Write to immutable log
      await writeImmutableLog("role_changed", {
        adminId: ctx.user.id,
        adminName: ctx.user.name,
        targetUserId: input.userId,
        targetUserEmail: targetUser.email,
        previousRole: result.previousRole,
        newRole: input.newRole,
        reason: input.reason,
      });

      return {
        success: true,
        previousRole: result.previousRole,
        newRole: input.newRole,
      };
    }),
});
