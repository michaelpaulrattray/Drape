/**
 * COUNT THE QUEUE - the reading behind the numbers on his background-work
 * switches, extracted so that MORE THAN ONE moment can take it (#618).
 *
 * # WHY THIS IS A LIBRARY AND NOT A SCRIPT
 *
 * His question, 2026-09-07 morning (terminal), verbatim: *"how many bugs has it
 * done and worked on its still reading as 18 but its been working all night"*.
 * He was right, and the cause was not the counting - it was WHEN it ran. The
 * whole of this reading lived inside `scripts/crew-count-queue.mts`, an
 * 833-line top-level-await script that exported nothing, and the standing
 * orders call it at shift START and nowhere else. So the number on his panel
 * was always what a shift FOUND, never what it CLOSED: ten bug cards closed
 * overnight and the panel still read the morning's figure.
 *
 * The card named two roads and only one of them is safe. Spawning this script
 * as a child process from the close is smaller to type and puts a child process
 * on **the one path that must never fail** - a close that dies leaves a run row
 * open, which his page renders as a shift still running (#288's incident). So
 * the counting is extracted here instead, and both callers call a function.
 *
 * # THE CONTRACT, AND IT IS THE WHOLE POINT
 *
 * `refreshQueueCounts` **never calls `process.exit` and never closes the
 * connection it was handed.** Its caller owns both. A refusal comes back as
 * `{ ok: false, reason }` rather than as an exit code, precisely so the close
 * can report it and still close the row - a counting failure must cost his
 * panel one stale reading, never a run row left open all night.
 *
 * The reading itself is unchanged and is documented where it always was, in
 * `scripts/crew-count-queue.mts`: what it counts, why the count is cached
 * rather than live, the titles beside the number, the cards that may already be
 * done, and the columns that arrive by their own migration.
 *
 * # THIS IS A WRITER, AND `crew_queue_counts` IS THE ONLY TABLE IT MAY NAME
 *
 * No DDL, no DELETE, and in particular never `crew_work_switches` - those are
 * HIS rows, and a shift that could write them could switch its own permission
 * on. `server/crewShiftWriterBoundary.test.ts` pins that at the source, with a
 * positive control, and it reads THIS file now that the statements live here.
 */
import { execFileSync } from "node:child_process";

import {
  CREW_PIPELINE_GROUPS,
  pipelineGroupFor,
  pipelineGroupRowKey,
} from "../../shared/crewPipelineGroups.js";
import {
  exclusionFor,
  parseQueueExclusions,
  queueExclusionSentence,
  serializeQueueExclusions,
  type CrewQueueExclusions,
} from "../../shared/crewQueueExclusions.js";
import {
  CITED_CARDS_CEILING,
  cardNumbersIn,
  namedAsEvidenceIn,
  isCitingRatherThanFixing,
  parsePossiblyDone,
  possiblyDoneSentence,
  qualifyingNamings,
  serializePossiblyDone,
  type CardNaming,
} from "../../shared/crewQueuePossiblyDone.js";
import {
  QUEUE_TITLES_PER_CATEGORY,
  parseQueueTitles,
  serializeQueueTitles,
  type CrewQueueTitle,
} from "../../shared/crewQueueTitles.js";
import { CREW_WORK_CATEGORIES } from "../../shared/crewWorkSwitches.js";
import { judgementIsBlind, mergedPullRequestArgs, SEARCH_RESULT_CEILING } from "./crewNamingWindow.mts";

/**
 * THE CONNECTION THIS FUNCTION IS HANDED, described by what it USES and
 * nothing more.
 *
 * Deliberately structural rather than the driver's own class: the caller owns
 * the connection, this file only queries through it, and a narrow shape is what
 * lets a suite drive the whole reading against a double without a database.
 * `end()` is absent on purpose - it is not this function's to call.
 */
export type QueueCountConnection = {
  query<T = unknown>(sql: string, values?: readonly unknown[]): Promise<[T, unknown]>;
};

/**
 * THE ONE PLACE THIS FILE SHELLS OUT (#618).
 *
 * ⚠ **IT IS A SEAM, NOT A WRAPPER FOR TIDINESS.** Four readings here call
 * `gh`, and until they went through one named function the whole of this
 * reading was undrivable: a suite could reach it only by having an
 * authenticated `gh` on PATH and a real queue behind it, which is a test that
 * measures GitHub rather than this code. That mattered more the moment the
 * SHIFT CLOSE started calling it - work added to the close is work that must be
 * provable, and #618's own safety argument is about what happens when this
 * road fails.
 *
 * The default is the real command. Everything else about the four call sites -
 * their arguments, their buffer sizes, their `null`-on-any-doubt handling - is
 * unchanged and stays where it was.
 */
export type QueueGhReader = (args: readonly string[], options?: { readonly maxBuffer?: number }) => string;

/**
 * ⚠ A HANG IS NOT A THROW, AND IT IS THE ONE ROAD A CATCH CANNOT RESCUE
 * (PR #669's review, finding 1).
 *
 * `refreshQueueCountsQuietly` resolves on every road it can SEE - success, a
 * returned refusal, a rejection, a thrown non-Error. A `gh` that blocks
 * forever (an auth prompt, a network that dies mid-TCP) is none of those: it
 * never resolves and never rejects, so the arms that prove the wrapper safe
 * cannot see it. Before this reading moved, that cost only the standalone
 * counter. Now it sits on the SHIFT CLOSE, after the terminal UPDATE - the run
 * row is safely closed either way, so #288's shape cannot recur, but the
 * process would never reach its own exit or its #295 finding.
 *
 * A timeout converts the invisible road into one the catch already handles:
 * `execFileSync` throws `ETIMEDOUT`, the wrapper reports it, and his panel
 * keeps its previous numbers. Two minutes is deliberately generous - the whole
 * reading is a handful of `gh` calls and the slowest measured is seconds, so
 * this can only ever fire on a genuine hang, never on a slow day.
 */
export const QUEUE_GH_TIMEOUT_MS = 120_000;

const REAL_GH: QueueGhReader = (args, options) =>
  execFileSync("gh", [...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: QUEUE_GH_TIMEOUT_MS,
    ...(options?.maxBuffer === undefined ? {} : { maxBuffer: options.maxBuffer }),
  });

const TABLE = "crew_queue_counts";
const TITLES_COLUMN = "titles";
const EXCLUDED_COLUMN = "excluded";
const POSSIBLY_DONE_COLUMN = "possiblyDone";

