import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { declKey, importersAt, readTree, type Tree } from "../scripts/lib/importerCountDiff.mts";

/**
 * THE DELETION DOOR'S SECOND READER — two readers, two resolvers (#274).
 *
 * The door (`scripts/check-cleanup-dispositions.mts`) decides whether a symbol
 * ruled for removal has come back, and it decides it with ONE reading:
 * `importersAt` from `lib/importerCountDiff.mts`, which resolves import
 * specifiers with `lib/moduleResolution.mts`. **A control that is its own only
 * witness has never been shown to discriminate** — working law 2, and #274's
 * own closing ask in its own words:
 *
 * > *"A second reader that does not share the resolver is the other half, per
 * > the Atlas's own rule: the Atlas's edge graph is module-granular and has
 * > always distinguished these two files, so it can answer 'does anything
 * > import `server/casting/geminiPrompts.ts`' without the name collision. Two
 * > readers, two resolvers."*
 *
 * # WHAT IT ASSERTS, AND WHY IT IS SOUND RATHER THAN MERELY STRICT
 *
 * The reader credits an importer file `A` to a DECLARATION `(F, S)`. It gets
 * there by resolving `A`'s specifier to some module and then walking re-export
 * barrels until it finds `F`. So every credit implies a claim about the module
 * graph: **`A` reaches `F` by importing.**
 *
 * The Atlas answers exactly that question, and it answers it through the
 * TypeScript compiler rather than through this repository's own resolver
 * (`scripts/generate-architecture.mts`). So: for every credit, there must be a
 * path `A → … → F` over the Atlas's `imports` edges. **No path at all means
 * the credit cannot be real**, whatever the name says.
 *
 * ⚠ **THE WALK IS TRANSITIVE AND UNBOUNDED ON PURPOSE, AND THAT IS WHAT MAKES
 * IT A SOUND REFUSAL RATHER THAN A NOISY ONE.** A re-export barrel is a real
 * hop the reader collapses and the Atlas does not: measured at HEAD, of 3,533
 * credits, **3,278 are a direct Atlas edge, 243 are two hops, 11 are three, and
 * exactly ONE has no path at any distance.** Demanding a DIRECT edge would
 * report 255 findings and all but one would be the two instruments correctly
 * describing the same barrel; demanding a path reports the one.
 *
 * # IT WAS BORN WITH A HIT, WHICH IS THE ARGUMENT FOR IT EXISTING
 *
 * The one no-path credit on its first run:
 *
 *     client/src/features/boards/canvas/canvasZoom.ts  →  server/_core/context.ts  (createContext)
 *
 * A client canvas module reading `import { createContext } from "react"`,
 * recorded as a production importer of the **tRPC request context**. The cause
 * is in `moduleResolution.mts`: a bare package specifier resolved to `null`,
 * and `null` meant *"credit every in-scope declaration"*. Repaired in the same
 * commit as this file — `isPackageSpecifier` — together with the `@shared/`
 * alias the resolver had never been taught, because calling THAT a package
 * would have been the dangerous half of the same repair.
 *
 * ⚠ **Its honest size: one credit, and the declaration had a real importer
 * besides, so no row in `cleanup-dispositions.yaml` moved.** Latent, not live.
 *
 * # WHAT IT CANNOT DO, STATED RATHER THAN DISCOVERED
 *
 * - **It cannot confirm a ZERO.** The Atlas is module-granular: a file with
 *   inbound edges says nothing about whether a particular export of it is
 *   reached. So the direction that would license a deletion — *nothing imports
 *   this symbol* — is NOT what this proves, and the reading below reports that
 *   population rather than asserting anything about it.
 * - **It sees only what both instruments walk.** The Atlas scans `server`,
 *   `client/src`, `shared` and `drizzle` and excludes test files; the reader
 *   walks `server`, `client`, `shared` and counts production importers only.
 *   A credit naming a file outside the Atlas is SKIPPED and counted out loud —
 *   a skip that nobody counts is how a reader comes to be looking at nothing.
 * - **It reads the COMMITTED Atlas.** `.githooks/atlas-stage` regenerates it on
 *   any commit touching a scanned root, so a branch carries the map of its own
 *   tree; a partial stage is the one case where it may not, and the hook says
 *   so at the time.
 */

const REPO = resolve(import.meta.dirname, "..");

type Atlas = {
  modules: { path: string }[];
  edges: { from: string; to: string; kind: string }[];
};

function readAtlas(): Atlas {
  return JSON.parse(
    readFileSync(resolve(REPO, "docs/architecture/drape-architecture.json"), "utf8"),
  ) as Atlas;
}

/** `module:client/src/App.tsx` -> `client/src/App.tsx`. */
const modulePath = (id: string) => id.replace(/^module:/, "");

function importGraph(atlas: Atlas): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const edge of atlas.edges) {
    if (edge.kind !== "imports") continue;
    const from = modulePath(edge.from);
    const set = out.get(from) ?? new Set<string>();
    set.add(modulePath(edge.to));
    out.set(from, set);
  }
  return out;
}

/** Every module reachable from `from` over import edges, visited-set bounded. */
function reachableFrom(graph: Map<string, Set<string>>, from: string): Set<string> {
  const seen = new Set<string>();
  const stack = [from];
  while (stack.length > 0) {
    const node = stack.pop()!;
    for (const target of graph.get(node) ?? []) {
      if (seen.has(target)) continue;
      seen.add(target);
      stack.push(target);
    }
  }
  return seen;
}

export type CrossReading = {
  credits: number;
  skipped: number;
  unreachable: string[];
};

