/**
 * The two audit-log dialogs — suspend a user, block an IP (#421, then #436).
 *
 * Same repair as `UserActionModals.tsx` and for the same reason: the shadcn
 * primitives underneath already resolve to foundation tokens through
 * `index.css`'s semantic remap, so the hard-coded `bg-white`, `#F8F8F8` and
 * `#E5E5E5` were painting over a themed component in one theme's colours.
 * **Taking the paint off is the fix; restating the value in `var()` form is
 * not.** Read that file's header for the full reasoning.
 *
 * Both acts here are genuinely destructive and both already wore
 * `variant="destructive"`, which is why the confirm buttons are the one part
 * of these dialogs that does not move.
 *
 * # ⚠ Brief 11 (#436): these two had NO footer and NO height bound
 *
 * The card is filed against `ChangeRequestModal`, whose footer scrolls away.
 * **These were worse.** Their buttons sat in a plain `div` at the bottom of
 * the body — so there was no header/body/footer split to keep — and the
 * content carried no `max-h` at all. A `top-50% translate-y-[-50%]` card
 * taller than the window therefore overflows in **both** directions with no
 * scroll region anywhere: the confirm button is not below a fold, it is off
 * the screen and unreachable. Block IP is three fields plus a select plus a
 * paragraph, which is enough at 540px.
 *
 * The repair is brief 03 §3's rule — header and footer `flex: none`, only the
 * body scrolls — through `STAFF_DIALOG_CONTENT` / `STAFF_DIALOG_BODY`, so the
 * string is written once for all seven dialogs rather than seven times.
 *
 * ⚠ **The two descriptive paragraphs moved INTO the header** as
 * `DialogDescription`. They are descriptions; they were the first thing in the
 * scrolling body, which is where the consequence of a destructive act is least
 * likely to be read. Copy is byte-identical.
 */
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  StaffDialogHeader,
  StaffField,
  STAFF_DIALOG_BODY,
  STAFF_DIALOG_CONTENT,
} from "@/features/staff";

// ── Suspend User Modal ────────────────────────────────────
interface SuspendModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reason: string;
  setReason: (v: string) => void;
  onConfirm: () => void;
  isPending: boolean;
  onCancel: () => void;
}

export function SuspendUserModal({
  open,
  onOpenChange,
  reason,
  setReason,
  onConfirm,
  isPending,
  onCancel,
}: SuspendModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`${STAFF_DIALOG_CONTENT} max-w-md`}>
        {/*
          `Ban` came out of the title (brief 11 §3). No house modal carries a
          glyph beside its words, and on a destructive dialog it competes with
          the one signal that matters — which is the red the title keeps.
        */}
        <StaffDialogHeader
          eyebrow="AUDIT"
          title="Suspend user"
          destructive
          description="This will immediately block the user from accessing the platform. They will be logged out and unable to log back in until unsuspended."
        />
        <div className={STAFF_DIALOG_BODY}>
          {/* The uppercase field label is brief 07's one uppercase device, and
              brief 11 §5 settles which of the three treatments it is: the mono
              one, through `.dpc-modal__label`. */}
          <StaffField label="Suspension reason" htmlFor="audit-suspend-reason">
            <Input
              id="audit-suspend-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Enter reason for suspension..."
              required
            />
          </StaffField>
        </div>
        <DialogFooter className="shrink-0">
          <Button
            variant="outline"
            onClick={onCancel}
          >
            Cancel
          </Button>
          {/*
            The label swaps and names the act (brief 11 §7). The spinner is
            gone with it: a `Loader2` inside a button that has just had its
            icon removed puts the glyph straight back.
          */}
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={!reason.trim() || isPending}
          >
            {isPending ? "Suspending…" : "Confirm suspension"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Block IP Modal ────────────────────────────────────────
interface BlockIpModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ipAddress: string;
  setIpAddress: (v: string) => void;
  reason: string;
  setReason: (v: string) => void;
  duration: string;
  setDuration: (v: string) => void;
  onConfirm: () => void;
  isPending: boolean;
  onCancel: () => void;
}

export function BlockIpModal({
  open,
  onOpenChange,
  ipAddress,
  setIpAddress,
  reason,
  setReason,
  duration,
  setDuration,
  onConfirm,
  isPending,
  onCancel,
}: BlockIpModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`${STAFF_DIALOG_CONTENT} max-w-md`}>
        <StaffDialogHeader
          eyebrow="AUDIT"
          title="Block IP address"
          destructive
          description="This will block all requests from this IP address. Blocked IPs cannot access any part of the platform."
        />
        <div className={STAFF_DIALOG_BODY}>
          <StaffField label="IP address" htmlFor="audit-block-ip">
            <Input
              id="audit-block-ip"
              value={ipAddress}
              onChange={(e) => setIpAddress(e.target.value)}
              placeholder="e.g. 192.168.1.1"
              className="font-mono"
              required
            />
          </StaffField>
          <StaffField label="Reason" htmlFor="audit-block-reason">
            <Input
              id="audit-block-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Enter reason for blocking..."
              required
            />
          </StaffField>
          {/*
            ⚠ Five options with a `Permanent` outlier, so this stays a select.
            Brief 11 §6 draws the line at four: *"Nine is a list."* The one
            control that becomes segmented in this brief is the request form's
            Priority.
          */}
          <StaffField label="Duration">
            <Select value={duration} onValueChange={setDuration}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              {/*
                ⚠ The className came OFF this one too, and it is the one place
                where that matters beyond tidiness: `SelectContent` renders in
                its own portal on `--color-popover`, so `bg-white` here was a
                white menu that stayed white in dark mode even after the dialog
                behind it was fixed.
              */}
              <SelectContent>
                <SelectItem value="1h">1 hour</SelectItem>
                <SelectItem value="24h">24 hours</SelectItem>
                <SelectItem value="7d">7 days</SelectItem>
                <SelectItem value="30d">30 days</SelectItem>
                <SelectItem value="permanent">Permanent</SelectItem>
              </SelectContent>
            </Select>
          </StaffField>
        </div>
        <DialogFooter className="shrink-0">
          <Button
            variant="outline"
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={!ipAddress.trim() || !reason.trim() || isPending}
          >
            {isPending ? "Blocking…" : "Block IP"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
