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
 *     npx tsx scripts/patrol-clocks.mts
 *     npx tsx scripts/patrol-clocks.mts --dir <path> --today YYYY-MM-DD   # arms
 *
 * Unknown flags are REFUSED rather than ignored — the crew writers' rule, from
 * the shift that appended `--dry-run` to a script that had never heard of it
 * and stamped a running row terminal (#288).
 */
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
const RUN_HEADING = /^##\s+Run\s+\d+\s*[—–-]\s*(\d{4}-\d{2}-\d{2})/gm;

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
  /** Positive = overdue by this many days. Zero or less = not yet due. */
  overdueDays: number;
  /** elapsed / clock. One clock elapsed = 1.0. Ranks seats on unlike clocks. */
  clocksElapsed: number;
};

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

  /* The NEWEST date, not the last heading in the file: a run appended out of
     order (or a log that keeps its runs newest-first) must still read right. */
  RUN_HEADING.lastIndex = 0;
  const dates: string[] = [];
  for (const match of text.matchAll(RUN_HEADING)) dates.push(match[1]);
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

function parseArgs(argv: string[]): { dir: string; today: number } {
  let dir = "docs";
  let today = Date.now();
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

  const overdue = readings.filter((row) => row.overdueDays > 0);
  console.log("");
  if (overdue.length === 0) {
    console.log("No seat is overdue. Standing exception 3 does not fire; work the category order.");
  } else {
    const next = overdue[0];
    console.log(
      `${overdue.length} seat${overdue.length === 1 ? " is" : "s are"} overdue: ${overdue.map((row) => row.seat).join(", ")}.`,
    );
    console.log(
      `NEXT: ${next.seat} (${next.log}) — furthest through its own clock. An overdue patrol whose`,
    );
    console.log(
      `switch is ON takes precedence over the category order (#505); ${next.seat}'s switch is ${next.category}.`,
    );
    console.log("Ranked by clocks elapsed, ties alphabetical. Read the switches to decide.");
  }
  return 0;
}

process.exit(main(process.argv.slice(2)));
