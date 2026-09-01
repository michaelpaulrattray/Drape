/**
 * His replies under one card — and the ONLY place "seen by the crew" is said.
 *
 * Acknowledgement is honest by construction (design §1): a reply is marked seen
 * when a DEPLOYED briefing edition names its id in `acknowledgedReplyIds`, and
 * nowhere else. There is no read receipt the server writes for itself and no
 * timestamp theatre — the label means the team's own next push proved it was
 * read, which is the only claim we can make truthfully.
 *
 * Plain text with line breaks, no markdown (design §10). `white-space:
 * pre-wrap` is the whole renderer: what he typed is what he sees.
 *
 * ⚠ **THE TICK IS GONE (brief 08 §6).** His words: *"Acknowledged replies get a
 * quiet `--faint` marker, not a colour."* The sentence already says *Seen by
 * the crew*; a check glyph beside it is a second marker for one fact, which is
 * the same argument that took the italic off the quote. Seen and unseen now
 * differ by their words and by weight of grey, never by hue or by an icon.
 */
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
    <ul className="dp-crew__thread">
      {ordered.map((reply) => {
        const seen = acknowledgedReplyIds.includes(reply.id);
        return (
          <li key={reply.id} className="dp-crew__entry">
            <div className="dp-crew__entryhead">
              <span className="dp-crew__who">{reply.author}</span>
              {/* A time is a measured value, so it is mono (§4). */}
              <span className="dp-crew__mono">{shortDate(String(reply.createdAt))}</span>
              <span className={seen ? "dp-crew__seen" : "dp-crew__unseen"}>
                {seen ? "Seen by the crew" : "Not read yet"}
              </span>
            </div>
            <p className="dp-crew__said">{reply.body}</p>
          </li>
        );
      })}
    </ul>
  );
}
