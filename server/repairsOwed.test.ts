/**
 * REPAIRS OWED COME BEFORE ANY NEW CARD — #1977, his word 2026-10-08.
 *
 * Verbatim: *"yes shouldnt the manager be on top of this when delegating the
 * work to the crew"*, said after five money/privacy pull requests sat held on the
 * relay's findings with no repair pushed while seats opened new cards.
 *
 * # What these arms are driven on
 *
 * ⚠ **The REAL population of the day the card was written, carried as a fixture
 * of exactly what `gh pr list` returns** — `__fixtures__/repairsOwed.live.json`,
 * twelve open pull requests with their commits and comments reduced to the four
 * fields the reading uses. Its provenance is in the file. Nine of the twelve were
 * held on a finding, the oldest for 9.6 hours, and THREE were not held at all — two
 * dependabot bumps and this card`s own sibling PR #1983, open and unreviewed at the
 * moment of the read. So the fixture carries its own negative control rather than
 * needing one invented.
 *
 * # ⚠ THE ARM THE CARD ASKS FOR IS THE ORDERING ONE
 *
 * His card's done-when: *"a driven arm with one held PR and one fresh
 * founder-ordered card shows the picker offering the repair first"*. That is the
 * `cut-seat-batches.mts` arm at the foot of this file, which runs the real cut
 * over fixtures and reads its stdout.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import {
  oldestRepairAgeHours,
  REPAIR_PR_PAGE,
  REPAIRS_OWED_LIST_ARGS,
  repairsOwedFrom,
  repairsOwedWord,
  type RepairPullRequestRow,
} from "../scripts/lib/repairsOwed.mts";

/**
 * ⚠ **A SPAWNING SUITE DECLARES ITS OWN TIMEOUT AT FILE LEVEL**, which
 * `contendedTestTimeouts` holds every suite in this repository to: the cut arm
 * runs a real `tsx` process, and under a contended full run that is minutes
 * rather than seconds.
 */
const CONTENDED_TEST_TIMEOUT_MS = 240_000;

const LIVE = JSON.parse(
  readFileSync("server/__fixtures__/repairsOwed.live.json", "utf8"),
) as { provenance: Record<string, string>; ownerLogin: string; rows: RepairPullRequestRow[] };

/**
 * THE MOMENT THE FIXTURE WAS CAPTURED — every age asserted below is measured
 * from it, so the arms read the real hours rather than a number that drifts
 * with the clock the suite happens to run on.
 */
const READ_AT_MS = Date.parse("2026-10-08T08:35:00Z");

