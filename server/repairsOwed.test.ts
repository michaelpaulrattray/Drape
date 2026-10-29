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

import { afterAll, describe, expect, it, vi } from "vitest";

import { CHILD_PROCESS_TEST_TIMEOUT_MS } from "./testing/childProcessTimeout";

import {
  oldestRepairAgeHours,
  REPAIR_PR_PAGE,
  REPAIRS_OWED_LIST_ARGS,
  repairCardClaims,
  repairClaimWord,
  repairsOwedFrom,
  repairsOwedWord,
  type RepairPullRequestRow,
} from "../scripts/lib/repairsOwed.mts";
import { factsFromRows } from "../scripts/lib/cardBuildState.mts";
import { CREW_CLAIM_LIVE_MS, pullRequestBuildsCard } from "../shared/crewCardBuildState";

/**
 * ⚠ **A SPAWNING SUITE TAKES THE CLASS'S OWN TIMEOUT, NOT ONE OF ITS OWN.**
 * The cut arm below runs a real `tsx` process, and `childProcessTestTimeouts`
 * holds every such suite to this exact pair — which is the point: a suite that
 * invented its own number would be a second declaration of one rule, and the
 * first shape of this file did precisely that and went red for it.
 */
vi.setConfig({ testTimeout: CHILD_PROCESS_TEST_TIMEOUT_MS });

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
    /*
      ⚠ **WHICH LIMB THIS PINS, SAID PRECISELY BECAUSE SABOTAGE MEASURED IT.**
      Removing the `reviewPresence` check entirely left this arm GREEN: a pull
      request nobody has found anything on carries no findings at all, so the
      `if (!oldest) continue;` below it already excludes these three. What this
      arm guards is THAT limb. The `reviewPresence` limb is guarded by the
      verdict-ordering arm below, which is the only one that reddened — and it
      is the limb that matters, because a pull request the relay found something
      on and then PASSED still has findings on it.
    */
    const reading = repairsOwedFrom(LIVE.rows, LIVE.ownerLogin);
    const held = new Set(reading.repairs.map((repair) => repair.pullRequest));
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

  const runCut = (
    repairsFixture: RepairPullRequestRow[],
    /* The board and the card comments, for the #2769 arms below. Defaulted, so
       every arm written before that card reads exactly as it did. */
    extra?: { readonly cards?: readonly unknown[]; readonly comments?: readonly unknown[] },
  ): { stdout: string; plan: Record<string, unknown> } => {
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
        "--cards", write("cards.json", extra?.cards ?? [CARD]),
        "--open-prs", write("prs.json", []),
        "--comments", write("comments.json", extra?.comments ?? []),
        "--not-built", write("not-built.json", []),
        "--repairs", write("repairs.json", repairsFixture),
        "--repairs-owner", LIVE.ownerLogin,
        "--switches", write("switches.json", { master: true, bugs: true, smallfix: true }),
        "--out", planPath,
      ],
      { encoding: "utf8", timeout: CHILD_PROCESS_TEST_TIMEOUT_MS, stdio: ["ignore", "pipe", "pipe"] },
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

  /*
    ── AND WHOSE HANDS ARE ALREADY ON IT (#2769) ───────────────────────────────

    The repairs road never asked. A repair is handed out as a PULL REQUEST, so
    the seat never declares a card and not one of the three claim readers is ever
    reached; the measured instance cost one Opus session producing one comment,
    over a claim that was six minutes old and perfectly readable.

    These arms drive the REAL cut, because the question is what the cut PRINTS
    and WRITES — the library cannot answer it, and the line the runner actually
    logs is the one that matters: `foreman-runner.ps1` pipes this stdout through
    `Where-Object { $_ -match "^SEATS " }` and keeps the last match, so a claim
    named anywhere else reaches nobody on the automated road.
  */
  /** The cards two of the fixture's held pull requests name, open on the board. */
  const CARD_1903 = { ...CARD, number: 1903, title: "a paid redo of a signed package" };
  const CARD_1937 = { ...CARD, number: 1937, title: "a plan-change move" };

  /** A claim comment as the REST listing hands one back (`cardActivity`'s captured shape). */
  const claimRow = (issue: number, seat: string, at: string): unknown => ({
    issue_url: `https://api.github.com/repos/michaelpaulrattray/Drape/issues/${issue}`,
    user: { login: LIVE.ownerLogin },
    created_at: at,
    updated_at: at,
    body: `CLAIMED — ${seat}, ${at}\n`,
  });
  /* ⚠ The CUT reads `Date.now()`, so a claim that must be LIVE is written
     against the real clock rather than against `READ_AT_MS` — which is weeks
     behind by now and would make every claim here stale. */
  const ago = (ms: number): string => new Date(Date.now() - ms).toISOString().replace(/\.\d{3}Z$/, "Z");

  it("names the card each repair is for, and the live claim sitting on it", () => {
    const { stdout, plan } = runCut(LIVE.rows, {
      cards: [CARD, CARD_1903, CARD_1937],
      comments: [claimRow(1903, "seat1-20261029-095243", ago(6 * 60 * 1000))],
    });

    /* THE LINE THE RUNNER LOGS — the seat and the age, never a bare count: a
       claim six minutes old is somebody at a keyboard and an eleven-hour one is
       a shift that never released, and those want opposite actions. */
    const seats = stdout.split(/\r?\n/).find((line) => line.startsWith("SEATS "))!;
    expect(seats).toContain("repair claims: PR #1924 -> card #1903 claimed by seat1-20261029-095243");
    expect(seats).toMatch(/claimed by seat1-20261029-095243 \dm ago/);

    /* THE LINE A PERSON READS, which carries the timestamp too. */
    const owed = stdout.split(/\r?\n/).filter((line) => line.startsWith("REPAIR OWED |"));
    expect(owed[0]).toContain("card #1903");
    expect(owed[0]).toContain("⚠ #1903 CLAIMED by seat1-20261029-095243 at ");
    /* The next repair's card is named and carries no claim — the same line, the
       other answer, so the arm cannot pass by printing the warning always. */
    expect(owed[1]).toContain("card #1937");
    expect(owed[1]).not.toContain("CLAIMED");

    /* THE MACHINE-READABLE HALF: the runner builds its own sentence out of these
       fields, and the one line that prints `claim` is the relay's to land. */
    const items = (plan.repairsOwed as {
      items: {
        pullRequest: number;
        cards: number[];
        claim: { card: number; claims: { seat: string | null; at: string }[] } | null;
      }[];
    }).items;
    expect(items[0]!.pullRequest).toBe(1924);
    expect(items[0]!.cards).toEqual([1903]);
    expect(items[0]!.claim).toMatchObject({ card: 1903 });
    expect(items[0]!.claim!.claims.map((entry) => entry.seat)).toEqual(["seat1-20261029-095243"]);
    expect(items[1]!.cards).toEqual([1937]);
    expect(items[1]!.claim).toBeNull();
  });

  it("THE CONTROL: the same cut over the same repairs, with no claim, says nothing about claims", () => {
    /*
      ⚠ **Without this the arm above proves only that a sentence can be printed.**
      Same nine repairs, same board, no comment on any card: every claim fact
      must disappear and the cards must still be named — which is also the
      measurement saying this road is SILENT in the ordinary case rather than a
      line every pass has to read past.
    */
    const { stdout, plan } = runCut(LIVE.rows, { cards: [CARD, CARD_1903, CARD_1937], comments: [] });
    const seats = stdout.split(/\r?\n/).find((line) => line.startsWith("SEATS "))!;
    expect(seats).toContain("repairs 9");
    expect(seats).not.toContain("repair claims");
    const owed = stdout.split(/\r?\n/).filter((line) => line.startsWith("REPAIR OWED |"));
    expect(owed[0]).toContain("card #1903");
    expect(owed[0]).not.toContain("CLAIMED");
    const items = (plan.repairsOwed as { items: { cards: number[]; claim: unknown }[] }).items;
    expect(items[0]!.cards).toEqual([1903]);
    expect(items[0]!.claim).toBeNull();
  });

  it("⚠ a repair whose title names no OPEN card is silent, and says so to a person", () => {
    /*
      The failure direction this derivation is allowed to have. A dependabot bump
      names no card at all, and a pull request whose card has closed names none
      that is open — in both cases the road behaves exactly as it did before this
      card existed, and the per-repair line says which.
    */
    const { stdout, plan } = runCut(LIVE.rows, { cards: [CARD], comments: [] });
    const seats = stdout.split(/\r?\n/).find((line) => line.startsWith("SEATS "))!;
    expect(seats).not.toContain("repair claims");
    const owed = stdout.split(/\r?\n/).filter((line) => line.startsWith("REPAIR OWED |"));
    expect(owed).toHaveLength(9);
    for (const line of owed) expect(line).toContain("no open card named in its title");
    const items = (plan.repairsOwed as { items: { cards: number[]; claim: unknown }[] }).items;
    for (const item of items) {
      expect(item.cards).toEqual([]);
      expect(item.claim).toBeNull();
    }
  });

  it("⚠ IT NEVER WITHHOLDS A REPAIR — a claimed card changes the words and nothing else", () => {
    /*
      The card's own asymmetry, and the one thing these arms exist to protect: a
      held pull request with a repair owed is the highest-priority work on the
      board (his word, #1977), so a stale or a foreign claim must never be able
      to stall one. Driven as an equality rather than asserted: the repair list,
      its order and the seat count are identical with and without the claim.
    */
    const withClaim = runCut(LIVE.rows, {
      cards: [CARD, CARD_1903, CARD_1937],
      comments: [claimRow(1903, "seat1", ago(6 * 60 * 1000))],
    });
    const without = runCut(LIVE.rows, { cards: [CARD, CARD_1903, CARD_1937], comments: [] });

    const owedOrder = (plan: Record<string, unknown>): number[] =>
      (plan.repairsOwed as { items: { pullRequest: number }[] }).items.map((item) => item.pullRequest);
    expect(owedOrder(withClaim.plan)).toEqual(owedOrder(without.plan));
    expect((withClaim.plan as unknown as { seatCount: number }).seatCount)
      .toBe((without.plan as unknown as { seatCount: number }).seatCount);
    expect((withClaim.plan as unknown as { repairsOwed: { count: number } }).repairsOwed.count).toBe(9);
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
      { encoding: "utf8", timeout: CHILD_PROCESS_TEST_TIMEOUT_MS, stdio: ["ignore", "pipe", "pipe"] },
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
      { encoding: "utf8", timeout: CHILD_PROCESS_TEST_TIMEOUT_MS, stdio: ["ignore", "pipe", "pipe"] },
    )).toThrow();
  });
});

