/**
 * THE SHIFT WORKTREE HELPER'S ARMS (#543).
 *
 * ⚠ THE JUNCTION ARMS ARE A MEASUREMENT, AND ONE OF THEM IS THE NEGATIVE
 * CONTROL THE OTHER THREE DEPEND ON.
 *
 * Deleting a worktree's PARENT directory is safe in all three tools tested —
 * node's `rmSync`, PowerShell's `Remove-Item`, git-bash's `rm -rf` — because
 * Windows surfaces a junction as a reparse point and each unlinks it rather
 * than descending. **`rm -rf <link>/` with a trailing slash does NOT: it
 * empties the main tree's install**, and that is the form a shift types by
 * hand.
 *
 * That destroying arm is the negative control. Without it the three
 * "survived" arms would pass just as happily on a platform that had no
 * junctions at all, or on a fixture where `mklink` silently failed — which is
 * exactly what happened on the first hand-run of this measurement, reporting
 * the install safe when the delete had met an ordinary empty directory. So
 * every fixture here PROVES the junction resolves before deleting anything.
 *
 * The script keeps unlinking first regardless of which form it uses: it costs
 * one `rmdir`, and being wrong about it once costs every worktree's dependency
 * install and the founder's running session.
 *
 * The rest is the refusal logic, driven pure in both directions — a helper that
 * refuses too readily gets `--force`d by habit and is then not a guard at all,
 * so every refusal has an arm proving it does NOT fire on the clean case.
 */
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** git-bash's own rm, which is what a shift types by hand. */
const RM_EXE = "C:/Program Files/Git/usr/bin/rm.exe";

/** git-bash takes forward slashes; `mkdtempSync` hands back backslashes. */
function toPosix(p: string): string {
  return p.split("\\").join("/");
}

import { describe, expect, it, vi } from "vitest";

import {
  branchForRemoval,
  branchReadFailed,
  branchToCreate,
  classifyIgnored,
  decideRemoval,
  decideReviewRemoval,
  describeKeptIgnored,
  entryForPath,
  humanBytes,
  ignoredReadingLine,
  keptIgnoredPrefixFor,
  mergedPrArgs,
  parseWorktreeList,
  parseWorktreeStatus,
  worktreeStatusArgs,
  KEPT_IGNORED_PATHS,
  prHeadFetchArgs,
  prHeadFetchIntoRefArgs,
  prReadFailed,
  readHeadAgainstPrHead,
  readMergedPullRequest,
  readShippedCommits,
  removalStateFromShipReading,
  reviewCheckoutRef,
  reviewPlanFor,
  reviewWorktreeAddArgs,
  shipReadingFor,
  junctionMustBeGone,
  looksCrlfSmudged,
  planFor,
  validatePrNumber,
  validateSlug,
  worktreeListArgs,
  type RemovalState,
  type ShipReading,
} from "../scripts/lib/shiftWorktree.mts";
import { measureTree, MEASURE_ENTRY_CAP } from "../scripts/lib/riteWorktree.mts";
import { CHILD_PROCESS_TEST_TIMEOUT_MS } from "./testing/childProcessTimeout";

/* This suite drives a real child process, so it declares the class's timeout
   rather than racing vitest's 5 s default under a parallel run (#548). */
vi.setConfig({ testTimeout: CHILD_PROCESS_TEST_TIMEOUT_MS });

const clean: RemovalState = {
  unpushedCommits: 0,
  dirtyFiles: [],
  registered: true,
  junctionPresent: false,
  /* Read, and nothing merged this branch (#1540). Explicit rather than omitted
     because the field is REQUIRED: `null` and "nobody asked" are different facts
     and an omitted field would silently pick one. Every arm below that is not
     about the merge overrides it. */
  mergedPullRequest: null,
  /* No merged pull request was found, so there is nothing past one either
     (#1540, at review). Required for the same reason as the field above. */
  unshippedPastMerge: null,
  /* ⚠ GIT WAS ASKED ABOUT IGNORED FILES AND FOUND NOTHING (#1823) — required
     rather than optional for exactly the `mergedPullRequest` reason above, and it
     is the whole lesson of the card: an EMPTY list and a reading nobody took were
     indistinguishable, and that is how a tree holding 1.36 GB read as clean. */
  keptIgnored: [],
  disposableIgnored: [],
};

describe("validateSlug — it ends in a recursive delete, so it is checked once here", () => {
  it("accepts the shapes shifts actually use", () => {
    for (const slug of ["preflight", "shift-worktree", "n1-sheet-record", "issue543"]) {
      expect(validateSlug(slug), slug).toEqual({ ok: true });
    }
  });

  it("REFUSES a slug that would walk the delete out of the worktree parent", () => {
    for (const slug of ["..", "../..", "a/../..", "a/b"]) {
      const verdict = validateSlug(slug);
      expect(verdict.ok, slug).toBe(false);
    }
  });

  it("REFUSES a slug that would read as a flag to the next tool", () => {
    expect(validateSlug("-force").ok).toBe(false);
    expect(validateSlug("--dry-run").ok).toBe(false);
  });

  it("REFUSES an empty slug, which would make the path the parent directory itself", () => {
    expect(validateSlug("").ok).toBe(false);
  });

  it("REFUSES shell and path metacharacters", () => {
    for (const slug of ["a b", "a;rm", "a$b", 'a"b', "a\\b", "a*b", "a~b"]) {
      expect(validateSlug(slug).ok, slug).toBe(false);
    }
  });
});

describe("planFor", () => {
  it("puts the worktree beside the repository, never inside it", () => {
    const plan = planFor("thing", "C:/Users/Admin/Drape", "C:/Users/Admin");
    expect(plan.path).toBe("C:/Users/Admin/drape-shift-thing");
    expect(plan.nodeModulesLink).toBe("C:/Users/Admin/drape-shift-thing/node_modules");
    expect(plan.path.startsWith("C:/Users/Admin/Drape/")).toBe(false);
  });

  it("⚠ CARRIES NO BRANCH — the removal path cannot reach the convention (#1613)", () => {
    /* This arm replaced `expect(plan.branch).toBe("team/thing")`, and the swap
       IS the repair. `team/<slug>` is true only of the branch `add` creates; a
       worktree made on an existing branch has a directory name and a branch name
       with nothing to do with each other, and `remove` printed the convention as
       fact four lines above a recursive delete. Tightening the five call sites
       would have left the derived name one property access away from every
       future edit — so it is not on the object `remove` holds. A key-level
       assertion rather than a type-level one, because a re-added field must
       redden a RUN and not merely a `tsc` somebody may not have run. */
    expect(Object.keys(planFor("thing", "C:/Users/Admin/Drape", "C:/Users/Admin"))).not.toContain("branch");
  });

  it("branchToCreate is the convention, and it is `add`'s alone", () => {
    expect(branchToCreate("thing")).toBe("team/thing");
  });
});

describe("decideRemoval — refusing without becoming a rubber stamp", () => {
  it("proceeds on a clean, pushed, registered worktree", () => {
    const verdict = decideRemoval(clean, false);
    expect(verdict.proceed).toBe(true);
    if (verdict.proceed) expect(verdict.warnings).toEqual([]);
  });

  it("REFUSES unpushed commits — that is a shift's work about to vanish", () => {
    const verdict = decideRemoval({ ...clean, unpushedCommits: 2 }, false);
    expect(verdict.proceed).toBe(false);
    if (!verdict.proceed) {
      expect(verdict.reason).toContain("2 commits");
      expect(verdict.overridable).toBe(true);
    }
  });

  it("REFUSES uncommitted work and names the files", () => {
    const verdict = decideRemoval({ ...clean, dirtyFiles: ["server/a.ts", "server/b.ts"] }, false);
    expect(verdict.proceed).toBe(false);
    if (!verdict.proceed) expect(verdict.reason).toContain("server/a.ts");
  });

  it("--force proceeds, and SAYS WHAT IT IS DESTROYING rather than going quiet", () => {
    const verdict = decideRemoval({ ...clean, unpushedCommits: 3, dirtyFiles: ["x.ts"] }, true);
    expect(verdict.proceed).toBe(true);
    if (verdict.proceed) {
      expect(verdict.warnings.join(" ")).toContain("3 unpushed commit(s)");
      expect(verdict.warnings.join(" ")).toContain("1 uncommitted file(s)");
    }
  });

  it("an unregistered path is a warning, not a refusal — the directory is still litter", () => {
    const verdict = decideRemoval({ ...clean, registered: false }, false);
    expect(verdict.proceed).toBe(true);
    if (verdict.proceed) expect(verdict.warnings.join(" ")).toContain("not have this path registered");
  });
});

/**
 * ⚠ **`git status` CANNOT SEE AN IGNORED FILE, AND `output/` IS IGNORED (#1823).**
 *
 * The tool read `git status --porcelain` for its whole life and that reading is
 * what authorises a recursive delete. Measured 2026-10-03: the sweep asked about
 * `drape-shift-sign-engine-court-1394`, was answered `uncommitted 0 file(s)`, and
 * the directory held **1.357 GB in 188 files** — 155 renders and the eye strips a
 * founder verdict was given on. Nothing was lost, because the sweep moved every
 * byte out by hand first; what is honest is that EVERY worktree removal this
 * program has performed ran on that verdict.
 *
 * ⚠ **THIS GUARD'S FAILURE MODE IS READING CLEAN, SO IT GETS BOTH CONTROLS
 * (working law 2), AND THE CARD ASKED FOR BOTH BY NAME.** The positive control is
 * a real file under `output/` in a real temporary worktree; the negative is a
 * `node_modules` link alone, which must NOT trip it. The arms against a real git
 * are below — a fixture of what this suite BELIEVES porcelain prints could never
 * have caught this, because the defect was a belief about what porcelain prints.
 */
