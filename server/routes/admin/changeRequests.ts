import { adminProcedure, router } from "../../_core/trpc";
import { CHANGE_REQUEST_ACTION_BY_TYPE, executeChangeRequestAction } from "../../lib/adminActions";
import { approvalExecution } from "../../lib/adminActions/approvalExecution";
import { changeRequestStateBlocker } from "../../lib/adminActions/approvalStateBlocker";
import { changeRequestApprovalBlocker } from "@shared/changeRequestApproval";
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
  //
  // ⚠ `.strict()` (#1360, the Warden's W5-B). This is the approval that
  // EXECUTES a money change request, and it stood beside `admin.adjustCredits`
  // as the other staff money surface the 2026-08-23 strictness sweep never
  // reached. Its one caller, `AdminChangeRequests.tsx`, sends `id`, `action`
  // and an optional `reviewNotes` — read before this was tightened — and the
  // removal contract in `adjustCredits`' note applies here too.
  reviewChangeRequest: adminProcedure
    .input(z.object({
      id: z.number(),
      action: z.enum(["approved", "denied"]),
      reviewNotes: z.string().max(2000).optional(),
    }).strict())
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

      // ─── The approval cannot proceed without the field it acts ON ────
      //
      // #921. `block_ip` is the one type whose executor target is NOT the
      // target user: every other sensitive type acts on `targetUserId`, which
      // is `.notNull()` in the schema and therefore always there. So the
      // target (`approvalExecution`, `lib/adminActions/approvalExecution.ts`) reads
      //   `request.type === "block_ip" && request.ipAddress
      //      ? request.ipAddress : String(request.targetUserId)`
      // — and with no address that fallback handed `cr_blockIP` the target
      // user's NUMERIC ID, which it blocked happily: a row on the block list
      // reading `823`, an `IP_BLOCKED` audit row, an immutable entry saying
      // *"IP 823 blocked"*, and the request settling to `approved` so the
      // panel reported success. A block-list row is exactly the record read
      // months later by somebody with no way to know it was an account number.
      //
      // ⚠ REFUSED HERE, BEFORE THE COMPARE-AND-SWAP BELOW, AND THAT PLACE IS
      // THE WHOLE POINT. The credit executors refuse the same class of missing
      // field (`cr_addCredits`/`cr_refundCredits` open on
      // `if (typeof amount !== "number" || amount <= 0) throw`) — but they do
      // it AFTER the CAS has already moved the request to `pending_execution`,
      // where it wedges at "Outcome unconfirmed" and nothing on the panel can
      // clear it, because this procedure deliberately refuses anything that is
      // not `pending`. Refusing before the CAS leaves the request `pending`
      // and still DENIABLE, which is a state an admin can act on.
      //
      // ⚠ #923 CLOSED THE TWO WEDGING SIBLINGS THE SAME WAY. `add_credits` /
      // `refund_credits` with no usable `creditAmount`, and `stripe_refund`
      // with no `stripeSessionId` or `originalCredits`, used to reach the
      // CAS and throw in the executor. The rule for all four fields is now
      // ONE declaration in `shared/changeRequestApproval.ts`, which the
      // panel's sentence under Approve reads too, and
      // `server/changeRequestApprovalBlocker.test.ts` drives the REAL
      // executors over every nullable column so a new field refusal cannot
      // quietly bring the wedge back. The executors keep their own refusals.
      //
      // Reachability, measured rather than assumed (2026-09-14, both worlds):
      // `moderator.createChangeRequest` is the only creation road in the
      // product and it already refuses every one of these, so the states
      // cannot be reached through the app today; production holds zero
      // `change_requests` rows of any type, all time, and zero `blocked_ips`
      // rows. This is depth on a staff path, not a live incident — and the
      // guard is what keeps the creation road from being the only thing
      // standing between a missing field and a permanent wrong record.
      if (input.action === "approved") {
        const blocker = changeRequestApprovalBlocker(request);
        if (blocker) {
          throw new TRPCError({ code: "BAD_REQUEST", message: blocker.sentence });
        }
      }

      // ─── …nor on a target whose STATE its executor would refuse ─────
      //
      // #991. The same wedge from the other side: the request carries every
      // field, but the person it is about has changed since a moderator
      // raised it — the suspension was already lifted from the Users page
      // (reachable today), the account is gone, the target became an admin,
      // or there is no credit balance to add to. Each executor refuses those
      // before writing anything, but only after the CAS below, so the request
      // wedged at "Outcome unconfirmed". Read here, the request stays `pending`
      // and deniable.
      //
      // ⚠ A read before the CAS can go stale before the executor's, so this is
      // the common case and not the race: the executors keep their refusals,
      // and the no-retry wedge in the `catch` below is deliberately untouched.
      // The Stripe executor's charge read and zero-refund refusal stay there
      // too (`approvalStateBlocker.ts` says why).
      if (input.action === "approved" && isSensitive) {
        const stateBlocker = await changeRequestStateBlocker(request);
        if (stateBlocker) {
          throw new TRPCError({ code: "BAD_REQUEST", message: stateBlocker.sentence });
        }
      }

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

        // Build the executor's target and params from the stored row.
        const { targetId, params: approvalParams } = approvalExecution(request);

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
