/**
 * THE RITE'S BRIEFING PARSE CAN FAIL, ON THE REAL INCIDENT'S SHAPE (#169).
 *
 * Edition 55 (2026-08-27) shipped `status: "done"` on two pipeline rows and a
 * journal past its cap; the rite was green end to end and the founder's Crew
 * page served its degraded state for ~15 minutes. The repair is
 * `scripts/lib/briefingConformance.mts`, called by the deploy rite on the
 * briefing at the commit being pushed. These arms prove the judge against the
 * incident's own shapes (working law 2 — a guard that cannot fail is not a
 * guard, and the negative arms here are the incident, not inventions):
 *
 *   - green on the REAL committed briefing (the positive control — and this
 *     arm alone also reddens any PR that commits a broken briefing);
 *   - red on `status: "done"` — the e55 specimen, with the refusal NAMING the
 *     failing path (arm-asserts-its-own-reason: a refusal for some other
 *     reason must not print PROVEN over this one);
 *   - red on a LIST PAST ITS CAP — e55's other half. ⚠ The cap it broke was
 *     the journal's, and #293 deleted the journal; the arm moved to
 *     `nextUp.items` (cap 40) rather than being deleted with it, because the
 *     thing being proven is that a cap refuses, and that population is now the
 *     live one — the founder-ordered queue is a list shifts append to and it
 *     has no other guard;
 *   - red on a briefing that still CARRIES a journal — the schema is
 *     `.strict()`, so an edition copied forward from before #293 is refused on
 *     the push path rather than served and never drawn;
 *   - red on bytes that are not JSON at all;
 *   - and the rite actually calls the judge (invariant 7 — the e55 hole was
 *     precisely a parse arm nothing invoked on the push path).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

import { briefingReadingSuites, judgeBriefingConformance } from "../scripts/lib/briefingConformance.mts";
import { CHILD_PROCESS_TEST_TIMEOUT_MS } from "./testing/childProcessTimeout";
import { runHook } from "./testing/hookDriver";

/* #1679 put real `git grep` and `git rev-list` processes in this suite (the
   derivation is read AT THE COMMIT, which is the whole point of it), so it
   joined #548's population the moment those arms landed. File level, never per
   arm: a number typed onto one `it(…)` is not inherited by its neighbour. */
vi.setConfig({ testTimeout: CHILD_PROCESS_TEST_TIMEOUT_MS });

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const realBriefing = readFileSync(path.join(repoRoot, "server/crew/crew-briefing.json"), "utf8");

/*
  ⚠ THE SPECIMENS ARE BUILT HERE, NEVER BORROWED FROM THE LIVE BRIEFING (#674's
  law-7 sibling, found by the gate on 2026-09-08).

  Both mutation arms below used to clone row [0] of a real list. That is a
  reader with a hidden precondition — the committed edition must happen to
  carry a row — and NEXT UP legitimately emptied for the first time in edition
  300, which turned this suite RED ON MAIN AND BLOCKED EVERY MERGE. The arm did
  not fail because the schema stopped refusing an over-cap list; it failed
  because it had nothing to clone, and an arm that reddens for the wrong reason
  proves nothing about the thing it names.

  #674 taught the SCHEMA that an empty NEXT UP is legitimate. It did not sweep
  the arms that assumed otherwise, and the pipeline arm below is the same shape
  waiting for the first edition with nothing in flight — so it is converted
  here too, before it costs a second shift.

  Each helper builds the MINIMUM its schema declares, so a required field added
  later fails these arms loudly rather than letting them pass on a stale clone.
*/
const nextUpRow = (issueNumber: number) => ({
  issueNumber,
  title: "a card the queue is offering, number " + String(issueNumber),
  urgent: false,
});

const pipelineRow = () => ({
  id: "specimen-row",
  title: "a change this shift has in flight",
  status: "building" as const,
  prNumber: null,
  note: null,
});

