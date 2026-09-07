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
    /* This is the sweep's finding made executable. FOUR arms in `preCommitGate`
       and FIVE in `atlasMergeDriver` assert refusal exactly this way — nine —
       and the old sentinel satisfied every one without a process ever starting.
       Written as the old driver wrote it, the block below PASSES; written as the
       new one does, it cannot reach the assertion at all.

       ⚠ The counts here read "eleven" and "sixteen" until PR #643's review
       caught them at the bytes. They were wrong in the direction this
       repository is repeatedly bitten by — a confident number left in narration
       that a later sweep has to re-derive to disbelieve. The authoritative
       count is the grep, and it is nine. */
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

  it("requireShell REFUSES rather than returning a name that cannot run — DRIVEN", () => {
    /*
      ⚠ THIS ARM USED TO HAND-BUILD A `SpawnFailure` AND ASSERT ITS MESSAGE,
      which is a test of the constructor and not of the refusal (PR #643's
      review, finding 3). `requireShell()` was called on a machine that HAS a
      shell, so it succeeded, and the refusal path no arm executed could not have
      failed if `requireShell` stopped refusing. The sabotage run drove it by
      hand under PowerShell — a hand-run is not a checked arm.

      `resolveShell` reads `process.env.PATH` at call time and looks for git
      relative to it, so emptying PATH makes the refusal deterministic on every
      platform rather than only on the machine that happens to lack `sh`.
    */
    const savedPath = process.env.PATH;
    try {
      process.env.PATH = "";
      expect(() => requireShell()).toThrow(SpawnFailure);
      let thrown: unknown;
      try {
        requireShell();
      } catch (error) {
        thrown = error;
      }
      /* The refusal names the machine problem, because "no shell was found" is
         a fix someone can act on and `expected -1 to be 1` is not. */
      expect((thrown as SpawnFailure).message).toContain("no POSIX shell was found");
      expect((thrown as SpawnFailure).message).toContain("Git for Windows");
      expect((thrown as Error).name).toBe("SpawnFailure");
    } finally {
      process.env.PATH = savedPath;
    }

    /* And it comes straight back once PATH is restored — a refusal that stuck
       would be a new defect wearing this arm's pass. */
    expect(requireShell()).toBeTruthy();
  });
});

describe("a child that RAN and produced no exit code is not a missing binary", () => {
  it("a signal-killed child throws, and says it RAN rather than blaming the PATH", () => {
    /*
      PR #643's review, finding 5. The first discriminator read "no numeric
      status" as "never started", so a child killed by a signal — which ran, and
      may have done half its work — would have been narrated as a missing
      executable, sending whoever read it to fix their PATH.

      Driven through a real kill so the arm exercises Node's actual `signal`
      field rather than a model of it. ⚠ The kill is a TIMEOUT rather than
      `process.kill` on the child: Windows has no real signals, so a self-kill
      there comes back as an ordinary exit code and this arm passed nothing on
      the very machine the shifts run on. `spawnSync`'s own timeout sets
      `signal` on every platform.
    */
    let thrown: unknown;
    try {
      runHook(process.execPath, ["-e", "setTimeout(() => {}, 30000)"], { timeout: 300 });
    } catch (error) {
      thrown = error;
    }
    expect(thrown, "the child must not come back as an exit code").toBeInstanceOf(SpawnFailure);
    const failure = thrown as SpawnFailure;
    expect(failure.signal, "the signal is kept, not flattened away").toBeTruthy();
    expect(failure.message).toContain("was killed by");
    expect(failure.message).toContain("It RAN");
    /* The negative half: it must NOT tell the reader the binary is missing. */
    expect(failure.message).not.toContain("could not start");
  });
});

describe("stderr survives a SUCCESSFUL run", () => {
  it("captures what a process said on stderr while exiting 0", () => {
    /*
      PR #643's review, finding 4, and the incident is on the record in
      `server/atlasCommitHook.test.ts:47`: `execFileSync` returns stdout alone
      and surfaces stderr only by throwing, so a run that exits 0 reported an
      empty stderr whatever it said. Two positive arms failed honestly there and
      a `not.toContain` passed over nothing.

      The pre-commit hook's partial-stage path is exactly this shape — it WARNS
      and ALLOWS — so a driver that loses stderr on success cannot see the one
      thing that path exists to say.
    */
    const warned = runHook(process.execPath, [
      "-e",
      "process.stderr.write('atlas: partial stage, the map may not match'); process.exit(0)",
    ]);
    expect(warned.status).toBe(0);
    expect(warned.stderr).toContain("partial stage");
  });
});
