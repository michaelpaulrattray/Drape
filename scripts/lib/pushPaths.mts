/**
 * EVERY PATH THAT CAN REACH `main` WITHOUT A PULL REQUEST — DERIVED, NOT LISTED
 * (#263, founder ruling 2026-08-30).
 *
 * > "The CI hole is the best find in the card. A gate that only runs on pull
 * > requests, plus a path that pushes straight to main, means the gate is
 * > optional in practice. Fixing the rite to run the check is right. Worth
 * > checking whether anything else can reach main without a PR."
 *
 * The second sentence is what this module answers, and his own bar governs the
 * shape of the answer: *"the sweep reports the full list of push paths whether
 * or not it finds a second offender — 'only the rite' is a real and valuable
 * answer, but only when it comes from a search rather than from an
 * assumption."*
 *
 * `docs/specs/PUSH_PATHS_TO_MAIN.md` is the written record and carries the
 * doors this module CANNOT see (see below). This file is the half that a new
 * door cannot ship past.
 *
 * # Why derived
 *
 * CLAUDE.md already keeps four enumerated lists — public endpoints, session
 * issuance sites, the flag index, the fal budget — and every one was written
 * after something got in unlisted. Their shared lesson is in this repository's
 * own record: *"a prose enumeration needs an arm deriving its population from
 * the code"* (working law 4). So the population here is read off the tree and
 * compared to an allowlist that names each door and its reason. A new script
 * that pushes turns the suite red until somebody writes down why it exists.
 *
 * # THE CONTRACT, STATED EXACTLY
 *
 * A tracked file is a PUSHER when it is executable source (`.ts .mts .mjs .js
 * .cjs .ps1 .sh .yml .yaml`, or any file under `.githooks/`) and its text
 * contains a git push invocation in one of two shapes:
 *
 *   - the shell form, `git push` — `\bgit\s+push\b`, so the prose "git pushes
 *     the index" in `check-architecture.mts` is NOT a hit;
 *   - the argv form, `"git", ["push"` — which is how every TypeScript caller
 *     in this repository spawns git.
 *
 * ⚠ **Prose is deliberately in scope for the shell form.** A comment saying
 * `git push` in an executable file makes that file a candidate and forces it
 * onto the allowlist with a reason. Over-inclusion costs one line of writing;
 * under-inclusion is a door nobody sees, and that is the silent direction.
 * `.md` files are excluded because they cannot execute — this repository's
 * documentation says "git push" in dozens of places.
 *
 * # WHAT THIS MODULE CANNOT SEE, and the record says so out loud
 *
 * Three of the real doors are NOT in the code and no test can read them:
 *
 *   1. **GitHub branch protection** — server-side state, like the Railway flag
 *      positions. Read by hand and recorded in the doc with its date.
 *   2. **`core.hooksPath`** — per-clone git config. The hook file is committed;
 *      its INSTALLATION is not, and a fresh clone has the file without the gate.
 *      The rite refuses to run when the config is absent, which is the only
 *      place this is enforceable.
 *   3. **`git push --no-verify`** and the GitHub web/API editor — a human act
 *      and a hosted surface. Neither is reachable from a repository check.
 *
 * A green run of this module therefore means *"no new door in the code"* and
 * never *"the door is shut"*. That distinction is the whole point of writing
 * it down.
 *
 * This is a MODULE (imported by its suite) and it never exits.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

/** The one pusher #263 was filed on; a derivation that loses it is not a derivation. */
export const ORIGIN_PUSHER = "scripts/deploy-rite.mts";

/**
 * Extensions that can execute. `.githooks/` files carry no extension at all,
 * and `package.json` executes through `pnpm run` like any script.
 *
 * ⚠ `.cmd` and `.bat` are here because the machine the rite runs on is Windows,
 * where a `.cmd` wrapper is the NATIVE shape for a pusher — they were missing
 * from the first cut of this list, which is the blind spot least likely to be
 * noticed and most likely to be used (review of #263, finding 3).
 */
const EXECUTABLE = /\.(ts|mts|mjs|js|cjs|ps1|sh|cmd|bat|ya?ml)$/;
const ALSO_EXECUTES = (file: string) => file === "package.json" || file.startsWith(".githooks/");

