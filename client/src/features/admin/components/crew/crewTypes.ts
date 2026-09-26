/**
 * The page's view types, INFERRED from the router rather than restated.
 *
 * Working law 4: a hand-written mirror of `crew.getState`'s shape is a second
 * list shadowing a source of truth, and it drifts the first time a shift adds a
 * field to the briefing schema. These are derived, so a change on the server is
 * a type error here rather than a silently unrendered fact.
 */
import type { inferRouterOutputs } from "@trpc/server";

import { crewCardNeedsHim } from "../../../../../../shared/crewCardState";
import { indexCardBuilds, type CrewCardBuildView } from "../../../../../../shared/crewCardBuildState";
import { resolveHold, type CrewHold } from "../../../../../../shared/crewNextUpHold";
import { crewPipelineRowIsDone } from "../../../../../../shared/crewPipelineStatus";
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
 * (#75). Both carry the same id/state/title triple, and the General box's reply router (gone with the box, #1201)
 * asks only for id + state, so the General box's fall-through rule covers both
 * populations with one list.
 *
 * ⚠ **IT IS THE SERVER'S OWN LIST NOW, NOT A `Pick` OFF THE CARDS (#1138).**
 * `briefing.needsYou` and `briefing.eyeItems` carry only what still needs him
 * since the wire projection widened, so the union of those two is no longer
 * the host population — a reply on a card he answered last week would have
 * found no title and rendered *on "<id>", a card since closed*. The server
 * sends every host's triple in `threadHosts`, built above its own filters.
 */
export type CrewThreadHost = CrewBriefingView["threadHosts"][number];


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
/**
 * A step that names a card (`#N`) GitHub has since closed reads as DONE,
 * whatever the edition still says (#1201). The milestone list is the crew's
 * hand-written notes and it goes stale between editions — on the day he
 * asked, a step still read "waiting" for a sitting he had finished the
 * night before. A step naming no card keeps the state the crew wrote.
 */
export function stepsWithLiveState<T extends { readonly title: string; readonly state: CrewMilestoneStep["state"] }>(
  steps: readonly T[],
  closedCards: readonly number[],
): T[] {
  const closed = new Set(closedCards);
  const token = /(?:^|[^0-9A-Za-z])#0*([1-9][0-9]*)(?![0-9])/g;
  return steps.map((step) => {
    if (step.state === "done") return step;
    let match: RegExpExecArray | null;
    token.lastIndex = 0;
    while ((match = token.exec(step.title)) !== null) {
      if (closed.has(Number(match[1]))) return { ...step, state: "done" as const };
    }
    return step;
  });
}

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
    /* ⚠ THE SERVER NO LONGER SENDS THESE (#1137) — `crewBriefingForPage` drops
       every finished row before the wire, because the page has nowhere to draw
       one and it was 351 KB of a 1.0 MB payload re-read every 60 seconds. This
       line is not thereby dead: it is the DEFINITION of what this list holds,
       the projection asks the same shared question, and it is what still holds
       if the projection is ever taken out. */
    .filter((item) => !crewPipelineRowIsDone(item.status))
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
  /**
   * WHETHER SOMEBODY IS ALREADY ON THIS ROW — the same phrase the other lists
   * carry, or `null` when nobody is (#1345).
   *
   * ⚠ **THE LIST HE READS FIRST WAS THE ONE THAT DID NOT SAY IT.** Seen on his
   * desk 2026-09-26: NEXT UP row 7 read `#1307 Every concurrent PR conflicts on
   * the atlas fingerprint line…` with nothing beside it while PR #1336 sat in
   * *In flight* as *Reviewed — merging* for that same card. #1094's first piece
   * put the phrase on Background Work and Not-on-any-road; NEXT UP was not in
   * its scope, so the page said two different things about one card depending on
   * which block he happened to look at.
   *
   * ⚠ **The judgement is `shared/crewCardBuildState.ts`'s, not this file's** —
   * the same reason the hold above defers to `crewNextUpHold`. A second opinion
   * about "is somebody building this" is the drift working law 4 is about, and
   * that module's own header is where the narrow read (title, `card #N`, branch)
   * is argued.
   */
  build: string | null;
};

