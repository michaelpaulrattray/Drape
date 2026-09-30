import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import { containedIn, trackedFiles } from "../scripts/lib/trackedFiles.mts";
import { CHILD_PROCESS_TEST_TIMEOUT_MS } from "./testing/childProcessTimeout";
import { readListedSource } from "./testing/listedSource";

/* Most arms here spawn real `git` processes — `init`, `add`, `commit`, `ls-files`
   — in throwaway repositories, so this suite is in #548's population. The
   constant it declares also satisfies #741's source-sweep population, which this
   file joins by reading the reading-list family off the real tree through
   `readListedSource`; `declaresTheFloor` accepts either floor and both are
   30_000. */
vi.setConfig({ testTimeout: CHILD_PROCESS_TEST_TIMEOUT_MS });

/**
 * THE READING LIST'S POPULATION IS WHAT THE REPOSITORY CONTAINS (#1617).
 *
 * `pnpm preflight` exists so that a first gate run is green **by intent, not by
 * luck**. The uncalled-export sweep broke that promise in the direction that
 * looks like success: it built its importer population by walking the WORKING
 * TREE, and `CONSUMER_ROOTS` includes `scripts/`, where this repository's
 * scratch lives. So a shift that wrote a disposable to drive its own new code
 * credited that code with an importer, the symbol left the reading list, and
 * `check-cleanup-dispositions --strict` — `pnpm check`, so `pnpm preflight` —
 * reported OPEN on a symbol the gate would call `unread`.
 *
 * Measured on a clean worktree, the `CAST_PUBLIC_ID_PATTERN` disposition row
 * removed and nothing else changed:
 *
 *   | state                                 | reading list | verdict |
 *   |---------------------------------------|--------------|---------|
 *   | no untracked file on disk             | 152          | REFUSED |
 *   | one untracked disposable importing it | 151          | OPEN    |
 *
 * ⚠ **It is self-concealing**: the more carefully a shift drives its new code —
 * which is what working law 2 asks for — the more certainly it hides its own
 * `unread`. And the narrower reading was already INSIDE the instrument.
 * `buildClassifier` has asked git since it was written (*"A CONSUMER THIS
 * REPOSITORY DOES NOT CONTAIN IS NOT A CONSUMER"*), and the sweep that calls it
 * for the intersection walked the disk — one instrument, one question, two
 * answers, and the looser one decided the list. Working law 4.
 *
 * # What each arm here is for, and what it deliberately does not claim
 *
 * The repair is one reader (`scripts/lib/trackedFiles.mts`) with several
 * consumers, so the ways it can rot are: the reader ceasing to discriminate; the
 * reader answering "nothing is contained" and thereby emptying every population
 * at once while looking like a clean tree; and a second reader appearing beside
 * it inside the same family.
 *
 * The first two are driven against REAL temporary repositories, because a
 * tracked and an untracked file are identical on disk and only git can tell them
 * apart. The third is DERIVED from the door's own import closure with a negative
 * control, so it cannot pass by finding nothing.
 *
 * ⚠ **STATED LIMIT, because a sweep's remainder is a floor unless a reader
 * produced it**: nothing here can see a FOURTH population added to the sweep
 * that bypasses the gate by walking on its own. What makes that unlikely is
 * structural rather than tested — the gate now sits INSIDE the sweep's `walk`,
 * so every path entering any population there passes through one function, and
 * there is no per-list `.filter` to forget. That is the argument; it is not a
 * guard, and it is written down rather than implied.
 */

const repoRoot = path.resolve(import.meta.dirname, "..");

function git(cwd: string, ...args: string[]): string {
  /* stderr is piped rather than inherited so the refusal arms below — which
     deliberately run git where there is no repository — do not print git's own
     `fatal:` line into an otherwise clean run and read as a broken suite. */
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

/** A throwaway repository, so the shared worktree's index is never touched. */
function scratchRepo(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "drape-1617-"));
  git(dir, "init", "-q", "-b", "main");
  git(dir, "config", "user.email", "seat@example.com");
  git(dir, "config", "user.name", "seat");
  /* No hooks: this repository's `core.hooksPath` is relative, and a scratch repo
     has none of them. */
  git(dir, "config", "core.hooksPath", path.join(dir, ".no-hooks"));
  /* And no line-ending rewriting, so the fixtures are the bytes written and git
     prints no `LF will be replaced by CRLF` warning into the run. */
  git(dir, "config", "core.autocrlf", "false");
  return dir;
}

