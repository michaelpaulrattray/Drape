/**
 * Open problems — severity first, plain sentences, no jargon.
 *
 * This is also where the briefing's own failure shows up: when
 * `crew-briefing.json` cannot be parsed the server returns a degraded state
 * carrying exactly one problem entry that says so. That is why the section
 * renders whenever there is anything to render and never hides behind an empty
 * check on the briefing as a whole — the one case where the page is most broken
 * is the case where this section is the only thing with anything in it.
 *
 * ⚠ **THIS IS THE ONE SECTION WHERE COLOUR IS LEGITIMATE (brief 08 §6).** His
 * words: *"A problem is urgent; a waiting card is not."* Urgent takes
 * `--errorInk`; a warning does not. Before this brief, urgent wore the same
 * ink border as everything else on the page, so the section that exists to
 * flag trouble looked exactly like the section that lists rungs.
 *
 * `--errorInk` and never plain `--error`, because this is TEXT: `tokens.css`
 * records `--error` on the dark surface at 3.40:1, below the AA floor.
 */
import { cn } from "@/lib/utils";
import { TableHead } from "@/foundation";
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
    <section className="dp-crew__card">
      {/* No count: §3 moves the counts that were already rendered inline, and
          this section never had one. A new number is content, not surface. */}
      <TableHead eyebrow="Problems" />
      <ul className="dp-crew__probs dp-crew__gap">
        {open.map((problem) => (
          <li key={problem.id}>
            <div className="dp-crew__focus">
              <span
                className={cn(
                  "dp-crew__sev",
                  problem.severity === "urgent" && "dp-crew__sev--urgent",
                )}
              >
                {SEVERITY_LABEL[problem.severity] ?? problem.severity}
              </span>
              <h3 className="dp-crew__title">{problem.title}</h3>
            </div>
            <p className="dp-crew__body dp-crew__body--soft dp-crew__gap--tight">
              {problem.detail}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
