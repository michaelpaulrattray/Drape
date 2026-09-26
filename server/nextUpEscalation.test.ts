import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { runHook } from "./testing/hookDriver";
import { CHILD_PROCESS_TEST_TIMEOUT_MS } from "./testing/childProcessTimeout";

/* This suite drives a real child process, so it declares the class's timeout
   rather than racing vitest's 5 s default under a parallel run (#548). */
vi.setConfig({ testTimeout: CHILD_PROCESS_TEST_TIMEOUT_MS });

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

type Row = { number: number; title: string; createdAt: string; labels: { name: string }[] };
type Result = { status: number; stdout: string; stderr: string; last: string };

let dir = "";

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "nextup-escalation-"));
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

/*
  ⚠ **`createdAt` IS SYNTHESISED FROM THE ISSUE NUMBER, AND THAT IS THE TRUE
  RELATION RATHER THAN A CONVENIENCE** (#718): GitHub stamps numbers in filing
  order, so a higher number IS a later card. It is why the desk sweep's old
  `issueNumber` tiebreak was never WRONG — only a different key, which could be
  held to its siblings by nothing but a sentence.
*/
const filedAt = (number: number): string =>
  new Date(Date.UTC(2026, 0, 1) + number * 60 * 60 * 1000).toISOString();

