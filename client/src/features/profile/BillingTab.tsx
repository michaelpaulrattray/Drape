import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Sparkles,
  ChevronRight,
  Loader2,
  Download,
  ExternalLink,
  RefreshCw,
} from "lucide-react";

interface BillingTabProps {
  planTier: string;
  creditsBalance: number;
  onOpenBilling?: () => void;
  onOpenTopup?: () => void;
  onClose: () => void;
}

export function BillingTab({
  planTier,
  creditsBalance,
  onOpenBilling,
  onOpenTopup,
  onClose,
}: BillingTabProps) {
  const [showAllInvoices, setShowAllInvoices] = useState(false);
  
  // Fetch subscription details
  const { data: subscriptionDetails } = trpc.billing.getSubscriptionDetails.useQuery();
  
  // Fetch recent invoices
  const { data: invoicesData, isLoading: isLoadingInvoices } = trpc.billing.getInvoices.useQuery(
    { limit: 5 },
    { enabled: !showAllInvoices }
  );
  
  // Fetch all invoices when expanded
  const { data: allInvoicesData, isLoading: isLoadingAllInvoices } = trpc.billing.getAllInvoices.useQuery(
    undefined,
    { enabled: showAllInvoices }
  );

  // Fetch billing status for credits breakdown
  const { data: billingStatus } = trpc.billing.getStatus.useQuery();

  const invoices = showAllInvoices ? allInvoicesData?.invoices : invoicesData?.invoices;
  const hasMoreInvoices = showAllInvoices ? allInvoicesData?.hasMore : invoicesData?.hasMore;

  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const formatAmount = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const { data: plans } = trpc.billing.getPlans.useQuery();

  const getPlanLabel = (tier: string) => {
    const tierData = plans?.tiers?.[tier as keyof typeof plans.tiers];
    if (tierData && tier !== "free") return `Drape ${tierData.name}`;
    return "Free Plan";
  };

  // Get plan monthly credits allocation
  const getPlanCredits = (tier: string) => {
    const tierData = plans?.tiers?.[tier as keyof typeof plans.tiers];
    return tierData?.monthlyCredits || 100;
  };

  const monthlyAllocation = getPlanCredits(planTier);
  const rolloverCredits = billingStatus?.rolloverCredits || 0;
  const monthlyCredits = planTier !== "free" ? (billingStatus?.creditsPurchased || 0) : 0;

  return (
    <div className="space-y-6">
      {/* Current Plan Card */}
      <div className="rounded-xl border border-[#D4D4D4] overflow-hidden">
        {/* Plan Header */}
        <div className="p-5 bg-[#FAFAFA]">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-base font-semibold text-[#0A0A0A]">{getPlanLabel(planTier)}</h3>
              {subscriptionDetails?.renewalDate && (
                <p className="text-sm text-[#757575] mt-0.5">
                  Renewal date {formatDate(subscriptionDetails.renewalDate)}
                </p>
              )}
              {subscriptionDetails?.cancelAtPeriodEnd && (
                <p className="text-sm text-amber-600 mt-0.5">
                  Cancels at end of billing period
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  onOpenBilling?.();
                }}
                className="px-4 py-1.5 rounded-lg bg-white border border-[#D4D4D4] text-[#0A0A0A] text-sm font-medium hover:bg-[#F5F5F5] transition-colors"
              >
                Manage
              </button>
              <button
                onClick={() => {
                  onOpenTopup?.();
                }}
                className="px-4 py-1.5 rounded-lg border border-[#0A0A0A] text-[#0A0A0A] text-sm font-medium hover:bg-[#0A0A0A] hover:text-white transition-colors"
              >
                Add credits
              </button>
            </div>
          </div>
        </div>

        {/* Credits Breakdown */}
        <div className="px-5 py-4 space-y-3">
          {/* Total Credits */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#757575]" />
              <span className="text-sm font-medium text-[#0A0A0A]">Credits</span>
            </div>
            <span className="text-base font-semibold text-[#0A0A0A]">{creditsBalance.toLocaleString()}</span>
          </div>

          {/* Sub-items */}
          {planTier === "free" ? (
            <div className="flex items-center justify-between text-sm pl-6">
              <span className="text-[#757575]">Free credits</span>
              <span className="text-[#4D4D4D]">{creditsBalance.toLocaleString()}</span>
            </div>
          ) : (
            <>
              {rolloverCredits > 0 && (
                <div className="flex items-center justify-between text-sm pl-6">
                  <span className="text-[#757575]">Rollover credits</span>
                  <span className="text-[#4D4D4D]">{rolloverCredits.toLocaleString()}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-sm pl-6">
                <span className="text-[#757575]">Monthly credits</span>
                <span className="text-[#4D4D4D]">
                  {(monthlyCredits - rolloverCredits).toLocaleString()} / {monthlyAllocation.toLocaleString()}
                </span>
              </div>
            </>
          )}

          {/* Monthly Credit Refresh */}
          {planTier !== "free" && (
            <div className="flex items-center justify-between pt-3 border-t border-[#EBEBEB]">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-[#757575]" />
                <span className="text-sm font-medium text-[#0A0A0A]">Monthly credit refresh</span>
              </div>
              <span className="text-base font-semibold text-[#0A0A0A]">{monthlyAllocation.toLocaleString()}</span>
            </div>
          )}
          {planTier !== "free" && subscriptionDetails?.renewalDate && (
            <p className="text-xs text-[#757575] pl-6">
              Refreshes on {formatDate(subscriptionDetails.renewalDate)}
            </p>
          )}
        </div>
      </div>

      {/* Recent Activity / Invoices */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="text-sm font-medium text-[#757575]">Recent activity</label>
          {(hasMoreInvoices || showAllInvoices) && (
            <button
              onClick={() => setShowAllInvoices(!showAllInvoices)}
              className="text-sm text-[#757575] hover:text-[#0A0A0A] transition-colors flex items-center gap-1"
            >
              {showAllInvoices ? "Show less" : "View all invoices"}
              <ChevronRight className={`w-4 h-4 transition-transform ${showAllInvoices ? "rotate-90" : ""}`} />
            </button>
          )}
        </div>

        {(isLoadingInvoices || isLoadingAllInvoices) ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : invoices && invoices.length > 0 ? (
          <div className="rounded-xl border border-gray-200 overflow-hidden">
            {/* Table Header */}
            <div className="grid grid-cols-3 gap-4 px-4 py-3 bg-gray-50 border-b border-gray-200">
              <span className="text-xs font-medium text-gray-500 uppercase">Date</span>
              <span className="text-xs font-medium text-gray-500 uppercase">Amount</span>
              <span className="text-xs font-medium text-gray-500 uppercase text-right"></span>
            </div>
            
            {/* Invoice Rows */}
            {invoices.map((invoice) => (
              <div
                key={invoice.id}
                className="grid grid-cols-3 gap-4 px-4 py-3 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors bg-white"
              >
                <span className="text-sm text-gray-900">{formatDate(invoice.date)}</span>
                <span className="text-sm text-gray-900">{formatAmount(invoice.amount)}</span>
                <div className="flex justify-end">
                  {invoice.pdfUrl ? (
                    <a
                      href={invoice.pdfUrl}
                      download={`invoice-${invoice.id}.pdf`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-gray-600 hover:text-gray-900 transition-colors flex items-center gap-1"
                    >
                      Download
                      <Download className="w-3.5 h-3.5" />
                    </a>
                  ) : invoice.hostedUrl ? (
                    <a
                      href={invoice.hostedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-gray-600 hover:text-gray-900 transition-colors flex items-center gap-1"
                    >
                      View
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  ) : (
                    <span className="text-sm text-gray-400">—</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500 text-sm">
            No invoices yet
          </div>
        )}
      </div>
    </div>
  );
}
