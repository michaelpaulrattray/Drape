/**
 * IN FLIGHT — every open pull request, read from GitHub (#1193).
 *
 * This block was NOT DONE YET: the edition's pipeline rows minus the merged
 * ones, which meant a row read *in review* for an hour after it merged. It
 * now draws the PRs that are open RIGHT NOW, each with the one word that says
 * what it is waiting for — the gate, the reviewer's hand verdict, or its own
 * author (a draft) — and the cards its title names, so a change and the card
 * it closes are one row rather than two lists.
 *
 * When GitHub has not answered the edition's rows are drawn instead, under a
 * stamp that says so; that is the page as it was until today, and it is
 * still better than an empty block pretending nothing is open.
 */
import { cn } from "@/lib/utils";
import { SectionHead, SectionShell } from "./CrewShell";
import { ago } from "./crewAgo";
import { pipelineNotDone } from "./crewTypes";
import type { CrewLivePullRequest, CrewLiveView, CrewPipelineItem, CrewQueueRead } from "./crewTypes";
import { QueueReadStamp } from "./QueueReadStamp";

const STATUS_LABEL: Record<string, string> = {
  building: "Building",
  "in-review": "In review",
  "waiting-founder": "Waiting on you",
  merged: "Merged",
  blocked: "Blocked",
};

/** The one word per PR, in his terms — what it is waiting for, never what tool holds it. */
const PR_STATE_LABEL: Record<CrewLivePullRequest["state"], string> = {
  draft: "Still being written",
  held: "Waiting for review",
  gate: "In the gate",
};

function SnapshotRow({ item }: { item: CrewPipelineItem }) {
  const wantsAHuman = item.status === "waiting-founder" || item.status === "blocked";
  return (
    <li className="dp-crew__row">
      <span className={cn("dp-crew__status", wantsAHuman && "dp-crew__status--wants")}>
        {STATUS_LABEL[item.status] ?? item.status}
      </span>
      <span className="dp-crew__rowmain">
        {item.title}
        {item.note && <span className="dp-crew__rowwhy">{item.note}</span>}
      </span>
      {item.prNumber !== null && <span className="dp-chrome dp-crew__mono">PR {item.prNumber}</span>}
    </li>
  );
}

function LiveRow({ pr, now }: { pr: CrewLivePullRequest; now: number }) {
  return (
    <li className="dp-crew__row" data-testid={`crew-pr-${pr.number}`}>
      <span className={cn("dp-crew__status", pr.state === "held" && "dp-crew__status--wants")}>
        {PR_STATE_LABEL[pr.state]}
      </span>
      <span className="dp-crew__rowmain">
        <a className="dp-crew__link" href={pr.url} target="_blank" rel="noreferrer">{pr.title}</a>
        <span className="dp-crew__rowwhy">
          touched {ago(pr.updatedAt, now)}
          {pr.cards.length > 0 && (
            <> · for {pr.cards.map((card, index) => (
              <span key={card}>{index > 0 ? ", " : ""}<a className="dp-chrome dp-crew__ref" href={`#crew-issue-${card}`}>#{card}</a></span>
            ))}</>
          )}
        </span>
      </span>
      <span className="dp-chrome dp-crew__mono">PR {pr.number}</span>
    </li>
  );
}

export function CrewPipeline({
  live, snapshot, queueRead, now, embedded, first,
}: {
  live: CrewLiveView;
  snapshot: readonly CrewPipelineItem[];
  queueRead: CrewQueueRead;
  now: number;
  /** One block of the HAPPENING NOW card rather than a card of its own (#1201). */
  embedded?: boolean;
  first?: boolean;
}) {
  const liveRows = live.available ? live.desk.pullRequests : null;
  const snapshotRows = pipelineNotDone(snapshot);
  const count = liveRows ? liveRows.length : snapshotRows.length;
  return (
    <SectionShell embedded={embedded} first={first} testId="crew-pipeline">
      <SectionHead embedded={embedded} eyebrow="In flight">
        {count > 0 && <span className="dp-crew__meta">{count} open</span>}
        {/* The shared card stamps its reading once, on its own head. */}
        {!embedded && <QueueReadStamp read={queueRead} now={now} />}
      </SectionHead>
      {liveRows ? (
        liveRows.length === 0 ? (
          <div className="dp-crew__well dp-crew__gap">
            Nothing is in flight. A pull request appears here the moment a shift opens one.
          </div>
        ) : (
          <ul className="dp-crew__rows dp-crew__gap">
            {liveRows.map((pr) => <LiveRow key={pr.number} pr={pr} now={now} />)}
          </ul>
        )
      ) : snapshotRows.length === 0 ? (
        <div className="dp-crew__well dp-crew__gap">
          Nothing is stuck. Blocked work and anything waiting on you appears here.
        </div>
      ) : (
        <ul className="dp-crew__rows dp-crew__gap">
          {snapshotRows.map((item) => <SnapshotRow key={item.id} item={item} />)}
        </ul>
      )}
    </SectionShell>
  );
}
