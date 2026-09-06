/**
 * COUNT THE QUEUE — the numbers under his background-work switches (issue #277).
 *
 * Run at shift start, beside the switch read:
 *
 *   railway.cmd run --service MySQL -- npx tsx scripts/crew-count-queue.mts
 *
 * # WHAT IT COUNTS, AND WHY THERE IS NO LIST HERE
 *
 * ⚠ **AND SINCE #324 IT IS HOW MANY ARE ON OFFER, NOT HOW MANY EXIST.** He
 * asked at the live panel: *"how do we know they are not already scheduled to
 * be fixed in current pipeline or work?"* — and two of his thirteen bugs were
 * `founder-ordered` cards already sitting in NEXT UP, offered a second time as
 * background work a shift may take on its own judgement. A card he has queued,
 * or one parked on his own ruling, is subtracted and **named** in the same row
 * (`shared/crewQueueExclusions.ts`), so the panel reads *Bugs (11, 2 already
 * queued)* rather than a number that quietly got smaller.
 *
 * One number per category: **how many OPEN cards carry that category's label**.
 * The labels are `shared/crewWorkSwitches.ts`'s `queueLabel`, and **not one of
 * them was invented for this feature** — `bug`, `seat:warden`,
 * `seat:machinist`, `seat:janitor` and `seat:retro` were already in use by the
 * seats. His card says it in capitals: *the counts and the categories are
 * derived from the queue's own labels, never a second list*, so **a card
 * relabelled in GitHub moves category on his page without anyone touching the
 * panel.**
 *
 * # ⚠ WHY THE COUNT IS CACHED RATHER THAN LIVE, SAID OUT LOUD
 *
 * A truly live count means the SERVER calling the GitHub API, which means a
 * repo-scoped token as a production environment variable — a credential that
 * can read this private repository, living in the app's environment, plus an
 * outbound dependency on his admin page. **That is a founder-level decision
 * about a credential, not a shift's**, so it is named as the upgrade rather
 * than taken.
 *
 * What lands instead is a DERIVED CACHE with its own timestamp: nobody types
 * these numbers, and `countedAt` rides every row so the panel says **"counted
 * 14 min ago"** rather than implying an instant it does not have. That is the
 * difference between this and the lists that rotted — the
 * standing-exceptions ranking went stale because a PERSON typed it.
 *
 * # THE TITLES BESIDE THE NUMBER (#285)
 *
 * Founder, at the live panel: *"am i suppose to see a list under these
 * categories?"* Up to five card titles ride each row, most recent first, and
 * **they cost nothing extra to produce** — this script already has the cards in
 * hand when it counts them, so the titles come out of the SAME `gh` response
 * and land in the SAME statement. That is what makes his card's bar — *the
 * count and the titles share one `countedAt`* — hold by construction rather
 * than by two writes agreeing.
 *
 * ⚠ **AND IT STILL WRITES THE COUNT WHERE THE COLUMN DOES NOT EXIST.** The
 * column is migration 0057 and production takes it by ceremony, which is a
 * founder act; between the deploy and that command this script runs at every
 * shift start against a table without it. So it asks `SHOW COLUMNS` first and
 * falls back to the count-only INSERT — a shift must never leave his panel
 * uncounted because a feature it cannot see is not installed yet.
 *
 * # THE CARDS THAT MAY ALREADY BE DONE (#494)
 *
 * His question at the live panel: *"does the agent know when a bug or any other
 * category item has already been fixed etc? i dont want want it trying to fix an
 * irrelevant bug"* — and the 2 September triage had already found five cards
 * whose fix landed and whose card nobody closed. So beside each count this now
 * reads **which offered cards a merged pull request named and nobody answered**,
 * writes them into the same row, and — the part that matters at 3am — NAMES
 * every one of them in the log with the pull request to open first.
 *
 * ⚠ **IT FLAGS AND NEVER SUBTRACTS.** A flagged card is still inside
 * `openCount`; the panel reads `Bugs (14, 2 already queued, 2 possibly fixed)`,
 * where the queued two are OUT of the fourteen and the flagged two are two OF
 * them. His card: *"No card closes from this instrument."*
 *
 * ⚠ **AND IT IS A FLOOR, NOT COVERAGE** — `shared/crewQueuePossiblyDone.ts`
 * states the limits it was measured against: two of those five cards are named
 * by no merged pull request at all. A category with no flags means this reading
 * found nothing, never that nothing is stale. The re-read-before-take standing
 * order is the control; this says which to re-read FIRST.
 *
 * # ⚠ THIS IS A WRITER, AND IT IS THE ONLY TABLE IT MAY NAME
 *
 * `crew_queue_counts` and nothing else; no DDL, no DELETE. In particular it may
 * never touch `crew_work_switches` — those are HIS rows, and a shift that could
 * write them could switch its own permission on.
 * `server/crewShiftWriterBoundary.test.ts` pins that at the source, with a
 * positive control.
 */
