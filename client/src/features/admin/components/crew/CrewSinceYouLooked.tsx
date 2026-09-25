/**
 * SINCE YOU LAST LOOKED — what finished while he was away (#1193).
 *
 * His complaint, verbatim: *"its difficult for me to decipher what is
 * actually going on"*. The page had no block answering "what happened since
 * I was last here" — #438 deleted the history section, correctly, because it
 * was a hand-written list of everything ever merged. This is the opposite
 * thing: every PR merged and every card closed in the last two days, read from
 * GitHub, newest first, with a mark on the rows that landed after his previous
 * visit.
 *
 * "Last visit" is the browser's own memory (`localStorage`), per viewer and
 * never shared — the honest scope for a fact about where HE was. Absent (a
 * first visit, a private window) nothing is marked and the list still reads.
 *
 * Folded past the first eight, because a busy night merges twenty and the
 * block is a glance, not a ledger.
 */
import { useState } from "react";
import { cn } from "@/lib/utils";
import { TableHead } from "@/foundation";
import { ago } from "./crewAgo";
import type { CrewLiveRecentRow, CrewLiveView } from "./crewTypes";
import { QueueReadStamp } from "./QueueReadStamp";
import type { CrewQueueRead } from "./crewTypes";

export const SINCE_VISIBLE = 8;

const OUTCOME_WORD: Record<CrewLiveRecentRow["outcome"], string> = {
  merged: "Merged",
  closed: "Closed",
  "closed-unmerged": "Closed, not merged",
};

/** Rows that landed after the previous visit, or none when there is no record of one. */
export function landedSince(rows: readonly CrewLiveRecentRow[], lastSeenAt: number | null): number {
  if (lastSeenAt === null) return 0;
  return rows.filter((row) => Date.parse(row.at) > lastSeenAt).length;
}

function Row({ row, isNew, now }: { row: CrewLiveRecentRow; isNew: boolean; now: number }) {
  return (
    <li className={cn("dp-crew__row", isNew && "dp-crew__row--new")} data-testid={`crew-since-${row.number}`}>
      <span className={cn("dp-crew__status", row.outcome === "closed-unmerged" && "dp-crew__status--wants")}>
        {OUTCOME_WORD[row.outcome]}
      </span>
      <span className="dp-crew__rowmain">
        <a className="dp-crew__link" href={row.url} target="_blank" rel="noreferrer">{row.title}</a>
        <span className="dp-crew__rowwhy">
          {ago(row.at, now)}
          {row.cards.length > 0 && <> · closes {row.cards.map((card) => `#${card}`).join(", ")}</>}
        </span>
      </span>
      {isNew && <span className="dp-crew__urgent">new</span>}
      <span className="dp-chrome dp-crew__mono">{row.kind === "pr" ? "PR" : "#"}{row.kind === "pr" ? ` ${row.number}` : row.number}</span>
    </li>
  );
}

export function CrewSinceYouLooked({
  live, queueRead, now, lastSeenAt,
}: {
  live: CrewLiveView;
  queueRead: CrewQueueRead;
  now: number;
  /** When this browser last opened the page, or null when it has no record. */
  lastSeenAt: number | null;
}) {
  const [showAll, setShowAll] = useState(false);
  if (!live.available) {
    return (
      <section className="dp-crew__card" data-testid="crew-since">
        <TableHead eyebrow="Since you last looked">
          <QueueReadStamp read={queueRead} now={now} />
        </TableHead>
        <p className="dp-crew__body dp-crew__body--soft dp-crew__gap">
          This block reads GitHub directly and GitHub has not answered yet. The crew’s own notes
          above and below still stand; this list fills in on the next tick.
        </p>
      </section>
    );
  }
  const rows = live.desk.recent;
  const fresh = landedSince(rows, lastSeenAt);
  const shown = showAll ? rows : rows.slice(0, SINCE_VISIBLE);
  return (
    <section className="dp-crew__card" data-testid="crew-since">
      <TableHead eyebrow="Since you last looked">
        {fresh > 0 && <span className="dp-crew__meta">{fresh} new</span>}
        <QueueReadStamp read={queueRead} now={now} />
      </TableHead>
      {rows.length === 0 ? (
        <div className="dp-crew__well dp-crew__gap">Nothing has finished in the last two days.</div>
      ) : (
        <>
          <ul className="dp-crew__rows dp-crew__gap">
            {shown.map((row) => (
              <Row
                key={`${row.kind}-${row.number}`}
                row={row}
                isNew={lastSeenAt !== null && Date.parse(row.at) > lastSeenAt}
                now={now}
              />
            ))}
          </ul>
          {rows.length > SINCE_VISIBLE && (
            <button
              type="button"
              className="dp-crew__more"
              onClick={() => setShowAll((current) => !current)}
              data-testid="crew-since-more"
            >
              {showAll ? "Show fewer" : `Show all ${rows.length}`}
            </button>
          )}
        </>
      )}
      <p className="dp-crew__foot">
        Everything merged or closed in the last two days, newest first. A row marked{" "}
        <span className="dp-crew__strong">new</span> landed after you last opened this page.
      </p>
    </section>
  );
}
