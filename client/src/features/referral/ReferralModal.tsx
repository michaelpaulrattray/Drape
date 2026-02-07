import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { X, Copy, Check, Gift, Users, Coins } from "lucide-react";
import { toast } from "sonner";

interface ReferralModalProps {
  open: boolean;
  onClose: () => void;
}

export function ReferralModal({ open, onClose }: ReferralModalProps) {
  const [copied, setCopied] = useState(false);

  const { data: codeData, isLoading: codeLoading } =
    trpc.referral.getMyCode.useQuery(undefined, { enabled: open });
  const { data: stats } = trpc.referral.getStats.useQuery(undefined, {
    enabled: open,
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

  const rewardCredits = codeData?.rewardCredits ?? 500;

  return (
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
          className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-muted transition-colors"
        >
          <X className="w-4 h-4 text-muted-foreground" />
        </button>

        {/* Header */}
        <div className="px-6 pt-6 pb-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
            <Gift className="w-6 h-6 text-primary" />
          </div>
          <h2 className="text-xl font-semibold tracking-tight">
            Share Forma with a friend
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Get {rewardCredits.toLocaleString()} credits each when your friend
            completes their first generation.
          </p>
        </div>

        {/* Referral Link */}
        <div className="px-6 pb-4">
          <div className="bg-muted/50 border border-border rounded-xl p-4">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">
              Your referral link
            </label>
            {codeLoading ? (
              <div className="h-10 bg-muted animate-pulse rounded-lg" />
            ) : (
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono truncate">
                  {codeData?.referralLink || "—"}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopy}
                  className="shrink-0 gap-1.5"
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
        </div>

        {/* How it works */}
        <div className="px-6 pb-4">
          <h3 className="text-sm font-medium mb-3">How it works</h3>
          <div className="space-y-2.5">
            <StepItem
              number={1}
              text="Share your unique link with a friend"
            />
            <StepItem number={2} text="They sign up and create their first generation" />
            <StepItem
              number={3}
              text={`You both receive ${rewardCredits.toLocaleString()} bonus credits`}
            />
          </div>
        </div>

        {/* Stats */}
        {stats && (stats.totalReferrals > 0 || stats.totalCreditsEarned > 0) && (
          <div className="px-6 pb-4">
            <div className="grid grid-cols-3 gap-3">
              <StatCard
                icon={<Users className="w-4 h-4" />}
                label="Referred"
                value={stats.totalReferrals}
              />
              <StatCard
                icon={<Check className="w-4 h-4" />}
                label="Completed"
                value={stats.completedReferrals}
              />
              <StatCard
                icon={<Coins className="w-4 h-4" />}
                label="Earned"
                value={stats.totalCreditsEarned.toLocaleString()}
              />
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border bg-muted/30">
          <Button onClick={onClose} variant="outline" className="w-full">
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}

function StepItem({ number, text }: { number: number; text: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center shrink-0 mt-0.5">
        {number}
      </div>
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
}) {
  return (
    <div className="bg-muted/50 border border-border rounded-lg p-3 text-center">
      <div className="flex items-center justify-center text-muted-foreground mb-1">
        {icon}
      </div>
      <div className="text-lg font-semibold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
