import {
  User,
  UserCog,
  Coins,
  Activity,
  Shield,
  ShieldOff,
  RefreshCw,
  Plus,
  Minus,
  AlertTriangle,
  Lock,
  Snowflake,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge, RoleBadge, getUserStatus, formatDate } from "./UserBadges";

interface UserDetailData {
  user: {
    id: number;
    name: string | null;
    email: string | null;
    avatarUrl: string | null;
    openId: string;
    role: "user" | "admin" | "moderator";
    suspendedAt: string | Date | null;
    suspendedReason: string | null;
    frozenAt: string | Date | null;
    frozenReason: string | null;
    frozenBy: string | null;
    lockedUntil: string | Date | null;
    failedLoginAttempts: number;
    createdAt: string | Date;
    lastSignedIn: string | Date;
  };
  stats: {
    totalModels: number;
    totalGenerations: number;
  };
  credits: {
    balance: number;
    planTier: string;
    creditsPurchased: number;
    creditsUsed: number;
  } | null;
}

interface ActivityLog {
  id: number;
  action: string;
  severity: string;
  createdAt: string | Date;
  resourceType: string | null;
  resourceId: string | null;
}

interface UserDetailModalProps {
  open: boolean;
  onClose: () => void;
  selectedUser: UserDetailData | undefined;
  isLoading: boolean;
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

export function UserDetailModal({
  open,
  onClose,
  selectedUser,
  isLoading,
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
}: UserDetailModalProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl h-[600px] bg-white border-[#E5E5E5] text-[#0A0A0A] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[#0A0A0A]">
            <UserCog className="w-5 h-5 text-[#666]" />
            User Details
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#CCC]" />
              <span className="text-[#999]">Loading user details...</span>
            </div>
          </div>
        ) : selectedUser ? (
          <div className="flex flex-col flex-1 min-h-0">
            {/* Tabs */}
            <div className="flex gap-1 border-b border-[#E5E5E5] pb-2 shrink-0">
              {(["profile", "credits", "activity"] as const).map((tab) => (
                <Button
                  key={tab}
                  variant={activeTab === tab ? "default" : "ghost"}
                  size="sm"
                  onClick={() => onTabChange(tab)}
                  className={activeTab === tab
                    ? "bg-[#0A0A0A] hover:bg-[#222] text-white"
                    : "text-[#999] hover:text-[#0A0A0A] hover:bg-[#F0F0F0]"
                  }
                >
                  {tab === "profile" && <User className="w-4 h-4 mr-1" />}
                  {tab === "credits" && <Coins className="w-4 h-4 mr-1" />}
                  {tab === "activity" && <Activity className="w-4 h-4 mr-1" />}
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </Button>
              ))}
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto mt-4">
            {activeTab === "profile" && (
              <ProfileTabContent
                selectedUser={selectedUser}
                onSuspend={onSuspend}
                onUnsuspend={onUnsuspend}
                unsuspendPending={unsuspendPending}
                onPromote={onPromote}
                onDemote={onDemote}
                onFreeze={onFreeze}
                onUnfreeze={onUnfreeze}
                freezePending={freezePending}
                unfreezePending={unfreezePending}
              />
            )}
            {activeTab === "credits" && (
              <CreditsTabContent
                credits={selectedUser.credits}
                onAddCredits={onAddCredits}
                onDeductCredits={onDeductCredits}
              />
            )}
            {activeTab === "activity" && (
              <ActivityTabContent logs={activityLogs} isLoading={activityLoading} />
            )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-[#999]">User not found</div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ProfileTabContent({
  selectedUser,
  onSuspend,
  onUnsuspend,
  unsuspendPending,
  onPromote,
  onDemote,
  onFreeze,
  onUnfreeze,
  freezePending,
  unfreezePending,
}: {
  selectedUser: UserDetailData;
  onSuspend: () => void;
  onUnsuspend: () => void;
  unsuspendPending: boolean;
  onPromote: () => void;
  onDemote: () => void;
  onFreeze: () => void;
  onUnfreeze: () => void;
  freezePending: boolean;
  unfreezePending: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-4">
        {selectedUser.user.avatarUrl ? (
          <img src={selectedUser.user.avatarUrl} alt="" className="w-16 h-16 rounded-full object-cover ring-2 ring-[#E5E5E5]" />
        ) : (
          <div className="w-16 h-16 rounded-full bg-[#F0F0F0] flex items-center justify-center">
            <User className="w-8 h-8 text-[#999]" />
          </div>
        )}
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-[#0A0A0A]">{selectedUser.user.name || "Unnamed"}</h3>
          <p className="text-[#999]">{selectedUser.user.email || "No email"}</p>
          <div className="flex gap-2 mt-2">
            <StatusBadge status={getUserStatus(selectedUser.user)} />
            <RoleBadge role={selectedUser.user.role} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="bg-[#F8F8F8] rounded-lg p-3 border border-[#E5E5E5]">
          <span className="text-[#999] text-xs">User ID</span>
          <div className="font-medium text-[#0A0A0A]">{selectedUser.user.id}</div>
        </div>
        <div className="bg-[#F8F8F8] rounded-lg p-3 border border-[#E5E5E5]">
          <span className="text-[#999] text-xs">Open ID</span>
          <div className="font-mono text-xs text-[#0A0A0A]">{selectedUser.user.openId.slice(0, 16)}...</div>
        </div>
        <div className="bg-[#F8F8F8] rounded-lg p-3 border border-[#E5E5E5]">
          <span className="text-[#999] text-xs">Joined</span>
          <div className="font-medium text-[#0A0A0A]">{formatDate(selectedUser.user.createdAt)}</div>
        </div>
        <div className="bg-[#F8F8F8] rounded-lg p-3 border border-[#E5E5E5]">
          <span className="text-[#999] text-xs">Last Active</span>
          <div className="font-medium text-[#0A0A0A]">{formatDate(selectedUser.user.lastSignedIn)}</div>
        </div>
        <div className="bg-[#F8F8F8] rounded-lg p-3 border border-[#E5E5E5]">
          <span className="text-[#999] text-xs">Models</span>
          <div className="font-medium text-[#0A0A0A]">{selectedUser.stats.totalModels}</div>
        </div>
        <div className="bg-[#F8F8F8] rounded-lg p-3 border border-[#E5E5E5]">
          <span className="text-[#999] text-xs">Generations</span>
          <div className="font-medium text-[#0A0A0A]">{selectedUser.stats.totalGenerations}</div>
        </div>
      </div>

      {selectedUser.user.suspendedAt && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3">
          <div className="flex items-center gap-2 text-red-700 font-medium">
            <AlertTriangle className="w-4 h-4" />
            Account Suspended
          </div>
          <p className="text-sm text-red-600/70 mt-1">Reason: {selectedUser.user.suspendedReason || "No reason provided"}</p>
          <p className="text-sm text-red-600/70">Since: {formatDate(selectedUser.user.suspendedAt)}</p>
        </div>
      )}

      {selectedUser.user.frozenAt && (
        <div className="bg-cyan-50 border border-cyan-200 rounded-xl p-3">
          <div className="flex items-center gap-2 text-cyan-700 font-medium">
            <Snowflake className="w-4 h-4" />
            Account Frozen
          </div>
          <p className="text-sm text-cyan-600/70 mt-1">Reason: {selectedUser.user.frozenReason || "No reason provided"}</p>
          <p className="text-sm text-cyan-600/70">Since: {formatDate(selectedUser.user.frozenAt)}</p>
          {selectedUser.user.frozenBy && (
            <p className="text-sm text-cyan-600/70">By: {selectedUser.user.frozenBy === "system" ? "System (auto-freeze)" : `Admin #${selectedUser.user.frozenBy}`}</p>
          )}
        </div>
      )}

      {selectedUser.user.lockedUntil && new Date(selectedUser.user.lockedUntil) > new Date() && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
          <div className="flex items-center gap-2 text-amber-700 font-medium">
            <Lock className="w-4 h-4" />
            Account Temporarily Locked
          </div>
          <p className="text-sm text-amber-600/70 mt-1">Until: {formatDate(selectedUser.user.lockedUntil)}</p>
          <p className="text-sm text-amber-600/70">Failed attempts: {selectedUser.user.failedLoginAttempts}</p>
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-2">
        {selectedUser.user.suspendedAt ? (
          <Button onClick={onUnsuspend} disabled={unsuspendPending} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            <Shield className="w-4 h-4 mr-2" />
            Unsuspend User
          </Button>
        ) : (
          <Button onClick={onSuspend} disabled={selectedUser.user.role === "admin"} variant="destructive">
            <ShieldOff className="w-4 h-4 mr-2" />
            Suspend User
          </Button>
        )}
        {selectedUser.user.frozenAt ? (
          <Button onClick={onUnfreeze} disabled={unfreezePending} className="bg-cyan-600 hover:bg-cyan-700 text-white">
            <Snowflake className="w-4 h-4 mr-2" />
            {unfreezePending ? "Unfreezing..." : "Unfreeze Account"}
          </Button>
        ) : (
          <Button
            onClick={onFreeze}
            disabled={selectedUser.user.role === "admin" || freezePending}
            variant="outline"
            className="border-cyan-200 text-cyan-700 hover:bg-cyan-50"
          >
            <Snowflake className="w-4 h-4 mr-2" />
            {freezePending ? "Freezing..." : "Freeze Account"}
          </Button>
        )}
        {selectedUser.user.role !== "admin" && (
          selectedUser.user.role === "moderator" ? (
            <Button onClick={onDemote} variant="outline" className="border-amber-200 text-amber-700 hover:bg-amber-50">
              <ShieldOff className="w-4 h-4 mr-2" />
              Demote to User
            </Button>
          ) : (
            <Button onClick={onPromote} variant="outline" className="border-blue-200 text-blue-700 hover:bg-blue-50">
              <Shield className="w-4 h-4 mr-2" />
              Promote to Moderator
            </Button>
          )
        )}
      </div>
    </div>
  );
}

function CreditsTabContent({
  credits,
  onAddCredits,
  onDeductCredits,
}: {
  credits: UserDetailData["credits"];
  onAddCredits: () => void;
  onDeductCredits: () => void;
}) {
  if (!credits) {
    return <div className="text-center py-8 text-[#999]">No credits record found for this user</div>;
  }
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-[#F8F8F8] rounded-xl p-4 border border-[#E5E5E5]">
          <div className="text-3xl font-bold text-purple-600">{credits.balance}</div>
          <div className="text-xs text-[#999] mt-1 font-medium uppercase tracking-wide">Current Balance</div>
        </div>
        <div className="bg-[#F8F8F8] rounded-xl p-4 border border-[#E5E5E5]">
          <div className="text-xl font-semibold capitalize text-[#0A0A0A]">{credits.planTier}</div>
          <div className="text-xs text-[#999] mt-1 font-medium uppercase tracking-wide">Plan Tier</div>
        </div>
        <div className="bg-[#F8F8F8] rounded-xl p-4 border border-[#E5E5E5]">
          <div className="text-xl font-semibold text-[#0A0A0A]">{credits.creditsPurchased}</div>
          <div className="text-xs text-[#999] mt-1 font-medium uppercase tracking-wide">Credits Purchased</div>
        </div>
        <div className="bg-[#F8F8F8] rounded-xl p-4 border border-[#E5E5E5]">
          <div className="text-xl font-semibold text-[#0A0A0A]">{credits.creditsUsed}</div>
          <div className="text-xs text-[#999] mt-1 font-medium uppercase tracking-wide">Credits Used</div>
        </div>
      </div>
      <div className="flex gap-2">
        <Button onClick={onAddCredits} className="bg-emerald-600 hover:bg-emerald-700 text-white">
          <Plus className="w-4 h-4 mr-2" />
          Add Credits
        </Button>
        <Button onClick={onDeductCredits} variant="outline" className="border-[#E5E5E5] text-[#666] hover:bg-[#F0F0F0]">
          <Minus className="w-4 h-4 mr-2" />
          Deduct Credits
        </Button>
      </div>
    </div>
  );
}

function ActivityTabContent({
  logs,
  isLoading,
}: {
  logs: ActivityLog[] | undefined;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="py-8 text-center">
        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#CCC]" />
        <span className="text-[#999]">Loading activity...</span>
      </div>
    );
  }
  if (!logs?.length) {
    return <div className="text-center py-8 text-[#999]">No activity found for this user</div>;
  }
  return (
    <div className="space-y-2">
      {logs.map((log) => (
        <div key={log.id} className="bg-[#F8F8F8] rounded-lg p-3 border border-[#E5E5E5]">
          <div className="flex items-center justify-between">
            <span className="font-medium text-[#0A0A0A]">{log.action}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
              log.severity === "critical" ? "bg-red-50 text-red-700 border-red-200" :
              log.severity === "warning" ? "bg-amber-50 text-amber-700 border-amber-200" :
              "bg-gray-100 text-[#666] border-gray-200"
            }`}>
              {log.severity}
            </span>
          </div>
          <div className="text-sm text-[#999] mt-1">
            {formatDate(typeof log.createdAt === "string" ? log.createdAt : log.createdAt.toISOString())}
          </div>
          {log.resourceType && (
            <div className="text-xs text-[#CCC] mt-1">
              {log.resourceType}: {log.resourceId}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
