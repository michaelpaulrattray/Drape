import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { readListedSource } from "./testing/listedSource";

import { runHook } from "./testing/hookDriver";
import { CHILD_PROCESS_TEST_TIMEOUT_MS } from "./testing/childProcessTimeout";

/* This suite drives a real child process, so it declares the class's timeout
   rather than racing vitest's 5 s default under a parallel run (#548). */
vi.setConfig({ testTimeout: CHILD_PROCESS_TEST_TIMEOUT_MS });

/**
 * THE PATROL-CLOCK READER, DRIVEN (card #505).
 *
 * `scripts/patrol-clocks.mts` tells a shift at start whether a patrol seat is
 * overdue, by reading each seat's own log rather than a period typed into
 * PROGRAM.md. The defect it answers is measured: the Retro had run ONCE, on
 * 2026-08-26, and was still nine days cold on 2026-09-04 with nothing anywhere
 * computing the date.
 *
 * The script is driven as a process, not imported: it ends in `process.exit`,
 * and the exit code is half of what this suite asserts. A `--dir` lets fixtures
 * stand in for `docs/` so no arm can pass by reading the real logs.
 *
 * BOTH DIRECTIONS ON EVERY ARM (working law 2). The refusal arms are the
 * load-bearing ones: a reader that SKIPPED an unreadable log would print a
 * short table, and a seat missing from a table looks exactly like a seat that
 * is up to date — which is the failure mode, not a cosmetic one. The negative
 * control (a seat inside its clock) exists because a reader that called
 * everything overdue would satisfy every positive arm here.
 *
 * THE LAST ARM IS THE ONE THAT KEEPS IT HONEST: it runs against the REAL
 * `docs/` logs, so a log that loses its `**Clock:**` line or its run headings
 * reddens this suite instead of silently dropping a seat from the shift-start
 * reading.
 */

const SCRIPT = resolve("scripts/patrol-clocks.mts");
/* tsx's own entry, for the one arm that runs the script under a stripped PATH
   and therefore cannot reach `npx`. Same spelling as
   `server/nextUpEscalation.test.ts`, which pays for the same reading. */
const TSX_CLI = resolve("node_modules/tsx/dist/cli.mjs");
const REAL_LOGS = [
  "RETRO_LOG.md",
  "JANITOR_LOG.md",
  "WARDEN_LOG.md",
  "MACHINIST_LEDGER.md",
] as const;

type Result = { status: number; stdout: string; stderr: string };

function run(...args: string[]): Result {
  /* An `npx` that fails to start throws rather than reading as an exit code
     (#640) — this suite asserts exit 1 for a REFUSAL, and a missing npx would
     otherwise have to be told apart from one by eye. */
  return runHook("npx", ["tsx", SCRIPT, ...args], { shell: process.platform === "win32" });
}

/** A log with a declared clock and one run heading, in the shape the real ones use. */
function logFile(clockDays: number, runDates: string[]): string {
  const runs = runDates
    .map((date, index) => `## Run ${index + 1} — ${date} 07:16–07:30 AEST (patrol)\n\nbody\n`)
    .join("\n");
  return `# Fixture log — a seat\n\n**Clock:** every ${clockDays} days.\n\nprose\n\n---\n\n${runs}`;
}

let dir: string;

