import { AlertTriangle, ShieldAlert } from "lucide-react";

interface AccountFrozenBannerProps {
  frozenAt: Date | string;
  frozenReason?: string | null;
}

/**
 * Prominent banner shown to frozen users across the dashboard.
 * Explains that their account is under review and what's restricted.
 */
export function AccountFrozenBanner({ frozenAt, frozenReason }: AccountFrozenBannerProps) {
  const frozenDate = new Date(frozenAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="mx-auto mb-4 w-full max-w-5xl">
      <div className="rounded-lg border border-amber-500/40 bg-amber-950/30 p-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex-shrink-0 rounded-full bg-amber-500/20 p-2">
            <ShieldAlert className="h-5 w-5 text-amber-400" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-amber-300">
              Account Under Review
            </h3>
            <p className="mt-1 text-sm text-amber-200/80">
              Your account has been temporarily restricted while we verify your billing records.
              During this review, <strong>generations and purchases are paused</strong>.
              You can still browse your dashboard, view your history, and access your existing content.
            </p>
            <p className="mt-2 text-sm text-amber-200/80">
              This process usually resolves within <strong>24–48 hours</strong>.
              If you believe this is an error, please contact support.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-amber-400/70">
              <span className="flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Restricted since {frozenDate}
              </span>
              {frozenReason && (
                <span className="truncate" title={frozenReason}>
                  Reason: {frozenReason}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
