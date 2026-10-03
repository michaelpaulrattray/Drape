/**
 * A SEAT'S `shipped` CLAIM IS CHECKED AGAINST ITS PULL REQUEST (#1859).
 *
 * # What was missing, read at the code rather than reasoned about
 *
 * `.agents/foreman/close-stamp.ps1` is the team's one mechanical honesty check
 * — after a shift's process exits the runner re-reads that shift's mailbox
 * entry and tests every *"merged"* against `gh` (#101). Read at
 * `.agents/foreman/foreman-runner.ps1` on 2026-10-04: **it has exactly one call
 * site, inside the focus-shift path**, while the seat lane calls
 * `is-empty-shift.ps1` and the pass digest and never the stamp. So no builder
 * seat's claims have ever been checked by anything — and a seat cannot write
 * the mailbox entry a stamp would read, because the standing orders forbid it
 * touching `.agents/` at all.
 *
 * The claim a seat DOES make is its close: `--outcome shipped --pr N`. This is
 * the arm set for the rule that tests the second against the first.
 *
 * # ⚠ WHY THE SUITE LIVES HERE AND NOT IN `.agents/`
 *
 * `.agents/` is gitignored but for `PROGRAM.md`, so no suite in this repository
 * can ever see the stamp or the runner. A control that could only live there
 * could never be guarded. That asymmetry is half the argument for answering
 * #1859 in the close rather than in a stamp, and this file is the other half:
 * the rule is in tracked code, so it has arms that run at the gate.
 *
 * # The controls, and what each is for
 *
 * **1 · The rule is driven over the whole outcome set**, derived from
 * `CREW_SHIFT_OUTCOMES` rather than typed, so a fourth outcome cannot join it
 * without an answer here.
 *
 * **2 · THE SAFE DIRECTION IS PROVEN IN BOTH DIRECTIONS.** An arm asserting
 * only that a draft is caught would pass just as happily on a rule that flagged
 * everything. So each silence is asserted beside its finding — a merged pull
 * request, an open one, an unreadable one, and every non-`shipped` outcome.
 *
 * **3 · The reader is driven with an injected `gh`**, including the throw, the
 * non-`Error` throw and the unparseable answer, because the direction it must
 * fail in is not symmetric: reading a draft as `open` silences the finding,
 * which is this card's defect.
 *
 * **4 · The caller is read at the source with a positive control** — the shape
 * `server/crewCloseHandback.test.ts` uses on the same script. A control with no
 * caller does not exist (invariant 7), and that is precisely what #1859 found
 * about the stamp.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  closingPullRequestFinding,
  type ClosingPullRequestReading,
} from "../shared/crewCardBuildState";
import { CREW_SHIFT_OUTCOMES } from "../shared/crewShiftState";
import {
  closingPullRequestArgs,
  closingPullRequestFromJson,
  readClosingPullRequest,
} from "../scripts/lib/crewClosingPullRequest.mts";

const REPO = join(__dirname, "..");
const read = (relative: string) => readFileSync(join(REPO, relative), "utf8");

const reading = (
  over: Partial<{ number: number; isDraft: boolean; state: "open" | "closed" | "merged" | "unknown" }> = {},
): ClosingPullRequestReading => ({
  kind: "read",
  facts: { number: 1376, isDraft: false, state: "open", ...over },
});

const finding = (outcome: string, r: ClosingPullRequestReading) =>
  closingPullRequestFinding({ runId: 560, outcome, reading: r });

describe("the rule: a `shipped` close over a pull request that says otherwise", () => {
  it("a DRAFT under a `shipped` close is the finding, and it names the one command that fixes it", () => {
    const out = finding("shipped", reading({ isDraft: true }));
    expect(out, "a draft under a shipped close must be a finding").not.toBeNull();
    expect(out).toContain("still a DRAFT");
    /* The repair, because the seat is still alive to run it — which is the one
       thing a post-hoc stamp could never offer. */
    expect(out).toContain("gh pr ready 1376");
    expect(out).toContain("#560");
  });

  it("a CLOSED-unmerged pull request under a `shipped` close is a finding too", () => {
    const out = finding("shipped", reading({ state: "closed" }));
    expect(out).toContain("CLOSED");
    expect(out).toContain("`stopped`");
  });

  it("⚠ THE SILENCES, each asserted beside its finding — a rule that flags everything is not a rule", () => {
    /* The normal seat road: opened ready, waiting on the gate and the relay. */
    expect(finding("shipped", reading({ state: "open" }))).toBeNull();
    /* Already merged by the time the seat closed — nothing to say. */
    expect(finding("shipped", reading({ state: "merged" }))).toBeNull();
    /* A state this reader has never seen is not evidence of anything. */
    expect(finding("shipped", reading({ state: "unknown" }))).toBeNull();
    /* No `--pr` at all: a shift may ship an edition through the rite. */
    expect(finding("shipped", { kind: "none" })).toBeNull();
    /* ⚠ An unreadable `gh` carries NO exit code, by design — otherwise a
       machine without `gh` exits 2 on every close and a shift learns to ignore
       the number. The reason is printed by the reader instead. */
    expect(finding("shipped", { kind: "unreadable", why: "gh: command not found" })).toBeNull();
    expect(finding("shipped", { kind: "unreadable", why: "could not resolve" })).toBeNull();
  });

  it("⚠ ONLY `shipped` IS JUDGED, over the whole derived outcome set", () => {
    const draft = reading({ isDraft: true });
    const closed = reading({ state: "closed" });
    expect(CREW_SHIFT_OUTCOMES.length, "the outcome set must not be empty or this arm proves nothing")
      .toBeGreaterThan(1);
    for (const outcome of CREW_SHIFT_OUTCOMES) {
      const expected = outcome === "shipped";
      expect(finding(outcome, draft) !== null, `${outcome} + draft`).toBe(expected);
      expect(finding(outcome, closed) !== null, `${outcome} + closed`).toBe(expected);
    }
    /* A `stopped` close over a draft is COHERENT — unfinished work, unfinished
       pull request — so this is a silence on purpose rather than a gap. */
    expect(finding("stopped", draft)).toBeNull();
  });

  it("an outcome this rule has never seen is silent, not a finding", () => {
    expect(finding("", reading({ isDraft: true }))).toBeNull();
    expect(finding("SHIPPED", reading({ isDraft: true })), "the outcome column is lower-case").toBeNull();
  });
});

