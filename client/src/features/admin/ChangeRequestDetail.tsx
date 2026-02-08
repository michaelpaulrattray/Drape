import { Link } from "wouter";
import {
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  User,
  Shield,
  Eye,
  Loader2,
  Timer,
} from "lucide-react";
import { AttachmentsSection } from "./ChangeRequestAttachments";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  TYPE_CONFIG,
  SENSITIVE_TYPES,
  StatusBadge,
  PriorityBadge,
  TypeIcon,
  formatDate,
  getActionConfig,
} from "./ChangeRequestConstants";

interface ChangeRequestDetailProps {
  selectedRequestId: number | null;
  selectedRequest: any;
  isLoading: boolean;
  slackStatus: string | null | undefined;
  isSlackExecuting: boolean;
  onApprove: () => void;
  onDeny: () => void;
}

export function ChangeRequestDetail({
  selectedRequestId,
  selectedRequest,
  isLoading,
  slackStatus,
  isSlackExecuting,
  onApprove,
  onDeny,
}: ChangeRequestDetailProps) {
  if (!selectedRequestId) {
    return (
      <div className="bg-white border border-[#E5E5E5] rounded-lg p-12 text-center text-[#999]">
        <Eye className="w-10 h-10 mx-auto mb-3 opacity-50" />
        <p>Select a request to view details</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="bg-white border border-[#E5E5E5] rounded-lg p-12 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#999]" />
      </div>
    );
  }

  if (!selectedRequest) {
    return (
      <div className="bg-white border border-[#E5E5E5] rounded-lg p-12 text-center text-[#999]">
        <AlertTriangle className="w-10 h-10 mx-auto mb-3 opacity-50" />
        <p>Request not found</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-[#E5E5E5] rounded-lg overflow-hidden">
      {/* Detail Header */}
      <div className="p-6 border-b border-[#E5E5E5]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <TypeIcon type={selectedRequest.type} />
              <h2 className="text-lg font-semibold text-[#0A0A0A]">{selectedRequest.title}</h2>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <StatusBadge status={selectedRequest.status} />
              <PriorityBadge priority={selectedRequest.priority} />
              <Badge variant="outline" className="text-xs border-[#E5E5E5] text-[#999]">
                {TYPE_CONFIG[selectedRequest.type]?.label || selectedRequest.type}
              </Badge>
              <span className="text-xs text-[#CCC]">#{selectedRequest.id}</span>
            </div>
          </div>

          {/* Action Buttons */}
          {selectedRequest.status === "pending" && (() => {
            const actionCfg = getActionConfig(selectedRequest.type);
            const isSensitive = SENSITIVE_TYPES.includes(selectedRequest.type);
            return (
              <div className="flex gap-2 shrink-0">
                <Button
                  size="sm"
                  onClick={onApprove}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <CheckCircle className="w-4 h-4 mr-1" />
                  {isSensitive ? `${actionCfg.approveLabel} (Slack)` : actionCfg.approveLabel}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onDeny}
                  className="border-red-300 text-red-600 hover:bg-red-50"
                >
                  <XCircle className="w-4 h-4 mr-1" />
                  {actionCfg.denyLabel}
                </Button>
              </div>
            );
          })()}

          {/* Pending Slack Execution Status */}
          {selectedRequest.status === "pending_execution" && (
            <SlackStatusIndicator slackStatus={slackStatus} isExecuting={isSlackExecuting} />
          )}
        </div>
      </div>

      {/* Detail Body */}
      <div className="p-6 space-y-6">
        {/* Description */}
        <div>
          <h3 className="text-xs font-medium text-[#999] uppercase tracking-wider mb-2">Description</h3>
          <p className="text-sm text-[#666] whitespace-pre-wrap leading-relaxed">
            {selectedRequest.description}
          </p>
        </div>

        {/* Key Details Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-[#F8F8F8] rounded-lg p-3 border border-[#EFEFEF]">
            <div className="text-xs text-[#999] mb-1">Submitted By</div>
            <div className="flex items-center gap-2">
              <User className="w-3.5 h-3.5 text-[#999]" />
              <span className="text-sm text-[#0A0A0A]">{selectedRequest.submittedByName || `User ${selectedRequest.submittedById}`}</span>
            </div>
          </div>
          <div className="bg-[#F8F8F8] rounded-lg p-3 border border-[#EFEFEF]">
            <div className="text-xs text-[#999] mb-1">Target User</div>
            <div className="flex items-center gap-2">
              <Shield className="w-3.5 h-3.5 text-[#999]" />
              <span className="text-sm text-[#0A0A0A]">
                {selectedRequest.targetUserName
                  ? `${selectedRequest.targetUserName} (ID: ${selectedRequest.targetUserId})`
                  : `User ID: ${selectedRequest.targetUserId}`}
              </span>
            </div>
          </div>
          <div className="bg-[#F8F8F8] rounded-lg p-3 border border-[#EFEFEF]">
            <div className="text-xs text-[#999] mb-1">Created</div>
            <div className="text-sm text-[#0A0A0A]">{formatDate(selectedRequest.createdAt)}</div>
          </div>
          <div className="bg-[#F8F8F8] rounded-lg p-3 border border-[#EFEFEF]">
            <div className="text-xs text-[#999] mb-1">Last Updated</div>
            <div className="text-sm text-[#0A0A0A]">{formatDate(selectedRequest.updatedAt)}</div>
          </div>
        </div>

        {/* Credit Details */}
        <CreditDetailsSection request={selectedRequest} />

        {/* Stripe Refund Details */}
        <StripeRefundSection request={selectedRequest} />

        {/* IP Details */}
        <IPDetailsSection request={selectedRequest} />

        {/* Suspend/Unsuspend Warning */}
        <SuspendWarningSection request={selectedRequest} />

        {/* Pending Execution Banner */}
        <PendingExecutionBanner request={selectedRequest} slackStatus={slackStatus} />

        {/* Evidence Summary */}
        {selectedRequest.evidenceSummary && (
          <div>
            <h3 className="text-xs font-medium text-[#999] uppercase tracking-wider mb-2">Evidence Summary</h3>
            <p className="text-sm text-[#666] whitespace-pre-wrap bg-[#F8F8F8] rounded-lg p-3 border border-[#EFEFEF]">
              {selectedRequest.evidenceSummary}
            </p>
          </div>
        )}

        {/* Attachments */}
        <AttachmentsSection changeRequestId={selectedRequest.id} />

        {/* Related Audit Log */}
        {selectedRequest.relatedAuditLogId && (
          <div>
            <h3 className="text-xs font-medium text-[#999] uppercase tracking-wider mb-2">Related Audit Log</h3>
            <Link href={`/admin/audit-logs?highlight=${selectedRequest.relatedAuditLogId}`}>
              <span className="text-sm text-blue-600 hover:underline cursor-pointer">
                View Audit Log Entry #{selectedRequest.relatedAuditLogId} →
              </span>
            </Link>
          </div>
        )}

        {/* Review Info (for already reviewed requests) */}
        {selectedRequest.reviewedById && (
          <div className="bg-[#F8F8F8] border border-[#E5E5E5] rounded-lg p-4">
            <h3 className="text-xs font-medium text-[#999] uppercase tracking-wider mb-2">Review Decision</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#999]">Reviewed by:</span>
                <span className="text-sm text-[#0A0A0A]">{selectedRequest.reviewedByName || `Admin ${selectedRequest.reviewedById}`}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#999]">Reviewed at:</span>
                <span className="text-sm text-[#0A0A0A]">{formatDate(selectedRequest.reviewedAt)}</span>
              </div>
              {selectedRequest.reviewNotes && (
                <div>
                  <span className="text-xs text-[#999]">Notes:</span>
                  <p className="text-sm text-[#666] mt-1">{selectedRequest.reviewNotes}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sub-sections ────────────────────────────────────────────────────────────

function SlackStatusIndicator({ slackStatus, isExecuting }: { slackStatus: string | null | undefined; isExecuting: boolean }) {
  if (slackStatus === "approved") {
    return (
      <div className="flex items-center gap-2 shrink-0">
        <CheckCircle className="w-4 h-4 text-emerald-600" />
        <span className="text-sm text-emerald-600">Slack Approved</span>
        {isExecuting && <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />}
      </div>
    );
  }
  if (slackStatus === "denied") {
    return (
      <div className="flex items-center gap-2 shrink-0">
        <XCircle className="w-4 h-4 text-red-600" />
        <span className="text-sm text-red-600">Slack Denied</span>
      </div>
    );
  }
  if (slackStatus === "expired") {
    return (
      <div className="flex items-center gap-2 shrink-0">
        <Clock className="w-4 h-4 text-[#999]" />
        <span className="text-sm text-[#999]">Slack Expired</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 shrink-0">
      <Timer className="w-4 h-4 animate-pulse text-purple-600" />
      <span className="text-sm text-purple-600">Awaiting Slack Approval...</span>
    </div>
  );
}

function CreditDetailsSection({ request }: { request: any }) {
  if (!(request.type === "refund_credits" || request.type === "add_credits") || !request.creditAmount) return null;
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
      <h3 className="text-xs font-medium text-amber-700 uppercase tracking-wider mb-2">Credit Details</h3>
      <div className="flex items-center gap-4">
        <div>
          <div className="text-xs text-[#999]">Amount</div>
          <div className="text-lg font-bold text-amber-700">{request.creditAmount} credits</div>
        </div>
        {request.creditReason && (
          <div className="flex-1">
            <div className="text-xs text-[#999]">Reason</div>
            <div className="text-sm text-[#666]">{request.creditReason}</div>
          </div>
        )}
      </div>
      {request.status === "pending" && (
        <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" />
          Approving will {request.type === "refund_credits" ? "refund" : "add"} {request.creditAmount} credits to the user's account.
        </p>
      )}
    </div>
  );
}

function StripeRefundSection({ request }: { request: any }) {
  if (request.type !== "stripe_refund") return null;
  return (
    <div className="bg-violet-50 border border-violet-200 rounded-lg p-4">
      <h3 className="text-xs font-medium text-violet-700 uppercase tracking-wider mb-3">Stripe Refund Details</h3>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-xs text-[#999]">Refund Type</div>
          <div className="text-sm font-medium text-[#0A0A0A] capitalize">{request.refundType || "—"}</div>
        </div>
        <div>
          <div className="text-xs text-[#999]">Refund Amount</div>
          <div className="text-lg font-bold text-violet-700">${request.refundAmountCents ? (request.refundAmountCents / 100).toFixed(2) : "—"}</div>
        </div>
        <div>
          <div className="text-xs text-[#999]">Original Credits</div>
          <div className="text-sm text-[#0A0A0A]">{request.originalCredits ?? "—"} credits</div>
        </div>
        <div>
          <div className="text-xs text-[#999]">Credits to Deduct</div>
          <div className="text-sm font-medium text-red-600">{request.creditsToDeduct ?? "—"} credits</div>
        </div>
        {request.stripeSessionId && (
          <div className="col-span-2">
            <div className="text-xs text-[#999]">Stripe Session</div>
            <code className="text-xs font-mono text-[#666]">{request.stripeSessionId}</code>
          </div>
        )}
      </div>
      {request.status === "pending" && (
        <p className="text-xs text-violet-600 mt-3 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" />
          Approving will issue a ${request.refundAmountCents ? (request.refundAmountCents / 100).toFixed(2) : "—"} Stripe refund and deduct {request.creditsToDeduct ?? "—"} credits from the user (balance floored at 0).
        </p>
      )}
    </div>
  );
}

function IPDetailsSection({ request }: { request: any }) {
  if (request.type !== "block_ip" || !request.ipAddress) return null;
  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
      <h3 className="text-xs font-medium text-red-700 uppercase tracking-wider mb-2">IP Address</h3>
      <div className="flex items-center gap-2">
        <code className="text-sm font-mono text-red-700">{request.ipAddress}</code>
      </div>
      {request.status === "pending" && (
        <p className="text-xs text-red-600 mt-2 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" />
          Approving will automatically block this IP address.
        </p>
      )}
    </div>
  );
}

function SuspendWarningSection({ request }: { request: any }) {
  if (!(request.type === "suspend_user" || request.type === "unsuspend_user") || request.status !== "pending") return null;
  const isSuspend = request.type === "suspend_user";
  return (
    <div className={`${isSuspend ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"} border rounded-lg p-4`}>
      <p className={`text-xs ${isSuspend ? "text-red-600" : "text-green-600"} flex items-center gap-1`}>
        <AlertTriangle className="w-3 h-3" />
        Approving will require Slack confirmation before {isSuspend ? "suspending" : "unsuspending"} the target user's account.
      </p>
    </div>
  );
}

function PendingExecutionBanner({ request, slackStatus }: { request: any; slackStatus: string | null | undefined }) {
  if (request.status !== "pending_execution") return null;
  return (
    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-2">
        <Timer className="w-4 h-4 text-purple-600" />
        <h3 className="text-sm font-medium text-purple-700">Awaiting Slack Confirmation</h3>
      </div>
      <p className="text-xs text-purple-600">
        This change request has been approved by an admin but requires Slack confirmation before the action is executed.
        {slackStatus === "pending" && " Check your Slack #admin-actions channel for the approval buttons."}
        {slackStatus === "denied" && " The Slack approval was denied. This request will not be executed."}
        {slackStatus === "expired" && " The Slack approval has expired. This request will not be executed."}
      </p>
      {request.reviewedByName && (
        <p className="text-xs text-[#999] mt-2">
          Approved by {request.reviewedByName} at {formatDate(request.reviewedAt)}
        </p>
      )}
    </div>
  );
}
