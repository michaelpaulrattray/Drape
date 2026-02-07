/**
 * Tab navigation bar for the Moderator Dashboard.
 */
import { Activity, Users, Globe, FileText, Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export type ModeratorTab = "audit-logs" | "users" | "blocked-ips" | "flagged-referrals" | "my-requests";

interface TabNavigationProps {
  activeTab: ModeratorTab;
  setActiveTab: (tab: ModeratorTab) => void;
  blockedIpCount?: number;
  flaggedReferralCount?: number;
  pendingRequestCount?: number;
}

export function TabNavigation({
  activeTab,
  setActiveTab,
  blockedIpCount,
  flaggedReferralCount,
  pendingRequestCount,
}: TabNavigationProps) {
  return (
    <div className="flex gap-2 border-b border-white/10 pb-2">
      <Button
        variant={activeTab === "audit-logs" ? "default" : "ghost"}
        size="sm"
        onClick={() => setActiveTab("audit-logs")}
        className={activeTab === "audit-logs" ? "bg-blue-600 hover:bg-blue-700" : "text-white/60 hover:text-white"}
      >
        <Activity className="w-4 h-4 mr-2" />
        Audit Logs
      </Button>
      <Button
        variant={activeTab === "users" ? "default" : "ghost"}
        size="sm"
        onClick={() => setActiveTab("users")}
        className={activeTab === "users" ? "bg-blue-600 hover:bg-blue-700" : "text-white/60 hover:text-white"}
      >
        <Users className="w-4 h-4 mr-2" />
        User Investigation
      </Button>
      <Button
        variant={activeTab === "blocked-ips" ? "default" : "ghost"}
        size="sm"
        onClick={() => setActiveTab("blocked-ips")}
        className={activeTab === "blocked-ips" ? "bg-blue-600 hover:bg-blue-700" : "text-white/60 hover:text-white"}
      >
        <Globe className="w-4 h-4 mr-2" />
        Blocked IPs
        {blockedIpCount ? (
          <Badge className="ml-2 bg-red-500/20 text-red-400">{blockedIpCount}</Badge>
        ) : null}
      </Button>
      <Button
        variant={activeTab === "flagged-referrals" ? "default" : "ghost"}
        size="sm"
        onClick={() => setActiveTab("flagged-referrals")}
        className={activeTab === "flagged-referrals" ? "bg-amber-600 hover:bg-amber-700" : "text-white/60 hover:text-white"}
      >
        <Flag className="w-4 h-4 mr-2" />
        Flagged Referrals
        {flaggedReferralCount ? (
          <Badge className="ml-2 bg-amber-500/20 text-amber-400">{flaggedReferralCount}</Badge>
        ) : null}
      </Button>
      <Button
        variant={activeTab === "my-requests" ? "default" : "ghost"}
        size="sm"
        onClick={() => setActiveTab("my-requests")}
        className={activeTab === "my-requests" ? "bg-amber-600 hover:bg-amber-700" : "text-white/60 hover:text-white"}
      >
        <FileText className="w-4 h-4 mr-2" />
        My Requests
        {pendingRequestCount ? (
          <Badge className="ml-2 bg-amber-500/20 text-amber-400">{pendingRequestCount}</Badge>
        ) : null}
      </Button>
    </div>
  );
}
