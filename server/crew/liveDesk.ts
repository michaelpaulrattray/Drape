/**
 * THE LIVE DESK — what the page shows is DERIVED from the queue as it is now,
 * never copied from a file (#1193; working law 4).
 *
 * Every function here is pure over one `LiveQueueReading` and the ladder's
 * rung keys, so the arms in `liveDesk.test.ts` drive them on fixtures and the
 * page draws exactly what they return. The partitions are the SHARED ones —
 * `pipelineGroupFor` and `rungFromLabels` are what `crew-desk-sweep.mts` used
 * to write the snapshot, and `compareOrderedBand` is the one sort every
 * NEXT UP view calls — so the live page and the shift's tools cannot disagree
 * about what a label means. What changed is only WHEN they run: on the
 * server, every 30 s, instead of into a JSON file at the end of a shift.
 *
 * What stays the briefing's (a shift's hand, not GitHub's): the mission, the
 * focus and his quote, the milestone, each rung's title and its done /
 * current / queued / parked state, the card explanations, the eye items and
 * the problems. Those are readings and judgements; this file carries facts.
 */
import {
  CREW_LADDER_GROUP_KEYS,
  pipelineGroupFor,
  rungFromLabels,
} from "../../shared/crewPipelineGroups";
import { CREW_HOLD_WORD, heldStateFromLabels, type CrewHeldState } from "../../shared/crewNextUpHold";
import { rankFromLabels, sortOrderedBand } from "../../shared/crewOrderedBand";
import { CREW_PIPELINE_GROUPS } from "../../shared/crewPipelineGroups";
import { exclusionFor, type CrewQueueExclusions } from "../../shared/crewQueueExclusions";
import { QUEUE_POSSIBLY_DONE_CAP } from "../../shared/crewQueuePossiblyDone";
import { QUEUE_TITLES_PER_CATEGORY, type CrewQueueTitle } from "../../shared/crewQueueTitles";
import { CREW_WORK_CATEGORIES } from "../../shared/crewWorkSwitches";
import type { CrewPipelineGroupView, CrewQueueCountView } from "../db/crewWorkSwitches";
import type { LiveQueueItem, LiveQueueReading } from "./liveQueue";

export const ORDERED_LABEL = "founder-ordered";
export const URGENT_LABEL = "urgent";
/** A PR carrying either waits for the relay's hand verdict before it can merge. */
export const HELD_PR_LABELS: readonly string[] = ["needs-fable", "founder-review"];

export type LiveLadderCard = {
  readonly issueNumber: number;
  readonly title: string;
  readonly kind: string;
  readonly rung: string | null;
  /**
   * The quiet word after the title on the ladder row, or null: a hold's own
   * plain word (`CREW_HOLD_WORD`) when the card carries one, else "debt" for
   * a carded cleanup. A rung card that is blocked stays ON the rung (#1199)
   * and says so here rather than falling off the road.
   */
  readonly note: string | null;
};

export type LiveNextUpItem = {
  readonly issueNumber: number;
  readonly title: string;
  readonly urgent: boolean;
  readonly held?: { readonly state: CrewHeldState; readonly because?: string };
};

export type LivePullRequestState = "draft" | "held" | "gate";

export type LivePullRequest = {
  readonly number: number;
  readonly title: string;
  readonly state: LivePullRequestState;
  /** Cards the PR's title names (`#N`) that the queue holds. */
  readonly cards: readonly number[];
  readonly author: string;
  readonly updatedAt: string;
  readonly url: string;
};

export type LiveRecentOutcome = "merged" | "closed" | "closed-unmerged";

export type LiveRecentRow = {
  readonly number: number;
  readonly title: string;
  readonly kind: "issue" | "pr";
  readonly outcome: LiveRecentOutcome;
  /** When it happened — mergedAt for a merge, closedAt otherwise. */
  readonly at: string;
  readonly cards: readonly number[];
  readonly url: string;
};

export type LiveDesk = {
  readonly readAt: string;
  readonly ladderCards: { readonly readAt: string; readonly items: readonly LiveLadderCard[] };
  readonly nextUp: { readonly readAt: string; readonly items: readonly LiveNextUpItem[] };
  readonly pullRequests: readonly LivePullRequest[];
  readonly recent: readonly LiveRecentRow[];
  /**
   * The Background Work panel's numbers, derived from this reading (#1199):
   * the same rows `crew-count-queue.mts` writes into `crew_queue_counts` at
   * the end of a shift, computed here every tick through the same shared
   * rules, so "counted 21 min ago" becomes "counted 12 s ago".
   */
  readonly work: {
    readonly counts: readonly CrewQueueCountView[];
    readonly groups: readonly CrewPipelineGroupView[];
  };
  /**
   * Cards GitHub has CLOSED inside the window. The edition's needs-you cards
   * carry a state a shift wrote by hand; a card he answered and the relay
   * closed an hour ago would keep asking him until the next edition. The page
   * subtracts these before it draws what needs him (#1193).
   */
  readonly closedCards: readonly number[];
  /**
   * Ladder cards CLOSED inside the window, with the rung their label named —
   * so a rung can say "2 finished" beside "5 waiting" and show them struck
   * through, instead of a count that only ever shrinks (#1201, his question:
   * *"shouldnt it let me know instead of showing 5 waiting?"*).
   */
  readonly finishedLadder: readonly {
    readonly issueNumber: number;
    readonly title: string;
    readonly rung: string | null;
    readonly closedAt: string;
  }[];
  readonly counts: {
    readonly openCards: number;
    readonly openPullRequests: number;
    readonly truncated: boolean;
  };
};

