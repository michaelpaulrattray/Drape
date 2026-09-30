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
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
  decideRemoval,
  mergedPrArgs,
  prHeadFetchArgs,
  prReadFailed,
  readMergedPullRequest,
  readShippedCommits,
  removalStateFromShipReading,
  junctionMustBeGone,
  looksCrlfSmudged,
  planFor,
  validateSlug,
  type RemovalState,
} from "../scripts/lib/shiftWorktree.mts";
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
    expect(plan.branch).toBe("team/thing");
    expect(plan.nodeModulesLink).toBe("C:/Users/Admin/drape-shift-thing/node_modules");
    expect(plan.path.startsWith("C:/Users/Admin/Drape/")).toBe(false);
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
    expect(source).toContain('line.startsWith("worktree ")');
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
    const branch = source.indexOf("registeredButGone");
    expect(branch).toBeGreaterThan(-1);
    expect(source).toContain("prune the stale registration");
  });

  it("the unpushed count asks the branch's OWN remote before refusing (finding 4)", () => {
    // `git worktree add -b team/x <path> origin/main` sets upstream to
    // origin/main, so `@{u}..HEAD` over-refuses before a `push -u`. Safe
    // direction, but a guard that fires on healthy input trains the --force
    // habit the header warns about.
    expect(source).toContain("origin/${plan.branch}..HEAD");
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
