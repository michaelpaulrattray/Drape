/**
 * WORKING NOW — what the team is doing, while it does it (issue #272).
 *
 * Founder, 2026-08-30, verbatim: *"if my shifts are running and i have no idea
 * what they are working on or doing thats dangerous"*.
 *
 * ⚠ **REVERSED BY HIS ORDER (#437, 2026-09-02).** This said *"it sits ABOVE
 * the program banner, which is the only thing on this page that outranks the
 * briefing itself"* — honest reasoning that lost to his, kept here rather than
 * deleted so nobody restores the old order as a fix. THE PROGRAM is now first
 * on the page, whole, on his *"yes the easier fix"*.
 *
 * It still leads everything that describes what the team has DONE: this says
 * what it is doing to his product right now, and it sits second only to the
 * briefing itself.
 *
 * # THREE STATES, AND THE THIRD IS THE ONE THAT MATTERS
 *
 * - **Working now** — a run with a live heartbeat.
 * - **Nothing running** — no open run. Said plainly, never left blank; #272's
 *   bar is *"With nothing running, it says so — never a stale 'working on'."*
 * - **No check-in** — an open run that has not stamped a step inside the
 *   window and has not stamped itself finished. Derived from the heartbeat in
 *   `shared/crewShiftState.ts`, because a shift that dies cannot write that it
 *   died.
 *
 *   ⚠ **It reports the fact and stops there (issue #295).** This block used to
 *   read *"It has probably died"* — a CLAIM, and the founder read it over a
 *   shift that had merged a PR thirty minutes earlier and shipped a briefing
 *   edition one minute earlier. Nothing reports process liveness to the
 *   database, so *dead* and *inside a long step* are indistinguishable from
 *   here. The surface says WHEN the last check-in was and lets him judge.
 *
 * A fourth, and it is honest rather than a state of the team: **not live yet**,
 * when the table exists in the code and not in the database. It is drawn as an
 * explicitly dark instrument rather than as "nothing running", because those
 * two look identical and mean opposite things.
 *
 * # NO PROGRESS BAR, NO LOG, NO PER-FILE ACTIVITY
 *
 * #272 puts all three out of scope in as many words: *"He does not need to
 * watch it work; he needs to know what it is doing and be able to stop it."*
 *
 * # ⚠ BRIEF 08 NEVER SAW THIS COMPONENT, AND ITS RED IS A STATED DEPARTURE
 *
 * #272 landed after the mockup was drawn, so §6 does not list it. Its §7 bans
 * colour by state except on warn chips and Problems — and this component has
 * two coloured things: the no-check-in reading, and a `failed` outcome in the
 * short list beneath.
 *
 * **Both stay, as `--errorInk`.** They are the *problem* class §6 admits, not
 * decoration: a shift that has stopped checking in is the single thing on this
 * page worth acting on tonight, and brief 07's own rule one surface over is
 * that fine is colourless and red means urgent. Nothing else here is coloured.
 */
import { deriveShiftRunState } from "@shared/crewShiftState";
import { cn } from "@/lib/utils";
import { TableHead } from "@/foundation";
import type { CrewShiftRunView, CrewShiftRunsView } from "./crewTypes";

/** How a run's kind reads in a sentence. `background` is called out by name. */
const KIND_LABEL: Record<string, string> = {
  focus: "the focus",
  sidelane: "side lane",
  patrol: "patrol",
  maintenance: "maintenance",
  background: "background work",
};

const OUTCOME_LABEL: Record<string, string> = {
  shipped: "Shipped",
  stopped: "Stopped",
  failed: "Failed",
};

