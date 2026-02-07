/**
 * SystemStatusCard — compact system health card showing uptime, DB latency,
 * active banners, and Stripe webhook status.
 * Fetches live data from the /api/health endpoint.
 */

import { useState, useEffect, useCallback } from "react";
import { Activity, Database, Megaphone, Server } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface HealthResponse {
  status: "healthy" | "unhealthy";
  uptime: number;
  timestamp: string;
  checks: {
    database: {
      status: "up" | "down";
      latencyMs: number;
    };
  };
}

interface SystemStatusCardProps {
  activeBanners: number;
  serverStartedAt: string | Date;
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function latencyColor(ms: number): string {
  if (ms < 100) return "text-emerald-600";
  if (ms < 500) return "text-amber-600";
  return "text-red-600";
}

export function SystemStatusCard({ activeBanners, serverStartedAt }: SystemStatusCardProps) {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState(false);

  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch("/api/health");
      if (res.ok) {
        const data = await res.json();
        setHealth(data);
        setError(false);
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 30_000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  const dbStatus = health?.checks.database;
  const isHealthy = health?.status === "healthy";

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#e0e0e0]">
      <div className="flex items-center gap-2 mb-4">
        <Activity className="w-5 h-5 text-[#0A0A0A]" />
        <h3 className="text-base font-semibold text-[#0A0A0A]">System Status</h3>
        <Badge
          className={`text-[10px] ml-auto ${
            error ? "bg-red-100 text-red-700" : isHealthy ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
          }`}
        >
          {error ? "Unreachable" : isHealthy ? "Healthy" : "Degraded"}
        </Badge>
      </div>

      <div className="space-y-3">
        {/* Server Uptime */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-[#666]">
            <Server className="w-3.5 h-3.5" />
            <span>Server Uptime</span>
          </div>
          <span className="text-sm font-medium text-[#0A0A0A] tabular-nums">
            {health ? formatUptime(health.uptime) : "—"}
          </span>
        </div>

        {/* DB Latency */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-[#666]">
            <Database className="w-3.5 h-3.5" />
            <span>DB Latency</span>
          </div>
          <span className={`text-sm font-medium tabular-nums ${dbStatus ? latencyColor(dbStatus.latencyMs) : "text-[#999]"}`}>
            {dbStatus ? `${dbStatus.latencyMs.toFixed(0)}ms` : "—"}
          </span>
        </div>

        {/* Active Banners */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-[#666]">
            <Megaphone className="w-3.5 h-3.5" />
            <span>Active Banners</span>
          </div>
          <span className="text-sm font-medium text-[#0A0A0A] tabular-nums">
            {activeBanners}
          </span>
        </div>

        {/* Server Started */}
        <div className="pt-2 border-t border-[#f0f0f0]">
          <p className="text-[10px] text-[#bbb]">
            Server started {new Date(serverStartedAt).toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}