/** Writes all four seats at once; individual arms overwrite the one they test. */
function writeAll(contents: string) {
  for (const name of REAL_LOGS) writeFileSync(join(dir, name), contents, "utf8");
}

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "patrol-clocks-"));
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("patrol-clocks reader", () => {
  it("the card's positive control: a weekly seat last run 10 days ago is overdue by 3", () => {
    writeAll(logFile(7, ["2026-08-25"]));
    const result = run("--dir", dir, "--today", "2026-09-04");
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("OVERDUE by 3 days");
    expect(result.stdout).toContain("last run 2026-08-25 (10d ago)");
    expect(result.stdout).toContain("4 seats' clocks have fired");
    expect(result.stdout).toContain("Janitor (overdue by 3)");
  });

  it("negative control: a seat inside its clock has not fired and exception 3 does not fire", () => {
    writeAll(logFile(7, ["2026-09-02"]));
    const result = run("--dir", dir, "--today", "2026-09-04");
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("due in 5 days");
    expect(result.stdout).not.toContain("OVERDUE");
    expect(result.stdout).toContain("No seat's clock has fired");
  });

  it("the day the clock lands reads DUE today, not overdue and not due in 0", () => {
    writeAll(logFile(7, ["2026-08-28"]));
    const result = run("--dir", dir, "--today", "2026-09-04");
    expect(result.status).toBe(0);
    /* This arm's own property, unchanged: the ROW LABEL for a landed clock is
       `DUE today` and never `due in 0 days` or `OVERDUE by 0`. */
    expect(result.stdout).toContain("DUE today");
    expect(result.stdout).not.toContain("OVERDUE");
    expect(result.stdout).not.toContain("due in 0 day");
  });

  /*
    #971 — THE ARM THE ONE ABOVE USED TO CARRY BACKWARDS. It asserted `"No seat
    is overdue"` on a landed clock, which pinned the verdict as *quiet* on the
    exact day PROGRAM.md's standing exception 3 says a patrol's clock FIRES.
    That was never the arm's stated purpose (its title is about the row label);
    it rode along, and it made the Janitor a 4-day seat on a 3-day clock.

    Measured before it was changed: `janitor-20260912-0730` §A records two
    shifts skipping the seat on that verdict and a third overriding it from
    PROGRAM.md — *"It had fired."* — and five further launches read `DUE today`
    and skipped, because standing exception 3 is the only road that reaches a
    patrol ahead of the category order.
  */
  it("a clock that lands today HAS fired — the verdict names it and does not call it overdue", () => {
    writeAll(logFile(7, ["2026-08-28"]));
    const result = run("--dir", dir, "--today", "2026-09-04");
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("4 seats' clocks have fired");
    expect(result.stdout).toContain("Janitor (due today)");
    /* The seat is named with the state it is actually IN. A verdict that
       called a landed clock "overdue" would be the same defect mirrored. */
    expect(result.stdout).not.toContain("Janitor (overdue");
    expect(result.stdout).toContain("NEXT: Janitor");
  });

  it("a landed clock ranks BELOW a genuinely overdue one, so the worst seat is still NEXT", () => {
    /*
      WHAT THIS ARM GUARDS, AND WHAT IT CANNOT: it proves the WIDENED `fired`
      set is still ordered and that `NEXT` is the worst seat in it — a landed
      clock joining the set must not displace a seat two clocks gone, and
      `next = fired[0]` must be the ranked head rather than whatever order the
      seats were declared in.

      It deliberately does NOT claim to discriminate the two ranking metrics,
      because on this fixture it cannot: a landed clock is exactly 1.00 clocks
      elapsed and 0 days overdue, and an overdue seat always exceeds BOTH, so
      the orderings can never disagree about a landed-vs-overdue pair. Driven:
      swapping the comparator to raw days overdue leaves this arm green and
      reddens the arm above, which is the one written to tell them apart.
    */
    writeAll(logFile(7, ["2026-09-02"]));
    writeFileSync(join(dir, "JANITOR_LOG.md"), logFile(3, ["2026-09-01"]), "utf8");
    writeFileSync(join(dir, "WARDEN_LOG.md"), logFile(7, ["2026-08-21"]), "utf8");
    const result = run("--dir", dir, "--today", "2026-09-04");
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Janitor    DUE today");
    expect(result.stdout).toContain("Warden     OVERDUE by 7 days");
    expect(result.stdout).toContain("NEXT: Warden");
    expect(result.stdout.indexOf("Warden ")).toBeLessThan(result.stdout.indexOf("Janitor "));
  });

  it("ranks by clocks elapsed, not by raw days overdue", () => {
    /*
      The two orderings must DISAGREE here or the arm proves nothing — and the
      first version of this fixture proved nothing: both seats were 2 days
      overdue, so the alphabetical tie-break put Janitor first under either
      rule and a sabotage swapping them stayed green. So:

        Janitor  3-day clock, 6 days elapsed -> 3 overdue, 2.00 clocks
        Machinist 7-day clock, 13 days elapsed -> 6 overdue, 1.86 clocks

      Clocks elapsed ranks Janitor first (correct); raw days overdue ranks
      Machinist first, and Machinist also sorts alphabetically first, so
      neither the wrong metric nor the tie-break can rescue it.
    */
    writeAll(logFile(7, ["2026-09-02"]));
    writeFileSync(join(dir, "JANITOR_LOG.md"), logFile(3, ["2026-08-29"]), "utf8");
    writeFileSync(join(dir, "MACHINIST_LEDGER.md"), logFile(7, ["2026-08-22"]), "utf8");
    const result = run("--dir", dir, "--today", "2026-09-04");
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Janitor    OVERDUE by 3 days");
    expect(result.stdout).toContain("Machinist  OVERDUE by 6 days");
    const janitorAt = result.stdout.indexOf("Janitor");
    const machinistAt = result.stdout.indexOf("Machinist");
    expect(janitorAt).toBeGreaterThan(-1);
    expect(machinistAt).toBeGreaterThan(-1);
    expect(janitorAt).toBeLessThan(machinistAt);
    expect(result.stdout).toContain("NEXT: Janitor");
    // and it names the switch that governs whether that precedence applies
    expect(result.stdout).toContain("Janitor's switch is Housekeeping");
  });

  it("takes the NEWEST run date, not the last heading in the file", () => {
    writeAll(logFile(7, ["2026-09-01", "2026-08-01"]));
    const result = run("--dir", dir, "--today", "2026-09-04");
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("last run 2026-09-01");
    expect(result.stdout).not.toContain("last run 2026-08-01");
  });

  it("REFUSES a log with no clock line, naming the seat and the path", () => {
    writeAll(logFile(7, ["2026-09-01"]));
    writeFileSync(
      join(dir, "WARDEN_LOG.md"),
      "# Warden log\n\n## Run 1 — 2026-09-01 (patrol)\n",
      "utf8",
    );
    const result = run("--dir", dir, "--today", "2026-09-04");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("REFUSES");
    expect(result.stderr).toContain("Warden");
    expect(result.stderr).toContain("declares no clock");
    // it stops rather than printing three seats and quietly dropping the fourth
    expect(result.stdout).not.toContain("OVERDUE");
  });

  it("REFUSES a log that records no run", () => {
    writeAll(logFile(7, ["2026-09-01"]));
    writeFileSync(
      join(dir, "MACHINIST_LEDGER.md"),
      "# Machinist ledger\n\n**Clock:** every 7 days.\n\nno runs yet\n",
      "utf8",
    );
    const result = run("--dir", dir, "--today", "2026-09-04");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Machinist");
    expect(result.stderr).toContain("records no run");
  });

  it("REFUSES a missing log rather than reporting three seats", () => {
    writeAll(logFile(7, ["2026-09-01"]));
    rmSync(join(dir, "RETRO_LOG.md"));
    const result = run("--dir", dir, "--today", "2026-09-04");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Retro");
    expect(result.stderr).toContain("cannot read");
  });

  it("REFUSES a run date more than a day in the future — a clock cannot be read backwards", () => {
    writeAll(logFile(7, ["2026-09-01"]));
    writeFileSync(join(dir, "RETRO_LOG.md"), logFile(7, ["2026-12-25"]), "utf8");
    const result = run("--dir", dir, "--today", "2026-09-04");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("in the future");
  });

  it("does NOT refuse a run stamped one day ahead — the AEST morning, which is the normal case", () => {
    /*
      Every recorded patrol so far ran between 06:56 and 08:55 AEST, which is
      20:56-22:55 UTC of the previous day. So a patrol running this morning
      writes what UTC still calls tomorrow, for up to ten hours. A zero-
      tolerance future check would have reddened the gate on the patrol's own
      commit — the refusal firing on the thing it exists to serve.
    */
    writeAll(logFile(7, ["2026-09-05"]));
    const result = run("--dir", dir, "--today", "2026-09-04");
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("last run 2026-09-05 (0d ago)");
    expect(result.stdout).toContain("due in 7 days");
    expect(result.stdout).not.toContain("OVERDUE");
  });

  it("REFUSES a run heading whose date is malformed, rather than silently skipping it", () => {
    /*
      Collecting only well-formed headings would DROP `## Run 3 — 2026-9-5`, and
      if that were the newest run the seat would read its clock off the previous
      one — a patrol re-run because a date was typed a character short. The
      reader's doctrine is that coming up short is a refusal.
    */
    writeAll(logFile(7, ["2026-09-01"]));
    writeFileSync(
      join(dir, "WARDEN_LOG.md"),
      "# Warden log\n\n**Clock:** every 7 days.\n\n## Run 1 — 2026-08-20 (patrol)\n\n## Run 2 — 2026-9-5 (patrol)\n",
      "utf8",
    );
    const result = run("--dir", dir, "--today", "2026-09-04");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("no readable date");
    expect(result.stderr).toContain("2026-9-5");
    // and it did NOT quietly fall back to Run 1
    expect(result.stdout).not.toContain("last run 2026-08-20");
  });

  it("with no --today it reads the LOCAL calendar date, not the UTC instant", () => {
    /*
      The logs stamp LOCAL (AEST) dates. Measuring elapsed days from `Date.now()`
      made every clock fire one calendar day late on the no-flag path a shift
      actually uses — a Janitor run stamped 2026-08-29, read at 07:00 AEST
      (21:00 UTC the day before), came out "OVERDUE by 2" where the calendar says
      3. Every fixture arm above passes `--today`, so none of them could see it.

      ⚠ WHAT THIS ARM CAN AND CANNOT PROVE, stated rather than implied: it
      discriminates only while the machine's local date differs from UTC's,
      which on a UTC+10 machine is ten hours in twenty-four — and CI runs in UTC,
      where it can never discriminate at all. `TZ` does not take effect for Node
      on this Windows machine (driven: Pacific/Kiritimati still reported the
      local date), so there is no way to pin the zone from a test here. It is a
      FLOOR, not coverage, and the expectation below is derived independently of
      the script's own arithmetic (Intl, not getFullYear/getMonth/getDate).
    */
    writeAll(logFile(7, ["2026-08-01"]));
    const result = run("--dir", dir);
    expect(result.status).toBe(0);
    const localDate = new Date().toLocaleDateString("en-CA");
    expect(result.stdout).toContain(`as of ${localDate}`);
  });

  it("REFUSES a --today that passes the shape but is not a real date", () => {
    writeAll(logFile(7, ["2026-09-01"]));
    const result = run("--dir", dir, "--today", "2026-13-45");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("is not a real date");
    // a named refusal, not a raw stack
    expect(result.stderr).not.toContain("RangeError");
  });

  it("REFUSES a flag it does not know instead of ignoring it (#288's class)", () => {
    const result = run("--dir", dir, "--dry-run");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('unknown flag "--dry-run"');
  });

  it("REFUSES a clock of zero days", () => {
    writeAll(logFile(7, ["2026-09-01"]));
    writeFileSync(join(dir, "RETRO_LOG.md"), logFile(0, ["2026-09-01"]), "utf8");
    const result = run("--dir", dir, "--today", "2026-09-04");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("not a period");
  });

  it("the REAL logs each declare a clock and record a run — the arm that keeps this wired", () => {
    for (const name of REAL_LOGS) {
      const text = readFileSync(resolve("docs", name), "utf8");
      expect(text, `${name} lost its machine-readable clock line`).toMatch(
        /^\*\*Clock:\*\*\s+every\s+\d+\s+days?\b/m,
      );
      expect(text, `${name} records no parseable run heading`).toMatch(
        /^##\s+Run\s+\d+\s*[—–-]\s*\d{4}-\d{2}-\d{2}/m,
      );
    }
    const result = run();
    /* ⚠ **TWO REFUSALS NOW REACH THIS ARM AND ONLY ONE OF THEM IS ITS SUBJECT
       (#2180).** This arm is about the LOGS being readable. Since #2180 the
       reader also refuses when THIS TREE is behind `origin/main` on a log —
       which is a fact about the tree, true of any seat branch the moment a
       patrol appends a run to main, and asserting exit 0 through it would make
       this guard red for a reason it is not guarding. So the freshness refusal
       is tolerated BY NAME, and nothing else is. */
    if (result.status === 1 && /REFUSES: this tree is behind origin\/main/.test(result.stderr)) {
      expect(result.stdout).not.toContain("THE PATROL CLOCKS");
      return;
    }
    expect(result.status).toBe(0);
    for (const seat of ["Retro", "Janitor", "Warden", "Machinist"]) {
      expect(result.stdout).toContain(seat);
    }
  });

  it("no log in docs/ declares a clock without being one of the reader's seats", () => {
    /*
      `SEATS` is a hand-kept enumeration, and a fifth seat added to docs/ later
      would be silently absent from the table — which is precisely the failure
      the reader names for itself ("a seat missing from a table looks exactly
      like a seat that is up to date"), and the list-stops-being-the-list class.
      So the population is DERIVED here from the artifact — every file under
      docs/ that declares a clock must be a file the reader reads.
    */
    const declared = readdirSync(resolve("docs"))
      .filter((name) => name.endsWith(".md"))
      .filter((name) => {
        /* #223: a file a listing named can be gone by the time you read it —
           this tree is shared and carries hundreds of untracked files, so a
           listed entry is read through the helper and a null is skipped. */
        const source = readListedSource(resolve("docs", name));
        return source !== null && /^\*\*Clock:\*\*\s+every\s+\d+\s+days?\b/m.test(source);
      })
      .sort();
    expect(
      declared,
      "a docs/ log declares a **Clock:** line that scripts/patrol-clocks.mts does not read — add it to SEATS or drop the line",
    ).toEqual([...REAL_LOGS].sort());
  });
});

