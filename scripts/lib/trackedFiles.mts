/**
 * WHAT THIS REPOSITORY CONTAINS — asked of git, once, for every reader that
 * must agree with the gate (#1617).
 *
 * # The defect this exists to close
 *
 * `pnpm preflight` runs `pnpm check`, which runs the uncalled-export sweep's
 * reading list through `check-cleanup-dispositions.mts --strict`. That sweep
 * built its importer population by WALKING THE WORKING TREE, and
 * `CONSUMER_ROOTS` includes `scripts/`, where this repository's scratch lives
 * (~440 untracked disposables in the founder's own tree). So a shift that wrote
 * a disposable to drive its own new code took that code OFF the reading list,
 * and preflight went green on a symbol CI would call `unread`.
 *
 * Measured on a clean worktree the day this landed, the disposition row for
 * `CAST_PUBLIC_ID_PATTERN` deliberately removed and nothing else changed:
 *
 *   | state                                      | reading list | verdict   |
 *   |--------------------------------------------|--------------|-----------|
 *   | no untracked file on disk                  | 152          | REFUSED   |
 *   | one untracked disposable importing it      | 151          | OPEN      |
 *
 * ⚠ **It fails in the direction that looks like success, and it is
 * self-concealing**: the more carefully a shift drives its new code — which is
 * what working law 2 asks for — the more certainly it hides its own `unread`.
 *
 * # Why ONE reader rather than a line in each caller
 *
 * Because half of this instrument was already right. `buildClassifier` in
 * `productionMention.mts` has asked git since it was written — *"A CONSUMER
 * THIS REPOSITORY DOES NOT CONTAIN IS NOT A CONSUMER"* — while the sweep that
 * calls it walked the working tree, so the same instrument answered the same
 * question two ways and the narrower answer never reached the reading list.
 * That is working law 4 inside one file family, so the repair is one reader
 * with several consumers rather than a second correct copy.
 *
 * `scripts/typecheck-scripts.mts` reached the same conclusion for `pnpm
 * check:scripts` one script over (#1231) and its docblock carries the argument
 * this one rests on: **the project is what this repository has committed.** It
 * keeps its own `git ls-files --others` call on purpose — it needs the
 * COMPLEMENT as a path LIST under ONE root to drop into a tsconfig `exclude`,
 * which is a different question with a different shape, and collapsing the two
 * would make this module answer to a compiler's config format.
 *
 * # The index, not HEAD — stated because it is a real limit
 *
 * `git ls-files` reads the INDEX, so a staged-but-uncommitted file counts as
 * contained while the gate, which reads the pushed commit, would not have it.
 * That gap is closed by WHEN preflight runs rather than by reaching for `git
 * ls-tree HEAD`: the standing orders say run it AFTER you commit, and at that
 * moment the index and the commit are the same tree. It is also the reading
 * `typecheck-scripts.mts` already takes, and two readers of "what does this
 * repository contain" disagreeing by one flag is the thing this module exists
 * to prevent.
 *
 * # It REFUSES rather than answering "nothing is tracked"
 *
 * An empty answer would drop every file from every population at once, and a
 * reader that looks at nothing reports a clean tree — the exact shape this
 * repository keeps paying for. So a root git cannot answer for throws, and a
 * root that answers with no files at all throws too: both are unreadable, and
 * neither is a repository with nothing in it.
 */
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

/** Windows path separator, by code point, so no source file carries a bare escape. */
const BACKSLASH = String.fromCharCode(92);

/**
 * The repo-relative, forward-slashed paths this repository contains, read at
 * `root` — which may be any git working tree, including one `git worktree add`
 * produced for a historical commit.
 */
export function trackedFiles(root: string): Set<string> {
  let listing: string;
  try {
    listing = execFileSync("git", ["ls-files"], {
      cwd: resolve(root),
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      /* Captured rather than inherited, so git's own reason travels INTO the
         refusal below instead of being printed beside it — a reader that fails
         somewhere it was not expected to should say why in one place. */
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (cause) {
    const said = (cause as { stderr?: string }).stderr?.trim();
    throw new Error(
      `REFUSED — git cannot say what ${root} contains, so no population read against it is `
        + "trustworthy. An empty answer would drop every file from every list at once and read "
        + `as a clean tree.${said ? ` git said: ${said}` : ""}`,
      { cause },
    );
  }
  const files = new Set(
    listing.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.length > 0),
  );
  if (files.size === 0) {
    throw new Error(
      `REFUSED — git reports no files at all under ${root}. That is an unreadable tree, not a `
        + "repository with nothing in it, and treating it as the latter empties every population "
        + "that asks.",
    );
  }
  return files;
}

/**
 * A predicate over the ABSOLUTE paths a directory walk produces.
 *
 * ⚠ **The path spelling is the whole reason this is a function and not two
 * lines at each call site.** A walk on this platform returns
 * `C:\…\server\x.ts` and git returns `server/x.ts`, so a caller that forgets
 * the separator swap gets `false` for EVERY file — which empties its
 * population silently and reads as an instrument with nothing to report. It is
 * spelled once here and driven in both directions on a real temporary
 * repository by `server/trackedFilePopulation.test.ts`.
 */
export function containedIn(root: string): (absolutePath: string) => boolean {
  const resolvedRoot = resolve(root);
  const files = trackedFiles(resolvedRoot);
  return function contains(absolutePath: string): boolean {
    const absolute = resolve(absolutePath);
    if (!absolute.startsWith(resolvedRoot)) return false;
    return files.has(absolute.slice(resolvedRoot.length + 1).split(BACKSLASH).join("/"));
  };
}
