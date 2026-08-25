/**
 * NEEDS YOU — the cards waiting on his word, and the reply thread under each.
 *
 * Product impact LEADS every card. That is his standing order (2026-08-25:
 * decision cards lead with what it changes in the product plus a worked
 * example, flags second) and it is enforced by the layout rather than by a
 * writer remembering: `productImpact` is the first paragraph and there is
 * nowhere else for it to go.
 *
 * When a card carries options, the RECOMMENDATION is stated before them — same
 * order the mailbox uses, for the same reason: he should be able to answer
 * "yes" without reading the alternatives, and read the alternatives when "yes"
 * is not obviously right.
 *
 * Answered and done cards collapse into a short list at the bottom. They are
 * not deleted from the page — a card he answered last night is how he
 * remembers he answered it.
 */
import { cn } from "@/lib/utils";
import { CrewReplyBox } from "./CrewReplyBox";
import { CrewReplyThread } from "./CrewReplyThread";
import { shortDate } from "./CrewProgramBanner";
import type { CrewNeedsYouCard, CrewReplyView } from "./crewTypes";

export function CrewNeedsYou({
  cards,
  replies,
  acknowledgedReplyIds,
  sending,
  onSend,
}: {
  cards: readonly CrewNeedsYouCard[];
  replies: readonly CrewReplyView[];
  acknowledgedReplyIds: readonly number[];
  sending: boolean;
  onSend: (input: { cardId: string | null; body: string }) => Promise<unknown>;
}) {
  const open = cards.filter((card) => card.state === "open");
  const closed = cards.filter((card) => card.state !== "open");

  return (
    <section>
      <h2 className="text-[11px] uppercase tracking-[0.12em] text-[#999] mb-3">
        Needs you {open.length > 0 && <span className="text-[#0A0A0A]">· {open.length}</span>}
      </h2>

      {open.length === 0 && closed.length === 0 && (
        <div className="bg-white rounded-2xl border border-[#E5E5E5] p-5 sm:p-6 text-sm text-[#999]">
          Nothing is waiting on you. The crew will file a card here when something is.
        </div>
      )}

      <div className="space-y-4">
        {open.map((card) => (
          <article key={card.id} className="bg-white rounded-2xl border border-[#E5E5E5] p-5 sm:p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <h3 className="text-base font-semibold text-[#0A0A0A]">{card.title}</h3>
              <span className="text-[11px] text-[#BBB] shrink-0">
                {card.issueNumber !== null && <>#{card.issueNumber} · </>}
                filed {shortDate(card.filedAt)}
              </span>
            </div>

            {/* Product impact first — his standing order, held by the layout. */}
            <p className="mt-3 text-sm leading-relaxed text-[#0A0A0A]">{card.productImpact}</p>

            {card.workedExample && (
              <p className="mt-3 text-sm leading-relaxed text-[#666]">{card.workedExample}</p>
            )}

            {card.recommendation && (
              <p className="mt-4 text-sm leading-relaxed text-[#0A0A0A]">
                <span className="text-[11px] uppercase tracking-[0.12em] text-[#999] mr-2">
                  Recommendation
                </span>
                {card.recommendation}
              </p>
            )}

            {card.options.length > 0 && (
              <ul className="mt-3 space-y-2">
                {card.options.map((option) => (
                  <li key={option.key} className="text-sm leading-relaxed">
                    <span className="font-medium text-[#0A0A0A]">{option.label}</span>
                    <span className="text-[#666]"> — {option.consequence}</span>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-5 pt-4 border-t border-[#EFEFEF]">
              <CrewReplyThread
                replies={replies.filter((reply) => reply.cardId === card.id)}
                acknowledgedReplyIds={acknowledgedReplyIds}
              />
              <CrewReplyBox
                cardId={card.id}
                placeholder="Your answer…"
                sending={sending}
                onSend={onSend}
              />
            </div>
          </article>
        ))}
      </div>

      {closed.length > 0 && (
        <div className="mt-4 bg-white rounded-2xl border border-[#E5E5E5] p-5 sm:p-6">
          <h3 className="text-[11px] uppercase tracking-[0.12em] text-[#999] mb-3">
            Recently answered
          </h3>
          <ul className="space-y-2">
            {closed.map((card) => (
              <li key={card.id} className="flex items-baseline gap-3 text-sm">
                <span
                  className={cn(
                    "text-[11px] shrink-0 w-16",
                    card.state === "done" ? "text-[#999]" : "text-[#666]",
                  )}
                >
                  {card.state === "done" ? "Done" : "Answered"}
                </span>
                <span className="flex-1 leading-relaxed text-[#666]">{card.title}</span>
                {card.issueNumber !== null && (
                  <span className="text-[11px] text-[#BBB] shrink-0">#{card.issueNumber}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