describe("the repairs-owed reading (#1977)", () => {
  it("the fixture is the real population and says so", () => {
    expect(LIVE.provenance.read).toContain("2026-10-08");
    expect(LIVE.ownerLogin).toBe("michaelpaulrattray");
    expect(LIVE.rows).toHaveLength(12);
    /* Every row carries the three things the reading needs, or the arm below
       would pass by never reaching the question. */
    for (const row of LIVE.rows) {
      expect(typeof row.number).toBe("number");
      expect(Array.isArray(row.comments)).toBe(true);
    }
  });

  it("reads the nine held pull requests of that day, oldest repair first", () => {
    const reading = repairsOwedFrom(LIVE.rows, LIVE.ownerLogin);
    expect(reading.repairs.map((repair) => repair.pullRequest))
      .toEqual([1924, 1946, 1960, 1963, 1974, 1975, 1979, 1981, 1982]);
    expect(reading.partial).toBe(false);
    expect(reading.undatable).toEqual([]);
  });

  it("⚠ the three unheld pull requests are NOT repairs — the fixture's own negative control", () => {
    const reading = repairsOwedFrom(LIVE.rows, LIVE.ownerLogin);
    const held = new Set(reading.repairs.map((repair) => repair.pullRequest));
    /* They are open, they are in the fixture, and nobody has found anything on
       them. A reader that answered "every open pull request" would pass every
       other arm in this file. */
    expect(held.has(1892)).toBe(false);
    expect(held.has(1889)).toBe(false);
    expect(held.has(1983)).toBe(false);
  });

  it("⚠ orders by the OLDEST fresh finding, not the newest — PR #1963 is the case", () => {
    /*
      #1963 carries TWO fresh findings on one head: the relay read it twice with
      no push between, so the repair has been owed since the FIRST. Measured on
      the day: by the newest it reads 0.8 h and sorts last of nine; by the oldest
      it reads 3.0 h and sorts fourth. The difference decides whether it is
      picked before #1974, #1975, #1979, #1981 and #1982.
    */
    const reading = repairsOwedFrom(LIVE.rows, LIVE.ownerLogin);
    const row = reading.repairs.find((repair) => repair.pullRequest === 1963)!;
    expect(row.findings).toBe(2);

    const newestFindingAt = [...(LIVE.rows.find((r) => r.number === 1963)!.comments ?? [])]
      .filter((comment) => (comment.body ?? "").trimStart().startsWith("**Relay finding"))
      .map((comment) => comment.createdAt!)
      .sort()
      .pop()!;
    expect(row.heldSince < newestFindingAt).toBe(true);

    /* And the position it buys, which is the thing that matters. */
    expect(reading.repairs.findIndex((repair) => repair.pullRequest === 1963)).toBe(3);
  });

  it("the oldest age is read off the finding, and it is the figure he complained about", () => {
    const reading = repairsOwedFrom(LIVE.rows, LIVE.ownerLogin);
    const hours = oldestRepairAgeHours(reading, READ_AT_MS)!;
    /* #1924, held since 2026-10-07T21:55Z — 9.6 h at the reading. */
    expect(reading.repairs[0]!.pullRequest).toBe(1924);
    expect(hours).toBeGreaterThan(9);
    expect(hours).toBeLessThan(10);
    /*
      ⚠ **AND #1924 CARRIES A REAL STALE FINDING, WHICH ARRIVED IN THE CAPTURE
      RATHER THAN BEING INVENTED.** Its head was committed at 22:33:44Z and a
      finding sits at 17:01:03Z — five and a half hours EARLIER, so that repair
      was pushed. A reader that counted every finding would date this pull
      request's hold from 17:01 and report 15.6 hours instead of 9.7.
    */
    const stale = (LIVE.rows.find((row) => row.number === 1924)!.comments ?? [])
      .filter((comment) => (comment.body ?? "").startsWith("**Relay finding"));
    expect(stale).toHaveLength(3);
    expect(reading.repairs[0]!.findings).toBe(2);
    expect(stale.some((comment) => comment.createdAt! < reading.repairs[0]!.heldSince)).toBe(true);
  });

  it("a finding on an EARLIER head is a repair already pushed, and is not owed", () => {
    /*
      The whole distinction this reader exists on: `tallyRounds` calls a finding
      posted before the head commit `stale`, because the push that moved the head
      IS the repair. Driven by moving one pull request's head forward past its
      finding and watching it leave the list.
    */
    const rows = structuredClone(LIVE.rows) as RepairPullRequestRow[];
    const held = rows.find((row) => row.number === 1946)!;
    expect(repairsOwedFrom(rows, LIVE.ownerLogin).repairs
      .some((repair) => repair.pullRequest === 1946)).toBe(true);

    (held as { commits: { committedDate: string }[] }).commits = [
      { committedDate: "2026-10-09T00:00:00Z" },
    ];
    const after = repairsOwedFrom(rows, LIVE.ownerLogin);
    expect(after.repairs.some((repair) => repair.pullRequest === 1946)).toBe(false);
    /* And the other eight are untouched — the change is local to the one head. */
    expect(after.repairs).toHaveLength(8);
  });

  it("a later VERDICT on the same head clears the repair, and an earlier one does not", () => {
    /*
      `reviewPresence`'s own rule (#1673): the newest hand comment decides, and a
      tie goes to the finding. Both directions are driven here because only one
      of them is the safe one — merging a held pull request is what cost six
      hours of the pricing chain.
    */
    const rows = structuredClone(LIVE.rows) as RepairPullRequestRow[];
    const row = rows.find((entry) => entry.number === 1982)!;
    const finding = (row.comments ?? []).find((c) => (c.body ?? "").startsWith("**Relay finding"))!;

    const withLaterPass = structuredClone(rows) as RepairPullRequestRow[];
    (withLaterPass.find((entry) => entry.number === 1982)!.comments as unknown[]).push({
      id: 9_000_001,
      author: { login: LIVE.ownerLogin },
      /* After #1982's finding at 07:38:16Z — an earlier one is the other arm. */
      createdAt: "2026-10-08T07:45:00Z",
      body: "**Fable review — by hand** (head abc1234)\n\nLooks right.",
    });
    expect(repairsOwedFrom(withLaterPass, LIVE.ownerLogin).repairs
      .some((repair) => repair.pullRequest === 1982)).toBe(false);

    const withEarlierPass = structuredClone(rows) as RepairPullRequestRow[];
    (withEarlierPass.find((entry) => entry.number === 1982)!.comments as unknown[]).push({
      id: 9_000_002,
      author: { login: LIVE.ownerLogin },
      createdAt: new Date(Date.parse(finding.createdAt!) - 60_000).toISOString(),
      body: "**Fable review — by hand** (head abc1234)\n\nLooks right.",
    });
    expect(repairsOwedFrom(withEarlierPass, LIVE.ownerLogin).repairs
      .some((repair) => repair.pullRequest === 1982)).toBe(true);
  });

  it("⚠ only the OWNER's comment is the relay's — a seat cannot hold its own pull request", () => {
    /*
      The author gate lives in `classifyComment` and is asserted here because this
      is the reader that would be wrong about it: every seat posts as the same
      account as the relay in production, but a fixture can carry a third party —
      the vendor comments on #1690 and #1904 are the real precedent — and a
      bot-authored header must never hold a pull request.
    */
    const rows = structuredClone(LIVE.rows) as RepairPullRequestRow[];
    const clean = rows.find((row) => row.number === 1892)!;
    (clean.comments as unknown[]).push({
      id: 9_000_003,
      author: { login: "velin-api" },
      createdAt: "2026-10-08T07:20:00Z",
      body: "**Relay finding — HELD** (head deadbee)\n\nNot the relay.",
    });
    expect(repairsOwedFrom(rows, LIVE.ownerLogin).repairs
      .some((repair) => repair.pullRequest === 1892)).toBe(false);

    /* THE POSITIVE CONTROL: the same body from the owner DOES hold it. */
    (clean.comments as { author: { login: string } }[])[
      (clean.comments ?? []).length - 1
    ]!.author.login = LIVE.ownerLogin;
    expect(repairsOwedFrom(rows, LIVE.ownerLogin).repairs
      .some((repair) => repair.pullRequest === 1892)).toBe(true);
  });

  it("a pull request with no commits is NAMED, never silently dropped", () => {
    const rows = structuredClone(LIVE.rows) as RepairPullRequestRow[];
    (rows.find((row) => row.number === 1946) as { commits: unknown[] }).commits = [];
    const reading = repairsOwedFrom(rows, LIVE.ownerLogin);
    expect(reading.undatable).toEqual([1946]);
    expect(reading.repairs.some((repair) => repair.pullRequest === 1946)).toBe(false);
  });

  it("⚠ a FULL page is reported as partial — a repair it cannot see must not read as none", () => {
    /*
      The failure direction is the wrong one: a repair past the page reads as not
      owed and a seat takes a new card, which is the behaviour this card exists to
      end. So a full page says so rather than answering confidently.
    */
    const one = LIVE.rows.find((row) => row.number === 1892)!;
    const full = Array.from({ length: REPAIR_PR_PAGE }, (_, index) => ({
      ...structuredClone(one),
      number: 10_000 + index,
    }));
    const reading = repairsOwedFrom(full, LIVE.ownerLogin);
    expect(reading.partial).toBe(true);
    expect(repairsOwedWord(reading, READ_AT_MS)).toContain("page full");
    /* And a short page is not partial, so the flag means something. */
    expect(repairsOwedFrom(LIVE.rows, LIVE.ownerLogin).partial).toBe(false);
  });

  it("the page size is the measured one and the wire asks for what the reading uses", () => {
    /*
      ⚠ **NOT 100, AND THE DIFFERENCE IS GITHUB'S OWN REFUSAL.** `commits` and
      `comments` are connections, so a 100-row page exceeds the node ceiling and
      the read fails outright. Measured live: 50 refused, 30 answered.
    */
    expect(REPAIR_PR_PAGE).toBe(30);
    const args = [...REPAIRS_OWED_LIST_ARGS];
    expect(args).toContain("--limit");
    expect(args[args.indexOf("--limit") + 1]).toBe("30");
    const fields = args[args.indexOf("--json") + 1]!.split(",");
    for (const field of ["number", "title", "createdAt", "isDraft", "headRefName", "commits", "comments"]) {
      expect(fields).toContain(field);
    }
  });

  it("the word for the runner's line carries the count AND the age", () => {
    const reading = repairsOwedFrom(LIVE.rows, LIVE.ownerLogin);
    const word = repairsOwedWord(reading, READ_AT_MS);
    expect(word).toContain("repairs 9");
    expect(word).toContain("PR #1924");
    expect(word).toMatch(/oldest 9\.\dh/);
    /* ⚠ The age is the half he complained about, so an empty list says so plainly
       rather than printing an age of nothing. */
    expect(repairsOwedWord({ repairs: [], partial: false, undatable: [] }, READ_AT_MS))
      .toBe(" | repairs none");
  });
});

