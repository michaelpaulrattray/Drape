import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Redirect, Link } from "wouter";
import { useState, useEffect, useCallback } from "react";
import {
  LayoutDashboard,
  RefreshCw,
  Clock,
  Shield,
  Users,
  ClipboardList,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  HealthMetrics,
  UserGrowthCard,
  CreditEconomyCard,
  GovernanceCard,
  AlertsFeed,
} from "@/features/admin/overview";

const REFRESH_INTERVAL_MS = 30_000; // 30 seconds

const NAV_LINKS = [
  { href: "/admin/users", icon: Users, label: "Users" },
  { href: "/admin/audit-logs", icon: Shield, label: "Audit Logs" },
  { href: "/admin/change-requests", icon: ClipboardList, label: "Change Requests" },
  { href: "/moderator", icon: Eye, label: "Moderator" },
] as const;

export default function AdminOverview() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const overviewQuery = trpc.admin.getOverview.useQuery(undefined, {
    enabled: isAuthenticated && user?.role === "admin",
    refetchInterval: autoRefresh ? REFRESH_INTERVAL_MS : false,
    staleTime: 10_000,
  });

  // Update last-refresh timestamp when data arrives
  useEffect(() => {
    if (overviewQuery.dataUpdatedAt) {
      setLastRefresh(new Date(overviewQuery.dataUpdatedAt));
    }
  }, [overviewQuery.dataUpdatedAt]);

  const handleRefresh = useCallback(() => {
    overviewQuery.refetch();
    toast.success("Dashboard refreshed");
  }, [overviewQuery]);

  // Auth guards
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#EBEBEB] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[#0A0A0A]" />
      </div>
    );
  }
  if (!isAuthenticated) return <Redirect to="/login" />;
  if (user?.role !== "admin") {
    toast.error("Access denied. Admin privileges required.");
    return <Redirect to="/dashboard" />;
  }

  const data = overviewQuery.data;

  return (
    <div className="min-h-screen bg-[#EBEBEB] text-[#0A0A0A]">
      {/* Header */}
      <header className="border-b border-[#D5D5D5] bg-white/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/dashboard">
                <Button variant="ghost" size="sm" className="text-[#757575] hover:text-[#0A0A0A]">
                  <LayoutDashboard className="w-4 h-4 mr-2" />
                  Dashboard
                </Button>
              </Link>
              <div className="h-5 w-px bg-[#D5D5D5]" />
              <h1 className="text-lg font-semibold text-[#0A0A0A]">
                Admin Overview
              </h1>
            </div>

            <div className="flex items-center gap-2">
              {/* Quick nav links */}
              <div className="hidden md:flex items-center gap-1 mr-3">
                {NAV_LINKS.map(({ href, icon: Icon, label }) => (
                  <Link key={href} href={href}>
                    <Button variant="ghost" size="sm" className="text-[#757575] hover:text-[#0A0A0A] text-xs">
                      <Icon className="w-3.5 h-3.5 mr-1" />
                      {label}
                    </Button>
                  </Link>
                ))}
              </div>

              <span className="text-[10px] text-[#999] hidden sm:inline">
                {lastRefresh.toLocaleTimeString()}
              </span>
              <Button
                variant={autoRefresh ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setAutoRefresh(!autoRefresh);
                  toast.info(autoRefresh ? "Auto-refresh paused" : "Auto-refresh enabled (30s)");
                }}
                className={
                  autoRefresh
                    ? "bg-[#0A0A0A] hover:bg-[#222] text-white text-xs"
                    : "border-[#D5D5D5] text-[#757575] text-xs"
                }
              >
                <Clock className="w-3.5 h-3.5 mr-1" />
                {autoRefresh ? "Live" : "Paused"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={overviewQuery.isRefetching}
                className="border-[#D5D5D5] text-[#757575] text-xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${overviewQuery.isRefetching ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Loading state */}
        {overviewQuery.isLoading && !data && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-[#E5E5E5] p-5 h-32 animate-pulse" />
            ))}
          </div>
        )}

        {/* Error state */}
        {overviewQuery.isError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
            <p className="text-red-700 font-medium">Failed to load dashboard data</p>
            <p className="text-red-500 text-sm mt-1">{overviewQuery.error?.message}</p>
            <Button variant="outline" size="sm" onClick={handleRefresh} className="mt-3">
              Retry
            </Button>
          </div>
        )}

        {data && (
          <>
            {/* Health metrics row */}
            <HealthMetrics data={data.health} />

            {/* Main grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left column */}
              <div className="space-y-6">
                <UserGrowthCard data={data.users} />
                <GovernanceCard data={data.governance} />
              </div>

              {/* Center column */}
              <div>
                <CreditEconomyCard data={data.credits} />
              </div>

              {/* Right column — alerts feed */}
              <div>
                <AlertsFeed alerts={data.alerts} />
              </div>
            </div>

            {/* Fetched-at footer */}
            <div className="text-center text-[10px] text-[#999] pb-4">
              Data as of {new Date(data.fetchedAt).toLocaleString()}
              {overviewQuery.isRefetching && (
                <Badge variant="secondary" className="ml-2 text-[10px]">
                  Refreshing...
                </Badge>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
