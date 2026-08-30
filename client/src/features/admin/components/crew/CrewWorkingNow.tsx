/**
 * WORKING NOW — what the team is doing, while it does it (issue #272).
 *
 * Founder, 2026-08-30, verbatim: *"if my shifts are running and i have no idea
 * what they are working on or doing thats dangerous"*.
 *
 * It sits ABOVE the program banner, which is the only thing on this page that
 * outranks the briefing itself: everything below describes what the team has
 * DONE, and this says what it is doing to his product right now.
 *
 * # THREE STATES, AND THE THIRD IS THE ONE THAT MATTERS
 *
 * - **Working now** — a run with a live heartbeat.
 * - **Nothing running** — no open run. Said plainly, never left blank; #272's
 *   bar is *"With nothing running, it says so — never a stale 'working on'."*
 * - **Stalled** — an open run whose shift died without stamping it. Derived
 *   from the heartbeat in `shared/crewShiftState.ts`, because a shift that dies
 *   cannot write that it died.
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
 */
import { deriveShiftRunState } from "@shared/crewShiftState";
import { cn } from "@/lib/utils";
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

/** The card reference and title, when the run named one. */
function CardLine({ run }: { run: CrewShiftRunView }) {
  if (!run.cardRef && !run.cardTitle) return null;
  return (
    <span className="text-[#0A0A0A]">
      {run.cardRef && <span className="font-medium">{run.cardRef}</span>}
      {run.cardRef && run.cardTitle && " · "}
      {run.cardTitle}
    </span>
  );
}

function RunBody({ run, now }: { run: CrewShiftRunView; now: number }) {
  return (
    <>
      <p className="text-[14px] leading-[1.5] text-[#0A0A0A]">
        <CardLine run={run} />
      </p>
      <p className="text-[13px] leading-[1.55] text-[#444] mt-1">{run.intent}</p>
      <p className="text-[11px] text-[#999] mt-2">
        {run.shift} · {run.seat} · {KIND_LABEL[run.workKind] ?? run.workKind} · started {ago(run.startedAt, now)}
        {run.branch && <> · <span className="font-mono text-[10px]">{run.branch}</span></>}
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
    <li className="flex items-baseline gap-2 text-[12px] leading-[1.6]">
      <span
        className={cn(
          "shrink-0 text-[10px] uppercase tracking-[0.08em] w-[52px]",
          run.outcome === "failed" ? "text-[#C0473A]" : "text-[#999]",
        )}
      >
        {OUTCOME_LABEL[run.outcome ?? ""] ?? "—"}
      </span>
      <span className="text-[#444] min-w-0">
        {run.cardRef && <span className="text-[#0A0A0A]">{run.cardRef} </span>}
        {run.outcomeNote ?? run.intent}
        {run.prNumber && <span className="text-[#999]"> · PR #{run.prNumber}</span>}
        <span className="text-[#999]"> · {run.shift}, {ago(run.endedAt ?? run.startedAt, now)}</span>
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
      <section className="bg-white rounded-2xl border border-[#E5E5E5] p-5 sm:p-6">
        <h2 className="text-[11px] uppercase tracking-[0.12em] text-[#999] mb-2">Working now</h2>
        <p className="text-[14px] text-[#666]">Not live yet.</p>
        <p className="text-[12px] text-[#999] mt-1">
          The shift row needs its table in this database — one command, and it is yours to run:
          {" "}
          <span className="font-mono text-[11px] text-[#666]">
            railway.cmd run --service MySQL -- npx tsx scripts/ceremony-crew-shift-runs.mts --production
          </span>
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
    <section
      className={cn(
        "bg-white rounded-2xl border p-5 sm:p-6",
        state === "stalled" ? "border-[#C0473A]" : "border-[#E5E5E5]",
      )}
    >
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <h2 className="text-[11px] uppercase tracking-[0.12em] text-[#999]">Working now</h2>
        {state === "running" && (
          /* The one live signal on the page. `aria-hidden` because the state is
             already said in words below — a screen reader should not hear a
             decoration. */
          <span className="flex items-center gap-1.5 text-[11px] text-[#0A0A0A]">
            <span aria-hidden className="w-1.5 h-1.5 rounded-full bg-[#0A0A0A] animate-pulse" />
            live
          </span>
        )}
      </div>

      {state === null && (
        <p className="text-[14px] text-[#666]">Nothing running.</p>
      )}

      {state === "running" && open && <RunBody run={open} now={now} />}

      {state === "stalled" && open && (
        <>
          <p className="text-[13px] text-[#C0473A] mb-2">
            Stalled — this shift has not checked in for over an hour and never stamped itself
            finished. It has probably died.
          </p>
          <RunBody run={open} now={now} />
        </>
      )}

      {past.length > 0 && (
        <div className="mt-4 pt-4 border-t border-[#EEE]">
          <h3 className="text-[11px] uppercase tracking-[0.12em] text-[#999] mb-2">Recent shifts</h3>
          <ul className="space-y-1">
            {past.map((run) => <PastRun key={run.id} run={run} now={now} />)}
          </ul>
        </div>
      )}
    </section>
  );
}
