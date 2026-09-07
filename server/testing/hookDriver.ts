import { execFileSync } from "node:child_process";
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
 * A spawn that never happened. Thrown — never returned — so no arm can read it
 * as a decision. It carries the executable because the fix for the only
 * instance found so far is "that binary is not on this PATH".
 */
export class SpawnFailure extends Error {
  constructor(
    readonly file: string,
    readonly reason: string,
  ) {
    super(
      `could not start "${file}": ${reason}. This is the DRIVER failing, not the hook — ` +
        `no exit code was produced, so nothing here says what the hook would have decided.`,
    );
    this.name = "SpawnFailure";
  }
}

/**
 * Node reports a failure to spawn with `error.code` (ENOENT, EACCES, …) and NO
 * numeric `status`; a process that ran and exited non-zero always carries a
 * numeric `status`. That is the whole discriminator, and it is Node's own
 * contract rather than a heuristic about messages.
 */
function isSpawnFailure(error: unknown): boolean {
  return typeof (error as { status?: unknown } | null)?.status !== "number";
}

/**
 * Run `file` with `args` and report what it did.
 *
 * @throws SpawnFailure when the process could not be started at all.
 */
export function runHook(
  file: string,
  args: string[],
  options: { input?: string; cwd?: string; env?: NodeJS.ProcessEnv } = {},
): HookRun {
  try {
    const stdout = execFileSync(file, args, {
      ...options,
      encoding: "utf8",
      stdio: "pipe",
    });
    return { status: 0, stdout: String(stdout ?? ""), stderr: "" };
  } catch (error: unknown) {
    if (isSpawnFailure(error)) {
      const reason = String(
        (error as { code?: unknown; message?: unknown })?.code ??
          (error as { message?: unknown })?.message ??
          "no exit code was produced",
      );
      throw new SpawnFailure(file, reason);
    }
    const shaped = error as { status: number; stdout?: unknown; stderr?: unknown };
    return {
      status: shaped.status,
      stdout: String(shaped.stdout ?? ""),
      stderr: String(shaped.stderr ?? ""),
    };
  }
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
