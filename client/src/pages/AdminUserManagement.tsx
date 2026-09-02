import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Redirect } from "wouter";
import { useState } from "react";
import { RefreshCw, Snowflake } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  StaffBarAdmin,
  StaffLoading,
  StaffSurface,
  useStaffRefresh,
  STAFF_REFRESH_INTERVAL_MS,
} from "@/features/staff";
import { UserStatsCards } from "@/features/admin/UserStatsCards";
import { UserFilters } from "@/features/admin/UserFilters";
import { UserTable } from "@/features/admin/UserTable";
import { SuspendModal, CreditModal, RoleChangeModal } from "@/features/admin/UserActionModals";

const ITEMS_PER_PAGE = 20;

export default function AdminUserManagement() {
  const { user, isAuthenticated, loading } = useAuth();

  // List state
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "suspended" | "locked" | "frozen">("all");
  const [roleFilter, setRoleFilter] = useState<"all" | "user" | "admin" | "moderator">("all");
  const [sortBy, setSortBy] = useState<"createdAt" | "lastSignedIn" | "name">("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Detail state
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"profile" | "credits" | "activity">("profile");

  // Modal state
  const [suspendModalOpen, setSuspendModalOpen] = useState(false);
  const [suspendReason, setSuspendReason] = useState("");
  const [creditModalOpen, setCreditModalOpen] = useState(false);
  const [creditAmount, setCreditAmount] = useState("");
  const [creditReason, setCreditReason] = useState("");
  const [creditAction, setCreditAction] = useState<"add" | "deduct">("add");
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [roleChangeTarget, setRoleChangeTarget] = useState<"user" | "moderator">("moderator");
  const [roleChangeReason, setRoleChangeReason] = useState("");
  const [freezeModalOpen, setFreezeModalOpen] = useState(false);
  const [freezeReason, setFreezeReason] = useState("");
  const [unfreezeModalOpen, setUnfreezeModalOpen] = useState(false);
  const [unfreezeNotes, setUnfreezeNotes] = useState("");

  /*
    ⚠ #413's LAW-7 SWEEP FOUND THIS PAGE, AND THE CARD'S OWN TABLE DID NOT.
    That table was built by grepping staff pages for `refreshControls` and
    listed Users as having the cluster. It had the PROP and two of its five
    fields — a manual button alone, no stamp and no toggle — so it failed two
    of the three things he named while satisfying the grep. A property is
    proven at the values, not at the prop name.
  */
  const [autoRefresh, setAutoRefresh] = useState(false);

  // Queries
  const statsQuery = trpc.admin.getUserStats.useQuery(undefined, {
    enabled: isAuthenticated && user?.role === "admin",
    refetchInterval: autoRefresh ? STAFF_REFRESH_INTERVAL_MS : false,
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
    refetchInterval: autoRefresh ? STAFF_REFRESH_INTERVAL_MS : false,
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
    onSuccess: () => { toast.success("User suspended successfully"); setSuspendModalOpen(false); setSuspendReason(""); usersQuery.refetch(); userDetailsQuery.refetch(); },
    onError: (error) => { toast.error(error.message); },
  });

  const unsuspendMutation = trpc.admin.unsuspendUser.useMutation({
    onSuccess: () => { toast.success("User unsuspended successfully"); usersQuery.refetch(); userDetailsQuery.refetch(); },
    onError: (error) => { toast.error(error.message); },
  });

  const adjustCreditsMutation = trpc.admin.adjustCredits.useMutation({
    onSuccess: (data) => { toast.success(`Credits adjusted. New balance: ${data.newBalance}`); setCreditModalOpen(false); setCreditAmount(""); setCreditReason(""); userDetailsQuery.refetch(); },
    onError: (error) => { toast.error(error.message); },
  });

  const changeRoleMutation = trpc.admin.changeUserRole.useMutation({
    onSuccess: (data) => { toast.success(`Role changed: ${data.previousRole} → ${data.newRole}`); setRoleModalOpen(false); setRoleChangeReason(""); usersQuery.refetch(); userDetailsQuery.refetch(); },
    onError: (error) => { toast.error(error.message); },
  });

  const freezeMutation = trpc.admin.freezeUser.useMutation({
    onSuccess: () => { toast.success("Account frozen successfully"); setFreezeModalOpen(false); setFreezeReason(""); usersQuery.refetch(); userDetailsQuery.refetch(); },
    onError: (error) => { toast.error(error.message); },
  });

  const unfreezeMutation = trpc.admin.unfreezeUser.useMutation({
    onSuccess: () => { toast.success("Account unfrozen successfully"); setUnfreezeModalOpen(false); setUnfreezeNotes(""); usersQuery.refetch(); userDetailsQuery.refetch(); },
    onError: (error) => { toast.error(error.message); },
  });

  // Handlers
  const handleSearch = (value: string) => { setSearch(value); setPage(0); };

  const handleSuspend = () => {
    if (!selectedUserId || !suspendReason.trim()) return;
    suspendMutation.mutate({ userId: selectedUserId, reason: suspendReason });
  };

  const handleAdjustCredits = () => {
    if (!selectedUserId || !creditAmount || !creditReason.trim()) return;
    const amount = parseInt(creditAmount);
    if (isNaN(amount) || amount <= 0) { toast.error("Please enter a valid positive amount"); return; }
    adjustCreditsMutation.mutate({ userId: selectedUserId, amount: creditAction === "deduct" ? -amount : amount, reason: creditReason });
  };

  const handleChangeRole = () => {
    if (!selectedUserId || !roleChangeReason.trim()) return;
    changeRoleMutation.mutate({ userId: selectedUserId, newRole: roleChangeTarget, reason: roleChangeReason });
  };

  const handleFreeze = () => {
    if (!selectedUserId || !freezeReason.trim()) return;
    freezeMutation.mutate({ userId: selectedUserId, reason: freezeReason });
  };

  const handleUnfreeze = () => {
    if (!selectedUserId || !unfreezeNotes.trim()) return;
    unfreezeMutation.mutate({ userId: selectedUserId, notes: unfreezeNotes });
  };

  const refreshControls = useStaffRefresh({
    autoRefresh,
    setAutoRefresh,
    dataUpdatedAt: usersQuery.dataUpdatedAt,
    isRefetching: usersQuery.isFetching || statsQuery.isFetching,
    onRefresh: () => {
      usersQuery.refetch();
      statsQuery.refetch();
      toast.success("Users refreshed");
    },
  });

  /* ⚠ Every hook above this line — the guards below return early. */
  // Auth guards
  if (loading) return <StaffLoading />;
  if (!isAuthenticated) return <Redirect to="/" />;
  /* Brief 05 §6 — the redirect is silent now. The `toast.error` that used to
     sit here fired from the render body, which double-fires under strict mode,
     and somebody who cannot see Admin does not need telling why. */
  if (user?.role !== "admin") return <Redirect to="/app" />;

  const totalPages = Math.ceil((usersQuery.data?.total || 0) / ITEMS_PER_PAGE);

  return (
    <StaffSurface
      breadcrumb="Admin / Users"
      /*
        ⚠ THE COMMENT THAT STOOD HERE WAS FALSE AT THE CODE, AND IT IS WHY THIS
        PAGE SAT WRONG FOR A MONTH. It said the page *"keeps no stamp and no
        auto-refresh preference, and the frame does not invent either"* —
        reading as a decision when it was an omission. `dataUpdatedAt` is
        produced by every TanStack query and `AdminOverview` has read its stamp
        from exactly that field since brief 05 shipped. The state was never
        missing; it was never wired.
      */
      bar={<StaffBarAdmin refreshControls={refreshControls} />}
    >
      <main className="space-y-6">
        <UserStatsCards stats={statsQuery.data} />

        <UserFilters
          searchInput={searchInput}
          onSearchInputChange={setSearchInput}
          onSearch={handleSearch}
          statusFilter={statusFilter}
          onStatusFilterChange={(v) => { setStatusFilter(v); setPage(0); }}
          roleFilter={roleFilter}
          onRoleFilterChange={(v) => { setRoleFilter(v); setPage(0); }}
          sortBy={sortBy}
          onSortByChange={(v) => { setSortBy(v); setPage(0); }}
          sortOrder={sortOrder}
          onSortOrderChange={setSortOrder}
        />

        {/* Brief 06 §2 — the row opens in place. `selectedUserId` is now the
            OPEN ROW rather than a modal's subject, so the detail query below is
            unchanged: same procedure, same input, a different trigger. */}
        <UserTable
          users={usersQuery.data?.users}
          isLoading={usersQuery.isLoading}
          page={page}
          totalPages={totalPages}
          total={usersQuery.data?.total || 0}
          itemsPerPage={ITEMS_PER_PAGE}
          onPageChange={setPage}
          selectedUserId={selectedUserId}
          onSelectUser={(id) => { setSelectedUserId(id); setActiveTab("profile"); }}
          detail={userDetailsQuery.data ?? undefined}
          detailLoading={userDetailsQuery.isLoading}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          activityLogs={userActivityQuery.data?.logs}
          activityLoading={userActivityQuery.isLoading}
          onSuspend={() => setSuspendModalOpen(true)}
          onUnsuspend={() => { if (selectedUserId) unsuspendMutation.mutate({ userId: selectedUserId }); }}
          unsuspendPending={unsuspendMutation.isPending}
          onPromote={() => { setRoleChangeTarget("moderator"); setRoleModalOpen(true); }}
          onDemote={() => { setRoleChangeTarget("user"); setRoleModalOpen(true); }}
          onAddCredits={() => { setCreditAction("add"); setCreditModalOpen(true); }}
          onDeductCredits={() => { setCreditAction("deduct"); setCreditModalOpen(true); }}
          onFreeze={() => setFreezeModalOpen(true)}
          onUnfreeze={() => setUnfreezeModalOpen(true)}
          freezePending={freezeMutation.isPending}
          unfreezePending={unfreezeMutation.isPending}
        />
      </main>

      <SuspendModal
        open={suspendModalOpen}
        onOpenChange={setSuspendModalOpen}
        reason={suspendReason}
        onReasonChange={setSuspendReason}
        onConfirm={handleSuspend}
        isPending={suspendMutation.isPending}
      />

      <CreditModal
        open={creditModalOpen}
        onOpenChange={setCreditModalOpen}
        action={creditAction}
        amount={creditAmount}
        onAmountChange={setCreditAmount}
        reason={creditReason}
        onReasonChange={setCreditReason}
        onConfirm={handleAdjustCredits}
        isPending={adjustCreditsMutation.isPending}
      />

      <RoleChangeModal
        open={roleModalOpen}
        onOpenChange={setRoleModalOpen}
        targetRole={roleChangeTarget}
        reason={roleChangeReason}
        onReasonChange={setRoleChangeReason}
        onConfirm={handleChangeRole}
        isPending={changeRoleMutation.isPending}
        selectedUser={userDetailsQuery.data ?? undefined}
      />

      {/*
        ⚠ THE TWO DIALOGS #421'S FIRST TABLE DID NOT LIST, and the reason they
        were missed is worth a line: both reports behind that card were written
        from inside `features/admin/`, and these two are drawn INLINE on the
        page rather than extracted into a modals module. The card's own "same
        for freeze" sentence described them while its file table could not see
        them — a population inherited from a report is only as wide as the
        report. Found by deriving the list from every staff file that mounts a
        `Dialog`, which is how the change request modal turned up too.

        They keep `<textarea>` rather than the `Textarea` primitive: swapping
        the element is a behaviour change (IME guard, field sizing) and #421's
        bar is that every field behaves exactly as before. So the colours come
        off and the element does not move.
      */}

      {/* Freeze Modal */}
      <Dialog open={freezeModalOpen} onOpenChange={setFreezeModalOpen}>
        <DialogContent className="text-foreground">
          <DialogHeader>
            {/*
              The cyan and the emerald are both gone and neither is replaced.
              Freezing is reversible — Unfreeze sits two rows below it — so it
              does not earn the one red, and a colour that means nothing in this
              palette is worse than no colour. The icon and the words carry it.
            */}
            <DialogTitle className="flex items-center gap-2">
              <Snowflake className="w-5 h-5 text-muted-foreground" />
              Freeze account
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Freezing restricts the user from generating content or spending credits. This is lighter than a full suspension.</p>
          <textarea
            value={freezeReason}
            onChange={(e) => setFreezeReason(e.target.value)}
            placeholder="Reason for freezing this account..."
            className="w-full bg-transparent border border-input rounded-lg p-3 text-sm text-foreground placeholder:text-muted-foreground resize-none h-24 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none"
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setFreezeModalOpen(false)}>Cancel</Button>
            <Button onClick={handleFreeze} disabled={!freezeReason.trim() || freezeMutation.isPending}>
              {freezeMutation.isPending ? "Freezing..." : "Freeze account"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Unfreeze Modal */}
      <Dialog open={unfreezeModalOpen} onOpenChange={setUnfreezeModalOpen}>
        <DialogContent className="text-foreground">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Snowflake className="w-5 h-5 text-muted-foreground" />
              Unfreeze account
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">This will restore the user's ability to generate content and spend credits.</p>
          <textarea
            value={unfreezeNotes}
            onChange={(e) => setUnfreezeNotes(e.target.value)}
            placeholder="Notes for unfreezing (e.g., issue resolved, false positive)..."
            className="w-full bg-transparent border border-input rounded-lg p-3 text-sm text-foreground placeholder:text-muted-foreground resize-none h-24 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none"
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setUnfreezeModalOpen(false)}>Cancel</Button>
            <Button onClick={handleUnfreeze} disabled={!unfreezeNotes.trim() || unfreezeMutation.isPending}>
              {unfreezeMutation.isPending ? "Unfreezing..." : "Unfreeze account"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </StaffSurface>
  );
}
