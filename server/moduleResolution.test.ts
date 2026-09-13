import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import {
  buildReexportMap,
  creditedDeclarations,
  reachableModules,
  resolveSpecifier,
} from "../scripts/lib/moduleResolution.mts";

/**
 * WHERE DOES THIS IMPORT POINT? — the shared resolver's controls (#274).
 *
 * Three instruments decide whether an exported symbol is still reached, and all
 * three used to answer on a BARE NAME, so a live twin credited its importers to
 * a dead one and the dead one never appeared on any list. This module is the
 * resolver that keys those readings on (file, symbol) instead.
 *
 * ⚠ **THE ARM THAT MATTERS MOST IS THE FAIL-SAFE ONE**, not the accuracy one.
 * Every caller uses this to NARROW a use from "any declaration of this name" to
 * "this one", so a resolution miss that silently narrowed to nothing would put
 * a LIVE export onto a deletion list. The contract is that an unplaceable
 * specifier credits everything, exactly as before the resolver existed — and
 * that is driven here in both directions, because a conservative fallback
 * nobody tests is indistinguishable from one that was never written.
 *
 * Driven against real temporary trees rather than mocked `existsSync`: the
 * whole job of this module is deciding what is on disk, so a fixture that
 * cannot answer that question proves nothing about it.
 */

const roots: string[] = [];
function tree(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "modres-"));
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

/** Sources keyed absolute, the shape both callers already hold. */
function sourcesOf(root: string, files: Record<string, string>): Map<string, string> {
  return new Map(Object.entries(files).map(([rel, src]) => [join(root, rel), src]));
}

describe("resolveSpecifier", () => {
  const files = {
    "client/src/foundation/brand.ts": `export const BRAND_NAME = "Klieg";\n`,
    "client/src/foundation/index.ts": `export { BRAND_NAME } from "./brand";\n`,
    "server/db/index.ts": `export { isAccountLocked } from "./security";\n`,
    "server/db/security.ts": `export function isAccountLocked() { return false; }\n`,
    "server/routes/login.ts": `import * as db from "../db";\n`,
  };

  it("places a relative specifier, trying extensions and index files", () => {
    const root = tree(files);
    expect(resolveSpecifier(join(root, "server/routes/login.ts"), "../db", root))
      .toBe(join(root, "server/db/index.ts"));
    expect(resolveSpecifier(join(root, "server/db/index.ts"), "./security", root))
      .toBe(join(root, "server/db/security.ts"));
  });

  it("places the client's `@/` alias, which is the house style it must not be blind to", () => {
    const root = tree(files);
    expect(resolveSpecifier(join(root, "client/src/pages/Any.tsx"), "@/foundation", root))
      .toBe(join(root, "client/src/foundation/index.ts"));
  });

  /*
    THE NEGATIVE CONTROLS. Each must return null rather than something
    plausible — a resolver that guesses is worse here than one that declines,
    because every caller reads null as "credit everything".
  */
  it("returns null for a package, and for a relative path that is not on disk", () => {
    const root = tree(files);
    expect(resolveSpecifier(join(root, "server/routes/login.ts"), "zod", root)).toBeNull();
    expect(resolveSpecifier(join(root, "server/routes/login.ts"), "@anthropic-ai/sdk", root)).toBeNull();
    expect(resolveSpecifier(join(root, "server/routes/login.ts"), "./nope", root)).toBeNull();
  });
});

describe("reachableModules", () => {
  it("follows a barrel to the module that actually declares the symbol", () => {
    const files = {
      "server/db/index.ts": `export { isAccountLocked } from "./security";\n`,
      "server/db/security.ts": `export function isAccountLocked() { return false; }\n`,
    };
    const root = tree(files);
    const reexports = buildReexportMap(sourcesOf(root, files), root);
    const reached = reachableModules(join(root, "server/db/index.ts"), reexports);
    expect(reached.has(resolve(join(root, "server/db/security.ts")))).toBe(true);
  });

  /*
    A BARREL OF BARRELS, which the sibling reader in importerCountDiff.mts
    deliberately does NOT follow. It is safe for that one to stop at one hop
    and read "no importer"; it is NOT safe here, where "no importer" is the
    verdict that proposes a deletion. So this walk is transitive, and the arm
    exists because the two readers differing on purpose is the kind of thing
    that gets "tidied" into agreement later.
  */
  it("follows a barrel of barrels, unlike the one-hop reader it sits beside", () => {
    const files = {
      "server/db/index.ts": `export { deep } from "./inner";\n`,
      "server/db/inner/index.ts": `export { deep } from "./deep";\n`,
      "server/db/inner/deep.ts": `export function deep() {}\n`,
    };
    const root = tree(files);
    const reexports = buildReexportMap(sourcesOf(root, files), root);
    const reached = reachableModules(join(root, "server/db/index.ts"), reexports);
    expect(reached.has(resolve(join(root, "server/db/inner/deep.ts")))).toBe(true);
  });

  it("terminates on a cyclic barrel instead of hanging", () => {
    const files = {
      "server/a.ts": `export * from "./b";\n`,
      "server/b.ts": `export * from "./a";\n`,
    };
    const root = tree(files);
    const reexports = buildReexportMap(sourcesOf(root, files), root);
    const reached = reachableModules(join(root, "server/a.ts"), reexports);
    expect(reached.has(resolve(join(root, "server/b.ts")))).toBe(true);
    expect(reached.size).toBe(2);
  });
});

