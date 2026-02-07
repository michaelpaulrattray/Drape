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
}: UserDetailModalProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl bg-[#0f0f0f] border-white/10 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCog className="w-5 h-5 text-purple-400" />
            User Details
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
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
                  onClick={() => onTabChange(tab)}
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
              <ProfileTabContent
                selectedUser={selectedUser}
                onSuspend={onSuspend}
                onUnsuspend={onUnsuspend}
                unsuspendPending={unsuspendPending}
                onPromote={onPromote}
                onDemote={onDemote}
              />
            )}

            {/* Credits Tab */}
            {activeTab === "credits" && (
              <CreditsTabContent
                credits={selectedUser.credits}
                onAddCredits={onAddCredits}
                onDeductCredits={onDeductCredits}
              />
            )}

            {/* Activity Tab */}
            {activeTab === "activity" && (
              <ActivityTabContent logs={activityLogs} isLoading={activityLoading} />
            )}
          </div>
        ) : (
          <div className="py-8 text-center text-gray-400">User not found</div>
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
}: {
  selectedUser: UserDetailData;
  onSuspend: () => void;
  onUnsuspend: () => void;
  unsuspendPending: boolean;
  onPromote: () => void;
  onDemote: () => void;
}) {
  return (
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
        <div><span className="text-gray-400">User ID:</span><span className="ml-2">{selectedUser.user.id}</span></div>
        <div><span className="text-gray-400">Open ID:</span><span className="ml-2 font-mono text-xs">{selectedUser.user.openId.slice(0, 16)}...</span></div>
        <div><span className="text-gray-400">Joined:</span><span className="ml-2">{formatDate(selectedUser.user.createdAt)}</span></div>
        <div><span className="text-gray-400">Last Active:</span><span className="ml-2">{formatDate(selectedUser.user.lastSignedIn)}</span></div>
        <div><span className="text-gray-400">Models:</span><span className="ml-2">{selectedUser.stats.totalModels}</span></div>
        <div><span className="text-gray-400">Generations:</span><span className="ml-2">{selectedUser.stats.totalGenerations}</span></div>
      </div>

      {selectedUser.user.suspendedAt && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
          <div className="flex items-center gap-2 text-red-400 font-medium">
            <AlertTriangle className="w-4 h-4" />
            Account Suspended
          </div>
          <p className="text-sm text-gray-400 mt-1">Reason: {selectedUser.user.suspendedReason || "No reason provided"}</p>
          <p className="text-sm text-gray-400">Since: {formatDate(selectedUser.user.suspendedAt)}</p>
        </div>
      )}

      {selectedUser.user.lockedUntil && new Date(selectedUser.user.lockedUntil) > new Date() && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
          <div className="flex items-center gap-2 text-amber-400 font-medium">
            <Lock className="w-4 h-4" />
            Account Temporarily Locked
          </div>
          <p className="text-sm text-gray-400 mt-1">Until: {formatDate(selectedUser.user.lockedUntil)}</p>
          <p className="text-sm text-gray-400">Failed attempts: {selectedUser.user.failedLoginAttempts}</p>
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-2">
        {selectedUser.user.suspendedAt ? (
          <Button onClick={onUnsuspend} disabled={unsuspendPending} className="bg-emerald-600 hover:bg-emerald-700">
            <Shield className="w-4 h-4 mr-2" />
            Unsuspend User
          </Button>
        ) : (
          <Button onClick={onSuspend} disabled={selectedUser.user.role === "admin"} variant="destructive">
            <ShieldOff className="w-4 h-4 mr-2" />
            Suspend User
          </Button>
        )}
        {selectedUser.user.role !== "admin" && (
          selectedUser.user.role === "moderator" ? (
            <Button onClick={onDemote} variant="outline" className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10">
              <ShieldOff className="w-4 h-4 mr-2" />
              Demote to User
            </Button>
          ) : (
            <Button onClick={onPromote} variant="outline" className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10">
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
    return <div className="text-center py-8 text-gray-400">No credits record found for this user</div>;
  }
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white/5 rounded-lg p-4 border border-white/10">
          <div className="text-3xl font-bold text-purple-400">{credits.balance}</div>
          <div className="text-sm text-gray-400">Current Balance</div>
        </div>
        <div className="bg-white/5 rounded-lg p-4 border border-white/10">
          <div className="text-xl font-semibold capitalize">{credits.planTier}</div>
          <div className="text-sm text-gray-400">Plan Tier</div>
        </div>
        <div className="bg-white/5 rounded-lg p-4 border border-white/10">
          <div className="text-xl font-semibold">{credits.creditsPurchased}</div>
          <div className="text-sm text-gray-400">Credits Purchased</div>
        </div>
        <div className="bg-white/5 rounded-lg p-4 border border-white/10">
          <div className="text-xl font-semibold">{credits.creditsUsed}</div>
          <div className="text-sm text-gray-400">Credits Used</div>
        </div>
      </div>
      <div className="flex gap-2">
        <Button onClick={onAddCredits} className="bg-emerald-600 hover:bg-emerald-700">
          <Plus className="w-4 h-4 mr-2" />
          Add Credits
        </Button>
        <Button onClick={onDeductCredits} variant="outline" className="border-white/10 hover:bg-white/5">
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
        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-gray-400" />
        Loading activity...
      </div>
    );
  }
  if (!logs?.length) {
    return <div className="text-center py-8 text-gray-400">No activity found for this user</div>;
  }
  return (
    <div className="space-y-2 max-h-[400px] overflow-y-auto">
      {logs.map((log) => (
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
            {formatDate(typeof log.createdAt === "string" ? log.createdAt : log.createdAt.toISOString())}
          </div>
          {log.resourceType && (
            <div className="text-xs text-gray-500 mt-1">
              {log.resourceType}: {log.resourceId}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
