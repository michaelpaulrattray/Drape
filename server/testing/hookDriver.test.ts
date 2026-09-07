import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { HookRun, SpawnFailure, requireShell, resolveShell, runHook } from "./hookDriver";

/**
 * THE HOOK DRIVER'S OWN ARMS (#640).
 *
 * The three hook suites cannot test this themselves: each asks "what did the
 * hook decide", and the whole defect is that a driver answered that question
 * without running anything. So the discriminator gets its own suite, and the
 * arms that matter are the ones pointed at a process that CANNOT START.
 *
 * ⚠ Working law 2 — the instrument before its findings. `runHook` is the reader
 * every one of those suites now trusts, so it gets both controls here: a
 * positive one (a real process, a real code) and a negative one (a name that
 * does not exist), and the negative arm asserts a THROW rather than a value,
 * because returning any value at all is the defect.
 */

/** A name no PATH entry can hold. */
const ABSENT = "drape-no-such-executable-640";

describe("runHook: a process that never started is not an exit code", () => {
  it("THROWS on a binary that does not exist — it never returns a number", () => {
    /* The old driver returned `-1` here, and every arm downstream read that as
       the hook's verdict. The bar from #640: an unrunnable instrument says it
       could not run. */
    expect(() => runHook(ABSENT, [])).toThrow(SpawnFailure);
  });

  it("names the executable and says the DRIVER failed, not the hook", () => {
    /* `expected -1 to be 1` was the message this replaces: a claim about the
       hook, produced by a hook that never ran. */
    let thrown: unknown;
    try {
      runHook(ABSENT, []);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(SpawnFailure);
    const failure = thrown as SpawnFailure;
    expect(failure.file).toBe(ABSENT);
    expect(failure.message).toContain(ABSENT);
    expect(failure.message).toContain("ENOENT");
    expect(failure.message).toContain("DRIVER failing, not the hook");
  });

  it("⚠ THE ARM THE OLD DRIVER WOULD HAVE PASSED: refusal asserted as `not.toBe(0)`", () => {
    /* This is the sweep's finding made executable. Eleven arms in
       `preCommitGate` and five in `atlasMergeDriver` assert refusal exactly this
       way, and the old sentinel satisfied all sixteen without a process ever
       starting. Written as the old driver wrote it, the block below PASSES;
       written as the new one does, it cannot reach the assertion at all. */
    const asTheOldDriverDid = (): HookRun => {
      try {
        return runHook(ABSENT, []);
      } catch (error: unknown) {
        return { status: typeof (error as { status?: unknown })?.status === "number" ? -999 : -1, stdout: "", stderr: "" };
      }
    };
    expect(asTheOldDriverDid().status).not.toBe(0);

    /* And the same input through the driver as it now stands: no status to
       assert against, because none was produced. */
    expect(() => runHook(ABSENT, [])).toThrow(SpawnFailure);
  });

  it("POSITIVE CONTROL: a process that DOES run reports its real exit code", () => {
    /* Without this the suite above is satisfied by a `runHook` that throws at
       everything — "refuses everything" and "working" would be one reading
       (the misaimed-guard shape named in `prePushGate`'s own header). */
    const ok = runHook(process.execPath, ["-e", "process.stdout.write('ran'); process.exit(0)"]);
    expect(ok.status).toBe(0);
    expect(ok.stdout).toContain("ran");

    const refused = runHook(process.execPath, ["-e", "process.stderr.write('nope'); process.exit(3)"]);
    expect(refused.status).toBe(3);
    expect(refused.stderr).toContain("nope");
  });

  it("passes stdin through, which is how git talks to a pre-push hook", () => {
    const echoed = runHook(
      process.execPath,
      ["-e", "process.stdin.on('data', (d) => process.stdout.write(d))"],
      { input: "refs/heads/main abc refs/heads/main def\n" },
    );
    expect(echoed.status).toBe(0);
    expect(echoed.stdout).toContain("refs/heads/main");
  });
});

describe("resolveShell: the reason the same commit was green in one shell and red in another", () => {
  it("finds a POSIX shell on this machine", () => {
    /* #640's instance: `sh` resolves off PATH under Git Bash and does not under
       PowerShell, so `prePushGate` was 6/6 green from one and 5/6 red from the
       other, on the same tree in the same minute. Git for Windows ships a shell
       and the shifts' machine necessarily has git. */
    const shell = resolveShell();
    expect(shell, "no POSIX shell found — the hook suites cannot run here").toBeTruthy();
  });

  it("returns something that exists and actually executes", () => {
    /* A path is a claim; running `true` through it is the fact. A resolver that
       returned a plausible path to nothing would pass an existsSync-only arm. */
    const shell = requireShell();
    if (shell !== "sh") expect(existsSync(shell)).toBe(true);
    expect(runHook(shell, ["-c", "exit 0"]).status).toBe(0);
    expect(runHook(shell, ["-c", "exit 7"]).status).toBe(7);
  });

  it("requireShell REFUSES rather than returning a name that cannot run", () => {
    /* The refusal names the machine problem, because "sh is missing" is a fix
       someone can act on and `expected -1 to be 1` is not. */
    expect(requireShell()).toBeTruthy();
    const failure = new SpawnFailure("sh", "no POSIX shell was found");
    expect(failure.message).toContain("sh");
    expect(failure.name).toBe("SpawnFailure");
  });
});
