/**
 * Sticky header for the Moderator Dashboard with navigation, refresh, and change request buttons.
 */
import { Link } from "wouter";
import { RefreshCw, Clock, Eye, Home, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface DashboardHeaderProps {
  lastRefresh: Date;
  autoRefresh: boolean;
  setAutoRefresh: (v: boolean) => void;
  onRefresh: () => void;
  isRefetching: boolean;
  onNewChangeRequest: () => void;
}

export function DashboardHeader({
  lastRefresh,
  autoRefresh,
  setAutoRefresh,
  onRefresh,
  isRefetching,
  onNewChangeRequest,
}: DashboardHeaderProps) {
  return (
    <header className="border-b border-white/10 bg-[#0a0a0a]/95 backdrop-blur sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm" className="text-white/60 hover:text-white">
                <Home className="w-4 h-4 mr-2" />
                Dashboard
              </Button>
            </Link>
            <div className="h-6 w-px bg-white/10" />
            <div className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-blue-400" />
              <h1 className="text-lg font-semibold">Moderator Dashboard</h1>
              <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20 text-xs">
                Read-Only
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-white/40">
              Last updated: {lastRefresh.toLocaleTimeString()}
            </span>
            <Button
              variant={autoRefresh ? "default" : "outline"}
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={autoRefresh ? "bg-blue-600 hover:bg-blue-700" : "border-white/20 text-white"}
            >
              <Clock className="w-4 h-4 mr-2" />
              {autoRefresh ? "Auto-refresh ON" : "Auto-refresh"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={isRefetching}
              className="border-white/20 text-white"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isRefetching ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button
              size="sm"
              onClick={onNewChangeRequest}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              <FileText className="w-4 h-4 mr-2" />
              New Change Request
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