const openIssues = (reading: LiveQueueReading) =>
  reading.open.filter((item) => item.kind === "issue" && item.status === "open");

const openPulls = (reading: LiveQueueReading) =>
  reading.open.filter((item) => item.kind === "pr" && item.status === "open");

/**
 * Every `#N` a title names that is a card the reading knows — open, or closed
 * inside the window. A number the reading does not hold is not a card here:
 * the page draws these as links to cards it can also show, and a PR titled
 * for "#1160 slice 3" should point at #1160, not at nothing.
 */
export function cardsNamedIn(title: string, known: ReadonlySet<number>): number[] {
  const found = new Set<number>();
  /* An exec loop rather than matchAll: one tsconfig that reads this file
     targets es5 and cannot iterate a match iterator. */
  const token = /(?:^|[^0-9A-Za-z])#0*([1-9][0-9]*)(?![0-9])/g;
  let match: RegExpExecArray | null;
  while ((match = token.exec(title)) !== null) {
    const number = Number(match[1]);
    if (known.has(number)) found.add(number);
  }
  return Array.from(found).sort((a, b) => a - b);
}

function knownCards(reading: LiveQueueReading): ReadonlySet<number> {
  return new Set(
    [...reading.open, ...reading.recent]
      .filter((item) => item.kind === "issue")
      .map((item) => item.number),
  );
}

/**
 * The ladder's cards — the roadmap, parked and design-unbuilt populations —
 * each on the rung its `rung:` label names, or `null` for the honest
 * remainder. Same rows `crew-desk-sweep.mts` wrote into
 * `program.ladderCards`, read live.
 */
export function ladderNoteFor(labels: readonly string[]): string | null {
  const held = heldStateFromLabels(labels);
  /* Lower-case, like the ladder's other marks ("parked", "unbuilt design"). */
  if (held !== null) return CREW_HOLD_WORD[held].toLowerCase();
  if (labels.includes("debt")) return "debt";
  return null;
}

export function liveLadderCards(reading: LiveQueueReading, rungKeys: readonly string[]): LiveLadderCard[] {
  return openIssues(reading)
    .map((item) => ({ item, kind: pipelineGroupFor(item.labels) }))
    .filter(({ kind }) => CREW_LADDER_GROUP_KEYS.includes(kind))
    .map(({ item, kind }) => ({
      issueNumber: item.number,
      title: item.title,
      kind,
      rung: rungFromLabels(item.labels, rungKeys),
      note: ladderNoteFor(item.labels),
    }))
    .sort((a, b) => a.issueNumber - b.issueNumber);
}

/** Newest filed first — the sweep's own order for the titles under a count (#285). */
function newestFirst(items: readonly LiveQueueItem[]): LiveQueueItem[] {
  return [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.number - a.number);
}

function titlesOf(items: readonly LiveQueueItem[]): CrewQueueTitle[] {
  return newestFirst(items).slice(0, QUEUE_TITLES_PER_CATEGORY).map((item) => ({ number: item.number, title: item.title }));
}

/**
 * THE SWITCH COUNTS AND THE GROUPS, LIVE (#1199) — the sweep's two readings
 * (`readCategory` and the whole-queue partition in `crewQueueCount.mts`)
 * computed from one reading rather than written to a table:
 *
 *  - a switch count is every open card carrying the category's label, minus
 *    the ones an exclusion takes out (his ordered band, parked, the holds —
 *    `exclusionFor`, first match, so a card is subtracted once); the titles
 *    are the OFFERED population, newest first, five;
 *  - "possibly fixed" is an offered card whose number a merged PR in the
 *    window names in its title — the sweep reads a longer window through the
 *    naming index; this reads the two days the reading holds, and says so;
 *  - the groups are the whole open queue filed once each through
 *    `pipelineGroupFor`, every group written even at zero, so the counts sum
 *    to the queue (the sweep's own control).
 */