describe("judgeBriefingConformance", () => {
  it("positive control: the REAL committed briefing parses", () => {
    const verdict = judgeBriefingConformance(realBriefing);
    expect(verdict.ok, `the live briefing must satisfy the page's own schema — ${verdict.why}`).toBe(true);
  });

  it("red on the e55 specimen — a pipeline status outside the enum — naming the failing path", () => {
    const briefing = JSON.parse(realBriefing);
    briefing.pipeline = [{ ...pipelineRow(), status: "done" }];
    const verdict = judgeBriefingConformance(JSON.stringify(briefing));
    expect(verdict.ok).toBe(false);
    expect(verdict.why, "the refusal must point at the pipeline status, not fail for some other reason").toMatch(/pipeline\.0\.status/);
  });

  it("red on a list past its cap — e55's other half, moved to the queue #293 left standing", () => {
    const briefing = JSON.parse(realBriefing);
    /* Unique issue numbers, because the schema also refuses duplicates — an
       arm that reddens for the wrong reason prints PROVEN over nothing. */
    briefing.nextUp.items = Array.from({ length: 41 }, (_unused, index) => nextUpRow(900000 + index));
    const verdict = judgeBriefingConformance(JSON.stringify(briefing));
    expect(verdict.ok).toBe(false);
    expect(verdict.why, "the refusal must name the capped list, not fail for some other reason").toMatch(/nextUp\.items/);
  });

  it("red on an edition that still carries a journal — the field is gone, not ignored (#293)", () => {
    const briefing = JSON.parse(realBriefing);
    expect(briefing.journal, "the committed briefing must not carry one").toBeUndefined();
    briefing.journal = [{ at: "2026-08-27T09:55:00+10:00", shift: "foreman-43", text: "an entry copied forward" }];
    const verdict = judgeBriefingConformance(JSON.stringify(briefing));
    expect(verdict.ok).toBe(false);
    expect(verdict.why).toMatch(/journal/);
  });

  it("red on bytes that are not JSON", () => {
    const verdict = judgeBriefingConformance("edition: 55\nnot json at all");
    expect(verdict.ok).toBe(false);
    expect(verdict.why).toMatch(/not JSON/);
  });

  it("the deploy rite invokes the judge on its push path (invariant 7)", () => {
    const rite = readFileSync(path.join(repoRoot, "scripts/deploy-rite.mts"), "utf8");
    expect(rite).toContain('from "./lib/briefingConformance.mts"');
    expect(rite).toContain("judgeBriefingConformance(");
    // The refusal is real, not a log line: the red branch dies.
    expect(rite).toMatch(/conformance\.ok && !DRY[\s\S]{0,200}die\(/);
  });
});

/**
 * #169's SHAPE A SECOND TIME, AND WHAT CLOSED IT (#1679).
 *
 * The judge above answers *does this edition PARSE*. Edition 599 parsed and
 * still turned `main` red: its `shift` field was written as five paragraphs,
 * `crewBodyWhitespace.test.ts` holds that a briefing field carrying a blank
 * line is rendered by a class that keeps one, and **the first PR to merge main
 * forward — #1678, a pricing PR — failed its gate for a reason that had nothing
 * to do with its diff.** The cause is #169's own sentence applied to a
 * different guard: the arm exists and runs on PRs, and an edition push never
 * rides a PR.
 *
 * So the rite runs the client suites that read the briefing, and the list is
 * DERIVED at the commit rather than named — the thing being proven here is that
 * the derivation finds a real population and that an empty one refuses, because
 * a `git grep` over a glob fails to EMPTY rather than loudly, and a step that
 * checks nothing while printing `ok` is the shape invariant 7 is about.
 */
describe("briefingReadingSuites — the other half of the edition gate (#1679)", () => {
  it("finds the real client suites at HEAD, and the whitespace guard is one", () => {
    const suites = briefingReadingSuites(repoRoot, "HEAD");
    expect(suites.length, "an empty derivation is the failure this exists to refuse").toBeGreaterThan(0);
    expect(suites).toContain("client/src/features/admin/components/crew/crewBodyWhitespace.test.ts");
    expect(suites).toContain("client/src/features/admin/components/crew/crewTypes.test.ts");
  });

  it("selects CLIENT readers only — the server's are the judge's own job", () => {
    const suites = briefingReadingSuites(repoRoot, "HEAD");
    expect(suites.every((suite) => suite.startsWith("client/src/")), suites.join(", ")).toBe(true);
    // Named because it is the obvious thing to fold in and must not be: it is
    // this judge's own suite, and it already runs here.
    expect(suites).not.toContain("server/briefingConformance.test.ts");
  });

  it("POSITIVE CONTROL: it can come back empty — the reader is not matching everything", () => {
    // Without this, a derivation that returned every file would make the arms
    // above pass for the wrong reason (working law 2). The repository's FIRST
    // commit predates `client/src` entirely.
    /* ⚠ `runHook`, not a bare `execFileSync`, and the reason is this repository's
       own pinned population (#943, `server/testing/hookDriver.test.ts`): a suite
       that spawns a child synchronously AND holds the characters `.status`
       anywhere in its CODE joins that population and must be declared there with
       a reason. This suite holds them at the `pipeline.0.status` regex above — a
       claim about the briefing's own JSON, nothing to do with a child process —
       so a bare call here earns a declared entry whose reason is a coincidence of
       characters, which is how a pinned population rots. The driver is the honest
       answer either way: it is the house reader, it THROWS on a process that
       never started rather than handing back a sentinel, and it takes this file
       out of the population instead of into the list. PR #1693 went red here. */
    const listed = runHook("git", ["rev-list", "--max-parents=0", "HEAD"], { cwd: repoRoot });
    expect(listed.status, listed.stderr).toBe(0);
    const first = listed.stdout.trim().split(/\r?\n/)[0]!;
    expect(first, "no root commit read — the control cannot ask its question").toMatch(/^[0-9a-f]{7,40}$/);
    expect(briefingReadingSuites(repoRoot, first)).toEqual([]);
  });

  it("the deploy rite runs them, refuses on an empty population, and dies on a red", () => {
    const rite = readFileSync(path.join(repoRoot, "scripts/deploy-rite.mts"), "utf8");
    expect(rite).toContain("briefingReadingSuites(");
    // An empty derivation REFUSES rather than printing ok over nothing.
    expect(rite).toMatch(/suites\.length === 0 && !DRY[\s\S]{0,120}die\(/);
    // And a red suite refuses too — a log line would leave the hole open.
    expect(rite).toMatch(/!verdict\.ok[\s\S]{0,400}this edition would redden/);
  });
});
