/**
 * THE FIVE STATES A PIPELINE ROW CAN BE IN, AND THE ONE THAT MEANS *DO NOT
 * SEND THIS TO HIS PAGE* (#1137).
 *
 * # WHAT THE PAGE ACTUALLY DRAWS
 *
 * `CrewPipeline` renders `pipelineNotDone` and nothing else, and #438 deleted
 * `CrewRecentHistory.tsx` — the only surface that ever showed a finished row.
 * So a `merged` row is drawn by NOTHING: it is the shift record, kept in the
 * file and in git on purpose (`crewTypes.ts`'s own note), and it is not a
 * surface.
 *
 * # WHY THAT NEEDED A MODULE RATHER THAN A COMMENT
 *
 * Measured at edition 492, at the file rather than inferred: **281 pipeline
 * rows, 281 of them `merged`, 0 live.** Their notes alone are **298 KB — 29%
 * of a 1.0 MB briefing** — median 848 characters, longest 4,160, and 81 of
 * them written in paragraphs. `crew.getState` sends the whole briefing, and
 * `/admin/crew` re-reads that query every 60 seconds while it is open. He was
 * being sent a third of a megabyte a minute of prose no screen can draw, and
 * shifts kept writing it because nothing told them otherwise — the shift that
 * filed #1137 wrote a four-paragraph note addressed to him within an hour of
 * fixing the same class of defect, then looked at the page and could not find
 * it.
 *
 * ⚠ **THE FILTER IS CORRECT AND FOUNDER-ORDERED — nothing here proposes
 * bringing the history section back.** His own reading of it was *"a massive
 * list i cant tell whats going on"*. What changes is only that the page stops
 * being SENT what it was already throwing away.
 *
 * # ⚠ WHY THE PREDICATE IS SHARED AND NOT A LITERAL IN EACH PLACE
 *
 * Working law 4, and the `CREW_CARD_STATES` precedent one file over: the status
 * list was written out three times (the briefing's zod enum, the page's status
 * labels, the not-done ranking) and the wire projection would have been a
 * fourth. A row this product stops sending and a row the page declines to draw
 * must be the same question, or the day they disagree the page silently shows
 * nothing and no test can see why.
 */

/** Every state a pipeline row may hold. The briefing's zod enum is derived from it. */
export const CREW_PIPELINE_STATUSES = [
  "building",
  "in-review",
  "waiting-founder",
  "merged",
  "blocked",
] as const;

export type CrewPipelineStatus = (typeof CREW_PIPELINE_STATUSES)[number];

/**
 * Is this row finished — a record rather than something happening?
 *
 * The one definition, asked by the page's filter and by the wire projection
 * that keeps those rows off his browser in the first place.
 */
export function crewPipelineRowIsDone(status: string): boolean {
  return status === "merged";
}