/**
 * The safety bound on how many merged pull requests are fetched (#494, #507).
 *
 * ⚠ **THE WINDOW ITSELF IS NO LONGER THIS NUMBER — IT IS A DATE, DERIVED FROM
 * THE OLDEST OPEN CARD** (`readOldestOpenCardFiling`). This constant is only
 * the page bound underneath it, and hitting it is now a REPORTED HORIZON rather
 * than a refusal of the whole reading.
 *
 * The reason is #507, found by the reviewer on PR #498 rather than by a
 * customer: the window used to be a bare 500 with a refusal on top, the whole
 * history was 182 when that shipped and is **217 today**, and this repository
 * merges several a day. A few months on, every run would have refused, every
 * category would have been written UNFLAGGED forever, and from his panel that
 * is indistinguishable from *"nothing is ever stale"* — the most reassuring
 * wrong answer this panel can print.
 *
 * A date bound cannot expire that way. The rule only ever qualifies a pull
 * request that merged AFTER the card was filed
 * (`shared/crewQueuePossiblyDone.ts`), so nothing merged before the oldest open
 * card can change any verdict, and old cards close.
 */
const MERGED_PR_PAGE_BOUND = SEARCH_RESULT_CEILING;

/** UTC ISO, never a locale string. */
function iso(value: unknown): string {
  return value instanceof Date ? `${value.toISOString().replace("T", " ").slice(0, 19)} UTC` : String(value);
}
/**
 * One category's whole reading — BOTH answers, because which one is stored
 * depends on a column this script has not looked for yet (#324).
 *
 * `total` / `allTitles` are the reading this script has always taken: every
 * open card carrying the label. `offered` / `offeredTitles` / `exclusions` are
 * the same reading with the cards he has already queued, and the ones parked on
 * his own ruling, taken out and NAMED.
 */
type CategoryReading = {
  readonly total: number;
  readonly allTitles: readonly CrewQueueTitle[];
  readonly offered: number;
  readonly offeredTitles: readonly CrewQueueTitle[];
  readonly exclusions: CrewQueueExclusions;
  /**
   * The OFFERED cards a merged pull request named and nobody answered (#494) —
   * card numbers, newest card first, and the pull requests that named them for
   * the log. Never a subtraction: these are cards inside `offered`.
   */
  readonly possiblyDone: ReadonlyArray<{ card: number; title: string; prs: readonly number[] }>;
  /**
   * OFFERED cards the reader could not judge because they were filed before the
   * pull-request horizon (#507). Empty in the ordinary case. Never stored — it
   * is a fact about the INSTRUMENT this run, not about the card, and it belongs
   * where a shift reads.
   */
  readonly outOfReach: ReadonlyArray<{ card: number; title: string }>;
};

/**
 * WHICH MERGED PULL REQUESTS NAME WHICH CARDS — read once, for every category
 * (#494).
 *
 * ⚠ **ONE `gh` CALL FOR THE WHOLE HISTORY, AND IT IS NOT AN OPTIMISATION.**
 * Per-category calls would re-download the same pull-request bodies seven times
 * and — worse — could return different sets a second apart, so two categories
 * could disagree about whether one card was named. One read, one index, one
 * `countedAt`, which is this table's standing property.
 *
 * `null` on any doubt, exactly as `countOpen` does: a broken `gh` here must
 * leave every category UNFLAGGED rather than write "nothing is stale", which is
 * the most reassuring wrong answer this panel could print.
 */
/**
 * THE OLDEST OPEN CARD'S FILING DATE — the window's own bound (#507).
 *
 * One `gh` call, sorted by GitHub rather than by us, because the answer is one
 * row and paging a hundred to find a minimum is the same reading done slowly.
 *
 * `null` on any doubt, and `readCardNamings` then falls back to the whole
 * history: a date that cannot be read must widen the window, never narrow it.
 * A narrowed window would drop qualifying pull requests and report the result
 * as "nothing flagged", which is the silent direction this file refuses
 * everywhere else.
 */
function readOldestOpenCardFiling(gh: QueueGhReader): { number: number; date: string } | null {
  try {
    const out = gh([
      "issue", "list", "--state", "open", "--limit", "1", "--search", "sort:created-asc", "--json", "number,createdAt",
    ]);
    const rows = JSON.parse(out);
    if (!Array.isArray(rows) || rows.length !== 1) return null;
    const row = rows[0] as { number?: unknown; createdAt?: unknown };
    if (typeof row.createdAt !== "string" || !Number.isFinite(Date.parse(row.createdAt))) return null;
    if (typeof row.number !== "number") return null;
    /* The DAY, not the instant. `merged:>=` takes a date and truncates to its
       start, so this is always a shade WIDER than the rule needs — the safe
       direction, and the only one that cannot lose a qualifying merge. */
    return { number: row.number, date: row.createdAt.slice(0, 10) };
  } catch {
    return null;
  }
}

/**
 * The pull-request index, and how far back it can actually see.
 *
 * `truncated` is false when the whole derived window came back — the ordinary
 * case, and it means every open card can be judged. When the page bound is hit
 * the reader cannot know WHICH merges it is missing (neither `gh` road returns
 * a merge-date-ordered page), so every offered card is reported OUT OF REACH by
 * name rather than unflagged (#507's bar, corrected by PR #588's review).
 */
type CardNamingIndex = {
  readonly index: Map<number, CardNaming[]>;
  readonly truncated: boolean;
};