function card(number: number, labels: string[], title = `card ${number}`): Row {
  return { number, title, createdAt: filedAt(number), labels: labels.map((name) => ({ name })) };
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
  /* An `npx` that fails to start throws rather than reading as an exit code
     (#640) — this suite asserts specific exit codes as VERDICTS. */
  const proc = runHook("npx", ["tsx", SCRIPT, ...args], { shell: process.platform === "win32" });
  const stdout = proc.stdout;
  const lines = stdout.split(/\r?\n/).filter((line) => line.trim().length > 0);
  return {
    status: proc.status,
    stdout,
    stderr: proc.stderr,
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
    /* #1094 piece 2 added "or is already being built" to the same sentence — the
       three skips are one list now, and the reason names all three. */
    expect(result.last).toContain("blocked, needs a sitting, or is already being built");
    expect(result.status).toBe(1);
  });

  it("does NOT escalate on an empty queue", () => {
    /* ⚠ THE FIXTURE NAMES HERE ARE FREE AGAIN — HISTORY, NOT A RULE (#545).
       This comment used to warn that they were not. The capability census once
       credited ANY test under `server/` that quoted a door id, so this suite's
       first draft — naming temp files "empty" and "unreadable" — was recorded
       as PINNING the casting doors `empty`, `unreachable` and
       `concept.unreadable`, three doors it has never been within a mile of. A
       real arm could then be deleted and `unpinned-refusal` would not fire.
       Fixed at the class in #615: a pin must now REACH `server/castingV2` by
       living there or importing from it (`reachesDoors`,
       scripts/lib/capabilityAtlas.mts), and this file does neither. The names
       below stay descriptive because they read better, not because they must. */
    const queue = queueFile("empty-queue", []);
    const result = run("--queue", queue, "--state", statePath("empty-queue"), "--today", "2026-09-05");

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

describe("the URGENT band is read too — #1258, #541's defect one band over", () => {
  /*
    ⚠ **EVERY ARM HERE WOULD HAVE ANSWERED `NONE` UNDER THE OLD READING, AND
    THAT IS WHY THEY ARE BEHAVIOUR ARMS RATHER THAN A SOURCE GREP.** The gate
    asked `gh issue list --label founder-ordered` and nothing else, so a card
    that is urgent but not ordered was invisible to it: the hold rendered on his
    page, every shift stepped over it, and nothing wrote the marker. #1222 —
    `bug` + `urgent` + `rung:N2`, his own eye on the Sifr dress — was escalated
    by hand on 2026-09-26 for exactly this reason.

    The fixtures are now the WHOLE OPEN QUEUE rather than one band, which is the
    other half of the change: one read, cross-examined, instead of two narrow
    reads that each believe whatever comes back.
  */

  it("escalates an urgent Fable card when nothing is in his ordered band", () => {
    const queue = queueFile("urgent-only", [
      card(1201, ["bug"], "an ordinary bug nobody ordered"),
      card(1210, ["seat:retro"], "a retro card"),
      card(1222, ["bug", "urgent", "rung:N2", "awaiting-fable"], "a signed view's lower half is still a guess"),
    ]);
    const result = run("--queue", queue, "--state", statePath("urgent-only"), "--today", "2026-09-26");

    expect(result.last).toMatch(/^ESCALATE #1222 /);
    expect(result.status).toBe(0);
  });

  it("his ordered band outranks the urgent one — a takeable ordered card still blocks it", () => {
    /* #471's rule: `urgent` means this cannot wait, `founder-ordered` means he
       chose the order. His band is walked FIRST, so an Opus-takeable card at the
       top of it suppresses the escalation exactly as it did before. */
    const queue = queueFile("ordered-outranks", [
      card(391, ["founder-ordered"], "his ladder ruling"),
      card(1222, ["bug", "urgent", "awaiting-fable"], "the urgent judgment card"),
    ]);
    const result = run("--queue", queue, "--state", statePath("ordered-outranks"), "--today", "2026-09-26");

    expect(result.last).toMatch(/^NONE: /);
    expect(result.last).toContain("#391");
    expect(result.status).toBe(1);
  });

  it("escalates the ORDERED Fable card, never the urgent one, when both are waiting", () => {
    const queue = queueFile("both-fable", [
      card(534, ["founder-ordered", "awaiting-fable"], "his own judgment card"),
      card(1222, ["bug", "urgent", "awaiting-fable"], "the urgent judgment card"),
    ]);
    const result = run("--queue", queue, "--state", statePath("both-fable"), "--today", "2026-09-26");

    expect(result.last).toMatch(/^ESCALATE #534 /);
    expect(result.last).not.toContain("#1222");
  });

  it("names an urgent takeable card as a bundle candidate behind the judgment card", () => {
    const queue = queueFile("urgent-bundle", [
      card(534, ["founder-ordered", "awaiting-fable"], "his own judgment card"),
      card(1235, ["bug", "urgent"], "an urgent bug an Opus sitting could also land"),
      card(1240, ["seat:retro"], "neither ordered nor urgent — not a candidate"),
    ]);
    const result = run("--queue", queue, "--state", statePath("urgent-bundle"), "--today", "2026-09-26");

    expect(result.last).toMatch(/^ESCALATE #534 /);
    expect(result.last).toContain("bundle=#1235");
    expect(result.last).not.toContain("#1240");
  });

  it("a card carrying BOTH labels is counted once, in his band", () => {
    /*
      ⚠ **THE FIRST SHAPE OF THIS ARM WAS INERT AND THE SABOTAGE RUN SAID SO.**
      It asserted `bundle=none` over a fixture whose only duplicate was the
      JUDGMENT card — and the judgment card's second copy carries the same
      `awaiting-fable` hold, so it was filtered out of the bundle either way and
      the arm passed with the de-duplication deleted.

      A duplicate only shows where it can be COUNTED: a takeable card in both
      bands, behind the judgment card, is named twice in the bundle without it.
    */
    const queue = queueFile("both-labels", [
      card(700, ["founder-ordered", "urgent", "awaiting-fable"], "the judgment card, ordered and urgent"),
      card(800, ["founder-ordered", "urgent"], "takeable, and in both bands"),
    ]);
    const result = run("--queue", queue, "--state", statePath("both-labels"), "--today", "2026-09-26");

    expect(result.last).toMatch(/^ESCALATE #700 /);
    expect(result.last).toContain("bundle=#800");
    expect(result.last, "a card in both bands must be named once").not.toContain("#800,#800");
  });

  it("answers NONE when neither band holds a card, rather than reading the rest of the queue", () => {
    /* The queue answered and is believable; it simply holds nothing in either
       band. A gate that walked the whole queue here would escalate work he never
       ordered and never called urgent. */
    const queue = queueFile("no-bands", [
      card(1240, ["seat:retro", "awaiting-fable"], "Fable-only but in neither band"),
      card(1241, ["bug"], "an ordinary bug"),
    ]);
    const result = run("--queue", queue, "--state", statePath("no-bands"), "--today", "2026-09-26");

    expect(result.last).toMatch(/^NONE: /);
    expect(result.last).toContain("neither band");
    expect(result.status).toBe(1);
  });

  it("answers NONE when an empty band cannot be believed, never a fallback to the band it could read", () => {
    /*
      ⚠ **THE ARM THE CARD ASKED FOR, DISSOLVED RATHER THAN BUILT AS WRITTEN.**
      #1258 asks for *"an unreadable urgent query answers NONE rather than
      falling back to the ordered band alone."* There is no second query to be
      unreadable any more — the fix removed one. What remains is the same
      danger in the shape it can actually take: a whole-queue read that came
      back EMPTY makes both bands unbelievable (`deriveBands`, #774), and the
      gate must refuse rather than treat "no ordered cards" as a reading.
    */
    const result = run("--queue", queueFile("blip", []), "--state", statePath("blip"), "--today", "2026-09-26");

    expect(result.last).toMatch(/^NONE: /);
    expect(result.last).toContain("could not be believed");
    expect(result.status).toBe(1);
  });

  it("reaches both bands through deriveBands rather than filtering labels itself", () => {
    /* A second copy of the cut is how the two views come to disagree about what
       is at the top of his queue. The cut and the empty-band cross-examination
       are `queue-standing-exceptions.mts`'s, and this gate calls them. */
    const source = readFileSync(SCRIPT, "utf8");
    expect(source).toContain("deriveBands");
    expect(source, "the gate must not ask gh for one band any more")
      .not.toMatch(/"--label",\s*"founder-ordered"/);
  });
});

/**
 * ⚠ **BUILT IS BUILT — #1094 piece 2, and it answers the #541 rule-3 question
 * this gate was held on for four days.**
 *
 * His order, 2026-09-26 (terminal), verbatim: *"work on 1094 and 1307 next so the
 * desk shows whats built"*. A card with an open pull request or a live claim is
 * not on offer, so this gate must not buy a Fable session for one.
 *
 * ⚠ **AND IT MUST SKIP THE ROW RATHER THAN ANSWER `NONE`**, which is the arm that
 * matters most here: the card's own held comment worked out that a gate which
 * stood down on "this one has a pull request" would freeze **every
 * `awaiting-fable` card behind it** — the #586 consequence, reached by a new road,
 * measured on 2026-09-06 when #535 was never escalated. The third arm below is
 * that one, and it fails if the skip ever becomes a refusal.
 */
describe("a card somebody is already building is not takeable (#1094)", () => {
  const prFile = (name: string, rows: unknown[]): string => {
    const path = join(dir, `${name}-prs.json`);
    writeFileSync(path, JSON.stringify(rows), "utf8");
    return path;
  };
  const commentFile = (name: string, rows: unknown[]): string => {
    const path = join(dir, `${name}-comments.json`);
    writeFileSync(path, JSON.stringify(rows), "utf8");
    return path;
  };
  /** A comment row exactly as `gh api repos/{owner}/{repo}/issues/comments` returns one. */
  const claim = (card: number, at: string, seat = "seat-desk-9") => ({
    issue_url: `https://api.github.com/repos/michaelpaulrattray/Drape/issues/${card}`,
    user: { login: "michaelpaulrattray" },
    created_at: at,
    body: `CLAIMED — ${seat}, ${at}\n`,
  });

  it("does NOT escalate onto a Fable card that already has an open pull request", () => {
    const queue = queueFile("built-fable", [
      card(508, ["founder-ordered", "awaiting-fable"], "deploy on merge"),
    ]);
    const prs = prFile("built-fable", [
      { number: 1400, title: "feat: deploy on merge (#508)", body: "for card #508", headRefName: "team/x-508" },
    ]);
    const result = run(
      "--queue", queue, "--open-prs", prs, "--state", statePath("built-fable"), "--today", "2026-09-26",
    );
    expect(result.last).toMatch(/^NONE: /);
    expect(result.last).toContain("already being built");
    expect(result.status).toBe(1);
  });

  it("does NOT escalate onto a Fable card a seat CLAIMED in the last twelve hours", () => {
    /* The artifact that existed at the moment #1094's measured duplicate happened:
       a claim comment, eighty-five seconds before the second pull request. */
    const queue = queueFile("claimed-fable", [
      card(508, ["founder-ordered", "awaiting-fable"], "deploy on merge"),
    ]);
    const comments = commentFile("claimed-fable", [claim(508, new Date().toISOString())]);
    const result = run(
      "--queue", queue, "--comments", comments, "--state", statePath("claimed-fable"), "--today", "2026-09-26",
    );
    expect(result.last).toMatch(/^NONE: /);
    expect(result.status).toBe(1);
  });

  it("⚠ SKIPS the built row and escalates the Fable card BEHIND it — never `NONE` (the #586 shape)", () => {
    /* #391 is takeable and blocks escalation today; give it a pull request and it
       is not takeable, so #508 — the next Fable card in his order — is reached.
       A gate that answered NONE here would freeze every Fable card behind #391,
       which is exactly what happened on 2026-09-06. */
    const queue = queueFile("skip-built", [
      card(391, ["founder-ordered"], "his ladder ruling"),
      card(508, ["founder-ordered", "awaiting-fable"], "deploy on merge"),
    ]);
    const prs = prFile("skip-built", [
      { number: 1401, title: "chore: the ladder ruling", body: "for card #391", headRefName: "team/ladder-391" },
    ]);
    const result = run(
      "--queue", queue, "--open-prs", prs, "--state", statePath("skip-built"), "--today", "2026-09-26",
    );
    expect(result.last).toMatch(/^ESCALATE #508 /);
    expect(result.status).toBe(0);

    /* THE CONTROL: without the pull request the same queue answers NONE, because
       #391 is genuinely takeable. Without this arm the one above proves only that
       the script runs. */
    const control = run(
      "--queue", queue, "--state", statePath("skip-built-control"), "--today", "2026-09-26",
    );
    expect(control.last).toMatch(/^NONE: /);
    expect(control.last).toContain("#391");
  });

  it("a built card is never named in the BUNDLE either", () => {
    const queue = queueFile("bundle-built", [
      card(508, ["founder-ordered", "awaiting-fable"], "deploy on merge"),
      card(530, ["founder-ordered"], "the sphinx-cat tail court"),
      card(539, ["founder-ordered"], "MAX heat"),
    ]);
    const prs = prFile("bundle-built", [
      { number: 1402, title: "court: the sphinx-cat tail (#530)", body: "for card #530" },
    ]);
    const result = run(
      "--queue", queue, "--open-prs", prs, "--state", statePath("bundle-built"), "--today", "2026-09-26",
    );
    expect(result.last).toMatch(/^ESCALATE #508 /);
    expect(result.last).toContain("bundle=#539");
    expect(result.last).not.toContain("#530");
  });

  it("⚠ an UNREADABLE board answers NONE — this gate's own law, and the one caller that fails that way", () => {
    /* Every other consumer of the board prints the reason and offers the card
       anyway; this one spends a Fable session, so it stands down. Driven with a
       fixture path that cannot be read, which is what a broken `gh` looks like to
       the reader. */
    const queue = queueFile("unread-board", [
      card(508, ["founder-ordered", "awaiting-fable"], "deploy on merge"),
    ]);
    const result = run(
      "--queue", queue,
      "--open-prs", join(dir, "does-not-exist.json"),
      "--state", statePath("unread-board"), "--today", "2026-09-26",
    );
    expect(result.last).toMatch(/^NONE: /);
    expect(result.last).toContain("board could not be read");
    expect(result.status).toBe(1);

    /* THE CONTROL: the same queue with a readable, empty board escalates. */
    const control = run(
      "--queue", queue, "--open-prs", prFile("unread-control", []),
      "--state", statePath("unread-control"), "--today", "2026-09-26",
    );
    expect(control.last).toMatch(/^ESCALATE #508 /);
  });

  it("a claim older than twelve hours is not live, and the card is offered again", () => {
    const queue = queueFile("stale-claim", [
      card(508, ["founder-ordered", "awaiting-fable"], "deploy on merge"),
    ]);
    const old = new Date(Date.now() - 13 * 60 * 60 * 1000).toISOString();
    const comments = commentFile("stale-claim", [claim(508, old)]);
    const result = run(
      "--queue", queue, "--comments", comments, "--state", statePath("stale-claim"), "--today", "2026-09-26",
    );
    expect(result.last).toMatch(/^ESCALATE #508 /);
  });

  it("⚠ consults the ONE shared reader rather than its own grep", () => {
    const source = readFileSync(SCRIPT, "utf8");
    expect(source).toContain('from "./lib/cardBuildState.mts"');
    expect(source).toContain("board.holdsOffOffer(");
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
    const result = run("--queue", join(dir, "does-not-exist.json"), "--state", statePath("unreadable-state"), "--today", "2026-09-05");

    expect(result.last).toMatch(/^NONE: /);
    expect(result.last).toContain("could not be read");
    expect(result.status).toBe(1);
  });

  it("answers NONE when a row has no usable issue number", () => {
    /*
      NaN IS THE ONE SHAPE THAT COULD HAVE ESCALATED FOREVER, and it is the
      card's own "one session, never five" running backwards. `Number(undefined)`
      is NaN, so a malformed row could print `ESCALATE #NaN` — and then
      `--record NaN` is refused, the ledger never advances, and the no-repeat
      rule never engages. Every launch would buy another session on the same
      unreadable row. A queue holding a row nobody can name is an unreadable
      queue, so it answers NONE.
    */
    const path = join(dir, "no-number.json");
    writeFileSync(path, JSON.stringify([
      { title: "a row with no number", labels: [{ name: "awaiting-fable" }] },
    ]), "utf8");
    const result = run("--queue", path, "--state", statePath("no-number"), "--today", "2026-09-05");

    expect(result.last).toMatch(/^NONE: /);
    expect(result.last).not.toContain("NaN");
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
  /*
    ⚠ **THIS USED TO COMPARE THE TWO SORTS AS TEXT, AND IT WORKED — it reddened
    the moment #718 changed one of them.** What it could never say is whether
    the two ORDERS agreed, only whether the two STRINGS did; and its repair
    would have been to paste the new expression into a third file. His ruling of
    2026-09-09 (*"Urgent wins inside your ordered group"*) made the sort one
    function instead — `scripts/lib/orderedBand.mts` — so there is nothing left
    to mirror, and what is checked here is that nobody has re-grown a copy.

    The ORDER itself is now driven through the real process below, and across
    his page and the shift's priority view in `server/orderedBandOrder.test.ts`.
  */
  it("declares no comparator of its own, and neither does the sweep", () => {
    for (const [name, path] of [["the gate", SCRIPT], ["the sweep", SWEEP]] as const) {
      const source = readFileSync(path, "utf8");
      expect(source, `${name} must not carry its own urgent-first expression`)
        .not.toMatch(/a\.urgent \?/);
      expect(source, `${name} must reach the running order through the shared module`)
        .toMatch(/lib\/(orderedBand|nextUpItems)\.mts/);
    }
  });

  it("puts an urgent card above an OLDER ordered one — his ruling, driven", () => {
    /*
      ⚠ **THE ARM THE TEXT COMPARISON COULD NOT BE.** The card's own worked
      example: an old non-urgent ordered card against a newer one carrying both
      labels. #100 was filed first; #400 is urgent, so it is the top card and
      the gate must answer about #400.
    */
    const queue = queueFile("ruling-order", [
      card(100, ["founder-ordered"], "old and not urgent"),
      card(400, ["founder-ordered", "awaiting-fable"], "newer and urgent"),
    ]);
    /* The urgent one is the Fable-only one, so a gate reading oldest-first
       would answer NONE here and a gate obeying his ruling escalates #400. */
    const withUrgent = queueFile("ruling-order-urgent", [
      card(100, ["founder-ordered"], "old and not urgent"),
      card(400, ["founder-ordered", "urgent", "awaiting-fable"], "newer and urgent"),
    ]);

    const oldestFirst = run("--queue", queue, "--state", statePath("ruling-a"), "--today", "2026-09-09");
    expect(oldestFirst.last, "without `urgent`, the older card leads and it is Opus-takeable")
      .toContain("NONE");

    const ruling = run("--queue", withUrgent, "--state", statePath("ruling-b"), "--today", "2026-09-09");
    expect(ruling.last, "with `urgent`, his ruling floats #400 to the top").toContain("ESCALATE");
    expect(ruling.last).toContain("#400");
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
