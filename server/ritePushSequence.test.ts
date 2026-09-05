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
  classifyPushFailure,
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

  /*
    THE REVIEWER'S FINDING ON PR #570, kept as an arm rather than a fixed
    comment. The first draft printed `git merge origin/main` in BOTH branches.
    In the shipped branch that is the one scenario the message will ever be
    read in — `main` landed, `local-migration` was rejected — and there
    `origin/main` IS HEAD, so the command is "Already up to date" followed by a
    re-run that fails identically. The orphan is on the ref that did NOT land.
  */
  it("merges the ref that FAILED, never origin/main by reflex", () => {
    const shipped = pushInSequence(
      ["main", "main:local-migration"],
      pusherFailing(["main:local-migration"], []),
    );
    const message = pushFailureMessage(shipped);

    expect(message).toMatch(/git merge origin\/local-migration --no-edit/);
    expect(message).not.toMatch(/git merge origin\/main/);
    /* And it says WHY, so the next reader does not "helpfully" change it back. */
    expect(message).toMatch(/would be a no-op here/);
    expect(message).toMatch(/--is-ancestor origin\/local-migration HEAD/);
  });

  it("still merges origin/main when main is the ref that failed", () => {
    const message = pushFailureMessage(
      pushInSequence(["main", "main:local-migration"], pusherFailing(["main"], [])),
    );
    expect(message).toMatch(/git merge origin\/main --no-edit/);
    expect(message).not.toMatch(/git merge origin\/local-migration/);
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

  /* Same finding, same shape, second site (#570 review). */
  it("the diverged-ref message merges the ref that disagrees, not origin/main", () => {
    const onProd = divergedRefMessage("local-migration", "a".repeat(40), "abc1234");
    expect(onProd).toMatch(/git merge origin\/local-migration --no-edit/);
    expect(onProd).not.toMatch(/git merge origin\/main/);
    expect(onProd).toMatch(/not origin\/main by/);

    const onMain = divergedRefMessage("main", "b".repeat(40), "abc1234");
    expect(onMain).toMatch(/git merge origin\/main --no-edit/);
    expect(onMain).not.toMatch(/git merge origin\/local-migration/);
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

/**
 * #577 — THE DIAGNOSIS IS READ OUT OF THE ERROR, NOT ASSUMED FROM THE SHAPE.
 *
 * The measured incident: a rite run died on `Could not resolve host` and then
 * printed the ordinary-race repair, whose first line is `git fetch origin` —
 * the very command that had just failed. The classifier is a pure function of
 * the error text, so every arm here is a fixture string: no network, no git,
 * no remote.
 *
 * The one that matters most is the LAST group — the message must not merely
 * say something different, it must stop saying the false thing.
 */
describe("#577 · the push failure is classified before it is diagnosed", () => {
  /* THE REGRESSION FIXTURE — the real stderr, verbatim, from 2026-09-05 20:45 UTC. */
  const DNS_FAILURE =
    "fatal: unable to access 'https://github.com/mrattray/Drape.git/': "
    + "Could not resolve host: github.com";

  it("reads a rejection as the race", () => {
    expect(classifyPushFailure("! [rejected]        main -> main (fetch first)")).toBe("race");
    expect(classifyPushFailure("Updates were rejected because the tip of your current branch is behind"))
      .toBe("race");
    expect(classifyPushFailure("error: failed to push some refs\nhint: non-fast-forward")).toBe("race");
  });

  it("reads the incident's own stderr as a network failure", () => {
    expect(classifyPushFailure(DNS_FAILURE)).toBe("network");
  });

  it("reads the other ways the wire dies as network failures too", () => {
    expect(classifyPushFailure("fatal: unable to access '…': Failed to connect to github.com port 443"))
      .toBe("network");
    expect(classifyPushFailure("ssh: connect to host github.com port 22: Connection timed out"))
      .toBe("network");
    expect(classifyPushFailure("fatal: the remote end hung up\nOpenSSL SSL_read: Connection reset"))
      .toBe("network");
    expect(classifyPushFailure("Temporary failure in name resolution")).toBe("network");
  });

  /*
    THE FAIL-TOWARD-THE-SHRUG ARMS. `unable to access` and `could not read from
    remote repository` are deliberately absent from both sign lists: git prints
    the first over a 403 as readily as over dead DNS, and the second is usually
    authentication. A message that called either one a network blip would send
    a tired reader to wait out a permissions problem.
  */
  it("refuses to guess at an authentication failure", () => {
    expect(classifyPushFailure("remote: Permission to mrattray/Drape.git denied to bot.\n"
      + "fatal: unable to access '…': The requested URL returned error: 403")).toBe("unknown");
    expect(classifyPushFailure("git@github.com: Permission denied (publickey).\n"
      + "fatal: Could not read from remote repository.")).toBe("unknown");
  });

  it("refuses to guess at silence, and at an error carrying both signatures", () => {
    expect(classifyPushFailure("")).toBe("unknown");
    expect(classifyPushFailure("pre-push hook refused: the atlas is stale")).toBe("unknown");
    /* Both at once is not a third diagnosis — it is a reason to stop. */
    expect(classifyPushFailure("! [rejected] main -> main\nCould not resolve host: github.com"))
      .toBe("unknown");
  });

  /** A sequence whose failure carries the given stderr. */
  const failWith = (failFor: string, output: string) =>
    pushInSequence(["main", "main:local-migration"], (branch) =>
      branch === failFor ? { ok: false, output } : { ok: true, output: "To github.com:x/y.git" });

  it("says the network is down and prints NO merge repair at all", () => {
    const message = pushFailureMessage(failWith("main", DNS_FAILURE));

    expect(message).toMatch(/THE NETWORK IS DOWN/);
    expect(message).toMatch(/nothing is wrong with this tree/);
    expect(message).toMatch(/git ls-remote origin/);
    /* THE DEFECT ITSELF: not one word of the race repair may survive. */
    expect(message).not.toMatch(/git merge/);
    expect(message).not.toMatch(/git fetch origin\n/);
    expect(message).not.toMatch(/ordinary race/);
    /* It still carries the raw error and the force-push refusal. */
    expect(message).toMatch(/Could not resolve host/);
    expect(message).toMatch(/DO NOT force push/);
  });

  it("states what shipped even when the wire died — that fact is read, not diagnosed", () => {
    const message = pushFailureMessage(failWith("main:local-migration", DNS_FAILURE));

    expect(message).toMatch(/ALREADY PUSHED: main\b/);
    expect(message).toMatch(/production'?s own ref is the one that did NOT land/);
    expect(message).toMatch(/THE NETWORK IS DOWN/);
    expect(message).toMatch(/the one that did is already correct/);
    expect(message).not.toMatch(/git merge/);
  });

  it("shrugs honestly when it does not recognise the cause", () => {
    const message = pushFailureMessage(
      failWith("main", "fatal: Could not read from remote repository."),
    );

    expect(message).toMatch(/THE CAUSE WAS NOT RECOGNISED/);
    expect(message).toMatch(/Could not read from remote repository/);
    expect(message).not.toMatch(/git merge/);
    expect(message).not.toMatch(/THE NETWORK IS DOWN/);
    /*
      #360's class, met head on: this message NAMES both roads in order to rule
      them out ("neither the ordinary race nor a network failure"), so the arm
      asserts the DECLARATION is absent, not the phrase. Matching the phrase
      would forbid the message from explaining itself.
    */
    expect(message).not.toMatch(/This is the ordinary race/);
    expect(message).toMatch(/DO NOT force push/);
  });

  it("still gives the merge repair when the cause really is the race", () => {
    const message = pushFailureMessage(
      failWith("main", "! [rejected]        main -> main (fetch first)"),
    );

    expect(message).toMatch(/ordinary race/);
    expect(message).toMatch(/git merge origin\/main --no-edit/);
    expect(message).not.toMatch(/THE NETWORK IS DOWN/);
    expect(message).not.toMatch(/NOT RECOGNISED/);
  });

  /*
    The no-op sentence used to hard-code `origin/main` as the ref that landed,
    which is true only of a two-ref rite. Derived from the sequence now, so a
    third ref cannot turn the sentence into a lie without the arm noticing.
  */
  it("names the ref that actually landed as the no-op, derived from the sequence", () => {
    const three = pushInSequence(["main", "main:staging", "main:local-migration"], (branch) =>
      branch === "main:local-migration"
        ? { ok: false, output: "! [rejected] (fetch first)" }
        : { ok: true, output: "" });
    const message = pushFailureMessage(three);

    expect(message).toMatch(/Merging\norigin\/staging would be a no-op here/);
    expect(message).toMatch(/git merge origin\/local-migration --no-edit/);
  });
});
