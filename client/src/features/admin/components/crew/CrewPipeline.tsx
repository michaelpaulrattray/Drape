/**
 * The build pipeline — what the crew has in flight, one row each.
 *
 * Deliberately the plainest section on the page. It answers one question at a
 * glance ("is anything stuck?") and nothing else; a status board with charts
 * would be the dashboard this page is explicitly not.
 */
import { cn } from "@/lib/utils";
import { splitPipeline } from "./crewTypes";
import type { CrewPipelineItem } from "./crewTypes";

const STATUS_LABEL: Record<string, string> = {
  building: "Building",
  "in-review": "In review",
  "waiting-founder": "Waiting on you",
  merged: "Merged",
  blocked: "Blocked",
};

function PipelineRow({ item }: { item: CrewPipelineItem }) {
  return (
    <li className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
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
        <span
          className={cn(
            "text-sm leading-relaxed",
            item.status === "merged" ? "text-[#666]" : "text-[#0A0A0A]",
          )}
        >
          {item.title}
        </span>
        {item.note && <span className="text-sm text-[#999]"> — {item.note}</span>}
      </div>
      {item.prNumber !== null && (
        <span className="text-[11px] text-[#BBB] shrink-0 tabular-nums">
          PR {item.prNumber}
        </span>
      )}
    </li>
  );
}

/**
 * Split into what is MOVING and what has LANDED (#74 items 4 and 6): the
 * founder's gap list named momentum as invisible. "Landed" is derived from the
 * merged status the shifts already record — never a second list.
 */
export function CrewPipeline({ items }: { items: readonly CrewPipelineItem[] }) {
  if (items.length === 0) return null;
  const { inFlight, landed } = splitPipeline(items);

  return (
    <section className="bg-white rounded-2xl border border-[#E5E5E5] p-5 sm:p-6">
      <h2 className="text-[11px] uppercase tracking-[0.12em] text-[#999] mb-3">Pipeline</h2>
      {inFlight.length === 0 ? (
        <p className="text-sm text-[#999]">Nothing in flight right now.</p>
      ) : (
        <ul className="space-y-3">
          {inFlight.map((item) => (
            <PipelineRow key={item.id} item={item} />
          ))}
        </ul>
      )}

      {landed.length > 0 && (
        <div className="mt-5 pt-5 border-t border-[#EFEFEF]">
          <h3 className="text-[11px] uppercase tracking-[0.12em] text-[#999] mb-3">
            Recently landed
          </h3>
          <ul className="space-y-3">
            {landed.map((item) => (
              <PipelineRow key={item.id} item={item} />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
