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
 * Every card (`#N`) a sentence names, in the order it names them. One reader
 * for the three surfaces that ask it — a milestone step, a problem row, and
 * the guard that holds them to one spelling — because the token was written
 * out twice already and a third copy is the drift working law 4 names.
 */
export function cardsNamedIn(text: string): number[] {
  const token = /(?:^|[^0-9A-Za-z])#0*([1-9][0-9]*)(?![0-9])/g;
  const found: number[] = [];
  let match: RegExpExecArray | null;
  while ((match = token.exec(text)) !== null) found.push(Number(match[1]));
  return found;
}

/**
 * A step that names a card (`#N`) GitHub has since closed reads as DONE,
 * whatever the edition still says (#1201). The milestone list is the crew's
 * hand-written notes and it goes stale between editions — on the day he
 * asked, a step still read "waiting" for a sitting he had finished the
 * night before. A step naming no card keeps the state the crew wrote.
 *
 * ⚠ **IT TAKES A PREDICATE RATHER THAN A LIST OF CLOSURES — #1586.** It was
 * handed `desk.closedCards`, which is one page of a 48-hour search, so a
 * step naming a card closed before that window, or crowded off its page,
 * read as in progress for ever. His words: *"why does it still say all these
 * things are in progress? are they?"* — ten steps, eleven closed cards, none
 * of them drawn as done. `cardIsClosed` is the reading; see its docblock and
 * `LiveDesk.closedCards` for the measurement.
 */
