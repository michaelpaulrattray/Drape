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
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-lg mx-4 bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-500/20">
              <Coins className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">Buy Credits</h2>
              <p className="text-sm text-zinc-400">
                Current balance: <span className="text-orange-400 font-medium">{currentBalance.toLocaleString()}</span> credits
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5 text-zinc-400" />
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
                className="w-full p-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-orange-500/30 transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-4">
                  <div className="p-2 rounded-lg bg-orange-500/10 group-hover:bg-orange-500/20 transition-colors">
                    <Sparkles className="w-5 h-5 text-orange-400" />
                  </div>
                  <div className="text-left">
                    <div className="flex items-center gap-2">
                      <p className="text-white font-medium">{pkg.credits.toLocaleString()} Credits</p>
                      {discount && (
                        <span className="px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 text-xs font-medium">
                          {discount}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-zinc-400">{pkg.description}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin text-orange-400" />
                  ) : (
                    <span className="text-lg font-semibold text-white">{formatPrice(pkg.priceInCents)}</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6">
          <div className="p-4 rounded-xl bg-white/5 border border-white/10">
            <p className="text-sm text-zinc-400 text-center">
              Credits never expire and can be used for any generation feature.
              <br />
              <span className="text-zinc-500">1 credit ≈ $0.01 • Larger packages include volume discounts</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
