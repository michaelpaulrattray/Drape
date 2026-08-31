/**
 * His replies under one card — and the ONLY place "seen by the crew" is said.
 *
 * Acknowledgement is honest by construction (design §1): a reply is marked seen
 * when a DEPLOYED briefing edition names its id in `acknowledgedReplyIds`, and
 * nowhere else. There is no read receipt the server writes for itself and no
 * timestamp theatre — the label means the team's own next push proved it was
 * read, which is the only claim we can make truthfully.
 *
 * Plain text with line breaks, no markdown (design §10). `whitespace-pre-wrap`
 * is the whole renderer: what he typed is what he sees.
 */
import { Check } from "lucide-react";

import { shortDate } from "./CrewProgramBanner";
import type { CrewReplyView } from "./crewTypes";

export function CrewReplyThread({
  replies,
  acknowledgedReplyIds,
}: {
  replies: readonly CrewReplyView[];
  acknowledgedReplyIds: readonly number[];
}) {
  if (replies.length === 0) return null;

  /* Oldest first inside a thread — a conversation reads down. The page's
     General box reads the other way, and that is deliberate: one is a thread and
     the other is a feed. An OPTIMISTIC row carries a negative id and is the
     NEWEST thing in the thread, so negatives sort last — a plain id sort put
     the in-flight reply at the top for ~200ms and then jumped it to the
     bottom on settle, a visible reorder on the page's one control. */
  const rank = (id: number) => (id < 0 ? Number.MAX_SAFE_INTEGER : id);
  const ordered = [...replies].sort((a, b) => rank(a.id) - rank(b.id));

  return (
    <ul className="space-y-3">
      {ordered.map((reply) => {
        const seen = acknowledgedReplyIds.includes(reply.id);
        return (
          <li key={reply.id} className="pl-3 border-l-2 border-[#0A0A0A]">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="text-[11px] font-medium text-[#0A0A0A]">{reply.author}</span>
              <span className="text-[11px] text-[#BBB]">{shortDate(String(reply.createdAt))}</span>
              {seen ? (
                <span className="text-[11px] text-[#999] inline-flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  Seen by the crew
                </span>
              ) : (
                <span className="text-[11px] text-[#BBB]">Not read yet</span>
              )}
            </div>
            <p className="mt-1 text-sm leading-relaxed text-[#0A0A0A] whitespace-pre-wrap">
              {reply.body}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
