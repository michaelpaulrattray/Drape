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
      <DialogContent className="bg-[#1a1a1a] border-white/10 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-400">
            <Ban className="w-5 h-5" />
            Suspend User
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-white/60">
            This will immediately block the user from accessing the platform. They will be logged out and unable to log back in until unsuspended.
          </p>
          <div>
            <label className="text-xs text-white/40 uppercase mb-2 block">Suspension Reason</label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Enter reason for suspension..."
              className="bg-white/5 border-white/10 text-white"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={onCancel}
              className="border-white/20 text-white"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={onConfirm}
              disabled={!reason.trim() || isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Ban className="w-4 h-4 mr-2" />
              )}
              Confirm Suspension
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
      <DialogContent className="bg-[#1a1a1a] border-white/10 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-400">
            <Globe className="w-5 h-5" />
            Block IP Address
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-white/60">
            This will block all requests from this IP address. Blocked IPs cannot access any part of the platform.
          </p>
          <div>
            <label className="text-xs text-white/40 uppercase mb-2 block">IP Address</label>
            <Input
              value={ipAddress}
              onChange={(e) => setIpAddress(e.target.value)}
              placeholder="e.g. 192.168.1.1"
              className="bg-white/5 border-white/10 text-white font-mono"
            />
          </div>
          <div>
            <label className="text-xs text-white/40 uppercase mb-2 block">Reason</label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Enter reason for blocking..."
              className="bg-white/5 border-white/10 text-white"
            />
          </div>
          <div>
            <label className="text-xs text-white/40 uppercase mb-2 block">Duration</label>
            <Select value={duration} onValueChange={setDuration}>
              <SelectTrigger className="bg-white/5 border-white/10 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#1a1a1a] border-white/10">
                <SelectItem value="1h">1 Hour</SelectItem>
                <SelectItem value="24h">24 Hours</SelectItem>
                <SelectItem value="7d">7 Days</SelectItem>
                <SelectItem value="30d">30 Days</SelectItem>
                <SelectItem value="permanent">Permanent</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={onCancel}
              className="border-white/20 text-white"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={onConfirm}
              disabled={!ipAddress.trim() || !reason.trim() || isPending}
              className="bg-red-600 hover:bg-red-700"
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
