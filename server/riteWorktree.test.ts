/**
 * THE RITE'S THROWAWAY WORKTREE TEARDOWN — the directory half (#654).
 *
 * `server/scriptGuards.test.ts` proves the REGISTRATION is always cleaned up
 * and states, at length, why it deliberately does not assert the DIRECTORY:
 * the two properties come apart on this platform, and a leaked registration
 * breaks the next run while a leaked directory is only litter. This suite is
 * the other half — the litter, which measured **7.8 GB across 32 checkouts**
 * in `%TEMP%` and had regrown to **4 within a day** of being swept by hand.
 *
 * ⚠ WHAT THE GATE IS FOR, AND WHAT THIS SUITE MAY THEREFORE CLAIM.
 *
 * `removeThrowawayDir`'s recursive fallback is gated on the junction being
 * proven gone, because `riteWorktree.mts`'s own header records that removing
 * the tree recursively through a live junction walks into the REAL
 * `node_modules` — a known way to destroy the main checkout on this machine.
 *
 * **That danger was DRIVEN before this suite was written, and Node's own
 * remover does not have it**: `rmSync(dir, { recursive: true })` over a
 * directory holding a junction into a decoy `node_modules` unlinked the
 * junction and left every byte of the decoy standing (a canary file and a
 * nested file, both intact — one run, this machine, this Node). The footgun
 * is real for the removers a person reaches for by hand — `rmdir /s`,
 * `Remove-Item -Recurse` — and it is house doctrine either way; it is not
 * reachable through the call this module makes.
 *
 * **So a "the decoy survived" assertion here would be GREEN WITH THE GATE
 * DELETED**, which is a guard over nothing — the class this repository keeps
 * paying for. The load-bearing arm is therefore the gate's own DECISION: the
 * returned verdict and the directory left standing. Delete the
 * `readJunctionAt(junction)` check and that arm goes red, because the fallback
 * then fires and takes the directory. The decoy is still checked, as a
 * documented redundancy that costs nothing — never as the proof.
 */
