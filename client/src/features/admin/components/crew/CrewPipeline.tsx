/**
 * The build pipeline — what the crew has in flight, one row each.
 *
 * Deliberately the plainest section on the page. It answers one question at a
 * glance ("is anything stuck?") and nothing else; a status board with charts
 * would be the dashboard this page is explicitly not.
 */
import { cn } from "@/lib/utils";
import type { CrewPipelineItem } from "./crewTypes";

const STATUS_LABEL: Record<string, string> = {
  building: "Building",
  "in-review": "In review",
  "waiting-founder": "Waiting on you",
  merged: "Merged",
  blocked: "Blocked",
};

export function CrewPipeline({ items }: { items: readonly CrewPipelineItem[] }) {
  if (items.length === 0) return null;

  return (
    <section className="bg-white rounded-2xl border border-[#E5E5E5] p-5 sm:p-6">
      <h2 className="text-[11px] uppercase tracking-[0.12em] text-[#999] mb-3">Pipeline</h2>
      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span
              className={cn(
                "text-[11px] shrink-0 w-24",
                item.status === "waiting-founder" || item.status === "blocked"
                  ? "text-[#0A0A0A] font-medium"
                  : "text-[#999]",
              )}
            >
              {STATUS_LABEL[item.status] ?? item.status}
            </span>
            <div className="flex-1 min-w-[12rem]">
              <span className="text-sm leading-relaxed text-[#0A0A0A]">{item.title}</span>
              {item.note && <span className="text-sm text-[#999]"> — {item.note}</span>}
            </div>
            {item.prNumber !== null && (
              <span className="text-[11px] text-[#BBB] shrink-0 tabular-nums">
                PR {item.prNumber}
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
