/**
 * UserGrowthCard — user growth, account status, and plan distribution.
 */
import {
  Users,
  UserPlus,
  Snowflake,
  Ban,
  Crown,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface UserGrowthData {
  totalUsers: number;
  newSignups7d: number;
  newSignups24h: number;
  frozenAccounts: number;
  suspendedAccounts: number;
  planDistribution: Array<{ plan: string; count: number }>;
}

const PLAN_LABELS: Record<string, string> = {
  free: "Free",
  starter: "Starter",
  pro: "Pro",
  enterprise: "Enterprise",
};

const PLAN_COLORS: Record<string, string> = {
  free: "bg-gray-100 text-gray-700",
  starter: "bg-blue-50 text-blue-700",
  pro: "bg-violet-50 text-violet-700",
  enterprise: "bg-amber-50 text-amber-700",
};

export function UserGrowthCard({ data }: { data: UserGrowthData }) {
  const totalPlans = data.planDistribution.reduce((sum, p) => sum + p.count, 0);

  return (
    <div className="bg-white rounded-xl border border-[#E5E5E5] p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-[#0A0A0A] uppercase tracking-wider">
          Users & Growth
        </h3>
        <Users className="w-4 h-4 text-[#757575]" />
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 gap-4 mb-5">
        <div>
          <span className="text-2xl font-semibold tabular-nums text-[#0A0A0A]">
            {data.totalUsers.toLocaleString()}
          </span>
          <p className="text-xs text-[#757575] mt-0.5">Total users</p>
        </div>
        <div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-semibold tabular-nums text-emerald-600">
              +{data.newSignups7d}
            </span>
          </div>
          <p className="text-xs text-[#757575] mt-0.5">
            New this week
            {data.newSignups24h > 0 && (
              <span className="text-emerald-600 ml-1">
                ({data.newSignups24h} today)
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Account status */}
      <div className="flex items-center gap-3 mb-5">
        {data.frozenAccounts > 0 && (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-xs font-medium">
            <Snowflake className="w-3 h-3" />
            {data.frozenAccounts} frozen
          </div>
        )}
        {data.suspendedAccounts > 0 && (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-50 text-red-700 text-xs font-medium">
            <Ban className="w-3 h-3" />
            {data.suspendedAccounts} suspended
          </div>
        )}
        {data.frozenAccounts === 0 && data.suspendedAccounts === 0 && (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-medium">
            All accounts healthy
          </div>
        )}
      </div>

      {/* Plan distribution */}
      <div>
        <p className="text-xs font-medium text-[#757575] uppercase tracking-wider mb-2.5">
          Plan Distribution
        </p>
        <div className="space-y-2">
          {data.planDistribution
            .sort((a, b) => b.count - a.count)
            .map((plan) => {
              const pct = totalPlans > 0 ? Math.round((plan.count / totalPlans) * 100) : 0;
              return (
                <div key={plan.plan} className="flex items-center gap-3">
                  <Badge
                    variant="secondary"
                    className={`text-[10px] w-20 justify-center ${PLAN_COLORS[plan.plan] || "bg-gray-100 text-gray-700"}`}
                  >
                    {PLAN_LABELS[plan.plan] || plan.plan}
                  </Badge>
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#0A0A0A]/20 rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs tabular-nums text-[#757575] w-16 text-right">
                    {plan.count} ({pct}%)
                  </span>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
