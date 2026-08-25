/**
 * The program banner — mission, focus, current milestone, ladder.
 *
 * First on the page because it is first in his reading order on the Desk: what
 * we are building, what he has confirmed, where we are inside it. His verbatim
 * confirming quote is rendered as a quote and never paraphrased — a focus is
 * set by his word, and the word is the evidence that it was.
 */
import { cn } from "@/lib/utils";
import type { CrewBriefingView } from "./crewTypes";

const FOCUS_LABEL: Record<string, string> = {
  confirmed: "Confirmed",
  proposed: "Proposed — awaiting your word",
  none: "No focus set",
};

const STEP_LABEL: Record<string, string> = {
  done: "Done",
  "in-progress": "In progress",
  waiting: "Waiting",
  blocked: "Blocked",
};

const RUNG_LABEL: Record<string, string> = {
  done: "Done",
  current: "Current",
  queued: "Queued",
  parked: "Parked",
};

export function CrewProgramBanner({ program }: { program: CrewBriefingView["program"] }) {
  return (
    <section className="bg-white rounded-2xl border border-[#E5E5E5] p-5 sm:p-6">
      <h2 className="text-[11px] uppercase tracking-[0.12em] text-[#999] mb-3">The program</h2>

      <p className="text-base leading-relaxed text-[#0A0A0A]">{program.mission}</p>

      <div className="mt-5 pt-5 border-t border-[#EFEFEF]">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-[11px] uppercase tracking-[0.12em] text-[#999]">Focus</span>
          <span className="text-sm font-semibold text-[#0A0A0A]">
            {program.focus.title || "—"}
          </span>
          <span
            className={cn(
              "text-[11px] px-2 py-0.5 rounded-full border",
              program.focus.state === "confirmed"
                ? "border-[#0A0A0A] text-[#0A0A0A]"
                : "border-[#D5D5D5] text-[#999]",
            )}
          >
            {FOCUS_LABEL[program.focus.state] ?? program.focus.state}
          </span>
        </div>

        {program.focus.quote && (
          <blockquote className="mt-2 pl-3 border-l-2 border-[#0A0A0A] text-sm text-[#444] italic">
            “{program.focus.quote}”
            {program.focus.quotedAt && (
              <span className="not-italic text-[#999]"> — you, {shortDate(program.focus.quotedAt)}</span>
            )}
          </blockquote>
        )}
      </div>

      {program.milestone && (
        <div className="mt-5 pt-5 border-t border-[#EFEFEF]">
          <h3 className="text-sm font-semibold text-[#0A0A0A]">{program.milestone.title}</h3>
          <ol className="mt-3 space-y-2">
            {program.milestone.steps.map((step, index) => (
              <li key={`${index}-${step.title}`} className="flex items-baseline gap-3 text-sm">
                <span className="text-[#BBB] tabular-nums w-4 shrink-0">{index + 1}</span>
                <span
                  className={cn(
                    "flex-1 leading-relaxed",
                    step.state === "done" ? "text-[#999]" : "text-[#0A0A0A]",
                  )}
                >
                  {step.title}
                </span>
                <span className="text-[11px] text-[#999] shrink-0">
                  {STEP_LABEL[step.state] ?? step.state}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {program.ladder.length > 0 && (
        <div className="mt-5 pt-5 border-t border-[#EFEFEF]">
          <h3 className="text-[11px] uppercase tracking-[0.12em] text-[#999] mb-2">The ladder</h3>
          <ul className="space-y-1.5">
            {program.ladder.map((rung) => (
              <li key={rung.key} className="flex items-baseline gap-3 text-sm">
                <span className="text-[#999] tabular-nums shrink-0 w-14">{rung.key}</span>
                <span
                  className={cn(
                    "flex-1 leading-relaxed",
                    rung.state === "current" ? "text-[#0A0A0A] font-medium" : "text-[#666]",
                  )}
                >
                  {rung.title}
                </span>
                <span className="text-[11px] text-[#999] shrink-0">
                  {RUNG_LABEL[rung.state] ?? rung.state}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/** A date he can read at a glance. Never a relative "2 hours ago" — a ruling's
 *  date is a fact and relative time makes it a moving one. */
export function shortDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
