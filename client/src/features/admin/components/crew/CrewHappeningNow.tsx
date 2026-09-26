/**
 * HAPPENING NOW — what is running, what is in the gate, what is next, on ONE
 * card (#1201). His word, 2026-09-25: *"shouldnt next up card and in flight
 * card and working now card be together or on the same card for an easy
 * visual overlook? at the moment i have to scroll to different parts of the
 * page to get a quick picture"*.
 *
 * The three blocks are the three components as they were, framed as blocks
 * (`embedded`) under one eyebrow and one reading stamp. Their order is the
 * question's own: now, then the gate, then next.
 */
import { TableHead } from "@/foundation";
import { CrewNextUp } from "./CrewNextUp";
import { CrewPipeline } from "./CrewPipeline";
import { CrewWorkingNow } from "./CrewWorkingNow";
import type {
  CrewLiveView, CrewNeedsYouCard, CrewNextUpSource, CrewPipelineItem, CrewQueueRead, CrewShiftRunsView,
} from "./crewTypes";
import { QueueReadStamp } from "./QueueReadStamp";

export function CrewHappeningNow({
  shiftRuns, live, pipelineSnapshot, nextUp, cards, queueRead, now,
}: {
  shiftRuns: CrewShiftRunsView;
  live: CrewLiveView;
  pipelineSnapshot: readonly CrewPipelineItem[];
  nextUp: CrewNextUpSource;
  cards: readonly CrewNeedsYouCard[];
  queueRead: CrewQueueRead;
  now: number;
}) {
  return (
    <section className="dp-crew__card" data-testid="crew-happening-now">
      <TableHead eyebrow="Happening now">
        <QueueReadStamp read={queueRead} now={now} />
      </TableHead>
      <CrewWorkingNow shiftRuns={shiftRuns} now={now} embedded first />
      <CrewPipeline live={live} snapshot={pipelineSnapshot} queueRead={queueRead} now={now} embedded />
      {/* ⚠ #1345 — NEXT UP now carries the same build phrase the other lists do,
          and the facts come from the `live` view this card already holds rather
          than from two new props threaded down through `AdminCrew`. Read HERE
          because this is where `live` already is; the shape of the read is the
          one `AdminCrew` uses for Background Work, and both defer to
          `shared/crewCardBuildState.ts` for the judgement itself, which is what
          keeps them one answer rather than two. Empty when GitHub has not
          answered at all — the same window every other live list falls back in,
          and an absent read cannot invent a builder. */}
      <CrewNextUp
        nextUp={nextUp}
        queueRead={queueRead}
        now={now}
        cards={cards}
        builds={live.available ? live.desk.builds.items : []}
        buildsWhy={live.available ? live.desk.builds.commentsWhy : null}
        embedded
      />
    </section>
  );
}
