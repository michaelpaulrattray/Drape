/**
 * The program banner — mission, focus, current milestone, ladder.
 *
 * First on the page because it is first in his reading order on the Desk: what
 * we are building, what he has confirmed, where we are inside it. His verbatim
 * confirming quote is rendered as a quote and never paraphrased — a focus is
 * set by his word, and the word is the evidence that it was.
 */
import { cn } from "@/lib/utils";
import { milestoneCountLine, milestoneProgress } from "./crewTypes";
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

const CHIP_TONE: Record<string, string> = {
  good: "border-[#0A0A0A] text-[#0A0A0A]",
  /* The one non-monochrome value, deliberately: the house's sanctioned error
     red (tokens.css --errorInk), not an ad-hoc amber — a warn chip is a
     problem wearing a smaller badge (PR #78 review note). */
  warn: "border-[#C0473A] text-[#C0473A]",
  neutral: "border-[#D5D5D5] text-[#666]",
};

export function CrewProgramBanner({ program }: { program: CrewBriefingView["program"] }) {
  return (
    <section className="bg-white rounded-2xl border border-[#E5E5E5] p-5 sm:p-6">
      <h2 className="text-[11px] uppercase tracking-[0.12em] text-[#999] mb-3">The program</h2>

      {/* At-a-glance chips (#74). A chip's source is the reading it cites —
          shown under it in small type, never hidden in a tooltip he has to
          discover. */}
      {program.chips.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {program.chips.map((chip, index) => (
            /* Composite key (PR #78 review nit): labels are writer-controlled
               and the schema does not force them unique. */
            <div key={`${index}-${chip.label}`} className="max-w-[16rem]">
              <span
                className={cn(
                  "inline-block text-[11px] px-2 py-0.5 rounded-full border",
                  CHIP_TONE[chip.tone] ?? CHIP_TONE.neutral,
                )}
              >
                {chip.label}
              </span>
              {chip.source && (
                <p className="mt-0.5 pl-1 text-[10px] leading-snug text-[#BBB]">{chip.source}</p>
              )}
            </div>
          ))}
        </div>
      )}

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

          {/* The progress bar (#74 item 1) — READ off the steps below, never a
              second number beside them. An in-progress step fills half, so the
              bar moves the day work starts. */}
          {program.milestone.steps.length > 0 && (() => {
            const progress = milestoneProgress(program.milestone.steps);
            return (
              <div className="mt-3">
                <div className="h-1.5 rounded-full bg-[#EFEFEF] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#0A0A0A] transition-[width]"
                    style={{ width: `${Math.round(progress.fraction * 100)}%` }}
                  />
                </div>
                <p className="mt-1.5 text-[11px] text-[#999]">{milestoneCountLine(progress)}</p>
              </div>
            );
          })()}

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

          {/* The rung bar (#74 item 2) — the whole climb in one glance: filled
              is done, black-ringed is where we stand, light is queued, dashed
              is parked. The list below stays the reading copy. */}
          <div className="flex items-end gap-1 mb-3" aria-hidden="true">
            {program.ladder.map((rung) => (
              <div key={`bar-${rung.key}`} className="flex-1 min-w-0">
                <div
                  className={cn(
                    "h-2 rounded-sm",
                    rung.state === "done" && "bg-[#0A0A0A]",
                    rung.state === "current" && "bg-white border-2 border-[#0A0A0A]",
                    rung.state === "queued" && "bg-[#E5E5E5]",
                    rung.state === "parked" && "bg-transparent border border-dashed border-[#CCC]",
                  )}
                />
                <p
                  className={cn(
                    "mt-1 text-[10px] tabular-nums truncate",
                    rung.state === "current" ? "text-[#0A0A0A] font-medium" : "text-[#BBB]",
                  )}
                >
                  {rung.key}
                </p>
              </div>
            ))}
          </div>

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