describe("the parse: only what `gh` actually spells is believed", () => {
  it("asks for the three fields the rule reads, and no more", () => {
    expect(closingPullRequestArgs(1376)).toEqual(["pr", "view", "1376", "--json", "number,isDraft,state"]);
  });

  it("reads a real answer, in both casings of `state`", () => {
    expect(closingPullRequestFromJson('{"number":1376,"isDraft":true,"state":"OPEN"}'))
      .toEqual({ number: 1376, isDraft: true, state: "open" });
    expect(closingPullRequestFromJson('{"number":1376,"isDraft":false,"state":"merged"}'))
      .toEqual({ number: 1376, isDraft: false, state: "merged" });
  });

  it("⚠ A MISSING OR RE-TYPED `isDraft` REFUSES THE WHOLE ANSWER — never reads as `not a draft`", () => {
    /* This is the one direction the reader may not fail in: a draft silently
       read as not-a-draft is the defect, so the answer is refused instead. */
    expect(closingPullRequestFromJson('{"number":1376,"state":"OPEN"}')).toBeNull();
    expect(closingPullRequestFromJson('{"number":1376,"isDraft":"true","state":"OPEN"}')).toBeNull();
    expect(closingPullRequestFromJson('{"number":1376,"isDraft":null,"state":"OPEN"}')).toBeNull();
  });

  it("an answer it cannot understand is null, never a half-read fact", () => {
    expect(closingPullRequestFromJson("")).toBeNull();
    expect(closingPullRequestFromJson("not json")).toBeNull();
    expect(closingPullRequestFromJson("null")).toBeNull();
    expect(closingPullRequestFromJson("[]")).toBeNull();
    expect(closingPullRequestFromJson("{}")).toBeNull();
    /* A `number` that is not one: the row is about some other pull request. */
    expect(closingPullRequestFromJson('{"number":"1376","isDraft":true,"state":"OPEN"}')).toBeNull();
    /* A state nobody has seen is a state, not a refusal — the rule is silent on it. */
    expect(closingPullRequestFromJson('{"number":1376,"isDraft":false,"state":"QUEUED"}'))
      .toEqual({ number: 1376, isDraft: false, state: "unknown" });
  });
});

describe("the reader: nothing reaches the close as a throw", () => {
  it("no `--pr` costs no `gh` call at all", () => {
    let called = 0;
    const notes: string[] = [];
    const out = readClosingPullRequest(null, (line) => notes.push(line), () => {
      called += 1;
      return "{}";
    });
    expect(out).toEqual({ kind: "none" });
    expect(called, "a close that names no pull request must not spend the shared GitHub budget").toBe(0);
    expect(notes).toEqual([]);
  });

  it("a throw is swallowed and REPORTED, and the reading says UNKNOWN in as many words", () => {
    const notes: string[] = [];
    const out = readClosingPullRequest(1376, (line) => notes.push(line), () => {
      throw new Error("GraphQL: Could not resolve to a PullRequest\nsecond line");
    });
    expect(out.kind).toBe("unreadable");
    const text = notes.join("\n");
    expect(text).toContain("could not be read");
    expect(text).toContain("UNKNOWN");
    /* ⚠ NOT a clean bill — the sentence must deny the reading nobody should take. */
    expect(text).toContain("the pull request is fine");
    expect(text, "one line of a multi-line error, like every other reader here").not.toContain("second line");
  });

  it("a thrown NON-Error is swallowed too — every throw, not a chosen family", () => {
    const notes: string[] = [];
    const out = readClosingPullRequest(1376, (line) => notes.push(line), () => {
      throw "a string";
    });
    expect(out.kind).toBe("unreadable");
    expect(notes.join("\n")).toContain("a string");
  });

  it("an answer it could not understand says so rather than passing quietly", () => {
    const notes: string[] = [];
    const out = readClosingPullRequest(1376, (line) => notes.push(line), () => "{}");
    expect(out.kind).toBe("unreadable");
    expect(notes.join("\n")).toContain("could not be understood");
  });

  it("a pull request it CAN read is silent — a reader that always warns is a reader nobody reads", () => {
    const notes: string[] = [];
    const out = readClosingPullRequest(
      1376,
      (line) => notes.push(line),
      () => '{"number":1376,"isDraft":true,"state":"OPEN"}',
    );
    expect(out).toEqual({ kind: "read", facts: { number: 1376, isDraft: true, state: "open" } });
    expect(notes).toEqual([]);
  });

  it("it reads the number the CLOSE named, never one off the answer", () => {
    /* A `gh` answering about a different pull request would otherwise rename
       the finding's subject silently. The args carry the close's number. */
    const args: string[][] = [];
    readClosingPullRequest(1376, () => {}, (a) => {
      args.push([...a]);
      return '{"number":9999,"isDraft":false,"state":"OPEN"}';
    });
    expect(args).toEqual([["pr", "view", "1376", "--json", "number,isDraft,state"]]);
  });
});

