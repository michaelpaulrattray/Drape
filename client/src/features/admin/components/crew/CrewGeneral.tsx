/**
 * THE GENERAL BOX — where he types something that is not about a card, and
 * where those words then live (issue #293).
 *
 * It replaces the JOURNAL, which was two things in one section: the shifts'
 * own end-of-shift entries, and his cardless replies interleaved with them.
 * The founder removed the first half, verbatim:
 *
 *   "id remove the journal because nights should auto park when decisions are
 *    waiting on me and the background work toggle is turned off"
 *
 * His argument was that the journal's one irreplaceable function was being the
 * only place to type "pause the nights", and that parking automatically makes
 * that unnecessary. The shift narrative it also carried is not lost: WORKING
 * NOW reads the live shift table (#272), and the recent-history block reads
 * what was decided and what landed (#292). What had no other home was HIS
 * half — so when he was asked where a cardless reply should go once the
 * journal went, his answer was the whole of this component's brief:
 *
 *   "Keep a General box."
 *
 * ⚠ **WHAT "GENERAL" HOLDS IS NOT WIDENED.** It holds exactly what fell to the
 * journal before: his replies with no card, and his replies whose card no
 * longer renders a thread. Nothing else was stated and nothing else is
 * invented here.
 *
 * ⚠ **The fall-through is the reason this box may never be dropped.** Needs
 * You renders threads under OPEN cards only, so a reply on an answered card
 * would render on no part of the page at all — the vanishing the design
 * forbids, caught live by the PR #72 gate review. This box is where those
 * words land.
 */
import { useState } from "react";
import { cn } from "@/lib/utils";
import { CrewReplyBox } from "./CrewReplyBox";
import { shortDate } from "./CrewProgramBanner";
import { foldTimeline, replyFallsToGeneral } from "./crewTypes";
import type { CrewReplyView, CrewThreadHost } from "./crewTypes";

export function CrewGeneral({
  replies,
  cards,
  acknowledgedReplyIds,
  sending,
  onSend,
}: {
  replies: readonly CrewReplyView[];
  /** Every thread host on the page — needs-you cards AND eye items (#75). */
  cards: readonly CrewThreadHost[];
  acknowledgedReplyIds: readonly number[];
  sending: boolean;
  onSend: (input: { cardId: string | null; body: string }) => Promise<unknown>;
}) {
  /* The fold (#74 item 7 — his standing Desk rule): the last 8 visible, the
     rest behind one disclosure. */
  const [showOlder, setShowOlder] = useState(false);

  const cardTitles = new Map(cards.map((card) => [card.id, card.title]));

  const items = replies
    .filter((reply) => replyFallsToGeneral(reply.cardId, cards))
    .map((reply) => ({
      at: new Date(String(reply.createdAt)).getTime(),
      reply,
      orphanedFrom: reply.cardId,
    }))
    .sort((a, b) => b.at - a.at);

  const { recent, older } = foldTimeline(items);
  const visibleItems = showOlder ? items : recent;

  return (
    <section className="bg-white rounded-2xl border border-[#E5E5E5] p-5 sm:p-6">
      <h2 className="text-[11px] uppercase tracking-[0.12em] text-[#999]">General</h2>

      <CrewReplyBox
        cardId={null}
        placeholder="A note to the crew — steer, correct, or ask. “Pause the nights” stops the shifts before the next one starts."
        sending={sending}
        onSend={onSend}
      />

      {items.length === 0 ? (
        <p className="mt-5 pt-5 border-t border-[#EFEFEF] text-sm text-[#999]">
          Nothing here yet. Anything you write that is not about a card shows up here.
        </p>
      ) : (
        <ul className="mt-5 pt-5 border-t border-[#EFEFEF] space-y-5">
          {visibleItems.map((item) => (
            <li key={`reply-${item.reply.id}`} className="pl-3 border-l-2 border-[#0A0A0A]">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="text-[11px] font-medium text-[#0A0A0A]">{item.reply.author}</span>
                <span className="text-[11px] text-[#BBB]">
                  {shortDate(String(item.reply.createdAt))}
                </span>
                {item.orphanedFrom !== null && (
                  <span className="text-[11px] text-[#BBB]">
                    {cardTitles.has(item.orphanedFrom)
                      ? <>on “{cardTitles.get(item.orphanedFrom)}”</>
                      : <>on “{item.orphanedFrom}”, a card since closed</>}
                  </span>
                )}
                <span className="text-[11px] text-[#BBB]">
                  {acknowledgedReplyIds.includes(item.reply.id)
                    ? "Seen by the crew"
                    : "Not read yet"}
                </span>
              </div>
              <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap text-[#0A0A0A]">
                {item.reply.body}
              </p>
            </li>
          ))}
        </ul>
      )}

      {older.length > 0 && (
        <button
          type="button"
          onClick={() => setShowOlder((open) => !open)}
          className="mt-4 text-[11px] text-[#999] hover:text-[#0A0A0A] transition-colors"
        >
          {showOlder
            ? "Show fewer"
            : `Show ${older.length} earlier ${older.length === 1 ? "note" : "notes"}`}
        </button>
      )}
    </section>
  );
}
