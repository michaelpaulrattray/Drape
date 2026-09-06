import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * THE PRE-PUSH GATE, DRIVEN RATHER THAN READ.
 *
 * Ordered fable-982 after the second hand-push in the program's record. The
 * first produced a sentence in the rite's own header; the second happened with
 * that sentence already written. So the ceremony became a gate — and a gate
 * nothing drives is a sentence with a shebang.
 *
 * This runs `.githooks/pre-push` as git runs it: the ref lines arrive on stdin,
 * the decision is the exit code. Both directions are here because only having
 * the refusal would leave "refuses everything" indistinguishable from a working
 * gate (law 2, and the misaimed-guard incident that admitted 28 of 28 clothing
 * words after its positive arm passed).
 *
 * It does NOT mock `sh`. A test that models the shell would be testing the
 * model; the point is that the file git executes does what it says.
 */

const HOOK = ".githooks/pre-push";

/** One ref line in git's own pre-push stdin format. */
const refLine = (remoteRef: string) =>
  `refs/heads/local aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa ${remoteRef} bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\n`;

function drive(remoteRef: string, marker: string | undefined): number {
  const env = { ...process.env };
  delete env.DRAPE_DEPLOY_RITE;
  if (marker !== undefined) env.DRAPE_DEPLOY_RITE = marker;
  /*
    ⚠ ARM 2's freshness check is STUBBED here, and the arms below are about ARM
    1 alone (#606, #519). ARM 2 runs `pnpm architecture:check && pnpm
    capability:check` — ~10s of real generation — and every arm in this file
    that pushes a branch other than `main` would pay it, which is exactly what
    happened: two arms timed out at 5000ms the first time the hook grew this
    arm. Stubbing keeps each arm measuring the one decision it names; ARM 2's
    own decision is driven end to end, against real repositories and a real
    remote, in `server/atlasPushGate.test.ts`.

    The stub arrives through git's own env-config protocol rather than
    `git config`, because this suite runs the hook in THIS repository and a
    test must not write to the developer's config.
  */
  env.GIT_CONFIG_COUNT = "1";
  env.GIT_CONFIG_KEY_0 = "drape.atlasCheck";
  env.GIT_CONFIG_VALUE_0 = "true";
  try {
    execFileSync("sh", [HOOK], { input: refLine(remoteRef), env, encoding: "utf8", stdio: "pipe" });
    return 0;
  } catch (error: any) {
    return typeof error?.status === "number" ? error.status : -1;
  }
}

describe("the pre-push gate", () => {
  it("exists and is what the rite checks for", () => {
    expect(existsSync(HOOK)).toBe(true);
    const rite = readFileSync("scripts/deploy-rite.mts", "utf8");
    /* The rite must refuse when the gate is not installed — a guard that is
       silently absent on a fresh clone is invariant 7's own shape. */
    expect(rite).toContain("core.hooksPath");
    expect(rite).toContain("DRAPE_DEPLOY_RITE");
  });

  it("REFUSES a push to the production branch without the rite's marker", () => {
    expect(drive("refs/heads/main", undefined)).toBe(1);
  });

  it("no longer guards local-migration — the branch is deleted and nothing deploys from it (#508)", () => {
    /* Before 2026-09-06 this ref deployed production beside `main` and was
       refused the same way. Railway watches `main` now; a hand push here would
       recreate a branch nothing reads, which is untidy but not a deploy. */
    expect(drive("refs/heads/local-migration", undefined)).toBe(0);
  });

  it("allows the same push when the rite's marker is set", () => {
    expect(drive("refs/heads/main", "1")).toBe(0);
  });

  it("ARM 1 leaves every other branch alone, marker or not", () => {
    /* ⚠ "alone" is ARM 1's claim and no longer the hook's: since #606/#519 a
       BRANCH push meets the freshness arm, which refuses a stale map. The two
       are independent — ARM 1 is about which ref deploys, ARM 2 about whether
       the commits describe themselves — and this arm keeps naming only the
       first, with the stub above holding the second still. */
    expect(drive("refs/heads/some-feature", undefined)).toBe(0);
    expect(drive("refs/heads/mainline", undefined)).toBe(0);
    expect(drive("refs/tags/v1", undefined)).toBe(0);
  });

  it("treats an empty marker as absent", () => {
    /* `DRAPE_DEPLOY_RITE=` on the command line sets the variable to the empty
       string, which is a shift's likeliest accidental bypass. `-z` is the test
       the hook uses, and this is what pins it. */
    expect(drive("refs/heads/main", "")).toBe(1);
  });
});
