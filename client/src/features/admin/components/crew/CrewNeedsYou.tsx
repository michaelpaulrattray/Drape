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
 * ⚠ **THE ANSWERED LIST LEFT THIS SECTION (#292) AND THEN LEFT THE PAGE
 * (#438).** It used to collapse into a short list at the bottom headed *Recently
 * answered* — one of THREE history lists stacked down the page, which he read as
 * *"double ups"*. The three became one; on 2026-09-02 he deleted the one, which
 * by then held 281 rows. **An answered card is still recorded** — its `state`
 * lives in `crew-briefing.json` and the desk sweep still promotes it to `done`
 * from the issue's own state. This section is, as before, only what is open.
 *
 * ⚠ **BRIEF 08 KEEPS THE EMPTY STATE, AND SAYS SO IN AS MANY WORDS (#398 §4).**
 * Brief 07's rule is that a section with nothing to show disappears. That rule
 * is REVERSED here, by his own §6: *"Nothing is waiting on you"* is the answer
 * to the question this page exists to answer, and its absence would read as a
 * loading failure. It is a `--well` block rather than a card — present, and
 * visibly not a thing to act on.
 *
 * ⚠ **AND THE OPTIONS ARE TWO LINES NOW, NOT ONE (§6).** Label and consequence
 * were run together with an em dash; at 790px a long consequence wraps under
 * the label and the dash is left orphaned at the end of the first line.
 */
import { CrewReplyBox } from "./CrewReplyBox";
import { CrewReplyThread } from "./CrewReplyThread";
import { crewCardNeedsHim } from "../../../../../../shared/crewCardState";
import { shortDate } from "./CrewProgramBanner";
import { TableHead } from "@/foundation";
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
  /*
    ⚠ HIS RULING, Crew reply #159 (#354): *"The first. Keep it on my desk until
    the act is done."*

    `state === "open"` used to mean BOTH "he has not replied" and "this still
    wants something from him", and the moment those came apart — he answers,
    and the remaining step is another act of HIS — the card left this section
    for *already dealt with*, which means no action needed. A `waiting` card
    stays here and says why.
  */
  const open = cards.filter((card) => crewCardNeedsHim(card.state));

  return (
    <section className="dp-crew__section">
      {/* §3: the inline count moves to the head's right-hand meta. The hairline
          is what separates the label from the count, so the middle dot goes. */}
      <TableHead eyebrow="Needs you">
        {open.length > 0 && <span className="dp-crew__meta">{open.length} open</span>}
      </TableHead>

      {open.length === 0 && (
        <div className="dp-crew__well">
          Nothing is waiting on you. The crew will file a card here when something is.
        </div>
      )}

      <div className="dp-crew__stack">
        {open.map((card) => (
          /* The DOM anchor NEXT UP's "Waiting on you" chip jumps to (#493
             move 3) — the card's stable slug, the same id replies point at. */
          <article key={card.id} id={`crew-card-${card.id}`} className="dp-crew__card">
            <div className="dp-crew__cardhead">
              <h3 className="dp-crew__title">
                {card.title}
                {/*
                  THE VISIBLY DISTINCT KIND (#354). It says the two facts that
                  make this card different from the one above it — you already
                  answered, and it is still yours — in his words rather than in
                  the field's name. A card wearing nothing is a fresh ask, which
                  is what every card on this page meant until tonight.
                */}
                {card.state === "waiting" && (
                  <span className="dp-crew__waitchip">Answered · still yours to do</span>
                )}
              </h3>
              <span className="dp-crew__ref">
                {card.issueNumber !== null && <>#{card.issueNumber} · </>}
                filed {shortDate(card.filedAt)}
              </span>
            </div>

            {/* Product impact first — his standing order, held by the layout. */}
            <p className="dp-crew__body dp-crew__gap">{card.productImpact}</p>

            {card.workedExample && (
              <p className="dp-crew__body dp-crew__body--soft dp-crew__gap">{card.workedExample}</p>
            )}

            {card.recommendation && (
              <div className="dp-crew__gap">
                <span className="dp-crew__subhead">Recommendation</span>
                <p className="dp-crew__body dp-crew__gap--tight">{card.recommendation}</p>
              </div>
            )}

            {card.options.length > 0 && (
              <ul className="dp-crew__options">
                {card.options.map((option) => (
                  <li key={option.key}>
                    <span className="dp-crew__optlabel">{option.label}</span>
                    <span className="dp-crew__conseq">{option.consequence}</span>
                  </li>
                ))}
              </ul>
            )}

            <div className="dp-crew__rule dp-crew__rule--tight">
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
    </section>
  );
}
