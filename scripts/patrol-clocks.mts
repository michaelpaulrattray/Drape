/**
 * THE PATROL CLOCKS, DERIVED — standing exception 3, read rather than remembered.
 *
 * Founder-ordered (#505, 2026-09-04, terminal, verbatim): *"file it all and
 * puit it on the road. if anything is already in que make it urgent so the next
 * shift picks it up first."*
 *
 * # The measurement that filed it
 *
 * `docs/RETRO_LOG.md` held ONE run — 2026-08-26 — when the card was written on
 * 2026-09-04. PROGRAM.md's standing exception 3 says the Retro is WEEKLY and
 * adds that "the Foreman tracks last-run dates in its mailbox entries."
 * Nothing computed the date, so nothing noticed the seat was nine days cold,
 * and the process findings it exists to catch (#434, #494 and their siblings)
 * were found ad hoc by the relay instead.
 *
 * That is working law 4 in its usual shape: a clock kept in prose, in a file
 * nobody re-reads, drifts from the thing it describes. So the date is READ,
 * never typed.
 *
 * # Where each number comes from, and why not from PROGRAM.md
 *
 * Two facts decide a seat's state and BOTH are read out of that seat's own log:
 *
 *   - the CLOCK — the `**Clock:** every N days` line under the title;
 *   - the LAST RUN — the newest `## Run N — YYYY-MM-DD` heading in the file.
 *
 * PROGRAM.md states the same periods in prose and is the founder-facing
 * authority, but it lives under `.agents/`, which is gitignored — so tracked
 * code cannot read it and CI can never see it. Copying its numbers into a
 * constant here would be the mirror this card exists to remove. Putting the
 * period in each log instead makes the log self-describing: one artifact
 * carries both facts, and a seat whose clock changes changes it in the file
 * that records its runs.
 *
 * # It REFUSES rather than skipping
 *
 * A log with no clock line, no run heading, or no file at all is an ERROR with
 * the path named — never a row quietly missing from the table. A reader that
 * can come up short must throw, or a seat that has fallen out of its own log
 * reads exactly like a seat that is up to date. (CLAUDE.md's collector class:
 * every collector that can come up empty throws rather than returning a short
 * list.) Exit 1 on any refusal; exit 0 otherwise, whatever the clocks say —
 * being overdue is a FINDING FOR THE SHIFT, not a failure of this reader.
 *
 * # It reports; it does not decide
 *
 * The card's rule — *"An overdue patrol whose switch is on is the next
 * background card, ahead of the category order"* — needs his switch panel,
 * which is a production database row. This script deliberately touches no
 * database and no network, so it is free, offline and gate-testable; it prints
 * the switch category each seat answers to and leaves the comparison to the
 * shift, which has already read the switches at start.
 *
 * # ⚠ AND IT REFUSES WHEN ITS INPUT IS A TREE THAT IS BEHIND (#2180)
 *
 * Measured by `foreman-20261010-0213` on 2026-10-10: this reader reported
 * **Warden DUE about three hours after the Warden patrol had run.** It was not
 * wrong about anything it could see — the tree was four commits behind
 * `origin/main` and patrol run 7's append to `docs/WARDEN_LOG.md` was in one of
 * them. So it read a log that did not yet hold the run, **and answered
 * confidently**, which is the worse half of the shape the whole module is
 * written against: a reader that refuses tells you something; one that returns
 * a confident wrong answer from stale input sends a shift to re-run a patrol
 * that ran hours ago (which the anti-boredom rule forbids) or hides one that is
 * genuinely due.
 *
 * So before any clock is printed, the four log paths are compared between
 * `HEAD` and `refs/remotes/origin/main`, and a tree missing a commit that
 * touches one of them is a REFUSAL — the same posture this reader already takes
 * toward a log it cannot parse. **Only those four paths count**: a tree behind
 * on anything else cannot change a clock, and refusing for it would redden
 * every seat branch for no reason.
 *
 * ⚠ **IT FAILS OPEN, AND THAT IS THE CARD'S OWN CONDITION** — *"a refusal must
 * not be able to stop a shift starting"*. This runs at standing orders §2z
 * before any work, so when the check itself cannot be made — no git, no
 * repository, no `origin/main` ref (which is the ordinary state of a shallow CI
 * checkout), a git that hangs — it prints a NOTE naming the reason and reads
 * the tree as it stands. A check that cannot run never decides anything here.
 *
 * ⚠ **Stated limit: it compares against the `origin/main` ALREADY FETCHED.** It
 * runs no `git fetch`, because the no-network promise above is what makes this
 * free, offline and gate-testable — the rejected alternative was reading the
 * logs at `origin/main` after a fetch, which buys an answer independent of the
 * tree and costs the network. So it catches *"behind what this clone has seen"*
 * and not *"behind the remote this minute"*. That is the measured incident
 * exactly: the shift knew it was four commits behind, so the ref was there.
 *
 *     npx tsx scripts/patrol-clocks.mts
 *     npx tsx scripts/patrol-clocks.mts --dir <path> --today YYYY-MM-DD   # arms
 *
 * Unknown flags are REFUSED rather than ignored — the crew writers' rule, from
 * the shift that appended `--dry-run` to a script that had never heard of it
 * and stamped a running row terminal (#288).
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The seats, their logs, and the background-work switch each answers to.
 * The mapping is the card's own, verbatim: "Process -> Retro, Housekeeping ->
 * Janitor, Security -> Warden, Performance -> Machinist".
 */
