/**
 * GovernanceCard — pending change requests, urgent items, and referral activity.
 */
import {
  ClipboardList,
  AlertCircle,
  Gift,
  ArrowRight,
} from "lucide-react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";

interface GovernanceData {
  pendingChangeRequests: number;
  urgentChangeRequests: number;
  changeRequestsThisWeek: number;
  activeReferrals: number;
}

export function GovernanceCard({ data }: { data: GovernanceData }) {
  return (
    <div className="bg-white rounded-xl border border-[#E5E5E5] p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-[#0A0A0A] uppercase tracking-wider">
          Governance
        </h3>
        <ClipboardList className="w-4 h-4 text-[#757575]" />
      </div>

      {/* Pending change requests */}
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-semibold tabular-nums text-[#0A0A0A]">
              {data.pendingChangeRequests}
            </span>
            {data.urgentChangeRequests > 0 && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0.5">
                {data.urgentChangeRequests} urgent
              </Badge>
            )}
          </div>
          <Link href="/admin/change-requests">
            <button className="flex items-center gap-1 text-xs text-[#757575] hover:text-[#0A0A0A] transition-colors">
              View all
              <ArrowRight className="w-3 h-3" />
            </button>
          </Link>
        </div>
        <p className="text-xs text-[#757575] mt-0.5">
          Pending change requests
        </p>
      </div>

      {/* This week's activity */}
      <div className="flex items-center gap-4 pt-4 border-t border-[#E5E5E5]">
        <div>
          <span className="text-lg font-semibold tabular-nums text-[#0A0A0A]">
            {data.changeRequestsThisWeek}
          </span>
          <p className="text-xs text-[#757575]">Requests this week</p>
        </div>
        <div className="w-px h-8 bg-[#E5E5E5]" />
        <div>
          <div className="flex items-center gap-1.5">
            <Gift className="w-3.5 h-3.5 text-violet-500" />
            <span className="text-lg font-semibold tabular-nums text-[#0A0A0A]">
              {data.activeReferrals}
            </span>
          </div>
          <p className="text-xs text-[#757575]">Active referrals</p>
        </div>
      </div>
    </div>
  );
}
