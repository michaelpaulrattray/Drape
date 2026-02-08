/**
 * Attachments section for change request detail view.
 * Renders images inline and other files as download links.
 */
import {
  Paperclip,
  FileText,
  Download,
  Image,
  Loader2,
} from "lucide-react";
import { trpc } from "@/lib/trpc";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AttachmentsSection({ changeRequestId }: { changeRequestId: number }) {
  const { data: attachments, isLoading } = trpc.moderatorAttachments.getAttachments.useQuery(
    { changeRequestId },
    { enabled: !!changeRequestId }
  );

  if (isLoading) {
    return (
      <div>
        <h3 className="text-xs font-medium text-[#999] uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <Paperclip className="w-3.5 h-3.5" /> Attachments
        </h3>
        <div className="flex items-center gap-2 text-[#999] text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading...
        </div>
      </div>
    );
  }

  if (!attachments || attachments.length === 0) return null;

  return (
    <div>
      <h3 className="text-xs font-medium text-[#999] uppercase tracking-wider mb-2 flex items-center gap-1.5">
        <Paperclip className="w-3.5 h-3.5" /> Attachments ({attachments.length})
      </h3>
      <div className="space-y-2">
        {attachments.map((att) => (
          <div key={att.id} className="bg-[#F8F8F8] border border-[#E5E5E5] rounded-lg overflow-hidden">
            {att.mimeType.startsWith("image/") ? (
              <a href={att.url} target="_blank" rel="noopener noreferrer" className="block">
                <img
                  src={att.url}
                  alt={att.filename}
                  className="w-full max-h-64 object-contain bg-[#F0F0F0]"
                />
                <div className="flex items-center gap-2 p-2 border-t border-[#E5E5E5]">
                  <Image className="w-3.5 h-3.5 text-[#999] flex-shrink-0" />
                  <span className="text-xs text-[#666] truncate flex-1">{att.filename}</span>
                  <span className="text-xs text-[#999]">{formatBytes(att.size)}</span>
                  <Download className="w-3.5 h-3.5 text-[#999] flex-shrink-0" />
                </div>
              </a>
            ) : (
              <a
                href={att.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 p-3 hover:bg-[#F0F0F0] transition-colors"
              >
                <FileText className="w-5 h-5 text-[#999] flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[#666] truncate">{att.filename}</p>
                  <p className="text-xs text-[#999]">{att.mimeType} — {formatBytes(att.size)}</p>
                </div>
                <Download className="w-4 h-4 text-[#999] flex-shrink-0" />
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
