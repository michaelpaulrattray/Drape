import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Redirect, Link } from "wouter";
import { useState } from "react";
import {
  Users,
  Search,
  Shield,
  ShieldOff,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  UserCog,
  Coins,
  Activity,
  X,
  Plus,
  Minus,
  AlertTriangle,
  CheckCircle,
  Lock,
  Clock,
  Crown,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

// Status badge component
const StatusBadge = ({ status }: { status: "active" | "suspended" | "locked" }) => {
  const styles = {
    active: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    suspended: "bg-red-500/10 text-red-400 border-red-500/20",
    locked: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  };
  const icons = {
    active: <CheckCircle className="w-3 h-3" />,
    suspended: <ShieldOff className="w-3 h-3" />,
    locked: <Lock className="w-3 h-3" />,
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full border ${styles[status]}`}>
      {icons[status]}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
};

// Role badge component
const RoleBadge = ({ role }: { role: "user" | "admin" | "moderator" }) => {
  if (role === "admin") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full border bg-purple-500/10 text-purple-400 border-purple-500/20">
        <Crown className="w-3 h-3" />
        Admin
      </span>
    );
  }
  if (role === "moderator") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full border bg-blue-500/10 text-blue-400 border-blue-500/20">
        <Shield className="w-3 h-3" />
        Moderator
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full border bg-gray-500/10 text-gray-400 border-gray-500/20">
      <User className="w-3 h-3" />
      User
    </span>
  );
};

export default function AdminUserManagement() {
  const { user, isAuthenticated, loading } = useAuth();
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "suspended" | "locked">("all");
  const [roleFilter, setRoleFilter] = useState<"all" | "user" | "admin" | "moderator">("all");
  const [sortBy, setSortBy] = useState<"createdAt" | "lastSignedIn" | "name">("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"profile" | "credits" | "activity">("profile");
  
  // Modal states
  const [suspendModalOpen, setSuspendModalOpen] = useState(false);
  const [suspendReason, setSuspendReason] = useState("");
  const [creditModalOpen, setCreditModalOpen] = useState(false);
  const [creditAmount, setCreditAmount] = useState("");
  const [creditReason, setCreditReason] = useState("");
  const [creditAction, setCreditAction] = useState<"add" | "deduct">("add");
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [roleChangeTarget, setRoleChangeTarget] = useState<"user" | "moderator">("moderator");
  const [roleChangeReason, setRoleChangeReason] = useState("");

  const ITEMS_PER_PAGE = 20;

  // Queries
  const statsQuery = trpc.admin.getUserStats.useQuery(undefined, {
    enabled: isAuthenticated && user?.role === "admin",
  });

  const usersQuery = trpc.admin.listUsers.useQuery({
    limit: ITEMS_PER_PAGE,
    offset: page * ITEMS_PER_PAGE,
    search: search || undefined,
    status: statusFilter,
    role: roleFilter,
    sortBy,
    sortOrder,
  }, {
    enabled: isAuthenticated && user?.role === "admin",
  });

  const userDetailsQuery = trpc.admin.getUserFullDetails.useQuery(
    { userId: selectedUserId! },
    { enabled: !!selectedUserId && isAuthenticated && user?.role === "admin" }
  );

  const userActivityQuery = trpc.admin.getUserActivity.useQuery(
    { userId: selectedUserId!, limit: 50 },
    { enabled: !!selectedUserId && activeTab === "activity" && isAuthenticated && user?.role === "admin" }
  );

  // Mutations
  const suspendMutation = trpc.admin.suspendUser.useMutation({
    onSuccess: () => {
      toast.success("User suspended successfully");
      setSuspendModalOpen(false);
      setSuspendReason("");
      usersQuery.refetch();
      userDetailsQuery.refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const unsuspendMutation = trpc.admin.unsuspendUser.useMutation({
    onSuccess: () => {
      toast.success("User unsuspended successfully");
      usersQuery.refetch();
      userDetailsQuery.refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const adjustCreditsMutation = trpc.admin.adjustCredits.useMutation({
    onSuccess: (data) => {
      toast.success(`Credits adjusted. New balance: ${data.newBalance}`);
      setCreditModalOpen(false);
      setCreditAmount("");
      setCreditReason("");
      userDetailsQuery.refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const changeRoleMutation = trpc.admin.changeUserRole.useMutation({
    onSuccess: (data) => {
      toast.success(`Role changed: ${data.previousRole} → ${data.newRole}`);
      setRoleModalOpen(false);
      setRoleChangeReason("");
      usersQuery.refetch();
      userDetailsQuery.refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Handlers
  const handleSearch = () => {
    setSearch(searchInput);
    setPage(0);
  };

  const handleSuspend = () => {
    if (!selectedUserId || !suspendReason.trim()) return;
    suspendMutation.mutate({ userId: selectedUserId, reason: suspendReason });
  };

  const handleUnsuspend = () => {
    if (!selectedUserId) return;
    unsuspendMutation.mutate({ userId: selectedUserId });
  };

  const handleAdjustCredits = () => {
    if (!selectedUserId || !creditAmount || !creditReason.trim()) return;
    const amount = parseInt(creditAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid positive amount");
      return;
    }
    const finalAmount = creditAction === "deduct" ? -amount : amount;
    adjustCreditsMutation.mutate({
      userId: selectedUserId,
      amount: finalAmount,
      reason: creditReason,
    });
  };

  const handleChangeRole = () => {
    if (!selectedUserId || !roleChangeReason.trim()) return;
    changeRoleMutation.mutate({
      userId: selectedUserId,
      newRole: roleChangeTarget,
      reason: roleChangeReason,
    });
  };

  const getUserStatus = (user: { suspendedAt: string | null; lockedUntil: string | null }): "active" | "suspended" | "locked" => {
    if (user.suspendedAt) return "suspended";
    if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) return "locked";
    return "active";
  };

  const formatDate = (dateStr: string | Date) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Loading and auth checks
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Redirect to="/" />;
  }

  if (user?.role !== "admin") {
    toast.error("Access denied. Admin privileges required.");
    return <Redirect to="/dashboard" />;
  }

  const totalPages = Math.ceil((usersQuery.data?.total || 0) / ITEMS_PER_PAGE);
  const selectedUser = userDetailsQuery.data;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <header className="border-b border-white/10 bg-[#0a0a0a]/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/dashboard">
                <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Dashboard
                </Button>
              </Link>
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-400" />
                <h1 className="text-xl font-semibold">User Management</h1>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                usersQuery.refetch();
                statsQuery.refetch();
              }}
              className="border-white/10 hover:bg-white/5"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${usersQuery.isFetching ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>
      </header>

      <main className="container py-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <div className="bg-white/5 rounded-lg p-4 border border-white/10">
            <div className="text-2xl font-bold">{statsQuery.data?.totalUsers || 0}</div>
            <div className="text-sm text-gray-400">Total Users</div>
          </div>
          <div className="bg-white/5 rounded-lg p-4 border border-white/10">
            <div className="text-2xl font-bold text-emerald-400">{statsQuery.data?.activeUsers || 0}</div>
            <div className="text-sm text-gray-400">Active</div>
          </div>
          <div className="bg-white/5 rounded-lg p-4 border border-white/10">
            <div className="text-2xl font-bold text-red-400">{statsQuery.data?.suspendedUsers || 0}</div>
            <div className="text-sm text-gray-400">Suspended</div>
          </div>
          <div className="bg-white/5 rounded-lg p-4 border border-white/10">
            <div className="text-2xl font-bold text-amber-400">{statsQuery.data?.lockedUsers || 0}</div>
            <div className="text-sm text-gray-400">Locked</div>
          </div>
          <div className="bg-white/5 rounded-lg p-4 border border-white/10">
            <div className="text-2xl font-bold text-blue-400">{statsQuery.data?.newUsersThisMonth || 0}</div>
            <div className="text-sm text-gray-400">New This Month</div>
          </div>
          <div className="bg-white/5 rounded-lg p-4 border border-white/10">
            <div className="text-2xl font-bold text-purple-400">{statsQuery.data?.adminCount || 0}</div>
            <div className="text-sm text-gray-400">Admins</div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-white/5 rounded-lg p-4 border border-white/10">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search by name, email, or ID..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="pl-10 bg-white/5 border-white/10"
                />
              </div>
              <Button onClick={handleSearch} className="bg-purple-600 hover:bg-purple-700">
                Search
              </Button>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as typeof statusFilter); setPage(0); }}>
                <SelectTrigger className="w-[130px] bg-white/5 border-white/10">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                  <SelectItem value="locked">Locked</SelectItem>
                </SelectContent>
              </Select>
              <Select value={roleFilter} onValueChange={(v) => { setRoleFilter(v as typeof roleFilter); setPage(0); }}>
                <SelectTrigger className="w-[120px] bg-white/5 border-white/10">
                  <SelectValue placeholder="Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="user">Users</SelectItem>
                  <SelectItem value="moderator">Moderators</SelectItem>
                  <SelectItem value="admin">Admins</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={(v) => { setSortBy(v as typeof sortBy); setPage(0); }}>
                <SelectTrigger className="w-[140px] bg-white/5 border-white/10">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="createdAt">Join Date</SelectItem>
                  <SelectItem value="lastSignedIn">Last Active</SelectItem>
                  <SelectItem value="name">Name</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                className="border-white/10 hover:bg-white/5"
              >
                {sortOrder === "asc" ? "↑" : "↓"}
              </Button>
            </div>
          </div>
        </div>

        {/* Users Table */}
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
                {usersQuery.isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                      Loading users...
                    </td>
                  </tr>
                ) : usersQuery.data?.users.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                      No users found
                    </td>
                  </tr>
                ) : (
                  usersQuery.data?.users.map((u) => (
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
                            <div className="font-medium">{u.name || "Unnamed"}</div>
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
                          onClick={() => {
                            setSelectedUserId(u.id);
                            setActiveTab("profile");
                          }}
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

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-white/10">
              <div className="text-sm text-gray-400">
                Showing {page * ITEMS_PER_PAGE + 1} to {Math.min((page + 1) * ITEMS_PER_PAGE, usersQuery.data?.total || 0)} of {usersQuery.data?.total || 0}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page - 1)}
                  disabled={page === 0}
                  className="border-white/10 hover:bg-white/5"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page + 1)}
                  disabled={page >= totalPages - 1}
                  className="border-white/10 hover:bg-white/5"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* User Details Modal */}
      <Dialog open={!!selectedUserId} onOpenChange={(open) => !open && setSelectedUserId(null)}>
        <DialogContent className="max-w-2xl bg-[#0f0f0f] border-white/10 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCog className="w-5 h-5 text-purple-400" />
              User Details
            </DialogTitle>
          </DialogHeader>

          {userDetailsQuery.isLoading ? (
            <div className="py-8 text-center">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-gray-400" />
              Loading user details...
            </div>
          ) : selectedUser ? (
            <div className="space-y-4">
              {/* Tabs */}
              <div className="flex gap-2 border-b border-white/10 pb-2">
                {(["profile", "credits", "activity"] as const).map((tab) => (
                  <Button
                    key={tab}
                    variant={activeTab === tab ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setActiveTab(tab)}
                    className={activeTab === tab ? "bg-purple-600" : "text-gray-400 hover:text-white"}
                  >
                    {tab === "profile" && <User className="w-4 h-4 mr-1" />}
                    {tab === "credits" && <Coins className="w-4 h-4 mr-1" />}
                    {tab === "activity" && <Activity className="w-4 h-4 mr-1" />}
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </Button>
                ))}
              </div>

              {/* Profile Tab */}
              {activeTab === "profile" && (
                <div className="space-y-4">
                  <div className="flex items-start gap-4">
                    {selectedUser.user.avatarUrl ? (
                      <img src={selectedUser.user.avatarUrl} alt="" className="w-16 h-16 rounded-full object-cover" />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-purple-500/20 flex items-center justify-center">
                        <User className="w-8 h-8 text-purple-400" />
                      </div>
                    )}
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold">{selectedUser.user.name || "Unnamed"}</h3>
                      <p className="text-gray-400">{selectedUser.user.email || "No email"}</p>
                      <div className="flex gap-2 mt-2">
                        <StatusBadge status={getUserStatus(selectedUser.user)} />
                        <RoleBadge role={selectedUser.user.role} />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-400">User ID:</span>
                      <span className="ml-2">{selectedUser.user.id}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Open ID:</span>
                      <span className="ml-2 font-mono text-xs">{selectedUser.user.openId.slice(0, 16)}...</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Joined:</span>
                      <span className="ml-2">{formatDate(selectedUser.user.createdAt)}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Last Active:</span>
                      <span className="ml-2">{formatDate(selectedUser.user.lastSignedIn)}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Models:</span>
                      <span className="ml-2">{selectedUser.stats.totalModels}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Generations:</span>
                      <span className="ml-2">{selectedUser.stats.totalGenerations}</span>
                    </div>
                  </div>

                  {selectedUser.user.suspendedAt && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                      <div className="flex items-center gap-2 text-red-400 font-medium">
                        <AlertTriangle className="w-4 h-4" />
                        Account Suspended
                      </div>
                      <p className="text-sm text-gray-400 mt-1">
                        Reason: {selectedUser.user.suspendedReason || "No reason provided"}
                      </p>
                      <p className="text-sm text-gray-400">
                        Since: {formatDate(selectedUser.user.suspendedAt)}
                      </p>
                    </div>
                  )}

                  {selectedUser.user.lockedUntil && new Date(selectedUser.user.lockedUntil) > new Date() && (
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                      <div className="flex items-center gap-2 text-amber-400 font-medium">
                        <Lock className="w-4 h-4" />
                        Account Temporarily Locked
                      </div>
                      <p className="text-sm text-gray-400 mt-1">
                        Until: {formatDate(selectedUser.user.lockedUntil)}
                      </p>
                      <p className="text-sm text-gray-400">
                        Failed attempts: {selectedUser.user.failedLoginAttempts}
                      </p>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 pt-2">
                    {selectedUser.user.suspendedAt ? (
                      <Button
                        onClick={handleUnsuspend}
                        disabled={unsuspendMutation.isPending}
                        className="bg-emerald-600 hover:bg-emerald-700"
                      >
                        <Shield className="w-4 h-4 mr-2" />
                        Unsuspend User
                      </Button>
                    ) : (
                      <Button
                        onClick={() => setSuspendModalOpen(true)}
                        disabled={selectedUser.user.role === "admin"}
                        variant="destructive"
                      >
                        <ShieldOff className="w-4 h-4 mr-2" />
                        Suspend User
                      </Button>
                    )}
                    {/* Role change buttons - only for non-admin users */}
                    {selectedUser.user.role !== "admin" && (
                      selectedUser.user.role === "moderator" ? (
                        <Button
                          onClick={() => {
                            setRoleChangeTarget("user");
                            setRoleModalOpen(true);
                          }}
                          variant="outline"
                          className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                        >
                          <ShieldOff className="w-4 h-4 mr-2" />
                          Demote to User
                        </Button>
                      ) : (
                        <Button
                          onClick={() => {
                            setRoleChangeTarget("moderator");
                            setRoleModalOpen(true);
                          }}
                          variant="outline"
                          className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                        >
                          <Shield className="w-4 h-4 mr-2" />
                          Promote to Moderator
                        </Button>
                      )
                    )}
                  </div>
                </div>
              )}

              {/* Credits Tab */}
              {activeTab === "credits" && (
                <div className="space-y-4">
                  {selectedUser.credits ? (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                          <div className="text-3xl font-bold text-purple-400">{selectedUser.credits.balance}</div>
                          <div className="text-sm text-gray-400">Current Balance</div>
                        </div>
                        <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                          <div className="text-xl font-semibold capitalize">{selectedUser.credits.planTier}</div>
                          <div className="text-sm text-gray-400">Plan Tier</div>
                        </div>
                        <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                          <div className="text-xl font-semibold">{selectedUser.credits.creditsPurchased}</div>
                          <div className="text-sm text-gray-400">Credits Purchased</div>
                        </div>
                        <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                          <div className="text-xl font-semibold">{selectedUser.credits.creditsUsed}</div>
                          <div className="text-sm text-gray-400">Credits Used</div>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          onClick={() => {
                            setCreditAction("add");
                            setCreditModalOpen(true);
                          }}
                          className="bg-emerald-600 hover:bg-emerald-700"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Add Credits
                        </Button>
                        <Button
                          onClick={() => {
                            setCreditAction("deduct");
                            setCreditModalOpen(true);
                          }}
                          variant="outline"
                          className="border-white/10 hover:bg-white/5"
                        >
                          <Minus className="w-4 h-4 mr-2" />
                          Deduct Credits
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-8 text-gray-400">
                      No credits record found for this user
                    </div>
                  )}
                </div>
              )}

              {/* Activity Tab */}
              {activeTab === "activity" && (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {userActivityQuery.isLoading ? (
                    <div className="py-8 text-center">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-gray-400" />
                      Loading activity...
                    </div>
                  ) : userActivityQuery.data?.logs.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                      No activity found for this user
                    </div>
                  ) : (
                    userActivityQuery.data?.logs.map((log) => (
                      <div key={log.id} className="bg-white/5 rounded-lg p-3 border border-white/10">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{log.action}</span>
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            log.severity === "critical" ? "bg-red-500/20 text-red-400" :
                            log.severity === "warning" ? "bg-amber-500/20 text-amber-400" :
                            "bg-gray-500/20 text-gray-400"
                          }`}>
                            {log.severity}
                          </span>
                        </div>
                        <div className="text-sm text-gray-400 mt-1">
                          {formatDate(typeof log.createdAt === 'string' ? log.createdAt : log.createdAt.toISOString())}
                        </div>
                        {log.resourceType && (
                          <div className="text-xs text-gray-500 mt-1">
                            {log.resourceType}: {log.resourceId}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="py-8 text-center text-gray-400">
              User not found
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Suspend Modal */}
      <Dialog open={suspendModalOpen} onOpenChange={setSuspendModalOpen}>
        <DialogContent className="bg-[#0f0f0f] border-white/10 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-400">
              <ShieldOff className="w-5 h-5" />
              Suspend User
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              This will immediately block the user from accessing their account.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-400">Reason for suspension</label>
              <Textarea
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                placeholder="Enter the reason for suspending this user..."
                className="mt-1 bg-white/5 border-white/10"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuspendModalOpen(false)} className="border-white/10">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleSuspend}
              disabled={!suspendReason.trim() || suspendMutation.isPending}
            >
              {suspendMutation.isPending ? "Suspending..." : "Suspend User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Credit Adjustment Modal */}
      <Dialog open={creditModalOpen} onOpenChange={setCreditModalOpen}>
        <DialogContent className="bg-[#0f0f0f] border-white/10 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Coins className={creditAction === "add" ? "text-emerald-400" : "text-amber-400"} />
              {creditAction === "add" ? "Add Credits" : "Deduct Credits"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-400">Amount</label>
              <Input
                type="number"
                value={creditAmount}
                onChange={(e) => setCreditAmount(e.target.value)}
                placeholder="Enter amount..."
                min="1"
                className="mt-1 bg-white/5 border-white/10"
              />
            </div>
            <div>
              <label className="text-sm text-gray-400">Reason</label>
              <Textarea
                value={creditReason}
                onChange={(e) => setCreditReason(e.target.value)}
                placeholder="Enter the reason for this adjustment..."
                className="mt-1 bg-white/5 border-white/10"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreditModalOpen(false)} className="border-white/10">
              Cancel
            </Button>
            <Button
              onClick={handleAdjustCredits}
              disabled={!creditAmount || !creditReason.trim() || adjustCreditsMutation.isPending}
              className={creditAction === "add" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-amber-600 hover:bg-amber-700"}
            >
              {adjustCreditsMutation.isPending ? "Processing..." : creditAction === "add" ? "Add Credits" : "Deduct Credits"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Role Change Modal */}
      <Dialog open={roleModalOpen} onOpenChange={setRoleModalOpen}>
        <DialogContent className="bg-[#0f0f0f] border-white/10 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {roleChangeTarget === "moderator" ? (
                <>
                  <Shield className="w-5 h-5 text-blue-400" />
                  Promote to Moderator
                </>
              ) : (
                <>
                  <UserCog className="w-5 h-5 text-amber-400" />
                  Demote to User
                </>
              )}
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              {roleChangeTarget === "moderator"
                ? "This user will gain access to the moderator dashboard with read-only audit logs, user activity, and the ability to escalate issues to admins via Slack."
                : "This user will lose moderator access and return to standard user permissions."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedUser && (
              <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                <div className="flex items-center gap-3">
                  {selectedUser.user.avatarUrl ? (
                    <img src={selectedUser.user.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                      <User className="w-5 h-5 text-purple-400" />
                    </div>
                  )}
                  <div>
                    <div className="font-medium">{selectedUser.user.name || "Unnamed"}</div>
                    <div className="text-sm text-gray-400">{selectedUser.user.email || "No email"}</div>
                  </div>
                  <div className="ml-auto flex items-center gap-2 text-sm">
                    <RoleBadge role={selectedUser.user.role} />
                    <span className="text-gray-500">→</span>
                    <RoleBadge role={roleChangeTarget} />
                  </div>
                </div>
              </div>
            )}
            <div>
              <label className="text-sm text-gray-400">Reason for role change</label>
              <Textarea
                value={roleChangeReason}
                onChange={(e) => setRoleChangeReason(e.target.value)}
                placeholder={roleChangeTarget === "moderator"
                  ? "e.g., Trusted community member, needs access to review reports..."
                  : "e.g., No longer needed, stepping down from moderation duties..."}
                className="mt-1 bg-white/5 border-white/10"
              />
            </div>
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
              <div className="flex items-center gap-2 text-amber-400 text-sm font-medium">
                <AlertTriangle className="w-4 h-4" />
                This action will be logged and reported to Slack
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleModalOpen(false)} className="border-white/10">
              Cancel
            </Button>
            <Button
              onClick={handleChangeRole}
              disabled={!roleChangeReason.trim() || changeRoleMutation.isPending}
              className={roleChangeTarget === "moderator" ? "bg-blue-600 hover:bg-blue-700" : "bg-amber-600 hover:bg-amber-700"}
            >
              {changeRoleMutation.isPending
                ? "Processing..."
                : roleChangeTarget === "moderator"
                  ? "Promote to Moderator"
                  : "Demote to User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
