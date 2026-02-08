/**
 * FlaggedDiscrepanciesCard — surfaces users with credit discrepancies
 * above a configurable threshold on the moderator dashboard overview.
 */
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Users,
  Settings2,
} from "lucide-react";
import { useState, useMemo } from "react";

interface FlaggedDiscrepanciesCardProps {
  onSelectUser: (userId: number) => void;
  autoRefreshInterval?: number | false;
}

const DEFAULT_THRESHOLD = 500;
const THRESHOLDS = [100, 250, 500, 1000, 2000, 5000];

export function FlaggedDiscrepanciesCard({
  onSelectUser,
  autoRefreshInterval = false,
}: FlaggedDiscrepanciesCardProps) {
  const [threshold, setThreshold] = useState(DEFAULT_THRESHOLD);
  const [expanded, setExpanded] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const flaggedQuery = trpc.moderatorReconciliation.getFlaggedUsers.useQuery(
    { threshold },
    { refetchInterval: autoRefreshInterval }
  );

  const flaggedUsers = flaggedQuery.data?.users ?? [];
  const scannedCount = flaggedQuery.data?.scannedCount ?? 0;
  const flaggedCount = flaggedUsers.length;

  const visibleUsers = useMemo(
    () => (expanded ? flaggedUsers : flaggedUsers.slice(0, 5)),
    [expanded, flaggedUsers]
  );

  const hasCritical = flaggedUsers.some((u) => Math.abs(u.discrepancy) >= 2000);
  const hasWarning = flaggedCount > 0;

  return (
    <div
      className={`rounded-xl border overflow-hidden ${
        hasCritical
          ? "bg-red-50 border-red-200"
          : hasWarning
          ? "bg-amber-50 border-amber-200"
          : "bg-white border-[#E5E5E5]"
      }`}
    >
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle
            className={`w-4 h-4 ${
              hasCritical ? "text-red-600" : hasWarning ? "text-amber-600" : "text-[#999]"
            }`}
          />
          <h3 className="text-sm font-semibold text-[#0A0A0A]">Credit Discrepancies</h3>
          {flaggedQuery.isLoading ? (
            <Skeleton className="h-5 w-8 bg-[#E5E5E5]" />
          ) : (
            <Badge
              variant="outline"
              className={`text-xs ${
                hasCritical
                  ? "border-red-300 text-red-700"
                  : hasWarning
                  ? "border-amber-300 text-amber-700"
                  : "border-[#D5D5D5] text-[#999]"
              }`}
            >
              {flaggedCount}
            </Badge>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 text-[#999] hover:text-[#0A0A0A]"
          onClick={() => setShowSettings(!showSettings)}
        >
          <Settings2 className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Threshold selector */}
      {showSettings && (
        <div className="flex items-center gap-2 px-4 pb-3 border-t border-[#E5E5E5] pt-2">
          <span className="text-xs text-[#999]">Threshold:</span>
          {THRESHOLDS.map((t) => (
            <button
              key={t}
              onClick={() => setThreshold(t)}
              className={`text-xs px-2 py-0.5 rounded ${
                threshold === t
                  ? "bg-[#0A0A0A] text-white"
                  : "bg-[#F0F0F0] text-[#999] hover:bg-[#E5E5E5] hover:text-[#666]"
              }`}
            >
              {t}+
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="px-4 pb-4">
        {flaggedQuery.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full bg-[#E5E5E5]" />
            <Skeleton className="h-10 w-full bg-[#E5E5E5]" />
          </div>
        ) : flaggedCount === 0 ? (
          <div className="flex items-center gap-2 py-3 text-[#999]">
            <Users className="w-4 h-4" />
            <span className="text-xs">
              No discrepancies above {threshold} credits across {scannedCount} users
            </span>
          </div>
        ) : (
          <>
            <p className="text-xs text-[#999] mb-2">
              {flaggedCount} user{flaggedCount !== 1 ? "s" : ""} with discrepancy
              {" \u2265 "}{threshold} credits ({scannedCount} scanned)
            </p>

            <div className="space-y-1">
              {visibleUsers.map((user) => (
                <FlaggedUserRow
                  key={user.userId}
                  user={user}
                  onSelect={() => onSelectUser(user.userId)}
                />
              ))}
            </div>

            {flaggedCount > 5 && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full h-7 text-xs text-[#999] hover:text-[#0A0A0A] mt-1"
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? (
                  <><ChevronUp className="w-3 h-3 mr-1" /> Show less</>
                ) : (
                  <><ChevronDown className="w-3 h-3 mr-1" /> Show all {flaggedCount} users</>
                )}
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Row sub-component ──

interface FlaggedUserRowProps {
  user: {
    userId: number;
    userName: string | null;
    email: string | null;
    discrepancy: number;
    netCost: number;
    completedCost: number;
    failedGenerations: number;
    totalGenerations: number;
  };
  onSelect: () => void;
}

function FlaggedUserRow({ user, onSelect }: FlaggedUserRowProps) {
  const absDisc = Math.abs(user.discrepancy);
  const severity =
    absDisc >= 2000 ? "critical" : absDisc >= 1000 ? "warning" : "info";

  return (
    <button
      onClick={onSelect}
      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg bg-white hover:bg-[#FAFAFA] transition-colors text-left group border border-[#E5E5E5]"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-[#0A0A0A] truncate">
            {user.userName || `User #${user.userId}`}
          </span>
          <Badge
            variant="outline"
            className={`text-[10px] px-1.5 py-0 ${
              severity === "critical"
                ? "border-red-300 text-red-700"
                : severity === "warning"
                ? "border-amber-300 text-amber-700"
                : "border-blue-300 text-blue-700"
            }`}
          >
            {user.discrepancy > 0 ? "+" : ""}
            {user.discrepancy}
          </Badge>
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          <span className="text-[10px] text-[#999]">
            Net: {user.netCost} | Completed: {user.completedCost}
          </span>
          {user.failedGenerations > 0 && (
            <span className="text-[10px] text-amber-600">
              {user.failedGenerations} failed
            </span>
          )}
        </div>
      </div>
      <ChevronRight className="w-3.5 h-3.5 text-[#CCC] group-hover:text-[#999] transition-colors shrink-0" />
    </button>
  );
}