function readCardNamings(
  since: { number: number; date: string } | null,
  gh: QueueGhReader,
  warn: (line: string) => void,
): CardNamingIndex | null {
  try {
    const out = gh(
      /* Built in `scripts/lib/crewNamingWindow.mts` so the wire this reading
         depends on has arms of its own. */
      mergedPullRequestArgs(since, MERGED_PR_PAGE_BOUND),
      /* Bodies are large and the default 1MB pipe buffer truncates them into a
         JSON parse error — which would read here as "no pull request names any
         card", the silent-zero failure. Raised, and the parse below throws
         rather than degrading if it is ever exceeded again. */
      { maxBuffer: 64 * 1024 * 1024 },
    );
    const rows = JSON.parse(out);
    if (!Array.isArray(rows)) return null;
    /* ⚠ THE PAGE BOUND IS NOT A REFUSAL (#507) AND NOT A PARTIAL READING
       EITHER (PR #588's review). The old code returned null here, which wrote
       every category UNFLAGGED — the sentence *"nothing is ever stale"*, which
       is the answer this instrument exists to stop the panel giving. The first
       repair judged cards newer than the oldest merge it held, which assumed
       the page was the newest-by-merge slice and neither `gh` road promises
       that. So the index is built and simply not consulted: every offered card is
       named as unjudged, and the reason is printed. */
    const truncated = rows.length >= MERGED_PR_PAGE_BOUND;
    if (truncated) {
      warn(
        `⚠ the possibly-fixed reading hit its page bound: ${MERGED_PR_PAGE_BOUND} merged pull requests came back`
        + " — the reader cannot tell which merges it is missing, so every offered card is reported OUT OF REACH"
        + " rather than unflagged. Narrow the window by closing old cards, or page the read by date.",
      );
    }
    const index = new Map<number, CardNaming[]>();
    let citing = 0;
    for (const row of rows as Array<{ number?: unknown; title?: unknown; body?: unknown; mergedAt?: unknown }>) {
      const pr = typeof row.number === "number" ? row.number : 0;
      const mergedAt = typeof row.mergedAt === "string" ? Date.parse(row.mergedAt) : Number.NaN;
      if (pr <= 0 || !Number.isFinite(mergedAt)) continue;
      /* TITLE AND BODY TOGETHER, deliberately. `#494:` in a title and `#494` in
         a body are the same fact to this reader — his card's bar is that the
         reader flags and does not judge, and reading WHERE the number sits is
         the first step toward judging it. Measured either way before choosing:
         the title alone flags 8 of 78 and, combined with the untouched rule, 0.

         A pull request's own number is dropped: a body legitimately names it. */
      const title = typeof row.title === "string" ? row.title : "";
      const body = typeof row.body === "string" ? row.body : "";
      /* TWO READINGS OF ONE BODY, each answering the question it was calibrated
         for (#728). `mentioned` is every `#N` anywhere — the population
         `CITED_CARDS_CEILING`'s 8 was derived from, and the one that must keep
         seeing a patrol report's tabulated twelve. `cards` is the same reader
         asked of the body with fenced blocks and table rows removed, which is
         what a flag is allowed to rest on. */
      const mentioned = cardNumbersIn(`${title}\n${body}`, pr);
      const cards = namedAsEvidenceIn(`${title}\n${body}`, pr);
      /* ⚠ A CITING PULL REQUEST CONTRIBUTES NOTHING, AND IT IS DROPPED HERE
         RATHER THAN AT THE FLAG (#514). One skip removes the naming from the
         index, so the flag and its RECEIPT lose it together — this module has
         already been bitten once by a second copy of a comparison (PR #498,
         finding 1), and a ceiling applied at the question rather than at the
         evidence would be that same second list. */
      if (isCitingRatherThanFixing(mentioned.length)) {
        citing += 1;
        continue;
      }
      for (const card of cards) {
        index.set(card, [...(index.get(card) ?? []), { pr, mergedAt }]);
      }
    }
    if (citing > 0) {
      /* SAID OUT LOUD, because a reader that silently drops evidence is the
         shape this card is about. The instrument stays a floor and reports
         where its floor is. */
      warn(
        `note: ${citing} merged pull request(s) named more than ${CITED_CARDS_CEILING} cards each and were read as`
        + " CITING rather than fixing (#514) — their mentions are not evidence about any single card.",
      );
    }
    return { index, truncated };
  } catch (cause) {
    warn(`[warn] could not read the merged pull requests: ${(cause as Error).message}`);
    return null;
  }
}

/**
 * How many OPEN issues carry this label, the five most recent of them, and
 * which of them are not actually on offer.
 *
 * ⚠ **A FAILED COUNT IS `null`, NEVER `0`.** They are opposite facts: zero
 * tells him toggling that category on buys nothing, and a broken `gh` telling
 * him zero is the confident-wrong-number failure this whole card is about. A
 * null is skipped, the old row is left standing with its older `countedAt`, and
 * the page keeps saying honestly when it was last counted.
 *
 * `--limit 500` and a length, rather than a `--json totalCount` field, because
 * `gh issue list` does not return a total — a `--limit` shorter than the real
 * population would silently cap the answer. 500 is far above any plausible
 * count here and the cap is checked below rather than assumed.
 *
 * ⚠ **THE EXCLUSIONS COST NOTHING EXTRA (#324).** `labels` rides the SAME `gh`
 * response the count and the titles already come out of, so the partition is
 * one more field on one call rather than a second round trip — which is what
 * makes "the count, the titles and the exclusions share one `countedAt`" a
 * property of the statement rather than of three reads agreeing.
 *
 * ⚠ **AND THE PROMISE ABOVE HAD A THIRD ROAD IT DID NOT COVER UNTIL #725: `gh`
 * EXITING 0 AND RETURNING `[]`.** A transient empty response is a *successful*
 * read of nothing, so it was neither a throw nor a non-array — it was written
 * as a fact, with a FRESH `countedAt`, and the staleness ceiling that guards
 * `check-park.ps1` against a bad zero cannot see a zero that is genuinely new.
 * Observed once on production at a shift start: `process` stored 0 at 15:00:11
 * and 8 forty seconds later, with `written 20, skipped 0`.
 *
 * ⚠ **SO A ZERO IS NOW CROSS-EXAMINED, AND THE WITNESS IS FREE.** `population`
 * is how many open cards carry each label in the whole-queue read this same run
 * already takes for the pipeline groups — one response, one instant. A category
 * that reads empty while that population holds cards with its label is
 * *provably* wrong and is REFUSED. A genuinely empty category still stores 0,
 * which is arm 3 of the suite and the only thing that stops this from being a
 * counter that can no longer say zero.
 *
 * ⚠ **AND A ZERO IT CANNOT CHECK IS ALSO REFUSED**, because an unverifiable
 * zero is precisely the one that parks the team. The cost of refusing is a
 * number one run older with an honest age on it; the cost of believing is the
 * nights putting themselves to sleep announcing there is nothing to do.
 *
 * ⚠ **IT IS `total` THAT IS CROSS-EXAMINED, NEVER `offered`, and the difference
 * is the trap.** A stored count of 0 is ORDINARY and correct when every card in
 * a category is excluded — `security` reads `0 open · 1 parked` today. Only an
 * empty ROW LIST is the thing `gh` cannot have meant.
 */
