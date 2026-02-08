import { Link, useRoute } from "wouter";
import {
  LayoutDashboard,
  RefreshCw,
  Clock,
  Shield,
  Users,
  ClipboardList,
  Eye,
  BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const NAV_LINKS = [
  { href: "/admin/overview", icon: BarChart3, label: "Overview" },
  { href: "/admin/users", icon: Users, label: "Users" },
  { href: "/admin/audit-logs", icon: Shield, label: "Audit Logs" },
  { href: "/admin/change-requests", icon: ClipboardList, label: "Change Requests" },
  { href: "/moderator", icon: Eye, label: "Moderator" },
] as const;

interface AdminHeaderProps {
  title: string;
  /** Optional: show auto-refresh toggle + manual refresh button */
  refreshControls?: {
    autoRefresh: boolean;
    onToggleAutoRefresh: () => void;
    onRefresh: () => void;
    isRefetching: boolean;
    lastRefresh?: Date;
  };
  /** Optional: extra action buttons rendered on the right side */
  actions?: React.ReactNode;
}

export function AdminHeader({ title, refreshControls, actions }: AdminHeaderProps) {
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
            <h1 className="text-lg font-semibold text-[#0A0A0A]">{title}</h1>
          </div>

          {/* Right: nav links + controls */}
          <div className="flex items-center gap-2">
            {/* Quick nav links */}
            <nav className="hidden md:flex items-center gap-1 mr-3">
              {NAV_LINKS.map(({ href, icon: Icon, label }) => (
                <NavLink key={href} href={href} icon={Icon} label={label} />
              ))}
            </nav>

            {/* Refresh controls */}
            {refreshControls && (
              <>
                {refreshControls.lastRefresh && (
                  <span className="text-[10px] text-[#bbb] hidden sm:inline tabular-nums">
                    {refreshControls.lastRefresh.toLocaleTimeString()}
                  </span>
                )}
                <Button
                  variant={refreshControls.autoRefresh ? "default" : "outline"}
                  size="sm"
                  onClick={refreshControls.onToggleAutoRefresh}
                  className={
                    refreshControls.autoRefresh
                      ? "bg-[#0A0A0A] hover:bg-[#222] text-white text-xs"
                      : "border-[#D5D5D5] text-[#999] text-xs"
                  }
                >
                  <Clock className="w-3.5 h-3.5 mr-1" />
                  {refreshControls.autoRefresh ? "Live" : "Paused"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={refreshControls.onRefresh}
                  disabled={refreshControls.isRefetching}
                  className="border-[#D5D5D5] text-[#999] text-xs"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${refreshControls.isRefetching ? "animate-spin" : ""}`} />
                </Button>
              </>
            )}

            {/* Extra action buttons */}
            {actions}
          </div>
        </div>
      </div>
    </header>
  );
}

/** Internal nav link with active state */
function NavLink({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  const [isActive] = useRoute(href);

  return (
    <Link href={href}>
      <Button
        variant="ghost"
        size="sm"
        className={
          isActive
            ? "text-[#0A0A0A] bg-[#E5E5E5] text-xs font-medium"
            : "text-[#999] hover:text-[#0A0A0A] text-xs"
        }
      >
        <Icon className="w-3.5 h-3.5 mr-1" />
        {label}
      </Button>
    </Link>
  );
}
