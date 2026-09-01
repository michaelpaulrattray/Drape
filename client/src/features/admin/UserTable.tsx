/**
 * Admin → Users, on the one staff table pattern (brief 06).
 *
 * # What changed, and why the row rather than a modal
 *
 * `UserDetailModal` is gone. Its three tabs are this row's three sub-tabs, its
 * six profile facts are the facts grid, and its eight buttons are the actions
 * row. The founder's §2 reason, in his order of weight: *"You keep your
 * place."* An admin working a 300-row list opens an account, acts, closes, and
 * needs the NEXT row — a modal loses the surrounding rows and makes them
 * re-find their position afterwards.
 *
 * The **Actions** column went with it. Twenty identical `Manage` buttons is a
 * column whose every cell is the same, which is the same rule that took the
 * shared perk off the plan cards.
 *
 * # The four form modals STAY, and that is the line
 *
 * Suspend, freeze, credit-adjust and role-change all need a typed reason
 * before they fire. **A dialog is right for "type a reason and confirm" and
 * wrong for "show me this"** — `ExpandableRow`'s own docblock draws that line,
 * and this surface is the first to sit on both sides of it.
 */
import { StatePill, RolePill, RowId, RowStack, pageRange, SUSPEND_CONSEQUENCE } from "@/features/staff";
import { DataTable, MiniList } from "@/foundation";
import type { DataRow, RowAction } from "@/foundation";

import { formatDate, getUserStatus } from "./UserBadges";

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

type ActivityLog = {
  id: number;
  action: string;
  severity: string;
  createdAt: string | Date;
  resourceType?: string | null;
  resourceId?: string | null;
};

export type UserDetail = {
  user: {
    id: number;
    name: string | null;
    email: string | null;
    openId: string;
    role: string;
    suspendedAt: Date | string | null;
    suspendedReason: string | null;
    frozenAt: Date | string | null;
    frozenReason: string | null;
    frozenBy: string | null;
    lockedUntil: Date | string | null;
    failedLoginAttempts: number;
    createdAt: Date | string;
    lastSignedIn: Date | string;
  };
  stats: { totalModels: number; totalGenerations: number };
  credits: {
    balance: number;
    planTier: string;
    creditsPurchased: number;
    creditsUsed: number;
  } | null;
};

/** The states an admin is scanning for. `active` is not one of them. */
const ATTENTION = new Set(["suspended", "frozen", "locked"]);

interface UserTableProps {
  users: UserRow[] | undefined;
  isLoading: boolean;
  page: number;
  totalPages: number;
  total: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  /** The open row IS the selection — opening one is what loads its detail. */
  selectedUserId: number | null;
  onSelectUser: (userId: number | null) => void;
  detail: UserDetail | undefined;
  detailLoading: boolean;
  activeTab: "profile" | "credits" | "activity";
  onTabChange: (tab: "profile" | "credits" | "activity") => void;
  activityLogs: ActivityLog[] | undefined;
  activityLoading: boolean;
  onSuspend: () => void;
  onUnsuspend: () => void;
  unsuspendPending: boolean;
  onPromote: () => void;
  onDemote: () => void;
  onAddCredits: () => void;
  onDeductCredits: () => void;
  onFreeze: () => void;
  onUnfreeze: () => void;
  freezePending: boolean;
  unfreezePending: boolean;
}

