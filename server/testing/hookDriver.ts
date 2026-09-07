import { spawnSync } from "node:child_process";
import { delimiter, dirname, join, resolve } from "node:path";
import { existsSync } from "node:fs";

/**
 * DRIVING A HOOK: "IT EXITED WITH A CODE" AND "IT NEVER RAN" ARE DIFFERENT ANSWERS.
 *
 * Three suites drive real git hooks by spawning a process and reading its exit
 * code (`prePushGate`, `preCommitGate`, `atlasMergeDriver`). Each one wrote its
 * own driver, and all three collapsed a spawn FAILURE into the same channel as
 * an exit code:
 *
 *     catch (error) { return typeof error?.status === "number" ? error.status : -1 }
 *
 * `-1` is not an exit code. It is the driver saying "I have no answer", dressed
 * as one — and an arm then interprets it as the hook's decision. That is the
 * measured defect of #640: `sh` is not on PATH under PowerShell (it is under Git
 * Bash), so `server/prePushGate.test.ts` returns `-1` from every arm and fails
 * `expected -1 to be 1` — a message about the hook, from a hook that never ran.
 *
 * ⚠ THE FAILING DIRECTION WAS LUCK, AND THE SWEEP SAYS WHERE THE LUCK RUNS OUT.
 * `-1` differs from every code an arm asserts, so #640's own suite fails loudly.
 * Its two siblings hold NINE arms asserting refusal as `expect(status).not.toBe(0)`
 * — and `-1 !== 0` passes. Every one of those would report "the gate refuses"
 * over a git that never started. Read at the arms, all nine happen to be followed
 * by a `stderr`/working-tree assertion that a non-run would also fail, so none is
 * live today; they are protected incidentally, by a neighbour, not by design. A
 * guard whose honesty depends on the assertion written after it is one edit from
 * being a guard that lies.
 *
 * So the repair is at the driver, for all three: a process that could not be
 * STARTED throws, naming the executable, and never returns a number.
 */

/** What a hook actually did: it ran, and it exited with this code. */
export type HookRun = { status: number; stdout: string; stderr: string };

/**
 * A process that produced no exit code. Thrown — never returned — so no arm can
 * read it as a decision. It carries the executable because the fix for the
 * commonest instance is "that binary is not on this PATH".
 *
 * Two different events land here and the message says WHICH, because they want
 * different repairs: a spawn that never happened (ENOENT, EACCES) and a child
 * killed by a signal, which DID run.
 */
export class SpawnFailure extends Error {
  constructor(
    readonly file: string,
    readonly reason: string,
    /** Set when the child ran and was killed, rather than never starting. */
    readonly signal?: NodeJS.Signals,
  ) {
    super(
      signal
        ? `"${file}" was killed by ${signal} and produced no exit code. It RAN — this is not a ` +
          `missing binary — but nothing here says what it would have decided.`
        : `could not start "${file}": ${reason}. This is the DRIVER failing, not the hook — ` +
          `no exit code was produced, so nothing here says what the hook would have decided.`,
    );
    this.name = "SpawnFailure";
  }
}

/**
 * Run `file` with `args` and report what it did.
 *
 * ⚠ **`spawnSync`, NOT `execFileSync`, and the reason is a defect this
 * repository has already caught in itself** (PR #643's review, finding 4;
 * originally `server/atlasCommitHook.test.ts:47`). `execFileSync` returns
 * stdout alone and surfaces stderr only by THROWING — so on a run that exits 0
 * the stderr is the empty string, whatever the process actually said. The
 * pre-commit hook's partial-stage path WARNS and allows, which is exactly that
 * shape, and when this bit before, two positive arms failed honestly while a
 * `not.toContain` passed over nothing at all (the absence-only-expect class).
 *
 * The first version of this helper hard-coded `stderr: ""` on success and did
 * not say so. No arm read it, so nothing broke — but it is the shared
 * instrument now, and an undeclared limitation in a shared instrument is the
 * fidelity law's own shape. It captures both streams on both outcomes instead.
 *
 * @throws SpawnFailure when no exit code was produced — the process could not
 *   be started, or it was killed by a signal.
 */
