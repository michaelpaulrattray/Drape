/**
 * Open problems — severity first, plain sentences, no jargon.
 *
 * This is also where the briefing's own failure shows up: when
 * `crew-briefing.json` cannot be parsed the server returns a degraded state
 * carrying exactly one problem entry that says so. That is why the section
 * renders whenever there is anything to render and never hides behind an empty
 * check on the briefing as a whole — the one case where the page is most broken
 * is the case where this section is the only thing with anything in it.
 */
import { cn } from "@/lib/utils";
import type { CrewProblem } from "./crewTypes";

const SEVERITY_ORDER: Record<string, number> = { urgent: 0, warning: 1, info: 2 };
const SEVERITY_LABEL: Record<string, string> = {
  urgent: "Urgent",
  warning: "Warning",
  info: "Note",
};

export function CrewProblems({ problems }: { problems: readonly CrewProblem[] }) {
  const open = [...problems]
    .filter((problem) => problem.state === "open")
    .sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 3) - (SEVERITY_ORDER[b.severity] ?? 3));

  if (open.length === 0) return null;

  return (
    <section className="bg-white rounded-2xl border border-[#E5E5E5] p-5 sm:p-6">
      <h2 className="text-[11px] uppercase tracking-[0.12em] text-[#999] mb-3">Problems</h2>
      <ul className="space-y-4">
        {open.map((problem) => (
          <li key={problem.id}>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span
                className={cn(
                  "text-[11px] px-2 py-0.5 rounded-full border shrink-0",
                  problem.severity === "urgent"
                    ? "border-[#0A0A0A] text-[#0A0A0A]"
                    : "border-[#D5D5D5] text-[#999]",
                )}
              >
                {SEVERITY_LABEL[problem.severity] ?? problem.severity}
              </span>
              <h3 className="text-sm font-medium text-[#0A0A0A]">{problem.title}</h3>
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-[#666]">{problem.detail}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
