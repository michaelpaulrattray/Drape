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
 *
 * ⚠ **BRIEF 08 NEVER SAW THIS COMPONENT** — #293 landed after the mockup was
 * drawn, so its §6 does not list it. It is restyled to the same grammar under
 * §8's bar (zero hex literals under `components/crew/`), and nothing it says
 * or does has changed.
 */
import { useState } from "react";
import { CrewReplyBox } from "./CrewReplyBox";
import { shortDate } from "./CrewProgramBanner";
import { TableHead } from "@/foundation";
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
    <section className="dp-crew__card">
      <TableHead eyebrow="General" />

      <CrewReplyBox
        cardId={null}
        placeholder="A note to the crew — steer, correct, or ask. “Pause the nights” stops the shifts before the next one starts."
        sending={sending}
        onSend={onSend}
      />

      {items.length === 0 ? (
        <p className="dp-crew__rule dp-crew__body dp-crew__body--quiet">
          Nothing here yet. Anything you write that is not about a card shows up here.
        </p>
      ) : (
        <ul className="dp-crew__rule dp-crew__notes">
          {visibleItems.map((item) => (
            <li key={`reply-${item.reply.id}`} className="dp-crew__entry">
              <div className="dp-crew__entryhead">
                <span className="dp-crew__who">{item.reply.author}</span>
                <span className="dp-crew__mono">{shortDate(String(item.reply.createdAt))}</span>
                {item.orphanedFrom !== null && (
                  <span className="dp-crew__unseen">
                    {cardTitles.has(item.orphanedFrom)
                      ? <>on “{cardTitles.get(item.orphanedFrom)}”</>
                      : <>on “{item.orphanedFrom}”, a card since closed</>}
                  </span>
                )}
                <span
                  className={
                    acknowledgedReplyIds.includes(item.reply.id)
                      ? "dp-crew__seen"
                      : "dp-crew__unseen"
                  }
                >
                  {acknowledgedReplyIds.includes(item.reply.id)
                    ? "Seen by the crew"
                    : "Not read yet"}
                </span>
              </div>
              <p className="dp-crew__said">{item.reply.body}</p>
            </li>
          ))}
        </ul>
      )}

      {older.length > 0 && (
        <button
          type="button"
          onClick={() => setShowOlder((open) => !open)}
          className="dp-crew__more"
        >
          {showOlder
            ? "Show fewer"
            : `Show ${older.length} earlier ${older.length === 1 ? "note" : "notes"}`}
        </button>
      )}
    </section>
  );
}