import { describe, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import {
  existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync,
  readdirSync, rmSync, symlinkSync, writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { inWorktreeOf, readJunctionAt, removeThrowawayDir } from "../scripts/lib/riteWorktree.mts";
import { CHILD_PROCESS_TEST_TIMEOUT_MS } from "./testing/childProcessTimeout";

/* This suite spawns real `git` — #548's class. Without the declaration it runs
   inside vitest's 5s default and goes red under load on somebody's machine
   rather than in CI. */
vi.setConfig({ testTimeout: CHILD_PROCESS_TEST_TIMEOUT_MS });

const ROOT = path.resolve(__dirname, "..");

/** A throwaway parent holding a `tree` that a failed `worktree remove` left behind. */
const leftoverShape = (base: string, withJunction: string | null) => {
  const dir = path.join(base, "throwaway");
  const tree = path.join(dir, "tree");
  mkdirSync(tree, { recursive: true });
  writeFileSync(path.join(tree, "file.txt"), "checkout content");
  const junction = path.join(tree, "node_modules");
  if (withJunction !== null) symlinkSync(withJunction, junction, "junction");
  return { dir, tree, junction };
};

const withTemp = <T,>(body: (base: string) => T): T => {
  const base = mkdtempSync(path.join(os.tmpdir(), "drape-654-"));
  try { return body(base); } finally { rmSync(base, { recursive: true, force: true }); }
};

describe("removeThrowawayDir — the recursive fallback is gated on the junction", () => {
  it("REFUSES to recurse while the junction is still on disk, and says so", () => {
    withTemp((base) => {
      const decoy = path.join(base, "decoy_node_modules");
      mkdirSync(path.join(decoy, "nested"), { recursive: true });
      writeFileSync(path.join(decoy, "CANARY.txt"), "the main checkout's node_modules");
      const { dir, junction } = leftoverShape(base, decoy);

      /* The fixture is only a fixture if the junction actually resolves —
         otherwise this arm is a gate test over a broken link. */
      expect(existsSync(path.join(junction, "CANARY.txt")),
        "the junction must resolve into the decoy, or this arm proves nothing").toBe(true);

      /* THE LOAD-BEARING ASSERTION. Both halves die if the gate is removed:
         the verdict becomes "removed" and the directory goes. */
      expect(removeThrowawayDir(dir, junction)).toBe("kept-junction-present");
      expect(existsSync(dir), "the directory is LEFT — litter is recoverable, the checkout is not").toBe(true);

      /* Redundancy, documented as such in this file's header: Node's remover
         would not have walked the junction even without the gate. */
      expect(readdirSync(decoy).sort()).toEqual(["CANARY.txt", "nested"]);
      expect(readFileSync(path.join(decoy, "CANARY.txt"), "utf8")).toBe("the main checkout's node_modules");
    });
  });

  it("SWEEPS the leftover once the junction is gone — the #654 leak itself", () => {
    withTemp((base) => {
      const { dir, junction } = leftoverShape(base, null);
      expect(existsSync(junction)).toBe(false);
      /* A non-empty directory: `rmdirSync` cannot take it, so this arm only
         passes through the fallback. Before #654 the answer here was "left". */
      expect(removeThrowawayDir(dir, junction)).toBe("removed");
      expect(existsSync(dir)).toBe(false);
    });
  });

  it("sweeps when the junction was never made at all", () => {
    withTemp((base) => {
      const { dir } = leftoverShape(base, null);
      expect(removeThrowawayDir(dir, null)).toBe("removed");
      expect(existsSync(dir)).toBe(false);
    });
  });

  it("takes the ordinary empty parent without the fallback ever being reached", () => {
    withTemp((base) => {
      const dir = path.join(base, "empty");
      mkdirSync(dir);
      expect(removeThrowawayDir(dir, null)).toBe("removed");
      expect(existsSync(dir)).toBe(false);
    });
  });

  it("reads the junction WITHOUT following it — a dangling link still blocks", () => {
    withTemp((base) => {
      const target = path.join(base, "target_that_will_vanish");
      mkdirSync(target);
      const { dir, junction } = leftoverShape(base, target);
      rmSync(target, { recursive: true, force: true });
      /* `existsSync` follows and would call this absent; `lstatSync` sees the
         link that is still standing in the directory about to be removed. */
      expect(existsSync(junction), "the link resolves nowhere now").toBe(false);
      expect(lstatSync(junction).isSymbolicLink()).toBe(true);
      expect(removeThrowawayDir(dir, junction)).toBe("kept-junction-present");
      expect(existsSync(dir)).toBe(true);
    });
  });

  /* ──────────────────────────────────────────────────────────────────────────
     ⚠ THE SIBLING OF #2161, FOUND BY ITS LAW-7 SWEEP.

     This gate read `stillOnDisk(junction)` — *is there anything at the path* —
     and answered `kept-junction-present`. So a `node_modules` that is a REAL
     DIRECTORY (an aborted install; the measured state of both review shells
     #2161 was filed about) made it report a live junction standing in the way
     when none was. The polarity is the safe one, so nothing was ever destroyed
     — what it produced is litter that can never be swept, under a verdict
     naming a cause that is not the cause.
     ────────────────────────────────────────────────────────────────────────── */
  it("⚠ SWEEPS a node_modules that is a REAL DIRECTORY — there is no link to follow", () => {
    withTemp((base) => {
      const { dir, junction } = leftoverShape(base, null);
      /* The fixture is the measured one: a real directory, non-empty, where a
         junction would be. `rmdir` takes neither an empty directory's contents
         nor a reparse point here, which is why the old reading dead-ended. */
      mkdirSync(path.join(junction, "some-package", "dist"), { recursive: true });
      expect(lstatSync(junction).isSymbolicLink(), "the fixture must NOT be a link, or this arm proves nothing")
        .toBe(false);

      expect(removeThrowawayDir(dir, junction)).toBe("removed");
      expect(existsSync(dir), "the leftover is gone — a real directory is the recursive delete's job").toBe(false);
    });
  });

  it("⚠ NEGATIVE CONTROL — a real directory sweeping does NOT mean a live junction sweeps", () => {
    /* The arm that proves the one above widened the gate and did not remove it.
       Same shape, one difference: the path is a LINK into a decoy that stands
       in for the main checkout's install, and the decoy must survive intact. */
    withTemp((base) => {
      const decoy = path.join(base, "decoy_node_modules");
      mkdirSync(path.join(decoy, "nested"), { recursive: true });
      writeFileSync(path.join(decoy, "CANARY.txt"), "the main checkout's node_modules");
      const { dir, junction } = leftoverShape(base, decoy);
      expect(lstatSync(junction).isSymbolicLink()).toBe(true);

      expect(removeThrowawayDir(dir, junction)).toBe("kept-junction-present");
      expect(existsSync(dir)).toBe(true);
      expect(readFileSync(path.join(decoy, "CANARY.txt"), "utf8")).toBe("the main checkout's node_modules");
    });
  });
});

describe("inWorktreeOf leaves no directory behind on the failure shape #654 measured", () => {
  it("sweeps the throwaway even when `worktree remove` cannot find the tree", () => {
    let dir = "";
    inWorktreeOf(ROOT, "HEAD", (tree) => {
      dir = path.dirname(tree);
      expect(existsSync(path.join(tree, "package.json"))).toBe(true);
      /*
        REPRODUCE THE LEAK'S OWN CAUSE, not a stand-in for it. #654 measured
        8 leftovers in 120 driven trees and read git's stderr: a sibling
        `git worktree prune` unregisters a tree whose directory is still
        there, after which this teardown's `remove --force` says *"is not a
        working tree"* and gives up, and the non-recursive `rmdir` fails
        because the tree is inside. Deleting the admin entry from under it
        puts git in exactly that state deterministically, instead of hoping
        for the 6.7%.

        ⚠ And deleting the admin entry is the RIGHT stand-in for a reason
        this comment did not have when it was written (#969, driven on git
        2.55): prune does not collect a registration merely because a
        directory is still standing — a tree with its directory and its own
        `.git` file both present survives one. Prune resolves the
        registration through that `.git` pointer and collects it when the
        pointer does not resolve, which is the same end state this arm
        creates directly. The arm is unchanged; only the reason it is
        faithful is now written down.
      */
      const admin = readFileSync(path.join(tree, ".git"), "utf8").replace(/^gitdir:\s*/, "").trim();
      expect(admin.length, "the tree must carry a gitdir pointer to unregister").toBeGreaterThan(0);
      rmSync(admin, { recursive: true, force: true });
      /* The remove genuinely fails now — asserted, so a future git that
         tolerates this cannot leave the arm quietly testing the happy path. */
      expect(() => execFileSync("git", ["worktree", "remove", "--force", tree],
        { cwd: ROOT, encoding: "utf8", stdio: "pipe" })).toThrow();
      return null;
    });
    expect(dir).not.toBe("");
    /* No per-arm number: the file-level `vi.setConfig` above is the house rule
       ("declared once per file, never per arm"). 30 s is ~3x the load-adjusted
       cost of this arm — it checks out ONE tree at 2.5 s solo, against the
       sibling two-tree arm in `scriptGuards.test.ts` that measured 4.8 s solo
       and 20.5 s inside a full 680-file run. */
    expect(existsSync(dir), "the throwaway directory is the 7.8 GB that was leaking").toBe(false);
  });
});

describe("the junction reading has ONE declaration and both recursive-delete roads use it", () => {
  /*
    LAW 7's SWEEP, PINNED (#654). Two places on this machine authorise a
    recursive delete on the answer to "is the junction gone" — this module's
    `removeThrowawayDir`, and `scripts/shift-worktree.mts` feeding
    `junctionMustBeGone`. The second read it with `existsSync`, which FOLLOWS
    the link, while its own comment said *"if the path is still there"*: a
    junction whose target had vanished read as absent.

    Collapsing them onto one predicate makes the call sites correct THROUGH a
    helper, so a sabotage of the helper alone is what proves them — and a
    second declaration appearing anywhere is the drift this arm exists to
    catch. Both facts are asserted: the declaration count, and the call sites.

    ⚠ **AND THE PREDICATE WAS THE WRONG QUESTION UNTIL #2161.** It was
    `stillOnDisk`, a boolean meaning *is there any entry here*, and all three
    call sites fed it to a decision about a LINK. Collapsing them onto one
    reading had made them consistently WRONG rather than inconsistently wrong,
    which is the honest shape of what #654 bought: one place to fix. It is
    `readJunctionAt` now and it returns the distinction `lstat` was already
    handing it.
  */
  const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");

  it("declares readJunctionAt exactly once, in riteWorktree.mts", () => {
    const lib = read("scripts/lib/riteWorktree.mts");
    expect(lib.match(/export const readJunctionAt\s*=/g) ?? []).toHaveLength(1);
    /* Nothing else may grow its own copy of the reading. */
    for (const rel of ["scripts/shift-worktree.mts", "scripts/lib/shiftWorktree.mts"]) {
      expect(read(rel), `${rel} must not re-declare the reading`).not.toMatch(/const readJunctionAt\s*=/);
      /* ⚠ AND THE OLD NAME MUST NOT COME BACK ANYWHERE. A re-added
         `stillOnDisk` is not a stale name — it is the boolean that cannot tell a
         link from a directory, re-entering the gate above a recursive delete. */
      expect(read(rel), `${rel} re-declares the boolean #2161 removed`).not.toMatch(/const stillOnDisk\s*=/);
    }
    expect(lib, "the boolean #2161 widened is back in the library").not.toMatch(/const stillOnDisk\s*=/);
  });

  it("routes shift-worktree's junction reads through it, never through existsSync", () => {
    const script = read("scripts/shift-worktree.mts");
    /* ⚠ THE SYMBOL IN THE LIST, NOT THE LIST ITSELF (#1823). This read
       `import \{ stillOnDisk \}` — the whole import statement, exactly — and went
       red the day a SECOND disk reading for the same recursive delete joined it
       (`measureTree`, the byte count beside an ignored path worth keeping). The
       rule this arm holds is that the CLI IMPORTS the reading rather than growing
       its own, and the sibling arm above already forbids a local declaration; the
       import list was never the rule. Still anchored on the specifier, so an
       import of the name from somewhere else does not satisfy it. */
    const importLine = script
      .split(/\r?\n/)
      .find((line) => /^import \{[^}]*\} from "\.\/lib\/riteWorktree\.mts";$/.test(line));
    expect(importLine, "shift-worktree.mts no longer imports from ./lib/riteWorktree.mts").toBeDefined();
    expect(importLine ?? "", "the junction reading is not among the imported names").toMatch(/\breadJunctionAt\b/);
    /* The guard's own argument is the one that matters: an `existsSync` here
       is the exact defect this sweep closed. */
    expect(script).toMatch(/junctionMustBeGone\(readJunctionAt\(plan\.nodeModulesLink\)\)/);
    expect(script).not.toMatch(/existsSync\(plan\.nodeModulesLink\)/);
    /* And the state the removal plan is printed from reads the same way. */
    expect(script).toMatch(/junctionAt: readJunctionAt\(plan\.nodeModulesLink\)/);
    /* ⚠ THE PROOF STEP RE-READS THE DISK RATHER THAN REUSING THE STATE (#2161).
       Its whole purpose is that the unlink above actually took; handed
       `state.junctionAt` it would assert the first reading against itself and
       pass by construction — a control that is invoked and inert, which every
       arm here would still call green. */
    expect(script, "the proof step reuses the first reading, so it proves nothing")
      .not.toMatch(/junctionMustBeGone\(state\.junctionAt\)/);
  });

  it("⚠ ROUTES THE RITE'S OWN TEARDOWN THROUGH IT TOO — the sibling #2161 swept", () => {
    /* `removeThrowawayDir` is the third road that authorises a recursive delete
       on this answer, and it read the boolean exactly as the CLI did. Held here
       because the behavioural arms above drive the function and would all stay
       green if this gate went back to asking "is there anything there". */
    const lib = read("scripts/lib/riteWorktree.mts");
    const start = lib.indexOf("export const removeThrowawayDir");
    const end = lib.indexOf("export const inWorktreeOf");
    expect(start, "removeThrowawayDir moved — re-anchor this arm").toBeGreaterThan(-1);
    expect(end, "inWorktreeOf moved — re-anchor this arm").toBeGreaterThan(start);
    const block = lib.slice(start, end);
    expect(block, "the rite's teardown no longer reads the junction kind").toMatch(/readJunctionAt\(junction\)/);
    expect(block, 'a "real" directory must not be reported as a live junction').toMatch(/at === "link"/);
  });

  it("FAILS CLOSED — a read it cannot complete means STILL THERE, not gone", () => {
    /*
      PR #692 review, finding 2. `lstat` can fail for reasons other than
      absence — EPERM, EACCES, ENOTDIR — and a bare `catch { return false }`
      would read every one of them as "the junction is gone" and authorise the
      recursive delete. This is the predicate the module's own docblock calls
      the thing standing between a sweep and the main checkout, so it takes the
      same polarity as everything else here: when in doubt, keep.

      ⚠ THE FIXTURE IS NOT THE OBVIOUS ONE, AND THE FIRST ONE WAS WRONG. A path
      THROUGH a file (`<file>/child`) is the natural ENOTDIR case and it was
      written first — this bench answers **ENOENT** for it, and the arm caught
      its own bad fixture rather than passing. Measured here, all four
      candidates: through-a-file ENOENT, absent ENOENT, a 400-character name
      ENOENT, and only a NUL-bearing path fails for a reason that is not
      absence. EPERM cannot be manufactured portably, so the branch is driven
      with the one non-ENOENT failure this platform reliably gives — which is
      the same branch, reached the same way.
    */
    withTemp((base) => {
      const unreadable = `${base}\0x`;
      let code = "";
      try { lstatSync(unreadable); } catch (e) { code = (e as NodeJS.ErrnoException).code ?? ""; }
      expect(code, "the fixture must fail for a reason that is NOT absence").not.toBe("ENOENT");
      expect(code.length, "the platform must give a code, or this arm proves nothing").toBeGreaterThan(0);
      /* ⚠ `unreadable`, AND #2161's WIDENING MUST NOT HAVE MADE IT `real` —
         which is the one way this card could have broken the gate it widened.
         `real` is a permission to delete recursively; `unreadable` is refused by
         `junctionMustBeGone`. Both halves are asserted, because "not absent"
         alone would pass on `real`. */
      expect(readJunctionAt(unreadable)).toBe("unreadable");
      expect(readJunctionAt(unreadable), "an unknown became a permission to delete").not.toBe("real");
      /* And the ordinary absent case still reads absent, or the hardening has
         simply broken the reader in the other direction. */
      expect(readJunctionAt(path.join(base, "nothing-here"))).toBe("absent");
    });
  });

  it("readJunctionAt sees a link whose target has gone — the property existsSync lacks", () => {
    withTemp((base) => {
      const target = path.join(base, "gone");
      mkdirSync(target);
      const link = path.join(base, "link");
      symlinkSync(target, link, "junction");
      expect(readJunctionAt(link)).toBe("link");
      rmSync(target, { recursive: true, force: true });
      expect(existsSync(link), "existsSync follows and loses the link").toBe(false);
      expect(readJunctionAt(link), "the link is still standing in the way").toBe("link");
    });
  });

  /* ──────────────────────────────────────────────────────────────────────────
     ⚠ THE DISTINCTION ITSELF, WITH ITS POSITIVE CONTROL (#2161).

     MEASURED on this machine before a line was written, which is why the card
     could be built rather than argued: `drape-review-1910/node_modules` and
     `drape-review-1915/node_modules` both answer `isSymbolicLink()` FALSE while
     a live worktree's answers true. Each shell holds 58 top-level entries, 824
     directories, 0 files, 0 bytes — an aborted install.
     ────────────────────────────────────────────────────────────────────────── */
  it("⚠ TELLS A LINK FROM A REAL DIRECTORY AT THE SAME PATH — the whole of #2161", () => {
    withTemp((base) => {
      const target = path.join(base, "target");
      mkdirSync(target);
      const asLink = path.join(base, "as_link");
      symlinkSync(target, asLink, "junction");
      const asReal = path.join(base, "as_real");
      mkdirSync(path.join(asReal, "some-package"), { recursive: true });

      expect(readJunctionAt(asLink)).toBe("link");
      expect(readJunctionAt(asReal)).toBe("real");
      /* The fixtures are only fixtures if they differ the way the real shells
         differ — otherwise this arm is two names for one state. */
      expect(lstatSync(asLink).isSymbolicLink()).toBe(true);
      expect(lstatSync(asReal).isSymbolicLink()).toBe(false);
    });
  });

  it("⚠ A FILE at the junction path is `real`, not `link` — not a directory either, and never a permissionless unknown", () => {
    /* The shape nobody expects and the reader must not get wrong by accident:
       `isDirectory()` and `isSymbolicLink()` are both false. It reads `real`
       because the only question the callers ask is *is there a link to follow*,
       and `rmSync(recursive, force)` takes a file perfectly well. Asserted so
       the answer is a decision rather than a side effect of the implementation. */
    withTemp((base) => {
      const asFile = path.join(base, "as_file");
      writeFileSync(asFile, "not a directory at all");
      expect(readJunctionAt(asFile)).toBe("real");
    });
  });
});