function countOpen(
  label: string,
  namings: CardNamingIndex | null,
  gh: QueueGhReader,
  warn: (line: string) => void,
  population: ReadonlyMap<string, number> | null,
  populationReadAt: number,
): CategoryReading | null {
  try {
    const out = gh(
      ["issue", "list", "--state", "open", "--label", label, "--limit", "500",
        /* `updatedAt` rides the SAME response the count, the titles and the
           exclusions already come out of (#494) — the possibly-fixed rule needs
           "has anybody touched this card since", and asking for it here is one
           more field on one call rather than a second round trip that could
           describe a different moment. */
        "--json", "number,title,createdAt,updatedAt,labels"],
      /* NO `shell: true`. `crew-read-replies.mts` needs one because `railway.cmd`
         is a batch file that cannot be resolved from PATH without it; `gh` is an
         .exe and does not. Driven both ways before choosing (3 rows either way),
         because the shell form emits node's DEP0190 on every run and a shift tool
         should print its answer and no noise. */
    );
    const rows = JSON.parse(out);
    if (!Array.isArray(rows)) return null;
    if (rows.length >= 500) {
      warn(`REFUSING ${label}: 500 rows came back, which is the limit — the count would be a floor, not a count.`);
      return null;
    }
    /* #725 — the zero is the one reading that must survive a cross-examination
       before it is believed. See the docblock: refusing costs a number one run
       older, believing a wrong one costs the nights. */
    if (rows.length === 0) {
      /* `null` is "the witness never took the stand", which is a different fact
         from "the witness says nobody carries this label" — and the two roads
         out of here refuse for different reasons, so they are told apart here
         rather than collapsed into a falsy check. */
      const carried = population === null ? null : population.get(label) ?? 0;
      if (carried === null) {
        warn(
          `REFUSING ${label}: it read empty, and the whole-queue population that could confirm that`
          + " could not be taken this run — an unchecked zero is the one that parks the team (#725).",
        );
        return null;
      }
      if (carried > 0) {
        warn(
          `REFUSING ${label}: it read empty, but this run's own whole-queue read holds ${carried} open card(s)`
          + " carrying that label. The two disagree, so the zero is not written (#725).",
        );
        return null;
      }
    }
    /*
      MOST RECENT FIRST, SORTED HERE RATHER THAN TRUSTED (#285's own words).
      `gh issue list` has a default order and this does not depend on it: an
      order that changed under us would silently reorder his panel, and the one
      thing five of ten rows must be is the five he has not seen.

      A row with no readable `createdAt` sorts LAST rather than being dropped —
      it is still a real open card, and the count above already includes it.
    */
    const stamped = rows.map((row: {
      number?: unknown; title?: unknown; createdAt?: unknown; updatedAt?: unknown; labels?: unknown;
    }) => ({
      number: typeof row.number === "number" ? row.number : 0,
      title: typeof row.title === "string" ? row.title : "",
      at: typeof row.createdAt === "string" ? Date.parse(row.createdAt) : Number.NaN,
      /* NaN when unreadable. `qualifyingNamings` states what each direction
         does: an unreadable FILING date never flags, an unreadable UPDATED one
         still can. */
      touched: typeof row.updatedAt === "string" ? Date.parse(row.updatedAt) : Number.NaN,
      /* `gh` returns labels as `[{ id, name, description, color }]`. A row whose
         labels are unreadable yields an EMPTY list, which makes the card
         OFFERED — the safe direction here is the one that shows him a card,
         never the one that silently hides it from a count he is deciding on. */
      labels: Array.isArray(row.labels)
        ? row.labels
          .map((entry) => (typeof entry === "object" && entry !== null
            ? (entry as { name?: unknown }).name
            : undefined))
          .filter((name): name is string => typeof name === "string")
        : [],
    }));
    stamped.sort((left, right) => {
      const l = Number.isFinite(left.at) ? left.at : -Infinity;
      const r = Number.isFinite(right.at) ? right.at : -Infinity;
      return r - l;
    });
    /*
      ⚠ THE TRIPWIRE ON THE CROSS-EXAMINATION ITSELF (PR #729's review,
      finding 1). The guard above is only as good as the two reads agreeing on
      what a label is CALLED: `gh issue list --label` matches case-insensitively
      on GitHub's side, while `population.get(label)` is an exact-string lookup
      against the canonical name the API returns. A rename, or a re-creation
      with different casing, would leave the per-label read working and the
      population lookup answering 0 — so a blip zero on that category would be
      believed again, with every arm here still green. Invariant 7's shape
      exactly: invoked, and inert by configuration.

      It WARNS and never refuses, because there is one benign way to see this.

      ⚠ **AND THE BENIGN WAY IS TOLD APART RATHER THAN TOLERATED**, which is
      the difference between a tripwire and a line people learn to ignore. The
      whole-queue read happens first, so a card filed DURING the run reaches the
      per-label read and not the population — and a shift filing cards while its
      own count runs is ordinary. Those rows are exactly the ones created after
      that read, and they carry their own `createdAt`. Only a row PREDATING the
      population read is unexplainable by skew, and only those are named.
    */
    if (population !== null && (population.get(label) ?? 0) === 0) {
      const predating = stamped.filter((row) => Number.isFinite(row.at) && row.at < populationReadAt);
      if (predating.length > 0) {
        warn(
          `⚠ VOCABULARY DRIFT on \`${label}\`: the per-label read found ${predating.length} card(s) filed BEFORE`
          + " this run's whole-queue read, and that read knows of none carrying the label. `gh` matches a label"
          + " case-insensitively and the cross-examination matches it exactly, so a rename or a re-casing would"
          + " disarm the #725 zero guard for this category silently. The count is written; the guard is not"
          + " trustworthy for it until the label names agree.",
        );
      }
    }

    const titlesOf = (list: typeof stamped): CrewQueueTitle[] => list
      .slice(0, QUEUE_TITLES_PER_CATEGORY)
      .map((row) => ({ number: row.number, title: row.title }));

    /* THE PARTITION (#324). First match wins and the vocabulary owns the order,
       so a card carrying both labels is counted ONCE — exclusions that summed
       to more than the cards they came from would be arithmetic his panel
       printed and nobody could reproduce. */
    const offeredRows: typeof stamped = [];
    const exclusions: Record<string, number> = {};
    for (const row of stamped) {
      const reason = exclusionFor(row.labels);
      if (reason === null) offeredRows.push(row);
      else exclusions[reason] = (exclusions[reason] ?? 0) + 1;
    }
    /* ⚠ THE FLAG IS TAKEN OVER THE **OFFERED** ROWS ONLY (#494). A card he has
       already queued, or one parked on his ruling, is not on offer at all — and
       telling him a card he cannot be given might already be done is noise
       about a number it is not in. The flag annotates the offer; the exclusions
       describe what left it. */
    const possiblyDone: Array<{ card: number; title: string; prs: number[] }> = [];
    const outOfReach: Array<{ card: number; title: string }> = [];
    if (namings !== null) {
      for (const row of offeredRows) {
        /* #507: on a truncated read the reader does not know what it is
           missing, and saying nothing about a card is the same output as
           "nothing found". Every offered card is named instead. */
        if (judgementIsBlind(namings.truncated)) {
          outOfReach.push({ card: row.number, title: row.title });
          continue;
        }
        /* ⚠ THE FLAG AND ITS RECEIPT COME FROM ONE CALL. This filtered inline
           with its own copy of the rule's two comparisons until the reviewer
           caught it (PR #498, finding 1) — a second list one line from its
           source, whose drift would empty the log line a shift acts on while
           the flag itself kept working. Only the pull requests that actually
           satisfied the rule are named: #8 is mentioned by ten and answered by
           none of them. */
        const qualifying = qualifyingNamings(row.at, row.touched, namings.index.get(row.number) ?? []);
        if (qualifying.length === 0) continue;
        possiblyDone.push({
          card: row.number,
          title: row.title,
          prs: qualifying.map((entry) => entry.pr),
        });
      }
    }
    return {
      total: rows.length,
      allTitles: titlesOf(stamped),
      offered: offeredRows.length,
      offeredTitles: titlesOf(offeredRows),
      exclusions: exclusions as CrewQueueExclusions,
      possiblyDone,
      outOfReach,
    };
  } catch (cause) {
    warn(`[warn] could not count \`${label}\`: ${(cause as Error).message}`);
    return null;
  }
}

