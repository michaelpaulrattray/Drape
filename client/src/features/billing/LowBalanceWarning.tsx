import { toast } from "sonner";

// Warning threshold - show warning when balance drops below this
export const LOW_BALANCE_THRESHOLD = 2500; // ~7 generations remaining

/**
 * Show a toast notification for low balance
 * Call this after credit deduction to alert user
 *
 * The persistent BANNER form of this warning was removed 2026-09-26 (#108
 * slice 5). Its only consumer was ever `pages/Dashboard.tsx`, deleted with the
 * legacy `/dashboard` page in `98931f66` (2026-04-04); the toast is the warning
 * the product delivers today, from `useCastingGeneration`, `CastingTakeover`
 * and `DrapeStudio`.
 */
export function showLowBalanceToast(balance: number, onTopUp: () => void) {
  if (balance >= LOW_BALANCE_THRESHOLD) {
    return;
  }

  const isCritical = balance === 0;
  const isVeryLow = balance < 500;

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
