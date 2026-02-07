import { useState, useMemo } from "react";
import { X, Check, Loader2, ChevronDown, Crown } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface CreditTopupModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentBalance?: number;
}

const ANNUAL_DISCOUNT = 0.17; // 17% savings

export function CreditTopupModal({ isOpen, onClose, currentBalance = 0 }: CreditTopupModalProps) {
  const [isAnnual, setIsAnnual] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedTierKey, setSelectedTierKey] = useState<string | null>(null);
  const [isUpgrading, setIsUpgrading] = useState(false);

  const { data: plans } = trpc.billing.getPlans.useQuery();
  const { data: status } = trpc.billing.getStatus.useQuery();
  const { data: subDetails } = trpc.billing.getSubscriptionDetails.useQuery();

  // Derive tier data
  const currentPlan = status?.planTier || "free";
  const planOrder = plans?.planOrder || [];
  const tiers = plans?.tiers;
  const hasSubscription = status?.hasSubscription ?? false;
  const isFreeUser = currentPlan === "free" || !hasSubscription;

  // Available upgrade options (tiers above current)
  const upgradeOptions = useMemo(() => {
    if (!tiers || !planOrder.length) return [];
    const currentIdx = planOrder.indexOf(currentPlan);
    return planOrder
      .slice(currentIdx + 1)
      .map((key) => {
        const tier = tiers[key as keyof typeof tiers];
        if (!tier) return null;
        const currentTier = tiers[currentPlan as keyof typeof tiers];
        const creditDelta = tier.monthlyCredits - (currentTier?.monthlyCredits || 0);
        return { key, ...tier, creditDelta };
      })
      .filter(Boolean) as Array<{
        key: string; name: string; monthlyCredits: number;
        price: number; rolloverPercent: number; creditDelta: number;
      }>;
  }, [tiers, planOrder, currentPlan]);

  // Default to next tier up
  const effectiveSelectedKey = selectedTierKey || upgradeOptions[0]?.key || null;
  const selectedOption = upgradeOptions.find((o) => o.key === effectiveSelectedKey);

  // Fetch proration preview for existing subscribers
  const { data: prorationPreview } = trpc.billing.previewPlanChange.useQuery(
    { newPlan: effectiveSelectedKey as any },
    { enabled: !isFreeUser && !!effectiveSelectedKey }
  );

  // Price calculations
  const newMonthlyPrice = selectedOption?.price || 0;

  // "Due today" calculation:
  // - Free users monthly: full monthly price of the new tier
  // - Free users annual: full year upfront (monthly × 12 × (1 - discount))
  // - Existing subscribers: prorated immediate charge from Stripe
  const annualFullYear = newMonthlyPrice * 12;
  const annualDiscounted = Math.round(annualFullYear * (1 - ANNUAL_DISCOUNT));

  const getDueToday = () => {
    if (isFreeUser) {
      return isAnnual ? annualDiscounted : newMonthlyPrice;
    }
    // Existing subscriber: use Stripe's prorated amount
    if (prorationPreview) {
      return prorationPreview.immediateCharge;
    }
    return 0;
  };

  const dueToday = getDueToday();

  // Strikethrough: show full year price (without discount) when annual is toggled
  const showStrikethrough = isAnnual && isFreeUser;
  const strikethroughPrice = annualFullYear;

  // New monthly rate going forward (for the bullet point)
  const newMonthlyRate = isAnnual
    ? Math.round(newMonthlyPrice * (1 - ANNUAL_DISCOUNT))
    : newMonthlyPrice;

  // Renewal date
  const renewalDate = subDetails?.renewalDate
    ? new Date(subDetails.renewalDate)
    : null;

  const formatPrice = (cents: number) => {
    const dollars = cents / 100;
    return dollars >= 1000
      ? `$${dollars.toLocaleString("en-US", { maximumFractionDigits: 0 })}`
      : `$${dollars.toFixed(0)}`;
  };

  const formatRenewalDate = (date: Date) =>
    date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  const createCheckout = trpc.billing.createSubscriptionCheckout.useMutation({
    onSuccess: (data) => {
      window.open(data.checkoutUrl, "_blank");
      toast.info("Redirecting to checkout...");
      setIsUpgrading(false);
      onClose();
    },
    onError: (error) => {
      toast.error(error.message);
      setIsUpgrading(false);
    },
  });

  const changePlan = trpc.billing.changePlan.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      setIsUpgrading(false);
      onClose();
    },
    onError: (error) => {
      toast.error(error.message);
      setIsUpgrading(false);
    },
  });

  const handleUpgrade = () => {
    if (!effectiveSelectedKey) return;
    setIsUpgrading(true);

    const planKey = effectiveSelectedKey as any;
    if (isFreeUser) {
      createCheckout.mutate({ plan: planKey, interval: isAnnual ? "annual" : "monthly" });
    } else {
      changePlan.mutate({ newPlan: planKey });
    }
  };

  if (!isOpen) return null;

  const isMaxTier = upgradeOptions.length === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-md mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-[#F5F5F5] transition-colors z-10"
        >
          <X className="w-4 h-4 text-[#757575]" />
        </button>

        {/* Header */}
        <div className="px-6 pt-6 pb-2">
          <div className="mb-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#0A0A0A] to-[#404040] flex items-center justify-center mb-4">
              <Crown className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-semibold text-[#0A0A0A] tracking-tight">
              Add more credits
            </h2>
          </div>
        </div>

        {isMaxTier ? (
          <div className="px-6 pb-6">
            <div className="text-center py-8">
              <p className="text-[#0A0A0A] font-medium">You're on the highest plan</p>
              <p className="text-sm text-[#757575] mt-1">
                You already have the maximum credit allocation.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Billing adjustment card */}
            <div className="mx-6 p-4 rounded-xl border border-[#E0E0E0] bg-[#FAFAFA]">
              {/* Top row: label + annual toggle */}
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-[#757575]">Billing adjustment</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-emerald-600">
                    Annual (Save 17%)
                  </span>
                  <button
                    onClick={() => setIsAnnual(!isAnnual)}
                    className={`relative w-9 h-5 rounded-full transition-colors ${
                      isAnnual ? "bg-[#0A0A0A]" : "bg-[#D4D4D4]"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                        isAnnual ? "translate-x-4" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Price display */}
              <div className="flex items-baseline gap-2 mb-3">
                {showStrikethrough && (
                  <span className="text-lg text-[#BDBDBD] line-through">
                    {formatPrice(strikethroughPrice)}
                  </span>
                )}
                <span className="text-3xl font-bold text-[#0A0A0A]">
                  {formatPrice(dueToday)}
                </span>
                <span className="text-sm text-[#757575]">due today</span>
              </div>

              {/* Tier dropdown */}
              <div className="relative">
                <button
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-lg bg-[#0A0A0A] text-white text-sm font-medium hover:bg-[#1A1A1A] transition-colors"
                >
                  <span>
                    + {selectedOption?.creditDelta.toLocaleString()} monthly credits
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 transition-transform ${isDropdownOpen ? "rotate-180" : ""}`}
                  />
                </button>

                {isDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg border border-[#E0E0E0] shadow-lg z-20 max-h-64 overflow-y-auto">
                    {upgradeOptions.map((option) => (
                      <button
                        key={option.key}
                        onClick={() => {
                          setSelectedTierKey(option.key);
                          setIsDropdownOpen(false);
                        }}
                        className={`w-full text-left px-4 py-3 text-sm hover:bg-[#F5F5F5] transition-colors ${
                          option.key === effectiveSelectedKey
                            ? "bg-[#F5F5F5] font-medium"
                            : ""
                        }`}
                      >
                        <span className="text-[#0A0A0A]">
                          + {option.creditDelta.toLocaleString()} monthly credits
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Bullet points */}
            <div className="px-6 py-4 space-y-3">
              <div className="flex items-start gap-3">
                <Check className="w-4 h-4 text-[#0A0A0A] mt-0.5 shrink-0" />
                <span className="text-sm text-[#424242]">
                  You will receive{" "}
                  <strong>{selectedOption?.creditDelta.toLocaleString()}</strong>{" "}
                  monthly credits immediately
                </span>
              </div>
              <div className="flex items-start gap-3">
                <Check className="w-4 h-4 text-[#0A0A0A] mt-0.5 shrink-0" />
                <span className="text-sm text-[#424242]">
                  Your plan will update to{" "}
                  <strong>{formatPrice(newMonthlyRate)} / month</strong>{" "}
                  for{" "}
                  <strong>{selectedOption?.monthlyCredits.toLocaleString()}</strong>{" "}
                  credits
                </span>
              </div>
              <div className="flex items-start gap-3">
                <Check className="w-4 h-4 text-[#0A0A0A] mt-0.5 shrink-0" />
                <span className="text-sm text-[#424242]">Downgrade anytime</span>
              </div>
            </div>

            {/* Renewal date */}
            {renewalDate && (
              <div className="px-6 pb-2">
                <p className="text-xs text-[#9E9E9E]">
                  Next billing cycle and plan renew{" "}
                  <strong className="text-[#616161]">
                    {formatRenewalDate(renewalDate)}
                  </strong>
                </p>
              </div>
            )}

            {/* Footer buttons */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#EBEBEB]">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-[#424242] hover:text-[#0A0A0A] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUpgrade}
                disabled={isUpgrading || !effectiveSelectedKey}
                className="px-5 py-2 rounded-lg bg-[#0A0A0A] text-white text-sm font-medium hover:bg-[#1A1A1A] transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isUpgrading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  "Upgrade"
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