const SEATS = [
  { seat: "Retro", log: "RETRO_LOG.md", category: "Process" },
  { seat: "Janitor", log: "JANITOR_LOG.md", category: "Housekeeping" },
  { seat: "Warden", log: "WARDEN_LOG.md", category: "Security" },
  { seat: "Machinist", log: "MACHINIST_LEDGER.md", category: "Performance" },
] as const;

const CLOCK_LINE = /^\*\*Clock:\*\*\s+every\s+(\d+)\s+days?\b/m;
/* The heading is `## Run 2 — 2026-08-29 06:56–08:0x AEST (...)`. The dash after
   the run number is an em dash in every log; a hyphen is accepted too so a
   hand-typed heading still reads. */
const RUN_HEADING = /^##\s+Run\s+\d+\s*[—–-]\s*(\d{4}-\d{2}-\d{2})/;

const DAY_MS = 24 * 60 * 60 * 1000;

class Refusal extends Error {}

type Reading = {
  seat: string;
  category: string;
  log: string;
  clockDays: number;
  lastRun: string;
  /** Whole days since the last run — negative is impossible and refused. */
  elapsedDays: number;
  /**
   * Days past the clock. Positive = overdue by this many. **Zero = the clock
   * LANDED today, which is a fired clock and not a quiet one** (#971) —
   * see `hasFired` below, which is the question the verdict asks.
   */
  overdueDays: number;
  /** elapsed / clock. One clock elapsed = 1.0. Ranks seats on unlike clocks. */
  clocksElapsed: number;
};

/**
 * HAS THIS SEAT'S CLOCK FIRED? — the one question the verdict asks, and the
 * one this reader used to answer two different ways in the same breath (#971).
 *
 * It printed `Janitor DUE today` and, four lines below, *"No seat is overdue.
 * Standing exception 3 does not fire"*. The row and the verdict were two
 * answers to one question because the verdict tested `overdueDays > 0`, so a
 * clock landing exactly on its day scored 0 and was counted as quiet — making
 * the Janitor a 4-day seat on a 3-day clock and the three weekly seats 8-day
 * seats.
 *
 * `PROGRAM.md`'s standing exception 3 is the authority and its words are
 * *"patrol duties when their clock fires"*; a clock every N days fires on day
 * N. #505's build line and the standing orders say "overdue", which describes
 * the ordinary case — **no ruling anywhere grants a landed clock a grace day**,
 * and the seats' own logs never behaved as though one existed: the most recent
 * run of all four seats was made on the exact day its clock landed, and
 * `MACHINIST_LEDGER.md` Run 3 heads itself "weekly clock, on the day".
 *
 * It had already been settled once by hand and the finding was not filed:
 * `janitor-20260912-0730` §A records two shifts skipping the seat on this
 * verdict and a third overriding it from PROGRAM.md — *"It had fired."* Five
 * further launches read `DUE today` and skipped, because standing exception 3
 * is the ONLY road that reaches a patrol ahead of the category order, and the
 * category order has not reached Housekeeping in days.
 *
 * The ROW LABELS are deliberately untouched: `DUE today` and `OVERDUE by N`
 * stay distinct, because they are distinct facts and the ranking below uses
 * the difference. Only the verdict's question changed.
 */
