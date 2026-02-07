/**
 * HealthMetrics — real-time platform health KPIs (top row).
 * Shows generation success rate, active users, pending/failed counts.
 */
import {
  Activity,
  Users,
  AlertTriangle,
  Clock,
  Loader2,
  CheckCircle2,
  XCircle,
} from "lucide-react";

interface HealthData {
  total24h: number;
  completed24h: number;
  failed24h: number;
  pending: number;
  processing: number;
  successRate: number;
  activeUsers24h: number;
}

export function HealthMetrics({ data }: { data: HealthData }) {
  const isHealthy = data.successRate >= 95;
  const isWarning = data.successRate >= 80 && data.successRate < 95;
  const isCritical = data.successRate < 80;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Success Rate */}
      <div className="bg-white rounded-xl border border-[#E5E5E5] p-5 relative overflow-hidden">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-[#757575] uppercase tracking-wider">
            Success Rate
          </span>
          <div className={`w-2 h-2 rounded-full ${
            isHealthy ? "bg-emerald-500" : isWarning ? "bg-amber-500" : "bg-red-500"
          } animate-pulse`} />
        </div>
        <div className="flex items-baseline gap-2">
          <span className={`text-3xl font-semibold tabular-nums ${
            isHealthy ? "text-emerald-600" : isWarning ? "text-amber-600" : "text-red-600"
          }`}>
            {data.successRate}%
          </span>
          <span className="text-xs text-[#757575]">24h</span>
        </div>
        <div className="flex items-center gap-3 mt-3 text-xs text-[#757575]">
          <span className="flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
            {data.completed24h}
          </span>
          <span className="flex items-center gap-1">
            <XCircle className="w-3 h-3 text-red-400" />
            {data.failed24h}
          </span>
        </div>
      </div>

      {/* Active Users */}
      <div className="bg-white rounded-xl border border-[#E5E5E5] p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-[#757575] uppercase tracking-wider">
            Active Users
          </span>
          <Users className="w-4 h-4 text-[#757575]" />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-semibold tabular-nums text-[#0A0A0A]">
            {data.activeUsers24h}
          </span>
          <span className="text-xs text-[#757575]">24h</span>
        </div>
        <p className="text-xs text-[#757575] mt-3">
          Users who signed in recently
        </p>
      </div>

      {/* Generations Today */}
      <div className="bg-white rounded-xl border border-[#E5E5E5] p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-[#757575] uppercase tracking-wider">
            Generations
          </span>
          <Activity className="w-4 h-4 text-[#757575]" />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-semibold tabular-nums text-[#0A0A0A]">
            {data.total24h}
          </span>
          <span className="text-xs text-[#757575]">24h</span>
        </div>
        <div className="flex items-center gap-3 mt-3 text-xs text-[#757575]">
          {data.processing > 0 && (
            <span className="flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin text-blue-500" />
              {data.processing} processing
            </span>
          )}
          {data.pending > 0 && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-amber-500" />
              {data.pending} queued
            </span>
          )}
          {data.processing === 0 && data.pending === 0 && (
            <span>All clear</span>
          )}
        </div>
      </div>

      {/* Failed Generations */}
      <div className={`rounded-xl border p-5 ${
        isCritical
          ? "bg-red-50 border-red-200"
          : data.failed24h > 0
          ? "bg-amber-50 border-amber-200"
          : "bg-white border-[#E5E5E5]"
      }`}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-[#757575] uppercase tracking-wider">
            Failures
          </span>
          <AlertTriangle className={`w-4 h-4 ${
            isCritical ? "text-red-500" : data.failed24h > 0 ? "text-amber-500" : "text-[#757575]"
          }`} />
        </div>
        <div className="flex items-baseline gap-2">
          <span className={`text-3xl font-semibold tabular-nums ${
            isCritical ? "text-red-600" : data.failed24h > 0 ? "text-amber-600" : "text-[#0A0A0A]"
          }`}>
            {data.failed24h}
          </span>
          <span className="text-xs text-[#757575]">24h</span>
        </div>
        <p className="text-xs text-[#757575] mt-3">
          {isCritical
            ? "Critical — investigate immediately"
            : data.failed24h > 0
            ? "Some failures detected"
            : "No failures in 24h"}
        </p>
      </div>
    </div>
  );
}
