import { describe, expect, it, vi } from "vitest";

import {
  buildClassifier,
  lineUsesNameAsCode,
  REPO_ROOT,
  runMentionControls,
} from "../scripts/lib/productionMention.mts";
import { CHILD_PROCESS_TEST_TIMEOUT_MS } from "./testing/childProcessTimeout";

/* The real-tree arm below walks `CONSUMER_ROOTS` and asks git for the tracked
   set, so it drives a child process and declares that class's timeout rather
   than racing vitest's 5 s default under a parallel run (#548). */
vi.setConfig({ testTimeout: CHILD_PROCESS_TEST_TIMEOUT_MS });

/**
 * A NAME A FILE MATCHES ON IS NOT A NAME IT CALLS — #2293.
 *
 * The production-mention classifier decides whether a symbol has a production
 * consumer, and the `none` verdict is what puts a symbol on a DELETION reading
 * list. It already knew a name inside quotes is data; it did not know a name
 * inside a REGEX LITERAL is. The repair points it at `codeOnly`, whose
 * regex-literal reading was proven against the TypeScript parser over every
 * tracked file (#1635, #1638), rather than teaching this module a second copy
 * of that walk.
 *
 * ⚠ **WHY THIS SUITE EXISTS AT ALL, AND IT IS INVARIANT 7.** `runMentionControls`
 * ran in exactly one place — inside `sweep-uncalled-exports-disposable.mts`,
 * which is keyboard-run. So the only controls on a reader whose output is a
 * deletion list fired when somebody happened to run a sweep, and never on a
 * gate. Both directions of the new rule, and the whole control set with its
 * real positive and negative controls, now run on every gate.
 *
 * The arms are driven through `lineUsesNameAsCode`, which is the predicate the
 * classifier itself calls — not a restatement of it, so an arm cannot pass
 * while the classifier does something else.
 */
describe("a regex literal is data to the production-mention classifier (#2293)", () => {
  /* The shape that caused the card: a production module asserting on a name. */
  const pattern = "    if (/(?:zzzInAPattern)/.test(code)) zzzBesideIt();";

  it("a name inside a regex literal is NOT a mention", () => {
    expect(lineUsesNameAsCode(pattern, "zzzInAPattern")).toBe(false);
  });

  /*
    THE OTHER DIRECTION, AND IT IS THE ONE THAT STOPS THE REPAIR BEING A
    STRIPPER THAT DROPS THE WHOLE LINE. A real call sits outside the pattern on
    the same line and must survive — a blanket drop would silently turn every
    such file into "nothing calls this", which is the deletion direction.
  */
  it("a real call BESIDE that pattern still is a mention", () => {
    expect(lineUsesNameAsCode(pattern, "zzzBesideIt")).toBe(true);
  });

  /* The rule this inherits, kept under the same predicate so the two cannot
     drift apart: a name that survives only inside quotes is a table entry. */
  it("a name inside quotes is data, and an identifier beside it is not", () => {
    const line = '  { symbol: "zzzInATable", verdict: zzzInCode },';
    expect(lineUsesNameAsCode(line, "zzzInATable")).toBe(false);
    expect(lineUsesNameAsCode(line, "zzzInCode")).toBe(true);
  });

  /*
    ⚠ DIVISION IS NOT A PATTERN, AND THIS ARM BITES RATHER THAN DECORATES.
    The regex-vs-division question is answered the way #1635 answered it and is
    deliberately not re-litigated here — but a misread in the OTHER direction
    costs this reader its voice: two divisions on one line give a wrong reader a
    closing slash to find, so it would swallow `boxHeight + padLeft` as a regex
    and report a live consumer as none. That is the silent, deletion-shaped
    failure, so it gets its own arm.
  */
  it("a name between two DIVISIONS survives — a misread would read as no consumer", () => {
    const line = "  const ratio = boxWidth / boxHeight + padLeft / padRight;";
    expect(lineUsesNameAsCode(line, "boxHeight")).toBe(true);
    expect(lineUsesNameAsCode(line, "padLeft")).toBe(true);
  });

  /*
    THE WHOLE CONTROL SET, ON THE REAL TREE, ON EVERY GATE. It carries the two
    controls no synthetic fixture can stand in for: `allowColdImports` must read
    `none` (it lives in `server/testing/`, and its own docblock says production
    calling it would itself be the bug) and `isAccountLocked` must read as
    reached (both login routes call it). Sabotaging the stripper in either
    direction reddens this arm as well as the synthetic ones above.
  */
  it("the classifier passes its own controls against the real tree", () => {
    const lines: string[] = [];
    const passed = runMentionControls(buildClassifier(REPO_ROOT), (line) => lines.push(line));
    expect(lines.join("\n")).not.toContain("FAIL");
    expect(passed).toBe(true);
  });
});
