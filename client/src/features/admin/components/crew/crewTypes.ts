/**
 * The page's view types, INFERRED from the router rather than restated.
 *
 * Working law 4: a hand-written mirror of `crew.getState`'s shape is a second
 * list shadowing a source of truth, and it drifts the first time a shift adds a
 * field to the briefing schema. These are derived, so a change on the server is
 * a type error here rather than a silently unrendered fact.
 */
import type { inferRouterOutputs } from "@trpc/server";

import { resolveHold, type CrewHold } from "../../../../../../shared/crewNextUpHold";
import type { AppRouter } from "../../../../../../server/routers";

type CrewState = inferRouterOutputs<AppRouter>["crew"]["getState"];

export type CrewBriefingView = CrewState["briefing"];
export type CrewReplyView = CrewState["replies"][number];
export type CrewNeedsYouCard = CrewBriefingView["needsYou"][number];
export type CrewEyeItem = CrewBriefingView["eyeItems"][number];
export type CrewPipelineItem = CrewBriefingView["pipeline"][number];
export type CrewProblem = CrewBriefingView["problems"][number];

/**
 * Anything a reply thread can hang under — a needs-you card or an eye item
 * (#75). Both carry the same id/state/title triple, and `replyFallsToGeneral`
 * asks only for id + state, so the General box's fall-through rule covers both
 * populations with one list.
 */
export type CrewThreadHost = Pick<CrewNeedsYouCard, "id" | "state" | "title">;

/**
 * Whether a reply renders in the GENERAL box rather than under a needs-you card.
 *
 * The rule is "does a thread render for its card", not "does the briefing
 * mention its card": Needs You shows reply threads under OPEN cards only, so a
 * reply on an answered/done card (listed in the recent-history block since
 * #292) must fall through here or it renders NOWHERE — the vanishing the
 * design forbids, caught live by the PR #72 gate review. Pure, and tested
 * directly.
 *
 * ⚠ It was named for the journal until #293 removed it; the RULE is unchanged
 * and the box it falls to is the General one now.
 */
export function replyFallsToGeneral(
  cardId: string | null,
  cards: readonly Pick<CrewNeedsYouCard, "id" | "state">[],
): boolean {
  return cardId === null || !cards.some((card) => card.id === cardId && card.state === "open");
}

/* ─── #74: the Desk's information design, as derivations over what the
   briefing already says. These are pure and tested directly; none of them adds
   a second copy of a state (working law 4 — the bar is READ off the steps,
   never written beside them). ─── */

export type CrewMilestoneStep = NonNullable<CrewBriefingView["program"]["milestone"]>["steps"][number];

export type MilestoneProgress = {
  done: number;
  inProgress: number;
  waiting: number;
  blocked: number;
  total: number;
  /** 0..1 — done steps over all steps; an in-progress step counts half, so the
   *  bar visibly moves the day work starts, not only the day it lands. */
  fraction: number;
};

export function milestoneProgress(
  steps: readonly Pick<CrewMilestoneStep, "state">[],
): MilestoneProgress {
  const count = (state: CrewMilestoneStep["state"]) =>
    steps.filter((step) => step.state === state).length;
  const done = count("done");
  const inProgress = count("in-progress");
  const total = steps.length;
  return {
    done,
    inProgress,
    waiting: count("waiting"),
    blocked: count("blocked"),
    total,
    fraction: total === 0 ? 0 : (done + inProgress / 2) / total,
  };
}

/** The count line under the bar — zero-count groups are omitted so the
 *  sentence stays as short as the truth allows. */
export function milestoneCountLine(progress: MilestoneProgress): string {
  const parts: string[] = [];
  if (progress.done > 0) parts.push(`${progress.done} done`);
  if (progress.inProgress > 0) parts.push(`${progress.inProgress} in progress`);
  if (progress.waiting > 0) parts.push(`${progress.waiting} waiting`);
  if (progress.blocked > 0) parts.push(`${progress.blocked} blocked`);
  return parts.join(" · ");
}

/* ─── #290/#291: the page reads the program → working now → next up → what is
   not done. Questions he actually asks, instead of one 107-row scroll with
   three history sections in it. The derivations are pure and tested directly;
   none of them writes a state down twice.

   ⚠ This sentence said *"working now → next up → …"* until #437 (2026-09-02),
   when he moved THE PROGRAM to the top of the page. The derivations below did
   not change and none of them depends on section order — only the sentence
   was wrong, which is exactly the kind of stale prose that survives because
   nothing it describes can break.

   ⚠ **AND #292's `recentHistory` / `foldHistory` LEFT THIS FILE WITH THEIR
   SECTION (#438, 2026-09-02).** After `CrewRecentHistory.tsx` was deleted
   nothing but their own tests read them, and a suite that cannot fail when its
   subject is dead is how dead code keeps a live reputation — this repository's
   own credit-velocity lesson. The DATA is untouched: `crew-briefing.json`
   still carries every merged pipeline row and every answered card, and
   `pipelineNotDone` below still filters `merged` out. ─── */

