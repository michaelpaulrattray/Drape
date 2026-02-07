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
import { SENSITIVE_TYPES } from "./ChangeRequestConstants";

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#141414] border-white/10 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {action === "approved" ? (
              <>
                <CheckCircle className="w-5 h-5 text-emerald-400" />
                Approve Change Request
              </>
            ) : (
              <>
                <XCircle className="w-5 h-5 text-red-400" />
                Deny Change Request
              </>
            )}
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            {action === "approved" ? (
              <>
                This will approve request <strong>#{selectedRequestId}</strong>.
                {isSensitive && (
                  <span className="block mt-1 text-purple-400 font-medium">
                    This is a sensitive action. A Slack confirmation will be required before execution.
                  </span>
                )}
                {!isSensitive && (
                  <span className="block mt-1 text-gray-400">
                    This will approve the request. No auto-execution for this type.
                  </span>
                )}
              </>
            ) : (
              <>This will deny request <strong>#{selectedRequestId}</strong>. No action will be taken.</>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <label className="text-sm text-gray-400">Review Notes (optional)</label>
          <Textarea
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            placeholder={action === "approved" ? "Any notes about this approval..." : "Reason for denial..."}
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
            {action === "approved"
              ? (isSensitive ? "Approve & Send to Slack" : "Approve")
              : "Deny Request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
