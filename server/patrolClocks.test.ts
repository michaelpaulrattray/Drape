import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

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
const REAL_LOGS = [
  "RETRO_LOG.md",
  "JANITOR_LOG.md",
  "WARDEN_LOG.md",
  "MACHINIST_LEDGER.md",
] as const;

type Result = { status: number; stdout: string; stderr: string };

function run(...args: string[]): Result {
  const proc = spawnSync("npx", ["tsx", SCRIPT, ...args], {
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  return {
    status: typeof proc.status === "number" ? proc.status : -1,
    stdout: String(proc.stdout ?? ""),
    stderr: String(proc.stderr ?? ""),
  };
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
    expect(result.stdout).toContain("4 seats are overdue");
  });

  it("negative control: a seat inside its clock is not overdue and exception 3 does not fire", () => {
    writeAll(logFile(7, ["2026-09-02"]));
    const result = run("--dir", dir, "--today", "2026-09-04");
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("due in 5 days");
    expect(result.stdout).not.toContain("OVERDUE");
    expect(result.stdout).toContain("No seat is overdue");
  });

  it("the day the clock lands reads DUE today, not overdue and not due in 0", () => {
    writeAll(logFile(7, ["2026-08-28"]));
    const result = run("--dir", dir, "--today", "2026-09-04");
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("DUE today");
    expect(result.stdout).toContain("No seat is overdue");
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

  it("REFUSES a run date in the future — a clock cannot be read backwards", () => {
    writeAll(logFile(7, ["2026-09-01"]));
    writeFileSync(join(dir, "RETRO_LOG.md"), logFile(7, ["2026-12-25"]), "utf8");
    const result = run("--dir", dir, "--today", "2026-09-04");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("in the future");
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
    expect(result.status).toBe(0);
    for (const seat of ["Retro", "Janitor", "Warden", "Machinist"]) {
      expect(result.stdout).toContain(seat);
    }
  });
});
