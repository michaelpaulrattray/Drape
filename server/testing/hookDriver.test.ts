import { existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { HookRun, SpawnFailure, requireShell, resolveShell, runHook, runHookAsync, runWithLimit } from "./hookDriver";
import { readListedSource } from "./listedSource";
import { CHILD_PROCESS_TEST_TIMEOUT_MS } from "./childProcessTimeout";

/* This suite drives a real child process, so it declares the class's timeout
   rather than racing vitest's 5 s default under a parallel run (#548). */
vi.setConfig({ testTimeout: CHILD_PROCESS_TEST_TIMEOUT_MS });

const REPO = resolve(import.meta.dirname, "..", "..");

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

describe("the class is keyed on the SHAPE now, because three greps were keyed on spellings", () => {
  /*
    ⚠ THE REVIEWER'S OWN CLOSING SENTENCE, MADE MECHANICAL (PR #643, round 2):
    *"The durable sweep key is any status read from a bare child_process call in
    a suite that asserts a verdict, not any particular catch idiom."*

    Three sweeps, three misses, each for the same reason:
      1. the original grep keyed on `? error.status : -1` — the execFileSync
         spelling — and missed FOUR spawnSync drivers;
      2. round 1 keyed on the sentinel — and missed TWO inline calls that have
         no sentinel at all, where a raw `null` flows into the assertion;
      3. and a `not.toBe(0)` refusal arm on either of those would have reported
         a control blocking over a process that never started.

    So the population is pinned rather than swept again. A new test file that
    drives a child process and reads its status must be added to this list
    deliberately, with a reason — which is the point at which somebody asks
    whether it should be on `runHook` instead.
  */
  const DECLARED: Record<string, string> = {
    "server/atlasMergeDriver.test.ts":
      "its VERDICT driver is runHook; the bare call is the declared repository-state read (git check-attr), where throwing on any failure is wanted",
    "server/preCommitGate.test.ts":
      "same shape — the bare call is `git ls-files` reading index modes, not a gate decision",
    "server/prepareCommitMsgGate.test.ts":
      "same shape again — every VERDICT goes through runHook; the bare calls are `git ls-files` reading index modes and `git ls-files --others` naming a written patch file, repository-state reads where throwing on any failure is wanted",
    "server/batchB-drive-guards.test.ts":
      "DECLARED REMAINDER: asserts EXACT codes (toBe(2)), so a non-run fails loudly rather than passing — the loud half of the class, worth migrating but not silent",
    "server/shiftWorktree.test.ts":
      "DECLARED REMAINDER: asserts EXACT codes (toBe(0)) on filesystem helpers (mklink, rm) rather than on a gate's verdict — same loud half",
    "server/testing/hookDriver.test.ts":
      "THIS FILE — it carries the reader's own positive controls, which are source-shaped strings the reader necessarily matches (#943). It drives nothing directly: every child here goes through runHook or runHookAsync, which are its subjects",
  };

  /**
   * Does this suite's source drive a child process itself, rather than through
   * the driver?
   *
   * TWO clauses, and the second one is new (#943):
   *
   *  - the SYNCHRONOUS shape — it spawns something AND reads a `.status`. Both
   *    halves must hold: a suite that only spawns is not asserting a verdict
   *    from one.
   *  - ⚠ the ASYNCHRONOUS shape — a bare `spawn(` / `exec(` / `execFile(`.
   *    **`.status` cannot be the key for these: an async child reports its code
   *    on a `close` event, so the clause above is blind to the whole family.**
   *    That was a harmless hole while nothing here spawned asynchronously;
   *    `runHookAsync` makes it a road somebody will take, and the hole would
   *    have been invisible on the day it was walked. Measured at the tree the
   *    day this clause landed: **no suite matches it**, so it costs nothing
   *    today and catches the first one tomorrow.
   */
  function drivesAChildDirectly(body: string): boolean {
    const synchronous = /\b(spawnSync|execFileSync|execSync)\(/.test(body) && /\.status\b/.test(body);
    const asynchronous = /(?<![.\w])(spawn|exec|execFile)\(/.test(body);
    return synchronous || asynchronous;
  }

  it("no suite drives a child process and reads its status outside the declared list", () => {
    const walk = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) return entry.name === "node_modules" ? [] : walk(full);
        return entry.name.endsWith(".test.ts") ? [full] : [];
      });

    const found = walk(join(REPO, "server"))
      .filter((file) => readListedSource(file) !== null)
      .filter((file) => drivesAChildDirectly(readListedSource(file) ?? ""))
      .map((file) => file.slice(REPO.length + 1).replace(/\\/g, "/"))
      .sort();

    /* The positive control: an empty population would pass an `every` and prove
       nothing — this suite's own subject guarantees at least two members. */
    expect(found.length, "the reader found nothing — it cannot say yes").toBeGreaterThanOrEqual(2);

    /*
      ⚠ AND THE READER ITSELF GETS BOTH CONTROLS, because a sweep that has
      stopped matching reports a clean tree forever. The fixtures go through the
      real predicate, not a second copy of the regex (working law 2).
    */
    expect(
      drivesAChildDirectly('const r = spawnSync("git", []);\nexpect(r.status).toBe(0);'),
      "the synchronous clause has stopped matching",
    ).toBe(true);
    expect(
      drivesAChildDirectly('const c = spawn("git", []);\nc.on("close", (code) => done(code));'),
      "the ASYNCHRONOUS clause has stopped matching — the #943 hole is open again",
    ).toBe(true);
    expect(
      drivesAChildDirectly('const r = runHook("git", []);\nexpect(r.status).toBe(0);'),
      "the reader flags a suite that uses the driver — it would flag everything",
    ).toBe(false);

    const undeclared = found.filter((file) => !(file in DECLARED));
    expect(
      undeclared,
      "a new suite reads a child process's status directly — put it on runHook, or declare it here with why",
    ).toEqual([]);
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

describe("runHookAsync: the overlappable twin keeps every one of runHook's promises (#943)", () => {
  /*
    ⚠ WORKING LAW 2, AND THE REASON THIS BLOCK IS LONG. `runHookAsync` exists so
    `server/selfInvocationCheck.test.ts` can overlap eight `tsx` starts instead
    of queueing them — that arm was 5.9 s on an IDLE machine against a 30 s cap,
    and the deploy rite crossed the cap under its own load and REFUSED a correct
    tree.

    A second driver is a second chance to reintroduce #640. `spawnSync` hands
    back one object carrying `signal`, `error` and `status` together; the async
    child emits them as separate events in either order, and for a failed spawn
    `close` may never arrive at all. So every direction is DRIVEN here rather
    than argued from the sync twin's arms, and each is paired with its opposite.
  */

  it("THROWS on a binary that does not exist — it never resolves to a number", async () => {
    await expect(runHookAsync(ABSENT, ["--version"])).rejects.toBeInstanceOf(SpawnFailure);
  });

  it("names the executable and says the DRIVER failed, not the hook", async () => {
    const failure = await runHookAsync(ABSENT, []).then(
      (run) => run as never,
      (error: unknown) => error as SpawnFailure,
    );
    expect(failure).toBeInstanceOf(SpawnFailure);
    expect(failure.file).toBe(ABSENT);
    expect(failure.message).toContain("could not start");
    expect(failure.message).toContain("This is the DRIVER failing, not the hook");
    /* The negative half: a non-start must not be narrated as a child that ran. */
    expect(failure.message).not.toContain("It RAN");
    expect(failure.signal).toBeUndefined();
  });

  it("a signal-killed child rejects, and says it RAN rather than blaming the PATH", async () => {
    /*
      ⚠ THE ORDERING ARM, AND IT IS SHARPER HERE THAN ON THE SYNC TWIN. A
      timeout kills the child AND surfaces an `error` — so an implementation
      that settled inside the `error` handler would narrate a process that ran,
      and may have done half its work, as a missing binary. The kill is a
      TIMEOUT rather than `process.kill` because Windows has no real signals and
      a self-kill there comes back as an ordinary exit code, which would pass
      this arm over nothing on the machine the shifts actually run on.
    */
    const failure = await runHookAsync(process.execPath, ["-e", "setTimeout(() => {}, 30000)"], {
      timeout: 300,
    }).then(
      (run) => run as never,
      (error: unknown) => error as SpawnFailure,
    );
    expect(failure, "a killed child must not come back as an exit code").toBeInstanceOf(SpawnFailure);
    expect(failure.signal, "the signal is kept, not flattened away").toBeTruthy();
    expect(failure.message).toContain("was killed by");
    expect(failure.message).toContain("It RAN");
    expect(failure.message).not.toContain("could not start");
  });

  it("POSITIVE CONTROL: a process that DOES run reports its real exit code and BOTH streams", async () => {
    const ok = await runHookAsync(process.execPath, [
      "-e",
      "process.stdout.write('ran'); process.stderr.write('warned'); process.exit(0)",
    ]);
    expect(ok.status).toBe(0);
    expect(ok.stdout).toBe("ran");
    /* stderr on a SUCCESSFUL run — the limitation that bit `execFileSync`. */
    expect(ok.stderr).toBe("warned");

    const refused = await runHookAsync(process.execPath, [
      "-e",
      "process.stderr.write('nope'); process.exit(3)",
    ]);
    expect(refused.status).toBe(3);
    expect(refused.stderr).toContain("nope");
  });

  it("captures output larger than one pipe buffer — a truncated read is a silent wrong answer", async () => {
    /*
      The sync twin gets one buffer handed to it; this one accumulates chunks,
      which is where a partial read would hide. 200 KB is well past any single
      chunk, and the assertion is on the LENGTH as well as the ends, because a
      middle that went missing would still start and finish correctly.
    */
    const big = await runHookAsync(process.execPath, [
      "-e",
      "process.stdout.write('A'.repeat(200000)); process.stdout.write('END')",
    ]);
    expect(big.status).toBe(0);
    expect(big.stdout).toHaveLength(200003);
    expect(big.stdout.endsWith("END")).toBe(true);
  });
});

describe("runWithLimit: the cap that keeps the overlap from becoming its own starvation (#943)", () => {
  it("never exceeds the limit, and returns results in the INPUT order", async () => {
    let inFlight = 0;
    let peak = 0;
    const jobs = Array.from({ length: 9 }, (_, i) => async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      /* Staggered, so a correct implementation genuinely overlaps and a
         sequential one would still pass the ORDER arm but not the peak one. */
      await new Promise((done) => setTimeout(done, 20 + (i % 3) * 10));
      inFlight -= 1;
      return i;
    });

    const results = await runWithLimit(jobs, 4);

    expect(results, "the results must come back in the jobs' own order").toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8,
    ]);
    expect(peak, "more children were in flight than the cap allows").toBeLessThanOrEqual(4);
    /* THE POSITIVE CONTROL for the arm above: a sequential implementation
       satisfies `<= 4` trivially, so overlap is asserted too. */
    expect(peak, "nothing overlapped — the cap is not being used at all").toBeGreaterThan(1);
  });

  it("propagates a rejection rather than losing it to an unhandled promise", async () => {
    /*
      ⚠ THE REASON THIS IS NOT `Promise.all`. A `SpawnFailure` from one child
      must reach the arm that asked; under `Promise.all` the siblings' rejections
      become unhandled and vitest reports them against whatever file is running
      at the time — a red with no relationship to the diff, which is the class
      #943 is about.
    */
    const jobs = [
      async () => "first",
      async () => {
        throw new SpawnFailure("nope", "ENOENT");
      },
      async () => "third",
    ];

    await expect(runWithLimit(jobs, 2)).rejects.toBeInstanceOf(SpawnFailure);
  });

  it("REFUSES a limit that would run nothing, rather than hanging", async () => {
    await expect(runWithLimit([async () => 1], 0)).rejects.toThrow("would run nothing");
  });
});
