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
 * ⚠ **BRIEF 08 §7 FORBIDS SPLITTING THIS BACK APART**, in as many words: *"If
 * the diff … splits history back apart, it has gone wrong."* It is one list.
 *
 * # THE `done` TAG IS DERIVED, WHICH IS THE HALF THAT WAS BROKEN
 *
 * `answered` used to be written by a shift the moment he replied and never
 * revisited, so half of everything marked answered was actually FINISHED and
 * the page never said so — it under-reported its own progress, which is a bad
 * way round to be wrong. `scripts/crew-desk-sweep.mts` now promotes
 * `answered → done` from the issue's own state every shift. This component
 * only renders what that sweep found.
 *
 * ⚠ **AND §6 ASKS FOR IT DIMMER THROUGHOUT** — `--metaStrong` bodies, mono
 * dates and ids, no card per entry. His reason: *"It is memory, not work."*
 */
import { useState } from "react";
import { cn } from "@/lib/utils";
import { TableHead } from "@/foundation";
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
    <section className="dp-crew__card" data-testid="crew-recent-history">
      {/* ⚠ NO COUNT IN THE META. §3 moves the count that was ALREADY rendered
          inline — `Needs you · 3` — into the head's right slot. This section
          never had one, and adding a number here would be content rather than
          surface, which is the one thing §1 forbids. */}
      <TableHead eyebrow="Already dealt with" />

      <ul className="dp-crew__hist dp-crew__gap">
        {visible.map((row) => (
          <li key={row.key} className="dp-crew__histrow">
            <span className={cn("dp-crew__kind", row.done && "dp-crew__kind--done")}>
              {KIND_LABEL[row.kind] ?? row.kind}
            </span>
            <span className="dp-crew__histtitle">{row.title}</span>
            {/* An issue number is a measured value, so it is mono (§4). */}
            {row.issueNumber !== null && (
              <span className="dp-crew__mono">#{row.issueNumber}</span>
            )}
          </li>
        ))}
      </ul>

      {hidden > 0 && (
        <button type="button" onClick={() => setShowAll(true)} className="dp-crew__more">
          Show {hidden} older
        </button>
      )}
    </section>
  );
}
