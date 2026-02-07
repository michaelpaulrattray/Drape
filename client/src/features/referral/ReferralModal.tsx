import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  X, Copy, Check, Gift, Send, Coins, Users,
  ChevronLeft, Clock, UserPlus, AlertTriangle, Mail,
} from "lucide-react";
import { toast } from "sonner";
import { RedeemCodeModal } from "./RedeemCodeModal";

/* ── Status config for history items ── */
const STATUS_CONFIG: Record<
  string,
  { label: string; icon: React.ReactNode; color: string }
> = {
  pending: {
    label: "Pending",
    icon: <Clock className="w-3.5 h-3.5" />,
    color: "text-amber-600 bg-amber-50",
  },
  signed_up: {
    label: "Signed up",
    icon: <UserPlus className="w-3.5 h-3.5" />,
    color: "text-blue-600 bg-blue-50",
  },
  completed: {
    label: "Completed",
    icon: <Check className="w-3.5 h-3.5" />,
    color: "text-emerald-600 bg-emerald-50",
  },
  expired: {
    label: "Expired",
    icon: <AlertTriangle className="w-3.5 h-3.5" />,
    color: "text-muted-foreground bg-muted",
  },
};

interface ReferralModalProps {
  open: boolean;
  onClose: () => void;
}

type ModalView = "share" | "history";

export function ReferralModal({ open, onClose }: ReferralModalProps) {
  const [view, setView] = useState<ModalView>("share");
  const [copied, setCopied] = useState(false);
  const [email, setEmail] = useState("");
  const [showRedeem, setShowRedeem] = useState(false);

  const { data: codeData, isLoading: codeLoading } =
    trpc.referral.getMyCode.useQuery(undefined, { enabled: open });
  const { data: stats } = trpc.referral.getStats.useQuery(undefined, {
    enabled: open,
  });
  const { data: history, isLoading: historyLoading } =
    trpc.referral.getHistory.useQuery(undefined, {
      enabled: open && view === "history",
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

  const handleClose = () => {
    setView("share");
    onClose();
  };

  const rewardCredits = codeData?.rewardCredits ?? 12500;

  return (
    <>
      <div className="fixed inset-0 z-[70] flex items-center justify-center">
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={handleClose}
        />

        {/* Modal shell — fixed size so view switch doesn't jump */}
        <div className="relative w-full max-w-md mx-4 bg-card text-card-foreground rounded-2xl shadow-2xl border border-border overflow-hidden">
          {/* Close button (always visible) */}
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-muted transition-colors z-10"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>

          {/* ─── SHARE VIEW ─── */}
          {view === "share" && (
            <>
              {/* Header */}
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
                        /{(stats?.lifetimeCap ?? 250000).toLocaleString()}
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

              {/* Footer */}
              <div className="px-6 py-3 border-t border-border bg-muted/20 flex items-center justify-between">
                <button
                  onClick={() => setShowRedeem(true)}
                  className="text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                >
                  Redeem a code
                </button>
                <button
                  onClick={() => setView("history")}
                  className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                >
                  Invitation history
                  <span className="text-xs">›</span>
                </button>
              </div>
            </>
          )}

          {/* ─── HISTORY VIEW ─── */}
          {view === "history" && (
            <>
              {/* Header with back arrow */}
              <div className="px-6 pt-5 pb-4 flex items-center gap-3">
                <button
                  onClick={() => setView("share")}
                  className="p-1 rounded-full hover:bg-muted transition-colors -ml-1"
                >
                  <ChevronLeft className="w-5 h-5 text-foreground" />
                </button>
                <h3 className="text-base font-semibold tracking-tight">
                  Invitation history
                </h3>
              </div>

              {/* History list */}
              <div className="px-6 pb-6 max-h-80 overflow-y-auto">
                {historyLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="h-14 bg-muted animate-pulse rounded-lg"
                      />
                    ))}
                  </div>
                ) : !history || history.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                      <Mail className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      No recipient email
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {history.map((item) => {
                      const config =
                        STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
                      const displayName =
                        item.referredName ||
                        item.referredEmail ||
                        "Invited user";
                      const date = new Date(
                        item.createdAt
                      ).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      });

                      return (
                        <div
                          key={item.id}
                          className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/20 hover:bg-muted/40 transition-colors"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium truncate">
                              {displayName}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {date}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 ml-3">
                            {item.creditsAwarded > 0 && (
                              <span className="text-xs font-medium text-emerald-600">
                                +{item.creditsAwarded.toLocaleString()}
                              </span>
                            )}
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.color}`}
                            >
                              {config.icon}
                              {config.label}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Redeem code modal — overlay on top */}
      <RedeemCodeModal
        open={showRedeem}
        onClose={() => setShowRedeem(false)}
      />
    </>
  );
}
