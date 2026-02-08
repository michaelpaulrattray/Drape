import { Link } from "wouter";
import {
  LayoutDashboard,
  RefreshCw,
  Clock,
  Eye,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface ModeratorHeaderProps {
  lastRefresh: Date;
  autoRefresh: boolean;
  onToggleAutoRefresh: () => void;
  onRefresh: () => void;
  isRefetching: boolean;
  onNewChangeRequest: () => void;
}

export function ModeratorHeader({
  lastRefresh,
  autoRefresh,
  onToggleAutoRefresh,
  onRefresh,
  isRefetching,
  onNewChangeRequest,
}: ModeratorHeaderProps) {
  return (
    <header className="border-b border-[#D5D5D5] bg-white/80 backdrop-blur sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
        <div className="flex items-center justify-between">
          {/* Left: Dashboard link + title */}
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm" className="text-[#999] hover:text-[#0A0A0A]">
                <LayoutDashboard className="w-4 h-4 mr-2" />
                Dashboard
              </Button>
            </Link>
            <div className="h-5 w-px bg-[#D5D5D5]" />
            <div className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-[#0A0A0A]" />
              <h1 className="text-lg font-semibold text-[#0A0A0A]">Moderator Dashboard</h1>
              <Badge className="bg-[#F0F0F0] text-[#999] border border-[#E5E5E5] text-[10px]">
                Read-Only
              </Badge>
            </div>
          </div>

          {/* Right: controls + new request */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[#bbb] hidden sm:inline tabular-nums">
              {lastRefresh.toLocaleTimeString()}
            </span>
            <Button
              variant={autoRefresh ? "default" : "outline"}
              size="sm"
              onClick={onToggleAutoRefresh}
              className={
                autoRefresh
                  ? "bg-[#0A0A0A] hover:bg-[#222] text-white text-xs"
                  : "border-[#D5D5D5] text-[#999] text-xs"
              }
            >
              <Clock className="w-3.5 h-3.5 mr-1" />
              {autoRefresh ? "Live" : "Paused"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={isRefetching}
              className="border-[#D5D5D5] text-[#999] text-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefetching ? "animate-spin" : ""}`} />
            </Button>
            <Button
              size="sm"
              onClick={onNewChangeRequest}
              className="bg-[#0A0A0A] hover:bg-[#222] text-white text-xs"
            >
              <FileText className="w-3.5 h-3.5 mr-1" />
              New Request
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
