/**
 * User Investigation tab — user list, detail sidebar with activity/credits/generations sub-tabs.
 */
import { useState } from "react";
import {
  Search,
  Eye,
  User,
  Users,
  Activity,
  Coins,
  Image,
  FileText,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AuditLog,
  PAGE_SIZE,
  formatDate,
  type OpenChangeRequestOptions,
} from "./moderatorConstants";
import { ActivitySubTab } from "./ActivitySubTab";
import { CreditsSubTab } from "./CreditsSubTab";
import { GenerationsSubTab } from "./GenerationsSubTab";

interface UserInvestigationTabProps {
  usersQuery: any;
  userDetailsQuery: any;
  userActivityQuery: any;
  creditHistoryQuery: any;
  generationHistoryQuery: any;
  userSearchQuery: string;
  setUserSearchQuery: (v: string) => void;
  userPage: number;
  setUserPage: (fn: (p: number) => number) => void;
  selectedUserId: number | null;
  setSelectedUserId: (id: number | null) => void;
  userTotalPages: number;
  onSelectLog: (log: AuditLog) => void;
  onOpenChangeRequest: (options?: OpenChangeRequestOptions) => void;
  creditTypeFilter: string;
  setCreditTypeFilter: (v: string) => void;
  creditPage: number;
  setCreditPage: (fn: (p: number) => number) => void;
  genStatusFilter: string;
  setGenStatusFilter: (v: string) => void;
  genTypeFilter: string;
  setGenTypeFilter: (v: string) => void;
  genPage: number;
  setGenPage: (fn: (p: number) => number) => void;
  creditStartDate: string;
  setCreditStartDate: (v: string) => void;
  creditEndDate: string;
  setCreditEndDate: (v: string) => void;
  genStartDate: string;
  setGenStartDate: (v: string) => void;
  genEndDate: string;
  setGenEndDate: (v: string) => void;
}

