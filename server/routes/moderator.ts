import { moderatorProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";

export const moderatorRouter = router({
  // View audit logs (read-only, same data as admin)
  getAuditLogs: moderatorProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).optional().default(20),
      offset: z.number().min(0).optional().default(0),
      severity: z.enum(["info", "warning", "critical", "all"]).optional().default("all"),
      actionCategory: z.enum(["billing", "model", "security", "abuse", "all"]).optional().default("all"),
      userId: z.number().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const { getFilteredAuditLogs } = await import("../auditLog");
      return await getFilteredAuditLogs({
        limit: input?.limit || 20,
        offset: input?.offset || 0,
        severity: input?.severity === "all" ? undefined : input?.severity,
        actionCategory: input?.actionCategory === "all" ? undefined : input?.actionCategory,
        userId: input?.userId,
        startDate: input?.startDate ? new Date(input.startDate) : undefined,
        endDate: input?.endDate ? new Date(input.endDate) : undefined,
      });
    }),

  // View abuse alerts (read-only)
  getAbuseAlerts: moderatorProcedure
    .input(z.object({
      limit: z.number().min(1).max(50).optional().default(10),
    }).optional())
    .query(async ({ input }) => {
      const { getAbuseAlertsSummary } = await import("../auditLog");
      return await getAbuseAlertsSummary(input?.limit || 10);
    }),

  // View audit statistics (read-only)
  getAuditStats: moderatorProcedure
    .query(async () => {
      const { getAuditStatistics } = await import("../auditLog");
      return await getAuditStatistics();
    }),

  // View single audit log entry (read-only)
  getAuditLogById: moderatorProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const { getAuditLogById } = await import("../auditLog");
      return await getAuditLogById(input.id);
    }),

  // View user details (read-only, no mutations)
  getUserDetails: moderatorProcedure
    .input(z.object({ userId: z.number() }))
    .query(async ({ input }) => {
      const { getUserById, getUserCredits } = await import("../db");
      const user = await getUserById(input.userId);
      if (!user) return null;
      
      const userCredits = await getUserCredits(input.userId);
      return {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          suspendedAt: user.suspendedAt,
          suspendedReason: user.suspendedReason,
          lockedUntil: user.lockedUntil,
          failedLoginAttempts: user.failedLoginAttempts,
          frozenAt: user.frozenAt,
          frozenReason: user.frozenReason,
          frozenBy: user.frozenBy,
          createdAt: user.createdAt,
          lastSignedIn: user.lastSignedIn,
        },
        credits: userCredits ? { balance: userCredits.balance } : null,
      };
    }),

  // View user activity (read-only)
  getUserActivity: moderatorProcedure
    .input(z.object({
      userId: z.number(),
      limit: z.number().min(1).max(100).optional().default(50),
      offset: z.number().min(0).optional().default(0),
    }))
    .query(async ({ input }) => {
      const { getFilteredAuditLogs } = await import("../auditLog");
      return await getFilteredAuditLogs({
        userId: input.userId,
        limit: input.limit,
        offset: input.offset,
      });
    }),

  // View blocked IPs (read-only)
  listBlockedIPs: moderatorProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).optional().default(50),
      offset: z.number().min(0).optional().default(0),
    }).optional())
    .query(async ({ input }) => {
      const { getBlockedIps } = await import("../db");
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

  // View user list (read-only, for investigation)
  listUsers: moderatorProcedure
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
      const { listAllUsers } = await import("../db");
      const result = await listAllUsers({
        limit: input?.limit || 20,
        offset: input?.offset || 0,
        search: input?.search,
        status: input?.status || "all",
        role: input?.role || "all",
        sortBy: input?.sortBy || "createdAt",
        sortOrder: input?.sortOrder || "desc",
      });
      /*
       * #700 — an EXPLICIT projection, not a spread of the db row. The
       * safety used to live entirely in `listAllUsers`' own select: widen
       * that select for some other staff feature and the new column arrived
       * on a moderator's wire with nothing here saying no. Invariant 8 wants
       * this by construction rather than by the helper remembering.
       * Driven by `server/moderator.test.ts`, whose fixture seeds the
       * forbidden six so a spread regression reddens.
       */
      return {
        users: result.users.map(user => ({
          id: user.id,
          openId: user.openId,
          name: user.name,
          email: user.email,
          avatarUrl: user.avatarUrl,
          role: user.role,
          suspendedReason: user.suspendedReason,
          suspendedAt: user.suspendedAt?.toISOString() || null,
          /* #703 — ISO, like every other date on this projection. It crossed
             as a raw `Date` while its four neighbours crossed as strings; the
             admin twin has always sent a string. superjson kept both alive, so
             nothing broke — it was one column stated two ways (working law 4). */
          frozenAt: user.frozenAt?.toISOString() || null,
          lockedUntil: user.lockedUntil?.toISOString() || null,
          createdAt: user.createdAt.toISOString(),
          lastSignedIn: user.lastSignedIn.toISOString(),
        })),
        total: result.total,
      };
    }),

  // View user full details (read-only, for investigation)
  getUserFullDetails: moderatorProcedure
    .input(z.object({ userId: z.number() }))
    .query(async ({ input }) => {
      const { getUserFullDetails } = await import("../db");
      const result = await getUserFullDetails(input.userId);
      if (!result) return null;
      /* #700 — explicit projection, same reasoning as `listUsers` above. */
      return {
        user: {
          id: result.user.id,
          openId: result.user.openId,
          name: result.user.name,
          displayName: result.user.displayName,
          email: result.user.email,
          avatarUrl: result.user.avatarUrl,
          bannerUrl: result.user.bannerUrl,
          bio: result.user.bio,
          role: result.user.role,
          storageUsed: result.user.storageUsed,
          storageLimit: result.user.storageLimit,
          suspendedReason: result.user.suspendedReason,
          suspendedBy: result.user.suspendedBy,
          /* #703 — ISO, matching `listUsers` above and the admin twin. */
          frozenAt: result.user.frozenAt?.toISOString() || null,
          frozenReason: result.user.frozenReason,
          frozenBy: result.user.frozenBy,
          failedLoginAttempts: result.user.failedLoginAttempts,
          suspendedAt: result.user.suspendedAt?.toISOString() || null,
          lockedUntil: result.user.lockedUntil?.toISOString() || null,
          createdAt: result.user.createdAt.toISOString(),
          lastSignedIn: result.user.lastSignedIn.toISOString(),
        },
        credits: result.credits,
        stats: result.stats,
      };
    }),

  // View user statistics (read-only)
  getUserStats: moderatorProcedure
    .query(async () => {
      const { getUserStatistics } = await import("../db");
      return await getUserStatistics();
    }),

  // View user credit transaction history (read-only, for complaint investigation)
  getUserCreditHistory: moderatorProcedure
    .input(z.object({
      userId: z.number(),
      limit: z.number().min(1).max(100).optional().default(50),
      offset: z.number().min(0).optional().default(0),
      type: z.enum(["generation", "purchase", "bonus", "refund", "signup", "topup", "subscription", "admin_add", "admin_deduct", "all"]).optional().default("all"),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const { getDetailedCreditHistory } = await import("../db");
      return await getDetailedCreditHistory(input.userId, {
        limit: input.limit,
        offset: input.offset,
        type: input.type === "all" ? undefined : input.type,
        startDate: input.startDate ? new Date(input.startDate) : undefined,
        endDate: input.endDate ? new Date(input.endDate) : undefined,
      });
    }),

  // View user generation history (read-only, for complaint investigation)
  getUserGenerationHistory: moderatorProcedure
    .input(z.object({
      userId: z.number(),
      limit: z.number().min(1).max(100).optional().default(50),
      offset: z.number().min(0).optional().default(0),
      status: z.enum(["pending", "processing", "completed", "failed", "all"]).optional().default("all"),
      type: z.enum(["masterPrompt", "castingImage", "fullBody", "multiView", "iteration", "upscale", "all"]).optional().default("all"),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const { getDetailedGenerationHistory } = await import("../db");
      return await getDetailedGenerationHistory(input.userId, {
        limit: input.limit,
        offset: input.offset,
        status: input.status === "all" ? undefined : input.status,
        type: input.type === "all" ? undefined : input.type,
        startDate: input.startDate ? new Date(input.startDate) : undefined,
        endDate: input.endDate ? new Date(input.endDate) : undefined,
      });
    }),

  // ============ Change Requests (structured write operations for moderators) ============

  // Submit a structured change request for admin review
  createChangeRequest: moderatorProcedure
    .input(z.object({
      type: z.enum(["refund_credits", "add_credits", "flag_account", "note_incident", "suspend_user", "unsuspend_user", "block_ip", "stripe_refund", "other"]),
      priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
      targetUserId: z.number(),
      targetUserName: z.string().optional(),
      title: z.string().min(5).max(512),
      description: z.string().min(10).max(5000),
      evidenceSummary: z.string().max(5000).optional(),
      relatedAuditLogId: z.number().optional(),
      creditAmount: z.number().min(1).optional(),
      creditReason: z.string().max(512).optional(),
      ipAddress: z.string().max(45).optional(),
      stripeSessionId: z.string().max(128).optional(),
      refundType: z.enum(["full", "proportional"]).optional(),
      // `originalAmountCents` / `originalCredits` are NOT inputs any more
      // (#418): the amount comes from the Stripe charge and the credits from
      // this user's own ledger row, below.
      //
      // ⚠ `.strict()` is the SECOND HALF of that removal and is deliberately
      // one deploy behind it (#705). While the schema was non-strict an older
      // staff bundle still sending the two keys had them stripped harmlessly,
      // which is what made #418 deploy-safe in one commit. PR #704 shipped and
      // deployed the client that stopped sending them, so the tolerance has
      // done its job and access-control invariant 4 applies: an undeclared
      // field on a credit-adjustment surface is refused, not dropped.
      //
      // `server/publicInputStrictness.test.ts` proves both halves by parsing
      // through the real router — the rejection AND the positive control that
      // `ModeratorDashboard.tsx`'s own payload still parses.
    }).strict())
    .mutation(async ({ ctx, input }) => {
      const { createChangeRequest } = await import("../db");
      const { logAuditEvent } = await import("../auditLog");
      const { AUDIT_ACTIONS } = await import("../../drizzle/schema");

      const moderatorName = ctx.user.name || ctx.user.email || `Moderator ${ctx.user.id}`;

      // Validate credit-related fields
      if ((input.type === "refund_credits" || input.type === "add_credits") && !input.creditAmount) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Credit amount is required for credit-related requests" });
      }
      if (input.type === "block_ip" && !input.ipAddress) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "IP address is required for block IP requests" });
      }
      // For a Stripe refund the purchase facts are DERIVED, never typed (#418):
      // the credits from this user's own ledger row for that session (which
      // also proves the session belongs to the target user — the lookup is
      // keyed on BOTH), and the amount from the charge Stripe actually made.
      // A session that matches neither refuses HERE, at submit, with a plain
      // message — not at execution weeks later.
      let derivedOriginalCredits: number | null = null;
      let derivedAmountCents: number | null = null;
      if (input.type === "stripe_refund") {
        if (!input.stripeSessionId) throw new TRPCError({ code: "BAD_REQUEST", message: "Stripe session ID is required for refund requests" });
        if (!input.refundType) throw new TRPCError({ code: "BAD_REQUEST", message: "Refund type (full/proportional) is required" });

        const { getCreditTransactionByRef } = await import("../db");
        const ledgerRow = await getCreditTransactionByRef(input.targetUserId, input.stripeSessionId);
        // `type === "topup"` is the server-side twin of the client button's own
        // gate: this door refunds top-up purchases, and a positive row of any
        // other kind that happens to carry a session id must not walk through
        // it (PR #704 review, finding 2).
        if (!ledgerRow || ledgerRow.type !== "topup" || ledgerRow.amount <= 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "No credit purchase matches that Stripe session for this user — check the session ID against the customer's credit history" });
        }
        derivedOriginalCredits = ledgerRow.amount;

        const { getSessionChargedAmountCents } = await import("../stripe/stripeService");
        derivedAmountCents = await getSessionChargedAmountCents(input.stripeSessionId);
        if (!derivedAmountCents) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Could not read the original charge from Stripe for that session — the refund request was not filed" });
        }
      }

      // Create the change request in the database
      const result = await createChangeRequest({
        type: input.type,
        priority: input.priority,
        submittedById: ctx.user.id,
        submittedByName: moderatorName,
        targetUserId: input.targetUserId,
        targetUserName: input.targetUserName || null,
        title: input.title,
        description: input.description,
        evidenceSummary: input.evidenceSummary || null,
        relatedAuditLogId: input.relatedAuditLogId || null,
        creditAmount: input.creditAmount || null,
        creditReason: input.creditReason || null,
        ipAddress: input.ipAddress || null,
        stripeSessionId: input.stripeSessionId || null,
        refundType: input.refundType || null,
        originalCredits: derivedOriginalCredits,
        // The full-refund preview stored for admin review carries the DERIVED
        // figures. A proportional refund stores no amount, as before — it
        // depends on the balance at execution time.
        ...(input.type === "stripe_refund" && input.refundType === "full" ? {
          refundAmountCents: derivedAmountCents,
          creditsToDeduct: derivedOriginalCredits,
        } : {}),
      });

      if (!result.success) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: result.error || "Failed to create change request" });
      }

      // The admin panel's pending change-request list IS the notification
      // road: an admin opening /admin/change-requests sees the new request at
      // the top. The Slack sends that used to sit here pointed at webhooks
      // production never had (#800).
      const auditSeverity = input.priority === "urgent" ? "critical" as const : input.priority === "high" ? "warning" as const : "info" as const;

      // Log to database audit log
      await logAuditEvent({
        userId: ctx.user.id,
        action: AUDIT_ACTIONS.CHANGE_REQUEST_CREATED,
        resourceType: "change_request",
        resourceId: String(result.requestId),
        metadata: {
          requestId: result.requestId,
          type: input.type,
          priority: input.priority,
          targetUserId: input.targetUserId,
          targetUserName: input.targetUserName,
          title: input.title,
          creditAmount: input.creditAmount,
          ipAddress: input.ipAddress,
        },
        severity: auditSeverity,
        req: ctx.req,
      });

      return {
        success: true,
        requestId: result.requestId,
        message: "Change request submitted for admin review",
      };
    }),

  // Get referrals flagged for same-IP fraud review
  getFlaggedReferrals: moderatorProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).optional().default(50),
      offset: z.number().min(0).optional().default(0),
    }).optional())
    .query(async ({ input }) => {
      const { getFlaggedReferrals } = await import("../db");
      return await getFlaggedReferrals(input?.limit || 50, input?.offset || 0);
    }),

  // Get change requests submitted by the current moderator
  getMyChangeRequests: moderatorProcedure
    .input(z.object({
      status: z.enum(["pending", "approved", "denied", "cancelled", "expired", "all"]).optional().default("all"),
      limit: z.number().min(1).max(100).optional().default(50),
      offset: z.number().min(0).optional().default(0),
    }).optional())
    .query(async ({ ctx, input }) => {
      const { getChangeRequestsByModerator } = await import("../db");
      return await getChangeRequestsByModerator(ctx.user.id, {
        status: input?.status === "all" ? undefined : input?.status,
        limit: input?.limit || 50,
        offset: input?.offset || 0,
      });
    }),

});
