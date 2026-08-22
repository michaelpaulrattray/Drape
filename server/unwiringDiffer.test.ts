import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { importerCount, readTree, unwiredBetween } from "../scripts/lib/importerCountDiff.mts";

/**
 * THE UN-WIRING DIFFER — the arms that need no `git worktree`.
 *
 * `scripts/diff-importer-count-across-time.mts` answers the question CLAUDE.md
 * said an import-graph reading could not: was this control WIRED AND LOST, or
 * never wired at all? It reads two trees and reports every symbol whose
 * PRODUCTION importer count fell to zero.
 *
 * Its strongest control is real rather than manufactured — given the February
 * window it must rediscover both deaths from that morning — and that one needs
 * two checked-out trees, so it rides `--controls february` on the script.
 * These are the arms that can run in the ordinary suite, driven against
 * manufactured trees, and they exist because a control you only run by hand is
 * a control that stops being run.
 *
 * **Each arm below is written so it can FAIL**: the same fixture pair, varied
 * in one property at a time, with the un-varied direction asserted beside it.
 */

const roots: string[] = [];
function tree(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "unwiring-"));
  roots.push(root);
  for (const [rel, source] of Object.entries(files)) {
    const full = join(root, rel);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, source, "utf8");
  }
  return root;
}
afterAll(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

const GATE = `export function isSensitiveAction(action: string): boolean {\n  return action === "delete";\n}\n`;
const CALLER = `import { isSensitiveAction } from "./adminSecurity";\nexport const route = (a: string) => isSensitiveAction(a);\n`;
const namesFound = (before: string, after: string) =>
  unwiredBetween(readTree(before), readTree(after)).map((f) => f.name);

describe("the un-wiring differ", () => {
  it("finds a symbol whose only production importer disappeared", () => {
    const before = tree({ "server/adminSecurity.ts": GATE, "server/routers.ts": CALLER });
    const after = tree({
      "server/adminSecurity.ts": GATE,
      "server/routers.ts": `export const route = (a: string) => a === "delete";\n`,
    });
    expect(namesFound(before, after)).toEqual(["isSensitiveAction"]);
    /* the un-varied direction: it was genuinely reachable before */
    expect(importerCount(readTree(before), "isSensitiveAction")).toBe(1);
  });

  it("does NOT find a symbol that kept an importer", () => {
    const before = tree({ "server/adminSecurity.ts": GATE, "server/routers.ts": CALLER });
    const after = tree({ "server/adminSecurity.ts": GATE, "server/routers.ts": CALLER });
    expect(namesFound(before, after)).toEqual([]);
  });

  /**
   * THE TYPE SPECIMEN'S OWN SHAPE, and the reason this instrument exists.
   *
   * `isSensitiveAction` survived the `3cb0cdee` split still consulted TWICE
   * inside its own module for severity labelling. The uncalled-export sweep
   * excludes any self-referencing symbol, so it can never report this case
   * however many trees it reads. Here the differ must report it AND label it,
   * because the label is what tells a reader the parent was blind rather than
   * silent.
   */
  it("reports a symbol still consulted inside its own module, and labels it", () => {
    const selfConsulting = GATE + `export const severity = (a: string) => (isSensitiveAction(a) ? "warn" : "info");\n`;
    const before = tree({ "server/adminSecurity.ts": selfConsulting, "server/routers.ts": CALLER });
    const after = tree({
      "server/adminSecurity.ts": selfConsulting,
      "server/routers.ts": `export const route = (a: string) => a === "delete";\n`,
    });
    const [finding, ...rest] = unwiredBetween(readTree(before), readTree(after));
    expect(rest).toEqual([]);
    expect(finding.name).toBe("isSensitiveAction");
    expect(finding.kind).toBe("self-consulted");
    expect(finding.selfUses).toBeGreaterThan(0);
    expect(finding.lostImporters).toEqual(["server/routers.ts"]);
  });

  it("labels a symbol nothing mentions any more as fully dark", () => {
    const before = tree({ "server/adminSecurity.ts": GATE, "server/routers.ts": CALLER });
    const after = tree({
      "server/adminSecurity.ts": GATE,
      "server/routers.ts": `export const route = (a: string) => a === "delete";\n`,
    });
    expect(unwiredBetween(readTree(before), readTree(after))[0].kind).toBe("fully-dark");
  });

  it("does NOT find a symbol that was BORN in the window", () => {
    const before = tree({ "server/routers.ts": `export const route = () => 1;\n` });
    const after = tree({ "server/adminSecurity.ts": GATE, "server/routers.ts": `export const route = () => 1;\n` });
    expect(namesFound(before, after)).toEqual([]);
  });

  it("does NOT find a symbol DELETED outright — that is a different question", () => {
    const before = tree({ "server/adminSecurity.ts": GATE, "server/routers.ts": CALLER });
    const after = tree({ "server/routers.ts": `export const route = () => 1;\n` });
    expect(namesFound(before, after)).toEqual([]);
  });

  /**
   * A TEST IMPORTER IS NOT A PRODUCTION IMPORTER — the whole premise. A symbol
   * whose last remaining consumer is a suite governs nothing on a request path,
   * and invariant 7 is about exactly that.
   */
  it("counts a surviving TEST importer as no importer at all", () => {
    const suite = `import { isSensitiveAction } from "./adminSecurity";\nit("x", () => isSensitiveAction("delete"));\n`;
    const before = tree({ "server/adminSecurity.ts": GATE, "server/routers.ts": CALLER });
    const after = tree({ "server/adminSecurity.ts": GATE, "server/adminSecurity.test.ts": suite });
    expect(namesFound(before, after)).toEqual(["isSensitiveAction"]);
  });

  /**
   * THE DEFECT THAT NEARLY KILLED THE THESIS, kept as an arm.
   *
   * The first reading of these counts matched `import .*symbol` on ONE line.
   * The ordinary shape in this repo is a multi-line `import {\n  a,\n  b,\n}`,
   * so it read `prodImporters=0` on a live symbol at BOTH trees — a clean,
   * confident, wrong null. If this arm ever goes red the differ has stopped
   * seeing most of the repository's imports.
   */
  it("counts a MULTI-LINE import, which is the ordinary shape here", () => {
    const multiline = `import {\n  logAdminAction,\n  isSensitiveAction,\n} from "./adminSecurity";\n`
      + `export const route = (a: string) => isSensitiveAction(a) && logAdminAction(a);\n`;
    const source = tree({
      "server/adminSecurity.ts": GATE + `export function logAdminAction(a: string) {\n  return a;\n}\n`,
      "server/routers.ts": multiline,
    });
    expect(importerCount(readTree(source), "isSensitiveAction")).toBe(1);
    expect(importerCount(readTree(source), "logAdminAction")).toBe(1);
  });

  /**
   * THE SECOND CLEAN-NULL DEFECT, found the same way as the first — by
   * running it, not by reading it (2026-08-22, opus-1001).
   *
   * `show()` strips `root.length + 1` characters to make a path repo-relative,
   * so a RELATIVE root of "." chopped two characters off every path:
   * `server/x.ts` became `rver/x.ts`, the `startsWith("server/")` gate never
   * matched, and the reader declared ZERO exports while reporting that it had
   * walked 1,471 files. The differ's sanity control refused to report and that
   * is the control earning its place — but `check-cleanup-dispositions` now
   * shares this reader for its `rewired` door, and a door reading an empty
   * tree finds nothing to refuse.
   *
   * The arm drives the reader BOTH ways over the same fixture and asserts they
   * agree. It is written as a COMPARISON rather than a literal count, so it
   * cannot be quieted by editing a number.
   */
  it("reads a RELATIVE root exactly as it reads an absolute one", () => {
    const source = tree({ "server/adminSecurity.ts": GATE, "server/routers.ts": CALLER });
    const absolute = readTree(source);
    const previous = process.cwd();
    try {
      process.chdir(source);
      const relative = readTree(".");
      expect(relative.decl.size, "a relative root read no declarations at all").toBe(absolute.decl.size);
      expect(importerCount(relative, "isSensitiveAction")).toBe(
        importerCount(absolute, "isSensitiveAction"),
      );
      /* And the un-varied direction, so the arm cannot pass by both being empty. */
      expect(importerCount(absolute, "isSensitiveAction")).toBe(1);
    } finally {
      process.chdir(previous);
    }
  });
});

/**
 * ⚠ THE NAMESPACE HOP — THE READER'S THIRD CLEAN-NULL DEFECT, and the first
 * one found by asking what the instrument could not see rather than by it
 * misbehaving (2026-08-23).
 *
 * `import { isAccountLocked } from "../db"` was counted. This was not:
 *
 *     import * as db from "../db";
 *     const lockStatus = await db.isAccountLocked(user.openId);
 *
 * Both login routes reach the account lockout exactly that way, and it is the
 * house style of the whole database layer. Measured against the real tree
 * before the fix: **33 server exports were production-wired and counted zero**
 * — `isAccountLocked`, `recordFailedLogin`, `resetFailedLogins` and 28 board
 * operations among them.
 *
 * The consequence is the "toward silence" one, which is the direction this
 * reader must never fail in: **a symbol already counted at zero can never be
 * seen to FALL to zero.** Delete the lockout's call site tomorrow and the
 * differ reports nothing at all — the instrument the retirement program uses
 * to prove a control did not die is blind to that control dying. The second
 * arm below is that exact scenario, and it could not have been written before
 * the fix, because the count was zero at both ends.
 *
 * Every arm varies ONE property against the same shape, and the negative ones
 * are the point: a loose resolution would count `path.relative(…)` as a
 * consumer of any `relative` the server happens to export.
 */
describe("the namespace hop", () => {
  const LOCKOUT = `export async function isAccountLocked(id: string) {\n  return id === "x";\n}\n`;
  const NS_CALL = `import * as db from "./db";\nexport const login = (id: string) => db.isAccountLocked(id);\n`;

  it("counts a symbol reached through `import * as db` — the login lockout's own shape", () => {
    const source = tree({ "server/db.ts": LOCKOUT, "server/emailAuth.ts": NS_CALL });
    expect(importerCount(readTree(source), "isAccountLocked")).toBe(1);
    expect(readTree(source).prodImporters.get("isAccountLocked")).toEqual(["server/emailAuth.ts"]);
  });

  it("⚠ and REPORTS it when that call site disappears — the arm the blindness made impossible", () => {
    const before = tree({ "server/db.ts": LOCKOUT, "server/emailAuth.ts": NS_CALL });
    const after = tree({
      "server/db.ts": LOCKOUT,
      "server/emailAuth.ts": `import * as db from "./db";\nexport const login = (id: string) => db.upsertUser(id);\n`,
    });
    expect(namesFound(before, after)).toEqual(["isAccountLocked"]);
    /* the un-varied direction: it really was reachable before */
    expect(importerCount(readTree(before), "isAccountLocked")).toBe(1);
  });

  it("follows ONE re-export hop, because that is what a barrel is", () => {
    const source = tree({
      "server/db/security.ts": LOCKOUT,
      "server/db/index.ts": `export { isAccountLocked } from "./security";\n`,
      "server/emailAuth.ts": NS_CALL,
    });
    const t = readTree(source);
    expect(t.decl.get("isAccountLocked")).toBe("server/db/security.ts");
    expect(importerCount(t, "isAccountLocked")).toBe(1);
  });

  it("does NOT follow a barrel of barrels — the stated limit, pinned rather than assumed", () => {
    /*
      A second hop would need a transitive closure and every extra hop widens
      what an alias may claim. Unresolved reads as NO importer, which is the
      safe direction for this reader: it can produce a finding that turns out
      to be alive, never a silence about something that died.
    */
    const source = tree({
      "server/db/inner/deep.ts": LOCKOUT,
      "server/db/inner/index.ts": `export { isAccountLocked } from "./deep";\n`,
      "server/db/index.ts": `export { isAccountLocked } from "./inner";\n`,
      "server/emailAuth.ts": NS_CALL,
    });
    expect(importerCount(readTree(source), "isAccountLocked")).toBe(0);
    /* the same shape with ONE hop instead of two, so this arm cannot pass by
       the hop machinery being dead */
    const oneHop = tree({
      "server/db/inner/deep.ts": LOCKOUT,
      "server/db/index.ts": `export { isAccountLocked } from "./inner/deep";\n`,
      "server/emailAuth.ts": NS_CALL,
    });
    expect(importerCount(readTree(oneHop), "isAccountLocked")).toBe(1);
  });

  it("does NOT credit an alias that resolves to a module without the symbol", () => {
    const wrong = tree({
      "server/db.ts": LOCKOUT,
      "server/audit.ts": `export const trail = 1;\n`,
      "server/emailAuth.ts": `import * as audit from "./audit";\nexport const login = (id: string) => audit.isAccountLocked(id);\n`,
    });
    expect(importerCount(readTree(wrong), "isAccountLocked")).toBe(0);
    /* the same fixture with the ONE property varied — the alias now points at
       the declaring module, and the identical member access is counted */
    const right = tree({ "server/db.ts": LOCKOUT, "server/emailAuth.ts": NS_CALL });
    expect(importerCount(readTree(right), "isAccountLocked")).toBe(1);
  });

  it("does NOT credit a member access on a package import", () => {
    /*
      `path.relative(…)` against a server that exports `relative` is the loose
      reading's failure, and it is not hypothetical — half the member accesses
      in any file are on node builtins and npm packages.
    */
    const source = tree({
      "server/paths.ts": `export function relative(a: string) {\n  return a;\n}\n`,
      "server/routers.ts": `import path from "node:path";\nexport const p = () => path.relative("a", "b");\n`,
    });
    expect(importerCount(readTree(source), "relative")).toBe(0);
    /* the same member access on a RELATIVE binding — counted, so this arm
       cannot pass by the resolution being dead */
    const relativeBinding = tree({
      "server/paths.ts": `export function relative(a: string) {\n  return a;\n}\n`,
      "server/routers.ts": `import * as paths from "./paths";\nexport const p = () => paths.relative("a");\n`,
    });
    expect(importerCount(readTree(relativeBinding), "relative")).toBe(1);
  });

  it("counts a TEST file's namespace use as no importer, exactly as it does a named one", () => {
    const suite = `import * as db from "./db";\nit("x", () => db.isAccountLocked("x"));\n`;
    const source = tree({ "server/db.ts": LOCKOUT, "server/db.test.ts": suite });
    expect(importerCount(readTree(source), "isAccountLocked")).toBe(0);
    /* byte-for-byte the same consumer, named as production — counted */
    const production = tree({ "server/db.ts": LOCKOUT, "server/dbUse.ts": suite });
    expect(importerCount(readTree(production), "isAccountLocked")).toBe(1);
  });
});
