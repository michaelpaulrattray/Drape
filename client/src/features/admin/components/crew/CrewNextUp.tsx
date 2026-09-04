/**
 * NEXT UP — what a shift takes next, in the order it takes it (#290).
 *
 * His verbatim question: *"but i am still confused where is the list which
 * tells me the order things are being executed right now? like a pipeline. in
 * the correct order? … i can see what it working on now what it just shipped,
 * thats great but i cant see what its planned as the next shift etc or can i
 * see it im just missing it"*
 *
 * He was not missing it. The pipeline's five statuses are all happening-now or
 * already-done, so the page had no state that means QUEUED — and the three
 * outcomes he could not tell apart (queued / blocked / dropped) were
 * indistinguishable because only one of them had a surface.
 *
 * # THE LIST IS THE ONE SHIFTS OBEY, NOT A SECOND ONE
 *
 * Its source is the `founder-ordered` label, which `PROGRAM.md` already makes
 * authorised work taken first — so `gh issue list --label founder-ordered
 * --state open` IS the running order, and this section renders that rather
 * than a copy someone maintains. `scripts/crew-desk-sweep.mts` writes the rows
 * mechanically; no shift composes them.
 *
 * # AND THE SECOND GROUP IS HIS OWN SETTING, SAID OUT LOUD
 *
 * Under the list: what a shift does when the ordered queue empties. He must be
 * able to see that a quiet night is his switches being off rather than a fault
 * — that is his own instruction, and it is why the empty state here is a
 * sentence and never a blank box.
 *
 * ⚠ **BRIEF 08 NEVER SAW THIS COMPONENT** — #290 landed after the mockup was
 * drawn, so its §6 does not list it. It is restyled to the same grammar under
 * §8's bar; the position, the hold word, the reason under the title and the
 * closing paragraph are untouched.
 */
import { cn } from "@/lib/utils";
import { TableHead } from "@/foundation";
import { heldCount, nextUpRows } from "./crewTypes";
import type { CrewBriefingView, CrewNeedsYouCard } from "./crewTypes";

/**
 * "read 09:12 · 30 Aug" — the stamp is said, never implied.
 *
 * ⚠ 24-hour, forced: the third of this page's three time formatters and the
 * second one missed when `CrewWorkingNow`'s `clockTime` was fixed. Its docblock
 * carries the argument; the class sweep is in `shortDate`'s.
 */
function readStamp(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return iso;
  return at.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function CrewNextUp({
  nextUp,
  cards,
}: {
  nextUp: CrewBriefingView["nextUp"];
  cards: readonly CrewNeedsYouCard[];
}) {
  const rows = nextUpRows(nextUp, cards);
  const held = heldCount(rows);

  return (
    <section className="dp-crew__card" data-testid="crew-next-up">
      {/* §3: the count moves to the head's right, and the queue-read stamp
          rides beside it — both are measured values, so both are mono. */}
      <TableHead eyebrow="Next up">
        {rows.length > 0 && <span className="dp-crew__meta">{rows.length} open</span>}
        <span className="dp-crew__mono">queue read {readStamp(nextUp.readAt)}</span>
      </TableHead>

      {rows.length === 0 ? (
        <p className="dp-crew__body dp-crew__body--soft dp-crew__gap">
          Nothing is ordered. The next shift will work a standing exception — an urgent card, a
          broken gate, a patrol whose clock has fired — and if none of those is waiting it will
          stop and say why it is idle rather than pick something itself.
        </p>
      ) : (
        <ol className="dp-crew__rows dp-crew__gap">
          {rows.map((row, index) => (
            <li key={row.issueNumber} className="dp-crew__row">
              {/* ⚠ THE POSITION IS THE ANSWER, so it is what the eye lands on.
                  The first build put the word "Queued" here on every row —
                  eleven identical labels down a column, and his question was
                  "in the correct order?". Caught by looking at the rendered
                  page rather than at the markup. */}
              <span className="dp-crew__num dp-crew__pos">{index + 1}</span>
              <span className="dp-crew__rowmain">
                {row.title}
                {/* The reason rides UNDER the title rather than beside it: it is
                    a sentence, and a sentence competing with the chip for the
                    end of the line is what makes a row wrap to three lines. */}
                {row.hold?.because && <span className="dp-crew__rowwhy">{row.hold.because}</span>}
              </span>
              {row.hold && (row.hold.kind === "you" && row.holdingCardId !== null ? (
                /* THE CHIP IS THE CROSS-REFERENCE (#493 move 3): "Waiting on
                   you" and the Needs-you card asking the question are one fact
                   in two sections, so the chip goes to the card instead of
                   both describing it. A plain fragment anchor — no router, no
                   state, and the card's own id is the address. */
                <a
                  href={`#crew-card-${row.holdingCardId}`}
                  data-testid={`crew-next-up-hold-${row.issueNumber}`}
                  className="dp-crew__hold dp-crew__hold--you"
                >
                  {row.hold.word}
                </a>
              ) : (
                <span
                  data-testid={`crew-next-up-hold-${row.issueNumber}`}
                  className={cn("dp-crew__hold", row.hold.kind === "you" && "dp-crew__hold--you")}
                >
                  {row.hold.word}
                </span>
              ))}
              {row.urgent && <span className="dp-crew__urgent">urgent</span>}
              <span className="dp-crew__mono">#{row.issueNumber}</span>
            </li>
          ))}
        </ol>
      )}

      <p className="dp-crew__foot">
        This is every card you have ordered that is still open, in the order a shift takes them.
        A row marked <span className="dp-crew__strong">Waiting on you</span> is one your desk above
        still has an open question about.
        {held > 0 && (
          <>
            {" "}
            <span className="dp-crew__strong">
              {held} of {rows.length} {held === 1 ? "is" : "are"} held right now
            </span>{" "}
            — a shift works down this list and takes the first row with nothing beside it, so a
            marked row is one it stepped over rather than ignored. Nothing is reordered or hidden:
            clearing a hold is what moves work, not the position.
          </>
        )}
      </p>
    </section>
  );
}