const SHELL_PUSH = /\bgit\s+push\b/;
const ARGV_PUSH = /["']git["']\s*,\s*\[\s*["']push["']/;

export type PushPathReading = {
  /** Every tracked executable file whose text invokes `git push`. */
  pushers: string[];
  /** Workflows granting `contents: write` — any of which could push from CI. */
  workflowWriters: string[];
  /** Workflows with no top-level `permissions:` block, which inherit the repository default. */
  workflowsWithoutPermissions: string[];
  /** The refs `.githooks/pre-push` refuses without the rite's marker. */
  protectedRefs: string[];
};

export type TreeReader = {
  /** Tracked paths, repo-relative, forward slashes. */
  files: () => string[];
  /** File text, or "" when the path cannot be read. */
  read: (file: string) => string;
};

/**
 * Reads the real repository: `git ls-files` for the population, so untracked
 * litter is never counted, and the DISK for the text.
 *
 * ⚠ Deliberately the disk and not `git show HEAD:` — `ls-files` reports the
 * INDEX, so a pushing script that has been `git add`ed but not yet committed is
 * in the population while `HEAD` has no such blob. Reading HEAD would hand that
 * file an empty string and quietly clear it. Same-source-for-both is the rule
 * the Atlas learned the hard way (`check-architecture.mts`: "the Atlas walks
 * the working tree, git pushes the index"), and here the safe direction is to
 * see the file EARLIER, before the commit that carries it.
 */
export const gitTreeReader = (root: string): TreeReader => ({
  files: () => execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 })
    .split(/\r?\n/).map((line) => line.trim().replace(/\\/g, "/")).filter((line) => line !== ""),
  read: (file) => {
    try {
      return readFileSync(path.join(root, file), "utf8");
    } catch { return ""; }
  },
});

/**
 * Read every push path the repository can state about itself.
 *
 * REFUSES when the derivation loses `ORIGIN_PUSHER` — an empty or short list is
 * indistinguishable from a broken reader, and a broken reader that returns
 * "no doors" is the most dangerous output this module could produce
 * (invariant 7: refuse, never allow, when the instrument is blind).
 */
export const readPushPaths = (reader: TreeReader): PushPathReading => {
  const files = reader.files();
  if (files.length === 0) throw new Error("push-path derivation saw no tracked files — the reader is blind");

  const pushers = files
    .filter((file) => EXECUTABLE.test(file) || ALSO_EXECUTES(file))
    .filter((file) => {
      const text = reader.read(file);
      return SHELL_PUSH.test(text) || ARGV_PUSH.test(text);
    })
    .sort();

  if (!pushers.includes(ORIGIN_PUSHER)) {
    throw new Error(
      `push-path derivation lost its origin case (${ORIGIN_PUSHER}); found ${pushers.length}: ${pushers.join(", ") || "(none)"}`,
    );
  }

  const workflows = files.filter((file) => /^\.github\/workflows\/.+\.ya?ml$/.test(file)).sort();
  if (workflows.length === 0) throw new Error("push-path derivation found no workflows — the reader is blind");

  const workflowWriters = workflows.filter((file) => /contents:\s*write/.test(reader.read(file)));

  /*
    ⚠ A WORKFLOW WITH NO `permissions:` BLOCK IS NOT A SAFE WORKFLOW (review of
    #263, finding 2). It inherits the repository's DEFAULT workflow token
    permissions — server-side state this module cannot read, recorded by hand in
    the doc's door A (`read`, on 2026-09-03). If that default is ever flipped to
    write, a workflow that never says the word `write` gains it silently, and
    `local-migration` has no branch protection at all.

    So the arm is not "no workflow says write"; it is "every workflow SAYS what
    it gets". An absent block is the silent direction.
  */
  const workflowsWithoutPermissions = workflows
    .filter((file) => !/^permissions:/m.test(reader.read(file)));

  return {
    pushers,
    workflowWriters,
    workflowsWithoutPermissions,
    protectedRefs: readProtectedRefs(reader),
  };
};

/**
 * The refs `.githooks/pre-push` guards, read out of the hook's own `case`
 * arm rather than restated here — restating it is the second list this whole
 * module exists to avoid.
 */
export const readProtectedRefs = (reader: TreeReader): string[] => {
  const hook = reader.read(".githooks/pre-push");
  if (hook.trim() === "") throw new Error(".githooks/pre-push is missing or unreadable — the push gate cannot be read");
  const arm = /case\s+"\$1"\s+in\s*([\s\S]*?)\besac\b/.exec(hook);
  if (!arm) throw new Error(".githooks/pre-push no longer states its protected refs as a `case` arm — read it by hand");
  return [...arm[1]!.matchAll(/refs\/heads\/([A-Za-z0-9._\/-]+)/g)].map((match) => match[1]!).sort();
};
