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
});
