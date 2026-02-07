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
      <DialogContent className="bg-[#1a1a1a] border-white/10 text-white max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-emerald-400" />
            Audit Log Details
          </DialogTitle>
        </DialogHeader>
        {log && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-white/40 uppercase">ID</label>
                <p className="font-mono">{log.id}</p>
              </div>
              <div>
                <label className="text-xs text-white/40 uppercase">Timestamp</label>
                <p>{formatFullDate(log.createdAt)}</p>
              </div>
              <div>
                <label className="text-xs text-white/40 uppercase">Action</label>
                <p>{formatAction(log.action)}</p>
              </div>
              <div>
                <label className="text-xs text-white/40 uppercase">Severity</label>
                <Badge className={SEVERITY_COLORS[log.severity]}>{log.severity}</Badge>
              </div>
              <div>
                <label className="text-xs text-white/40 uppercase">User ID</label>
                <p>{log.userId || "System"}</p>
              </div>
              <div>
                <label className="text-xs text-white/40 uppercase">Resource</label>
                <p>{log.resourceType ? `${log.resourceType}: ${log.resourceId}` : "N/A"}</p>
              </div>
            </div>

            <div>
              <label className="text-xs text-white/40 uppercase">IP Address</label>
              <p className="font-mono text-sm">{log.ipAddress || "N/A"}</p>
            </div>

            <div>
              <label className="text-xs text-white/40 uppercase">User Agent</label>
              <p className="text-sm text-white/60 break-all">{log.userAgent || "N/A"}</p>
            </div>

            {log.metadata && Object.keys(log.metadata).length > 0 && (
              <div>
                <label className="text-xs text-white/40 uppercase mb-2 block">Metadata</label>
                <pre className="bg-white/5 rounded-lg p-4 text-sm overflow-x-auto font-mono text-white/80">
                  {JSON.stringify(log.metadata, null, 2)}
                </pre>
              </div>
            )}

            {/* User Status Section */}
            {log.userId && userDetails && (
              <div className="bg-white/5 rounded-lg p-4 space-y-2">
                <label className="text-xs text-white/40 uppercase">User Status</label>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm">{userDetails.name || "Unknown"}</p>
                    <p className="text-xs text-white/60">{userDetails.email}</p>
                  </div>
                  {userDetails.suspendedAt ? (
                    <Badge className="bg-red-500/10 text-red-400 border-red-500/20">
                      Suspended
                    </Badge>
                  ) : userDetails.lockedUntil && new Date(userDetails.lockedUntil) > new Date() ? (
                    <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20">
                      Locked
                    </Badge>
                  ) : (
                    <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                      Active
                    </Badge>
                  )}
                </div>
                {userDetails.suspendedAt && (
                  <p className="text-xs text-red-400">
                    Reason: {userDetails.suspendedReason}
                  </p>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-4 border-t border-white/10">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onFilterByUser(log.userId?.toString() || "");
                  onClose();
                }}
                disabled={!log.userId}
                className="border-white/20 text-white"
              >
                <Filter className="w-4 h-4 mr-2" />
                Filter by User
              </Button>

              {log.userId && userDetails && !userDetails.suspendedAt && userDetails.role !== "admin" && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => onSuspendUser(log.userId!)}
                  className="bg-red-600 hover:bg-red-700"
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
                  className="border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10"
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
                  className="bg-red-600 hover:bg-red-700"
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
