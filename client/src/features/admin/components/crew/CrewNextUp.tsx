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
 */
import { nextUpRows } from "./crewTypes";
import type { CrewBriefingView, CrewNeedsYouCard } from "./crewTypes";

/** "read 09:12 UTC · 30 Aug" — the stamp is said, never implied. */
function readStamp(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return iso;
  return at.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
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

  return (
    <section
      className="bg-white rounded-2xl border border-[#E5E5E5] p-5 sm:p-6"
      data-testid="crew-next-up"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 mb-3">
        <h2 className="text-[11px] uppercase tracking-[0.12em] text-[#999]">
          Next up {rows.length > 0 && <span className="text-[#0A0A0A]">· {rows.length}</span>}
        </h2>
        <span className="text-[11px] text-[#BBB]">queue read {readStamp(nextUp.readAt)}</span>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm leading-relaxed text-[#666]">
          Nothing is ordered. The next shift will work a standing exception — an urgent card, a
          broken gate, a patrol whose clock has fired — and if none of those is waiting it will
          stop and say why it is idle rather than pick something itself.
        </p>
      ) : (
        <ol className="space-y-3">
          {rows.map((row, index) => (
            <li key={row.issueNumber} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              {/* ⚠ THE POSITION IS THE ANSWER, so it is what the eye lands on.
                  The first build put the word "Queued" here on every row —
                  eleven identical labels down a column, and his question was
                  "in the correct order?". Caught by looking at the rendered
                  page rather than at the markup. */}
              <span className="text-[11px] shrink-0 w-6 text-right text-[#BBB] tabular-nums">
                {index + 1}
              </span>
              <span className="flex-1 min-w-[12rem] text-sm leading-relaxed text-[#0A0A0A]">
                {row.title}
              </span>
              {row.blockedOnYou && (
                <span className="text-[11px] shrink-0 text-[#0A0A0A] font-medium">
                  Waiting on you
                </span>
              )}
              {row.urgent && (
                <span className="text-[11px] text-[#999] shrink-0 uppercase tracking-[0.08em]">
                  urgent
                </span>
              )}
              <span className="text-[11px] text-[#BBB] shrink-0 tabular-nums">
                #{row.issueNumber}
              </span>
            </li>
          ))}
        </ol>
      )}

      <p className="mt-4 pt-4 border-t border-[#EFEFEF] text-[11px] leading-relaxed text-[#999]">
        This is every card you have ordered that is still open, in the order a shift takes them.
        A row marked <span className="text-[#666]">Waiting on you</span> is one your desk above
        still has an open question about.
      </p>
    </section>
  );
}
