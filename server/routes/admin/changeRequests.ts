import { adminProcedure, router } from "../../_core/trpc";
import { CHANGE_REQUEST_ACTION_BY_TYPE, executeChangeRequestAction } from "../../lib/adminActions";
import { z } from "zod";
import { TRPCError } from "@trpc/server";

export const changeRequestsRouter = router({
  // List change requests with optional filters
  listChangeRequests: adminProcedure
    .input(z.object({
      status: z.enum(["pending", "approved", "denied", "cancelled", "expired", "pending_execution", "all"]).optional().default("pending"),
      type: z.string().optional(),
      priority: z.string().optional(),
      limit: z.number().min(1).max(100).optional().default(50),
      offset: z.number().min(0).optional().default(0),
    }).optional())
    .query(async ({ input }) => {
      const { listChangeRequests } = await import("../../db");
      return await listChangeRequests({
        status: input?.status === "all" ? undefined : input?.status,
        type: input?.type,
        priority: input?.priority,
        limit: input?.limit || 50,
        offset: input?.offset || 0,
      });
    }),

  // Get a single change request by ID
  getChangeRequest: adminProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const { getChangeRequestById } = await import("../../db");
      const request = await getChangeRequestById(input.id);
      if (!request) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Change request not found" });
      }
      return request;
    }),

  // Approve or deny a change request. The admin's Approve in the panel IS the
  // approval — a sensitive type executes inside this same mutation. The Slack
  // confirmation leg was retired by #800 (2026-09-11): it never ran in
  // production (no webhook was ever configured, so it self-approved), which
  // means the panel review was always the only human decision on this road.
  reviewChangeRequest: adminProcedure
    .input(z.object({
      id: z.number(),
      action: z.enum(["approved", "denied"]),
      reviewNotes: z.string().max(2000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { getChangeRequestById, updateChangeRequestStatus } = await import("../../db");
      const { logAuditEvent } = await import("../../auditLog");
      const { AUDIT_ACTIONS } = await import("../../../drizzle/schema");
      const { writeImmutableLog } = await import("../../security/adminSecurity");

      const adminName = ctx.user.name || ctx.user.email || `Admin ${ctx.user.id}`;

      // Fetch the request first
      const request = await getChangeRequestById(input.id);
      if (!request) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Change request not found" });
      }
      if (request.status !== "pending") {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Change request is already ${request.status}` });
      }

      // A sensitive type executes on approval — and a type is sensitive
      // EXACTLY WHEN it has an executor action to run. That equivalence is
      // structural rather than coincidental: a sensitive type is looked up in
      // `CHANGE_REQUEST_ACTION_BY_TYPE` below, so a sensitive type without an
      // action would hand the executor `undefined`. Derived rather than
      // re-typed (3g's D — this was a fourth hand-typed copy of the same six,
      // and the test file's own copy had already drifted to FIVE, missing
      // `stripe_refund`).
      const isSensitive = request.type in CHANGE_REQUEST_ACTION_BY_TYPE;

      const actionVerb = input.action === "approved" ? "Approved" : "Denied";

      // ─── Sensitive type + approval → execute in this mutation ────────
      if (input.action === "approved" && isSensitive) {
        // Record the review FIRST, compare-and-swapped on `pending`, so two
        // admins approving at once cannot both reach the executor — the
        // second write finds the status already moved and refuses. The
        // intermediate `pending_execution` status also means a crash between
        // this write and the executor's own `→ approved` settle leaves the
        // request visibly unsettled ("outcome unconfirmed") rather
        // than silently done or silently lost.
        const result = await updateChangeRequestStatus(input.id, {
          status: "pending_execution",
          reviewedById: ctx.user.id,
          reviewedByName: adminName,
          reviewNotes: input.reviewNotes,
        }, "pending");

        if (!result.success) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: result.error || "Failed to update change request" });
        }

        // Build params for the executor
        const approvalParams: Record<string, unknown> = {
          changeRequestId: input.id,
          reason: request.title,
        };
        if (request.creditAmount) approvalParams.creditAmount = request.creditAmount;
        if (request.creditReason) approvalParams.creditReason = request.creditReason;
        if (request.ipAddress) approvalParams.reason = `${request.title} (IP: ${request.ipAddress})`;
        // ⚠ The stripe_refund executor reads these three off the approval
        // params, and until #418 nothing put them there — every approved
        // Stripe refund would have died at execution on "Missing Stripe
        // session ID". The AMOUNT is deliberately not carried: the executor
        // reads it from the charge itself at the moment money moves.
        if (request.type === "stripe_refund") {
          approvalParams.stripeSessionId = request.stripeSessionId;
          approvalParams.refundType = request.refundType;
          approvalParams.originalCredits = request.originalCredits;
        }

        // Determine targetId for the executor
        const targetId = request.type === "block_ip" && request.ipAddress
          ? request.ipAddress
          : String(request.targetUserId);

        // Audit the approval before execution, so a failed execution still
        // leaves the decision on the record.
        await logAuditEvent({
          userId: ctx.user.id,
          action: AUDIT_ACTIONS.CHANGE_REQUEST_APPROVED,
          resourceType: "change_request",
          resourceId: String(input.id),
          metadata: {
            requestId: input.id,
            type: request.type,
            decision: "approved",
            reviewNotes: input.reviewNotes,
            submittedById: request.submittedById,
            targetUserId: request.targetUserId,
            creditAmount: request.creditAmount,
          },
          severity: "info",
          req: ctx.req,
        });

        await writeImmutableLog(
          "change_request_approved",
          {
            adminId: ctx.user.id,
            adminName,
            targetId: String(request.targetUserId),
            action: `Approved change request #${input.id} (${request.type})`,
            requestId: input.id,
            type: request.type,
            title: request.title,
            creditAmount: request.creditAmount,
            reviewNotes: input.reviewNotes,
          },
        );

        // Execute. The executor settles the request (`pending_execution` →
        // `approved`) and writes its own audit + immutable rows. On a throw
        // the request STAYS `pending_execution` — deliberately, and with no
        // self-serve retry: an executor that failed midway may already have
        // moved money or state, and a retry road here is how a refund gets
        // issued twice. The warning audit row below lands the failure on the
        // admin overview's alerts feed.
        try {
          const execResult = await executeChangeRequestAction({
            action: CHANGE_REQUEST_ACTION_BY_TYPE[request.type as keyof typeof CHANGE_REQUEST_ACTION_BY_TYPE],
            targetId,
            params: approvalParams,
            resolvedBy: adminName,
          }, ctx);

          return {
            success: true,
            action: "approved" as const,
            message: execResult.message,
            executionResult: { executed: true },
          };
        } catch (error: any) {
          await logAuditEvent({
            userId: ctx.user.id,
            action: AUDIT_ACTIONS.CHANGE_REQUEST_EXECUTION_FAILED,
            resourceType: "change_request",
            resourceId: String(input.id),
            metadata: {
              requestId: input.id,
              type: request.type,
              error: error?.message || String(error),
              targetUserId: request.targetUserId,
              creditAmount: request.creditAmount,
            },
            severity: "warning",
            req: ctx.req,
          });
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error?.message || "Failed to execute approved change request",
          });
        }
      }

      // ─── Non-sensitive approval or denial → immediate processing ─────
      const result = await updateChangeRequestStatus(input.id, {
        status: input.action,
        reviewedById: ctx.user.id,
        reviewedByName: adminName,
        reviewNotes: input.reviewNotes,
      });

      if (!result.success) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: result.error || "Failed to update change request" });
      }

      // Database audit log
      const auditAction = input.action === "approved"
        ? AUDIT_ACTIONS.CHANGE_REQUEST_APPROVED
        : AUDIT_ACTIONS.CHANGE_REQUEST_DENIED;

      await logAuditEvent({
        userId: ctx.user.id,
        action: auditAction,
        resourceType: "change_request",
        resourceId: String(input.id),
        metadata: {
          requestId: input.id,
          type: request.type,
          decision: input.action,
          reviewNotes: input.reviewNotes,
          submittedById: request.submittedById,
          targetUserId: request.targetUserId,
          creditAmount: request.creditAmount,
        },
        severity: "info",
        req: ctx.req,
      });

      // Write to immutable log for compliance
      await writeImmutableLog(
        `change_request_${input.action}`,
        {
          adminId: ctx.user.id,
          adminName,
          targetId: String(request.targetUserId),
          action: `${actionVerb} change request #${input.id} (${request.type})`,
          requestId: input.id,
          type: request.type,
          title: request.title,
          creditAmount: request.creditAmount,
          reviewNotes: input.reviewNotes,
        },
      );

      // Non-sensitive approvals still don't auto-execute (flag_account, note_incident, other)
      return {
        success: true,
        action: input.action,
        message: `Change request #${input.id} has been ${actionVerb.toLowerCase()}`,
        executionResult: { executed: false },
      };
    }),
});
