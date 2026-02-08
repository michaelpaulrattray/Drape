interface UserStatsData {
  totalUsers: number;
  activeUsers: number;
  suspendedUsers: number;
  lockedUsers: number;
  newUsersThisMonth: number;
  adminCount: number;
}

interface UserStatsCardsProps {
  stats: UserStatsData | undefined;
}

const statCards = [
  { key: "totalUsers", label: "Total Users", color: "text-[#0A0A0A]" },
  { key: "activeUsers", label: "Active", color: "text-emerald-600" },
  { key: "suspendedUsers", label: "Suspended", color: "text-red-500" },
  { key: "lockedUsers", label: "Locked", color: "text-amber-500" },
  { key: "newUsersThisMonth", label: "New This Month", color: "text-blue-600" },
  { key: "adminCount", label: "Admins", color: "text-purple-600" },
] as const;

export function UserStatsCards({ stats }: UserStatsCardsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {statCards.map(({ key, label, color }) => (
        <div
          key={key}
          className="bg-white rounded-xl p-4 border border-[#E5E5E5] hover:shadow-sm transition-shadow"
        >
          <div className={`text-2xl font-bold ${color}`}>
            {stats?.[key] ?? 0}
          </div>
          <div className="text-xs text-[#999] mt-1 font-medium uppercase tracking-wide">
            {label}
          </div>
        </div>
      ))}
    </div>
  );
}
