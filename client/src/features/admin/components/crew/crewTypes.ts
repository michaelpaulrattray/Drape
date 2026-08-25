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
export type CrewPipelineItem = CrewBriefingView["pipeline"][number];
export type CrewProblem = CrewBriefingView["problems"][number];
export type CrewJournalEntry = CrewBriefingView["journal"][number];

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
