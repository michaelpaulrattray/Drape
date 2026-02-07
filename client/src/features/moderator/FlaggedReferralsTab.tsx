/**
 * Flagged Referrals Tab — shows referrals with sameIpFlag=true for moderator review.
 */
import { AlertTriangle, Flag, User, Globe, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate, type OpenChangeRequestOptions } from "./moderatorConstants";

const PAGE_SIZE = 20;

interface FlaggedReferral {
  id: number;
  referrerUserId: number;
  referrerName: string | null;
  referrerEmail: string | null;
  referredUserId: number | null;
  referredName: string | null;
  referredEmail: string | null;
  referrerIp: string | null;
  referredIp: string | null;
  status: string;
  creditsAwarded: number;
  referrerCredited: boolean;
  referredCredited: boolean;
  createdAt: Date;
  completedAt: Date | null;
}

interface FlaggedReferralsTabProps {
  data: { items: FlaggedReferral[]; total: number } | undefined;
  isLoading: boolean;
  page: number;
  setPage: (page: number) => void;
  onOpenChangeRequest: (options: OpenChangeRequestOptions) => void;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-400",
  signed_up: "bg-blue-500/10 text-blue-400",
  completed: "bg-green-500/10 text-green-400",
  subscribed: "bg-emerald-500/10 text-emerald-400",
  expired: "bg-zinc-500/10 text-zinc-400",
};

export function FlaggedReferralsTab({
  data,
  isLoading,
  page,
  setPage,
  onOpenChangeRequest,
}: FlaggedReferralsTabProps) {
  const totalPages = Math.ceil((data?.total || 0) / PAGE_SIZE);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-white" />
      </div>
    );
  }

  if (!data?.items.length) {
    return (
      <div className="text-center py-16 text-white/40">
        <Flag className="w-12 h-12 mx-auto mb-3 opacity-40" />
        <p className="text-lg font-medium">No flagged referrals</p>
        <p className="text-sm mt-1">No same-IP referrals detected yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-400" />
          <h3 className="text-lg font-semibold text-white">
            Flagged Referrals
          </h3>
          <Badge className="bg-amber-500/20 text-amber-400">{data.total}</Badge>
        </div>
        <p className="text-sm text-white/40">
          Referrals where referee IP matched referrer IP within 24 hours
        </p>
      </div>

      <div className="rounded-xl border border-white/10 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-white/5">
              <th className="text-left px-4 py-3 text-white/60 font-medium">Referrer</th>
              <th className="text-left px-4 py-3 text-white/60 font-medium">Referee</th>
              <th className="text-left px-4 py-3 text-white/60 font-medium">IPs</th>
              <th className="text-left px-4 py-3 text-white/60 font-medium">Status</th>
              <th className="text-left px-4 py-3 text-white/60 font-medium">Credits</th>
              <th className="text-left px-4 py-3 text-white/60 font-medium">Date</th>
              <th className="text-right px-4 py-3 text-white/60 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item) => (
              <tr key={item.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-white/40" />
                    <div>
                      <p className="text-white font-medium">{item.referrerName || "Unknown"}</p>
                      <p className="text-white/40 text-xs">ID: {item.referrerUserId}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-white/40" />
                    <div>
                      <p className="text-white font-medium">
                        {item.referredName || item.referredEmail || "Not signed up"}
                      </p>
                      {item.referredUserId && (
                        <p className="text-white/40 text-xs">ID: {item.referredUserId}</p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <Globe className="w-3 h-3 text-red-400" />
                      <span className="text-white/70 text-xs font-mono">{item.referrerIp || "—"}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Globe className="w-3 h-3 text-red-400" />
                      <span className="text-white/70 text-xs font-mono">{item.referredIp || "—"}</span>
                    </div>
                    {item.referrerIp && item.referredIp && item.referrerIp === item.referredIp && (
                      <Badge className="bg-red-500/20 text-red-400 text-[10px]">Exact match</Badge>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Badge className={STATUS_COLORS[item.status] || "bg-zinc-500/10 text-zinc-400"}>
                    {item.status}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="text-white/70 text-xs space-y-0.5">
                    <p>Referrer: {item.referrerCredited ? `✓ ${item.creditsAwarded}` : "—"}</p>
                    <p>Referee: {item.referredCredited ? `✓ ${item.creditsAwarded}` : "—"}</p>
                  </div>
                </td>
                <td className="px-4 py-3 text-white/50 text-xs">
                  {formatDate(item.createdAt)}
                </td>
                <td className="px-4 py-3 text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
                    onClick={() =>
                      onOpenChangeRequest({
                        type: "flag_account",
                        targetUserId: String(item.referrerUserId),
                        targetUserName: item.referrerName || undefined,
                        ipAddress: item.referrerIp || undefined,
                      })
                    }
                  >
                    <Flag className="w-3.5 h-3.5 mr-1" />
                    Review
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-white/40">
            Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, data.total)} of {data.total}
          </p>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
              className="text-white/60"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={page >= totalPages - 1}
              onClick={() => setPage(page + 1)}
              className="text-white/60"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