/**
 * THE WHOLE OPEN QUEUE, READ ONCE AND FILED INTO GROUPS (#325).
 *
 * ⚠ **`null` ON ANY DOUBT, EXACTLY AS `countOpen` DOES.** A broken `gh` that
 * returned an empty list here would write TWELVE zeros — his page would read
 * *"nothing in the pipeline at all"*, which is the most reassuring and most
 * wrong sentence this panel could ever print. A null leaves every group row
 * standing with its older `countedAt`, and the page shows the age.
 *
 * The 500 cap is checked rather than assumed, for `countOpen`'s stated reason:
 * a `--limit` shorter than the real population turns a count into a floor
 * silently. At 100 open today there is room, and the day there is not, this
 * refuses instead of quietly capping his pipeline at 500.
 *
 * ⚠ **AND THE PARAGRAPH ABOVE DESCRIBED A GUARD THIS FUNCTION DID NOT HAVE
 * (#725's law-7 sibling, found in its own sweep).** *"A broken `gh` that
 * returned an empty list here would write TWELVE zeros"* is exactly right about
 * the stake and was wrong about the protection: `!Array.isArray(rows)` catches
 * a broken SHAPE, and an empty array is a perfectly good array. The most
 * reassuring and most wrong sentence this panel could print was one blip away,
 * in the function whose docblock names it.
 *
 * `queueIsKnownNonEmpty` is the corroboration, and it is free — the oldest open
 * card was already read at the top of this run, for the merged-PR window. If a
 * card exists, a whole queue reading empty is provably wrong.
 *
 * ⚠ **ITS LIMIT, STATED RATHER THAN DISCOVERED: A GENUINELY EMPTY QUEUE ALSO
 * REFUSES.** `readOldestOpenCardFiling` returns `null` both when it fails and
 * when there is nothing to find, so it cannot corroborate emptiness — only
 * non-emptiness. The trade is deliberate: the cost of refusing is that his
 * pipeline rows keep their last numbers with an honest age on them, ended by
 * the first card anybody files; the cost of believing is a page that says the
 * whole queue is empty on the strength of one bad response.
 */
function countPipelineGroups(gh: QueueGhReader, warn: (line: string) => void, queueIsKnownNonEmpty: boolean): {
  total: number;
  byGroup: Map<string, Array<{ number: number; title: string }>>;
  labelPopulation: ReadonlyMap<string, number>;
} | null {
  try {
    const out = gh(["issue", "list", "--state", "open", "--limit", "500", "--json", "number,title,createdAt,labels"]);
    const rows = JSON.parse(out);
    if (!Array.isArray(rows)) return null;
    if (rows.length >= 500) {
      warn("REFUSING the pipeline groups: 500 rows came back, which is the limit — the total would be a floor, not a total.");
      return null;
    }
    if (rows.length === 0) {
      warn(
        "REFUSING the pipeline groups: the whole open queue read back empty, which would write a zero into every"
        + (queueIsKnownNonEmpty
          ? " group — and this run's own oldest-open-card read found a card, so it is provably wrong (#725)."
          : " group. Nothing this run read can corroborate an empty queue, and `nothing in the pipeline at all`"
            + " is too reassuring a sentence to print on one unconfirmed response (#725)."),
      );
      return null;
    }
    /* Most recent first, sorted here rather than trusted — `countOpen`'s reason,
       and the titles under each group are the five he has not seen. */
    const stamped = rows.map((row: { number?: unknown; title?: unknown; createdAt?: unknown; labels?: unknown }) => ({
      number: typeof row.number === "number" ? row.number : 0,
      title: typeof row.title === "string" ? row.title : "",
      at: typeof row.createdAt === "string" ? Date.parse(row.createdAt) : Number.NaN,
      /* A row whose labels are unreadable yields an EMPTY list, which files it
         under `unfiled` — visible, and asking to be looked at. The safe
         direction is the one that shows him a card. */
      labels: Array.isArray(row.labels)
        ? row.labels
          .map((entry) => (typeof entry === "object" && entry !== null ? (entry as { name?: unknown }).name : undefined))
          .filter((name): name is string => typeof name === "string")
        : [],
    }));
    stamped.sort((left, right) => {
      const l = Number.isFinite(left.at) ? left.at : -Infinity;
      const r = Number.isFinite(right.at) ? right.at : -Infinity;
      return r - l;
    });
    const byGroup = new Map<string, Array<{ number: number; title: string }>>();
    for (const group of CREW_PIPELINE_GROUPS) byGroup.set(group.key, []);
    for (const row of stamped) {
      const key = pipelineGroupFor(row.labels);
      /* `pipelineGroupFor` is total by construction, so this cannot miss — but
         a group renamed here and not there would drop cards on the floor, and a
         dropped card is precisely what this card exists to end. */
      const bucket = byGroup.get(key);
      if (!bucket) {
        warn(`REFUSING: a card was filed under \`${key}\`, which is not a declared group. The vocabularies have drifted.`);
        return null;
      }
      bucket.push({ number: row.number, title: row.title });
    }
    /*
      ⚠ THE SAME ROWS, COUNTED A SECOND WAY — AND THAT IS THE POINT (#725).

      The groups above partition the queue; this counts how many open cards
      carry each individual LABEL, which the groups cannot answer because a card
      belongs to exactly one group and may carry several labels. It is the
      evidence `countOpen` needs to disprove a zero, and it costs nothing: it is
      derived from the population this function has already read, in the same
      response, at the same moment. Asking `gh` a second time would produce a
      second reading of a different instant, which is the shape that cannot
      settle a disagreement between two readings.
    */
    const labelPopulation = new Map<string, number>();
    for (const row of stamped) {
      for (const name of row.labels) labelPopulation.set(name, (labelPopulation.get(name) ?? 0) + 1);
    }
    return { total: stamped.length, byGroup, labelPopulation };
  } catch (cause) {
    warn(`[warn] could not read the open queue for the pipeline groups: ${(cause as Error).message}`);
    return null;
  }
}

