import { useState, useEffect } from "react";
import { AlertTriangle, X, Coins } from "lucide-react";
import { toast } from "sonner";

// Warning threshold - show warning when balance drops below this
export const LOW_BALANCE_THRESHOLD = 50;

interface LowBalanceWarningProps {
  balance: number;
  onTopUp: () => void;
  variant?: "banner" | "toast";
  dismissible?: boolean;
}

/**
 * Banner component for persistent low balance warning
 */
export function LowBalanceBanner({ 
  balance, 
  onTopUp, 
  dismissible = true 
}: Omit<LowBalanceWarningProps, "variant">) {
  const [isDismissed, setIsDismissed] = useState(false);

  // Reset dismissed state when balance changes significantly
  useEffect(() => {
    if (balance >= LOW_BALANCE_THRESHOLD) {
      setIsDismissed(false);
    }
  }, [balance]);

  if (isDismissed || balance >= LOW_BALANCE_THRESHOLD) {
    return null;
  }

  const isVeryLow = balance < 10;
  const isCritical = balance === 0;

  return (
    <div 
      className={`relative flex items-center justify-between gap-4 px-4 py-3 rounded-xl border ${
        isCritical 
          ? "bg-red-500/10 border-red-500/30 text-red-400"
          : isVeryLow
          ? "bg-amber-500/10 border-amber-500/30 text-amber-500"
          : "bg-amber-500/10 border-amber-500/30 text-amber-400"
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${
          isCritical 
            ? "bg-red-500/20"
            : isVeryLow
            ? "bg-amber-500/20"
            : "bg-amber-500/20"
        }`}>
          <AlertTriangle className="w-4 h-4" />
        </div>
        <div>
          <p className="text-sm font-medium">
            {isCritical 
              ? "You're out of credits!"
              : isVeryLow
              ? "Credits running very low"
              : "Low credit balance"
            }
          </p>
          <p className="text-xs opacity-80">
            {isCritical
              ? "Top up now to continue generating"
              : `Only ${balance} credits remaining`
            }
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onTopUp}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
            isCritical
              ? "bg-red-500 hover:bg-red-600 text-white"
              : isVeryLow
              ? "bg-amber-500 hover:bg-amber-600 text-black"
              : "bg-amber-500 hover:bg-amber-600 text-black"
          }`}
        >
          <Coins className="w-4 h-4" />
          Top Up Now
        </button>
        
        {dismissible && !isCritical && (
          <button
            onClick={() => setIsDismissed(true)}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            aria-label="Dismiss warning"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Show a toast notification for low balance
 * Call this after credit deduction to alert user
 */
export function showLowBalanceToast(balance: number, onTopUp: () => void) {
  if (balance >= LOW_BALANCE_THRESHOLD) {
    return;
  }

  const isCritical = balance === 0;
  const isVeryLow = balance < 10;

  toast.warning(
    isCritical 
      ? "You're out of credits!" 
      : isVeryLow
      ? "Credits running very low"
      : "Low credit balance",
    {
      description: isCritical
        ? "Top up now to continue generating"
        : `Only ${balance} credits remaining`,
      duration: isCritical ? 10000 : 5000,
      action: {
        label: "Top Up",
        onClick: onTopUp,
      },
    }
  );
}

/**
 * Hook to check if balance is low and trigger warnings
 */
export function useLowBalanceCheck(
  balance: number | undefined,
  previousBalance: number | undefined,
  onTopUp: () => void
) {
  useEffect(() => {
    // Only show toast when balance drops below threshold (not on initial load)
    if (
      balance !== undefined &&
      previousBalance !== undefined &&
      previousBalance >= LOW_BALANCE_THRESHOLD &&
      balance < LOW_BALANCE_THRESHOLD
    ) {
      showLowBalanceToast(balance, onTopUp);
    }
  }, [balance, previousBalance, onTopUp]);

  return {
    isLow: balance !== undefined && balance < LOW_BALANCE_THRESHOLD,
    isCritical: balance !== undefined && balance === 0,
    isVeryLow: balance !== undefined && balance < 10,
  };
}