export function stepsWithLiveState<T extends { readonly title: string; readonly state: CrewMilestoneStep["state"] }>(
  steps: readonly T[],
  isClosed: (issueNumber: number) => boolean,
): T[] {
  return steps.map((step) => {
    if (step.state === "done") return step;
    return cardsNamedIn(step.title).some(isClosed)
      ? { ...step, state: "done" as const }
      : step;
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
/* The two lists carry the same row shape, and it is taken from `open` because
   that is the one the page cannot do without (#1358). */
export type CrewShiftRunView = CrewShiftRunsView["open"][number];

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
/**
 * One milestone's test drive, read off its completion card (#1646). Inferred
 * from the router like every other live view, so the server's extractor is the
 * only declaration of the shape.
 */
export type CrewLiveTestDrive = CrewLiveDesk["testDrives"][number];

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

/**
 * IS THIS CARD CLOSED — the one reading every surface that subtracts a closed
 * card now asks (#1586): a milestone step, a needs-you card, an eye item, a
 * problem row. All four used to read `desk.closedCards`, which answers a
 * different question — *what closed in the last 48 hours*, one page of it —
 * and all four said so in their own docblocks while believing the first.
 *
 * **The reading, in order:**
 *  1. in `closedCards` → closed. The window is small but it is a fact, and it
 *     is the only thing available when the open read is truncated.
 *  2. `openComplete` and the number is at or below `highestCard` and NOT in
 *     `openCards` → closed. A number this repository has issued is either open
 *     or closed, and the open set is the complete one (37 items against a page
 *     of 100 the day this landed; the closed window held 132).
 *  3. otherwise → NOT closed, and the surface keeps whatever the crew wrote.
 *
 * ⚠ **STEP 3 IS THE DIRECTION THIS IS BUILT TO FAIL IN.** A card above
 * `highestCard` (a typo, a number not yet issued) and every card at all when
 * the open read truncated are treated as open. That is the behaviour of every
 * day before this fix — his page saying *less done than it is*, which costs
 * him a question. The other direction costs him the milestone gate: a
 * milestone drawn as finished when it is not is the one thing THE MILESTONE
 * GATE exists to stop, and no stale sentence is worth guessing at it.
 */
export function cardIsClosed(live: CrewLiveView): (issueNumber: number) => boolean {
  if (!live.available) return () => false;
  const { closedCards, openCards, highestCard, openComplete } = live.desk;
  const closed = new Set(closedCards);
  const open = new Set(openCards);
  return (issueNumber: number) => {
    if (closed.has(issueNumber)) return true;
    if (!openComplete) return false;
    return issueNumber <= highestCard && !open.has(issueNumber);
  };
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
  const closed = cardIsClosed(live);
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
  const kept = cards.filter((card) =>
    card.issueNumber === null || (!closed(card.issueNumber) && held.has(card.issueNumber)));
  /*
    AND THE HALF NO EDITION HAS WRITTEN UP (#1467). Everything above SUBTRACTS:
    it can only ever make the section shorter than the file a shift last wrote,
    so a question nobody wrote up is a question he never sees. Measured on
    edition 575: every one of the 143 cards in that file was marked `done`, the
    section said *"Nothing is waiting on you"*, and two open cards said on their
    own card that they were waiting on him. A card whose own hold sentence names
    him is therefore drawn whatever the edition says, and one the edition HAS
    written up keeps its prose — the join is on the issue number, so a card is
    never listed twice.
  */
  const written = new Set(kept.map((card) => card.issueNumber).filter((n): n is number => n !== null));
  const bare = live.desk.waitingOnYou
    .filter((item) => !written.has(item.issueNumber))
    .map(needsYouCardFromHold);
  return [...kept, ...bare];
}

/**
 * The filer's hold sentence with its marker put back, so a bare row reads as a
 * sentence rather than starting mid-thought. See `needsYouCardFromHold`.
 */
function waitingSentence(reason: string): string {
  return /^waiting\s+on\b/i.test(reason.trim()) ? reason : `Waiting on ${reason}`;
}

/**
 * A held card rendered as a needs-you card, with nothing invented.
 *
 * ⚠ **ITS `id` IS WHAT MAKES THE REPLY BOX WORK**, and it is the card number
 * rather than a slug because there is no shift to coin one: `crew_replies.cardId`
 * is *"bounded at 64 and validated for NOTHING ELSE"* (`server/routes/crew.ts`),
 * the thread under each card is `replies.filter(r => r.cardId === card.id)`, and
 * `#N` is the one identity this row and his answer can both be sure of. So he
 * answers these exactly where he answers every other card.
 *
 * ⚠ **AND THE PROSE IS THE FILER'S SENTENCE, NOT A COMPOSED ONE.** `productImpact`
 * leads the row by his standing order; here it is the `**Waiting on:**` line
 * that made this card his, which is the most honest thing available and the only
 * thing that is not a guess. A bare row is visibly terser than a written-up card
 * — that difference is true, and it is the signal that a shift still owes this
 * one a proper write-up.
 *
 * ⚠ **THE MARKER IS PUT BACK AS PROSE, WHICH IS THE ONE WORD THIS ROW COMPOSES
 * (the relay's nit on PR #1527, filed on #1467 for this slice).** The reader
 * strips `**Waiting on:**` to get the sentence, so the row rendered #1434's as
 * *"you — a yes or no, and no is a fine answer."* — a line that starts with a
 * pronoun and reads like the middle of something. Restoring the two words makes
 * it a sentence again (*"Waiting on you — a yes or no…"*) without touching what
 * the filer actually wrote, which is why it is a prefix rather than a rewrite.
 *
 * A sentence that already opens with those words is left alone: the marker and a
 * filer's own *"Waiting on the founder"* would otherwise stack into *"Waiting on
 * Waiting on the founder"*. No card says it twice today — it is guarded because
 * the cost is one comparison and the symptom would be on HIS page.
 */
function needsYouCardFromHold(item: CrewLiveDesk["waitingOnYou"][number]): CrewNeedsYouCard {
  return {
    id: `card-${item.issueNumber}`,
    title: item.title,
    productImpact: waitingSentence(item.reason),
    workedExample: null,
    options: [],
    recommendation: null,
    state: "open",
    filedAt: item.filedAt,
    issueNumber: item.issueNumber,
  };
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
  const closed = cardIsClosed(live);
  return items.filter((item) => item.issueNumber === null || !closed(item.issueNumber));
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
  const closed = cardIsClosed(live);
  return problems.filter((problem) =>
    problem.severity !== "info"
    && !cardsNamedIn(`${problem.title} ${problem.detail}`).some(closed));
}

export function nextUpFor(live: CrewLiveView, briefing: CrewBriefingView): CrewNextUpSource {
  return live.available ? live.desk.nextUp : briefing.nextUp;
}

/**
 * ONE QUESTION, ONE CARD — which eye items belong INSIDE a Needs-you card, and
 * which still stand on their own (#1895, his word 2026-10-07: *"i dont want
 * double up of cards on my desk … its making my desk look overcrowded"*).
 *
 * # What was wrong, and what it cost
 *
 * One question reached him as TWO cards — the decision with its own reply box,
 * and the frames with ANOTHER — and he answered **#1837 twice, seventeen
 * minutes apart** (replies #260 and #262, both *YES*). The two write-ups asked
 * the same thing in different words, so from his side there was no way to tell
 * that answering one had settled the other.
 *
 * ⚠ **AND THE LUCK IS THE WORSE HALF: HE AGREED WITH HIMSELF.** Nothing in the
 * record said which reply wins when the two disagree, and nothing would have
 * flagged it — a shift reading `crew-read-replies` sees two rows and no warning
 * that they are one question. **The merge answers it rather than leaving it to
 * the first time it happens**: there is one box per question from here, so a
 * disagreement cannot be created; and the replies already filed against BOTH
 * ids render in ONE thread in time order, so a historical pair is visible as a
 * pair rather than silently resolved by whichever list a reader opened.
 *
 * # The rule, derived from `cardId` and from nothing else
 *
 * An eye item is MERGED when its `cardId` names a Needs-you card that is still
 * on his desk, and **ANSWERED — dropped — when its card is one the edition
 * wrote and the page is no longer drawing.** Only an item with no `cardId`, or
 * one naming a card the edition never had, stands on its own.
 *
 * ⚠ **THE ANSWERED LIMB IS #1938, AND WITHOUT IT THE MERGE CREATED THE DEFECT
 * IT WAS BUILT TO FIX, ONE ROAD OVER.** `needsYouFor` takes a card off the
 * live desk the moment the relay records his answer and lifts the hold (#1193)
 * — the card is still OPEN, because its next slice is being built, so
 * `eyeItemsFor` cannot see it: that reader drops an item only when its issue is
 * CLOSED. The host then failed the `drawn` test, fell into `standalone`, and
 * the gallery drew the frames as their own item **with their own reply box**.
 * So from his answer until the next edition, the pictures came back asking
 * again — #1895's double-answer failure, by another road.
 *
 * ⚠ **AND THE REPAIR BELONGS HERE RATHER THAN IN `eyeItemsFor`, WHICH IS WHERE
 * IT LOOKS LIKE IT BELONGS.** That reader keys on the item's OWN
 * `issueNumber`, and an eye item's issue need not be the issue of the card
 * asking its question: `retry-outfit-1474` carries issue 1474 and hosts on
 * `sheet-shape-1278`. A drop keyed on `issueNumber` would therefore judge the
 * wrong card. The question *"has the thing that asked this been answered"* is
 * about the HOST, so it is asked where the host is known.
 *
 * ⚠ **IT NEEDS BOTH LISTS AND THE DIFFERENCE IS THE WHOLE POINT.** `cards` is
 * what the page DRAWS (post-`needsYouFor`); `editionCards` is what the edition
 * WROTE. A host missing from the first is answered; a host missing from BOTH is
 * a `cardId` naming nothing, which the briefing schema refuses (#133) and which
 * is therefore kept visible rather than dropped — frames cannot be re-created
 * from a vanished item, so the one case this function cannot explain fails
 * toward his eye (law 9).
 *
 * ⚠ **NO SECOND LIST (working law 4).** Both drawn halves are this one function
 * read two ways, so a section cannot disagree with the other about what is
 * paired: the gallery draws `standalone`, each card draws
 * `mergedInto.get(card.id)`. `answered` is returned rather than quietly
 * discarded so that *nothing is lost* stays a provable property — the three
 * halves between them are the whole list — instead of a claim about a function
 * that drops things.
 */
export function partitionEyeItems(
  items: readonly CrewEyeItem[],
  cards: readonly CrewNeedsYouCard[],
  editionCards: readonly CrewNeedsYouCard[],
): {
  standalone: CrewEyeItem[];
  mergedInto: Map<string, CrewEyeItem[]>;
  answered: CrewEyeItem[];
} {
  /* The cards this page is actually DRAWING — the same `crewCardNeedsHim`
     filter `CrewNeedsYou` applies, because an item merged into a card that is
     not rendered would vanish, and a vanishing is what #354 called "the
     vanishing the design forbids". */
  const drawn = new Set(cards.filter((card) => crewCardNeedsHim(card.state)).map((card) => card.id));
  /* Every card the edition wrote, whatever state it is in — the set that tells
     an ANSWERED host from one that never existed. */
  const written = new Set(editionCards.map((card) => card.id));
  const standalone: CrewEyeItem[] = [];
  const answered: CrewEyeItem[] = [];
  const mergedInto = new Map<string, CrewEyeItem[]>();
  for (const item of items) {
    const host = item.cardId ?? null;
    if (host === null || !written.has(host)) {
      standalone.push(item);
      continue;
    }
    if (!drawn.has(host)) {
      answered.push(item);
      continue;
    }
    const beside = mergedInto.get(host);
    if (beside) beside.push(item);
    else mergedInto.set(host, [item]);
  }
  return { standalone, mergedInto, answered };
}
