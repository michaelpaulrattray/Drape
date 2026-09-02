/**
 * Approve or deny a change request (#421).
 *
 * Same repair as its two siblings — the paint comes off a primitive that was
 * already themed; see `UserActionModals.tsx`'s header for why that is the fix
 * rather than a substitution.
 *
 * # ⚠ The two buttons stopped being a colour pair, and that is a decision
 *
 * Approve was `bg-emerald-600` and deny was `bg-red-600` — a green/red pair
 * that told you which was which by hue alone and read as two equally weighted
 * options. Brief 07 §3 removed exactly this device from the staff surfaces:
 * **the one red is reserved for genuinely urgent state**, and green is not in
 * the palette at all.
 *
 * So approve takes the house ink, which is what a constructive commit wears
 * everywhere else in this product, and deny takes `variant="destructive"` —
 * the one red, spent on the one act here that ends something.
 */
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
    /*
      ⚠ TITLE CASE ON PURPOSE, AND IT IS THE ONE PLACE THIS FILE DOES NOT SPEAK
      THE HOUSE VOICE. `approveLabel` is `"Approve Refund"`, `"Acknowledge"`,
      `"Confirm Suspend"` — nineteen strings in `ChangeRequestConstants.tsx`,
      which also feeds `ChangeRequestList.tsx`, a surface brief 06 already
      shipped. Lowercasing this suffix alone would read as a typo beside them;
      lowercasing the constants is a copy change across a file no modal owns.
      Filed rather than smuggled in.
    */
    ? (isSensitive ? `${actionCfg.approveLabel} & Send to Slack` : actionCfg.approveLabel)
    : actionCfg.denyLabel;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="text-foreground">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            {action === "approved" ? (
              <CheckCircle className="w-5 h-5 text-muted-foreground" />
            ) : (
              <XCircle className="w-5 h-5 text-destructive" />
            )}
            {modalTitle}
          </DialogTitle>
          <DialogDescription>
            {/*
              ⚠ THE ISSUE-NUMBER TRAP IN REVERSE: this `#` is a request id the
              admin is reading, not a colour and not a card reference. It is
              interpolated rather than literal, so `token-guard` never sees it.
            */}
            <span>Request <strong>#{selectedRequestId}</strong>: {modalDesc}</span>
            {action === "approved" && isSensitive && (
              /*
                The purple is gone. This sentence is a warning about a second
                pair of eyes, so it takes the warning weight the rest of the
                staff surfaces use — emphasis, not a hue nobody else spends.
              */
              <span className="block mt-1 font-medium text-foreground">
                This is a sensitive action. A Slack confirmation will be required before execution.
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <label className="text-sm text-muted-foreground">Notes (optional)</label>
          <Textarea
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            placeholder={notesPlaceholder}
            className="min-h-[80px]"
          />
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-muted-foreground hover:text-foreground"
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isPending}
            variant={action === "approved" ? "default" : "destructive"}
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
