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

import { describe, expect, it } from "vitest";

import {
  decideRemoval,
  junctionMustBeGone,
  looksCrlfSmudged,
  planFor,
  validateSlug,
  type RemovalState,
} from "../scripts/lib/shiftWorktree.mts";

const clean: RemovalState = {
  unpushedCommits: 0,
  dirtyFiles: [],
  registered: true,
  junctionPresent: false,
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