export function UserInvestigationTab({
  usersQuery,
  userDetailsQuery,
  userActivityQuery,
  creditHistoryQuery,
  generationHistoryQuery,
  userSearchQuery,
  setUserSearchQuery,
  userPage,
  setUserPage,
  selectedUserId,
  setSelectedUserId,
  userTotalPages,
  onSelectLog,
  onOpenChangeRequest,
  creditTypeFilter,
  setCreditTypeFilter,
  creditPage,
  setCreditPage,
  genStatusFilter,
  setGenStatusFilter,
  genTypeFilter,
  setGenTypeFilter,
  genPage,
  setGenPage,
  creditStartDate,
  setCreditStartDate,
  creditEndDate,
  setCreditEndDate,
  genStartDate,
  setGenStartDate,
  genEndDate,
  setGenEndDate,
}: UserInvestigationTabProps) {
  const [userDetailTab, setUserDetailTab] = useState<"overview" | "credits" | "generations">("overview");

  const handleSelectUser = (id: number) => {
    setSelectedUserId(id);
    setUserDetailTab("overview");
    setCreditPage(() => 0);
    setGenPage(() => 0);
    setCreditTypeFilter("all");
    setGenStatusFilter("all");
    setGenTypeFilter("all");
    setCreditStartDate("");
    setCreditEndDate("");
    setGenStartDate("");
    setGenEndDate("");
  };

  return (
    <>
      <div className="flex gap-3 items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
          <Input
            placeholder="Search users by name, email, or ID..."
            value={userSearchQuery}
            onChange={(e) => { setUserSearchQuery(e.target.value); setUserPage(() => 0); }}
            className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/30"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* User List */}
        <div className="lg:col-span-2">
          <UserTable
            usersQuery={usersQuery}
            selectedUserId={selectedUserId}
            onSelectUser={handleSelectUser}
            userPage={userPage}
            setUserPage={setUserPage}
            userTotalPages={userTotalPages}
          />
        </div>

        {/* User Detail Sidebar */}
        <div className="space-y-4">
          {selectedUserId ? (
            <div className="space-y-4">
              <UserDetailCard
                userDetailsQuery={userDetailsQuery}
                selectedUserId={selectedUserId}
                onOpenChangeRequest={onOpenChangeRequest}
              />

              {/* Sub-Tab Navigation */}
              <div className="flex gap-1 border-b border-white/10 pb-1">
                <Button
                  variant={userDetailTab === "overview" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setUserDetailTab("overview")}
                  className={`text-xs ${userDetailTab === "overview" ? "bg-blue-600 hover:bg-blue-700" : "text-white/60 hover:text-white"}`}
                >
                  <Activity className="w-3 h-3 mr-1" />
                  Activity
                </Button>
                <Button
                  variant={userDetailTab === "credits" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setUserDetailTab("credits")}
                  className={`text-xs ${userDetailTab === "credits" ? "bg-blue-600 hover:bg-blue-700" : "text-white/60 hover:text-white"}`}
                >
                  <Coins className="w-3 h-3 mr-1" />
                  Credits
                </Button>
                <Button
                  variant={userDetailTab === "generations" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setUserDetailTab("generations")}
                  className={`text-xs ${userDetailTab === "generations" ? "bg-blue-600 hover:bg-blue-700" : "text-white/60 hover:text-white"}`}
                >
                  <Image className="w-3 h-3 mr-1" />
                  Generations
                </Button>
              </div>

              {userDetailTab === "overview" && (
                <ActivitySubTab userActivityQuery={userActivityQuery} onSelectLog={onSelectLog} />
              )}
              {userDetailTab === "credits" && (
                <CreditsSubTab
                  creditHistoryQuery={creditHistoryQuery}
                  userDetailsQuery={userDetailsQuery}
                  creditTypeFilter={creditTypeFilter}
                  setCreditTypeFilter={setCreditTypeFilter}
                  creditPage={creditPage}
                  setCreditPage={setCreditPage}
                  startDate={creditStartDate}
                  setStartDate={setCreditStartDate}
                  endDate={creditEndDate}
                  setEndDate={setCreditEndDate}
                  selectedUserId={selectedUserId}
                  onOpenChangeRequest={onOpenChangeRequest}
                />
              )}
              {userDetailTab === "generations" && (
                <GenerationsSubTab
                  generationHistoryQuery={generationHistoryQuery}
                  genStatusFilter={genStatusFilter}
                  setGenStatusFilter={setGenStatusFilter}
                  genTypeFilter={genTypeFilter}
                  setGenTypeFilter={setGenTypeFilter}
                  genPage={genPage}
                  setGenPage={setGenPage}
                  startDate={genStartDate}
                  setStartDate={setGenStartDate}
                  endDate={genEndDate}
                  setEndDate={setGenEndDate}
                />
              )}
            </div>
          ) : (
            <Card className="bg-white/5 border-white/10">
              <CardContent className="py-12 text-center">
                <User className="w-8 h-8 mx-auto mb-3 text-white/20" />
                <p className="text-white/40 text-sm">Select a user to view details</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

// ── User Table ──

function UserTable({
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
                  <td className="px-4 py-3" colSpan={5}>
                    <Skeleton className="h-6 w-full bg-white/10" />
                  </td>
                </tr>
              ))
            ) : usersQuery.data?.users.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-white/40">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  No users found
                </td>
              </tr>
            ) : (
              usersQuery.data?.users.map((u: any) => (
                <tr
                  key={u.id}
                  className={`border-b border-white/5 hover:bg-white/5 cursor-pointer transition-colors ${selectedUserId === u.id ? "bg-blue-500/10" : ""}`}
                  onClick={() => onSelectUser(u.id)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {u.avatarUrl ? (
                        <img src={u.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-medium text-white">
                          {(u.name || "U").charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs text-white/30">#{u.id}</span>
                          <p className="text-sm font-medium text-white">{u.name || "Unnamed"}</p>
                        </div>
                        <p className="text-xs text-white/40">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={
                      u.role === "admin" ? "bg-red-500/10 text-red-400" :
                      u.role === "moderator" ? "bg-blue-500/10 text-blue-400" :
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

function UserDetailCard({
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
