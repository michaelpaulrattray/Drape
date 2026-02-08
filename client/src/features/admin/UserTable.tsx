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
    <div className="bg-white rounded-xl border border-[#E5E5E5] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#E5E5E5] bg-[#FAFAFA]">
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#999] uppercase tracking-wider">User</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#999] uppercase tracking-wider">Status</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#999] uppercase tracking-wider">Role</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#999] uppercase tracking-wider">Joined</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#999] uppercase tracking-wider">Last Active</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-[#999] uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[#999]">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#CCC]" />
                  Loading users...
                </td>
              </tr>
            ) : users?.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center">
                  <User className="w-10 h-10 mx-auto mb-3 text-[#CCC]" />
                  <div className="text-[#666] font-medium">No users found</div>
                  <div className="text-sm text-[#999] mt-1">Try adjusting your search or filters</div>
                </td>
              </tr>
            ) : (
              users?.map((u) => (
                <tr key={u.id} className="border-b border-[#F0F0F0] last:border-0 hover:bg-[#FAFAFA] transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {u.avatarUrl ? (
                        <img src={u.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover ring-1 ring-[#E5E5E5]" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-[#F0F0F0] flex items-center justify-center">
                          <User className="w-4 h-4 text-[#999]" />
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs text-[#CCC]">#{u.id}</span>
                          <span className="font-medium text-[#0A0A0A]">{u.name || "Unnamed"}</span>
                        </div>
                        <div className="text-sm text-[#999]">{u.email || "No email"}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={getUserStatus(u)} />
                  </td>
                  <td className="px-4 py-3">
                    <RoleBadge role={u.role} />
                  </td>
                  <td className="px-4 py-3 text-sm text-[#666]">
                    {formatDate(u.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-sm text-[#666]">
                    {formatDate(u.lastSignedIn)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onSelectUser(u.id)}
                      className="border-[#E5E5E5] text-[#666] hover:bg-[#F0F0F0]"
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
        <div className="flex items-center justify-between px-4 py-3 border-t border-[#E5E5E5] bg-[#FAFAFA]">
          <div className="text-sm text-[#999]">
            Showing {page * itemsPerPage + 1} to {Math.min((page + 1) * itemsPerPage, total)} of {total}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page - 1)}
              disabled={page === 0}
              className="border-[#E5E5E5] text-[#666] hover:bg-[#F0F0F0]"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages - 1}
              className="border-[#E5E5E5] text-[#666] hover:bg-[#F0F0F0]"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
