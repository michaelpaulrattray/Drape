import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import {
  classifyTimeline,
  newTimeline,
  observeTree,
  readTree,
  type TimelineKind,
} from "../scripts/lib/importerCountDiff.mts";

/**
 * THE UN-WIRING TIMELINE — the arms that need no `git worktree`.
 *
 * `scripts/unwiring-timeline.mts` walks the whole history and classifies every
 * symbol ever declared against HEAD. Its strongest controls are REAL — three of
 * this product's own accidents, one per class — and those need 241 checked-out
 * trees, so they ride the script. These are the arms the ordinary suite can
 * run, because a control you only run by hand is a control that stops being
 * run.
 *
 * ⚠ **THE ARM THAT MATTERS MOST IS `an intermediate boundary`.** The pairwise
 * differ's documented gap is that a symbol born and un-wired inside one window
 * is invisible. The half that was NOT documented until 2026-08-23 is what the
 * reading returns instead: **`dark-born`, which is the path-ONE road — written,
 * never wired** — for a symbol that was in fact wired and demolished. CLAUDE.md
 * spends a paragraph on why that is worse than reporting nothing: "never wired"
 * invites you to write the wiring, "un-wired" hands you a commit to read.
 * Measured on the real history, `isSensitiveAction` reads `dark-born` at stride
 * 400 and `died` at stride 10. The pair below is that fact as a property of the
 * classifier — the same three trees, observed and not observed, one variable.
 */

const roots: string[] = [];
function tree(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "timeline-"));
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
const SILENT = `export const route = (a: string) => a === "delete";\n`;

/** Walk the roots in order and classify against the last one, as the script does. */
function classify(...paths: string[]): Map<string, TimelineKind> {
  const timeline = newTimeline();
  let head = readTree(paths[0]!);
  for (let i = 0; i < paths.length; i++) {
    head = readTree(paths[i]!);
    observeTree(timeline, i, head);
  }
  return new Map(classifyTimeline(timeline, head).map((row) => [row.name, row.kind]));
}

describe("the un-wiring timeline", () => {
  it("calls a symbol that lost its last importer DIED", () => {
    const wired = tree({ "server/adminSecurity.ts": GATE, "server/routers.ts": CALLER });
    const dark = tree({ "server/adminSecurity.ts": GATE, "server/routers.ts": SILENT });
    expect(classify(wired, dark).get("isSensitiveAction")).toBe("died");
  });

  it("calls a symbol wired at every boundary WIRED-AT-HEAD", () => {
    const wired = tree({ "server/adminSecurity.ts": GATE, "server/routers.ts": CALLER });
    expect(classify(wired, wired, wired).get("isSensitiveAction")).toBe("wired-at-head");
  });

  it("⚠ calls a symbol wired, then dark, then wired again REVIVED — not wired-at-head", () => {
    /*
      The login-attack detector's own shape: importers at both ends and four and
      a half months of nothing in between. A reading that knows only the two
      ends cannot tell it from a symbol nobody ever touched, and that is the
      mis-filing CLAUDE.md carried for months.
    */
    const wired = tree({ "server/adminSecurity.ts": GATE, "server/routers.ts": CALLER });
    const dark = tree({ "server/adminSecurity.ts": GATE, "server/routers.ts": SILENT });
    expect(classify(wired, dark, wired).get("isSensitiveAction")).toBe("revived");
    /* the un-varied direction: without the dark boundary the same two ends are
       ordinary live code */
    expect(classify(wired, wired).get("isSensitiveAction")).toBe("wired-at-head");
  });

  it("calls a symbol that was wired and is now gone DELETED, not died", () => {
    const wired = tree({ "server/adminSecurity.ts": GATE, "server/routers.ts": CALLER });
    const gone = tree({ "server/routers.ts": SILENT });
    expect(classify(wired, gone).get("isSensitiveAction")).toBe("deleted");
  });

  it("calls a symbol nothing ever imported DARK-BORN", () => {
    const never = tree({ "server/adminSecurity.ts": GATE, "server/routers.ts": SILENT });
    expect(classify(never, never).get("isSensitiveAction")).toBe("dark-born");
    /* the un-varied direction, because EVERY symbol reads dark-born to a
       classifier that has stopped seeing importers at all — the one verdict
       this arm could otherwise be handed for free */
    const wired = tree({ "server/adminSecurity.ts": GATE, "server/routers.ts": CALLER });
    expect(classify(wired, wired).get("isSensitiveAction")).toBe("wired-at-head");
  });

  it("⚠ an intermediate boundary is the whole difference between path ONE and path THREE", () => {
    /*
      Three trees. The symbol does not exist in the first, is wired in the
      second, and is dark in the third — the shape of every control this
      product has lost, since a control is born, wired, and demolished, in that
      order, and rarely at a tile boundary.

      Observed:      died      — "wired at 2026-02-07, here is the commit"
      Not observed:  dark-born — "never had a production importer at all"

      One variable: whether the middle tree was read. The verdict flips between
      two roads that call for OPPOSITE repairs.
    */
    const before = tree({ "server/routers.ts": SILENT });
    const wired = tree({ "server/adminSecurity.ts": GATE, "server/routers.ts": CALLER });
    const dark = tree({ "server/adminSecurity.ts": GATE, "server/routers.ts": SILENT });

    expect(classify(before, wired, dark).get("isSensitiveAction")).toBe("died");
    expect(classify(before, dark).get("isSensitiveAction")).toBe("dark-born");
  });

  it("carries the importers it LOST, so the finding names where to look", () => {
    const wired = tree({ "server/adminSecurity.ts": GATE, "server/routers.ts": CALLER });
    const dark = tree({ "server/adminSecurity.ts": GATE, "server/routers.ts": SILENT });
    const timeline = newTimeline();
    observeTree(timeline, 0, readTree(wired));
    const head = readTree(dark);
    observeTree(timeline, 1, head);
    const row = classifyTimeline(timeline, head).find((r) => r.name === "isSensitiveAction")!;
    expect(row.kind).toBe("died");
    expect(row.lostImporters).toEqual(["server/routers.ts"]);
    expect(row.lastWiredIndex).toBe(0);
    /* and a symbol that never lost anything carries no phantom importers */
    const live = classifyTimeline(timeline, head).find((r) => r.name === "route")!;
    expect(live.lostImporters).toEqual([]);
  });

  it("counts every symbol exactly once across the classes", () => {
    /*
      The five classes are a PARTITION, and a classifier whose branches overlap
      double-counts silently — the shape that fired a court's own stop condition
      once already. Asserted as arithmetic rather than by reading the branches.
    */
    const before = tree({ "server/routers.ts": SILENT });
    const wired = tree({ "server/adminSecurity.ts": GATE, "server/routers.ts": CALLER });
    const dark = tree({ "server/adminSecurity.ts": GATE, "server/routers.ts": SILENT });
    const timeline = newTimeline();
    for (const [index, path] of [before, wired, dark].entries()) observeTree(timeline, index, readTree(path));
    const rows = classifyTimeline(timeline, readTree(dark));
    expect(rows.length).toBe(timeline.everDeclared.size);
    expect(new Set(rows.map((row) => row.name)).size).toBe(rows.length);
    expect(rows.length).toBeGreaterThan(1);
  });
});
