/**
 * Approve or deny a change request (#421, then #436).
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
 *
 * # Brief 11 (#436): the grammar, and the height bound this never had
 *
 * `CheckCircle`/`XCircle` come out of the title and out of the confirm button
 * (§3), the header takes the mono `CHANGE REQUEST` eyebrow (§4), and the notes
 * field takes the one field-label treatment (§5). The content had no `max-h`,
 * so a long `modalDesc` plus the sensitive-action sentence plus an 80px
 * textarea could push the buttons past a short window with nothing to scroll;
 * it is now header / scrolling body / footer like the other six.
 */
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ModalField } from "@/foundation";
import {
  StaffDialogHeader,
  STAFF_DIALOG_BODY,
  STAFF_DIALOG_CONTENT,
} from "@/features/staff";
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
    ? actionCfg.approveLabel
    : actionCfg.denyLabel;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={STAFF_DIALOG_CONTENT}>
        <StaffDialogHeader
          eyebrow="CHANGE REQUEST"
          title={modalTitle}
          description={
            <>
              {/*
                ⚠ THE ISSUE-NUMBER TRAP IN REVERSE: this `#` is a request id the
                admin is reading, not a colour and not a card reference. It is
                interpolated rather than literal, so `token-guard` never sees it.
              */}
              <span>Request <strong>#{selectedRequestId}</strong>: {modalDesc}</span>
              {action === "approved" && isSensitive && (
                /*
                  This sentence is the warning that approving IS the act (#800
                  — no second sign-off exists), so it takes the warning weight
                  the rest of the staff surfaces use.
                */
                <span className="block mt-1 font-medium text-foreground">
                  This is a sensitive action. It runs the moment you approve it.
                </span>
              )}
            </>
          }
        />

        <div className={STAFF_DIALOG_BODY}>
          <ModalField label="Notes" htmlFor="review-notes" helper="Optional.">
            <Textarea
              id="review-notes"
              value={notes}
              onChange={(e) => onNotesChange(e.target.value)}
              placeholder={notesPlaceholder}
              className="min-h-[80px]"
            />
          </ModalField>
        </div>

        <DialogFooter className="shrink-0 gap-2">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-muted-foreground hover:text-foreground"
          >
            Cancel
          </Button>
          {/*
            ⚠ The pending label names the act rather than the button's own
            words. It cannot reuse `confirmLabel`: those constants are
            imperatives (`Approve refund`, `Acknowledge`), and an imperative
            with an ellipsis reads as an instruction, not as progress.
          */}
          <Button
            onClick={onConfirm}
            disabled={isPending}
            variant={action === "approved" ? "default" : "destructive"}
          >
            {isPending
              ? (action === "approved" ? "Approving…" : "Denying…")
              : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