import { execFileSync } from "node:child_process";

import {
  CREW_PIPELINE_GROUPS,
  pipelineGroupFor,
  pipelineGroupRowKey,
} from "../shared/crewPipelineGroups.js";
import {
  exclusionFor,
  parseQueueExclusions,
  queueExclusionSentence,
  serializeQueueExclusions,
  type CrewQueueExclusions,
} from "../shared/crewQueueExclusions.js";
import {
  cardNumbersIn,
  parsePossiblyDone,
  possiblyDoneSentence,
  qualifyingNamings,
  serializePossiblyDone,
  type CardNaming,
} from "../shared/crewQueuePossiblyDone.js";
import {
  QUEUE_TITLES_PER_CATEGORY,
  parseQueueTitles,
  serializeQueueTitles,
  type CrewQueueTitle,
} from "../shared/crewQueueTitles.js";
import { CREW_WORK_CATEGORIES } from "../shared/crewWorkSwitches.js";
import { openDatabase, resolveDatabaseUrl, worldOf } from "./lib/dbConnection.mts";

import { isOutOfNamingReach, mergedPullRequestArgs } from "./lib/crewNamingWindow.mts";

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
const MERGED_PR_PAGE_BOUND = 1000;

/** WHICH WORLD, named plainly — see `crew-shift-start.mts`'s note. */
function whichWorld(): "PRODUCTION" | "DEV" {
  return process.env.MYSQL_PUBLIC_URL ? "PRODUCTION" : "DEV";
}

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
function readOldestOpenCardFiling(): { number: number; date: string } | null {
  try {
    const out = execFileSync(
      "gh",
      ["issue", "list", "--state", "open", "--limit", "1", "--search", "sort:created-asc", "--json", "number,createdAt"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
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
 * `horizonAt` is null when the whole derived window came back — the ordinary
 * case, and it means every open card can be judged. When the page bound is hit
 * it is the oldest `mergedAt` the reader actually holds, and a card filed
 * before it is OUT OF REACH rather than unflagged (#507's bar).
 */
type CardNamingIndex = {
  readonly index: Map<number, CardNaming[]>;
  readonly horizonAt: number | null;
};

function readCardNamings(since: { number: number; date: string } | null): CardNamingIndex | null {
  try {
    const out = execFileSync(
      "gh",
      /* Built in `scripts/lib/crewNamingWindow.mts` so the wire this reading
         depends on has arms of its own — nothing here can be driven from a
         suite without opening a database and calling GitHub. */
      mergedPullRequestArgs(since, MERGED_PR_PAGE_BOUND),
      /* Bodies are large and the default 1MB pipe buffer truncates them into a
         JSON parse error — which would read here as "no pull request names any
         card", the silent-zero failure. Raised, and the parse below throws
         rather than degrading if it is ever exceeded again. */
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 * 1024 * 1024 },
    );
    const rows = JSON.parse(out);
    if (!Array.isArray(rows)) return null;
    /* ⚠ THE PAGE BOUND IS A HORIZON NOW, NOT A REFUSAL (#507). The old code
       returned null here, which wrote every category UNFLAGGED — and an
       unflagged category is the sentence *"nothing is ever stale"*, which is
       the answer this instrument exists to stop the panel giving. Reporting how
       far back the reader can see keeps every card inside that reach judged and
       names the ones outside it. */
    let horizonAt: number | null = null;
    if (rows.length >= MERGED_PR_PAGE_BOUND) {
      const oldest = Math.min(
        ...(rows as Array<{ mergedAt?: unknown }>)
          .map((row) => (typeof row.mergedAt === "string" ? Date.parse(row.mergedAt) : Number.NaN))
          .filter((value) => Number.isFinite(value)),
      );
      horizonAt = Number.isFinite(oldest) ? oldest : null;
      console.error(
        `⚠ the possibly-fixed reading hit its page bound: ${MERGED_PR_PAGE_BOUND} merged pull requests came back`
        + (horizonAt === null
          ? " and none carried a readable merge date — every card is reported OUT OF REACH."
          : ` — it can see back to ${new Date(horizonAt).toISOString().slice(0, 10)}, and cards filed before that`
            + " are reported OUT OF REACH rather than unflagged."),
      );
      /* Not knowing the horizon is the one case that cannot be reported per
         card, so it refuses the whole reading exactly as before. */
      if (horizonAt === null) return null;
    }
    const index = new Map<number, CardNaming[]>();
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
      for (const card of cardNumbersIn(`${title}\n${body}`, pr)) {
        index.set(card, [...(index.get(card) ?? []), { pr, mergedAt }]);
      }
    }
    return { index, horizonAt };
  } catch (cause) {
    console.error(`[warn] could not read the merged pull requests: ${(cause as Error).message}`);
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
 */
function countOpen(label: string, namings: CardNamingIndex | null): CategoryReading | null {
  try {
    const out = execFileSync(
      "gh",
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
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
    const rows = JSON.parse(out);
    if (!Array.isArray(rows)) return null;
    if (rows.length >= 500) {
      console.error(`REFUSING ${label}: 500 rows came back, which is the limit — the count would be a floor, not a count.`);
      return null;
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
        /* #507: a card filed before the reader's horizon is UNJUDGED, and
           saying nothing about it is the same output as "nothing found". */
        if (isOutOfNamingReach(row.at, namings.horizonAt)) {
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
    console.error(`[warn] could not count \`${label}\`: ${(cause as Error).message}`);
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
 */
function countPipelineGroups(): {
  total: number;
  byGroup: Map<string, Array<{ number: number; title: string }>>;
} | null {
  try {
    const out = execFileSync(
      "gh",
      ["issue", "list", "--state", "open", "--limit", "500", "--json", "number,title,createdAt,labels"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
    const rows = JSON.parse(out);
    if (!Array.isArray(rows)) return null;
    if (rows.length >= 500) {
      console.error("REFUSING the pipeline groups: 500 rows came back, which is the limit — the total would be a floor, not a total.");
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
        console.error(`REFUSING: a card was filed under \`${key}\`, which is not a declared group. The vocabularies have drifted.`);
        return null;
      }
      bucket.push({ number: row.number, title: row.title });
    }
    return { total: stamped.length, byGroup };
  } catch (cause) {
    console.error(`[warn] could not read the open queue for the pipeline groups: ${(cause as Error).message}`);
    return null;
  }
}

await import("dotenv/config");
const url = resolveDatabaseUrl();
if (!url) {
  console.error("REFUSING: no database URL. Set DATABASE_URL in .env, or wrap in `railway.cmd run --service MySQL`.");
  process.exit(1);
}

const conn = await openDatabase(url);
console.log(`world: ${whichWorld()} · ${worldOf(url)}`);

try {
  /* Working law 2 — the existence reader gets a control before its negative counts. */
  const [control] = await conn.query<any[]>("SHOW TABLES LIKE 'users'");
  if (control.length !== 1) {
    console.error("REFUSING: the existence reader cannot see `users` — wrong database, or a reader that cannot say yes.");
    await conn.end();
    process.exit(1);
  }
  const [present] = await conn.query<any[]>(`SHOW TABLES LIKE '${TABLE}'`);
  if (present.length !== 1) {
    console.error(
      `REFUSING: \`${TABLE}\` does not exist in this world. It is migration 0056 and production takes it by`
      + " `scripts/ceremony-crew-work-switches.mts`, which the DEPLOY RITE now applies itself (#322).",
    );
    await conn.end();
    process.exit(1);
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
    console.log(
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
    console.log(
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
    console.log(
      `  (no \`${POSSIBLY_DONE_COLUMN}\` column here — the possibly-fixed flag is read and printed but not stored.`
      + " It is migration 0061 and the deploy rite applies it itself (#322).)",
    );
  }

  /*
    THE MERGED PULL REQUESTS, READ ONCE FOR EVERY CATEGORY (#494) — see
    `readCardNamings`. A `null` here means every category is written UNFLAGGED,
    which is the honest degradation: this reading is a floor even when it works.
  */
  const oldestOpen = readOldestOpenCardFiling();
  if (oldestOpen === null) {
    console.log("  (the oldest open card's date could not be read — the merged-PR window falls back to the whole history.)");
  }
  const namings = readCardNamings(oldestOpen);
  if (namings === null) {
    console.log("  ⚠ the possibly-fixed reading could not be taken this run — every category is written unflagged.");
  }

  let written = 0;
  let skipped = 0;
  for (const category of CREW_WORK_CATEGORIES) {
    const reading = countOpen(category.queueLabel, namings);
    if (reading === null) {
      skipped += 1;
      console.log(`  ${category.label.padEnd(14)} SKIPPED — the old row stands, with its older timestamp`);
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
    console.log(
      `  ${category.label.padEnd(14)} ${String(storedCount).padStart(3)} open  (label \`${category.queueLabel}\`)`
      + (sentence ? ` · ${sentence}${keepsExclusions ? "" : ", NOT stored — no column yet"}` : "")
      + (flagged > 0 ? ` · ${flagged} possibly fixed${keepsPossiblyDone ? "" : ", NOT stored — no column yet"}` : ""),
    );
    for (const card of storedTitles) console.log(`      #${card.number} ${card.title}`);
    /* ⚠ EVERY FLAGGED CARD IS NAMED IN THE LOG, uncapped and with its receipt —
       this is where the SHIFT reads, and the standing order is that a
       background card is re-read at the code before it is taken. The column
       stores a capped sample for his panel; the shift gets the whole list and
       the pull request to open first. */
    for (const row of reading.possiblyDone) {
      console.log(`      ⚠ #${row.card} may already be done — named by merged PR ${row.prs.map((pr) => `#${pr}`).join(", ")} · ${row.title}`);
    }
    /* #507: named, so a horizon can never look like a clean reading. */
    for (const row of reading.outOfReach) {
      console.log(`      ? #${row.card} OUT OF REACH — filed before the merged-PR horizon, not judged · ${row.title}`);
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
  const pipeline = countPipelineGroups();
  if (pipeline === null) {
    skipped += CREW_PIPELINE_GROUPS.length;
    console.log("\n  PIPELINE GROUPS SKIPPED — the old rows stand, with their older timestamps");
  } else {
    console.log(`\n  the rest of the pipeline — ${pipeline.total} open in total, filed into ${CREW_PIPELINE_GROUPS.length} groups:`);
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
      console.log(
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
      console.error(
        `REFUSING to report a total: the groups sum to ${sum} and the queue holds ${pipeline.total}.`
        + " The rows are written; the arithmetic is not trustworthy and must be fixed before his page is believed.",
      );
      await conn.end();
      process.exit(1);
    }
    console.log(`  ${"".padEnd(16)} ${String(sum).padStart(3)} — sums to the queue's own total ✓`);
  }

  /* Read back rather than trusted (working law 1 — the changed rows are the fact). */
  const [rows] = await conn.query<any[]>(
    `SELECT categoryKey, openCount, ${keepsTitles ? `${TITLES_COLUMN}, ` : ""}`
    + `${keepsExclusions ? `${EXCLUDED_COLUMN}, ` : ""}${keepsPossiblyDone ? `${POSSIBLY_DONE_COLUMN}, ` : ""}`
    + `countedAt FROM \`${TABLE}\` ORDER BY categoryKey`,
  );
  console.log(`\nstored ${rows.length} row(s) · ${written} written, ${skipped} skipped this run`);
  for (const row of rows) {
    /* Read back through the PARSERS his page uses, never through this script's
       own idea of the shape — a value that writes and reads fine here and
       yields nothing on the panel is exactly the failure being avoided. */
    const named = keepsTitles ? parseQueueTitles(row[TITLES_COLUMN]).length : 0;
    const back = keepsExclusions ? queueExclusionSentence(parseQueueExclusions(row[EXCLUDED_COLUMN])) : null;
    const stale = keepsPossiblyDone ? possiblyDoneSentence(parsePossiblyDone(row[POSSIBLY_DONE_COLUMN])) : null;
    console.log(
      `  ${String(row.categoryKey).padEnd(14)} ${String(row.openCount).padStart(3)}`
      + `${keepsTitles ? ` · ${named} named` : ""}${back ? ` · ${back}` : ""}${stale ? ` · ${stale}` : ""}`
      + ` · ${iso(row.countedAt)}`,
    );
  }
  if (skipped > 0) {
    console.log("\n⚠ A skipped category keeps its previous number and its previous timestamp. The page shows the age.");
  }
} catch (cause) {
  console.error(`FAILED: ${(cause as Error).message}`);
  await conn.end();
  process.exit(1);
}

await conn.end();
process.exit(0);
