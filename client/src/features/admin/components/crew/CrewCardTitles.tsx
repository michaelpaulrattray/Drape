/**
 * THE CARD TITLES, AND HIS TAP ON EACH OF THEM (#285's list, #325's tap).
 *
 * ⚠ **ONE COMPONENT, DRAWN WHEREVER THE PAGE NAMES CARDS.** The switch rows
 * and the pipeline groups rendered this list twice, byte for byte, before the
 * tap existed — which was harmless while it was five lines and is exactly how
 * a control ends up living on half a panel. His question was about *"all those
 * other ones"*, so the tap has to reach every card the page names, and the
 * only way to be sure of that is for there to be one list. #493 gave it a
 * third consumer — the ladder's cards under THE PROGRAM — which is why it
 * lives in its own module now: `CrewProgramBanner` importing the background
 * panel for one row shape would be a dependency pointing the wrong way.
 *
 * # ⚠ THE TAP DOES NOT CLOSE THE CARD, AND THE LABEL SAYS SO
 *
 * It reads **Not relevant**, not *Close* and not a bin icon, because what it
 * does is record what he thinks — a shift closes the card afterwards, having
 * checked. A control whose label promises the thing it does not do is the
 * dead-control shape his own stub ruling forbids, wearing a working one's
 * clothes.
 *
 * The confirmation is the SENTENCE that replaces it — *"Marked not relevant —
 * a shift will check it and close it"* — rather than a toast that vanishes, so
 * a tap he took at 1am is still visible at 8am. And it is reversible in one
 * press until a shift acts, which is why there is no confirm dialog: the
 * cheapest undo beats the cheapest warning.
 */
import { cn } from "@/lib/utils";
import { intentSentence, type CrewCardIntentView } from "@shared/crewCardIntents";
import type { CrewQueueTitle } from "@shared/crewQueueTitles";

export function CardTitles({
  titles, intents, onIntent, pendingCard, mark,
}: {
  titles: readonly CrewQueueTitle[];
  intents: ReadonlyMap<number, CrewCardIntentView>;
  /** `null` while the table is absent — the tap is withheld rather than drawn dead. */
  onIntent: ((issueNumber: number, intent: "close" | null) => void) | null;
  pendingCard: number | null;
  /** A quiet word after the title — the ladder rows say *parked* / *unbuilt design* (#493). */
  mark?: (card: CrewQueueTitle) => string | null;
}) {
  if (titles.length === 0) return null;
  return (
    <>
      {titles.map((card) => {
        const intent = intents.get(card.number);
        const sentence = intentSentence(intent);
        /* Only a LIVE mark is takeable back. A resolved row keeps a shift's
           answer on the page rather than offering him an undo that would erase
           the record of what was done and why. */
        const marked = sentence !== null && intent?.resolution == null;
        const word = mark?.(card) ?? null;
        return (
          <li key={card.number} className="dp-crew__cardtitle">
            <div className="dp-crew__cardrow">
              {/* ⚠ `flex: 1` IS WHAT MAKES THE BUTTONS A COLUMN RATHER THAN A
                  RAGGED EDGE. Without it the title shrinks to its content and
                  the tap lands wherever that title happens to end — measured at
                  the frame, `Not relevant` sat mid-row on the short titles and
                  at the margin on the long ones, across 56 rows. `min-width: 0`
                  is what lets the ellipsis work inside a flex child. */}
              <span className="dp-crew__cardname" title={`#${card.number} ${card.title}`}>
                {/* An issue number is a measured value, so it is mono (§4). */}
                <span className="dp-crew__mono">#{card.number}</span>
                {" "}
                {card.title}
              </span>
              {word && <span className="dp-crew__cardkind">{word}</span>}
              {/* A resolved card's row is a REPORT, not a control — there is
                  nothing left for him to press, and drawing a live button
                  beside a shift's answer would invite him to press it. */}
              {onIntent !== null && intent?.resolution == null && (
                <button
                  type="button"
                  disabled={pendingCard === card.number}
                  onClick={() => onIntent(card.number, marked ? null : "close")}
                  className={cn("dp-crew__tap", marked && "dp-crew__tap--marked")}
                  aria-label={
                    marked
                      ? `Undo — keep #${card.number} in the queue`
                      : `Mark #${card.number} not relevant`
                  }
                >
                  {marked ? "Undo" : "Not relevant"}
                </button>
              )}
            </div>
            {sentence && <p className="dp-crew__taken">{sentence}</p>}
          </li>
        );
      })}
    </>
  );
}