export function UserTable({
  users,
  isLoading,
  page,
  totalPages,
  total,
  itemsPerPage,
  onPageChange,
  selectedUserId,
  onSelectUser,
  detail,
  detailLoading,
  activeTab,
  onTabChange,
  activityLogs,
  activityLoading,
  onSuspend,
  onUnsuspend,
  unsuspendPending,
  onPromote,
  onDemote,
  onAddCredits,
  onDeductCredits,
  onFreeze,
  onUnfreeze,
  freezePending,
  unfreezePending,
}: UserTableProps) {
  const rows: DataRow[] = (users ?? []).map((user) => {
    const status = getUserStatus(user);
    const open = selectedUserId === user.id;
    const loaded = open && detail?.user.id === user.id ? detail : undefined;

    return {
      id: String(user.id),
      cells: [
        <RowStack
          key="who"
          name={
            <>
              <RowId>#{user.id}</RowId> {user.name || "Unnamed"}
            </>
          }
          meta={user.email || "No email"}
        />,
        <StatePill key="status" label={status} attention={ATTENTION.has(status)} />,
        <RolePill key="role" role={user.role} />,
        <span key="joined">{formatDate(user.createdAt)}</span>,
        <span key="active">{formatDate(user.lastSignedIn)}</span>,
      ],
      facts: loaded
        ? [
            { label: "USER ID", value: loaded.user.id },
            { label: "OPEN ID", value: loaded.user.openId },
            { label: "JOINED", value: formatDate(loaded.user.createdAt) },
            { label: "LAST ACTIVE", value: formatDate(loaded.user.lastSignedIn) },
            { label: "CASTS", value: loaded.stats.totalModels },
            { label: "GENERATIONS", value: loaded.stats.totalGenerations },
          ]
        : [{ label: "USER ID", value: user.id }],
      subTabs: [
        { value: "profile", label: "Profile" },
        { value: "credits", label: "Credits" },
        { value: "activity", label: "Activity" },
      ],
      subTab: activeTab,
      onSubTab: (value) => onTabChange(value as "profile" | "credits" | "activity"),
      panel: open ? (
        <UserPanel
          detail={loaded}
          loading={detailLoading}
          tab={activeTab}
          activityLogs={activityLogs}
          activityLoading={activityLoading}
        />
      ) : null,
      /* The reason each state's own sentence is written out rather than
         generated: "This will suspend the user" is the button label wearing a
         sentence. What an admin needs to know is what it does to the person. */
      evidence: loaded ? stateNote(loaded) : undefined,
      actions: loaded ? userActions(loaded) : [],
    };

    function userActions(loadedDetail: UserDetail): RowAction[] {
      const actions: RowAction[] = [];
      const u = loadedDetail.user;

      if (u.suspendedAt) {
        actions.push({
          key: "unsuspend",
          label: unsuspendPending ? "Unsuspending…" : "Unsuspend",
          onClick: onUnsuspend,
          disabled: unsuspendPending,
          variant: "secondary",
        });
      } else {
        actions.push({
          key: "suspend",
          label: "Suspend",
          onClick: onSuspend,
          disabled: u.role === "admin",
          destructive: true,
          consequence: SUSPEND_CONSEQUENCE,
        });
      }

      if (u.frozenAt) {
        actions.push({
          key: "unfreeze",
          label: unfreezePending ? "Unfreezing…" : "Unfreeze",
          onClick: onUnfreeze,
          disabled: unfreezePending,
          variant: "secondary",
        });
      } else {
        actions.push({
          key: "freeze",
          label: "Freeze",
          onClick: onFreeze,
          disabled: freezePending || u.role === "admin",
          destructive: true,
          consequence:
            "Freezing stops new generations and credit spending but leaves them signed in and able to look at their work.",
        });
      }

      if (u.role === "user") {
        actions.push({ key: "promote", label: "Make moderator", onClick: onPromote });
      } else if (u.role === "moderator") {
        actions.push({
          key: "demote",
          label: "Remove moderator",
          onClick: onDemote,
          destructive: true,
          consequence:
            "They keep their own account and work; they lose the moderation panel and everything behind it.",
        });
      }

      actions.push({ key: "add", label: "Add credits", onClick: onAddCredits });
      actions.push({
        key: "deduct",
        label: "Deduct credits",
        onClick: onDeductCredits,
        destructive: true,
        consequence:
          "Deducting takes credits off the balance immediately. It does not refund money and it cannot be undone from here.",
      });
      return actions;
    }
  });

  return (
    <DataTable
      columns={[
        { label: "User", width: "1 1 0" },
        { label: "Status", width: "0 0 104px" },
        { label: "Role", width: "0 0 104px" },
        { label: "Joined", width: "0 0 148px" },
        { label: "Last active", width: "0 0 148px" },
      ]}
      rows={rows}
      loading={isLoading}
      openId={selectedUserId === null ? null : String(selectedUserId)}
      onOpenChange={(id) => onSelectUser(id === null ? null : Number(id))}
      empty={{
        title: "No users match those filters.",
        body: "Clear the filters or search a different term.",
      }}
      footer={{
        meta: pageRange({ offset: page * itemsPerPage, count: users?.length ?? 0, total }),
        onBack: () => onPageChange(Math.max(0, page - 1)),
        onNext: () => onPageChange(page + 1),
        backDisabled: page === 0,
        nextDisabled: page >= totalPages - 1,
      }}
    />
  );
}

