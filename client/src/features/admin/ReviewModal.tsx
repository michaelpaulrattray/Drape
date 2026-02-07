import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { SENSITIVE_TYPES, getActionConfig } from "./ChangeRequestConstants";

interface ReviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action: "approved" | "denied";
  notes: string;
  onNotesChange: (notes: string) => void;
  onConfirm: () => void;
  isPending: boolean;
  selectedRequestId: number | null;
  selectedRequestType: string | undefined;
}

export function ReviewModal({
  open,
  onOpenChange,
  action,
  notes,
  onNotesChange,
  onConfirm,
  isPending,
  selectedRequestId,
  selectedRequestType,
}: ReviewModalProps) {
  const isSensitive = selectedRequestType ? SENSITIVE_TYPES.includes(selectedRequestType) : false;
  const actionCfg = getActionConfig(selectedRequestType || "other");

  const modalTitle = action === "approved" ? actionCfg.modalApproveTitle : actionCfg.modalDenyTitle;
  const modalDesc = action === "approved" ? actionCfg.modalApproveDesc : actionCfg.modalDenyDesc;
  const notesPlaceholder = action === "approved" ? actionCfg.approveNotesPlaceholder : actionCfg.denyNotesPlaceholder;
  const confirmLabel = action === "approved"
    ? (isSensitive ? `${actionCfg.approveLabel} & Send to Slack` : actionCfg.approveLabel)
    : actionCfg.denyLabel;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#141414] border-white/10 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {action === "approved" ? (
              <CheckCircle className="w-5 h-5 text-emerald-400" />
            ) : (
              <XCircle className="w-5 h-5 text-red-400" />
            )}
            {modalTitle}
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            <span>Request <strong>#{selectedRequestId}</strong>: {modalDesc}</span>
            {action === "approved" && isSensitive && (
              <span className="block mt-1 text-purple-400 font-medium">
                This is a sensitive action. A Slack confirmation will be required before execution.
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <label className="text-sm text-gray-400">Notes (optional)</label>
          <Textarea
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            placeholder={notesPlaceholder}
            className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 min-h-[80px]"
          />
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-gray-400 hover:text-white"
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isPending}
            className={
              action === "approved"
                ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                : "bg-red-600 hover:bg-red-700 text-white"
            }
          >
            {isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : action === "approved" ? (
              <CheckCircle className="w-4 h-4 mr-2" />
            ) : (
              <XCircle className="w-4 h-4 mr-2" />
            )}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