describe("the reader tells a contained file from a file that is merely on disk", () => {
  it("⚠ both directions, at a real repository — committed yes, scratch no", () => {
    const dir = scratchRepo();
    try {
      writeFileSync(path.join(dir, ".gitignore"), "ignored.mts\n", "utf8");
      writeFileSync(path.join(dir, "root.ts"), "export const a = 1;\n", "utf8");
      const scripts = path.join(dir, "scripts", "lib");
      mkdirSync(scripts, { recursive: true });
      writeFileSync(path.join(scripts, "committed.mts"), "export const b = 2;\n", "utf8");
      git(dir, "add", ".gitignore", "root.ts", "scripts/lib/committed.mts");
      git(dir, "commit", "-q", "-m", "a tree");

      writeFileSync(path.join(scripts, "_scratch-disposable.mts"), "export const c = 3;\n", "utf8");
      writeFileSync(path.join(dir, "ignored.mts"), "export const d = 4;\n", "utf8");

      const contains = containedIn(dir);

      expect(contains(path.join(dir, "root.ts")), "a committed file read as absent").toBe(true);
      /*
        ⚠ THE SUBDIRECTORY ARM IS THE ONE THAT MATTERS MOST ON THIS PLATFORM,
        and it is separate from the root arm on purpose. A walk here returns
        `C:\…\scripts\lib\committed.mts` and git returns
        `scripts/lib/committed.mts`; a reader that forgets the separator swap
        answers FALSE for every file in a subdirectory, which is every file this
        sweep reads. That failure empties the population and prints a clean tree,
        so it must be asserted rather than inferred from the root case passing.
      */
      expect(
        contains(path.join(scripts, "committed.mts")),
        "a committed file in a SUBDIRECTORY read as absent — the path spelling is wrong, "
          + "and that empties every population while looking like a clean tree",
      ).toBe(true);

      expect(
        contains(path.join(scripts, "_scratch-disposable.mts")),
        "an untracked disposable counted as part of the repository — this is #1617",
      ).toBe(false);
      expect(contains(path.join(dir, "ignored.mts")), "an ignored file counted").toBe(false);
      /* A path outside the root is not this repository's, whatever it is. */
      expect(contains(path.join(tmpdir(), "elsewhere.ts"))).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("⚠ a STAGED file counts, and the docblock says so rather than the behaviour being a surprise", () => {
    /*
      `git ls-files` reads the INDEX, so a staged-but-uncommitted file is
      contained here while the gate — which reads the pushed commit — would not
      have it. The gap is closed by WHEN preflight runs (after the commit, where
      index and commit are the same tree), not by reaching for `git ls-tree
      HEAD`, which would also put this reader one flag away from
      `typecheck-scripts.mts`'s. Pinned as the documented answer so a later
      reading does not treat it as a defect it has just discovered.
    */
    const dir = scratchRepo();
    try {
      writeFileSync(path.join(dir, "seed.ts"), "export const a = 1;\n", "utf8");
      git(dir, "add", "seed.ts");
      git(dir, "commit", "-q", "-m", "seed");
      writeFileSync(path.join(dir, "staged.ts"), "export const b = 2;\n", "utf8");
      git(dir, "add", "staged.ts");

      expect(containedIn(dir)(path.join(dir, "staged.ts"))).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("⚠ REFUSES on a directory git cannot answer for — never 'nothing is contained'", () => {
    /*
      Invariant 7's shape: a reader that answers with an empty set drops every
      file from every population in one go, and an instrument looking at nothing
      reports a clean tree. So the failure is loud. The arm asserts the refusal
      AND that it is not a silent false — a `try/catch` returning `new Set()`
      would pass a "throws or returns" assertion.
    */
    const dir = mkdtempSync(path.join(tmpdir(), "drape-1617-nogit-"));
    try {
      expect(() => trackedFiles(dir)).toThrow(/REFUSED/);
      expect(() => containedIn(dir)).toThrow(/REFUSED/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("⚠ REFUSES on a repository with no files — an unreadable tree, not an empty one", () => {
    /*
      The second road to the same silence, and it is the one a `git init` in the
      wrong place produces. `git ls-files` exits ZERO there and prints nothing,
      so the refusal above cannot catch it: an empty listing has to be its own
      refusal or the population empties with no error at all.
    */
    const dir = scratchRepo();
    try {
      expect(() => trackedFiles(dir)).toThrow(/REFUSED/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("reads this repository, and the answer is not vacuous", () => {
    const files = trackedFiles(repoRoot);
    expect(files.size, "the real tree came back empty or tiny").toBeGreaterThan(3_000);
    /*
      Forward slashes, repo-relative — the spelling every consumer compares
      against. A long-tracked file in a SUBDIRECTORY rather than one this card
      added: the point is the spelling the real tree comes back in, and a
      self-reference would only prove that this commit staged itself.
    */
    expect(files).toContain("package.json");
    expect(files).toContain("scripts/lib/productionMention.mts");
    expect(
      files,
      "git came back with native separators — every consumer compares forward-slashed paths",
    ).not.toContain(`scripts${String.fromCharCode(92)}lib${String.fromCharCode(92)}productionMention.mts`);
  });
});

/* ---- the family may not grow a second reader ------------------------------ */

/**
 * The `git ls-files` CALL, matched on its shape and never on the words — which
 * this file, the reader's docblock and the sweep's all contain in prose.
 * `preflight.mts` learned the same lesson for the same reason; both spellings
 * this repository uses are covered, because the family holds one of each.
 */
const LS_FILES_CALL =
  /exec(?:File)?Sync\s*\(\s*"git"\s*,\s*\[\s*"ls-files"|exec(?:File|)Sync\s*\(\s*"git ls-files"/;

/**
 * The modules the deletion door's verdict is computed by, DERIVED: the door, the
 * script it spawns (read out of the door's own source, so a rename cannot orphan
 * this), and their transitive relative imports.
 *
 * Derived rather than listed because a hand list is the second list this whole
 * card is about. It is deliberately NOT repo-wide: six other modules read `git
 * ls-files` for genuinely different questions — the Atlas's population, the
 * rite's changed paths, preflight's reverse index, the scripts typecheck's
 * tsconfig exclude — and indicting them would be a rule nobody agreed to.
 */
function readingListFamily(): Map<string, string> {
  const door = "scripts/check-cleanup-dispositions.mts";
  const doorSource = readListedSource(path.join(repoRoot, door));
  if (doorSource === null) throw new Error(`${door} is missing — the family cannot be derived`);

  const queue = [door];
  /* Every `scripts/…mts` literal the door names: the script it spawns for the
     reading list is one of them, and reading it here means no filename is
     restated in this suite. */
  for (const match of doorSource.matchAll(/"(scripts\/[\w./-]+\.mts)"/g)) queue.push(match[1]!);

  const family = new Map<string, string>();
  while (queue.length > 0) {
    const file = queue.shift()!;
    if (family.has(file)) continue;
    const source = readListedSource(path.join(repoRoot, file));
    /* A file a listing named can be gone by the time it is read — the rule
       `readListedSource` owns. A member that vanished is not a violation. */
    if (source === null) continue;
    family.set(file, source);
    for (const match of source.matchAll(/from\s+"(\.[\w./-]+\.mts)"/g)) {
      queue.push(path.posix.normalize(path.posix.join(path.posix.dirname(file), match[1]!)));
    }
  }
  return family;
}

/** Members of a family that ask git the population question themselves. */
function ownReaders(family: Map<string, string>): string[] {
  return [...family]
    .filter(([, source]) => LS_FILES_CALL.test(source))
    .map(([file]) => file)
    .sort();
}

describe("one reader, several consumers — the family may not answer this twice", () => {
  it("derives a real family — a rule over an empty closure is not a rule", () => {
    const family = readingListFamily();
    expect(family.size, "the closure collapsed to the door alone").toBeGreaterThan(4);
    /* Named rather than counted: the sweep is where the defect was, and
       `productionMention` is the half that was already right. If either leaves
       this closure the arm below stops watching the thing it is for. */
    expect([...family.keys()]).toContain("scripts/sweep-uncalled-exports-disposable.mts");
    expect([...family.keys()]).toContain("scripts/lib/productionMention.mts");
    expect([...family.keys()]).toContain("scripts/lib/trackedFiles.mts");
  });

  it("⚠ only the shared reader asks git", () => {
    expect(
      ownReaders(readingListFamily()),
      "a second module in the deletion door's own closure reads the population itself. That is "
        + "how the sweep and its classifier came to disagree (#1617): one question, two answers, "
        + "and the looser one decided the reading list. Import `containedIn` from "
        + "scripts/lib/trackedFiles.mts instead.",
    ).toEqual(["scripts/lib/trackedFiles.mts"]);
  });

  it("⚠ and it can SEE one — the detector is driven against a family that has two", () => {
    /*
      The negative control, and without it the arm above passes on any tree where
      the regex matches nothing at all — a spelling drift in `LS_FILES_CALL`
      reads exactly like compliance. Both real spellings are driven, because the
      family holds `execFileSync("git", ["ls-files"…` and this repository also
      uses `execSync("git ls-files"…` elsewhere.
    */
    const shared = 'scripts/lib/trackedFiles.mts';
    const withExecFile = new Map([
      [shared, 'execFileSync("git", ["ls-files"], {});'],
      ["scripts/lib/rogue.mts", 'const t = execFileSync("git", ["ls-files"], { cwd: root });'],
    ]);
    expect(ownReaders(withExecFile)).toEqual([shared, "scripts/lib/rogue.mts"].sort());

    const withExecSync = new Map([
      [shared, 'execFileSync("git", ["ls-files"], {});'],
      ["scripts/lib/rogue.mts", 'const t = execSync("git ls-files", { cwd: root });'],
    ]);
    expect(ownReaders(withExecSync)).toEqual([shared, "scripts/lib/rogue.mts"].sort());

    /* And it does not indict PROSE — this file, the reader and the sweep all
       discuss `git ls-files` in comments, so a word match would indict three
       innocent members and read as a broken rule. */
    expect(ownReaders(new Map([["scripts/lib/prose.mts", "/* asks git ls-files */"]]))).toEqual([]);
  });
});

describe("the consumers actually go through it", () => {
  it("⚠ the sweep gates its walk, and the door gates its stale check", () => {
    /*
      A control that is not invoked does not exist (invariant 7). The reader can
      be perfect and the defect fully open if nothing calls it, and the arms
      above would all stay green — so the call sites are asserted, anchored on
      the statement rather than on the symbol's name appearing somewhere.

      ⚠ Its honest weakness, named: this is a text read, so it proves the call
      EXISTS and not that every path goes through it. The structural half of that
      claim is that the sweep's gate sits inside its `walk` — see this file's
      header.
    */
    const sweep = readListedSource(
      path.join(repoRoot, "scripts/sweep-uncalled-exports-disposable.mts"),
    );
    expect(sweep, "the sweep is missing").not.toBeNull();
    expect(sweep!, "the sweep's walk no longer gates on what the repository contains")
      .toMatch(/if\s*\(contains\(full\)\)\s*out\.push\(full\);/);

    const door = readListedSource(path.join(repoRoot, "scripts/check-cleanup-dispositions.mts"));
    expect(door, "the door is missing").not.toBeNull();
    expect(door!, "the door's `stale` check reads the disk again rather than the repository")
      .toMatch(/!existsSync\(path\)\s*\|\|\s*!contains\(path\)/);

    const classifier = readListedSource(path.join(repoRoot, "scripts/lib/productionMention.mts"));
    expect(classifier, "the classifier is missing").not.toBeNull();
    expect(classifier!, "the classifier stopped excluding what the repository does not contain")
      .toMatch(/files\.filter\(\(file\)\s*=>\s*!contains\(file\)\)/);
  });
});
