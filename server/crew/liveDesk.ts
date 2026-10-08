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
import {
  buildStateHoldsOffOffer,
  crewCardBuildState,
  crewCardBuildViews,
  handFindingNoteForPullRequest,
  repairFlaggedAtForPullRequest,
  handVerdictForPullRequest,
  notBuiltCards,
  type CrewBuildPullRequest,
  type CrewCardBuildView,
  type CrewCardCommentFact,
} from "../../shared/crewCardBuildState";
import type { HandVerdictFreshness } from "../../shared/handVerdict";
import {
  CREW_HOLD_LABELS,
  CREW_HOLD_WORD,
  heldStateFromLabels,
  heldStatesFromLabels,
  holdOwnerFromReason,
  type CrewHeldState,
} from "../../shared/crewNextUpHold";
import { rankFromLabels, sortOrderedBand } from "../../shared/crewOrderedBand";
import type { CrewTestDriveStep } from "../../shared/crewTestDrive";
import { CREW_PIPELINE_GROUPS } from "../../shared/crewPipelineGroups";
import { exclusionFor, type CrewQueueExclusions } from "../../shared/crewQueueExclusions";
import { QUEUE_POSSIBLY_DONE_CAP } from "../../shared/crewQueuePossiblyDone";
import { QUEUE_TITLES_PER_CATEGORY, type CrewQueueTitle } from "../../shared/crewQueueTitles";
import { CREW_WORK_CATEGORIES, homeWorkCategoryFor } from "../../shared/crewWorkSwitches";
import type { CrewPipelineGroupView, CrewQueueCountView } from "../db/crewWorkSwitches";
import type { LiveQueueItem, LiveQueueReading } from "./liveQueue";
import { exactHandReading, type LivePullRequestHead } from "./liveRepairs";

export const ORDERED_LABEL = "founder-ordered";
const URGENT_LABEL = "urgent";
/** A PR carrying either waits for the relay's hand verdict before it can merge. */
const HELD_PR_LABELS: readonly string[] = ["needs-fable", "founder-review"];

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

/**
 * A card waiting on HIM, read off the card itself — see `liveWaitingOnYou`.
 * The shape a needs-you row can be built from with nothing else: what it is,
 * why it is his, when it was filed, and where to read it.
 */
export type LiveWaitingOnYou = {
  readonly issueNumber: number;
  readonly title: string;
  /** The filer's `**Waiting on:**` sentence, marker already stripped. */
  readonly reason: string;
  readonly filedAt: string;
  readonly url: string;
  readonly urgent: boolean;
};

/**
 * A MILESTONE'S TEST DRIVE, as his page draws it (#1646).
 *
 * His word, 2026-10-01, on N2's completion card: *"i mean this could be a card
 * on my desk if it tell me exactly what to drive and test but it didnt??"* —
 * the drive was in #1644's BODY, and a body is the one thing his Desk has never
 * rendered. The steps come off the card itself every tick
 * (`LiveQueueItem.testDrive`), so an edit to the card is live on his page and
 * there is no copy to rot (working law 4).
 */
export type LiveTestDrive = {
  readonly issueNumber: number;
  readonly title: string;
  /** The rung the card's label names — the heading says "Test drive · N2". */
  readonly rung: string | null;
  readonly steps: readonly CrewTestDriveStep[];
  /**
   * ⚠ **A CLOSED COMPLETION CARD'S DRIVE STILL DRAWS, AND THE PAGE SAYS SO.**
   * The queue's closed search reaches back `RECENT_WINDOW_HOURS` (48), so a
   * drive on a closed card leaves his page two days later. That is correct when
   * the drive is OVER and wrong while it is not — which is why his own rule of
   * 2026-09-26 settles it rather than this field: *"yes it shouldnt close if its
   * waiting on my eye and my verdict"*. A completion card whose drive he has not
   * finished is waiting on his hands, so it stays OPEN, and an open card is read
   * from the open search for ever. The flag exists so the section can say *this
   * card is closed* instead of quietly disappearing.
   */
  readonly cardClosed: boolean;
  readonly url: string;
};

