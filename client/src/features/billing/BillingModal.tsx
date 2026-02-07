import { useState } from "react";
import { X, Check, Zap, Crown, Building2, Sparkles, Loader2, ArrowRight, AlertCircle, ChevronDown } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface BillingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenTopup?: () => void;
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

export function BillingModal({ isOpen, onClose, onOpenTopup }: BillingModalProps) {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [confirmingPlan, setConfirmingPlan] = useState<string | null>(null);
  const [planPreview, setPlanPreview] = useState<PlanChangePreview | null>(null);
  const [billingInterval, setBillingInterval] = useState<"monthly" | "annual">("monthly");

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
    
    if (currentPlan === "free" || !status?.hasSubscription) {
      setLoadingPlan(plan);
      createSubscriptionCheckout.mutate({ plan, interval: billingInterval });
      return;
    }
    
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

  const handleEditBilling = () => {
    createPortalSession.mutate();
  };

  const formatPrice = (cents: number) => {
    return `$${(cents / 100).toFixed(0)}`;
  };

  const formatPriceCents = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const getAnnualPrice = (monthlyCents: number) => {
    const annualTotal = monthlyCents * 12;
    return Math.round(annualTotal * 0.83);
  };

  const getMonthlyEquivalent = (monthlyCents: number) => {
    const annualTotal = getAnnualPrice(monthlyCents);
    return Math.round(annualTotal / 12);
  };

  const currentPlan = status?.planTier || "free";

  const getPlanOrder = (plan: string) => {
    const order = plans?.planOrder || [];
    const idx = order.indexOf(plan as any);
    return idx >= 0 ? idx : 0;
  };

  // Plan Change Confirmation Dialog
  if (confirmingPlan && planPreview) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div 
          className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          onClick={handleCancelPlanChange}
        />
        
        <div className="relative w-full max-w-md mx-4 bg-white rounded-2xl shadow-2xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className={`p-3 rounded-xl ${planPreview.isUpgrade ? "bg-green-50" : "bg-amber-50"}`}>
              {planPreview.isUpgrade ? (
                <ArrowRight className="w-6 h-6 text-green-600" />
              ) : (
                <AlertCircle className="w-6 h-6 text-amber-600" />
              )}
            </div>
            <div>
              <h3 className="text-xl font-semibold text-[#0A0A0A]">
                {planPreview.isUpgrade ? "Upgrade" : "Downgrade"} to {confirmingPlan.charAt(0).toUpperCase() + confirmingPlan.slice(1)}
              </h3>
              <p className="text-sm text-[#757575]">
                {planPreview.daysRemaining} days remaining in current period
              </p>
            </div>
          </div>

          <div className="space-y-4 mb-6">
            <div className="p-4 rounded-xl bg-[#FAFAFA] border border-[#EBEBEB]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[#757575]">Current Plan</span>
                <span className="text-[#0A0A0A] font-medium capitalize">
                  {planPreview.currentPlan} ({formatPrice(planPreview.currentPlanPrice)}/mo)
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#757575]">New Plan</span>
                <span className="text-[#0A0A0A] font-medium capitalize">
                  {planPreview.newPlan} ({formatPrice(planPreview.newPlanPrice)}/mo)
                </span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#FAFAFA] border border-[#EBEBEB]">
              {planPreview.isUpgrade ? (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[#757575]">Prorated charge today</span>
                    <span className="text-[#0A0A0A] font-medium">
                      {formatPriceCents(planPreview.immediateCharge)}
                    </span>
                  </div>
                  {planPreview.creditAdjustment > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-[#757575]">Bonus credits</span>
                      <span className="text-green-600 font-medium">
                        +{planPreview.creditAdjustment} credits
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[#757575]">Credit to account</span>
                    <span className="text-green-600 font-medium">
                      {formatPriceCents(planPreview.creditBalance)}
                    </span>
                  </div>
                  <p className="text-xs text-[#757575] mt-2">
                    Credit will be applied to your next invoice. Changes take effect immediately.
                  </p>
                </>
              )}
            </div>

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
              className="flex-1 py-3 rounded-xl font-medium bg-[#F5F5F5] hover:bg-[#EBEBEB] text-[#4D4D4D] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmPlanChange}
              disabled={changePlan.isPending}
              className={`flex-1 py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 ${
                planPreview.isUpgrade
                  ? "bg-[#0A0A0A] hover:bg-[#0A0A0A]/90 text-white"
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
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      
      <div className="relative w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between p-6 pb-4 bg-white">
          <h2 className="text-2xl font-semibold text-[#0A0A0A] tracking-tight">
            Manage your subscription
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-[#F5F5F5] transition-colors"
          >
            <X className="w-5 h-5 text-[#757575]" />
          </button>
        </div>

        {/* Billing Interval Toggle */}
        <div className="flex justify-center px-6 pb-6">
          <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-[#F5F5F5]">
            <button
              onClick={() => setBillingInterval("monthly")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                billingInterval === "monthly"
                  ? "bg-[#0A0A0A] text-white shadow-sm"
                  : "text-[#757575] hover:text-[#4D4D4D]"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingInterval("annual")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
                billingInterval === "annual"
                  ? "bg-[#0A0A0A] text-white shadow-sm"
                  : "text-[#757575] hover:text-[#4D4D4D]"
              }`}
            >
              Annually
              <span className={`text-xs ${billingInterval === "annual" ? "text-white/70" : "text-green-600"}`}>
                · Save 17%
              </span>
            </button>
          </div>
        </div>

        {/* Plan Cards */}
        <div className="px-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans?.subscriptions.map((plan) => {
            const isCurrentPlan = currentPlan === plan.id;
            const isLoading = loadingPlan === plan.id;
            const currentOrder = getPlanOrder(currentPlan);
            const planOrder = getPlanOrder(plan.id);
            const isUpgrade = planOrder > currentOrder;
            const isDowngrade = planOrder < currentOrder;

            const displayPrice = billingInterval === "annual" 
              ? getMonthlyEquivalent(plan.priceInCents)
              : plan.priceInCents;

            return (
              <div
                key={plan.id}
                className={`relative rounded-xl border p-6 transition-all ${
                  isCurrentPlan
                    ? "border-[#0A0A0A] ring-1 ring-[#0A0A0A]"
                    : "border-[#D4D4D4]"
                }`}
              >
                {/* Price */}
                <div className="mb-1">
                  <span className="text-3xl font-bold text-[#0A0A0A]">{formatPrice(displayPrice)}</span>
                  <span className="text-[#757575] text-sm ml-1">/ month</span>
                </div>

                {/* Description */}
                <p className="text-sm text-[#757575] mb-4">{plan.description}</p>

                {/* Action Button */}
                <button
                  onClick={() => handleSubscribe(plan.id as any)}
                  disabled={isCurrentPlan || isLoading}
                  className={`w-full py-2.5 rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-2 mb-5 ${
                    isCurrentPlan
                      ? "bg-[#F5F5F5] text-[#757575] cursor-not-allowed"
                      : isUpgrade
                      ? "bg-[#0A0A0A] hover:bg-[#0A0A0A]/90 text-white"
                      : "bg-white border border-[#D4D4D4] text-[#0A0A0A] hover:bg-[#F5F5F5]"
                  }`}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Processing...
                    </>
                  ) : isCurrentPlan ? (
                    "Current Plan"
                  ) : isUpgrade ? (
                    "Upgrade"
                  ) : (
                    "Downgrade"
                  )}
                </button>

                {/* Credits highlight */}
                <div className="flex items-center gap-2 mb-3 pb-3 border-b border-[#EBEBEB]">
                  <Sparkles className="w-4 h-4 text-[#757575]" />
                  <span className="text-sm font-medium text-[#0A0A0A]">
                    {plan.credits.toLocaleString()} credits / month
                  </span>
                </div>

                {/* Features */}
                <ul className="space-y-2">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Check className="w-4 h-4 text-[#0A0A0A] mt-0.5 flex-shrink-0" />
                      <span className="text-[#4D4D4D]">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        {/* Expand Credit Limit Section */}
        <div className="mx-6 mt-6 flex items-center justify-between p-4 rounded-xl border border-[#D4D4D4] bg-[#FAFAFA]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-white border border-[#EBEBEB]">
              <Sparkles className="w-5 h-5 text-[#0A0A0A]" />
            </div>
            <div>
              <p className="text-sm font-medium text-[#0A0A0A]">Expand credit limit</p>
              <p className="text-xs text-[#757575]">Upgrade your monthly credits</p>
            </div>
          </div>
          <button
            onClick={() => {
              onClose();
              onOpenTopup?.();
            }}
            className="px-4 py-2 rounded-lg border border-[#D4D4D4] bg-white text-[#0A0A0A] text-sm font-medium hover:bg-[#F5F5F5] transition-colors"
          >
            Add credits
          </button>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-5 mt-4 border-t border-[#EBEBEB]">
          <p className="text-sm text-[#757575]">
            Questions? Contact us at support@formastudio.app
          </p>
          <div className="flex items-center gap-4">
            {currentPlan !== "free" && status?.hasSubscription && (
              <button
                onClick={() => handleSubscribe("starter")}
                className="text-sm text-[#757575] hover:text-[#0A0A0A] underline transition-colors"
              >
                Downgrade to Free
              </button>
            )}
            {status?.canManage && (
              <button
                onClick={handleEditBilling}
                className="text-sm text-[#757575] hover:text-[#0A0A0A] transition-colors flex items-center gap-1"
              >
                Edit billing <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
