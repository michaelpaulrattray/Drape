/**
 * Change Request Modal — form for submitting structured change requests.
 */
import { X, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import type { ChangeRequestType, ChangeRequestPriority } from "./moderatorConstants";

interface ChangeRequestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isPending: boolean;
  onSubmit: () => void;
  // Form state
  crType: ChangeRequestType;
  setCrType: (v: ChangeRequestType) => void;
  crPriority: ChangeRequestPriority;
  setCrPriority: (v: ChangeRequestPriority) => void;
  crTargetUserId: string;
  setCrTargetUserId: (v: string) => void;
  crTargetUserName: string;
  setCrTargetUserName: (v: string) => void;
  crTitle: string;
  setCrTitle: (v: string) => void;
  crDescription: string;
  setCrDescription: (v: string) => void;
  crEvidenceSummary: string;
  setCrEvidenceSummary: (v: string) => void;
  crRelatedAuditLogId: string;
  setCrRelatedAuditLogId: (v: string) => void;
  crCreditAmount: string;
  setCrCreditAmount: (v: string) => void;
  crCreditReason: string;
  setCrCreditReason: (v: string) => void;
  crIpAddress: string;
  setCrIpAddress: (v: string) => void;
  crStripeSessionId: string;
  setCrStripeSessionId: (v: string) => void;
  crRefundType: "full" | "proportional";
  setCrRefundType: (v: "full" | "proportional") => void;
  crOriginalAmountCents: number;
  setCrOriginalAmountCents: (v: number) => void;
  crOriginalCredits: number;
  setCrOriginalCredits: (v: number) => void;
}

