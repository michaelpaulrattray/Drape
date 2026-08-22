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
 * ⚠ A DEAD IMPORT IS NOT AN IMPORTER — the reader's one bias toward NOISE, and
 * the only one that ever told a false story about a security control.
 *
 * The specimen is real. `server/routes/generation/castingRefinement.ts`
 * imported `checkUserRateLimit` at `1b8a07f2` and never called it. `916c8cc4`
 * removed the line in a dead-import cleanup — correctly, and its message says
 * so. To a reader counting import STATEMENTS that looked like the per-user rate
 * limiter losing its last call site, so the timeline told a four-month
 * dark-window story about a control that had never been invoked at all. Driven
 * at the code rather than inferred: `git log -S "checkUserRateLimit("` changes
 * count at its declaration (2026-02-05) and then not again until 2026-07-25.
 *
 * Measured at HEAD when this landed: 45 dead imports across 40 symbols, and for
 * SIX of them every counted importer was dead — read as wired, called by
 * nothing, which is the retirement program's question answered wrong.
 *
 * The rule is a MENTION and not a call, because a re-export, a type position
 * and an object shorthand are all real uses and none of them is a call.
 */
describe("a dead import", () => {
  const GUARD = `export function checkUserRateLimit(id: number): boolean {\n  return id > 0;\n}\n`;
  const DEAD = `import { checkUserRateLimit } from "./rateLimit";\nexport const route = (id: number) => id > 0;\n`;
  const LIVE = `import { checkUserRateLimit } from "./rateLimit";\nexport const route = (id: number) => checkUserRateLimit(id);\n`;

  it("⚠ is not counted — the specimen's own shape", () => {
    const dead = tree({ "server/rateLimit.ts": GUARD, "server/refinement.ts": DEAD });
    expect(importerCount(readTree(dead), "checkUserRateLimit")).toBe(0);
    /* the same fixture varied in ONE property: the name is used in the body */
    const live = tree({ "server/rateLimit.ts": GUARD, "server/refinement.ts": LIVE });
    expect(importerCount(readTree(live), "checkUserRateLimit")).toBe(1);
  });

  it("⚠ and REMOVING one is not a death", () => {
    /*
      The whole point. `916c8cc4` deleted a line that governed nothing, and the
      reader called it the loss of a control's last call site.
    */
    const before = tree({ "server/rateLimit.ts": GUARD, "server/refinement.ts": DEAD });
    const after = tree({
      "server/rateLimit.ts": GUARD,
      "server/refinement.ts": `export const route = (id: number) => id > 0;\n`,
    });
    expect(namesFound(before, after)).toEqual([]);
    /* and the un-varied direction — a REAL call site disappearing still is */
    const wasLive = tree({ "server/rateLimit.ts": GUARD, "server/refinement.ts": LIVE });
    expect(namesFound(wasLive, after)).toEqual(["checkUserRateLimit"]);
  });

  it("⚠ follows an ALIAS — the body says the new name, not the exported one", () => {
    /*
      `import { getApprovalStatus as getSlackApprovalStatus }` is the house
      style wherever two modules export the same word, and the Slack-approval
      trio is exactly that. Searching the body for the EXPORTED name finds
      nothing and calls a live consumer dead — silence, the one direction this
      reader must never fail in. Caught by checking a claim before writing it
      into CLAUDE.md, which is the only reason it was caught at all.
    */
    const aliased = tree({
      "server/rateLimit.ts": GUARD,
      "server/refinement.ts":
        `import { checkUserRateLimit as guard } from "./rateLimit";\n`
        + `export const route = (id: number) => guard(id);\n`,
    });
    expect(importerCount(readTree(aliased), "checkUserRateLimit")).toBe(1);
    /* and an alias that is imported and never used is still dead */
    const aliasedDead = tree({
      "server/rateLimit.ts": GUARD,
      "server/refinement.ts":
        `import { checkUserRateLimit as guard } from "./rateLimit";\n`
        + `export const route = (id: number) => id > 0;\n`,
    });
    expect(importerCount(readTree(aliasedDead), "checkUserRateLimit")).toBe(0);
  });

  it("counts a MENTION that is not a call — a re-export and a type position", () => {
    const reexport = tree({
      "server/rateLimit.ts": GUARD,
      "server/index.ts": `import { checkUserRateLimit } from "./rateLimit";\nexport const surface = { checkUserRateLimit };\n`,
    });
    expect(importerCount(readTree(reexport), "checkUserRateLimit")).toBe(1);
    const typePosition = tree({
      "server/rateLimit.ts": GUARD,
      "server/index.ts": `import { checkUserRateLimit } from "./rateLimit";\nexport type Guard = typeof checkUserRateLimit;\n`,
    });
    expect(importerCount(readTree(typePosition), "checkUserRateLimit")).toBe(1);
  });

  it("⚠ a BARE side-effect import does not swallow the body", () => {
    /*
      The first version of this rule stripped from `^import` to the next
      `from "…"`, and `import "dotenv/config";` has no `from` of its own — so
      the strip ran past it and deleted every line up to the next `from "…"`
      string anywhere below, use included. That reads as a dead import, which
      is SILENCE, which is the one direction this reader must never fail in.
      The body is spliced at the exact matches now, and this drives it.
    */
    const source = tree({
      "server/rateLimit.ts": GUARD,
      "server/refinement.ts":
        `import "dotenv/config";\n`
        + `import { checkUserRateLimit } from "./rateLimit";\n`
        + `const sql = 'select 1 from "users"';\n`
        + `export const route = (id: number) => checkUserRateLimit(id) && sql.length > 0;\n`,
    });
    expect(importerCount(readTree(source), "checkUserRateLimit")).toBe(1);
  });

  it("does not lose a use to an `import` word inside a comment or a string", () => {
    /*
      The strip is line-anchored for this reason. Over-stripping would delete
      real body text and push the reader toward SILENCE, which is the direction
      it must never fail in — so the failure mode is driven rather than trusted.
    */
    const source = tree({
      "server/rateLimit.ts": GUARD,
      "server/refinement.ts":
        `import { checkUserRateLimit } from "./rateLimit";\n`
        + `/* the docs say: import { x } from "./y"; and that is prose */\n`
        + `const sample = 'import { z } from "./z"';\n`
        + `export const route = (id: number) => checkUserRateLimit(id) && sample.length > 0;\n`,
    });
    expect(importerCount(readTree(source), "checkUserRateLimit")).toBe(1);
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
