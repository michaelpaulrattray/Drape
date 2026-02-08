/**
 * Tab navigation bar for the Moderator Dashboard — clean pill-style tabs.
 */
import { FileSearch, Users, ShieldBan, Flag, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export type ModeratorTab = "audit-logs" | "users" | "blocked-ips" | "flagged-referrals" | "my-requests";

interface TabNavigationProps {
  activeTab: ModeratorTab;
  setActiveTab: (tab: ModeratorTab) => void;
  blockedIpCount?: number;
  flaggedReferralCount?: number;
  pendingRequestCount?: number;
}

const TABS: { id: ModeratorTab; label: string; icon: typeof FileSearch }[] = [
  { id: "audit-logs", label: "Audit Logs", icon: FileSearch },
  { id: "users", label: "User Investigation", icon: Users },
  { id: "blocked-ips", label: "Blocked IPs", icon: ShieldBan },
  { id: "flagged-referrals", label: "Flagged Referrals", icon: Flag },
  { id: "my-requests", label: "My Requests", icon: FileText },
];

export function TabNavigation({
  activeTab,
  setActiveTab,
  blockedIpCount,
  flaggedReferralCount,
  pendingRequestCount,
}: TabNavigationProps) {
  const getBadge = (id: ModeratorTab): number | undefined => {
    if (id === "blocked-ips") return blockedIpCount;
    if (id === "flagged-referrals") return flaggedReferralCount;
    if (id === "my-requests") return pendingRequestCount;
    return undefined;
  };

  return (
    <div className="bg-white rounded-xl border border-[#E5E5E5] p-1.5 flex gap-1 overflow-x-auto">
      {TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        const badge = getBadge(tab.id);
        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              isActive
                ? "bg-[#0A0A0A] text-white"
                : "text-[#999] hover:text-[#0A0A0A] hover:bg-[#F5F5F5]"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {badge !== undefined && badge > 0 && (
              <Badge className={`text-[10px] px-1.5 py-0 h-4 ${
                isActive
                  ? "bg-white/20 text-white"
                  : "bg-[#F0F0F0] text-[#666]"
              }`}>
                {badge}
              </Badge>
            )}
          </button>
        );
      })}
    </div>
  );
}
