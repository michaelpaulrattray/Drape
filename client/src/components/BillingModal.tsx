import { useState } from "react";
import { X, Check, Zap, Crown, Building2, Sparkles, Loader2, ArrowRight, AlertCircle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface BillingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface PlanChangePreview {
  currentPlan: string;
  newPlan: string;
  isUpgrade: boolean;
  proratedAmount: number;
  immediateCharge: number;
  creditBalance: number;
  currentPlanPrice: number;
  newPlanPrice: number;
  daysRemaining: number;
  totalDays: number;
  creditAdjustment: number;
}

export function BillingModal({ isOpen, onClose }: BillingModalProps) {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [confirmingPlan, setConfirmingPlan] = useState<string | null>(null);
  const [planPreview, setPlanPreview] = useState<PlanChangePreview | null>(null);

  const { data: plans } = trpc.billing.getPlans.useQuery();
  const { data: status, refetch: refetchStatus } = trpc.billing.getStatus.useQuery();
  const utils = trpc.useUtils();
  
  const createSubscriptionCheckout = trpc.billing.createSubscriptionCheckout.useMutation({
    onSuccess: (data) => {
      window.location.href = data.checkoutUrl;
    },
    onError: (error) => {
      toast.error(error.message);
      setLoadingPlan(null);
    },
  });

  const createPortalSession = trpc.billing.createPortalSession.useMutation({
    onSuccess: (data) => {
      window.location.href = data.portalUrl;
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const changePlan = trpc.billing.changePlan.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      setConfirmingPlan(null);
      setPlanPreview(null);
      refetchStatus();
      utils.credits.getBalance.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
      setConfirmingPlan(null);
    },
  });

  if (!isOpen) return null;

  const handleSubscribe = async (plan: "starter" | "pro" | "studio") => {
    const currentPlan = status?.planTier || "free";
    
    // If user has no subscription, go to checkout
    if (currentPlan === "free" || !status?.hasSubscription) {
      setLoadingPlan(plan);
      createSubscriptionCheckout.mutate({ plan });
      return;
    }
    
    // If user has a subscription, show plan change confirmation
    setLoadingPlan(plan);
    try {
      const preview = await utils.billing.previewPlanChange.fetch({ newPlan: plan });
      setPlanPreview(preview);
      setConfirmingPlan(plan);
    } catch (error) {
      toast.error("Failed to preview plan change");
    } finally {
      setLoadingPlan(null);
    }
  };

  const handleConfirmPlanChange = () => {
    if (!confirmingPlan) return;
    changePlan.mutate({ newPlan: confirmingPlan as "starter" | "pro" | "studio" });
  };

  const handleCancelPlanChange = () => {
    setConfirmingPlan(null);
    setPlanPreview(null);
  };

  const handleManageSubscription = () => {
    createPortalSession.mutate();
  };

  const getPlanIcon = (planId: string) => {
    switch (planId) {
      case "starter":
        return <Zap className="w-5 h-5" />;
      case "pro":
        return <Crown className="w-5 h-5" />;
      case "studio":
        return <Building2 className="w-5 h-5" />;
      default:
        return <Sparkles className="w-5 h-5" />;
    }
  };

  const formatPrice = (cents: number) => {
    return `$${(cents / 100).toFixed(0)}`;
  };

  const formatPriceCents = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const currentPlan = status?.planTier || "free";

  // Plan Change Confirmation Dialog - Light Mode
  if (confirmingPlan && planPreview) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div 
          className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          onClick={handleCancelPlanChange}
        />
        
        <div className="relative w-full max-w-md mx-4 bg-white border border-gray-200 rounded-2xl shadow-2xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className={`p-3 rounded-xl ${planPreview.isUpgrade ? "bg-emerald-50" : "bg-amber-50"}`}>
              {planPreview.isUpgrade ? (
                <ArrowRight className="w-6 h-6 text-emerald-600" />
              ) : (
                <AlertCircle className="w-6 h-6 text-amber-600" />
              )}
            </div>
            <div>
              <h3 className="text-xl font-semibold text-gray-900">
                {planPreview.isUpgrade ? "Upgrade" : "Downgrade"} to {confirmingPlan.charAt(0).toUpperCase() + confirmingPlan.slice(1)}
              </h3>
              <p className="text-sm text-gray-500">
                {planPreview.daysRemaining} days remaining in current period
              </p>
            </div>
          </div>

          <div className="space-y-4 mb-6">
            {/* Price Change */}
            <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-500">Current Plan</span>
                <span className="text-gray-900 font-medium capitalize">
                  {planPreview.currentPlan} ({formatPrice(planPreview.currentPlanPrice)}/mo)
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">New Plan</span>
                <span className="text-gray-900 font-medium capitalize">
                  {planPreview.newPlan} ({formatPrice(planPreview.newPlanPrice)}/mo)
                </span>
              </div>
            </div>

            {/* Proration Details */}
            <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
              {planPreview.isUpgrade ? (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-500">Prorated charge today</span>
                    <span className="text-gray-900 font-medium">
                      {formatPriceCents(planPreview.immediateCharge)}
                    </span>
                  </div>
                  {planPreview.creditAdjustment > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Bonus credits</span>
                      <span className="text-emerald-600 font-medium">
                        +{planPreview.creditAdjustment} credits
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-500">Credit to account</span>
                    <span className="text-emerald-600 font-medium">
                      {formatPriceCents(planPreview.creditBalance)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    Credit will be applied to your next invoice. Changes take effect immediately.
                  </p>
                </>
              )}
            </div>

            {/* Warning for downgrade */}
            {!planPreview.isUpgrade && (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                <p className="text-sm text-amber-700">
                  Your monthly credit allocation will decrease. Unused credits from your current plan will roll over based on your new plan's rollover percentage.
                </p>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleCancelPlanChange}
              className="flex-1 py-3 rounded-xl font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmPlanChange}
              disabled={changePlan.isPending}
              className={`flex-1 py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 ${
                planPreview.isUpgrade
                  ? "bg-gray-900 hover:bg-gray-800 text-white"
                  : "bg-amber-500 hover:bg-amber-600 text-white"
              }`}
            >
              {changePlan.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing...
                </>
              ) : (
                `Confirm ${planPreview.isUpgrade ? "Upgrade" : "Downgrade"}`
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal - Light Mode */}
      <div className="relative w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto bg-white border border-gray-200 rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between p-6 border-b border-gray-100 bg-white/95 backdrop-blur-sm">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">Upgrade Your Plan</h2>
            <p className="text-sm text-gray-500 mt-1">
              Get more credits and unlock premium features
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Current Plan Banner */}
        {currentPlan !== "free" && (
          <div className="mx-6 mt-6 p-4 rounded-xl bg-gray-50 border border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gray-900 text-white">
                  {getPlanIcon(currentPlan)}
                </div>
                <div>
                  <p className="text-sm text-gray-500">Current Plan</p>
                  <p className="text-gray-900 font-medium capitalize">{currentPlan}</p>
                </div>
              </div>
              {status?.canManage && (
                <button
                  onClick={handleManageSubscription}
                  className="px-4 py-2 text-sm rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
                >
                  Manage Subscription
                </button>
              )}
            </div>
          </div>
        )}

        {/* Pricing Cards */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans?.subscriptions.map((plan) => {
            const isCurrentPlan = currentPlan === plan.id;
            const isLoading = loadingPlan === plan.id;
            const isPro = plan.id === "pro";
            const isUpgrade = currentPlan === "free" || 
              (currentPlan === "starter" && (plan.id === "pro" || plan.id === "studio")) ||
              (currentPlan === "pro" && plan.id === "studio");

            return (
              <div
                key={plan.id}
                className={`relative rounded-xl border p-6 transition-all ${
                  isPro
                    ? "border-gray-900 bg-gray-50 shadow-lg"
                    : "border-gray-200 bg-white hover:border-gray-300"
                } ${isCurrentPlan ? "ring-2 ring-gray-900" : ""}`}
              >
                {isPro && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-gray-900 text-xs font-medium text-white">
                    Most Popular
                  </div>
                )}

                <div className="flex items-center gap-2 mb-4">
                  <div className={`p-2 rounded-lg ${isPro ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600"}`}>
                    {getPlanIcon(plan.id)}
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">{plan.name.replace("FormaStudio ", "")}</h3>
                </div>

                <div className="mb-4">
                  <span className="text-3xl font-bold text-gray-900">{formatPrice(plan.priceInCents)}</span>
                  <span className="text-gray-500">/month</span>
                </div>

                <div className="mb-4 p-3 rounded-lg bg-gray-100">
                  <p className="text-2xl font-bold text-gray-900">{plan.credits.toLocaleString()}</p>
                  <p className="text-sm text-gray-500">credits per month</p>
                </div>

                <ul className="space-y-2 mb-6">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Check className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-600">{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleSubscribe(plan.id as "starter" | "pro" | "studio")}
                  disabled={isCurrentPlan || isLoading}
                  className={`w-full py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
                    isCurrentPlan
                      ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                      : isPro
                      ? "bg-gray-900 hover:bg-gray-800 text-white"
                      : "bg-gray-100 hover:bg-gray-200 text-gray-900"
                  }`}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Processing...
                    </>
                  ) : isCurrentPlan ? (
                    "Current Plan"
                  ) : status?.hasSubscription ? (
                    isUpgrade ? "Upgrade" : "Downgrade"
                  ) : (
                    "Subscribe"
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* Free Tier Info */}
        <div className="mx-6 mb-6 p-4 rounded-xl bg-gray-50 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-900 font-medium">Free Tier</p>
              <p className="text-sm text-gray-500">100 credits to get started • No credit card required</p>
            </div>
            {currentPlan === "free" && (
              <span className="px-3 py-1 rounded-full bg-gray-200 text-gray-600 text-xs">
                Your Current Plan
              </span>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 text-center text-sm text-gray-400">
          <p>All plans include access to all generation features. Credits roll over based on your plan tier.</p>
          <p className="mt-1">Questions? Contact us at support@formastudio.app</p>
        </div>
      </div>
    </div>
  );
}