export type LivePullRequestState = "draft" | "held" | "finding" | "passed" | "gate";

export type LivePullRequest = {
  readonly number: number;
  readonly title: string;
  readonly state: LivePullRequestState;
  /** Cards the PR's title names (`#N`) that the queue holds. */
  readonly cards: readonly number[];
  readonly author: string;
  readonly updatedAt: string;
  /**
   * When the relay last said something was wrong — the timestamp of the very
   * finding this row's words are quoted from, or `null` on any row that is not
   * `finding` (#1977).
   *
   * ⚠ **NOT `updatedAt`, which is the row's own clock and moves on a label or a
   * reply from anybody.** It is the finding the row is held on (`liveHandReading`,
   * #1984) — the newest one, because the comment store keeps the newest of each
   * kind; the seat cut's reader dates the same hold by the OLDEST finding on the
   * head, which is the question of *since when the repair has been owed*.
   */
  readonly repairFlaggedAt: string | null;
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
   *
   * ⚠ **THIS IS A HISTORY FEED AND FOUR READERS WERE ASKING IT A STATE
   * QUESTION — #1586, 2026-09-30, his own words: *"why does it still say all
   * these things are in progress? are they?"*.** It is one page of a
   * 48-hour search, and `stepsWithLiveState`, `needsYouFor`, `eyeItemsFor`
   * and `problemsFor` each read it as *is this card closed* — every one of
   * them saying so in its own docblock. Measured the morning he asked: his
   * milestone drew **ten** steps as in progress and **all eleven cards they
   * name were closed**; two had closed outside the 48 hours (#1408 on the
   * 26th, #1443 on the 27th) and the other eight were inside it and dropped
   * anyway, because **132 items closed in that window against a page of
   * 100** and the page is sorted by `updated`, so a card closed yesterday
   * and untouched since sorts below a hundred busier rows. The section whose
   * job is to say when the milestone gate opens was reading *less done than
   * it is*.
   *
   * **The repair is not a bigger window** — that makes the truncation worse,
   * and the numbers above say a page can never bound this repository's
   * closures. It is `openCards` + `openComplete` below: ask the question the
   * readers are actually asking, of the set that can answer it. This field
   * stays exactly as it was, because *what closed recently* is a real and
   * different fact (it is what `finishedLadder` and *since you last looked*
   * are built from) and `cardIsClosed` unions the two.
   */
  readonly closedCards: readonly number[];
  /**
   * EVERY open number the reading saw — issues AND pull requests, which share
   * one number space on GitHub, so an open PR named in a step must not read as
   * closed by being absent from the issues.
   *
   * With `openComplete` and `highestCard` this is what answers *is this card
   * closed* (`cardIsClosed`): a number at or below the highest the reading saw
   * is one GitHub has issued, and if it is not open then it is closed. That
   * reading needs no extra request and no window at all — the complement of a
   * set of 37 rather than a page of a list of 132.
   */
  readonly openCards: readonly number[];
  /**
   * The highest number the reading saw, across both searches — the bound on
   * the complement above, and `0` for an empty reading.
   *
   * Without it a step naming a card that does not exist yet (a typo, or a
   * number this repository has not issued) would read as closed, which is the
   * one direction that matters: this page may say *less done than it is* and
   * cost him a question, or *more done than it is* and cost him the milestone
   * gate.
   */
  readonly highestCard: number;
  /**
   * True when the OPEN search was not truncated, so its absences are facts
   * rather than a page boundary (`liveQueue`'s `truncated.open`).
   *
   * When it is false `cardIsClosed` falls back to `closedCards` alone — the
   * behaviour of every day before #1586, which reads a closed card as still
   * in progress rather than an open card as done. **A guess in the other
   * direction would be the page telling him a milestone is finished when it
   * is not**, and no repair to a stale sentence is worth that.
   */
  readonly openComplete: boolean;
  /**
   * Open cards still carrying the hold label — the ones genuinely waiting on
   * somebody. His question, 2026-09-25 (terminal), verbatim: *"do i need to
   * reply to these?"* — two items still asked him for a word he had already
   * given in the terminal an hour earlier. A needs-you card names a card he
   * must answer; the moment the relay records his answer it lifts the hold,
   * and the card is open but no longer held. `closedCards` could not see
   * that (the card is not closed — its next slice is being built), so the
   * page subtracts a needs-you card whose issue is open and NOT here. Derived
   * from the same label the hold vocabulary reads (`CREW_HOLD_LABELS.blocked`),
   * never a second spelling of "blocked".
   */
  readonly heldCards: readonly number[];
  /**
   * Cards whose own hold sentence says they are waiting on HIM (#1467) — the
   * live half of *Needs you*, joined with the edition's prose on the issue
   * number by `needsYouFor`. See `liveWaitingOnYou` for why the sentence is
   * read rather than a label, and for the one thing it cannot see.
   */
  readonly waitingOnYou: readonly LiveWaitingOnYou[];
  /**
   * Every card in this reading that declares a test drive (#1646) — in practice
   * the milestone completion cards, newest first.
   */
  readonly testDrives: readonly LiveTestDrive[];
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
  /**
   * WHAT IS ALREADY HAPPENING TO EACH CARD (#1094) — his order, 2026-09-26:
   * *"work on 1094 and 1307 next so the desk shows whats built"*. One short
   * phrase per open card that somebody is building, has claimed, or has refused;
   * a card nobody is on has no entry at all, which is how the rows stay quiet.
   */
  readonly builds: {
    readonly items: readonly CrewCardBuildView[];
    /**
     * `null` when the claim-and-refusal read answered; its reason otherwise —
     * the panel says so, because a missing phrase and an unread comment look
     * identical on a row and only one of them means nobody is on it.
     */
    readonly commentsWhy: string | null;
  };
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
export function liveWorkCounts(
  reading: LiveQueueReading,
  /**
   * WHICH CARDS SOMEBODY IS ALREADY BUILDING (#1094 piece 2) — the numbers under
   * his switches subtract them, through the `building` exclusion reason, so the
   * panel that offered him five already-built cards stops counting them as work.
   * Empty by default: a reading with no comment half subtracts nothing and draws
   * the panel it drew before, because an unread board must never make a count
   * smaller.
   */
  heldOffOffer: ReadonlySet<number> = new Set<number>(),
): LiveDesk["work"] {
  const countedAt = new Date(reading.readAt);
  const issues = openIssues(reading);
  const mergedTitles = reading.recent.filter((item) => item.kind === "pr" && item.status === "merged").map((item) => item.title);
  const namedByMerge = (number: number) => mergedTitles.some((title) => cardsNamedIn(title, new Set([number])).length > 0);

  const counts: CrewQueueCountView[] = CREW_WORK_CATEGORIES.map((category) => {
    /*
      HOMED ONCE (his question, 2026-09-25): a card with two work labels used
      to be drawn and counted under both. The home is the first matching
      category in list order — `homeWorkCategoryFor` — so the sum of the
      category counts is a count of cards, the way the groups' total already
      was. A card with no work label homes nowhere here and stays the groups'.
    */
    const population = issues.filter((item) => homeWorkCategoryFor(item.labels) === category.key);
    const offered: LiveQueueItem[] = [];
    const excluded: Record<string, number> = {};
    for (const item of population) {
      const reason = exclusionFor(item.labels, heldOffOffer.has(item.number));
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

/**
 * ⚠ **THE CARDS THAT SAY THEMSELVES THEY ARE WAITING ON HIM (#1467).**
 *
 * *Needs you* is the one question this page exists to answer, and it was the
 * last section still answered entirely by hand: an edition's `needsYou` list,
 * written at the end of a shift and deployed. Working law 4's mirror, and it
 * had drifted all the way. **Measured on edition 575, the night this landed:
 * 143 of 143 needs-you cards and 117 of 117 eye items marked `done`, so the
 * section rendered *"Nothing is waiting on you"* — while #1434 asked him for a
 * yes or no and #1492 asked him to pick a retry shape.** Neither was on his
 * page; both had said so on their own card for days.
 *
 * So a held card whose own `**Waiting on:**` sentence names HIM appears here,
 * whatever any edition says — the label makes the hold live, the sentence says
 * whose it is, and `holdOwnerFromReason` is anchored on its first word for the
 * reason that function's docblock gives. The edition still owns the PROSE: a
 * card it has written up keeps its product-impact paragraph, its options and
 * its recommendation, and is not duplicated here (`crewTypes.ts` joins the two
 * on the issue number).
 *
 * ⚠ **THE STATED LIMIT, AND IT IS THE PROGRAM'S OWN RULE RATHER THAN A GAP:
 * ONLY THE CARD BODY IS READ.** `liveQueue` takes the reason from the body
 * (`holdReasonFromBody`) because that is where the founder-ordered clause puts
 * it — *"A comment is a record; the body is what gets read."* A hold sentence
 * written only in a comment is invisible to this, deliberately: the comment
 * reader's window is 48 hours and three pages, so a reason older than that
 * would appear on his desk for two days and then vanish, which is worse than a
 * rule.
 *
 * ⚠ **THE REMAINDER IS NAMED NOW, AND IT IS STILL NOT DRAWN — the two are
 * different questions (#1467 slice 2).** A held card whose sentence cannot be
 * read — absent, or about something that is not a person — is deliberately not
 * drawn here, because this reader never guesses `you`; that is the same
 * direction #298 chose, for a reason that has not changed. What has changed is
 * that it is no longer SILENT: `planUnreadableHolds` (`shared/crewNextUpHold.ts`)
 * reads the whole open queue and `crew-desk-sweep.mts` prints every such card
 * at the close of every shift, which is where a person is already looking.
 *
 * It could not live in the stale-hold block beside it: that block's population
 * is `planDeskHoldLabels`' `ordered` — the **founder-ordered** cards alone —
 * and **neither of the two cards this card was filed about is founder-ordered**,
 * so the obvious home could see neither of them. Measured the night slice 2
 * landed, with these three readers rather than a grep: **6 held cards — 2 name
 * him, 2 name something that is not a person, 2 (#1468, #1337) carry `blocked`
 * with no `**Waiting on:**` line at all.**
 *
 * ⚠ **The report REPAIRS NOTHING**, for `planDeskHoldLabels`' reason: what a
 * hold waits on is a judgement about work, and a sentence nobody meant is worse
 * than none because the next reader believes it. So the floor this docblock used
 * to state still stands as the page's behaviour — **a card that does not say
 * whose hold it is does not reach his page** — it is just no longer the only
 * thing that happens to it.
 */
export function liveWaitingOnYou(reading: LiveQueueReading): LiveWaitingOnYou[] {
  const items: LiveWaitingOnYou[] = [];
  for (const item of openIssues(reading)) {
    /* ⚠ ANY hold label, not `blocked` alone — `needs-sitting` is a hold whose
       whole meaning is a sitting with HIM. The sentence is what decides; the
       label only says the hold is still live (#298's split). */
    if (heldStatesFromLabels(item.labels).length === 0) continue;
    const reason = item.holdReason;
    /* The filer's own sentence, with the marker already taken off by
       `holdReasonFromBody`. `null` is `unknown`, which is never his. */
    if (reason === null || holdOwnerFromReason(reason) !== "you") continue;
    items.push({
      issueNumber: item.number,
      title: item.title,
      reason,
      filedAt: item.createdAt,
      url: item.url,
      urgent: item.labels.includes(URGENT_LABEL),
    });
  }
  return items.sort((a, b) => a.issueNumber - b.issueNumber);
}

/**
 * THE TEST DRIVES IN THIS READING (#1646) — open cards first, then the ones
 * closed inside the window, newest card first within each.
 *
 * ⚠ **IT ASKS THE CARD, NOT A LABEL AND NOT THE EDITION.** A drive is declared
 * by writing a `## Your test drive` section, which is what every completion card
 * already does; demanding a `completion-card` label as well would mean the one
 * card this feature was built for (#1644, which carries `founder-review` and
 * `rung:N2`) rendered nothing, and the next shift would have had to remember a
 * label for a section it had already written. **The card body is the whole
 * contract**, which is the card's own clause and working law 4.
 *
 * ⚠ **AND IT READS THE CLOSED WINDOW AS WELL AS THE OPEN SET, ON PURPOSE.**
 * #1644 closed at 2026-09-30T22:16Z — before this was built — so an open-only
 * reader would have shipped a feature that drew nothing on the day it landed
 * and could not be looked at (working law 6). What a closed card costs is
 * stated on `LiveTestDrive.cardClosed` rather than hidden here.
 */
export function liveTestDrives(reading: LiveQueueReading, rungKeys: readonly string[]): LiveTestDrive[] {
  const rows: LiveTestDrive[] = [];
  for (const item of [...reading.open, ...reading.recent]) {
    if (item.kind !== "issue") continue;
    if (item.testDrive.length === 0) continue;
    /* The two searches can both hold one card for a tick around a close, and a
       drive drawn twice would give him two sets of buttons for one step. */
    if (rows.some((row) => row.issueNumber === item.number)) continue;
    rows.push({
      issueNumber: item.number,
      title: item.title,
      rung: rungFromLabels(item.labels, rungKeys),
      steps: item.testDrive,
      cardClosed: item.status !== "open",
      url: item.url,
    });
  }
  return rows.sort((a, b) => {
    /* An open drive is a thing to do; a closed one is a record. */
    if (a.cardClosed !== b.cardClosed) return a.cardClosed ? 1 : -1;
    return b.issueNumber - a.issueNumber;
  });
}

/**
 * ⚠ **A FRESH VERDICT OUTRANKS THE HELD LABEL — his desk correction of
 * 2026-09-26.** *Waiting for review* and *reviewed, now merging* are the two
 * states he actually acts differently on, and In flight drew them with one word
 * because the label is what it read. The verdict is a comment rather than a
 * label, so it arrives as an argument; absent, this answers exactly what it
 * always did.
 */
export function livePullRequestState(
  item: Pick<LiveQueueItem, "draft" | "labels">,
  handVerdict: HandVerdictFreshness = "none",
): LivePullRequestState {
  if (item.draft) return "draft";
  /* ⚠ **A FINDING FIRST (#1673).** The relay read this one and something is
     wrong; it is the only state on this row that names work somebody owes. It
     outranks the verdict clause because `handVerdictForPullRequest` has already
     resolved which hand comment is newer. */
  if (handVerdict === "finding") return "finding";
  if (handVerdict === "fresh") return "passed";
  if (item.labels.some((label) => HELD_PR_LABELS.includes(label))) return "held";
  return "gate";
}

/**
 * WHAT THE RELAY'S HAND COMMENTS MEAN FOR ONE OPEN PULL REQUEST — the stage, the
 * relay's words when it is held, and when it was flagged — from ONE resolution,
 * so the row's state, its quote and its clock cannot come from two readings.
 *
 * ⚠ **WITH THE HEAD COMMIT'S DATE IT IS THE MERGE TOOL'S OWN READING (#1984).**
 * `exactHandReading` hands the facts to `tallyRounds` + `reviewPresence` — the
 * reader `scripts/lib/repairsOwed.mts` and `pr-merge-in-order` use — so a seat
 * replying under a finding no longer makes the page forget it. Measured the day
 * it was filed: 5 shown where that reader saw 9.
 *
 * Without the date (the head reader has not answered, or the pull request opened
 * inside its TTL) it falls back to the `updatedAt` bound every row used before,
 * which under-counts and never invents a hold.
 */
export type LiveHandReading = {
  readonly handVerdict: HandVerdictFreshness;
  readonly note: string | null;
  readonly flaggedAt: string | null;
};

export function liveHandReading(
  item: Pick<LiveQueueItem, "number" | "updatedAt" | "createdAt">,
  facts: readonly CrewCardCommentFact[],
  headDates: ReadonlyMap<number, string> = new Map<number, string>(),
): LiveHandReading {
  const headCommittedAt = headDates.get(item.number);
  if (headCommittedAt === undefined) {
    const input = { pullRequest: item.number, updatedAt: item.updatedAt, facts };
    return {
      handVerdict: handVerdictForPullRequest(input),
      note: handFindingNoteForPullRequest(input),
      flaggedAt: repairFlaggedAtForPullRequest(input),
    };
  }
  const exact = exactHandReading({
    pullRequest: item.number,
    createdAt: item.createdAt,
    headCommittedAt,
    facts,
  });
  if (exact.handVerdict !== "finding") return { handVerdict: exact.handVerdict, note: null, flaggedAt: null };
  /* The finding the reader held it on — its words travel with its clock. */
  const finding = facts.find((fact) => fact.kind === "finding" && fact.card === item.number && fact.at === exact.flaggedAt);
  return {
    handVerdict: "finding",
    note: finding?.kind === "finding" ? finding.note : null,
    flaggedAt: exact.flaggedAt,
  };
}

/** The head dates a `LivePullRequestHead` reading carries, keyed for `liveHandReading`. */
export function headDatesFrom(heads: readonly LivePullRequestHead[]): Map<number, string> {
  const dates = new Map<number, string>();
  for (const head of heads) {
    if (head.headCommittedAt !== null) dates.set(head.number, head.headCommittedAt);
  }
  return dates;
}

/** Open PRs, most recently touched first — what is in flight right now. */
export function livePullRequests(
  reading: LiveQueueReading,
  facts: readonly CrewCardCommentFact[] = [],
  headDates: ReadonlyMap<number, string> = new Map<number, string>(),
): LivePullRequest[] {
  const known = knownCards(reading);
  return openPulls(reading)
    .map((item) => {
      const hand = liveHandReading(item, facts, headDates);
      return {
        number: item.number,
        title: item.title,
        state: livePullRequestState(item, hand.handVerdict),
        cards: cardsNamedIn(item.title, known),
        author: item.author,
        updatedAt: item.updatedAt,
        /* The same resolution as the state, so the row's clock is the finding
           the row is held on (#1977). */
        repairFlaggedAt: hand.flaggedAt,
        url: item.url,
      };
    })
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

/**
 * THE BUILD PHRASES (#1094) — every open card, against the open pull requests
 * this reading holds and whatever claims and refusals the comment reader
 * managed to see.
 *
 * ⚠ **THE PULL REQUESTS COME FROM THE READING AND CARRY NO HEAD REF.** GitHub's
 * search API does not return one, so `pullRequestBuildsCard`'s branch limb is
 * empty here and its title and `card #N` limbs do the work. A shift's `gh pr
 * list` fills all three. That is a difference in what each caller can SEE, and
 * `shared/crewCardBuildState.ts`'s header says so rather than leaving it to be
 * discovered.
 *
 * # THE PHRASES AND THE OFFER VERDICT COME FROM ONE PASS (#1094 piece 2)
 *
 * ⚠ **THE SET IS NOT DERIVED FROM THE PHRASES, and that is deliberate** — a
 * reader that decided "is this on offer" by matching the WORDS of a phrase would
 * break the day a phrase is reworded, and the phrase is copy. Both come from the
 * same `CrewCardBuildState`, which is the fact.
 */
function liveBuildBoard(
  reading: LiveQueueReading,
  facts: readonly CrewCardCommentFact[],
  headDates: ReadonlyMap<number, string>,
): { items: CrewCardBuildView[]; heldOffOffer: Set<number> } {
  const pulls: CrewBuildPullRequest[] = openPulls(reading).map((item) => {
    const hand = liveHandReading(item, facts, headDates);
    return {
      number: item.number,
      title: item.title,
      body: item.body,
      draft: item.draft,
      labels: item.labels,
      /* ⚠ HIS DESK CORRECTION OF 2026-09-26: a pull request the relay has already
         reviewed was reading *"waiting on review"* beside one nobody had looked at.
         The verdict is a COMMENT, so it arrives in `facts` from the comment reader,
         and it is dated against the head commit when that is known (#1984,
         `liveHandReading`) and the pull request's own `updatedAt` otherwise. With no comment read this
         is `none` and the phrase is exactly the one it was before. */
      handVerdict: hand.handVerdict,
      /* ⚠ THE RELAY'S OWN WORDS FOR A HOLD (#1705). His board had one hold state
         for two different things — "a repair is owed" and "sound, held for merge
         order" — and it drew both as the first. It answers `null` for every pull
         request that is not held, and for a header that says nothing beyond
         "held", in which case the row reads exactly as it did before. */
      handFindingNote: hand.note,
    };
  });
  const parsed = Date.parse(reading.readAt);
  const nowMs = Number.isFinite(parsed) ? parsed : Date.now();
  const cards = openIssues(reading).map((item) => item.number);
  /* ⚠ **THE REFUSAL LABEL COSTS THIS READER NOTHING (#1337).** The search that
     gives his page its cards already carries every card's labels, so the durable
     half of a refusal is read here with no second call and no window — which is
     precisely what the paged comment reader could not offer. A shift's board
     takes its own `gh` read for the same fact (`scripts/lib/cardBuildState.mts`)
     because a script holds no such reading; one spelling, one derivation
     (`notBuiltCards`), two places that already had the rows. */
  const notBuilt = notBuiltCards(openIssues(reading));
  const heldOffOffer = new Set<number>();
  for (const card of cards) {
    if (buildStateHoldsOffOffer(crewCardBuildState({ card, openPullRequests: pulls, facts, nowMs, notBuilt }))) {
      heldOffOffer.add(card);
    }
  }
  return {
    items: crewCardBuildViews({ cards, openPullRequests: pulls, facts, nowMs, notBuilt }),
    heldOffOffer,
  };
}

export function deriveLiveDesk(
  reading: LiveQueueReading,
  rungKeys: readonly string[],
  activity: { readonly facts: readonly CrewCardCommentFact[]; readonly why: string | null }
    = { facts: [], why: "the card comments have not been read" },
  /**
   * The head commit's date per open pull request (#1984) — `headDatesFrom` over
   * `liveRepairs`' reading. Empty means every row is read the way it was before.
   */
  headDates: ReadonlyMap<number, string> = new Map<number, string>(),
): LiveDesk {
  const board = liveBuildBoard(reading, activity.facts, headDates);
  return {
    readAt: reading.readAt,
    builds: { items: board.items, commentsWhy: activity.why },
    ladderCards: { readAt: reading.readAt, items: liveLadderCards(reading, rungKeys) },
    nextUp: { readAt: reading.readAt, items: liveNextUp(reading) },
    pullRequests: livePullRequests(reading, activity.facts, headDates),
    recent: liveRecent(reading),
    work: liveWorkCounts(reading, board.heldOffOffer),
    heldCards: openIssues(reading)
      .filter((item) => item.labels.includes(CREW_HOLD_LABELS.blocked))
      .map((item) => item.number)
      .sort((a, b) => a - b),
    waitingOnYou: liveWaitingOnYou(reading),
    testDrives: liveTestDrives(reading, rungKeys),
    closedCards: reading.recent
      .filter((item) => item.kind === "issue" && item.status !== "open")
      .map((item) => item.number)
      .sort((a, b) => a - b),
    /* Issues AND pull requests — one number space (see the field's docblock). */
    openCards: reading.open
      .filter((item) => item.status === "open")
      .map((item) => item.number)
      .sort((a, b) => a - b),
    highestCard: [...reading.open, ...reading.recent]
      .reduce((highest, item) => (item.number > highest ? item.number : highest), 0),
    openComplete: !reading.truncated.open,
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
      /* The counts are a FLOOR if either search overflowed, so this stays the
         combined reading — derived here rather than kept as a second field on
         `LiveQueueReading` (working law 4). */
      truncated: reading.truncated.open || reading.truncated.recent,
    },
  };
}

export type LiveDeskState =
  | { readonly available: false; readonly why: string }
  | { readonly available: true; readonly stale: boolean; readonly why: string | null; readonly desk: LiveDesk };
