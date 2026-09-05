/**
 * #317 — THE RITE MUST STOP BETWEEN ITS TWO PUSHES.
 *
 * `scripts/deploy-rite.mts` pushes `main` and then `main:local-migration`, and
 * **production builds from the second one**. For three incidents the loop had
 * no early exit, so a `main` rejected as non-fast-forward was printed and
 * `local-migration` shipped anyway — handing production a tree `main` did not
 * carry, and then blocking the rite for every later shift.
 *
 * The card asked for this suite by name: *"this wants its own sitting and a
 * sabotage arm proving the refusal actually fires, not a drive-by edit."*
 *
 * Two halves, and the second is the one that keeps working after today:
 *
 * - the **decision** arms drive `pushInSequence` with a fake pusher, so the
 *   STOP is proven without a remote;
 * - the **producer** arms read `scripts/deploy-rite.mts` itself, because a
 *   correct helper the rite does not call is invariant 7's dead control. They
 *   are driven by SABOTAGE: each mutates the real source in memory and asserts
 *   the reading goes red, so a green run means the arm can still fail
 *   (working law 2 — verify the instrument before believing its finding).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  DEPLOY_SOURCE_REF,
  deployRefOrderProblem,
  divergedRefMessage,
  pushFailureMessage,
  pushInSequence,
  refOf,
  type PushOutcome,
} from "../scripts/lib/ritePushSequence.mts";

const RITE_PATH = path.join(process.cwd(), "scripts", "deploy-rite.mts");
const riteSource = () => readFileSync(RITE_PATH, "utf8");

/**
 * The rite's OWN branch list, read out of its source rather than restated.
 * Working law 4: a second list shadowing a source of truth always drifts.
 */
function branchesFrom(source: string): string[] {
  const match = /const BRANCHES = \[([^\]]*)\]/.exec(source);
  if (!match) throw new Error("BRANCHES not found in deploy-rite.mts — the reader is looking at the wrong shape.");
  return [...match[1]!.matchAll(/"([^"]+)"/g)].map((m) => m[1]!);
}

/** A pusher that succeeds for the named branches and fails for the rest. */
const pusherFailing = (failFor: string[], log: string[]) => (branch: string): PushOutcome => {
  log.push(branch);
  return failFor.includes(branch)
    ? { ok: false, output: "! [rejected]        main -> main (fetch first)" }
    : { ok: true, output: "To github.com:x/y.git" };
};

describe("#317 · the push sequence stops at the first failure", () => {
  it("pushes every branch when they all land", () => {
    const log: string[] = [];
    const result = pushInSequence(["main", "main:local-migration"], pusherFailing([], log));

    expect(log).toEqual(["main", "main:local-migration"]);
    expect(result.failed).toBeNull();
    expect(result.skipped).toEqual([]);
    expect(result.attempts.map((a) => a.ok)).toEqual([true, true]);
  });

  /* THE ARM THIS CARD EXISTS FOR. */
  it("never attempts local-migration when main is rejected", () => {
    const log: string[] = [];
    const result = pushInSequence(["main", "main:local-migration"], pusherFailing(["main"], log));

    expect(log).toEqual(["main"]);
    expect(log).not.toContain("main:local-migration");
    expect(result.failed?.branch).toBe("main");
    expect(result.skipped).toEqual(["main:local-migration"]);
    expect(result.attempts).toHaveLength(1);
  });

  it("reports the failure when the LAST ref is the one that fails", () => {
    const log: string[] = [];
    const result = pushInSequence(["main", "main:local-migration"], pusherFailing(["main:local-migration"], log));

    expect(log).toEqual(["main", "main:local-migration"]);
    expect(result.failed?.branch).toBe("main:local-migration");
    expect(result.skipped).toEqual([]);
  });

  it("reads failure from the status, not from the output — a silent success is still a success", () => {
    /* An up-to-date `git push` prints NOTHING. Any reader matching on text
       would call this a failure, or call a noisy success a failure. */
    const result = pushInSequence(["main"], () => ({ ok: true, output: "" }));
    expect(result.failed).toBeNull();

    const noisy = pushInSequence(["main"], () => ({ ok: false, output: "To github.com:x/y.git" }));
    expect(noisy.failed?.branch).toBe("main");
  });
});

describe("#317 · production's ref must be pushed LAST", () => {
  it("accepts the order the rite actually uses", () => {
    expect(deployRefOrderProblem(branchesFrom(riteSource()))).toBeNull();
  });

  it("refuses the reversed order — stopping cannot help after production has shipped", () => {
    const problem = deployRefOrderProblem(["main:local-migration", "main"]);
    expect(problem).toMatch(/must be LAST/);
  });

  it("refuses a list that never pushes production's ref, and an empty one", () => {
    expect(deployRefOrderProblem(["main"])).toMatch(/none of them is local-migration/);
    expect(deployRefOrderProblem([])).toMatch(/empty/);
  });

  it("resolves a local:remote refspec to the ref it lands on", () => {
    expect(refOf("main:local-migration")).toBe(DEPLOY_SOURCE_REF);
    expect(refOf("main")).toBe("main");
  });
});