/**
 * WHAT A RUN OF THE COUNTER CAME BACK WITH.
 *
 * A refusal is a VALUE, not an exit and not a throw: the close's whole reason
 * for existing is to terminate a row, and it must be able to report that the
 * count refused while still doing that.
 */
/**
 * WHERE THE READING NARRATES ITSELF.
 *
 * It defaults to the console, which is what the command-line front door wants
 * and what every shift has read at 3am. It is a parameter because this function
 * now has callers that are not a terminal: a suite driving thirteen arms
 * through it would otherwise print the whole panel thirteen times into a gate
 * log, and a caller that wants the reading without the narration has no way to
 * ask.
 */
export type QueueCountLog = {
  readonly log?: (line: string) => void;
  readonly warn?: (line: string) => void;
};

export type QueueCountOutcome =
  | { readonly ok: true; readonly written: number; readonly skipped: number; readonly stored: number }
  | { readonly ok: false; readonly reason: string };

/**
 * TAKE THE READING AND WRITE IT.
 *
 * The connection is the CALLER'S - this function neither opens nor closes it,
 * so a caller that is in the middle of its own transaction-shaped work (the
 * shift close, which has just terminated a row) keeps its own control of the
 * thing it opened.
 *
 * It may still THROW on a genuine database fault, which is deliberate: the
 * standalone script wants that to be a red exit. The shift close catches it
 * (see `scripts/crew-shift-close.mts`) because there it must never be one.
 */