describe("the rule has a caller on the road every shift walks", () => {
  const CLOSE = "scripts/crew-shift-close.mts";

  /** THE READING, as one function, so the arm and its control run the same one. */
  const consultsTheRule = (source: string): boolean => source.includes("readClosingPullRequest(")
    && source.includes("closingPullRequestFinding({");

  it("the close reads the pull request and asks the rule", () => {
    expect(
      consultsTheRule(read(CLOSE)),
      "the close does not consult the rule — a control with no caller does not exist, which is"
      + " exactly what #1859 found about the close-stamp",
    ).toBe(true);
  });

  it("POSITIVE CONTROL — that reading goes red on a copy carrying each defect", () => {
    const real = read(CLOSE);
    expect(consultsTheRule(real.replace(/readClosingPullRequest\(/g, "somethingElse("))).toBe(false);
    expect(consultsTheRule(real.replace(/closingPullRequestFinding\(\{/g, "somethingElse({"))).toBe(false);
    /* And the state this card is about: the close as it stood before it. */
    const beforeThisCard = real.replace(
      /\n {2}if \(prNumber !== null\) \{\n {4}const prReading[\s\S]*?\n {2}\}\n/,
      "\n",
    );
    expect(
      beforeThisCard,
      "the doctored copy must actually have lost the block, or this control proves nothing",
    ).not.toContain("readClosingPullRequest(");
    expect(consultsTheRule(beforeThisCard)).toBe(false);
  });

  it("the finding is collected AFTER the row is stamped, and never refuses", () => {
    const source = read(CLOSE);
    /* `refuse()` exits. A pull-request reading that could refuse would cost a
       shift its close and leave a row open that his page reads as a shift still
       running (#288) — this script's own standing rule. */
    const update = source.indexOf("SET endedAt = UTC_TIMESTAMP()");
    const site = source.indexOf("readClosingPullRequest(");
    expect(update, "the close no longer writes — this arm is reading the wrong file").toBeGreaterThan(0);
    expect(site, "the reading must come AFTER the row is stamped").toBeGreaterThan(update);
    /* ⚠ SLICED to the block, not the whole file: a `not.toContain` over the
       file would be satisfied by any `refuse(` anywhere in it, and the file has
       several (memory: a guard arm satisfied by a sibling). */
    const block = source.slice(site, source.indexOf("THE HEARTBEAT FINDING", site));
    expect(block.length, "the slice must be the block, not the rest of the file").toBeLessThan(900);
    expect(block).not.toContain("refuse(");
  });

  it("the finding joins the collected list rather than exiting where it stands", () => {
    /* A `process.exit` at the pull-request check would hide the heartbeat
       finding under it — the file's own stated reason for collecting. */
    const source = read(CLOSE);
    const site = source.indexOf("readClosingPullRequest(");
    const block = source.slice(site, source.indexOf("THE HEARTBEAT FINDING", site));
    expect(block).toContain("findings.push(");
    expect(block).not.toContain("process.exit");
  });

  it("the reader runs on the counts' own `gh` seam, not a private child process", () => {
    /* A `gh` caller with no timeout would re-open the one road a `catch` cannot
       rescue, and it would do it on the shift close.

       ⚠ Read at the IMPORT rather than at the word — `crewCloseHandback`'s own
       arm records why: a negative arm a SENTENCE can satisfy is measuring
       prose, and this module's docblock says "its own `execFileSync`". */
    const reader = read("scripts/lib/crewClosingPullRequest.mts");
    const spawns = (source: string): boolean => /from "node:child_process"/.test(source);
    expect(reader).toContain("crewGhReader");
    expect(spawns(reader), "a private child-process call here is the defect, not the fix").toBe(false);
    /* POSITIVE CONTROL — the reading can go red. */
    expect(spawns('import { execFileSync } from "node:child_process";')).toBe(true);
  });
});
