import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * THE AUTO-ESCALATION GATE, DRIVEN (card #541, founder-ordered and urgent).
 *
 * `scripts/next-up-escalation.mts` answers one question at every shift launch:
 * is the next card a shift would take one that only Fable can take? Until it
 * existed, `awaiting-fable` was a hold with no road out — five of his own
 * ordered cards carried it, no `ESCALATE` marker had ever been written by
 * anything, and every shift took something smaller.
 *
 * The script is driven as a PROCESS, not imported: it ends in `process.exit`,
 * and the exit code is half of what a caller reads. `--queue` puts a fixture
 * where the live `gh` call goes and `--state` puts the no-repeat ledger in a
 * temp directory, so no arm here can touch the real queue, the real state file,
 * or the network.
 *
 * BOTH DIRECTIONS ON EVERY ARM (working law 2), and here the NEGATIVE ones
 * carry the weight, because this gate spends money when it says yes:
 *
 *  - a takeable card at the top must produce NO escalation (an Opus shift takes
 *    it), or every ordinary night becomes an expensive one;
 *  - an unreadable queue must produce NO escalation — an unauthenticated `gh`
 *    prints nothing, which looks exactly like an empty queue (#504's trap);
 *  - the same card twice running must produce NO second escalation, which is
 *    the card's own bar: *"a bug here must cost one session, never five."*
 *
 * THE LAST ARM IS THE ONE THAT KEEPS IT HONEST: it reads the sort out of BOTH
 * this script and `scripts/crew-desk-sweep.mts` and refuses if they differ.
 * The sweep's order is what his page shows him; a gate escalating a card that
 * is not visibly at the top of his own queue would be answering a different
 * question from the one he asked.
 */

const SCRIPT = resolve("scripts/next-up-escalation.mts");
const SWEEP = resolve("scripts/crew-desk-sweep.mts");

type Row = { number: number; title: string; labels: { name: string }[] };
type Result = { status: number; stdout: string; stderr: string; last: string };

let dir = "";

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "nextup-escalation-"));
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

function card(number: number, labels: string[], title = `card ${number}`): Row {
  return { number, title, labels: labels.map((name) => ({ name })) };
}

function queueFile(name: string, rows: Row[]): string {
  const path = join(dir, `${name}.json`);
  writeFileSync(path, JSON.stringify(rows), "utf8");
  return path;
}

function statePath(name: string): string {
  return join(dir, `${name}-state.json`);
}

