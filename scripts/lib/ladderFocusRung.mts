/**
 * THE RUNG HE HAS OPENED, READ OFF THE LADDER — one reader, for every tool that
 * needs it (#1881).
 *
 * `cutSeatBatches` holds a card on a rung that is not the current milestone
 * (`rungHoldFor`, THE MILESTONE GATE), so every tool that tells a shift or the
 * runner what his band offers needs the same rung the cut used. Until #1881
 * exactly one tool read it — `cut-seat-batches.mts` — and the three readers that
 * print an offer count did not, which is why all three counted a rung-held card
 * as available work.
 *
 * ⚠ **SO THIS IS THE REPAIR'S OWN WORKING-LAW-4 ARM.** The fix needed the rung
 * in three more command scripts, and a copy of this eight-line read in each is
 * the drift the fix is about. One reader, four callers.
 *
 * # What it does NOT do
 *
 * It takes no view on `.agents/foreman/PROGRAM.md`. `focusRungFromRulebook`
 * reads the rung as the RULEBOOK declares it, and #1840 is the night those two
 * artifacts disagreed — his *"phase 2 gets built next"* reached the rulebook and
 * not the briefing, and four cards he had just ordered were held on a stale
 * rung. Both readings matter and they answer different questions: the gate acts
 * on the briefing, so a tool that reports what the gate WILL DO must read the
 * briefing too. A tool comparing the two is welcome to call both.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { currentLadderRung } from "../../shared/crewPipelineGroups.js";

/** Where the ladder lives, so no caller types the path. */
export const LADDER_BRIEFING_PATH = "server/crew/crew-briefing.json";

export type LadderFocusRung = {
  /** The rung marked `current`, or `null` when nothing names one or the file could not be read. */
  readonly focusRung: string | null;
  /**
   * Why there is no rung, for a caller to print — `""` when one was found.
   *
   * ⚠ **A caller must SAY this rather than silently fall back.** `null` holds
   * every rung card (`rungHoldFor`'s own behaviour), which is the same direction
   * the cut takes and is therefore the right answer — but a count that shrinks
   * because a file could not be read, with nothing on the page saying so, is the
   * silence this whole class of defect is made of.
   */
  readonly note: string;
};

export function readLadderFocusRung(briefingPath: string = LADDER_BRIEFING_PATH): LadderFocusRung {
  let ladder: readonly { readonly key?: unknown; readonly state?: unknown }[] | null = null;
  let note = "";
  try {
    const briefing = JSON.parse(readFileSync(resolve(briefingPath), "utf8")) as {
      program?: { ladder?: readonly { readonly key?: unknown; readonly state?: unknown }[] };
    };
    ladder = briefing.program?.ladder ?? null;
  } catch (error) {
    note = `the ladder at ${briefingPath} could not be read (${error instanceof Error ? error.message : String(error)}) — every rung card is held`;
  }
  const focusRung = currentLadderRung(ladder);
  if (focusRung === null && note === "") {
    note = `${briefingPath} names no single rung as \`current\` — every rung card is held until it does`;
  }
  return { focusRung, note };
}
