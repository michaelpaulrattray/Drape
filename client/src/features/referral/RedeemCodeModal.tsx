import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Ticket, Check, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface RedeemCodeModalProps {
  open: boolean;
  onClose: () => void;
}

export function RedeemCodeModal({ open, onClose }: RedeemCodeModalProps) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const utils = trpc.useUtils();
  const redeemMutation = trpc.referral.redeem.useMutation({
    onSuccess: (data) => {
      toast.success(
        `Code redeemed! You'll receive ${data.rewardCredits} credits after your first generation.`
      );
      utils.referral.getStats.invalidate();
      setCode("");
      setError(null);
      onClose();
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  if (!open) return null;

  const handleRedeem = () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;
    setError(null);
    redeemMutation.mutate({ code: trimmed });
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-sm mx-4 bg-card text-card-foreground rounded-2xl shadow-2xl border border-border overflow-hidden">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-muted transition-colors z-10"
        >
          <X className="w-4 h-4 text-muted-foreground" />
        </button>

        {/* Header */}
        <div className="px-6 pt-6 pb-4 text-center">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-3">
            <Ticket className="w-5 h-5 text-primary" />
          </div>
          <h3 className="text-lg font-semibold tracking-tight">
            Redeem a referral code
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Enter a code from a friend to earn bonus credits.
          </p>
        </div>

        {/* Input */}
        <div className="px-6 pb-4">
          <Input
            placeholder="DRAPE-XXXXXX"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              setError(null);
            }}
            onKeyDown={(e) => e.key === "Enter" && handleRedeem()}
            className="text-center font-mono tracking-wider text-base"
            maxLength={16}
          />
          {error && (
            <div className="flex items-center gap-1.5 mt-2 text-destructive text-sm">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 flex gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={handleRedeem}
            disabled={!code.trim() || redeemMutation.isPending}
            className="flex-1 gap-1.5"
          >
            {redeemMutation.isPending ? (
              "Redeeming..."
            ) : (
              <>
                <Check className="w-4 h-4" />
                Redeem
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
