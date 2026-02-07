/**
 * FlaggedDiscrepanciesCard — surfaces users with credit discrepancies
 * above a configurable threshold on the moderator dashboard overview.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Users,
  Settings2,
} from "lucide-react";
import { useState, useMemo } from "react";

interface FlaggedDiscrepanciesCardProps {
  onSelectUser: (userId: number) => void;
  autoRefreshInterval?: number | false;
}

const DEFAULT_THRESHOLD = 50;
const THRESHOLDS = [10, 25, 50, 100, 250, 500];

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

  const hasCritical = flaggedUsers.some((u) => Math.abs(u.discrepancy) >= 500);
  const hasWarning = flaggedCount > 0;

  return (
    <Card
      className={`border ${
        hasCritical
          ? "bg-red-500/10 border-red-500/30"
          : hasWarning
          ? "bg-amber-500/10 border-amber-500/30"
          : "bg-white/5 border-white/10"
      }`}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle
              className={`w-4 h-4 ${
                hasCritical
                  ? "text-red-400"
                  : hasWarning
                  ? "text-amber-400"
                  : "text-white/40"
              }`}
            />
            <CardTitle className="text-sm font-medium text-white/80">
              Credit Discrepancies
            </CardTitle>
            {flaggedQuery.isLoading ? (
              <Skeleton className="h-5 w-8 bg-white/10" />
            ) : (
              <Badge
                variant="outline"
                className={`text-xs ${
                  hasCritical
                    ? "border-red-500/40 text-red-400"
                    : hasWarning
                    ? "border-amber-500/40 text-amber-400"
                    : "border-white/20 text-white/50"
                }`}
              >
                {flaggedCount}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-white/40 hover:text-white"
              onClick={() => setShowSettings(!showSettings)}
            >
              <Settings2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Threshold selector */}
        {showSettings && (
          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-white/10">
            <span className="text-xs text-white/40">Threshold:</span>
            {THRESHOLDS.map((t) => (
              <button
                key={t}
                onClick={() => setThreshold(t)}
                className={`text-xs px-2 py-0.5 rounded ${
                  threshold === t
                    ? "bg-white/20 text-white"
                    : "bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60"
                }`}
              >
                {t}+
              </button>
            ))}
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-2">
        {flaggedQuery.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full bg-white/10" />
            <Skeleton className="h-10 w-full bg-white/10" />
          </div>
        ) : flaggedCount === 0 ? (
          <div className="flex items-center gap-2 py-3 text-white/40">
            <Users className="w-4 h-4" />
            <span className="text-xs">
              No discrepancies above {threshold} credits across {scannedCount} users
            </span>
          </div>
        ) : (
          <>
            <p className="text-xs text-white/40">
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
                className="w-full h-7 text-xs text-white/40 hover:text-white"
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? (
                  <>
                    <ChevronUp className="w-3 h-3 mr-1" />
                    Show less
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3 h-3 mr-1" />
                    Show all {flaggedCount} users
                  </>
                )}
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
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
    absDisc >= 500 ? "critical" : absDisc >= 100 ? "warning" : "info";

  return (
    <button
      onClick={onSelect}
      className="w-full flex items-center gap-3 px-3 py-2 rounded-md bg-white/5 hover:bg-white/10 transition-colors text-left group"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-white truncate">
            {user.userName || `User #${user.userId}`}
          </span>
          <Badge
            variant="outline"
            className={`text-[10px] px-1.5 py-0 ${
              severity === "critical"
                ? "border-red-500/40 text-red-400"
                : severity === "warning"
                ? "border-amber-500/40 text-amber-400"
                : "border-blue-500/40 text-blue-400"
            }`}
          >
            {user.discrepancy > 0 ? "+" : ""}
            {user.discrepancy}
          </Badge>
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          <span className="text-[10px] text-white/30">
            Net: {user.netCost} | Completed: {user.completedCost}
          </span>
          {user.failedGenerations > 0 && (
            <span className="text-[10px] text-amber-400/60">
              {user.failedGenerations} failed
            </span>
          )}
        </div>
      </div>
      <ArrowRight className="w-3.5 h-3.5 text-white/20 group-hover:text-white/60 transition-colors shrink-0" />
    </button>
  );
}
