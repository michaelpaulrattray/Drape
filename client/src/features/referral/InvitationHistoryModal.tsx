import { trpc } from "@/lib/trpc";
import { X, Clock, Check, UserPlus, AlertTriangle } from "lucide-react";

interface InvitationHistoryModalProps {
  open: boolean;
  onClose: () => void;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; icon: React.ReactNode; color: string }
> = {
  pending: {
    label: "Pending",
    icon: <Clock className="w-3.5 h-3.5" />,
    color: "text-amber-600 bg-amber-50",
  },
  signed_up: {
    label: "Signed up",
    icon: <UserPlus className="w-3.5 h-3.5" />,
    color: "text-blue-600 bg-blue-50",
  },
  completed: {
    label: "Completed",
    icon: <Check className="w-3.5 h-3.5" />,
    color: "text-emerald-600 bg-emerald-50",
  },
  expired: {
    label: "Expired",
    icon: <AlertTriangle className="w-3.5 h-3.5" />,
    color: "text-muted-foreground bg-muted",
  },
};

export function InvitationHistoryModal({
  open,
  onClose,
}: InvitationHistoryModalProps) {
  const { data: history, isLoading } = trpc.referral.getHistory.useQuery(
    undefined,
    { enabled: open }
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 bg-card text-card-foreground rounded-2xl shadow-2xl border border-border overflow-hidden">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-muted transition-colors z-10"
        >
          <X className="w-4 h-4 text-muted-foreground" />
        </button>

        {/* Header */}
        <div className="px-6 pt-6 pb-4">
          <h3 className="text-lg font-semibold tracking-tight">
            Invitation history
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Track the status of your referral invitations.
          </p>
        </div>

        {/* List */}
        <div className="px-6 pb-6 max-h-80 overflow-y-auto">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-14 bg-muted animate-pulse rounded-lg"
                />
              ))}
            </div>
          ) : !history || history.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                <UserPlus className="w-5 h-5 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                No invitations yet. Share your link to get started!
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {history.map((item) => {
                const config = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
                const displayName =
                  item.referredName || item.referredEmail || "Invited user";
                const date = new Date(item.createdAt).toLocaleDateString(
                  undefined,
                  { month: "short", day: "numeric", year: "numeric" }
                );

                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/20 hover:bg-muted/40 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">
                        {displayName}
                      </div>
                      <div className="text-xs text-muted-foreground">{date}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      {item.creditsAwarded > 0 && (
                        <span className="text-xs font-medium text-emerald-600">
                          +{item.creditsAwarded}
                        </span>
                      )}
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.color}`}
                      >
                        {config.icon}
                        {config.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