/** "14 min ago" / "3 h ago" — coarse, because this is a status strip. */
function ago(value: Date | string, now: number): string {
  const then = value instanceof Date ? value.getTime() : new Date(value).getTime();
  if (!Number.isFinite(then)) return "unknown";
  const minutes = Math.max(0, Math.round((now - then) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}

/**
 * An absolute wall-clock time, in HIS timezone — "20:17".
 *
 * Everything else on this strip is relative ("14 min ago") because a status
 * strip reads better that way. The no-check-in line is the one place an
 * absolute time earns its space: #295 asks for *"no check-in since HH:MM"*
 * precisely so he can compare it against what he knows was happening — a merge
 * he saw, an edition that landed — instead of doing the subtraction himself.
 *
 * The browser's own zone, not UTC: he reads this page on his machine, and a
 * time he has to convert is a time he will not check.
 *
 * ⚠ **24-hour, forced.** The locale default here is `03:48 pm`, and it was
 * shipped that way for exactly as long as it took to look at it: every other
 * time in his world is 24-hour — the runner's close-stamps, the shift rows,
 * his own #295 report quoting `19:46` and `20:17` — so the one clock he would
 * be comparing against was the one written differently. Caught by rendering
 * it, not by reading the diff.
 */
function clockTime(value: Date | string): string {
  const then = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(then.getTime())) return "an unreadable time";
  return then.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
}

/** The card reference and title, when the run named one. */
function CardLine({ run }: { run: CrewShiftRunView }) {
  if (!run.cardRef && !run.cardTitle) return null;
  return (
    <span>
      {run.cardRef && <span className="dp-crew__strong">{run.cardRef}</span>}
      {run.cardRef && run.cardTitle && " · "}
      {run.cardTitle}
    </span>
  );
}

function RunBody({ run, now }: { run: CrewShiftRunView; now: number }) {
  return (
    <>
      <p className="dp-crew__mission">
        <CardLine run={run} />
      </p>
      <p className="dp-crew__body dp-crew__body--soft dp-crew__gap--tight">{run.intent}</p>
      {/* A shift id, a seat, an elapsed time and a branch are all measured
          values, so the whole line is mono (§4). */}
      <p className="dp-crew__mono dp-crew__gap--tight">
        {run.shift} · {run.seat} · {KIND_LABEL[run.workKind] ?? run.workKind} · started{" "}
        {ago(run.startedAt, now)}
        {run.branch && <> · {run.branch}</>}
      </p>
    </>
  );
}

/**
 * One finished run, in the short list beneath.
 *
 * #272 asks for "the last three shifts, so he can see the recent past without
 * opening GitHub" — so this is deliberately one line and not a card.
 */
function PastRun({ run, now }: { run: CrewShiftRunView; now: number }) {
  return (
    <li className="dp-crew__pastrow">
      <span
        className={cn(
          "dp-crew__outcome",
          run.outcome === "failed" && "dp-crew__outcome--failed",
        )}
      >
        {OUTCOME_LABEL[run.outcome ?? ""] ?? "—"}
      </span>
      <span>
        {run.cardRef && <span className="dp-crew__strong">{run.cardRef} </span>}
        {run.outcomeNote ?? run.intent}
        {run.prNumber && <span className="dp-crew__body--quiet"> · PR #{run.prNumber}</span>}
        <span className="dp-crew__body--quiet">
          {" "}· {run.shift}, {ago(run.endedAt ?? run.startedAt, now)}
        </span>
      </span>
    </li>
  );
}

export function CrewWorkingNow({ shiftRuns, now }: { shiftRuns: CrewShiftRunsView; now: number }) {
  /*
    THE DARK INSTRUMENT SAYS SO. `available: false` means the table is not in
    this database yet — the window between this deploy and the founder's
    ceremony. Drawing "Nothing running" here would be a confident answer from an
    instrument that cannot see, which is the one thing a status strip must never
    do.
  */
  if (!shiftRuns.available) {
    return (
      <section className="dp-crew__card">
        <TableHead eyebrow="Working now" />
        <p className="dp-crew__mission dp-crew__body--soft dp-crew__gap">Not live yet.</p>
        <p className="dp-crew__body dp-crew__body--quiet dp-crew__gap--tight">
          The shift row needs its table in this database — one command, and it is yours to run:
        </p>
        <p className="dp-crew__command dp-crew__gap--tight">
          railway.cmd run --service MySQL -- npx tsx scripts/ceremony-crew-shift-runs.mts
          --production
        </p>
      </section>
    );
  }

  const runs = shiftRuns.runs;
  /* The open run, if there is one. Only one can be "current"; the reader orders
     newest first, so this is the newest unstamped row. */
  const open = runs.find((run) => run.endedAt === null);
  const state = open ? deriveShiftRunState(open, now) : null;
  /* Everything else, whether it closed or was superseded. */
  const past = runs.filter((run) => run.id !== open?.id).slice(0, 3);

  return (
    <section className={cn("dp-crew__card", state === "stalled" && "dp-crew__card--alert")}>
      <TableHead eyebrow="Working now">
        {state === "running" && (
          /* The one live signal on the page. `aria-hidden` on the dot because
             the state is already said in words below — a screen reader should
             not hear a decoration. */
          <span className="dp-crew__live">
            <span aria-hidden className="dp-crew__dot" />
            live
          </span>
        )}
      </TableHead>

      {state === null && (
        <p className="dp-crew__mission dp-crew__body--soft dp-crew__gap">Nothing running.</p>
      )}

      {state === "running" && open && (
        <div className="dp-crew__gap">
          <RunBody run={open} now={now} />
        </div>
      )}

      {state === "stalled" && open && (
        <div className="dp-crew__gap">
          {/*
            ⚠ THE WORDS ARE A READING, NOT A VERDICT (#295). What is known is
            the timestamp; what is NOT known is whether the process is alive.
            Both possibilities are named, in that order, and neither is ranked —
            the founder is the one with the terminal.
          */}
          <p className="dp-crew__alert">
            No check-in since {clockTime(open.heartbeatAt)}
            {" "}({ago(open.heartbeatAt, now)}), and it has not stamped itself finished.
            {" "}
            <span className="dp-crew__body--soft">
              It may be inside a long step, or it may have died — this page cannot tell which.
            </span>
          </p>
          <RunBody run={open} now={now} />
        </div>
      )}

      {past.length > 0 && (
        <div className="dp-crew__rule dp-crew__rule--tight">
          <h3 className="dp-crew__subhead">Recent shifts</h3>
          <ul className="dp-crew__past dp-crew__gap--tight">
            {past.map((run) => <PastRun key={run.id} run={run} now={now} />)}
          </ul>
        </div>
      )}
    </section>
  );
}
