/**
 * ALREADY DEALT WITH — one history block where the page had three (#292).
 *
 * His verdict, verbatim: *"the recently answered and already judged sections
 * are double ups also i can see a bunch of things answered and only a few
 * things done this must be a mess also"*.
 *
 * It was three, not two — `Recently answered` under Needs You, `Already
 * judged` under the eye gallery, and `Recently landed` under the pipeline.
 * Three lists stacked down one page, differing only by which internal array
 * the item came from. **That distinction is ours, not his.** One heading now,
 * one list, and the kind is a tag on the row.
 *
 * # THE `done` TAG IS DERIVED, WHICH IS THE HALF THAT WAS BROKEN
 *
 * `answered` used to be written by a shift the moment he replied and never
 * revisited, so half of everything marked answered was actually FINISHED and
 * the page never said so — it under-reported its own progress, which is a bad
 * way round to be wrong. `scripts/crew-desk-sweep.mts` now promotes
 * `answered → done` from the issue's own state every shift. This component
 * only renders what that sweep found.
 */
import { useState } from "react";
import { cn } from "@/lib/utils";
import { foldHistory, recentHistory } from "./crewTypes";
import type { CrewEyeItem, CrewNeedsYouCard, CrewPipelineItem } from "./crewTypes";

const KIND_LABEL: Record<string, string> = {
  answered: "You answered",
  judged: "You judged",
  landed: "Landed",
};

export function CrewRecentHistory({
  cards,
  eyeItems,
  pipeline,
}: {
  cards: readonly CrewNeedsYouCard[];
  eyeItems: readonly CrewEyeItem[];
  pipeline: readonly CrewPipelineItem[];
}) {
  const [showAll, setShowAll] = useState(false);
  const rows = recentHistory(cards, eyeItems, pipeline);
  if (rows.length === 0) return null;

  /* Folded per kind, not off the top of the list: 65 decided cards sort ahead
     of 93 landed rows, so a flat cut showed him no shipped work at all. */
  const { recent, older } = foldHistory(rows);
  const visible = showAll ? rows : recent;
  const hidden = showAll ? 0 : older.length;

  return (
    <section
      className="bg-white rounded-2xl border border-[#E5E5E5] p-5 sm:p-6"
      data-testid="crew-recent-history"
    >
      <h2 className="text-[11px] uppercase tracking-[0.12em] text-[#999] mb-3">
        Already dealt with
      </h2>

      <ul className="space-y-2">
        {visible.map((row) => (
          <li key={row.key} className="flex items-baseline gap-3 text-sm">
            <span
              className={cn(
                "text-[11px] shrink-0 w-24",
                row.done ? "text-[#999]" : "text-[#666]",
              )}
            >
              {KIND_LABEL[row.kind] ?? row.kind}
            </span>
            <span className="flex-1 leading-relaxed text-[#666]">{row.title}</span>
            {row.issueNumber !== null && (
              <span className="text-[11px] text-[#BBB] shrink-0 tabular-nums">
                #{row.issueNumber}
              </span>
            )}
          </li>
        ))}
      </ul>

      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="mt-4 text-[11px] uppercase tracking-[0.12em] text-[#999] hover:text-[#0A0A0A] transition-colors"
        >
          Show {hidden} older
        </button>
      )}
    </section>
  );
}