export async function refreshQueueCounts(
  conn: QueueCountConnection,
  gh: QueueGhReader = REAL_GH,
  { log = console.log, warn = console.error }: QueueCountLog = {},
): Promise<QueueCountOutcome> {
  /* Working law 2 — the existence reader gets a control before its negative counts. */
  const [control] = await conn.query<any[]>("SHOW TABLES LIKE 'users'");
  if (control.length !== 1) {
    return { ok: false, reason: "the existence reader cannot see `users` — wrong database, or a reader that cannot say yes." };
  }
  const [present] = await conn.query<any[]>(`SHOW TABLES LIKE '${TABLE}'`);
  if (present.length !== 1) {
    return {
      ok: false,
      reason:
        `\`${TABLE}\` does not exist in this world. It is migration 0056 and production takes it by`
        + " `scripts/ceremony-crew-work-switches.mts`, which the DEPLOY RITE now applies itself (#322).",
    };
  }

  /*
    ⚠ IS THE TITLES COLUMN HERE? Migration 0057, and production takes it by
    `scripts/ceremony-crew-queue-count-titles.mts`, which the DEPLOY RITE now applies itself (#322) — so
    this script runs at every shift start in the window before that command. A
    write naming a column the table does not have fails the whole INSERT, which
    would leave his panel UNCOUNTED because a feature it cannot see is not
    installed. Asked rather than caught: a writer should know which statement it
    is about to run, not discover it from an error.
  */
  const [titleColumn] = await conn.query<any[]>(`SHOW COLUMNS FROM \`${TABLE}\` LIKE '${TITLES_COLUMN}'`);
  const keepsTitles = titleColumn.length === 1;
  if (!keepsTitles) {
    log(
      `  (no \`${TITLES_COLUMN}\` column here — counting only. It is migration 0057 and production takes it by`
      + " `scripts/ceremony-crew-queue-count-titles.mts`, or the next deploy rite, which applies additive migrations itself since #322.)",
    );
  }

  /*
    ⚠ AND IS THE EXCLUSIONS COLUMN HERE? Migration 0058 (#324), same shape and
    the same ceremony, which the deploy rite now runs itself (#322).

    ⚠ **THIS ANSWER DECIDES WHAT `openCount` MEANS, WHICH IS WHY IT IS ASKED
    RATHER THAN ASSUMED.** With the column, the stored count is the OFFERED one
    and this row says what was taken out of it. Without it, the stored count is
    the TOTAL — exactly what this script has always written.

    The one thing that must never happen is the half state: writing the offered
    count where the reasons cannot be stored. His card names it — *"a count that
    silently shrinks for an invisible reason is the confident-wrong-number
    failure this panel already exists to avoid"* — and it would look, on his
    page, like bugs quietly going away.
  */
  const [excludedColumn] = await conn.query<any[]>(`SHOW COLUMNS FROM \`${TABLE}\` LIKE '${EXCLUDED_COLUMN}'`);
  const keepsExclusions = excludedColumn.length === 1;
  if (!keepsExclusions) {
    log(
      `  (no \`${EXCLUDED_COLUMN}\` column here — storing TOTALS, as before. It is migration 0058 and production`
      + " takes it by `scripts/ceremony-crew-queue-count-exclusions.mts`, or the next deploy rite, which applies additive migrations itself since #322.)",
    );
  }

  /*
    ⚠ AND IS THE POSSIBLY-FIXED COLUMN HERE? Migration 0061 (#494). Unlike 0057
    and 0058 there is no founder ceremony behind it — since #322 the deploy rite
    applies an additive migration itself — but a shift may still be running
    against a DEV database the rite has never touched, so the same question is
    asked rather than assumed.

    ⚠ **AND ITS ABSENCE CHANGES NOTHING ELSE, WHICH IS WHY IT IS NOT
    ALL-OR-NOTHING THE WAY `excluded` IS.** The exclusions column decides what
    `openCount` MEANS, so writing the offered count without it would make a
    number shrink for a reason the page cannot show. This column subtracts
    nothing: without it the count and the titles are byte-identical to today's
    and the flag is simply not stored. The reading is still taken and still
    printed in the log below, because a shift reading this at 3am wants the
    list whatever the schema can hold.
  */
  const [possiblyDoneColumn] = await conn.query<any[]>(`SHOW COLUMNS FROM \`${TABLE}\` LIKE '${POSSIBLY_DONE_COLUMN}'`);
  const keepsPossiblyDone = possiblyDoneColumn.length === 1;
  if (!keepsPossiblyDone) {
    log(
      `  (no \`${POSSIBLY_DONE_COLUMN}\` column here — the possibly-fixed flag is read and printed but not stored.`
      + " It is migration 0061 and the deploy rite applies it itself (#322).)",
    );
  }

  /*
    THE MERGED PULL REQUESTS, READ ONCE FOR EVERY CATEGORY (#494) — see
    `readCardNamings`. A `null` here means every category is written UNFLAGGED,
    which is the honest degradation: this reading is a floor even when it works.
  */
  const oldestOpen = readOldestOpenCardFiling(gh);
  if (oldestOpen === null) {
    log("  (the oldest open card's date could not be read — the merged-PR window falls back to the whole history.)");
  }
  const namings = readCardNamings(oldestOpen, gh, warn);
  if (namings === null) {
    log("  ⚠ the possibly-fixed reading could not be taken this run — every category is written unflagged.");
  }

  /*
    ⚠ THE WHOLE-QUEUE READ IS TAKEN HERE, BEFORE THE CATEGORIES, AND ITS ROWS
    ARE WRITTEN LATER (#725). It moved up rather than being read twice: it is
    the evidence a category's zero is cross-examined against, and two reads
    would be two different instants — which cannot settle a disagreement, only
    describe one.

    ⚠ It is read FIRST on purpose, so the only skew it can produce is a card
    closing between the two reads: the category then legitimately says zero
    while this population still holds it, and the zero is refused. That costs a
    number one run older with an honest age. The other order would let a card
    OPENED between the reads make a stale zero look confirmed, which is the
    failure this is about.
  */
  /* The instant the population describes — the tripwire in `countOpen` tells a
     label rename apart from a card filed while this very run was reading. */
  const populationReadAt = Date.now();
  const pipeline = countPipelineGroups(gh, warn, oldestOpen !== null);

  let written = 0;
  let skipped = 0;
  for (const category of CREW_WORK_CATEGORIES) {
    const reading = countOpen(category.queueLabel, namings, gh, warn, pipeline?.labelPopulation ?? null, populationReadAt);
    if (reading === null) {
      skipped += 1;
      log(`  ${category.label.padEnd(14)} SKIPPED — the old row stands, with its older timestamp`);
      continue;
    }
    /* ⚠ WHICH READING IS STORED, decided once, here, by what the table can
       hold. Count and titles move TOGETHER: naming five cards he cannot pick
       up, under a number that excludes them, would be a list disagreeing with
       its own total. */
    const storedCount = keepsExclusions ? reading.offered : reading.total;
    const storedTitles = keepsExclusions ? reading.offeredTitles : reading.allTitles;

    /* Upsert on the UNIQUE `categoryKey`, so the store can never hold two
       answers for one category and the count cannot depend on row order.

       ⚠ The titles and the exclusions ride the SAME statement as the count,
       which is what makes "they share one `countedAt`" a property of the schema
       rather than of three writes all happening to succeed. */
    /* ⚠ THE STATEMENT IS BUILT FROM THE COLUMNS THAT EXIST, not chosen from a
       list of hand-written variants. Three optional columns are eight variants,
       and a fourth would be sixteen — a combinatorial second list of exactly
       the kind working law 4 is about, where the ONE that goes wrong is the
       rare combination nobody drives. Column names here are module constants
       and never input; every value is still a placeholder. */
    const optional: Array<{ column: string; value: string }> = [];
    if (keepsTitles) optional.push({ column: TITLES_COLUMN, value: serializeQueueTitles(storedTitles) });
    if (keepsExclusions) optional.push({ column: EXCLUDED_COLUMN, value: serializeQueueExclusions(reading.exclusions) });
    if (keepsPossiblyDone) {
      optional.push({ column: POSSIBLY_DONE_COLUMN, value: serializePossiblyDone(reading.possiblyDone.map((row) => row.card)) });
    }
    const columns = ["categoryKey", "openCount", ...optional.map((entry) => entry.column)];
    await conn.query(
      `INSERT INTO \`${TABLE}\` (${columns.map((name) => `\`${name}\``).join(", ")}, countedAt)
       VALUES (${columns.map(() => "?").join(", ")}, UTC_TIMESTAMP())
       ON DUPLICATE KEY UPDATE `
      + [...columns.slice(1), "countedAt"].map((name) => `\`${name}\` = VALUES(\`${name}\`)`).join(", "),
      [category.key, storedCount, ...optional.map((entry) => entry.value)],
    );
    written += 1;
    /* The excluded cards are named in the LOG whether or not the column can
       hold them: a shift reading this at 3am should see what it did not offer
       him even in the window before the ceremony runs. */
    const sentence = queueExclusionSentence(reading.exclusions);
    const flagged = reading.possiblyDone.length;
    log(
      `  ${category.label.padEnd(14)} ${String(storedCount).padStart(3)} open  (label \`${category.queueLabel}\`)`
      + (sentence ? ` · ${sentence}${keepsExclusions ? "" : ", NOT stored — no column yet"}` : "")
      + (flagged > 0 ? ` · ${flagged} possibly fixed${keepsPossiblyDone ? "" : ", NOT stored — no column yet"}` : ""),
    );
    for (const card of storedTitles) log(`      #${card.number} ${card.title}`);
    /* ⚠ EVERY FLAGGED CARD IS NAMED IN THE LOG, uncapped and with its receipt —
       this is where the SHIFT reads, and the standing order is that a
       background card is re-read at the code before it is taken. The column
       stores a capped sample for his panel; the shift gets the whole list and
       the pull request to open first. */
    for (const row of reading.possiblyDone) {
      log(`      ⚠ #${row.card} may already be done — named by merged PR ${row.prs.map((pr) => `#${pr}`).join(", ")} · ${row.title}`);
    }
    /* #507: named, so a horizon can never look like a clean reading. */
    for (const row of reading.outOfReach) {
      log(`      ? #${row.card} OUT OF REACH — the merged-PR read was truncated, not judged · ${row.title}`);
    }
  }

  /*
    ⚠ ZONE 2 — THE REST OF THE PIPELINE (#325).

    His question: *"all those other ones should be put them under additional
    categories so i can see the full pipeline like all 97?"* Measured the hour
    this shipped: 100 open, 29 reached by a switch label, **71 reached by
    nothing** — invisible on the panel he looks at from bed, with no way to ask
    why.

    ⚠ **ONE `gh` CALL FOR ALL OF THEM, AND THAT IS NOT AN OPTIMISATION — IT IS
    THE ONLY WAY THE PARTITION CAN EXIST.** The switch categories above are
    counted with one call each, per label, and they may legitimately overlap (a
    card carrying `bug` and `seat:retro` is in both). The groups must NOT
    overlap: his bar is *"the counts sum to the real total"*, and thirteen
    independent per-label calls could not produce a sum, only thirteen
    populations that add up to more than the queue. So the whole open queue is
    read once and `pipelineGroupFor` files each card exactly once.

    A group whose count is zero is still written — `Blocked (0)` is a real
    answer, and the panel's own rule since #277 is that a row must never vanish
    or he cannot tell "nothing there" from "not offered".
  */
  if (pipeline === null) {
    skipped += CREW_PIPELINE_GROUPS.length;
    log("\n  PIPELINE GROUPS SKIPPED — the old rows stand, with their older timestamps");
  } else {
    log(`\n  the rest of the pipeline — ${pipeline.total} open in total, filed into ${CREW_PIPELINE_GROUPS.length} groups:`);
    for (const group of CREW_PIPELINE_GROUPS) {
      const filed = pipeline.byGroup.get(group.key) ?? [];
      const titles = filed.slice(0, QUEUE_TITLES_PER_CATEGORY).map((row) => ({ number: row.number, title: row.title }));
      const rowKey = pipelineGroupRowKey(group.key);
      /* Same upsert, same table, same `countedAt` — the prefix is the whole
         separation, and the projection filters each side to its own vocabulary
         so neither can read the other's rows as its own.

         `excluded` and `possiblyDone` are deliberately NOT named here even where
         the columns exist. The exclusions are a fact about a SWITCH count (what
         was taken out of something on offer) and the possibly-fixed flag is a
         fact about the cards inside one; a group is not on offer at all, so
         both are meaningless of it. Leaving them null is the honest value —
         writing an empty flag list would be a claim that nothing in the group
         is stale, over a population this reading was never taken on. */
      if (keepsTitles) {
        await conn.query(
          `INSERT INTO \`${TABLE}\` (categoryKey, openCount, ${TITLES_COLUMN}, countedAt)
           VALUES (?, ?, ?, UTC_TIMESTAMP())
           ON DUPLICATE KEY UPDATE openCount = VALUES(openCount), ${TITLES_COLUMN} = VALUES(${TITLES_COLUMN}), countedAt = VALUES(countedAt)`,
          [rowKey, filed.length, serializeQueueTitles(titles)],
        );
      } else {
        await conn.query(
          `INSERT INTO \`${TABLE}\` (categoryKey, openCount, countedAt)
           VALUES (?, ?, UTC_TIMESTAMP())
           ON DUPLICATE KEY UPDATE openCount = VALUES(openCount), countedAt = VALUES(countedAt)`,
          [rowKey, filed.length],
        );
      }
      written += 1;
      log(
        `  ${group.label.padEnd(16)} ${String(filed.length).padStart(3)} open`
        + (group.queueLabel ? `  (label \`${group.queueLabel}\`)` : ""),
      );
    }
    /* ⚠ THE SUM IS ASSERTED HERE, NOT ONLY ON HIS PAGE. A partition that stops
       partitioning is a silent wrong number — the panel would still draw twelve
       tidy rows. This is the writer's own control, on the population it just
       filed, and it costs one addition. */
    let sum = 0;
    for (const group of CREW_PIPELINE_GROUPS) sum += (pipeline.byGroup.get(group.key) ?? []).length;
    if (sum !== pipeline.total) {
      return {
        ok: false,
        reason:
          `the groups sum to ${sum} and the queue holds ${pipeline.total}.`
          + " The rows are written; the arithmetic is not trustworthy and must be fixed before his page is believed.",
      };
    }
    log(`  ${"".padEnd(16)} ${String(sum).padStart(3)} — sums to the queue's own total ✓`);
  }

  /* Read back rather than trusted (working law 1 — the changed rows are the fact). */
  const [rows] = await conn.query<any[]>(
    `SELECT categoryKey, openCount, ${keepsTitles ? `${TITLES_COLUMN}, ` : ""}`
    + `${keepsExclusions ? `${EXCLUDED_COLUMN}, ` : ""}${keepsPossiblyDone ? `${POSSIBLY_DONE_COLUMN}, ` : ""}`
    + `countedAt FROM \`${TABLE}\` ORDER BY categoryKey`,
  );
  log(`\nstored ${rows.length} row(s) · ${written} written, ${skipped} skipped this run`);
  for (const row of rows) {
    /* Read back through the PARSERS his page uses, never through this script's
       own idea of the shape — a value that writes and reads fine here and
       yields nothing on the panel is exactly the failure being avoided. */
    const named = keepsTitles ? parseQueueTitles(row[TITLES_COLUMN]).length : 0;
    const back = keepsExclusions ? queueExclusionSentence(parseQueueExclusions(row[EXCLUDED_COLUMN])) : null;
    const stale = keepsPossiblyDone ? possiblyDoneSentence(parsePossiblyDone(row[POSSIBLY_DONE_COLUMN])) : null;
    log(
      `  ${String(row.categoryKey).padEnd(14)} ${String(row.openCount).padStart(3)}`
      + `${keepsTitles ? ` · ${named} named` : ""}${back ? ` · ${back}` : ""}${stale ? ` · ${stale}` : ""}`
      + ` · ${iso(row.countedAt)}`,
    );
  }
  if (skipped > 0) {
    log("\n⚠ A skipped category keeps its previous number and its previous timestamp. The page shows the age.");
  }

  return { ok: true, written, skipped, stored: rows.length };
}