function run(...args: string[]): Result {
  const proc = spawnSync("npx", ["tsx", SCRIPT, ...args], {
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  const stdout = String(proc.stdout ?? "");
  const lines = stdout.split(/\r?\n/).filter((line) => line.trim().length > 0);
  return {
    status: typeof proc.status === "number" ? proc.status : -1,
    stdout,
    stderr: String(proc.stderr ?? ""),
    last: lines.length === 0 ? "" : lines[lines.length - 1],
  };
}

/** The live shape at the moment this landed: #541 urgent, then his eight, oldest first. */
const LIVE_SHAPE: Row[] = [
  card(541, ["founder-ordered", "urgent", "seat:retro"], "the runner escalates on its own"),
  card(391, ["founder-ordered"], "his ladder ruling"),
  card(404, ["founder-ordered", "design-unbuilt", "blocked"], "the plan card's blurb slot"),
  card(508, ["founder-ordered", "awaiting-fable", "seat:retro"], "deploy on merge"),
  card(530, ["founder-ordered", "casting-upkeep"], "the sphinx-cat tail court"),
  card(534, ["founder-ordered", "awaiting-fable"], "the sheet never shows the machine's prompt"),
  card(535, ["founder-ordered", "awaiting-fable", "design-unbuilt"], "Re-imagine"),
  card(539, ["founder-ordered"], "MAX heat must never contradict a stated fact"),
];

describe("the escalation verdict", () => {
  it("escalates when the next card a shift would take is Fable-only, and names it", () => {
    /* #541 taken, #391 taken, #404 blocked → the next row is #508, awaiting-fable. */
    const queue = queueFile("fable-top", LIVE_SHAPE.filter((row) => ![541, 391].includes(row.number)));
    const result = run("--queue", queue, "--state", statePath("fable-top"), "--today", "2026-09-05");

    expect(result.last).toMatch(/^ESCALATE #508 /);
    expect(result.status).toBe(0);
  });

  it("names the takeable cards after it as bundle candidates, and never the held ones", () => {
    const queue = queueFile("bundle", LIVE_SHAPE.filter((row) => ![541, 391].includes(row.number)));
    const result = run("--queue", queue, "--state", statePath("bundle"), "--today", "2026-09-05");

    /* #530 and #539 are takeable and follow it; #534/#535 hold their own label
       and his order for those is one Fable session each. */
    expect(result.last).toContain("bundle=#530,#539");
    expect(result.last).not.toContain("#534");
    expect(result.last).not.toContain("#535");
  });

  it("does NOT escalate while a card an Opus shift can take sits above it", () => {
    /* The live queue on the day this shipped: #391 has no hold, so it is next. */
    const queue = queueFile("opus-top", LIVE_SHAPE.filter((row) => row.number !== 541));
    const result = run("--queue", queue, "--state", statePath("opus-top"), "--today", "2026-09-05");

    expect(result.last).toMatch(/^NONE: /);
    expect(result.last).toContain("#391");
    expect(result.status).toBe(1);
  });

  it("skips holds no seat can clear rather than stopping at them", () => {
    /* #404 is `blocked`; a Fable shift cannot clear that either, so the walk
       must continue past it to #508 rather than answering NONE. */
    const queue = queueFile("past-blocked", [
      card(404, ["founder-ordered", "blocked"]),
      card(508, ["founder-ordered", "awaiting-fable"]),
    ]);
    const result = run("--queue", queue, "--state", statePath("past-blocked"), "--today", "2026-09-05");

    expect(result.last).toMatch(/^ESCALATE #508 /);
  });

  it("does NOT escalate a card that is BOTH blocked and awaiting-fable", () => {
    /*
      THE ARM THE REVIEWER ASKED FOR, and it is the exact failure the card was
      written to prevent (PR #544, before merge). `heldStateFromLabels` collapses
      several holds to the ONE furthest from takeable, and `CREW_HOLD_ORDER`
      ranks `fable` ABOVE `blocked` — so a card carrying both resolved to
      "fable", and a gate reading the collapsed answer would have spent an
      expensive Fable session opening a card that cannot proceed.

      "Needs a design decision AND waits on something external" is an ordinary
      filing, not a corner. The repair reads EVERY held state
      (`heldStatesFromLabels`) rather than the one-word chip answer.
    */
    const queue = queueFile("blocked-and-fable", [
      card(534, ["founder-ordered", "blocked", "awaiting-fable"]),
    ]);
    const result = run("--queue", queue, "--state", statePath("blocked-and-fable"), "--today", "2026-09-05");

    expect(result.last).toMatch(/^NONE: /);
    expect(result.status).toBe(1);
  });

  it("walks PAST a blocked-and-fable card to the real next one", () => {
    /* The other direction: the pair must be SKIPPED, not treated as a wall. */
    const queue = queueFile("past-dual", [
      card(508, ["founder-ordered", "blocked", "awaiting-fable"]),
      card(534, ["founder-ordered", "awaiting-fable"]),
    ]);
    const result = run("--queue", queue, "--state", statePath("past-dual"), "--today", "2026-09-05");

    expect(result.last).toMatch(/^ESCALATE #534 /);
  });

  it("never offers a held card as a bundle candidate", () => {
    /* A bundle candidate is work the Fable sitting could also land; a card with
       ANY hold on it is not that, whichever hold collapsed to the top. */
    const queue = queueFile("bundle-holds", [
      card(534, ["founder-ordered", "awaiting-fable"]),
      card(540, ["founder-ordered", "blocked", "awaiting-fable"]),
      card(542, ["founder-ordered"]),
    ]);
    const result = run("--queue", queue, "--state", statePath("bundle-holds"), "--today", "2026-09-05");

    expect(result.last).toMatch(/^ESCALATE #534 /);
    expect(result.last).toContain("bundle=#542");
    expect(result.last).not.toContain("#540");
  });

  it("does NOT escalate when every ordered card is blocked or needs a sitting", () => {
    const queue = queueFile("all-held", [
      card(404, ["founder-ordered", "blocked"]),
      card(600, ["founder-ordered", "needs-sitting"]),
    ]);
    const result = run("--queue", queue, "--state", statePath("all-held"), "--today", "2026-09-05");

    expect(result.last).toMatch(/^NONE: /);
    expect(result.last).toContain("blocked or needs a sitting");
    expect(result.status).toBe(1);
  });

  it("does NOT escalate on an empty queue", () => {
    const queue = queueFile("empty", []);
    const result = run("--queue", queue, "--state", statePath("empty"), "--today", "2026-09-05");

    expect(result.last).toMatch(/^NONE: /);
    expect(result.status).toBe(1);
  });

  it("respects urgent-first, then oldest-first — not the order gh returns", () => {
    /* gh returns newest first. A sort on the number alone would put #700 last
       and escalate #508; the real order puts the urgent card first, and it is
       takeable, so nothing escalates. */
    const queue = queueFile("urgent-first", [
      card(700, ["founder-ordered", "urgent"], "an urgent card filed today"),
      card(508, ["founder-ordered", "awaiting-fable"]),
    ]);
    const result = run("--queue", queue, "--state", statePath("urgent-first"), "--today", "2026-09-05");

    expect(result.last).toMatch(/^NONE: /);
    expect(result.last).toContain("#700");
  });

  it("escalates an URGENT Fable card over an older takeable one", () => {
    /* The other direction of the same sort: urgency wins, so a takeable #391
       below an urgent Fable card must not suppress the escalation. */
    const queue = queueFile("urgent-fable", [
      card(391, ["founder-ordered"]),
      card(700, ["founder-ordered", "urgent", "awaiting-fable"]),
    ]);
    const result = run("--queue", queue, "--state", statePath("urgent-fable"), "--today", "2026-09-05");

    expect(result.last).toMatch(/^ESCALATE #700 /);
    expect(result.last).toContain("bundle=#391");
  });
});

describe("the no-repeat rule — one session, never five", () => {
  it("refuses a second automatic escalation of the same card", () => {
    const queue = queueFile("repeat", [card(534, ["founder-ordered", "awaiting-fable"])]);
    const state = statePath("repeat");

    const first = run("--queue", queue, "--state", state, "--today", "2026-09-05");
    expect(first.last).toMatch(/^ESCALATE #534 /);

    /* The runner records only AFTER it has written the marker — asking must
       never move the ledger, so the same ask twice still says ESCALATE. */
    const askedAgain = run("--queue", queue, "--state", state, "--today", "2026-09-05");
    expect(askedAgain.last).toMatch(/^ESCALATE #534 /);

    const recorded = run("--record", "534", "--state", state, "--today", "2026-09-05");
    expect(recorded.last).toContain("RECORDED #534");
    expect(recorded.status).toBe(0);

    const second = run("--queue", queue, "--state", state, "--today", "2026-09-05");
    expect(second.last).toMatch(/^NONE: /);
    expect(second.last).toContain("already auto-escalated once");
    expect(second.status).toBe(1);
  });

  it("still escalates a DIFFERENT card after one has been recorded", () => {
    const state = statePath("different");
    run("--record", "534", "--state", state, "--today", "2026-09-05");

    const queue = queueFile("different", [card(535, ["founder-ordered", "awaiting-fable"])]);
    const result = run("--queue", queue, "--state", state, "--today", "2026-09-05");

    expect(result.last).toMatch(/^ESCALATE #535 /);
  });

  it("counts the day's sessions, and the counter rolls at the day boundary", () => {
    const state = statePath("counter");

    expect(run("--record", "534", "--state", state, "--today", "2026-09-05").last)
      .toContain("auto-escalated today: 1");
    expect(run("--record", "535", "--state", state, "--today", "2026-09-05").last)
      .toContain("auto-escalated today: 2");
    expect(run("--record", "508", "--state", state, "--today", "2026-09-06").last)
      .toContain("auto-escalated today: 1");

    const ledger = JSON.parse(readFileSync(state, "utf8"));
    expect(ledger).toMatchObject({ lastCard: 508, day: "2026-09-06", countToday: 1 });
  });

  it("carries the day's count into the verdict, so the cost is on the line the runner reads", () => {
    const state = statePath("cost");
    run("--record", "534", "--state", state, "--today", "2026-09-05");

    const queue = queueFile("cost", [card(535, ["founder-ordered", "awaiting-fable"])]);
    expect(run("--queue", queue, "--state", state, "--today", "2026-09-05").last)
      .toContain("today=1");
  });
});

describe("it fails toward NOT spending", () => {
  it("answers NONE when the queue cannot be read at all", () => {
    /* An unauthenticated `gh` prints nothing, which looks exactly like an empty
       queue — so an unreadable queue must never be read as "no cards". */
    const result = run("--queue", join(dir, "does-not-exist.json"), "--state", statePath("unreadable"), "--today", "2026-09-05");

    expect(result.last).toMatch(/^NONE: /);
    expect(result.last).toContain("could not be read");
    expect(result.status).toBe(1);
  });

  it("answers NONE on a queue that is not a list", () => {
    const path = join(dir, "not-a-list.json");
    writeFileSync(path, JSON.stringify({ number: 534 }), "utf8");
    const result = run("--queue", path, "--state", statePath("not-a-list"), "--today", "2026-09-05");

    expect(result.last).toMatch(/^NONE: /);
    expect(result.status).toBe(1);
  });

  it("answers NONE when the row count hits the --limit, because that is a floor", () => {
    const rows = Array.from({ length: 200 }, (_, i) => card(i + 1, ["founder-ordered", "awaiting-fable"]));
    const result = run("--queue", queueFile("at-limit", rows), "--state", statePath("at-limit"), "--today", "2026-09-05");

    expect(result.last).toMatch(/^NONE: /);
    expect(result.last).toContain("floor");
  });

  it("still answers on a corrupt state file rather than refusing to run", () => {
    /* The unsafe direction, named out loud in the script: an unreadable ledger
       reads as empty, which permits one escalation the no-repeat rule might
       have refused. One extra session once, versus one bad byte freezing his
       queue again — which is the defect this card exists to fix. */
    const state = statePath("corrupt");
    writeFileSync(state, "{ this is not json", "utf8");
    const queue = queueFile("corrupt", [card(534, ["founder-ordered", "awaiting-fable"])]);

    expect(run("--queue", queue, "--state", state, "--today", "2026-09-05").last)
      .toMatch(/^ESCALATE #534 /);
  });

  it("REFUSES a flag given twice rather than letting the last one win", () => {
    /* Same fault as ignoring an unknown flag: the caller's second intention
       silently beats their first and nothing says so. */
    const queue = queueFile("twice", []);
    const result = run("--queue", queue, "--queue", queue);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("was given twice");
  });

  it("REFUSES an argument it does not know rather than ignoring it", () => {
    /* #288: `--dry-run` was appended to a script that had no such word, was
       ignored, and stamped a running shift terminal on production. */
    const result = run("--queue", queueFile("refuse", []), "--dry-run");

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("REFUSING");
    expect(result.stdout).not.toContain("ESCALATE");
  });

  it("REFUSES a --record that is not an issue number", () => {
    const state = statePath("bad-record");
    const result = run("--record", "the sheet", "--state", state);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("REFUSING");
    expect(existsSync(state)).toBe(false);
  });
});

describe("the order is the desk sweep's order, or it is nothing", () => {
  it("carries the same sort expression as scripts/crew-desk-sweep.mts", () => {
    /*
      A MIRROR NEEDS A READER (working law 4). The sweep writes NEXT UP onto his
      page and this gate decides what is at the top of it; two sorts drifting
      apart would escalate a card he cannot see at the top of his own queue, and
      nothing would go red. The sort is one expression, so it is compared as
      text — the cheap check that can actually fail.
    */
    const normalise = (text: string) => text.replace(/\s+/g, " ").trim();
    const SORT = normalise(
      "(a.urgent === b.urgent ? 0 : a.urgent ? -1 : 1) || a.issueNumber - b.issueNumber",
    );

    expect(normalise(readFileSync(SCRIPT, "utf8"))).toContain(SORT);
    expect(normalise(readFileSync(SWEEP, "utf8"))).toContain(SORT);
  });

  it("uses shared/crewNextUpHold.ts for the hold verdict rather than its own list", () => {
    /* The labels are the one owner's; a second copy here is how `#278` came to
       tell him a card was blocked for two shifts after it was unblocked. */
    const source = readFileSync(SCRIPT, "utf8");
    expect(source).toContain("heldStatesFromLabels");

    /* ⚠ AND IT READS THE FULL LIST, NEVER THE ONE-WORD CHIP ANSWER. That was
       the defect the reviewer caught before merge: `heldStateFromLabels`
       collapses `blocked` + `awaiting-fable` to "fable", so acting on it would
       have spent a Fable session on a blocked card. A future edit reaching for
       the shorter name reddens here as well as on the behaviour arms. */
    expect(source).not.toMatch(/[^s]heldStateFromLabels\(/);
  });
});