export function liveWorkCounts(reading: LiveQueueReading): LiveDesk["work"] {
  const countedAt = new Date(reading.readAt);
  const issues = openIssues(reading);
  const mergedTitles = reading.recent.filter((item) => item.kind === "pr" && item.status === "merged").map((item) => item.title);
  const namedByMerge = (number: number) => mergedTitles.some((title) => cardsNamedIn(title, new Set([number])).length > 0);

  const counts: CrewQueueCountView[] = CREW_WORK_CATEGORIES.map((category) => {
    const population = issues.filter((item) => item.labels.includes(category.queueLabel));
    const offered: LiveQueueItem[] = [];
    const excluded: Record<string, number> = {};
    for (const item of population) {
      const reason = exclusionFor(item.labels);
      if (reason === null) offered.push(item);
      else excluded[reason] = (excluded[reason] ?? 0) + 1;
    }
    const flagged = newestFirst(offered).filter((item) => namedByMerge(item.number)).map((item) => item.number);
    return {
      categoryKey: category.key,
      openCount: offered.length,
      titles: titlesOf(offered),
      excluded: excluded as CrewQueueExclusions,
      possiblyDone: { count: flagged.length, cards: flagged.slice(0, QUEUE_POSSIBLY_DONE_CAP) },
      countedAt,
    };
  });

  const groups: CrewPipelineGroupView[] = CREW_PIPELINE_GROUPS.map((group) => {
    const filed = issues.filter((item) => pipelineGroupFor(item.labels) === group.key);
    return { groupKey: group.key, openCount: filed.length, titles: titlesOf(filed), countedAt };
  });

  return { counts, groups };
}

/**
 * NEXT UP — every open card he ordered by name, in the order a shift takes
 * them (`compareOrderedBand`, the one sort). A held card keeps its position
 * and carries its chip: the label is the state, the card's own
 * `**Waiting on:**` line is the reason, and the reason is only ever shown
 * beside a live state (#298).
 */
export function liveNextUp(reading: LiveQueueReading): LiveNextUpItem[] {
  const rows = openIssues(reading)
    .filter((item) => item.labels.includes(ORDERED_LABEL))
    .map((item) => {
      const state = heldStateFromLabels(item.labels);
      return {
        issueNumber: item.number,
        title: item.title,
        urgent: item.labels.includes(URGENT_LABEL),
        rank: rankFromLabels(item.labels),
        createdAt: item.createdAt,
        ...(state === null
          ? {}
          : { held: { state, ...(item.holdReason ? { because: item.holdReason } : {}) } }),
      };
    });
  return sortOrderedBand(rows).map(({ rank: _rank, createdAt: _createdAt, ...item }) => item);
}

export function livePullRequestState(item: Pick<LiveQueueItem, "draft" | "labels">): LivePullRequestState {
  if (item.draft) return "draft";
  if (item.labels.some((label) => HELD_PR_LABELS.includes(label))) return "held";
  return "gate";
}

/** Open PRs, most recently touched first — what is in flight right now. */
export function livePullRequests(reading: LiveQueueReading): LivePullRequest[] {
  const known = knownCards(reading);
  return openPulls(reading)
    .map((item) => ({
      number: item.number,
      title: item.title,
      state: livePullRequestState(item),
      cards: cardsNamedIn(item.title, known),
      author: item.author,
      updatedAt: item.updatedAt,
      url: item.url,
    }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/**
 * SINCE YOU LAST LOOKED — everything that finished inside the window, newest
 * first. A merged PR is a merge; a closed card is a close; a PR closed
 * without merging says so, because that is the one of the three that usually
 * means a change was refused.
 */
export function liveRecent(reading: LiveQueueReading): LiveRecentRow[] {
  const known = knownCards(reading);
  return reading.recent
    .filter((item) => item.status !== "open")
    .map((item): LiveRecentRow | null => {
      const outcome: LiveRecentOutcome = item.status === "merged"
        ? "merged"
        : item.kind === "pr" ? "closed-unmerged" : "closed";
      const at = item.mergedAt ?? item.closedAt;
      if (at === null) return null;
      return {
        number: item.number,
        title: item.title,
        kind: item.kind,
        outcome,
        at,
        cards: item.kind === "pr" ? cardsNamedIn(item.title, known) : [],
        url: item.url,
      };
    })
    .filter((row): row is LiveRecentRow => row !== null)
    .sort((a, b) => b.at.localeCompare(a.at));
}

export function deriveLiveDesk(reading: LiveQueueReading, rungKeys: readonly string[]): LiveDesk {
  return {
    readAt: reading.readAt,
    ladderCards: { readAt: reading.readAt, items: liveLadderCards(reading, rungKeys) },
    nextUp: { readAt: reading.readAt, items: liveNextUp(reading) },
    pullRequests: livePullRequests(reading),
    recent: liveRecent(reading),
    work: liveWorkCounts(reading),
    closedCards: reading.recent
      .filter((item) => item.kind === "issue" && item.status !== "open")
      .map((item) => item.number)
      .sort((a, b) => a - b),
    finishedLadder: reading.recent
      .filter((item) => item.kind === "issue" && item.status !== "open" && item.closedAt !== null)
      .filter((item) => CREW_LADDER_GROUP_KEYS.includes(pipelineGroupFor(item.labels)))
      .map((item) => ({
        issueNumber: item.number,
        title: item.title,
        rung: rungFromLabels(item.labels, rungKeys),
        closedAt: item.closedAt as string,
      }))
      .sort((a, b) => b.closedAt.localeCompare(a.closedAt)),
    counts: {
      openCards: openIssues(reading).length,
      openPullRequests: openPulls(reading).length,
      truncated: reading.truncated,
    },
  };
}

export type LiveDeskState =
  | { readonly available: false; readonly why: string }
  | { readonly available: true; readonly stale: boolean; readonly why: string | null; readonly desk: LiveDesk };
