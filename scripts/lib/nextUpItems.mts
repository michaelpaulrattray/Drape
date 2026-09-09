/**
 * NEXT UP's ROWS — the pure half of `scripts/crew-desk-sweep.mts`, lifted out
 * so the running order his page shows him can be DRIVEN (#718).
 *
 * The sweep's I/O stays where it was: reading `gh`, writing labels, writing the
 * briefing. What is here is everything that decides WHAT HE SEES AND IN WHAT
 * ORDER, as a function of already-fetched rows and the holds this run applied.
 *
 * ⚠ **It is here for one reason and it is the same reason `standingExceptions`
 * has a rendering half: a sort that cannot be driven is a sort held to its
 * sibling by prose.** #718 is exactly what that costs — the sweep's own
 * docblock asserted *"queue-standing-exceptions is the same sort"*, which was
 * true when written and stopped being true with nothing anywhere noticing.
 * `server/orderedBandOrder.test.ts` now drives this function and the priority
 * view over ONE fixture and asserts they agree.
 *
 * The rule they both obey is the founder's, on 2026-09-09 (Crew reply #168):
 * *"Urgent wins inside your ordered group"* — `scripts/lib/orderedBand.mts`.
 */
import {
  CREW_HOLD_LABELS,
  heldStateFromLabels,
  holdReasonFromBody,
} from "../../shared/crewNextUpHold.js";

import { sortOrderedBand } from "./orderedBand.mts";

/** A row as `gh issue list --json number,title,labels,body,createdAt` gives it. */
export type OrderedIssue = {
  number: number | string;
  title: unknown;
  labels?: unknown;
  body?: unknown;
  createdAt?: unknown;
};

/** A row of NEXT UP, exactly as `nextUpSchema` in `server/crew/crewBriefing.ts`
 *  will parse it — nothing here may add a field that schema does not know. */
export type NextUpItem = {
  issueNumber: number;
  title: string;
  urgent: boolean;
  held?: { state: string; because?: string };
};

function labelNames(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((label) => String((label as { name?: unknown })?.name ?? ""));
}

/**
 * The rows of NEXT UP, in the order a shift genuinely takes them.
 *
 * `appliedReasons` maps an issue number to the reason THIS RUN held it, so a
 * label written moments ago is reflected without re-reading `gh`.
 */
export function planNextUpItems(input: {
  ordered: readonly OrderedIssue[];
  appliedReasons: ReadonlyMap<number, string>;
}): NextUpItem[] {
  const { ordered, appliedReasons } = input;

  const rows = ordered.map((row) => {
    const labels = labelNames(row.labels);
    /*
      ⚠ **THE HOLD'S STATE COMES FROM A LABEL AND ITS REASON FROM THE BODY,
      AND THE REASON IS ONLY EVER WRITTEN BESIDE A LIVE STATE** (#298).

      That asymmetry is the anti-rot property, not a shortcut: `#278` told him
      it was blocked for two shifts after it was unblocked, because the state
      lived in prose. Here, removing the label removes the whole row's chip
      AND its sentence in one act — a reason cannot outlive the state that
      renders it, whatever the body still says.

      A held card with no marker line keeps its chip. The label alone answers
      *"why was this skipped"*, and demanding prose would let a filer's
      omission quietly un-hold a card.
    */
    const appliedReason = appliedReasons.get(Number(row.number)) ?? null;
    const state = heldStateFromLabels(
      appliedReason === null ? labels : [...labels, CREW_HOLD_LABELS.blocked],
    );
    /* A hold this run applied says WHY from the desk; every other hold keeps
       reading the filer's own line, which is #298's rule untouched. */
    const because = state === null
      ? null
      : appliedReason ?? holdReasonFromBody(String(row.body ?? ""));
    return {
      issueNumber: Number(row.number),
      title: String(row.title).slice(0, 300),
      urgent: labels.includes("urgent"),
      /* ⚠ NOT stringified here — `filedKey` in `scripts/lib/orderedBand.mts`
         owns what a missing date means, once, for all three views. */
      createdAt: row.createdAt,
      ...(state === null ? {} : { held: { state, ...(because ? { because } : {}) } }),
    };
  });

  /*
    ⚠ **HELD ROWS ARE NOT SORTED DOWN, AND THAT IS #298's OWN INSTRUCTION**:
    *"Do not quietly hide blocked rows — he needs to see that seven of eight
    are stuck, because that is the real state of his queue and it is the thing
    that would tell him to unblock something."* The position stays the
    priority order; the chip explains the skip.
  */
  return sortOrderedBand(rows).map(({ createdAt: _sortKey, ...item }) => item);
}
