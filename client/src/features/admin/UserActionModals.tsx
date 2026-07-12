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
      <DialogContent className="bg-white border-[#E5E5E5] text-[#0A0A0A]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <ShieldOff className="w-5 h-5" />
            Suspend User
          </DialogTitle>
          <DialogDescription className="text-[#666]">
            This will immediately block the user from accessing their account.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm text-[#666] font-medium">Reason for suspension</label>
            <Textarea
              value={reason}
              onChange={(e) => onReasonChange(e.target.value)}
              placeholder="Enter the reason for suspending this user..."
              className="mt-1 bg-[#F8F8F8] border-[#E5E5E5] text-[#0A0A0A] placeholder:text-[#999]"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-[#E5E5E5] text-[#666]">Cancel</Button>
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
      <DialogContent className="bg-white border-[#E5E5E5] text-[#0A0A0A]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Coins className="text-[#666]" />
            {action === "add" ? "Add credits" : "Deduct credits"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm text-[#666] font-medium">Amount</label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => onAmountChange(e.target.value)}
              placeholder="Enter amount..."
              min="1"
              className="mt-1 bg-[#F8F8F8] border-[#E5E5E5] text-[#0A0A0A] placeholder:text-[#999]"
            />
          </div>
          <div>
            <label className="text-sm text-[#666] font-medium">Reason</label>
            <Textarea
              value={reason}
              onChange={(e) => onReasonChange(e.target.value)}
              placeholder="Enter the reason for this adjustment..."
              className="mt-1 bg-[#F8F8F8] border-[#E5E5E5] text-[#0A0A0A] placeholder:text-[#999]"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-[#E5E5E5] text-[#666]">Cancel</Button>
          {/* R6 pile (b): money actions wear the house ink, not a color code */}
          <Button
            onClick={onConfirm}
            disabled={!amount || !reason.trim() || isPending}
            className="bg-[#0A0A0A] hover:bg-[#0A0A0A]/90 text-white"
          >
            {isPending ? "Processing..." : action === "add" ? "Add credits" : "Deduct credits"}
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
      <DialogContent className="bg-white border-[#E5E5E5] text-[#0A0A0A]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {targetRole === "moderator" ? (
              <><Shield className="w-5 h-5 text-blue-600" />Promote to Moderator</>
            ) : (
              <><UserCog className="w-5 h-5 text-amber-600" />Demote to User</>
            )}
          </DialogTitle>
          <DialogDescription className="text-[#666]">
            {targetRole === "moderator"
              ? "This user will gain access to the moderator dashboard with read-only audit logs, user activity, and the ability to escalate issues to admins via Slack."
              : "This user will lose moderator access and return to standard user permissions."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {selectedUser && (
            <div className="bg-[#F8F8F8] rounded-xl p-3 border border-[#E5E5E5]">
              <div className="flex items-center gap-3">
                {selectedUser.user.avatarUrl ? (
                  <img src={selectedUser.user.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover ring-1 ring-[#E5E5E5]" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-[#F0F0F0] flex items-center justify-center">
                    <User className="w-5 h-5 text-[#999]" />
                  </div>
                )}
                <div>
                  <div className="font-medium text-[#0A0A0A]">{selectedUser.user.name || "Unnamed"}</div>
                  <div className="text-sm text-[#999]">{selectedUser.user.email || "No email"}</div>
                </div>
                <div className="ml-auto flex items-center gap-2 text-sm">
                  <RoleBadge role={selectedUser.user.role} />
                  <span className="text-[#CCC]">→</span>
                  <RoleBadge role={targetRole} />
                </div>
              </div>
            </div>
          )}
          <div>
            <label className="text-sm text-[#666] font-medium">Reason for role change</label>
            <Textarea
              value={reason}
              onChange={(e) => onReasonChange(e.target.value)}
              placeholder={targetRole === "moderator"
                ? "e.g., Trusted community member, needs access to review reports..."
                : "e.g., No longer needed, stepping down from moderation duties..."}
              className="mt-1 bg-[#F8F8F8] border-[#E5E5E5] text-[#0A0A0A] placeholder:text-[#999]"
            />
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
            <div className="flex items-center gap-2 text-amber-700 text-sm font-medium">
              <AlertTriangle className="w-4 h-4" />
              This action will be logged and reported to Slack
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-[#E5E5E5] text-[#666]">Cancel</Button>
          <Button
            onClick={onConfirm}
            disabled={!reason.trim() || isPending}
            className={targetRole === "moderator" ? "bg-blue-600 hover:bg-blue-700 text-white" : "bg-amber-600 hover:bg-amber-700 text-white"}
          >
            {isPending ? "Processing..." : targetRole === "moderator" ? "Promote to Moderator" : "Demote to User"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