describe("the ignored population — the fact `dirtyFiles` cannot see (#1823)", () => {
  it("⚠ THE CALL IS ASSERTED AT THE WIRE, and it carries --ignored (working law 5)", () => {
    expect(worktreeStatusArgs()).toEqual(["status", "--porcelain", "--ignored=matching"]);
  });

  it("splits a porcelain status on the FIRST TWO COLUMNS, not on a substring", () => {
    /* A path may contain `!!`, and the marker lives in the X/Y position only. */
    const read = parseWorktreeStatus(
      [" M server/a.ts", "?? scratch.png", "!! output/", "!! node_modules/", "?? weird!!name.txt", ""].join("\n"),
    );
    expect(read.dirty).toEqual(["server/a.ts", "scratch.png", "weird!!name.txt"]);
    expect(read.ignored).toEqual(["output/", "node_modules/"]);
  });

  it("⚠ THE NAMED SET, NOT A FLAT `ignored files present` — the card's own shape", () => {
    const { kept, disposable } = classifyIgnored([
      "node_modules/", ".env", "dist/", "output/", ".vite/", ".theme-shots/",
    ]);
    expect(kept).toEqual(["output/", ".theme-shots/"]);
    /* ⚠ THE NEGATIVE HALF MATTERS AS MUCH: a guard that refuses on a build cache
       is a guard that gets `--force`d by habit, which is this module's own stated
       hazard. These four are present on virtually every worktree ever cut. */
    expect(disposable).toEqual(["node_modules/", ".env", "dist/", ".vite/"]);
  });

  it("matches a file UNDER a kept prefix, and never a lookalike beside it", () => {
    expect(keptIgnoredPrefixFor("output/court/frame-01.png")?.prefix).toBe("output/");
    expect(keptIgnoredPrefixFor("output")?.prefix).toBe("output/");
    /* `outputs/` and `my-output/` are different directories, on a tool that ends
       in a recursive delete — the same exact-match doctrine `entryForPath` has. */
    expect(keptIgnoredPrefixFor("outputs/x.png")).toBeNull();
    expect(keptIgnoredPrefixFor("server/output/x.png")).toBeNull();
  });

  it("⚠ A QUOTED PATH IS STILL READ — git quotes a name with a space in it", () => {
    /* Without the dequote the one directory whose name forced a quote would read
       as disposable, which is the silent direction this whole card is about. */
    expect(keptIgnoredPrefixFor('"output/eye strip.png"')?.prefix).toBe("output/");
  });

  it("⚠ EVERY KEPT PREFIX IS STILL A RULE IN `.gitignore` — a second reader", () => {
    /* The set is a JUDGEMENT and cannot be derived (no reader tells a court's
       renders from a build cache by path). What CAN be derived is whether the
       rules it names still exist: an ignore rule renamed out from under this set
       would leave it unreachable with nothing going red, which is the shape that
       let the original defect live. */
    const gitignore = readFileSync(join(import.meta.dirname, "..", ".gitignore"), "utf8")
      .split(/\r?\n/)
      .map((l) => l.trim());
    expect(KEPT_IGNORED_PATHS.length).toBeGreaterThan(0);
    for (const { prefix, why } of KEPT_IGNORED_PATHS) {
      expect(gitignore, `${prefix} is in the kept set but is no longer a .gitignore rule`).toContain(prefix);
      expect(why.length, `${prefix} carries no reason`).toBeGreaterThan(20);
    }
  });

  it("REFUSES the kept set, overridably — and `--force` says what it destroys", () => {
    const court = [{ path: "output/", bytes: 1_456_822_000, files: 188, capped: false }];
    const verdict = decideRemoval({ ...clean, keptIgnored: court }, false);
    expect(verdict.proceed).toBe(false);
    if (!verdict.proceed) {
      expect(verdict.reason).toContain("output/");
      /* The number that makes it a decision rather than a notice. */
      expect(verdict.reason).toContain("1.36 GB");
      expect(verdict.reason).toContain("188 files");
      expect(verdict.overridable).toBe(true);
    }
    const forced = decideRemoval({ ...clean, keptIgnored: court }, true);
    expect(forced.proceed).toBe(true);
    if (forced.proceed) {
      expect(forced.warnings.join(" ")).toContain("destroying ignored work worth keeping");
      expect(forced.warnings.join(" ")).toContain("1.36 GB");
    }
  });

  it("⚠ NEVER REFUSES ON A DISPOSABLE — `node_modules` is on every worktree", () => {
    const verdict = decideRemoval(
      { ...clean, disposableIgnored: ["node_modules/", ".env", "dist/", ".vite/"] },
      false,
    );
    expect(verdict.proceed, "a build cache refused a removal — this guard would be --force`d away").toBe(true);
    if (verdict.proceed) expect(verdict.warnings).toEqual([]);
  });

  it("⚠ COMMITS AND TRACKED WORK OUTRANK ARTIFACTS in the refusal order", () => {
    /* A refusal naming renders over lost commits would send a shift to copy a
       directory and then `--force` past the commits. */
    const verdict = decideRemoval(
      { ...clean, unpushedCommits: 2, keptIgnored: [{ path: "output/", bytes: 10, files: 1, capped: false }] },
      false,
    );
    expect(verdict.proceed).toBe(false);
    if (!verdict.proceed) expect(verdict.reason).toContain("on no remote");
  });

  it("the printed line says how many were LOOKED at, even when there is nothing", () => {
    /* The report that lost the court had NO ignored line. Silence about a
       population cannot be told apart from an empty population — #1540's lesson
       read in the other direction. */
    expect(ignoredReadingLine({ keptIgnored: [], disposableIgnored: [] })).toContain("ignoring nothing");
    expect(ignoredReadingLine({ keptIgnored: [], disposableIgnored: ["node_modules/", ".env"] }))
      .toBe("2 path(s), none worth keeping (node_modules/, .env)");
    const line = ignoredReadingLine({
      keptIgnored: [{ path: "output/", bytes: 1_456_822_000, files: 188, capped: false }],
      disposableIgnored: ["node_modules/"],
    });
    expect(line).toContain("WORTH KEEPING");
    expect(line).toContain("1.36 GB in 188 files");
    expect(line).toContain("1 disposable (node_modules/)");
  });

  it("a capped walk reads as a FLOOR, never as a measurement", () => {
    expect(describeKeptIgnored({ path: "output/", bytes: 2048, files: 2, capped: true }))
      .toBe("output/ (at least 2.0 kB in at least 2 files)");
  });

  it("⚠ humanBytes REACHES GB — the unit the 1.357 GB that filed this is read in", () => {
    /* The four `kb()` helpers already in the tree all stop at kB, which is why
       this is a fifth declaration and says so in its own docblock. */
    expect(humanBytes(0)).toBe("0 B");
    expect(humanBytes(1536)).toBe("1.5 kB");
    expect(humanBytes(5 * 1024 ** 2)).toBe("5.0 MB");
    expect(humanBytes(1_456_822_000)).toBe("1.36 GB");
  });
});

/**
 * ⚠ **THE CONTROLS, AGAINST A REAL GIT AND A REAL WORKTREE — the card asked for
 * both by name, and a fixture could not have caught this defect (#1823).**
 *
 * The whole fault was a belief about what `git status --porcelain` prints, so an
 * arm asserting this suite's belief about that output proves nothing. These build
 * a repository, add a worktree, put a real file under `output/`, and read git.
 *
 *  - POSITIVE: the old call prints NOTHING over that file (the defect,
 *    reproduced), the new one reports it, and the removal REFUSES with its bytes.
 *  - NEGATIVE: a `node_modules` link alone does not trip it.
 */
