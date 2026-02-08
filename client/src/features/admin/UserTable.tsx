import { RefreshCw, UserCog, User, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge, RoleBadge, getUserStatus, formatDate } from "./UserBadges";

interface UserRow {
  id: number;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
  role: "user" | "admin" | "moderator";
  suspendedAt: string | null;
  frozenAt: string | null;
  lockedUntil: string | null;
  createdAt: string;
  lastSignedIn: string;
}

interface UserTableProps {
  users: UserRow[] | undefined;
  isLoading: boolean;
  page: number;
  totalPages: number;
  total: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  onSelectUser: (userId: number) => void;
}

export function UserTable({
  users,
  isLoading,
  page,
  totalPages,
  total,
  itemsPerPage,
  onPageChange,
  onSelectUser,
}: UserTableProps) {
  return (
    <div className="bg-white/5 rounded-lg border border-white/10 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-white/5">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">User</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Role</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Joined</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Last Active</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                  Loading users...
                </td>
              </tr>
            ) : users?.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  No users found
                </td>
              </tr>
            ) : (
              users?.map((u) => (
                <tr key={u.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {u.avatarUrl ? (
                        <img src={u.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                          <User className="w-4 h-4 text-purple-400" />
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs text-white/30">#{u.id}</span>
                          <span className="font-medium">{u.name || "Unnamed"}</span>
                        </div>
                        <div className="text-sm text-gray-400">{u.email || "No email"}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={getUserStatus(u)} />
                  </td>
                  <td className="px-4 py-3">
                    <RoleBadge role={u.role} />
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400">
                    {formatDate(u.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400">
                    {formatDate(u.lastSignedIn)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onSelectUser(u.id)}
                      className="border-white/10 hover:bg-white/5"
                    >
                      <UserCog className="w-4 h-4 mr-1" />
                      Manage
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-white/10">
          <div className="text-sm text-gray-400">
            Showing {page * itemsPerPage + 1} to {Math.min((page + 1) * itemsPerPage, total)} of {total}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page - 1)}
              disabled={page === 0}
              className="border-white/10 hover:bg-white/5"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages - 1}
              className="border-white/10 hover:bg-white/5"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