/**
 * ⚠ **THE ORDER IS THE POINT.** His reading of the old section was *"a massive
 * list i cant tell whats going on"* — 107 rows with the 15 that could change
 * his behaviour scattered through them. Blocked first, then what waits on him,
 * then what is moving: the rows are sorted by how much they want a human,
 * never by when they were written.
 */
const NOT_DONE_RANK: Record<string, number> = {
  blocked: 0,
  "waiting-founder": 1,
  "in-review": 2,
  building: 3,
};

export function pipelineNotDone(items: readonly CrewPipelineItem[]): CrewPipelineItem[] {
  return items
    .filter((item) => item.status !== "merged")
    /* Stable within a rank: the file is already newest-first, and `sort` is
       stable in every engine this ships to, so equal-rank rows keep the order
       the shifts recorded. */
    .slice()
    .sort((a, b) => (NOT_DONE_RANK[a.status] ?? 9) - (NOT_DONE_RANK[b.status] ?? 9));
}

/** One row of NEXT UP (#290) — a founder-ordered card a shift will take. */
export type CrewNextUpRow = {
  issueNumber: number;
  title: string;
  urgent: boolean;
  /**
   * ⚠ **DERIVED, NEVER STORED.** A queued card is blocked on him when his own
   * desk still has an OPEN card naming that issue — the desk's state is the one
   * definition of "he is blocking this" (#291's rule). `#278` sat looking like
   * ordinary queued work while it was actually waiting on one sentence from
   * him; a queue that cannot show that is the same failure with a nicer
   * surface.
   */
  blockedOnYou: boolean;
  /**
   * The OPEN needs-you card whose question holds this row, when one does —
   * the `id` slug the card's DOM anchor is built from (#493 move 3). Derived
   * in the same pass as `blockedOnYou`, from the same population, so the chip
   * can never link to a card the rule did not count.
   */
  holdingCardId: string | null;
  /**
   * Why no shift has taken this row yet, or `null` when nothing is stopping
   * one (#298). His question was *"did it skip things or what happened"* —
   * five rows were skipped and every skip was correct, but the block could
   * only say one of the four reasons out loud.
   *
   * ⚠ **The verdict is `shared/crewNextUpHold.ts`'s, not this file's.** The
   * sweep that writes the state and the page that draws it must agree on what
   * "blocked" means, and a second definition here is exactly the drift working
   * law 4 is about.
   */
  hold: CrewHold | null;
};

export function nextUpRows(
  nextUp: CrewBriefingView["nextUp"],
  cards: readonly CrewNeedsYouCard[],
): CrewNextUpRow[] {
  const askingHim = new Map(
    cards
      .filter((card) => card.state === "open" && card.issueNumber !== null)
      .map((card) => [card.issueNumber as number, card.id]),
  );
  return nextUp.items.map((item) => {
    const holdingCardId = askingHim.get(item.issueNumber) ?? null;
    const blockedOnYou = holdingCardId !== null;
    return {
      issueNumber: item.issueNumber,
      title: item.title,
      urgent: item.urgent,
      blockedOnYou,
      holdingCardId,
      hold: resolveHold({ blockedOnYou, held: item.held ?? null }),
    };
  });
}

/**
 * Whether any row is held — what the block's footer needs to know before it
 * tells him a shift takes the first row without a chip.
 *
 * ⚠ **The rows are NOT reordered around this**, and #298 says so in as many
 * words: *"the ordering must not silently reorder around it … Do not quietly
 * hide blocked rows — he needs to see that seven of eight are stuck, because
 * that is the real state of his queue and it is the thing that would tell him
 * to unblock something."* So the position stays the priority order and the
 * chip explains the skip.
 */
export function heldCount(rows: readonly CrewNextUpRow[]): number {
  return rows.filter((row) => row.hold !== null).length;
}

/** How many notes the General box shows before the fold (#74 item 7 — his
 *  standing Desk rule: last 8, older behind a disclosure). */
export const GENERAL_FOLD_VISIBLE = 8;

/**
 * The fold over an already-sorted (newest-first) list. Generic because it is
 * applied to the items the box actually draws rather than to raw replies —
 * folding before the list is assembled would hide his words, which the design
 * forbids anywhere on this page.
 */
export function foldTimeline<T>(sorted: readonly T[], visible = GENERAL_FOLD_VISIBLE): {
  recent: T[];
  older: T[];
} {
  return { recent: sorted.slice(0, visible), older: sorted.slice(visible) };
}

/**
 * The live shift row (#272). Inferred like everything else on this page, so a
 * column added to `crew_shift_runs` is a type error here rather than a fact
 * that silently never renders.
 */
export type CrewShiftRunsView = CrewState["shiftRuns"];
export type CrewShiftRunView = CrewShiftRunsView["runs"][number];

/**
 * His background-work switches and the counts beside them (#277). Inferred, so
 * a shape change on the server is a type error here rather than a fact that
 * silently never renders.
 */
export type CrewWorkStateView = CrewState["workState"];

/**
 * His "not relevant" taps (#325). Inferred like everything else on this page,
 * so a column added to `crew_card_intents` is a type error here rather than a
 * fact that silently never renders.
 */
export type CrewCardIntentsView = CrewState["cardIntents"];