/**
 * THE SAME READING, ON A PATH THAT MUST NOT FAIL (#618).
 *
 * ⚠ **THIS EXISTS SO THAT THE SAFETY PROPERTY IS A DRIVEN UNIT RATHER THAN A
 * SENTENCE IN A COMMENT.** The shift close's whole job is to terminate a run
 * row; a close that dies leaves that row open and his page renders it as a
 * shift still running (#288's incident). Refreshing his numbers is a nicety
 * beside that, so it must be structurally incapable of costing the close its
 * exit - and "structurally" has to mean something a suite can redden, not a
 * `try` a later edit can quietly move.
 *
 * So the try/catch lives HERE, in one named function with arms on it
 * (`server/crewCloseCounts.test.ts`), instead of being copied into every caller
 * that wants the reading without the risk. This function RESOLVES on every
 * road: success, a returned refusal, and a connection that throws.
 *
 * It reports through the caller's own channel rather than printing directly, so
 * a caller can put the reason where its operator is already looking.
 */
export async function refreshQueueCountsQuietly(
  conn: QueueCountConnection,
  report: (line: string) => void,
  gh: QueueGhReader = REAL_GH,
  sink: QueueCountLog = {},
): Promise<QueueCountOutcome> {
  const kept = "  his panel keeps its previous numbers and their older timestamps. The close is unaffected.";
  try {
    const outcome = await refreshQueueCounts(conn, gh, sink);
    if (!outcome.ok) {
      report(`  the count REFUSED: ${outcome.reason}`);
      report(kept);
    }
    return outcome;
  } catch (cause) {
    /* ⚠ EVERY throw, not a chosen family. A database fault, a `gh` that is not
       there, a driver error nobody has seen yet - none of them may reach the
       caller, because the caller is the close. The reason is always REPORTED,
       so a swallowed failure is still a visible one. */
    const reason = cause instanceof Error ? cause.message : String(cause);
    report(`  the count FAILED: ${reason}`);
    report(kept);
    return { ok: false, reason };
  }
}
