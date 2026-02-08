/**
 * Log Detail Modal — shows full audit log details with metadata.
 */
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AuditLog,
  SEVERITY_COLORS,
  formatAction,
  formatFullDate,
  type OpenChangeRequestOptions,
} from "./moderatorConstants";

interface LogDetailModalProps {
  selectedLog: AuditLog | null;
  onClose: () => void;
  onOpenChangeRequest: (options?: OpenChangeRequestOptions) => void;
}

export function LogDetailModal({ selectedLog, onClose, onOpenChangeRequest }: LogDetailModalProps) {
  return (
    <Dialog open={!!selectedLog} onOpenChange={() => onClose()}>
      <DialogContent className="bg-white border-[#E5E5E5] text-[#0A0A0A] max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[#0A0A0A]">
            <FileText className="w-5 h-5 text-blue-600" />
            Audit Log Detail
          </DialogTitle>
        </DialogHeader>
        {selectedLog && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] text-[#999] uppercase tracking-wider mb-1">Log ID</p>
                <p className="text-sm text-[#0A0A0A]">#{selectedLog.id}</p>
              </div>
              <div>
                <p className="text-[10px] text-[#999] uppercase tracking-wider mb-1">Severity</p>
                <Badge className={SEVERITY_COLORS[selectedLog.severity]}>
                  {selectedLog.severity}
                </Badge>
              </div>
              <div>
                <p className="text-[10px] text-[#999] uppercase tracking-wider mb-1">Action</p>
                <p className="text-sm text-[#0A0A0A]">{formatAction(selectedLog.action)}</p>
              </div>
              <div>
                <p className="text-[10px] text-[#999] uppercase tracking-wider mb-1">Time</p>
                <p className="text-sm text-[#0A0A0A]">{formatFullDate(selectedLog.createdAt)}</p>
              </div>
              <div>
                <p className="text-[10px] text-[#999] uppercase tracking-wider mb-1">User ID</p>
                <p className="text-sm text-[#0A0A0A]">{selectedLog.userId ? `#${selectedLog.userId}` : "—"}</p>
              </div>
              <div>
                <p className="text-[10px] text-[#999] uppercase tracking-wider mb-1">IP Address</p>
                <p className="text-sm font-mono text-[#0A0A0A]">{selectedLog.ipAddress || "—"}</p>
              </div>
              {selectedLog.resourceType && (
                <div>
                  <p className="text-[10px] text-[#999] uppercase tracking-wider mb-1">Resource Type</p>
                  <p className="text-sm text-[#0A0A0A]">{selectedLog.resourceType}</p>
                </div>
              )}
              {selectedLog.resourceId && (
                <div>
                  <p className="text-[10px] text-[#999] uppercase tracking-wider mb-1">Resource ID</p>
                  <p className="text-sm font-mono text-[#0A0A0A]">{selectedLog.resourceId}</p>
                </div>
              )}
            </div>

            {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
              <div>
                <p className="text-[10px] text-[#999] uppercase tracking-wider mb-2">Metadata</p>
                <pre className="bg-[#F8F8F8] border border-[#E5E5E5] rounded-xl p-3 text-xs overflow-x-auto text-[#666] max-h-48">
                  {JSON.stringify(selectedLog.metadata, null, 2)}
                </pre>
              </div>
            )}

            {selectedLog.userAgent && (
              <div>
                <p className="text-[10px] text-[#999] uppercase tracking-wider mb-1">User Agent</p>
                <p className="text-xs text-[#999] break-all">{selectedLog.userAgent}</p>
              </div>
            )}

            {/* Change request button in detail view */}
            {(selectedLog.severity === "warning" || selectedLog.severity === "critical") && (
              <div className="pt-2 border-t border-[#E5E5E5]">
                <Button
                  size="sm"
                  className="bg-amber-600 hover:bg-amber-700 text-white"
                  onClick={() => {
                    const metadata = selectedLog.metadata as Record<string, unknown> | null;
                    onOpenChangeRequest({
                      type: metadata?.ipAddress ? "block_ip" : selectedLog.userId ? "flag_account" : "note_incident",
                      targetUserId: selectedLog.userId?.toString() || "",
                      targetUserName: metadata?.userName as string || undefined,
                      relatedAuditLogId: selectedLog.id,
                      ipAddress: metadata?.ipAddress as string || undefined,
                    });
                    onClose();
                  }}
                >
                  <FileText className="w-3 h-3 mr-2" />
                  Submit Change Request
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