export function ChangeRequestModal({
  open,
  onOpenChange,
  isPending,
  onSubmit,
  crType, setCrType,
  crPriority, setCrPriority,
  crTargetUserId, setCrTargetUserId,
  crTargetUserName, setCrTargetUserName,
  crTitle, setCrTitle,
  crDescription, setCrDescription,
  crEvidenceSummary, setCrEvidenceSummary,
  crRelatedAuditLogId, setCrRelatedAuditLogId,
  crCreditAmount, setCrCreditAmount,
  crCreditReason, setCrCreditReason,
  crIpAddress, setCrIpAddress,
  crStripeSessionId, setCrStripeSessionId,
  crRefundType, setCrRefundType,
  crOriginalAmountCents, setCrOriginalAmountCents,
  crOriginalCredits, setCrOriginalCredits,
}: ChangeRequestModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#111] border-white/10 text-white max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-amber-400" />
            New Change Request
          </DialogTitle>
          <DialogDescription className="text-white/50">
            Submit a structured request for admin review. This will be tracked and you can follow its status.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-white/40 mb-1 block">Request Type</label>
              <Select value={crType} onValueChange={(v) => setCrType(v as ChangeRequestType)}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="refund_credits">Refund Credits</SelectItem>
                  <SelectItem value="add_credits">Add Credits</SelectItem>
                  <SelectItem value="flag_account">Flag Account</SelectItem>
                  <SelectItem value="note_incident">Note Incident</SelectItem>
                  <SelectItem value="suspend_user">Suspend User</SelectItem>
                  <SelectItem value="unsuspend_user">Unsuspend User</SelectItem>
                  <SelectItem value="block_ip">Block IP</SelectItem>
                  <SelectItem value="stripe_refund">Stripe Refund</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-white/40 mb-1 block">Priority</label>
              <Select value={crPriority} onValueChange={(v) => setCrPriority(v as ChangeRequestPriority)}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-white/40 mb-1 block">Target User ID *</label>
              <Input
                value={crTargetUserId}
                onChange={(e) => setCrTargetUserId(e.target.value)}
                placeholder="e.g., 42"
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
              />
            </div>
            <div>
              <label className="text-xs text-white/40 mb-1 block">Target User Name</label>
              <Input
                value={crTargetUserName}
                onChange={(e) => setCrTargetUserName(e.target.value)}
                placeholder="User name (optional)"
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
              />
            </div>
          </div>

          {/* Conditional fields based on type */}
          {(crType === "refund_credits" || crType === "add_credits") && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-white/40 mb-1 block">Credit Amount *</label>
                <Input
                  type="number"
                  value={crCreditAmount}
                  onChange={(e) => setCrCreditAmount(e.target.value)}
                  placeholder="e.g., 100"
                  min="1"
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                />
              </div>
              <div>
                <label className="text-xs text-white/40 mb-1 block">Credit Reason</label>
                <Input
                  value={crCreditReason}
                  onChange={(e) => setCrCreditReason(e.target.value)}
                  placeholder="e.g., Service disruption"
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                />
              </div>
            </div>
          )}

          {crType === "block_ip" && (
            <div>
              <label className="text-xs text-white/40 mb-1 block">IP Address *</label>
              <Input
                value={crIpAddress}
                onChange={(e) => setCrIpAddress(e.target.value)}
                placeholder="e.g., 192.168.1.1"
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
              />
            </div>
          )}

          {crType === "stripe_refund" && (
            <div className="space-y-3 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
              <p className="text-xs text-amber-400 font-medium">Stripe Refund Details</p>
              <div>
                <label className="text-xs text-white/40 mb-1 block">Stripe Session ID *</label>
                <Input
                  value={crStripeSessionId}
                  onChange={(e) => setCrStripeSessionId(e.target.value)}
                  placeholder="cs_test_..."
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/30 font-mono text-xs"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-white/40 mb-1 block">Original Amount (cents)</label>
                  <Input
                    type="number"
                    value={crOriginalAmountCents || ""}
                    onChange={(e) => setCrOriginalAmountCents(parseInt(e.target.value) || 0)}
                    placeholder="e.g., 1500"
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                  />
                  {crOriginalAmountCents > 0 && (
                    <p className="text-xs text-white/30 mt-0.5">${(crOriginalAmountCents / 100).toFixed(2)}</p>
                  )}
                </div>
                <div>
                  <label className="text-xs text-white/40 mb-1 block">Original Credits</label>
                  <Input
                    type="number"
                    value={crOriginalCredits || ""}
                    onChange={(e) => setCrOriginalCredits(parseInt(e.target.value) || 0)}
                    placeholder="e.g., 100"
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-white/40 mb-1 block">Refund Type</label>
                <Select value={crRefundType} onValueChange={(v) => setCrRefundType(v as "full" | "proportional")}>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="proportional">Proportional (unused credits only)</SelectItem>
                    <SelectItem value="full">Full Refund (goodwill)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-white/30 mt-1">
                  {crRefundType === "proportional"
                    ? "Refunds only the unused portion. Credits deducted, balance floors at 0."
                    : "Refunds full amount regardless of usage. Credits deducted, balance floors at 0."}
                </p>
              </div>
            </div>
          )}

          <div>
            <label className="text-xs text-white/40 mb-1 block">Title * (min 5 characters)</label>
            <Input
              value={crTitle}
              onChange={(e) => setCrTitle(e.target.value)}
              placeholder="Brief summary of the request"
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
            />
          </div>

          <div>
            <label className="text-xs text-white/40 mb-1 block">Description * (min 10 characters)</label>
            <Textarea
              value={crDescription}
              onChange={(e) => setCrDescription(e.target.value)}
              placeholder="Detailed description of the issue and why this action is needed..."
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30 min-h-[80px]"
            />
            <p className="text-xs text-white/30 mt-1">{crDescription.length}/5000 characters</p>
          </div>

          <div>
            <label className="text-xs text-white/40 mb-1 block">Evidence Summary (optional)</label>
            <Textarea
              value={crEvidenceSummary}
              onChange={(e) => setCrEvidenceSummary(e.target.value)}
              placeholder="Links, screenshots, or other evidence supporting this request..."
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30 min-h-[60px]"
            />
          </div>

          {crRelatedAuditLogId && (
            <div>
              <label className="text-xs text-white/40 mb-1 block">Related Audit Log</label>
              <Badge className="bg-white/10 text-white/60">
                #{crRelatedAuditLogId}
                <button
                  className="ml-1 hover:text-white"
                  onClick={() => setCrRelatedAuditLogId("")}
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-white/20 text-white"
          >
            Cancel
          </Button>
          <Button
            onClick={onSubmit}
            disabled={isPending || crTitle.length < 5 || crDescription.length < 10 || !crTargetUserId}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            {isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <FileText className="w-4 h-4 mr-2" />
            )}
            Submit Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
