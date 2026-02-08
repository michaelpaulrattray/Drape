import {
  Shield,
  Filter,
  Ban,
  UserCheck,
  Globe,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  SEVERITY_COLORS,
  formatAction,
  formatFullDate,
  type AuditLog,
} from "./adminConstants";

interface UserDetails {
  name: string | null;
  email: string | null;
  role: string;
  suspendedAt: Date | null;
  suspendedReason: string | null;
  lockedUntil: Date | null;
}

interface AuditLogDetailModalProps {
  log: AuditLog | null;
  onClose: () => void;
  userDetails?: UserDetails;
  onFilterByUser: (userId: string) => void;
  onSuspendUser: (userId: number) => void;
  onUnsuspendUser: (userId: number) => void;
  unsuspendPending: boolean;
  onBlockIp: (ip: string) => void;
}

export function AuditLogDetailModal({
  log,
  onClose,
  userDetails,
  onFilterByUser,
  onSuspendUser,
  onUnsuspendUser,
  unsuspendPending,
  onBlockIp,
}: AuditLogDetailModalProps) {
  return (
    <Dialog open={!!log} onOpenChange={() => onClose()}>
      <DialogContent className="bg-white border-[#E5E5E5] text-[#0A0A0A] max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[#0A0A0A]">
            <Shield className="w-5 h-5 text-[#666]" />
            Audit Log Details
          </DialogTitle>
        </DialogHeader>
        {log && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#F8F8F8] rounded-lg p-3 border border-[#E5E5E5]">
                <label className="text-xs text-[#999] uppercase">ID</label>
                <p className="font-mono text-[#0A0A0A]">{log.id}</p>
              </div>
              <div className="bg-[#F8F8F8] rounded-lg p-3 border border-[#E5E5E5]">
                <label className="text-xs text-[#999] uppercase">Timestamp</label>
                <p className="text-[#0A0A0A]">{formatFullDate(log.createdAt)}</p>
              </div>
              <div className="bg-[#F8F8F8] rounded-lg p-3 border border-[#E5E5E5]">
                <label className="text-xs text-[#999] uppercase">Action</label>
                <p className="text-[#0A0A0A]">{formatAction(log.action)}</p>
              </div>
              <div className="bg-[#F8F8F8] rounded-lg p-3 border border-[#E5E5E5]">
                <label className="text-xs text-[#999] uppercase">Severity</label>
                <Badge className={SEVERITY_COLORS[log.severity]}>{log.severity}</Badge>
              </div>
              <div className="bg-[#F8F8F8] rounded-lg p-3 border border-[#E5E5E5]">
                <label className="text-xs text-[#999] uppercase">User ID</label>
                <p className="text-[#0A0A0A]">{log.userId || "System"}</p>
              </div>
              <div className="bg-[#F8F8F8] rounded-lg p-3 border border-[#E5E5E5]">
                <label className="text-xs text-[#999] uppercase">Resource</label>
                <p className="text-[#0A0A0A]">{log.resourceType ? `${log.resourceType}: ${log.resourceId}` : "N/A"}</p>
              </div>
            </div>

            <div className="bg-[#F8F8F8] rounded-lg p-3 border border-[#E5E5E5]">
              <label className="text-xs text-[#999] uppercase">IP Address</label>
              <p className="font-mono text-sm text-[#0A0A0A]">{log.ipAddress || "N/A"}</p>
            </div>

            <div className="bg-[#F8F8F8] rounded-lg p-3 border border-[#E5E5E5]">
              <label className="text-xs text-[#999] uppercase">User Agent</label>
              <p className="text-sm text-[#666] break-all">{log.userAgent || "N/A"}</p>
            </div>

            {log.metadata && Object.keys(log.metadata).length > 0 && (
              <div>
                <label className="text-xs text-[#999] uppercase mb-2 block">Metadata</label>
                <pre className="bg-[#F8F8F8] rounded-lg p-4 text-sm overflow-x-auto font-mono text-[#0A0A0A] border border-[#E5E5E5]">
                  {JSON.stringify(log.metadata, null, 2)}
                </pre>
              </div>
            )}

            {/* User Status Section */}
            {log.userId && userDetails && (
              <div className="bg-[#F8F8F8] rounded-lg p-4 space-y-2 border border-[#E5E5E5]">
                <label className="text-xs text-[#999] uppercase">User Status</label>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-[#0A0A0A]">{userDetails.name || "Unknown"}</p>
                    <p className="text-xs text-[#999]">{userDetails.email}</p>
                  </div>
                  {userDetails.suspendedAt ? (
                    <Badge className="bg-red-50 text-red-700 border-red-200">
                      Suspended
                    </Badge>
                  ) : userDetails.lockedUntil && new Date(userDetails.lockedUntil) > new Date() ? (
                    <Badge className="bg-amber-50 text-amber-700 border-amber-200">
                      Locked
                    </Badge>
                  ) : (
                    <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">
                      Active
                    </Badge>
                  )}
                </div>
                {userDetails.suspendedAt && (
                  <p className="text-xs text-red-600">
                    Reason: {userDetails.suspendedReason}
                  </p>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-4 border-t border-[#E5E5E5]">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onFilterByUser(log.userId?.toString() || "");
                  onClose();
                }}
                disabled={!log.userId}
                className="border-[#E5E5E5] text-[#666] hover:bg-[#F0F0F0]"
              >
                <Filter className="w-4 h-4 mr-2" />
                Filter by User
              </Button>

              {log.userId && userDetails && !userDetails.suspendedAt && userDetails.role !== "admin" && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => onSuspendUser(log.userId!)}
                >
                  <Ban className="w-4 h-4 mr-2" />
                  Suspend User
                </Button>
              )}

              {log.userId && userDetails?.suspendedAt && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onUnsuspendUser(log.userId!)}
                  disabled={unsuspendPending}
                  className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                >
                  {unsuspendPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <UserCheck className="w-4 h-4 mr-2" />
                  )}
                  Unsuspend User
                </Button>
              )}

              {log.ipAddress && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => onBlockIp(log.ipAddress!)}
                >
                  <Globe className="w-4 h-4 mr-2" />
                  Block IP
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
