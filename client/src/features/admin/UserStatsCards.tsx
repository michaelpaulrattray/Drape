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

export function UserStatsCards({ stats }: UserStatsCardsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
      <div className="bg-white/5 rounded-lg p-4 border border-white/10">
        <div className="text-2xl font-bold">{stats?.totalUsers || 0}</div>
        <div className="text-sm text-gray-400">Total Users</div>
      </div>
      <div className="bg-white/5 rounded-lg p-4 border border-white/10">
        <div className="text-2xl font-bold text-emerald-400">{stats?.activeUsers || 0}</div>
        <div className="text-sm text-gray-400">Active</div>
      </div>
      <div className="bg-white/5 rounded-lg p-4 border border-white/10">
        <div className="text-2xl font-bold text-red-400">{stats?.suspendedUsers || 0}</div>
        <div className="text-sm text-gray-400">Suspended</div>
      </div>
      <div className="bg-white/5 rounded-lg p-4 border border-white/10">
        <div className="text-2xl font-bold text-amber-400">{stats?.lockedUsers || 0}</div>
        <div className="text-sm text-gray-400">Locked</div>
      </div>
      <div className="bg-white/5 rounded-lg p-4 border border-white/10">
        <div className="text-2xl font-bold text-blue-400">{stats?.newUsersThisMonth || 0}</div>
        <div className="text-sm text-gray-400">New This Month</div>
      </div>
      <div className="bg-white/5 rounded-lg p-4 border border-white/10">
        <div className="text-2xl font-bold text-purple-400">{stats?.adminCount || 0}</div>
        <div className="text-sm text-gray-400">Admins</div>
      </div>
    </div>
  );
}
