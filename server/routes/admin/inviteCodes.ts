import { adminProcedure, router } from "../../_core/trpc";
import { logAdminAction, writeImmutableLog } from "../../security/adminSecurity";
import { z } from "zod";
import { TRPCError } from "@trpc/server";

export const inviteCodesRouter = router({
  /** List all invite codes with status info */
  listInviteCodes: adminProcedure.query(async () => {
    const { listInviteCodes } = await import("../../db");
    const codes = await listInviteCodes();
    return codes.map((c) => ({
      ...c,
      status: getCodeStatus(c),
    }));
  }),

  /** Generate a new invite code */
  createInviteCode: adminProcedure
    .input(
      z.object({
        code: z
          .string()
          .min(3, "Code must be at least 3 characters")
          .max(32, "Code must be at most 32 characters")
          .regex(/^[A-Za-z0-9_-]+$/, "Code can only contain letters, numbers, hyphens, and underscores"),
        maxUses: z.number().int().min(1).max(10000).default(1),
        expiresInDays: z.number().int().min(1).max(365).nullable().optional(),
        note: z.string().max(256).nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { createInviteCode } = await import("../../db");

      const expiresAt = input.expiresInDays
        ? new Date(Date.now() + input.expiresInDays * 86400000)
        : null;

      const result = await createInviteCode({
        code: input.code,
        createdBy: ctx.user.id,
        maxUses: input.maxUses,
        expiresAt,
        note: input.note ?? null,
      });

      if (!result.success) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: result.error || "Failed to create invite code",
        });
      }

      // Audit logging
      await logAdminAction({
        adminId: ctx.user.id,
        adminName: ctx.user.name || "Admin",
        action: "CREATE_INVITE_CODE",
        targetType: "invite_code",
        targetId: input.code.toUpperCase(),
        details: `Created invite code: ${input.code.toUpperCase()} (max uses: ${input.maxUses})`,
      });
      await writeImmutableLog("CREATE_INVITE_CODE", {
        adminId: ctx.user.id,
        code: input.code.toUpperCase(),
      });

      return { success: true };
    }),

  /** Deactivate an invite code */
  deactivateInviteCode: adminProcedure
    .input(z.object({ codeId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const { deactivateInviteCode } = await import("../../db");

      await deactivateInviteCode(input.codeId);

      await logAdminAction({
        adminId: ctx.user.id,
        adminName: ctx.user.name || "Admin",
        action: "DEACTIVATE_INVITE_CODE",
        targetType: "invite_code",
        targetId: String(input.codeId),
        details: `Deactivated invite code ID: ${input.codeId}`,
      });
      await writeImmutableLog("DEACTIVATE_INVITE_CODE", {
        adminId: ctx.user.id,
        codeId: input.codeId,
      });

      return { success: true };
    }),
});

/** Derive display status from invite code fields */
function getCodeStatus(code: {
  isActive: boolean;
  currentUses: number;
  maxUses: number;
  expiresAt: Date | null;
}): "active" | "used_up" | "expired" | "deactivated" {
  if (!code.isActive) return "deactivated";
  if (code.expiresAt && code.expiresAt < new Date()) return "expired";
  if (code.currentUses >= code.maxUses) return "used_up";
  return "active";
}