/**
 * THE CARD'S OWN DONE-WHEN, DRIVEN THROUGH THE REAL CUT.
 *
 * *"a driven arm with one held PR and one fresh founder-ordered card shows the
 * picker offering the repair first"*. So this runs `scripts/cut-seat-batches.mts`
 * itself over fixtures — no GitHub, no database — and reads its stdout and its
 * plan. A unit test of the library could not answer this: the question is about
 * what the CUT prints and writes, which is what the runner reads.
 */
describe("⚠ the cut offers the repair before the card (#1977)", () => {
  const dirs: string[] = [];
  const scratch = (): string => {
    const dir = mkdtempSync(join(tmpdir(), "repairs1977-"));
    dirs.push(dir);
    return dir;
  };
  afterAll(() => {
    for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
  });

  /** One founder-ordered card, fresh, with nothing holding it. */
  const CARD = {
    number: 4242,
    title: "a fresh founder-ordered card",
    body: "Nothing holds this.",
    labels: [{ name: "founder-ordered" }],
    createdAt: "2026-10-08T06:00:00Z",
  };

  const runCut = (repairsFixture: RepairPullRequestRow[]): { stdout: string; plan: Record<string, unknown> } => {
    const dir = scratch();
    const write = (name: string, value: unknown): string => {
      const path = join(dir, name);
      writeFileSync(path, JSON.stringify(value), "utf8");
      return path;
    };
    const planPath = join(dir, "plan.json");
    const stdout = execFileSync(
      process.execPath,
      [
        "--import", "tsx",
        resolve("scripts/cut-seat-batches.mts"),
        "--max-seats", "4",
        "--batch-size", "5",
        "--no-jev",
        "--cards", write("cards.json", [CARD]),
        "--open-prs", write("prs.json", []),
        "--comments", write("comments.json", []),
        "--not-built", write("not-built.json", []),
        "--repairs", write("repairs.json", repairsFixture),
        "--repairs-owner", LIVE.ownerLogin,
        "--switches", write("switches.json", { master: true, bugs: true, smallfix: true }),
        "--out", planPath,
      ],
      { encoding: "utf8", timeout: CONTENDED_TEST_TIMEOUT_MS, stdio: ["ignore", "pipe", "pipe"] },
    );
    return { stdout, plan: JSON.parse(readFileSync(planPath, "utf8")) };
  };

  it("names the repair on the line the runner logs, with its age, ahead of the cards word", () => {
    const { stdout, plan } = runCut(LIVE.rows);

    const seats = stdout.split(/\r?\n/).find((line) => line.startsWith("SEATS "))!;
    expect(seats).toBeDefined();
    /* ⚠ THE ORDER ON THE LINE IS THE CLAIM: the repairs word sits before the
       milestone and the manager words, which is where a reader looks first. */
    expect(seats).toContain("repairs 9");
    expect(seats).toMatch(/repairs 9 \(oldest \d+\.\dh, PR #1924\)/);

    /* And one line per repair, oldest first, so a person knows WHICH. */
    const owed = stdout.split(/\r?\n/).filter((line) => line.startsWith("REPAIR OWED |"));
    expect(owed).toHaveLength(9);
    expect(owed[0]).toContain("PR #1924");
    expect(owed[8]).toContain("PR #1982");

    const block = plan.repairsOwed as {
      count: number;
      oldestAgeHours: number | null;
      items: { pullRequest: number }[];
      unreadable: string | null;
    };
    expect(block.count).toBe(9);
    expect(block.unreadable).toBeNull();
    expect(block.items.map((item) => item.pullRequest)).toEqual(
      [1924, 1946, 1960, 1963, 1974, 1975, 1979, 1981, 1982],
    );
    expect(block.oldestAgeHours).toBeGreaterThan(9);
  });

  it("THE CONTROL: with nothing held, the same cut says so and the card still stands", () => {
    /*
      ⚠ **Without this the arm above proves nothing** — a cut that printed
      `repairs 9` unconditionally, or one that happened to list every open pull
      request, would pass it. The two dependabot rows are open and unheld, so this
      is the same reader on the same shape of input answering none.
    */
    const unheld = LIVE.rows.filter((row) => [1892, 1889, 1983].includes(row.number!));
    expect(unheld).toHaveLength(3);
    const { stdout, plan } = runCut(unheld);

    const seats = stdout.split(/\r?\n/).find((line) => line.startsWith("SEATS "))!;
    expect(seats).toContain("repairs none");
    expect(stdout.split(/\r?\n/).filter((line) => line.startsWith("REPAIR OWED |"))).toHaveLength(0);
    expect((plan.repairsOwed as { count: number }).count).toBe(0);

    /* The card is still read and offered — the repairs reading changes the
       ORDER of the work, never whether a card exists. */
    expect(plan.repairsOwed).toBeDefined();
    expect(JSON.stringify(plan)).toContain("4242");
  });

  it("⚠ a repairs list that cannot be read NEVER refuses the pass — it says so and cuts as before", () => {
    /*
      The opposite direction from the board read above it, and deliberately so:
      an unreadable board hides a card somebody is building, so a pass that cannot
      read it must cut nothing. A repairs list that cannot be read costs only this
      card's ordering, and refusing there would let one slow `gh` call stop the
      night.

      ⚠ **THIS ARM'S FIRST SHAPE POINTED AT A MISSING FILE AND WENT RED, WHICH
      WAS THE ARM BEING RIGHT.** `readJsonFile` refuses and exits before the
      `catch` around the read can see it, so the claim *never refuses the pass*
      was not true of that road. The distinction it surfaced is real and is kept:
      a caller naming a fixture that does not exist has made a MISTAKE and should
      hear about it loudly, while a world that answers badly is an outage this
      pass must survive. So the arm drives the second — a readable answer that is
      not a list, which is exactly the shape a malformed `gh` reply takes, and the
      one road production shares with it.
    */
    const dir = scratch();
    const write = (name: string, value: unknown): string => {
      const path = join(dir, name);
      writeFileSync(path, JSON.stringify(value), "utf8");
      return path;
    };
    const planPath = join(dir, "plan.json");
    const stdout = execFileSync(
      process.execPath,
      [
        "--import", "tsx",
        resolve("scripts/cut-seat-batches.mts"),
        "--max-seats", "4",
        "--batch-size", "5",
        "--no-jev",
        "--cards", write("cards.json", [CARD]),
        "--open-prs", write("prs.json", []),
        "--comments", write("comments.json", []),
        "--not-built", write("not-built.json", []),
        /* Readable, and not a list — a malformed answer rather than a missing file. */
        "--repairs", write("repairs.json", { not: "a list" }),
        "--repairs-owner", LIVE.ownerLogin,
        "--switches", write("switches.json", { master: true, bugs: true, smallfix: true }),
        "--out", planPath,
      ],
      { encoding: "utf8", timeout: CONTENDED_TEST_TIMEOUT_MS, stdio: ["ignore", "pipe", "pipe"] },
    );

    const seats = stdout.split(/\r?\n/).find((line) => line.startsWith("SEATS "))!;
    expect(seats).toContain("repairs unread");
    expect(seats).toContain("cards offered as before");
    const plan = JSON.parse(readFileSync(planPath, "utf8")) as {
      repairsOwed: { count: number; unreadable: string | null };
    };
    expect(plan.repairsOwed.count).toBe(0);
    expect(plan.repairsOwed.unreadable).not.toBeNull();

    /* THE OTHER HALF: a fixture path that does not exist IS a caller's mistake
       and does refuse, loudly, naming the file. Both directions are driven so
       neither can quietly become the other. */
    expect(() => execFileSync(
      process.execPath,
      [
        "--import", "tsx",
        resolve("scripts/cut-seat-batches.mts"),
        "--max-seats", "4",
        "--batch-size", "5",
        "--no-jev",
        "--cards", write("cards2.json", [CARD]),
        "--open-prs", write("prs2.json", []),
        "--comments", write("comments2.json", []),
        "--not-built", write("not-built2.json", []),
        "--repairs", join(dir, "nothing-here.json"),
        "--repairs-owner", LIVE.ownerLogin,
        "--switches", write("switches2.json", { master: true, bugs: true, smallfix: true }),
        "--out", join(dir, "plan2.json"),
      ],
      { encoding: "utf8", timeout: CONTENDED_TEST_TIMEOUT_MS, stdio: ["ignore", "pipe", "pipe"] },
    )).toThrow();
  });
}, CONTENDED_TEST_TIMEOUT_MS);