export function nextUpRows(
  nextUp: CrewNextUpSource,
  cards: readonly CrewNeedsYouCard[],
  /**
   * What is already happening to each card, from the live read. Omitted — which
   * is what every existing caller does — every row reads as nobody's, exactly as
   * it did before this existed: an absent read cannot invent a builder.
   */
  builds: readonly CrewCardBuildView[] = [],
): CrewNextUpRow[] {
  const askingHim = new Map(
    cards
      .filter((card) => crewCardNeedsHim(card.state) && card.issueNumber !== null)
      .map((card) => [card.issueNumber as number, card.id]),
  );
  const buildsByCard = indexCardBuilds(builds);
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
      build: buildsByCard.get(item.issueNumber) ?? null,
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

/* ─── THE LIVE HALF (#1193). GitHub is read on the server every 30 s and the
   lists below are derived from it; the edition's own snapshot is the FALLBACK
   when GitHub has not answered, and the page says which it is drawing. ─── */
export type CrewLiveView = CrewState["live"];
export type CrewLiveDesk = Extract<CrewLiveView, { available: true }>["desk"];
export type CrewLivePullRequest = CrewLiveDesk["pullRequests"][number];
export type CrewLiveRecentRow = CrewLiveDesk["recent"][number];

/** NEXT UP's input — the shape the live desk and the edition both produce. */
export type CrewNextUpSource = {
  readonly readAt: string;
  readonly items: readonly {
    readonly issueNumber: number;
    readonly title: string;
    readonly urgent: boolean;
    readonly held?: { readonly state: "blocked" | "fable" | "sitting"; readonly because?: string } | null;
  }[];
};

/** The ladder cards input — the shape the live desk and the edition both produce. */
export type CrewLadderCardsSource = {
  readonly readAt: string;
  readonly items: readonly {
    readonly issueNumber: number;
    readonly title: string;
    readonly kind: string;
    readonly rung: string | null;
    /** The live desk's quiet word for the row (a hold, "debt"); the edition's list has none. */
    readonly note?: string | null;
  }[];
};

/**
 * Where a queue reading came from, said on the block that draws it. `live` is
 * GitHub answering now; `stale` is the last good reading with GitHub not
 * answering since; `snapshot` is the edition's own list, one shift old.
 */
export type CrewQueueRead = {
  readonly kind: "live" | "stale" | "snapshot";
  readonly readAt: string;
  readonly why: string | null;
};

export function queueReadOf(live: CrewLiveView, snapshotReadAt: string): CrewQueueRead {
  if (!live.available) return { kind: "snapshot", readAt: snapshotReadAt, why: live.why };
  return { kind: live.stale ? "stale" : "live", readAt: live.desk.readAt, why: live.why };
}

/** The ladder's cards — live when GitHub answers, the edition's list otherwise. */
export function ladderCardsFor(live: CrewLiveView, briefing: CrewBriefingView): CrewLadderCardsSource {
  return live.available ? live.desk.ladderCards : briefing.program.ladderCards;
}

/**
 * What still needs him: the edition's cards minus any GitHub has since closed.
 * The edition's `state` is a shift's hand and can be a cycle old; a closed
 * card is a fact, and a closed card does not ask questions.
 */
export function needsYouFor(live: CrewLiveView, cards: readonly CrewNeedsYouCard[]): CrewNeedsYouCard[] {
  if (!live.available) return [...cards];
  const closed = new Set(live.desk.closedCards);
  const held = new Set(live.desk.heldCards);
  /*
    ANSWERED IS NOT ONLY CLOSED — his question, 2026-09-25 (terminal),
    verbatim: *"do i need to reply to these?"*, of a question he had answered
    in the terminal an hour before. The relay records an answer on the card
    and lifts its hold; the card stays open while the crew builds on it. So a
    needs-you card whose issue is open and no longer held has been answered,
    and stops asking him. A card the edition filed with no issue number is
    kept — nothing live can vouch for it either way.
  */
  return cards.filter((card) =>
    card.issueNumber === null || (!closed.has(card.issueNumber) && held.has(card.issueNumber)));
}

/**
 * The eye items still worth his eye — his question, 2026-09-25 (terminal),
 * verbatim: *"do i need to reply to these?"*: the Sifr strips stayed under FOR
 * YOUR EYES after their card had been closed with his verdict recorded on it.
 * The page passed the edition's items straight through; a closed card's frames
 * were never subtracted the way its needs-you card was (#1193). Same rule now.
 */
export function eyeItemsFor(live: CrewLiveView, items: readonly CrewEyeItem[]): CrewEyeItem[] {
  if (!live.available) return [...items];
  const closed = new Set(live.desk.closedCards);
  return items.filter((item) => item.issueNumber === null || !closed.has(item.issueNumber));
}

/**
 * PROBLEMS holds only actionable faults — his ruling 2026-09-25 (#1201):
 * *"only problems which are actual problems and actionable need to go here
 * otherwise these are not problems??"*. An `info` row (the page drew it as
 * "Note" — queue-shape narration) is not a problem and is not drawn; a
 * problem that names a card (`#N`) GitHub has since closed is treated as
 * resolved live, whatever the edition still says about it.
 */
export function problemsFor(live: CrewLiveView, problems: readonly CrewProblem[]): CrewProblem[] {
  const closed = new Set(live.available ? live.desk.closedCards : []);
  const namesClosedCard = (text: string) => {
    const token = /(?:^|[^0-9A-Za-z])#0*([1-9][0-9]*)(?![0-9])/g;
    let match: RegExpExecArray | null;
    while ((match = token.exec(text)) !== null) {
      if (closed.has(Number(match[1]))) return true;
    }
    return false;
  };
  return problems.filter((problem) =>
    problem.severity !== "info" && !namesClosedCard(`${problem.title} ${problem.detail}`));
}

export function nextUpFor(live: CrewLiveView, briefing: CrewBriefingView): CrewNextUpSource {
  return live.available ? live.desk.nextUp : briefing.nextUp;
}
