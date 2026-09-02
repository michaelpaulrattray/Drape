/**
 * The two audit-log dialogs — suspend a user, block an IP (#421).
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
 */
import {
  Ban,
  Globe,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
      <DialogContent className="text-foreground max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Ban className="w-5 h-5" />
            Suspend user
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This will immediately block the user from accessing the platform. They will be logged out and unable to log back in until unsuspended.
          </p>
          <div>
            {/* The uppercase field label is brief 07's one uppercase device. */}
            <label className="text-xs text-muted-foreground uppercase mb-2 block">Suspension reason</label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Enter reason for suspension..."
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={onCancel}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={onConfirm}
              disabled={!reason.trim() || isPending}
            >
              {isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Ban className="w-4 h-4 mr-2" />
              )}
              Confirm suspension
            </Button>
          </div>
        </div>
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
      <DialogContent className="text-foreground max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Globe className="w-5 h-5" />
            Block IP address
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This will block all requests from this IP address. Blocked IPs cannot access any part of the platform.
          </p>
          <div>
            <label className="text-xs text-muted-foreground uppercase mb-2 block">IP address</label>
            <Input
              value={ipAddress}
              onChange={(e) => setIpAddress(e.target.value)}
              placeholder="e.g. 192.168.1.1"
              className="font-mono"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground uppercase mb-2 block">Reason</label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Enter reason for blocking..."
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground uppercase mb-2 block">Duration</label>
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
          </div>
          <div className="flex gap-2 justify-end">
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
              {isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Ban className="w-4 h-4 mr-2" />
              )}
              Block IP
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
