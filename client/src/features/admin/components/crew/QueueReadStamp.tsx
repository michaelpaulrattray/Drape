/**
 * "read 12 s ago · live" — the one stamp every list drawn from the queue
 * carries (#1193), so each block says where its facts came from instead of
 * the page implying one instant it does not have.
 *
 * Three readings, three sentences, and the two that are not live SAY so:
 *  - live      — GitHub answered on the last tick;
 *  - stale     — the last good reading, with GitHub not answering since, and
 *                the reason beside it;
 *  - snapshot  — the edition's own list, written by a shift; the page is one
 *                cycle behind and this is the sentence that admits it.
 *
 * The time is relative because the live read is at most thirty seconds old
 * and an absolute clock reading beside "live" is a number he has to subtract.
 */
import { cn } from "@/lib/utils";
import { ago } from "./crewAgo";
import type { CrewQueueRead } from "./crewTypes";

export function QueueReadStamp({ read, now }: { read: CrewQueueRead; now: number }) {
  if (read.kind === "live") {
    return (
      <span className="dp-crew__live" data-testid="crew-queue-read" data-kind="live">
        <span aria-hidden="true" className="dp-crew__dot dp-crew__dot--live" />
        live · read {ago(read.readAt, now)}
      </span>
    );
  }
  if (read.kind === "stale") {
    return (
      <span
        className={cn("dp-crew__live", "dp-crew__live--stale")}
        data-testid="crew-queue-read"
        data-kind="stale"
        title={read.why ?? undefined}
      >
        last read {ago(read.readAt, now)} · GitHub is not answering
      </span>
    );
  }
  return (
    <span
      className={cn("dp-crew__live", "dp-crew__live--stale")}
      data-testid="crew-queue-read"
      data-kind="snapshot"
      title={read.why ?? undefined}
    >
      the crew’s reading, {ago(read.readAt, now)}
    </span>
  );
}
