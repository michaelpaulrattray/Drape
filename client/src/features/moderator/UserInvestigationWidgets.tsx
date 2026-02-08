/**
 * Extracted sub-components for UserInvestigationTab: UserTable + UserDetailCard.
 */
import {
  Eye,
  User,
  FileText,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, type OpenChangeRequestOptions } from "./moderatorConstants";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

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
    <div className="bg-white rounded-xl border border-[#E5E5E5] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#E5E5E5] bg-[#FAFAFA]">
              <th className="px-4 py-3 text-left text-[10px] font-medium text-[#999] uppercase tracking-wider">User</th>
              <th className="px-4 py-3 text-left text-[10px] font-medium text-[#999] uppercase tracking-wider">Role</th>
              <th className="px-4 py-3 text-left text-[10px] font-medium text-[#999] uppercase tracking-wider">Status</th>
              <th className="px-4 py-3 text-left text-[10px] font-medium text-[#999] uppercase tracking-wider">Last Active</th>
              <th className="px-4 py-3 text-right text-[10px] font-medium text-[#999] uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody>
            {usersQuery.isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-[#F0F0F0]">
                  <td className="px-4 py-3"><Skeleton className="h-5 w-32 bg-[#E5E5E5]" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-5 w-16 bg-[#E5E5E5]" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-5 w-16 bg-[#E5E5E5]" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-5 w-24 bg-[#E5E5E5]" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-5 w-8 bg-[#E5E5E5] ml-auto" /></td>
                </tr>
              ))
            ) : usersQuery.data?.users?.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-[#999] text-sm">
                  No users found
                </td>
              </tr>
            ) : (
              usersQuery.data?.users?.map((u: any) => (
                <tr
                  key={u.id}
                  className={`border-b border-[#F0F0F0] cursor-pointer transition-colors ${
                    selectedUserId === u.id ? "bg-blue-50" : "hover:bg-[#FAFAFA]"
                  }`}
                  onClick={() => onSelectUser(u.id)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {u.avatarUrl ? (
                        <img src={u.avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover" />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-[#F0F0F0] flex items-center justify-center text-xs font-medium text-[#666]">
                          {(u.name || "U").charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-medium text-[#0A0A0A]">{u.name || "Unnamed"}</p>
                        <p className="text-xs text-[#999]">
                          <span className="font-mono text-[#CCC]">#{u.id}</span>{" "}
                          {u.email}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={
                      u.role === "admin" ? "bg-red-50 text-red-700" :
                      u.role === "moderator" ? "bg-amber-50 text-amber-700" :
                      "bg-gray-100 text-gray-600"
                    }>
                      {u.role}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    {u.suspendedAt ? (
                      <Badge className="bg-red-50 text-red-700">Suspended</Badge>
                    ) : (
                      <Badge className="bg-emerald-50 text-emerald-700">Active</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-[#999]">
                    {u.lastLoginAt ? formatDate(new Date(u.lastLoginAt)) : "Never"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 h-7 w-7 p-0"
                      onClick={(e) => { e.stopPropagation(); onSelectUser(u.id); }}
                    >
                      <Eye className="w-3.5 h-3.5" />
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
        <div className="flex items-center justify-between px-4 py-3 border-t border-[#E5E5E5]">
          <span className="text-xs text-[#999]">
            Page {userPage + 1} of {userTotalPages}
          </span>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setUserPage(p => Math.max(0, p - 1))}
              disabled={userPage === 0}
              className="border-[#E5E5E5] text-[#666] h-7 w-7 p-0"
            >
              <ChevronLeft className="w-3 h-3" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setUserPage(p => p + 1)}
              disabled={userPage + 1 >= userTotalPages}
              className="border-[#E5E5E5] text-[#666] h-7 w-7 p-0"
            >
              <ChevronRight className="w-3 h-3" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Freeze Action Button ──

function FreezeActionButton({
  userId,
  isFrozen,
  isAdmin,
}: {
  userId: number;
  isFrozen: boolean;
  isAdmin: boolean;
}) {
  const [showForm, setShowForm] = useState(false);
  const [reason, setReason] = useState("");
  const utils = trpc.useUtils();

  const freezeMutation = trpc.moderatorReconciliation.freezeAccount.useMutation({
    onSuccess: () => {
      toast.success("Account frozen successfully");
      setShowForm(false);
      setReason("");
      utils.moderator.getUserDetails.invalidate({ userId });
      utils.moderatorReconciliation.getFlaggedUsers.invalidate();
    },
    onError: (err) => toast.error(err.message || "Failed to freeze account"),
  });

  const unfreezeMutation = trpc.moderatorReconciliation.unfreezeAccount.useMutation({
    onSuccess: () => {
      toast.success("Account unfrozen successfully");
      setShowForm(false);
      setReason("");
      utils.moderator.getUserDetails.invalidate({ userId });
      utils.moderatorReconciliation.getFlaggedUsers.invalidate();
    },
    onError: (err) => toast.error(err.message || "Failed to unfreeze account"),
  });

  if (isAdmin) return null;

  if (!showForm) {
    return (
      <div className="pt-2">
        <Button
          size="sm"
          variant="outline"
          className={`w-full ${
            isFrozen
              ? "border-emerald-300 text-emerald-700 hover:bg-emerald-50"
              : "border-red-300 text-red-700 hover:bg-red-50"
          }`}
          onClick={() => setShowForm(true)}
        >
          {isFrozen ? (
            <><ShieldCheck className="w-3 h-3 mr-2" /> Unfreeze Account</>
          ) : (
            <><ShieldAlert className="w-3 h-3 mr-2" /> Freeze Account</>
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className="pt-2 space-y-2">
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder={isFrozen ? "Review notes (required)..." : "Reason for freeze (required)..."}
        className="w-full bg-[#F8F8F8] border border-[#E5E5E5] rounded-lg px-2 py-1.5 text-xs text-[#0A0A0A] placeholder:text-[#CCC] resize-none"
        rows={2}
        maxLength={500}
      />
      <div className="flex gap-2">
        <Button
          size="sm"
          className={`h-7 text-xs flex-1 ${
            isFrozen
              ? "bg-emerald-600 hover:bg-emerald-700 text-white"
              : "bg-red-600 hover:bg-red-700 text-white"
          }`}
          disabled={!reason.trim() || freezeMutation.isPending || unfreezeMutation.isPending}
          onClick={() => {
            if (isFrozen) {
              unfreezeMutation.mutate({ userId, notes: reason.trim() });
            } else {
              freezeMutation.mutate({ userId, reason: reason.trim() });
            }
          }}
        >
          {(freezeMutation.isPending || unfreezeMutation.isPending)
            ? (isFrozen ? "Unfreezing..." : "Freezing...")
            : (isFrozen ? "Confirm Unfreeze" : "Confirm Freeze")}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs text-[#999] hover:text-[#0A0A0A]"
          onClick={() => { setShowForm(false); setReason(""); }}
        >
          Cancel
        </Button>
      </div>
    </div>
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
    <div className="bg-white rounded-xl border border-[#E5E5E5] p-4">
      <div className="flex items-center gap-2 mb-3">
        <User className="w-4 h-4 text-blue-600" />
        <h3 className="text-sm font-semibold text-[#0A0A0A]">User #{selectedUserId}</h3>
      </div>

      {userDetailsQuery.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-12 w-full bg-[#E5E5E5]" />
          <Skeleton className="h-8 w-3/4 bg-[#E5E5E5]" />
          <Skeleton className="h-8 w-1/2 bg-[#E5E5E5]" />
        </div>
      ) : userDetailsQuery.data ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            {userDetailsQuery.data.user.avatarUrl ? (
              <img src={userDetailsQuery.data.user.avatarUrl} alt="" className="w-12 h-12 rounded-full object-cover" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-[#F0F0F0] flex items-center justify-center text-lg font-medium text-[#666]">
                {(userDetailsQuery.data.user.name || "U").charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <p className="font-medium text-[#0A0A0A]">{userDetailsQuery.data.user.name || "Unnamed"}</p>
              <p className="text-xs text-[#999]">{userDetailsQuery.data.user.email}</p>
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-[#999]">Credits</span>
              <span className="font-medium text-[#0A0A0A]">{userDetailsQuery.data.credits?.balance?.toLocaleString() ?? "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#999]">Plan</span>
              <Badge className={
                userDetailsQuery.data.credits?.planTier === "enterprise" ? "bg-amber-50 text-amber-700" :
                userDetailsQuery.data.credits?.planTier === "studio" ? "bg-purple-50 text-purple-700" :
                userDetailsQuery.data.credits?.planTier === "starter" ? "bg-emerald-50 text-emerald-700" :
                "bg-gray-100 text-gray-600"
              }>
                {userDetailsQuery.data.credits?.planTier || "free"}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-[#999]">Joined</span>
              <span className="text-xs text-[#666]">{formatDate(new Date(userDetailsQuery.data.user.createdAt))}</span>
            </div>
            {userDetailsQuery.data.user.suspendedAt && (
              <div className="p-2 rounded-lg bg-red-50 border border-red-200">
                <p className="text-red-700 text-xs font-medium">Suspended</p>
                <p className="text-[#666] text-xs mt-1">{userDetailsQuery.data.user.suspendedReason || "No reason"}</p>
              </div>
            )}
            {userDetailsQuery.data.user.frozenAt && (
              <div className="p-2 rounded-lg bg-amber-50 border border-amber-200">
                <p className="text-amber-700 text-xs font-medium flex items-center gap-1">
                  <ShieldAlert className="w-3 h-3" /> Account Frozen
                </p>
                <p className="text-[#666] text-xs mt-1">{userDetailsQuery.data.user.frozenReason || "No reason"}</p>
              </div>
            )}
            <FreezeActionButton
              userId={selectedUserId}
              isFrozen={!!userDetailsQuery.data.user.frozenAt}
              isAdmin={userDetailsQuery.data.user.role === "admin"}
            />
            <div className="pt-1">
              <Button
                size="sm"
                variant="outline"
                className="w-full border-amber-300 text-amber-700 hover:bg-amber-50"
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
        <p className="text-[#999] text-sm">User not found</p>
      )}
    </div>
  );
}
