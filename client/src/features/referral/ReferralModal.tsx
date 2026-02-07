import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Copy, Check, Gift, Send, Coins, Users } from "lucide-react";
import { toast } from "sonner";
import { RedeemCodeModal } from "./RedeemCodeModal";
import { InvitationHistoryModal } from "./InvitationHistoryModal";

interface ReferralModalProps {
  open: boolean;
  onClose: () => void;
}

export function ReferralModal({ open, onClose }: ReferralModalProps) {
  const [copied, setCopied] = useState(false);
  const [email, setEmail] = useState("");
  const [showRedeem, setShowRedeem] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const { data: codeData, isLoading: codeLoading } =
    trpc.referral.getMyCode.useQuery(undefined, { enabled: open });
  const { data: stats } = trpc.referral.getStats.useQuery(undefined, {
    enabled: open,
  });

  const sendInviteMutation = trpc.referral.sendInvite.useMutation({
    onSuccess: () => {
      toast.success("Invitation sent!");
      setEmail("");
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  if (!open) return null;

  const handleCopy = async () => {
    if (!codeData?.referralLink) return;
    try {
      await navigator.clipboard.writeText(codeData.referralLink);
      setCopied(true);
      toast.success("Referral link copied!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const handleSendInvite = () => {
    if (!email.trim()) return;
    sendInviteMutation.mutate({ email: email.trim() });
  };

  const rewardCredits = codeData?.rewardCredits ?? 250;

  return (
    <>
      <div className="fixed inset-0 z-[70] flex items-center justify-center">
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="relative w-full max-w-md mx-4 bg-card text-card-foreground rounded-2xl shadow-2xl border border-border overflow-hidden">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-muted transition-colors z-10"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>

          {/* Header — centered icon + title */}
          <div className="px-6 pt-6 pb-4 text-center">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
              <Gift className="w-6 h-6 text-primary" />
            </div>
            <h2 className="text-xl font-semibold tracking-tight">
              Share Forma with a friend
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              You get{" "}
              <span className="font-medium text-foreground">
                {rewardCredits.toLocaleString()} credits
              </span>{" "}
              when they subscribe. They get{" "}
              <span className="font-medium text-foreground">
                {rewardCredits.toLocaleString()} credits
              </span>{" "}
              on their first generation.
            </p>
          </div>

          {/* Share Link */}
          <div className="px-6 pb-3">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
              Share link
            </label>
            {codeLoading ? (
              <div className="h-10 bg-muted animate-pulse rounded-lg" />
            ) : (
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm font-mono truncate text-muted-foreground">
                  {codeData?.referralLink || "—"}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopy}
                  className="shrink-0 gap-1.5 bg-background"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>

          {/* Email Invite */}
          <div className="px-6 pb-4">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
              Invite by email
            </label>
            <div className="flex items-center gap-2">
              <Input
                type="email"
                placeholder="friend@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendInvite()}
                className="flex-1"
              />
              <Button
                size="sm"
                onClick={handleSendInvite}
                disabled={!email.trim() || sendInviteMutation.isPending}
                className="shrink-0 gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                {sendInviteMutation.isPending ? "Sending..." : "Send"}
              </Button>
            </div>
          </div>

          {/* Stats Row */}
          <div className="px-6 pb-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-muted/40 border border-border rounded-lg p-3 text-center">
                <div className="flex items-center justify-center gap-1.5 text-muted-foreground mb-1">
                  <Coins className="w-3.5 h-3.5" />
                  <span className="text-xs font-medium">Credits earned</span>
                </div>
                <div className="text-lg font-semibold">
                  {(stats?.totalCreditsEarned ?? 0).toLocaleString()}
                  <span className="text-xs text-muted-foreground font-normal">
                    /{(stats?.lifetimeCap ?? 5000).toLocaleString()}
                  </span>
                </div>
              </div>
              <div className="bg-muted/40 border border-border rounded-lg p-3 text-center">
                <div className="flex items-center justify-center gap-1.5 text-muted-foreground mb-1">
                  <Users className="w-3.5 h-3.5" />
                  <span className="text-xs font-medium">Referrals</span>
                </div>
                <div className="text-lg font-semibold">
                  {stats?.completedReferrals ?? 0}
                  <span className="text-sm text-muted-foreground font-normal">
                    /{stats?.totalReferrals ?? 0}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer with links */}
          <div className="px-6 py-3 border-t border-border bg-muted/20 flex items-center justify-between">
            <button
              onClick={() => setShowRedeem(true)}
              className="text-sm font-medium text-primary hover:text-primary/80 transition-colors"
            >
              Redeem a code
            </button>
            <button
              onClick={() => setShowHistory(true)}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
            >
              Invitation history
              <span className="text-xs">›</span>
            </button>
          </div>
        </div>
      </div>

      {/* Secondary modals — overlay on top */}
      <RedeemCodeModal
        open={showRedeem}
        onClose={() => setShowRedeem(false)}
      />
      <InvitationHistoryModal
        open={showHistory}
        onClose={() => setShowHistory(false)}
      />
    </>
  );
}