const hasFired = (row: Reading): boolean => row.overdueDays >= 0;

/**
 * IS THIS TREE MISSING A COMMIT THAT TOUCHES ONE OF THE LOGS? (#2180)
 *
 * `git` is run with the LOGS' OWN DIRECTORY as its working directory, so the
 * pathspecs are the bare log names and the question is asked of exactly the
 * four files this reader reads — a tree behind on anything else cannot change a
 * clock. `HEAD..refs/remotes/origin/main` is a local ref walk: no network, no
 * fetch, and nothing written.
 *
 * Returns the logs that moved, or a REASON the question could not be asked.
 * Every failure road — no git on the path, not a repository, no `origin/main`
 * ref, an unborn `HEAD`, a git that hangs past ten seconds — lands in
 * `unreadable`, because the caller must fail open on all of them.
 */
type Freshness =
  | { kind: "current" }
  | { kind: "behind"; behind: { log: string; commits: number }[] }
  | { kind: "unreadable"; reason: string };

function readFreshness(dir: string): Freshness {
  const git = (args: string[]): string =>
    execFileSync("git", args, {
      cwd: dir,
      encoding: "utf8",
      timeout: 10_000,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
  const reason = (error: unknown): string =>
    (error instanceof Error ? error.message : String(error)).split("\n")[0]!.trim();

  try {
    git(["rev-parse", "--is-inside-work-tree"]);
  } catch (error) {
    return { kind: "unreadable", reason: `not a git working tree here (${reason(error)})` };
  }
  try {
    /* `--verify --quiet` exits 1 on a missing ref, which `execFileSync` throws.
       A shallow CI checkout has no `origin/main` at all, and that is the single
       most common road through here — it must cost nothing. */
    git(["rev-parse", "--verify", "--quiet", "refs/remotes/origin/main"]);
  } catch {
    return { kind: "unreadable", reason: "this clone has no refs/remotes/origin/main to compare against" };
  }

  const behind: { log: string; commits: number }[] = [];
  for (const entry of SEATS) {
    let count: number;
    try {
      count = Number(
        git(["rev-list", "--count", "HEAD..refs/remotes/origin/main", "--", entry.log]).trim(),
      );
    } catch (error) {
      return { kind: "unreadable", reason: `git could not compare ${entry.log} (${reason(error)})` };
    }
    /* A reading that is not a number is not a reading. Failing open here rather
       than treating NaN as zero: zero is an ANSWER ("current") and this is the
       absence of one. */
    if (!Number.isFinite(count)) {
      return { kind: "unreadable", reason: `git gave no commit count for ${entry.log}` };
    }
    if (count > 0) behind.push({ log: entry.log, commits: count });
  }
  return behind.length === 0 ? { kind: "current" } : { kind: "behind", behind };
}

function readSeat(
  dir: string,
  entry: (typeof SEATS)[number],
  today: number,
): Reading {
  const path = join(dir, entry.log);
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch (error) {
    throw new Refusal(
      `${entry.seat}: cannot read ${path} (${error instanceof Error ? error.message : String(error)})`,
    );
  }

  const clock = CLOCK_LINE.exec(text);
  if (!clock) {
    throw new Refusal(
      `${entry.seat}: ${path} declares no clock — expected a line "**Clock:** every N days"`,
    );
  }
  const clockDays = Number(clock[1]);
  if (!Number.isFinite(clockDays) || clockDays <= 0) {
    throw new Refusal(
      `${entry.seat}: ${path} declares a clock of "${clock[1]}" days, which is not a period`,
    );
  }

  /*
    EVERY `## Run` HEADING IS COLLECTED, AND ONE THAT CARRIES NO PARSEABLE DATE
    IS REFUSED RATHER THAN DROPPED. Matching only well-formed headings would
    silently skip `## Run 3 — 2026-9-5`, and if that were the NEWEST run the
    seat would read its clock off the previous one — a patrol re-run because a
    date was typed a character short. Refusing is this reader's own doctrine and
    the error direction is not the point: a reader that can come up short says
    so.

    The NEWEST date is taken, not the last heading in the file, so a run
    appended out of order (or a log kept newest-first) still reads right.
  */
  const dates: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!/^##\s+Run\b/.test(line)) continue;
    const dated = RUN_HEADING.exec(line);
    if (!dated) {
      throw new Refusal(
        `${entry.seat}: ${path} has a run heading with no readable date — "${line.trim()}"`,
      );
    }
    dates.push(dated[1]);
  }
  if (dates.length === 0) {
    throw new Refusal(
      `${entry.seat}: ${path} records no run — expected a heading "## Run N — YYYY-MM-DD"`,
    );
  }
  dates.sort();
  const lastRun = dates[dates.length - 1];

  const lastRunMs = Date.parse(`${lastRun}T00:00:00Z`);
  if (Number.isNaN(lastRunMs)) {
    throw new Refusal(`${entry.seat}: ${path} newest run date "${lastRun}" is not a date`);
  }
  /*
    A FULL DAY OF TOLERANCE, AND IT IS THE NORMAL CASE THAT NEEDS IT. The run
    headings are stamped in AEST (UTC+10) and every recorded run so far happened
    between 06:56 and 08:55 AEST — which is 20:56–22:55 UTC of the PREVIOUS day.
    So a patrol that runs this morning writes tomorrow's date as far as UTC is
    concerned, for up to ten hours. Refusing on `lastRunMs > today` would have
    reddened the gate on the patrol's own commit, every AEST morning: the
    refusal that exists to catch a typo would have fired on the thing it is
    meant to serve. One day covers every zone up to UTC+14; a date genuinely
    further ahead than that is a typo and is still refused.
  */
  if (lastRunMs > today + DAY_MS) {
    throw new Refusal(
      `${entry.seat}: ${path} newest run is ${lastRun}, which is more than a day in the future — the clock cannot be read`,
    );
  }

  /* Clamped at 0 for the same reason: a run stamped in local time can read as
     -1 days elapsed, and "due in 8 days" on a 7-day clock is not a state. */
  const elapsedDays = Math.max(0, Math.floor((today - lastRunMs) / DAY_MS));
  return {
    seat: entry.seat,
    category: entry.category,
    log: path.replace(/\\/g, "/"),
    clockDays,
    lastRun,
    elapsedDays,
    overdueDays: elapsedDays - clockDays,
    clocksElapsed: elapsedDays / clockDays,
  };
}

/**
 * TODAY IS A CALENDAR DATE, NOT AN INSTANT, AND THAT IS THE WHOLE POINT.
 *
 * The run headings carry a LOCAL calendar date (AEST in every log so far). If
 * the default compared them against `Date.now()`, a shift starting at 07:00
 * AEST — which is 21:00 UTC the day before — would measure elapsed days from
 * UTC midnight and come up one day short: a Janitor run stamped 2026-08-29 read
 * "OVERDUE by 2" where the calendar says 3, and a seat exactly due read "due in
 * 1 day". Every clock fired one day late, on the no-flag path a shift actually
 * uses, while the fixtures (which all pass `--today`) could never see it.
 *
 * So both paths mean the same thing: midnight UTC of a CALENDAR DATE. `--today`
 * names one; with no flag it is the machine's LOCAL date. Comparing a date to a
 * date is the only arithmetic here that is well defined.
 */
function localCalendarDateMs(now: Date = new Date()): number {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return Date.parse(`${year}-${month}-${day}T00:00:00Z`);
}

function parseArgs(argv: string[]): { dir: string; today: number } {
  let dir = "docs";
  let today = localCalendarDateMs();
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag === "--dir") {
      const value = argv[i + 1];
      if (!value) throw new Refusal("--dir needs a path");
      dir = value;
      i += 1;
    } else if (flag === "--today") {
      const value = argv[i + 1];
      if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        throw new Refusal("--today needs a YYYY-MM-DD date");
      }
      today = Date.parse(`${value}T00:00:00Z`);
      /* The shape regex accepts month 13 and day 45, and a NaN sails past every
         comparison below (`NaN > x` is false) until `toISOString()` throws a raw
         RangeError. This script's own doctrine is that a bad input is a named
         REFUSES line, never a stack trace. */
      if (Number.isNaN(today)) {
        throw new Refusal(`--today "${value}" is not a real date`);
      }
      i += 1;
    } else {
      throw new Refusal(`unknown flag "${flag}" — this reader takes --dir and --today only`);
    }
  }
  return { dir, today };
}

