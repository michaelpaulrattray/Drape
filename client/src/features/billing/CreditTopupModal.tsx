import { useState } from "react";
import { X, Sparkles, Loader2, ArrowRight, Check, Zap, Crown, Building2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface CreditTopupModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentBalance?: number;
}

const PLAN_ORDER = ["free", "starter", "pro", "studio"] as const;

const PLAN_META: Record<string, { icon: typeof Sparkles; label: string; color: string; bgColor: string }> = {
  free: { icon: Sparkles, label: "Free", color: "text-[#757575]", bgColor: "bg-[#F5F5F5]" },
  starter: { icon: Zap, label: "Starter", color: "text-blue-600", bgColor: "bg-blue-50" },
  pro: { icon: Crown, label: "Pro", color: "text-violet-600", bgColor: "bg-violet-50" },
  studio: { icon: Building2, label: "Studio", color: "text-amber-600", bgColor: "bg-amber-50" },
};

export function CreditTopupModal({ isOpen, onClose, currentBalance = 0 }: CreditTopupModalProps) {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const { data: plans } = trpc.billing.getPlans.useQuery();
  const { data: status } = trpc.billing.getStatus.useQuery();

  const createSubscriptionCheckout = trpc.billing.createSubscriptionCheckout.useMutation({
    onSuccess: (data) => {
      window.location.href = data.checkoutUrl;
    },
    onError: (error) => {
      toast.error(error.message);
      setLoadingPlan(null);
    },
  });

  const changePlan = trpc.billing.changePlan.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      setLoadingPlan(null);
      onClose();
    },
    onError: (error) => {
      toast.error(error.message);
      setLoadingPlan(null);
    },
  });

  if (!isOpen) return null;

  const currentPlan = status?.planTier || "free";
  const currentIndex = PLAN_ORDER.indexOf(currentPlan as typeof PLAN_ORDER[number]);

  // Get available upgrade tiers (everything above current plan)
  const upgradeTiers = plans?.subscriptions.filter((plan) => {
    const planIndex = PLAN_ORDER.indexOf(plan.id as typeof PLAN_ORDER[number]);
    return planIndex > currentIndex;
  }) || [];

  const handleUpgrade = (planId: string) => {
    setLoadingPlan(planId);

    if (currentPlan === "free" || !status?.hasSubscription) {
      createSubscriptionCheckout.mutate({
        plan: planId as "starter" | "pro" | "studio",
        interval: "monthly",
      });
    } else {
      changePlan.mutate({
        newPlan: planId as "starter" | "pro" | "studio",
      });
    }
  };

  const formatPrice = (cents: number) => `$${(cents / 100).toFixed(0)}`;

  const currentTierData = plans?.tiers?.[currentPlan as keyof typeof plans.tiers];
  const currentCredits = currentTierData?.monthlyCredits || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative w-full max-w-lg mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-4">
          <div>
            <h2 className="text-xl font-semibold text-[#0A0A0A] tracking-tight">
              Add more credits
            </h2>
            <p className="text-sm text-[#757575] mt-1">
              Upgrade your plan to increase your monthly credit allocation
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-[#F5F5F5] transition-colors"
          >
            <X className="w-5 h-5 text-[#757575]" />
          </button>
        </div>

        {/* Current Plan Summary */}
        <div className="mx-6 mb-4 p-4 rounded-xl bg-[#FAFAFA] border border-[#EBEBEB]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${PLAN_META[currentPlan]?.bgColor || "bg-[#F5F5F5]"}`}>
                {(() => {
                  const Icon = PLAN_META[currentPlan]?.icon || Sparkles;
                  return <Icon className={`w-4 h-4 ${PLAN_META[currentPlan]?.color || "text-[#757575]"}`} />;
                })()}
              </div>
              <div>
                <p className="text-sm font-medium text-[#0A0A0A]">
                  Current: {PLAN_META[currentPlan]?.label || "Free"} plan
                </p>
                <p className="text-xs text-[#757575]">
                  {currentCredits.toLocaleString()} credits/month
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-[#0A0A0A]">
                {currentBalance.toLocaleString()}
              </p>
              <p className="text-xs text-[#757575]">credits remaining</p>
            </div>
          </div>
        </div>

        {/* Upgrade Options */}
        <div className="px-6 space-y-3">
          {upgradeTiers.length === 0 ? (
            <div className="text-center py-8">
              <div className="p-3 rounded-full bg-[#F5F5F5] inline-flex mb-3">
                <Crown className="w-6 h-6 text-[#757575]" />
              </div>
              <p className="text-[#0A0A0A] font-medium">You're on the highest plan</p>
              <p className="text-sm text-[#757575] mt-1">
                You already have the maximum credit allocation available.
              </p>
            </div>
          ) : (
            upgradeTiers.map((plan) => {
              const meta = PLAN_META[plan.id] || PLAN_META.free;
              const Icon = meta.icon;
              const isLoading = loadingPlan === plan.id;
              const creditIncrease = plan.credits - currentCredits;
              const isRecommended = upgradeTiers.length > 1 && plan.id === upgradeTiers[0].id;

              return (
                <div
                  key={plan.id}
                  className={`relative p-4 rounded-xl border transition-all ${
                    isRecommended
                      ? "border-[#0A0A0A] ring-1 ring-[#0A0A0A]"
                      : "border-[#D4D4D4]"
                  }`}
                >
                  {isRecommended && (
                    <span className="absolute -top-2.5 left-4 px-2 py-0.5 bg-[#0A0A0A] text-white text-[10px] font-medium rounded-full uppercase tracking-wider">
                      Recommended
                    </span>
                  )}

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${meta.bgColor}`}>
                        <Icon className={`w-5 h-5 ${meta.color}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-[#0A0A0A]">{meta.label}</p>
                          <span className="text-sm text-[#757575]">
                            {formatPrice(plan.priceInCents)}/mo
                          </span>
                        </div>
                        <p className="text-sm text-[#757575]">
                          {plan.credits.toLocaleString()} credits/month
                          <span className="text-green-600 ml-1">
                            (+{creditIncrease.toLocaleString()})
                          </span>
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => handleUpgrade(plan.id)}
                      disabled={!!loadingPlan}
                      className="px-4 py-2 rounded-lg bg-[#0A0A0A] text-white text-sm font-medium hover:bg-[#0A0A0A]/90 transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Processing
                        </>
                      ) : (
                        <>
                          Upgrade
                          <ArrowRight className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-5 mt-4 border-t border-[#EBEBEB]">
          <p className="text-xs text-[#757575] text-center">
            Credits roll over each month based on your plan's rollover percentage.
            Upgrades take effect immediately with prorated billing.
          </p>
        </div>
      </div>
    </div>
  );
}
