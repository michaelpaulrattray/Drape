import {
  ShieldOff,
  Coins,
  Shield,
  UserCog,
  User,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RoleBadge } from "./UserBadges";

/* ── Suspend Modal ─────────────────────────────────────────── */

interface SuspendModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reason: string;
  onReasonChange: (value: string) => void;
  onConfirm: () => void;
  isPending: boolean;
}

export function SuspendModal({ open, onOpenChange, reason, onReasonChange, onConfirm, isPending }: SuspendModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0f0f0f] border-white/10 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-400">
            <ShieldOff className="w-5 h-5" />
            Suspend User
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            This will immediately block the user from accessing their account.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm text-gray-400">Reason for suspension</label>
            <Textarea
              value={reason}
              onChange={(e) => onReasonChange(e.target.value)}
              placeholder="Enter the reason for suspending this user..."
              className="mt-1 bg-white/5 border-white/10"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-white/10">Cancel</Button>
          <Button variant="destructive" onClick={onConfirm} disabled={!reason.trim() || isPending}>
            {isPending ? "Suspending..." : "Suspend User"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Credit Adjustment Modal ───────────────────────────────── */

interface CreditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action: "add" | "deduct";
  amount: string;
  onAmountChange: (value: string) => void;
  reason: string;
  onReasonChange: (value: string) => void;
  onConfirm: () => void;
  isPending: boolean;
}

export function CreditModal({ open, onOpenChange, action, amount, onAmountChange, reason, onReasonChange, onConfirm, isPending }: CreditModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0f0f0f] border-white/10 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Coins className={action === "add" ? "text-emerald-400" : "text-amber-400"} />
            {action === "add" ? "Add Credits" : "Deduct Credits"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm text-gray-400">Amount</label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => onAmountChange(e.target.value)}
              placeholder="Enter amount..."
              min="1"
              className="mt-1 bg-white/5 border-white/10"
            />
          </div>
          <div>
            <label className="text-sm text-gray-400">Reason</label>
            <Textarea
              value={reason}
              onChange={(e) => onReasonChange(e.target.value)}
              placeholder="Enter the reason for this adjustment..."
              className="mt-1 bg-white/5 border-white/10"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-white/10">Cancel</Button>
          <Button
            onClick={onConfirm}
            disabled={!amount || !reason.trim() || isPending}
            className={action === "add" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-amber-600 hover:bg-amber-700"}
          >
            {isPending ? "Processing..." : action === "add" ? "Add Credits" : "Deduct Credits"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Role Change Modal ─────────────────────────────────────── */

interface RoleChangeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetRole: "user" | "moderator";
  reason: string;
  onReasonChange: (value: string) => void;
  onConfirm: () => void;
  isPending: boolean;
  selectedUser: {
    user: {
      name: string | null;
      email: string | null;
      avatarUrl: string | null;
      role: "user" | "admin" | "moderator";
    };
  } | undefined;
}

export function RoleChangeModal({ open, onOpenChange, targetRole, reason, onReasonChange, onConfirm, isPending, selectedUser }: RoleChangeModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0f0f0f] border-white/10 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {targetRole === "moderator" ? (
              <><Shield className="w-5 h-5 text-blue-400" />Promote to Moderator</>
            ) : (
              <><UserCog className="w-5 h-5 text-amber-400" />Demote to User</>
            )}
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            {targetRole === "moderator"
              ? "This user will gain access to the moderator dashboard with read-only audit logs, user activity, and the ability to escalate issues to admins via Slack."
              : "This user will lose moderator access and return to standard user permissions."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {selectedUser && (
            <div className="bg-white/5 rounded-lg p-3 border border-white/10">
              <div className="flex items-center gap-3">
                {selectedUser.user.avatarUrl ? (
                  <img src={selectedUser.user.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                    <User className="w-5 h-5 text-purple-400" />
                  </div>
                )}
                <div>
                  <div className="font-medium">{selectedUser.user.name || "Unnamed"}</div>
                  <div className="text-sm text-gray-400">{selectedUser.user.email || "No email"}</div>
                </div>
                <div className="ml-auto flex items-center gap-2 text-sm">
                  <RoleBadge role={selectedUser.user.role} />
                  <span className="text-gray-500">→</span>
                  <RoleBadge role={targetRole} />
                </div>
              </div>
            </div>
          )}
          <div>
            <label className="text-sm text-gray-400">Reason for role change</label>
            <Textarea
              value={reason}
              onChange={(e) => onReasonChange(e.target.value)}
              placeholder={targetRole === "moderator"
                ? "e.g., Trusted community member, needs access to review reports..."
                : "e.g., No longer needed, stepping down from moderation duties..."}
              className="mt-1 bg-white/5 border-white/10"
            />
          </div>
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
            <div className="flex items-center gap-2 text-amber-400 text-sm font-medium">
              <AlertTriangle className="w-4 h-4" />
              This action will be logged and reported to Slack
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-white/10">Cancel</Button>
          <Button
            onClick={onConfirm}
            disabled={!reason.trim() || isPending}
            className={targetRole === "moderator" ? "bg-blue-600 hover:bg-blue-700" : "bg-amber-600 hover:bg-amber-700"}
          >
            {isPending ? "Processing..." : targetRole === "moderator" ? "Promote to Moderator" : "Demote to User"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
