import { useState } from "react";
import { X, Check, Zap, Crown, Building2, Sparkles, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface BillingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BillingModal({ isOpen, onClose }: BillingModalProps) {
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

  const createPortalSession = trpc.billing.createPortalSession.useMutation({
    onSuccess: (data) => {
      window.location.href = data.portalUrl;
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  if (!isOpen) return null;

  const handleSubscribe = (plan: "starter" | "pro" | "studio") => {
    setLoadingPlan(plan);
    createSubscriptionCheckout.mutate({ plan });
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

  const currentPlan = status?.planTier || "free";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between p-6 border-b border-white/10 bg-zinc-900/95 backdrop-blur-sm">
          <div>
            <h2 className="text-2xl font-semibold text-white">Upgrade Your Plan</h2>
            <p className="text-sm text-zinc-400 mt-1">
              Get more credits and unlock premium features
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5 text-zinc-400" />
          </button>
        </div>

        {/* Current Plan Banner */}
        {currentPlan !== "free" && (
          <div className="mx-6 mt-6 p-4 rounded-xl bg-orange-500/10 border border-orange-500/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-500/20">
                  {getPlanIcon(currentPlan)}
                </div>
                <div>
                  <p className="text-sm text-orange-400">Current Plan</p>
                  <p className="text-white font-medium capitalize">{currentPlan}</p>
                </div>
              </div>
              {status?.canManage && (
                <button
                  onClick={handleManageSubscription}
                  className="px-4 py-2 text-sm rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
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

            return (
              <div
                key={plan.id}
                className={`relative rounded-xl border p-6 transition-all ${
                  isPro
                    ? "border-orange-500/50 bg-gradient-to-b from-orange-500/10 to-transparent"
                    : "border-white/10 bg-white/5"
                } ${isCurrentPlan ? "ring-2 ring-orange-500" : ""}`}
              >
                {isPro && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-orange-500 text-xs font-medium text-white">
                    Most Popular
                  </div>
                )}

                <div className="flex items-center gap-2 mb-4">
                  <div className={`p-2 rounded-lg ${isPro ? "bg-orange-500/20 text-orange-400" : "bg-white/10 text-zinc-400"}`}>
                    {getPlanIcon(plan.id)}
                  </div>
                  <h3 className="text-lg font-semibold text-white">{plan.name.replace("FormaStudio ", "")}</h3>
                </div>

                <div className="mb-4">
                  <span className="text-3xl font-bold text-white">{formatPrice(plan.priceInCents)}</span>
                  <span className="text-zinc-400">/month</span>
                </div>

                <div className="mb-4 p-3 rounded-lg bg-white/5">
                  <p className="text-2xl font-bold text-orange-400">{plan.credits.toLocaleString()}</p>
                  <p className="text-sm text-zinc-400">credits per month</p>
                </div>

                <ul className="space-y-2 mb-6">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Check className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                      <span className="text-zinc-300">{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleSubscribe(plan.id as "starter" | "pro" | "studio")}
                  disabled={isCurrentPlan || isLoading}
                  className={`w-full py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
                    isCurrentPlan
                      ? "bg-white/10 text-zinc-500 cursor-not-allowed"
                      : isPro
                      ? "bg-orange-500 hover:bg-orange-600 text-white"
                      : "bg-white hover:bg-zinc-100 text-zinc-900"
                  }`}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Processing...
                    </>
                  ) : isCurrentPlan ? (
                    "Current Plan"
                  ) : (
                    "Subscribe"
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* Free Tier Info */}
        <div className="mx-6 mb-6 p-4 rounded-xl bg-white/5 border border-white/10">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white font-medium">Free Tier</p>
              <p className="text-sm text-zinc-400">100 credits to get started • No credit card required</p>
            </div>
            {currentPlan === "free" && (
              <span className="px-3 py-1 rounded-full bg-zinc-700 text-zinc-300 text-xs">
                Your Current Plan
              </span>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 text-center text-sm text-zinc-500">
          <p>All plans include access to all generation features. Credits roll over based on your plan tier.</p>
          <p className="mt-1">Questions? Contact us at support@formastudio.app</p>
        </div>
      </div>
    </div>
  );
}