/**
 * WHOSE HANDS ARE ON A REPAIR'S CARD — the reading, over the same real
 * population (#2769).
 *
 * ⚠ **THE POPULATION IS THE NINE HELD PULL REQUESTS OF 2026-10-08, not the
 * merged history.** The card's premise is that a repair's card can be derived at
 * all, and the only population that settles it is the one a repair hand-out
 * actually walks. Measured here: **9 of 9 resolve exactly one card** from the
 * title, and the fixture's two dependabot rows resolve NONE. (Over the 120
 * newest merged pull requests the same reader holds at 114 of 120 — 4 name no
 * card, 2 genuinely built two. That proxy is recorded in
 * `scripts/lib/repairsOwed.mts`'s own block and is not what these arms drive.)
 */
describe("the card behind a repair, and the claim on it (#2769)", () => {
  const HELD = repairsOwedFrom(LIVE.rows, LIVE.ownerLogin).repairs;
  /** Every card the fixture's own titles name — the board, as it stood. */
  const BOARD = [1903, 1937, 1954, 1936, 1959, 1941, 1961, 1962, 1966, 1971];
  const NOW = Date.parse("2026-10-29T00:00:00Z");

  const claimFact = (card: number, seat: string, at: string): unknown => ({
    issue_url: `https://api.github.com/repos/michaelpaulrattray/Drape/issues/${card}`,
    user: { login: LIVE.ownerLogin },
    created_at: at,
    updated_at: at,
    body: `CLAIMED — ${seat}, ${at}\n`,
  });
  const releaseFact = (card: number, seat: string, at: string): unknown => ({
    ...(claimFact(card, seat, at) as Record<string, unknown>),
    body: `RELEASED — ${seat}, ${at}\n`,
  });
  const refusalFact = (card: number, at: string): unknown => ({
    ...(claimFact(card, "x", at) as Record<string, unknown>),
    body: "**NOT BUILT — the premise is wrong against the code, seat-janitor.**\n",
  });

  it("all nine held pull requests of that day resolve exactly ONE open card", () => {
    const read = repairCardClaims({ repairs: HELD, openCards: BOARD, facts: [], nowMs: NOW });
    expect(read).toHaveLength(9);
    for (const row of read) expect(row.cards).toHaveLength(1);
    expect(read.map((row) => [row.pullRequest, row.cards[0]])).toEqual([
      [1924, 1903], [1946, 1937], [1960, 1954], [1963, 1936], [1974, 1959],
      [1975, 1941], [1979, 1961], [1981, 1962], [1982, 1966],
    ]);
  });

  it("THE NEGATIVE CONTROL: the fixture's two dependabot rows name no card", () => {
    /* They are in the fixture precisely so this control needs no invention:
       `chore(deps): Bump cookie from 1.0.2 to 2.0.1` carries version digits and
       must still resolve nothing. */
    const bumps = LIVE.rows.filter((row) => [1892, 1889].includes(row.number!));
    expect(bumps).toHaveLength(2);
    for (const row of bumps) {
      const found = BOARD.filter((card) =>
        pullRequestBuildsCard({ number: row.number!, title: row.title! }, card).length > 0);
      expect(found).toEqual([]);
    }
  });

  it("⚠ THE BRANCH LIMB IS NOT USED, and a seat branch is why", () => {
    /*
      `pullRequestBuildsCard` matches any digit RUN in a branch name, so a branch
      called `team/seat-1-20261029-0105` resolves card #1 — for every seat branch
      in the repository. This reading passes the TITLE alone, which is
      `shared/crewShippedNotClosed.ts`'s own narrowing; the arm proves the
      narrowing is live here rather than incidental.
    */
    const repair = {
      pullRequest: 9001,
      title: "fix(crew): something with no card in its title",
      headRefName: "team/seat-1-20261029-0105",
      draft: false,
      heldSince: "2026-10-28T23:00:00Z",
      findings: 1,
    };
    expect(pullRequestBuildsCard({ number: 9001, headRefName: repair.headRefName }, 1)).toContain("branch");
    const read = repairCardClaims({ repairs: [repair], openCards: [1, 20261029], facts: [], nowMs: NOW });
    expect(read[0]!.cards).toEqual([]);
  });

  it("a live claim on the card is reported with its seat and its time", () => {
    const facts = factsFromRows([claimFact(1903, "seat1-20261029-095243", "2026-10-28T23:54:00Z")]);
    expect(facts).toHaveLength(1);
    const read = repairCardClaims({ repairs: HELD, openCards: BOARD, facts, nowMs: NOW });
    expect(read[0]!.claim).toEqual({
      card: 1903,
      claims: [{ seat: "seat1-20261029-095243", at: "2026-10-28T23:54:00Z" }],
    });
    /* And only that one — eight repairs with nothing said about their cards. */
    expect(read.filter((row) => row.claim !== null)).toHaveLength(1);
  });

  it("⚠ a claim past the live window is not a claim — the same twelve hours a seat applies", () => {
    const inside = NOW - (CREW_CLAIM_LIVE_MS - 60_000);
    const outside = NOW - (CREW_CLAIM_LIVE_MS + 60_000);
    const at = (ms: number): string => new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");
    expect(repairCardClaims({
      repairs: HELD,
      openCards: BOARD,
      nowMs: NOW,
      facts: factsFromRows([claimFact(1903, "seat1", at(inside))]),
    })[0]!.claim).not.toBeNull();
    expect(repairCardClaims({
      repairs: HELD,
      openCards: BOARD,
      nowMs: NOW,
      facts: factsFromRows([claimFact(1903, "seat1", at(outside))]),
    })[0]!.claim).toBeNull();
  });

  it("⚠ THE NEWEST FACT WINS, NOT THE NEWEST CLAIM — a release or a refusal after it is silence", () => {
    /*
      The direction that costs a session: reporting a claim its own seat has
      already released reads as hands on work that is free. Both facts that put a
      card back on offer are driven, and the claim they follow is inside the
      window in each case — so the arm cannot pass by the claim merely having
      aged out.
    */
    const released = factsFromRows([
      claimFact(1903, "seat1", "2026-10-28T22:00:00Z"),
      releaseFact(1903, "seat1", "2026-10-28T23:30:00Z"),
    ]);
    expect(repairCardClaims({ repairs: HELD, openCards: BOARD, facts: released, nowMs: NOW })[0]!.claim)
      .toBeNull();

    const refused = factsFromRows([
      claimFact(1903, "seat1", "2026-10-28T22:00:00Z"),
      refusalFact(1903, "2026-10-28T23:30:00Z"),
    ]);
    expect(repairCardClaims({ repairs: HELD, openCards: BOARD, facts: refused, nowMs: NOW })[0]!.claim)
      .toBeNull();

    /* AND THE POSITIVE HALF: the same two facts the other way round — a claim
       after a release — is a live claim, which is what makes the arms above a
       test of the ORDER rather than of the extra fact. */
    const reclaimed = factsFromRows([
      releaseFact(1903, "seat1", "2026-10-28T22:00:00Z"),
      claimFact(1903, "seat2", "2026-10-28T23:30:00Z"),
    ]);
    expect(repairCardClaims({ repairs: HELD, openCards: BOARD, facts: reclaimed, nowMs: NOW })[0]!
      .claim?.claims[0]?.seat).toBe("seat2");
  });

  it("the word for the runner's line: empty with nothing to say, the seat and the age when there is", () => {
    expect(repairClaimWord([], NOW)).toBe("");
    expect(repairClaimWord([{ pullRequest: 1924, cards: [1903], claim: null }], NOW)).toBe("");

    const minutes = repairClaimWord(
      [{ pullRequest: 1924, cards: [1903], claim: { card: 1903, claims: [{ seat: "seat1", at: "2026-10-28T23:54:00Z" }] } }],
      NOW,
    );
    expect(minutes).toBe(" | repair claims: PR #1924 -> card #1903 claimed by seat1 6m ago");

    const hours = repairClaimWord(
      [{ pullRequest: 1924, cards: [1903], claim: { card: 1903, claims: [{ seat: "seat1", at: "2026-10-28T13:00:00Z" }] } }],
      NOW,
    );
    expect(hours).toContain("11.0h ago");

    /* An unattributed claim is still somebody's — the asymmetry `readCardClaim`
       states: a missed claim costs an hour of a seat, a named one costs a word. */
    expect(repairClaimWord(
      [{ pullRequest: 1924, cards: [1903], claim: { card: 1903, claims: [{ seat: null, at: "2026-10-28T23:54:00Z" }] } }],
      NOW,
    )).toContain("a seat that did not name itself");
  });

  /**
   * ⚠ **A CONTESTED CARD NAMES BOTH SEATS HERE, AND EACH AGE (#2775).** This is
   * the line a person untangling a collision reads, and it is where the names
   * live now that his page counts rather than names them: it is a terminal line
   * with no cell to fit, where the 42-character bound on the page's phrase does
   * not apply.
   */
  it("two live claims on one card name both seats, each with its own age", () => {
    const word = repairClaimWord(
      [{
        pullRequest: 1924,
        cards: [1903],
        claim: {
          card: 1903,
          claims: [
            { seat: "seat1-20261029-095243", at: "2026-10-28T23:54:00Z" },
            { seat: "foreman-20261029-1005", at: "2026-10-28T13:00:00Z" },
          ],
        },
      }],
      NOW,
    );
    expect(word).toBe(
      " | repair claims: PR #1924 -> card #1903 claimed by seat1-20261029-095243 6m ago"
      + " and foreman-20261029-1005 11.0h ago",
    );
    /* ⚠ THE TWO AGES ARE THE POINT, not decoration: this function's own docblock
       says three minutes is somebody at a keyboard and eleven hours is a
       finished shift that never released — and on a contested card the two
       seats can be one of each, which is exactly what this row is. A reader
       given one name and one age could not have told those apart. */
    expect(word).toContain("6m ago");
    expect(word).toContain("11.0h ago");
  });
});