/**
 * THE INPUT'S OWN FRESHNESS (#2180).
 *
 * The measured defect: this reader said **Warden DUE about three hours after
 * the Warden ran**, because the tree was four commits behind `origin/main` and
 * run 7's append to `docs/WARDEN_LOG.md` was in one of them. It read a log that
 * did not hold the run and answered confidently — the worse half of the shape
 * the reader's own docblock is written against.
 *
 * ⚠ **DRIVEN AGAINST REAL REPOSITORIES, with a real bare remote and real
 * commits.** A faked `git` would prove the branch is reachable and nothing
 * about whether the question it asks is the right question — and the question
 * is the whole repair: `HEAD..refs/remotes/origin/main` limited to the four log
 * paths. This repository's doctrine for anything deciding on git is a real
 * repository (`atlasCommitHook.test.ts`, `atlasMergeDriver.test.ts`).
 *
 * BOTH DIRECTIONS ON EVERY ARM. The refusal is the headline, but the three
 * controls beside it are what stop the repair being a reader that refuses
 * everything: a current tree answers, a tree behind on something that is NOT a
 * log answers, and a check that cannot be made answers with a note. That last
 * one is the card's own condition — *"a refusal must not be able to stop a
 * shift starting"* — because this runs at standing orders §2z before any work.
 */
