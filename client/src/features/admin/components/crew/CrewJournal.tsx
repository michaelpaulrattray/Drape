/**
 * The journal — the merged timeline, and his control panel.
 *
 * Two writers, one thread: the shifts' briefing entries, and HIS cardless
 * replies. They are interleaved by time, newest first, and his are visually
 * distinct because they are rulings rather than reports. A reply whose card has
 * left the briefing lands here too — the design's rule that his words are never
 * walled means they must always have somewhere to appear.
 *
 * The box at the top writes a journal note (`cardId: null`). It is the same
 * writer as the card boxes; the placeholder is what tells him it steers.
 */
import { useState } from "react";
import { cn } from "@/lib/utils";
import { CrewReplyBox } from "./CrewReplyBox";
import { shortDate } from "./CrewProgramBanner";
import { foldTimeline, replyFallsToJournal } from "./crewTypes";
import type { CrewJournalEntry, CrewNeedsYouCard, CrewReplyView } from "./crewTypes";

type Item =
  | { kind: "shift"; at: number; entry: CrewJournalEntry }
  | { kind: "founder"; at: number; reply: CrewReplyView; orphanedFrom: string | null };

export function CrewJournal({
  journal,
  replies,
  cards,
  acknowledgedReplyIds,
  sending,
  onSend,
}: {
  journal: readonly CrewJournalEntry[];
  replies: readonly CrewReplyView[];
  cards: readonly CrewNeedsYouCard[];
  acknowledgedReplyIds: readonly number[];
  sending: boolean;
  onSend: (input: { cardId: string | null; body: string }) => Promise<unknown>;
}) {
  /*
    Which of his replies belong HERE: the cardless ones, plus any whose card no
    longer renders a thread — which means every card that is not OPEN, because
    Needs You shows threads under open cards only and collapses the rest to a
    title line. The first version keyed this on "card still listed", and a
    reply on an ANSWERED card — listed in "Recently answered", thread nowhere —
    rendered on no part of the page at all: the exact vanishing the design
    forbids, caught by the PR #72 gate review (finding 2). The rule is now
    "does a thread render for it", not "does the briefing mention it".
  */
  /* The fold (#74 item 7 — his standing Desk rule): last 8 merged items
     visible, the rest behind one disclosure. Folded AFTER the merge so his
     replies are never hidden by being older than 8 shift entries. */
  const [showOlder, setShowOlder] = useState(false);

  const cardTitles = new Map(cards.map((card) => [card.id, card.title]));

  const items: Item[] = [
    ...journal.map((entry) => ({
      kind: "shift" as const,
      at: new Date(entry.at).getTime(),
      entry,
    })),
    ...replies
      .filter((reply) => replyFallsToJournal(reply.cardId, cards))
      .map((reply) => ({
        kind: "founder" as const,
        at: new Date(String(reply.createdAt)).getTime(),
        reply,
        orphanedFrom: reply.cardId,
      })),
  ].sort((a, b) => b.at - a.at);

  const { recent, older } = foldTimeline(items);
  const visibleItems = showOlder ? items : recent;

  return (
    <section className="bg-white rounded-2xl border border-[#E5E5E5] p-5 sm:p-6">
      <h2 className="text-[11px] uppercase tracking-[0.12em] text-[#999]">Journal</h2>

      <CrewReplyBox
        cardId={null}
        placeholder="A note to the crew — steer, correct, or ask. “Pause the nights” stops the shifts before the next one starts."
        sending={sending}
        onSend={onSend}
      />

      {items.length === 0 ? (
        <p className="mt-5 pt-5 border-t border-[#EFEFEF] text-sm text-[#999]">
          Nothing here yet. The crew writes an entry at the end of every shift.
        </p>
      ) : (
        <ul className="mt-5 pt-5 border-t border-[#EFEFEF] space-y-5">
          {visibleItems.map((item) => (
            <li
              key={item.kind === "shift" ? `shift-${item.at}-${item.entry.shift}` : `reply-${item.reply.id}`}
              className={cn(item.kind === "founder" && "pl-3 border-l-2 border-[#0A0A0A]")}
            >
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span
                  className={cn(
                    "text-[11px]",
                    item.kind === "founder" ? "font-medium text-[#0A0A0A]" : "text-[#999]",
                  )}
                >
                  {item.kind === "shift" ? item.entry.shift : item.reply.author}
                </span>
                <span className="text-[11px] text-[#BBB]">
                  {shortDate(
                    item.kind === "shift" ? item.entry.at : String(item.reply.createdAt),
                  )}
                </span>
                {item.kind === "founder" && item.orphanedFrom !== null && (
                  <span className="text-[11px] text-[#BBB]">
                    {cardTitles.has(item.orphanedFrom)
                      ? <>on “{cardTitles.get(item.orphanedFrom)}”</>
                      : <>on “{item.orphanedFrom}”, a card since closed</>}
                  </span>
                )}
                {item.kind === "founder" && (
                  <span className="text-[11px] text-[#BBB]">
                    {acknowledgedReplyIds.includes(item.reply.id)
                      ? "Seen by the crew"
                      : "Not read yet"}
                  </span>
                )}
              </div>
              <p
                className={cn(
                  "mt-1 text-sm leading-relaxed whitespace-pre-wrap",
                  item.kind === "founder" ? "text-[#0A0A0A]" : "text-[#666]",
                )}
              >
                {item.kind === "shift" ? item.entry.text : item.reply.body}
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
            : `Show ${older.length} earlier ${older.length === 1 ? "entry" : "entries"}`}
        </button>
      )}
    </section>
  );
}