describe("#317 · the failure message names the recovery and forbids the force push", () => {
  const failedFirst = pushInSequence(["main", "main:local-migration"], pusherFailing(["main"], []));

  it("says nothing shipped, and gives the one-merge repair", () => {
    const message = pushFailureMessage(failedFirst);
    expect(message).toMatch(/NOTHING WAS PUSHED/);
    expect(message).toMatch(/git merge origin\/main --no-edit/);
    expect(message).toMatch(/deploy-rite\.mts/);
  });

  it("warns against the destructive alternative — the card's whole reason for asking", () => {
    expect(pushFailureMessage(failedFirst)).toMatch(/DO NOT force push/);
    /* And never SUGGESTS one. */
    expect(pushFailureMessage(failedFirst)).not.toMatch(/push --force|push -f\b/);
  });

  it("escalates when something already shipped, with the two no-op readings", () => {
    const shipped = pushInSequence(
      ["main", "main:local-migration"],
      pusherFailing(["main:local-migration"], []),
    );
    const message = pushFailureMessage(shipped);
    expect(message).toMatch(/ALREADY PUSHED/);
    expect(message).toMatch(/must be EMPTY/);
    expect(message).toMatch(/--is-ancestor/);
  });

  it("is empty when nothing failed", () => {
    expect(pushFailureMessage(pushInSequence(["main"], () => ({ ok: true, output: "" })))).toBe("");
  });

  it("the diverged-ref message names production's ref as the one that matters", () => {
    const onProd = divergedRefMessage("local-migration", "a".repeat(40), "abc1234");
    expect(onProd).toMatch(/Production builds from this ref/);
    expect(onProd).toMatch(/DO NOT force push/);

    const onMain = divergedRefMessage("main", "", "abc1234");
    expect(onMain).toMatch(/\(absent\)/);
    expect(onMain).toMatch(/Production builds from local-migration/);
  });
});

/**
 * THE PRODUCER ARMS — a correct helper the rite does not call is a dead
 * control. Each is driven by a sabotage of the real source, so a green run
 * means the arm could still have gone red.
 */
describe("#317 · the rite actually uses it (driven by sabotage)", () => {
  it("calls pushInSequence on the push path", () => {
    const source = riteSource();
    expect(source).toMatch(/pushInSequence\(BRANCHES/);

    const sabotaged = source.replace(/pushInSequence\(BRANCHES/, "pushInSequenceXX(BRANCHES");
    expect(sabotaged).not.toBe(source);
    expect(sabotaged).not.toMatch(/pushInSequence\(BRANCHES/);
  });

  it("dies on a failed push instead of continuing", () => {
    const source = riteSource();
    expect(source).toMatch(/if \(sequence\.failed\) die\(pushFailureMessage\(sequence\)\)/);

    const sabotaged = source.replace(/if \(sequence\.failed\) die\(pushFailureMessage\(sequence\)\);/, "");
    expect(sabotaged).not.toBe(source);
    expect(sabotaged).not.toMatch(/if \(sequence\.failed\) die\(/);
  });

  it("checks the branch order before pushing", () => {
    const source = riteSource();
    expect(source).toMatch(/deployRefOrderProblem\(BRANCHES\)/);

    const sabotaged = source.replace(/deployRefOrderProblem\(BRANCHES\)/, "null");
    expect(sabotaged).not.toMatch(/deployRefOrderProblem\(BRANCHES\)/);
  });

  /* THE REGRESSION ITSELF: the status-blind pusher must not come back on the
     push path. `run()` returns stderr as a string, so a loop built on it
     cannot stop — which is the entire defect. */
  it("no longer pushes through the status-blind helper", () => {
    const source = riteSource();
    expect(source).not.toMatch(/gitPush\(/);
    expect(source).toMatch(/gitPushStatus\(/);
    expect(source).toMatch(/result\.status === 0/);

    /* The sabotage: restore the old one-liner and prove this arm reddens. */
    const sabotaged = source.replace(
      /const sequence = pushInSequence\(BRANCHES, \(branch\) => gitPushStatus\("origin", branch\)\);/,
      'for (const branch of BRANCHES) say(`  push ${branch}: ${gitPush("origin", branch) || "ok"}`);',
    );
    expect(sabotaged).not.toBe(source);
    expect(sabotaged).toMatch(/gitPush\("origin", branch\)/);
  });

  it("the reader is looking at a real BRANCHES, and refuses a shape it cannot parse", () => {
    expect(branchesFrom(riteSource())).toEqual(["main", "main:local-migration"]);
    expect(() => branchesFrom("const BRANCHES = something();")).toThrow(/wrong shape/);
  });
});
