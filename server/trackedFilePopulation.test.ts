import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import { importersOfName, readTree } from "../scripts/lib/importerCountDiff.mts";
import { withoutComments } from "../scripts/lib/productionMention.mts";
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
 * The `git ls-files` CALL, matched on its ARGUMENTS and never on the words —
 * which this file, the reader's docblock and the sweep's all contain in prose.
 * `preflight.mts` learned the words half of that lesson for the same reason.
 *
 * ⚠ **AND NOT ON THE FUNCTION'S NAME EITHER, WHICH THE SABOTAGE RUN IS THE
 * RECEIPT FOR.** The first shape of this was
 * `exec(File)?Sync\(\s*"git"\s*,\s*\[\s*"ls-files"`, and the case that adds a
 * second reader to the closure SURVIVED it: the fixture had written
 * `import { execFileSync as rogue }`, so the call read `rogue("git",
 * ["ls-files"…` and a name match could not see it. Matching the arguments is
 * both alias-proof and a truer statement of the question — *does this module run
 * `git ls-files`* — since `spawnSync` and `execFile` reach it too. Both spellings
 * this repository uses are covered, because the tree holds one of each.
 */
const LS_FILES_CALL = /\(\s*"git"\s*,\s*\[\s*"ls-files"|\(\s*"git ls-files"/;

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

/**
 * Members of a family that ask git the population question themselves.
 *
 * Comments are stripped with the house stripper — `withoutComments`, the one the
 * family it is scanning already uses — rather than a second one written here
 * (working law 4). Without it the argument shape above would indict a paragraph:
 * `preflight.mts`'s docblock carries `execFileSync("git", ["ls-files"…` verbatim
 * as prose, and a rule that reddens on an explanation reads as broken.
 */
function ownReaders(family: Map<string, string>): string[] {
  return [...family]
    .filter(([, source]) => LS_FILES_CALL.test(withoutComments(source)))
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

    /* An ALIASED import is caught too, and this is the case the sabotage run
       found surviving a name-matched regex. */
    const withAlias = new Map([
      [shared, 'execFileSync("git", ["ls-files"], {});'],
      [
        "scripts/lib/rogue.mts",
        'import { execFileSync as r } from "node:child_process";\nconst t = r("git", ["ls-files"], {});',
      ],
    ]);
    expect(ownReaders(withAlias)).toEqual([shared, "scripts/lib/rogue.mts"].sort());

    /*
      And it does not indict PROSE. This file, the reader and the sweep all
      discuss the call in comments — and `preflight.mts` carries the whole
      argument shape verbatim in a docblock — so the fixtures here are the REAL
      prose shapes rather than a softened paraphrase, which is what a control
      over its own easy case would be.
    */
    const prose = new Map([
      ["scripts/lib/a.mts", "/* asks git ls-files for the population */ export const a = 1;"],
      ["scripts/lib/b.mts", '// the call is `execFileSync("git", ["ls-files"], …)`\nexport const b = 2;'],
      ["scripts/lib/c.mts", '/* was `execSync("git ls-files", …)` before #1617 */ export const c = 3;'],
    ]);
    expect(ownReaders(prose), "a comment discussing the call was indicted").toEqual([]);
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

/* ---- #1620: the importer reader reads the repository too --------------------- */

/**
 * THE UN-WIRING READER'S OWN POPULATION (#1620) — the sibling #1617's law-7
 * sweep filed rather than folded in, because the repair there was not free.
 *
 * `readTree` in `scripts/lib/importerCountDiff.mts` walked the DISK, and three
 * instruments read its answer to decide something the gate will re-take:
 * `check-cleanup-dispositions`'s `rewired` and `unreadable` arms — the door that
 * licenses a deletion — the un-wiring differ, and the timeline. Reproduced at
 * this repository before the repair was written, one untracked file under
 * `server/`:
 *
 *   | reading                          | clean | with one untracked file |
 *   |----------------------------------|-------|-------------------------|
 *   | importers of `ACTION_CATEGORIES` | 1     | **2**                   |
 *   | `phantom1620Symbol` in `decls`   | false | **true**                |
 *
 * ⚠ **THE CARD SAID TWO CONSUMERS AND THERE ARE THREE** (#909's re-count):
 * `scripts/unwiring-timeline.mts` reads the same function across the whole
 * history. And its shape option said the differ could safely pass nothing,
 * which is false at this repository's own record — the differ's new tree is the
 * tree you are standing in (`… C:/tmp/rite-window-1001 .`,
 * `docs/specs/CLEANUP_MILESTONE_TRIAGE.md`), so an untracked importer there
 * makes a symbol that lost its last real consumer read as still wired. That is
 * the toward-SILENCE direction, which is the one the differ's own docblock says
 * it must never fail in. So every reading of a real repository passes the
 * predicate, and the cost the card declined to pay was measured: `git ls-files`
 * is **18 ms**, 2.0% of one `readTree`, 16 ms of it the bare process spawn.
 */
const READ_TREE_MODULE = "importerCountDiff.mts";

/**
 * Files that IMPORT `readTree` from that module, with the local name each gave
 * it — derived from what the repository contains, so a new caller anywhere is in
 * the population the day it is written.
 *
 * ⚠ Derived rather than listed for a reason with a specimen in this tree:
 * `scripts/sweep-handwritten-vocabularies.mts` declares its OWN
 * `function readTree(): Reading` and calls it with no arguments at all. A rule
 * matching the bare word would indict it, and the sentence explaining why it was
 * exempt would be the second list working law 4 is about.
 */
function readTreeCallers(): Map<string, string> {
  const callers = new Map<string, string>();
  for (const file of trackedFiles(repoRoot)) {
    if (!/\.(ts|tsx|mts)$/.test(file)) continue;
    const source = readListedSource(path.join(repoRoot, file));
    /* A file the listing named can be gone by the time it is read — the rule
       `readListedSource` owns. */
    if (source === null) continue;
    /* The specifier is a string literal, so it is read from the RAW source; the
       CALLS below are read from the comment-stripped source. Same split, and for
       the same reason, as `childProcessSuites.ts`'s `startsAProcess`. */
    const imported = new RegExp(
      String.raw`import\s*\{([^}]*)\}\s*from\s*["'][^"']*` + READ_TREE_MODULE + String.raw`["']`,
    ).exec(source);
    if (imported === null) continue;
    const named = /(?:^|,)\s*readTree(?:\s+as\s+([A-Za-z_$][\w$]*))?\s*(?:,|$)/.exec(imported[1]!);
    if (named === null) continue;
    callers.set(file, named[1] ?? "readTree");
  }
  return callers;
}

/**
 * How many TOP-LEVEL arguments the call starting at `name(` was given, for every
 * such call in `source`. `-1` marks a call whose parentheses do not balance
 * before the file ends, which is a read this cannot trust rather than a finding.
 *
 * Written out rather than regexed because the second argument is itself a call
 * (`containedIn(oldTree)`), so a comma count has to know about nesting — and
 * `codeOnly` is the wrong stripper here: it removes string CONTENTS, which turns
 * `readTree(".")` into a call with no arguments at all.
 */
function argumentCounts(source: string, name: string): number[] {
  const code = withoutComments(source);
  const counts: number[] = [];
  const BACKSLASH = String.fromCharCode(92);
  const call = new RegExp(String.raw`(\w+\s+)?\b` + name + String.raw`\s*\(`, "g");
  for (const match of code.matchAll(call)) {
    /* The declaration is not a call. */
    if ((match[1] ?? "").trim() === "function") continue;
    let index = match.index + match[0].length - 1;
    let depth = 0;
    let quote: string | null = null;
    /*
      ⚠ SEGMENTS, NEVER A COMMA COUNT PLUS ONE. Both the differ and the timeline
      are written multi-line with a TRAILING comma, and `commas + 1` read those
      as THREE arguments — which is not a finding in either direction here, but a
      counter that is wrong about the shape the tree actually holds is a counter
      whose verdicts nobody can lean on. The first form of this arm failed on the
      real spelling and said so.
    */
    const segments: string[] = [""];
    for (; index < code.length; index++) {
      const character = code[index]!;
      const keep = () => { segments[segments.length - 1] += character; };
      if (quote !== null) {
        keep();
        if (character === BACKSLASH) { segments[segments.length - 1] += code[index + 1] ?? ""; index += 1; continue; }
        if (character === quote) quote = null;
        continue;
      }
      if (character === `"` || character === `'` || character === "`") { quote = character; keep(); continue; }
      if (character === "(" || character === "[" || character === "{") {
        depth += 1;
        if (depth > 1) keep();
        continue;
      }
      if (character === ")" || character === "]" || character === "}") {
        depth -= 1;
        if (depth === 0) { counts.push(segments.filter((s) => s.trim().length > 0).length); break; }
        keep();
        continue;
      }
      if (character === "," && depth === 1) { segments.push(""); continue; }
      keep();
    }
    if (depth !== 0) counts.push(-1);
  }
  return counts;
}

/**
 * The files allowed to read a tree WITHOUT asking what it contains, each with
 * the reason at its entry. All three are suites and none of them reads a real
 * repository bare.
 *
 * ⚠ **THE THIRD ENTRY WAS FOUND BY THE ARM BELOW AND NOT BY THE CARD OR BY A
 * GREP.** #1620 names two consumers; the derived population came back with
 * SEVEN files, and `server/unwiringTimeline.test.ts` was in it — the same
 * manufactured-tree class as the differ's suite, invisible to the hand grep that
 * wrote the card because that reading was cut at thirty lines. It is the reason
 * this population is derived rather than listed (#909).
 *
 * ⚠ A declared exemption is only worth its reason staying TRUE, so the arm below
 * asserts each named file exists AND still makes a bare call — an entry that
 * goes dead silently is the drift a list like this exists to avoid, and #1623
 * was the cost of writing a sentence here that was not true of its file.
 */
const MANUFACTURED_TREES =
  "manufactured `mkdtempSync` trees that are not git repositories at all. `trackedFiles` REFUSES "
  + "there by design, and the reader's own header is explicit that the arms which CAN run cheaply "
  + "must not need the ones that cannot.";
const BARE_READING_DECLARED: Readonly<Record<string, string>> = {
  "server/unwiringDiffer.test.ts": `63 readings of ${MANUFACTURED_TREES}`,
  "server/unwiringTimeline.test.ts": `six readings of ${MANUFACTURED_TREES}`,
  "server/trackedFilePopulation.test.ts":
    "this file drives the bare form on purpose, as the BEFORE arm of the discriminator below: "
    + "without it nothing proves the predicate is what excludes an untracked importer, and the "
    + "filter could be a no-op with every arm still green.",
};

describe("the un-wiring reader asks what the repository contains (#1620)", () => {
  it("derives a real caller population — a rule over an empty one is not a rule", () => {
    const callers = readTreeCallers();
    /* Named rather than counted: these are the three instruments whose verdicts
       the gate re-takes, and the card named only the first two. */
    expect([...callers.keys()]).toContain("scripts/check-cleanup-dispositions.mts");
    expect([...callers.keys()]).toContain("scripts/diff-importer-count-across-time.mts");
    expect([...callers.keys()]).toContain("scripts/unwiring-timeline.mts");
    expect([...callers.keys()]).toContain("server/deletionDoorSecondReader.test.ts");
    expect(
      [...callers.keys()],
      "the local `readTree` in sweep-handwritten-vocabularies.mts was collected — the population "
        + "is importers of one module, not everything sharing a name",
    ).not.toContain("scripts/sweep-handwritten-vocabularies.mts");
  });

  it("⚠ every reading of a real repository passes the predicate", () => {
    const offenders: string[] = [];
    for (const [file, local] of readTreeCallers()) {
      if (file in BARE_READING_DECLARED) continue;
      const source = readListedSource(path.join(repoRoot, file));
      if (source === null) continue;
      for (const count of argumentCounts(source, local)) {
        if (count === 1) offenders.push(file);
        expect(
          count,
          `${file}: a readTree call's parentheses do not balance — the read is not trustworthy`,
        ).not.toBe(-1);
      }
    }
    expect(
      [...new Set(offenders)].sort(),
      "a reading of a real repository walks the DISK. An untracked file under server/client/shared/"
        + "drizzle then counts as a production importer AND as a declaration, so the deletion door "
        + "licenses a removal the gate would refuse, and the differ reads a dead symbol as still "
        + "wired. Pass `containedIn(root)` from scripts/lib/trackedFiles.mts (#1620).",
    ).toEqual([]);
  });

  it("⚠ and it can SEE one — the detector is driven both ways", () => {
    /*
      The negative control, without which the arm above passes on any tree where
      the scanner finds nothing at all: a drift in the call pattern reads exactly
      like compliance. The fixtures are the real shapes this tree holds.
    */
    expect(argumentCounts("const t = readTree(REPO);", "readTree")).toEqual([1]);
    expect(argumentCounts("const t = readTree(REPO, contains);", "readTree")).toEqual([2]);
    /* The second argument is itself a call, so a naive comma count reads it as
       one argument and the whole guard passes on the fixed tree. */
    expect(argumentCounts("readTree(oldTree, containedIn(oldTree));", "readTree")).toEqual([2]);
    /* Multi-line, which is how the differ and the timeline are written. */
    expect(argumentCounts("readTree(\n  WORKTREE,\n  containedIn(WORKTREE),\n);", "readTree")).toEqual([2]);
    /* A string argument survives — the reason `codeOnly` is not the stripper here. */
    expect(argumentCounts('readTree(".");', "readTree")).toEqual([1]);
    /* The declaration is not a call, and an aliased local name is followed. */
    expect(
      argumentCounts(
        "export function readTree(root: string, contains?: Pred): Tree {\n  return x;\n}",
        "readTree",
      ),
    ).toEqual([]);
    expect(argumentCounts("const t = look(REPO);", "look")).toEqual([1]);
    /* Prose is not a call: this suite, the reader and the differ all discuss it. */
    expect(
      argumentCounts("/* the bare `readTree(REPO)` form walked the disk */\nexport const a = 1;", "readTree"),
      "a comment discussing the call was counted",
    ).toEqual([]);
  });

  it("⚠ each declared exemption still exists and still makes a bare call", () => {
    const callers = readTreeCallers();
    for (const [file, reason] of Object.entries(BARE_READING_DECLARED)) {
      const source = readListedSource(path.join(repoRoot, file));
      expect(source, `${file} is declared as reading a tree bare and is not in the tree`).not.toBeNull();
      expect(reason.length, `${file}'s exemption carries no reason`).toBeGreaterThan(40);
      const local = callers.get(file);
      expect(local, `${file} is declared here and no longer imports readTree at all`).toBeDefined();
      expect(
        argumentCounts(source!, local!),
        `${file} no longer makes a bare readTree call — its exemption is dead and should be deleted `
          + "rather than left standing as a sentence nobody re-reads",
      ).toContain(1);
    }
  });

  it("⚠ the predicate is what excludes an untracked importer — both directions, at a real repository", () => {
    /*
      A tracked and an untracked file are identical on disk, so only git can tell
      them apart and only a real repository can drive this. The BEFORE arm (the
      bare call) is why this file is a declared exemption above: without it the
      filter could be a no-op and every other arm here would still be green.
    */
    const dir = scratchRepo();
    try {
      const server = path.join(dir, "server");
      mkdirSync(server, { recursive: true });
      writeFileSync(
        path.join(server, "gate.ts"),
        'export function isSensitive(a: string) {\n  return a === "x";\n}\n',
        "utf8",
      );
      writeFileSync(
        path.join(server, "routers.ts"),
        'import { isSensitive } from "./gate";\nexport const route = (a: string) => isSensitive(a);\n',
        "utf8",
      );
      git(dir, "add", "server/gate.ts", "server/routers.ts");
      git(dir, "commit", "-q", "-m", "a tree with one real importer");

      /* Neither of these is committed: one imports the symbol, one declares a
         new export. Both are the shapes measured at this repository. */
      writeFileSync(
        path.join(server, "_scratch-disposable.ts"),
        'import { isSensitive } from "./gate";\nexport const used = isSensitive("x");\n',
        "utf8",
      );
      writeFileSync(path.join(server, "_phantom.ts"), "export const phantomSymbol = 1;\n", "utf8");

      const disk = readTree(dir);
      const repository = readTree(dir, containedIn(dir));

      expect(
        importersOfName(disk, "isSensitive").sort(),
        "the BEFORE arm stopped reproducing #1620 — if the disk reading no longer counts an "
          + "untracked importer, the arm below proves nothing about the predicate",
      ).toEqual(["server/_scratch-disposable.ts", "server/routers.ts"]);
      expect(disk.decls.has("phantomSymbol"), "the declaration half stopped reproducing").toBe(true);

      expect(
        importersOfName(repository, "isSensitive"),
        "an untracked importer survived the predicate — this is #1620, and the deletion door "
          + "reads it as a production consumer",
      ).toEqual(["server/routers.ts"]);
      expect(
        repository.decls.has("phantomSymbol"),
        "an untracked file's export is in `decls`, so the door can be answered about a "
          + "declaration this repository does not contain",
      ).toBe(false);
      expect(repository.files, "the predicate dropped more than the two untracked files").toBe(disk.files - 2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