describe("creditedDeclarations — the twin that hid a road", () => {
  /*
    THE CARD'S OWN SPECIMEN, rebuilt at the size that fits in a test: one name,
    two declarations, and an importer that reaches exactly one of them. The
    server twin is the legacy `BRAND_NAME = 'DRAPE'`; the client twin is the
    live one. Before #274 the client's single import counted as an importer of
    BOTH, so the dead server constant could never appear on a list of things
    nothing imports.
  */
  const files = {
    "server/casting/geminiPrompts.ts": `export const BRAND_NAME = 'DRAPE';\n`,
    "client/src/foundation/brand.ts": `export const BRAND_NAME = "Klieg";\n`,
    "client/src/foundation/index.ts": `export { BRAND_NAME } from "./brand";\n`,
    "client/src/features/staff/StaffBar.tsx": `import { BRAND_NAME } from "@/foundation";\n`,
  };
  const build = () => {
    const root = tree(files);
    return { root, reexports: buildReexportMap(sourcesOf(root, files), root) };
  };
  const serverTwin = (root: string) => join(root, "server/casting/geminiPrompts.ts");
  const clientTwin = (root: string) => join(root, "client/src/foundation/brand.ts");

  it("credits NOTHING to the server twin when the import reaches the client one through a barrel", () => {
    const { root, reexports } = build();
    expect(creditedDeclarations({
      fromFile: join(root, "client/src/features/staff/StaffBar.tsx"),
      spec: "@/foundation",
      /* What the sweep scans: server and shared only. */
      declaringFiles: [serverTwin(root)],
      /* What exists: both twins. Omitting the client one is the bug. */
      allDeclaringFiles: [serverTwin(root), clientTwin(root)],
      reexports,
      root,
    })).toEqual([]);
  });

  /*
    ⚠ THE SAME CALL WITHOUT THE OUT-OF-SCOPE TWIN, which is how the first
    version of this fix failed. With only the server declaration known there is
    "nothing to disambiguate", and the client's import goes on crediting the
    legacy constant — the bug surviving its own repair. This arm reddens if
    `allDeclaringFiles` ever stops being consulted.
  */
  it("credits the server twin anyway when the client twin is not declared to it — the bug's own shape", () => {
    const { root, reexports } = build();
    expect(creditedDeclarations({
      fromFile: join(root, "client/src/features/staff/StaffBar.tsx"),
      spec: "@/foundation",
      declaringFiles: [serverTwin(root)],
      allDeclaringFiles: [serverTwin(root)],
      reexports,
      root,
    })).toEqual([serverTwin(root)]);
  });

  it("credits the declaration the specifier genuinely reaches", () => {
    const { root, reexports } = build();
    expect(creditedDeclarations({
      fromFile: join(root, "server/casting/geminiService.ts"),
      spec: "./geminiPrompts",
      declaringFiles: [serverTwin(root)],
      allDeclaringFiles: [serverTwin(root), clientTwin(root)],
      reexports,
      root,
    })).toEqual([serverTwin(root)]);
  });

  /*
    ---- THE FAIL-SAFE DIRECTION ----

    Three ways of not knowing, and all three must credit EVERYTHING. If any of
    them returned [] the caller would report a live export as imported by
    nobody, which is how a deletion list acquires a symbol production calls.
  */
  it("credits every declaration when the specifier cannot be placed at all", () => {
    const { root, reexports } = build();
    for (const spec of ["some-package", "./does-not-exist", ""]) {
      expect(creditedDeclarations({
        fromFile: join(root, "client/src/features/staff/StaffBar.tsx"),
        spec,
        declaringFiles: [serverTwin(root)],
        allDeclaringFiles: [serverTwin(root), clientTwin(root)],
        reexports,
        root,
      })).toEqual([serverTwin(root)]);
    }
  });

  it("credits every declaration when the chain resolves but reaches no declaration of the name", () => {
    const files2 = {
      "server/x.ts": `export const SHARED = 1;\n`,
      "client/src/barrel.ts": `export { SOMETHING_ELSE } from "./other";\n`,
      "client/src/other.ts": `export const SOMETHING_ELSE = 2;\n`,
      "client/src/use.ts": `import { SHARED } from "./barrel";\n`,
    };
    const root = tree(files2);
    const reexports = buildReexportMap(sourcesOf(root, files2), root);
    expect(creditedDeclarations({
      fromFile: join(root, "client/src/use.ts"),
      spec: "./barrel",
      declaringFiles: [join(root, "server/x.ts")],
      allDeclaringFiles: [join(root, "server/x.ts")],
      reexports,
      root,
    })).toEqual([join(root, "server/x.ts")]);
  });

  it("credits nothing when there is nothing in scope to credit", () => {
    const { root, reexports } = build();
    expect(creditedDeclarations({
      fromFile: join(root, "client/src/features/staff/StaffBar.tsx"),
      spec: "@/foundation",
      declaringFiles: [],
      allDeclaringFiles: [clientTwin(root)],
      reexports,
      root,
    })).toEqual([]);
  });
});