function main(argv: string[]): number {
  let dir: string;
  let today: number;
  try {
    ({ dir, today } = parseArgs(argv));
  } catch (error) {
    console.error(`patrol-clocks REFUSES: ${(error as Error).message}`);
    return 1;
  }

  /* ⚠ **THE INPUT IS CHECKED BEFORE IT IS READ (#2180).** A tree missing a
     commit that touches one of these logs cannot be asked what the clocks are,
     and the measured cost of answering anyway was "Warden DUE" three hours
     after the Warden ran. The marker word `behind` is in the first line on
     purpose: this refusal is a fact about the TREE, not about the logs, and the
     suite tells the two apart by it. */
  const freshness = readFreshness(dir);
  if (freshness.kind === "behind") {
    const named = freshness.behind
      .map((row) => `${row.log} (${row.commits} commit${row.commits === 1 ? "" : "s"})`)
      .join(", ");
    console.error(`patrol-clocks REFUSES: this tree is behind origin/main on ${named}`);
    console.error(
      "The runs origin/main records are not in this tree, so a seat can read as DUE hours after it ran (#2180).",
    );
    console.error(
      "Bring the tree up to date — `git pull` on main, or `git merge origin/main` in a worktree — and run it again.",
    );
    return 1;
  }
  if (freshness.kind === "unreadable") {
    /* FAILS OPEN, by the card's own condition: this runs before any work, so a
       check that cannot be made never stops a shift starting. The note is on
       stderr so the table on stdout stays machine-readable. */
    console.error(
      `patrol-clocks NOTE: could not check whether this tree is current — ${freshness.reason}.`,
    );
    console.error("The clocks below are read from the tree exactly as it stands.");
  }

  const readings: Reading[] = [];
  for (const entry of SEATS) {
    try {
      readings.push(readSeat(dir, entry, today));
    } catch (error) {
      console.error(`patrol-clocks REFUSES: ${(error as Error).message}`);
      console.error(
        "A seat whose log cannot be read looks exactly like a seat that is up to date, so this reader stops rather than printing a short table.",
      );
      return 1;
    }
  }

  /* Ranked by how many of its OWN clocks have elapsed, so seats on unlike
     periods compare honestly: a 3-day seat two days late is further gone than a
     7-day seat two days late. Ties break alphabetically and the footer says so. */
  readings.sort(
    (a, b) => b.clocksElapsed - a.clocksElapsed || a.seat.localeCompare(b.seat),
  );

  const asOf = new Date(today).toISOString().slice(0, 10);
  console.log("THE PATROL CLOCKS — standing exception 3, derived from each log's own header");
  console.log(`as of ${asOf} · clock and last run read from ${dir.replace(/\\/g, "/")}/\n`);

  for (const row of readings) {
    const state =
      row.overdueDays > 0
        ? `OVERDUE by ${row.overdueDays} day${row.overdueDays === 1 ? "" : "s"}`
        : row.overdueDays === 0
          ? "DUE today"
          : `due in ${-row.overdueDays} day${row.overdueDays === -1 ? "" : "s"}`;
    console.log(
      `  ${row.seat.padEnd(10)} ${state.padEnd(20)} last run ${row.lastRun} (${row.elapsedDays}d ago) · every ${row.clockDays} days · switch: ${row.category}`,
    );
  }

  const fired = readings.filter(hasFired);
  console.log("");
  if (fired.length === 0) {
    console.log("No seat's clock has fired. Standing exception 3 does not fire; work the category order.");
  } else {
    const next = fired[0];
    /* Each seat is named with the state it is actually in. The old line said
       "overdue" of every seat it listed, which would now be false of a seat
       whose clock landed today — and printing one word over two states is the
       defect this repair exists to remove, not a shape to carry forward. */
    const named = fired
      .map((row) =>
        row.overdueDays > 0
          ? `${row.seat} (overdue by ${row.overdueDays})`
          : `${row.seat} (due today)`,
      )
      .join(", ");
    console.log(
      `${fired.length} seat${fired.length === 1 ? "'s clock has" : "s' clocks have"} fired: ${named}.`,
    );
    console.log(
      `NEXT: ${next.seat} (${next.log}) — furthest through its own clock. A patrol whose clock has`,
    );
    console.log(
      `fired and whose switch is ON takes precedence over the category order (#505); ${next.seat}'s switch is ${next.category}.`,
    );
    console.log("Ranked by clocks elapsed, ties alphabetical. Read the switches to decide.");
  }
  return 0;
}

process.exit(main(process.argv.slice(2)));
