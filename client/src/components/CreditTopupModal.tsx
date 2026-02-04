import { useState } from "react";
import { X, Coins, Loader2, Sparkles } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface CreditTopupModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentBalance?: number;
}

export function CreditTopupModal({ isOpen, onClose, currentBalance = 0 }: CreditTopupModalProps) {
  const [loadingPackage, setLoadingPackage] = useState<string | null>(null);

  const { data: plans } = trpc.billing.getPlans.useQuery();
  
  const createTopupCheckout = trpc.billing.createTopupCheckout.useMutation({
    onSuccess: (data) => {
      window.location.href = data.checkoutUrl;
    },
    onError: (error) => {
      toast.error(error.message);
      setLoadingPackage(null);
    },
  });

  if (!isOpen) return null;

  const handlePurchase = (packageId: "small" | "medium" | "large" | "xl") => {
    setLoadingPackage(packageId);
    createTopupCheckout.mutate({ packageId });
  };

  const formatPrice = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const getDiscount = (packageId: string) => {
    switch (packageId) {
      case "medium":
        return "10% off";
      case "large":
        return "15% off";
      case "xl":
        return "20% off";
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal - Light Mode */}
      <div className="relative w-full max-w-lg mx-4 bg-white border border-gray-200 rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gray-100">
              <Coins className="w-5 h-5 text-gray-700" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Buy Credits</h2>
              <p className="text-sm text-gray-500">
                Current balance: <span className="text-gray-900 font-medium">{currentBalance.toLocaleString()}</span> credits
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Credit Packages */}
        <div className="p-6 space-y-3">
          {plans?.topups.map((pkg) => {
            const isLoading = loadingPackage === pkg.id;
            const discount = getDiscount(pkg.id);

            return (
              <button
                key={pkg.id}
                onClick={() => handlePurchase(pkg.id as "small" | "medium" | "large" | "xl")}
                disabled={isLoading}
                className="w-full p-4 rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 hover:border-gray-300 transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-4">
                  <div className="p-2 rounded-lg bg-gray-200 group-hover:bg-gray-300 transition-colors">
                    <Sparkles className="w-5 h-5 text-gray-700" />
                  </div>
                  <div className="text-left">
                    <div className="flex items-center gap-2">
                      <p className="text-gray-900 font-medium">{pkg.credits.toLocaleString()} Credits</p>
                      {discount && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-medium">
                          {discount}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">{pkg.description}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin text-gray-600" />
                  ) : (
                    <span className="text-lg font-semibold text-gray-900">{formatPrice(pkg.priceInCents)}</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6">
          <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
            <p className="text-sm text-gray-500 text-center">
              Credits never expire and can be used for any generation feature.
              <br />
              <span className="text-gray-400">1 credit ≈ $0.01 • Larger packages include volume discounts</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