describe("patrol-clocks refuses a tree that is behind on a log (#2180)", () => {
  const repos: string[] = [];

  afterAll(() => {
    for (const path of repos) rmSync(path, { recursive: true, force: true });
  });

  /**
   * The fixture repositories' own git, through the house driver rather than a
   * bare `execFileSync` — PR #2213's first relay finding.
   *
   * `server/testing/hookDriver.test.ts` pins the population of suites that
   * spawn a child AND read a `.status`, and this file matched: the bare call
   * below was fixture CONSTRUCTION while every VERDICT already went through
   * `runHook`, which is the "declared remainder" shape three entries on that
   * list carry. ⚠ **The remedy taken is the one the guard's own docblock
   * prefers** — *"which is the point at which somebody asks whether it should
   * be on `runHook` instead"* — because a tenth declaration is how a pinned
   * population rots, and that guard says so about itself.
   *
   * Non-zero THROWS, so nothing here is quieter than the call it replaces: a
   * fixture that half-built would otherwise flow into an arm as a reading. It
   * is in fact louder — `execFileSync` hides the child's stderr behind
   * `error.stderr`, and a fixture repository that will not build is diagnosed
   * from that text and nothing else.
   */
  const git = (cwd: string, ...args: string[]): string => {
    const run = runHook("git", args, { cwd });
    if (run.status !== 0) {
      throw new Error(
        `fixture git ${args.join(" ")} exited ${run.status} in ${cwd}: ${run.stderr.trim() || "(no stderr)"}`,
      );
    }
    return run.stdout;
  };

  /*
    ⚠ THE FIXTURE BUILDER'S OWN ARM, and a sabotage is what asked for it: with
    the throw above deleted, six arms stayed green, because no happy path ever
    runs a git command that fails. So the net was there and untested — the same
    property `execFileSync` had, which is not a reason to inherit it.

    A fixture that half-builds otherwise flows into an arm as a READING: a
    `git push` that silently did nothing leaves `origin/main` equal to `HEAD`,
    and the behind-tree arms would then measure a current tree and pass while
    proving nothing. This drives the helper directly rather than through a
    broken fixture, which is law 3's "a test the model cannot rescue".
  */
  it("the fixture builder is LOUD — a git that exits non-zero throws, carrying the child's own words", () => {
    const loose = mkdtempSync(join(tmpdir(), "patrol-2180-loudfixture-"));
    repos.push(loose);

    /* A real git, a real non-zero exit, a real message — not a stub. */
    expect(() => git(loose, "rev-parse", "--definitely-not-a-flag-2180"))
      .toThrow(/exited [1-9]\d*/);
    expect(() => git(loose, "rev-parse", "--definitely-not-a-flag-2180"))
      .toThrow(/definitely-not-a-flag-2180/);
  });

  /**
   * A clone whose `origin/main` carries `remoteLogs` and whose working tree is
   * one commit behind it. `localLogs` is what the TREE holds.
   *
   * Built the way the incident happened rather than by rewriting refs: commit
   * the local state, push it, commit the remote-only change, push that, then
   * reset the branch back one — so `refs/remotes/origin/main` is genuinely
   * ahead of `HEAD` by a real commit touching a real file.
   */
  function cloneBehindBy(remoteOnly: Record<string, string>): string {
    const root = mkdtempSync(join(tmpdir(), "patrol-2180-"));
    repos.push(root);
    const bare = join(root, "remote.git");
    const work = join(root, "work");
    mkdirSync(work, { recursive: true });
    git(root, "init", "--quiet", "--bare", "--initial-branch=main", bare);
    git(root, "init", "--quiet", "--initial-branch=main", work);
    git(work, "config", "user.email", "seat@example.invalid");
    git(work, "config", "user.name", "seat");
    git(work, "config", "commit.gpgsign", "false");
    git(work, "remote", "add", "origin", bare);

    const docs = join(work, "docs");
    mkdirSync(docs, { recursive: true });
    for (const name of REAL_LOGS) writeFileSync(join(docs, name), logFile(7, ["2026-09-02"]), "utf8");
    writeFileSync(join(work, "unrelated.txt"), "one\n", "utf8");
    git(work, "add", "--all");
    git(work, "commit", "--quiet", "--no-verify", "-m", "the tree a shift has");
    const behindSha = git(work, "rev-parse", "HEAD").trim();
    git(work, "push", "--quiet", "origin", "main");

    for (const [file, text] of Object.entries(remoteOnly)) {
      const full = join(work, file);
      mkdirSync(dirname(full), { recursive: true });
      writeFileSync(full, text, "utf8");
    }
    git(work, "add", "--all");
    git(work, "commit", "--quiet", "--no-verify", "-m", "what origin/main has and this tree does not");
    git(work, "push", "--quiet", "origin", "main");
    /* The tree goes back to where the shift's was; `origin/main` stays ahead.
       `--hard` is safe here: this is a throwaway repository built two lines
       above, never a tree anybody is working in. */
    git(work, "reset", "--quiet", "--hard", behindSha);
    return join(work, "docs");
  }

  it("REFUSES when origin/main has a commit touching a log that this tree does not have", () => {
    const docs = cloneBehindBy({
      "docs/WARDEN_LOG.md": logFile(7, ["2026-09-02", "2026-09-09"]),
    });

    const result = run("--dir", docs, "--today", "2026-09-09");

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("REFUSES: this tree is behind origin/main");
    expect(result.stderr).toContain("WARDEN_LOG.md (1 commit)");
    expect(result.stderr).toContain("#2180");
    /* The incident in one assertion: the tree's own copy of the Warden log says
       the last run was a week ago, so answering from it would have printed a
       fired clock. Nothing is printed at all. */
    expect(result.stdout).not.toContain("THE PATROL CLOCKS");
    expect(result.stdout).not.toContain("Warden");
  });

  it("NEGATIVE CONTROL — the same clone, current, answers normally", () => {
    const docs = cloneBehindBy({
      "docs/WARDEN_LOG.md": logFile(7, ["2026-09-02", "2026-09-09"]),
    });
    git(join(docs, ".."), "merge", "--quiet", "--ff-only", "refs/remotes/origin/main");

    const result = run("--dir", docs, "--today", "2026-09-09");

    expect(result.status).toBe(0);
    expect(result.stderr).not.toContain("REFUSES");
    expect(result.stdout).toContain("THE PATROL CLOCKS");
    /* ⚠ **AND THIS IS THE INCIDENT IN ONE PAIR OF LINES.** The commit the
       behind tree was missing is a Warden run on 2026-09-09, which is today —
       so the current tree reads the Warden as `due in 7 days`, while the three
       seats whose logs did not move still read `DUE today` off their 2026-09-02
       run. A reader answering from the behind tree would have put the Warden in
       that same fired group, which is exactly what it did on 2026-10-10. */
    expect(result.stdout).toMatch(/Warden\s+due in 7 days.*last run 2026-09-09/);
    expect(result.stdout).toMatch(/Retro\s+DUE today/);
  });

  it("NEGATIVE CONTROL — a tree behind on something that is NOT a log is not refused", () => {
    const docs = cloneBehindBy({ "unrelated.txt": "two\n" });

    const result = run("--dir", docs, "--today", "2026-09-09");

    expect(result.status).toBe(0);
    expect(result.stderr).not.toContain("REFUSES");
    expect(result.stdout).toContain("THE PATROL CLOCKS");
  });

  it("the card's condition: a check that CANNOT BE MADE never stops a shift — no repository", () => {
    const loose = mkdtempSync(join(tmpdir(), "patrol-2180-loose-"));
    repos.push(loose);
    for (const name of REAL_LOGS) writeFileSync(join(loose, name), logFile(7, ["2026-09-02"]), "utf8");

    const result = run("--dir", loose, "--today", "2026-09-09");

    expect(result.status).toBe(0);
    expect(result.stderr).toContain("NOTE: could not check whether this tree is current");
    expect(result.stderr).toContain("not a git working tree here");
    expect(result.stdout).toContain("THE PATROL CLOCKS");
  });

  it("…and the same when the clone has no origin/main to compare against — the shallow-CI case", () => {
    const root = mkdtempSync(join(tmpdir(), "patrol-2180-noremote-"));
    repos.push(root);
    git(root, "init", "--quiet", "--initial-branch=main", ".");
    git(root, "config", "user.email", "seat@example.invalid");
    git(root, "config", "user.name", "seat");
    git(root, "config", "commit.gpgsign", "false");
    const docs = join(root, "docs");
    mkdirSync(docs, { recursive: true });
    for (const name of REAL_LOGS) writeFileSync(join(docs, name), logFile(7, ["2026-09-02"]), "utf8");
    git(root, "add", "--all");
    git(root, "commit", "--quiet", "--no-verify", "-m", "tree");

    const result = run("--dir", docs, "--today", "2026-09-09");

    expect(result.status).toBe(0);
    expect(result.stderr).toContain("no refs/remotes/origin/main");
    expect(result.stdout).toContain("THE PATROL CLOCKS");
  });

  it("…and the same when there is no git at all on the PATH", () => {
    /* The one road none of the arms above can build, driven by taking `git`
       away from the child rather than by faking a failure: a shift on a box
       without git still gets its clocks. */
    const loose = mkdtempSync(join(tmpdir(), "patrol-2180-nogit-"));
    repos.push(loose);
    const docs = join(loose, "docs");
    mkdirSync(docs, { recursive: true });
    for (const name of REAL_LOGS) writeFileSync(join(docs, name), logFile(7, ["2026-09-02"]), "utf8");

    const env: NodeJS.ProcessEnv = {
      ...process.env,
      PATH: dirname(process.execPath),
      Path: dirname(process.execPath),
    };

    /*
      ⚠ THE INSTRUMENT'S OWN CONTROL, AND THIS ARM NEEDS IT MORE THAN MOST:
      the fixture is a bare `mkdtemp` directory, so if `git` WERE still
      reachable the script would answer `not a git working tree here` and print
      the very same NOTE — the assertion below would pass for the reason the
      arm two above it already covers. A stripped PATH that still finds the
      binary makes this a green that means nothing.

      Probed through `runHook` rather than a bare `spawnSync` so this suite
      stays off `hookDriver`'s pinned population (PR #2213's first finding),
      and in a `try` because a reachable-nothing PATH is exactly the
      `SpawnFailure` road.
    */
    const reachable = (probeEnv: NodeJS.ProcessEnv): boolean => {
      try {
        return runHook("git", ["--version"], { env: probeEnv }).status === 0;
      } catch {
        return false;
      }
    };

    /* ⚠ BOTH DIRECTIONS, because a probe that has stopped being able to say YES
       reports an unreachable binary on every PATH there is — including the real
       one — and this arm would then be green on a machine where nothing was
       ever stripped. The positive control is the inherited environment, where
       `git` is reachable by construction: this suite's own fixtures are built
       with it twenty lines up. */
    expect(reachable(process.env), "the probe cannot find `git` even on the real PATH — it cannot say no").toBe(true);
    expect(reachable(env), "the stripped PATH still finds `git`, so this arm would prove nothing").toBe(false);

    /* ⚠ node ITSELF by its absolute path, and tsx by its file — never `npx`.
       This is the SECOND instance of a measured class, and the first is written
       up at `server/nextUpEscalation.test.ts`: `npx` spawns `sh` to run the
       bin, `sh` lives in `/bin`, and a PATH stripped to node's own directory
       deliberately does not carry it — on the runner that was `spawn sh ENOENT`
       (run 36219309593 there, and `expected 254 to be +0` here, run
       38047540460). `process.execPath` needs no PATH lookup at all, and tsx
       starts its child from the same path, so nothing consults the shell and
       the arm tests the script instead of its own plumbing. */
    const result = runHook(
      process.execPath,
      [TSX_CLI, SCRIPT, "--dir", docs, "--today", "2026-09-09"],
      { env },
    );

    expect(result.status, result.stderr).toBe(0);
    expect(result.stderr).toContain("NOTE: could not check whether this tree is current");
    /* The reason, not only the note: `ENOENT` is what tells a missing binary
       apart from the not-a-repository road, and it is the only thing in this
       arm that the arm above could not also produce. */
    expect(result.stderr).toMatch(/ENOENT/);
    expect(result.stdout).toContain("THE PATROL CLOCKS");
  });
});
