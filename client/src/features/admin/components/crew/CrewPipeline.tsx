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
 *
 * ⚠ **THE HEADING KEEPS ITS WORDS (#398 §1).** Brief 08's §3 calls this section
 * `THE PIPELINE`. It says *Not done yet*, which is #291 — his own ruling above
 * — and §1 is explicit that where the mockup and the built Crew disagree on
 * content, the built one wins. The head changed FACE, not words.
 *
 * # ⚠ THE EMPTY LINE SAYS WHAT THE SECTION IS FOR (#438)
 *
 * He asked whether this section and `ALREADY DEALT WITH` were cards he even
 * needed. **The measurement answered the two differently**: at edition 209 the
 * history block held 281 rows and this one held NONE, because every pipeline
 * row was merged. So the history block went and this one stayed — **and its
 * emptiness is the argument FOR it.** This is the only place a card appears
 * that is blocked, waiting on him, in review or building AND is not in his
 * `founder-ordered` queue (that is NEXT UP) and not a step of the current
 * milestone (that is THE PROGRAM). Delete it and that card is invisible until
 * somebody happens to open GitHub — the exact failure of #321, which he found
 * himself.
 *
 * ⚠ **The old line said *"Nothing is in flight. Everything the crew has started
 * has landed."*, which described the rows and taught him nothing.** An empty
 * box has to say what a FULL one would mean, or "nothing is stuck" and "this
 * section is broken" look identical — the same ambiguity §6 protects
 * `CrewNeedsYou`'s empty state from, in his own words: *"its absence would read
 * as a loading failure."*
 *
 * ⚠ **AND THIS IS DELIBERATELY THE OPPOSITE OF BRIEF 07's RULE** for Overview's
 * `NEEDS A HUMAN`, where a section with nothing to show disappears. The
 * difference is the one brief 08 already drew: **Overview is SCANNED for
 * exceptions; this page is READ.** Do not "harmonise" the two.
 */
import { cn } from "@/lib/utils";
import { TableHead } from "@/foundation";
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
  const wantsAHuman = item.status === "waiting-founder" || item.status === "blocked";
  return (
    <li className="dp-crew__row">
      <span className={cn("dp-crew__status", wantsAHuman && "dp-crew__status--wants")}>
        {STATUS_LABEL[item.status] ?? item.status}
      </span>
      <span className="dp-crew__rowmain">
        {item.title}
        {item.note && <span className="dp-crew__rowwhy">{item.note}</span>}
      </span>
      {/* A PR number is a measured value, so it is mono (§4). */}
      {item.prNumber !== null && <span className="dp-crew__mono">PR {item.prNumber}</span>}
    </li>
  );
}

export function CrewPipeline({ items }: { items: readonly CrewPipelineItem[] }) {
  const notDone = pipelineNotDone(items);

  return (
    <section className="dp-crew__card" data-testid="crew-pipeline">
      <TableHead eyebrow="Not done yet">
        {notDone.length > 0 && <span className="dp-crew__meta">{notDone.length} open</span>}
      </TableHead>
      {notDone.length === 0 ? (
        /* A `--well` block, the same treatment as `CrewNeedsYou`'s empty state
           (§6) — present, and visibly not a thing to act on. */
        <div className="dp-crew__well dp-crew__gap">
          Nothing is stuck. Blocked work and anything waiting on you appears here.
        </div>
      ) : (
        <ul className="dp-crew__rows dp-crew__gap">
          {notDone.map((item) => (
            <PipelineRow key={item.id} item={item} />
          ))}
        </ul>
      )}
    </section>
  );
}
