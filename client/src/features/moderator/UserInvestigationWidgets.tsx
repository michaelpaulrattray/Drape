/**
 * Extracted sub-components for UserInvestigationTab: UserTable + UserDetailCard.
 */
import {
  Eye,
  User,
  FileText,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, type OpenChangeRequestOptions } from "./moderatorConstants";

// ── User Table ──

export function UserTable({
  usersQuery,
  selectedUserId,
  onSelectUser,
  userPage,
  setUserPage,
  userTotalPages,
}: {
  usersQuery: any;
  selectedUserId: number | null;
  onSelectUser: (id: number) => void;
  userPage: number;
  setUserPage: (fn: (p: number) => number) => void;
  userTotalPages: number;
}) {
  return (
    <Card className="bg-white/5 border-white/10 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/10">
              <th className="px-4 py-3 text-left text-xs font-medium text-white/40 uppercase">User</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-white/40 uppercase">Role</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-white/40 uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-white/40 uppercase">Last Active</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-white/40 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {usersQuery.isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-white/5">
                  <td className="px-4 py-3"><Skeleton className="h-5 w-32 bg-white/10" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-5 w-16 bg-white/10" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-5 w-16 bg-white/10" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-5 w-24 bg-white/10" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-5 w-8 bg-white/10 ml-auto" /></td>
                </tr>
              ))
            ) : usersQuery.data?.users?.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-white/40 text-sm">
                  No users found
                </td>
              </tr>
            ) : (
              usersQuery.data?.users?.map((u: any) => (
                <tr
                  key={u.id}
                  className={`border-b border-white/5 cursor-pointer transition-colors ${
                    selectedUserId === u.id ? "bg-blue-500/10" : "hover:bg-white/5"
                  }`}
                  onClick={() => onSelectUser(u.id)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {u.avatarUrl ? (
                        <img src={u.avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover" />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-xs font-medium text-white">
                          {(u.name || "U").charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-medium text-white">{u.name || "Unnamed"}</p>
                        <p className="text-xs text-white/40">
                          <span className="font-mono text-white/30">#{u.id}</span>{" "}
                          {u.email}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={
                      u.role === "admin" ? "bg-red-500/10 text-red-400" :
                      u.role === "moderator" ? "bg-amber-500/10 text-amber-400" :
                      "bg-gray-500/10 text-gray-400"
                    }>
                      {u.role}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    {u.suspendedAt ? (
                      <Badge className="bg-red-500/10 text-red-400">Suspended</Badge>
                    ) : (
                      <Badge className="bg-emerald-500/10 text-emerald-400">Active</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-white/60">
                    {u.lastLoginAt ? formatDate(new Date(u.lastLoginAt)) : "Never"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                      onClick={(e) => { e.stopPropagation(); onSelectUser(u.id); }}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* User Pagination */}
      {userTotalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-white/10">
          <span className="text-xs text-white/40">
            Page {userPage + 1} of {userTotalPages}
          </span>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setUserPage(p => Math.max(0, p - 1))}
              disabled={userPage === 0}
              className="border-white/20 text-white h-7 w-7 p-0"
            >
              <ChevronLeft className="w-3 h-3" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setUserPage(p => p + 1)}
              disabled={userPage + 1 >= userTotalPages}
              className="border-white/20 text-white h-7 w-7 p-0"
            >
              <ChevronRight className="w-3 h-3" />
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

// ── User Detail Card ──

export function UserDetailCard({
  userDetailsQuery,
  selectedUserId,
  onOpenChangeRequest,
}: {
  userDetailsQuery: any;
  selectedUserId: number;
  onOpenChangeRequest: (options?: OpenChangeRequestOptions) => void;
}) {
  return (
    <Card className="bg-white/5 border-white/10">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2 text-white">
          <User className="w-4 h-4 text-blue-400" />
          User #{selectedUserId}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {userDetailsQuery.isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-12 w-full bg-white/10" />
            <Skeleton className="h-8 w-3/4 bg-white/10" />
            <Skeleton className="h-8 w-1/2 bg-white/10" />
          </div>
        ) : userDetailsQuery.data ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              {userDetailsQuery.data.user.avatarUrl ? (
                <img src={userDetailsQuery.data.user.avatarUrl} alt="" className="w-12 h-12 rounded-full object-cover" />
              ) : (
                <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-lg font-medium text-white">
                  {(userDetailsQuery.data.user.name || "U").charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <p className="font-medium text-white">{userDetailsQuery.data.user.name || "Unnamed"}</p>
                <p className="text-xs text-white/40">{userDetailsQuery.data.user.email}</p>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-white/40">Credits</span>
                <span className="font-medium text-white">{userDetailsQuery.data.credits?.balance?.toLocaleString() ?? "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/40">Plan</span>
                <Badge className={
                  userDetailsQuery.data.credits?.planTier === "enterprise" ? "bg-amber-500/10 text-amber-400" :
                  userDetailsQuery.data.credits?.planTier === "studio" ? "bg-purple-500/10 text-purple-400" :
                  userDetailsQuery.data.credits?.planTier === "starter" ? "bg-emerald-500/10 text-emerald-400" :
                  "bg-gray-500/10 text-gray-400"
                }>
                  {userDetailsQuery.data.credits?.planTier || "free"}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-white/40">Joined</span>
                <span className="text-xs text-white/80">{formatDate(new Date(userDetailsQuery.data.user.createdAt))}</span>
              </div>
              {userDetailsQuery.data.user.suspendedAt && (
                <div className="p-2 rounded bg-red-500/10 border border-red-500/20">
                  <p className="text-red-400 text-xs font-medium">Suspended</p>
                  <p className="text-white/60 text-xs mt-1">{userDetailsQuery.data.user.suspendedReason || "No reason"}</p>
                </div>
              )}
              <div className="pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                  onClick={() => onOpenChangeRequest({
                    type: "flag_account",
                    targetUserId: selectedUserId.toString(),
                    targetUserName: userDetailsQuery.data?.user.name || userDetailsQuery.data?.user.email || undefined,
                  })}
                >
                  <FileText className="w-3 h-3 mr-2" />
                  Submit Change Request
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-white/40 text-sm">User not found</p>
        )}
      </CardContent>
    </Card>
  );
}
