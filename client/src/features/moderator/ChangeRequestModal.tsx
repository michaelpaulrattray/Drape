/**
 * Change Request Modal — form for submitting structured change requests with file attachments.
 */
import { X, FileText, Loader2, Upload, Image, File, Trash2 } from "lucide-react";
import { useState, useRef } from "react";
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
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import type { ChangeRequestType, ChangeRequestPriority } from "./moderatorConstants";

export interface UploadedAttachment {
  id: number;
  filename: string;
  url: string;
  mimeType: string;
  size: number;
}

interface ChangeRequestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isPending: boolean;
  onSubmit: (attachmentIds: number[]) => void;
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

const MAX_FILES = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
  "image/jpeg", "image/png", "image/gif", "image/webp",
  "application/pdf", "text/csv", "text/plain",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImageMime(mime: string): boolean {
  return mime.startsWith("image/");
}

export function ChangeRequestModal(props: ChangeRequestModalProps) {
  const {
    open, onOpenChange, isPending, onSubmit,
    crType, setCrType, crPriority, setCrPriority,
    crTargetUserId, setCrTargetUserId, crTargetUserName, setCrTargetUserName,
    crTitle, setCrTitle, crDescription, setCrDescription,
    crEvidenceSummary, setCrEvidenceSummary,
    crRelatedAuditLogId, setCrRelatedAuditLogId,
    crCreditAmount, setCrCreditAmount, crCreditReason, setCrCreditReason,
    crIpAddress, setCrIpAddress,
    crStripeSessionId, setCrStripeSessionId,
    crRefundType, setCrRefundType,
    crOriginalAmountCents, setCrOriginalAmountCents,
    crOriginalCredits, setCrOriginalCredits,
  } = props;

  const [attachments, setAttachments] = useState<UploadedAttachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadMutation = trpc.moderatorAttachments.uploadAttachment.useMutation();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const remaining = MAX_FILES - attachments.length;
    if (remaining <= 0) {
      toast.error(`Maximum ${MAX_FILES} files allowed`);
      return;
    }

    const toUpload = files.slice(0, remaining);
    setIsUploading(true);

    for (const file of toUpload) {
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`${file.name} is too large (max 10MB)`);
        continue;
      }
      if (!ALLOWED_TYPES.includes(file.type)) {
        toast.error(`${file.name}: unsupported file type`);
        continue;
      }

      try {
        const base64 = await fileToBase64(file);
        const result = await uploadMutation.mutateAsync({
          filename: file.name,
          mimeType: file.type,
          base64Data: base64,
        });
        setAttachments((prev) => [...prev, result]);
      } catch {
        toast.error(`Failed to upload ${file.name}`);
      }
    }

    setIsUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAttachment = (id: number) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const handleSubmit = () => {
    onSubmit(attachments.map((a) => a.id));
  };

  const handleClose = (v: boolean) => {
    if (!v) setAttachments([]);
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-white border-[#E5E5E5] text-[#0A0A0A] max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[#0A0A0A]">
            <FileText className="w-5 h-5 text-amber-600" />
            New Change Request
          </DialogTitle>
          <DialogDescription className="text-[#999]">
            Submit a structured request for admin review. This will be tracked and you can follow its status.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Type + Priority */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-[#999] uppercase tracking-wider mb-1 block">Request Type</label>
              <Select value={crType} onValueChange={(v) => setCrType(v as ChangeRequestType)}>
                <SelectTrigger className="bg-[#F8F8F8] border-[#E5E5E5] text-[#0A0A0A]"><SelectValue /></SelectTrigger>
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
              <label className="text-[10px] text-[#999] uppercase tracking-wider mb-1 block">Priority</label>
              <Select value={crPriority} onValueChange={(v) => setCrPriority(v as ChangeRequestPriority)}>
                <SelectTrigger className="bg-[#F8F8F8] border-[#E5E5E5] text-[#0A0A0A]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Target User */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-[#999] uppercase tracking-wider mb-1 block">Target User ID *</label>
              <Input value={crTargetUserId} onChange={(e) => setCrTargetUserId(e.target.value)} placeholder="e.g., 42" className="bg-[#F8F8F8] border-[#E5E5E5] text-[#0A0A0A] placeholder:text-[#CCC]" />
            </div>
            <div>
              <label className="text-[10px] text-[#999] uppercase tracking-wider mb-1 block">Target User Name</label>
              <Input value={crTargetUserName} onChange={(e) => setCrTargetUserName(e.target.value)} placeholder="User name (optional)" className="bg-[#F8F8F8] border-[#E5E5E5] text-[#0A0A0A] placeholder:text-[#CCC]" />
            </div>
          </div>

          {/* Credit fields */}
          {(crType === "refund_credits" || crType === "add_credits") && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-[#999] uppercase tracking-wider mb-1 block">Credit Amount *</label>
                <Input type="number" value={crCreditAmount} onChange={(e) => setCrCreditAmount(e.target.value)} placeholder="e.g., 100" min="1" className="bg-[#F8F8F8] border-[#E5E5E5] text-[#0A0A0A] placeholder:text-[#CCC]" />
              </div>
              <div>
                <label className="text-[10px] text-[#999] uppercase tracking-wider mb-1 block">Credit Reason</label>
                <Input value={crCreditReason} onChange={(e) => setCrCreditReason(e.target.value)} placeholder="e.g., Service disruption" className="bg-[#F8F8F8] border-[#E5E5E5] text-[#0A0A0A] placeholder:text-[#CCC]" />
              </div>
            </div>
          )}

          {/* IP field */}
          {crType === "block_ip" && (
            <div>
              <label className="text-[10px] text-[#999] uppercase tracking-wider mb-1 block">IP Address *</label>
              <Input value={crIpAddress} onChange={(e) => setCrIpAddress(e.target.value)} placeholder="e.g., 192.168.1.1" className="bg-[#F8F8F8] border-[#E5E5E5] text-[#0A0A0A] placeholder:text-[#CCC]" />
            </div>
          )}

          {/* Stripe refund fields */}
          {crType === "stripe_refund" && (
            <div className="space-y-3 p-3 rounded-xl bg-amber-50 border border-amber-200">
              <p className="text-xs text-amber-700 font-medium">Stripe Refund Details</p>
              <div>
                <label className="text-[10px] text-[#999] uppercase tracking-wider mb-1 block">Stripe Session ID *</label>
                <Input value={crStripeSessionId} onChange={(e) => setCrStripeSessionId(e.target.value)} placeholder="cs_test_..." className="bg-white border-[#E5E5E5] text-[#0A0A0A] placeholder:text-[#CCC] font-mono text-xs" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-[#999] uppercase tracking-wider mb-1 block">Original Amount (cents)</label>
                  <Input type="number" value={crOriginalAmountCents || ""} onChange={(e) => setCrOriginalAmountCents(parseInt(e.target.value) || 0)} placeholder="e.g., 1500" className="bg-white border-[#E5E5E5] text-[#0A0A0A] placeholder:text-[#CCC]" />
                  {crOriginalAmountCents > 0 && <p className="text-xs text-[#999] mt-0.5">${(crOriginalAmountCents / 100).toFixed(2)}</p>}
                </div>
                <div>
                  <label className="text-[10px] text-[#999] uppercase tracking-wider mb-1 block">Original Credits</label>
                  <Input type="number" value={crOriginalCredits || ""} onChange={(e) => setCrOriginalCredits(parseInt(e.target.value) || 0)} placeholder="e.g., 150" className="bg-white border-[#E5E5E5] text-[#0A0A0A] placeholder:text-[#CCC]" />
                </div>
              </div>
              <div>
                <label className="text-[10px] text-[#999] uppercase tracking-wider mb-1 block">Refund Type</label>
                <Select value={crRefundType} onValueChange={(v) => setCrRefundType(v as "full" | "proportional")}>
                  <SelectTrigger className="bg-white border-[#E5E5E5] text-[#0A0A0A]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="proportional">Proportional (unused credits only)</SelectItem>
                    <SelectItem value="full">Full Refund (goodwill)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-[#999] mt-1">
                  {crRefundType === "proportional" ? "Refunds only the unused portion. Credits deducted, balance floors at 0." : "Refunds full amount regardless of usage. Credits deducted, balance floors at 0."}
                </p>
              </div>
            </div>
          )}

          {/* Title + Description */}
          <div>
            <label className="text-[10px] text-[#999] uppercase tracking-wider mb-1 block">Title * (min 5 characters)</label>
            <Input value={crTitle} onChange={(e) => setCrTitle(e.target.value)} placeholder="Brief summary of the request" className="bg-[#F8F8F8] border-[#E5E5E5] text-[#0A0A0A] placeholder:text-[#CCC]" />
          </div>
          <div>
            <label className="text-[10px] text-[#999] uppercase tracking-wider mb-1 block">Description * (min 10 characters)</label>
            <Textarea value={crDescription} onChange={(e) => setCrDescription(e.target.value)} placeholder="Detailed description of the issue and why this action is needed..." className="bg-[#F8F8F8] border-[#E5E5E5] text-[#0A0A0A] placeholder:text-[#CCC] min-h-[80px]" />
            <p className="text-xs text-[#CCC] mt-1">{crDescription.length}/5000 characters</p>
          </div>

          {/* Evidence Summary */}
          <div>
            <label className="text-[10px] text-[#999] uppercase tracking-wider mb-1 block">Evidence Summary (optional)</label>
            <Textarea value={crEvidenceSummary} onChange={(e) => setCrEvidenceSummary(e.target.value)} placeholder="Links, screenshots, or other evidence supporting this request..." className="bg-[#F8F8F8] border-[#E5E5E5] text-[#0A0A0A] placeholder:text-[#CCC] min-h-[60px]" />
          </div>

          {/* File Attachments */}
          <div>
            <label className="text-[10px] text-[#999] uppercase tracking-wider mb-1 block">Attachments ({attachments.length}/{MAX_FILES})</label>
            <input ref={fileInputRef} type="file" multiple accept={ALLOWED_TYPES.join(",")} onChange={handleFileSelect} className="hidden" />

            {/* Upload area */}
            {attachments.length < MAX_FILES && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="w-full border border-dashed border-[#CCC] rounded-xl p-3 flex items-center justify-center gap-2 text-[#999] hover:text-[#666] hover:border-[#999] transition-colors disabled:opacity-50"
              >
                {isUploading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Uploading...</>
                ) : (
                  <><Upload className="w-4 h-4" /> Drop files or click to upload</>
                )}
              </button>
            )}
            <p className="text-xs text-[#CCC] mt-1">JPEG, PNG, GIF, WebP, PDF, CSV, TXT, XLSX — max 10MB each</p>

            {/* Attachment previews */}
            {attachments.length > 0 && (
              <div className="mt-2 space-y-2">
                {attachments.map((att) => (
                  <div key={att.id} className="flex items-center gap-2 p-2 rounded-lg bg-[#F8F8F8] border border-[#E5E5E5]">
                    {isImageMime(att.mimeType) ? (
                      <img src={att.url} alt={att.filename} className="w-10 h-10 rounded object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded bg-[#E5E5E5] flex items-center justify-center flex-shrink-0">
                        <File className="w-5 h-5 text-[#999]" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[#0A0A0A] truncate">{att.filename}</p>
                      <p className="text-xs text-[#CCC]">{formatFileSize(att.size)}</p>
                    </div>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-[#CCC] hover:text-red-600" onClick={() => removeAttachment(att.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Related audit log */}
          {crRelatedAuditLogId && (
            <div>
              <label className="text-[10px] text-[#999] uppercase tracking-wider mb-1 block">Related Audit Log</label>
              <Badge className="bg-[#F0F0F0] text-[#666]">
                #{crRelatedAuditLogId}
                <button className="ml-1 hover:text-[#0A0A0A]" onClick={() => setCrRelatedAuditLogId("")}>
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)} className="border-[#E5E5E5] text-[#666]">Cancel</Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending || isUploading || crTitle.length < 5 || crDescription.length < 10 || !crTargetUserId}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            {isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />}
            Submit Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function fileToBase64(file: globalThis.File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]); // Strip data:...;base64, prefix
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
