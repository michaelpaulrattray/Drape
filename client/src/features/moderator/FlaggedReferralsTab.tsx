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
  pending: "bg-amber-50 text-amber-700",
  signed_up: "bg-blue-50 text-blue-700",
  completed: "bg-emerald-50 text-emerald-700",
  subscribed: "bg-green-50 text-green-700",
  expired: "bg-gray-100 text-gray-600",
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
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[#0A0A0A]" />
      </div>
    );
  }

  if (!data?.items.length) {
    return (
      <div className="text-center py-16 text-[#999]">
        <Flag className="w-12 h-12 mx-auto mb-3 opacity-40" />
        <p className="text-lg font-medium text-[#666]">No flagged referrals</p>
        <p className="text-sm mt-1">No same-IP referrals detected yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-600" />
          <h3 className="text-lg font-semibold text-[#0A0A0A]">
            Flagged Referrals
          </h3>
          <Badge className="bg-amber-50 text-amber-700">{data.total}</Badge>
        </div>
        <p className="text-sm text-[#999]">
          Referrals where referee IP matched referrer IP within 24 hours
        </p>
      </div>

      <div className="rounded-xl border border-[#E5E5E5] overflow-hidden bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#E5E5E5] bg-[#FAFAFA]">
              <th className="text-left px-4 py-3 text-[#999] font-medium text-xs">Referrer</th>
              <th className="text-left px-4 py-3 text-[#999] font-medium text-xs">Referee</th>
              <th className="text-left px-4 py-3 text-[#999] font-medium text-xs">IPs</th>
              <th className="text-left px-4 py-3 text-[#999] font-medium text-xs">Status</th>
              <th className="text-left px-4 py-3 text-[#999] font-medium text-xs">Credits</th>
              <th className="text-left px-4 py-3 text-[#999] font-medium text-xs">Date</th>
              <th className="text-right px-4 py-3 text-[#999] font-medium text-xs">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item) => (
              <tr key={item.id} className="border-b border-[#F0F0F0] hover:bg-[#FAFAFA] transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-[#CCC]" />
                    <div>
                      <p className="text-[#0A0A0A] font-medium">{item.referrerName || "Unknown"}</p>
                      <p className="text-[#999] text-xs">ID: {item.referrerUserId}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-[#CCC]" />
                    <div>
                      <p className="text-[#0A0A0A] font-medium">
                        {item.referredName || item.referredEmail || "Not signed up"}
                      </p>
                      {item.referredUserId && (
                        <p className="text-[#999] text-xs">ID: {item.referredUserId}</p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <Globe className="w-3 h-3 text-red-500" />
                      <span className="text-[#666] text-xs font-mono">{item.referrerIp || "—"}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Globe className="w-3 h-3 text-red-500" />
                      <span className="text-[#666] text-xs font-mono">{item.referredIp || "—"}</span>
                    </div>
                    {item.referrerIp && item.referredIp && item.referrerIp === item.referredIp && (
                      <Badge className="bg-red-50 text-red-700 text-[10px]">Exact match</Badge>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Badge className={STATUS_COLORS[item.status] || "bg-gray-100 text-gray-600"}>
                    {item.status}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="text-[#666] text-xs space-y-0.5">
                    <p>Referrer: {item.referrerCredited ? `✓ ${item.creditsAwarded}` : "—"}</p>
                    <p>Referee: {item.referredCredited ? `✓ ${item.creditsAwarded}` : "—"}</p>
                  </div>
                </td>
                <td className="px-4 py-3 text-[#999] text-xs">
                  {formatDate(item.createdAt)}
                </td>
                <td className="px-4 py-3 text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-amber-700 hover:text-amber-800 hover:bg-amber-50"
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
          <p className="text-sm text-[#999]">
            Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, data.total)} of {data.total}
          </p>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
              className="text-[#666]"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={page >= totalPages - 1}
              onClick={() => setPage(page + 1)}
              className="text-[#666]"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