/**
 * Cross-read one tree's credits against one Atlas.
 *
 * Exported and parameterised so the controls below can drive it against
 * FABRICATED inputs. A checker whose only exercise is today's clean tree has
 * never been shown able to fail — working law 2, and this repository's own
 * `check-cleanup-dispositions` docblock says the same thing in the same words.
 */
export function crossRead(tree: Tree, atlas: Atlas): CrossReading {
  const modules = new Set(atlas.modules.map((module) => module.path));
  const graph = importGraph(atlas);
  const reach = new Map<string, Set<string>>();
  const reading: CrossReading = { credits: 0, skipped: 0, unreachable: [] };

  for (const [key, importers] of tree.prodImportersAt) {
    const separator = key.lastIndexOf("::");
    const file = key.slice(0, separator);
    const symbol = key.slice(separator + 2);
    for (const importer of importers) {
      reading.credits += 1;
      if (!modules.has(importer) || !modules.has(file)) {
        reading.skipped += 1;
        continue;
      }
      let reachable = reach.get(importer);
      if (!reachable) {
        reachable = reachableFrom(graph, importer);
        reach.set(importer, reachable);
      }
      if (!reachable.has(file)) reading.unreachable.push(`${importer} -> ${file} (${symbol})`);
    }
  }
  return reading;
}

describe("the deletion door's second reader", () => {
  const atlas = readAtlas();
  const tree = readTree(REPO);

  /*
    CONTROLS FIRST (working law 2). Both run against fabricated inputs, because
    a cross-reader exercised only on a tree that happens to agree cannot be told
    apart from one that returns an empty list whatever it is given.
  */
  it("REPORTS a credit the Atlas cannot reach — the positive control", () => {
    const fabricated: Tree = {
      decls: new Map([["ghost", ["server/ghost.ts"]]]),
      prodImportersAt: new Map([[declKey("server/ghost.ts", "ghost"), ["client/src/elsewhere.ts"]]]),
      selfUsesAt: new Map(),
      declsAnywhere: new Map(),
      files: 2,
    };
    const reading = crossRead(fabricated, {
      modules: [{ path: "server/ghost.ts" }, { path: "client/src/elsewhere.ts" }],
      edges: [],
    });
    expect(reading.credits).toBe(1);
    expect(reading.skipped).toBe(0);
    expect(reading.unreachable).toEqual(["client/src/elsewhere.ts -> server/ghost.ts (ghost)"]);
  });

  it("accepts a credit reached only through a barrel — the negative control", () => {
    const fabricated: Tree = {
      decls: new Map([["real", ["server/db/security.ts"]]]),
      prodImportersAt: new Map([[declKey("server/db/security.ts", "real"), ["server/routes/auth.ts"]]]),
      selfUsesAt: new Map(),
      declsAnywhere: new Map(),
      files: 3,
    };
    const reading = crossRead(fabricated, {
      modules: [
        { path: "server/db/security.ts" },
        { path: "server/db/index.ts" },
        { path: "server/routes/auth.ts" },
      ],
      /* auth -> index -> security: the reader collapses this, the Atlas does not. */
      edges: [
        { from: "module:server/routes/auth.ts", to: "module:server/db/index.ts", kind: "imports" },
        { from: "module:server/db/index.ts", to: "module:server/db/security.ts", kind: "imports" },
      ],
    });
    expect(reading.credits).toBe(1);
    expect(reading.unreachable).toEqual([]);
  });

  it("counts a credit it had to skip rather than passing it silently", () => {
    const fabricated: Tree = {
      decls: new Map([["offstage", ["server/offstage.ts"]]]),
      prodImportersAt: new Map([[declKey("server/offstage.ts", "offstage"), ["scripts/tool.mts"]]]),
      selfUsesAt: new Map(),
      declsAnywhere: new Map(),
      files: 2,
    };
    const reading = crossRead(fabricated, { modules: [{ path: "server/offstage.ts" }], edges: [] });
    expect(reading.skipped).toBe(1);
    expect(reading.unreachable).toEqual([]);
  });

  /* Only now does a verdict on the real tree mean anything. */
  it("the instrument is looking at something — both populations are real", () => {
    expect(atlas.modules.length).toBeGreaterThan(500);
    expect(atlas.edges.filter((edge) => edge.kind === "imports").length).toBeGreaterThan(2000);
    expect(tree.prodImportersAt.size).toBeGreaterThan(500);
  });

  it("every credit the door acts on is a path the Atlas holds", () => {
    const reading = crossRead(tree, atlas);
    expect(reading.credits).toBeGreaterThan(1000);
    /* A skip is a file one instrument walks and the other does not. Today there
       are none; if that changes it is a scope question, not a licence to skip. */
    expect(reading.skipped).toBe(0);
    expect(reading.unreachable).toEqual([]);
  });

  it("says out loud what it does NOT prove: the zeros are reported, never asserted", () => {
    const graph = importGraph(atlas);
    const inbound = new Set<string>();
    for (const [, targets] of graph) for (const target of targets) inbound.add(target);

    let zeros = 0;
    let zerosInsideAnImportedFile = 0;
    for (const [symbol, files] of tree.decls) {
      for (const file of files) {
        if (importersAt(tree, file, symbol).length > 0) continue;
        zeros += 1;
        if (inbound.has(file)) zerosInsideAnImportedFile += 1;
      }
    }
    /*
      The Atlas is module-granular, so `zerosInsideAnImportedFile` is NOT a
      finding — the importers of that file may take other exports entirely. It
      is asserted only as a floor, so that this arm cannot quietly become an
      assertion that the Atlas confirms a zero. It never can.
    */
    expect(zeros).toBeGreaterThan(0);
    expect(zerosInsideAnImportedFile).toBeLessThanOrEqual(zeros);
  });
});
