/**
 * Attachments section for change request detail view.
 * Renders images inline and other files as download links.
 *
 * # Why this file was the last one under `features/admin/` outside token-guard
 *
 * It is a DETAIL-ROW component rather than a modal or a list, so it fell
 * outside brief 06 (which enrolled the lists), brief 09 (`features/moderator/`)
 * and #421 (the form modals). Nothing went red while it sat there — the guard
 * is enrolled file by file, so an unenrolled file is not failing, it is simply
 * unwatched. It held **16** light-only hex literals: `#999`, `#666`, `#F8F8F8`,
 * `#F0F0F0`, `#E5E5E5` — grey-on-grey in dark mode, invisible until the theme
 * flipped. (#428, the declared remainder of #421.)
 *
 * ⚠ **THE REPAIR IS DELETION, NOT SUBSTITUTION** — `UserActionModals.tsx`'s
 * header states the same finding and it is the precedent followed here. The
 * shadcn slots in `client/src/index.css` already map onto foundation tokens
 * (`--color-muted-foreground` is `--meta`, `--color-border` is `--border`), so
 * writing `text-[var(--meta)]` where `text-[#999]` was would be a second
 * statement of a value that already has one — working law 4. The classes are
 * `text-muted-foreground`, `bg-muted`, `border-border` instead.
 *
 * THREE of the sixteen are NOT a flat swap and are stated rather than left to
 * be re-derived:
 *
 *   1. The row hover was `#F0F0F0` over an `#F8F8F8` card, so it becomes
 *      `hover:bg-accent` (`--fillStrong`) rather than `bg-muted` — which is the
 *      card's own token, and would have made hovering do nothing.
 *   2. The filename was `#666` against `#999` beside it, i.e. the row's CONTENT
 *      rather than its meta, so `text-foreground`.
 *   3. ⚠ The image letterbox was `#F0F0F0` INSIDE the `#F8F8F8` card — a third
 *      step of grey — and it becomes `bg-muted`, the same token as the card. So
 *      that one distinction is deliberately LOST rather than preserved. It is
 *      named here because it is the only one of the three the drive could not
 *      show: it is visible solely behind an `object-contain` image that does
 *      not fill its box, and no real attachment exists in dev to render. A
 *      letterbox one shade off its own card is decoration; if it is ever wanted
 *      back it is `bg-accent`, and this paragraph is why it is not there now.
 *
 * With this file clean, `features/admin` has no hex remainder — see the
 * directory row in `foundation/token-guard.test.ts`.
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
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <Paperclip className="w-3.5 h-3.5" /> Attachments
        </h3>
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading...
        </div>
      </div>
    );
  }

  if (!attachments || attachments.length === 0) return null;

  return (
    <div>
      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
        <Paperclip className="w-3.5 h-3.5" /> Attachments ({attachments.length})
      </h3>
      <div className="space-y-2">
        {attachments.map((att) => (
          <div key={att.id} className="bg-muted border border-border rounded-lg overflow-hidden">
            {att.mimeType.startsWith("image/") ? (
              <a href={att.url} target="_blank" rel="noopener noreferrer" className="block">
                <img
                  src={att.url}
                  alt={att.filename}
                  className="w-full max-h-64 object-contain bg-muted"
                />
                <div className="flex items-center gap-2 p-2 border-t border-border">
                  <Image className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  <span className="text-xs text-foreground truncate flex-1">{att.filename}</span>
                  <span className="text-xs text-muted-foreground">{formatBytes(att.size)}</span>
                  <Download className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                </div>
              </a>
            ) : (
              <a
                href={att.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 p-3 hover:bg-accent transition-colors"
              >
                <FileText className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground truncate">{att.filename}</p>
                  <p className="text-xs text-muted-foreground">{att.mimeType} — {formatBytes(att.size)}</p>
                </div>
                <Download className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
