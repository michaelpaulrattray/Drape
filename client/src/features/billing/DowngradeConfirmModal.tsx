import { useState } from "react";
import { X, Check, Loader2, Sparkles, AlertTriangle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface DowngradeConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmDowngrade: () => void;
  isCancelling: boolean;
  /** Best-value plan to suggest as alternative */
  bestValuePlan: {
    id: string;
    name: string;
    priceInCents: number;
    credits: number;
    features: string[];
  } | null;
  currentPlanPrice: number;
}

export function DowngradeConfirmModal({
  isOpen,
  onClose,
  onConfirmDowngrade,
  isCancelling,
  bestValuePlan,
  currentPlanPrice,
}: DowngradeConfirmModalProps) {
  const [isRedirecting, setIsRedirecting] = useState(false);

  const createSubscriptionCheckout = trpc.billing.createSubscriptionCheckout.useMutation({
    onSuccess: (data) => {
      window.open(data.checkoutUrl, "_blank");
      toast.info("Redirecting to checkout...");
      setIsRedirecting(false);
      onClose();
    },
    onError: (error) => {
      toast.error(error.message);
      setIsRedirecting(false);
    },
  });

  const changePlan = trpc.billing.changePlan.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      setIsRedirecting(false);
      onClose();
    },
    onError: (error) => {
      toast.error(error.message);
      setIsRedirecting(false);
    },
  });

  if (!isOpen) return null;

  const handleSwitchToBestValue = () => {
    if (!bestValuePlan) return;
    setIsRedirecting(true);

    // If user is on free (shouldn't happen since this is for paid users),
    // create a checkout. Otherwise, change plan via proration.
    if (currentPlanPrice === 0) {
      createSubscriptionCheckout.mutate({
        plan: bestValuePlan.id as any,
        interval: "monthly",
      });
    } else {
      changePlan.mutate({ newPlan: bestValuePlan.id as any, clientRequestId: crypto.randomUUID() });
    }
  };

  const savingsPercent = bestValuePlan && currentPlanPrice > 0
    ? Math.round((1 - bestValuePlan.priceInCents / currentPlanPrice) * 100)
    : 0;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-md mx-4 bg-[#1A1A1A] rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-0">
          <div />
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4 text-[#999]" />
          </button>
        </div>

        {/* Icon + Title */}
        <div className="px-6 pt-2 pb-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center mb-4">
            <AlertTriangle className="w-6 h-6 text-amber-400" />
          </div>
          <h3 className="text-xl font-semibold text-white">
            Switch to best-value plan
          </h3>
          <p className="text-sm text-[#999] mt-1">
            Keep the features you use most at a lower cost
          </p>
        </div>

        {/* Best Value Plan Card */}
        {bestValuePlan && (
          <div className="mx-6 p-5 rounded-xl bg-[#242424] border border-[#333]">
            <p className="text-xs font-medium text-[#999] uppercase tracking-wider mb-2">
              Best-value plan
            </p>
            <div className="flex items-baseline gap-3 mb-4">
              <span className="text-3xl font-bold text-white">
                ${(bestValuePlan.priceInCents / 100).toFixed(0)}
              </span>
              <span className="text-[#999] text-sm">/ month</span>
              {savingsPercent > 0 && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
                  Save {savingsPercent}%
                </span>
              )}
            </div>

            <ul className="space-y-2.5">
              <li className="flex items-start gap-2.5 text-sm">
                <Check className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                <span className="text-[#CCC]">
                  Your plan will update to ${(bestValuePlan.priceInCents / 100).toFixed(0)} / month for{" "}
                  {bestValuePlan.credits.toLocaleString()} credits
                </span>
              </li>
              {bestValuePlan.features.slice(1).map((feature, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm">
                  <Check className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                  <span className="text-[#CCC]">{feature}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 p-6">
          <button
            onClick={onConfirmDowngrade}
            disabled={isCancelling || isRedirecting}
            className="flex-1 py-3 rounded-xl font-medium text-sm bg-[#242424] border border-[#444] text-[#CCC] hover:bg-[#2A2A2A] hover:border-[#555] transition-colors flex items-center justify-center gap-2"
          >
            {isCancelling ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Cancelling...
              </>
            ) : (
              "Downgrade plan"
            )}
          </button>
          {bestValuePlan && (
            <button
              onClick={handleSwitchToBestValue}
              disabled={isCancelling || isRedirecting}
              className="flex-1 py-3 rounded-xl font-medium text-sm bg-white text-[#0A0A0A] hover:bg-[#F0F0F0] transition-colors flex items-center justify-center gap-2"
            >
              {isRedirecting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing...
                </>
              ) : (
                `Switch to best-value plan`
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
