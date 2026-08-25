/**
 * The page's view types, INFERRED from the router rather than restated.
 *
 * Working law 4: a hand-written mirror of `crew.getState`'s shape is a second
 * list shadowing a source of truth, and it drifts the first time a shift adds a
 * field to the briefing schema. These are derived, so a change on the server is
 * a type error here rather than a silently unrendered fact.
 */
import type { inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "../../../../../../server/routers";

type CrewState = inferRouterOutputs<AppRouter>["crew"]["getState"];

export type CrewBriefingView = CrewState["briefing"];
export type CrewReplyView = CrewState["replies"][number];
export type CrewNeedsYouCard = CrewBriefingView["needsYou"][number];
export type CrewEyeItem = CrewBriefingView["eyeItems"][number];
export type CrewPipelineItem = CrewBriefingView["pipeline"][number];
export type CrewProblem = CrewBriefingView["problems"][number];
export type CrewJournalEntry = CrewBriefingView["journal"][number];

/**
 * Anything a reply thread can hang under — a needs-you card or an eye item
 * (#75). Both carry the same id/state/title triple, and `replyFallsToJournal`
 * asks only for id + state, so the journal's fall-through rule covers both
 * populations with one list.
 */
export type CrewThreadHost = Pick<CrewNeedsYouCard, "id" | "state" | "title">;

/**
 * Whether a reply renders in the JOURNAL rather than under a needs-you card.
 *
 * The rule is "does a thread render for its card", not "does the briefing
 * mention its card": Needs You shows reply threads under OPEN cards only, so a
 * reply on an answered/done card (still listed under "Recently answered") must
 * fall through here or it renders NOWHERE — the vanishing the design forbids,
 * caught live by the PR #72 gate review. Pure, and tested directly.
 */
export function replyFallsToJournal(
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

/**
 * The pipeline split (#74 items 4 and 6): momentum gets its own section.
 * "Landed" is DERIVED from the status the shifts already record — a merged row
 * is a done thing wherever it sits in the file — so there is no second
 * "recently completed" list to drift.
 */
export function splitPipeline(items: readonly CrewPipelineItem[]): {
  inFlight: CrewPipelineItem[];
  landed: CrewPipelineItem[];
} {
  return {
    inFlight: items.filter((item) => item.status !== "merged"),
    landed: items.filter((item) => item.status === "merged"),
  };
}

/** How many merged timeline items the journal shows before the fold (#74 item
 *  7 — his standing Desk rule: last 8, older behind a disclosure). */
export const JOURNAL_FOLD_VISIBLE = 8;

/**
 * The fold over an already-sorted (newest-first) list. Generic because the
 * journal folds its MERGED items (shift entries + his orphaned replies), not
 * raw entries — folding before the merge would hide his words, which the
 * design forbids anywhere on this page.
 */
export function foldTimeline<T>(sorted: readonly T[], visible = JOURNAL_FOLD_VISIBLE): {
  recent: T[];
  older: T[];
} {
  return { recent: sorted.slice(0, visible), older: sorted.slice(visible) };
}