describe("the ignored reading, against a real repository (#1823)", () => {
  function withWorktree(body: (paths: { repo: string; tree: string }) => void): void {
    const root = toPosix(mkdtempSync(join(tmpdir(), "drape-1823-")));
    const repo = `${root}/repo`;
    const tree = `${root}/drape-shift-ignored-1823`;
    const run = (args: string[], cwd = repo) => {
      const result = spawnSync("git", args, { cwd, encoding: "utf8" });
      if (result.error) throw result.error;
      expect(result.status, `git ${args.join(" ")} — ${result.stderr}`).toBe(0);
      return (result.stdout ?? "").trim();
    };
    try {
      mkdirSync(repo, { recursive: true });
      run(["init", "-b", "main"], repo);
      /* The real repository's own rules, so the arm cannot pass against a
         `.gitignore` this suite invented. */
      writeFileSync(
        join(repo, ".gitignore"),
        readFileSync(join(import.meta.dirname, "..", ".gitignore"), "utf8"),
      );
      run(["add", ".gitignore"]);
      run(["-c", "user.email=seat@drape.test", "-c", "user.name=Seat", "commit", "-m", "rules"]);
      run(["worktree", "add", tree, "-b", "team/ignored-1823"]);
      body({ repo, tree });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }

  const statusIn = (tree: string, args: string[]) => {
    const result = spawnSync("git", args, { cwd: tree, encoding: "utf8" });
    expect(result.status, result.stderr).toBe(0);
    return result.stdout ?? "";
  };

  it("⚠ POSITIVE CONTROL — a file under `output/` is INVISIBLE to the old call and reported by the new one", () => {
    withWorktree(({ tree }) => {
      mkdirSync(join(tree, "output", "court"), { recursive: true });
      const bytes = Buffer.alloc(4096, 7);
      writeFileSync(join(tree, "output", "court", "frame-01.png"), bytes);
      writeFileSync(join(tree, "output", "REPORT.txt"), "the verdict");

      /* THE DEFECT, REPRODUCED: the reading this tool made for its whole life
         says the worktree is clean while 4 kB of a court sits in it. */
      expect(
        statusIn(tree, ["status", "--porcelain"]).trim(),
        "`git status --porcelain` saw an ignored file — this arm can no longer demonstrate the defect",
      ).toBe("");

      const read = parseWorktreeStatus(statusIn(tree, worktreeStatusArgs()));
      expect(read.dirty).toEqual([]);
      const { kept } = classifyIgnored(read.ignored);
      expect(kept, "the repaired reading still cannot see output/").toContain("output/");

      /* And the measurement the refusal prints, taken off the real disk. */
      const measured = measureTree(join(tree, "output"));
      expect(measured.files).toBe(2);
      expect(measured.bytes).toBe(4096 + "the verdict".length);
      expect(measured.capped).toBe(false);

      const verdict = decideRemoval(
        { ...clean, keptIgnored: [{ path: "output/", ...measured }] },
        false,
      );
      expect(verdict.proceed, "the removal still proceeds over a court's artifacts").toBe(false);
      if (!verdict.proceed) expect(verdict.reason).toContain("output/ (4.0 kB in 2 files)");
    });
  });

  it("⚠ NEGATIVE CONTROL — a node_modules link alone does not trip it", () => {
    withWorktree(({ repo, tree }) => {
      /* A junction is what `shift-worktree add` makes on Windows and node's
         `symlinkSync(…, "junction")` is the same call it uses; the fallback keeps
         the arm honest on a POSIX runner, where a dir symlink is the equivalent. */
      mkdirSync(join(repo, "node_modules", "left-pad"), { recursive: true });
      writeFileSync(join(repo, "node_modules", "left-pad", "index.js"), "module.exports = 0;");
      try {
        symlinkSync(join(repo, "node_modules"), join(tree, "node_modules"), "junction");
      } catch {
        symlinkSync(join(repo, "node_modules"), join(tree, "node_modules"), "dir");
      }

      const read = parseWorktreeStatus(statusIn(tree, worktreeStatusArgs()));
      const { kept, disposable } = classifyIgnored(read.ignored);
      expect(kept, "a node_modules link read as work worth keeping").toEqual([]);
      expect(disposable.join(" "), "git stopped reporting the junction at all").toContain("node_modules");

      const verdict = decideRemoval({ ...clean, keptIgnored: [], disposableIgnored: [...disposable] }, false);
      expect(verdict.proceed, "a node_modules junction refused a removal").toBe(true);

      /* ⚠ AND THE MEASUREMENT MUST NOT WALK THROUGH IT. The scar in this
         module's own header is a recursive act that followed this link into the
         main checkout; a byte count that descended it would walk a gigabyte to
         answer a question about a seat's `output/`. */
      const measured = measureTree(join(tree, "node_modules"));
      expect(measured.files, "measureTree followed the junction into the real install").toBe(0);
      expect(measured.bytes).toBe(0);
    });
  });

  it("measureTree returns zero for a path that is not there, rather than throwing", () => {
    withWorktree(({ tree }) => {
      expect(measureTree(join(tree, "output"))).toEqual({ bytes: 0, files: 0, capped: false });
    });
  });

  it("the walk cap is a real number and the floor wording keys on it", () => {
    expect(MEASURE_ENTRY_CAP).toBeGreaterThan(1000);
  });
});

/**
 * ⚠ **THE GUARD HAD STOPPED BEING ABLE TO TELL ITS TWO CASES APART (#1540).**
 *
 * `delete_branch_on_merge` went on 2026-09-29 (#1434) and **a squash merge does
 * not make the branch's commits ancestors of `main`** — so from that night every
 * merged branch read as `N commits on this branch are on no remote`, the exact
 * words of the refusal that exists to stop a shift's work vanishing. Measured on
 * PR #1536 the same evening: merged as `ea6c407b`, remote ref deleted, helper
 * refused, `--force` was correct, and it printed *"⚠ --force is destroying 2
 * unpushed commit(s)"* over work that had already shipped.
 *
 * **The defect is not the refusal, it is that the message argues for the wrong
 * act on the COMMON path** — and the two ways to be wrong after reading it are
 * not symmetric: `--force` by reflex is right tonight and wrong on the branch the
 * guard exists for, and believing it leaves the worktree, which is how this
 * machine came to hold seventeen of them.
 *
 * So these arms pin the three answers apart. A merged pull request clears the
 * refusal; no pull request keeps it, which is the case the card asked for by
 * name; and a read nobody could take keeps it too, while SAYING it was not
 * taken — never quietly asserting that nothing merged.
 */
describe("decideRemoval — a merged branch is not lost work (#1540)", () => {
  /** What the helper saw on the night of PR #1536: two commits, no remote ref. */
  const squashMerged: RemovalState = { ...clean, unpushedCommits: 2 };

  it("⚠ a MERGED pull request clears the refusal — the measured PR #1536 case", () => {
    const verdict = decideRemoval({ ...squashMerged, mergedPullRequest: 1536 }, false);
    expect(verdict.proceed, "a branch that merged an hour ago is litter, not lost work").toBe(true);
    if (verdict.proceed) {
      /* ⚠ AND IT DOES NOT SAY "DESTROYING". The count is still said — a shift
         asked to trust a tool about deleting things is owed the number it saw —
         but a warning that cries wolf on the common path is how the real one
         stops being read. */
      const said = verdict.warnings.join(" ");
      expect(said).toContain("PR #1536");
      expect(said).toContain("2 commit(s)");
      expect(said, "it must not claim to be destroying work that shipped").not.toContain("destroying");
    }
  });

  it("⚠ NO merged pull request still REFUSES — this is the case worth refusing", () => {
    /* The negative control the arm above is worthless without: if a merged PR
       were not what cleared it, something else did. */
    const verdict = decideRemoval({ ...squashMerged, mergedPullRequest: null }, false);
    expect(verdict.proceed).toBe(false);
    if (!verdict.proceed) {
      expect(verdict.reason).toContain("2 commits");
      expect(verdict.reason, "the shift is told WHICH question was asked")
        .toContain("no merged pull request names this branch");
      expect(verdict.reason).toContain("this directory is their only copy");
      expect(verdict.overridable).toBe(true);
    }
  });

  it("⚠ A READ NOBODY COULD TAKE REFUSES, AND SAYS IT WAS NOT TAKEN", () => {
    /* The third answer, kept apart from the second on purpose: `null` says
       *asked, and nothing merged this*; `unreadable` says *nobody asked*. An
       absent `gh` must never be able to assert that a branch never merged. */
    const verdict = decideRemoval(
      { ...squashMerged, mergedPullRequest: { unreadable: "`gh pr list` exited -1: spawn gh ENOENT" } },
      false,
    );
    expect(verdict.proceed).toBe(false);
    if (!verdict.proceed) {
      expect(verdict.reason).toContain("COULD NOT BE READ");
      expect(verdict.reason).toContain("spawn gh ENOENT");
      expect(verdict.reason, "an unread board is not a finding about the branch")
        .toContain("the safe answer rather than a finding");
      /* ⚠ AND IT MUST NOT CLAIM NOTHING MERGED — the sentence the `null` arm
         above asserts is the one this arm forbids. */
      expect(verdict.reason).not.toContain("no merged pull request names this branch");
    }
  });

  it("--force still reaches it, and an UNREADABLE read does not soften the warning", () => {
    const verdict = decideRemoval(
      { ...squashMerged, mergedPullRequest: { unreadable: "offline" } },
      true,
    );
    expect(verdict.proceed).toBe(true);
    if (verdict.proceed) {
      expect(verdict.warnings.join(" "), "with no proof it merged, --force is still destroying")
        .toContain("destroying 2 unpushed commit(s)");
    }
  });

  it("a merged pull request says so even under --force — the verb follows the FACT", () => {
    const verdict = decideRemoval({ ...squashMerged, mergedPullRequest: 1536 }, true);
    expect(verdict.proceed).toBe(true);
    if (verdict.proceed) {
      expect(verdict.warnings.join(" ")).toContain("PR #1536");
      expect(verdict.warnings.join(" ")).not.toContain("destroying");
    }
  });

  it("nothing unpushed proceeds silently whatever the pull request says", () => {
    for (const merged of [null, 1536, { unreadable: "offline" } as const]) {
      const verdict = decideRemoval({ ...clean, mergedPullRequest: merged }, false);
      expect(verdict.proceed).toBe(true);
      if (verdict.proceed) expect(verdict.warnings).toEqual([]);
    }
  });

  it("the read-failure test has ONE owner, and it answers both ways", () => {
    expect(prReadFailed({ unreadable: "x" })).toBe(true);
    expect(prReadFailed(null)).toBe(false);
    expect(prReadFailed(1536)).toBe(false);
  });
});

/**
 * THE READING ITSELF — over an injected runner, so both directions are drivable
 * without a network (#1540).
 */
describe("readMergedPullRequest", () => {
  it("⚠ THE CALL IS ASSERTED AT THE WIRE, and it asks for MERGED only", () => {
    /* `--state all` would count a CLOSED-unmerged pull request over a deleted
       branch as proof the work shipped, and that is the case still worth
       refusing: rejected work with no remote ref is nowhere. */
    expect(mergedPrArgs("team/refused-view-1492")).toEqual([
      "pr", "list",
      "--head", "team/refused-view-1492",
      "--state", "merged",
      "--limit", "5",
      "--json", "number,mergedAt",
    ]);
  });

  it("reads the number, and the NEWEST merge when a branch merged twice", () => {
    const rows = JSON.stringify([
      { number: 1200, mergedAt: "2026-09-01T00:00:00Z" },
      { number: 1536, mergedAt: "2026-09-29T13:11:00Z" },
    ]);
    expect(readMergedPullRequest("team/x", () => ({ status: 0, out: rows, err: "" }))).toBe(1536);
  });

  it("an empty list is `null` — asked, and nothing merged this", () => {
    expect(readMergedPullRequest("team/x", () => ({ status: 0, out: "[]", err: "" }))).toBeNull();
  });

  it("⚠ EVERY FAILURE IS `unreadable`, NEVER `null` — four roads, each named", () => {
    /* The two are one character apart in a hurry and opposite in meaning. An
       absent `gh` asserting "never merged" would make every removal read as the
       dangerous case forever, which trains the exact habit this card is about. */
    const roads: Array<[string, ReturnType<typeof readMergedPullRequest>]> = [
      ["a non-zero exit", readMergedPullRequest("team/x", () => ({ status: 1, out: "", err: "gh: not logged in" }))],
      ["a throw", readMergedPullRequest("team/x", () => { throw new Error("spawn gh ENOENT"); })],
      ["not JSON", readMergedPullRequest("team/x", () => ({ status: 0, out: "gh: command not found", err: "" }))],
      ["not a list", readMergedPullRequest("team/x", () => ({ status: 0, out: '{"number":1}', err: "" }))],
    ];
    for (const [road, answer] of roads) {
      expect(prReadFailed(answer), `${road} must be unreadable, not null`).toBe(true);
    }
    /* Each says WHY, because a refusal quoting "unreadable" and nothing else
       sends a shift looking in the wrong place. */
    const exited = readMergedPullRequest("team/x", () => ({ status: 1, out: "", err: "gh: not logged in" }));
    expect(prReadFailed(exited) && exited.unreadable).toContain("not logged in");
  });

  it("a row with no usable number is not a merge", () => {
    const rows = JSON.stringify([{ number: 0, mergedAt: "2026-09-29T00:00:00Z" }, { mergedAt: "x" }]);
    expect(readMergedPullRequest("team/x", () => ({ status: 0, out: rows, err: "" }))).toBeNull();
  });
});

describe("junctionMustBeGone — the refusal --force cannot reach", () => {
  it("passes once the junction is gone", () => {
    expect(junctionMustBeGone(false).ok).toBe(true);
  });

  it("REFUSES while the junction is present", () => {
    const verdict = junctionMustBeGone(true);
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toContain("node_modules");
  });

  it("⚠ IS NOT PART OF THE FORCE-ABLE VERDICT — a habitual --force must not reach it", () => {
    // The arm that keeps the two apart. `decideRemoval` is about losing a
    // shift's work, where --force is a legitimate answer; this is about
    // emptying the machine's dependency install, where it never is. If the
    // junction check ever migrated into decideRemoval, this reddens.
    const withJunction: RemovalState = { ...clean, junctionPresent: true };
    const forced = decideRemoval(withJunction, true);
    expect(forced.proceed).toBe(true); // decideRemoval says nothing about it…
    expect(junctionMustBeGone(withJunction.junctionPresent).ok).toBe(false); // …this still refuses.
  });
});

describe("looksCrlfSmudged", () => {
  it("spots a CRLF checkout and passes an LF one", () => {
    expect(looksCrlfSmudged('{\r\n  "name": "drape"\r\n}')).toBe(true);
    expect(looksCrlfSmudged('{\n  "name": "drape"\n}')).toBe(false);
  });
});

/**
 * The real-filesystem arms. Skipped off Windows, where junctions do not exist
 * and the question does not arise — and SAID so rather than passing silently.
 */
describe.runIf(process.platform === "win32")("junctions, against the real filesystem", () => {
  function makeJunction(link: string, target: string): boolean {
    const result = spawnSync("cmd", ["/c", "mklink", "/J", link.replace(/\//g, "\\"), target.replace(/\//g, "\\")], {
      encoding: "utf8",
    });
    return result.status === 0;
  }

  /** A worktree-shaped fixture: a real install, a tree, a junction between them. */
  function withJunction(name: string, body: (paths: { real: string; tree: string; link: string; canary: string }) => void) {
    const root = mkdtempSync(join(tmpdir(), `drape-junction-${name}-`));
    try {
      const real = join(root, "real-node-modules");
      const tree = join(root, "worktree");
      mkdirSync(real);
      mkdirSync(tree);
      const canary = join(real, "canary.txt");
      writeFileSync(canary, "the main tree's install");
      const link = join(tree, "node_modules");
      expect(makeJunction(link, real), "could not create a junction — this fixture proves nothing without one").toBe(true);
      // ⚠ THE PROOF, NOT THE EXIT CODE. A hand-run of this measurement once
      // reported the install safe because `mklink` had failed unnoticed and the
      // delete met an ordinary empty directory. A null result is evidence only
      // if the fixture could have produced a positive.
      expect(
        readFileSync(join(link, "canary.txt"), "utf8"),
        "the junction does not resolve — this fixture cannot measure anything",
      ).toBe("the main tree's install");
      body({ real, tree, link, canary });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }

  it("MEASUREMENT — node's recursive rmSync does NOT follow a junction", () => {
    withJunction("node-rm", ({ tree, canary }) => {
      // The mistake performed deliberately: delete the tree with the junction
      // still in it. This is the exact call `shift-worktree remove` makes.
      rmSync(tree, { recursive: true, force: true });
      expect(
        existsSync(canary),
        "node's rmSync followed the junction — the removal order is now LOAD-BEARING, not belt-and-braces; read lib/shiftWorktree.mts's header, it says the opposite",
      ).toBe(true);
    });
  });

  it("MEASUREMENT — git-bash `rm -rf <parent>` does NOT follow a junction", () => {
    withJunction("bash-rm", ({ tree, canary }) => {
      const rm = spawnSync(RM_EXE, ["-rf", toPosix(tree)], { encoding: "utf8" });
      // A missing git-bash is not a pass: say so rather than asserting nothing.
      expect(rm.error, "git-bash rm.exe not found — this arm measured nothing").toBeUndefined();
      expect(
        existsSync(canary),
        "git-bash rm -rf followed the junction — the removal order is now load-bearing; the header says otherwise and must be corrected",
      ).toBe(true);
    });
  });

  it("⚠ NEGATIVE CONTROL — `rm -rf <link>/` DOES empty the main tree's install", () => {
    // The one form that follows the junction, and the form a shift types by
    // hand. It is asserted DESTRUCTIVE on purpose: if this ever survives, the
    // three arms above have stopped testing anything and the whole table in
    // lib/shiftWorktree.mts must be re-driven before it is trusted again.
    withJunction("bash-rm-slash", ({ link, canary }) => {
      const rm = spawnSync(RM_EXE, ["-rf", `${toPosix(link)}/`], { encoding: "utf8" });
      expect(rm.error, "git-bash rm.exe not found — this arm measured nothing").toBeUndefined();
      expect(
        existsSync(canary),
        "the trailing-slash delete NO LONGER destroys the target — the negative control has gone inert, so re-drive the table before trusting the other arms",
      ).toBe(false);
    });
  });

  it("removing the junction first leaves the install untouched — the order the script uses", () => {
    withJunction("order", ({ link, tree, canary }) => {
      const unlinked = spawnSync("cmd", ["/c", "rmdir", link.replace(/\//g, "\\")], { encoding: "utf8" });
      expect(unlinked.status).toBe(0);
      expect(junctionMustBeGone(existsSync(link)).ok).toBe(true);
      rmSync(tree, { recursive: true, force: true });
      expect(existsSync(canary)).toBe(true);
      expect(readFileSync(canary, "utf8")).toBe("the main tree's install");
    });
  });

  it("`rmdir` on a junction removes the LINK and keeps the target — the positive control for the unlink itself", () => {
    // Without this, the arm above passes even if `rmdir` silently did nothing:
    // the canary would survive for the wrong reason.
    withJunction("unlink", ({ link, canary }) => {
      expect(existsSync(link)).toBe(true);
      const unlinked = spawnSync("cmd", ["/c", "rmdir", link.replace(/\//g, "\\")], { encoding: "utf8" });
      expect(unlinked.status).toBe(0);
      expect(existsSync(link)).toBe(false);
      expect(existsSync(canary)).toBe(true);
    });
  });
});

describe("the script's own text — the sequence a reader must be able to trust", () => {
  const source = readFileSync(join(import.meta.dirname, "..", "scripts", "shift-worktree.mts"), "utf8");

  it("⚠ THE LEFTOVER PATH IS REACHABLE — the git probes are skipped when git has let go (finding 1)", () => {
    // The dead end this closes: an unregistered directory's `.git` file points
    // at a pruned entry, so BOTH `git log` probes fail. Exiting there would
    // send the shift back to hand-typing a recursive delete — on the second
    // run of the tool built to remove exactly that hazard.
    const guarded = source.indexOf("if (registered) {");
    const probe = source.indexOf('git(["log", "--oneline", "@{u}..HEAD"]');
    const giveUp = source.indexOf("could not tell whether this branch has unpushed commits");
    expect(guarded).toBeGreaterThan(-1);
    expect(probe).toBeGreaterThan(guarded);
    expect(giveUp).toBeGreaterThan(guarded);
  });

  it("⚠ THE DELETE IS CAUGHT — a held directory must not exit 1, the 'nothing changed' code (finding 2)", () => {
    // `force: true` suppresses a missing path, never an EBUSY on a held file.
    // By the time the delete runs the junction is gone and the worktree is
    // unregistered, so exit 1 would be a lie about a partial removal.
    const tryIndex = source.indexOf("try {\n    rmSync(plan.path");
    expect(tryIndex, "the recursive delete is not inside a try/catch").toBeGreaterThan(-1);
    expect(source.slice(tryIndex)).toContain("could not delete");
  });

  it("registered is an exact path match on a checked listing, not a substring (finding 3)", () => {
    // `drape-shift-a` must not match the entry for `drape-shift-a-b`.
    // ⚠ THE RULE MOVED AND SO DID ITS GUARD (#1613). This arm used to grep the
    // CLI for `line.startsWith("worktree ")`, which was one of TWO hand-rolled
    // copies of the same parse here — working law 4, with the drift already
    // visible: neither copy could say what branch an entry named. The rule now
    // has one owner in the library and is DRIVEN rather than grepped, by "an
    // EXACT path match" in the `#1613` describe below. What is held here is that
    // the CLI does not grow a third copy.
    expect(source).toContain("entryForPath(parseWorktreeList(");
    expect(
      source,
      "the CLI is hand-rolling the worktree listing parse again — `parseWorktreeList` owns it (#1613)",
    ).not.toContain('line.startsWith("worktree ")');
    expect(source).toContain("git worktree list failed");
    expect(source).not.toContain('worktree", "list", "--porcelain"]).out.replace');
  });

  it("⚠ `add` REFUSES BEFORE ITS FIRST MUTATION, never halfway (round 2, findings 1 and 2)", () => {
    // `add` performs four acts. Every check that could fail must sit before
    // `git worktree add`, or a failure leaves a half-made worktree behind.
    const firstMutation = source.indexOf('git(["worktree", "add"');
    expect(firstMutation).toBeGreaterThan(-1);
    for (const guard of [
      "only exists on Windows",
      "already exists`",
      "already exists locally",
    ]) {
      const at = source.indexOf(guard);
      expect(at, `guard "${guard}" not found`).toBeGreaterThan(-1);
      expect(at, `guard "${guard}" runs AFTER the worktree is created`).toBeLessThan(firstMutation);
    }
  });

  it("⚠ NEVER `-B` — resetting an existing branch is the destruction this tool prevents", () => {
    // The tempting one-character fix for the re-add case, and the wrong one:
    // it would throw away exactly the commits `remove` had just refused to
    // destroy.
    expect(source).toContain('"-b"');
    expect(source).not.toContain('"-B"');
  });

  it("the mirror leftover — registered but the directory gone — prunes rather than refusing (finding 3)", () => {
    // `registeredButGone` became `staleEntry` with #1613: the same question, asked
    // of the parsed entry rather than of a hand-rolled line test, because the
    // pruned entry still NAMES its branch and the closing sentence now reads it.
    expect(source.indexOf("staleEntry")).toBeGreaterThan(-1);
    expect(source).toContain("prune the stale registration");
  });

  it("the unpushed count asks the branch's OWN remote before refusing (finding 4)", () => {
    // `git worktree add -b team/x <path> origin/main` sets upstream to
    // origin/main, so `@{u}..HEAD` over-refuses before a `push -u`. Safe
    // direction, but a guard that fires on healthy input trains the --force
    // habit the header warns about.
    // ⚠ AGAINST THE BRANCH THAT WAS READ, NOT `team/<slug>` (#1613) — the
    // derived form named a ref that does not exist for a worktree made on an
    // existing branch, so the command failed and this correction never happened.
    expect(source).toContain("origin/${branchRead.branch}..HEAD");
    expect(source).not.toContain("origin/${plan.branch}..HEAD");
  });

  it("⚠ THE DERIVED BRANCH NAME IS USED ONLY BY `add` (#1613)", () => {
    /* The card asked for this arm by name. `add` is the one place a convention
       is right — there is nothing to read yet, and `git worktree add -b` then
       makes the name true. Everything after the remove marker must READ.

       A region read, not a whole-file grep: the file legitimately discusses the
       convention in its header. The marker is asserted first, because a split on
       a string that is not there yields one half and passes vacuously. */
    const marker = "// ---- remove ---";
    const at = source.indexOf(marker);
    expect(at, `the "${marker}" section marker is gone — this arm would pass vacuously`).toBeGreaterThan(-1);
    const addHalf = source.slice(0, at);
    const removeHalf = source.slice(at);
    expect(addHalf, "`add` must still create `team/<slug>`").toContain("branchToCreate(slug)");
    expect(
      removeHalf,
      "the removal path reaches the `team/<slug>` convention again — read the branch instead (#1613)",
    ).not.toContain("branchToCreate");
    /* ⚠ THE INTERPOLATION, NOT THE WORDS. A first cut forbade `` `team/ ``
       anywhere in the remove half and went red on its own docblock, which
       DISCUSSES the convention at length and must be free to. What is forbidden
       is building the name: `team/${…}`. Nobody writes that in prose. */
    expect(
      removeHalf,
      "the removal path builds a `team/${…}` branch name instead of reading it (#1613)",
    ).not.toContain("team/${");
  });

  it("proves the junction is gone BEFORE any recursive delete", () => {
    const proof = source.indexOf("junctionMustBeGone(");
    const destroy = source.indexOf("rmSync(plan.path");
    expect(proof).toBeGreaterThan(-1);
    expect(destroy).toBeGreaterThan(-1);
    expect(proof).toBeLessThan(destroy);
  });

  it("has exactly one recursive delete, and it is of the planned path", () => {
    const deletes = source.match(/rmSync\(/g) ?? [];
    expect(deletes).toHaveLength(1);
    expect(source).toContain("rmSync(plan.path, { recursive: true, force: true })");
  });

  it("refuses an unknown flag rather than ignoring it — a misspelt --dry-run on a remove deletes", () => {
    expect(source).toContain("unknown flag");
  });

  it("⚠ THE STATUS READ CANNOT GO BACK TO BEING BLIND TO IGNORED FILES (#1823)", () => {
    /* The args and the split both have one owner in the library, so this holds
       only that the CLI does not hand-roll the call again — the behaviour itself
       is driven against a real git above. A bare `["status", "--porcelain"]` here
       is the exact line that reported `uncommitted 0 file(s)` over 1.357 GB. */
    expect(source).toContain("git(worktreeStatusArgs(), plan.path)");
    expect(
      source,
      "the CLI is reading `git status --porcelain` without --ignored again (#1823)",
    ).not.toContain('["status", "--porcelain"]');
    expect(source).toContain("parseWorktreeStatus(status.out)");
  });

  it("⚠ ONLY THE KEPT SET IS WALKED — measuring node_modules walks the main install", () => {
    /* `classifyIgnored` returns both halves; the measurement must be mapped over
       `ignored.kept` and never over the whole reading. The junction is in the
       disposable half, and it is over a gigabyte. */
    expect(source).toContain("ignored.kept.map(");
    expect(source).not.toContain("read.ignored.map(");
  });

  it("the ignored line is printed beside `uncommitted`, on every run", () => {
    const uncommitted = source.indexOf("uncommitted ${state.dirtyFiles.length}");
    const ignored = source.indexOf("ignoredReadingLine(state)");
    const verdict = source.indexOf("decideRemoval(state, force)");
    expect(uncommitted).toBeGreaterThan(-1);
    expect(ignored).toBeGreaterThan(uncommitted);
    /* Printed BEFORE the verdict refuses, so a reader sees the bytes whether the
       removal proceeds or not. */
    expect(ignored).toBeLessThan(verdict);
  });
});

/**
 * ⚠ **"A MERGED PULL REQUEST NAMES THIS BRANCH" IS NOT "THESE COMMITS SHIPPED"
 * — the gap this card's own review found, and the one that would have made the
 * fix WORSE than the defect** (#1540, relay verdict on PR #1549).
 *
 * The first shape cleared the refusal on the branch NAME. But a branch merges and
 * the seat keeps working on the same branch for its next card — measured on this
 * machine that night: `seat-1-20260930-013307` sat on
 * `team/shared-bare-door-id-1506` with new work after PR #1514 merged. One commit
 * later, `remove` would have printed *"1 commit(s) sit on no remote, and that is
 * expected: PR #1514 merged this branch"* and **proceeded without `--force`**.
 * That commit never shipped. The guard would have been bypassed on the very path
 * it exists for, and with a friendlier sentence than the one it replaced.
 *
 * **What makes it answerable after the branch is gone:** GitHub keeps
 * `refs/pull/<N>/head` past `delete_branch_on_merge`. So the commits shipped
 * exactly when HEAD is an ANCESTOR of that ref — a fact about the commits rather
 * than about the name.
 *
 * Every arm here injects both runners, so the whole road is driven with no
 * network and no GitHub.
 */
describe("readShippedCommits — the commits, not the branch name (#1540)", () => {
  /** A `gh` that reports one merged pull request. */
  const ghSaysMerged = (pr: number) => () => ({
    status: 0,
    out: JSON.stringify([{ number: pr, mergedAt: "2026-09-30T01:14:00Z" }]),
    err: "",
  });

  /**
   * A git whose answers are keyed on the SUBCOMMAND, so an arm cannot pass by
   * answering the wrong question — and an unexpected call is a loud throw rather
   * than a quiet default, which is what stops a reader that stopped asking from
   * reading as a reader that asked and was satisfied.
   */
  const gitAnswering = (answers: Record<string, { status: number; out?: string; err?: string }>) => {
    const asked: string[][] = [];
    const run = (args: string[]) => {
      asked.push(args);
      const answer = answers[args[0] ?? ""];
      if (!answer) throw new Error(`the arm did not expect git ${args.join(" ")}`);
      return { status: answer.status, out: answer.out ?? "", err: answer.err ?? "" };
    };
    return { run, asked };
  };

  it("⚠ THE FETCH IS ASSERTED AT THE WIRE, and it reaches the PULL REQUEST's ref", () => {
    /* Working law 5: the contract is proven on the outgoing call. `refs/pull/N/head`
       and not `refs/heads/team/…`, because the whole point is that the branch ref
       is already deleted by the time anyone asks. */
    expect(prHeadFetchArgs(1514)).toEqual(["fetch", "--no-tags", "origin", "refs/pull/1514/head"]);
  });

  it("HEAD EQUAL to the merged pull request's head SHIPPED — and it proceeds", () => {
    const git = gitAnswering({ fetch: { status: 0 }, "merge-base": { status: 0 } });
    const ship = readShippedCommits("team/x", ghSaysMerged(1514), git.run);
    expect(ship).toEqual({ shippedBy: 1514 });

    /* Driven through the REAL fold and the REAL verdict, not a copy of either. */
    const verdict = decideRemoval({ ...clean, unpushedCommits: 1, ...removalStateFromShipReading(ship) }, false);
    expect(verdict.proceed, "a fully merged branch is litter").toBe(true);
    if (verdict.proceed) expect(verdict.warnings.join(" ")).not.toContain("destroying");
  });

  it("⚠ HEAD ONE COMMIT PAST IT REFUSES — the measured seat-1 case, and the whole point", () => {
    const git = gitAnswering({
      fetch: { status: 0 },
      /* exit 1 is `merge-base --is-ancestor` ANSWERING no, not failing. */
      "merge-base": { status: 1 },
      log: { status: 0, out: "9f1c2d3 the commit that never shipped\n" },
    });
    const ship = readShippedCommits("team/shared-bare-door-id-1506", ghSaysMerged(1514), git.run);
    expect(ship).toEqual({ pastMerge: { pr: 1514, commits: 1 } });

    const verdict = decideRemoval({ ...clean, unpushedCommits: 1, ...removalStateFromShipReading(ship) }, false);
    expect(verdict.proceed, "the one commit past the merge is in no pull request").toBe(false);
    if (!verdict.proceed) {
      /* It names the merge rather than hiding it — a shift told only "on no
         remote" over a branch it merged reaches for --force, which is the habit
         this card is about. */
      expect(verdict.reason).toContain("PR #1514 merged this branch");
      expect(verdict.reason).toContain("1 commit was made on it AFTER that merge");
      expect(verdict.reason).toContain("this directory is their only copy");
      /* ⚠ AND IT MUST NOT CARRY THE CLEARED SENTENCE. This is the assertion that
         would have caught the reviewed shape: it said "that is expected". */
      expect(verdict.reason).not.toContain("that is expected");
    }
  });

  it("the plural reads as a plural, because the count is what a shift acts on", () => {
    const git = gitAnswering({
      fetch: { status: 0 },
      "merge-base": { status: 1 },
      log: { status: 0, out: "aaa one\nbbb two\nccc three\n" },
    });
    const ship = readShippedCommits("team/x", ghSaysMerged(1536), git.run);
    expect(ship).toEqual({ pastMerge: { pr: 1536, commits: 3 } });
    const verdict = decideRemoval({ ...clean, unpushedCommits: 3, ...removalStateFromShipReading(ship) }, false);
    expect(verdict.proceed).toBe(false);
    if (!verdict.proceed) expect(verdict.reason).toContain("3 commits were made on it AFTER that merge");
  });

  it("⚠ A FETCH THAT FAILS IS `unreadable` — the safe direction, never a merge", () => {
    /* A deleted-and-never-recreated ref, an offline machine, a repository whose
       remote is gone: none of them is evidence that the work shipped. */
    const git = gitAnswering({ fetch: { status: 128, err: "fatal: couldn't find remote ref refs/pull/1514/head" } });
    const ship = readShippedCommits("team/x", ghSaysMerged(1514), git.run);
    expect("unreadable" in ship, "a failed fetch must never read as shipped").toBe(true);
    if ("unreadable" in ship) expect(ship.unreadable).toContain("couldn't find remote ref");

    const state = removalStateFromShipReading(ship);
    expect(state.mergedPullRequest, "it keeps the PR number out of the verdict entirely")
      .toEqual({ unreadable: expect.stringContaining("refs/pull/1514/head") });
    const verdict = decideRemoval({ ...clean, unpushedCommits: 2, ...state }, false);
    expect(verdict.proceed).toBe(false);
    if (!verdict.proceed) expect(verdict.reason).toContain("COULD NOT BE READ");
  });

  it("⚠ A MERGE-BASE THAT ERRORS IS `unreadable` TOO — exit 1 is an answer, 128 is not", () => {
    /* The trap named in the reader's own docblock, driven: treating "not 0" as
       *no* turns a broken repository into a confident refusal, and treating
       "not 1" as *yes* turns it into a confident PROCEED over the only copy of
       somebody's work. */
    const git = gitAnswering({
      fetch: { status: 0 },
      "merge-base": { status: 128, err: "fatal: Not a valid object name FETCH_HEAD" },
    });
    const ship = readShippedCommits("team/x", ghSaysMerged(1514), git.run);
    expect("unreadable" in ship).toBe(true);
    if ("unreadable" in ship) expect(ship.unreadable).toContain("Not a valid object name");
  });

  it("no merged pull request never reaches git at all — and still refuses", () => {
    /* The read is ordered cheapest-first: with nothing merged there is no ref to
       fetch, so the network call is not made. The throwing git proves it. */
    const git = gitAnswering({});
    const ship = readShippedCommits("team/x", () => ({ status: 0, out: "[]", err: "" }), git.run);
    expect(ship).toEqual({ notMerged: true });
    expect(git.asked, "nothing merged it, so there was nothing to compare against").toEqual([]);
    const verdict = decideRemoval({ ...clean, unpushedCommits: 1, ...removalStateFromShipReading(ship) }, false);
    expect(verdict.proceed).toBe(false);
  });

  it("an unreadable `gh` never reaches git either, and stays unreadable", () => {
    const git = gitAnswering({});
    const ship = readShippedCommits("team/x", () => { throw new Error("spawn gh ENOENT"); }, git.run);
    expect("unreadable" in ship && ship.unreadable).toContain("spawn gh ENOENT");
    expect(git.asked).toEqual([]);
  });

  it("⚠ THE FOLD IS FAIL-CLOSED, held over every reading there is", () => {
    /* One owner, and the property that matters stated as a property rather than
       as four separate hopes: ONLY `shippedBy` may produce a number, because a
       number is the only thing that clears the refusal. */
    const readings = [
      { shippedBy: 1514 },
      { notMerged: true as const },
      { pastMerge: { pr: 1514, commits: 1 } },
      { unreadable: "offline" },
      null,
    ];
    for (const reading of readings) {
      const state = removalStateFromShipReading(reading);
      const clears = typeof state.mergedPullRequest === "number";
      expect(clears, `only shippedBy may clear the refusal, not ${JSON.stringify(reading)}`)
        .toBe(reading !== null && "shippedBy" in reading);
    }
  });
});

/**
 * ⚠ **"team/<slug>" IS NOT "THE BRANCH THIS WORKTREE IS ON" (#1613)** — the same
 * shape as #1540 itself, one level up: the tool asked about a NAME where it could
 * have read the THING.
 *
 * Found by USING the tool, minutes after #1540's repair merged. A shift removed
 * its own worktree and `remove` printed `branch team/worktree-merged-1540` — a
 * branch that does not exist. The worktree was on
 * `team/worktree-merged-branch-1540`, because it had been made on an EXISTING
 * branch, and from that moment the directory name and the branch name are
 * independent. The relay's own release note PRESCRIBES that shape: *continue on
 * the pull request's branch, do not start over.*
 *
 * **Nothing was ever at risk**, and saying so is part of the record: every
 * consequential count runs in the worktree against `HEAD` and `@{u}`, so the `0`
 * that run printed was correct. What broke was #1540's own brand-new feature —
 * `gh pr list --head team/<slug>` named a branch no pull request had used, so the
 * answer was always *no merged pull request* and the friendly outcome could never
 * appear for this entire class of worktree. The cry-wolf refusal #1540 was filed
 * to end came back, silently, in the safe direction.
 */
describe("the branch is READ, never derived (#1613)", () => {
  const PORCELAIN = [
    "worktree C:/Users/Admin/Drape",
    "HEAD 1111111111111111111111111111111111111111",
    "branch refs/heads/main",
    "",
    "worktree C:/Users/Admin/drape-shift-worktree-merged-1540",
    "HEAD 2222222222222222222222222222222222222222",
    "branch refs/heads/team/worktree-merged-branch-1540",
    "",
    "worktree C:/Users/Admin/drape-shift-detached",
    "HEAD 3333333333333333333333333333333333333333",
    "detached",
    "",
  ].join("\n");

  it("parses one entry per worktree, with the branch each one names", () => {
    expect(parseWorktreeList(PORCELAIN)).toEqual([
      { path: "C:/Users/Admin/Drape", branch: "main" },
      {
        path: "C:/Users/Admin/drape-shift-worktree-merged-1540",
        branch: "team/worktree-merged-branch-1540",
      },
      { path: "C:/Users/Admin/drape-shift-detached", branch: null },
    ]);
  });

  it("⚠ THE MEASURED CASE — the directory name and the branch name differ", () => {
    /* The real run's values. A reader that derived `team/<slug>` from the
       directory would answer `team/worktree-merged-1540`; the entry says
       otherwise, and the entry is the fact. */
    const entry = entryForPath(parseWorktreeList(PORCELAIN), "C:/Users/Admin/drape-shift-worktree-merged-1540");
    expect(branchForRemoval(entry)).toEqual({ branch: "team/worktree-merged-branch-1540" });
    expect(branchToCreate("worktree-merged-1540")).toBe("team/worktree-merged-1540");
    expect(branchForRemoval(entry)).not.toEqual({ branch: branchToCreate("worktree-merged-1540") });
  });

  it("an EXACT path match — `drape-shift-a` is not the entry for `drape-shift-a-b`", () => {
    /* The rule the CLI's own comment carried, now with one owner. It matters on
       a tool that ends in a recursive delete. */
    const entries = parseWorktreeList(
      "worktree C:/x/drape-shift-a-b\nHEAD 4444444444444444444444444444444444444444\nbranch refs/heads/team/a-b\n",
    );
    expect(entryForPath(entries, "C:/x/drape-shift-a")).toBeNull();
    expect(entryForPath(entries, "C:/x/drape-shift-a-b")?.branch).toBe("team/a-b");
  });

  it("normalises backslashes on BOTH sides, because git prints either", () => {
    const entries = parseWorktreeList("worktree C:\\x\\drape-shift-a\nbranch refs/heads/team/a\n");
    expect(entryForPath(entries, "C:/x/drape-shift-a")?.branch).toBe("team/a");
    expect(entryForPath(entries, "C:\\x\\drape-shift-a")?.branch).toBe("team/a");
  });

  it("reads a final entry that has no trailing blank line", () => {
    /* Porcelain separates entries with blank lines; a parser that relied on them
       would silently drop the last one, and a dropped entry reads exactly like
       "git does not know this path" — which is a proceed. */
    expect(parseWorktreeList("worktree C:/x/one\nbranch refs/heads/team/one")).toEqual([
      { path: "C:/x/one", branch: "team/one" },
    ]);
  });

  it("⚠ UNREADABLE, NEVER THE CONVENTION — a detached HEAD and an unknown path", () => {
    /* The card asked for this direction by name: falling back is how this defect
       reads as working, because a derived name is always A name. Both of these
       are states with no branch state to protect, so neither refuses the
       REMOVAL — it is the SENTENCE that is refused. */
    const detached = branchForRemoval(
      entryForPath(parseWorktreeList(PORCELAIN), "C:/Users/Admin/drape-shift-detached"),
    );
    expect(branchReadFailed(detached)).toBe(true);
    if (branchReadFailed(detached)) expect(detached.unreadable).toContain("detached");

    const unknown = branchForRemoval(entryForPath(parseWorktreeList(PORCELAIN), "C:/Users/Admin/drape-shift-nobody"));
    expect(branchReadFailed(unknown)).toBe(true);
    if (branchReadFailed(unknown)) expect(unknown.unreadable).toContain("registered");
  });

  it("the listing is asked for once, in one place (working law 5)", () => {
    expect(worktreeListArgs()).toEqual(["worktree", "list", "--porcelain"]);
  });
});

/**
 * ⚠ **THE READING, AGAINST A REAL GIT — a worktree whose DIRECTORY NAME AND
 * BRANCH NAME DIFFER (#1613).** The card asked for this arm by name, and a
 * fixture is not enough for it: the porcelain shape above is this suite's belief
 * about what git prints, and the whole defect was a belief about a name.
 *
 * So a real repository is built, a branch is created WITHOUT being checked out,
 * and a worktree is added ON it at a directory named after a different slug —
 * the exact shape a seat produces when it continues a released card. Then both
 * halves are proven: the branch this module reads equals what
 * `git rev-parse --abbrev-ref HEAD` says inside that worktree, and the convention
 * names a branch the repository does not have.
 */
describe("the branch read, against a real repository (#1613)", () => {
  /** A real git worktree whose directory slug is NOT its branch name. */
  function withMismatchedWorktree(
    body: (paths: { repo: string; tree: string; slug: string; realBranch: string }) => void,
  ) {
    const root = toPosix(mkdtempSync(join(tmpdir(), "drape-1613-")));
    const repo = `${root}/repo`;
    /* The measured names from the run that found this. */
    const slug = "worktree-merged-1540";
    const realBranch = "team/worktree-merged-branch-1540";
    const tree = `${root}/drape-shift-${slug}`;
    const run = (args: string[], cwd = repo) => {
      const result = spawnSync("git", args, { cwd, encoding: "utf8" });
      if (result.error) throw result.error;
      expect(result.status, `git ${args.join(" ")} — ${result.stderr}`).toBe(0);
      return (result.stdout ?? "").trim();
    };
    try {
      mkdirSync(repo, { recursive: true });
      run(["init", "-b", "main"], repo);
      writeFileSync(join(repo, "a.txt"), "one");
      run(["add", "a.txt"]);
      run(["-c", "user.email=seat@drape.test", "-c", "user.name=Seat", "commit", "-m", "one"]);
      /* Created, never checked out — so `worktree add` may take it, which is the
         road that makes the directory name and the branch name independent. */
      run(["branch", realBranch]);
      run(["worktree", "add", tree, realBranch]);
      body({ repo, tree, slug, realBranch });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }

  it("⚠ equals `git rev-parse --abbrev-ref HEAD` inside the worktree", () => {
    withMismatchedWorktree(({ repo, tree, slug, realBranch }) => {
      const porcelain = spawnSync("git", worktreeListArgs(), { cwd: repo, encoding: "utf8" });
      expect(porcelain.status, porcelain.stderr).toBe(0);
      const read = branchForRemoval(entryForPath(parseWorktreeList(porcelain.stdout ?? ""), tree));

      /* THE OTHER READING THE CARD NAMED, taken from git independently of the
         porcelain parser — two readers, so neither inherits the other's blind
         spot. */
      const revParse = spawnSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd: tree, encoding: "utf8" });
      expect(revParse.status, revParse.stderr).toBe(0);
      const head = (revParse.stdout ?? "").trim();

      expect(head).toBe(realBranch);
      expect(read).toEqual({ branch: head });

      /* ⚠ AND THE CONVENTION NAMES A BRANCH THIS REPOSITORY DOES NOT HAVE —
         the measured symptom, reproduced against a real git rather than argued.
         `git rev-parse --verify` on it is the exact command the card ran. */
      const derived = branchToCreate(slug);
      expect(derived).not.toBe(head);
      const verify = spawnSync("git", ["rev-parse", "--verify", "--quiet", `refs/heads/${derived}`], {
        cwd: repo,
        encoding: "utf8",
      });
      expect(
        verify.status,
        `${derived} exists in this fixture — it cannot demonstrate the defect`,
      ).not.toBe(0);
    });
  });

  it("⚠ THE MERGED ROAD FIRES on the read branch, and would not on the derived one", () => {
    withMismatchedWorktree(({ repo, tree, slug, realBranch }) => {
      const porcelain = spawnSync("git", worktreeListArgs(), { cwd: repo, encoding: "utf8" });
      const read = branchForRemoval(entryForPath(parseWorktreeList(porcelain.stdout ?? ""), tree));
      expect(branchReadFailed(read)).toBe(false);

      /* A `gh` that answers only for the branch the worktree is really on — so a
         reader still asking about `team/<slug>` comes back `notMerged`, which is
         precisely what the tool did on the run that found this. */
      const gh = (args: string[]) =>
        args[args.indexOf("--head") + 1] === realBranch
          ? { status: 0, out: JSON.stringify([{ number: 1549, mergedAt: "2026-09-30T00:00:00Z" }]), err: "" }
          : { status: 0, out: "[]", err: "" };
      /* Real git, in the real worktree: the fetch cannot reach a `refs/pull` ref
         in a fixture, so the ancestry is settled locally — HEAD against itself,
         which is the `shippedBy` road. */
      const gitInWorktree = (args: string[]) => {
        if (args[0] === "fetch") return { status: 0, out: "", err: "" };
        const rewritten = args.map((arg) => (arg === "FETCH_HEAD" ? "HEAD" : arg));
        const result = spawnSync("git", rewritten, { cwd: tree, encoding: "utf8" });
        return { status: result.status ?? 1, out: result.stdout ?? "", err: result.stderr ?? "" };
      };

      expect(shipReadingFor(read, gh, gitInWorktree)).toEqual({ shippedBy: 1549 });
      expect(shipReadingFor({ branch: branchToCreate(slug) }, gh, gitInWorktree)).toEqual({ notMerged: true });
    });
  });

  it("a DETACHED worktree reads unreadable against a real git, not a branch name", () => {
    withMismatchedWorktree(({ repo, tree }) => {
      const detach = spawnSync("git", ["checkout", "--detach"], { cwd: tree, encoding: "utf8" });
      expect(detach.status, detach.stderr).toBe(0);
      const porcelain = spawnSync("git", worktreeListArgs(), { cwd: repo, encoding: "utf8" });
      const read = branchForRemoval(entryForPath(parseWorktreeList(porcelain.stdout ?? ""), tree));
      expect(branchReadFailed(read), "a detached worktree came back with a branch name").toBe(true);
    });
  });
});

/**
 * THE FOLD THAT KEEPS AN UNREAD BRANCH OUT OF THE VERDICT (#1613).
 *
 * `readShippedCommits` would accept an empty or guessed name and come back
 * `notMerged` — *asked, and nobody merged this* — which is a confident fact about
 * a question nobody put. That is the difference `unreadable` exists to hold, and
 * it is one character wide.
 */
describe("shipReadingFor — an unreadable branch is an unreadable READING (#1613)", () => {
  const never = () => {
    throw new Error("nothing should be asked when there is no branch to ask about");
  };

  it("does not call out at all when the branch could not be read", () => {
    const reading = shipReadingFor({ unreadable: "this worktree is on a detached HEAD" }, never, never);
    expect("unreadable" in reading).toBe(true);
    if ("unreadable" in reading) expect(reading.unreadable).toContain("detached HEAD");
  });

  it("⚠ NEVER `notMerged` — that would assert nobody merged a branch nobody named", () => {
    const reading = shipReadingFor({ unreadable: "git does not have this path registered" }, never, never);
    expect("notMerged" in reading).toBe(false);
    /* And it cannot clear the refusal: `unreadable` maps to a `mergedPullRequest`
       the verdict treats as "nobody asked". */
    expect(typeof removalStateFromShipReading(reading).mergedPullRequest).not.toBe("number");
  });

  it("asks the pull request about the branch that was READ (working law 5)", () => {
    const asked: string[][] = [];
    const gh = (args: string[]) => {
      asked.push(args);
      return { status: 0, out: "[]", err: "" };
    };
    shipReadingFor({ branch: "team/worktree-merged-branch-1540" }, gh, never);
    expect(asked[0]).toEqual(mergedPrArgs("team/worktree-merged-branch-1540"));
  });
});

/**
 * ⚠ **THE REVIEW ROAD — A CUT STEP WITH NO REMOVAL STEP, MEASURED AT 19 SHELLS
 * IN THREE DAYS** (#1796, Janitor patrol #12).
 *
 * Reviewing a pull request by hand meant `git worktree add -b team/<slug> …
 * && mklink /J … && cp .env` and nothing afterwards, so every review left a
 * zero-file `drape-review-<n>` directory holding a LIVE JUNCTION into the main
 * tree's `node_modules`. Two more appeared inside the hour the Janitor swept
 * the nineteen — one pull request, two review attempts — so the producer is the
 * thing to fix and a per-instance sweep cannot win against it.
 *
 * What is driven here is the whole of what the review road adds, and the order
 * of the arms is the order of the risk:
 *
 *  1. the pull request number, because it becomes a directory name and then an
 *     argument to a recursive delete, exactly as a slug does;
 *  2. the three calls, asserted at the wire (working law 5) — a `--detach` that
 *     silently became a `-b` would put the branch-per-review back, which is the
 *     second contributor #1797 measures;
 *  3. `decideReviewRemoval`, in all four states and both force positions,
 *     including the NEGATIVE CONTROL that the happy path does not refuse —
 *     a guard that refuses on every review trains the `--force` habit that is
 *     the only thing between a real find and a deleted directory;
 *  4. the exit-code mapping, injected AND then against a real git, because
 *     `merge-base --is-ancestor` answers with exit 1 and errors with 128 and
 *     the whole reading turns on not conflating them;
 *  5. the real script, end to end, against a real repository with a real bare
 *     remote carrying a real `refs/pull/7/head` and a real junction — with the
 *     install counted before, between and after, which is the Janitor's own
 *     canary and the only arm that can prove the removal step now exists.
 */
describe("validatePrNumber — a number that becomes a path and then a delete (#1796)", () => {
  it("accepts the shapes a reviewer types", () => {
    expect(validatePrNumber("1794")).toEqual({ ok: true, pr: 1794 });
    expect(validatePrNumber("1")).toEqual({ ok: true, pr: 1 });
  });

  it("⚠ REFUSES everything that is not digits — including the `1794b` that was actually typed", () => {
    /* `drape-review-1794b` was on this machine when this card was filed: a
       second review of one pull request met the first directory in the way and
       a suffix was invented by hand, producing a directory no tool can address
       by pull request number. */
    for (const raw of ["1794b", "-1", "1.5", "1e3", "1 2", "1;rm -rf /", "../x", "", " 7", "7 "]) {
      const read = validatePrNumber(raw);
      expect(read.ok, `the number ${JSON.stringify(raw)} was accepted`).toBe(false);
    }
  });

  it("REFUSES zero and a number no repository could have", () => {
    expect(validatePrNumber("0").ok).toBe(false);
    expect(validatePrNumber("9".repeat(40)).ok).toBe(false);
  });

  it("⚠ THE PATH IS BUILT FROM THE NUMBER, SO TWO SPELLINGS NAME ONE DIRECTORY", () => {
    /* The duplication this card is about is two directories for one pull
       request. `007` and `7` must not be able to become two shells. */
    const typed = validatePrNumber("007");
    expect(typed).toEqual({ ok: true, pr: 7 });
    if (!typed.ok) throw new Error("unreachable");
    expect(reviewPlanFor(typed.pr, "/repo", "/parent").path).toBe(
      reviewPlanFor(7, "/repo", "/parent").path,
    );
  });
});

describe("reviewPlanFor (#1796)", () => {
  const plan = reviewPlanFor(1794, "/repo", "/parent");

  it("keeps the name the hand-rolled road already used, so existing shells are addressable", () => {
    /* Naming this `drape-shift-review-<n>` would have left the shells already
       on this machine unreachable by the tool that is supposed to own them. */
    expect(plan.path).toBe("/parent/drape-review-1794");
  });

  it("puts the worktree beside the repository, never inside it", () => {
    expect(plan.path.startsWith("/parent/")).toBe(true);
    expect(plan.path.startsWith("/repo/")).toBe(false);
    expect(plan.nodeModulesLink).toBe("/parent/drape-review-1794/node_modules");
    expect(plan.envSource).toBe("/repo/.env");
    expect(plan.envTarget).toBe("/parent/drape-review-1794/.env");
  });

  it("⚠ CARRIES NO BRANCH — a review worktree is detached and nothing may derive one", () => {
    expect(Object.keys(plan).sort()).toEqual(
      ["envSource", "envTarget", "nodeModulesLink", "path", "slug"].sort(),
    );
    expect(JSON.stringify(plan)).not.toContain("team/");
  });
});

describe("the review road's calls, asserted at the wire (#1796, working law 5)", () => {
  it("the checkout ref is the pull request's own head, which is NOT a branch", () => {
    /* `refs/pull/<n>/head` never appears in `git branch`, so a review leaves
       nothing for #1797's local-ref sweep to find — and GitHub keeps it, so it
       is simultaneously the restore road for anything the removal destroys. */
    expect(reviewCheckoutRef(1794)).toBe("refs/pull/1794/head");
    expect(reviewCheckoutRef(1794)).not.toContain("team/");
  });

  it("⚠ THE FETCH HAS A DESTINATION AND IS FORCED — both differ from the removal's fetch on purpose", () => {
    expect(prHeadFetchIntoRefArgs(1794)).toEqual([
      "fetch", "--no-tags", "origin", "+refs/pull/1794/head:refs/pull/1794/head",
    ]);
    /* A DESTINATION, because `FETCH_HEAD` is one slot shared by the whole
       repository and four seats fetch into it concurrently on this machine — a
       worktree created at `FETCH_HEAD` could be created at somebody else's
       fetch. FORCED, because a pull request's head moves when its author
       pushes a repair, which is exactly when the reviewer looks again. */
    expect(prHeadFetchArgs(1794)).toEqual(["fetch", "--no-tags", "origin", "refs/pull/1794/head"]);
    expect(prHeadFetchIntoRefArgs(1794).join(" ")).toContain(":");
    expect(prHeadFetchArgs(1794).join(" ")).not.toContain(":");
  });

  it("⚠ THE WORKTREE IS `--detach` AND NEVER `-b` — a branch per review is #1797's second contributor", () => {
    const args = reviewWorktreeAddArgs(1794, "/parent/drape-review-1794");
    expect(args).toEqual([
      "worktree", "add", "--detach", "/parent/drape-review-1794", "refs/pull/1794/head",
    ]);
    expect(args).not.toContain("-b");
    expect(args).not.toContain("-B");
  });
});

describe("decideReviewRemoval — the question decideRemoval cannot put (#1796)", () => {
  it("⚠ NEGATIVE CONTROL — the happy path does NOT refuse, which is the whole reason this exists", () => {
    /* Traced before this function was written: a detached HEAD has no upstream,
       so the CLI's unpushed count falls back to `origin/main..HEAD` and reports
       the PULL REQUEST'S OWN commits as work about to vanish; `shipReadingFor`
       is handed an unreadable branch and answers `unreadable`; `decideRemoval`
       refuses. Every single review would have met a refusal on its happy
       path. */
    const verdict = decideReviewRemoval({ shippedBy: 1794 }, 1794, false);
    expect(verdict.proceed).toBe(true);
    if (!verdict.proceed) throw new Error("unreachable");
    expect(verdict.note).toContain("refs/pull/1794/head");
  });

  it("REFUSES commits made in the review worktree, and names how many", () => {
    const verdict = decideReviewRemoval({ pastMerge: { pr: 1794, commits: 3 } }, 1794, false);
    expect(verdict.proceed).toBe(false);
    if (verdict.proceed) throw new Error("unreachable");
    expect(verdict.reason).toContain("3 commits were made in this review worktree");
    expect(verdict.reason).toContain("only copy");
    expect(verdict.reason).toContain("--force");
  });

  it("one commit reads as one commit — the singular, because a reviewer reads this before deleting", () => {
    const verdict = decideReviewRemoval({ pastMerge: { pr: 1794, commits: 1 } }, 1794, false);
    expect(verdict.proceed).toBe(false);
    if (verdict.proceed) throw new Error("unreachable");
    expect(verdict.reason).toContain("1 commit was made");
    expect(verdict.reason).not.toContain("1 commits");
  });

  it("--force proceeds past commits, and SAYS WHAT IT IS DESTROYING", () => {
    const verdict = decideReviewRemoval({ pastMerge: { pr: 1794, commits: 2 } }, 1794, true);
    expect(verdict.proceed).toBe(true);
    if (!verdict.proceed) throw new Error("unreachable");
    expect(verdict.note).toContain("--force is destroying 2 commit(s)");
  });

  it("⚠ A READING NOBODY COULD TAKE REFUSES, AND SAYS IT WAS NOT TAKEN", () => {
    const verdict = decideReviewRemoval({ unreadable: "git is not on PATH" }, 1794, false);
    expect(verdict.proceed).toBe(false);
    if (verdict.proceed) throw new Error("unreachable");
    expect(verdict.reason).toContain("COULD NOT BE READ");
    expect(verdict.reason).toContain("git is not on PATH");
    /* The refusal must not read as a finding about the directory — it is a
       finding about the read. */
    expect(verdict.reason).toContain("safe answer rather than a finding");
  });

  it("--force reaches an unreadable reading, and the note does not pretend it was read", () => {
    const verdict = decideReviewRemoval({ unreadable: "offline" }, 1794, true);
    expect(verdict.proceed).toBe(true);
    if (!verdict.proceed) throw new Error("unreachable");
    expect(verdict.note).toContain("NOT read");
    expect(verdict.note).toContain("offline");
  });

  it("⚠ `notMerged` CANNOT ARISE AND IS STILL REFUSED — fail closed on a state with no meaning here", () => {
    /* `readHeadAgainstPrHead` never returns it: only the branch hop can, and
       the review road has no branch hop. Refused rather than dropped through a
       default, so a future edit that routes some other reading in here cannot
       make an unasked question read as a clean proceed. */
    for (const force of [false, true]) {
      const verdict = decideReviewRemoval({ notMerged: true }, 1794, force);
      expect(verdict.proceed, `force=${force}`).toBe(false);
    }
  });
});

describe("readHeadAgainstPrHead — the exit codes, which are the whole reading (#1796)", () => {
  /** A git runner that answers a scripted status per command, in order. */
  function scripted(answers: { status: number; out?: string; err?: string }[]) {
    const seen: string[][] = [];
    let i = 0;
    const git = (args: string[]) => {
      seen.push(args);
      const answer = answers[i] ?? { status: 1, err: "no scripted answer" };
      i += 1;
      return { status: answer.status, out: answer.out ?? "", err: answer.err ?? "" };
    };
    return { git, seen };
  }

  it("⚠ THE FETCH IS ASSERTED AT THE WIRE, and it reaches the PULL REQUEST's ref", () => {
    const { git, seen } = scripted([{ status: 0 }, { status: 0 }]);
    expect(readHeadAgainstPrHead(7, git)).toEqual({ shippedBy: 7 });
    expect(seen[0]).toEqual(prHeadFetchArgs(7));
    expect(seen[1]).toEqual(["merge-base", "--is-ancestor", "HEAD", "FETCH_HEAD"]);
  });

  it("a fetch that cannot be taken is `unreadable`, never an answer", () => {
    const { git } = scripted([{ status: 128, err: "couldn't find remote ref" }]);
    const reading = readHeadAgainstPrHead(7, git);
    expect(reading).toHaveProperty("unreadable");
    expect(JSON.stringify(reading)).toContain("refs/pull/7/head");
  });

  it("⚠ EXIT 1 IS AN ANSWER AND 128 IS AN ERROR — conflating them is how this goes quietly wrong", () => {
    /* Exit 1 means HEAD is NOT contained, which is a verdict. 128 means git
       could not tell you. A reader treating "not 0" as "no" turns every git
       failure into a confident refusal; one treating "not 1" as "yes" turns it
       into a confident PROCEED over the only copy of somebody's work. */
    const answer = scripted([{ status: 0 }, { status: 1 }, { status: 0, out: "abc123 a fix\n" }]);
    expect(readHeadAgainstPrHead(7, answer.git)).toEqual({ pastMerge: { pr: 7, commits: 1 } });
    expect(answer.seen[2]).toEqual(["log", "--oneline", "FETCH_HEAD..HEAD"]);

    const error = scripted([{ status: 0 }, { status: 128, err: "bad object" }]);
    expect(readHeadAgainstPrHead(7, error.git)).toHaveProperty("unreadable");
  });

  it("⚠ A ZERO COUNT PAST A NON-ANCESTOR IS ARITHMETICALLY IMPOSSIBLE, so it refuses to invent one", () => {
    const { git } = scripted([{ status: 0 }, { status: 1 }, { status: 0, out: "\n" }]);
    const reading = readHeadAgainstPrHead(7, git);
    expect(reading).toHaveProperty("unreadable");
    expect(JSON.stringify(reading)).toContain("no commit separates them");
  });

  it("⚠ ONE READER, NOT TWO — `readShippedCommits` drives these same bytes", () => {
    /* Working law 4, on the one path in this file that ends in a recursive
       delete. The branch road and the review road must not grow two copies of
       an exit-code mapping whose three states are each one character apart. */
    const source = readFileSync(
      join(import.meta.dirname, "..", "scripts", "lib", "shiftWorktree.mts"),
      "utf8",
    );
    expect(source.match(/"--is-ancestor"/g) ?? []).toHaveLength(1);
    expect(source).toContain("return readHeadAgainstPrHead(pr, gitInWorktree);");
  });
});

/**
 * THE REVIEW ROAD AGAINST REAL GIT AND A REAL REMOTE (#1796).
 *
 * ⚠ **THE INJECTED ARMS ABOVE PROVE THE MAPPING; ONLY THIS PROVES GIT ACTUALLY
 * ANSWERS THAT WAY.** `refs/pull/<n>/head` is not a git concept — it is a ref
 * GitHub happens to keep — so the fixture puts a real one in a real bare remote
 * and fetches it, which is faithful because that is all GitHub's end of it is.
 *
 * Nothing here touches this repository: a fresh repo, a fresh bare remote, a
 * temporary directory, and no network.
 */
describe("the review road against a real repository (#1796)", () => {
  function git(cwd: string, args: string[]) {
    const result = spawnSync("git", args, { cwd, encoding: "utf8" });
    return { status: result.status ?? 1, out: result.stdout ?? "", err: result.stderr ?? "" };
  }

  function commit(repo: string, file: string, body: string) {
    writeFileSync(join(repo, file), body);
    expect(git(repo, ["add", file]).status).toBe(0);
    expect(git(repo, ["commit", "-q", "-m", `add ${file}`]).status).toBe(0);
  }

  /** A repo, a bare remote, and a real `refs/pull/7/head` on it. */
  function withRemote(name: string, body: (paths: { repo: string; parent: string }) => void) {
    const parent = mkdtempSync(join(tmpdir(), `drape-review-${name}-`));
    try {
      const repo = join(parent, "repo");
      mkdirSync(repo);
      expect(git(parent, ["init", "-q", "--bare", "remote.git"]).status).toBe(0);
      expect(git(repo, ["init", "-q", "-b", "main"]).status).toBe(0);
      expect(git(repo, ["config", "user.email", "arm@example.com"]).status).toBe(0);
      expect(git(repo, ["config", "user.name", "Arm"]).status).toBe(0);
      expect(git(repo, ["remote", "add", "origin", join(parent, "remote.git")]).status).toBe(0);
      commit(repo, "main.txt", "main\n");
      expect(git(repo, ["push", "-q", "origin", "main"]).status).toBe(0);
      /* THE PULL REQUEST'S HEAD, as GitHub keeps it: a commit pushed straight
         to `refs/pull/7/head` with no branch anywhere naming it. */
      commit(repo, "pr.txt", "the pull request\n");
      expect(git(repo, ["push", "-q", "origin", "HEAD:refs/pull/7/head"]).status).toBe(0);
      expect(git(repo, ["checkout", "-q", "main"]).status).toBe(0);
      expect(git(repo, ["reset", "-q", "--hard", "HEAD~1"]).status).toBe(0);
      /* THE PROOF THE FIXTURE CAN MEASURE ANYTHING: the ref is really on the
         remote. A clean null is evidence only if the fixture could have
         produced a positive. */
      const remoteRefs = git(repo, ["ls-remote", "origin", "refs/pull/7/head"]);
      expect(remoteRefs.status).toBe(0);
      expect(remoteRefs.out, "refs/pull/7/head is not on the fixture's remote").toContain(
        "refs/pull/7/head",
      );
      body({ repo, parent });
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  }

  it("HEAD at the pull request's head reads as SHIPPED — exit 0 from real git", () => {
    withRemote("ancestor", ({ repo }) => {
      expect(git(repo, prHeadFetchIntoRefArgs(7)).status).toBe(0);
      expect(git(repo, ["checkout", "-q", "--detach", reviewCheckoutRef(7)]).status).toBe(0);
      const reading: ShipReading = readHeadAgainstPrHead(7, (args) => git(repo, args));
      expect(reading).toEqual({ shippedBy: 7 });
      expect(decideReviewRemoval(reading, 7, false).proceed).toBe(true);
    });
  });

  it("⚠ A COMMIT MADE IN THE REVIEW WORKTREE READS AS PAST IT AND REFUSES — exit 1 from real git", () => {
    withRemote("past", ({ repo }) => {
      expect(git(repo, prHeadFetchIntoRefArgs(7)).status).toBe(0);
      expect(git(repo, ["checkout", "-q", "--detach", reviewCheckoutRef(7)]).status).toBe(0);
      commit(repo, "reviewer-note.txt", "a repair typed in the review worktree\n");
      const reading = readHeadAgainstPrHead(7, (args) => git(repo, args));
      expect(reading).toEqual({ pastMerge: { pr: 7, commits: 1 } });
      expect(decideReviewRemoval(reading, 7, false).proceed).toBe(false);
    });
  });
});

/**
 * THE REAL SCRIPT, END TO END, WITH A REAL JUNCTION (#1796).
 *
 * ⚠ **THIS IS THE ONLY ARM THAT CAN SHOW THE REMOVAL STEP EXISTS, AND IT
 * CARRIES THE JANITOR'S OWN CANARY.** The nineteen shells each held a live
 * junction into the main tree's `node_modules`; the Janitor counts that install
 * before, between and after every removal it performs, because the one deletion
 * form that destroys it is the form a human types. So this fixture counts the
 * install's entries before the add, after the add and after the remove, and
 * reads a canary file THROUGH the junction first — a fixture whose `mklink`
 * failed silently would otherwise report the install safe while the delete met
 * an ordinary empty directory, which is exactly what happened to the first hand
 * run of this file's older measurement.
 *
 * It runs the REAL script bytes against a temporary repository, which is
 * faithful because the script derives its own repo root from its own location:
 * copy the three files into `<tmp>/repo/scripts/`, and `<tmp>` is the parent the
 * worktree is cut beside. **This repository is never touched** — the alternative
 * (driving `--pr` against the live tree) would register a worktree in the shared
 * `.git` and drop a `drape-review-*` directory into the very population the
 * Janitor is sweeping.
 */
describe.runIf(process.platform === "win32")("shift-worktree --pr, driven end to end (#1796)", () => {
  const suiteRepoRoot = join(import.meta.dirname, "..");

  function git(cwd: string, args: string[]) {
    const result = spawnSync("git", args, { cwd, encoding: "utf8" });
    return { status: result.status ?? 1, out: result.stdout ?? "", err: result.stderr ?? "" };
  }

  /** The real script, run through this repository's own tsx, on a temp repo. */
  function tool(repo: string, args: string[]) {
    const result = spawnSync(
      process.execPath,
      [
        join(suiteRepoRoot, "node_modules", "tsx", "dist", "cli.mjs"),
        join(repo, "scripts", "shift-worktree.mts"),
        ...args,
      ],
      { cwd: repo, encoding: "utf8" },
    );
    return { status: result.status ?? 1, out: `${result.stdout ?? ""}${result.stderr ?? ""}` };
  }

  /** A repository the real script can operate on, with a real install to junction. */
  function withReviewFixture(
    name: string,
    body: (paths: { repo: string; install: string; reviewPath: string }) => void,
  ) {
    const parent = mkdtempSync(join(tmpdir(), `drape-prdrive-${name}-`));
    try {
      const repo = join(parent, "repo");
      mkdirSync(join(repo, "scripts", "lib"), { recursive: true });
      copyFileSync(
        join(suiteRepoRoot, "scripts", "shift-worktree.mts"),
        join(repo, "scripts", "shift-worktree.mts"),
      );
      for (const lib of ["shiftWorktree.mts", "riteWorktree.mts"]) {
        copyFileSync(join(suiteRepoRoot, "scripts", "lib", lib), join(repo, "scripts", "lib", lib));
      }
      /* The install the junction points at, with the canary the Janitor reads. */
      const install = join(repo, "node_modules");
      mkdirSync(join(install, "react"), { recursive: true });
      writeFileSync(join(install, "canary.txt"), "the main tree's install");
      writeFileSync(join(install, "react", "index.js"), "module.exports = {};\n");
      /* `add` refuses without one: a worktree without it cannot run the app. */
      writeFileSync(join(repo, ".env"), "JWT_SECRET=fixture\n");
      writeFileSync(join(repo, ".gitignore"), "node_modules/\n.env\n");

      expect(git(parent, ["init", "-q", "--bare", "remote.git"]).status).toBe(0);
      expect(git(repo, ["init", "-q", "-b", "main"]).status).toBe(0);
      expect(git(repo, ["config", "user.email", "arm@example.com"]).status).toBe(0);
      expect(git(repo, ["config", "user.name", "Arm"]).status).toBe(0);
      expect(git(repo, ["remote", "add", "origin", join(parent, "remote.git")]).status).toBe(0);
      expect(git(repo, ["add", "-A"]).status).toBe(0);
      expect(git(repo, ["commit", "-q", "-m", "the fixture repository"]).status).toBe(0);
      expect(git(repo, ["push", "-q", "origin", "main"]).status).toBe(0);
      writeFileSync(join(repo, "pr.txt"), "what the pull request changed\n");
      expect(git(repo, ["add", "pr.txt"]).status).toBe(0);
      expect(git(repo, ["commit", "-q", "-m", "the pull request's commit"]).status).toBe(0);
      expect(git(repo, ["push", "-q", "origin", "HEAD:refs/pull/7/head"]).status).toBe(0);
      expect(git(repo, ["checkout", "-q", "main"]).status).toBe(0);
      expect(git(repo, ["reset", "-q", "--hard", "HEAD~1"]).status).toBe(0);

      body({ repo, install, reviewPath: join(parent, "drape-review-7") });
    } finally {
      /* ⚠ THE JUNCTION COMES OUT BEFORE THE RECURSIVE DELETE HERE TOO. A
         fixture's teardown must not be the one deletion form that empties an
         install — and on a failing arm the junction is exactly what is left. */
      const link = join(parent, "drape-review-7", "node_modules");
      if (existsSync(link)) spawnSync("cmd", ["/c", "rmdir", link.replace(/\//g, "\\")]);
      rmSync(parent, { recursive: true, force: true });
    }
  }

  it("⚠ ADD CUTS A DETACHED REVIEW WORKTREE AND REMOVE TAKES IT DOWN — the install counted throughout", () => {
    withReviewFixture("roundtrip", ({ repo, install, reviewPath }) => {
      const before = readdirSync(install).length;
      expect(before, "the fixture's install is empty — nothing here could measure a loss")
        .toBeGreaterThan(0);

      const added = tool(repo, ["add", "--pr", "7"]);
      expect(added.status, added.out).toBe(0);
      expect(existsSync(reviewPath), added.out).toBe(true);
      expect(
        existsSync(join(reviewPath, "pr.txt")),
        "the worktree is not at the pull request's head",
      ).toBe(true);
      expect(existsSync(join(reviewPath, ".env"))).toBe(true);

      /* ⚠ READ THROUGH THE JUNCTION, NOT ITS EXIT CODE. A fixture whose
         `mklink` failed would report the install safe below because the delete
         met an ordinary empty directory — the exact false pass this file's
         older measurement was thrown away for. */
      expect(
        readFileSync(join(reviewPath, "node_modules", "canary.txt"), "utf8"),
        "the junction does not resolve — this arm cannot measure anything",
      ).toBe("the main tree's install");
      expect(readdirSync(install).length, "the add changed the install").toBe(before);

      /* NO LOCAL BRANCH — the half of this that answers #1797. */
      const branches = git(repo, ["branch", "--list"]);
      expect(branches.out).not.toContain("review");
      expect(branches.out).not.toContain("pull");

      /* AND `add` NAMES ITS OWN TAKEDOWN, which is the whole defect in one
         line: the hand road had a cut step and no removal step to skip. */
      expect(added.out).toContain("remove --pr 7");

      const removed = tool(repo, ["remove", "--pr", "7"]);
      expect(removed.status, removed.out).toBe(0);
      expect(existsSync(reviewPath), `the directory survived:\n${removed.out}`).toBe(false);
      expect(
        readFileSync(join(install, "canary.txt"), "utf8"),
        "THE REMOVAL FOLLOWED THE JUNCTION AND EMPTIED THE INSTALL",
      ).toBe("the main tree's install");
      expect(readdirSync(install).length, "the removal changed the install").toBe(before);
      expect(git(repo, ["worktree", "list", "--porcelain"]).out).not.toContain("drape-review-7");
    });
  });

  it("⚠ A SECOND ATTEMPT ON ONE PULL REQUEST IS REFUSED AND NAMES THE REMOVAL — no `1794b` to invent", () => {
    withReviewFixture("second-attempt", ({ repo, reviewPath }) => {
      expect(tool(repo, ["add", "--pr", "7"]).status).toBe(0);
      const again = tool(repo, ["add", "--pr", "7"]);
      expect(again.status, again.out).toBe(1);
      expect(again.out).toContain("already exists");
      expect(again.out).toContain("remove --pr 7");
      expect(again.out).toContain("Do NOT make a second directory");
      expect(existsSync(reviewPath), "the refused second attempt removed the first").toBe(true);
      expect(tool(repo, ["remove", "--pr", "7"]).status).toBe(0);
    });
  });

  it("⚠ A COMMIT TYPED IN THE REVIEW WORKTREE REFUSES THE REMOVAL, AND THE DIRECTORY SURVIVES", () => {
    withReviewFixture("commit-in-review", ({ repo, reviewPath }) => {
      expect(tool(repo, ["add", "--pr", "7"]).status).toBe(0);
      expect(git(reviewPath, ["config", "user.email", "arm@example.com"]).status).toBe(0);
      expect(git(reviewPath, ["config", "user.name", "Arm"]).status).toBe(0);
      writeFileSync(join(reviewPath, "note.txt"), "a repair typed in the review worktree\n");
      expect(git(reviewPath, ["add", "note.txt"]).status).toBe(0);
      expect(git(reviewPath, ["commit", "-q", "-m", "a repair"]).status).toBe(0);

      const refused = tool(repo, ["remove", "--pr", "7"]);
      expect(refused.status, refused.out).toBe(1);
      expect(refused.out).toContain("REFUSING");
      expect(refused.out).toContain("only copy");
      expect(existsSync(reviewPath), "the refusal deleted the directory anyway").toBe(true);

      /* ⚠ AND `--force` IS STILL A ROAD, because the alternative is a reviewer
         hand-typing the one deletion form that empties the install. */
      const forced = tool(repo, ["remove", "--pr", "7", "--force"]);
      expect(forced.status, forced.out).toBe(0);
      expect(existsSync(reviewPath)).toBe(false);
    });
  });

  it("⚠ AN UNREGISTERED SHELL IS REMOVED, NOT REFUSED — that is the state of all nineteen", () => {
    withReviewFixture("orphan-shell", ({ repo, install, reviewPath }) => {
      expect(tool(repo, ["add", "--pr", "7"]).status).toBe(0);
      /* The documented git 2.55 outcome, performed deliberately: the worktree
         is unregistered and the directory and its junction are left standing.
         That is what a `drape-review-*` shell IS — and asking git about a
         pruned worktree would come back `unreadable` and refuse to clean up
         litter, i.e. refuse the one case this card exists to make easy. */
      git(repo, ["worktree", "remove", "--force", reviewPath]);
      git(repo, ["worktree", "prune"]);
      expect(existsSync(reviewPath), "the fixture could not produce a shell").toBe(true);
      expect(existsSync(join(reviewPath, "node_modules"))).toBe(true);
      const before = readdirSync(install).length;

      const removed = tool(repo, ["remove", "--pr", "7"]);
      expect(removed.status, removed.out).toBe(0);
      expect(removed.out).toContain("registered");
      expect(existsSync(reviewPath)).toBe(false);
      expect(readFileSync(join(install, "canary.txt"), "utf8")).toBe("the main tree's install");
      expect(readdirSync(install).length).toBe(before);
    });
  });

  it("--dry-run on a review removal changes nothing", () => {
    withReviewFixture("dry-run", ({ repo, reviewPath }) => {
      expect(tool(repo, ["add", "--pr", "7"]).status).toBe(0);
      const dry = tool(repo, ["remove", "--pr", "7", "--dry-run"]);
      expect(dry.status, dry.out).toBe(0);
      expect(dry.out).toContain("nothing was changed");
      expect(existsSync(reviewPath)).toBe(true);
      expect(existsSync(join(reviewPath, "node_modules"))).toBe(true);
      expect(tool(repo, ["remove", "--pr", "7"]).status).toBe(0);
    });
  });
});

describe("the script's own text — the review road's sequence (#1796)", () => {
  const source = readFileSync(join(import.meta.dirname, "..", "scripts", "shift-worktree.mts"), "utf8");

  it("⚠ STILL EXACTLY ONE RECURSIVE DELETE — two roads, one destructive sequence", () => {
    /* The point of routing the review road through this tool rather than giving
       it its own is that the dangerous part has ONE owner. A second `rmSync`
       here would mean the review road had quietly grown its own. */
    expect(source.match(/rmSync\(/g) ?? []).toHaveLength(1);
    expect(source).toContain("rmSync(plan.path, { recursive: true, force: true })");
  });

  it("⚠ THE REVIEW VERDICT IS ASKED BEFORE THE JUNCTION COMES OUT, let alone the delete", () => {
    const review = source.indexOf("if (reviewVerdict !== null) {");
    const proof = source.indexOf("junctionMustBeGone(");
    const destroy = source.indexOf("rmSync(plan.path");
    expect(review).toBeGreaterThan(-1);
    expect(review).toBeLessThan(proof);
    expect(proof).toBeLessThan(destroy);
  });

  it("⚠ THE UNPUSHED PROBES ARE NOT PUT TO A REVIEW WORKTREE", () => {
    /* On a detached HEAD they report the pull request's own commits as work
       about to vanish, and every review would meet a refusal on its happy path.
       The guard is asserted first, so a later read cannot pass vacuously. */
    const guard = source.indexOf("if (reviewPr === null) {\n    const unpushed");
    expect(guard, "the review road reaches the unpushed probes again (#1796)").toBeGreaterThan(-1);
    const probe = source.indexOf('git(["log", "--oneline", "@{u}..HEAD"]');
    expect(probe).toBeGreaterThan(guard);
  });

  it("⚠ `--pr` NEVER SWALLOWS A FLAG AS ITS VALUE", () => {
    /* `remove --pr --dry-run` taking `--dry-run` as the number would leave
       `dryRun` false on the one command that deletes. */
    expect(source).toContain('value.startsWith("--")');
  });
});