/**
 * The banner that used to be three coloured boxes inside the modal, as one
 * sentence on the evidence block. It appears ONLY when there is something to
 * say — an active account's expansion has no banner at all.
 */
function stateNote(detail: UserDetail): string | undefined {
  const u = detail.user;
  const parts: string[] = [];
  if (u.suspendedAt) {
    parts.push(
      `Suspended ${formatDate(u.suspendedAt)} — ${u.suspendedReason || "no reason recorded"}.`,
    );
  }
  if (u.frozenAt) {
    const by =
      u.frozenBy === "system"
        ? "the automatic discrepancy scan"
        : u.frozenBy
          ? `admin #${u.frozenBy}`
          : "an admin";
    parts.push(
      `Frozen ${formatDate(u.frozenAt)} by ${by} — ${u.frozenReason || "no reason recorded"}.`,
    );
  }
  if (u.lockedUntil && new Date(u.lockedUntil) > new Date()) {
    parts.push(
      `Locked out until ${formatDate(u.lockedUntil)} after ${u.failedLoginAttempts} failed sign-in attempts. This one clears itself.`,
    );
  }
  return parts.length > 0 ? parts.join(" ") : undefined;
}

function UserPanel({
  detail,
  loading,
  tab,
  activityLogs,
  activityLoading,
}: {
  detail: UserDetail | undefined;
  loading: boolean;
  tab: "profile" | "credits" | "activity";
  activityLogs: ActivityLog[] | undefined;
  activityLoading: boolean;
}) {
  if (loading || !detail) {
    return <p className="dp-minilist__empty">Loading this account…</p>;
  }

  if (tab === "credits") {
    if (!detail.credits) {
      return <p className="dp-minilist__empty">This account has no credits record.</p>;
    }
    return (
      <MiniList
        empty="No credits record."
        entries={[
          { key: "balance", when: "Now", what: "Balance", amount: `${detail.credits.balance} cr` },
          { key: "plan", when: "Plan", what: "Tier", amount: detail.credits.planTier },
          {
            key: "bought",
            when: "All time",
            what: "Purchased",
            amount: `${detail.credits.creditsPurchased} cr`,
          },
          {
            key: "used",
            when: "All time",
            what: "Used",
            amount: `${detail.credits.creditsUsed} cr`,
          },
        ]}
      />
    );
  }

  if (tab === "activity") {
    if (activityLoading) {
      return <p className="dp-minilist__empty">Loading activity…</p>;
    }
    return (
      <MiniList
        empty="No recorded activity for this account."
        entries={(activityLogs ?? []).map((log) => ({
          key: String(log.id),
          when: shortTime(log.createdAt),
          what: log.resourceType ? `${log.action} · ${log.resourceType} ${log.resourceId ?? ""}` : log.action,
          amount: log.severity,
          alert: log.severity === "critical" || log.severity === "warning",
        }))}
      />
    );
  }

  /* Profile: the facts grid above already IS the profile, so this pane says
     the one thing the grid cannot — nothing, when there is nothing to add. */
  return null;
}

function shortTime(value: string | Date): string {
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
