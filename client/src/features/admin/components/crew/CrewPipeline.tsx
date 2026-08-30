/**
 * WHAT IS NOT DONE — the pipeline, cut to the rows that can change what he
 * does (#291).
 *
 * His verdict, verbatim: *"yeah your right the current pipeline design is a
 * mess a massive list i cant tell whats going on"*. It held **107 entries and
 * 92 were merged** — a changelog presented as a status view, with the fifteen
 * rows that mattered scattered through it.
 *
 * Two changes, and neither is cosmetic:
 *
 *  - **the merged rows left.** They are history and they now live in the one
 *    recent-history block with everything else he has already dealt with.
 *    This section is only what is still moving, still stuck, or still his.
 *  - **the order is by how much a row wants a human** — blocked, then waiting
 *    on him, then in review, then building — rather than by when a shift
 *    happened to write it down.
 *
 * ⚠ **`waiting-founder` IS NOT A WORD A SHIFT MAY SIMPLY TYPE ANY MORE.** Seven
 * rows here said "Waiting on you" while his desk said nothing was, and both
 * sections were on the same screen. The schema now refuses a `waiting-founder`
 * row that does not name an OPEN needs-you card, so the day he answers, the
 * row goes red in the next shift's own commit instead of quietly outliving his
 * reply.
 */
import { cn } from "@/lib/utils";
import { pipelineNotDone } from "./crewTypes";
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
        <span className="text-sm leading-relaxed text-[#0A0A0A]">{item.title}</span>
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

export function CrewPipeline({ items }: { items: readonly CrewPipelineItem[] }) {
  const notDone = pipelineNotDone(items);

  return (
    <section
      className="bg-white rounded-2xl border border-[#E5E5E5] p-5 sm:p-6"
      data-testid="crew-pipeline"
    >
      <h2 className="text-[11px] uppercase tracking-[0.12em] text-[#999] mb-3">
        Not done yet {notDone.length > 0 && <span className="text-[#0A0A0A]">· {notDone.length}</span>}
      </h2>
      {notDone.length === 0 ? (
        <p className="text-sm text-[#999]">
          Nothing is in flight. Everything the crew has started has landed.
        </p>
      ) : (
        <ul className="space-y-3">
          {notDone.map((item) => (
            <PipelineRow key={item.id} item={item} />
          ))}
        </ul>
      )}
    </section>
  );
}