export function runHook(
  file: string,
  args: string[],
  options: {
    input?: string;
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    /** Windows needs it for `npx`; it changes nothing about the discriminator. */
    shell?: boolean;
    /**
     * Milliseconds after which the child is killed. On expiry `spawnSync`
     * reports a SIGNAL and no status, which is the portable way to reach the
     * killed-child branch below — Windows has no real signals, so
     * `process.kill` on a child there produces an ordinary exit code.
     */
    timeout?: number;
  } = {},
): HookRun {
  const run = spawnSync(file, args, { ...options, encoding: "utf8" });

  /*
    THE DISCRIMINATOR, and it is Node's own contract rather than a heuristic:
    `signal` is set when the child ran and was killed; `error` is set when the
    spawn itself failed; `status` is a number exactly when a process ran to
    completion. Only the third is an answer to "what did the hook decide".

    ⚠ SIGNAL IS TESTED FIRST, AND THE ORDER IS LOAD-BEARING. A timed-out child
    carries BOTH `error` (ETIMEDOUT) and `signal` — so an `error`-first reading
    calls a process that ran and was killed a missing binary, which is finding
    5's wrong narration arriving by a second road. The arm below drives exactly
    this case and reddened on the error-first ordering.
  */
  if (run.signal) throw new SpawnFailure(file, `killed by ${run.signal}`, run.signal);
  if (run.error) {
    const reason = String((run.error as NodeJS.ErrnoException).code ?? run.error.message);
    throw new SpawnFailure(file, reason);
  }
  if (typeof run.status !== "number") {
    throw new SpawnFailure(file, "no exit code and no signal were reported");
  }

  return {
    status: run.status,
    stdout: String(run.stdout ?? ""),
    stderr: String(run.stderr ?? ""),
  };
}

/**
 * Where this machine's POSIX shell is.
 *
 * `sh` resolves off PATH under Git Bash and does NOT under PowerShell, so the
 * same suite on the same commit is green or red depending only on which shell
 * launched vitest — which is exactly how #640 stayed invisible: CI is Linux and
 * whoever ran it by hand happened to be in Bash.
 *
 * Git for Windows ships its own `sh.exe`, and the shifts' machine necessarily
 * has git. It is found FROM the `git` on PATH rather than from a hard-coded
 * `C:\Program Files\Git` so a portable or winget install resolves too.
 */
export function resolveShell(): string | undefined {
  for (const candidate of shellCandidates()) {
    if (existsSync(candidate)) return candidate;
  }
  return onPath("sh") ? "sh" : undefined;
}

function shellCandidates(): string[] {
  const gitExe = onPath("git");
  if (!gitExe) return [];
  /* …/Git/cmd/git.exe and …/Git/bin/git.exe both sit two levels under the
     install root, where `bin/sh.exe` and `usr/bin/sh.exe` live. */
  const root = dirname(dirname(gitExe));
  return [join(root, "bin", "sh.exe"), join(root, "usr", "bin", "sh.exe")];
}

/** The first entry on PATH that exists, with Windows' executable suffixes. */
function onPath(name: string): string | undefined {
  const suffixes = process.platform === "win32" ? ["", ".exe", ".cmd", ".bat"] : [""];
  for (const dir of (process.env.PATH ?? "").split(delimiter)) {
    if (!dir) continue;
    for (const suffix of suffixes) {
      const full = resolve(dir, `${name}${suffix}`);
      if (existsSync(full)) return full;
    }
  }
  return undefined;
}

/**
 * The shell, or a refusal that says which machine problem to fix.
 *
 * @throws SpawnFailure when no POSIX shell can be found, so a suite that cannot
 *   run says so instead of reporting a verdict it never obtained.
 */
export function requireShell(): string {
  const shell = resolveShell();
  if (shell) return shell;
  throw new SpawnFailure(
    "sh",
    "no POSIX shell was found on PATH or in the Git for Windows installation. " +
      "Git Bash ships one; install Git for Windows or put `sh` on PATH",
  );
}
